import { describe, expect, it } from "vitest";
import { canTransition, customerCanCancel } from "../../src/modules/orders/order-status.js";
import { ORDER_STATUSES, type OrderStatus } from "../../src/modules/orders/orders.model.js";

describe("machine à états des commandes", () => {
  it("autorise exactement les transitions du contrat", () => {
    const allowed: Array<[OrderStatus, OrderStatus]> = [
      ["RECEIVED", "PREPARING"],
      ["RECEIVED", "CANCELLED"],
      ["PREPARING", "READY"],
      ["PREPARING", "CANCELLED"],
      ["READY", "PICKED_UP"],
      ["READY", "CANCELLED"],
    ];
    for (const from of ORDER_STATUSES) {
      for (const to of ORDER_STATUSES) {
        const expected = allowed.some(([f, t]) => f === from && t === to);
        expect(canTransition(from, to), `${from} -> ${to}`).toBe(expected);
      }
    }
  });

  it("PICKED_UP et CANCELLED sont des états finaux", () => {
    for (const to of ORDER_STATUSES) {
      expect(canTransition("PICKED_UP", to)).toBe(false);
      expect(canTransition("CANCELLED", to)).toBe(false);
    }
  });

  it("un client ne peut annuler que depuis RECEIVED", () => {
    expect(customerCanCancel("RECEIVED")).toBe(true);
    for (const status of ["PREPARING", "READY", "PICKED_UP", "CANCELLED"] as const) {
      expect(customerCanCancel(status), status).toBe(false);
    }
  });
});
