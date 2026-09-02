import { extname } from "node:path";

const IMAGE_CONTENT_TYPES: Readonly<Record<string, string>> = {
  ".jpg": "image/jpeg",
  ".jpeg": "image/jpeg",
  ".png": "image/png",
  ".webp": "image/webp",
  ".avif": "image/avif",
};

export const ALLOWED_IMAGE_EXTENSIONS_LABEL = "jpg, jpeg, png, webp, or avif";

export function imageContentType(filename: string): string | undefined {
  return IMAGE_CONTENT_TYPES[extname(filename).toLowerCase()];
}

export function isAllowedImageFilename(filename: string): boolean {
  return Boolean(
    filename &&
      !filename.includes("/") &&
      !filename.includes("\\") &&
      !filename.includes("..") &&
      !filename.startsWith(".") &&
      imageContentType(filename),
  );
}
