import { z } from "zod";
import { paginationShape } from "../../shared/validation.js";
import type { AllergenRecord, CategoryRecord, DishInput, DishPatch, DishRecord, DishSearch } from "./menu.model.js";

// ---- Entrée : schémas stricts, qui produisent directement les types du modèle ----

const csv = (value: string) =>
  value
    .split(",")
    .map((code) => code.trim())
    .filter(Boolean);

export const listDishesQuerySchema = z.strictObject({
  category: z.coerce.number().int().min(1).optional(),
  available: z
    .enum(["true", "false"])
    .transform((value) => value === "true")
    .optional(),
  allergenFree: z.string().transform(csv).optional(),
  q: z.string().max(50).optional(),
  ...paginationShape,
}) satisfies z.ZodType<DishSearch>;

// Champs d'un plat, sans valeur par défaut : le PATCH ne doit pas en réinjecter
const dishFields = {
  name: z.string().min(2).max(80),
  description: z.string().max(300),
  priceCents: z.number().int().min(50).max(10000),
  categoryId: z.number().int(),
  allergens: z.array(z.string()).transform((codes) => [...new Set(codes)]), // sans doublon
  available: z.boolean(),
  stock: z.number().int().min(0).nullable(),
};

export const createDishSchema = z.strictObject({
  name: dishFields.name,
  priceCents: dishFields.priceCents,
  categoryId: dishFields.categoryId,
  description: dishFields.description.optional(),
  allergens: dishFields.allergens.optional(),
  available: dishFields.available.optional(),
  stock: dishFields.stock.optional(),
}) satisfies z.ZodType<DishInput>;

export const updateDishSchema = z
  .strictObject(dishFields)
  .partial()
  .refine((patch) => Object.keys(patch).length > 0, {
    message: "Au moins un champ à modifier",
  }) satisfies z.ZodType<DishPatch>;

// ---- Sortie : chaque champ est choisi explicitement ----

export type CategoryDto = { id: number; name: string; position: number };
export type AllergenDto = { id: number; code: string; label: string };
export type DishDto = {
  id: number;
  name: string;
  description: string;
  priceCents: number;
  available: boolean;
  stock: number | null;
  category: { id: number; name: string };
  allergens: { code: string; label: string }[];
};

export const toDishDto = (d: DishRecord): DishDto => ({
  id: d.id,
  name: d.name,
  description: d.description,
  priceCents: d.priceCents,
  available: d.available,
  stock: d.stock ?? null,
  category: { id: d.category.id, name: d.category.name },
  allergens: d.allergens.map((a) => ({ code: a.code, label: a.label })),
});

export const toCategoryDto = (c: CategoryRecord): CategoryDto => ({ id: c.id, name: c.name, position: c.position });
export const toAllergenDto = (a: AllergenRecord): AllergenDto => ({ id: a.id, code: a.code, label: a.label });
