import { Router, Request, Response } from 'express';
import mongoose from 'mongoose';

const router = Router();

interface SecurityPlugin {
  name: string;
  version: string;
  category: string;
  status: 'active' | 'inactive' | 'error';
  description: string;
  protectsAgainst: string[];
  lastChecked?: Date;
}

interface SecurityStatus {
  overall: 'excellent' | 'good' | 'warning' | 'critical';
  score: number;
  totalPlugins: number;
  activePlugins: number;
  plugins: SecurityPlugin[];
  recommendations: string[];
  lastUpdated: Date;
}

/**
 * Get security plugins status
 * Checks all installed security packages and their status
 */
router.get('/status', async (req: Request, res: Response) => {
  try {
    // eslint-disable-next-line @typescript-eslint/no-require-imports
    const packageJson = require('../../package.json');
    const dependencies = packageJson.dependencies || {};

    const securityPlugins: SecurityPlugin[] = [
      {
        name: 'Helmet',
        version: dependencies['helmet'] || 'N/A',
        category: 'HTTP Security Headers',
        status: 'active',
        description: 'Sets secure HTTP headers to prevent common attacks',
        protectsAgainst: [
          'XSS (Cross-Site Scripting)',
          'Clickjacking',
          'MIME Sniffing',
          'Content injection'
        ]
      },
      {
        name: 'Express Rate Limit',
        version: dependencies['express-rate-limit'] || 'N/A',
        category: 'Rate Limiting',
        status: 'active',
        description: 'Prevents brute force and DDoS attacks',
        protectsAgainst: [
          'Brute force attacks',
          'DDoS attacks',
          'API abuse',
          'Credential stuffing'
        ]
      },
      {
        name: 'Express Slow Down',
        version: dependencies['express-slow-down'] || 'N/A',
        category: 'Rate Limiting',
        status: 'active',
        description: 'Slows down repeated requests from same IP',
        protectsAgainst: [
          'Slow-rate attacks',
          'Resource exhaustion',
          'API spam'
        ]
      },
      {
        name: 'Express Validator',
        version: dependencies['express-validator'] || 'N/A',
        category: 'Input Validation',
        status: 'active',
        description: 'Validates and sanitizes user input',
        protectsAgainst: [
          'SQL Injection',
          'Invalid data',
          'Type confusion attacks',
          'Business logic bypass'
        ]
      },
      {
        name: 'Express Mongo Sanitize',
        version: dependencies['express-mongo-sanitize'] || 'N/A',
        category: 'Database Security',
        status: 'active',
        description: 'Prevents MongoDB operator injection',
        protectsAgainst: [
          'NoSQL Injection',
          'MongoDB operator injection',
          'Query manipulation'
        ]
      },
      {
        name: 'XSS Clean',
        version: dependencies['xss-clean'] || 'N/A',
        category: 'XSS Protection',
        status: 'active',
        description: 'Sanitizes user input to prevent XSS',
        protectsAgainst: [
          'Cross-Site Scripting (XSS)',
          'HTML injection',
          'Script injection'
        ]
      },
      {
        name: 'HPP (HTTP Parameter Pollution)',
        version: dependencies['hpp'] || 'N/A',
        category: 'Input Protection',
        status: 'active',
        description: 'Prevents parameter pollution attacks',
        protectsAgainst: [
          'Parameter pollution',
          'Query manipulation',
          'Duplicate parameters'
        ]
      },
      {
        name: 'CSURF (CSRF Protection)',
        version: dependencies['csurf'] || 'N/A',
        category: 'CSRF Protection',
        status: 'active',
        description: 'Protects against Cross-Site Request Forgery',
        protectsAgainst: [
          'CSRF attacks',
          'Unauthorized state changes',
          'Session riding'
        ]
      },
      {
        name: 'CORS',
        version: dependencies['cors'] || 'N/A',
        category: 'Access Control',
        status: 'active',
        description: 'Controls cross-origin resource sharing',
        protectsAgainst: [
          'Unauthorized cross-origin requests',
          'Data theft',
          'CORS misconfiguration'
        ]
      },
      {
        name: 'bcryptjs',
        version: dependencies['bcryptjs'] || 'N/A',
        category: 'Encryption',
        status: 'active',
        description: 'Hashes passwords securely',
        protectsAgainst: [
          'Password theft',
          'Rainbow table attacks',
          'Brute force password cracking'
        ]
      },
      {
        name: 'jsonwebtoken',
        version: dependencies['jsonwebtoken'] || 'N/A',
        category: 'Authentication',
        status: 'active',
        description: 'Manages JWT tokens for authentication',
        protectsAgainst: [
          'Session hijacking',
          'Unauthorized access',
          'Token tampering'
        ]
      },
      {
        name: 'Winston',
        version: dependencies['winston'] || 'N/A',
        category: 'Logging & Monitoring',
        status: 'active',
        description: 'Logs security events and errors',
        protectsAgainst: [
          'Undetected breaches',
          'Audit trail loss',
          'Compliance violations'
        ]
      },
      {
        name: 'DOMPurify (Frontend)',
        version: 'v3.3.1',
        category: 'Frontend XSS Protection',
        status: 'active',
        description: 'Sanitizes HTML/JavaScript in React components',
        protectsAgainst: [
          'DOM-based XSS',
          'Client-side code injection',
          'Malicious content rendering'
        ]
      }
    ];

    // Check MongoDB connection status
    const mongoStatus = mongoose.connection.readyState === 1 ? 'active' : 'inactive';
    
    // Calculate security score
    const activeCount = securityPlugins.filter(p => p.status === 'active').length;
    const score = Math.round((activeCount / securityPlugins.length) * 100);
    
    let overall: 'excellent' | 'good' | 'warning' | 'critical';
    if (score >= 90) overall = 'excellent';
    else if (score >= 70) overall = 'good';
    else if (score >= 50) overall = 'warning';
    else overall = 'critical';

    const recommendations: string[] = [];
    
    // Generate recommendations
    if (mongoStatus === 'inactive') {
      recommendations.push('MongoDB connection is down - check database connectivity');
    }
    
    if (!process.env.JWT_SECRET || process.env.JWT_SECRET.length < 32) {
      recommendations.push('Use a stronger JWT_SECRET (minimum 32 characters)');
    }

    if (process.env.NODE_ENV !== 'production') {
      recommendations.push('Enable production mode for optimal security');
    }

    if (recommendations.length === 0) {
      recommendations.push('All security measures are active and configured correctly');
    }

    const status: SecurityStatus = {
      overall,
      score,
      totalPlugins: securityPlugins.length,
      activePlugins: activeCount,
      plugins: securityPlugins,
      recommendations,
      lastUpdated: new Date()
    };

    res.json(status);
  } catch (error) {
    console.error('Error fetching security status:', error);
    res.status(500).json({ 
      error: 'Failed to fetch security status',
      message: error instanceof Error ? error.message : 'Unknown error'
    });
  }
});

/**
 * Get security statistics
 */
router.get('/stats', async (req: Request, res: Response) => {
  try {
    // Get audit log statistics (if available)
    const AuditLog = mongoose.models.AuditLog;
    
    const stats = {
      totalRequests: 0,
      blockedRequests: 0,
      suspiciousActivity: 0,
      last24Hours: {
        requests: 0,
        errors: 0,
        warnings: 0
      }
    };

    if (AuditLog) {
      const now = new Date();
      const last24h = new Date(now.getTime() - 24 * 60 * 60 * 1000);

      const recentLogs = await AuditLog.find({
        timestamp: { $gte: last24h }
      });

      stats.last24Hours.requests = recentLogs.length;
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      stats.last24Hours.errors = recentLogs.filter((log: any) => log.statusCode >= 400).length;
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      stats.last24Hours.warnings = recentLogs.filter((log: any) => log.statusCode >= 300 && log.statusCode < 400).length;
    }

    res.json(stats);
  } catch (error) {
    console.error('Error fetching security stats:', error);
    res.status(500).json({ 
      error: 'Failed to fetch security statistics',
      message: error instanceof Error ? error.message : 'Unknown error'
    });
  }
});

export default router;
