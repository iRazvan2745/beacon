import { Hono } from 'hono';
import { spawn } from 'bun';
import { Logger } from '../logger';
import { config, getResticRepository } from '../config';

// Utility to run restic with current env
function resticEnv(): Record<string, string> {
  return {
    ...process.env,
    RESTIC_REPOSITORY: getResticRepository ? getResticRepository() : (process.env.RESTIC_REPOSITORY || ''),
    RESTIC_PASSWORD: config?.resticPassword || process.env.RESTIC_PASSWORD || '',
    
    // AWS S3/R2 credentials
    AWS_ACCESS_KEY_ID: config?.s3AccessKeyId || process.env.AWS_ACCESS_KEY_ID || '',
    AWS_SECRET_ACCESS_KEY: config?.s3SecretAccessKey || process.env.AWS_SECRET_ACCESS_KEY || '',
    
    // Required for S3-compatible storage like Cloudflare R2
    AWS_DEFAULT_REGION: config?.s3Region || process.env.AWS_DEFAULT_REGION || 'auto',
    
    // Ensure we don't use AWS default credentials provider chain
    AWS_SDK_LOAD_CONFIG: 'true',
    
    // Required for Cloudflare R2
    AWS_REGION: config?.s3Region || process.env.AWS_REGION || 'auto',
    
    // Required for S3-compatible storage
    S3_USE_PATH_STYLE_ENDPOINT: 'true',
    
    // Set the endpoint URL for S3-compatible storage
    AWS_ENDPOINT_URL: config?.s3Endpoint || process.env.AWS_ENDPOINT_URL || ''
  };
}

const router = new Hono();

// GET /api/backup/files/:snapshot
// Optional query: path=/some/dir to filter a subtree
router.get('/files/:snapshot', async (c) => {
  const snapshot = c.req.param('snapshot');
  const path = c.req.query('path'); // optional

  if (!snapshot) {
    return c.json({ error: 'snapshot is required' }, 400);
  }

  const args = ['ls', snapshot, '--json'];
  if (path) args.push(path);

  const proc = spawn({
    cmd: ['restic', ...args],
    env: resticEnv(),
    stdout: 'pipe',
    stderr: 'pipe',
  });

  const [out, err, code] = await Promise.all([
    new Response(proc.stdout).text(),
    new Response(proc.stderr).text(),
    proc.exited,
  ]);

  if (code !== 0) {
    Logger.error('restic_ls_failed', { err });
    return c.json({ error: 'Failed to list snapshot', details: err }, 500);
  }

  // restic ls --json outputs newline-delimited JSON events; collect them
  const items: any[] = [];
  for (const line of out.split('\n')) {
    const t = line.trim();
    if (!t) continue;
    try {
      const obj = JSON.parse(t);
      // obj has structure like { "type":"node","path":"/...","name":"...", "mode":... }
      items.push(obj);
    } catch {
      // ignore non-JSON lines
    }
  }

  return c.json({ success: true, count: items.length, items });
});

// GET /api/backup/dump/:snapshot/*path
// Streams a single file from a snapshot to the client
router.get('/dump/:snapshot/*', async (c) => {
  const snapshot = c.req.param('snapshot');
  const filePath = c.req.param('*');

  if (!snapshot || !filePath) {
    return c.json({ error: 'snapshot and file path are required' }, 400);
    }

  Logger.info('restic_dump_start', { snapshot, filePath });

  const proc = spawn({
    cmd: ['restic', 'dump', snapshot, filePath],
    env: resticEnv(),
    stdout: 'pipe',
    stderr: 'pipe',
  });

  // Set headers for download
  const filename = filePath.split('/').pop() || 'file';
  const headers = new Headers({
    'Content-Type': 'application/octet-stream',
    'Content-Disposition': `attachment; filename="${filename}"`,
  });

  // Create streaming response
  const body = proc.stdout;
  const response = new Response(body, { headers });

  // Log completion or error
  proc.exited.then(async (code) => {
    if (code !== 0) {
      const err = await new Response(proc.stderr).text();
      Logger.error('restic_dump_failed', { code, err });
    } else {
      Logger.info('restic_dump_ok', { snapshot, filePath });
    }
  });

  return response;
});

export default router;