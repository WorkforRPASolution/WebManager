<script setup>
import { computed } from 'vue'
import { useRoute, useRouter } from 'vue-router'
import DefaultLayout from './layouts/DefaultLayout.vue'
import AuthLayout from './layouts/AuthLayout.vue'
import LandingLayout from './layouts/LandingLayout.vue'
import { useAccessLogger } from '@/shared/composables/useAccessLogger'

const route = useRoute()
const router = useRouter()
useAccessLogger(router)

const layout = computed(() => {
  const l = route.meta.layout
  if (l === 'auth') return AuthLayout
  if (l === 'landing') return LandingLayout
  return DefaultLayout
})
</script>

<template>
  <component :is="layout">
    <router-view v-slot="{ Component, route }">
      <keep-alive :max="10">
        <component :is="Component" :key="route.path" />
      </keep-alive>
    </router-view>
  </component>
</template>
