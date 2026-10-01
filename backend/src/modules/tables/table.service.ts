import type { Prisma } from "@prisma/client";
import type { UpdateTableInput } from "./table.schema.js";
import prisma from "../../config/database.js";
import { ConflictError, NotFoundError } from "../../utils/errors.js";

export class TableService {
  async findAll(tenantId: string, branchId?: string) {
    const where: Prisma.TableWhereInput = { tenantId };
    if (branchId) where.branchId = branchId;

    return prisma.table.findMany({
      where,
      include: {
        orders: {
          where: { status: { in: ["pending", "confirmed", "preparing", "ready", "served"] } },
          select: { id: true, total: true, createdAt: true, status: true },
        },
      },
      orderBy: { number: "asc" },
    });
  }

  async findById(tenantId: string, id: string) {
    const table = await prisma.table.findFirst({
      where: { id, tenantId },
      include: {
        orders: {
          where: { status: { in: ["pending", "confirmed", "preparing", "ready", "served"] } },
          include: {
            items: { include: { product: { select: { name: true } } } },
          },
          orderBy: { createdAt: "desc" },
        },
      },
    });
    if (!table) throw new NotFoundError("Стол не найден");
    return table;
  }

  private async assertBranchOwned(tenantId: string, branchId?: string | null) {
    if (!branchId) return;
    const branch = await prisma.branch.findFirst({ where: { id: branchId, tenantId } });
    if (!branch) throw new NotFoundError("Филиал не найден");
  }

  async create(tenantId: string, data: { number: string; capacity: number; branchId?: string; zone?: string }) {
    await this.assertBranchOwned(tenantId, data.branchId);
    return prisma.table.create({
      data: { ...data, tenantId },
    });
  }

  async update(tenantId: string, id: string, data: UpdateTableInput) {
    const table = await prisma.table.findFirst({ where: { id, tenantId } });
    if (!table) throw new NotFoundError("Стол не найден");

    return prisma.table.update({
      where: { id },
      data,
    });
  }

  async updateStatus(tenantId: string, id: string, status: string) {
    const table = await prisma.table.findFirst({ where: { id, tenantId } });
    if (!table) throw new NotFoundError("Стол не найден");

    return prisma.table.update({
      where: { id },
      data: { status },
    });
  }

  async delete(tenantId: string, id: string) {
    const table = await prisma.table.findFirst({ where: { id, tenantId } });
    if (!table) throw new NotFoundError("Стол не найден");
    if (table.status === "occupied") throw new ConflictError("Нельзя удалить занятый стол");

    await prisma.table.delete({ where: { id } });
    return { message: "Table deleted" };
  }

  async getStats(tenantId: string) {
    const stats = await prisma.table.groupBy({
      by: ["status"],
      where: { tenantId },
      _count: true,
    });

    const total = stats.reduce((sum, s) => sum + s._count, 0);
    return {
      total,
      available: stats.find((s) => s.status === "available")?._count || 0,
      occupied: stats.find((s) => s.status === "occupied")?._count || 0,
      reserved: stats.find((s) => s.status === "reserved")?._count || 0,
      maintenance: stats.find((s) => s.status === "maintenance")?._count || 0,
    };
  }
}

export const tableService = new TableService();
