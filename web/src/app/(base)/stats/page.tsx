"use client";

import { useActivityStats, useMachineStats } from "@/hooks/use-stats";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import {
  RefreshCw,
  AlertCircle,
  Server,
  HardDrive,
  Activity,
  Calendar,
  TrendingUp,
} from "lucide-react";
import { formatBytes } from "bytes-formatter";

export default function StatsPage() {
  const {
    data: machineData,
    loading: machineLoading,
    error: machineError,
    refetch: refetchMachines,
  } = useMachineStats({ autoRefresh: true, refreshInterval: 30000 });

  const {
    data: activityData,
    loading: activityLoading,
    error: activityError,
    refetch: refetchActivity,
  } = useActivityStats({ autoRefresh: true, refreshInterval: 30000 });

  const handleRefresh = () => {
    refetchMachines();
    refetchActivity();
  };

  if (machineError || activityError) {
    return (
      <div>
        <div className="flex items-center justify-between">
          <h1 className="text-2xl font-semibold">Statistics</h1>
          <button
            onClick={handleRefresh}
            className="flex items-center gap-2 px-4 py-2 text-sm bg-primary text-primary-foreground rounded-md hover:bg-primary/90"
          >
            <RefreshCw className="h-4 w-4" />
            Refresh
          </button>
        </div>

        <Card className="border-red-200 bg-red-50">
          <CardContent className="flex items-center gap-3 p-4">
            <AlertCircle className="h-5 w-5 text-red-600" />
            <div>
              <p className="font-medium text-red-800">
                Failed to load statistics
              </p>
              <p className="text-sm text-red-600">
                {machineError || activityError}
              </p>
            </div>
          </CardContent>
        </Card>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-semibold">Statistics</h1>
        <button
          onClick={handleRefresh}
          disabled={machineLoading || activityLoading}
          className="flex items-center gap-2 px-4 py-2 text-sm bg-primary text-primary-foreground rounded-md hover:bg-primary/90 disabled:opacity-50 disabled:cursor-not-allowed"
        >
          <RefreshCw
            className={`h-4 w-4 ${machineLoading || activityLoading ? "animate-spin" : ""}`}
          />
          Refresh
        </button>
      </div>

      {/* Machine Statistics */}
      <div>
        <h2 className="text-lg font-medium mb-4 flex items-center gap-2">
          <Server className="h-5 w-5" />
          Machine Statistics
        </h2>

        {machineLoading && !machineData ? (
          <Card>
            <CardContent className="flex items-center justify-center p-8">
              <RefreshCw className="h-6 w-6 animate-spin mr-2" />
              <span>Loading machine statistics...</span>
            </CardContent>
          </Card>
        ) : machineData && machineData.machines.length > 0 ? (
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            {machineData.machines.map((machine) => (
              <Card key={machine.id} className="shadow-sm">
                <CardHeader>
                  <CardTitle className="flex items-center justify-between">
                    <span className="text-lg">{machine.name}</span>
                    <span className="text-sm text-muted-foreground">
                      {machine.region}
                    </span>
                  </CardTitle>
                </CardHeader>
                <CardContent className="space-y-4">
                  {/* Repository Stats */}
                  {machine.stats?.repository ? (
                    <div className="grid grid-cols-2 gap-4">
                      <div>
                        <div className="text-sm text-muted-foreground">
                          Storage Used
                        </div>
                        <div className="text-xl font-semibold">
                          {formatBytes(machine.stats?.repository?.totalSize)}
                        </div>
                        <div className="text-xs text-muted-foreground">
                          {machine.stats?.repository?.totalFileCount.toLocaleString()}{" "}
                          files
                        </div>
                      </div>
                      <div>
                        <div className="text-sm text-muted-foreground">
                          Snapshots
                        </div>
                        <div className="text-xl font-semibold">
                          {machine.stats?.repository?.snapshotCount}
                        </div>
                        <div className="text-xs text-muted-foreground">
                          Total snapshots
                        </div>
                      </div>
                    </div>
                  ) : (
                    <div className="text-sm text-muted-foreground bg-gray-50 p-3 rounded">
                      No repository statistics available
                    </div>
                  )}

                  {/* Activity Stats */}
                  <div className="pt-4 border-t">
                    <h4 className="text-sm font-medium mb-2 flex items-center gap-2">
                      <Activity className="h-4 w-4" />
                      Recent Activity
                    </h4>
                    <div className="grid grid-cols-3 gap-4 text-sm">
                      <div className="text-center">
                        <div className="text-lg font-semibold text-green-600">
                          {machine.stats?.activity?.recentBackups.completed}
                        </div>
                        <div className="text-muted-foreground">Completed</div>
                      </div>
                      <div className="text-center">
                        <div className="text-lg font-semibold text-red-600">
                          {machine.stats?.activity?.recentBackups.failed}
                        </div>
                        <div className="text-muted-foreground">Failed</div>
                      </div>
                      <div className="text-center">
                        <div className="text-lg font-semibold text-blue-600">
                          {machine.stats?.activity?.recentBackups.running}
                        </div>
                        <div className="text-muted-foreground">Running</div>
                      </div>
                    </div>
                    <div className="mt-2 text-center">
                      <div
                        className={`text-sm font-medium ${
                          machine.stats?.activity?.recentBackups.successRate >=
                          90
                            ? "text-green-600"
                            : machine.stats?.activity?.recentBackups
                                  .successRate >= 70
                              ? "text-yellow-600"
                              : "text-red-600"
                        }`}
                      >
                        {machine.stats?.activity?.recentBackups.successRate}%
                        success rate
                      </div>
                    </div>
                  </div>

                  {/* Recent Snapshots */}
                  {machine.recentSnapshots?.length > 0 && (
                    <div className="pt-4 border-t">
                      <h4 className="text-sm font-medium mb-2">
                        Recent Snapshots
                      </h4>
                      <div className="space-y-2 max-h-32 overflow-y-auto">
                        {machine.recentSnapshots.map((snapshot, index) => (
                          <div
                            key={index}
                            className="text-xs flex justify-between items-center p-2 bg-gray-50 rounded"
                          >
                            <div>
                              <div className="font-medium">
                                {snapshot.shortId}
                              </div>
                              <div className="text-muted-foreground">
                                {snapshot.size}
                              </div>
                            </div>
                            <div className="text-muted-foreground">
                              {new Date(
                                snapshot.createdAt,
                              ).toLocaleDateString()}
                            </div>
                          </div>
                        ))}
                      </div>
                    </div>
                  )}

                  {/* Last Updated */}
                  <div className="text-xs text-muted-foreground text-right">
                    {machine.stats?.repository?.lastReported ? (
                      <>
                        Stats updated:{" "}
                        {new Date(
                          machine.stats?.repository?.lastReported,
                        ).toLocaleString()}
                      </>
                    ) : (
                      "No recent stats"
                    )}
                  </div>
                </CardContent>
              </Card>
            ))}
          </div>
        ) : (
          <Card>
            <CardContent className="text-center p-8">
              <Server className="h-12 w-12 text-muted-foreground mx-auto mb-4" />
              <p className="text-muted-foreground">No machines found</p>
            </CardContent>
          </Card>
        )}
      </div>

      {/* Activity Overview */}
      <div>
        <h2 className="text-lg font-medium mb-4 flex items-center gap-2">
          <TrendingUp className="h-5 w-5" />
          Recent Activity
        </h2>

        {activityLoading && !activityData ? (
          <Card>
            <CardContent className="flex items-center justify-center p-8">
              <RefreshCw className="h-6 w-6 animate-spin mr-2" />
              <span>Loading activity data...</span>
            </CardContent>
          </Card>
        ) : activityData ? (
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            {/* Recent Backups */}
            <Card>
              <CardHeader>
                <CardTitle className="text-base flex items-center gap-2">
                  <Activity className="h-4 w-4" />
                  Recent Backup Runs
                </CardTitle>
              </CardHeader>
              <CardContent>
                {activityData.recentBackups.length > 0 ? (
                  <div className="space-y-3 max-h-80 overflow-y-auto">
                    {activityData.recentBackups.map((backup) => (
                      <div
                        key={backup.id}
                        className="flex items-center justify-between p-3 bg-gray-50 rounded"
                      >
                        <div className="flex-1">
                          <div className="font-medium text-sm">
                            {backup.machineName}
                          </div>
                          <div className="text-xs text-muted-foreground">
                            {new Date(backup.startedAt).toLocaleString()}
                            {backup.duration && (
                              <span className="ml-2">({backup.duration}s)</span>
                            )}
                          </div>
                          {backup.error && (
                            <div className="text-xs text-red-600 mt-1">
                              {backup.error}
                            </div>
                          )}
                        </div>
                        <div
                          className={`px-2 py-1 rounded text-xs font-medium ${
                            backup.status === "completed"
                              ? "bg-green-100 text-green-800"
                              : backup.status === "failed"
                                ? "bg-red-100 text-red-800"
                                : backup.status === "running"
                                  ? "bg-blue-100 text-blue-800"
                                  : "bg-gray-100 text-gray-800"
                          }`}
                        >
                          {backup.status}
                        </div>
                      </div>
                    ))}
                  </div>
                ) : (
                  <div className="text-center text-muted-foreground py-8">
                    No recent backup runs
                  </div>
                )}
              </CardContent>
            </Card>

            {/* Recent Snapshots */}
            <Card>
              <CardHeader>
                <CardTitle className="text-base flex items-center gap-2">
                  <HardDrive className="h-4 w-4" />
                  Recent Snapshots
                </CardTitle>
              </CardHeader>
              <CardContent>
                {activityData.recentSnapshots.length > 0 ? (
                  <div className="space-y-3 max-h-80 overflow-y-auto">
                    {activityData.recentSnapshots.map((snapshot) => (
                      <div
                        key={snapshot.id}
                        className="flex items-center justify-between p-3 bg-gray-50 rounded"
                      >
                        <div className="flex-1">
                          <div className="font-medium text-sm">
                            {snapshot.machineName}
                          </div>
                          <div className="text-xs text-muted-foreground">
                            {snapshot.id} • {formatBytes(Number(snapshot.size))}
                          </div>
                        </div>
                        <div className="text-xs text-muted-foreground">
                          {new Date(snapshot.createdAt).toLocaleDateString()}
                        </div>
                      </div>
                    ))}
                  </div>
                ) : (
                  <div className="text-center text-muted-foreground py-8">
                    No recent snapshots
                  </div>
                )}
              </CardContent>
            </Card>
          </div>
        ) : (
          <Card>
            <CardContent className="text-center p-8">
              <Activity className="h-12 w-12 text-muted-foreground mx-auto mb-4" />
              <p className="text-muted-foreground">
                No activity data available
              </p>
            </CardContent>
          </Card>
        )}
      </div>

      {/* Backup Trends */}
      {activityData?.trends && activityData.trends.length > 0 && (
        <div>
          <h2 className="text-lg font-medium mb-4 flex items-center gap-2">
            <Calendar className="h-5 w-5" />
            Backup Trends (Last 7 Days)
          </h2>
          <Card>
            <CardContent className="p-6">
              <div className="space-y-4">
                {Object.values(
                  activityData.trends.reduce(
                    (acc, trend) => {
                      const date = trend.date as string;
                      if (!acc[date]) {
                        acc[date] = {
                          date,
                          completed: 0,
                          failed: 0,
                          running: 0,
                        };
                      }
                      if (
                        trend.status === "completed" ||
                        trend.status === "failed" ||
                        trend.status === "running"
                      ) {
                        acc[date][trend.status] = trend.count as number;
                      }
                      return acc;
                    },
                    {} as Record<
                      string,
                      {
                        date: string;
                        completed: number;
                        failed: number;
                        running: number;
                      }
                    >,
                  ),
                )
                  .sort(
                    (a, b) =>
                      new Date(b.date).getTime() - new Date(a.date).getTime(),
                  )
                  .map((day) => (
                    <div
                      key={day.date}
                      className="flex items-center justify-between p-3 bg-gray-50 rounded"
                    >
                      <div className="font-medium">
                        {new Date(day.date).toLocaleDateString()}
                      </div>
                      <div className="flex items-center gap-4 text-sm">
                        <div className="flex items-center gap-1">
                          <div className="w-3 h-3 bg-green-500 rounded-full"></div>
                          <span>{day.completed} completed</span>
                        </div>
                        {day.failed > 0 && (
                          <div className="flex items-center gap-1">
                            <div className="w-3 h-3 bg-red-500 rounded-full"></div>
                            <span>{day.failed} failed</span>
                          </div>
                        )}
                        {day.running > 0 && (
                          <div className="flex items-center gap-1">
                            <div className="w-3 h-3 bg-blue-500 rounded-full"></div>
                            <span>{day.running} running</span>
                          </div>
                        )}
                      </div>
                    </div>
                  ))}
              </div>
            </CardContent>
          </Card>
        </div>
      )}

      {/* Footer */}
      <div className="text-xs text-muted-foreground text-right">
        Page last updated: {new Date().toLocaleTimeString()}
      </div>
    </div>
  );
}
