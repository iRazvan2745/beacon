import { useState, useEffect, useCallback } from "react";

type StatsType = "overview" | "storage" | "activity" | "machines";

interface OverviewStats {
  machines: {
    total: number;
    active: number;
  };
  snapshots: {
    total: number;
  };
  backups: {
    running: number;
    completedToday: number;
    failedToday: number;
    successRate: number;
  };
}

interface StorageStats {
  total: {
    size: number;
    sizeHuman: string;
    fileCount: number;
    snapshotCount: number;
  };
  machines: Array<{
    machineId: string;
    machineName: string;
    size: number;
    sizeHuman: string;
    fileCount: number;
    snapshotCount: number;
    lastUpdated: string | null;
  }>;
}

interface ActivityStats {
  recentBackups: Array<{
    id: string;
    machineId: string;
    machineName: string;
    status: string;
    startedAt: string;
    finishedAt: string | null;
    duration: number | null;
    error: string | null;
  }>;
  recentSnapshots: Array<{
    id: string;
    name: string;
    machineId: string;
    machineName: string;
    size: string;
    createdAt: string;
  }>;
  trends: Array<{
    date: string;
    status: string;
    count: number;
  }>;
}

interface MachineStats {
  machines: Array<{
    id: string;
    name: string;
    region: string;
    url: string;
    lastUpdated: string;
    stats: {
      repository: {
        totalSize: number;
        totalSizeHuman: string;
        totalFileCount: number;
        snapshotCount: number;
        lastReported: string | null;
      } | null;
      activity: {
        totalSnapshots: number;
        totalBackupRuns: number;
        recentBackups: {
          completed: number;
          failed: number;
          running: number;
          successRate: number;
        };
      };
    };
    recentSnapshots: Array<any>;
    recentBackupRuns: Array<any>;
  }>;
  count: number;
}

type StatsData = OverviewStats | StorageStats | ActivityStats | MachineStats;

interface UseStatsReturn<T extends StatsData> {
  data: T | null;
  loading: boolean;
  error: string | null;
  refetch: () => Promise<void>;
}

export function useStats<T extends StatsData = OverviewStats>(
  type: StatsType = "overview",
  options: {
    autoRefresh?: boolean;
    refreshInterval?: number;
  } = {}
): UseStatsReturn<T> {
  const [data, setData] = useState<T | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const { autoRefresh = false, refreshInterval = 30000 } = options;

  const fetchStats = useCallback(async () => {
    try {
      setLoading(true);
      setError(null);

      const response = await fetch(`/api/stats?type=${type}`);

      if (!response.ok) {
        throw new Error(`Failed to fetch stats: ${response.status} ${response.statusText}`);
      }

      const result = await response.json();

      if (!result.success) {
        throw new Error(result.error || "Unknown error occurred");
      }

      setData(result.stats || result);
    } catch (err) {
      console.error("Error fetching stats:", err);
      setError(err instanceof Error ? err.message : "Unknown error occurred");
    } finally {
      setLoading(false);
    }
  }, [type]);

  const refetch = useCallback(async () => {
    await fetchStats();
  }, [fetchStats]);

  useEffect(() => {
    fetchStats();
  }, [fetchStats]);

  useEffect(() => {
    if (autoRefresh && refreshInterval > 0) {
      const interval = setInterval(fetchStats, refreshInterval);
      return () => clearInterval(interval);
    }
  }, [autoRefresh, refreshInterval, fetchStats]);

  return {
    data: data as T | null,
    loading,
    error,
    refetch,
  };
}

// Specialized hooks for each stats type
export function useOverviewStats(options?: { autoRefresh?: boolean; refreshInterval?: number }) {
  return useStats<OverviewStats>("overview", options);
}

export function useStorageStats(options?: { autoRefresh?: boolean; refreshInterval?: number }) {
  return useStats<StorageStats>("storage", options);
}

export function useActivityStats(options?: { autoRefresh?: boolean; refreshInterval?: number }) {
  return useStats<ActivityStats>("activity", options);
}

export function useMachineStats(options?: { autoRefresh?: boolean; refreshInterval?: number }) {
  return useStats<MachineStats>("machines", options);
}

// Hook for remote machine stats
export function useRemoteStats(machineId?: string) {
  const [data, setData] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const fetchRemoteStats = useCallback(async () => {
    if (!machineId) {
      setData(null);
      setLoading(false);
      return;
    }

    try {
      setLoading(true);
      setError(null);

      const response = await fetch(`/api/remote?machineId=${machineId}`);

      if (!response.ok) {
        throw new Error(`Failed to fetch remote stats: ${response.status} ${response.statusText}`);
      }

      const result = await response.json();

      if (!result.success) {
        throw new Error(result.error || "Unknown error occurred");
      }

      setData(result.machine);
    } catch (err) {
      console.error("Error fetching remote stats:", err);
      setError(err instanceof Error ? err.message : "Unknown error occurred");
    } finally {
      setLoading(false);
    }
  }, [machineId]);

  const refetch = useCallback(async () => {
    await fetchRemoteStats();
  }, [fetchRemoteStats]);

  useEffect(() => {
    fetchRemoteStats();
  }, [fetchRemoteStats]);

  return {
    data,
    loading,
    error,
    refetch,
  };
}
