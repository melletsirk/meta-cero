<script setup>
import { useAuthStore } from '../stores/auth'
import { useRouter } from 'vue-router'
import { ref } from 'vue'
import { useNotificationsStore } from '../stores/notifications'

const authStore = useAuthStore()
const router = useRouter()
const notificationsStore = useNotificationsStore()
const isMobileMenuOpen = ref(false)

const handleLogout = async () => {
  await authStore.signOut()
  notificationsStore.info('Has cerrado sesión exitosamente')
  router.push('/login')
}
</script>

<template>
  <div class="min-h-screen flex flex-col bg-slate-50 relative overflow-hidden">
    <!-- Background subtle glows -->
    <div class="absolute top-0 left-0 w-full h-full overflow-hidden -z-10 pointer-events-none">
      <div class="absolute -top-[20%] -left-[10%] w-[50%] h-[50%] bg-indigo-400/20 rounded-full blur-[120px]"></div>
      <div class="absolute top-[20%] -right-[10%] w-[40%] h-[60%] bg-purple-400/20 rounded-full blur-[120px]"></div>
    </div>

    <nav class="sticky top-0 z-50 glass border-b border-white/40 shadow-sm">
      <div class="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div class="flex items-center justify-between h-16">
          <!-- Logo -->
          <div class="flex items-center gap-3 cursor-pointer transition-transform hover:scale-105" @click="router.push('/')">
            <div class="bg-gradient-to-br from-indigo-500 to-purple-600 p-2 rounded-xl shadow-lg shadow-indigo-500/30">
              <svg xmlns="http://www.w3.org/2000/svg" class="h-6 w-6 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M12 8c-1.657 0-3 .895-3 2s1.343 2 3 2 3 .895 3 2-1.343 2-3 2m0-8c1.11 0 2.08.402 2.599 1M12 8V7m0 1v8m0 0v1m0-1c-1.11 0-2.08-.402-2.599-1M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
              </svg>
            </div>
            <span class="font-extrabold text-xl tracking-tight bg-clip-text text-transparent bg-gradient-to-r from-indigo-700 to-purple-700">Meta Cero</span>
          </div>

          <!-- Desktop Menu -->
          <div class="hidden md:flex space-x-1 items-center">
            <router-link to="/" class="text-slate-600 hover:text-indigo-600 hover:bg-indigo-50/80 px-4 py-2 rounded-lg transition-all font-medium" active-class="text-indigo-700 bg-indigo-50/80 shadow-sm">Dashboard</router-link>
            <div class="h-6 w-px bg-slate-200 mx-2"></div>
            <button @click="handleLogout" class="text-slate-500 hover:text-red-600 hover:bg-red-50/80 px-4 py-2 rounded-lg transition-all font-medium flex items-center gap-2">
              <svg xmlns="http://www.w3.org/2000/svg" class="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M17 16l4-4m0 0l-4-4m4 4H7m6 4v1a3 3 0 01-3 3H6a3 3 0 01-3-3V7a3 3 0 013-3h4a3 3 0 013 3v1" />
              </svg>
              Salir
            </button>
          </div>

          <!-- Mobile menu button -->
          <div class="md:hidden flex items-center">
            <button @click="isMobileMenuOpen = !isMobileMenuOpen" class="text-slate-600 hover:text-indigo-600 focus:outline-none p-2 rounded-md hover:bg-slate-100/50 transition">
              <svg class="h-6 w-6" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path v-if="!isMobileMenuOpen" stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M4 6h16M4 12h16M4 18h16" />
                <path v-else stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M6 18L18 6M6 6l12 12" />
              </svg>
            </button>
          </div>
        </div>
      </div>

      <!-- Mobile Menu -->
      <div v-if="isMobileMenuOpen" class="md:hidden glass border-t border-slate-200/50 absolute w-full shadow-lg">
        <div class="px-4 pt-2 pb-4 space-y-2">
          <router-link to="/" @click="isMobileMenuOpen = false" class="block px-4 py-3 rounded-xl text-base font-medium text-slate-700 hover:bg-indigo-50/80 hover:text-indigo-600" active-class="bg-indigo-50/80 text-indigo-700">Dashboard</router-link>
          <button @click="handleLogout" class="block w-full text-left px-4 py-3 rounded-xl text-base font-medium text-red-600 hover:bg-red-50/80 flex items-center gap-2">
             <svg xmlns="http://www.w3.org/2000/svg" class="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M17 16l4-4m0 0l-4-4m4 4H7m6 4v1a3 3 0 01-3 3H6a3 3 0 01-3-3V7a3 3 0 013-3h4a3 3 0 013 3v1" />
              </svg>
            Cerrar Sesión
          </button>
        </div>
      </div>
    </nav>

    <main class="flex-1 w-full max-w-7xl mx-auto p-4 sm:p-6 lg:p-8 animate-fade-in relative z-10">
      <slot />
    </main>
  </div>
</template>
