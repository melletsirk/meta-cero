<script setup>
import { ref, onMounted } from 'vue'
import { useRouter } from 'vue-router'
import { useDeudasStore } from '../stores/deudas'
import { formatearMoneda } from '../lib/finanzas'

const deudasStore = useDeudasStore()
const router = useRouter()

const formatMonto = (monto, moneda) => formatearMoneda(Number(monto) || 0, moneda || 'PEN')

const goDetalle = (id) => router.push(`/deudas/${id}`)

onMounted(() => {
  deudasStore.fetchHistorial()
})
</script>

<template>
  <div class="space-y-8 pb-12">
    <!-- ── Header ── -->
    <div class="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-6">
      <div>
        <h1 class="text-3xl font-extrabold text-slate-900 tracking-tight">
          Historial de Deudas
        </h1>
        <p class="text-slate-500 mt-1 font-medium">Aquí están las deudas que ya lograste liquidar.</p>
      </div>
    </div>

    <!-- Lista de deudas cerradas -->
    <div class="glass rounded-3xl shadow-sm border border-white/60 p-6 sm:p-8">
      <!-- Loading -->
      <div v-if="deudasStore.loading" class="text-center py-16">
        <div class="animate-spin rounded-full h-10 w-10 border-b-2 border-indigo-600 mx-auto"></div>
        <p class="text-slate-500 mt-4 font-medium">Cargando historial...</p>
      </div>

      <!-- Vacío -->
      <div v-else-if="deudasStore.historialCerradas.length === 0"
        class="text-center py-16 px-4 border-2 border-dashed border-slate-200 rounded-2xl bg-slate-50/50">
        <div class="bg-emerald-100 p-4 rounded-full inline-block mb-4 shadow-sm">
          <svg xmlns="http://www.w3.org/2000/svg" class="h-10 w-10 text-emerald-500" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
          </svg>
        </div>
        <h3 class="text-lg font-bold text-slate-900 mb-1">Aún no hay deudas finalizadas</h3>
        <p class="text-slate-500 max-w-sm mx-auto mb-6">Cuando liquides una deuda, aparecerá aquí como parte de tus logros.</p>
      </div>

      <!-- Lista -->
      <div v-else class="space-y-4">
        <div
          v-for="(deuda, index) in deudasStore.historialCerradas"
          :key="deuda.id"
          @click="goDetalle(deuda.id)"
          class="group flex flex-col sm:flex-row justify-between items-start sm:items-center p-5 bg-white/60 border border-slate-100 rounded-2xl hover:bg-white hover:shadow-md transition-all cursor-pointer opacity-75 hover:opacity-100 grayscale hover:grayscale-0">

          <!-- Info izquierda -->
          <div class="flex items-center gap-4 w-full sm:w-auto">
            <div class="h-12 w-12 rounded-xl flex items-center justify-center shadow-sm shrink-0 bg-slate-100 text-slate-500 border border-slate-200">
              <svg xmlns="http://www.w3.org/2000/svg" class="h-6 w-6" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
              </svg>
            </div>

            <div class="flex-1 min-w-0">
              <h4 class="font-bold text-slate-900 truncate line-through">{{ deuda.nombre }}</h4>
              <div class="flex flex-wrap items-center gap-x-2 gap-y-1 mt-1">
                <span class="text-sm font-medium text-slate-500">{{ deuda.entidad }}</span>
                <span class="text-slate-300">•</span>
                <span class="text-xs font-bold px-2 py-0.5 rounded-full bg-slate-100 text-slate-500">
                  Cancelada
                </span>
              </div>
            </div>
          </div>

          <!-- Info derecha -->
          <div class="mt-4 sm:mt-0 flex flex-col sm:items-end gap-2 border-t border-slate-100 sm:border-0 pt-3 sm:pt-0 w-full sm:w-auto">
            <div class="flex sm:flex-col justify-between sm:items-end w-full">
              <div>
                <span class="text-xs text-slate-400 font-medium">Monto Original</span>
                <p class="font-extrabold text-lg text-slate-900 leading-tight">
                  {{ formatMonto(deuda.monto_original || 0, deuda.moneda) }}
                </p>
              </div>
              <span class="inline-flex items-center px-2.5 py-1 rounded-md text-xs font-bold uppercase tracking-wider bg-emerald-100 text-emerald-700">
                Líquidada
              </span>
            </div>
          </div>
        </div>
      </div>
    </div>
  </div>
</template>
