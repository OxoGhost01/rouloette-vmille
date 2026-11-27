import request from "supertest";
import { describe, expect, it } from "vitest";
import { createApp } from "../../src/app.js";
import { loadConfig } from "../../src/config.js";
import { createTestContainer } from "../../src/container.js";

const config = loadConfig({ DATABASE_URL: "file:./test.db", JWT_SECRET: "test-secret-0123456789" });
const app = createApp(createTestContainer(config));

describe("options du palier 4", () => {
  it("GET /docs sert Swagger UI sans connexion", async () => {
    const res = await request(app).get("/docs/").redirects(1);
    expect(res.status).toBe(200);
    expect(res.headers["content-type"]).toMatch(/text\/html/);
    expect(res.text).toContain("swagger-ui");
  });

  it("GET /dishes envoie un ETag et répond 304 si le client le renvoie", async () => {
    const first = await request(app).get("/dishes");
    expect(first.headers.etag).toBeTruthy();
    expect(first.headers["cache-control"]).toBe("no-cache");

    const second = await request(app).get("/dishes").set("If-None-Match", first.headers.etag!);
    expect(second.status).toBe(304);
  });
});
