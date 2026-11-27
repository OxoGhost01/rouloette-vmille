import { randomUUID } from "node:crypto";
import pino from "pino";
import { pinoHttp } from "pino-http";

export type Logger = pino.Logger;

// Logs structurés (JSON) : le jeton et les cookies ne sont jamais écrits
export const createLogger = (level: string): Logger =>
  pino({ level, redact: ["req.headers.authorization", "req.headers.cookie"] });

// Un identifiant par requête : renvoyé dans X-Request-Id et repris dans chaque ligne de log
export const requestLogger = (logger: Logger) =>
  pinoHttp({
    logger,
    genReqId: (_req, res) => {
      const id = randomUUID();
      res.setHeader("X-Request-Id", id);
      return id;
    },
  });
