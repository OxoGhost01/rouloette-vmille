import type { PageQuery } from "../../shared/pagination.js";

export type CategoryRecord = { id: number; name: string; position: number };
export type AllergenRecord = { id: number; code: string; label: string };

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

// Plat tel que le voit une commande : prix et disponibilité suffisent
export type DishSnapshot = Pick<DishRecord, "id" | "name" | "priceCents" | "available">;

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

// Création : seuls nom, prix et catégorie sont obligatoires, le service complète le reste
export type DishInput = Pick<NewDish, "name" | "priceCents" | "categoryId"> &
  Partial<Pick<NewDish, "description" | "allergens" | "available" | "stock">>;

// Recherche demandée au service de la carte
export type DishSearch = PageQuery & {
  category?: number;
  available?: boolean;
  allergenFree?: string[];
  q?: string;
};

// Filtre transmis au repository
export type DishFilter = {
  categoryId?: number;
  available?: boolean;
  allergenFreeCodes?: string[];
  q?: string;
  skip: number;
  take: number;
};

export type DishWrite = { status: "ok"; dish: DishRecord } | { status: "name_taken" | "not_found" };
export type DishDelete = "deleted" | "not_found" | "ordered";
