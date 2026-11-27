import { mkdtemp, readdir, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import request from "supertest";
import { afterAll, beforeAll, beforeEach, describe, expect, it } from "vitest";
import { createApp } from "../../src/app.js";
import { loadConfig } from "../../src/config.js";
import { createTestContainer } from "../../src/container.js";
import { hashPassword, type Role } from "../../src/fourni/auth/index.js";
import { DiskDishImageStorage } from "../../src/modules/menu/dish-image.storage.js";
import { InMemoryMenuRepository } from "../../src/modules/menu/menu.repository.js";
import { InMemoryUserRepository } from "../../src/modules/users/user.repository.js";
import { NOT_AN_IMAGE, PNG } from "../support/images.js";

let uploadDir: string;
let app: ReturnType<typeof createApp>;
let admin: string;
let staff: string;

async function tokenFor(users: InMemoryUserRepository, role: Role) {
  const email = `${role.toLowerCase()}@test.fr`;
  await users.create({ email, name: "Test", role, passwordHash: await hashPassword("Motdepasse1!") });
  const res = await request(app).post("/auth/login").send({ email, password: "Motdepasse1!" });
  return `Bearer ${res.body.token}`;
}

const putImage = (token: string | null, id: number) => {
  const req = request(app).put(`/dishes/${id}/image`);
  return token ? req.set("Authorization", token) : req;
};

const storedFiles = () => readdir(join(uploadDir, "dishes"));

beforeAll(async () => {
  uploadDir = await mkdtemp(join(tmpdir(), "roulotte-uploads-"));
});

afterAll(() => rm(uploadDir, { recursive: true, force: true }));

beforeEach(async () => {
  const users = new InMemoryUserRepository();
  const menu = new InMemoryMenuRepository({
    categories: [{ id: 1, name: "Desserts", position: 1 }],
    dishes: [
      {
        id: 1,
        name: "Brownie",
        description: "",
        priceCents: 450,
        available: true,
        category: { id: 1, name: "Desserts" },
        allergens: [],
      },
    ],
  });
  const config = loadConfig({
    DATABASE_URL: "file:./test.db",
    JWT_SECRET: "test-secret-0123456789",
    UPLOAD_DIR: uploadDir,
  });
  app = createApp(createTestContainer(config, { users, menu, images: new DiskDishImageStorage(uploadDir) }));
  admin = await tokenFor(users, "ADMIN");
  staff = await tokenFor(users, "STAFF");
});

describe("PUT /dishes/:id/image", () => {
  it("200 : le plat porte son imageUrl, et la photo est servie à une autre origine", async () => {
    const res = await putImage(admin, 1).attach("image", PNG, { filename: "../../burger.png", contentType: "image/png" });

    expect(res.status).toBe(200);
    expect(res.body.imageUrl).toMatch(/^\/uploads\/dishes\/[0-9a-f-]{36}\.png$/);
    expect(res.body.imageUrl).not.toContain("burger");
    expect((await request(app).get("/dishes/1")).body.imageUrl).toBe(res.body.imageUrl);

    const image = await request(app).get(res.body.imageUrl);
    expect(image.status).toBe(200);
    expect(image.headers["content-type"]).toBe("image/png");
    expect(image.headers["cross-origin-resource-policy"]).toBe("cross-origin");
  });

  it("une nouvelle photo remplace l'ancienne : l'ancien fichier n'est plus servi ni conservé", async () => {
    const first: string = (await putImage(admin, 1).attach("image", PNG, "a.png")).body.imageUrl;
    const second: string = (await putImage(admin, 1).attach("image", PNG, "b.png")).body.imageUrl;

    expect(second).not.toBe(first);
    expect((await request(app).get(first)).status).toBe(404);
    expect((await request(app).get(second)).status).toBe(200);
    const files = await storedFiles();
    expect(files).toContain(second.split("/").pop());
    expect(files).not.toContain(first.split("/").pop());
  });

  it("415 : le contenu est vérifié, pas le nom ni le type déclaré", async () => {
    const res = await putImage(admin, 1).attach("image", NOT_AN_IMAGE, { filename: "piege.png", contentType: "image/png" });
    expect(res.status).toBe(415);
    expect(res.body.error.code).toBe("UNSUPPORTED_MEDIA_TYPE");
  });

  it("413 au-delà de 2 Mo", async () => {
    const big = Buffer.concat([PNG, Buffer.alloc(2.5 * 1024 * 1024)]);
    const res = await putImage(admin, 1).attach("image", big, "gros.png");
    expect(res.status).toBe(413);
    expect(res.body.error.code).toBe("PAYLOAD_TOO_LARGE");
  });

  it("400 sans fichier, ou avec un fichier dans le mauvais champ", async () => {
    const empty = await putImage(admin, 1).field("autre", "valeur");
    expect(empty.status).toBe(400);
    expect(empty.body.error.code).toBe("VALIDATION_ERROR");

    const wrongField = await putImage(admin, 1).attach("photo", PNG, "a.png");
    expect(wrongField.status).toBe(400);
  });

  it("401 sans token, 403 pour la cuisine, 404 pour un plat inconnu", async () => {
    expect((await putImage(null, 1).attach("image", PNG, "a.png")).status).toBe(401);
    expect((await putImage(staff, 1).attach("image", PNG, "a.png")).status).toBe(403);
    expect((await putImage(admin, 999).attach("image", PNG, "a.png")).status).toBe(404);
  });

  it("GET /uploads/... répond 404 au format du contrat pour un fichier inconnu", async () => {
    const res = await request(app).get("/uploads/dishes/inconnu.png");
    expect(res.status).toBe(404);
    expect(res.body.error.code).toBe("NOT_FOUND");
  });
});
