<script setup>
import { ref } from 'vue'
import { useAuthStore } from '../stores/auth'
import { useRouter } from 'vue-router'
import { useNotificationsStore } from '../stores/notifications'

const authStore = useAuthStore()
const router = useRouter()
const notificationsStore = useNotificationsStore()

const password = ref('')
const confirmPassword = ref('')
const loading = ref(false)

const handleSubmit = async () => {
  if (password.value !== confirmPassword.value) {
    return notificationsStore.error('Las contraseñas no coinciden')
  }
  loading.value = true
  try {
    await authStore.updatePassword(password.value)
    notificationsStore.success('Contraseña actualizada exitosamente', 6000)
    router.push('/')
  } catch (error) {
    notificationsStore.error(error.message || 'Error al actualizar contraseña')
  } finally {
    loading.value = false
  }
}
</script>

<template>
  <div class="min-h-screen flex items-center justify-center p-4 bg-slate-50 relative overflow-hidden">
    <!-- Animated Background Elements -->
    <div class="absolute inset-0 overflow-hidden pointer-events-none">
      <div class="absolute -top-40 -left-40 w-96 h-96 bg-indigo-400 rounded-full mix-blend-multiply filter blur-3xl opacity-30 animate-blob"></div>
      <div class="absolute top-40 -right-40 w-96 h-96 bg-purple-400 rounded-full mix-blend-multiply filter blur-3xl opacity-30 animate-blob animation-delay-2000"></div>
      <div class="absolute -bottom-40 left-20 w-96 h-96 bg-pink-400 rounded-full mix-blend-multiply filter blur-3xl opacity-30 animate-blob animation-delay-4000"></div>
    </div>

    <div class="max-w-md w-full glass rounded-3xl shadow-2xl p-8 sm:p-10 relative z-10 animate-slide-up border border-white/50">
      <div class="text-center mb-10">
        <div class="inline-flex items-center justify-center bg-gradient-to-br from-indigo-500 to-purple-600 p-4 rounded-2xl shadow-lg shadow-indigo-500/30 mb-6 transform transition-transform hover:rotate-12 hover:scale-110">
          <svg xmlns="http://www.w3.org/2000/svg" class="h-10 w-10 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M15 7a2 2 0 012 2m4 0a6 6 0 01-7.743 5.743L11 17H9v2H7v2H4a1 1 0 01-1-1v-2.586a1 1 0 01.293-.707l5.964-5.964A6 6 0 1121 9z" />
          </svg>
        </div>
        <h2 class="text-3xl font-extrabold tracking-tight bg-clip-text text-transparent bg-gradient-to-r from-slate-900 to-slate-700">Nueva Contraseña</h2>
        <p class="text-slate-500 mt-3 text-sm font-medium">Ingresa tu nueva contraseña para recuperar el acceso a Meta Cero.</p>
      </div>

      <form @submit.prevent="handleSubmit" class="space-y-6">
        <div class="group">
          <label for="password" class="block text-sm font-semibold text-slate-700 mb-2 group-focus-within:text-indigo-600 transition-colors">Nueva Contraseña</label>
          <input id="password" v-model="password" type="password" required class="block w-full border-slate-200 rounded-xl shadow-sm focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500 sm:text-base p-3.5 bg-white/70 backdrop-blur-sm transition-all hover:bg-white" placeholder="••••••••" />
        </div>

        <div class="group">
          <label for="confirmPassword" class="block text-sm font-semibold text-slate-700 mb-2 group-focus-within:text-indigo-600 transition-colors">Confirma la Contraseña</label>
          <input id="confirmPassword" v-model="confirmPassword" type="password" required class="block w-full border-slate-200 rounded-xl shadow-sm focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500 sm:text-base p-3.5 bg-white/70 backdrop-blur-sm transition-all hover:bg-white" placeholder="••••••••" />
        </div>

        <button type="submit" :disabled="loading" class="w-full flex justify-center items-center gap-2 py-3.5 px-4 border border-transparent rounded-xl shadow-lg shadow-indigo-500/30 text-base font-bold text-white bg-gradient-to-r from-indigo-600 to-purple-600 hover:from-indigo-500 hover:to-purple-500 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-indigo-500 transform transition-all hover:-translate-y-0.5 disabled:opacity-50 disabled:cursor-not-allowed">
          <svg v-if="loading" class="animate-spin -ml-1 mr-2 h-5 w-5 text-white" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
            <circle class="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" stroke-width="4"></circle>
            <path class="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
          </svg>
          Actualizar y Entrar
        </button>
      </form>
    </div>
  </div>
</template>
