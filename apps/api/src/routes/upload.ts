import { Router, Request, Response } from 'express';
import multer from 'multer';
import { S3Client, PutObjectCommand } from '@aws-sdk/client-s3';
import { requireAuth, requireRole, AuthenticatedRequest } from '../middleware/auth';
import crypto from 'crypto';
import path from 'path';

const router = Router();

// Configure Cloudflare R2 client (S3-compatible)
const r2Client = new S3Client({
  region: 'auto',
  endpoint: process.env.R2_ENDPOINT,
  credentials: {
    accessKeyId: process.env.R2_ACCESS_KEY_ID || '',
    secretAccessKey: process.env.R2_SECRET_ACCESS_KEY || '',
  },
});

const R2_BUCKET = process.env.R2_BUCKET_NAME || '';
const R2_PUBLIC_URL = process.env.R2_PUBLIC_URL || '';

function getErrorMessage(error: unknown): string {
  return error instanceof Error ? error.message : 'Upload failed';
}

// Configure multer for memory storage (images + videos — admin only)
const upload = multer({
  storage: multer.memoryStorage(),
  limits: {
    fileSize: 10 * 1024 * 1024, // 10MB limit
  },
  fileFilter: (req, file, cb) => {
    // Allow images and videos
    const allowedMimes = [
      'image/jpeg',
      'image/jpg',
      'image/png',
      'image/gif',
      'image/webp',
      'video/mp4',
      'video/webm',
      'video/quicktime',
    ];
    
    if (allowedMimes.includes(file.mimetype)) {
      cb(null, true);
    } else {
      cb(new Error('Invalid file type. Only images and videos are allowed.'));
    }
  },
});

// Configure multer for document uploads (PDF + images — any authenticated user)
const uploadDocument = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: 10 * 1024 * 1024 }, // 10MB
  fileFilter: (_req, file, cb) => {
    const allowedMimes = [
      'application/pdf',
      'image/jpeg',
      'image/jpg',
      'image/png',
      'image/webp',
    ];
    if (allowedMimes.includes(file.mimetype)) {
      cb(null, true);
    } else {
      cb(new Error('Invalid file type. Only PDF and images are allowed.'));
    }
  },
});

/**
 * Upload single file to Cloudflare R2
 * Protected route - requires authentication and admin role
 */
router.post(
  '/single',
  requireAuth,
  requireRole('admin', 'super-admin'),
  upload.single('file'),
  async (req: AuthenticatedRequest, res: Response): Promise<void> => {
    try {
      if (!req.file) {
        res.status(400).json({ error: 'No file uploaded' });
        return;
      }

      const { folder = 'uploads', label = '' } = req.body;
      
      // Generate unique filename
      const fileExt = path.extname(req.file.originalname);
      const randomName = crypto.randomBytes(16).toString('hex');
      const timestamp = Date.now();
      const fileName = label 
        ? `${folder}/${label}-${timestamp}-${randomName}${fileExt}`
        : `${folder}/${timestamp}-${randomName}${fileExt}`;

      // Upload to R2
      const command = new PutObjectCommand({
        Bucket: R2_BUCKET,
        Key: fileName,
        Body: req.file.buffer,
        ContentType: req.file.mimetype,
        // Make objects publicly readable
        // Note: R2 bucket must have public access enabled
      });

      await r2Client.send(command);

      // Construct public URL
      const publicUrl = `${R2_PUBLIC_URL}/${fileName}`;

      console.log('[R2 Upload] Success:', {
        fileName,
        size: req.file.size,
        type: req.file.mimetype,
        url: publicUrl,
      });

      res.json({
        success: true,
        url: publicUrl,
        fileName,
        size: req.file.size,
        type: req.file.mimetype,
      });
    } catch (error: unknown) {
      console.error('[R2 Upload] Error:', error);
      res.status(500).json({
        error: 'Upload failed',
        message: getErrorMessage(error),
      });
    }
  }
);

/**
 * Upload multiple files to Cloudflare R2
 * Protected route - requires authentication and admin role
 */
router.post(
  '/multiple',
  requireAuth,
  requireRole('admin', 'super-admin'),
  upload.array('files', 10), // Max 10 files
  async (req: AuthenticatedRequest, res: Response): Promise<void> => {
    try {
      const files = req.files as Array<{
        buffer: Buffer;
        originalname: string;
        mimetype: string;
        size: number;
      }>;
      
      if (!files || files.length === 0) {
        res.status(400).json({ error: 'No files uploaded' });
        return;
      }

      const { folder = 'uploads', label = '' } = req.body;
      
      const uploadPromises = files.map(async (file, index) => {
        const fileExt = path.extname(file.originalname);
        const randomName = crypto.randomBytes(16).toString('hex');
        const timestamp = Date.now();
        const fileName = label 
          ? `${folder}/${label}-${index + 1}-${timestamp}-${randomName}${fileExt}`
          : `${folder}/${timestamp}-${randomName}${fileExt}`;

        const command = new PutObjectCommand({
          Bucket: R2_BUCKET,
          Key: fileName,
          Body: file.buffer,
          ContentType: file.mimetype,
        });

        await r2Client.send(command);

        return {
          url: `${R2_PUBLIC_URL}/${fileName}`,
          fileName,
          size: file.size,
          type: file.mimetype,
        };
      });

      const results = await Promise.all(uploadPromises);

      console.log('[R2 Upload Multiple] Success:', {
        count: results.length,
        totalSize: results.reduce((sum, r) => sum + r.size, 0),
      });

      res.json({
        success: true,
        files: results,
        count: results.length,
      });
    } catch (error: unknown) {
      console.error('[R2 Upload Multiple] Error:', error);
      res.status(500).json({
        error: 'Upload failed',
        message: getErrorMessage(error),
      });
    }
  }
);

/**
 * Upload a travel document (passport / visa copy) to Cloudflare R2.
 * Accessible to ANY authenticated user (not just admins).
 * Accepts: PDF, JPEG, PNG, WebP — max 10 MB.
 * Files go to: documents/{type}/{userId}/{timestamp}-{random}.ext
 */
router.post(
  '/document',
  requireAuth,
  uploadDocument.single('file'),
  async (req: AuthenticatedRequest, res: Response): Promise<void> => {
    try {
      if (!req.file) {
        res.status(400).json({ error: 'No file uploaded' });
        return;
      }

      // type: 'passport' | 'visa' (defaults to 'passport')
      const docType = (req.body.type as string) || 'passport';
      if (!['passport', 'visa'].includes(docType)) {
        res.status(400).json({ error: 'Invalid document type. Use "passport" or "visa".' });
        return;
      }

      const userId = req.user?.id || 'guest';
      const fileExt = path.extname(req.file.originalname);
      const randomName = crypto.randomBytes(16).toString('hex');
      const timestamp = Date.now();
      const fileName = `documents/${docType}s/${userId}/${timestamp}-${randomName}${fileExt}`;

      const command = new PutObjectCommand({
        Bucket: R2_BUCKET,
        Key: fileName,
        Body: req.file.buffer,
        ContentType: req.file.mimetype,
      });

      await r2Client.send(command);

      const publicUrl = `${R2_PUBLIC_URL}/${fileName}`;

      console.log('[R2 Document Upload] Success:', { docType, fileName, userId, size: req.file.size });

      res.json({
        success: true,
        url: publicUrl,
        fileName,
        size: req.file.size,
        type: req.file.mimetype,
      });
    } catch (error: unknown) {
      console.error('[R2 Document Upload] Error:', error);
      res.status(500).json({
        error: 'Upload failed',
        message: getErrorMessage(error),
      });
    }
  }
);

/**
 * Health check endpoint
 */
router.get('/health', (req: Request, res: Response) => {
  const configured = !!(
    process.env.R2_ENDPOINT &&
    process.env.R2_ACCESS_KEY_ID &&
    process.env.R2_SECRET_ACCESS_KEY &&
    process.env.R2_BUCKET_NAME &&
    process.env.R2_PUBLIC_URL
  );

  res.json({
    status: configured ? 'ready' : 'not-configured',
    bucket: R2_BUCKET || 'not-set',
    endpoint: process.env.R2_ENDPOINT ? 'configured' : 'not-set',
  });
});

export default router;
