/* global WIKI */
const crypto = require('crypto')
const graphHelper = require('../../helpers/graph')
const { getWorldBySlug } = require('../utils/world')
const { seedWorldCatalog } = require('../utils/worldCatalog')

module.exports = {
  Mutation: {
    async createWorld(_, { slug, name, isPrivate = false }, ctx) {
      try {
        if (!ctx?.req?.user?.id) throw new Error('Auth required')

        // ensure unique slug
        const existing = await getWorldBySlug(slug)
        if (existing) throw new Error('World slug already exists')

        const id = crypto.randomUUID()
        // insert world
        await WIKI.db.sequelize.query(
          `INSERT INTO worlds (id, owner_id, slug, name, is_private)
           VALUES ($1,$2,$3,$4,$5)`,
          { bind: [id, ctx.req.user.id, slug, name, !!isPrivate] }
        )

        // owner membership
        await WIKI.db.sequelize.query(
          `INSERT INTO world_memberships (id, world_id, user_id, role)
           VALUES ($1,$2,$3,$4)`,
          { bind: [crypto.randomUUID(), id, ctx.req.user.id, 'owner'] }
        )

        // seed official categories/subcategories
        await seedWorldCatalog(id)

        return {
          responseResult: graphHelper.generateSuccess('World created.'),
          world: { id, slug, name, isPrivate: !!isPrivate }
        }
      } catch (err) {
        return graphHelper.generateError(err)
      }
    }
  }
}
