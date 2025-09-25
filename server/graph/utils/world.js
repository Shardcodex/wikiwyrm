// server/graph/utils/world.js
/* global WIKI */

async function getWorldBySlug (slug) {
  if (!slug) return null
  const row = await WIKI.models.knex('worlds')
    .first('*')
    .where({ slug: String(slug).trim().toLowerCase() })
  return row || null
}

async function getDefaultWorld () {
  const row = await WIKI.models.knex('worlds')
    .first('*')
    .where({ slug: 'default' })
  return row || null
}

module.exports = {
  getWorldBySlug,
  getDefaultWorld
}
