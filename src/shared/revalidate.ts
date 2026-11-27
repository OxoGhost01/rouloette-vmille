import type { RequestHandler } from "express";

// Cache HTTP : Express envoie déjà un ETag et répond 304 si le contenu n'a pas changé.
// `no-cache` oblige les clients à revalider à chaque fois : une modification reste visible immédiatement.
export const revalidate: RequestHandler = (_req, res, next) => {
  res.setHeader("Cache-Control", "no-cache");
  next();
};
