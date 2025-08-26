<template>
  <button
    class="fav-btn"
    :aria-pressed="on"
    @click="toggle"
    :title="on ? 'Unfeature' : 'Feature'"
  >
    <span v-if="on">❤️</span>
    <span v-else>🤍</span>
  </button>
</template>

<script>
import gql from 'graphql-tag'

const TOGGLE = gql`
  mutation ToggleFeatured($id: Int!, $featured: Boolean!) {
    pages {
      update(id: $id, featured: $featured) {
        responseResult { succeeded message }
        page { id featured }
      }
    }
  }
`

export default {
  name: 'FavoritePageButton',
  props: {
    id: { type: Number, required: true },
    featured: { type: Boolean, default: false }
  },
  data() {
    return { on: this.featured }
  },
  watch: {
    featured(v) { this.on = !!v }
  },
  methods: {
    async toggle() {
      try {
        const { data } = await this.$apollo.mutate({
          mutation: TOGGLE,
          variables: { id: this.id, featured: !this.on }
        })
        const ok = data?.pages?.update?.responseResult?.succeeded
        if (ok) this.on = !this.on
      } catch (e) {
        console.error('Toggle featured failed', e)
      }
    }
  }
}
</script>

<style scoped>
.fav-btn { background: transparent; border: 0; cursor: pointer; font-size: 1.1rem; }
</style>
