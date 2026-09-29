import prisma from "../../config/database.js";

const ALLOWED_FIELDS = [
  "name",
  "logoUrl",
  "phone",
  "email",
  "address",
  "timezone",
  "currency",
  "taxRate",
  "defaultMarkupPercent",
  "settings",
] as const;

export const settingsService = {
  async get(tenantId: string) {
    return prisma.tenant.findUnique({
      where: { id: tenantId },
    });
  },

  async update(tenantId: string, data: Record<string, any>) {
    const safeData: Record<string, any> = {};
    for (const key of ALLOWED_FIELDS) {
      if (key in data) {
        safeData[key] = data[key];
      }
    }

    return prisma.tenant.update({
      where: { id: tenantId },
      data: safeData,
    });
  },
};
