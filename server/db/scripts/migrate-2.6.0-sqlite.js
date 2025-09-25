// scripts/migrate-2.6.0-sqlite.js
// Run with the app STOPPED. Applies 2.6.0 schema changes to ./db.sqlite.
// Safe to re-run: ignores "already exists" / duplicate errors.

const path = require('path')
const fs = require('fs')
const Database = require('better-sqlite3')

// --- config ---
// If your DB is elsewhere, change this path:
const DB_PATH = path.resolve(__dirname, '../data/wiki.db')

// --- helpers ---
function backup(src) {
  const ts = new Date().toISOString().replace(/[:.]/g, '-')
  const dst = `${src}.${ts}.bak`
  fs.copyFileSync(src, dst)
  console.log('Backup created:', dst)
}
function exec(db, sql) {
  try { db.prepare(sql).run() } catch (e) {
    const msg = String(e.message || e)
    if (/duplicate|exists|already/i.test(msg)) return // idempotent
    // SQLite ALTER TABLE "duplicate column name" message:
    if (/duplicate column name/i.test(msg)) return
    throw e
  }
}

// --- run ---
;(function main () {
  if (!fs.existsSync(DB_PATH)) {
    console.error('DB not found at', DB_PATH)
    process.exit(1)
  }
  backup(DB_PATH)
  const db = new Database(DB_PATH)
  try {
    // Optional pragmas (best-effort; may no-op)
    try { db.pragma('journal_mode = WAL') } catch (_) {}
    try { db.pragma('busy_timeout = 30000') } catch (_) {}
    try { db.pragma('synchronous = NORMAL') } catch (_) {}

    // ----- WORLDS -----
    exec(db, `CREATE TABLE IF NOT EXISTS worlds (
      id TEXT PRIMARY KEY,
      owner_id TEXT NOT NULL,
      slug TEXT NOT NULL UNIQUE,
      name TEXT NOT NULL,
      is_private INTEGER NOT NULL DEFAULT 0,
      created_at TEXT NOT NULL DEFAULT (datetime('now')),
      updated_at TEXT NOT NULL DEFAULT (datetime('now'))
    )`)
    exec(db, `CREATE INDEX IF NOT EXISTS worlds_owner_id_idx ON worlds(owner_id)`)

    // ----- MEMBERSHIPS -----
    exec(db, `CREATE TABLE IF NOT EXISTS world_memberships (
      id TEXT PRIMARY KEY,
      world_id TEXT NOT NULL,
      user_id TEXT NOT NULL,
      role TEXT NOT NULL DEFAULT 'editor',
      created_at TEXT NOT NULL DEFAULT (datetime('now')),
      updated_at TEXT NOT NULL DEFAULT (datetime('now')),
      UNIQUE(world_id, user_id)
    )`)
    exec(db, `CREATE INDEX IF NOT EXISTS world_memberships_world_id_idx ON world_memberships(world_id)`)
    exec(db, `CREATE INDEX IF NOT EXISTS world_memberships_user_id_idx ON world_memberships(user_id)`)

    // ----- CATEGORIES -----
    exec(db, `CREATE TABLE IF NOT EXISTS categories (
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

    // ----- SUBCATEGORIES -----
    exec(db, `CREATE TABLE IF NOT EXISTS subcategories (
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
    exec(db, `CREATE INDEX IF NOT EXISTS subcategories_category_id_idx ON subcategories(category_id)`)

    // ----- PAGES (add columns if missing) -----
    exec(db, `ALTER TABLE pages ADD COLUMN world_id TEXT`)
    exec(db, `ALTER TABLE pages ADD COLUMN category_id TEXT`)
    exec(db, `ALTER TABLE pages ADD COLUMN subcategory_id TEXT`)
    exec(db, `ALTER TABLE pages ADD COLUMN is_published INTEGER NOT NULL DEFAULT 1`)
    exec(db, `ALTER TABLE pages ADD COLUMN is_private INTEGER NOT NULL DEFAULT 0`)
    exec(db, `ALTER TABLE pages ADD COLUMN guided_data TEXT`)
    exec(db, `CREATE UNIQUE INDEX IF NOT EXISTS pages_world_path_uq ON pages(world_id, path)`)

    // ----- page_contents -----
    exec(db, `CREATE TABLE IF NOT EXISTS page_contents (
      id TEXT PRIMARY KEY,
      page_id TEXT NOT NULL,
      version INTEGER NOT NULL,
      content TEXT NOT NULL,
      created_by TEXT NOT NULL,
      created_at TEXT NOT NULL DEFAULT (datetime('now')),
      UNIQUE(page_id, version)
    )`)

    // ----- page_tags -----
    exec(db, `CREATE TABLE IF NOT EXISTS page_tags (
      page_id TEXT NOT NULL,
      tag TEXT NOT NULL,
      UNIQUE(page_id, tag)
    )`)

    // ----- guided templates / states -----
    exec(db, `CREATE TABLE IF NOT EXISTS guided_templates (
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
    exec(db, `CREATE TABLE IF NOT EXISTS page_guided_states (
      id TEXT PRIMARY KEY,
      page_id TEXT NOT NULL UNIQUE,
      template_id TEXT NOT NULL,
      state TEXT NOT NULL DEFAULT '{}',
      updated_at TEXT NOT NULL DEFAULT (datetime('now'))
    )`)

    console.log('2.6.0 SQLite schema applied.')
  } finally {
    db.close()
  }
})()
