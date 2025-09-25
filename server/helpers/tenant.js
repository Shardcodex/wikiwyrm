// server/helpers/tenant.js
/* global WIKI */
const CACHE_MS = 10 * 60 * 1000
const _cache = new Map()

function now() { return Date.now() }
function isLocale(seg) {
  if (!seg) return false
  const s = String(seg)
  return /^[A-Za-z]{2}(-[A-Za-z]{2})?$/.test(s)
}

async function worldExists(slug) {
  if (!slug) return false
  const hit = _cache.get(slug)
  if (hit && (now() - hit.t) < CACHE_MS) return hit.ok
  const rows = await WIKI.models.knex('worlds').select('id').where({ slug }).limit(1)
  const ok = rows && rows.length > 0
  _cache.set(slug, { ok, t: now() })
  return ok
}

function isReserved(seg) {
  // keep in sync with reservedPaths + static/internal endpoints
  return [
    '_assets', 'graphql', 'graphql-subscriptions', 'api', 'login', 'logout', 'register',
    'verify', 'favicons', 'fonts', 'img', 'js', 'svg', 'admin', 'theme'
  ].includes(seg)
}

function defaultLocale() {
  const cfg = (WIKI && WIKI.config && WIKI.config.lang && WIKI.config.lang.code) ? WIKI.config.lang.code : 'en'
  return cfg
}

function defaultWorld() {
  return process.env.WIKI_DEFAULT_WORLD || 'default'
}

async function parseTenantFromPath(pathname) {
  const segs = String(pathname || '/').split('/').filter(Boolean)
  let world = null; let locale = null; let passthrough = pathname

  if (segs.length === 0) {
    world = defaultWorld()
    locale = defaultLocale()
    return { world, locale, passthrough }
  }

  // ignore reserved roots (/graphql, /_assets, etc.)
  if (isReserved(segs[0])) {
    return { world: null, locale: null, passthrough }
  }

  // Prefer world first: /:world/(optional :locale)/...
  if (await worldExists(segs[0])) {
    world = segs[0]
    if (segs[1] && isLocale(segs[1])) {
      locale = segs[1]
      passthrough = '/' + segs.slice(2).join('/')
    } else {
      locale = defaultLocale()
      passthrough = '/' + segs.slice(1).join('/')
    }
    return { world, locale, passthrough }
  }

  // Back-compat: /:locale/...  -> use default world
  if (isLocale(segs[0])) {
    world = defaultWorld()
    locale = segs[0]
    passthrough = '/' + segs.slice(1).join('/')
    return { world, locale, passthrough }
  }

  // Fallback: treat first as world even if not yet created
  world = segs[0]
  locale = segs[1] && isLocale(segs[1]) ? segs[1] : defaultLocale()
  passthrough = isLocale(segs[1]) ? '/' + segs.slice(2).join('/') : '/' + segs.slice(1).join('/')
  return { world, locale, passthrough }
}

function tenantMiddleware() {
  return async (ctx, next) => {
    const parsed = await parseTenantFromPath(ctx.path)
    // stash on Koa state + req for Apollo context
    ctx.state.worldSlug = parsed.world
    ctx.state.locale = parsed.locale
    // don’t rewrite assets/admin/etc.
    if (parsed.world && !isReserved(ctx.path.split('/').filter(Boolean)[0])) {
      // NOTE: we DO NOT blindly rewrite ctx.path here; routes below will alias.
    }
    // also set on req (apollo sometimes reads from req)
    ctx.req.worldSlug = parsed.world
    ctx.req.locale = parsed.locale
    await next()
  }
}

module.exports = {
  tenantMiddleware,
  isLocale,
  defaultWorld,
  defaultLocale
}
