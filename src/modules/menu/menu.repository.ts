import type { PrismaClient } from "../../generated/prisma/client.js";
import type { AllergenRecord, CategoryRecord, DishFilter, DishPatch, DishRecord, NewDish } from "./menu.dto.js";

export type DishWrite = { status: "ok"; dish: DishRecord } | { status: "name_taken" | "not_found" };
export type DishDelete = "deleted" | "not_found" | "ordered";

// DAO : le service ne connaît que cette interface
export interface MenuRepository {
  listCategories(): Promise<CategoryRecord[]>;
  listAllergens(): Promise<AllergenRecord[]>;
  findDishes(filter: DishFilter): Promise<{ items: DishRecord[]; total: number }>;
  findDishById(id: number): Promise<DishRecord | null>;
  createDish(data: NewDish): Promise<DishWrite>;
  updateDish(id: number, patch: DishPatch): Promise<DishWrite>;
  deleteDish(id: number): Promise<DishDelete>;
}

const hasCode = (error: unknown, code: string) => (error as { code?: unknown } | null)?.code === code;

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

  async createDish({ allergens, ...data }: NewDish): Promise<DishWrite> {
    try {
      const dish = await this.prisma.dish.create({
        data: { ...data, allergens: { connect: allergens.map((code) => ({ code })) } },
        include: dishInclude,
      });
      return { status: "ok", dish };
    } catch (error) {
      if (hasCode(error, "P2002")) return { status: "name_taken" };
      throw error;
    }
  }

  async updateDish(id: number, { allergens, ...data }: DishPatch): Promise<DishWrite> {
    try {
      const dish = await this.prisma.dish.update({
        where: { id },
        data: { ...data, ...(allergens && { allergens: { set: allergens.map((code) => ({ code })) } }) },
        include: dishInclude,
      });
      return { status: "ok", dish };
    } catch (error) {
      if (hasCode(error, "P2002")) return { status: "name_taken" };
      if (hasCode(error, "P2025")) return { status: "not_found" };
      throw error;
    }
  }

  async deleteDish(id: number): Promise<DishDelete> {
    try {
      await this.prisma.dish.delete({ where: { id } });
      return "deleted";
    } catch (error) {
      if (hasCode(error, "P2025")) return "not_found";
      if (hasCode(error, "P2003")) return "ordered"; // onDelete: Restrict sur les lignes de commande
      throw error;
    }
  }
}

// Pour les tests HTTP sans base
export class InMemoryMenuRepository implements MenuRepository {
  private readonly dishes: DishRecord[];
  private nextId: number;

  constructor(
    private readonly data: {
      categories?: CategoryRecord[];
      allergens?: AllergenRecord[];
      dishes?: DishRecord[];
      orderedDishIds?: number[];
    } = {},
  ) {
    this.dishes = [...(data.dishes ?? [])];
    this.nextId = Math.max(0, ...this.dishes.map((d) => d.id)) + 1;
  }

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
    const all = this.dishes
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
    return this.dishes.find((d) => d.id === id) ?? null;
  }

  private toRecord(id: number, data: NewDish): DishRecord {
    const category = (this.data.categories ?? []).find((c) => c.id === data.categoryId)!;
    const allergens = (this.data.allergens ?? []).filter((a) => data.allergens.includes(a.code));
    const { categoryId: _categoryId, allergens: _codes, ...rest } = data;
    return { id, ...rest, category: { id: category.id, name: category.name }, allergens };
  }

  private toNewDish(d: DishRecord): NewDish {
    return {
      name: d.name,
      description: d.description,
      priceCents: d.priceCents,
      categoryId: d.category.id,
      allergens: d.allergens.map((a) => a.code),
      available: d.available,
      stock: d.stock ?? null,
    };
  }

  async createDish(data: NewDish): Promise<DishWrite> {
    if (this.dishes.some((d) => d.name === data.name)) return { status: "name_taken" };
    const dish = this.toRecord(this.nextId++, data);
    this.dishes.push(dish);
    return { status: "ok", dish };
  }

  async updateDish(id: number, patch: DishPatch): Promise<DishWrite> {
    const index = this.dishes.findIndex((d) => d.id === id);
    if (index === -1) return { status: "not_found" };
    if (patch.name && this.dishes.some((d) => d.id !== id && d.name === patch.name)) return { status: "name_taken" };
    const dish = this.toRecord(id, { ...this.toNewDish(this.dishes[index]!), ...patch });
    this.dishes[index] = dish;
    return { status: "ok", dish };
  }

  async deleteDish(id: number): Promise<DishDelete> {
    const index = this.dishes.findIndex((d) => d.id === id);
    if (index === -1) return "not_found";
    if (this.data.orderedDishIds?.includes(id)) return "ordered";
    this.dishes.splice(index, 1);
    return "deleted";
  }
}
