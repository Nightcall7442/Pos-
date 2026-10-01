import prisma from "../../config/database.js";
import type { CreateCategoryInput, UpdateCategoryInput } from "./category.schema.js";
import { AppError, ConflictError, NotFoundError } from "../../utils/errors.js";

export class CategoryService {
  async findAll(tenantId: string) {
    return prisma.category.findMany({
      where: { tenantId },
      include: {
        children: { orderBy: { sortOrder: "asc" } },
        _count: { select: { products: { where: { isActive: true } } } },
      },
      orderBy: { sortOrder: "asc" },
    });
  }

  async findTree(tenantId: string) {
    return prisma.category.findMany({
      where: { tenantId, parentId: null },
      include: {
        children: {
          include: { _count: { select: { products: { where: { isActive: true } } } } },
          orderBy: { sortOrder: "asc" },
        },
        _count: { select: { products: { where: { isActive: true } } } },
      },
      orderBy: { sortOrder: "asc" },
    });
  }

  async findById(tenantId: string, id: string) {
    const category = await prisma.category.findFirst({
      where: { id, tenantId },
      include: {
        parent: { select: { id: true, name: true } },
        children: { orderBy: { sortOrder: "asc" } },
        _count: { select: { products: { where: { isActive: true } } } },
      },
    });
    if (!category) throw new NotFoundError("Категория не найдена");
    return category;
  }

  private async assertParentOwned(tenantId: string, parentId?: string | null, selfId?: string) {
    if (!parentId) return;
    if (parentId === selfId) throw new AppError("Категория не может быть родителем самой себе");
    const parent = await prisma.category.findFirst({ where: { id: parentId, tenantId } });
    if (!parent) throw new NotFoundError("Родительская категория не найдена");
  }

  async create(tenantId: string, data: CreateCategoryInput) {
    await this.assertParentOwned(tenantId, data.parentId);
    return prisma.category.create({
      data: { ...data, tenantId },
    });
  }

  async update(tenantId: string, id: string, data: UpdateCategoryInput) {
    const category = await prisma.category.findFirst({ where: { id, tenantId } });
    if (!category) throw new NotFoundError("Категория не найдена");
    await this.assertParentOwned(tenantId, data.parentId, id);

    return prisma.category.update({
      where: { id },
      data,
    });
  }

  async delete(tenantId: string, id: string) {
    const category = await prisma.category.findFirst({
      where: { id, tenantId },
      include: { products: { where: { isActive: true }, take: 1 } },
    });
    if (!category) throw new NotFoundError("Категория не найдена");
    if (category.products.length > 0) {
      throw new ConflictError("Нельзя удалить категорию с товарами");
    }

    await prisma.category.delete({ where: { id } });
    return { message: "Category deleted" };
  }

  async reorder(tenantId: string, ids: string[]) {
    // Раньше tenantId здесь не использовался вовсе: категории обновлялись по
    // одному id, и админ одной точки мог переставить категории чужой, зная их
    // id. Нашёл это noUnusedParameters в tsconfig.
    const owned = await prisma.category.count({ where: { tenantId, id: { in: ids } } });
    if (owned !== new Set(ids).size) throw new NotFoundError("Категория не найдена");

    const updates = ids.map((id, index) =>
      prisma.category.updateMany({
        where: { id, tenantId },
        data: { sortOrder: index },
      })
    );
    await prisma.$transaction(updates);
    return { message: "Categories reordered" };
  }
}

export const categoryService = new CategoryService();
