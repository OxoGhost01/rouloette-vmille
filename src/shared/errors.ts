import type { ErrorRequestHandler, RequestHandler } from "express";

// Erreur métier ou HTTP, rendue au format du contrat : { error: { code, message, details? } }
export class HttpError extends Error {
  constructor(
    public readonly status: number,
    public readonly code: string,
    message: string,
    public readonly details?: unknown,
  ) {
    super(message);
    this.name = "HttpError";
  }
}

export const notFoundHandler: RequestHandler = (_req, _res, next) => {
  next(new HttpError(404, "NOT_FOUND", "Route introuvable"));
};

// Gestionnaire d'erreurs unique, placé après authErrorHandler (qui traite les erreurs du module fourni)
export const errorHandler: ErrorRequestHandler = (err, _req, res, _next) => {
  if (err instanceof HttpError) {
    res.status(err.status).json({
      error: { code: err.code, message: err.message, ...(err.details === undefined ? {} : { details: err.details }) },
    });
    return;
  }
  console.error(err);
  res.status(500).json({ error: { code: "INTERNAL_ERROR", message: "Erreur interne du serveur" } });
};
