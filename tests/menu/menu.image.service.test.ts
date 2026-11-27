import { describe, expect, it, vi } from "vitest";
import { InMemoryDishImageStorage } from "../../src/modules/menu/dish-image.storage.js";
import type { DishRecord } from "../../src/modules/menu/menu.model.js";
import { InMemoryMenuRepository } from "../../src/modules/menu/menu.repository.js";
import { MenuService } from "../../src/modules/menu/menu.service.js";
import { JPEG, NOT_AN_IMAGE, PNG, WEBP } from "../support/images.js";

const brownie: DishRecord = {
  id: 1,
  name: "Brownie",
  description: "",
  priceCents: 450,
  available: true,
  category: { id: 1, name: "Desserts" },
  allergens: [],
};

function setup() {
  const menu = new InMemoryMenuRepository({ categories: [{ id: 1, name: "Desserts", position: 1 }], dishes: [brownie] });
  const images = new InMemoryDishImageStorage();
  return { menu, images, service: new MenuService(menu, images) };
}

describe("MenuService.replaceDishImage", () => {
  it("enregistre la photo sous un nom choisi par le serveur et renvoie le plat avec son imageUrl", async () => {
    const { service, images } = setup();

    const dish = await service.replaceDishImage(1, { buffer: PNG });

    expect(dish.imageUrl).toMatch(/^\/uploads\/dishes\/[0-9a-f-]{36}\.png$/);
    expect(images.files.get(dish.imageUrl!)).toEqual(PNG);
    expect((await service.getDish(1)).imageUrl).toBe(dish.imageUrl);
  });

  it("déduit l'extension du contenu : PNG, JPEG et WebP sont acceptés", async () => {
    const { service } = setup();
    expect((await service.replaceDishImage(1, { buffer: PNG })).imageUrl).toMatch(/\.png$/);
    expect((await service.replaceDishImage(1, { buffer: JPEG })).imageUrl).toMatch(/\.jpg$/);
    expect((await service.replaceDishImage(1, { buffer: WEBP })).imageUrl).toMatch(/\.webp$/);
  });

  it("refuse un fichier qui n'est pas une image avec 415, sans rien enregistrer", async () => {
    const { service, images } = setup();

    await expect(service.replaceDishImage(1, { buffer: NOT_AN_IMAGE })).rejects.toMatchObject({
      status: 415,
      code: "UNSUPPORTED_MEDIA_TYPE",
    });

    expect(images.files.size).toBe(0);
    expect((await service.getDish(1)).imageUrl ?? null).toBeNull();
  });

  it("répond 404 pour un plat inconnu, sans rien enregistrer", async () => {
    const { service, images } = setup();
    await expect(service.replaceDishImage(99, { buffer: PNG })).rejects.toMatchObject({ status: 404 });
    expect(images.files.size).toBe(0);
  });

  it("une nouvelle photo remplace l'ancienne, dont le fichier est supprimé", async () => {
    const { service, images } = setup();

    const first = (await service.replaceDishImage(1, { buffer: PNG })).imageUrl!;
    const second = (await service.replaceDishImage(1, { buffer: JPEG })).imageUrl!;

    expect(second).not.toBe(first);
    expect([...images.files.keys()]).toEqual([second]);
  });

  it("ne fait pas échouer l'envoi si l'ancienne photo ne peut pas être supprimée", async () => {
    const { service, images } = setup();
    await service.replaceDishImage(1, { buffer: PNG });
    vi.spyOn(images, "remove").mockRejectedValue(new Error("disque en lecture seule"));

    await expect(service.replaceDishImage(1, { buffer: JPEG })).resolves.toMatchObject({
      imageUrl: expect.stringMatching(/\.jpg$/),
    });
  });

  it("supprime le fichier qu'il vient d'écrire si le plat a disparu entre-temps", async () => {
    const { service, menu, images } = setup();
    vi.spyOn(menu, "setDishImage").mockResolvedValue({ status: "not_found" });

    await expect(service.replaceDishImage(1, { buffer: PNG })).rejects.toMatchObject({ status: 404 });

    expect(images.files.size).toBe(0);
  });
});
