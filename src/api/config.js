export const LIVE_URL = 'https://datingapp-backend-api.vercel.app';

/**
 * Candidate URLs used in Development mode:
 * - USB Debugging: 'http://localhost:5000'
 * - Local Wi-Fi Network: 'http://10.0.3.64:5000'
 * - Android Emulator: 'http://10.0.2.2:5000'
 * - Live Production Fallback: LIVE_URL
 */
export const CANDIDATE_URLS = typeof __DEV__ !== 'undefined' && __DEV__
  ? [
      'http://localhost:5000',
      'http://10.0.3.64:5000',
      'http://10.0.2.2:5000',
      LIVE_URL,
    ]
  : [LIVE_URL];

let workingBaseUrl = (typeof __DEV__ !== 'undefined' && __DEV__)
  ? 'http://localhost:5000'
  : LIVE_URL;

export const getBaseUrl = () => workingBaseUrl;

export const setBaseUrl = (url) => {
  workingBaseUrl = url;
};

// Export BASE_URL function/getter or fallback to getBaseUrl()
export const BASE_URL = LIVE_URL;

export const getImageUrl = (url) => {
  if (!url) return '';
  if (
    typeof url !== 'string' ||
    url.startsWith('http://') ||
    url.startsWith('https://') ||
    url.startsWith('file://') ||
    url.startsWith('content://') ||
    url.startsWith('data:')
  ) {
    return url;
  }
  const currentBase = getBaseUrl();
  if (url.startsWith('/')) {
    return `${currentBase}${url}`;
  }
  return `${currentBase}/${url}`;
};

export const isVideoUrl = (url) => {
  if (!url || typeof url !== 'string') return false;
  const lower = url.toLowerCase();
  return (
    lower.endsWith('.mp4') ||
    lower.endsWith('.mov') ||
    lower.endsWith('.webm') ||
    lower.endsWith('.3gp') ||
    lower.endsWith('.mkv') ||
    lower.includes('/video/upload/') ||
    lower.includes('video')
  );
};

export const getVideoThumbnailUrl = (url) => {
  if (!url) return '';
  const fullUrl = getImageUrl(url);
  if (typeof fullUrl !== 'string') return fullUrl;

  const lower = fullUrl.toLowerCase();
  if (lower.includes('/video/upload/')) {
    // Transform Cloudinary video URL into a JPG video thumbnail frame
    let thumbnailUrl = fullUrl.replace('/video/upload/', '/video/upload/so_0,f_jpg/');
    if (/\.(mp4|mov|webm|3gp|mkv)($|\?)/i.test(thumbnailUrl)) {
      thumbnailUrl = thumbnailUrl.replace(/\.(mp4|mov|webm|3gp|mkv)($|\?)/i, '.jpg$2');
    } else if (!thumbnailUrl.endsWith('.jpg') && !thumbnailUrl.endsWith('.jpeg')) {
      thumbnailUrl = `${thumbnailUrl}.jpg`;
    }
    return thumbnailUrl;
  }
  return fullUrl;
};
