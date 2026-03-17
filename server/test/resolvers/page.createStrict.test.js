/**
 * Unit tests for the createStrict page resolver.
 *
 * Covers: auth guard, input validation, world/locale context matching,
 * duplicate-path enforcement, category/subcategory resolution, and the
 * happy-path transaction (pages + page_contents + page_tags rows).
 */

// ─── Mocks must be declared before any require() that pulls in the module ───

// crypto.randomUUID
jest.mock('crypto', () => ({ randomUUID: () => 'test-page-uuid' }))

// graph helper
jest.mock('../../helpers/graph', () => ({
  generateSuccess: (msg) => ({ succeeded: true, message: msg }),
  generateError: (err) => ({ succeeded: false, message: err.message })
}))

// world util (used by other resolvers in the same file, not createStrict directly)
jest.mock('../../graph/utils/world.js', () => ({ getWorldBySlug: jest.fn() }))

// ─── WIKI global ─────────────────────────────────────────────────────────────

/** Build a chainable, awaitable knex query-builder stub that resolves to `value`. */
function qb (value) {
  const b = {}
  ;['first', 'select', 'where', 'andWhere', 'orderBy', 'limit'].forEach(m => {
    b[m] = jest.fn().mockReturnThis()
  })
  b.insert = jest.fn().mockResolvedValue(undefined)
  b.then = (res, rej) => Promise.resolve(value).then(res, rej)
  b.catch = (rej) => Promise.resolve(value).catch(rej)
  return b
}

/** Build a transaction trx stub whose table calls return insert builders. */
function makeTrx () {
  const ignore = jest.fn().mockResolvedValue(undefined)
  const onConflict = jest.fn().mockReturnValue({ ignore })
  const tableInsert = jest.fn().mockReturnValue({ onConflict })
  const trx = jest.fn().mockReturnValue({ insert: tableInsert })
  trx.fn = { now: () => 'NOW()' }
  return { trx, tableInsert, onConflict, ignore }
}

const mockTransaction = jest.fn()
const mockKnex = jest.fn()
mockKnex.transaction = mockTransaction

global.WIKI = {
  models: { knex: mockKnex },
  config: { lang: { code: 'en' } }
}

// ─── Load resolver after mocks are in place ──────────────────────────────────
const { PageMutation } = require('../../graph/resolvers/page')
const create = PageMutation.create

// ─── Fixtures ────────────────────────────────────────────────────────────────

function ctx ({ worldSlug = 'myworld', locale = 'en', userId = 42 } = {}) {
  return { worldSlug, locale, req: { user: { id: userId } } }
}

function input (overrides = {}) {
  return {
    worldID: 'world-1',
    locale: 'en',
    path: 'characters/aragorn',
    title: 'Aragorn',
    description: 'King of Gondor',
    content: '# Aragorn\n\n## Role\nKing\n',
    editor: 'markdown',
    tags: [],
    categoryKey: 'characters',
    subcategoryKey: null,
    isPublished: true,
    isPrivate: false,
    guidedData: null,
    ...overrides
  }
}

// ─── Tests ───────────────────────────────────────────────────────────────────

beforeEach(() => jest.clearAllMocks())

describe('createStrict — auth & input guards', () => {
  it('throws if user is not authenticated', async () => {
    const noAuth = { worldSlug: 'myworld', locale: 'en', req: { user: {} } }
    await expect(create(null, { input: input() }, noAuth)).rejects.toThrow('Auth required')
  })

  it('throws if worldID is empty', async () => {
    await expect(create(null, { input: input({ worldID: '' }) }, ctx())).rejects.toThrow('worldID is required')
  })

  it('throws if locale is empty', async () => {
    await expect(create(null, { input: input({ locale: '' }) }, ctx())).rejects.toThrow('locale is required')
  })

  it('throws if path is missing', async () => {
    await expect(create(null, { input: input({ path: '' }) }, ctx())).rejects.toThrow('Missing required page fields')
  })

  it('throws if title is missing', async () => {
    await expect(create(null, { input: input({ title: '' }) }, ctx())).rejects.toThrow('Missing required page fields')
  })

  it('throws if editor is missing', async () => {
    await expect(create(null, { input: input({ editor: '' }) }, ctx())).rejects.toThrow('Missing required page fields')
  })
})

describe('createStrict — world & locale context matching', () => {
  it('throws if world is not found in DB', async () => {
    mockKnex.mockReturnValueOnce(qb(null))
    await expect(create(null, { input: input() }, ctx())).rejects.toThrow('World not found')
  })

  it('throws if DB world slug does not match tenant context slug', async () => {
    mockKnex.mockReturnValueOnce(qb({ id: 'world-1', slug: 'otherworld' }))
    await expect(create(null, { input: input() }, ctx({ worldSlug: 'myworld' }))).rejects.toThrow('World mismatch')
  })

  it('throws if input locale does not match tenant context locale', async () => {
    mockKnex.mockReturnValueOnce(qb({ id: 'world-1', slug: 'myworld' }))
    await expect(
      create(null, { input: input({ locale: 'en' }) }, ctx({ worldSlug: 'myworld', locale: 'fr' }))
    ).rejects.toThrow('Locale mismatch')
  })

  it('accepts case-insensitive locale comparison (EN vs en)', async () => {
    mockKnex
      .mockReturnValueOnce(qb({ id: 'world-1', slug: 'myworld' })) // worlds
      .mockReturnValueOnce(qb(null))                                // pages path check
      .mockReturnValueOnce(qb({ id: 'cat-1' }))                    // categories

    const { trx } = makeTrx()
    mockTransaction.mockImplementation(fn => fn(trx))

    const result = await create(
      null,
      { input: input({ locale: 'en' }) },
      ctx({ worldSlug: 'myworld', locale: 'EN' })
    )
    expect(result.responseResult.succeeded).toBe(true)
  })
})

describe('createStrict — duplicate path enforcement', () => {
  it('throws if a page with the same path already exists', async () => {
    mockKnex
      .mockReturnValueOnce(qb({ id: 'world-1', slug: 'myworld' }))
      .mockReturnValueOnce(qb({ id: 'existing-page' })) // existing page found
    await expect(create(null, { input: input() }, ctx())).rejects.toThrow('already exists')
  })
})

describe('createStrict — happy path', () => {
  it('creates page, page_contents, and returns success', async () => {
    mockKnex
      .mockReturnValueOnce(qb({ id: 'world-1', slug: 'myworld' })) // worlds
      .mockReturnValueOnce(qb(null))                                // pages path check
      .mockReturnValueOnce(qb({ id: 'cat-1' }))                    // categories

    const { trx } = makeTrx()
    mockTransaction.mockImplementation(fn => fn(trx))

    const result = await create(null, { input: input() }, ctx())

    expect(result.responseResult.succeeded).toBe(true)
    expect(result.page).toMatchObject({
      id: 'test-page-uuid',
      path: 'characters/aragorn',
      locale: 'en',
      title: 'Aragorn'
    })
    // Transaction was called
    expect(mockTransaction).toHaveBeenCalledTimes(1)
    // Two inserts: pages row + page_contents row
    expect(trx).toHaveBeenCalledWith('pages')
    expect(trx).toHaveBeenCalledWith('page_contents')
  })

  it('inserts tags row when tags are provided', async () => {
    mockKnex
      .mockReturnValueOnce(qb({ id: 'world-1', slug: 'myworld' })) // worlds
      .mockReturnValueOnce(qb(null))                                // pages path check
      .mockReturnValueOnce(qb({ id: 'cat-1' }))                    // categories
      .mockReturnValueOnce(qb({ id: 'sub-1' }))                    // subcategories

    const { trx } = makeTrx()
    mockTransaction.mockImplementation(fn => fn(trx))

    await create(null, {
      input: input({ tags: ['main-characters'], subcategoryKey: 'main-characters' })
    }, ctx())

    expect(trx).toHaveBeenCalledWith('page_tags')
  })

  it('skips tag insert when tags array is empty', async () => {
    mockKnex
      .mockReturnValueOnce(qb({ id: 'world-1', slug: 'myworld' })) // worlds
      .mockReturnValueOnce(qb(null))                                // pages path check
      .mockReturnValueOnce(qb({ id: 'cat-1' }))                    // categories

    const { trx } = makeTrx()
    mockTransaction.mockImplementation(fn => fn(trx))

    await create(null, { input: input({ tags: [] }) }, ctx())

    const tablesCalled = trx.mock.calls.map(c => c[0])
    expect(tablesCalled).not.toContain('page_tags')
  })

  it('resolves subcategoryId when both categoryKey and subcategoryKey are provided', async () => {
    mockKnex
      .mockReturnValueOnce(qb({ id: 'world-1', slug: 'myworld' })) // worlds
      .mockReturnValueOnce(qb(null))                                // pages path check
      .mockReturnValueOnce(qb({ id: 'cat-1' }))                    // categories
      .mockReturnValueOnce(qb({ id: 'sub-1' }))                    // subcategories

    const { trx, tableInsert } = makeTrx()
    mockTransaction.mockImplementation(fn => fn(trx))

    await create(null, {
      input: input({ subcategoryKey: 'main-characters', tags: ['main-characters'] })
    }, ctx())

    // The pages insert should include subcategory_id: 'sub-1'
    const pagesInsertArg = tableInsert.mock.calls[0][0]
    expect(pagesInsertArg.subcategory_id).toBe('sub-1')
  })

  it('passes guidedData as JSON into the pages row', async () => {
    mockKnex
      .mockReturnValueOnce(qb({ id: 'world-1', slug: 'myworld' })) // worlds
      .mockReturnValueOnce(qb(null))                                // pages path check
      .mockReturnValueOnce(qb({ id: 'cat-1' }))                    // categories

    const { trx, tableInsert } = makeTrx()
    mockTransaction.mockImplementation(fn => fn(trx))

    const guided = { role: 'King', affiliation: 'Gondor' }
    await create(null, { input: input({ guidedData: guided }) }, ctx())

    const pagesInsertArg = tableInsert.mock.calls[0][0]
    expect(pagesInsertArg.guided_data).toBe(JSON.stringify(guided))
  })
})
