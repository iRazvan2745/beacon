'use client';

import { MachinesStatCard } from '@/components/cards/total-machine';
import { SnapshotsStatCard } from '@/components/cards/total-snapshots';
import { StorageStatCard } from '@/components/cards/storage-stats';
import { BackupStatCard } from '@/components/cards/backup-stats';
import { useOverviewStats, useStorageStats } from '@/hooks/use-stats';
import { Card, CardContent } from '@/components/ui/card';
import { RefreshCw, AlertCircle } from 'lucide-react';

export default function Page() {
  const {
    data: overviewData,
    loading: overviewLoading,
    error: overviewError,
    refetch: refetchOverview,
  } = useOverviewStats({ autoRefresh: true, refreshInterval: 30000 });

  const {
    data: storageData,
    loading: storageLoading,
    error: storageError,
    refetch: refetchStorage,
  } = useStorageStats({ autoRefresh: true, refreshInterval: 60000 });

  const handleRefresh = () => {
    refetchOverview();
    refetchStorage();
  };

  if (overviewError || storageError) {
    return (
      <div>
        <div className="flex items-center justify-between mb-6">
          <h1 className="text-2xl font-semibold">Dashboard</h1>
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
                Failed to load dashboard data
              </p>
              <p className="text-sm text-red-600">
                {overviewError || storageError}
              </p>
            </div>
          </CardContent>
        </Card>
      </div>
    );
  }

  return (
    <div>
      <div className="flex items-center justify-between mb-6">
        <h1 className="text-2xl font-semibold">Dashboard</h1>
        <button
          onClick={handleRefresh}
          disabled={overviewLoading || storageLoading}
          className="flex items-center gap-2 px-4 py-2 text-sm bg-primary text-primary-foreground rounded-md hover:bg-primary/90 disabled:opacity-50 disabled:cursor-not-allowed"
        >
          <RefreshCw
            className={`h-4 w-4 ${overviewLoading || storageLoading ? 'animate-spin' : ''}`}
          />
          Refresh
        </button>
      </div>

      {/* Main Stats Grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4 mb-8">
        {/* Machines Card */}
        <div
          className={`transition-opacity ${overviewLoading ? 'opacity-50' : ''}`}
        >
          <MachinesStatCard
            value={overviewData?.machines?.total ?? 0}
            label={`Total machines (${overviewData?.machines?.active ?? 0} active)`}
          />
        </div>

        {/* Snapshots Card */}
        <div
          className={`transition-opacity ${overviewLoading ? 'opacity-50' : ''}`}
        >
          <SnapshotsStatCard value={overviewData?.snapshots?.total ?? 0} />
        </div>

        {/* Storage Card */}
        <div
          className={`transition-opacity ${storageLoading ? 'opacity-50' : ''}`}
        >
          <StorageStatCard
            totalSize={storageData?.total?.size ?? 0}
            totalSizeHuman={storageData?.total?.sizeHuman ?? '0 B'}
            fileCount={storageData?.total?.fileCount}
          />
        </div>

        {/* Backup Activity Card */}
        <div
          className={`transition-opacity ${overviewLoading ? 'opacity-50' : ''}`}
        >
          <BackupStatCard
            running={overviewData?.backups?.running}
            successRate={overviewData?.backups?.successRate}
            completedToday={overviewData?.backups?.completedToday}
            failedToday={overviewData?.backups?.failedToday}
          />
        </div>
      </div>

      {/* Storage Breakdown */}
      {storageData && storageData.machines.length > 0 && (
        <div className="mb-8">
          <h2 className="text-lg font-medium mb-4">Storage by Machine</h2>
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {storageData.machines.map((machine) => (
              <Card key={machine.machineId} className="shadow-sm">
                <CardContent className="p-4">
                  <div className="flex items-center justify-between mb-2">
                    <h3 className="font-medium text-sm">
                      {machine.machineName}
                    </h3>
                    <div className="text-xs text-muted-foreground">
                      {machine.snapshotCount} snapshots
                    </div>
                  </div>
                  <div className="text-xl font-semibold">
                    {machine.sizeHuman}
                  </div>
                  <div className="text-xs text-muted-foreground mt-1">
                    {machine.fileCount.toLocaleString()} files
                  </div>
                  {machine.lastUpdated && (
                    <div className="text-xs text-muted-foreground mt-1">
                      Updated:{' '}
                      {new Date(machine.lastUpdated).toLocaleDateString()}
                    </div>
                  )}
                </CardContent>
              </Card>
            ))}
          </div>
        </div>
      )}

      {/* Status Summary */}
      {overviewData && overviewData.backups && (
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-8">
          <Card className="shadow-sm">
            <CardContent className="p-4">
              <div className="text-sm text-muted-foreground">
                Active Backups
              </div>
              <div className="text-2xl font-semibold text-blue-600">
                {overviewData.backups.running}
              </div>
              <div className="text-xs text-muted-foreground mt-1">
                Currently running
              </div>
            </CardContent>
          </Card>

          <Card className="shadow-sm">
            <CardContent className="p-4">
              <div className="text-sm text-muted-foreground">
                Today's Backups
              </div>
              <div className="text-2xl font-semibold text-green-600">
                {overviewData.backups.completedToday}
              </div>
              <div className="text-xs text-muted-foreground mt-1">
                {overviewData.backups.failedToday > 0 && (
                  <span className="text-red-600">
                    {overviewData.backups.failedToday} failed
                  </span>
                )}
                {overviewData.backups.failedToday === 0 && 'All successful'}
              </div>
            </CardContent>
          </Card>

          <Card className="shadow-sm">
            <CardContent className="p-4">
              <div className="text-sm text-muted-foreground">Success Rate</div>
              <div
                className={`text-2xl font-semibold ${
                  overviewData.backups.successRate >= 90
                    ? 'text-green-600'
                    : overviewData.backups.successRate >= 70
                    ? 'text-yellow-600'
                    : 'text-red-600'
                }`}
              >
                {overviewData.backups.successRate}%
              </div>
              <div className="text-xs text-muted-foreground mt-1">
                Last 24 hours
              </div>
            </CardContent>
          </Card>
        </div>
      )}

      {/* Loading State */}
      {(overviewLoading || storageLoading) && !overviewData && !storageData && (
        <Card className="shadow-sm">
          <CardContent className="flex items-center justify-center p-8">
            <RefreshCw className="h-6 w-6 animate-spin mr-2" />
            <span>Loading dashboard data...</span>
          </CardContent>
        </Card>
      )}

      {/* Last Updated */}
      <div className="text-xs text-muted-foreground text-right mt-4">
        Last updated: {new Date().toLocaleTimeString()}
      </div>
    </div>
  );
}