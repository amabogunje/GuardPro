import { put, get } from "@vercel/blob";
import fs from "node:fs/promises";
import path from "node:path";
import { Readable } from "node:stream";
import { pipeline } from "node:stream/promises";

export const cloudMedia = Boolean(process.env.BLOB_READ_WRITE_TOKEN);
if (process.env.VERCEL && !cloudMedia)
  throw new Error("Private Blob storage must be configured");
export const maxUploadBytes = 4 * 1024 * 1024;
export async function saveMedia(key, buffer, contentType) {
  if (cloudMedia) {
    const blob = await put("guardpro/" + key, buffer, {
      access: "private",
      contentType,
      addRandomSuffix: false,
      allowOverwrite: true,
    });
    return blob.url;
  }
  const file = path.resolve(process.env.DATA_DIR || "data", "media", key);
  await fs.mkdir(path.dirname(file), { recursive: true });
  await fs.writeFile(file, buffer);
  return file;
}
export async function serveMedia(req, res, media) {
  res.set("Cache-Control", "private, no-store").type(media.mime);
  if (!cloudMedia)
    return new Promise((resolve, reject) =>
      res.sendFile(media.path, (error) => (error ? reject(error) : resolve())),
    );
  const result = await get(media.path, { access: "private", useCache: false });
  if (!result || result.statusCode !== 200)
    throw Object.assign(
      new Error("Recording or photo unavailable; retry shortly"),
      { status: 503 },
    );
  // The pilot caps each file below the Vercel request/response size limit.
  await pipeline(Readable.fromWeb(result.stream), res);
}
