import { Hono } from "hono";
import { ResticManager } from "../restic";
import { Logger } from "../logger";
import { config } from "../config";
import { sendStats } from "../utils/report";

const backup = new Hono();
const restic = new ResticManager();

// Stream backup progress: POST /api/backup
backup.post("/", async (c) => {
  return c.body(
    new ReadableStream({
      async start(controller) {
        const encoder = new TextEncoder();
        const machineId = c.req.header("x-machine-id") || "default";

        const sendUpdate = async (data: any) => {
          const message = `data: ${JSON.stringify(data)}\n\n`;
          controller.enqueue(encoder.encode(message));

          // Save to database history - this would need to be implemented
          // based on your database setup
          try {
            await saveToHistory(machineId, data);
          } catch (error) {
            console.error("Failed to save history:", error);
          }
        };

        try {
          const startData = {
            type: "progress",
            step: "starting",
            message: "API backup request initiated",
            timestamp: new Date().toISOString(),
          };
          await sendUpdate(startData);

          Logger.info("API backup request initiated");

          // Initialize repository
          const initData = {
            type: "progress",
            step: "init",
            message: "Initializing repository...",
            timestamp: new Date().toISOString(),
          };
          await sendUpdate(initData);

          await restic.initRepository();

          const initCompleteData = {
            type: "progress",
            step: "init_complete",
            message: "Repository initialized",
            timestamp: new Date().toISOString(),
          };
          await sendUpdate(initCompleteData);

          // Get hostname and prepare backup
          const tags = ["api", "pterodactyl"];
          let host = "unknown";
          try {
            const p = Bun.spawn(["hostname"]);
            host = (await new Response(p.stdout).text()).trim() || "unknown";
          } catch {}

          const preparingData = {
            type: "progress",
            step: "preparing",
            message: `Preparing backup for ${host}...`,
            timestamp: new Date().toISOString(),
            host,
            tags,
          };
          await sendUpdate(preparingData);

          await Logger.notifyBackupStarted({
            path: (config as any)?.restic?.backupPath ?? "/var/lib/pterodactyl",
            tags,
            host,
          });

          const startedAt = Date.now();

          // Run backup
          const backupRunningData = {
            type: "progress",
            step: "backup_running",
            message: "Running backup...",
            timestamp: new Date().toISOString(),
          };
          await sendUpdate(backupRunningData);

          const backupResult = await restic.backup(tags);

          const backupCompleteData = {
            type: "progress",
            step: "backup_complete",
            message: "Backup completed, running retention policies...",
            timestamp: new Date().toISOString(),
            backup: backupResult,
          };
          await sendUpdate(backupCompleteData);

          // Run retention
          const retentionRunningData = {
            type: "progress",
            step: "retention_running",
            message: "Applying retention policies...",
            timestamp: new Date().toISOString(),
          };
          await sendUpdate(retentionRunningData);

          const retentionResult = await restic.forget();

          const retentionCompleteData = {
            type: "progress",
            step: "retention_complete",
            message: "Retention policies applied",
            timestamp: new Date().toISOString(),
            retention: retentionResult,
          };
          await sendUpdate(retentionCompleteData);

          Logger.success("API backup completed successfully");

          const durationSec = (Date.now() - startedAt) / 1000;
          await Logger.notifyBackupFinished({
            ok: true,
            snapshotId:
              (backupResult as any).snapshotId ??
              (backupResult as any).snapshot_id ??
              null,
            dataAdded:
              (backupResult as any).dataAdded ??
              (backupResult as any).data_added,
            totalFilesProcessed:
              (backupResult as any).totalFilesProcessed ??
              (backupResult as any).total_files_processed,
            durationSec,
          });

          // Send final success message
          const completeData = {
            type: "complete",
            success: true,
            message: "Backup completed successfully",
            backup: backupResult,
            retention: retentionResult,
            durationSec,
            timestamp: new Date().toISOString(),
          };
          await sendUpdate(completeData);

          // Send stats to conductor after successful backup
          try {
            const stats = await restic.getStats();
            const statsData = {
              totalSize: stats.totalSize,
              totalSizeHuman: `${(stats.totalSize / 1024 / 1024 / 1024).toFixed(2)} GB`,
              totalFileCount: stats.totalFileCount,
              snapshotCount: stats.snapshotCount,
              lastBackup: new Date().toISOString(),
              backupResult: {
                snapshotId: backupResult.snapshotId,
                filesNew: backupResult.filesNew,
                filesChanged: backupResult.filesChanged,
                filesUnmodified: backupResult.filesUnmodified,
                duration: durationSec,
              },
            };

            await sendStats({ machineId, data: statsData });
            Logger.info("Stats sent to conductor successfully");
          } catch (statsError) {
            Logger.error("Failed to send stats to conductor:", statsError);
          }
        } catch (error) {
          Logger.error("API backup failed:", error);
          await Logger.notifyBackupFinished({
            ok: false,
            error: error instanceof Error ? error.message : String(error),
          });

          const errorData = {
            type: "error",
            success: false,
            error: error instanceof Error ? error.message : "Unknown error",
            timestamp: new Date().toISOString(),
          };
          await sendUpdate(errorData);
        } finally {
          controller.close();
        }
      },
    }),
    {
      headers: {
        "Content-Type": "text/event-stream",
        "Cache-Control": "no-cache",
        Connection: "keep-alive",
        "Access-Control-Allow-Origin": "*",
        "Access-Control-Allow-Headers": "Content-Type",
      },
    },
  );
});

// Helper function to save history - you'll need to implement this
// based on your database setup in the backend
async function saveToHistory(machineId: string, data: any) {
  // This would be implemented on your backend with Prisma
  // For now, just log it
  console.log(`Saving to history for machine ${machineId}:`, data);
}

// Keep existing endpoints...
backup.post("/init", async (c) => {
  try {
    Logger.info("API repository initialization initiated");
    const success = await restic.initRepository();
    if (success) {
      return c.json({
        success: true,
        message: "Repository initialized successfully",
        timestamp: new Date().toISOString(),
      });
    }
    return c.json(
      { success: false, error: "Failed to initialize repository" },
      500,
    );
  } catch (error) {
    Logger.error("Repository initialization failed:", error);
    return c.json(
      {
        success: false,
        error: error instanceof Error ? error.message : "Unknown error",
      },
      500,
    );
  }
});

backup.post("/check", async (c) => {
  try {
    Logger.info("API repository check initiated");
    await restic.check();
    return c.json({
      success: true,
      message: "Repository integrity check passed",
      timestamp: new Date().toISOString(),
    });
  } catch (error) {
    Logger.error("Repository check failed:", error);
    return c.json(
      {
        success: false,
        error: error instanceof Error ? error.message : "Unknown error",
      },
      500,
    );
  }
});

backup.get("/snapshots", async (c) => {
  try {
    const snapshots = await restic.listSnapshots();
    return c.json({
      success: true,
      snapshots,
      count: snapshots.length,
      timestamp: new Date().toISOString(),
    });
  } catch (error) {
    Logger.error("Failed to list snapshots:", error);
    return c.json(
      {
        success: false,
        error: error instanceof Error ? error.message : "Unknown error",
      },
      500,
    );
  }
});

backup.get("/stats", async (c) => {
  try {
    const stats = await restic.getStats();
    const statsResponse = {
      success: true,
      stats: {
        totalSize: stats.totalSize,
        totalSizeHuman: `${(stats.totalSize / 1024 / 1024 / 1024).toFixed(
          2,
        )} GB`,
        totalFileCount: stats.totalFileCount,
        snapshotCount: stats.snapshotCount,
      },
      timestamp: new Date().toISOString(),
    };

    // Also send stats to conductor if APP_URL is configured
    if (process.env.APP_URL) {
      try {
        const machineId = c.req.header("x-machine-id") || "default";
        await sendStats({
          machineId,
          data: {
            ...statsResponse.stats,
            lastReported: new Date().toISOString(),
          },
        });
      } catch (statsError) {
        Logger.warn("Failed to send stats to conductor:", statsError);
      }
    }

    return c.json(statsResponse);
  } catch (error) {
    Logger.error("Failed to get stats:", error);
    return c.json(
      {
        success: false,
        error: error instanceof Error ? error.message : "Unknown error",
      },
      500,
    );
  }
});

export { backup };
