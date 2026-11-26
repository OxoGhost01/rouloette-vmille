import { z } from "zod";
import { paginationShape } from "../../shared/pagination.js";

// ---- Entrée : schémas stricts ----

export const listDishesQuerySchema = z.strictObject({
  category: z.coerce.number().int().min(1).optional(),
  available: z.enum(["true", "false"]).optional(),
  allergenFree: z.string().optional(),
  q: z.string().max(50).optional(),
  ...paginationShape,
});

export type ListDishesQuery = z.infer<typeof listDishesQuerySchema>;

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
});

export const updateDishSchema = z
  .strictObject(dishFields)
  .partial()
  .refine((patch) => Object.keys(patch).length > 0, { message: "Au moins un champ à modifier" });

export type CreateDishInput = z.infer<typeof createDishSchema>;
export type UpdateDishInput = z.infer<typeof updateDishSchema>;

// Ce que le service demande d'écrire au repository (valeurs par défaut appliquées)
export type NewDish = {
  name: string;
  description: string;
  priceCents: number;
  categoryId: number;
  allergens: string[];
  available: boolean;
  stock: number | null;
};
export type DishPatch = Partial<NewDish>;

// Filtre repository : ce que le service demande, sans détail HTTP
export type DishFilter = {
  categoryId?: number;
  available?: boolean;
  allergenFreeCodes?: string[];
  q?: string;
  skip: number;
  take: number;
};

// Plat tel que le voit une commande : prix et disponibilité suffisent
export type DishSnapshot = Pick<DishRecord, "id" | "name" | "priceCents" | "available">;

// ---- Sortie ----
export type DishRecord = {
  id: number;
  name: string;
  description: string;
  priceCents: number;
  available: boolean;
  stock?: number | null;
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
  stock: d.stock ?? null,
  category: { id: d.category.id, name: d.category.name },
  allergens: d.allergens.map((a) => ({ code: a.code, label: a.label })),
});

export const toCategoryDto = (c: CategoryRecord) => ({ id: c.id, name: c.name, position: c.position });
export const toAllergenDto = (a: AllergenRecord) => ({ id: a.id, code: a.code, label: a.label });
