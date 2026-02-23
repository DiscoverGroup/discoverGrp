import { Request, Response, NextFunction } from "express";
import User from "../models/User";
import logger from "../utils/logger";
import { verifyToken } from "./jwtHardening";

// Type for authenticated request - use intersection to ensure proper inheritance
export type AuthenticatedRequest = Request & {
  user?: {
    id: string;
    email: string;
    name?: string;
    fullName?: string;
    role: string;
  };
}

/**
 * Middleware to require authentication via JWT token.
 * Uses hardened JWT verification (algorithm whitelist, blacklist, device
 * fingerprint, iss/aud/sub enforcement) — replaces the raw jwt.verify call.
 * All 65+ route usages are automatically hardened by this single change.
 */
export async function requireAuth(req: AuthenticatedRequest, res: Response, next: NextFunction) {
  try {
    const authHeader = req.headers.authorization;
    
    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      return res.status(401).json({ error: 'Authentication required. No token provided.' });
    }
    
    const token = authHeader.split(' ')[1];
    
    // ─ Hardened verification: algorithm whitelist + blacklist + iss/aud/sub + device FP
    const result = verifyToken(token, 'access', req);

    if (!result.valid || !result.payload) {
      const reason = result.reason ?? 'VERIFICATION_FAILED';
      if (reason === 'TOKEN_EXPIRED') {
        logger.warn('Expired JWT token attempt');
        return res.status(401).json({ error: 'Token expired. Please login again.', code: reason });
      }
      logger.warn('Invalid JWT token attempt', { reason });
      return res.status(401).json({ error: 'Invalid token. Please login again.', code: reason });
    }

    const decoded = result.payload;
    
    // Fetch user from database to ensure they still exist and are active
    // decoded.sub holds the userId (set by issueAccessToken as payload.sub)
    const userId = decoded.sub ?? (decoded as Record<string, unknown>)['id'];
    const user = await User.findById(userId);
    
    if (!user) {
      return res.status(401).json({ error: 'User not found. Token invalid.' });
    }
    
    if (!user.isActive) {
      return res.status(403).json({ error: 'Account is inactive. Contact support.' });
    }
    
    if (user.isArchived) {
      return res.status(403).json({ error: 'Account is archived. Contact support.' });
    }
    
    // Attach user info to request
    req.user = {
      id: user._id.toString(),
      email: user.email,
      fullName: user.fullName,
      name: user.fullName,
      role: user.role,
    };
    
    next();
  } catch (error) {
    logger.error('Authentication error:', error);
    return res.status(500).json({ error: 'Authentication failed. Please try again.' });
  }
}

/**
 * Middleware to require admin role
 * Must be used AFTER requireAuth middleware
 */
export function requireAdmin(req: AuthenticatedRequest, res: Response, next: NextFunction) {
  if (!req.user) {
    return res.status(401).json({ error: 'Authentication required.' });
  }
  
  // Include all role name variants used across admin frontend and legacy seeds.
  const adminRoles = [
    'admin', 'superadmin',          // legacy names
    'super_admin', 'administrator', // current primary names
    'web_developer',                // dev role with full access
  ];
  
  if (!adminRoles.includes(req.user.role)) {
    logger.warn(`Unauthorized admin access attempt by user: ${req.user.email} (role: ${req.user.role})`);
    return res.status(403).json({ error: 'Access denied. Admin privileges required.' });
  }
  
  next();
}

/**
 * Middleware to require specific role(s)
 * Must be used AFTER requireAuth middleware
 */
export function requireRole(...allowedRoles: string[]) {
  return (req: AuthenticatedRequest, res: Response, next: NextFunction) => {
    if (!req.user) {
      return res.status(401).json({ error: 'Authentication required.' });
    }
    
    if (!allowedRoles.includes(req.user.role)) {
      logger.warn(`Unauthorized access attempt by user: ${req.user.email} (role: ${req.user.role}, required: ${allowedRoles.join(', ')})`);
      return res.status(403).json({ error: 'Access denied. Insufficient privileges.' });
    }
    
    next();
  };
}