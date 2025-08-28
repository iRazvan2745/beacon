// config-manager.ts
import { writeFile, readFile } from 'fs/promises';
import { existsSync } from 'fs';
import * as path from 'path';

const CONFIG_FILE_PATH = path.join(process.cwd(), 'runtime-config.json');

interface EditableConfig {
  // API Configuration
  port?: number;
  
  // R2/S3 Configuration
  s3Endpoint?: string;
  s3Region?: string;
  s3Bucket?: string;
  s3AccessKeyId?: string;
  s3SecretAccessKey?: string;
  
  // Notifications Configuration
  notifications?: {
    discordWebhookUrl?: string;
  };
  
  // Restic Configuration
  resticPassword?: string;
  backupPath?: string;
  excludePatterns?: string[];
  retentionPolicy?: {
    keepLast?: number;
    keepDaily?: number;
    keepWeekly?: number;
    keepMonthly?: number;
  };
}

export interface RuntimeConfig extends EditableConfig {
  updatedAt: string;
}

let runtimeConfig: RuntimeConfig | null = null;

export async function loadRuntimeConfig(): Promise<RuntimeConfig | null> {
  if (runtimeConfig) return runtimeConfig;
  
  if (!existsSync(CONFIG_FILE_PATH)) {
    return null;
  }
  
  try {
    const data = await readFile(CONFIG_FILE_PATH, 'utf-8');
    runtimeConfig = JSON.parse(data);
    return runtimeConfig;
  } catch (error) {
    console.error('Failed to load runtime config:', error);
    return null;
  }
}

export async function saveRuntimeConfig(
  config: EditableConfig
): Promise<void> {
  const newConfig: RuntimeConfig = {
    ...config,
    updatedAt: new Date().toISOString(),
  };
  
  await writeFile(CONFIG_FILE_PATH, JSON.stringify(newConfig, null, 2));
  runtimeConfig = newConfig;
}

export function getRuntimeConfig(): RuntimeConfig | null {
  return runtimeConfig;
}