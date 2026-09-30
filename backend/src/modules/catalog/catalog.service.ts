import prisma from "../../config/database.js";
import { ConflictError, NotFoundError } from "../../utils/errors.js";
import { logger } from "../../utils/logger.js";
import { liveLookup } from "./catalog.off.js";
import type { CatalogAddInput } from "./catalog.schema.js";
import { SHELF_NAMES, shelfFromName } from "./categories.js";
import { barcodeVariants, canonicalBarcode, isCatalogBarcode } from "./gtin.js";
import { cleanName, displayName } from "./names.js";

export interface CatalogHit {
  found: true;
  barcode: string;
  name: string;
  brand: string | null;
  quantity: string | null;
  category: string | null;
  /** brand + name + pack size, ready to become the product's name */
  displayName: string;
  /** snapshot — shipped with the app; off — found live and remembered; crowd — entered by a shop */
  source: string;
}

export interface CatalogMiss {
  found: false;
  barcode: string;
  /** false: not a world-unique product code (mistyped, cut short, or a shop's own label) */
  valid: boolean;
}

interface Row {
  barcode: string;
  name: string;
  brand: string | null;
  quantity: string | null;
  category: string | null;
  source: string;
}

const toHit = (row: Row): CatalogHit => ({
  found: true,
  barcode: row.barcode,
  name: row.name,
  brand: row.brand,
  quantity: row.quantity,
  // Where the record names no shelf, the name itself often does ("Молоко Простоквашино").
  category: row.category ?? shelfFromName(row.name),
  displayName: displayName(row.name, row.quantity, row.brand),
  source: row.source,
});

// Codes nobody knew are not asked about again for half a day: a shop that scans
// the same unlisted item twenty times should cost the public API one request.
const MISS_TTL_MS = 12 * 60 * 60 * 1000;
const MISS_LIMIT = 20_000;
const misses = new Map<string, number>();
const inflight = new Map<string, Promise<CatalogHit | null>>();

function knownMiss(code: string): boolean {
  const until = misses.get(code);
  if (until === undefined) return false;
  if (until < Date.now()) {
    misses.delete(code);
    return false;
  }
  return true;
}

function rememberMiss(code: string): void {
  if (misses.size >= MISS_LIMIT) misses.delete(misses.keys().next().value as string);
  misses.set(code, Date.now() + MISS_TTL_MS);
}

const PALETTE = ["#ef4444", "#f59e0b", "#10b981", "#3b82f6", "#8b5cf6", "#ec4899", "#14b8a6", "#f97316"];
const colorFor = (name: string) => PALETTE[Array.from(name).reduce((sum, ch) => sum + ch.charCodeAt(0), 0) % PALETTE.length];
const same = (a: string, b: string) => a.toLowerCase().replace(/\s+/g, " ").trim() === b.toLowerCase().replace(/\s+/g, " ").trim();

let statsCache: { at: number; value: { total: number; crowd: number } } | null = null;

export class CatalogService {
  /** What is known about a barcode: our own base first, then — once — the public catalogues. */
  async lookup(rawCode: string): Promise<CatalogHit | CatalogMiss> {
    const code = rawCode.trim();
    if (!isCatalogBarcode(code)) return { found: false, barcode: code, valid: false };
    const canonical = canonicalBarcode(code);

    const stored = await prisma.catalogProduct.findFirst({ where: { barcode: { in: barcodeVariants(code) } } });
    if (stored) return toHit(stored);
    if (knownMiss(canonical)) return { found: false, barcode: canonical, valid: true };

    const live = await this.askLive(canonical);
    return live ?? { found: false, barcode: canonical, valid: true };
  }

  // Simultaneous scans of one unknown code share a single trip to the network.
  private askLive(code: string): Promise<CatalogHit | null> {
    let pending = inflight.get(code);
    if (!pending) {
      pending = this.fetchLive(code).finally(() => inflight.delete(code));
      inflight.set(code, pending);
    }
    return pending;
  }

  private async fetchLive(code: string): Promise<CatalogHit | null> {
    const { product, complete } = await liveLookup(code);
    if (!product) {
      if (complete) rememberMiss(code);
      return null;
    }
    const row = await prisma.catalogProduct.upsert({
      where: { barcode: code },
      create: { barcode: code, ...product, source: "off" },
      update: {},
    });
    return toHit(row);
  }

  /**
   * A shop's own product enriches the shared base: only the barcode, the name and
   * the shelf leave the shop — never a price or a stock figure — and only if the
   * shop has not opted out. Never throws: sharing must not break saving a product.
   */
  async contribute(tenantId: string, item: { barcode?: string | null; name: string; category?: string | null }): Promise<void> {
    try {
      const code = (item.barcode ?? "").trim();
      if (!isCatalogBarcode(code)) return;
      const name = cleanName(item.name);
      if (name.length < 2 || /^[\d\s.,-]+$/.test(name)) return;

      const tenant = await prisma.tenant.findUnique({ where: { id: tenantId }, select: { catalogSharing: true } });
      if (!tenant?.catalogSharing) return;

      const existing = await prisma.catalogProduct.findFirst({ where: { barcode: { in: barcodeVariants(code) } } });
      if (!existing) {
        // Only the fixed list of shelf names is shared — a shop's own category names stay its own.
        const shelf = item.category && SHELF_NAMES.includes(item.category) ? item.category : null;
        await prisma.catalogProduct.create({ data: { barcode: canonicalBarcode(code), name, category: shelf, source: "crowd" } });
        return;
      }
      // Another shop typed the very same name: that is a confirmation, nothing more.
      // What the shipped snapshot or the public catalogues say is never overwritten.
      if (existing.source === "crowd" && same(displayName(existing.name, existing.quantity, existing.brand), name)) {
        await prisma.catalogProduct.update({ where: { barcode: existing.barcode }, data: { confirmations: { increment: 1 } } });
      }
    } catch (error) {
      // A racing insert of the same code from another shop lands here too — that is fine.
      logger.warn("Catalogue contribution skipped", { message: error instanceof Error ? error.message : String(error) });
    }
  }

  /** Creates the shop's product from a scan: the catalogue supplied the name, the shop supplies the price. */
  async add(tenantId: string, input: CatalogAddInput) {
    const tenant = await prisma.tenant.findUnique({ where: { id: tenantId }, select: { defaultMarkupPercent: true } });

    const product = await prisma.$transaction(async (tx) => {
      const duplicate = await tx.product.findFirst({ where: { tenantId, barcode: { in: barcodeVariants(input.barcode) } }, select: { id: true, name: true, isActive: true } });
      if (duplicate?.isActive) throw new ConflictError(`Товар с этим штрихкодом уже есть: «${duplicate.name}»`);
      // Archived earlier: adding it again means bringing it back, at the price just entered.
      if (duplicate) return tx.product.update({ where: { id: duplicate.id }, data: { isActive: true, price: input.price }, include: { category: true } });

      let categoryId: string | null = null;
      if (input.categoryId) {
        const owned = await tx.category.findFirst({ where: { id: input.categoryId, tenantId }, select: { id: true } });
        if (!owned) throw new NotFoundError("Категория не найдена");
        categoryId = owned.id;
      } else if (input.categoryName) {
        const wanted = input.categoryName.toLowerCase();
        const shelves = await tx.category.findMany({ where: { tenantId, isIngredient: false }, select: { id: true, name: true } });
        categoryId =
          shelves.find((shelf) => shelf.name.trim().toLowerCase() === wanted)?.id ??
          (await tx.category.create({ data: { tenantId, name: input.categoryName, color: colorFor(input.categoryName), markupPercent: tenant?.defaultMarkupPercent ?? 0 } })).id;
      }

      return tx.product.create({
        data: {
          tenantId,
          categoryId,
          name: input.name,
          barcode: input.barcode,
          price: input.price,
          costPrice: input.costPrice ?? 0,
          unit: input.weighed ? "kg" : "piece",
          saleUnit: input.weighed ? "кг" : null,
          trackInventory: input.stock !== undefined,
          currentStock: input.stock ?? 0,
        },
        include: { category: true },
      });
    });

    void this.contribute(tenantId, { barcode: product.barcode, name: product.name, category: product.category?.name });
    return product;
  }

  async stats() {
    if (statsCache && Date.now() - statsCache.at < 5 * 60_000) return statsCache.value;
    const [total, crowd] = await Promise.all([prisma.catalogProduct.count(), prisma.catalogProduct.count({ where: { source: "crowd" } })]);
    statsCache = { at: Date.now(), value: { total, crowd } };
    return statsCache.value;
  }
}

export const catalogService = new CatalogService();
