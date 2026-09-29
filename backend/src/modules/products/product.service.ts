import prisma from "../../config/database.js";
import type { CreateProductInput, UpdateProductInput, ProductQueryInput } from "./product.schema.js";
import { AppError, NotFoundError } from "../../utils/errors.js";

export class ProductService {
  async findAll(tenantId: string, query: ProductQueryInput) {
    const { search, categoryId, isActive = true, isIngredient, minPrice, maxPrice, inStock, sort = "sortOrder", order = "asc", page = 1, limit = 20 } = query;
    const skip = (page - 1) * limit;

    // Every filter is its own AND clause: a previous version put both the
    // text search and the ingredient filter on `where.OR`, so whichever ran
    // last silently replaced the other.
    const and: any[] = [];
    const where: any = { tenantId, AND: and };
    if (search) {
      and.push({
        OR: [
          { name: { contains: search } },
          { sku: { contains: search } },
          { barcode: { contains: search } },
        ],
      });
    }
    if (categoryId) where.categoryId = categoryId;
    if (isActive !== undefined) where.isActive = isActive;
    if (isIngredient === false) {
      and.push({ isIngredient: false });
      and.push({ OR: [{ categoryId: null }, { category: { isIngredient: false } }] });
    } else if (isIngredient === true) {
      and.push({ OR: [{ isIngredient: true }, { category: { isIngredient: true } }] });
    }
    if (minPrice !== undefined) where.price = { ...where.price, gte: minPrice };
    if (maxPrice !== undefined) where.price = { ...where.price, lte: maxPrice };
    if (inStock !== undefined) {
      where.currentStock = inStock ? { gt: 0 } : { lte: 0 };
    }

    const orderBy: any = { [sort]: order };

    const [products, total] = await Promise.all([
      prisma.product.findMany({
        where,
        include: {
          category: { select: { id: true, name: true, color: true } },
          techCardRef: { select: { id: true, name: true, totalCost: true, output: true, unit: true, ingredients: true } },
          modifierGroups: {
            include: {
              modifierGroup: {
                include: { modifierItems: { where: { isActive: true }, orderBy: { sortOrder: "asc" } } },
              },
            },
          },
        },
        orderBy,
        skip,
        take: limit,
      }),
      prisma.product.count({ where }),
    ]);

    return { products, total, page, limit };
  }

  async findById(tenantId: string, id: string) {
    const product = await prisma.product.findFirst({
      where: { id, tenantId },
      include: {
        category: true,
        techCardRef: true,
        modifierGroups: {
          include: {
            modifierGroup: {
              include: { modifierItems: { orderBy: { sortOrder: "asc" } } },
            },
          },
        },
      },
    });
    if (!product) throw new NotFoundError("Товар не найден");
    return product;
  }

  // Ids that arrive from the client must belong to the caller's tenant —
  // otherwise a product could be attached to another shop's category or
  // recipe.
  private async assertReferencesOwned(tenantId: string, data: { categoryId?: string | null; techCardId?: string | null }) {
    if (data.categoryId) {
      const category = await prisma.category.findFirst({ where: { id: data.categoryId, tenantId } });
      if (!category) throw new NotFoundError("Категория не найдена");
    }
    if (data.techCardId) {
      const techCard = await prisma.techCard.findFirst({ where: { id: data.techCardId, tenantId } });
      if (!techCard) throw new NotFoundError("Техкарта не найдена");
    }
  }

  async create(tenantId: string, data: CreateProductInput) {
    await this.assertReferencesOwned(tenantId, data);
    const { tags, techCard, ...rest } = data;

    let conversionFactor = data.conversionFactor;
    if (data.purchaseUnit && data.saleUnit && !conversionFactor) {
      conversionFactor = this.calculateConversionFactor(data.purchaseUnit, data.saleUnit);
    }

    return prisma.product.create({
      data: {
        ...rest,
        tenantId,
        conversionFactor,
        tags: tags ? JSON.stringify(tags) : undefined,
        techCard: techCard !== undefined ? JSON.stringify(techCard) : undefined,
      },
      include: { category: true, techCardRef: true },
    });
  }

  async update(tenantId: string, id: string, data: UpdateProductInput) {
    const product = await prisma.product.findFirst({ where: { id, tenantId } });
    if (!product) throw new NotFoundError("Товар не найден");
    await this.assertReferencesOwned(tenantId, data);

    const { tags, techCard, ...rest } = data;

    let conversionFactor = data.conversionFactor;
    if (data.purchaseUnit && data.saleUnit && !conversionFactor) {
      conversionFactor = this.calculateConversionFactor(data.purchaseUnit, data.saleUnit);
    }

    return prisma.product.update({
      where: { id },
      data: {
        ...rest,
        conversionFactor,
        tags: tags !== undefined ? JSON.stringify(tags) : undefined,
        techCard: techCard !== undefined ? JSON.stringify(techCard) : undefined,
      },
      include: { category: true, techCardRef: true },
    });
  }

  private calculateConversionFactor(purchaseUnit: string, saleUnit: string): number | undefined {
    const conversions: Record<string, Record<string, number>> = {
      "кг": { "г": 1000 },
      "л": { "мл": 1000 },
      "упаковка": { "г": 1000, "мл": 1000 },
    };
    return conversions[purchaseUnit]?.[saleUnit];
  }

  async calculateTechCardCost(tenantId: string, productId: string): Promise<number> {
    const product = await prisma.product.findFirst({
      where: { id: productId, tenantId },
      include: { techCardRef: true },
    });
    if (!product) throw new NotFoundError("Товар не найден");

    if (product.techCardRef) {
      return product.techCardRef.totalCost;
    }

    const techCard = JSON.parse(product.techCard || "[]") as { ingredientId: string; quantity: number; unit: string }[];
    if (techCard.length === 0) return product.costPrice;

    let totalCost = 0;
    for (const item of techCard) {
      const ingredient = await prisma.product.findFirst({
        where: { id: item.ingredientId, tenantId },
      });
      if (ingredient) {
        totalCost += ingredient.costPrice * item.quantity;
      }
    }

    return totalCost;
  }

  async getIngredients(tenantId: string) {
    return prisma.product.findMany({
      where: { tenantId, isIngredient: true, isActive: true },
      select: {
        id: true,
        name: true,
        sku: true,
        costPrice: true,
        currentStock: true,
        unit: true,
        purchaseUnit: true,
        saleUnit: true,
      },
      orderBy: { name: "asc" },
    });
  }

  async delete(tenantId: string, id: string) {
    const product = await prisma.product.findFirst({ where: { id, tenantId } });
    if (!product) throw new NotFoundError("Товар не найден");

    await prisma.product.update({
      where: { id },
      data: { isActive: false },
    });
    return { message: "Product deactivated" };
  }

  async adjustStock(tenantId: string, productId: string, quantity: number, reason: string, userId: string) {
    const product = await prisma.product.findFirst({ where: { id: productId, tenantId } });
    if (!product) throw new NotFoundError("Товар не найден");

    const newStock = product.currentStock + quantity;
    if (newStock < 0) throw new AppError("Недостаточно остатка");

    const [updated] = await prisma.$transaction([
      prisma.product.update({
        where: { id: productId },
        data: { currentStock: newStock },
      }),
      prisma.inventoryMovement.create({
        data: {
          tenantId,
          productId,
          type: quantity > 0 ? "in" : "out",
          quantity: Math.abs(quantity),
          reason,
          userId,
        },
      }),
    ]);

    return updated;
  }
}

export const productService = new ProductService();
