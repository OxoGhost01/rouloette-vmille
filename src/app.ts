import express from "express";
import type { Container } from "./container.js";
import { authErrorHandler, installSecurity } from "./fourni/auth/index.js";
import { errorHandler, notFoundHandler } from "./shared/errors.js";

// L'ordre compte : sécurité -> routes -> 404 -> erreurs du module fourni -> erreurs de l'API
export function createApp(container: Container) {
  const app = express();

  installSecurity(app, { corsOrigin: container.config.CORS_ORIGIN });

  app.use("/auth", container.auth.router);
  for (const [path, router] of container.routes) app.use(path, router);

  app.use(notFoundHandler);
  app.use(authErrorHandler);
  app.use(errorHandler);

  return app;
}
