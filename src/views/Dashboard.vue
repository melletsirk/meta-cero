<script setup>
import { onMounted } from 'vue'
import { useRouter } from 'vue-router'
import { useAuthStore } from '../stores/auth'
import { useDeudasStore } from '../stores/deudas'
import { formatearMonedaPeru } from '../lib/finanzas'

const authStore = useAuthStore()
const deudasStore = useDeudasStore()
const router = useRouter()

onMounted(() => {
  deudasStore.fetchDeudas()
})

const goNuevaDeuda = () => {
  router.push('/deudas/nueva')
}
</script>

<template>
  <div class="space-y-8 pb-12">
    <!-- Header Section -->
    <div class="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-6 stagger-1">
      <div>
        <h1 class="text-3xl font-extrabold text-slate-900 tracking-tight">Hola, <span class="text-indigo-600">{{ authStore.user?.email.split('@')[0] }}</span> 👋</h1>
        <p class="text-slate-500 mt-1 font-medium">Aquí está el resumen de tus deudas activas.</p>
      </div>
      <button @click="goNuevaDeuda" class="bg-gradient-to-r from-indigo-600 to-purple-600 text-white px-5 py-2.5 rounded-xl hover:from-indigo-500 hover:to-purple-500 shadow-lg shadow-indigo-500/30 transition-all transform hover:-translate-y-0.5 font-bold flex items-center gap-2">
        <svg xmlns="http://www.w3.org/2000/svg" class="h-5 w-5" viewBox="0 0 20 20" fill="currentColor">
          <path fill-rule="evenodd" d="M10 5a1 1 0 011 1v3h3a1 1 0 110 2h-3v3a1 1 0 11-2 0v-3H6a1 1 0 110-2h3V6a1 1 0 011-1z" clip-rule="evenodd" />
        </svg>
        Nueva Deuda
      </button>
    </div>

    <!-- Metrics Cards -->
    <div class="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-6 stagger-2">
      <div class="glass p-6 rounded-2xl shadow-sm border border-white/60 card-hover relative overflow-hidden group">
        <div class="absolute -right-4 -top-4 w-24 h-24 bg-red-400 rounded-full mix-blend-multiply filter blur-2xl opacity-10 group-hover:opacity-20 transition-opacity"></div>
        <h3 class="text-sm font-semibold text-slate-500 mb-2 uppercase tracking-wider">Deuda Total</h3>
        <p class="text-3xl font-extrabold text-slate-900">{{ formatearMonedaPeru(deudasStore.deudaTotal) }}</p>
      </div>
      
      <div class="glass p-6 rounded-2xl shadow-sm border border-white/60 card-hover relative overflow-hidden group">
        <div class="absolute -right-4 -top-4 w-24 h-24 bg-amber-400 rounded-full mix-blend-multiply filter blur-2xl opacity-10 group-hover:opacity-20 transition-opacity"></div>
        <h3 class="text-sm font-semibold text-slate-500 mb-2 uppercase tracking-wider">Cuotas (Mes)</h3>
        <p class="text-3xl font-extrabold text-slate-900">{{ formatearMonedaPeru(deudasStore.cuotaTotalMes) }}</p>
      </div>
      
      <div class="glass p-6 rounded-2xl shadow-sm border border-white/60 card-hover relative overflow-hidden group">
        <div class="absolute -right-4 -top-4 w-24 h-24 bg-emerald-400 rounded-full mix-blend-multiply filter blur-2xl opacity-10 group-hover:opacity-20 transition-opacity"></div>
        <h3 class="text-sm font-semibold text-slate-500 mb-2 uppercase tracking-wider">Próximo Vence</h3>
        <template v-if="deudasStore.proximosVencimientos.length > 0">
          <p class="text-2xl font-bold text-slate-900">Día {{ deudasStore.proximosVencimientos[0].dia_vencimiento }}</p>
          <p class="text-sm text-slate-500 mt-1 truncate">{{ deudasStore.proximosVencimientos[0].nombre }}</p>
        </template>
        <template v-else>
           <p class="text-2xl font-bold text-slate-900">-</p>
        </template>
      </div>
      
      <div class="glass p-6 rounded-2xl shadow-sm border border-white/60 card-hover relative overflow-hidden group">
        <div class="absolute -right-4 -top-4 w-24 h-24 bg-indigo-400 rounded-full mix-blend-multiply filter blur-2xl opacity-10 group-hover:opacity-20 transition-opacity"></div>
        <h3 class="text-sm font-semibold text-slate-500 mb-2 uppercase tracking-wider">Activas</h3>
        <p class="text-3xl font-extrabold text-slate-900">{{ deudasStore.deudasActivas.length }}</p>
      </div>
    </div>

    <!-- Deudas List -->
    <div class="glass rounded-3xl shadow-sm border border-white/60 p-6 sm:p-8 stagger-3">
      <div class="flex items-center justify-between mb-6">
        <h2 class="text-xl font-bold text-slate-900">Mis Deudas</h2>
      </div>
      
      <div v-if="deudasStore.loading" class="text-center py-12">
        <div class="animate-spin rounded-full h-10 w-10 border-b-2 border-indigo-600 mx-auto"></div>
        <p class="text-slate-500 mt-4 font-medium">Cargando tu información...</p>
      </div>

      <div v-else-if="deudasStore.deudas.length === 0" class="text-center py-16 px-4 border-2 border-dashed border-slate-200 rounded-2xl bg-slate-50/50">
        <div class="bg-white p-4 rounded-full inline-block mb-4 shadow-sm">
          <svg xmlns="http://www.w3.org/2000/svg" class="h-10 w-10 text-indigo-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2" />
          </svg>
        </div>
        <h3 class="text-lg font-bold text-slate-900 mb-1">No hay deudas registradas</h3>
        <p class="text-slate-500 max-w-sm mx-auto mb-6">Comienza a organizar tus finanzas registrando tu primera deuda.</p>
        <button @click="goNuevaDeuda" class="text-indigo-600 font-semibold hover:text-indigo-700 bg-indigo-50 px-4 py-2 rounded-lg transition-colors">
          Registrar ahora
        </button>
      </div>

      <div v-else class="space-y-4">
        <!-- Deuda Items -->
        <div v-for="(deuda, index) in deudasStore.deudas" :key="deuda.id" 
             class="group flex flex-col sm:flex-row justify-between items-start sm:items-center p-5 bg-white/60 border border-slate-100 rounded-2xl hover:bg-white hover:shadow-md transition-all cursor-pointer animate-slide-up"
             :style="{ animationDelay: `${index * 100}ms` }">
          
          <div class="flex items-center gap-5 w-full sm:w-auto">
             <div class="h-12 w-12 rounded-xl flex items-center justify-center shadow-sm shrink-0 transition-transform group-hover:scale-110" 
                  :class="deuda.tipo === 'formal' ? 'bg-gradient-to-br from-blue-50 to-indigo-100 text-indigo-600 border border-indigo-100' : 'bg-gradient-to-br from-purple-50 to-pink-100 text-purple-600 border border-purple-100'">
                <svg v-if="deuda.tipo === 'formal'" xmlns="http://www.w3.org/2000/svg" class="h-6 w-6" viewBox="0 0 20 20" fill="currentColor">
                  <path fill-rule="evenodd" d="M10.496 2.132a1 1 0 00-.992 0l-7 4A1 1 0 003 7v10a1 1 0 001 1h12a1 1 0 001-1V7a1 1 0 00-.504-.868l-7-4zM5 9a1 1 0 00-1 1v4a1 1 0 102 0v-4a1 1 0 00-1-1zm3 0a1 1 0 00-1 1v4a1 1 0 102 0v-4a1 1 0 00-1-1zm4 1a1 1 0 11-2 0v4a1 1 0 112 0v-4zm2-1a1 1 0 00-1 1v4a1 1 0 102 0v-4a1 1 0 00-1-1z" clip-rule="evenodd" />
                </svg>
                <svg v-else xmlns="http://www.w3.org/2000/svg" class="h-6 w-6" viewBox="0 0 20 20" fill="currentColor">
                  <path fill-rule="evenodd" d="M10 9a3 3 0 100-6 3 3 0 000 6zm-7 9a7 7 0 1114 0H3z" clip-rule="evenodd" />
                </svg>
             </div>
             <div class="flex-1 min-w-0">
               <h4 class="font-bold text-slate-900 truncate">{{ deuda.nombre }}</h4>
               <div class="flex items-center gap-2 mt-1">
                 <span class="text-sm font-medium text-slate-500">{{ deuda.entidad }}</span>
                 <span class="text-slate-300">&bull;</span>
                 <span class="text-sm text-slate-500 flex items-center gap-1">
                   <svg xmlns="http://www.w3.org/2000/svg" class="h-4 w-4 text-slate-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                     <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z" />
                   </svg>
                   Vence día {{ deuda.dia_vencimiento }}
                 </span>
               </div>
             </div>
          </div>
          
          <div class="mt-4 sm:mt-0 text-left sm:text-right w-full sm:w-auto flex sm:block justify-between items-center border-t border-slate-100 sm:border-0 pt-3 sm:pt-0">
             <p class="font-extrabold text-lg text-slate-900">{{ formatearMonedaPeru(deuda.monto_pendiente) }}</p>
             <div class="flex items-center gap-2 justify-end mt-1">
               <span class="inline-flex items-center px-2.5 py-1 rounded-md text-xs font-bold uppercase tracking-wider" :class="{
                 'bg-emerald-100 text-emerald-700': deuda.estado === 'activa',
                 'bg-amber-100 text-amber-700': deuda.estado === 'pausada',
                 'bg-slate-100 text-slate-600': deuda.estado === 'cerrada'
               }">
                 {{ deuda.estado }}
               </span>
             </div>
          </div>
        </div>
      </div>
    </div>
  </div>
</template>
