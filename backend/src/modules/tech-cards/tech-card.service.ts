import prisma from "../../config/database.js";
import { ci } from "../../utils/search.js";
import type { CreateTechCardInput, UpdateTechCardInput, TechCardQueryInput } from "./tech-card.schema.js";
import { AppError, NotFoundError } from "../../utils/errors.js";

export class TechCardService {
  async findAll(tenantId: string, query: TechCardQueryInput) {
    const { search, isActive = true, sort = "name", order = "asc", page = 1, limit = 20 } = query;
    const skip = (page - 1) * limit;

    const where: any = { tenantId };
    if (search) {
      where.name = ci(search);
    }
    if (isActive !== undefined) where.isActive = isActive;

    const orderBy: any = { [sort]: order };

    const [techCards, total] = await Promise.all([
      prisma.techCard.findMany({
        where,
        include: {
          products: { select: { id: true, name: true } },
        },
        orderBy,
        skip,
        take: limit,
      }),
      prisma.techCard.count({ where }),
    ]);

    return { techCards, total, page, limit };
  }

  async findById(tenantId: string, id: string) {
    const techCard = await prisma.techCard.findFirst({
      where: { id, tenantId },
      include: {
        products: { select: { id: true, name: true, price: true } },
      },
    });
    if (!techCard) throw new NotFoundError("Техкарта не найдена");
    return techCard;
  }

  async create(tenantId: string, data: CreateTechCardInput) {
    const { ingredients, ...rest } = data;
    if (ingredients) await this.assertIngredientsExist(tenantId, ingredients);
    const ingredientsJson = ingredients ? JSON.stringify(ingredients) : "[]";
    const totalCost = ingredients ? await this.calculateCost(tenantId, ingredients) : 0;
    const output = ingredients
      ? ingredients.reduce((sum, i) => sum + (i.netWeight || i.quantity || 0), 0)
      : 0;

    return prisma.techCard.create({
      data: {
        ...rest,
        tenantId,
        ingredients: ingredientsJson,
        totalCost,
        output: data.output ?? output,
        unit: data.unit || "г",
      },
    });
  }

  async update(tenantId: string, id: string, data: UpdateTechCardInput) {
    const existing = await prisma.techCard.findFirst({ where: { id, tenantId } });
    if (!existing) throw new NotFoundError("Техкарта не найдена");

    const { ingredients, ...rest } = data;
    let totalCost = existing.totalCost;
    let output = existing.output;

    if (ingredients !== undefined) {
      await this.assertIngredientsExist(tenantId, ingredients);
      totalCost = await this.calculateCost(tenantId, ingredients);
      output = data.output ?? ingredients.reduce((sum, i) => sum + (i.netWeight || i.quantity || 0), 0);
    }

    return prisma.techCard.update({
      where: { id },
      data: {
        ...rest,
        ingredients: ingredients !== undefined ? JSON.stringify(ingredients) : undefined,
        totalCost,
        output,
      },
    });
  }

  async delete(tenantId: string, id: string) {
    const techCard = await prisma.techCard.findFirst({ where: { id, tenantId } });
    if (!techCard) throw new NotFoundError("Техкарта не найдена");

    await prisma.techCard.update({
      where: { id },
      data: { isActive: false },
    });
    return { message: "Tech card deactivated" };
  }

  async copy(tenantId: string, id: string) {
    const original = await prisma.techCard.findFirst({ where: { id, tenantId } });
    if (!original) throw new NotFoundError("Техкарта не найдена");

    return prisma.techCard.create({
      data: {
        tenantId,
        name: `${original.name} (копия)`,
        ingredients: original.ingredients,
        totalCost: original.totalCost,
        output: original.output,
        unit: original.unit,
      },
    });
  }

  async recalculateCost(tenantId: string, id: string) {
    const techCard = await prisma.techCard.findFirst({ where: { id, tenantId } });
    if (!techCard) throw new NotFoundError("Техкарта не найдена");

    const ingredients = JSON.parse(techCard.ingredients || "[]");
    const totalCost = await this.calculateCost(tenantId, ingredients);

    return prisma.techCard.update({
      where: { id },
      data: { totalCost },
    });
  }

  // Ингредиент, которого нет в точке (опечатка, чужой id), раньше молча
  // принимался: в себестоимость он не входил, при продаже не списывался, и
  // техкарта выглядела рабочей.
  private async assertIngredientsExist(tenantId: string, ingredients: { ingredientId: string }[]): Promise<void> {
    const ids = [...new Set(ingredients.map((i) => i.ingredientId))];
    const found = await prisma.product.findMany({ where: { tenantId, id: { in: ids } }, select: { id: true } });
    const known = new Set(found.map((p) => p.id));
    const missing = ids.filter((id) => !known.has(id));
    if (missing.length) {
      throw new AppError(`Ингредиент не найден в этой точке: ${missing.join(", ")}`, 400);
    }
  }

  private async calculateCost(tenantId: string, ingredients: { ingredientId: string; quantity: number }[]): Promise<number> {
    let totalCost = 0;
    for (const item of ingredients) {
      const ingredient = await prisma.product.findFirst({
        where: { id: item.ingredientId, tenantId },
      });
      if (ingredient) {
        totalCost += ingredient.costPrice * item.quantity;
      }
    }
    return totalCost;
  }
}

export const techCardService = new TechCardService();
