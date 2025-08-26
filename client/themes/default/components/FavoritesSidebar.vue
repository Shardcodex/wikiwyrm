<template lang="pug">
  v-list-group(
    no-action
    :value="isGroupOpen('favorites')"
    @click:active="(val) => setGroup('favorites', val)"
    prepend-icon="mdi-heart"
    append-icon=""
  )
    template(v-slot:activator)
      v-list-item-content
        v-list-item-title Favorites
      v-list-item-action
        v-spacer
        v-chip.count-chip(x-small outlined) {{ items.length }}

    v-list-item.quick-link(
      v-for="p in items"
      :key="p.id"
      :href="linkFor(p)"
      link
      :ripple="false"
    )
      v-list-item-icon
        v-icon(small) mdi-file-document-outline
      v-list-item-content
        v-list-item-title {{ p.title || p.path }}
</template>

<script>
import gql from 'graphql-tag'

const FAVORITES_QUERY = gql`
  query Favorites($locale: String, $limit: Int) {
    pages {
      list(limit: $limit, locale: $locale, filter: { featured: true }) {
        id
        path
        locale
        title
        updatedAt
      }
    }
  }
`

export default {
  name: 'FavoritesSidebar',
  props: {
    limit: { type: Number, default: 10 }
  },
  data () {
    return {
      items: [],
      openGroups: new Set()
    }
  },
  computed: {
    locale () {
      return (this.$store && this.$store.state && this.$store.state.i18n && this.$store.state.i18n.locale) ||
        (this.$i18n && this.$i18n.locale) ||
        'en'
    }
  },
  async mounted () {
    try {
      const { data } = await this.$apollo.query({
        query: FAVORITES_QUERY,
        variables: { locale: this.locale, limit: this.limit },
        fetchPolicy: 'cache-first'
      })
      this.items = (data && data.pages && data.pages.list) || []
    } catch (err) {
      console.warn('[FavoritesSidebar] fetch failed:', err)
      this.items = []
    }
  },
  methods: {
    linkFor (p) {
      const loc = p.locale || this.locale
      return `/${loc}/${p.path}`
    },
    isGroupOpen (name) {
      return this.openGroups.has(name)
    },
    setGroup (name, val) {
      if (val) this.openGroups.add(name)
      else this.openGroups.delete(name)
    }
  }
}
</script>

<style scoped>
.favorites-sidebar .v-list-item__title {
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
}
/* Make the header's content area take all available space */
.v-list-group__header__content {
  flex: 1 1 auto !important;
  min-width: 0;                 /* allows proper ellipsis on long titles */
}

/* Let the row inside that content fill the width */
.v-list-group__header__content .v-list-item {
  width: 100%;
  padding-right: 8px;           /* small breathing room before chevron */
}

/* Push the chip to the far right, just before the chevron */
.v-list-group__header__content .v-list-item__action {
  margin-left: auto;
}

/* let the text area flex correctly */
::v-deep .nav-quick .v-list-group__header .v-list-item__content {
  min-width: 0;                 /* critical in Vuetify flex rows */
  flex: 1 1 auto;
}

/* show full category names (wrap instead of clipping) */
::v-deep .nav-quick .v-list-group__header .v-list-item__title {
  white-space: normal !important;
  overflow: visible !important;
  text-overflow: unset !important;
  word-break: break-word;       /* handles very long words */
  line-height: 1.2;
}

/* keep chip near the chevron and away from the label */
::v-deep .nav-quick .v-list-group__header .count-chip {
  margin-left: 8px;
  margin-right: 8px;
}

/* optional: if you prefer single-line labels (no wrap), widen the drawer a bit */
</style>
