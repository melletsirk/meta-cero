<script setup>
import { ref, computed, onMounted } from 'vue'
import { useRouter } from 'vue-router'
import { useDeudasStore } from '../stores/deudas'
import { useNotificationsStore } from '../stores/notifications'
import { formatearMoneda } from '../lib/finanzas'
import { useAuthStore } from '../stores/auth'
import { supabase } from '../lib/supabase'

const router = useRouter()
const deudasStore = useDeudasStore()
const notificationsStore = useNotificationsStore()
const authStore = useAuthStore()

const loading = ref(false)
const cuotasVencidas = ref([])

const hoy = new Date()
const hoyStr = hoy.toISOString().split('T')[0]

const PALETA = [
  { bg: 'bg-indigo-50 border-indigo-200', dot: 'bg-indigo-500', text: 'text-indigo-700', badge: 'bg-indigo-100 text-indigo-700' },
  { bg: 'bg-violet-50 border-violet-200', dot: 'bg-violet-500', text: 'text-violet-700', badge: 'bg-violet-100 text-violet-700' },
  { bg: 'bg-sky-50 border-sky-200', dot: 'bg-sky-500', text: 'text-sky-700', badge: 'bg-sky-100 text-sky-700' },
  { bg: 'bg-emerald-50 border-emerald-200', dot: 'bg-emerald-500', text: 'text-emerald-700', badge: 'bg-emerald-100 text-emerald-700' },
  { bg: 'bg-rose-50 border-rose-200', dot: 'bg-rose-500', text: 'text-rose-700', badge: 'bg-rose-100 text-rose-700' },
  { bg: 'bg-amber-50 border-amber-200', dot: 'bg-amber-500', text: 'text-amber-700', badge: 'bg-amber-100 text-amber-700' },
  { bg: 'bg-pink-50 border-pink-200', dot: 'bg-pink-500', text: 'text-pink-700', badge: 'bg-pink-100 text-pink-700' },
  { bg: 'bg-cyan-50 border-cyan-200', dot: 'bg-cyan-500', text: 'text-cyan-700', badge: 'bg-cyan-100 text-cyan-700' },
]

const colorPorDeuda = computed(() => {
  const mapa = {}
  deudasStore.deudas.forEach((d, i) => {
    mapa[d.id] = PALETA[i % PALETA.length]
  })
  return mapa
})

async function cargarVencidas(silent = false) {
  if (!authStore.user) return
  if (!silent) loading.value = true
  try {
    if (deudasStore.deudas.length === 0) {
      await deudasStore.fetchDeudas(silent)
    }
    const deudasMap = {}
    deudasStore.deudas.forEach(d => { deudasMap[d.id] = d })

    const { data, error } = await supabase
      .from('v_cronograma_consolidado')
      .select('*')
      .eq('pagada', false)
      .lt('fecha', hoyStr)
      .order('fecha', { ascending: true })

    if (error) throw error

    cuotasVencidas.value = data.map(c => ({
      ...c,
      deuda: deudasMap[c.deuda_id] || null,
    }))
  } catch (e) {
    console.error('Error cargando cuotas vencidas:', e)
  } finally {
    if (!silent) loading.value = false
  }
}

onMounted(cargarVencidas)

const totalVencidoPEN = computed(() =>
  cuotasVencidas.value
    .filter(c => (c.deuda?.moneda || 'PEN') === 'PEN')
    .reduce((s, c) => s + Number(c.total), 0)
)
const totalVencidoUSD = computed(() =>
  cuotasVencidas.value
    .filter(c => c.deuda?.moneda === 'USD')
    .reduce((s, c) => s + Number(c.total), 0)
)

const toggling = ref({})
async function togglePagada(cuota) {
  if (toggling.value[cuota.id]) return

  let cuotasDeuda = deudasStore.cuotasPorDeuda[cuota.deuda_id] || []
  if (cuotasDeuda.length === 0) {
    cuotasDeuda = await deudasStore.fetchCuotas(cuota.deuda_id)
  }

  const ordenadas = [...cuotasDeuda].sort((a, b) => a.numero - b.numero)
  const proximaIdx = ordenadas.findIndex(c => !c.pagada)
  const idxActual = ordenadas.findIndex(c => c.id === cuota.id)

  if (idxActual !== proximaIdx) {
    notificationsStore.error('Debes pagar primero la cuota anterior para continuar.')
    return
  }

  toggling.value[cuota.id] = true
  try {
    await deudasStore.toggleCuotaPagada(cuota, cuota.deuda)
    notificationsStore.success('✅ Cuota marcada como pagada')
    await cargarVencidas(true)
  } catch (e) {
    console.error(e)
    notificationsStore.error('Error al actualizar la cuota')
  } finally {
    toggling.value[cuota.id] = false
  }
}

function formatFecha(fechaStr) {
  const f = new Date(fechaStr + 'T12:00:00')
  return f.toLocaleDateString('es-PE', { weekday: 'short', day: 'numeric', month: 'short', year: 'numeric' })
}
function formatMonto(monto, moneda) {
  return formatearMoneda(Number(monto), moneda || 'PEN')
}
function diasAtraso(fechaStr) {
  const f = new Date(fechaStr + 'T12:00:00')
  const diffTime = hoy - f
  return Math.max(1, Math.ceil(diffTime / (1000 * 60 * 60 * 24)))
}
</script>

<template>
  <div class="space-y-6 pb-12">
    <!-- Header -->
    <div class="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
      <div>
        <h1 class="text-3xl font-extrabold text-slate-900 tracking-tight">
          Cuotas <span class="text-red-600">Atrasadas</span>
        </h1>
        <p class="text-slate-500 mt-1 font-medium">Historial de pagos vencidos</p>
      </div>
      <button @click="router.push('/')"
        class="text-slate-500 hover:text-indigo-600 flex items-center gap-2 text-sm font-medium transition-colors">
        <svg xmlns="http://www.w3.org/2000/svg" class="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
          <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M15 19l-7-7 7-7" />
        </svg>
        Volver al Dashboard
      </button>
    </div>

    <!-- Resumen -->
    <div class="glass p-6 rounded-3xl border border-red-200/60 shadow-sm flex flex-col sm:flex-row justify-between items-center gap-6 bg-red-50/30">
      <div>
        <p class="text-sm font-bold text-red-800 uppercase tracking-wider mb-1">Deuda Vencida Total</p>
        <p class="text-3xl font-extrabold text-red-600">{{ formatMonto(totalVencidoPEN, 'PEN') }}</p>
        <p v-if="totalVencidoUSD > 0" class="text-lg font-bold text-red-500 mt-1">
          + {{ formatMonto(totalVencidoUSD, 'USD') }}
        </p>
      </div>
      <div class="text-right">
        <p class="text-sm font-bold text-slate-500 uppercase tracking-wider mb-1">Cuotas Pendientes</p>
        <p class="text-3xl font-extrabold text-slate-900">{{ cuotasVencidas.length }}</p>
      </div>
    </div>

    <!-- Loading -->
    <div v-if="loading" class="text-center py-20">
      <div class="animate-spin rounded-full h-12 w-12 border-b-2 border-indigo-600 mx-auto mb-4"></div>
      <p class="text-slate-500 font-medium">Buscando atrasos...</p>
    </div>

    <!-- Vacío -->
    <div v-else-if="cuotasVencidas.length === 0" class="glass rounded-3xl border border-emerald-200/60 shadow-sm p-12 text-center bg-emerald-50/30">
      <div class="bg-emerald-100 p-4 rounded-full inline-block mb-4">
        <svg xmlns="http://www.w3.org/2000/svg" class="h-10 w-10 text-emerald-600" fill="none" viewBox="0 0 24 24" stroke="currentColor">
          <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
        </svg>
      </div>
      <h3 class="text-xl font-extrabold text-emerald-900 mb-2">¡Felicidades!</h3>
      <p class="text-emerald-700 font-medium">Estás completamente al día con tus pagos. No tienes cuotas atrasadas.</p>
    </div>

    <!-- Lista -->
    <div v-else class="overflow-x-auto bg-white rounded-2xl shadow-sm border border-slate-200">
      <table class="min-w-full text-sm">
        <thead class="bg-red-50 border-b-2 border-red-100">
          <tr class="text-red-900">
            <th class="px-4 py-4 text-left text-sm font-extrabold uppercase tracking-wider rounded-tl-2xl">Fecha de Pago</th>
            <th class="px-4 py-4 text-left text-sm font-extrabold uppercase tracking-wider">Préstamo</th>
            <th class="px-4 py-4 text-center text-sm font-extrabold uppercase tracking-wider">N° Cuota</th>
            <th class="px-4 py-4 text-center text-sm font-extrabold uppercase tracking-wider">Atraso</th>
            <th class="px-4 py-4 text-right text-sm font-extrabold uppercase tracking-wider">Monto Vencido</th>
            <th class="px-4 py-4 text-center text-sm font-extrabold uppercase tracking-wider rounded-tr-2xl">Pagar</th>
          </tr>
        </thead>
        <tbody class="divide-y divide-slate-100">
          <tr v-for="cuota in cuotasVencidas" :key="cuota.id" class="transition-colors hover:bg-slate-50">
            <td class="px-4 py-4 whitespace-nowrap">
              <span class="font-bold text-slate-900 text-base">{{ formatFecha(cuota.fecha) }}</span>
            </td>
            <td class="px-4 py-4">
              <div class="flex items-center gap-2">
                <div class="shrink-0 w-3 h-3 rounded-full" :class="colorPorDeuda[cuota.deuda?.id]?.dot || 'bg-slate-400'"></div>
                <div>
                  <p class="font-bold text-slate-800 text-base">{{ cuota.deuda?.nombre || cuota.nombre_deuda || 'Sin nombre' }}</p>
                  <p class="text-sm text-slate-500 font-medium">{{ cuota.deuda?.entidad || cuota.entidad }}</p>
                </div>
              </div>
            </td>
            <td class="px-4 py-4 text-center font-bold text-slate-500">{{ cuota.numero }}</td>
            <td class="px-4 py-4 text-center">
              <span class="px-3 py-1 bg-red-100 text-red-700 text-xs font-extrabold rounded-full">
                Hace {{ diasAtraso(cuota.fecha) }} días
              </span>
            </td>
            <td class="px-4 py-4 text-right font-extrabold text-red-600 text-lg">
              {{ formatMonto(cuota.total, cuota.deuda?.moneda || cuota.moneda) }}
            </td>
            <td class="px-4 py-4 text-center">
              <button @click="togglePagada(cuota)" :disabled="toggling[cuota.id]"
                class="w-10 h-10 mx-auto rounded-full border-2 border-slate-200 text-slate-400 hover:border-emerald-500 hover:text-emerald-500 flex items-center justify-center transition-all bg-white shadow-sm hover:shadow-emerald-200"
                title="Marcar como pagada">
                <svg v-if="!toggling[cuota.id]" xmlns="http://www.w3.org/2000/svg" class="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path stroke-linecap="round" stroke-linejoin="round" stroke-width="3" d="M5 13l4 4L19 7" />
                </svg>
                <svg v-else class="animate-spin h-5 w-5 text-emerald-500" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
                  <circle class="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" stroke-width="4" />
                  <path class="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8v8H4z" />
                </svg>
              </button>
            </td>
          </tr>
        </tbody>
      </table>
    </div>
  </div>
</template>
