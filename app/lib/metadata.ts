/** Public share assets must not depend on checkout/auth callback URLs. */
export function publicMetadataBase(
  siteUrl = process.env.NEXT_PUBLIC_SITE_URL,
  production = process.env.NODE_ENV === 'production',
): URL {
  const fallback = new URL('https://app.chatmandarin.cc')
  if (!siteUrl) return fallback
  try {
    const url = new URL(siteUrl)
    const local = url.hostname === 'localhost' || url.hostname.endsWith('.localhost') ||
      url.hostname === '[::1]' || /^127\./.test(url.hostname) || url.hostname === '0.0.0.0'
    if (!['http:', 'https:'].includes(url.protocol) || url.username || url.password) return fallback
    if (production && (local || url.protocol !== 'https:')) return fallback
    return new URL(url.origin)
  } catch {
    return fallback
  }
}
