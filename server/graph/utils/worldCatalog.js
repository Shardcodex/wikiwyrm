/* global WIKI */
const crypto = require('crypto')

// idempotent upserts
async function upsertCategory(worldId, { key, label, prefix, icon, sort = 0, isOfficial = true }) {
  const S = WIKI.db.Sequelize.QueryTypes.SELECT
  const found = await WIKI.db.sequelize.query(
    'SELECT id FROM categories WHERE world_id=$1 AND key=$2 LIMIT 1',
    { bind: [worldId, key], type: S }
  )
  if (found[0]?.id) return found[0].id

  const id = crypto.randomUUID()
  await WIKI.db.sequelize.query(
    'INSERT INTO categories (id, world_id, key, label, prefix, icon, is_official, sort) VALUES ($1,$2,$3,$4,$5,$6,$7,$8)',
    { bind: [id, worldId, key, label, prefix || null, icon || null, isOfficial, sort] }
  )
  return id
}

async function upsertSub(worldId, categoryId, { key, label, sort = 0 }) {
  const S = WIKI.db.Sequelize.QueryTypes.SELECT
  const found = await WIKI.db.sequelize.query(
    'SELECT id FROM subcategories WHERE world_id=$1 AND category_id=$2 AND key=$3 LIMIT 1',
    { bind: [worldId, categoryId, key], type: S }
  )
  if (found[0]?.id) return found[0].id

  const id = crypto.randomUUID()
  await WIKI.db.sequelize.query(
    'INSERT INTO subcategories (id, world_id, category_id, key, label, sort) VALUES ($1,$2,$3,$4,$5,$6)',
    { bind: [id, worldId, categoryId, key, label, sort] }
  )
  return id
}

async function seedWorldCatalog(worldId) {
  // Add any official categories you want here:
  const defs = [
    { key: 'characters',
      label: 'Characters',
      prefix: 'characters',
      icon: 'mdi-account-group',
      sort: 10,
      subs: [['main', 'Main Characters', 1], ['supporting', 'Supporting Characters', 2], ['historical', 'Historical Figures', 3], ['mythic', 'Deities & Mythic Beings', 4]] },
    { key: 'locations',
      label: 'Locations',
      prefix: 'locations',
      icon: 'mdi-map',
      sort: 20,
      subs: [['regions', 'Continents / Regions', 1], ['cities', 'Cities & Towns', 2], ['landmarks', 'Landmarks & Structures', 3], ['maps', 'Maps', 4]] },
    { key: 'technology',
      label: 'Technology & Tools',
      prefix: 'technology',
      icon: 'mdi-cog',
      sort: 30,
      subs: [['inventions', 'Inventions', 1], ['weapons', 'Weapons & Armor', 2], ['transport', 'Transportation', 3]] },
    { key: 'magic',
      label: 'Magic',
      prefix: 'magic',
      icon: 'mdi-auto-fix',
      sort: 40,
      subs: [['systems', 'Magic Systems', 1], ['spells', 'Spells & Abilities', 2], ['artifacts', 'Artifacts & Relics', 3]] },
    { key: 'history',
      label: 'History & Lore',
      prefix: 'history',
      icon: 'mdi-timeline-text',
      sort: 50,
      subs: [['timelines', 'Timelines', 1], ['eras', 'Eras & Epochs', 2], ['myths', 'Myths & Legends', 3], ['events', 'Historical Events', 4]] },
    { key: 'languages',
      label: 'Languages',
      prefix: 'languages',
      icon: 'mdi-alphabet-greek',
      sort: 60,
      subs: [['conlangs', 'Constructed Languages', 1], ['scripts', 'Alphabets & Scripts', 2], ['names', 'Naming Conventions', 3]] },
    { key: 'creatures',
      label: 'Creatures',
      prefix: 'creatures',
      icon: 'mdi-paw',
      sort: 70,
      subs: [['beasts', 'Beasts & Monsters', 1], ['sentient', 'Sentient Species', 2], ['hybrids', 'Hybrids & Abominations', 3]] },
    { key: 'other', label: 'Other', prefix: 'wiki', icon: 'mdi-shape', sort: 90, subs: [] }
  ]

  for (const c of defs) {
    const catId = await upsertCategory(worldId, c)
    for (const [key, label, sort] of c.subs) {
      await upsertSub(worldId, catId, { key, label, sort })
    }
  }
}

module.exports = { seedWorldCatalog }
