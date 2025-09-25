const { query } = require('../migrator-source')
const { randomUUID } = require('crypto')

async function createPage({
  worldId, creatorId, path, locale, title, description,
  editor, categoryId = null, subcategoryId = null,
  isPublished = true, isPrivate = false, guidedData = null
}) {
  const id = randomUUID()
  await query(
    `INSERT INTO pages
     (id, world_id, creator_id, path, locale, title, description, editor,
      category_id, subcategory_id, is_published, is_private, guided_data)
     VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13)`,
    [id, worldId, creatorId, path, locale, title, description, editor,
      categoryId, subcategoryId, isPublished, isPrivate, guidedData]
  )
  return { id }
}

async function createPageContent({ pageId, version = 1, content, createdBy }) {
  const id = randomUUID()
  await query(
    'INSERT INTO page_contents (id, page_id, version, content, created_by) VALUES ($1,$2,$3,$4,$5)',
    [id, pageId, version, content, createdBy]
  )
  return { id }
}

async function addTags(pageId, tags = []) {
  for (const t of tags) {
    await query('INSERT INTO page_tags (page_id, tag) VALUES ($1,$2) ON CONFLICT DO NOTHING', [pageId, t])
  }
}

module.exports = { createPage, createPageContent, addTags }
