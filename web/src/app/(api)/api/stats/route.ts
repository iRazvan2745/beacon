// /app/api/stats/route.ts
import { NextResponse } from "next/server";
import prisma from "@/lib/prisma";
import { z } from "zod";
import { getSnapshots } from "@/lib/api";

const statsSchema = z.object({
  type: z
    .enum(["overview", "storage", "activity", "machines"])
    .default("overview"),
});

const MachineStatsSchema = z.object({
  totalSize: z.number().optional(),
  totalFileCount: z.number().optional(),
  snapshotCount: z.number().optional(),
  lastReported: z.string().datetime().optional().nullable(),
});

export async function GET(req: Request) {
  const { searchParams } = new URL(req.url);
  let type: z.infer<typeof statsSchema>["type"];

  try {
    const parsed = statsSchema.parse({ type: searchParams.get("type") });
    type = parsed.type;
  } catch (error) {
    console.error("Zod parsing error:", error);
    return NextResponse.json(
      {
        success: false,
        error: "Invalid type parameter",
      },
      { status: 400 },
    );
  }

  switch (type) {
    case "overview": {
      const [totalMachines, totalSnapshots, totalBackupRuns] =
        await Promise.all([
          prisma.machines.count(),
          prisma.snapshots.count(),
          prisma.backupRuns.count(),
        ]);

      return NextResponse.json({
        success: true,
        stats: {
          machines: totalMachines,
          snapshots: totalSnapshots,
          backupRuns: totalBackupRuns,
        },
      });
    }
    case "storage": {
      const machines = await prisma.machines.findMany({
        select: {
          id: true,
          name: true,
          stats: true,
        },
      });

      const totalSize = machines.reduce((acc, machine) => {
        const parsedStats = machine.stats
          ? MachineStatsSchema.safeParse(machine.stats)
          : null;
        const machineStats = parsedStats?.success ? parsedStats.data : null;
        return acc + (machineStats?.totalSize || 0);
      }, 0);

      return NextResponse.json({
        success: true,
        stats: {
          total: {
            size: totalSize,
          },
          machines: machines.map((machine) => {
            const parsedStats = machine.stats
              ? MachineStatsSchema.safeParse(machine.stats)
              : null;
            const machineStats = parsedStats?.success ? parsedStats.data : null;
            return {
              machineId: machine.id,
              machineName: machine.name,
              size: machineStats?.totalSize || 0,
              fileCount: machineStats?.totalFileCount || 0,
              snapshotCount: machineStats?.snapshotCount || 0,
              lastUpdated: machineStats?.lastReported
                ? new Date(machineStats.lastReported).toISOString()
                : null,
            };
          }),
        },
      });
    }
    case "activity": {
      const [recentBackups, recentSnapshots] = await Promise.all([
        prisma.backupRuns.findMany({
          where: {
            startedAt: { gte: new Date(Date.now() - 7 * 24 * 60 * 60 * 1000) },
          },
          orderBy: { startedAt: "desc" },
          take: 50,
        }),
        getSnapshots(), // Use getSnapshots from @/lib/api
      ]);

      // Log errors from getSnapshots
      const errors = recentSnapshots
        .filter((s: any) => s.error)
        .map((s: any) => s.error);
      if (errors.length > 0) {
        console.error("Errors from getSnapshots:", errors);
      }

      return NextResponse.json({
        success: true,
        stats: {
          recentBackups,
          recentSnapshots: recentSnapshots.map((snapshot) => ({
            id: snapshot.id,
            name: snapshot.short_id, // Map short_id to name
            machineId: snapshot.machineId,
            machineName: snapshot.machineName, // Use machineName from SnapshotWithMachine
            size: String(
              typeof snapshot.summary === "object" &&
                snapshot.summary !== null &&
                "total_bytes_processed" in snapshot.summary
                ? (snapshot.summary as any).total_bytes_processed
                : 0,
            ), // Convert size to string
            createdAt: snapshot.time, // Map time to createdAt
          })),
        },
      });
    }
    case "machines": {
      const machines = await prisma.machines.findMany({
        select: {
          id: true,
          name: true,
          region: true,
          url: true,
          stats: true,
        },
      });

      return NextResponse.json({
        success: true,
        stats: {
          machines: machines.map((machine) => {
            const parsedStats = machine.stats
              ? MachineStatsSchema.safeParse(machine.stats)
              : null;
            const machineStats = parsedStats?.success ? parsedStats.data : null;

            return {
              id: machine.id,
              name: machine.name,
              region: machine.region,
              url: machine.url,
              stats: machineStats
                ? {
                    repository: {
                      totalSize: machineStats.totalSize || 0,
                      totalSizeHuman: `${machineStats.totalSize || 0} B`,
                      totalFileCount: machineStats.totalFileCount || 0,
                      snapshotCount: machineStats.snapshotCount || 0,
                      lastReported: machineStats.lastReported
                        ? new Date(machineStats.lastReported).toISOString()
                        : null,
                    },
                    activity: {
                      totalSnapshots: 0, // Placeholder
                      totalBackupRuns: 0, // Placeholder
                      recentBackups: {
                        completed: 0, // Placeholder
                        failed: 0, // Placeholder
                        running: 0, // Placeholder
                        successRate: 0, // Plsaceholder
                      },
                    },
                  }
                : null,
            };
          }),
          count: machines.length,
        },
      });
    }
    default: {
      return NextResponse.json(
        { message: "Invalid stats type" },
        { status: 400 },
      );
    }
  }
}
