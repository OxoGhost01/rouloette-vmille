import type { PrismaClient } from "../../generated/prisma/client.js";
import type { AllergenRecord, CategoryRecord, DishFilter, DishRecord } from "./menu.dto.js";

// DAO : le service ne connaît que cette interface
export interface MenuRepository {
  listCategories(): Promise<CategoryRecord[]>;
  listAllergens(): Promise<AllergenRecord[]>;
  findDishes(filter: DishFilter): Promise<{ items: DishRecord[]; total: number }>;
  findDishById(id: number): Promise<DishRecord | null>;
}

const dishInclude = {
  category: { select: { id: true, name: true } },
  allergens: { select: { code: true, label: true }, orderBy: { code: "asc" as const } },
};

export class PrismaMenuRepository implements MenuRepository {
  constructor(private readonly prisma: PrismaClient) {}

  listCategories() {
    return this.prisma.category.findMany({ orderBy: { position: "asc" } });
  }

  listAllergens() {
    return this.prisma.allergen.findMany({ orderBy: { code: "asc" } });
  }

  async findDishes(f: DishFilter) {
    const where = {
      ...(f.categoryId !== undefined && { categoryId: f.categoryId }),
      ...(f.available !== undefined && { available: f.available }),
      ...(f.q && { name: { contains: f.q } }),
      // Traverse la relation n-n : aucun allergène parmi les codes demandés
      ...(f.allergenFreeCodes?.length && { allergens: { none: { code: { in: f.allergenFreeCodes } } } }),
    };
    const [items, total] = await this.prisma.$transaction([
      this.prisma.dish.findMany({
        where,
        include: dishInclude,
        orderBy: [{ category: { position: "asc" } }, { name: "asc" }],
        skip: f.skip,
        take: f.take,
      }),
      this.prisma.dish.count({ where }),
    ]);
    return { items, total };
  }

  findDishById(id: number) {
    return this.prisma.dish.findUnique({ where: { id }, include: dishInclude });
  }
}

// Pour les tests HTTP sans base
export class InMemoryMenuRepository implements MenuRepository {
  constructor(
    private readonly data: { categories?: CategoryRecord[]; allergens?: AllergenRecord[]; dishes?: DishRecord[] } = {},
  ) {}

  async listCategories() {
    return [...(this.data.categories ?? [])].sort((a, b) => a.position - b.position);
  }

  async listAllergens() {
    return [...(this.data.allergens ?? [])].sort((a, b) => a.code.localeCompare(b.code));
  }

  async findDishes(f: DishFilter) {
    const positions = new Map((this.data.categories ?? []).map((c) => [c.id, c.position]));
    const q = f.q?.toLowerCase();
    const excluded = f.allergenFreeCodes ?? [];
    const all = (this.data.dishes ?? [])
      .filter((d) => f.categoryId === undefined || d.category.id === f.categoryId)
      .filter((d) => f.available === undefined || d.available === f.available)
      .filter((d) => !q || d.name.toLowerCase().includes(q))
      .filter((d) => !d.allergens.some((a) => excluded.includes(a.code)))
      .sort(
        (a, b) =>
          (positions.get(a.category.id) ?? 0) - (positions.get(b.category.id) ?? 0) || a.name.localeCompare(b.name),
      );
    return { items: all.slice(f.skip, f.skip + f.take), total: all.length };
  }

  async findDishById(id: number) {
    return (this.data.dishes ?? []).find((d) => d.id === id) ?? null;
  }
}
