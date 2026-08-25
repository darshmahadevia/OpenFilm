export type DesktopPlatform = 'macOS' | 'Windows' | 'unsupported';

export function detectDesktopPlatform(userAgent = '', platform = ''): DesktopPlatform {
  const identity = `${platform} ${userAgent}`.toLowerCase();
  if (/iphone|ipad|ipod|android|mobile/.test(identity)) return 'unsupported';
  if (/mac/.test(identity)) return 'macOS';
  if (/win/.test(identity)) return 'Windows';
  return 'unsupported';
}
