import { put, get } from "@vercel/blob";
import fs from "node:fs/promises";
import path from "node:path";
import { Readable } from "node:stream";
import { pipeline } from "node:stream/promises";

export const cloudMedia = Boolean(process.env.BLOB_READ_WRITE_TOKEN);
if (process.env.VERCEL && !cloudMedia)
  throw new Error("Private Blob storage must be configured");
export const maxUploadBytes = 4 * 1024 * 1024;
let testFailureConsumed = false;
export async function saveMedia(key, buffer, contentType) {
  // Test-only delay used to prove an external upload cannot hold the write
  // transaction. It is never configured by the application runtime.
  const testDelay = Number(process.env.TEST_MEDIA_UPLOAD_DELAY_MS || 0);
  if (Number.isFinite(testDelay) && testDelay > 0)
    await new Promise((resolve) => setTimeout(resolve, testDelay));
  if (process.env.TEST_MEDIA_UPLOAD_FAIL_ONCE === "true" && !testFailureConsumed) {
    testFailureConsumed = true;
    throw Object.assign(new Error("Test media store unavailable"), { status: 503 });
  }
  if (cloudMedia) {
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), Number(process.env.MEDIA_UPLOAD_TIMEOUT_MS || 30000));
    try {
      const blob = await put("guardpro/" + key, buffer, {
        access: "private",
        contentType,
        addRandomSuffix: false,
        allowOverwrite: true,
        abortSignal: controller.signal,
      });
      return blob.url;
    } catch (error) {
      if (controller.signal.aborted)
        throw Object.assign(new Error("Media upload timed out; retry shortly"), { status: 503 });
      throw error;
    } finally {
      clearTimeout(timeout);
    }
  }
  const file = path.resolve(process.env.DATA_DIR || "data", "media", key);
  await fs.mkdir(path.dirname(file), { recursive: true });
  await fs.writeFile(file, buffer);
  return file;
}
export async function serveMedia(req, res, media) {
  res.set("Cache-Control", "private, no-store").type(media.mime);
  if (!cloudMedia) {
    try {
      // Local pilot media is capped on upload. Reading it here avoids an
      // Express sendFile path-resolution failure on Windows/OneDrive paths.
      return res.send(await fs.readFile(media.path));
    } catch {
      throw Object.assign(new Error("Recording or photo unavailable"), {
        status: 404,
      });
    }
  }
  const result = await get(media.path, { access: "private", useCache: false });
  if (!result || result.statusCode !== 200)
    throw Object.assign(
      new Error("Recording or photo unavailable; retry shortly"),
      { status: 503 },
    );
  // The pilot caps each file below the Vercel request/response size limit.
  await pipeline(Readable.fromWeb(result.stream), res);
}
