<template>
  <div class="category-sidebar">
    <h4 class="sidebar-heading">
      Categories
    </h4>

    <ul class="sidebar-list">
      <li
        v-for="cat in visibleCategories"
        :key="cat.name"
      >
        <div class="cat-row">
          <span class="cat-name">{{ cat.name }}</span>
          <span class="cat-count">({{ cat.pages.length }})</span>
        </div>

        <ul class="page-list">
          <li
            v-for="p in cat.pages"
            :key="p.id"
          >
            <a :href="pageHref(p)">{{ p.title || p.path }}</a>
          </li>
        </ul>
      </li>
    </ul>
  </div>
</template>

<script>
import gql from 'graphql-tag'

// Use pages.list (lighter than search) and include path + category.
const LIST_PAGES = gql`
  query($locale: String) {
    pages {
      list(locale: $locale, limit: 1000) {
        id
        title
        path
        category
      }
    }
  }
`

export default {
  data() {
    return {
      locale: (window?.CONFIG?.lang?.code) || 'en',
      categories: ['Characters', 'Locations', 'Items', 'Factions', 'Magic', 'Languages', 'Other'],
      pages: []
    }
  },
  computed: {
    // Group pages by category; only show categories that have at least one page
    visibleCategories() {
      const byCat = new Map(this.categories.map(c => [c, []]))
      for (const p of this.pages) {
        const cat = (p.category && this.categories.includes(p.category)) ? p.category : 'Other'
        byCat.get(cat).push(p)
      }
      return this.categories
        .map(name => ({ name, pages: byCat.get(name) || [] }))
        .filter(c => c.pages.length > 0)
    }
  },
  async mounted() {
    try {
      const { data } = await this.$apollo.query({
        query: LIST_PAGES,
        variables: { locale: this.locale },
        fetchPolicy: 'network-only'
      })
      // Defensive normalize: ensure path/title exist
      this.pages = (data?.pages?.list || [])
        .filter(p => p && p.path) // need path to link
        .map(p => ({ ...p, title: p.title || p.path, category: p.category || 'Other' }))
        .sort((a, b) => (a.title || '').localeCompare(b.title || ''))
    } catch (err) {
      console.error('CategorySidebar: failed to load pages:', err)
      this.pages = []
    }
  },
  methods: {
    pageHref(p) {
      return `/${this.locale}/${p.path}`
    }
  }
}
</script>

<style scoped>
.category-sidebar { padding: 1rem; }
.sidebar-heading { font-weight: 600; margin: .5rem 0 .25rem; }
.sidebar-list, .page-list { list-style: none; padding: 0; margin: 0; }
.cat-row { margin: .5rem 0 .25rem; }
.cat-name { font-weight: 600; }
.cat-count { opacity: .6; margin-left: .25rem; }
.page-list > li { margin: .125rem 0; }
.page-list a { text-decoration: none; }
.page-list a:hover { text-decoration: underline; }
</style>
