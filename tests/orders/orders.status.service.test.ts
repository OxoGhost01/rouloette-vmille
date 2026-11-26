import { describe, expect, it, vi } from "vitest";
import type { DishSnapshot } from "../../src/modules/menu/menu.model.js";
import type { OrderRecord } from "../../src/modules/orders/orders.model.js";
import { InMemoryOrderRepository } from "../../src/modules/orders/orders.repository.js";
import { OrderService } from "../../src/modules/orders/orders.service.js";
import { menuWith } from "../support/menu.js";

const dish = (id: number): DishSnapshot => ({ id, name: `Plat ${id}`, priceCents: 500, available: true });
const alice = { id: 1, role: "CUSTOMER" as const };
const bob = { id: 2, role: "CUSTOMER" as const };
const staff = { id: 3, role: "STAFF" as const };

function setup(stocks: Array<[number, number | null]> = []) {
  const orders = new InMemoryOrderRepository(undefined, new Map(stocks));
  const service = new OrderService(orders, menuWith([dish(1), dish(2)]));
  return { orders, service };
}

describe("OrderService.changeStatus", () => {
  it("la cuisine fait avancer une commande jusqu'au retrait", async () => {
    const { service } = setup();
    const order = await service.place(alice, { items: [{ dishId: 1, quantity: 1 }] });
    for (const status of ["PREPARING", "READY", "PICKED_UP"] as const) {
      expect((await service.changeStatus(staff, order.id, status)).status).toBe(status);
    }
  });

  it("refuse une transition interdite avec 409 INVALID_TRANSITION", async () => {
    const { service } = setup();
    const order = await service.place(alice, { items: [{ dishId: 1, quantity: 1 }] });
    await expect(service.changeStatus(staff, order.id, "READY")).rejects.toMatchObject({
      status: 409,
      code: "INVALID_TRANSITION",
    });
  });

  it("un client demandant autre chose qu'annuler reçoit 403", async () => {
    const { service } = setup();
    const order = await service.place(alice, { items: [{ dishId: 1, quantity: 1 }] });
    await expect(service.changeStatus(alice, order.id, "PREPARING")).rejects.toMatchObject({ status: 403 });
  });

  it("la commande d'un autre client répond 404, même pour une annulation", async () => {
    const { service } = setup();
    const order = await service.place(alice, { items: [{ dishId: 1, quantity: 1 }] });
    await expect(service.changeStatus(bob, order.id, "CANCELLED")).rejects.toMatchObject({ status: 404 });
  });

  it("un client ne peut plus annuler une commande en préparation (409)", async () => {
    const { service } = setup();
    const order = await service.place(alice, { items: [{ dishId: 1, quantity: 1 }] });
    await service.changeStatus(staff, order.id, "PREPARING");
    await expect(service.changeStatus(alice, order.id, "CANCELLED")).rejects.toMatchObject({
      status: 409,
      code: "INVALID_TRANSITION",
    });
  });

  it("demande la remise en stock uniquement pour une annulation", async () => {
    const updateStatus = vi.fn(async () => ({ id: 1, status: "X" }) as unknown as OrderRecord);
    const found = { id: 1, status: "RECEIVED", user: { id: 1, name: "A" } };
    const repo = { findById: async () => found, updateStatus };
    const service = new OrderService(repo as never, menuWith());

    await service.changeStatus(staff, 1, "PREPARING");
    await service.changeStatus(staff, 1, "CANCELLED");

    expect(updateStatus).toHaveBeenNthCalledWith(1, 1, "RECEIVED", "PREPARING", false);
    expect(updateStatus).toHaveBeenNthCalledWith(2, 1, "RECEIVED", "CANCELLED", true);
  });

  it("répond 409 si la commande a changé de statut entre la lecture et l'écriture", async () => {
    const found = { id: 1, status: "RECEIVED", user: { id: 1, name: "A" } };
    const repo = { findById: async () => found, updateStatus: async () => null };
    const service = new OrderService(repo as never, menuWith());
    await expect(service.changeStatus(staff, 1, "PREPARING")).rejects.toMatchObject({ code: "INVALID_TRANSITION" });
  });
});

describe("OrderService : stock", () => {
  it("décrémente le stock, et une annulation le remet", async () => {
    const { orders, service } = setup([[1, 5]]);
    const order = await service.place(alice, { items: [{ dishId: 1, quantity: 3 }] });
    expect(orders.stocks.get(1)).toBe(2);
    await service.changeStatus(alice, order.id, "CANCELLED");
    expect(orders.stocks.get(1)).toBe(5);
  });

  it("refuse avec 409 OUT_OF_STOCK et la quantité disponible", async () => {
    const { service } = setup([[1, 1]]);
    await expect(service.place(alice, { items: [{ dishId: 1, quantity: 2 }] })).rejects.toMatchObject({
      status: 409,
      code: "OUT_OF_STOCK",
      details: [{ dishId: 1, available: 1 }],
    });
  });

  it("tout ou rien : une commande refusée ne consomme aucun stock", async () => {
    const { orders, service } = setup([
      [1, 5],
      [2, 1],
    ]);
    await expect(
      service.place(alice, {
        items: [
          { dishId: 1, quantity: 2 },
          { dishId: 2, quantity: 3 },
        ],
      }),
    ).rejects.toMatchObject({ code: "OUT_OF_STOCK" });
    expect(orders.stocks.get(1)).toBe(5);
  });

  it("un plat sans stock (illimité) n'est jamais refusé ni décrémenté", async () => {
    const { orders, service } = setup([[1, null]]);
    await service.place(alice, { items: [{ dishId: 1, quantity: 10 }] });
    expect(orders.stocks.get(1)).toBeNull();
  });
});
