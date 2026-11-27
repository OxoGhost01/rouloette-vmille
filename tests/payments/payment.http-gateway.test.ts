import { createServer, type Server } from "node:http";
import type { AddressInfo } from "node:net";
import { afterEach, describe, expect, it } from "vitest";
import { HttpPaymentGateway } from "../../src/modules/payments/payment.http-gateway.js";

let server: Server;

// Faux prestataire : répond avec les statuts donnés, dans l'ordre, et garde les clés d'idempotence reçues
async function fakeProvider(statuses: number[]) {
  const keys: unknown[] = [];
  server = createServer((req, res) => {
    keys.push(req.headers["idempotency-key"]);
    const status = statuses[keys.length - 1] ?? statuses.at(-1)!;
    res.writeHead(status, { "Content-Type": "application/json" });
    res.end(JSON.stringify(status === 402 ? { status: "declined", declineReason: "nope" } : { status: "succeeded" }));
  });
  await new Promise<void>((resolve) => server.listen(0, resolve));
  const baseUrl = `http://localhost:${(server.address() as AddressInfo).port}`;
  return { keys, gateway: new HttpPaymentGateway({ baseUrl, apiKey: "k", backoffMs: 1 }) };
}

const request = { amountCents: 1000, reference: "order-1", token: "tok_visa" };

afterEach(() => new Promise((resolve) => server.close(resolve)));

describe("HttpPaymentGateway", () => {
  it("réessaie sur 5xx avec la même Idempotency-Key, puis réussit", async () => {
    const { gateway, keys } = await fakeProvider([503, 201]);
    await expect(gateway.charge(request)).resolves.toEqual({ status: "succeeded" });
    expect(keys).toHaveLength(2);
    expect(keys[0]).toBeTruthy();
    expect(keys[1]).toBe(keys[0]);
  });

  it("ne réessaie pas un refus (402) et abandonne après 3 pannes", async () => {
    const declined = await fakeProvider([402]);
    await expect(declined.gateway.charge(request)).resolves.toEqual({ status: "declined", reason: "nope" });
    expect(declined.keys).toHaveLength(1);
    await new Promise((resolve) => server.close(resolve));

    const down = await fakeProvider([500]);
    await expect(down.gateway.charge(request)).rejects.toMatchObject({ kind: "unavailable" });
    expect(down.keys).toHaveLength(3);
  });
});
