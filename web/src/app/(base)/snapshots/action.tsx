"use server";

import prisma from "@/lib/prisma";
import { getSnapshots } from "@/lib/api";

export type ActionResult<T> =
  | { success: true; data: T }
  | { success: false; error: string };

function ok<T>(data: T): ActionResult<T> {
  return { success: true, data };
}
function fail<T = never>(error: string): ActionResult<T> {
  return { success: false, error };
}

export async function getSnapshotsAction(): Promise<ActionResult<any[]>> {
  try {
    const snapshots = await getSnapshots();
    return ok(snapshots);
  } catch (error: any) {
    return fail(error?.message ?? "Failed to get snapshots");
  }
}

export async function getMachineAction(
  machineId: string,
): Promise<ActionResult<{ url: string; token: string }>> {
  try {
    if (!machineId) return fail("Machine ID is required");
    const m = await prisma.machines.findUnique({
      where: { id: machineId },
      select: { url: true, token: true },
    });
    if (!m?.url || !m?.token) return fail("Machine not found");
    return ok({ url: m.url, token: m.token });
  } catch (e: any) {
    return fail(e?.message ?? "Failed to get machine");
  }
}

export async function createBackupRunAction(
  machineId: string,
): Promise<ActionResult<{ id: string }>> {
  try {
    if (!machineId) return fail("Machine ID is required");
    const run = await prisma.backupRuns.create({
      data: { machineId, status: "running" },
      select: { id: true },
    });
    return ok(run);
  } catch (e: any) {
    return fail(e?.message ?? "Failed to create backup run");
  }
}

export async function updateBackupRunAction(
  runId: string,
  updates: {
    snapshotId?: string;
    finishedAt?: Date;
    status?: string;
    error?: string;
  },
): Promise<ActionResult<{ id: string }>> {
  try {
    if (!runId) return fail("Run ID required");
    const updated = await prisma.backupRuns.update({
      where: { id: runId },
      data: updates,
      select: { id: true },
    });
    return ok(updated);
  } catch (e: any) {
    return fail(e?.message ?? "Failed to update backup run");
  }
}

export async function saveBackupProgressAction(
  runId: string,
  data: any,
): Promise<ActionResult<{ id: string }>> {
  try {
    if (!runId) return fail("Run ID required");
    const created = await prisma.backupProgress.create({
      data: {
        backupRunId: runId,
        data,
        step: typeof data?.step === "string" ? data.step : null,
      },
      select: { id: true },
    });
    return ok(created);
  } catch (e: any) {
    return fail(e?.message ?? "Failed to save progress");
  }
}

export async function getBackupRunsAction(
  machineId: string,
  limit: number = 10,
): Promise<
  ActionResult<
    Array<{
      snapshotId: string | null | undefined;
      history: Array<{ timestamp: string; data: any }>;
      finishedAt: string | null;
      startedAt: string;
      status: string;
      error: string | null;
    }>
  >
> {
  try {
    if (!machineId) return fail("Machine ID is required");

    const backupRuns = await prisma.backupRuns.findMany({
      where: { machineId },
      include: {
        progress: {
          orderBy: { timestamp: "asc" },
        },
      },
      orderBy: { startedAt: "desc" },
      take: limit,
    });

    const formatted = backupRuns.map((run) => ({
      snapshotId: run.snapshotId,
      history: run.progress.map((p) => ({
        timestamp: p.timestamp.toISOString(),
        data: p.data,
      })),
      finishedAt: run.finishedAt ? run.finishedAt.toISOString() : null,
      startedAt: run.startedAt.toISOString(),
      status: run.status,
      error: run.error ?? null,
    }));

    return ok(formatted);
  } catch (e: any) {
    return fail(e?.message ?? "Failed to get backup runs");
  }
}
