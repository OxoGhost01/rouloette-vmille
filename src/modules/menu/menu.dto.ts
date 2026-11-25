import { z } from "zod";

// ---- Entrée : schémas stricts ----
export const idParamSchema = z.strictObject({ id: z.coerce.number().int().min(1) });

export const listDishesQuerySchema = z.strictObject({
  category: z.coerce.number().int().min(1).optional(),
  available: z.enum(["true", "false"]).optional(),
  allergenFree: z.string().optional(),
  q: z.string().max(50).optional(),
  page: z.coerce.number().int().min(1).default(1),
  pageSize: z.coerce.number().int().min(1).max(50).default(20),
});

export type ListDishesQuery = z.infer<typeof listDishesQuerySchema>;

// Filtre repository : ce que le service demande, sans détail HTTP
export type DishFilter = {
  categoryId?: number;
  available?: boolean;
  allergenFreeCodes?: string[];
  q?: string;
  skip: number;
  take: number;
};

// ---- Sortie ----
export type DishRecord = {
  id: number;
  name: string;
  description: string;
  priceCents: number;
  available: boolean;
  category: { id: number; name: string };
  allergens: { code: string; label: string }[];
};

export type CategoryRecord = { id: number; name: string; position: number };
export type AllergenRecord = { id: number; code: string; label: string };

export const toDishDto = (d: DishRecord) => ({
  id: d.id,
  name: d.name,
  description: d.description,
  priceCents: d.priceCents,
  available: d.available,
  category: { id: d.category.id, name: d.category.name },
  allergens: d.allergens.map((a) => ({ code: a.code, label: a.label })),
});

export const toCategoryDto = (c: CategoryRecord) => ({ id: c.id, name: c.name, position: c.position });
export const toAllergenDto = (a: AllergenRecord) => ({ id: a.id, code: a.code, label: a.label });
