import { describe, expect, it, vi } from "vitest";
import type { DishFilter } from "../../src/modules/menu/menu.model.js";
import { InMemoryDishImageStorage } from "../../src/modules/menu/dish-image.storage.js";
import type { MenuRepository } from "../../src/modules/menu/menu.repository.js";
import { MenuService } from "../../src/modules/menu/menu.service.js";

// Faux repository : un simple objet qui respecte l'interface, aucune base
function fakeRepo(overrides: Partial<MenuRepository> = {}): MenuRepository {
  return {
    listCategories: async () => [],
    listAllergens: async () => [],
    findDishes: async () => ({ items: [], total: 0 }),
    findDishById: async () => null,
    findDishesByIds: async () => [],
    createDish: async () => ({ status: "not_found" }),
    updateDish: async () => ({ status: "not_found" }),
    setDishImage: async () => ({ status: "not_found" }),
    deleteDish: async () => "not_found",
    ...overrides,
  };
}

describe("MenuService", () => {
  it("transforme la recherche et la pagination en filtre repository", async () => {
    const findDishes = vi.fn(async (_f: DishFilter) => ({ items: [], total: 0 }));
    const service = new MenuService(fakeRepo({ findDishes }), new InMemoryDishImageStorage());

    const result = await service.listDishes({
      allergenFree: ["gluten", "lait"],
      available: false,
      category: 2,
      q: "frites",
      page: 3,
      pageSize: 5,
    });

    expect(findDishes).toHaveBeenCalledWith({
      categoryId: 2,
      available: false,
      allergenFreeCodes: ["gluten", "lait"],
      q: "frites",
      skip: 10,
      take: 5,
    });
    expect(result).toMatchObject({ total: 0, page: 3, pageSize: 5 });
  });
});
