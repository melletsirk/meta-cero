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
    <!-- Si está autenticado, usar el layout principal. Si no, mostrar la vista sola (ej: Login) -->
    <AppLayout v-if="authStore.user">
      <router-view />
    </AppLayout>
    <router-view v-else />
  </div>
</template>
