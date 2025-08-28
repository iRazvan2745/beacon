// config.ts
import { loadRuntimeConfig, getRuntimeConfig } from './config-manager';

export interface BackupConfig {
  // API Configuration
  port: number;
  bearerToken: string;
  
  // R2/S3 Configuration
  s3Endpoint: string;
  s3Region: string;
  s3Bucket: string;
  s3AccessKeyId: string;
  s3SecretAccessKey: string;
  
  // Notifications Configuration
  notifications: {
    discordWebhookUrl: string;
  };
  
  // Restic Configuration
  resticPassword: string;
  backupPath: string;
  excludePatterns: string[];
  retentionPolicy: {
    keepLast: number;
    keepDaily: number;
    keepWeekly: number;
    keepMonthly: number;
  };
}

function validateRequired(value: string | undefined, name: string): string {
  if (!value) {
    console.error(`❌ ${name} environment variable is required`);
    process.exit(1);
  }
  return value;
}

// Load runtime config at startup
await loadRuntimeConfig();

function getConfigValue<T>(
  runtimeValue: T | undefined, 
  envValue: T, 
  defaultValue?: T
): T {
  if (runtimeValue !== undefined) return runtimeValue;
  if (envValue !== undefined) return envValue;
  return defaultValue as T;
}

export const config: BackupConfig = {
  // API Configuration
  port: getConfigValue(
    getRuntimeConfig()?.port,
    parseInt(process.env.PORT || '3000')
  ),
  bearerToken: validateRequired(process.env.BEARER_TOKEN, 'BEARER_TOKEN'),
  
  // R2/S3 Configuration
  s3Endpoint: getConfigValue(
    getRuntimeConfig()?.s3Endpoint,
    validateRequired(process.env.S3_ENDPOINT, 'S3_ENDPOINT')
  ),
  s3Region: getConfigValue(
    getRuntimeConfig()?.s3Region,
    process.env.S3_REGION || 'auto'
  ),
  s3Bucket: getConfigValue(
    getRuntimeConfig()?.s3Bucket,
    validateRequired(process.env.S3_BUCKET, 'S3_BUCKET')
  ),
  s3AccessKeyId: getConfigValue(
    getRuntimeConfig()?.s3AccessKeyId,
    validateRequired(process.env.S3_ACCESS_KEY_ID, 'S3_ACCESS_KEY_ID')
  ),
  s3SecretAccessKey: getConfigValue(
    getRuntimeConfig()?.s3SecretAccessKey,
    validateRequired(process.env.S3_SECRET_ACCESS_KEY, 'S3_SECRET_ACCESS_KEY')
  ),

  // Notifications Configuration
  notifications: {
    discordWebhookUrl: getConfigValue(
      getRuntimeConfig()?.notifications?.discordWebhookUrl,
      validateRequired(process.env.DISCORD_WEBHOOK_URL, 'DISCORD_WEBHOOK_URL')
    ),
  },
  
  // Restic Configuration
  resticPassword: getConfigValue(
    getRuntimeConfig()?.resticPassword,
    validateRequired(process.env.RESTIC_PASSWORD, 'RESTIC_PASSWORD')
  ),
  backupPath: getConfigValue(
    getRuntimeConfig()?.backupPath,
    process.env.BACKUP_PATH || '/var/lib/pterodactyl'
  ),
  excludePatterns: getConfigValue(
    getRuntimeConfig()?.excludePatterns,
    (process.env.EXCLUDE_PATTERNS || '*.tmp,*.log,cache/*,logs/*').split(',')
  ),
  retentionPolicy: {
    keepLast: getConfigValue(
      getRuntimeConfig()?.retentionPolicy?.keepLast,
      parseInt(process.env.KEEP_LAST || '10')
    ),
    keepDaily: getConfigValue(
      getRuntimeConfig()?.retentionPolicy?.keepDaily,
      parseInt(process.env.KEEP_DAILY || '7')
    ),
    keepWeekly: getConfigValue(
      getRuntimeConfig()?.retentionPolicy?.keepWeekly,
      parseInt(process.env.KEEP_WEEKLY || '4')
    ),
    keepMonthly: getConfigValue(
      getRuntimeConfig()?.retentionPolicy?.keepMonthly,
      parseInt(process.env.KEEP_MONTHLY || '6')
    )
  }
};

export const getResticRepository = (): string => {
  return `s3:${config.s3Endpoint}/${config.s3Bucket}/pterodactyl-backup`;
};

// Function to reload config after updates
export function reloadConfig(): void {
  const runtime = getRuntimeConfig();
  if (runtime) {
    Object.assign(config, {
      port: runtime.port ?? config.port,
      s3Endpoint: runtime.s3Endpoint ?? config.s3Endpoint,
      s3Region: runtime.s3Region ?? config.s3Region,
      s3Bucket: runtime.s3Bucket ?? config.s3Bucket,
      s3AccessKeyId: runtime.s3AccessKeyId ?? config.s3AccessKeyId,
      s3SecretAccessKey: runtime.s3SecretAccessKey ?? config.s3SecretAccessKey,
      notifications: {
        discordWebhookUrl: runtime.notifications?.discordWebhookUrl ?? config.notifications.discordWebhookUrl,
      },
      resticPassword: runtime.resticPassword ?? config.resticPassword,
      backupPath: runtime.backupPath ?? config.backupPath,
      excludePatterns: runtime.excludePatterns ?? config.excludePatterns,
      retentionPolicy: {
        keepLast: runtime.retentionPolicy?.keepLast ?? config.retentionPolicy.keepLast,
        keepDaily: runtime.retentionPolicy?.keepDaily ?? config.retentionPolicy.keepDaily,
        keepWeekly: runtime.retentionPolicy?.keepWeekly ?? config.retentionPolicy.keepWeekly,
        keepMonthly: runtime.retentionPolicy?.keepMonthly ?? config.retentionPolicy.keepMonthly,
      }
    });
  }
}