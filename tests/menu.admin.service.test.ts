import { describe, expect, it, vi } from "vitest";
import type { DishRecord } from "../src/modules/menu/menu.dto.js";
import { InMemoryMenuRepository } from "../src/modules/menu/menu.repository.js";
import { MenuService } from "../src/modules/menu/menu.service.js";

const desserts = { id: 1, name: "Desserts", position: 1 };
const gluten = { id: 1, code: "gluten", label: "Gluten" };
const lait = { id: 2, code: "lait", label: "Lait" };

const brownie: DishRecord = {
  id: 1,
  name: "Brownie",
  description: "",
  priceCents: 450,
  available: true,
  stock: 10,
  category: { id: 1, name: "Desserts" },
  allergens: [{ code: "gluten", label: "Gluten" }],
};

function setup(orderedDishIds: number[] = []) {
  const repo = new InMemoryMenuRepository({
    categories: [desserts],
    allergens: [gluten, lait],
    dishes: [brownie],
    orderedDishIds,
  });
  return { repo, service: new MenuService(repo) };
}

describe("MenuService : administration de la carte", () => {
  it("applique les valeurs par défaut à la création", async () => {
    const { repo, service } = setup();
    const createDish = vi.spyOn(repo, "createDish");

    await service.createDish({ name: "Tarte", priceCents: 450, categoryId: 1 });

    expect(createDish).toHaveBeenCalledWith({
      name: "Tarte",
      priceCents: 450,
      categoryId: 1,
      description: "",
      allergens: [],
      available: true,
      stock: null,
    });
  });

  it("refuse une catégorie ou un allergène inconnu avec 422 INVALID_REFERENCE", async () => {
    const { service } = setup();
    await expect(service.createDish({ name: "Tarte", priceCents: 450, categoryId: 99 })).rejects.toMatchObject({
      status: 422,
      code: "INVALID_REFERENCE",
    });
    await expect(
      service.createDish({ name: "Tarte", priceCents: 450, categoryId: 1, allergens: ["kryptonite"] }),
    ).rejects.toMatchObject({ status: 422, code: "INVALID_REFERENCE" });
  });

  it("refuse un nom déjà pris avec 409 CONFLICT, à la création comme à la modification", async () => {
    const { service } = setup();
    await expect(service.createDish({ name: "Brownie", priceCents: 450, categoryId: 1 })).rejects.toMatchObject({
      status: 409,
      code: "CONFLICT",
    });
    const tarte = await service.createDish({ name: "Tarte", priceCents: 450, categoryId: 1 });
    await expect(service.updateDish(tarte.id, { name: "Brownie" })).rejects.toMatchObject({ status: 409 });
  });

  it("modifie partiellement un plat et remplace ses allergènes", async () => {
    const { service } = setup();
    const updated = await service.updateDish(1, { priceCents: 600, allergens: ["lait"] });
    expect(updated).toMatchObject({ name: "Brownie", priceCents: 600, stock: 10 });
    expect(updated.allergens.map((a) => a.code)).toEqual(["lait"]);
  });

  it("répond 404 pour un plat inexistant (modification et suppression)", async () => {
    const { service } = setup();
    await expect(service.updateDish(99, { priceCents: 600 })).rejects.toMatchObject({ status: 404 });
    await expect(service.deleteDish(99)).rejects.toMatchObject({ status: 404 });
  });

  it("refuse de supprimer un plat déjà commandé (409) mais supprime les autres", async () => {
    const { service } = setup([1]);
    await expect(service.deleteDish(1)).rejects.toMatchObject({ status: 409, code: "CONFLICT" });

    const free = setup().service;
    await expect(free.deleteDish(1)).resolves.toBeUndefined();
    await expect(free.getDish(1)).rejects.toMatchObject({ status: 404 });
  });
});
