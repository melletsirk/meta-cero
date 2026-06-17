<script setup>
import { onMounted } from 'vue'
import { useAuthStore } from './stores/auth'
import AppLayout from './components/AppLayout.vue'
import ToastNotification from './components/ToastNotification.vue'

const authStore = useAuthStore()

onMounted(() => {
  authStore.init()
})
</script>

<template>
  <div class="min-h-screen bg-slate-50 text-slate-900">
    <ToastNotification />
    <!-- Usar el layout principal solo si la ruta actual lo requiere -->
    <AppLayout v-if="$route.meta.requiresAuth">
      <router-view />
    </AppLayout>
    <router-view v-else />
  </div>
</template>
