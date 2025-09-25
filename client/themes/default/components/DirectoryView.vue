<template lang="pug">
.div.directory-view
  v-toolbar(:color="$vuetify.theme.dark ? 'grey darken-4-d3' : 'grey lighten-3'", flat, dense)
    v-icon.left.mr-2 {{ icon }}
    span.subtitle-1.font-weight-medium {{ title }}
    v-spacer
    v-chip(x-small outlined) {{ items.length }} pages

  v-list(nav dense two-line)
    v-list-item(
      v-for="p in items"
      :key="p.id"
      tag="a"
      :href="linkFor(p)"
      :ripple="false"
    )
      v-list-item-content
        v-list-item-title {{ p.title || lastSegment(p.path) }}
        v-list-item-subtitle.caption.grey--text {{ p.path }}

  v-alert(v-if="!loading && items.length === 0" type="info" outlined dense)
    | No pages here yet. Create one with the “New Page” button.
</template>

<script>
import gql from 'graphql-tag'

// Self-contained search query (no external .gql file needed)
const SEARCH = gql`
  query {
    pages {
      search(query: "") {
        results {
          id
          title
          path
          category
        }
      }
    }
  }
`

export default {
  name: 'DirectoryView',
  props: {
    // e.g. "characters", "locations" (no leading/trailing slashes)
    prefix: { type: String, required: true },
    title: { type: String, default: '' },
    icon: { type: String, default: 'mdi-folder' },
    locale: { type: String, required: true }
  },
  data () {
    return {
      loading: false,
      items: []
    }
  },
  computed: {
    prefixNorm () {
      return (this.prefix || '').replace(/^\/+|\/+$/g, '')
    }
  },
  methods: {
    lastSegment (p) {
      const parts = (p || '').split('/')
      return parts[parts.length - 1] || p
    },
    isUnderPrefix (p) {
      const clean = (p || '').replace(/^\/+|\/+$/g, '')
      // only include children like "characters/..." (not the section page itself)
      return this.prefixNorm && clean.startsWith(this.prefixNorm + '/')
    },
    linkFor (p) {
      // Build a normal wiki URL for the current locale
      return `/${this.locale}/${p.path}`
    },
    async load () {
      this.loading = true
      try {
        const { data } = await this.$apollo.query({
          query: SEARCH,
          fetchPolicy: 'network-only'
        })
        const all = ((((data || {}).pages || {}).search || {}).results) || []
        this.items = all
          .filter(r => this.isUnderPrefix(r.path))
          .sort((a, b) => (a.title || '').localeCompare(b.title || ''))
      } catch (e) {
        console.error('DirectoryView load failed:', e)
        this.items = []
      } finally {
        this.loading = false
      }
    }
  },
  mounted () {
    this.load()
  }
}
</script>

<style scoped>
.directory-view .v-list-item__title {
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
}
</style>
