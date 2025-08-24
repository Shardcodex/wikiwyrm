<template>
  <div class="px-4 py-3">
    <h2 class="text-lg font-semibold">
      {{ decodedCategory }}
    </h2>
    <p v-if="loading">
      Loading…
    </p>
    <p v-else-if="pages.length === 0">
      No pages in this category (yet).
    </p>
    <ul
      v-else
      class="mt-2 space-y-1"
    >
      <li
        v-for="p in pages"
        :key="p.id"
      >
        <router-link :to="pageHref(p)">
          {{ p.title || p.path }}
        </router-link>
      </li>
    </ul>
  </div>
</template>

<script>
import gql from 'graphql-tag'

const LIST_BY_CATEGORY = gql`
  query($locale: String, $category: String) {
    pages {
      list(locale: $locale, category: $category, limit: 1000) {
        id
        title
        path
      }
    }
  }
`

export default {
  data() {
    return { loading: true, pages: [] }
  },
  computed: {
    locale() { return this.$route.params.locale || (window?.CONFIG?.lang?.code ?? 'en') },
    decodedCategory() { return decodeURIComponent(this.$route.params.category || 'Other') }
  },
  async created() {
    const { data } = await this.$apollo.query({
      query: LIST_BY_CATEGORY,
      variables: { locale: this.locale, category: this.decodedCategory },
      fetchPolicy: 'network-only'
    })
    this.pages = (data?.pages?.list || []).slice()
      .sort((a, b) => (a.title || '').localeCompare(b.title || ''))
    this.loading = false
  },
  methods: {
    pageHref(p) { return `/${this.locale}/${p.path}` }
  }
}
</script>
