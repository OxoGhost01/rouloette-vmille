import { describe, expect, it } from "vitest";
import { placeOrderSchema, toOrderDto } from "../../src/modules/orders/orders.dto.js";

describe("DTO d'entrée des commandes : stricts, dans les limites du contrat", () => {
  it("refuse les champs inconnus : le client ne fixe ni prix ni total", () => {
    expect(placeOrderSchema.safeParse({ items: [{ dishId: 1, quantity: 1, unitPriceCents: 1 }] }).success).toBe(false);
    expect(placeOrderSchema.safeParse({ items: [{ dishId: 1, quantity: 1 }], totalCents: 1 }).success).toBe(false);
  });

  it("refuse les valeurs hors limites du contrat", () => {
    expect(placeOrderSchema.safeParse({ items: [{ dishId: 1, quantity: 11 }] }).success).toBe(false);
    expect(placeOrderSchema.safeParse({ items: [] }).success).toBe(false);
    expect(
      placeOrderSchema.safeParse({
        items: [
          { dishId: 1, quantity: 1 },
          { dishId: 1, quantity: 2 },
        ],
      }).success,
    ).toBe(false);
  });
});

describe("DTO de sortie des commandes : seuls les champs du contrat sortent", () => {
  it("une commande expose le client sans son identité complète et calcule le total des lignes", () => {
    const record = {
      id: 3,
      status: "RECEIVED" as const,
      note: null,
      totalCents: 2300,
      createdAt: new Date("2026-11-26T12:00:00Z"),
      updatedAt: new Date("2026-11-26T12:00:00Z"),
      user: { id: 5, name: "Alice", email: "alice@test.fr", passwordHash: "secret" },
      items: [{ dishId: 1, name: "Classique", quantity: 2, unitPriceCents: 1150 }],
    };

    const dto = toOrderDto(record);

    expect(dto.customer).toEqual({ id: 5, name: "Alice" });
    expect(dto.createdAt).toBe("2026-11-26T12:00:00.000Z");
    expect(dto.items[0]).toEqual({ dishId: 1, name: "Classique", quantity: 2, unitPriceCents: 1150, lineTotalCents: 2300 });
    expect(JSON.stringify(dto)).not.toMatch(/passwordHash|email/);
  });
});
