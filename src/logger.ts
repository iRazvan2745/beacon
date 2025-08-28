// src/logger.ts
import { config } from './config';
import { consola } from 'consola'

export class Logger {
  private static formatTime(): string {
    return new Date().toISOString();
  }

  static info(message: string, ...args: any[]): void {
    consola.log(`[${this.formatTime()}] ℹ️  ${message}`, ...args);
  }

  static success(message: string, ...args: any[]): void {
    consola.log(`[${this.formatTime()}] ✅ ${message}`, ...args);
  }

  static error(message: string, ...args: any[]): void {
    consola.error(`[${this.formatTime()}] ❌ ${message}`, ...args);
  }

  static warn(message: string, ...args: any[]): void {
    consola.warn(`[${this.formatTime()}] ⚠️  ${message}`, ...args);
  }
  
  static debug(message: string, ...args: any[]): void {
    consola.debug(`[${this.formatTime()}] ℹ️  ${message}`, ...args);
  }

  // ========== Discord helpers ==========
  private static webhook(): string | null {
    // Expect config to expose webhook. If you don’t have it in config yet,
    // you can read from process.env directly.
    return (config as any)?.notifications?.discordWebhookUrl
      ?? process.env.DISCORD_WEBHOOK_URL
      ?? null;
  }

  private static async postDiscord(payload: unknown) {
    const url = this.webhook();
    if (!url) return; // disabled
    try {
      const res = await fetch(url, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      });
      if (!res.ok) {
        const text = await res.text().catch(() => '');
        this.warn('Discord webhook returned non-OK', { status: res.status, text });
      }
    } catch (e) {
      this.warn('Discord webhook error', e);
    }
  }

  private static colorHexToInt(hex: string) {
    return parseInt(hex.replace('#', ''), 16);
  }

  private static fmtBytes(b: number | undefined): string {
    const n = typeof b === 'number' ? b : 0;
    if (n <= 0) return '0 B';
    const u = ['B', 'KB', 'MB', 'GB', 'TB', 'PB'];
    const i = Math.floor(Math.log(n) / Math.log(1024));
    return `${(n / Math.pow(1024, i)).toFixed(2)} ${u[i]}`;
  }

  static async notifyBackupStarted(context?: {
    path?: string;
    tags?: string[];
    host?: string;
  }) {
    const embed = {
      title: 'Backup started',
      description: 'Restic backup has started',
      color: this.colorHexToInt('#3498db'),
      timestamp: new Date().toISOString(),
      fields: [
        { name: 'Path', value: context?.path ?? 'N/A', inline: true },
        { name: 'Tags', value: (context?.tags ?? []).join(', ') || 'none', inline: true },
        { name: 'Host', value: context?.host ?? 'unknown', inline: true },
      ],
    };
    await this.postDiscord({ embeds: [embed] });
  }

  static async notifyBackupFinished(result: {
    ok: boolean;
    snapshotId?: string | null;
    dataAdded?: number;
    totalFilesProcessed?: number;
    durationSec?: number;
    error?: string;
  }) {
    const ok = result.ok;
    const embed = {
      title: ok ? 'Backup finished: SUCCESS' : 'Backup finished: FAILURE',
      description: ok ? 'Restic backup completed successfully.' : 'Restic backup failed.',
      color: this.colorHexToInt(ok ? '#2ecc71' : '#e74c3c'),
      timestamp: new Date().toISOString(),
      fields: [
        { name: 'Snapshot', value: result.snapshotId || 'N/A', inline: true },
        { name: 'Data Added', value: this.fmtBytes(result.dataAdded), inline: true },
        {
          name: 'Files Processed',
          value: String(result.totalFilesProcessed ?? 0),
          inline: true,
        },
        {
          name: 'Duration',
          value: result.durationSec ? `${result.durationSec.toFixed(1)}s` : 'N/A',
          inline: true,
        },
        ...(ok
          ? []
          : [
              {
                name: 'Error',
                value: (result.error ?? 'Unknown error').slice(0, 1024),
              },
            ]),
      ],
    };
    await this.postDiscord({ embeds: [embed] });
  }
}