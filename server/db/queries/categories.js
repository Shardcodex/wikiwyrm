const { query } = require('../migrator-source')
const { randomUUID } = require('crypto')

async function upsertCategory(worldId, { key, label, prefix, icon, isOfficial = true, sort = 0 }) {
  const existing = await query('SELECT id FROM categories WHERE world_id=$1 AND key=$2', [worldId, key])
  if (existing[0]) {
    await query('UPDATE categories SET label=$1, prefix=$2, icon=$3, is_official=$4, sort=$5, updated_at=NOW() WHERE id=$6',
      [label, prefix, icon, isOfficial, sort, existing[0].id])
    return existing[0]
  }
  const id = randomUUID()
  await query(
    'INSERT INTO categories (id, world_id, key, label, prefix, icon, is_official, sort) VALUES ($1,$2,$3,$4,$5,$6,$7,$8)',
    [id, worldId, key, label, prefix || null, icon || null, isOfficial, sort]
  )
  return { id }
}

async function createSubcategory(worldId, categoryId, { key, label, sort = 0 }) {
  const id = randomUUID()
  await query(
    'INSERT INTO subcategories (id, world_id, category_id, key, label, sort) VALUES ($1,$2,$3,$4,$5,$6)',
    [id, worldId, categoryId, key, label, sort]
  )
  return { id }
}

async function getCategoryByKey(worldId, key) {
  const rows = await query('SELECT * FROM categories WHERE world_id=$1 AND key=$2 LIMIT 1', [worldId, key])
  return rows[0] || null
}

async function getSubcategoryByKey(worldId, categoryId, key) {
  const rows = await query(
    'SELECT * FROM subcategories WHERE world_id=$1 AND category_id=$2 AND key=$3 LIMIT 1',
    [worldId, categoryId, key]
  )
  return rows[0] || null
}

module.exports = {
  upsertCategory,
  createSubcategory,
  getCategoryByKey,
  getSubcategoryByKey
}
