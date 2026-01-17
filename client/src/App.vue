<script setup>
import { computed } from 'vue'
import { useRoute } from 'vue-router'
import DefaultLayout from './layouts/DefaultLayout.vue'
import AuthLayout from './layouts/AuthLayout.vue'

const route = useRoute()

const layout = computed(() => {
  return route.meta.layout === 'auth' ? AuthLayout : DefaultLayout
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
