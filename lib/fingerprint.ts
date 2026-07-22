/**
 * Generates a simple, non-invasive fingerprint from browser/device signals
 * available inside Telegram's WebView. Not a perfect unique ID — just a
 * signal to help spot shared-device account farming.
 */
export function generateFingerprint(): string {
  const parts = [
    navigator.userAgent,
    navigator.language,
    `${screen.width}x${screen.height}`,
    Intl.DateTimeFormat().resolvedOptions().timeZone,
  ];

  const raw = parts.join('|');

  // Simple hash (not cryptographic — just needs to be consistent, not secure)
  let hash = 0;
  for (let i = 0; i < raw.length; i++) {
    hash = (hash << 5) - hash + raw.charCodeAt(i);
    hash |= 0;
  }

  return hash.toString();
}