<script setup>
import { ref } from 'vue'
import { useAuthStore } from '../stores/auth'
import { useRouter } from 'vue-router'
import { useNotificationsStore } from '../stores/notifications'

const authStore = useAuthStore()
const router = useRouter()
const notificationsStore = useNotificationsStore()

const isRegistering = ref(false)
const email = ref('')
const password = ref('')
const nombre = ref('')
const loading = ref(false)

const handleSubmit = async () => {
  loading.value = true
  try {
    if (isRegistering.value) {
      const data = await authStore.signUp(email.value, password.value, nombre.value)
      if (data.user && data.user.identities && data.user.identities.length === 0) {
         notificationsStore.error('Este correo ya está registrado.')
      } else if (data.session) {
         notificationsStore.success('Cuenta creada exitosamente')
         router.push('/')
      } else {
         notificationsStore.success('¡Registro exitoso! Puedes iniciar sesión ahora.', 6000)
         isRegistering.value = false
         password.value = ''
      }
    } else {
      await authStore.signIn(email.value, password.value)
      notificationsStore.success('Inicio de sesión exitoso')
      router.push('/')
    }
  } catch (error) {
    notificationsStore.error(error.message || 'Error de autenticación')
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
            <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M12 8c-1.657 0-3 .895-3 2s1.343 2 3 2 3 .895 3 2-1.343 2-3 2m0-8c1.11 0 2.08.402 2.599 1M12 8V7m0 1v8m0 0v1m0-1c-1.11 0-2.08-.402-2.599-1M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
          </svg>
        </div>
        <h2 class="text-4xl font-extrabold tracking-tight bg-clip-text text-transparent bg-gradient-to-r from-slate-900 to-slate-700">Meta Cero</h2>
        <p class="text-slate-500 mt-3 text-lg font-medium">Toma el control de tus finanzas</p>
      </div>

      <form @submit.prevent="handleSubmit" class="space-y-6">
        <transition name="fade">
          <div v-if="isRegistering" class="group">
            <label for="nombre" class="block text-sm font-semibold text-slate-700 mb-2 group-focus-within:text-indigo-600 transition-colors">Nombre completo</label>
            <input id="nombre" v-model="nombre" type="text" :required="isRegistering" class="block w-full border-slate-200 rounded-xl shadow-sm focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500 sm:text-base p-3.5 bg-white/70 backdrop-blur-sm transition-all hover:bg-white" placeholder="Juan Pérez" />
          </div>
        </transition>

        <div class="group">
          <label for="email" class="block text-sm font-semibold text-slate-700 mb-2 group-focus-within:text-indigo-600 transition-colors">Correo electrónico</label>
          <input id="email" v-model="email" type="email" required class="block w-full border-slate-200 rounded-xl shadow-sm focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500 sm:text-base p-3.5 bg-white/70 backdrop-blur-sm transition-all hover:bg-white" placeholder="tu@correo.com" />
        </div>

        <div class="group">
          <label for="password" class="block text-sm font-semibold text-slate-700 mb-2 group-focus-within:text-indigo-600 transition-colors">Contraseña</label>
          <input id="password" v-model="password" type="password" required class="block w-full border-slate-200 rounded-xl shadow-sm focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500 sm:text-base p-3.5 bg-white/70 backdrop-blur-sm transition-all hover:bg-white" placeholder="••••••••" />
        </div>



        <button type="submit" :disabled="loading" class="w-full flex justify-center items-center gap-2 py-3.5 px-4 border border-transparent rounded-xl shadow-lg shadow-indigo-500/30 text-base font-bold text-white bg-gradient-to-r from-indigo-600 to-purple-600 hover:from-indigo-500 hover:to-purple-500 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-indigo-500 transform transition-all hover:-translate-y-0.5 disabled:opacity-50 disabled:cursor-not-allowed">
          <svg v-if="loading" class="animate-spin -ml-1 mr-2 h-5 w-5 text-white" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
            <circle class="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" stroke-width="4"></circle>
            <path class="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
          </svg>
          {{ isRegistering ? 'Crear mi cuenta' : 'Iniciar sesión' }}
        </button>
      </form>

      <div class="mt-8 text-center border-t border-slate-200/50 pt-6">
        <button type="button" @click="isRegistering = !isRegistering" class="text-sm text-slate-500 hover:text-indigo-600 font-semibold transition-colors">
          {{ isRegistering ? '¿Ya tienes una cuenta? Inicia sesión' : '¿No tienes cuenta? Regístrate aquí' }}
        </button>
      </div>
    </div>
  </div>
</template>

<style scoped>
.fade-enter-active,
.fade-leave-active {
  transition: opacity 0.3s ease, transform 0.3s ease;
}

.fade-enter-from,
.fade-leave-to {
  opacity: 0;
  transform: translateY(-10px);
}
</style>
