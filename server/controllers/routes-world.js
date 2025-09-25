// server/controllers/routes-world.js
const express = require('express')
const router = express.Router()

function setTenant(req, world, locale) {
  req.worldSlug = world
  req.locale = locale
  if (req.state) {
    req.state.worldSlug = world
    req.state.locale = locale
  }
}

// View: /:world/:locale/:path*  -> rewrite to /:locale/:path*
router.get('/:world/:locale/*', (req, res, next) => {
  const world = req.params.world
  const locale = req.params.locale
  const path = req.params[0] || ''
  setTenant(req, world, locale)
  // Rewrite and continue; legacy routes will handle it
  req.url = `/${locale}/${path}`
  next()
})

// Editor: /:world/e/:locale/:path* -> rewrite to /e/:locale/:path*
router.get('/:world/e/:locale/*', (req, res, next) => {
  const world = req.params.world
  const locale = req.params.locale
  const path = req.params[0] || ''
  setTenant(req, world, locale)
  req.url = `/e/${locale}/${path}`
  next()
})

module.exports = router
