import { HttpError } from "../../shared/errors.js";
import type { CreateDishInput, DishPatch, ListDishesQuery, UpdateDishInput } from "./menu.dto.js";
import type { MenuRepository } from "./menu.repository.js";

// Aucune notion HTTP (req / res) ici : le service ne reçoit que des données.
export class MenuService {
  constructor(private readonly menu: MenuRepository) {}

  listCategories() {
    return this.menu.listCategories();
  }

  listAllergens() {
    return this.menu.listAllergens();
  }

  async listDishes(query: ListDishesQuery) {
    const codes = query.allergenFree
      ?.split(",")
      .map((c) => c.trim())
      .filter(Boolean);
    const { items, total } = await this.menu.findDishes({
      categoryId: query.category,
      available: query.available === undefined ? undefined : query.available === "true",
      allergenFreeCodes: codes,
      q: query.q,
      skip: (query.page - 1) * query.pageSize,
      take: query.pageSize,
    });
    return { items, total, page: query.page, pageSize: query.pageSize };
  }

  async getDish(id: number) {
    const dish = await this.menu.findDishById(id);
    if (!dish) throw dishNotFound();
    return dish;
  }

  async createDish(input: CreateDishInput) {
    await this.assertReferences(input.categoryId, input.allergens);
    const result = await this.menu.createDish({
      name: input.name,
      priceCents: input.priceCents,
      categoryId: input.categoryId,
      description: input.description ?? "",
      allergens: [...new Set(input.allergens ?? [])],
      available: input.available ?? true,
      stock: input.stock ?? null,
    });
    if (result.status === "ok") return result.dish;
    throw nameTaken();
  }

  async updateDish(id: number, input: UpdateDishInput) {
    await this.assertReferences(input.categoryId, input.allergens);
    const patch: DishPatch = {
      ...input,
      ...(input.allergens && { allergens: [...new Set(input.allergens)] }),
    };
    const result = await this.menu.updateDish(id, patch);
    if (result.status === "ok") return result.dish;
    throw result.status === "not_found" ? dishNotFound() : nameTaken();
  }

  async deleteDish(id: number) {
    const result = await this.menu.deleteDish(id);
    if (result === "not_found") throw dishNotFound();
    if (result === "ordered") {
      throw new HttpError(409, "CONFLICT", "Ce plat a déjà été commandé : rendez-le indisponible plutôt");
    }
  }

  private async assertReferences(categoryId: number | undefined, allergenCodes: string[] | undefined) {
    if (categoryId !== undefined && !(await this.menu.listCategories()).some((c) => c.id === categoryId)) {
      throw new HttpError(422, "INVALID_REFERENCE", "Catégorie inconnue", [{ field: "categoryId", value: categoryId }]);
    }
    if (allergenCodes?.length) {
      const known = new Set((await this.menu.listAllergens()).map((a) => a.code));
      const unknown = allergenCodes.filter((code) => !known.has(code));
      if (unknown.length > 0) {
        throw new HttpError(422, "INVALID_REFERENCE", "Allergène inconnu", unknown.map((value) => ({ field: "allergens", value })));
      }
    }
  }
}

const dishNotFound = () => new HttpError(404, "NOT_FOUND", "Plat introuvable");
const nameTaken = () => new HttpError(409, "CONFLICT", "Un plat porte déjà ce nom");
