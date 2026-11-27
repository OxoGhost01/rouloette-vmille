import type { ErrorRequestHandler, RequestHandler } from "express";
import { HttpError } from "./http-error.js";

export const notFoundHandler: RequestHandler = (_req, _res, next) => {
  next(new HttpError(404, "NOT_FOUND", "Route introuvable"));
};

// Gestionnaire d'erreurs unique, placé après authErrorHandler (qui traite les erreurs du module fourni)
export const errorHandler: ErrorRequestHandler = (err, req, res, _next) => {
  if (err instanceof HttpError) {
    res.status(err.status).json({
      error: { code: err.code, message: err.message, ...(err.details === undefined ? {} : { details: err.details }) },
    });
    return;
  }
  req.log.error({ err }, "Erreur imprévue");
  res.status(500).json({ error: { code: "INTERNAL_ERROR", message: "Erreur interne du serveur" } });
};
