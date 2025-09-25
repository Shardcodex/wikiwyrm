<template lang="pug">
  v-list.dense.nav-quick
    v-subheader.pl-4 The Hoard

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
      :color="$vuetify.theme.dark ? 'white' : 'primary lighten-3'"
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
// replace LIST_QUERY
const LIST_QUERY = gql`
  query SidebarList($locale: String!, $limit: Int) {
    pages {
      list(locale: $locale, limit: $limit) {
        id
        path
        title
        category
        locale
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
      // align with your guided categories (extend as needed)
      categoriesMaster: [
        'Characters', 'Locations', 'Factions', 'Magic', 'History & Lore',
        'Languages', 'Creatures', 'Technology & Tools', 'Other'
      ],
      iconMap: {
        Characters: { full: 'mdi-account-group', empty: 'mdi-account-outline' },
        Locations: { full: 'mdi-map-marker-radius', empty: 'mdi-map-marker-outline' },
        Factions: { full: 'mdi-shield-account', empty: 'mdi-shield-outline' },
        Magic: { full: 'mdi-auto-fix', empty: 'mdi-auto-fix' },
        'History & Lore': { full: 'mdi-timeline-text', empty: 'mdi-timeline-clock-outline' },
        Languages: { full: 'mdi-alphabet-greek', empty: 'mdi-alphabet-greek' },
        Creatures: { full: 'mdi-paw', empty: 'mdi-paw-outline' },
        'Technology & Tools': { full: 'mdi-cog', empty: 'mdi-cog-outline' },
        Other: { full: 'mdi-folder', empty: 'mdi-folder-outline' }
      },
      locale: 'en',
      loading: false,
      error: null
    }
  },

  apollo: {
    allPages: {
      query: LIST_QUERY,
      variables () {
        const loc = this.$store?.state?.i18n?.locale || 'en'
        this.locale = loc
        return { locale: loc, limit: 500 }
      },
      update: d => d?.pages?.list || [],
      fetchPolicy: 'network-only',
      error: e => console.error('[CategorySidebar] list failed:', e)
    }
  },

  computed: {
    pagesByCategory () {
      const byCat = {}
      for (const p of (this.allPages || [])) {
        const cat = (p.category && typeof p.category === 'string' && p.category.trim()) ? p.category : 'Other'
        if (!byCat[cat]) byCat[cat] = []
        byCat[cat].push(p)
      }
      // ensure masters exist (keeps consistent ordering)
      for (const name of this.categoriesMaster) {
        if (!byCat[name]) byCat[name] = []
      }
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

  watch: {
    // auto-refresh when locale changes
    '$store.state.i18n.locale' () {
      if (this.$apollo && this.$apollo.queries && this.$apollo.queries.allPages) {
        this.$apollo.queries.allPages.refetch()
      }
    }
  },

  methods: {
    isGroupOpen (name) { return !!this.openGroups[name] },
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
      const storeLocale = this.$store && this.$store.state && this.$store.state.i18n && this.$store.state.i18n.locale
      const urlLocale = p.locale || storeLocale || (typeof window !== 'undefined' ?
        (window.location.pathname.split('/')[1] || 'en') :
        'en')
      return `/${urlLocale}/${p.path}`
    },
    refresh () {
      this.$apollo.queries.allPages && this.$apollo.queries.allPages.refetch()
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
::v-deep .v-list-group--active > .v-list-group__header .header-row .v-list-item__title,
::v-deep .v-list-group--active > .v-list-group__header .header-row .v-icon {
  opacity: 1 !important;
  color: white !important;   /* don’t force primary; use normal text color */
}
</style>
