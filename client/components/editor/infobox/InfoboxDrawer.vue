<template lang="pug">
v-navigation-drawer(
  :value="value"
  @input="$emit('input', $event)"
  absolute
  temporary
  right
  width="320"
  style="z-index:2000"
)
  v-card(flat)
    v-toolbar(dense flat color="primary" dark)
      span Infobox
      v-spacer
      v-btn(icon @click="close")  v-icon mdi-close
    v-divider
    infobox-form(:value="initRows" @save="handleSave")
</template>

<script>
import InfoboxForm from '@/components/editor/infobox/InfoboxForm.vue'

export default {
  name: 'InfoboxDrawer',
  components: { InfoboxForm },
  props: {
    value: Boolean, // v-model from parent
    initText: String // raw {infobox …} lines (if editing)
  },
  data () {
    return {
      open: this.value,
      tab: 0,
      formData: { title: '', race: '', magic: '' },
      source: ''
    }
  },
  watch: {
    value (v) { this.open = v },
    open  (v) { this.$emit('input', v) }
  },
  computed: {
    initRows () {
      if (!this.initText) return []
      return this.initText.trim().split('\n').map(l => {
        if (l.startsWith('## ')) return { key: l.substr(3), value: '', isHeader: true }
        const [k, ...v] = l.split(':')
        return { key: k.trim(), value: v.join(':').trim(), isHeader: false }
      })
    }
  },
  methods: {
    save () {
      // build {infobox} block from form
      const body = Object.entries(this.formData)
        .filter(([k, v]) => v)
        .map(([k, v]) => `${k} : ${v}`)
        .join('\n')
      this.$emit('insert', `{infobox\n${body}\n}`)
      this.open = false
    },
    handleSave (blockText) {
      this.$emit('save', blockText) // bubble up
      this.$emit('input', false) // close drawer
    }
  }
}
</script>
