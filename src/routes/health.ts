import { Hono } from 'hono';
import { config } from '../config';

const health = new Hono();

health.get('/', (c) => {
  return c.json({
    status: 'healthy',
    service: 'pterodactyl-backup-api',
    version: '1.0.0',
    timestamp: new Date().toISOString(),
    config: {
      backupPath: config.backupPath,
      s3Bucket: config.s3Bucket,
      s3Endpoint: config.s3Endpoint,
      retentionPolicy: config.retentionPolicy,
    }
  });
});

// Unauthenticated health check
health.get('/ping', (c) => {
  return c.json({ pong: true, timestamp: new Date().toISOString() });
});

export default health;