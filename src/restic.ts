import { spawn } from 'bun';
import { Logger } from './logger';
import { config, getResticRepository } from './config';

export interface BackupResult {
  success: boolean;
  snapshotId?: string;
  filesNew: number;
  filesChanged: number;
  filesUnmodified: number;
  dirsNew: number;
  dirsChanged: number;
  dirsUnmodified: number;
  dataBlobs: number;
  treeBlobs: number;
  dataAdded: number;
  totalFilesProcessed: number;
  totalBytesProcessed: number;
  totalDuration: number;
}

export interface Snapshot {
  id: string;
  short_id: string;
  time: string;
  hostname: string;
  username: string;
  tags: string[];
  paths: string[];
}

export class ResticManager {
  private env: Record<string, string>;

  constructor() {
    this.env = {
      ...process.env,
      RESTIC_REPOSITORY: getResticRepository(),
      RESTIC_PASSWORD: config.resticPassword,
      AWS_ACCESS_KEY_ID: config.s3AccessKeyId,
      AWS_SECRET_ACCESS_KEY: config.s3SecretAccessKey,
    };
  }

  private async runResticCommand(
    args: string[], 
    options: { timeout?: number } = {}
  ): Promise<{
    success: boolean;
    output: string;
    error: string;
    exitCode: number;
  }> {
    try {
      Logger.debug(`Running restic command: ${args.join(' ')}`);
      
      const proc = spawn({
        cmd: ['restic', ...args],
        env: this.env,
        stdout: 'pipe',
        stderr: 'pipe',
      });

      let timeoutId: Timer | null = null;
      if (options.timeout) {
        timeoutId = setTimeout(() => {
          proc.kill();
        }, options.timeout);
      }

      const output = await new Response(proc.stdout).text();
      const error = await new Response(proc.stderr).text();
      const exitCode = await proc.exited;

      if (timeoutId) {
        clearTimeout(timeoutId);
      }

      Logger.debug(`Restic command completed with exit code: ${exitCode}`);

      return {
        success: exitCode === 0,
        output: output.trim(),
        error: error.trim(),
        exitCode,
      };
    } catch (err) {
      Logger.error(`Failed to execute restic: ${err}`);
      return {
        success: false,
        output: '',
        error: `Failed to execute restic: ${err}`,
        exitCode: -1,
      };
    }
  }

  async initRepository(): Promise<boolean> {
    Logger.info('Initializing restic repository on R2...');
    const result = await this.runResticCommand(['init']);
    
    if (result.success) {
      Logger.success('Repository initialized successfully');
      return true;
    } else if (result.error.includes('already exists') || result.error.includes('already initialized')) {
      Logger.info('Repository already exists');
      return true;
    } else {
      Logger.error('Failed to initialize repository:', result.error);
      return false;
    }
  }

  async backup(tags: string[] = []): Promise<BackupResult> {
    Logger.info(`Starting backup of ${config.backupPath} to R2...`);

    // Build backup command
    const args = ['backup', config.backupPath, '--json'];
    
    // Add exclude patterns
    config.excludePatterns.forEach(pattern => {
      args.push('--exclude', pattern);
    });

    // Add tags
    tags.forEach(tag => {
      args.push('--tag', tag);
    });

    // Add hostname tag
    args.push('--tag', `hostname:${await this.getHostname()}`);
    args.push('--tag', `source:api`);

    const result = await this.runResticCommand(args, { timeout: 30 * 60 * 1000 }); // 30 min timeout

    if (result.success) {
      try {
        // Parse the JSON output to get backup statistics
        const lines = result.output.split('\n').filter(line => line.trim());
        const summaryLine = lines[lines.length - 1];
        const summary = JSON.parse(summaryLine);

        const backupResult: BackupResult = {
          success: true,
          snapshotId: summary.snapshot_id,
          filesNew: summary.files_new || 0,
          filesChanged: summary.files_changed || 0,
          filesUnmodified: summary.files_unmodified || 0,
          dirsNew: summary.dirs_new || 0,
          dirsChanged: summary.dirs_changed || 0,
          dirsUnmodified: summary.dirs_unmodified || 0,
          dataBlobs: summary.data_blobs || 0,
          treeBlobs: summary.tree_blobs || 0,
          dataAdded: summary.data_added || 0,
          totalFilesProcessed: summary.total_files_processed || 0,
          totalBytesProcessed: summary.total_bytes_processed || 0,
          totalDuration: summary.total_duration || 0,
        };

        Logger.success('Backup completed successfully');
        Logger.info(`Snapshot ID: ${backupResult.snapshotId}`);
        Logger.info(`Files processed: ${backupResult.totalFilesProcessed}`);
        Logger.info(`Data added: ${(backupResult.dataAdded / 1024 / 1024).toFixed(2)} MB`);

        return backupResult;
      } catch (parseError) {
        Logger.error('Failed to parse backup result:', parseError);
        return {
          success: true,
          snapshotId: 'unknown',
          filesNew: 0,
          filesChanged: 0,
          filesUnmodified: 0,
          dirsNew: 0,
          dirsChanged: 0,
          dirsUnmodified: 0,
          dataBlobs: 0,
          treeBlobs: 0,
          dataAdded: 0,
          totalFilesProcessed: 0,
          totalBytesProcessed: 0,
          totalDuration: 0,
        };
      }
    } else {
      Logger.error('Backup failed:', result.error);
      throw new Error(`Backup failed: ${result.error}`);
    }
  }

  async listSnapshots(): Promise<Snapshot[]> {
    Logger.debug('Listing snapshots...');
    const result = await this.runResticCommand(['snapshots', '--json']);

    if (result.success) {
      try {
        const snapshots = JSON.parse(result.output) as Snapshot[];
        Logger.debug(`Found ${snapshots.length} snapshots`);
        return snapshots;
      } catch (err) {
        Logger.error('Failed to parse snapshots JSON:', err);
        throw new Error('Failed to parse snapshots');
      }
    } else {
      Logger.error('Failed to list snapshots:', result.error);
      throw new Error(`Failed to list snapshots: ${result.error}`);
    }
  }

  async check(): Promise<boolean> {
    Logger.info('Checking repository integrity...');
    const result = await this.runResticCommand(['check'], { timeout: 10 * 60 * 1000 }); // 10 min timeout

    if (result.success) {
      Logger.success('Repository check completed successfully');
      return true;
    } else {
      Logger.error('Repository check failed:', result.error);
      throw new Error(`Repository check failed: ${result.error}`);
    }
  }

  async forget(): Promise<{ removed: number; kept: number }> {
    Logger.info('Applying retention policy...');
    const args = [
      'forget',
      '--keep-last', config.retentionPolicy.keepLast.toString(),
      '--keep-daily', config.retentionPolicy.keepDaily.toString(),
      '--keep-weekly', config.retentionPolicy.keepWeekly.toString(),
      '--keep-monthly', config.retentionPolicy.keepMonthly.toString(),
      '--prune',
      '--json',
    ];

    const result = await this.runResticCommand(args);

    if (result.success) {
      try {
        const forgetResult = JSON.parse(result.output);
        const removed = forgetResult.reduce((sum: number, repo: any) => sum + (repo.remove?.length || 0), 0);
        const kept = forgetResult.reduce((sum: number, repo: any) => sum + (repo.keep?.length || 0), 0);
        
        Logger.success(`Retention policy applied - Removed: ${removed}, Kept: ${kept}`);
        return { removed, kept };
      } catch (parseError) {
        Logger.warn('Could not parse forget output, but command succeeded');
        return { removed: 0, kept: 0 };
      }
    } else {
      Logger.error('Failed to apply retention policy:', result.error);
      throw new Error(`Failed to apply retention policy: ${result.error}`);
    }
  }

  async getStats(): Promise<{
    totalSize: number;
    totalFileCount: number;
    snapshotCount: number;
  }> {
    const result = await this.runResticCommand(['stats', '--json']);
    
    if (result.success) {
      try {
        const stats = JSON.parse(result.output);
        return {
          totalSize: stats.total_size || 0,
          totalFileCount: stats.total_file_count || 0,
          snapshotCount: await this.getSnapshotCount(),
        };
      } catch (err) {
        Logger.error('Failed to parse stats:', err);
        throw new Error('Failed to get repository stats');
      }
    } else {
      throw new Error(`Failed to get stats: ${result.error}`);
    }
  }

  private async getSnapshotCount(): Promise<number> {
    try {
      const snapshots = await this.listSnapshots();
      return snapshots.length;
    } catch {
      return 0;
    }
  }

  private async getHostname(): Promise<string> {
    try {
      const proc = spawn(['hostname']);
      const output = await new Response(proc.stdout).text();
      return output.trim() || 'unknown';
    } catch {
      return 'unknown';
    }
  }
}