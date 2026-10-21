import { Platform } from 'react-native';

export const LIVE_URL = 'https://datingapp-backend-api.vercel.app';
export const LOCAL_URL = 'http://localhost:5000';
export const EMULATOR_URL = 'http://10.0.2.2:5000';
export const NETWORK_URL = 'http://10.0.2.156:5000';
export const HOTSPOT_URL = 'http://192.168.137.1:5000';

export const STRIPE_PUBLISHABLE_KEY = 'pk_test_51UIPtESNVBh57Ub9dg7BgWRA8KgUvVfkFtyov0Etl0OCG3Uh3Xjrj39wr5C3FhO60Zes39Ioi9kDAROGYP3PPqpD00oCTzeHvY';

export const SUBSCRIPTION_PLANS = {
  GOLD: {
    productId: 'prod_VJ21gIU9Hsv76n',
    priceId: 'price_1UIPxoSNVBh57Ub94bpA7rtZ',
    type: 'Gold',
  },
  PREMIUM: {
    productId: 'prod_VJ211jsXBEFLpr',
    priceId: 'price_1UIPxESNVBh57Ub9JgqAyuuy',
    type: 'Premium',
  },
};

/**
 * Candidate URLs used in Development mode:
 * - USB/ADB Reverse Debugging: 'http://localhost:5000'
 * - Mobile Hotspot Loopback: 'http://192.168.137.1:5000'
 * - Local Wi-Fi Network: 'http://10.0.2.156:5000'
 * - Android Emulator Host Loopback: 'http://10.0.2.2:5000'
 * - Live Production Fallback: LIVE_URL
 */
export const CANDIDATE_URLS = __DEV__
  ? [LOCAL_URL, HOTSPOT_URL, NETWORK_URL, EMULATOR_URL, LIVE_URL]
  : [LIVE_URL, HOTSPOT_URL, NETWORK_URL, LOCAL_URL];

// Default to LOCAL_URL (http://localhost:5000) with ADB reverse in DEV, LIVE_URL in production APK
let workingBaseUrl = __DEV__ ? LOCAL_URL : LIVE_URL;


export const getBaseUrl = () => workingBaseUrl;

export const setBaseUrl = (url) => {
  workingBaseUrl = url;
};

export const BASE_URL = getBaseUrl();

export const get15SecVideoUrl = (url) => {
  if (!url || typeof url !== 'string') return url;
  const lower = url.toLowerCase();

  // Strictly do NOT transform voice notes, audio files, chat media, or sound streams into H264 video
  if (
    lower.includes('voice_') ||
    lower.includes('dating_app_chat_media') ||
    lower.includes('/api/chat/') ||
    lower.includes('/chat/media/') ||
    lower.includes('/uploads/') ||
    /\.(mp3|m4a|wav|aac|ogg|opus)($|\?|#)/i.test(lower)
  ) {
    return url;
  }

  if (lower.includes('cloudinary.com') && (lower.includes('/video/upload/') || lower.includes('/video/'))) {
    if (!url.includes('/so_0,eo_15/') && !url.includes('/eo_15/') && !url.includes('/du_15/')) {
      return url.replace(/\/video\/upload\/(?:[a-zA-Z0-9_,-]+\/)?/, '/video/upload/so_0,eo_15,q_auto,vc_h264/');
    }
  }
  return url;
};

export const getAudioUrl = (url) => {
  if (!url || typeof url !== 'string' || url.trim() === '') return '';
  let resolvedUrl = url.trim();

  // Strip any video transformations that may have been accidentally applied to an audio URL
  if (resolvedUrl.includes('cloudinary.com') && resolvedUrl.includes('/video/upload/')) {
    resolvedUrl = resolvedUrl.replace(
      /\/video\/upload\/(?:so_0,eo_15,q_auto,vc_h264|eo_15,vc_h264|so_0,eo_15|eo_15|du_15|q_auto,vc_h264|vc_h264)\//,
      '/video/upload/'
    );
  }

  const currentBase = getBaseUrl();

  // Prepend currentBase if relative URL (e.g. /uploads/... or /api/chat/media/...)
  if (
    !resolvedUrl.startsWith('http://') &&
    !resolvedUrl.startsWith('https://') &&
    !resolvedUrl.startsWith('file://') &&
    !resolvedUrl.startsWith('content://') &&
    !resolvedUrl.startsWith('data:')
  ) {
    resolvedUrl = resolvedUrl.startsWith('/') ? `${currentBase}${resolvedUrl}` : `${currentBase}/${resolvedUrl}`;
  }

  // Rewrite localhost or internal host loopbacks to current active backend base URL
  if (
    resolvedUrl.includes('localhost:5000') ||
    resolvedUrl.includes('127.0.0.1:5000') ||
    resolvedUrl.includes('10.0.2.2:5000')
  ) {
    resolvedUrl = resolvedUrl.replace(/http:\/\/(localhost|127\.0\.0\.1|10\.0\.2\.2):5000/, currentBase);
  }

  // Force HTTPS for Vercel URLs to prevent redirects and cleartext blocks
  if (resolvedUrl.includes('vercel.app') && resolvedUrl.startsWith('http://')) {
    resolvedUrl = resolvedUrl.replace('http://', 'https://');
  }

  return resolvedUrl;
};

export const getImageUrl = (url) => {
  if (!url || typeof url !== 'string' || url.trim() === '') return '';
  let resolvedUrl = url.trim();

  const currentBase = getBaseUrl();

  // Prepend currentBase if relative URL (e.g. /uploads/... or /api/chat/media/...)
  if (
    !resolvedUrl.startsWith('http://') &&
    !resolvedUrl.startsWith('https://') &&
    !resolvedUrl.startsWith('file://') &&
    !resolvedUrl.startsWith('content://') &&
    !resolvedUrl.startsWith('data:')
  ) {
    resolvedUrl = resolvedUrl.startsWith('/') ? `${currentBase}${resolvedUrl}` : `${currentBase}/${resolvedUrl}`;
  }

  // Rewrite localhost or internal host loopbacks to the current active backend base URL
  // (Prevents connection refused on physical Android devices and emulators)
  if (
    resolvedUrl.includes('localhost:5000') ||
    resolvedUrl.includes('127.0.0.1:5000') ||
    resolvedUrl.includes('10.0.2.2:5000')
  ) {
    resolvedUrl = resolvedUrl.replace(/http:\/\/(localhost|127\.0\.0\.1|10\.0\.2\.2):5000/, currentBase);
  }

  // Force HTTPS for Vercel URLs to prevent 308 redirects and Android cleartext policy blocks
  if (resolvedUrl.includes('vercel.app') && resolvedUrl.startsWith('http://')) {
    resolvedUrl = resolvedUrl.replace('http://', 'https://');
  }

  // Only apply 15s video trim if it's a Cloudinary video and definitely NOT an audio file or chat media
  const lowerResolved = resolvedUrl.toLowerCase();
  const isAudioOrChatMedia =
    lowerResolved.includes('voice_') ||
    lowerResolved.includes('dating_app_chat_media') ||
    lowerResolved.includes('/api/chat/') ||
    lowerResolved.includes('/chat/media/') ||
    lowerResolved.includes('/uploads/') ||
    /\.(mp3|m4a|wav|aac|ogg|opus)($|\?|#)/i.test(lowerResolved);

  if (!isAudioOrChatMedia && lowerResolved.includes('cloudinary.com') && lowerResolved.includes('/video/upload/')) {
    resolvedUrl = get15SecVideoUrl(resolvedUrl);
  }

  return resolvedUrl;
};

export const isVideoUrl = (url) => {
  if (!url || typeof url !== 'string') return false;
  const lower = url.toLowerCase();
  return (
    lower.includes('/video/upload/') ||
    lower.includes('/video/') ||
    lower.includes('video') ||
    lower.startsWith('data:video/') ||
    lower.includes('mime=video') ||
    lower.includes('type=video') ||
    /\.(mp4|mov|webm|3gp|mkv|avi|m4v|flv)($|\?|#)/i.test(lower)
  );
};

export const getVideoThumbnailUrl = (url) => {
  if (!url) return '';
  const fullUrl = getImageUrl(url);
  if (typeof fullUrl !== 'string') return fullUrl;

  const lower = fullUrl.toLowerCase();
  if ((lower.startsWith('file://') || lower.startsWith('content://')) && isVideoUrl(lower)) {
    return null;
  }

  if (lower.includes('cloudinary.com') && (lower.includes('/video/upload/') || lower.includes('/video/'))) {
    // Transform Cloudinary video URL into a lightweight 20KB JPG thumbnail image frame (so_0,w_400,c_limit,q_auto,f_jpg)
    let thumbnailUrl = fullUrl.replace(/\/video\/upload\/(?:[a-zA-Z0-9_,-]+\/)?/, '/video/upload/so_0,w_400,c_limit,q_auto,f_jpg/');
    if (/\.(mp4|mov|webm|3gp|mkv|avi|m4v|flv)($|\?|#)/i.test(thumbnailUrl)) {
      thumbnailUrl = thumbnailUrl.replace(/\.(mp4|mov|webm|3gp|mkv|avi|m4v|flv)($|\?|#)/i, '.jpg$2');
    } else if (!thumbnailUrl.endsWith('.jpg') && !thumbnailUrl.endsWith('.jpeg')) {
      thumbnailUrl = `${thumbnailUrl}.jpg`;
    }
    return thumbnailUrl;
  }
  return fullUrl;
};

