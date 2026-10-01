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
  "catalogSharing",
  "settings",
] as const;

const BUSINESS_TYPES = ["cafe", "retail"];

export const settingsService = {
  async get(tenantId: string) {
    return prisma.tenant.findUnique({
      where: { id: tenantId },
    });
  },

  async update(tenantId: string, data: Record<string, unknown>) {
    if ("businessType" in data && !(BUSINESS_TYPES as readonly unknown[]).includes(data.businessType)) {
      throw new AppError("Неизвестный тип заведения");
    }
    if ("catalogSharing" in data && typeof data.catalogSharing !== "boolean") {
      throw new AppError("Некорректное значение настройки общей базы");
    }
    const safeData: Record<string, unknown> = {};
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
