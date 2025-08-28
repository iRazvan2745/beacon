import prisma from "./prisma";

type Machine = {
  id: string;
  url: string | null;
  token: string | null;
  name?: string | null;
};

type ResticSnapshot = {
  time: string;
  tree: string;
  paths: string[];
  hostname: string;
  username: string;
  uid: number;
  gid: number;
  excludes: string[];
  tags: string[];
  program_version: string;
  summary: {
    backup_start: string;
    backup_end: string;
    files_new: number;
    files_changed: number;
    files_unmodified: number;
    dirs_new: number;
    dirs_changed: number;
    dirs_unmodified: number;
    data_blobs: number;
    tree_blobs: number;
    data_added: number;
    data_added_packed: number;
    total_files_processed: number;
    total_bytes_processed: number;
  };
  id: string;
  short_id: string;
  parent?: string;
};

type SnapshotsResponse = {
  success: boolean;
  snapshots: ResticSnapshot[];
  count: number;
  timestamp: string;
};

type SnapshotWithMachine = ResticSnapshot & {
  machineId: string;
  machineName?: string | null;
  machineUrl?: string | null;
  fetchedAt: string;
};

function normalizeBaseUrl(url: string) {
  return url.replace(/\/+$/, "");
}


export async function getMachines() {
  return prisma.machines.findMany();
}

async function fetchMachineSnapshots(
  machine: Machine
): Promise<{ snapshots: SnapshotWithMachine[]; error?: string }> {
  if (!machine.url) {
    return { snapshots: [], error: `Machine ${machine.id} missing url` };
  }

  const base = normalizeBaseUrl(machine.url);
  let res: Response;
  try {
    res = await fetch(`${base}/api/v1/backup/snapshots`, {
      headers: {
        Accept: "application/json",
        ...(machine.token ? { Authorization: `Bearer ${machine.token}` } : {}),
      },
    });
  } catch (e: any) {
    return {
      snapshots: [],
      error: `Fetch ${machine.id} failed: ${e.message}`,
    };
  }

  if (!res.ok) {
    let body = "";
    try {
      body = await res.text();
    } catch {}
    return {
      snapshots: [],
      error: `Fetch ${machine.id} failed (${
        res?.status ?? "?"
      } ${res?.statusText ?? "?"}): ${body}`,
    };
  }

  let json: SnapshotsResponse;
  try {
    json = (await res.json()) as SnapshotsResponse;
  } catch (e: any) {
    return {
      snapshots: [],
      error: `Invalid JSON from ${machine.id}: ${e.message}`,
    };
  }

  if (!json.success || !Array.isArray(json.snapshots)) {
    return {
      snapshots: [],
      error: `Unexpected payload from ${machine.id}`,
    };
  }

  const fetchedAt = new Date().toISOString();
  const withMachine: SnapshotWithMachine[] = json.snapshots.map((s) => ({
    ...s,
    machineId: machine.id,
    machineName: (machine as any).name ?? null,
    machineUrl: machine.url,
    fetchedAt,
  }));

  return { snapshots: withMachine };
}

const snapshotCache = new Map<
  string, // "all" or machineId
  { data: SnapshotWithMachine[]; expires: number }
>();

const CACHE_TTL_MS = 30_000;

export async function getSnapshots(
  machineId?: string
): Promise<SnapshotWithMachine[]> {
  const cacheKey = machineId ?? "all";
  const now = Date.now();

  const cached = snapshotCache.get(cacheKey);
  if (cached && cached.expires > now) {
    return cached.data;
  }

  const machines = await prisma.machines.findMany({
    where: machineId ? { id: machineId } : undefined,
    select: { id: true, url: true, token: true, name: true },
  });

  if (!machines.length) return [];

  const results = await Promise.all(
    machines.map((m) => fetchMachineSnapshots(m))
  );

  const snapshots = results.flatMap((r) => r.snapshots);
  const errors = results.filter((r) => r.error).map((r) => r.error!);

  if (errors.length) {
    console.warn(
      `Snapshot fetch errors (${errors.length}):\n- ${errors.join("\n- ")}`
    );
  }

  snapshots.sort(
    (a, b) => new Date(b.time).getTime() - new Date(a.time).getTime()
  );

  snapshotCache.set(cacheKey, {
    data: snapshots,
    expires: now + CACHE_TTL_MS,
  });

  return snapshots;
}

export async function runSnapshot(machineId?: string) {
  async function triggerFor(machine: {
    id: string;
    url: string | null;
    token: string | null;
  }) {
    if (!machine.url) {
      throw new Error(`Machine ${machine.id} missing url`);
    }
    const base = normalizeBaseUrl(machine.url);
    const res = await fetch(`${base}/api/v1/backup`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Accept: "application/json",
        ...(machine.token ? { Authorization: `Bearer ${machine.token}` } : {}),
      },
      // adjust payload if your API expects something else
      body: JSON.stringify({ source: "dashboard" }),
    });

    if (!res.ok) {
      const body = await res.text().catch(() => "");
      throw new Error(
        `Trigger failed for ${machine.id} (${res.status} ${res.statusText}): ${body}`
      );
    }

    try {
      return await res.json();
    } catch {
      return { success: true };
    }
  }

  if (machineId) {
    const machine = await prisma.machines.findUnique({
      where: { id: machineId },
      select: { id: true, url: true, token: true },
    });
    if (!machine) throw new Error("Machine not found");

    const result = await triggerFor(machine);
    return { success: true, triggered: 1, total: 1, results: [{ machineId, ok: true, result }] };
  }

  const machines = await prisma.machines.findMany({
    select: { id: true, url: true, token: true },
  });

  if (machines.length === 0) {
    return { success: true, triggered: 0, total: 0, results: [] };
  }

  const settled = await Promise.allSettled(
    machines.map((m) =>
      triggerFor(m).then(
        (result) => ({ machineId: m.id, ok: true as const, result }),
        (err) => ({
          machineId: m.id,
          ok: false as const,
          error: String(err?.message ?? err),
        })
      )
    )
  );

  const results = settled.map((r) =>
    r.status === "fulfilled" ? r.value : { ok: false, error: "Unknown" }
  ) as Array<
    | { machineId?: string; ok: true; result: any }
    | { machineId?: string; ok: false; error: string }
  >;

  const triggered = results.filter((r) => (r as any).ok).length;
  const failures = results.filter((r) => !(r as any).ok);

  if (failures.length) {
    console.warn(
      "Snapshot trigger failures:",
      failures
        .map((f: any) => `${f.machineId ?? "?"}: ${f.error}`)
        .join("; ")
    );
  }

  return {
    success: failures.length === 0,
    triggered,
    total: machines.length,
    results,
  };
}