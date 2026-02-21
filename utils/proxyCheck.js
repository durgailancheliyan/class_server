/**
 * Proxy/VPN detection for attendance. Blocks requests from proxy/VPN IPs when enabled.
 * Uses vpnapi.io (free tier: 1000 req/day). Set VPNAPI_API_KEY in .env to enable.
 * Set DISABLE_PROXY_CHECK=true to skip the check entirely.
 */

const CACHE_TTL_MS = 10 * 60 * 1000; // 10 minutes
const cache = new Map();

export function getClientIp(req) {
  const forwarded = req.headers['x-forwarded-for'];
  if (forwarded) {
    const first = typeof forwarded === 'string' ? forwarded.split(',')[0] : forwarded[0];
    return (first || '').trim();
  }
  return req.ip || req.socket?.remoteAddress || '';
}

/**
 * Check if the IP is allowed (not proxy/VPN). Returns { allowed: boolean, reason?: string }.
 * If DISABLE_PROXY_CHECK=true or no VPNAPI_API_KEY, returns { allowed: true }.
 */
export async function checkProxyAllowed(ip) {
  if (process.env.DISABLE_PROXY_CHECK === 'true') {
    return { allowed: true };
  }
  const apiKey = process.env.VPNAPI_API_KEY;
  if (!apiKey) {
    return { allowed: true };
  }
  if (!ip || ip === '::1' || ip === '127.0.0.1') {
    return { allowed: true };
  }

  const cached = cache.get(ip);
  if (cached && Date.now() < cached.expiresAt) {
    return cached.result;
  }

  try {
    const url = `https://vpnapi.io/api/${encodeURIComponent(ip)}?key=${encodeURIComponent(apiKey)}`;
    const res = await fetch(url);
    const data = await res.json();
    const security = data?.security || {};
    if (security.vpn || security.proxy || security.tor || security.relay) {
      const result = {
        allowed: false,
        reason: 'Attendance is not allowed from proxy or VPN. Please use a direct connection.'
      };
      cache.set(ip, { result, expiresAt: Date.now() + CACHE_TTL_MS });
      return result;
    }
    const result = { allowed: true };
    cache.set(ip, { result, expiresAt: Date.now() + CACHE_TTL_MS });
    return result;
  } catch (err) {
    console.warn('Proxy check failed for', ip, err.message);
    return { allowed: true };
  }
}
