// routes/config.ts
import { Hono } from "hono";
import { config, reloadConfig } from "../config";
import { saveRuntimeConfig, getRuntimeConfig } from "../config-manager";
import type { RuntimeConfig } from "../config-manager";

const configRoute = new Hono();

// GET current configuration (excluding sensitive data)
configRoute.get('/', (c) => {
  const runtime = getRuntimeConfig();
  
  return c.json({
    success: true,
    data: {
      current: {
        port: config.port,
        notifications: {
          discordWebhookUrl: config.notifications.discordWebhookUrl
        },
        backupPath: config.backupPath,
        excludePatterns: config.excludePatterns,
        retentionPolicy: config.retentionPolicy
      },
      runtime: runtime ? {
        ...runtime,
        hasRuntimeOverrides: true
      } : {
        hasRuntimeOverrides: false
      },
      editableFields: [
        'port',
        'notifications.discordWebhookUrl', 
        'backupPath',
        'excludePatterns',
        'retentionPolicy.keepLast',
        'retentionPolicy.keepDaily',
        'retentionPolicy.keepWeekly',
        'retentionPolicy.keepMonthly'
      ]
    }
  });
});

// PUT update configuration
configRoute.put('/', async (c) => {
  try {
    const body = await c.req.json();
    
    // Validate the incoming data
    const errors: string[] = [];
    
    if (body.port !== undefined) {
      if (!Number.isInteger(body.port) || body.port < 1 || body.port > 65535) {
        errors.push('port must be an integer between 1 and 65535');
      }
    }
    
    if (body.notifications?.discordWebhookUrl !== undefined) {
      if (typeof body.notifications.discordWebhookUrl !== 'string' || 
          !body.notifications.discordWebhookUrl.startsWith('https://discord.com/api/webhooks/')) {
        errors.push('notifications.discordWebhookUrl must be a valid Discord webhook URL');
      }
    }
    
    if (body.backupPath !== undefined) {
      if (typeof body.backupPath !== 'string' || body.backupPath.trim() === '') {
        errors.push('backupPath must be a non-empty string');
      }
    }
    
    if (body.excludePatterns !== undefined) {
      if (!Array.isArray(body.excludePatterns) || 
          !body.excludePatterns.every((p: any) => typeof p === 'string')) {
        errors.push('excludePatterns must be an array of strings');
      }
    }
    
    if (body.retentionPolicy) {
      const rp = body.retentionPolicy;
      ['keepLast', 'keepDaily', 'keepWeekly', 'keepMonthly'].forEach(field => {
        if (rp[field] !== undefined) {
          if (!Number.isInteger(rp[field]) || rp[field] < 0) {
            errors.push(`retentionPolicy.${field} must be a non-negative integer`);
          }
        }
      });
    }
    
    if (errors.length > 0) {
      return c.json({
        success: false,
        error: 'Validation failed',
        details: errors
      }, 400);
    }
    
    // Save the configuration
    await saveRuntimeConfig(body);
    
    // Reload the config in memory
    reloadConfig();
    
    return c.json({
      success: true,
      message: 'Configuration updated successfully',
      data: {
        updatedAt: new Date().toISOString(),
        updatedFields: Object.keys(body)
      }
    });
    
  } catch (error) {
    console.error('Failed to update config:', error);
    return c.json({
      success: false,
      error: 'Failed to update configuration'
    }, 500);
  }
});

// PATCH partially update configuration
configRoute.patch('/', async (c) => {
  try {
    const body = await c.req.json();
    const currentRuntime: Partial<RuntimeConfig> = getRuntimeConfig() || {};
    
    // Merge with existing runtime config
    const mergedConfig: RuntimeConfig = {
      ...currentRuntime,
      ...body,
      notifications: {
        ...currentRuntime.notifications,
        ...body.notifications
      },
      retentionPolicy: {
        ...currentRuntime.retentionPolicy,
        ...body.retentionPolicy
      },
      updatedAt: new Date().toISOString()
    };
    
    // Save the merged configuration
    await saveRuntimeConfig(mergedConfig);
    reloadConfig();
    
    return c.json({
      success: true,
      message: 'Configuration partially updated successfully',
      data: {
        updatedAt: mergedConfig.updatedAt,
        updatedFields: Object.keys(body)
      }
    });
    
  } catch (error) {
    console.error('Failed to patch config:', error);
    return c.json({
      success: false,
      error: 'Failed to patch configuration'
    }, 500);
  }
});

// DELETE reset configuration to environment defaults
configRoute.delete('/', async (c) => {
  try {
    const { unlink } = await import('fs/promises');
    const { existsSync } = await import('fs');
    const path = await import('path');
    
    const configPath = path.join(process.cwd(), 'runtime-config.json');
    
    if (existsSync(configPath)) {
      await unlink(configPath);
    }
    
    // Reload config to use environment defaults
    reloadConfig();
    
    return c.json({
      success: true,
      message: 'Configuration reset to environment defaults'
    });
    
  } catch (error) {
    console.error('Failed to reset config:', error);
    return c.json({
      success: false,
      error: 'Failed to reset configuration'
    }, 500);
  }
});

export default configRoute;