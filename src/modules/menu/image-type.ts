import { fileTypeFromBuffer } from "file-type";

const ACCEPTED = { png: "image/png", jpg: "image/jpeg", webp: "image/webp" } as const;
export type ImageExtension = keyof typeof ACCEPTED;

// Le type réel se lit dans les premiers octets du fichier : le nom et le type déclaré par le navigateur se falsifient
export async function detectImageExtension(buffer: Buffer): Promise<ImageExtension | null> {
  const found = await fileTypeFromBuffer(buffer);
  return found && found.ext in ACCEPTED ? (found.ext as ImageExtension) : null;
}
