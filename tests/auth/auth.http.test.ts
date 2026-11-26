import request from "supertest";
import { describe, expect, it } from "vitest";
import { createApp } from "../../src/app.js";
import { loadConfig } from "../../src/config.js";
import { createTestContainer } from "../../src/container.js";

const config = loadConfig({ DATABASE_URL: "file:./test.db", JWT_SECRET: "test-secret-0123456789" });
const app = createApp(createTestContainer(config));
const creds = { email: "a@b.test", name: "Alice", password: "motdepasse1" };

describe("authentification (module fourni branché)", () => {
  it("ne laisse jamais fuiter le hash du mot de passe, ni à l'inscription, ni à la connexion, ni sur /auth/me", async () => {
    const register = await request(app).post("/auth/register").send(creds);
    const login = await request(app).post("/auth/login").send({ email: creds.email, password: creds.password });
    const me = await request(app).get("/auth/me").set("Authorization", `Bearer ${login.body.token}`);

    expect(register.status).toBe(201);
    expect(login.status).toBe(200);
    expect(me.body).toMatchObject({ email: creds.email, role: "CUSTOMER" });
    for (const res of [register, login, me]) {
      expect(JSON.stringify(res.body)).not.toMatch(/passwordHash|motdepasse1/);
    }
  });

  it("refuse un champ role à l'inscription (mass assignment) et inscrit toujours un CUSTOMER", async () => {
    const res = await request(app)
      .post("/auth/register")
      .send({ ...creds, email: "evil@b.test", role: "ADMIN" });
    expect(res.status).toBe(400);
  });

  it("répond 401 sans token et 404 au format du contrat sur une route inconnue", async () => {
    expect((await request(app).get("/auth/me")).body.error.code).toBe("UNAUTHORIZED");
    const unknown = await request(app).get("/nimporte-quoi");
    expect(unknown.status).toBe(404);
    expect(unknown.body.error).toMatchObject({ code: "NOT_FOUND" });
  });

  it("répond 400 INVALID_JSON sur un corps mal formé", async () => {
    const res = await request(app).post("/auth/login").set("Content-Type", "application/json").send("{ pas du json");
    expect(res.status).toBe(400);
    expect(res.body.error.code).toBe("INVALID_JSON");
  });
});
