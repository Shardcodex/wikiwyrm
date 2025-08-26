<template lang="pug">
  v-list.dense.nav-quick
    v-subheader.pl-4 Categories

    v-list-group(
      v-for="cat in categoriesWithCounts"
      :key="cat.name"
      no-action
      :disabled="isEmpty(cat.name)"
      :prepend-icon="iconFor(cat.name)"
      append-icon=""
      :value="!isEmpty(cat.name) && isGroupOpen(cat.name)"
      :class="{ 'is-disabled': isEmpty(cat.name) }"
      @click:active="!isEmpty(cat.name) && toggleGroup(cat.name)"
    )
      template(v-slot:activator)
        v-list-item-content
          v-list-item-title {{ cat.name }}
        v-spacer
        v-chip.count-chip(
          x-small
          outlined
          :class="{ 'empty-chip': isEmpty(cat.name) }"
        ) {{ cat.count }}

      // children (only render when not empty)
      template(v-if="!isEmpty(cat.name)")
        v-list-item.quick-link(
          v-for="p in pagesByCategory[cat.name]"
          :key="p.id"
          tag="a"
          :href="linkFor(p)"
          :ripple="false"
        )
          v-list-item-content
            v-list-item-title {{ p.title || p.path }}
</template>

<script>
import gql from 'graphql-tag'

// Use SEARCH because it already works in your app and doesn’t depend on your new list args
const QUERY = gql`
  query {
    pages {
      search(query: "") {
        results {
          id
          path
          title
          category
        }
      }
    }
  }
`

export default {
  name: 'CategorySidebar',
  data () {
    return {
      allPages: [],
      openGroups: {},
      categoriesMaster: [
        'Characters', 'Locations', 'Items', 'Factions', 'Magic', 'Languages', 'Other'
      ],
      iconMap: {
        Characters: { full: 'mdi-account-group', empty: 'mdi-account-outline' },
        Locations: { full: 'mdi-map-marker-radius', empty: 'mdi-map-marker-outline' },
        Items: { full: 'mdi-sword', empty: 'mdi-sword-cross' },
        Factions: { full: 'mdi-shield-account', empty: 'mdi-shield-outline' },
        Magic: { full: 'mdi-auto-fix', empty: 'mdi-auto-fix' },
        Languages: { full: 'mdi-alphabet-greek', empty: 'mdi-alphabet-greek' },
        Other: { full: 'mdi-folder', empty: 'mdi-folder-outline' }
      },
      locale: 'en'
    }
  },
  computed: {
    pagesByCategory () {
      const byCat = {}
      for (const p of (this.allPages || [])) {
        const cat = (p.category && typeof p.category === 'string') ? p.category : 'Other'
        if (!byCat[cat]) byCat[cat] = []
        byCat[cat].push(p)
      }
      // ensure all masters exist
      for (const name of this.categoriesMaster) {
        if (!byCat[name]) byCat[name] = []
      }
      // optional sort
      Object.keys(byCat).forEach(k => byCat[k].sort((a, b) => (a.title || '').localeCompare(b.title || '')))
      return byCat
    },
    categoriesWithCounts () {
      return this.categoriesMaster.map(name => ({
        name,
        count: (this.pagesByCategory[name] || []).length
      }))
    }
  },

  methods: {
    isGroupOpen (name) {
      return !!this.openGroups[name]
    },
    toggleGroup (name) {
      const next = !this.isGroupOpen(name)
      if (this.$set) this.$set(this.openGroups, name, next)
      else this.openGroups[name] = next
    },
    iconFor (name) {
      const map = this.iconMap[name] || { full: 'mdi-folder', empty: 'mdi-folder-outline' }
      const hasPages = !!(this.pagesByCategory &&
        Array.isArray(this.pagesByCategory[name]) &&
        this.pagesByCategory[name].length)
      return hasPages ? map.full : map.empty
    },
    isEmpty (name) {
      const arr = this.pagesByCategory && this.pagesByCategory[name]
      return !arr || arr.length === 0
    },
    linkFor (p) {
      const storeLocale = this.$store?.state?.i18n?.locale
      const urlLocale =
        p.locale ||
        storeLocale ||
        (typeof window !== 'undefined' ?
          (window.location.pathname.split('/')[1] || 'en') :
          'en')
      return `/${urlLocale}/${p.path}`
    },

    async loadPages () {
      try {
        this.loading = true
        this.error = null
        // .. your existing GraphQL fetch that fills this.allPages ..
      } catch (e) {
        console.error('CategorySidebar fetch failed:', e)
        this.error = e
      } finally {
        this.loading = false
      }
    }
  },
  async mounted () {
    try {
      const loc =
        (this.$store && this.$store.state && this.$store.state.i18n && this.$store.state.i18n.locale) ||
        'en'
      this.locale = loc

      const { data } = await this.$apollo.query({
        query: QUERY,
        fetchPolicy: 'network-only'
      })

      const list = ((((data || {}).pages || {}).search || {}).results) || []
      // dev log: see what you actually got
      console.log('[CategorySidebar] results:', list)

      // normalize
      this.allPages = list.map(r => ({
        id: r.id,
        path: r.path,
        title: r.title,
        category: (r.category && typeof r.category === 'string') ? r.category : 'Other'
      }))
    } catch (e) {
      console.error('CategorySidebar fetch failed:', e)
      this.allPages = []
    }
  }
}
</script>

<style scoped>
.nav-quick .v-list-item__title {
  white-space: nowrap;
  overflow: visible;
  text-overflow: unset;
}
.nav-quick .v-list-item__content {
  min-width: 0;            /* important for Vuetify flex layouts */
}
.quick-link { padding-left: 8px; }
.v-list-group__header--active ~ .count-chip,
.v-list-group__header .count-chip {
  margin-right: 12px;
}
.v-list-group[disabled] .v-list-item-title { opacity: .6; }
/* grey out the whole group when empty */
.is-disabled {
  opacity: 0.55;
}

/* make disabled header clearly non-interactive */
.is-disabled .v-list-group__header {
  cursor: not-allowed;
  pointer-events: none; /* prevents opening */
}

/* faint chip for empty groups */
.count-chip.empty-chip {
  opacity: 0.75;
}

/* (optional) hide the caret when empty if any slips through */
.is-disabled .v-list-group__header .v-list-group__header__append-icon,
.is-disabled .v-list-group__header .v-icon--right {
  display: none !important;
}
</style>
