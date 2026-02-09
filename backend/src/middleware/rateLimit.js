import rateLimit from 'express-rate-limit';

/**
 * Rate limiter for store creation
 * Limits: 5 stores per hour per IP
 */
export const createStoreRateLimiter = rateLimit({
    windowMs: 60 * 60 * 1000, // 1 hour window
    max: 5, // Max 5 store creations per hour
    message: {
        success: false,
        error: 'Too many stores created from this IP. Maximum 5 stores per hour allowed. Please try again later.'
    },
    standardHeaders: true, // Return rate limit info in `RateLimit-*` headers
    legacyHeaders: false, // Disable `X-RateLimit-*` headers
    // Skip successful requests from counting (optional)
    skipSuccessfulRequests: false,
    // Skip failed requests from counting (optional)
    skipFailedRequests: false,
});

/**
 * Rate limiter for store deletion
 * Limits: 10 deletions per hour per IP
 */
export const deleteStoreRateLimiter = rateLimit({
    windowMs: 60 * 60 * 1000, // 1 hour window
    max: 10, // Max 10 store deletions per hour
    message: {
        success: false,
        error: 'Too many deletion requests from this IP. Maximum 10 deletions per hour allowed. Please try again later.'
    },
    standardHeaders: true,
    legacyHeaders: false,
});

/**
 * General API rate limiter
 * Limits: 100 requests per 15 minutes per IP
 */
export const apiRateLimiter = rateLimit({
    windowMs: 15 * 60 * 1000, // 15 minutes window
    max: 100, // Max 100 requests per 15 minutes
    message: {
        success: false,
        error: 'Too many requests from this IP. Please try again in 15 minutes.'
    },
    standardHeaders: true,
    legacyHeaders: false,
    // Skip rate limiting for localhost (development)
    skip: (req) => {
        const isLocalhost = req.ip === '127.0.0.1' ||
            req.ip === '::1' ||
            req.ip === '::ffff:127.0.0.1';
        return req.path === '/api/health' || isLocalhost;
    },
});

/**
 * Strict rate limiter for sensitive operations
 * Limits: 20 requests per 5 minutes per IP
 */
export const strictRateLimiter = rateLimit({
    windowMs: 5 * 60 * 1000, // 5 minutes window
    max: 20, // Max 20 requests per 5 minutes
    message: {
        success: false,
        error: 'Too many requests. Please slow down and try again in a few minutes.'
    },
    standardHeaders: true,
    legacyHeaders: false,
});
