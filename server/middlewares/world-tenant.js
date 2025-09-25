// server/middleware/world-tenant.js
module.exports = async (ctx, next) => {
  // Expect URLs like /:locale/:world/:path*
  // Examples: /en/arkhos/technology/laser-spear
  //           /e/en/arkhos/technology/laser-spear (editor)
  let url = ctx.path || ''
  // Strip optional /e prefix for editor routes
  if (url.startsWith('/e/')) url = url.slice(2)

  const parts = url.split('/').filter(Boolean) // ['en','arkhos','technology','laser-spear']
  const locale = parts[0]
  const worldSlug = parts[1]

  if (locale && worldSlug) {
    ctx.state.locale = locale
    ctx.state.worldSlug = worldSlug
  }

  // also allow X-World header or ?world=… as fallback
  if (!ctx.state.worldSlug) {
    ctx.state.worldSlug = ctx.get('x-world') || ctx.query.world || null
  }

  await next()
}
