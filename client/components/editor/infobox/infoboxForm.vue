<template lang="pug">
.flat.pa-4
  // — Action buttons —
  v-btn.primary.text-none(@click="addRow") + Row
  v-btn.secondary.text-none.ml-2(@click="addHeader") + Header

  // — List of rows / headers —
  v-data-table.mt-3(:headers="tblHdrs"
                   :items="rows"
                   hide-default-footer
                   dense)
    template(v-slot:item.key="{ item }")
      span(v-if="!item.isHeader") {{ item.key }}
      strong(v-else) {{ item.key }}
    template(v-slot:item.value="{ item }")
      span(v-if="!item.isHeader") {{ item.value }}
      em(v-else) — header —
    template(v-slot:item.actions="{ index }")
      v-btn.icon.small(@click="rows.splice(index,1)")
        v-icon mdi-close

  // — Save button —
  v-btn.primary.mt-4(@click="save") Save
</template>

<script>
export default {
  name: 'InfoboxForm',
  props: {
    // pre-loaded rows if editing an existing box
    value: { type: Array, default: () => [] }
  },
  data () {
    return {
      rows: JSON.parse(JSON.stringify(this.value)), // local copy
      tblHdrs: [
        { text: 'Key / Header', value: 'key' },
        { text: 'Value', value: 'value' },
        { text: '', value: 'actions', sortable: false }
      ]
    }
  },
  methods: {
    addRow () {
      const key = prompt('Key?')
      const value = prompt('Value?')
      if (key) this.rows.push({ key, value, isHeader: false })
    },
    addHeader () {
      const key = prompt('Header text?')
      if (key) this.rows.push({ key, value: '', isHeader: true })
    },
    save () {
      /* Convert rows → markdown infobox text */
      const lines = this.rows.map(r =>
        r.isHeader ? `## ${r.key}` : `${r.key}: ${r.value}`
      )
      const block = `{infobox\n${lines.join('\n')}\n}`

      // Emit to parent (InfoboxDrawer) → up to editor-ckeditor
      this.$emit('save', block)
    }
  }
}
</script>
