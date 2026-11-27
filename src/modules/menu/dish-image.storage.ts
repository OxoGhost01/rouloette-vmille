import { mkdir, unlink, writeFile } from "node:fs/promises";
import { basename, join } from "node:path";

export const DISH_IMAGE_URL_PREFIX = "/uploads/dishes/";

// Où vivent les photos des plats : le service ne connaît que cette interface, pas le disque
export interface DishImageStorage {
  // Enregistre le fichier sous le nom donné et renvoie son URL relative à l'API
  save(filename: string, buffer: Buffer): Promise<string>;
  remove(url: string): Promise<void>;
}

export class DiskDishImageStorage implements DishImageStorage {
  private readonly dir: string;

  constructor(uploadDir: string) {
    this.dir = join(uploadDir, "dishes");
  }

  async save(filename: string, buffer: Buffer) {
    await mkdir(this.dir, { recursive: true });
    await writeFile(join(this.dir, basename(filename)), buffer);
    return DISH_IMAGE_URL_PREFIX + basename(filename);
  }

  async remove(url: string) {
    // basename : une URL forgée ne peut pas sortir du dossier des photos
    if (!url.startsWith(DISH_IMAGE_URL_PREFIX)) return;
    try {
      await unlink(join(this.dir, basename(url)));
    } catch (error) {
      if ((error as NodeJS.ErrnoException).code !== "ENOENT") throw error;
    }
  }
}

// Pour les tests sans disque
export class InMemoryDishImageStorage implements DishImageStorage {
  readonly files = new Map<string, Buffer>();

  async save(filename: string, buffer: Buffer) {
    const url = DISH_IMAGE_URL_PREFIX + filename;
    this.files.set(url, buffer);
    return url;
  }

  async remove(url: string) {
    this.files.delete(url);
  }
}
