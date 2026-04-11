/**
 * Structured logger — wraps pino for production JSON logs,
 * pino-pretty for development terminal output.
 *
 * Usage:
 *   import logger from './utils/logger.js';
 *   logger.info('Server started on port %d', 3000);
 *   logger.error({ err }, 'Unhandled exception');
 */
import pino from 'pino';

const IS_DEV = process.env.NODE_ENV !== 'production';

const transport = IS_DEV
  ? {
      target: 'pino-pretty',
      options: {
        colorize: true,
        translateTime: 'SYS:HH:MM:ss',
        ignore: 'pid,hostname',
      },
    }
  : undefined; // Production: raw JSON to stdout (parsed by log aggregators)

const logger = pino(
  {
    level: process.env.LOG_LEVEL || (IS_DEV ? 'debug' : 'info'),
    base: { service: 'farmeasy-api' },
    redact: {
      paths: ['req.headers.authorization', 'body.otp', 'body.refreshToken', 'body.password'],
      censor: '[REDACTED]',
    },
  },
  transport ? pino.transport(transport) : undefined,
);

export default logger;
