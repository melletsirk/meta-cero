<script setup>
import { ref, computed, onMounted } from 'vue'
import { useRoute, useRouter } from 'vue-router'
import { useDeudasStore } from '../stores/deudas'
import { useNotificationsStore } from '../stores/notifications'
import { formatearMoneda, alertaTEA, FRECUENCIAS } from '../lib/finanzas'
import EditableCronogramaTable from '../components/EditableCronogramaTable.vue'

const route = useRoute()
const router = useRouter()
const deudasStore = useDeudasStore()
const notificationsStore = useNotificationsStore()

const deudaId = route.params.id
const cuotas = ref([])
const loadingDeuda = ref(true)   // loading local, independiente del store
const loadingCuotas = ref(true)
const togglingId = ref(null)

// Encontrar la deuda en el store (ya cargada desde el dashboard)
const deuda = computed(() => deudasStore.deudas.find(d => d.id === deudaId))

const fmt = (n, moneda) => formatearMoneda(Number(n) || 0, moneda || deuda.value?.moneda || 'PEN')

const frecuenciaLabel = (freq) => FRECUENCIAS[freq]?.label || 'Mensual'

const teaAlert = computed(() => {
  if (!deuda.value) return { level: 'none' }
  return alertaTEA(deuda.value.tea || deuda.value.tcea)
})

const teaBadgeClass = computed(() => {
  switch (teaAlert.value.level) {
    case 'yellow': return 'bg-yellow-100 text-yellow-800 border-yellow-300'
    case 'green': return 'bg-emerald-100 text-emerald-800 border-emerald-300'
    case 'orange': return 'bg-orange-100 text-orange-800 border-orange-300'
    case 'red': return 'bg-red-100 text-red-800 border-red-300'
    default: return 'bg-slate-100 text-slate-600 border-slate-200'
  }
})

const cuotasPagadas = computed(() => cuotas.value.filter(c => c.pagada).length)

// El saldo pendiente ahora es calculado por la DB (v_resumen_deudas)

onMounted(async () => {
  // Si no hay deudas cargadas, fetchearlas primero
  if (deudasStore.deudas.length === 0) {
    await deudasStore.fetchDeudas()
  }
  loadingDeuda.value = false
  // Cargar cuotas de esta deuda
  const data = await deudasStore.fetchCuotas(deudaId)
  cuotas.value = data
  loadingCuotas.value = false
})

const handleToggleCuota = async (cuota) => {
  if (togglingId.value) return

  // ── Regla secuencial ────────────────────────────────────────────────────
  // Solo se puede accionar la próxima cuota sin pagar (para marcar como pagada)
  // o la última cuota pagada (para deshacer un error).
  const ordenadas = [...cuotas.value].sort((a, b) => a.numero - b.numero)
  const proximaIdx = ordenadas.findIndex(c => !c.pagada)
  const ultimaPagadaIdx = (() => {
    for (let i = ordenadas.length - 1; i >= 0; i--) {
      if (ordenadas[i].pagada) return i
    }
    return -1
  })()

  const idxActual = ordenadas.findIndex(c => c.id === cuota.id)

  if (idxActual !== proximaIdx && idxActual !== ultimaPagadaIdx) {
    // Mensaje de error descriptivo según el caso
    if (!cuota.pagada) {
      notificationsStore.error('Debes pagar primero la cuota anterior para continuar.')
    } else {
      notificationsStore.error('Solo puedes desmarcar la última cuota pagada.')
    }
    return
  }
  // ────────────────────────────────────────────────────────────────────────

  togglingId.value = cuota.id
  // Capturar estado previo ANTES del optimistic update del store
  const estabaPageda = cuota.pagada
  try {
    await deudasStore.toggleCuotaPagada(cuota, deuda.value)
    cuotas.value = deudasStore.cuotasPorDeuda[deudaId] || cuotas.value
    const msg = estabaPageda ? '↩ Cuota desmarcada' : '✅ Cuota marcada como pagada'
    notificationsStore.success(msg)
  } catch (e) {
    notificationsStore.error('Error al actualizar la cuota')
  } finally {
    togglingId.value = null
  }
}

const handleEliminar = async () => {
  if (!confirm('¿Eliminar esta deuda? Esta acción no se puede deshacer.')) return
  try {
    await deudasStore.deleteDeuda(deudaId)
    notificationsStore.success('Deuda eliminada')
    router.push('/')
  } catch (e) {
    notificationsStore.error('Error al eliminar')
  }
}
</script>

<template>
  <div class="flex-1 p-2 sm:p-4 lg:p-6 overflow-y-auto animate-fade-in relative z-10 w-full mx-auto">
    <!-- Back Button -->
    <div class="flex items-center gap-3 mb-6">
      <button @click="router.push('/')"
        class="p-2 text-slate-400 hover:text-indigo-600 hover:bg-indigo-50 rounded-xl transition-all">
        <svg xmlns="http://www.w3.org/2000/svg" class="h-6 w-6" fill="none" viewBox="0 0 24 24" stroke="currentColor">
          <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M10 19l-7-7m0 0l7-7m-7 7h18" />
        </svg>
      </button>
      <span class="text-slate-400 text-sm font-medium">Mis Deudas</span>
    </div>

    <!-- Estado no encontrado -->
    <div v-if="!deuda && !loadingDeuda" class="text-center py-20 text-slate-400">
      <p class="text-lg font-bold">Deuda no encontrada</p>
      <button @click="router.push('/')" class="mt-4 text-indigo-600 font-semibold hover:underline">Volver al inicio</button>
    </div>

    <!-- Loading -->
    <div v-else-if="loadingDeuda" class="text-center py-20">
      <div class="animate-spin rounded-full h-10 w-10 border-b-2 border-indigo-600 mx-auto"></div>
    </div>

    <template v-else-if="deuda">
      <!-- ── Header de la Deuda ── -->
      <div
        class="glass rounded-3xl border border-white/60 shadow-xl shadow-slate-200/40 p-6 sm:p-8 mb-6 relative overflow-hidden">
        <div
          class="absolute -top-20 -right-20 w-48 h-48 bg-indigo-100 rounded-full mix-blend-multiply filter blur-3xl opacity-60 pointer-events-none">
        </div>

        <div class="flex flex-col sm:flex-row justify-between gap-4 relative z-10">
          <div class="flex items-start gap-4">
            <!-- Ícono tipo -->
            <div class="h-14 w-14 rounded-2xl flex items-center justify-center shadow-sm shrink-0"
              :class="deuda.tipo === 'formal' ? 'bg-gradient-to-br from-blue-50 to-indigo-100 text-indigo-600 border border-indigo-100' : 'bg-gradient-to-br from-purple-50 to-pink-100 text-purple-600 border border-purple-100'">
              <svg v-if="deuda.tipo === 'formal'" xmlns="http://www.w3.org/2000/svg" class="h-7 w-7" viewBox="0 0 20 20"
                fill="currentColor">
                <path fill-rule="evenodd"
                  d="M10.496 2.132a1 1 0 00-.992 0l-7 4A1 1 0 003 7v10a1 1 0 001 1h12a1 1 0 001-1V7a1 1 0 00-.504-.868l-7-4zM5 9a1 1 0 00-1 1v4a1 1 0 102 0v-4a1 1 0 00-1-1zm3 0a1 1 0 00-1 1v4a1 1 0 102 0v-4a1 1 0 00-1-1zm4 1a1 1 0 11-2 0v4a1 1 0 112 0v-4zm2-1a1 1 0 00-1 1v4a1 1 0 102 0v-4a1 1 0 00-1-1z"
                  clip-rule="evenodd" />
              </svg>
              <svg v-else xmlns="http://www.w3.org/2000/svg" class="h-7 w-7" viewBox="0 0 20 20" fill="currentColor">
                <path fill-rule="evenodd" d="M10 9a3 3 0 100-6 3 3 0 000 6zm-7 9a7 7 0 1114 0H3z" clip-rule="evenodd" />
              </svg>
            </div>
            <div>
              <h1 class="text-2xl font-extrabold text-slate-900 tracking-tight">{{ deuda.nombre }}</h1>
              <div class="flex flex-wrap items-center gap-2 mt-1.5">
                <span class="text-sm font-semibold text-slate-500">{{ deuda.entidad }}</span>
                <span class="text-slate-300">•</span>
                <span class="text-xs font-semibold bg-slate-100 text-slate-500 px-2 py-0.5 rounded-full">
                  {{ frecuenciaLabel(deuda.frecuencia_pago) }}
                </span>
                <span class="text-xs font-bold px-2 py-0.5 rounded-full"
                  :class="deuda.moneda === 'USD' ? 'bg-green-100 text-green-700' : 'bg-blue-100 text-blue-700'">
                  {{ deuda.moneda === 'USD' ? '$ USD' : 'S/ PEN' }}
                </span>
                <!-- TEA/TCEA badge -->
                <span v-if="deuda.tea || deuda.tcea" class="text-xs font-bold px-2 py-0.5 rounded-full border"
                  :class="teaBadgeClass">
                  {{ deuda.tea ? `TEA ${deuda.tea}%` : `TCEA ${deuda.tcea}%` }}
                </span>
              </div>
            </div>
          </div>

          <!-- Estado + Acciones -->
          <div class="flex flex-row sm:flex-col items-center sm:items-end gap-3 shrink-0">
            <span class="inline-flex items-center px-3 py-1 rounded-lg text-xs font-bold uppercase tracking-wider"
              :class="{
                'bg-emerald-100 text-emerald-700': deuda.estado === 'activa',
                'bg-amber-100 text-amber-700': deuda.estado === 'pausada',
                'bg-slate-100 text-slate-600': deuda.estado === 'cerrada'
              }">
              {{ deuda.estado }}
            </span>
            <div class="flex items-center">
              <button @click="router.push(`/deudas/${deudaId}/editar`)"
                class="p-2 text-slate-400 hover:text-indigo-600 hover:bg-indigo-50 rounded-xl transition-colors"
                title="Editar deuda">
                <svg xmlns="http://www.w3.org/2000/svg" class="h-5 w-5" fill="none" viewBox="0 0 24 24"
                  stroke="currentColor">
                  <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2"
                    d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z" />
                </svg>
              </button>
              <button @click="handleEliminar"
                class="p-2 text-slate-400 hover:text-red-600 hover:bg-red-50 rounded-xl transition-colors"
                title="Eliminar deuda">
                <svg xmlns="http://www.w3.org/2000/svg" class="h-5 w-5" fill="none" viewBox="0 0 24 24"
                  stroke="currentColor">
                  <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2"
                    d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                </svg>
              </button>
            </div>
          </div>
        </div>
      </div>

      <!-- ── Métricas clave ── -->
      <div class="grid grid-cols-2 sm:grid-cols-4 gap-4 mb-6">
        <div class="glass rounded-2xl border border-white/60 shadow-sm p-4 relative overflow-hidden group">
          <div
            class="absolute -right-3 -top-3 w-16 h-16 bg-red-400 rounded-full mix-blend-multiply filter blur-2xl opacity-10">
          </div>
          <p class="text-xs font-semibold text-slate-400 uppercase tracking-wider mb-1">Pendiente c/ intereses</p>
          <p class="text-xl font-extrabold text-slate-900 leading-tight">{{ fmt(deuda.total_pendiente || 0) }}</p>
        </div>
        <div class="glass rounded-2xl border border-white/60 shadow-sm p-4 relative overflow-hidden">
          <div
            class="absolute -right-3 -top-3 w-16 h-16 bg-indigo-400 rounded-full mix-blend-multiply filter blur-2xl opacity-10">
          </div>
          <p class="text-xs font-semibold text-slate-400 uppercase tracking-wider mb-1">Original</p>
          <p class="text-xl font-extrabold text-slate-900 leading-tight">{{ fmt(deuda.monto_original) }}</p>
        </div>
        <div class="glass rounded-2xl border border-white/60 shadow-sm p-4 relative overflow-hidden">
          <div
            class="absolute -right-3 -top-3 w-16 h-16 bg-emerald-400 rounded-full mix-blend-multiply filter blur-2xl opacity-10">
          </div>
          <p class="text-xs font-semibold text-slate-400 uppercase tracking-wider mb-1">Cuotas pagadas</p>
          <p class="text-xl font-extrabold text-slate-900 leading-tight">
            {{ cuotasPagadas }} <span class="text-sm font-semibold text-slate-400">/ {{ deuda.num_cuotas }}</span>
          </p>
        </div>
        <div class="glass rounded-2xl border border-white/60 shadow-sm p-4 relative overflow-hidden">
          <div
            class="absolute -right-3 -top-3 w-16 h-16 bg-amber-400 rounded-full mix-blend-multiply filter blur-2xl opacity-10">
          </div>
          <p class="text-xs font-semibold text-slate-400 uppercase tracking-wider mb-1">Inicio</p>
          <p class="text-base font-extrabold text-slate-900 leading-tight">
            {{ deuda.fecha_inicio ? new Date(deuda.fecha_inicio + 'T12:00:00').toLocaleDateString('es-PE', {
              day: '2-digit', month: 'short', year: 'numeric'
            }) : '-' }}
          </p>
        </div>
      </div>

      <!-- ── Cronograma ── -->
      <div class="glass rounded-3xl border border-white/60 shadow-xl shadow-slate-200/40 p-6 sm:p-8">
        <div v-if="loadingCuotas" class="text-center py-10">
          <div class="animate-spin rounded-full h-8 w-8 border-b-2 border-indigo-600 mx-auto"></div>
          <p class="text-slate-400 text-sm mt-3">Cargando cronograma...</p>
        </div>

        <template v-else>
          <EditableCronogramaTable v-model="cuotas" :moneda="deuda.moneda" readonly :toggling-id="togglingId"
            @toggle="handleToggleCuota" />
        </template>
      </div>
    </template>
  </div>
</template>
