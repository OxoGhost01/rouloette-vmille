import express, { Router } from "express";

// Sert les photos. Helmet interdit par défaut qu'une autre origine affiche nos fichiers
// (Cross-Origin-Resource-Policy: same-origin) : le front tourne sur un autre port, on l'autorise ici seulement.
export function staticUploads(uploadDir: string) {
  const router = Router();
  router.use((_req, res, next) => {
    res.setHeader("Cross-Origin-Resource-Policy", "cross-origin");
    next();
  });
  router.use(express.static(uploadDir, { index: false, dotfiles: "ignore", maxAge: "1h" }));
  return router;
}
