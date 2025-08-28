import { Context, Next } from 'hono';
import { config } from '../config';
import { Logger } from '../logger';

export const bearerAuth = async (c: Context, next: Next) => {
  const authorization = c.req.header('authorization');
  
  if (!authorization) {
    Logger.warn('Authentication failed: No authorization header');
    return c.json({ error: 'Authorization header required' }, 401);
  }

  if (!authorization.startsWith('Bearer ')) {
    Logger.warn('Authentication failed: Invalid authorization format');
    return c.json({ error: 'Bearer token required' }, 401);
  }

  const token = authorization.slice(7); // Remove "Bearer " prefix
  
  if (token !== config.bearerToken) {
    Logger.warn('Authentication failed: Invalid token');
    return c.json({ error: 'Invalid token' }, 401);
  }

  await next();
};