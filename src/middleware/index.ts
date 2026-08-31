import { Request, Response, NextFunction } from 'express';
import rateLimit from 'express-rate-limit';
import { CorsOptions } from 'cors';
import jwt from 'jsonwebtoken';
import { hasValidMakeIntegrationKey } from './integrationAuth';

// Error handling middleware
export const errorHandler = (
  error: any,
  _req: Request,
  res: Response,
  _next: NextFunction
): void => {
  console.error('Error:', error);

  // Default error
  let status = 500;
  let message = 'Internal server error';
  let errors: string[] = [];

  // Mongoose validation error
  if (error.name === 'ValidationError') {
    status = 400;
    message = 'Validation error';
    errors = Object.values(error.errors).map((err: any) => err.message);
  }

  // Mongoose duplicate key error
  if (error.code === 11000) {
    status = 400;
    message = 'Duplicate field value';
    const field = Object.keys(error.keyValue)[0];
    errors = [`${field} already exists`];
  }

  // Mongoose cast error
  if (error.name === 'CastError') {
    status = 400;
    message = 'Invalid ID format';
    errors = ['Please provide a valid ID'];
  }

  // JWT error
  if (error.name === 'JsonWebTokenError') {
    status = 401;
    message = 'Invalid token';
    errors = ['Please provide a valid token'];
  }

  // JWT expired error
  if (error.name === 'TokenExpiredError') {
    status = 401;
    message = 'Token expired';
    errors = ['Please login again'];
  }

  // Multer error (file upload)
  if (error.code === 'LIMIT_FILE_SIZE') {
    status = 400;
    message = 'File too large';
    errors = ['Please upload a smaller file'];
  }

  if (error.code === 'LIMIT_FILE_COUNT') {
    status = 400;
    message = 'Too many files';
    errors = ['Please upload fewer files'];
  }

  if (error.code === 'LIMIT_UNEXPECTED_FILE') {
    status = 400;
    message = 'Unexpected file field';
    errors = ['Please check your file upload field'];
  }

  // Custom API errors
  if (error.statusCode) {
    status = error.statusCode;
    message = error.message;
    if (error.errors) {
      errors = Array.isArray(error.errors) ? error.errors : [error.errors];
    }
  }

  res.status(status).json({
    success: false,
    message,
    errors: errors.length > 0 ? errors : undefined,
    ...(process.env.NODE_ENV === 'development' && { stack: error.stack })
  });
};

// 404 handler
export const notFoundHandler = (req: Request, res: Response): void => {
  res.status(404).json({
    success: false,
    message: `Route ${req.originalUrl} not found`
  });
};

// Rate limiting
export const createRateLimiter = (windowMs: number, max: number) => {
  return rateLimit({
    windowMs,
    max,
    message: {
      success: false,
      message: 'Too many requests, please try again later'
    },
    standardHeaders: true,
    legacyHeaders: false,
    // Skip successful requests
    skipSuccessfulRequests: false,
    // Skip failed requests
    skipFailedRequests: false,
    // Skip rate limiting for logged-in users
    skip: (req: Request) => {
      try {
        if (hasValidMakeIntegrationKey(req)) {
          return true;
        }

        const authHeader = req.headers.authorization;
        if (!authHeader || !authHeader.startsWith('Bearer ')) {
          return false;
        }
        
        const token = authHeader.split(' ')[1];
        if (!token) {
          return false;
        }
        
        const secret = process.env.JWT_SECRET;
        if (!secret) {
          return false;
        }
        
        // Verify the JWT token
        const decoded = jwt.verify(token, secret);
        if (decoded) {
          // Log when rate limiting is skipped for authenticated users
          if (process.env.NODE_ENV === 'development') {
            console.log(`🚀 Rate limiting skipped for authenticated user on ${req.method} ${req.path}`);
          }
          return true;
        }
        return false;
      } catch (error) {
        // If token verification fails, don't skip rate limiting
        if (process.env.NODE_ENV === 'development') {
          console.log(`⚠️ Rate limiting applied - invalid token on ${req.method} ${req.path}`);
        }
        return false;
      }
    },
    // Custom handler for when limit is exceeded
    handler: (req: Request, res: Response): void => {
      console.log(`🚫 Rate limit exceeded for ${req.ip} on ${req.method} ${req.path}`);
      res.status(429).json({
        success: false,
        message: 'Too many requests from this IP, please try again later',
        retryAfter: Math.round(windowMs / 1000)
      });
    }
  });
};

// CORS options
export const corsOptions: CorsOptions = {
  origin: function (origin, callback) {
    // Allow requests with no origin (like mobile apps or Postman)
    if (!origin) return callback(null, true);
    
    const allowedOrigins = [
      'http://localhost:3000',
      'http://localhost:5173',
      'http://localhost:5174',
      'http://localhost:5175',
      'http://127.0.0.1:3000',
      'http://127.0.0.1:5173',
      'http://127.0.0.1:5174',
      'http://127.0.0.1:5175'
    ];

    // Add production origins from environment
    if (process.env.FRONTEND_URL) {
      allowedOrigins.push(process.env.FRONTEND_URL);
    }
     if (process.env.FRONTEND_URL_WWW) {
      allowedOrigins.push(process.env.FRONTEND_URL_WWW);
    } 

    const isLocalNetworkDevOrigin = /^https?:\/\/(localhost|127\.0\.0\.1|10\.\d{1,3}\.\d{1,3}\.\d{1,3}|172\.(1[6-9]|2\d|3[0-1])\.\d{1,3}\.\d{1,3}|192\.168\.\d{1,3}\.\d{1,3})(:\d+)?$/.test(origin);

    if (process.env.NODE_ENV === 'development') {
      // In development, allow all origins
      return callback(null, true);
    }

    if (allowedOrigins.indexOf(origin) !== -1 || isLocalNetworkDevOrigin) {
      callback(null, true);
    } else {
      callback(new Error('Not allowed by CORS'));
    }
  },
  credentials: true,
  methods: ['GET', 'POST', 'PUT', 'DELETE', 'PATCH', 'OPTIONS'],
  allowedHeaders: [
    'Origin',
    'X-Requested-With',
    'Content-Type',
    'Accept',
    'Authorization',
    'Cache-Control',
    'Pragma'
  ],
  exposedHeaders: ['X-Total-Count', 'X-Page-Count'],
  maxAge: 86400 // 24 hours
};

// Request logging middleware
export const requestLogger = (req: Request, res: Response, next: NextFunction): void => {
  const start = Date.now();
  
  res.on('finish', () => {
    const duration = Date.now() - start;
    const { method, originalUrl, ip } = req;
    const { statusCode } = res;
    
    console.log(`${method} ${originalUrl} ${statusCode} ${duration}ms - ${ip}`);
  });
  
  next();
};

// Body parser error handler
export const bodyParserErrorHandler = (
  error: any,
  _req: Request,
  res: Response,
  next: NextFunction
): void => {
  if (error instanceof SyntaxError && 'body' in error) {
    res.status(400).json({
      success: false,
      message: 'Invalid JSON in request body'
    });
    return;
  }
  next(error);
};

// Validate content type for API routes
export const validateContentType = (req: Request, res: Response, next: NextFunction): void => {
  if (['POST', 'PUT', 'PATCH'].includes(req.method)) {
    if (!req.is('application/json') && !req.is('multipart/form-data')) {
      res.status(400).json({
        success: false,
        message: 'Content-Type must be application/json or multipart/form-data'
      });
      return;
    }
  }
  next();
};

// Security headers middleware (additional to helmet)
export const securityHeaders = (_req: Request, res: Response, next: NextFunction): void => {
  // Prevent clickjacking
  res.setHeader('X-Frame-Options', 'DENY');
  
  // Prevent MIME type sniffing
  res.setHeader('X-Content-Type-Options', 'nosniff');
  
  // Enable XSS protection
  res.setHeader('X-XSS-Protection', '1; mode=block');
  
  // Referrer policy
  res.setHeader('Referrer-Policy', 'strict-origin-when-cross-origin');
  
  next();
};

// Health check endpoint
export const healthCheck = (_req: Request, res: Response): void => {
  res.status(200).json({
    success: true,
    message: 'Server is healthy',
    timestamp: new Date().toISOString(),
    uptime: process.uptime(),
    environment: process.env.NODE_ENV || 'development'
  });
};
