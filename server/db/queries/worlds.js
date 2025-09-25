const { query } = require('../migrator-source')
const { randomUUID } = require('crypto')

async function getWorldBySlug(slug) {
  const rows = await query('SELECT * FROM worlds WHERE slug = $1 LIMIT 1', [slug])
  return rows[0] || null
}

async function createWorld({ ownerId, name, slug, isPrivate = false }) {
  const id = randomUUID()
  await query(
    'INSERT INTO worlds (id, owner_id, slug, name, is_private) VALUES ($1,$2,$3,$4,$5)',
    [id, ownerId, slug, name, isPrivate]
  )
  return { id, ownerId, slug, name, isPrivate }
}

module.exports = { getWorldBySlug, createWorld }
