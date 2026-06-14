<script setup>
import { ref, computed, onMounted } from 'vue'
import { useRouter } from 'vue-router'
import { useDeudasStore } from '../stores/deudas'
import { formatearMoneda } from '../lib/finanzas'
import { supabase } from '../lib/supabase'
import { useAuthStore } from '../stores/auth'

const router = useRouter()
const deudasStore = useDeudasStore()
const authStore = useAuthStore()

// ── Estado ─────────────────────────────────────────
const loading = ref(false)
const todasLasCuotas = ref([])  // { ...cuota, deuda }

const hoy = new Date()
const mesActual = ref(hoy.getMonth())   // 0-11
const anioActual = ref(hoy.getFullYear())

const MESES = [
  'Enero', 'Febrero', 'Marzo', 'Abril', 'Mayo', 'Junio',
  'Julio', 'Agosto', 'Septiembre', 'Octubre', 'Noviembre', 'Diciembre'
]

// ── Paleta de colores por deuda ─────────────────────
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

// mapa deudaId → índice de color
const colorPorDeuda = computed(() => {
  const mapa = {}
  deudasStore.deudas.forEach((d, i) => {
    mapa[d.id] = PALETA[i % PALETA.length]
  })
  return mapa
})

// ── Carga de datos ──────────────────────────────────
async function cargarTodasLasCuotas() {
  if (!authStore.user) return
  loading.value = true
  try {
    // Aseguramos que las deudas estén cargadas
    if (deudasStore.deudas.length === 0) {
      await deudasStore.fetchDeudas()
    }

    // Traer TODAS las cuotas del usuario
    const { data, error } = await supabase
      .from('cuotas')
      .select('*')
      .order('fecha', { ascending: true })

    if (error) throw error

    // Enriquecer cada cuota con la info de su deuda (ya cargada en el store)
    const deudasMap = {}
    deudasStore.deudas.forEach(d => { deudasMap[d.id] = d })

    todasLasCuotas.value = (data || []).map(c => ({
      ...c,
      deuda: deudasMap[c.deuda_id] || null,
    }))
  } catch (e) {
    console.error('Error cargando cuotas:', e)
  } finally {
    loading.value = false
  }
}

onMounted(cargarTodasLasCuotas)

// ── Navegación de mes ───────────────────────────────
function mesAnterior() {
  if (mesActual.value === 0) { mesActual.value = 11; anioActual.value-- }
  else mesActual.value--
}
function mesSiguiente() {
  if (mesActual.value === 11) { mesActual.value = 0; anioActual.value++ }
  else mesActual.value++
}
function irHoy() {
  mesActual.value = hoy.getMonth()
  anioActual.value = hoy.getFullYear()
}

// ── Cuotas del mes seleccionado ─────────────────────
const cuotasDelMes = computed(() => {
  return todasLasCuotas.value
    .filter(c => {
      const f = new Date(c.fecha + 'T12:00:00')
      return f.getFullYear() === anioActual.value && f.getMonth() === mesActual.value
    })
    .sort((a, b) => {
      if (a.pagada !== b.pagada) return a.pagada ? 1 : -1
      return new Date(a.fecha) - new Date(b.fecha)
    })
})


// ── Totales del mes ─────────────────────────────────
const totalMesPEN = computed(() =>
  cuotasDelMes.value
    .filter(c => (c.deuda?.moneda || 'PEN') === 'PEN')
    .reduce((s, c) => s + Number(c.total), 0)
)
const totalMesUSD = computed(() =>
  cuotasDelMes.value
    .filter(c => c.deuda?.moneda === 'USD')
    .reduce((s, c) => s + Number(c.total), 0)
)
const cuotasPagadas = computed(() => cuotasDelMes.value.filter(c => c.pagada).length)
const cuotasPendientes = computed(() => cuotasDelMes.value.filter(c => !c.pagada).length)

// ── Toggle pagada ────────────────────────────────────
const toggling = ref({})
async function togglePagada(cuota) {
  toggling.value[cuota.id] = true
  try {
    const nuevaPagada = !cuota.pagada
    const fechaPago = nuevaPagada ? new Date().toISOString().split('T')[0] : null
    const { error } = await supabase
      .from('cuotas')
      .update({ pagada: nuevaPagada, fecha_pago: fechaPago })
      .eq('id', cuota.id)
    if (error) throw error
    cuota.pagada = nuevaPagada
    cuota.fecha_pago = fechaPago
  } catch (e) {
    console.error(e)
  } finally {
    toggling.value[cuota.id] = false
  }
}

// ── Helpers ──────────────────────────────────────────
function formatFecha(fechaStr) {
  const f = new Date(fechaStr + 'T12:00:00')
  return f.toLocaleDateString('es-PE', { weekday: 'short', day: 'numeric' })
}
function formatMonto(monto, moneda) {
  return formatearMoneda(Number(monto), moneda || 'PEN')
}
function esHoy(dia) {
  return dia === hoy.getDate() && mesActual.value === hoy.getMonth() && anioActual.value === hoy.getFullYear()
}
function esPasado(fechaStr) {
  return new Date(fechaStr + 'T12:00:00') < hoy
}
</script>

<template>
  <div class="space-y-6 pb-12">

    <!-- ── Header ── -->
    <div class="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
      <div>
        <h1 class="text-3xl font-extrabold text-slate-900 tracking-tight">
          Calendario de <span class="text-indigo-600">Cuotas</span>
        </h1>
        <p class="text-slate-500 mt-1 font-medium">Vista mensual de todos tus pagos</p>
      </div>
      <button @click="router.push('/')"
        class="text-slate-500 hover:text-indigo-600 flex items-center gap-2 text-sm font-medium transition-colors">
        <svg xmlns="http://www.w3.org/2000/svg" class="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
          <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M15 19l-7-7 7-7" />
        </svg>
        Volver al Dashboard
      </button>
    </div>

    <!-- ── Navegador de Mes ── -->
    <div class="glass rounded-2xl border border-white/60 shadow-sm p-2 flex items-center justify-between gap-4">
      <button @click="mesAnterior"
        class="p-2 rounded-xl hover:bg-indigo-50 text-slate-500 hover:text-indigo-600 transition-colors">
        <svg xmlns="http://www.w3.org/2000/svg" class="h-6 w-6" fill="none" viewBox="0 0 24 24" stroke="currentColor">
          <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M15 19l-7-7 7-7" />
        </svg>
      </button>

      <div class="text-center">
        <h2 class="text-2xl font-extrabold text-slate-900">{{ MESES[mesActual] }} {{ anioActual }}</h2>
        <button @click="irHoy"
          class="text-xs text-indigo-500 hover:text-indigo-700 font-semibold mt-0.5 transition-colors">
          Ir a hoy
        </button>
      </div>

      <button @click="mesSiguiente"
        class="p-2 rounded-xl hover:bg-indigo-50 text-slate-500 hover:text-indigo-600 transition-colors">
        <svg xmlns="http://www.w3.org/2000/svg" class="h-6 w-6" fill="none" viewBox="0 0 24 24" stroke="currentColor">
          <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M9 5l7 7-7 7" />
        </svg>
      </button>
    </div>

    <!-- ── Resumen del mes ── -->
    <div class="grid grid-cols-2 sm:grid-cols-4 gap-4">
      <div class="glass p-4 rounded-2xl border border-white/60 shadow-sm text-center">
        <p class="text-xs font-semibold text-slate-400 uppercase tracking-wider mb-1">Total PEN</p>
        <p class="text-xl font-extrabold text-slate-900">{{ formatMonto(totalMesPEN, 'PEN') }}</p>
      </div>
      <div v-if="totalMesUSD > 0" class="glass p-4 rounded-2xl border border-white/60 shadow-sm text-center">
        <p class="text-xs font-semibold text-slate-400 uppercase tracking-wider mb-1">Total USD</p>
        <p class="text-xl font-extrabold text-slate-900">{{ formatMonto(totalMesUSD, 'USD') }}</p>
      </div>
      <div class="glass p-4 rounded-2xl border border-white/60 shadow-sm text-center">
        <p class="text-xs font-semibold text-slate-400 uppercase tracking-wider mb-1">Pagadas</p>
        <p class="text-xl font-extrabold text-emerald-600">{{ cuotasPagadas }}</p>
      </div>
      <div class="glass p-4 rounded-2xl border border-white/60 shadow-sm text-center">
        <p class="text-xs font-semibold text-slate-400 uppercase tracking-wider mb-1">Pendientes</p>
        <p class="text-xl font-extrabold" :class="cuotasPendientes > 0 ? 'text-amber-600' : 'text-slate-400'">
          {{ cuotasPendientes }}
        </p>
      </div>
    </div>

    <!-- ── Loading ── -->
    <div v-if="loading" class="text-center py-20">
      <div class="animate-spin rounded-full h-12 w-12 border-b-2 border-indigo-600 mx-auto mb-4"></div>
      <p class="text-slate-500 font-medium">Cargando cuotas...</p>
    </div>

    <!-- ── Sin cuotas ── -->
    <div v-else-if="cuotasDelMes.length === 0 && !loading"
      class="glass rounded-3xl border border-white/60 shadow-sm p-12 text-center">
      <div class="bg-slate-100 p-4 rounded-full inline-block mb-4">
        <svg xmlns="http://www.w3.org/2000/svg" class="h-10 w-10 text-slate-400" fill="none" viewBox="0 0 24 24"
          stroke="currentColor">
          <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2"
            d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z" />
        </svg>
      </div>
      <h3 class="text-lg font-bold text-slate-700 mb-1">Sin cuotas este mes</h3>
      <p class="text-slate-400 text-sm">No hay pagos registrados para {{ MESES[mesActual] }} {{ anioActual }}</p>
    </div>

    <!-- ── Tabla de cuotas ── -->
    <div v-else class="overflow-x-auto bg-white rounded-2xl shadow-sm border border-slate-200">
      <table class="min-w-full text-sm">
        <thead class="bg-indigo-50 border-b-2 border-indigo-100">
          <tr class="text-indigo-900">
            <th class="px-4 py-4 text-left text-sm font-extrabold uppercase tracking-wider rounded-tl-2xl">Fecha de Pago
            </th>
            <th class="px-4 py-4 text-left text-sm font-extrabold uppercase tracking-wider">Préstamo</th>
            <th class="px-4 py-4 text-center text-sm font-extrabold uppercase tracking-wider">N° Cuota</th>
            <th class="px-4 py-4 text-right text-sm font-extrabold uppercase tracking-wider">Monto de Cuota</th>
            <th class="px-4 py-4 text-center text-sm font-extrabold uppercase tracking-wider rounded-tr-2xl">Pago</th>
          </tr>
        </thead>
        <tbody class="divide-y divide-slate-100">
          <tr v-for="cuota in cuotasDelMes" :key="cuota.id" class="transition-colors hover:bg-slate-50"
            :class="{ 'opacity-60 bg-slate-50': cuota.pagada, 'bg-red-50/50': !cuota.pagada && esPasado(cuota.fecha) }">

            <td class="px-4 py-4 whitespace-nowrap">
              <span class="font-bold text-base"
                :class="esHoy(new Date(cuota.fecha + 'T12:00:00').getDate()) ? 'text-indigo-600' : 'text-slate-700'">
                {{ formatFecha(cuota.fecha) }}
              </span>
              <span v-if="esHoy(new Date(cuota.fecha + 'T12:00:00').getDate())"
                class="ml-2 px-2 py-0.5 bg-indigo-100 text-indigo-700 text-xs font-bold rounded-full">Hoy</span>
              <span v-else-if="!cuota.pagada && esPasado(cuota.fecha)"
                class="ml-2 px-2 py-0.5 bg-red-100 text-red-700 text-xs font-bold rounded-full">Vencida</span>
            </td>

            <td class="px-4 py-4">
              <div class="flex items-center gap-2">
                <div class="shrink-0 w-3 h-3 rounded-full"
                  :class="colorPorDeuda[cuota.deuda?.id]?.dot || 'bg-slate-400'"></div>
                <div>
                  <p class="font-bold text-slate-800 text-base">{{ cuota.deuda?.nombre || 'Sin nombre' }}</p>
                  <p class="text-sm text-slate-500 font-medium">{{ cuota.deuda?.entidad }}</p>
                </div>
              </div>
            </td>

            <td class="px-4 py-4 text-center font-bold text-slate-600 text-base">
              {{ cuota.numero }}
            </td>

            <td class="px-4 py-4 text-right font-extrabold text-slate-900 text-base"
              :class="{ 'line-through text-slate-400': cuota.pagada }">
              {{ formatMonto(cuota.total, cuota.deuda?.moneda) }}
            </td>

            <td class="px-4 py-4 text-center">
              <button @click="togglePagada(cuota)" :disabled="toggling[cuota.id]"
                class="w-8 h-8 mx-auto rounded-full border-2 flex items-center justify-center transition-all" :class="cuota.pagada
                  ? 'bg-emerald-500 border-emerald-500 text-white shadow-md shadow-emerald-200'
                  : 'border-slate-300 text-transparent hover:border-emerald-400 hover:text-emerald-400'"
                :title="cuota.pagada ? 'Marcar como pendiente' : 'Marcar como pagada'">
                <svg v-if="!toggling[cuota.id]" xmlns="http://www.w3.org/2000/svg" class="h-4 w-4" fill="none"
                  viewBox="0 0 24 24" stroke="currentColor">
                  <path stroke-linecap="round" stroke-linejoin="round" stroke-width="3" d="M5 13l4 4L19 7" />
                </svg>
                <svg v-else class="animate-spin h-4 w-4 text-slate-400" xmlns="http://www.w3.org/2000/svg" fill="none"
                  viewBox="0 0 24 24">
                  <circle class="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" stroke-width="4" />
                  <path class="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8v8H4z" />
                </svg>
              </button>
            </td>

          </tr>
        </tbody>
      </table>
    </div>

    <!-- ── Leyenda de deudas ── -->
    <div v-if="deudasStore.deudas.length > 0" class="glass rounded-2xl border border-white/60 shadow-sm p-5">
      <h3 class="text-sm font-bold text-slate-500 uppercase tracking-wider mb-3">Mis préstamos</h3>
      <div class="flex flex-wrap gap-3">
        <div v-for="(deuda, i) in deudasStore.deudas" :key="deuda.id" @click="router.push(`/deudas/${deuda.id}`)"
          class="flex items-center gap-2 px-3 py-2 rounded-xl cursor-pointer transition-all hover:shadow-sm"
          :class="PALETA[i % PALETA.length].bg + ' border'">
          <div class="w-2.5 h-2.5 rounded-full shrink-0" :class="PALETA[i % PALETA.length].dot"></div>
          <span class="text-sm font-semibold" :class="PALETA[i % PALETA.length].text">{{ deuda.nombre }}</span>
          <span class="text-xs opacity-70" :class="PALETA[i % PALETA.length].text">{{ deuda.entidad }}</span>
        </div>
      </div>
    </div>

  </div>
</template>
