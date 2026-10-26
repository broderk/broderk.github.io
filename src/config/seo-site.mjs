// SITE_URL is set in the build environment once the public domain is known.
export function getSiteSettings() {
  const value = process.env.SITE_URL?.trim();
  if (!value) return { site: 'http://localhost:4321', indexable: false };

  let url;
  try { url = new URL(value); }
  catch { throw new Error('SITE_URL must be an absolute http(s) URL.'); }
  const local = ['localhost', '127.0.0.1', '[::1]'].includes(url.hostname);
  if (!['http:', 'https:'].includes(url.protocol) || url.username || url.password
    || url.pathname !== '/' || url.search || url.hash || (!local && url.protocol !== 'https:')) {
    throw new Error('SITE_URL must be an HTTPS site origin (http is allowed for localhost only).');
  }
  return { site: url.origin, indexable: !local };
}
