import { z } from "zod";

// Champs de pagination communs à toutes les listes (50 éléments par page au plus)
export const paginationShape = {
  page: z.coerce.number().int().min(1).default(1),
  pageSize: z.coerce.number().int().min(1).max(50).default(20),
};

export type PageQuery = { page: number; pageSize: number };

export const pageWindow = ({ page, pageSize }: PageQuery) => ({ skip: (page - 1) * pageSize, take: pageSize });

export const toPage = <T>(items: T[], total: number, { page, pageSize }: PageQuery) => ({
  items,
  total,
  page,
  pageSize,
});
