import { Router, Request, Response } from 'express';
import multer from 'multer';
import { v2 as cloudinary } from 'cloudinary';
import { requireAuth, requireAdmin, AuthenticatedRequest } from '../middleware/auth';
import { Readable } from 'stream';

const router = Router();

//  Cloudinary configuration 
cloudinary.config({
  cloud_name: process.env.CLOUDINARY_CLOUD_NAME,
  api_key: process.env.CLOUDINARY_API_KEY,
  api_secret: process.env.CLOUDINARY_API_SECRET,
  secure: true,
});

function isCloudinaryConfigured(): boolean {
  return !!(
    process.env.CLOUDINARY_CLOUD_NAME &&
    process.env.CLOUDINARY_API_KEY &&
    process.env.CLOUDINARY_API_SECRET
  );
}

function getErrorMessage(error: unknown): string {
  return error instanceof Error ? error.message : 'Upload failed';
}

/**
 * Upload a buffer to Cloudinary and return the secure URL.
 */
function uploadToCloudinary(
  buffer: Buffer,
  options: {
    folder: string;
    publicId?: string;
    resourceType?: 'image' | 'video' | 'raw' | 'auto';
    mimeType?: string;
  }
): Promise<{ url: string; publicId: string }> {
  return new Promise((resolve, reject) => {
    const uploadStream = cloudinary.uploader.upload_stream(
      {
        folder: options.folder,
        public_id: options.publicId,
        resource_type: options.mimeType === 'application/pdf' ? 'raw' : (options.resourceType ?? 'auto'),
      },
      (error, result) => {
        if (error || !result) return reject(error ?? new Error('Cloudinary upload failed'));
        resolve({ url: result.secure_url, publicId: result.public_id });
      }
    );
    Readable.from(buffer).pipe(uploadStream);
  });
}

//  Multer configs 

// Images + videos (admin only)
const upload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: 10 * 1024 * 1024 },
  fileFilter: (_req, file, cb) => {
    const allowed = [
      'image/jpeg', 'image/jpg', 'image/png', 'image/gif', 'image/webp',
      'video/mp4', 'video/webm', 'video/quicktime',
    ];
    if (allowed.includes(file.mimetype)) cb(null, true);
    else cb(new Error('Invalid file type. Only images and videos are allowed.'));
  },
});

// Documents (any authenticated user)
const uploadDocument = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: 10 * 1024 * 1024 },
  fileFilter: (_req, file, cb) => {
    const allowed = ['application/pdf', 'image/jpeg', 'image/jpg', 'image/png', 'image/webp'];
    if (allowed.includes(file.mimetype)) cb(null, true);
    else cb(new Error('Invalid file type. Only PDF and images are allowed.'));
  },
});

//  Routes 

/**
 * Upload a single image/video to Cloudinary.
 * Admin only.
 */
router.post(
  '/single',
  requireAuth,
  requireAdmin,
  upload.single('file'),
  async (req: AuthenticatedRequest, res: Response): Promise<void> => {
    try {
      if (!req.file) {
        res.status(400).json({ error: 'No file uploaded' });
        return;
      }

      if (!isCloudinaryConfigured()) {
        res.status(503).json({ error: 'Storage not configured', message: 'Set CLOUDINARY_CLOUD_NAME, CLOUDINARY_API_KEY, CLOUDINARY_API_SECRET.' });
        return;
      }

      const { folder = 'uploads', label = '' } = req.body as { folder?: string; label?: string };
      const cloudFolder = `discovergrp/${folder}`;
      const publicId = label ? `${label}-${Date.now()}` : undefined;

      const { url, publicId: cloudPublicId } = await uploadToCloudinary(req.file.buffer, {
        folder: cloudFolder,
        publicId,
        mimeType: req.file.mimetype,
      });

      console.log('[Cloudinary Upload] Success:', { cloudPublicId, size: req.file.size, type: req.file.mimetype });
      res.json({ success: true, url, publicId: cloudPublicId, size: req.file.size, type: req.file.mimetype });
    } catch (error: unknown) {
      console.error('[Cloudinary Upload] Error:', error);
      res.status(500).json({ error: 'Upload failed', message: getErrorMessage(error) });
    }
  }
);

/**
 * Upload multiple images/videos to Cloudinary.
 * Admin only.
 */
router.post(
  '/multiple',
  requireAuth,
  requireAdmin,
  upload.array('files', 10),
  async (req: AuthenticatedRequest, res: Response): Promise<void> => {
    try {
      const files = req.files as Express.Multer.File[];
      if (!files?.length) {
        res.status(400).json({ error: 'No files uploaded' });
        return;
      }

      if (!isCloudinaryConfigured()) {
        res.status(503).json({ error: 'Storage not configured', message: 'Set CLOUDINARY_CLOUD_NAME, CLOUDINARY_API_KEY, CLOUDINARY_API_SECRET.' });
        return;
      }

      const { folder = 'uploads', label = '' } = req.body as { folder?: string; label?: string };
      const cloudFolder = `discovergrp/${folder}`;

      const results = await Promise.all(
        files.map(async (file, index) => {
          const publicId = label ? `${label}-${index + 1}-${Date.now()}` : undefined;
          const { url, publicId: cloudPublicId } = await uploadToCloudinary(file.buffer, {
            folder: cloudFolder,
            publicId,
            mimeType: file.mimetype,
          });
          return { url, publicId: cloudPublicId, size: file.size, type: file.mimetype };
        })
      );

      console.log('[Cloudinary Upload Multiple] Success:', { count: results.length });
      res.json({ success: true, files: results, count: results.length });
    } catch (error: unknown) {
      console.error('[Cloudinary Upload Multiple] Error:', error);
      res.status(500).json({ error: 'Upload failed', message: getErrorMessage(error) });
    }
  }
);

/**
 * Upload a travel document (passport / visa copy) to Cloudinary.
 * Accessible to any authenticated user.
 * Accepts: PDF, JPEG, PNG, WebP  max 10 MB.
 *
 * When Cloudinary is not yet configured the route returns a stub success
 * response so the booking flow can continue uninterrupted.
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

      const docType = (req.body as { type?: string }).type || 'passport';
      if (!['passport', 'visa'].includes(docType)) {
        res.status(400).json({ error: 'Invalid document type. Use "passport" or "visa".' });
        return;
      }

      const userId = req.user?.id || 'guest';

      //  Graceful fallback when Cloudinary is not yet configured 
      if (!isCloudinaryConfigured()) {
        const stubFileName = `documents/${docType}s/${userId}/${Date.now()}.stub`;
        console.warn('[Cloudinary Document Upload] Not configured  returning stub URL.', {
          docType, userId, size: req.file.size,
        });
        res.json({
          success: true,
          url: `/uploads/stub/${stubFileName}`,
          publicId: stubFileName,
          size: req.file.size,
          type: req.file.mimetype,
          stub: true,
        });
        return;
      }

      const { url, publicId } = await uploadToCloudinary(req.file.buffer, {
        folder: `discovergrp/documents/${docType}s/${userId}`,
        mimeType: req.file.mimetype,
      });

      console.log('[Cloudinary Document Upload] Success:', { docType, publicId, userId, size: req.file.size });
      res.json({ success: true, url, publicId, size: req.file.size, type: req.file.mimetype });
    } catch (error: unknown) {
      console.error('[Cloudinary Document Upload] Error:', error);
      res.status(500).json({ error: 'Upload failed', message: getErrorMessage(error) });
    }
  }
);

/**
 * Health check  reports Cloudinary configuration status.
 */
router.get('/health', (_req: Request, res: Response) => {
  res.json({
    status: isCloudinaryConfigured() ? 'ready' : 'not-configured',
    provider: 'cloudinary',
    cloudName: process.env.CLOUDINARY_CLOUD_NAME || 'not-set',
  });
});

export default router;
