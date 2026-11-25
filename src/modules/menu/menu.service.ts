import { HttpError } from "../../shared/errors.js";
import type { ListDishesQuery } from "./menu.dto.js";
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
    if (!dish) throw new HttpError(404, "NOT_FOUND", "Plat introuvable");
    return dish;
  }
}
