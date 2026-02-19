import { buildApiUrl } from '../config/apiBase';

export interface FeaturedVideo {
  id: string;
  title: string;
  description?: string;
  video_url: string;
  thumbnail_url?: string;
  display_order?: number;
  is_active?: boolean;
}

export async function fetchFeaturedVideos(): Promise<FeaturedVideo[]> {
  try {
    const response = await fetch(buildApiUrl('/api/featured-videos'));
    if (!response.ok) {
      return [];
    }

    const data = await response.json();
    if (Array.isArray(data)) {
      return data as FeaturedVideo[];
    }

    if (Array.isArray(data?.videos)) {
      return data.videos as FeaturedVideo[];
    }

    return [];
  } catch (error) {
    console.error('Failed to fetch featured videos:', error);
    return [];
  }
}
