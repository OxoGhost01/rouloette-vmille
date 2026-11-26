import { describe, expect, it } from "vitest";
import { createDishSchema, listDishesQuerySchema, toDishDto, updateDishSchema } from "../../src/modules/menu/menu.dto.js";

describe("DTO d'entrée de la carte : stricts, dans les limites du contrat", () => {
  it("refuse les champs inconnus : mass assignment impossible", () => {
    expect(createDishSchema.safeParse({ name: "Tarte", priceCents: 450, categoryId: 1, id: 9 }).success).toBe(false);
    expect(updateDishSchema.safeParse({ id: 9 }).success).toBe(false);
    expect(listDishesQuerySchema.safeParse({ inconnu: "1" }).success).toBe(false);
  });

  it("refuse les valeurs hors limites du contrat", () => {
    expect(listDishesQuerySchema.safeParse({ pageSize: "51" }).success).toBe(false);
    expect(updateDishSchema.safeParse({}).success).toBe(false);
  });

  it("un PATCH n'invente pas de valeurs par défaut", () => {
    expect(updateDishSchema.parse({ priceCents: 600 })).toEqual({ priceCents: 600 });
  });
});

describe("DTO de sortie de la carte : seuls les champs du contrat sortent", () => {
  it("un plat ne laisse pas passer un champ interne du modèle", () => {
    const record = {
      id: 1,
      name: "Brownie",
      description: "",
      priceCents: 450,
      available: true,
      category: { id: 1, name: "Desserts", position: 3 },
      allergens: [{ code: "gluten", label: "Gluten", id: 7 }],
      purchasePriceCents: 120,
    };

    expect(toDishDto(record)).toEqual({
      id: 1,
      name: "Brownie",
      description: "",
      priceCents: 450,
      available: true,
      stock: null,
      category: { id: 1, name: "Desserts" },
      allergens: [{ code: "gluten", label: "Gluten" }],
    });
  });
});
