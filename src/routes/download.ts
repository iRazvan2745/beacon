// src/routes/download.ts
import { Hono } from "hono";
import { Logger } from "../logger";
import { spawn } from "bun";
import { config, getResticRepository } from "../config";

const router = new Hono();

// GET /api/v1/download/:snapshot/*path
router.get("/:snapshot/*", async (c) => {
  const snapshot = c.req.param("snapshot");
  // Remaining path after /:snapshot/...
  const filePath = c.req.param("*") || "";
  if (!snapshot || !filePath) {
    return c.json({ error: "snapshot and file path are required" }, 400);
  }

  Logger.info("download_stream_start", { snapshot, filePath });

  // Run: restic dump <snapshot> <filePath>
  const env = {
    ...process.env,
    RESTIC_REPOSITORY: getResticRepository(),
    RESTIC_PASSWORD: config.resticPassword,
    AWS_ACCESS_KEY_ID: config.s3AccessKeyId,
    AWS_SECRET_ACCESS_KEY: config.s3SecretAccessKey,
    AWS_DEFAULT_REGION: config.s3Region,
    AWS_S3_FORCE_PATH_STYLE: "true",
  } as Record<string, string>;

  const proc = spawn({
    cmd: ["restic", "dump", snapshot, filePath],
    env,
    stdout: "pipe",
    stderr: "pipe"
  });

  // Optional: set a generic content type or detect by file extension
  const headers = new Headers({
    "Content-Type": "application/octet-stream",
    "Content-Disposition": `attachment; filename="${filePath.split("/").pop() || "file"}"`
  });

  // If restic fails, read stderr and return error
  const errorPromise = new Response(proc.stderr).text();

  // Create a streaming response from stdout
  const body = proc.stdout;

  const response = new Response(body, { headers });

  // Attach a finalizer to check exit code and possibly abort response
  proc.exited.then(async (code) => {
    if (code !== 0) {
      const err = await errorPromise;
      Logger.error("restic_dump_failed", { code, err });
      // Note: if the client is still connected, they may receive a truncated stream.
      // For strict behavior, you could buffer or use a temp file instead.
    } else {
      Logger.info("download_stream_ok", { snapshot, filePath });
    }
  });

  return response;
});

export default router;