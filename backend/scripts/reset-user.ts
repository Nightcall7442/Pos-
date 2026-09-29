import { PrismaClient } from "@prisma/client";
import bcrypt from "bcryptjs";

const prisma = new PrismaClient();

async function main() {
  const hash = await bcrypt.hash("deepunites", 12);

  const tenant = await prisma.tenant.findFirst();
  if (!tenant) {
    console.log("No tenant found!");
    return;
  }

  // Delete all users
  const deleted = await prisma.user.deleteMany();
  console.log(`Deleted ${deleted.count} users`);

  // Create new admin
  const user = await prisma.user.create({
    data: {
      tenantId: tenant.id,
      email: "support@admin.com",
      passwordHash: hash,
      firstName: "Support",
      lastName: "Admin",
      role: "admin",
    },
  });

  console.log(`Created user: ${user.email} (id: ${user.id})`);
  console.log("Login: support / deepunites");
}

main()
  .catch(console.error)
  .finally(() => prisma.$disconnect());
