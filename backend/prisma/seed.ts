import { PrismaClient } from "@prisma/client";
import bcrypt from "bcryptjs";

const prisma = new PrismaClient();

async function main() {
  console.log("Seeding database...");

  // Create demo tenant
  const tenant = await prisma.tenant.create({
    data: {
      name: "Demo Restaurant",
      slug: "demo-restaurant",
      email: "demo@wespro.com",
      phone: "+1 555 0123",
      address: "123 Main St, New York, NY 10001",
      currency: "USD",
      taxRate: 8.5,
      settings: JSON.stringify({ receipt_footer: "Thank you for dining with us!" }),
    },
  });

  // Create admin user
  const adminPassword = await bcrypt.hash("admin123", 12);
  await prisma.user.create({
    data: {
      tenantId: tenant.id,
      email: "admin@wespro.com",
      passwordHash: adminPassword,
      firstName: "Admin",
      lastName: "User",
      role: "admin",
    },
  });

  // Create cashier
  const cashierPassword = await bcrypt.hash("cashier123", 12);
  await prisma.user.create({
    data: {
      tenantId: tenant.id,
      email: "cashier@wespro.com",
      passwordHash: cashierPassword,
      firstName: "John",
      lastName: "Cashier",
      role: "cashier",
      pin: await bcrypt.hash("1234", 10),
    },
  });

  // Create categories
  const categories = await Promise.all([
    prisma.category.create({ data: { tenantId: tenant.id, name: "Burgers", color: "#ef4444", sortOrder: 0 } }),
    prisma.category.create({ data: { tenantId: tenant.id, name: "Pizza", color: "#f59e0b", sortOrder: 1 } }),
    prisma.category.create({ data: { tenantId: tenant.id, name: "Salads", color: "#10b981", sortOrder: 2 } }),
    prisma.category.create({ data: { tenantId: tenant.id, name: "Drinks", color: "#3b82f6", sortOrder: 3 } }),
    prisma.category.create({ data: { tenantId: tenant.id, name: "Desserts", color: "#8b5cf6", sortOrder: 4 } }),
  ]);

  // Create products
  const products = [
    { name: "Classic Burger", price: 12.99, costPrice: 4.50, categoryId: categories[0].id, sku: "BRG-001", currentStock: 50 },
    { name: "Cheese Burger", price: 14.99, costPrice: 5.00, categoryId: categories[0].id, sku: "BRG-002", currentStock: 50 },
    { name: "Bacon Burger", price: 16.99, costPrice: 5.50, categoryId: categories[0].id, sku: "BRG-003", currentStock: 50 },
    { name: "Margherita Pizza", price: 18.99, costPrice: 6.00, categoryId: categories[1].id, sku: "PIZ-001", currentStock: 30 },
    { name: "Pepperoni Pizza", price: 20.99, costPrice: 7.00, categoryId: categories[1].id, sku: "PIZ-002", currentStock: 30 },
    { name: "Caesar Salad", price: 9.99, costPrice: 3.00, categoryId: categories[2].id, sku: "SAL-001", currentStock: 40 },
    { name: "Greek Salad", price: 10.99, costPrice: 3.50, categoryId: categories[2].id, sku: "SAL-002", currentStock: 40 },
    { name: "Cola", price: 2.99, costPrice: 0.50, categoryId: categories[3].id, sku: "DRK-001", currentStock: 100, trackInventory: true },
    { name: "Fresh Lemonade", price: 4.99, costPrice: 1.00, categoryId: categories[3].id, sku: "DRK-002", currentStock: 60, trackInventory: true },
    { name: "Tiramisu", price: 8.99, costPrice: 3.00, categoryId: categories[4].id, sku: "DES-001", currentStock: 20 },
  ];

  for (const product of products) {
    await prisma.product.create({
      data: { tenantId: tenant.id, ...product },
    });
  }

  // Create tables
  for (let i = 1; i <= 12; i++) {
    await prisma.table.create({
      data: {
        tenantId: tenant.id,
        number: String(i),
        capacity: i <= 4 ? 2 : i <= 8 ? 4 : 6,
        zone: i <= 4 ? "Indoor" : i <= 8 ? "Terrace" : "VIP",
      },
    });
  }

  console.log("Database seeded successfully!");
  console.log("Admin login: admin@wespro.com / admin123");
  console.log("Cashier login: cashier@wespro.com / cashier123");
}

main()
  .catch(console.error)
  .finally(() => prisma.$disconnect());
