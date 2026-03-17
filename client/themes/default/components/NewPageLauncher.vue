<template lang="pug">
v-dialog(v-model="open" max-width="780")
  // ACTIVATOR
  template(v-slot:activator="{ on, attrs }")
    v-tooltip(bottom)
      template(v-slot:activator="{ on: tip }")
        v-btn(icon tile height="64" v-on="{...on, ...tip}" v-bind="attrs" :aria-label="$t('common:header.newPage')")
          v-icon(color="grey") mdi-text-box-plus-outline
      span {{ $t('common:header.newPage') }}

  v-card
    // HEADER — tighter, subtitle, quiet switch, close
    v-card-title.py-3.d-flex.align-center
      .d-flex.flex-column
        span.text-h6 New Page
        span.text-caption.text--secondary Choose a creation mode
      v-spacer
      v-switch.mr-1(v-model="openInEditor" inset label="Open editor after create")
      v-btn(icon @click="resetAndClose" :aria-label="$t('common:actions.close')")
        v-icon mdi-close

    v-divider.divider--soft

    v-card-text.py-4
      v-stepper(v-model="step" alt-labels flat class="elev-0 stepper--soft")
        v-stepper-header.px-2
          v-stepper-step(:complete="step>1" step="1" editable) Mode
          v-divider.mx-1
          v-stepper-step(:complete="step>2" step="2" :editable="canGoDetails") Details
          v-divider.mx-1
          v-stepper-step(step="3" :editable="canSubmit") Create

        v-stepper-items
          // STEP 1 — MODE
          v-stepper-content(step="1")
            v-fade-transition
              div
                .mb-3.text-subtitle-2.grey--text Choose the editor you want to work with.
                v-container(fluid role="radiogroup" aria-label="Creation mode")
                  v-row(dense align="stretch")
                    // GUIDED (with Recommended chip)
                    v-col(cols="12" sm="4" class="d-flex")
                      v-card.mode-card.fill-card.d-flex.flex-column(
                        outlined
                        :elevation="mode==='guided'?4:0"
                        :class="[{ 'mode-card--active': mode==='guided' }]"
                        tabindex="0"
                        role="radio"
                        :aria-checked="mode==='guided'"
                        @click="setMode('guided')"
                        @keyup.enter.space.prevent="setMode('guided')"
                      )
                        .d-flex.align-center.mb-1
                          v-avatar(size="28" tile class="mr-2")
                            v-icon(small :color="mode==='guided' ? 'primary' : 'grey'") {{ mode==='guided' ? 'mdi-compass' : 'mdi-compass-outline' }}
                          .text-subtitle-2.font-weight-medium Guided
                        .text-body-2.text--secondary Best for structured pages (Characters, Locations, etc.) with a guided template.
                        // chip
                        v-card-actions.pt-0.recommended
                          v-chip.chip-reco(label small color="primary" text-color="white" v-if="true")
                            v-icon(left small) mdi-star
                            | Recommended

                    // MARKDOWN
                    v-col(cols="12" sm="4" class="d-flex")
                      v-card.mode-card.fill-card.d-flex.flex-column(
                        outlined
                        :elevation="mode==='markdown'?4:0"
                        :class="[{ 'mode-card--active': mode==='markdown' }]"
                        tabindex="0"
                        role="radio"
                        :aria-checked="mode==='markdown'"
                        @click="setMode('markdown')"
                        @keyup.enter.space.prevent="setMode('markdown')"
                      )
                        .d-flex.align-center.mb-1
                          v-avatar(size="28" tile class="mr-2")
                            v-icon(small :color="mode==='markdown' ? 'primary' : 'grey'") {{ mode==='markdown' ? 'mdi-language-markdown' : 'mdi-language-markdown-outline' }}
                          .text-subtitle-2.font-weight-medium Markdown
                        .text-body-2.text--secondary Start with a blank Markdown page.

                    // RICH
                    v-col(cols="12" sm="4" class="d-flex")
                      v-card.mode-card.fill-card.d-flex.flex-column(
                        outlined
                        :elevation="mode==='rich'?4:0"
                        :class="[{ 'mode-card--active': mode==='rich' }]"
                        tabindex="0"
                        role="radio"
                        :aria-checked="mode==='rich'"
                        @click="setMode('rich')"
                        @keyup.enter.space.prevent="setMode('rich')"
                      )
                        .d-flex.align-center.mb-1
                          v-avatar(size="28" tile class="mr-2")
                            v-icon(small :color="mode==='rich' ? 'primary' : 'grey'") {{ mode==='rich' ? 'mdi-file-code' : 'mdi-file-document-edit-outline' }}
                          .text-subtitle-2.font-weight-medium Rich Text
                        .text-body-2.text--secondary Start with a blank WYSIWYG page.

                .d-flex.mt-6
                  v-btn(text @click="resetAndClose") Cancel
                  v-spacer
                  v-btn(color="primary" :disabled="!mode" @click="goDetails") Next

          // STEP 2 — DETAILS (guided vs others)
          v-stepper-content(step="2")
            v-fade-transition
              div
                // GUIDED
                template(v-if="mode==='guided'")
                  .mb-3.text-subtitle-2.grey--text Select type and fill quick details
                  v-container(fluid)
                    v-row(dense)
                      v-col(v-for="t in typeList" :key="t.key" cols="12" sm="6" md="4")
                        v-card.type-card(
                          outlined
                          :elevation="selectedType===t.key?4:0"
                          :class="[{ 'type-card--active': selectedType===t.key }]"
                          tabindex="0"
                          role="radio"
                          :aria-checked="selectedType===t.key"
                          @click="selectType(t.key)"
                          @keyup.enter.space.prevent="selectType(t.key)"
                        )
                          .d-flex.align-center.mb-1
                            v-avatar(size="28" tile class="mr-2")
                              v-icon(small :color="selectedType===t.key ? 'primary' : 'grey'") {{ t.icon }}
                            .text-subtitle-2.font-weight-medium {{ t.label }}
                          .text-body-2.text--secondary {{ t.help }}

                  v-form(ref="detailsForm" v-model="detailsValid" class="mt-4")
                    v-text-field(v-model="form.title" :label="titleLabel" :rules="[v => !!v || 'Required']" outlined dense)
                    v-text-field(v-model="form.description" label="Short description" outlined dense)
                    // Subtype (subcategory) now lives with metadata
                    v-select(
                      v-if="selectedType && subcategoriesFor(selectedType).length"
                      v-model="form.subcategory"
                      :items="subcategoriesFor(selectedType)"
                      label="Subtype"
                      outlined
                      dense
                      clearable
                    )
                    // Per-type dynamic fields
                    template(v-if="dynamicFields.length")
                      v-divider.my-3
                      .text-caption.grey--text.mb-2 Optional details (used to pre-fill page content)
                      v-row(dense)
                        v-col(v-for="fld in dynamicFields" :key="fld.key" cols="12" :sm="fld.sm || 12")
                          v-textarea(
                            v-if="fld.type === 'textarea'"
                            v-model="form.extra[fld.key]"
                            :label="fld.label"
                            outlined
                            dense
                            rows="3"
                            auto-grow
                          )
                          v-text-field(
                            v-else
                            v-model="form.extra[fld.key]"
                            :label="fld.label"
                            :type="fld.type === 'number' ? 'number' : 'text'"
                            outlined
                            dense
                          )

                // MARKDOWN / RICH
                template(v-else)
                  .mb-3.text-subtitle-2.grey--text Quick page setup
                  v-form(ref="detailsForm" v-model="detailsValid")
                    v-text-field(v-model="form.title" label="Title" :rules="[v => !!v || 'Required']" outlined dense)
                    v-text-field(v-model="form.description" label="Short description" outlined dense)
                    v-select(v-model="quick.category" :items="categoriesMaster" label="Category (optional)" outlined dense clearable)
                    v-combobox(v-model="quick.folder" :items="prefixSuggestions" label="Folder/prefix (optional)" outlined dense clearable
                      hint="e.g. characters, notes, wiki, etc." persistent-hint)

                .d-flex.mt-6
                  v-btn(text @click="step=1") Back
                  v-spacer
                  v-btn(color="primary" :disabled="!canGoConfirm" @click="goConfirm") Continue

          // STEP 3 — CONFIRM & CREATE
          v-stepper-content(step="3")
            v-fade-transition
              div
                .text-subtitle-2.mb-2 Review
                v-simple-table
                  tbody
                    tr
                      td.title Mode
                      td {{ modeLabel }}
                    tr
                      td.title Path
                      td(code) {{ previewPath }}
                    tr
                      td.title Category
                      td {{ finalCategory || '—' }}
                    tr(v-if="form.subcategory && mode==='guided'")
                      td.title Subtype
                      td {{ form.subcategory }}
                .caption.grey--text.mt-2 You can edit content after creation.

                .d-flex.mt-6
                  v-btn(text @click="step=2") Back
                  v-spacer
                  v-btn(color="primary" :loading="busy" :disabled="busy" @click="create") Create

    v-divider.divider--soft
    v-card-actions.py-3
      v-spacer
      v-btn(text @click="resetAndClose") Cancel
</template>

<script>
import gql from 'graphql-tag'

const WORLD_ID_BY_SLUG = gql`
  query WorldIdBySlug($slug: String!) {
    worldBySlug(slug: $slug) { id }
  }
`

const CREATE_PAGE = gql`
  mutation CreatePage($input: CreatePageInput!) {
    pages {
      create(input: $input) {
        responseResult { succeeded errorCode slug message }
        page { id path locale title }
      }
    }
  }
`

export default {
  name: 'NewPageLauncher',
  data () {
    return {
      open: false,
      step: 1,
      busy: false,
      openInEditor: true,
      worldID: null,

      // new bits
      mode: null, // 'guided' | 'markdown' | 'rich'
      selectedType: null,
      detailsValid: false,

      form: { title: '', description: '', subcategory: '', extra: {} },
      quick: { folder: '', category: '' },

      categoriesMaster: [
        'Characters', 'Locations', 'Factions', 'Magic', 'History & Lore', 'Languages', 'Creatures', 'Technology & Tools', 'Other'
      ],
      prefixSuggestions: [
        'characters', 'locations', 'factions', 'magic', 'history', 'languages', 'creatures', 'technology', 'notes', 'wiki'
      ],

      types: {
        characters: {
          label: 'Characters',
          icon: 'mdi-account-group',
          prefix: 'characters',
          help: 'People in your world',
          subcategories: [
            'Main Characters', 'Supporting Characters', 'Historical Figures', 'Deities & Mythic Beings'
          ],
          fields: [
            { key: 'aliases', label: 'Aliases' },
            { key: 'age', label: 'Age', type: 'number', sm: 6 },
            { key: 'role', label: 'Role', sm: 6 },
            { key: 'affiliation', label: 'Affiliation', sm: 6 },
            { key: 'species', label: 'Species', sm: 6 },
            { key: 'appearance', label: 'Appearance', type: 'textarea' },
            { key: 'abilities', label: 'Abilities', type: 'textarea' },
            { key: 'biography', label: 'Biography', type: 'textarea' }
          ]
        },
        locations: {
          label: 'Locations',
          icon: 'mdi-map',
          prefix: 'locations',
          help: 'Places and maps',
          subcategories: [
            'Continents / Regions', 'Cities & Towns', 'Landmarks & Structures', 'Maps'
          ],
          fields: [
            { key: 'region', label: 'Region/Parent', sm: 6 },
            { key: 'population', label: 'Population', sm: 6 },
            { key: 'climate', label: 'Climate', sm: 6 },
            { key: 'terrain', label: 'Terrain', sm: 6 },
            { key: 'history', label: 'History', type: 'textarea' }
          ]
        },
        factions: {
          label: 'Factions',
          icon: 'mdi-shield-account',
          prefix: 'factions',
          help: 'Groups, nations, orgs',
          subcategories: [
            'Nations', 'Guilds & Organizations', 'Religions & Cults', 'Political Entities'
          ],
          fields: [
            { key: 'leader', label: 'Leader', sm: 6 },
            { key: 'founded', label: 'Founded', sm: 6 },
            { key: 'ideology', label: 'Ideology', type: 'textarea' },
            { key: 'rivals', label: 'Rivals', type: 'textarea' }
          ]
        },
        magic: {
          label: 'Magic',
          icon: 'mdi-auto-fix',
          prefix: 'magic',
          help: 'Systems, spells, artifacts',
          subcategories: [
            'Magic Systems', 'Spells & Abilities', 'Magical Creatures', 'Artifacts & Relics'
          ],
          fields: [
            { key: 'source', label: 'Source', sm: 6 },
            { key: 'cost', label: 'Cost/Limitations', sm: 6 },
            { key: 'rules', label: 'Rules', type: 'textarea' }
          ]
        },
        history: {
          label: 'History & Lore',
          icon: 'mdi-timeline-text',
          prefix: 'history',
          help: 'Events, eras, myths',
          subcategories: [
            'Timelines', 'Eras & Epochs', 'Myths & Legends', 'Historical Events'
          ],
          fields: [
            { key: 'date', label: 'Date/Range', sm: 6 },
            { key: 'location', label: 'Location', sm: 6 },
            { key: 'summary', label: 'Summary', type: 'textarea' }
          ]
        },
        languages: {
          label: 'Languages',
          icon: 'mdi-alphabet-greek',
          prefix: 'languages',
          help: 'Conlangs, scripts, names',
          subcategories: [
            'Constructed Languages (Conlangs)', 'Alphabets & Scripts', 'Naming Conventions'
          ],
          fields: [
            { key: 'family', label: 'Language Family', sm: 6 },
            { key: 'script', label: 'Script', sm: 6 },
            { key: 'phonology', label: 'Phonology', type: 'textarea' },
            { key: 'grammar', label: 'Grammar', type: 'textarea' }
          ]
        },
        creatures: {
          label: 'Creatures',
          icon: 'mdi-paw',
          prefix: 'creatures',
          help: 'Species, monsters, hybrids',
          subcategories: [
            'Beasts & Monsters', 'Sentient Species', 'Hybrids & Abominations'
          ],
          fields: [
            { key: 'habitat', label: 'Habitat', sm: 6 },
            { key: 'diet', label: 'Diet', sm: 6 },
            { key: 'behavior', label: 'Behavior', type: 'textarea' },
            { key: 'abilities', label: 'Abilities', type: 'textarea' }
          ]
        },
        technology: {
          label: 'Technology & Tools',
          icon: 'mdi-cog',
          prefix: 'technology',
          help: 'Inventions, weapons, transport',
          subcategories: [
            'Inventions', 'Weapons & Armor', 'Transportation'
          ],
          fields: [
            { key: 'inventor', label: 'Inventor/Origin', sm: 6 },
            { key: 'era', label: 'Era', sm: 6 },
            { key: 'usage', label: 'Usage', type: 'textarea' }
          ]
        }
      }
    }
  },
  async mounted () {
    const segs = (window.location.pathname || '').split('/').filter(Boolean)
    const isLocale = s => /^[A-Za-z]{2}(-[A-Za-z]{2})?$/.test(s || '')
    let world = 'default'
    if (segs[0] && !isLocale(segs[0])) world = segs[0]

    const { data } = await this.$apollo.query({
      query: WORLD_ID_BY_SLUG,
      variables: { slug: world },
      fetchPolicy: 'cache-first'
    })
    this.worldID = data?.worldBySlug?.id || null
  },

  computed: {
    typeList () { return Object.entries(this.types).map(([key, v]) => ({ key, ...v })) },
    dynamicFields () { return this.selectedType ? this.types[this.selectedType].fields : [] },
    modeLabel () { return this.mode === 'guided' ? 'Guided' : this.mode === 'markdown' ? 'Markdown' : 'Rich Text' },
    titleLabel () { return this.selectedType ? `${this.types[this.selectedType].label} name/title` : 'Title' },
    categoryLabel () { return this.selectedType ? this.types[this.selectedType].label : 'Category' },
    locale () { return this.$store?.state?.i18n?.locale || 'en' },
    canGoDetails () { return !!this.mode },
    canGoConfirm () {
      if (!this.detailsValid) return false
      if (!this.form.title) return false
      if (this.mode === 'guided' && !this.selectedType) return false
      if (this.mode === 'guided') {
        const hasSubs = this.subcategoriesFor(this.selectedType).length > 0
        if (hasSubs && !this.form.subcategory) return false
      }
      return true
    },
    finalCategory () {
      return this.mode === 'guided' ? this.categoryLabel : (this.quick.category || '')
    },
    previewPath () {
      if (this.mode === 'guided') {
        const prefix = this.selectedType ? this.types[this.selectedType].prefix : ''
        const sub = this.form.subcategory ? `/${this.slug(this.form.subcategory)}` : ''
        const leaf = this.form.title ? `/${this.slug(this.form.title)}` : '/new-page'
        return `${prefix}${sub}${leaf}`
      } else {
        const prefix = this.quick.folder ? this.slug(this.quick.folder) : ''
        const leaf = this.form.title ? `/${this.slug(this.form.title)}` : '/new-page'
        return prefix ? `${prefix}${leaf}` : this.slug(this.form.title || 'new-page')
      }
    }
  },

  methods: {
    openLauncher () { this.open = true; this.step = 1 },
    setMode (m) { this.mode = m },

    subcategoriesFor (key) { return (this.types[key]?.subcategories) || [] },
    selectType (key) { this.selectedType = key; this.form.subcategory = '' },

    goDetails () { this.step = 2 },

    goConfirm () {
      if (!this.$refs.detailsForm) return
      this.$refs.detailsForm.validate()
      if (this.canGoConfirm) this.step = 3
    },

    inputFor (fld) {
      if (fld.type === 'textarea') return 'v-textarea'
      if (fld.type === 'select') return 'v-select'
      return 'v-text-field'
    },

    slug (s = '') {
      return s.toString()
        .normalize('NFKD').replace(/[\u0300-\u036f]/g, '')
        .replace(/[^a-zA-Z0-9]+/g, '-')
        .replace(/^-+|-+$/g, '')
        .toLowerCase() || 'new-page'
    },

    generateGuidedContent () {
      const fm = {
        category: this.categoryLabel,
        subcategory: this.form.subcategory || null
      }
      const yaml = '---\n' + Object.entries(fm)
        .filter(([, v]) => v !== null && v !== undefined && v !== '')
        .map(([k, v]) => `${k}: ${String(v).replace(/\n/g, '\\n')}`)
        .join('\n') + '\n---\n'

      // Scaffold sections from dynamic fields, using filled values when available.
      const sections = (this.dynamicFields || [])
        .map(f => {
          const val = (this.form.extra || {})[f.key]
          const body = val ? String(val).trim() : '_TBD_'
          return `## ${f.label}\n${body}\n`
        })
        .join('\n')

      const h1 = `# ${this.form.title}\n\n`
      const desc = this.form.description ? `> ${this.form.description}\n\n` : ''
      return yaml + h1 + desc + sections
    },

    generateBlankContent (fmt) {
      if (fmt === 'markdown') {
        const h1 = `# ${this.form.title}\n\n`
        const desc = this.form.description ? `> ${this.form.description}\n\n` : ''
        return h1 + desc
      }
      // rich/HTML
      const title = this.form.title.replace(/</g, '&lt;').replace(/>/g, '&gt;')
      const desc = this.form.description ? `<p>${this.form.description}</p>` : ''
      return `<h1>${title}</h1>\n${desc}`
    },

    async create () {
      this.busy = true
      try {
        let content, editor, tags
        let guidedData = null
        if (this.mode === 'guided') {
          content = this.generateGuidedContent()
          editor = 'markdown'
          tags = this.form.subcategory ? [this.slug(this.form.subcategory)] : []
          // Collect non-empty dynamic field values
          guidedData = Object.fromEntries(
            Object.entries(this.form.extra || {}).filter(([, v]) => v !== null && v !== undefined && v !== '')
          )
        } else if (this.mode === 'markdown') {
          content = this.generateBlankContent('markdown')
          editor = 'markdown'
          tags = []
        } else {
          content = this.generateBlankContent('html')
          editor = 'html'
          tags = []
        }

        const input = {
          path: this.previewPath,
          title: this.form.title,
          description: this.form.description || '',
          content,
          editor,
          tags,
          categoryKey: this.mode === 'guided' ? (this.selectedType || null) : null,
          subcategoryKey: this.mode === 'guided' ? (this.form.subcategory || null) : null,
          isPublished: true,
          isPrivate: false,
          guidedData,
          worldID: this.worldID,
          locale: this.locale
        }

        const res = await this.$apollo.mutate({
          mutation: CREATE_PAGE,
          variables: { input }
        })

        const ok = res?.data?.pages?.create?.responseResult?.succeeded
        if (!ok) throw new Error(res?.data?.pages?.create?.responseResult?.message || 'Create failed')

        const path = this.previewPath
        if (this.openInEditor) {
          window.location.assign(`/e/${this.locale}/${path}`)
        } else {
          window.location.assign(`/${this.locale}/${path}`)
        }
      } catch (e) {
        console.error('Create page failed:', e)
        this.$store?.commit?.('showNotification', { style: 'red', message: e.message || 'Failed to create page' })
      } finally {
        this.busy = false
      }
    },

    resetAndClose () {
      this.open = false
      this.step = 1
      this.mode = null
      this.selectedType = null
      this.form = { title: '', description: '', subcategory: '', extra: {} }
      this.quick = { folder: '', category: '' }
      this.detailsValid = false
      this.busy = false
    }
  }
}
</script>

<style scoped>
.fill-card { height: 100%; display: flex; flex-direction: column; }
/* Stepper + dividers */
.stepper--soft .v-stepper__header { box-shadow: none !important; }
.divider--soft { opacity: .6; }

/* Cards */
.mode-card, .type-card {
  position: relative;            /* for the chip */
  cursor: pointer;
  border-radius: 14px;
  padding: 16px;
  transition: box-shadow .18s ease, transform .12s ease, border-color .18s ease, background-color .18s ease;
  border-color: rgba(0,0,0,.08) !important;
  min-height: 112px;
}
.mode-card:hover, .type-card:hover {
  transform: translateY(-2px);
  box-shadow: 0 6px 16px rgba(0,0,0,.06);
}
.mode-card--active, .type-card--active {
  border-color: rgba(0,0,0,.24) !important;
  box-shadow: 0 10px 24px rgba(0,0,0,.08) !important;
}

/* Recommended chip */
.chip-reco {
  position: absolute;
  bottom: 10px;
  right: 10px;
}

/* Keyboard focus */
.mode-card:focus, .type-card:focus {
  outline: 2px solid rgba(25,118,210,.6);
  outline-offset: 2px;
}

/* Review table labels */
.title { font-weight: 600; width: 170px; }

.recommended{
  position: absolute;
  top: 15px;
  right: 0px;
  width:150px;
}
</style>
