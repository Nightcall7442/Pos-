import { PrismaClient } from "@prisma/client";
import bcrypt from "bcryptjs";
import { pathToFileURL } from "node:url";

// Демо-магазин для новой кассы: сканер, весовой товар, быстрые кнопки.
// Запуск отдельно: npx tsx prisma/seed-retail.ts — существующие данные не трогает.

// EAN-13 с настоящей контрольной цифрой: 478 — префикс GS1 Узбекистана, дальше
// 9 цифр товара. Так вымышленные штрихкоды проходят проверку любого сканера.
function ean13(body12: string): string {
  const sum = body12.split("").reduce((acc, d, i) => acc + Number(d) * (i % 2 === 0 ? 1 : 3), 0);
  return body12 + String((10 - (sum % 10)) % 10);
}
const code = (n: number): string => ean13("478" + String(n).padStart(9, "0"));

interface Item {
  name: string;
  price: number;
  cost: number;
  stock: number;
  min?: number;
  barcode?: string | null; // null — у товара штрихкода нет (хлеб, овощи на вес)
  sku?: string; // короткий код: для весовых — номер на весах
  weighed?: boolean; // цена и остаток — за килограмм
  quick?: boolean; // быстрая кнопка на кассе
}

const CATALOG: Record<string, { color: string; items: Item[] }> = {
  "Молочные продукты": {
    color: "#3b82f6",
    items: [
      { name: "Молоко «Лактис» 3,2% 1 л", price: 13500, cost: 10800, stock: 60, min: 12, barcode: code(11) },
      { name: "Молоко «Лактис» 1,5% 1 л", price: 12800, cost: 10200, stock: 40, min: 12, barcode: code(12) },
      { name: "Кефир «Лактис» 1 л", price: 13000, cost: 10400, stock: 28, min: 10, barcode: code(13) },
      { name: "Сметана 20% 400 г", price: 18500, cost: 14800, stock: 24, min: 8, barcode: code(14) },
      { name: "Йогурт клубничный 250 г", price: 8500, cost: 6600, stock: 36, min: 12, barcode: code(15) },
      { name: "Творог 5% 200 г", price: 11000, cost: 8800, stock: 20, min: 6, barcode: code(16) },
      { name: "Масло сливочное 180 г", price: 24000, cost: 19500, stock: 18, min: 6, barcode: code(17) },
      { name: "Яйца С1, 10 шт", price: 24000, cost: 19800, stock: 45, min: 10, barcode: code(42) },
      { name: "Сыр «Голландский»", price: 92000, cost: 76000, stock: 6.8, min: 2, sku: "212", weighed: true },
    ],
  },
  "Хлеб и выпечка": {
    color: "#f59e0b",
    items: [
      { name: "Хлеб «Нон» белый", price: 4500, cost: 3000, stock: 80, min: 20, barcode: null, sku: "N01", quick: true },
      { name: "Хлеб «Нон» чёрный", price: 5000, cost: 3400, stock: 50, min: 15, barcode: null, sku: "N02", quick: true },
      { name: "Лепёшка тандырная", price: 3000, cost: 1900, stock: 120, min: 30, barcode: null, sku: "N03", quick: true },
      { name: "Батон нарезной", price: 6500, cost: 4400, stock: 40, min: 10, barcode: null, sku: "N04" },
      { name: "Самса с мясом", price: 9000, cost: 6200, stock: 36, min: 10, barcode: null, sku: "N05" },
      { name: "Булочка с маком", price: 3500, cost: 2200, stock: 60, min: 15, barcode: null, sku: "N06" },
    ],
  },
  "Овощи и фрукты": {
    color: "#22c55e",
    items: [
      { name: "Яблоки «Семиренко»", price: 18000, cost: 12500, stock: 84.2, min: 15, sku: "104", weighed: true },
      { name: "Бананы", price: 21000, cost: 15500, stock: 36, min: 10, sku: "105", weighed: true },
      { name: "Помидоры тепличные", price: 15000, cost: 10500, stock: 22, min: 8, sku: "106", weighed: true },
      { name: "Огурцы", price: 12000, cost: 8500, stock: 18, min: 8, sku: "107", weighed: true },
      { name: "Картофель", price: 6000, cost: 3800, stock: 140, min: 30, sku: "108", weighed: true },
      { name: "Морковь", price: 5000, cost: 3200, stock: 9, min: 15, sku: "109", weighed: true },
      { name: "Лук репчатый", price: 4500, cost: 2900, stock: 75, min: 20, sku: "110", weighed: true },
      { name: "Лимоны", price: 28000, cost: 21000, stock: 6, min: 10, sku: "111", weighed: true },
      { name: "Виноград «Кишмиш»", price: 32000, cost: 24000, stock: 0, min: 5, sku: "112", weighed: true },
      { name: "Баклажаны", price: 14000, cost: 9800, stock: 15, min: 6, sku: "113", weighed: true },
      { name: "Перец болгарский", price: 26000, cost: 19000, stock: 11, min: 5, sku: "114", weighed: true },
      { name: "Гранат", price: 22000, cost: 15500, stock: 30, min: 8, sku: "116", weighed: true },
      { name: "Зелень: укроп, пучок", price: 3000, cost: 1800, stock: 24, min: 8, barcode: null, sku: "115" },
    ],
  },
  "Мясо и птица": {
    color: "#ef4444",
    items: [
      { name: "Куриное филе", price: 42000, cost: 34000, stock: 18, min: 5, sku: "201", weighed: true },
      { name: "Говядина мякоть", price: 95000, cost: 80000, stock: 12, min: 4, sku: "202", weighed: true },
      { name: "Фарш говяжий", price: 78000, cost: 64000, stock: 9, min: 4, sku: "203", weighed: true },
      { name: "Колбаса «Докторская»", price: 68000, cost: 54000, stock: 5.4, min: 2, sku: "204", weighed: true },
      { name: "Сосиски «Молочные» 400 г", price: 26000, cost: 20500, stock: 22, min: 6, barcode: code(33) },
    ],
  },
  "Бакалея": {
    color: "#a16207",
    items: [
      { name: "Рис «Лазер» 1 кг", price: 16000, cost: 13000, stock: 50, min: 12, barcode: code(34) },
      { name: "Гречка 800 г", price: 19500, cost: 16000, stock: 34, min: 10, barcode: code(35) },
      { name: "Макароны спагетти 500 г", price: 9000, cost: 7000, stock: 48, min: 12, barcode: code(36) },
      { name: "Сахар 1 кг", price: 14000, cost: 11500, stock: 60, min: 15, barcode: code(37) },
      { name: "Соль 1 кг", price: 3500, cost: 2500, stock: 40, min: 10, barcode: code(38) },
      { name: "Масло подсолнечное «Олейна» 1 л", price: 21000, cost: 17500, stock: 30, min: 8, barcode: code(39) },
      { name: "Мука пшеничная 2 кг", price: 22000, cost: 17800, stock: 26, min: 8, barcode: code(40) },
      { name: "Чай «Ахмад» чёрный 100 г", price: 32000, cost: 26000, stock: 20, min: 6, barcode: code(41) },
      { name: "Кофе Nescafé Gold 95 г", price: 58000, cost: 48000, stock: 14, min: 4, barcode: "8710447000021" },
    ],
  },
  "Напитки": {
    color: "#06b6d4",
    items: [
      { name: "Кока-кола 1,5 л", price: 14500, cost: 11800, stock: 96, min: 24, barcode: "5449000000996" },
      { name: "Фанта 1,5 л", price: 14500, cost: 11800, stock: 48, min: 12, barcode: code(44) },
      { name: "Вода «Bonaqua» 1,5 л", price: 5500, cost: 3800, stock: 120, min: 30, barcode: code(45) },
      { name: "Сок яблочный 1 л", price: 15000, cost: 11800, stock: 30, min: 8, barcode: code(46) },
      { name: "Чай холодный Lipton 1 л", price: 13000, cost: 10200, stock: 24, min: 8, barcode: code(47) },
    ],
  },
  "Сладости": {
    color: "#ec4899",
    items: [
      { name: "Шоколад Alpen Gold 90 г", price: 14000, cost: 11000, stock: 40, min: 10, barcode: code(48) },
      { name: "Печенье «Юбилейное» 200 г", price: 12000, cost: 9200, stock: 32, min: 8, barcode: code(49) },
      { name: "Конфеты «Ассорти»", price: 65000, cost: 52000, stock: 7.5, min: 2, sku: "301", weighed: true },
      { name: "Мороженое пломбир 80 г", price: 7500, cost: 5400, stock: 44, min: 12, barcode: code(51) },
    ],
  },
  "Бытовая химия и прочее": {
    color: "#8b5cf6",
    items: [
      { name: "Порошок стиральный 3 кг", price: 78000, cost: 64000, stock: 12, min: 4, barcode: code(52) },
      { name: "Средство для посуды 500 мл", price: 16500, cost: 12800, stock: 26, min: 8, barcode: code(53) },
      { name: "Туалетная бумага 4 рулона", price: 18000, cost: 14000, stock: 40, min: 10, barcode: code(55) },
      { name: "Пакет фасовочный", price: 500, cost: 200, stock: 2000, min: 200, barcode: null, sku: "P01", quick: true },
    ],
  },
};

export async function seedRetail(prisma: PrismaClient): Promise<void> {
  const existing = await prisma.tenant.findUnique({ where: { slug: "demo-market" } });
  if (existing) {
    console.log("Демо-магазин уже есть (demo-market) — пропускаю");
    return;
  }

  const tenant = await prisma.tenant.create({
    data: {
      name: "Продукты «Барака»",
      slug: "demo-market",
      businessType: "retail",
      email: "market@wespro.com",
      phone: "+998 71 200 00 00",
      address: "г. Ташкент, ул. Навои, 12",
      currency: "UZS",
      timezone: "Asia/Tashkent",
      settings: JSON.stringify({ receipt_footer: "Приходите ещё!" }),
    },
  });

  const password = (plain: string) => bcrypt.hash(plain, 12);
  await prisma.user.create({
    data: { tenantId: tenant.id, email: "market@wespro.com", passwordHash: await password("market123"), firstName: "Дильшод", lastName: "Каримов", role: "admin" },
  });
  await prisma.user.create({
    data: {
      tenantId: tenant.id, email: "aziza@wespro.com", passwordHash: await password("cashier123"),
      firstName: "Азиза", lastName: "Рахимова", role: "cashier", pin: await bcrypt.hash("1234", 10),
    },
  });
  await prisma.user.create({
    data: {
      tenantId: tenant.id, email: "jasur@wespro.com", passwordHash: await password("cashier123"),
      firstName: "Жасур", lastName: "Тошматов", role: "cashier", pin: await bcrypt.hash("5678", 10),
    },
  });

  let order = 0;
  let products = 0;
  for (const [name, { color, items }] of Object.entries(CATALOG)) {
    const category = await prisma.category.create({ data: { tenantId: tenant.id, name, color, sortOrder: order++ } });
    let sortOrder = 0;
    for (const item of items) {
      await prisma.product.create({
        data: {
          tenantId: tenant.id,
          categoryId: category.id,
          name: item.name,
          price: item.price,
          costPrice: item.cost,
          currentStock: item.stock,
          minStock: item.min ?? 0,
          trackInventory: true,
          barcode: item.barcode ?? null,
          sku: item.sku ?? null,
          // «кг» — цена и остаток за килограмм, вес на кассе вводится в кг.
          unit: item.weighed ? "kg" : "piece",
          purchaseUnit: item.weighed ? "кг" : null,
          saleUnit: item.weighed ? "кг" : null,
          tags: item.quick ? JSON.stringify(["quick"]) : "[]",
          sortOrder: sortOrder++,
        },
      });
      products++;
    }
  }

  console.log(`Демо-магазин: ${products} товаров, ${order} категорий`);
  console.log("  панель: market@wespro.com / market123");
  console.log("  касса:  код точки demo-market, PIN Азизы 1234, Жасура 5678");
}

// Запуск как самостоятельного скрипта (а не импорт из seed.ts).
if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  const prisma = new PrismaClient();
  seedRetail(prisma)
    .catch((error) => {
      console.error(error);
      process.exitCode = 1;
    })
    .finally(() => prisma.$disconnect());
}
