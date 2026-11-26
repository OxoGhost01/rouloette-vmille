import { z } from "zod";
import { HttpError } from "./http-error.js";

// Valide une entrée (body, query, params) avec un schéma Zod ; sinon 400 VALIDATION_ERROR
export function parse<T>(schema: z.ZodType<T>, input: unknown): T {
  const result = schema.safeParse(input);
  if (!result.success) {
    const details = result.error.issues.map((i) => ({ path: i.path.join("."), message: i.message }));
    throw new HttpError(400, "VALIDATION_ERROR", "Données invalides", details);
  }
  return result.data;
}

// Champs de pagination communs à toutes les listes (50 éléments par page au plus)
export const paginationShape = {
  page: z.coerce.number().int().min(1).default(1),
  pageSize: z.coerce.number().int().min(1).max(50).default(20),
};

// Paramètre de chemin /:id, commun à toutes les ressources
export const idParamSchema = z.strictObject({ id: z.coerce.number().int().min(1) });
