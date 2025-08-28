import { Hono } from "hono";
import { logger } from "hono/logger";
import { cors } from "hono/cors";
import { bearerAuth } from "./middleware/auth";
import { Logger } from "./logger";
import { backup } from "./routes/backup";
import healthRoutes from "./routes/health";
import downloadRoutes from "./routes/download";
import fileRoutes from "./routes/files";
import configRoutes from "./routes/config";

const app = new Hono();

// Middleware
app.use("*", logger());
app.use("*", cors());

// Public routes (no auth required)
app.route("/health", healthRoutes);

// Protected routes (require bearer auth)
app.use("/api/*", bearerAuth);
app.route("/api/v1/backup", backup);
app.route("/api/v1/download", downloadRoutes);
// Mount file routes with the snapshot parameter in the path
app.route("/api/v1/backup", fileRoutes);
app.route("/api/v1/config", configRoutes);

// Root endpoint
app.get("/", (c) => {
  return c.json({
    message: "Hi there!",
    timestamp: new Date().toISOString(),
  });
});

// 404 handler
app.notFound((c) => {
  return c.json({ error: "Not Found" }, 404);
});

// Error handler
app.onError((err, c) => {
  Logger.error("Unhandled error:", err);
  return c.json(
    {
      error: "Internal Server Error",
      message: err.message,
    },
    500,
  );
});

export default app;
