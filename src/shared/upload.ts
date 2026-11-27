import type { RequestHandler } from "express";
import multer from "multer";
import { HttpError } from "./http-error.js";

export const MAX_IMAGE_BYTES = 2 * 1024 * 1024;

// multer en mémoire : le fichier n'est écrit sur le disque qu'après vérification de son contenu
const receiveImage = multer({ storage: multer.memoryStorage(), limits: { fileSize: MAX_IMAGE_BYTES, files: 1 } }).single(
  "image",
);

// Reçoit le champ de formulaire `image` et traduit les erreurs de multer au format du contrat
export const uploadImage: RequestHandler = (req, res, next) => {
  receiveImage(req, res, (error?: unknown) => {
    if (!(error instanceof multer.MulterError)) return next(error);
    if (error.code === "LIMIT_FILE_SIZE") {
      return next(new HttpError(413, "PAYLOAD_TOO_LARGE", "Image trop volumineuse : 2 Mo au plus"));
    }
    next(new HttpError(400, "VALIDATION_ERROR", "Formulaire invalide : un seul fichier, dans le champ « image »"));
  });
};
