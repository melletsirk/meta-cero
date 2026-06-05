<script setup>
import { useAuthStore } from '../stores/auth'
import { useRouter } from 'vue-router'
import { ref } from 'vue'
import { useNotificationsStore } from '../stores/notifications'

const authStore = useAuthStore()
const router = useRouter()
const notificationsStore = useNotificationsStore()

const isSidebarOpen = ref(true) // For desktop
const isMobileMenuOpen = ref(false) // For mobile overlay

const handleLogout = async () => {
  await authStore.signOut()
  notificationsStore.info('Has cerrado sesión exitosamente')
  router.push('/login')
}
</script>

<template>
  <div class="min-h-screen flex bg-slate-50 relative overflow-hidden">
    <!-- Background subtle glows -->
    <div class="fixed top-0 left-0 w-full h-full overflow-hidden -z-10 pointer-events-none">
      <div class="absolute -top-[20%] -left-[10%] w-[50%] h-[50%] bg-indigo-400/20 rounded-full blur-[120px]"></div>
      <div class="absolute top-[20%] -right-[10%] w-[40%] h-[60%] bg-purple-400/20 rounded-full blur-[120px]"></div>
    </div>

    <!-- Mobile Overlay -->
    <div v-if="isMobileMenuOpen" class="fixed inset-0 bg-slate-900/50 backdrop-blur-sm z-40 md:hidden" @click="isMobileMenuOpen = false"></div>

    <!-- Sidebar -->
    <aside 
      class="fixed inset-y-0 left-0 z-50 flex flex-col glass border-r border-white/40 shadow-sm transition-all duration-300 transform"
      :class="{
        'w-64': isSidebarOpen,
        'w-20': !isSidebarOpen,
        '-translate-x-full md:translate-x-0': !isMobileMenuOpen
      }"
    >
      <!-- Sidebar Header / Logo -->
      <div class="h-16 flex items-center justify-between px-4 border-b border-white/20 shrink-0">
        <div class="flex items-center gap-3 cursor-pointer overflow-hidden transition-transform hover:scale-105" @click="router.push('/')">
          <div class="shrink-0 bg-gradient-to-br from-indigo-500 to-purple-600 p-2 rounded-xl shadow-lg shadow-indigo-500/30">
            <svg xmlns="http://www.w3.org/2000/svg" class="h-6 w-6 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M12 8c-1.657 0-3 .895-3 2s1.343 2 3 2 3 .895 3 2-1.343 2-3 2m0-8c1.11 0 2.08.402 2.599 1M12 8V7m0 1v8m0 0v1m0-1c-1.11 0-2.08-.402-2.599-1M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
            </svg>
          </div>
          <span v-if="isSidebarOpen" class="font-extrabold text-xl tracking-tight bg-clip-text text-transparent bg-gradient-to-r from-indigo-700 to-purple-700 whitespace-nowrap">Meta Cero</span>
        </div>
      </div>

      <!-- Sidebar Navigation -->
      <div class="flex-1 overflow-y-auto py-6 px-3 flex flex-col gap-2">
        <router-link to="/" @click="isMobileMenuOpen = false" class="flex items-center gap-3 px-3 py-3 rounded-xl text-slate-600 hover:text-indigo-600 hover:bg-indigo-50/80 transition-all font-medium group" active-class="text-indigo-700 bg-indigo-50/80 shadow-sm">
          <svg xmlns="http://www.w3.org/2000/svg" class="h-6 w-6 shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor">
             <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M3 12l2-2m0 0l7-7 7 7M5 10v10a1 1 0 001 1h3m10-11l2 2m-2-2v10a1 1 0 01-1 1h-3m-6 0a1 1 0 001-1v-4a1 1 0 011-1h2a1 1 0 011 1v4a1 1 0 001 1m-6 0h6" />
          </svg>
          <span v-if="isSidebarOpen" class="whitespace-nowrap">Dashboard</span>
        </router-link>

        <router-link to="/calendario" @click="isMobileMenuOpen = false" class="flex items-center gap-3 px-3 py-3 rounded-xl text-slate-600 hover:text-indigo-600 hover:bg-indigo-50/80 transition-all font-medium group" active-class="text-indigo-700 bg-indigo-50/80 shadow-sm">
          <svg xmlns="http://www.w3.org/2000/svg" class="h-6 w-6 shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z" />
          </svg>
          <span v-if="isSidebarOpen" class="whitespace-nowrap">Calendario</span>
        </router-link>
      </div>

      <!-- Sidebar Footer -->
      <div class="p-4 border-t border-white/20 shrink-0">
        <!-- Desktop Toggle -->
        <button @click="isSidebarOpen = !isSidebarOpen" class="hidden md:flex items-center justify-center w-full p-2 text-slate-400 hover:text-indigo-600 hover:bg-white/50 rounded-lg transition-colors mb-4">
          <svg v-if="isSidebarOpen" xmlns="http://www.w3.org/2000/svg" class="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M11 19l-7-7 7-7m8 14l-7-7 7-7" />
          </svg>
          <svg v-else xmlns="http://www.w3.org/2000/svg" class="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M13 5l7 7-7 7M5 5l7 7-7 7" />
          </svg>
        </button>

        <button @click="handleLogout" class="flex items-center justify-center md:justify-start gap-3 w-full px-3 py-3 rounded-xl text-red-500 hover:text-red-600 hover:bg-red-50/80 transition-all font-medium">
          <svg xmlns="http://www.w3.org/2000/svg" class="h-6 w-6 shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M17 16l4-4m0 0l-4-4m4 4H7m6 4v1a3 3 0 01-3 3H6a3 3 0 01-3-3V7a3 3 0 013-3h4a3 3 0 013 3v1" />
          </svg>
          <span v-if="isSidebarOpen" class="whitespace-nowrap text-left flex-1">Cerrar Sesión</span>
        </button>
      </div>
    </aside>

    <!-- Main Content Area -->
    <div class="flex-1 flex flex-col min-w-0 transition-all duration-300" :class="isSidebarOpen ? 'md:ml-64' : 'md:ml-20'">
      <!-- Mobile Header (Visible only on mobile) -->
      <header class="md:hidden sticky top-0 z-30 glass h-16 flex items-center justify-between px-4 border-b border-white/40 shadow-sm shrink-0">
        <div class="flex items-center gap-2">
          <div class="bg-gradient-to-br from-indigo-500 to-purple-600 p-1.5 rounded-lg shadow-sm">
            <svg xmlns="http://www.w3.org/2000/svg" class="h-5 w-5 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M12 8c-1.657 0-3 .895-3 2s1.343 2 3 2 3 .895 3 2-1.343 2-3 2m0-8c1.11 0 2.08.402 2.599 1M12 8V7m0 1v8m0 0v1m0-1c-1.11 0-2.08-.402-2.599-1M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
            </svg>
          </div>
          <span class="font-extrabold text-lg bg-clip-text text-transparent bg-gradient-to-r from-indigo-700 to-purple-700">Meta Cero</span>
        </div>
        <button @click="isMobileMenuOpen = true" class="p-2 text-slate-500 hover:text-indigo-600 hover:bg-slate-100 rounded-md transition-colors">
          <svg class="h-6 w-6" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M4 6h16M4 12h16M4 18h16" />
          </svg>
        </button>
      </header>

      <!-- Page Content -->
      <main class="flex-1 p-4 sm:p-6 lg:p-8 overflow-y-auto animate-fade-in relative z-10 w-full mx-auto" style="max-width: 1400px;">
        <slot />
      </main>
    </div>
  </div>
</template>
