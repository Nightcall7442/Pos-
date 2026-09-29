import { PrismaClient } from "@prisma/client";
import bcrypt from "bcryptjs";

const prisma = new PrismaClient();

async function main() {
  // Find or create tenant
  let tenant = await prisma.tenant.findFirst({ where: { slug: "demo-restaurant" } });
  if (!tenant) {
    tenant = await prisma.tenant.create({
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
    console.log("Created tenant:", tenant.id);
  } else {
    console.log("Tenant exists:", tenant.id);
  }

  // List existing users
  const existingUsers = await prisma.user.findMany({ where: { tenantId: tenant.id } });
  console.log("Existing users:", existingUsers.map((u) => ({ email: u.email, role: u.role, id: u.id })));

  // Ensure admin user
  const adminEmail = "admin@wespro.com";
  let admin = await prisma.user.findFirst({ where: { email: adminEmail, tenantId: tenant.id } });
  if (!admin) {
    const hash = await bcrypt.hash("admin123", 12);
    admin = await prisma.user.create({
      data: {
        tenantId: tenant.id,
        email: adminEmail,
        passwordHash: hash,
        firstName: "Admin",
        lastName: "User",
        role: "admin",
      },
    });
    console.log("Created admin user:", admin.id);
  } else {
    // Reset password to be sure
    const hash = await bcrypt.hash("admin123", 12);
    await prisma.user.update({ where: { id: admin.id }, data: { passwordHash: hash, isActive: true } });
    console.log("Reset admin password. Email:", adminEmail, "Password: admin123");
  }

  // Ensure cashier user
  const cashierEmail = "cashier@wespro.com";
  let cashier = await prisma.user.findFirst({ where: { email: cashierEmail, tenantId: tenant.id } });
  if (!cashier) {
    const hash = await bcrypt.hash("cashier123", 12);
    cashier = await prisma.user.create({
      data: {
        tenantId: tenant.id,
        email: cashierEmail,
        passwordHash: hash,
        firstName: "John",
        lastName: "Cashier",
        role: "cashier",
        pin: "1234",
      },
    });
    console.log("Created cashier user:", cashier.id);
  } else {
    const hash = await bcrypt.hash("cashier123", 12);
    await prisma.user.update({ where: { id: cashier.id }, data: { passwordHash: hash, isActive: true } });
    console.log("Reset cashier password. Email:", cashierEmail, "Password: cashier123");
  }

  console.log("\n=== Login credentials ===");
  console.log("Admin:  admin@wespro.com / admin123");
  console.log("Cashier: cashier@wespro.com / cashier123");
}

main()
  .catch(console.error)
  .finally(() => prisma.$disconnect());
