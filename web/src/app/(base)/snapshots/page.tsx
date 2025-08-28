"use client";

import * as React from "react";
import {
  getSnapshotsAction,
  getMachineAction,
  createBackupRunAction,
  updateBackupRunAction,
  saveBackupProgressAction,
  getBackupRunsAction,
} from "./action";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { formatBytes } from "bytes-formatter";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
  DropdownMenuItem,
} from "@/components/ui/dropdown-menu";
import {
  EllipsisVertical,
  CheckCircle,
  XCircle,
  Clock,
  History,
} from "lucide-react";
import { Progress } from "@/components/ui/progress";
import { cn } from "@/lib/utils";

type Snapshot = {
  machineId: string;
  id: string;
  short_id: string;
  hostname: string;
  summary: {
    total_bytes_processed: number;
  };
  time: string;
};

type BackupProgress =
  | {
      type: "progress";
      step?: string;
      message: string;
      timestamp: string;
      success?: boolean;
      error?: string;
      durationSec?: number;
      backup?: any;
      retention?: any;
      host?: string;
      tags?: string[];
    }
  | {
      type: "complete";
      message: string;
      timestamp: string;
      success: true;
      durationSec?: number;
      backup?: any;
      retention?: any;
    }
  | {
      type: "error";
      message: string;
      timestamp: string;
      success?: false;
      error?: string;
    };

export default function SnapshotsPage() {
  const [snapshots, setSnapshots] = React.useState<Snapshot[]>([]);
  const [loading, setLoading] = React.useState(true);
  const [error, setError] = React.useState<string | null>(null);

  const loadSnapshots = React.useCallback(async () => {
    setLoading(true);
    setError(null);
    const result = await getSnapshotsAction();
    if (result.success) {
      setSnapshots(result.data as Snapshot[]);
    } else {
      setError(result.error);
    }
    setLoading(false);
  }, []);

  React.useEffect(() => {
    void loadSnapshots();
  }, [loadSnapshots]);

  if (loading) {
    return (
      <div className="mx-auto flex min-h-screen max-w-6xl min-w-6xl flex-col gap-6 p-6">
        <div className="flex items-center justify-center">
          <p>Loading snapshots...</p>
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="mx-auto flex min-h-screen max-w-6xl min-w-6xl flex-col gap-6 p-6">
        <div className="flex items-center justify-center">
          <p className="text-red-500">Error: {error}</p>
          <Button onClick={() => void loadSnapshots()} className="ml-4">
            Retry
          </Button>
        </div>
      </div>
    );
  }

  return (
    <div className="mx-auto flex min-h-screen min-w-6xl flex-col gap-6 p-6">
      <div className="flex items-center justify-between">
        <h1 className="text-xl font-semibold">Snapshots</h1>
        <div className="flex gap-2">
          <BackupHistoryDialog />
          <RunSnapshotDialog onSuccess={() => void loadSnapshots()} />
        </div>
      </div>

      <div className="overflow-hidden rounded-md border">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>ID</TableHead>
              <TableHead>Hostname</TableHead>
              <TableHead>Size</TableHead>
              <TableHead>Created at</TableHead>
              <TableHead></TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {snapshots && snapshots.length > 0 ? (
              snapshots.map((snapshot) => (
                <TableRow key={`${snapshot.machineId}-${snapshot.id}`}>
                  <TableCell>{snapshot.short_id}</TableCell>
                  <TableCell>{snapshot.hostname}</TableCell>
                  <TableCell>
                    {formatBytes(snapshot.summary.total_bytes_processed)}
                  </TableCell>
                  <TableCell>
                    {new Date(snapshot.time).toLocaleString("en-US", {
                      year: "numeric",
                      month: "2-digit",
                      day: "2-digit",
                      hour: "2-digit",
                      minute: "2-digit",
                    })}
                  </TableCell>
                  <TableCell>
                    <DropdownMenu>
                      <DropdownMenuTrigger asChild>
                        <Button
                          variant="ghost"
                          size="icon"
                          className="h-8 w-8 p-0"
                        >
                          <EllipsisVertical className="h-4 w-4" />
                          <span className="sr-only">Open menu</span>
                        </Button>
                      </DropdownMenuTrigger>
                      <DropdownMenuContent align="end">
                        <DropdownMenuLabel>Actions</DropdownMenuLabel>
                        <DropdownMenuSeparator />
                        <DropdownMenuItem
                          onClick={() => console.log("View clicked")}
                        >
                          View
                        </DropdownMenuItem>
                        <DropdownMenuItem
                          className="text-red-600 focus:text-red-600"
                          onClick={() => console.log("Delete clicked")}
                        >
                          Delete
                        </DropdownMenuItem>
                      </DropdownMenuContent>
                    </DropdownMenu>
                  </TableCell>
                </TableRow>
              ))
            ) : (
              <TableRow>
                <TableCell colSpan={5} className="text-center">
                  No snapshots found
                </TableCell>
              </TableRow>
            )}
          </TableBody>
        </Table>
      </div>
    </div>
  );
}

interface RunSnapshotDialogProps {
  onSuccess: () => void;
}

function RunSnapshotDialog({ onSuccess }: RunSnapshotDialogProps) {
  const [open, setOpen] = React.useState(false);
  const [running, setRunning] = React.useState(false);
  const [progress, setProgress] = React.useState<BackupProgress[]>([]);
  const [currentStep, setCurrentStep] = React.useState<string>("");
  const [progressValue, setProgressValue] = React.useState(0);
  const [currentRunId, setCurrentRunId] = React.useState<string>(""); // never undefined

  const stepOrder = [
    "starting",
    "init",
    "init_complete",
    "preparing",
    "backup_running",
    "backup_complete",
    "retention_running",
    "retention_complete",
  ];

  const getStepName = (step: string) => {
    const names: Record<string, string> = {
      starting: "Starting",
      init: "Initializing Repository",
      init_complete: "Repository Ready",
      preparing: "Preparing Backup",
      backup_running: "Creating Backup",
      backup_complete: "Backup Created",
      retention_running: "Applying Retention",
      retention_complete: "Retention Applied",
    };
    return names[step] || step;
  };

  const runBackup = async (machineIdInput: string) => {
    const machineId = (machineIdInput ?? "").trim();
    if (!machineId) return;

    setRunning(true);
    setProgress([]);
    setCurrentStep("");
    setProgressValue(0);
    setCurrentRunId("");

    try {
      // 1) Create run
      const runResult = await createBackupRunAction(machineId);
      if (!runResult.success) throw new Error(runResult.error);
      const runId = runResult.data.id;
      setCurrentRunId(runId);

      // 2) Get machine
      const machineResult = await getMachineAction(machineId);
      if (!machineResult.success) throw new Error(machineResult.error);
      const machine = machineResult.data;

      // 3) Build headers without undefined
      const headers = new Headers({
        Authorization: `Bearer ${machine.token}`,
        Accept: "text/event-stream",
        "X-Machine-Id": machineId,
      });
      if (runId) headers.set("X-Backup-Run-Id", runId);

      // 4) Fetch SSE
      const response = await fetch(`${machine.url}/api/v1/backup`, {
        method: "POST",
        headers,
      });

      if (!response.ok) {
        throw new Error(`Backup API error: ${response.status}`);
      }
      if (!response.body) throw new Error("No response body");

      const reader = response.body.getReader();
      const decoder = new TextDecoder();

      try {
        let snapshotId: string | null = null;

        while (true) {
          const { done, value } = await reader.read();
          if (done) break;

          const chunk = decoder.decode(value);
          const lines = chunk.split("\n");

          for (const line of lines) {
            if (!line.startsWith("data: ")) continue;

            try {
              const data: BackupProgress = JSON.parse(line.slice(6));
              setProgress((prev) => [...prev, data]);

              // Save progress
              const saveRes = await saveBackupProgressAction(runId, data);
              // could handle saveRes.error, but non-blocking

              // Extract snapshotId if emitted by server
              const maybeId =
                (data as any)?.backup?.snapshotId ??
                (data as any)?.backup?.snapshot_id ??
                null;
              if (maybeId) snapshotId = String(maybeId);

              if ((data as any).step) {
                const step = String((data as any).step);
                setCurrentStep(step);
                const idx = stepOrder.indexOf(step);
                if (idx >= 0) {
                  setProgressValue(((idx + 1) / stepOrder.length) * 100);
                }
              }

              if (data.type === "complete") {
                setProgressValue(100);
                await updateBackupRunAction(runId, {
                  status: "completed",
                  finishedAt: new Date(),
                  snapshotId: snapshotId ?? undefined,
                });
                setTimeout(() => {
                  setOpen(false);
                  onSuccess();
                }, 1500);
              } else if (data.type === "error") {
                setProgressValue(100);
                await updateBackupRunAction(runId, {
                  status: "failed",
                  finishedAt: new Date(),
                  error:
                    (data as any).error ||
                    (data as any).message ||
                    "Unknown error",
                });
              }
            } catch (e) {
              console.error("Failed to parse SSE data:", e);
            }
          }
        }
      } finally {
        reader.releaseLock();
      }
    } catch (error: any) {
      console.error("Backup stream error:", error);
      const errorData: BackupProgress = {
        type: "error",
        message: error?.message ?? "Failed to run backup",
        timestamp: new Date().toISOString(),
        error: error?.message ?? "Unknown error",
      };
      setProgress((prev) => [...prev, errorData]);

      if (currentRunId) {
        await saveBackupProgressAction(currentRunId, errorData);
        await updateBackupRunAction(currentRunId, {
          status: "failed",
          finishedAt: new Date(),
          error: error?.message ?? "Unknown error",
        });
      }

      setProgressValue(100);
    } finally {
      setRunning(false);
    }
  };

  const onSubmit = (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    const fd = new FormData(e.currentTarget);
    const machineId = String(fd.get("machineId") ?? "");
    void runBackup(machineId);
  };

  const lastProgress = progress[progress.length - 1];
  const isComplete = lastProgress?.type === "complete";
  const hasError = lastProgress?.type === "error";

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button disabled={running}>Run snapshot</Button>
      </DialogTrigger>
      <DialogContent className="max-w-lg">
        <DialogHeader>
          <DialogTitle>Run snapshot</DialogTitle>
        </DialogHeader>

        {!running ? (
          <form onSubmit={onSubmit} className="space-y-3">
            <div className="space-y-2">
              <Label htmlFor="machineId">Machine ID (required)</Label>
              <Input
                id="machineId"
                name="machineId"
                placeholder="Enter machine ID"
                required
              />
            </div>

            <div className="flex gap-2">
              <Button type="submit">Run</Button>
              <Button
                type="button"
                variant="outline"
                onClick={() => setOpen(false)}
              >
                Cancel
              </Button>
            </div>
          </form>
        ) : (
          <div className="space-y-4">
            <div className="space-y-2">
              <div className="flex items-center justify-between">
                <span className="text-sm font-medium">
                  {currentStep ? getStepName(currentStep) : "Starting..."}
                </span>
                <span className="text-sm text-muted-foreground">
                  {Math.round(progressValue)}%
                </span>
              </div>
              <Progress value={progressValue} />
            </div>

            <div className="max-h-60 overflow-y-auto space-y-2 border rounded p-3">
              {progress.map((item, index) => (
                <div
                  key={index}
                  className={cn(
                    "flex items-start gap-2 text-sm p-2 rounded",
                    item.type === "error" && "bg-red-50 text-red-700",
                    item.type === "complete" && "bg-green-50 text-green-700",
                  )}
                >
                  {item.type === "error" ? (
                    <XCircle className="h-4 w-4 mt-0.5 flex-shrink-0" />
                  ) : item.type === "complete" ? (
                    <CheckCircle className="h-4 w-4 mt-0.5 flex-shrink-0" />
                  ) : (
                    <Clock className="h-4 w-4 mt-0.5 flex-shrink-0" />
                  )}
                  <div className="flex-1">
                    <div>{item.message}</div>
                    {"durationSec" in item && item.durationSec ? (
                      <div className="text-xs opacity-70">
                        Duration: {item.durationSec.toFixed(1)}s
                      </div>
                    ) : null}
                  </div>
                </div>
              ))}
            </div>

            {(isComplete || hasError) && (
              <div className="flex gap-2">
                {isComplete && (
                  <Button onClick={() => setOpen(false)}>Close</Button>
                )}
                {hasError && (
                  <Button
                    variant="outline"
                    onClick={() => {
                      setRunning(false);
                      setProgress([]);
                      setProgressValue(0);
                    }}
                  >
                    Try Again
                  </Button>
                )}
              </div>
            )}
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
}

function BackupHistoryDialog() {
  const [open, setOpen] = React.useState(false);
  const [machineId, setMachineId] = React.useState<string>(""); // never undefined
  const [history, setHistory] = React.useState<
    Array<{
      snapshotId: string | null | undefined;
      history: Array<{ timestamp: string; data: any }>;
      finishedAt: string | null;
      startedAt: string;
      status: string;
      error: string | null;
    }>
  >([]);
  const [loading, setLoading] = React.useState(false);

  const loadHistory = async () => {
    const id = machineId.trim();
    if (!id) return;

    setLoading(true);
    try {
      const result = await getBackupRunsAction(id);
      if (result.success) {
        setHistory(result.data);
      } else {
        // optionally show result.error
      }
    } finally {
      setLoading(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button variant="outline">
          <History className="h-4 w-4 mr-2" />
          Backup History
        </Button>
      </DialogTrigger>
      <DialogContent className="">
        <DialogHeader>
          <DialogTitle>Backup History</DialogTitle>
        </DialogHeader>

        <div className="space-y-4">
          <div className="flex gap-2">
            <Input
              placeholder="Enter machine ID"
              value={machineId}
              onChange={(e) => setMachineId(e.target.value)} // always string
            />
            <Button
              onClick={() => void loadHistory()}
              disabled={!machineId || loading}
            >
              {loading ? "Loading..." : "Load History"}
            </Button>
          </div>

          <div className="overflow-y-auto max-h-96">
            {history.map((run, index) => (
              <div key={index} className="border rounded p-4 mb-4">
                <div className="flex justify-between items-center mb-2">
                  <div className="font-medium">
                    Snapshot: {run.snapshotId?.substring(0, 8) || "N/A"}
                  </div>
                  <div className="text-sm text-muted-foreground">
                    {new Date(run.startedAt).toLocaleTimeString()}
                  </div>
                </div>

                <div className="space-y-1 max-h-32 overflow-y-auto">
                  {run.history.map((item, i) => (
                    <div
                      key={i}
                      className="text-sm p-1 border-l-2 border-gray-200 pl-2"
                    >
                      <div className="font-mono text-xs text-muted-foreground">
                        {new Date(item.timestamp).toLocaleTimeString()}
                      </div>
                      <div>
                        {typeof item.data?.message === "string"
                          ? item.data.message
                          : JSON.stringify(item.data)}
                      </div>
                    </div>
                  ))}
                </div>

                <div className="text-xs text-muted-foreground mt-2">
                  Status: {run.status}
                  {run.finishedAt
                    ? ` • Finished: ${new Date(run.finishedAt).toLocaleString()}`
                    : ""}
                  {run.error ? ` • Error: ${run.error}` : ""}
                </div>
              </div>
            ))}
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}
