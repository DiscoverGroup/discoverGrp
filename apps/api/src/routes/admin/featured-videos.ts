import { Router, Response } from 'express';
import multer from 'multer';
import { v2 as cloudinary } from 'cloudinary';
import { Readable } from 'stream';
import { requireAuth, requireRole, AuthenticatedRequest } from '../../middleware/auth';
import FeaturedVideo from '../../models/FeaturedVideo';

// Type for uploaded files (avoid Express namespace issues)
type UploadedFile = {
  buffer: Buffer;
  originalname: string;
  mimetype: string;
  size: number;
};

const router = Router();

// Configure Cloudinary
cloudinary.config({
  cloud_name: process.env.CLOUDINARY_CLOUD_NAME,
  api_key: process.env.CLOUDINARY_API_KEY,
  api_secret: process.env.CLOUDINARY_API_SECRET,
  secure: true,
});

// Configure multer for video and thumbnail uploads
const upload = multer({
  storage: multer.memoryStorage(),
  limits: {
    fileSize: 100 * 1024 * 1024, // 100MB for videos
  },
  fileFilter: (req, file, cb) => {
    const allowedMimes = [
      'image/jpeg',
      'image/jpg',
      'image/png',
      'image/webp',
      'video/mp4',
      'video/webm',
      'video/quicktime',
    ];
    
    if (allowedMimes.includes(file.mimetype)) {
      cb(null, true);
    } else {
      cb(new Error('Invalid file type'));
    }
  },
});

/**
 * Upload a file (video or image) to Cloudinary
 */
async function uploadToCloudinary(
  file: UploadedFile,
  folder: string
): Promise<string> {
  return new Promise((resolve, reject) => {
    const resourceType = file.mimetype.startsWith('video/') ? 'video' : 'image';
    const stream = cloudinary.uploader.upload_stream(
      { folder: `discovergrp/${folder}`, resource_type: resourceType },
      (error, result) => {
        if (error || !result) return reject(error ?? new Error('Cloudinary upload failed'));
        resolve(result.secure_url);
      }
    );
    Readable.from(file.buffer).pipe(stream);
  });
}

/**
 * GET /admin/featured-videos
 * List all featured videos
 */
router.get('/', requireAuth, requireRole('admin', 'super-admin'), async (req: AuthenticatedRequest, res: Response) => {
  try {
    const videos = await FeaturedVideo.find().sort({ display_order: 1, createdAt: -1 }).lean();
    
    const normalized = videos.map((video) => ({
      id: String(video._id),
      title: video.title,
      description: video.description,
      video_url: video.video_url,
      thumbnail_url: video.thumbnail_url,
      display_order: video.display_order,
      is_active: video.is_active,
      createdAt: video.createdAt,
      updatedAt: video.updatedAt,
    }));

    res.json({ success: true, videos: normalized });
  } catch (error) {
    console.error('Error fetching featured videos:', error);
    res.status(500).json({ error: 'Failed to fetch featured videos' });
  }
});

/**
 * POST /admin/featured-videos
 * Create new featured video (with file uploads)
 */
router.post(
  '/',
  requireAuth,
  requireRole('admin', 'super-admin'),
  upload.fields([
    { name: 'video', maxCount: 1 },
    { name: 'thumbnail', maxCount: 1 },
  ]),
  async (req: AuthenticatedRequest, res: Response): Promise<void> => {
    try {
      const { title, description, is_active, display_order } = req.body;
      const files = req.files as { [fieldname: string]: UploadedFile[] };

      if (!title) {
        res.status(400).json({ error: 'Title is required' });
        return;
      }

      if (!files || !files.video || files.video.length === 0) {
        res.status(400).json({ error: 'Video file is required' });
        return;
      }

      // Upload video
      const videoUrl = await uploadToCloudinary(files.video[0], 'homepage/videos');

      // Upload thumbnail if provided
      let thumbnailUrl: string | undefined;
      if (files.thumbnail && files.thumbnail.length > 0) {
        thumbnailUrl = await uploadToCloudinary(files.thumbnail[0], 'homepage/thumbnails');
      }

      // Create database record
      const video = new FeaturedVideo({
        title,
        description: description || undefined,
        video_url: videoUrl,
        thumbnail_url: thumbnailUrl,
        display_order: display_order ? parseInt(display_order as string, 10) : 0,
        is_active: is_active === 'true' || is_active === true,
      });

      await video.save();

      res.status(201).json({
        success: true,
        video: {
          id: String(video._id),
          title: video.title,
          description: video.description,
          video_url: video.video_url,
          thumbnail_url: video.thumbnail_url,
          display_order: video.display_order,
          is_active: video.is_active,
        },
      });
    } catch (error) {
      console.error('Error creating featured video:', error);
      res.status(500).json({ error: 'Failed to create featured video' });
    }
  }
);

/**
 * PUT /admin/featured-videos/:id
 * Update featured video metadata (no file upload)
 */
router.put('/:id', requireAuth, requireRole('admin', 'super-admin'), async (req: AuthenticatedRequest, res: Response) => {
  try {
    const { id } = req.params;
    const { title, description, is_active, display_order } = req.body;

    const video = await FeaturedVideo.findById(id);
    if (!video) {
      res.status(404).json({ error: 'Video not found' });
      return;
    }

    if (title) video.title = title as string;
    if (description !== undefined) video.description = description as string;
    if (is_active !== undefined) video.is_active = is_active as boolean;
    if (display_order !== undefined) video.display_order = parseInt(String(display_order), 10);

    await video.save();

    res.json({
      success: true,
      video: {
        id: String(video._id),
        title: video.title,
        description: video.description,
        video_url: video.video_url,
        thumbnail_url: video.thumbnail_url,
        display_order: video.display_order,
        is_active: video.is_active,
      },
    });
  } catch (error) {
    console.error('Error updating featured video:', error);
    res.status(500).json({ error: 'Failed to update featured video' });
  }
});

/**
 * DELETE /admin/featured-videos/:id
 * Delete featured video
 */
router.delete('/:id', requireAuth, requireRole('admin', 'super-admin'), async (req: AuthenticatedRequest, res: Response) => {
  try {
    const { id } = req.params;

    const video = await FeaturedVideo.findByIdAndDelete(id);
    if (!video) {
      res.status(404).json({ error: 'Video not found' });
      return;
    }

    // Note: Files remain in R2 storage. Add deletion logic if needed.
    res.json({ success: true, message: 'Video deleted successfully' });
  } catch (error) {
    console.error('Error deleting featured video:', error);
    res.status(500).json({ error: 'Failed to delete featured video' });
  }
});

export default router;
