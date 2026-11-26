export type PageQuery = { page: number; pageSize: number };

export type Page<T> = { items: T[]; total: number; page: number; pageSize: number };

export const pageWindow = ({ page, pageSize }: PageQuery) => ({ skip: (page - 1) * pageSize, take: pageSize });

export const toPage = <T>(items: T[], total: number, { page, pageSize }: PageQuery): Page<T> => ({
  items,
  total,
  page,
  pageSize,
});

// Sortie : transforme chaque élément d'une page (la vue) sans toucher à la pagination
export const mapPage = <T, U>(page: Page<T>, toDto: (item: T) => U): Page<U> => ({
  ...page,
  items: page.items.map(toDto),
});
