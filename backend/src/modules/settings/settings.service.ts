import prisma from "../../config/database.js";
import { AppError } from "../../utils/errors.js";

const ALLOWED_FIELDS = [
  "name",
  "businessType",
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

const BUSINESS_TYPES = ["cafe", "retail"];

export const settingsService = {
  async get(tenantId: string) {
    return prisma.tenant.findUnique({
      where: { id: tenantId },
    });
  },

  async update(tenantId: string, data: Record<string, any>) {
    if ("businessType" in data && !BUSINESS_TYPES.includes(data.businessType)) {
      throw new AppError("Неизвестный тип заведения");
    }
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
