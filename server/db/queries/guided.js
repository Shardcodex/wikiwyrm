const { query } = require('../migrator-source')
const { randomUUID } = require('crypto')

async function findTemplate(worldId, categoryId, subcategoryId, key = 'default') {
  const rows = await query(
    `SELECT * FROM guided_templates
     WHERE world_id=$1 AND category_id=$2 AND
           (subcategory_id IS ? OR subcategory_id = $3) AND key=$4
     LIMIT 1`,
    [worldId, categoryId, subcategoryId || null, key]
  )
  return rows[0] || null
}

async function setPageGuidedState(pageId, templateId, state = {}) {
  // upsert
  const existing = await query('SELECT id FROM page_guided_states WHERE page_id=$1', [pageId])
  if (existing[0]) {
    await query('UPDATE page_guided_states SET template_id=$1, state=$2, updated_at=NOW() WHERE page_id=$3',
      [templateId, JSON.stringify(state), pageId])
    return existing[0]
  }
  const id = randomUUID()
  await query(
    'INSERT INTO page_guided_states (id, page_id, template_id, state) VALUES ($1,$2,$3,$4)',
    [id, pageId, templateId, JSON.stringify(state)]
  )
  return { id }
}

module.exports = { findTemplate, setPageGuidedState }
