import { Router } from "express";
import swaggerUi from "swagger-ui-express";

// Documentation interactive (Swagger UI), publique, à partir du contrat
export function docsRoutes(spec: Record<string, unknown>) {
  const router = Router();
  router.use(swaggerUi.serve, swaggerUi.setup(spec));
  return router;
}
