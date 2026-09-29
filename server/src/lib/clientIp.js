const { isIP } = require('net');

// Rate-limit key for a request. On Render, traffic reaches the app through Cloudflare and
// Render's load balancer, and req.ip (from X-Forwarded-For with 'trust proxy' 1) is sometimes
// one of those relays' addresses instead of the visitor's — so unrelated customers ended up
// sharing one limit. Cloudflare always overwrites CF-Connecting-IP with the real visitor's
// address, so a client can't fake it. Without that header (local dev, or if Render ever
// stops sending it) this falls back to req.ip, exactly as before.
function clientIpKey(req) {
  const cf = req.headers['cf-connecting-ip'];
  return typeof cf === 'string' && isIP(cf) ? cf : req.ip;
}

module.exports = { clientIpKey };
