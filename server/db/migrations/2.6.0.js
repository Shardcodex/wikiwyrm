/* global WIKI */

// ---------- small helpers ----------
const sleep = (ms) => new Promise(r => setTimeout(r, ms))

async function execWithRetry(db, sql, bindings = [], opts = {}) {
  const { retries = 20, baseDelay = 100 } = opts // up to ~ (100+...)= a few seconds
  let attempt = 0
  for (;;) {
    try {
      return await db.raw(sql, bindings)
    } catch (e) {
      const msg = String(e && e.message || e)
      // Retry only SQLITE_BUSY on SQLite
      if (!msg.includes('SQLITE_BUSY') || attempt >= retries) throw e
      const delay = baseDelay * Math.min(10, attempt + 1) // simple linear-ish backoff
      await sleep(delay)
      attempt++
    }
  }
}

async function tableExists(db, name, isPg) {
  if (isPg) {
    const r = await db.raw('select to_regclass(?) as oid', [name])
    const row = r?.rows?.[0] ?? r?.[0]
    return !!(row && (row.oid || row.to_regclass))
  } else {
    const res = await db.raw("select name from sqlite_master where type='table' and name=?", [name])
    const rows = Array.isArray(res) ? (res[0] || res) : res
    return Array.isArray(rows) ? rows.length > 0 : false
  }
}
async function columnExists(db, table, col, isPg) {
  if (isPg) {
    const r = await db.raw(
      'select 1 from information_schema.columns where table_name = ? and column_name = ?',
      [table, col]
    )
    const rows = r?.rows ?? r?.[0] ?? []
    return rows.length > 0
  } else {
    const r = await db.raw(`PRAGMA table_info(${table})`)
    const rows = r?.[0] || r
    return (rows || []).some(c => (c.name || c?.[1]) === col)
  }
}
async function createIndexIfNotExists(db, name, createSql, isPg) {
  if (isPg) {
    await db.raw(`
      DO $$ BEGIN
        IF NOT EXISTS (SELECT 1 FROM pg_indexes WHERE indexname = ?) THEN
          EXECUTE ?;
        END IF;
      END $$;`, [name, createSql])
  } else {
    await execWithRetry(db, createSql.replace('CREATE INDEX ', 'CREATE INDEX IF NOT EXISTS '))
  }
}

module.exports = {
  async up () {
    const knex = WIKI.models.knex
    const isPg = (WIKI.config?.db?.type || 'postgres') !== 'sqlite'

    // ===== SQLite PRAGMAs OUTSIDE any transaction (best-effort, non-fatal) =====
    if (!isPg) {
      try {
        const r = await knex.raw('PRAGMA journal_mode;')
        const raw = Array.isArray(r) ? (r[0]?.[0] || r[0]) : r
        const mode = String(raw?.journal_mode ?? raw?.JOURNAL_MODE ?? '').toUpperCase()
        if (mode !== 'WAL') await knex.raw('PRAGMA journal_mode=WAL;')
      } catch (_) {}
      try { await knex.raw('PRAGMA busy_timeout=30000;') } catch (_) {}
      try { await knex.raw('PRAGMA synchronous=NORMAL;') } catch (_) {}
    }

    // ===== Run schema changes =====
    if (isPg) {
      // ---- Postgres: single transaction ----
      await knex.transaction(async trx => {
        // WORLDS
        if (!(await tableExists(trx, 'worlds', true))) {
          await trx.raw(`
            CREATE TABLE IF NOT EXISTS worlds (
              id TEXT PRIMARY KEY,
              owner_id TEXT NOT NULL,
              slug VARCHAR(64) NOT NULL UNIQUE,
              name VARCHAR(120) NOT NULL,
              is_private BOOLEAN NOT NULL DEFAULT FALSE,
              created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
              updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
            )`)
          await createIndexIfNotExists(trx, 'worlds_owner_id_idx',
            'CREATE INDEX worlds_owner_id_idx ON worlds(owner_id)', true)
        }

        // MEMBERSHIPS
        if (!(await tableExists(trx, 'world_memberships', true))) {
          await trx.raw(`
            CREATE TABLE IF NOT EXISTS world_memberships (
              id TEXT PRIMARY KEY,
              world_id TEXT NOT NULL,
              user_id TEXT NOT NULL,
              role VARCHAR(32) NOT NULL DEFAULT 'editor',
              created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
              updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
              UNIQUE(world_id, user_id)
            )`)
          await createIndexIfNotExists(trx, 'world_memberships_world_id_idx',
            'CREATE INDEX world_memberships_world_id_idx ON world_memberships(world_id)', true)
          await createIndexIfNotExists(trx, 'world_memberships_user_id_idx',
            'CREATE INDEX world_memberships_user_id_idx ON world_memberships(user_id)', true)
        }

        // CATEGORIES
        if (!(await tableExists(trx, 'categories', true))) {
          await trx.raw(`
            CREATE TABLE IF NOT EXISTS categories (
              id TEXT PRIMARY KEY,
              world_id TEXT NOT NULL,
              key VARCHAR(64) NOT NULL,
              label VARCHAR(120) NOT NULL,
              prefix VARCHAR(120),
              icon VARCHAR(80),
              is_official BOOLEAN NOT NULL DEFAULT TRUE,
              sort INTEGER NOT NULL DEFAULT 0,
              created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
              updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
              UNIQUE(world_id, key)
            )`)
        }

        // SUBCATEGORIES
        if (!(await tableExists(trx, 'subcategories', true))) {
          await trx.raw(`
            CREATE TABLE IF NOT EXISTS subcategories (
              id TEXT PRIMARY KEY,
              world_id TEXT NOT NULL,
              category_id TEXT NOT NULL,
              key VARCHAR(64) NOT NULL,
              label VARCHAR(120) NOT NULL,
              sort INTEGER NOT NULL DEFAULT 0,
              created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
              updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
              UNIQUE(world_id, category_id, key)
            )`)
          await createIndexIfNotExists(trx, 'subcategories_category_id_idx',
            'CREATE INDEX subcategories_category_id_idx ON subcategories(category_id)', true)
        }

        // PAGES columns
        if (!(await columnExists(trx, 'pages', 'world_id', true))) await trx.raw('ALTER TABLE pages ADD COLUMN world_id TEXT')
        if (!(await columnExists(trx, 'pages', 'category_id', true))) await trx.raw('ALTER TABLE pages ADD COLUMN category_id TEXT')
        if (!(await columnExists(trx, 'pages', 'subcategory_id', true))) await trx.raw('ALTER TABLE pages ADD COLUMN subcategory_id TEXT')
        if (!(await columnExists(trx, 'pages', 'is_published', true))) await trx.raw('ALTER TABLE pages ADD COLUMN is_published BOOLEAN NOT NULL DEFAULT TRUE')
        if (!(await columnExists(trx, 'pages', 'is_private', true))) await trx.raw('ALTER TABLE pages ADD COLUMN is_private BOOLEAN NOT NULL DEFAULT FALSE')
        if (!(await columnExists(trx, 'pages', 'guided_data', true))) await trx.raw('ALTER TABLE pages ADD COLUMN guided_data JSONB')
        await createIndexIfNotExists(trx, 'pages_world_path_uq',
          'CREATE UNIQUE INDEX pages_world_path_uq ON pages(world_id, path)', true)

        // page_contents
        if (!(await tableExists(trx, 'page_contents', true))) {
          await trx.raw(`
            CREATE TABLE IF NOT EXISTS page_contents (
              id TEXT PRIMARY KEY,
              page_id TEXT NOT NULL,
              version INTEGER NOT NULL,
              content TEXT NOT NULL,
              created_by TEXT NOT NULL,
              created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
              UNIQUE(page_id, version)
            )`)
        }

        // page_tags
        if (!(await tableExists(trx, 'page_tags', true))) {
          await trx.raw(`
            CREATE TABLE IF NOT EXISTS page_tags (
              page_id TEXT NOT NULL,
              tag TEXT NOT NULL,
              UNIQUE(page_id, tag)
            )`)
        }

        // guided tables
        if (!(await tableExists(trx, 'guided_templates', true))) {
          await trx.raw(`
            CREATE TABLE IF NOT EXISTS guided_templates (
              id TEXT PRIMARY KEY,
              world_id TEXT NOT NULL,
              category_id TEXT NOT NULL,
              subcategory_id TEXT,
              key VARCHAR(64) NOT NULL,
              label VARCHAR(120) NOT NULL,
              config JSONB NOT NULL DEFAULT '{}',
              created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
              updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
              UNIQUE(world_id, category_id, subcategory_id, key)
            )`)
        }
        if (!(await tableExists(trx, 'page_guided_states', true))) {
          await trx.raw(`
            CREATE TABLE IF NOT EXISTS page_guided_states (
              id TEXT PRIMARY KEY,
              page_id TEXT NOT NULL UNIQUE,
              template_id TEXT NOT NULL,
              state JSONB NOT NULL DEFAULT '{}',
              updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
            )`)
        }
      })
    } else {
      // ---- SQLite: NO transaction; DDL with retry to dodge transient locks ----
      const db = knex

      // WORLDS
      if (!(await tableExists(db, 'worlds', false))) {
        await execWithRetry(db, `
          CREATE TABLE IF NOT EXISTS worlds (
            id TEXT PRIMARY KEY,
            owner_id TEXT NOT NULL,
            slug TEXT NOT NULL UNIQUE,
            name TEXT NOT NULL,
            is_private INTEGER NOT NULL DEFAULT 0,
            created_at TEXT NOT NULL DEFAULT (datetime('now')),
            updated_at TEXT NOT NULL DEFAULT (datetime('now'))
          )`)
        await execWithRetry(db, 'CREATE INDEX IF NOT EXISTS worlds_owner_id_idx ON worlds(owner_id)')
      }

      // MEMBERSHIPS
      if (!(await tableExists(db, 'world_memberships', false))) {
        await execWithRetry(db, `
          CREATE TABLE IF NOT EXISTS world_memberships (
            id TEXT PRIMARY KEY,
            world_id TEXT NOT NULL,
            user_id TEXT NOT NULL,
            role TEXT NOT NULL DEFAULT 'editor',
            created_at TEXT NOT NULL DEFAULT (datetime('now')),
            updated_at TEXT NOT NULL DEFAULT (datetime('now')),
            UNIQUE(world_id, user_id)
          )`)
        await execWithRetry(db, 'CREATE INDEX IF NOT EXISTS world_memberships_world_id_idx ON world_memberships(world_id)')
        await execWithRetry(db, 'CREATE INDEX IF NOT EXISTS world_memberships_user_id_idx ON world_memberships(user_id)')
      }

      // CATEGORIES
      if (!(await tableExists(db, 'categories', false))) {
        await execWithRetry(db, `
          CREATE TABLE IF NOT EXISTS categories (
            id TEXT PRIMARY KEY,
            world_id TEXT NOT NULL,
            key TEXT NOT NULL,
            label TEXT NOT NULL,
            prefix TEXT,
            icon TEXT,
            is_official INTEGER NOT NULL DEFAULT 1,
            sort INTEGER NOT NULL DEFAULT 0,
            created_at TEXT NOT NULL DEFAULT (datetime('now')),
            updated_at TEXT NOT NULL DEFAULT (datetime('now')),
            UNIQUE(world_id, key)
          )`)
      }

      // SUBCATEGORIES
      if (!(await tableExists(db, 'subcategories', false))) {
        await execWithRetry(db, `
          CREATE TABLE IF NOT EXISTS subcategories (
            id TEXT PRIMARY KEY,
            world_id TEXT NOT NULL,
            category_id TEXT NOT NULL,
            key TEXT NOT NULL,
            label TEXT NOT NULL,
            sort INTEGER NOT NULL DEFAULT 0,
            created_at TEXT NOT NULL DEFAULT (datetime('now')),
            updated_at TEXT NOT NULL DEFAULT (datetime('now')),
            UNIQUE(world_id, category_id, key)
          )`)
        await execWithRetry(db, 'CREATE INDEX IF NOT EXISTS subcategories_category_id_idx ON subcategories(category_id)')
      }

      // PAGES columns
      if (!(await columnExists(db, 'pages', 'world_id', false))) await execWithRetry(db, 'ALTER TABLE pages ADD COLUMN world_id TEXT')
      if (!(await columnExists(db, 'pages', 'category_id', false))) await execWithRetry(db, 'ALTER TABLE pages ADD COLUMN category_id TEXT')
      if (!(await columnExists(db, 'pages', 'subcategory_id', false))) await execWithRetry(db, 'ALTER TABLE pages ADD COLUMN subcategory_id TEXT')
      if (!(await columnExists(db, 'pages', 'is_published', false))) await execWithRetry(db, 'ALTER TABLE pages ADD COLUMN is_published INTEGER NOT NULL DEFAULT 1')
      if (!(await columnExists(db, 'pages', 'is_private', false))) await execWithRetry(db, 'ALTER TABLE pages ADD COLUMN is_private INTEGER NOT NULL DEFAULT 0')
      if (!(await columnExists(db, 'pages', 'guided_data', false))) await execWithRetry(db, 'ALTER TABLE pages ADD COLUMN guided_data TEXT')
      await execWithRetry(db, 'CREATE UNIQUE INDEX IF NOT EXISTS pages_world_path_uq ON pages(world_id, path)')

      // page_contents
      if (!(await tableExists(db, 'page_contents', false))) {
        await execWithRetry(db, `
          CREATE TABLE IF NOT EXISTS page_contents (
            id TEXT PRIMARY KEY,
            page_id TEXT NOT NULL,
            version INTEGER NOT NULL,
            content TEXT NOT NULL,
            created_by TEXT NOT NULL,
            created_at TEXT NOT NULL DEFAULT (datetime('now')),
            UNIQUE(page_id, version)
          )`)
      }

      // page_tags
      if (!(await tableExists(db, 'page_tags', false))) {
        await execWithRetry(db, `
          CREATE TABLE IF NOT EXISTS page_tags (
            page_id TEXT NOT NULL,
            tag TEXT NOT NULL,
            UNIQUE(page_id, tag)
          )`)
      }

      // guided tables
      if (!(await tableExists(db, 'guided_templates', false))) {
        await execWithRetry(db, `
          CREATE TABLE IF NOT EXISTS guided_templates (
            id TEXT PRIMARY KEY,
            world_id TEXT NOT NULL,
            category_id TEXT NOT NULL,
            subcategory_id TEXT,
            key TEXT NOT NULL,
            label TEXT NOT NULL,
            config TEXT NOT NULL DEFAULT '{}',
            created_at TEXT NOT NULL DEFAULT (datetime('now')),
            updated_at TEXT NOT NULL DEFAULT (datetime('now')),
            UNIQUE(world_id, category_id, subcategory_id, key)
          )`)
      }
      if (!(await tableExists(db, 'page_guided_states', false))) {
        await execWithRetry(db, `
          CREATE TABLE IF NOT EXISTS page_guided_states (
            id TEXT PRIMARY KEY,
            page_id TEXT NOT NULL UNIQUE,
            template_id TEXT NOT NULL,
            state TEXT NOT NULL DEFAULT '{}',
            updated_at TEXT NOT NULL DEFAULT (datetime('now'))
          )`)
      }
    }
  },

  async down () {
    const knex = WIKI.models.knex
    const isPg = (WIKI.config?.db?.type || 'postgres') !== 'sqlite'

    if (isPg) {
      await knex.transaction(async trx => {
        await trx.raw('DROP TABLE IF EXISTS page_guided_states')
        await trx.raw('DROP TABLE IF EXISTS guided_templates')
        await trx.raw('DROP TABLE IF EXISTS page_tags')
        await trx.raw('DROP TABLE IF EXISTS page_contents')
        await trx.raw('DROP TABLE IF EXISTS subcategories')
        await trx.raw('DROP TABLE IF EXISTS categories')
        await trx.raw('DROP TABLE IF EXISTS world_memberships')
        await trx.raw('DROP TABLE IF EXISTS worlds')
        await trx.raw(`
          DO $$ BEGIN
            IF EXISTS (SELECT 1 FROM pg_indexes WHERE indexname='pages_world_path_uq') THEN
              DROP INDEX pages_world_path_uq;
            END IF;
          END $$;`)
      })
    } else {
      // SQLite: drop with retry (no transaction)
      await execWithRetry(knex, 'DROP TABLE IF EXISTS page_guided_states')
      await execWithRetry(knex, 'DROP TABLE IF EXISTS guided_templates')
      await execWithRetry(knex, 'DROP TABLE IF EXISTS page_tags')
      await execWithRetry(knex, 'DROP TABLE IF EXISTS page_contents')
      await execWithRetry(knex, 'DROP TABLE IF EXISTS subcategories')
      await execWithRetry(knex, 'DROP TABLE IF EXISTS categories')
      await execWithRetry(knex, 'DROP TABLE IF EXISTS world_memberships')
      await execWithRetry(knex, 'DROP TABLE IF EXISTS worlds')
      await execWithRetry(knex, 'DROP INDEX IF EXISTS pages_world_path_uq')
    }
  }
}
