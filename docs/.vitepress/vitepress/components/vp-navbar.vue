<script setup lang="ts">
import { computed } from 'vue'
import { inBrowser, useData, withBase } from 'vitepress'

import VPNavbarSearch from './navbar/vp-search.vue'
import VPNavbarMenu from './navbar/vp-menu.vue'
import VPNavbarThemeToggler from './navbar/vp-theme-toggler.vue'
import VPNavbarTranslation from './navbar/vp-translation.vue'
import VPNavbarSocialLinks from './navbar/vp-social-links.vue'
import VPNavbarHamburger from './navbar/vp-hamburger.vue'

defineProps<{
  fullScreen: boolean
}>()

defineEmits(['toggle'])

const { theme, page } = useData()

const currentLink = computed(() => {
  console.log('inBrowser', inBrowser)
  if (!inBrowser) {
    console.log('page.value?.frontmatter?.lang', page.value?.frontmatter?.lang)
    return withBase(`/${page.value?.frontmatter?.lang || ''}/`)
  }
  console.log('theme.value.langs', theme.value.langs)
  console.log('window?.location?.pathname', window?.location?.pathname)
  const existLangIndex = theme.value.langs.findIndex((lang) =>
    window?.location?.pathname.startsWith(withBase(`/${lang}`))
  )

  console.log('existLangIndex', existLangIndex)
  const link =
    existLangIndex === -1 ? '/' : `/${theme.value.langs[existLangIndex]}/`

  console.log('link', link)
  const withBaseLink = withBase(link)

  console.log('withBaseLink', withBaseLink)
  return withBaseLink
})
</script>

<template>
  <div class="navbar-wrapper">
    <div class="header-container">
      <div class="logo-container">
        <a :href="currentLink">
          <img
            class="logo"
            src="/images/element-plus-logo.svg"
            alt="Element Plus Logo"
          />
        </a>
      </div>
      <div class="content">
        <VPNavbarSearch class="search" :options="theme.agolia" multilang />
        <VPNavbarMenu class="menu" />
        <VPNavbarThemeToggler class="theme-toggler" />
        <VPNavbarTranslation class="translation" />
        <VPNavbarSocialLinks class="social-links" />
        <VPNavbarHamburger
          :active="fullScreen"
          class="hamburger"
          @click="$emit('toggle')"
        />
      </div>
    </div>
  </div>
</template>

<style scoped lang="scss">
.logo-container {
  display: flex;
  align-items: center;
  height: var(--header-height);
  > a {
    height: 28px;
    width: 128px;
  }
  .logo {
    position: relative;
    height: 100%;
  }
}
.dark {
  .logo {
    filter: drop-shadow(2px 2px 6px #409eff);
  }
}
</style>
