import { Platform } from 'react-native';

/**
 * Server Base URL configuration with candidate fallback URLs for:
 * - Physical Device via USB (adb reverse tcp:5000 tcp:5000): 'http://localhost:5000'
 * - Android Emulator: 'http://10.0.2.2:5000'
 * - Physical Device via Wi-Fi: 'http://10.0.3.64:5000'
 */
export const CANDIDATE_URLS = [
  'http://localhost:5000',
  'http://10.0.2.2:5000',
  'http://10.0.3.64:5000',
];

let workingBaseUrl = 'http://localhost:5000';

export const getBaseUrl = () => workingBaseUrl;

export const setBaseUrl = (url) => {
  workingBaseUrl = url;
};

export const BASE_URL = 'http://localhost:5000';

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
