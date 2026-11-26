import { describe, expect, it, vi } from "vitest";
import type { DishSnapshot } from "../src/modules/menu/menu.dto.js";
import type { OrderRecord } from "../src/modules/orders/orders.dto.js";
import { InMemoryOrderRepository } from "../src/modules/orders/orders.repository.js";
import { OrderService } from "../src/modules/orders/orders.service.js";
import { menuWith } from "./support.js";

const dish = (id: number, priceCents: number, available = true): DishSnapshot => ({
  id,
  name: `Plat ${id}`,
  priceCents,
  available,
});
const client = { id: 1, role: "CUSTOMER" as const };
const autre = { id: 2, role: "CUSTOMER" as const };

function setup(dishes: DishSnapshot[]) {
  const orders = new InMemoryOrderRepository();
  return { orders, service: new OrderService(orders, menuWith(dishes)) };
}

describe("OrderService.place", () => {
  it("prend les prix dans la base et calcule le total", async () => {
    const orders = { create: vi.fn(async (data) => ({ id: 1, ...data })), findById: vi.fn(), find: vi.fn() };
    const dishes = { findDishesByIds: async () => [dish(1, 1000), dish(2, 250)] };
    const service = new OrderService(orders as never, dishes);

    await service.place(client, {
      items: [
        { dishId: 1, quantity: 2 },
        { dishId: 2, quantity: 1 },
      ],
    });

    expect(orders.create).toHaveBeenCalledWith(
      expect.objectContaining({
        userId: 1,
        totalCents: 2250,
        items: [
          expect.objectContaining({ dishId: 1, unitPriceCents: 1000 }),
          expect.objectContaining({ dishId: 2, unitPriceCents: 250 }),
        ],
      }),
    );
  });
});

describe("OrderService.getFor / list", () => {
  async function withOrder() {
    const ctx = setup([dish(1, 1000)]);
    const order: OrderRecord = await ctx.service.place(client, { items: [{ dishId: 1, quantity: 1 }] });
    return { ...ctx, order };
  }

  it("répond 404 (pas 403) pour la commande d'un autre client", async () => {
    const { service, order } = await withOrder();
    await expect(service.getFor(autre, order.id)).rejects.toMatchObject({ status: 404, code: "NOT_FOUND" });
  });
});
