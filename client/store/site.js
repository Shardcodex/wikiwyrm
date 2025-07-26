import { make } from 'vuex-pathify'

/* global siteConfig */

const state = {
  company: siteConfig.company,
  contentLicense: siteConfig.contentLicense,
  footerOverride: siteConfig.footerOverride,
  dark: siteConfig.darkMode,
  tocPosition: siteConfig.tocPosition,
  mascot: true,
  title: siteConfig.title,
  logoUrl: siteConfig.logoUrl,
  search: '',
  searchIsFocused: false,
  searchIsLoading: false,
  searchRestrictLocale: false,
  searchRestrictPath: false,
  printView: false,
  featureFlags: {
    codeEditorEnabled: false // ← master toggle
  }
}

export default {
  namespaced: true,
  state,
  mutations: make.mutations(state)
}
