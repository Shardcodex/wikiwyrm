// server/graph/tenantContext.js
/* global WIKI */

const RESERVED = new Set(['_assets', 'graphql', 'graphql-subscriptions', 'api',
  'login', 'logout', 'register', 'verify', 'favicons', 'fonts', 'img', 'js', 'svg', 'admin', 'theme'])

function looksLocale(seg) { return /^[A-Za-z]{2}(-[A-Za-z]{2})?$/.test(String(seg || '')) }
function defaultLocale() { return (WIKI?.config?.lang?.code) || 'en' }
function defaultWorld() { return process.env.WIKI_DEFAULT_WORLD || 'default' }

function fromHeadersOrReferer(req) {
  const hWorld = req.headers['x-world-slug']
  const hLocale = req.headers['x-locale']
  if (hWorld || hLocale) return { worldSlug: hWorld || null, locale: hLocale || null }

  const ref = req.headers.referer || req.headers.referrer
  if (ref) {
    try {
      const base = `http://${req.headers.host || 'localhost'}`
      const u = new URL(ref, base)
      const segs = u.pathname.split('/').filter(Boolean)
      if (segs[0] && !looksLocale(segs[0]) && !RESERVED.has(segs[0])) {
        const worldSlug = segs[0]
        const locale = looksLocale(segs[1]) ? segs[1] : defaultLocale()
        return { worldSlug, locale }
      }
      if (looksLocale(segs[0])) {
        return { worldSlug: defaultWorld(), locale: segs[0] }
      }
    } catch {}
  }
  return { worldSlug: null, locale: null }
}

function tenantContext(req) {
  const path = (req && (req.path || req.url) || '/').split('?')[0]
  const segs = path.split('/').filter(Boolean)

  // reserved (graphql, assets, etc.) → use headers/referrer
  if (segs[0] && RESERVED.has(segs[0])) {
    const hdr = fromHeadersOrReferer(req)
    return { worldSlug: hdr.worldSlug, locale: hdr.locale }
  }

  // world-first
  if (segs[0] && !looksLocale(segs[0]) && !RESERVED.has(segs[0])) {
    const worldSlug = segs[0]
    const locale = looksLocale(segs[1]) ? segs[1] : defaultLocale()
    return { worldSlug, locale }
  }

  // locale-first (legacy) → default world
  if (looksLocale(segs[0])) {
    return { worldSlug: defaultWorld(), locale: segs[0] }
  }

  // root
  return { worldSlug: defaultWorld(), locale: defaultLocale() }
}

function tenantMiddleware() {
  return (req, _res, next) => {
    const { worldSlug, locale } = tenantContext(req)
    req.worldSlug = worldSlug
    req.locale = locale
    if (req.state) { req.state.worldSlug = worldSlug; req.state.locale = locale }
    next()
  }
}

module.exports = tenantContext
module.exports.tenantMiddleware = tenantMiddleware
