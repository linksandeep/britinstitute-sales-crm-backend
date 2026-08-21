import crypto from 'crypto';
import type { NextFunction, Request, Response } from 'express';

const secureEquals = (provided: string, expected: string): boolean => {
  const providedBuffer = Buffer.from(provided);
  const expectedBuffer = Buffer.from(expected);
  return providedBuffer.length === expectedBuffer.length && crypto.timingSafeEqual(providedBuffer, expectedBuffer);
};

export const hasValidMakeIntegrationKey = (req: Request): boolean => {
  const configuredKey = process.env.MAKE_META_LEADS_API_KEY?.trim();
  if (!configuredKey) return false;

  const authorization = req.headers.authorization;
  const bearerKey = authorization?.startsWith('Bearer ') ? authorization.slice(7).trim() : '';
  const headerKey = req.headers['x-api-key'] || req.headers['x-make-apikey'];
  const providedKey = bearerKey || (Array.isArray(headerKey) ? headerKey[0] : headerKey) || '';
  return Boolean(providedKey) && secureEquals(providedKey, configuredKey);
};

export const authenticateMakeIntegration = (req: Request, res: Response, next: NextFunction): void => {
  const configuredKey = process.env.MAKE_META_LEADS_API_KEY?.trim();
  if (!configuredKey) {
    res.status(503).json({
      success: false,
      message: 'Make Meta lead integration is not configured',
    });
    return;
  }

  if (!hasValidMakeIntegrationKey(req)) {
    res.status(401).json({
      success: false,
      message: 'Invalid integration API key',
    });
    return;
  }

  next();
};
