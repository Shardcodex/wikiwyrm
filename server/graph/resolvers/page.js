/* global WIKI */
const _ = require('lodash')
const crypto = require('crypto')
const graphHelper = require('../../helpers/graph')
const { getWorldBySlug } = require('../utils/world.js')

// ---------- helpers ----------
function normLocale(input) {
  const raw = (input || 'en').toString().trim()
  const base = raw.split(/[-_]/)[0].toLowerCase()
  return { raw, base }
}
async function loadWorldOrThrow(ctx) {
  const slug = ctx && ctx.worldSlug
  if (!slug) throw new Error('World slug missing')
  const world = await getWorldBySlug(slug)
  if (!world) throw new Error('World not found')
  return world
}
async function createStrict(_parent, { input }, context) {
  const k = WIKI.models.knex
  const userId = context?.req?.user?.id
  if (!userId) throw new Error('Auth required')

  // ---- required fields from input ----
  const {
    worldID, // required (ID of worlds.id)
    locale, // required (e.g. "en")
    path, title, description,
    content = '',
    editor,
    tags = [],
    categoryKey,
    subcategoryKey,
    isPublished = true,
    isPrivate = false,
    guidedData
  } = input

  if (!worldID) throw new Error('worldID is required')
  if (!locale) throw new Error('locale is required')
  if (!path || !title || !editor) throw new Error('Missing required page fields')

  // ---- load world by ID and compare with tenant context ----
  const world = await k('worlds').first(['id', 'slug']).where({ id: worldID })
  if (!world) throw new Error('World not found')

  // Context comes from your tenant middleware (URL/headers)
  const ctxSlug = context?.worldSlug
  const ctxLocale = context?.locale || (WIKI?.config?.lang?.code || 'en')

  // HARD guarantees: refuse if mismatched
  if (!ctxSlug || world.slug !== ctxSlug) {
    throw new Error('World mismatch (context vs input)')
  }
  if (ctxLocale.toLowerCase() !== locale.toLowerCase()) {
    throw new Error('Locale mismatch (context vs input)')
  }

  // ---- enforce unique path within world + locale ----
  const existing = await k('pages')
    .first('id')
    .where({ world_id: world.id, localeCode: locale, path })
  if (existing) throw new Error('A page with this path already exists in this world/locale')

  // ---- optional: resolve category/subcategory ids ----
  let categoryId = null
  if (categoryKey) {
    const c = await k('categories').first('id').where({ world_id: world.id, key: categoryKey })
    categoryId = c?.id || null
  }
  let subcategoryId = null
  if (subcategoryKey && categoryId) {
    const s = await k('subcategories')
      .first('id')
      .where({ world_id: world.id, category_id: categoryId, key: subcategoryKey })
    subcategoryId = s?.id || null
  }

  const pageId = crypto.randomUUID()

  // ---- write in a single transaction ----
  await k.transaction(async trx => {
    await trx('pages').insert({
      id: pageId,
      world_id: world.id,
      creatorId: userId, // Wiki.js stock column
      path,
      localeCode: locale, // Wiki.js stock column
      title,
      description,
      editorKey: editor, // Wiki.js stock column
      category: categoryKey || null, // keep display category for stock UI
      category_id: categoryId,
      subcategory_id: subcategoryId,
      isPublished: isPublished ? 1 : 0,
      isPrivate: isPrivate ? 1 : 0,
      guided_data: guidedData ? JSON.stringify(guidedData) : null,
      createdAt: trx.fn.now(),
      updatedAt: trx.fn.now()
    })

    await trx('page_contents').insert({
      id: crypto.randomUUID(),
      page_id: pageId,
      version: 1,
      content,
      created_by: userId,
      created_at: trx.fn.now()
    })

    if (tags.length) {
      await trx('page_tags')
        .insert(tags.map(t => ({ page_id: pageId, tag: t })))
        .onConflict(['page_id', 'tag']).ignore()
    }
  })

  return {
    responseResult: graphHelper.generateSuccess('Page created successfully.'),
    page: { id: pageId, path, locale, title }
  }
}

module.exports = {
  // ---------------------------------
  // Root Query / Mutation namespaces
  // ---------------------------------
  Query: {
    async pages () { return {} },

    // Keep if your SDL exposes this at root.
    async pageByPath(_, { path, locale }, context) {
      const world = await loadWorldOrThrow(context)
      const loc = locale || context.locale || 'en'

      const row = await WIKI.models.knex('pages')
        .first([
          'id',
          'path',
          'title',
          'description',
          { editor: 'editorKey' },
          'category',
          'isPublished',
          'isPrivate',
          { locale: 'localeCode' }
        ])
        .where('world_id', world.id)
        .andWhere('localeCode', loc)
        .andWhere('path', path)

      return row || null
    },
    async worldBySlug(_p, { slug }) {
      const row = await WIKI.models.knex('worlds')
        .first(['id', 'slug', 'name'])
        .where({ slug })
      return row || null
    }
  },

  Mutation: {
    async pages () { return {} }
  },

  // ---------------------------------
  // PageQuery (everything under Query.pages)
  // ---------------------------------
  PageQuery: {
    /**
     * Simple list used by CategorySidebar
     */
    async listSimple (_, args, context) {
      const world = await loadWorldOrThrow(context)
      const loc = args.locale || context.locale || 'en'
      const limit = Math.min(Math.max(args.limit || 200, 1), 500)

      const rows = await WIKI.models.knex('pages')
        .select([
          'id',
          'path',
          'title',
          'description',
          { locale: 'localeCode' },
          'category'
        ])
        .where('world_id', world.id)
        .andWhere('localeCode', loc)
        .orderBy('title', 'asc')
        .limit(limit)

      return rows.map(r => ({
        ...r,
        category: _.isString(r.category) ? r.category : 'Other'
      }))
    },

    /**
     * PAGE HISTORY
     */
    async history(obj, args, context) {
      const page = await WIKI.models.pages.query().select('path', 'localeCode').findById(args.id)
      if (WIKI.auth.checkAccess(context.req.user, ['read:history'], {
        path: page.path,
        locale: page.localeCode
      })) {
        return WIKI.models.pageHistory.getHistory({
          pageId: args.id,
          offsetPage: args.offsetPage || 0,
          offsetSize: args.offsetSize || 100
        })
      } else {
        throw new WIKI.Error.PageHistoryForbidden()
      }
    },

    /**
     * PAGE VERSION
     */
    async version(obj, args, context) {
      const page = await WIKI.models.pages.query().select('path', 'localeCode').findById(args.pageId)
      if (WIKI.auth.checkAccess(context.req.user, ['read:history'], {
        path: page.path,
        locale: page.localeCode
      })) {
        return WIKI.models.pageHistory.getVersion({
          pageId: args.pageId,
          versionId: args.versionId
        })
      } else {
        throw new WIKI.Error.PageHistoryForbidden()
      }
    },

    /**
     * SEARCH PAGES
     */
    async search (obj, args, context) {
      if (WIKI.data.searchEngine) {
        const resp = await WIKI.data.searchEngine.query(args.query, args)
        return {
          ...resp,
          results: _.filter(resp.results, r => {
            return WIKI.auth.checkAccess(context.req.user, ['read:pages'], {
              path: r.path,
              locale: r.locale,
              tags: r.tags // Tags are needed since access permissions can be limited by page tags too
            })
          })
        }
      } else {
        return {
          results: [],
          suggestions: [],
          totalHits: 0
        }
      }
    },

    /**
     * LIST PAGES (scoped by world)
     */
    async list (obj, args, context) {
      const world = await loadWorldOrThrow(context)
      let results = await WIKI.models.pages.query().column([
        'pages.id',
        'path',
        { locale: 'localeCode' },
        'title',
        'description',
        'isPublished',
        'isPrivate',
        'privateNS',
        'contentType',
        'createdAt',
        'updatedAt',
        'category',
        'featured'
      ])
        .withGraphJoined('tags')
        .modifyGraph('tags', builder => { builder.select('tag') })
        .modify(qb => {
          qb.where('pages.world_id', world.id)

          if (args.limit) qb.limit(args.limit)
          if (args.locale) qb.where('localeCode', args.locale)

          if (args.creatorId && args.authorId && args.creatorId > 0 && args.authorId > 0) {
            qb.where(function () {
              this.where('creatorId', args.creatorId).orWhere('authorId', args.authorId)
            })
          } else {
            if (args.creatorId && args.creatorId > 0) qb.where('creatorId', args.creatorId)
            if (args.authorId && args.authorId > 0) qb.where('authorId', args.authorId)
          }

          if (args.tags && args.tags.length > 0) {
            qb.whereIn('tags.tag', args.tags.map(t => _.trim(t).toLowerCase()))
          }
          if (args.category) {
            qb.where('category', args.category)
          }
          if (args.filter && typeof args.filter.featured === 'boolean') {
            qb.where('featured', args.filter.featured ? 1 : 0)
          }
          const orderDir = args.orderByDirection === 'DESC' ? 'desc' : 'asc'
          switch (args.orderBy) {
            case 'CREATED': qb.orderBy('createdAt', orderDir); break
            case 'PATH': qb.orderBy('path', orderDir); break
            case 'TITLE': qb.orderBy('title', orderDir); break
            case 'UPDATED': qb.orderBy('updatedAt', orderDir); break
            default: qb.orderBy('pages.id', orderDir); break
          }
        })

      results = _.filter(results, r => {
        return WIKI.auth.checkAccess(context.req.user, ['read:pages'], {
          path: r.path,
          locale: r.locale
        })
      }).map(r => ({
        ...r,
        tags: _.map(r.tags, 'tag'),
        category: typeof r.category === 'string' ? r.category : 'Other',
        featured: (r.featured === 1 || r.featured === true)
      }))

      if (args.tags && args.tags.length > 0) {
        results = _.filter(results, r => _.every(args.tags, t => _.includes(r.tags, t)))
      }
      return results
    },

    /**
     * FETCH SINGLE PAGE (by id)
     */
    async single (obj, args, context) {
      await loadWorldOrThrow(context) // ensure world present; base fetch remains
      const page = await WIKI.models.pages.getPageFromDb(args.id)
      if (page) {
        if (WIKI.auth.checkAccess(context.req.user, ['manage:pages', 'delete:pages'], {
          path: page.path,
          locale: page.localeCode
        })) {
          return {
            ...page,
            locale: page.localeCode,
            category: page.category || 'Other',
            editor: page.editorKey,
            scriptJs: page.extra.js,
            scriptCss: page.extra.css
          }
        } else {
          throw new WIKI.Error.PageViewForbidden()
        }
      } else {
        throw new WIKI.Error.PageNotFound()
      }
    },

    /**
     * FETCH SINGLE PAGE (by path/locale)
     */
    async singleByPath(obj, args, context) {
      await loadWorldOrThrow(context)
      const page = await WIKI.models.pages.getPageFromDb({
        path: args.path,
        locale: args.locale
      })
      if (page) {
        if (WIKI.auth.checkAccess(context.req.user, ['manage:pages', 'delete:pages'], {
          path: page.path,
          locale: page.localeCode
        })) {
          return {
            ...page,
            locale: page.localeCode,
            editor: page.editorKey,
            category: page.category || 'Other',
            scriptJs: page.extra.js,
            scriptCss: page.extra.css
          }
        } else {
          throw new WIKI.Error.PageViewForbidden()
        }
      } else {
        throw new WIKI.Error.PageNotFound()
      }
    },

    /**
     * FETCH TAGS
     */
    async tags (obj, args, context) {
      await loadWorldOrThrow(context)
      const pages = await WIKI.models.pages.query()
        .column(['path', { locale: 'localeCode' }])
        .withGraphJoined('tags')
      const allTags = _.filter(pages, r => {
        return WIKI.auth.checkAccess(context.req.user, ['read:pages'], {
          path: r.path,
          locale: r.locale
        })
      }).flatMap(r => r.tags)
      return _.orderBy(_.uniqBy(allTags, 'id'), ['tag'], ['asc'])
    },

    /**
     * SEARCH TAGS
     */
    async searchTags (obj, args, context) {
      await loadWorldOrThrow(context)
      const query = _.trim(args.query)
      const pages = await WIKI.models.pages.query()
        .column(['path', { locale: 'localeCode' }])
        .withGraphJoined('tags')
        .modifyGraph('tags', builder => { builder.select('tag') })
        .modify(qb => {
          qb.andWhere(sub => {
            if (WIKI.config.db.type === 'postgres') {
              sub.where('tags.tag', 'ILIKE', `%${query}%`)
            } else {
              sub.where('tags.tag', 'LIKE', `%${query}%`)
            }
          })
        })
      const allTags = _.filter(pages, r => {
        return WIKI.auth.checkAccess(context.req.user, ['read:pages'], {
          path: r.path,
          locale: r.locale
        })
      }).flatMap(r => r.tags).map(t => t.tag)
      return _.uniq(allTags).slice(0, 5)
    },

    /**
     * FETCH PAGE TREE (scoped by world)
     */
    async tree (obj, args, context) {
      const world = await loadWorldOrThrow(context)
      const { base } = normLocale(args && args.locale ? args.locale : (context && context.locale) || 'en')

      let curPage = null
      if (args && args.path && !args.parent) {
        curPage = await WIKI.models.knex('pageTree')
          .first('parent', 'ancestors')
          .where(function (builder) {
            builder.whereRaw('LOWER(localeCode) LIKE ?', [base + '%'])
            builder.andWhere('path', args.path)
          })
        if (curPage) {
          args.parent = curPage.parent || 0
        } else {
          return []
        }
      }

      const results = await WIKI.models.knex('pageTree')
        .leftJoin('pages', 'pages.id', 'pageTree.pageId')
        .where(builder => {
          builder.whereRaw('LOWER(pageTree.localeCode) LIKE ?', [`${base}%`])
          // include folder rows (no pageId) OR pages that belong to this world
          builder.andWhere(function () {
            this.where('pages.world_id', world.id).orWhereNull('pageTree.pageId')
          })
          switch (args.mode) {
            case 'FOLDERS':
              builder.andWhere('pageTree.isFolder', true)
              break
            case 'PAGES':
              builder.andWhereNotNull('pageTree.pageId')
              break
          }
          if (!args.parent || args.parent < 1) {
            builder.whereNull('pageTree.parent')
          } else {
            builder.where('pageTree.parent', args.parent)
            if (args.includeAncestors && curPage && curPage.ancestors && curPage.ancestors.length > 0) {
              const anc = _.isString(curPage.ancestors) ? JSON.parse(curPage.ancestors) : curPage.ancestors
              builder.orWhereIn('pageTree.id', anc)
            }
          }
        })
        .orderBy([{ column: 'pageTree.isFolder', order: 'desc' }, 'pageTree.title'])

      return results.filter(r => {
        return WIKI.auth.checkAccess(context.req.user, ['read:pages'], {
          path: r.path,
          locale: r.localeCode
        })
      }).map(r => ({
        ...r,
        parent: r.parent || 0,
        locale: r.localeCode
      }))
    },

    /**
     * FETCH PAGE LINKS
     */
    async links (obj, args, context) {
      await loadWorldOrThrow(context)
      let results

      if (WIKI.config.db.type === 'mysql' || WIKI.config.db.type === 'mariadb' || WIKI.config.db.type === 'sqlite') {
        results = await WIKI.models.knex('pages')
          .column({ id: 'pages.id' }, { path: 'pages.path' }, 'title', { link: 'pageLinks.path' }, { locale: 'pageLinks.localeCode' })
          .leftJoin('pageLinks', 'pages.id', 'pageLinks.pageId')
          .where({ 'pages.localeCode': args.locale })
          .unionAll(
            WIKI.models.knex('pageLinks')
              .column({ id: 'pages.id' }, { path: 'pages.path' }, 'title', { link: 'pageLinks.path' }, { locale: 'pageLinks.localeCode' })
              .leftJoin('pages', 'pageLinks.pageId', 'pages.id')
              .where({ 'pages.localeCode': args.locale })
          )
      } else {
        results = await WIKI.models.knex('pages')
          .column({ id: 'pages.id' }, { path: 'pages.path' }, 'title', { link: 'pageLinks.path' }, { locale: 'pageLinks.localeCode' })
          .fullOuterJoin('pageLinks', 'pages.id', 'pageLinks.pageId')
          .where({ 'pages.localeCode': args.locale })
      }

      return _.reduce(results, (result, val) => {
        if (
          !WIKI.auth.checkAccess(context.req.user, ['read:pages'], { path: val.path, locale: args.locale }) ||
          !WIKI.auth.checkAccess(context.req.user, ['read:pages'], { path: val.link, locale: val.locale })
        ) {
          return result
        }

        const existingEntry = _.findIndex(result, ['id', val.id])
        if (existingEntry >= 0) {
          if (val.link) result[existingEntry].links.push(`${val.locale}/${val.link}`)
        } else {
          result.push({
            id: val.id,
            title: val.title,
            path: `${args.locale}/${val.path}`,
            links: val.link ? [`${val.locale}/${val.link}`] : []
          })
        }
        return result
      }, [])
    },

    /**
     * CHECK FOR EDITING CONFLICT
     */
    async checkConflicts (obj, args, context) {
      const page = await WIKI.models.pages.query().select('path', 'localeCode', 'updatedAt').findById(args.id)
      if (page) {
        if (WIKI.auth.checkAccess(context.req.user, ['write:pages', 'manage:pages'], {
          path: page.path,
          locale: page.localeCode
        })) {
          return page.updatedAt > args.checkoutDate
        } else {
          throw new WIKI.Error.PageUpdateForbidden()
        }
      } else {
        throw new WIKI.Error.PageNotFound()
      }
    },

    /**
     * FETCH LATEST VERSION FOR CONFLICT COMPARISON
     */
    async conflictLatest (obj, args, context) {
      const page = await WIKI.models.pages.getPageFromDb(args.id)
      if (page) {
        if (WIKI.auth.checkAccess(context.req.user, ['write:pages', 'manage:pages'], {
          path: page.path,
          locale: page.localeCode
        })) {
          return {
            ...page,
            tags: page.tags.map(t => t.tag),
            locale: page.localeCode
          }
        } else {
          throw new WIKI.Error.PageViewForbidden()
        }
      } else {
        throw new WIKI.Error.PageNotFound()
      }
    }
  },

  // ---------------------------------
  // PageMutation (everything under Mutation.pages)
  // ---------------------------------
  PageMutation: {
    /**
     * CREATE PAGE (world-aware)
     */
    create: createStrict,

    /**
     * UPDATE PAGE
     */
    async update(obj, args, context) {
      try {
        const page = await WIKI.models.pages.updatePage({
          ...args,
          user: context.req.user
        })
        return {
          responseResult: graphHelper.generateSuccess('Page has been updated.'),
          page
        }
      } catch (err) {
        return graphHelper.generateError(err)
      }
    },

    /**
     * CONVERT PAGE
     */
    async convert(obj, args, context) {
      try {
        await WIKI.models.pages.convertPage({
          ...args,
          user: context.req.user
        })
        return {
          responseResult: graphHelper.generateSuccess('Page has been converted.')
        }
      } catch (err) {
        return graphHelper.generateError(err)
      }
    },

    /**
     * MOVE PAGE
     */
    async move(obj, args, context) {
      try {
        await WIKI.models.pages.movePage({
          ...args,
          user: context.req.user
        })
        return {
          responseResult: graphHelper.generateSuccess('Page has been moved.')
        }
      } catch (err) {
        return graphHelper.generateError(err)
      }
    },

    /**
     * DELETE PAGE
     */
    async delete(obj, args, context) {
      try {
        await WIKI.models.pages.deletePage({
          ...args,
          user: context.req.user
        })
        return {
          responseResult: graphHelper.generateSuccess('Page has been deleted.')
        }
      } catch (err) {
        return graphHelper.generateError(err)
      }
    },

    /**
     * DELETE TAG
     */
    async deleteTag (obj, args, context) {
      try {
        const tagToDel = await WIKI.models.tags.query().findById(args.id)
        if (tagToDel) {
          await tagToDel.$relatedQuery('pages').unrelate()
          await WIKI.models.tags.query().deleteById(args.id)
        } else {
          throw new Error('This tag does not exist.')
        }
        return {
          responseResult: graphHelper.generateSuccess('Tag has been deleted.')
        }
      } catch (err) {
        return graphHelper.generateError(err)
      }
    },

    /**
     * UPDATE TAG
     */
    async updateTag (obj, args) {
      try {
        const affectedRows = await WIKI.models.tags.query()
          .findById(args.id)
          .patch({
            tag: _.trim(args.tag).toLowerCase(),
            title: _.trim(args.title)
          })
        if (affectedRows < 1) throw new Error('This tag does not exist.')
        return {
          responseResult: graphHelper.generateSuccess('Tag has been updated successfully.')
        }
      } catch (err) {
        return graphHelper.generateError(err)
      }
    },

    /**
     * FLUSH PAGE CACHE
     */
    async flushCache() {
      try {
        await WIKI.models.pages.flushCache()
        WIKI.events.outbound.emit('flushCache')
        return {
          responseResult: graphHelper.generateSuccess('Pages Cache has been flushed successfully.')
        }
      } catch (err) {
        return graphHelper.generateError(err)
      }
    },

    /**
     * MIGRATE ALL PAGES FROM SOURCE LOCALE TO TARGET LOCALE
     */
    async migrateToLocale(obj, args) {
      try {
        const count = await WIKI.models.pages.migrateToLocale(args)
        return {
          responseResult: graphHelper.generateSuccess('Migrated content to target locale successfully.'),
          count
        }
      } catch (err) {
        return graphHelper.generateError(err)
      }
    },

    /**
     * REBUILD TREE
     */
    async rebuildTree() {
      try {
        await WIKI.models.pages.rebuildTree()
        return {
          responseResult: graphHelper.generateSuccess('Page tree rebuilt successfully.')
        }
      } catch (err) {
        return graphHelper.generateError(err)
      }
    },

    /**
     * RENDER PAGE
     */
    async render (obj, args) {
      try {
        const page = await WIKI.models.pages.query().findById(args.id)
        if (!page) throw new WIKI.Error.PageNotFound()
        await WIKI.models.pages.renderPage(page)
        return {
          responseResult: graphHelper.generateSuccess('Page rendered successfully.')
        }
      } catch (err) {
        return graphHelper.generateError(err)
      }
    },

    /**
     * RESTORE PAGE VERSION
     */
    async restore (obj, args, context) {
      try {
        const page = await WIKI.models.pages.query().select('path', 'localeCode').findById(args.pageId)
        if (!page) throw new WIKI.Error.PageNotFound()

        if (!WIKI.auth.checkAccess(context.req.user, ['write:pages'], {
          path: page.path,
          locale: page.localeCode
        })) {
          throw new WIKI.Error.PageRestoreForbidden()
        }

        const targetVersion = await WIKI.models.pageHistory.getVersion({ pageId: args.pageId, versionId: args.versionId })
        if (!targetVersion) throw new WIKI.Error.PageNotFound()

        await WIKI.models.pages.updatePage({
          ...targetVersion,
          id: targetVersion.pageId,
          user: context.req.user,
          action: 'restored'
        })

        return {
          responseResult: graphHelper.generateSuccess('Page version restored successfully.')
        }
      } catch (err) {
        return graphHelper.generateError(err)
      }
    },

    /**
     * Purge history
     */
    async purgeHistory (obj, args) {
      try {
        await WIKI.models.pageHistory.purge(args.olderThan)
        return {
          responseResult: graphHelper.generateSuccess('Page history purged successfully.')
        }
      } catch (err) {
        return graphHelper.generateError(err)
      }
    }
  },

  // ---------------------------------
  // Type mappers
  // ---------------------------------
  Page: {
    async tags (obj) {
      return WIKI.models.pages.relatedQuery('tags').for(obj.id)
    }
  },

  PageSearchResult: {
    category: (page) => (typeof page.category === 'string' ? page.category : 'Other'),
    tags: (page) => page.tags || []
  }
}
