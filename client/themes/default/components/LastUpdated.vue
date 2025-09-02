<template lang="pug">
  v-list-group(
    no-action
    :value="isGroupOpen('last')"
    @click:active="(val) => setGroup('last', val)"
    prepend-icon="mdi-clock-outline"
    append-icon=""
    :color="$vuetify.theme.dark ? 'white' : 'primary lighten-3'"
  )
    template(v-slot:activator)
      v-list-item-content
        v-list-item-title Recents
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
        v-list-item-subtitle {{ fmt(p.updatedAt) }}
</template>

<script>
import gql from 'graphql-tag'

const LAST_UPDATED_QUERY = gql`
  query LastUpdated($locale: String, $limit: Int) {
    pages {
      list(limit: $limit, locale: $locale, orderBy: UPDATED, orderByDirection: DESC) {
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
  name: 'LastUpdated',
  props: {
    limit: { type: Number, default: 10 }
  },
  data () {
    return {
      items: [],
      openGroups: new Set() // default open; remove to start closed
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
        query: LAST_UPDATED_QUERY,
        variables: { locale: this.locale, limit: this.limit },
        fetchPolicy: 'cache-first'
      })
      this.items = (data && data.pages && data.pages.list) || []
    } catch (err) {
      console.warn('[LastUpdated] fetch failed:', err)
      this.items = []
    }
  },
  methods: {
    linkFor (p) {
      const loc = p.locale || this.locale
      return `/${loc}/${p.path}`
    },
    fmt (iso) {
      if (!iso) return ''
      try {
        const d = new Date(iso)
        if (Number.isNaN(d.getTime())) return iso
        return d.toLocaleDateString(undefined, { year: 'numeric', month: 'short', day: 'numeric' })
      } catch (e) {
        return iso
      }
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
.lastupdated-sidebar .v-list-item__title,
.lastupdated-sidebar .v-list-item__subtitle {
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
}
.lastupdated-sidebar .v-list-item__subtitle {
  opacity: .8;
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

/* Optional polish for the count chip */
.count-chip {
  line-height: 1;
  height: 18px;
}
::v-deep .v-list-group--active > .v-list-group__header .header-row .v-list-item__title,
::v-deep .v-list-group--active > .v-list-group__header .header-row .v-icon {
  opacity: 1 !important;
  color: white !important;   /* don’t force primary; use normal text color */
}

</style>
