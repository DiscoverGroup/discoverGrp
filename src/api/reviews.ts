import { buildApiUrl } from '../config/apiBase';

const DEFAULT_TIMEOUT_MS = 8000;

async function fetchWithTimeout(input: RequestInfo | URL, init: RequestInit = {}, timeoutMs: number = DEFAULT_TIMEOUT_MS): Promise<Response> {
  const controller = new AbortController();
  const timeout = window.setTimeout(() => controller.abort(), timeoutMs);

  try {
    return await fetch(input, {
      ...init,
      signal: controller.signal,
    });
  } finally {
    window.clearTimeout(timeout);
  }
}

export interface Review {
  _id?: string;
  name: string;
  tourSlug?: string;
  tourTitle?: string;
  rating: number;
  comment: string;
  isApproved: boolean;
  createdAt?: string;
}

export async function submitReview(review: Omit<Review, '_id' | 'isApproved' | 'createdAt'>) {
  const response = await fetch(buildApiUrl('/api/reviews'), {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(review),
  });
  if (!response.ok) throw new Error('Failed to submit review');
  return response.json();
}

export async function fetchApprovedReviews() {
  const response = await fetchWithTimeout(buildApiUrl('/api/reviews/approved'));
  if (!response.ok) throw new Error('Failed to fetch approved reviews');
  return response.json();
}

export async function fetchAllReviews() {
  const response = await fetch(buildApiUrl('/api/reviews'));
  if (!response.ok) throw new Error('Failed to fetch reviews');
  return response.json();
}

export async function approveReview(reviewId: string) {
  const response = await fetch(buildApiUrl(`/api/reviews/${reviewId}/approve`), {
    method: 'PATCH',
  });
  if (!response.ok) throw new Error('Failed to approve review');
  return response.json();
}

export async function deleteReview(reviewId: string) {
  const response = await fetch(buildApiUrl(`/api/reviews/${reviewId}`), {
    method: 'DELETE',
  });
  if (!response.ok) throw new Error('Failed to delete review');
  return response.json();
}

export async function fetchTourReviewStats(tourSlug: string) {
  try {
    const response = await fetchWithTimeout(buildApiUrl(`/api/reviews/tour/${tourSlug}`), {}, 5000);
    if (!response.ok) {
      console.warn(`Failed to fetch review stats for ${tourSlug}: ${response.status}`);
      return { averageRating: 0, totalReviews: 0 };
    }
    const data = await response.json();
    return data.stats;
  } catch (error) {
    console.warn(`Failed to fetch review stats for ${tourSlug}:`, error);
    return { averageRating: 0, totalReviews: 0 };
  }
}
