<template lang="pug">
v-list.dense.nav-quick.shortcuts-sidebar
  v-subheader.pl-4 Shortcuts
  v-list-item.quick-link(
    :href="`/${locale}/maps`"
    link
    :ripple="false"
  )
    v-list-item-icon
      v-icon mdi-map
    v-list-item-content
      v-list-item-title Maps

  v-list-item.quick-link(
    :href="`/${locale}/gallery`"
    link
    :ripple="false"
  )
    v-list-item-icon
      v-icon mdi-image-multiple
    v-list-item-content
      v-list-item-title Image Gallery

  v-list-item.quick-link(
    :href="`/${locale}/help`"
    link
    :ripple="false"
  )
    v-list-item-icon
      v-icon mdi-help-circle-outline
    v-list-item-content
      v-list-item-title Help
</template>

<script>
export default {
  name: 'Shortcuts',
  computed: {
    locale () {
      return (this.$store && this.$store.state && this.$store.state.i18n && this.$store.state.i18n.locale) ||
        (this.$i18n && this.$i18n.locale) ||
        'en'
    }
  }
}
</script>

<style scoped>
.shortcuts-sidebar .v-list-item__title {
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
}
</style>
