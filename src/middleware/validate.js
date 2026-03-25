import { validationResult } from 'express-validator';
import { sendError } from '../utils/response.js';

/**
 * Run after express-validator chains to send a 422 if any field fails.
 */
export function validate(req, res, next) {
  const errors = validationResult(req);
  if (!errors.isEmpty()) {
    return sendError(res, 'Validation failed', 422, errors.array());
  }
  next();
}
