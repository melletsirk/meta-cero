<script setup>
/**
 * CronogramaTable.vue
 *
 * Tabla interactiva de cronograma de pagos con regla secuencial:
 *   - Solo la SIGUIENTE cuota sin pagar puede marcarse como pagada.
 *   - Para desmarcar, solo la ÚLTIMA cuota pagada es accionable.
 *   - Todas las demás filas están bloqueadas visualmente (candado / check).
 */
import { computed } from 'vue'
import { formatearMoneda, simboloMoneda } from '../lib/finanzas'

const props = defineProps({
  cuotas:       { type: Array,   default: () => [] },
  moneda:       { type: String,  default: 'PEN' },
  esAproximado: { type: Boolean, default: false },
  togglingId:   { type: String,  default: null },
})

const emit = defineEmits(['toggle'])

// ─── Derived state ───────────────────────────────────────────────────────────

/** Índice (0-based) de la primera cuota SIN pagar. -1 si todas pagadas. */
const proximaIdx = computed(() => props.cuotas.findIndex(c => !c.pagada))

/** Índice (0-based) de la última cuota PAGADA. -1 si ninguna pagada. */
const ultimaPagadaIdx = computed(() => {
  for (let i = props.cuotas.length - 1; i >= 0; i--) {
    if (props.cuotas[i].pagada) return i
  }
  return -1
})

const todasPagadas = computed(() => props.cuotas.length > 0 && props.cuotas.every(c => c.pagada))

const progreso = computed(() => {
  const total = props.cuotas.length
  if (!total) return 0
  return Math.round((props.cuotas.filter(c => c.pagada).length / total) * 100)
})

const totales = computed(() =>
  props.cuotas.reduce(
    (acc, c) => {
      acc.capital += Number(c.capital) || 0
      acc.interes += Number(c.interes) || 0
      acc.seguro  += Number(c.seguro)  || 0
      acc.total   += Number(c.total)   || 0
      return acc
    },
    { capital: 0, interes: 0, seguro: 0, total: 0 }
  )
)

// ─── Interaction rules ────────────────────────────────────────────────────────

const puedeAccionar = (idx) =>
  idx === proximaIdx.value || idx === ultimaPagadaIdx.value

const estaEnProceso = (cuota) => props.togglingId === cuota.id

// ─── Formatters ──────────────────────────────────────────────────────────────

const fmt = (n) => formatearMoneda(Number(n) || 0, props.moneda)
const prefijo = computed(() => simboloMoneda(props.moneda))

const fmtFecha = (iso) => {
  if (!iso) return '-'
  return new Date(iso + 'T12:00:00').toLocaleDateString('es-PE', {
    day: '2-digit', month: 'short', year: 'numeric'
  })
}

const handleToggle = (cuota, idx) => {
  if (!puedeAccionar(idx) || estaEnProceso(cuota)) return
  emit('toggle', cuota)
}
</script>

<template>
  <div class="space-y-5">

    <!-- ── Header ── -->
    <div class="flex flex-wrap items-center justify-between gap-3">
      <div class="flex items-center gap-2">
        <div class="bg-indigo-100 text-indigo-600 p-1.5 rounded-lg">
          <svg xmlns="http://www.w3.org/2000/svg" class="h-5 w-5" viewBox="0 0 20 20" fill="currentColor">
            <path fill-rule="evenodd" d="M6 2a1 1 0 00-1 1v1H4a2 2 0 00-2 2v10a2 2 0 002 2h12a2 2 0 002-2V6a2 2 0 00-2-2h-1V3a1 1 0 10-2 0v1H7V3a1 1 0 00-1-1zm0 5a1 1 0 000 2h8a1 1 0 100-2H6z" clip-rule="evenodd"/>
          </svg>
        </div>
        <h3 class="text-base font-bold text-slate-900">Cronograma de Pagos</h3>
        <span v-if="cuotas.length" class="text-xs font-semibold bg-slate-100 text-slate-500 px-2 py-0.5 rounded-full">
          {{ cuotas.length }} cuota{{ cuotas.length !== 1 ? 's' : '' }}
        </span>
      </div>
      <div v-if="esAproximado"
        class="flex items-center gap-1.5 text-xs font-semibold text-amber-700 bg-amber-50 border border-amber-200 px-2.5 py-1 rounded-full">
        <svg xmlns="http://www.w3.org/2000/svg" class="h-3.5 w-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
          <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z"/>
        </svg>
        Montos aproximados (TCEA)
      </div>
    </div>

    <!-- ── Barra de progreso ── -->
    <div v-if="cuotas.length > 0" class="p-4 bg-gradient-to-r from-indigo-50 to-purple-50 border border-indigo-100 rounded-2xl space-y-2">
      <div class="flex items-center justify-between text-sm font-bold">
        <span class="text-slate-700">
          {{ cuotas.filter(c => c.pagada).length }} de {{ cuotas.length }} cuotas pagadas
        </span>
        <span :class="todasPagadas ? 'text-emerald-600' : 'text-indigo-600'">{{ progreso }}%</span>
      </div>
      <div class="w-full h-3 bg-slate-200 rounded-full overflow-hidden">
        <div
          class="h-3 rounded-full transition-all duration-700 ease-out"
          :class="todasPagadas ? 'bg-gradient-to-r from-emerald-400 to-emerald-500' : 'bg-gradient-to-r from-indigo-500 to-purple-500'"
          :style="{ width: progreso + '%' }"
        ></div>
      </div>
      <p v-if="todasPagadas" class="text-xs font-bold text-emerald-600 flex items-center gap-1">
        <svg xmlns="http://www.w3.org/2000/svg" class="h-4 w-4" viewBox="0 0 20 20" fill="currentColor">
          <path fill-rule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zm3.707-9.293a1 1 0 00-1.414-1.414L9 10.586 7.707 9.293a1 1 0 00-1.414 1.414l2 2a1 1 0 001.414 0l4-4z" clip-rule="evenodd"/>
        </svg>
        ¡Préstamo completamente pagado! 🎉
      </p>
      <p v-else-if="progreso > 50" class="text-xs font-semibold text-indigo-600">¡Más de la mitad! Sigue así 💪</p>
    </div>

    <!-- ── Regla secuencial (aviso) ── -->
    <div v-if="cuotas.length > 0 && !todasPagadas"
      class="flex items-start gap-3 px-4 py-3 bg-blue-50 border border-blue-200 rounded-xl text-sm">
      <svg xmlns="http://www.w3.org/2000/svg" class="h-5 w-5 text-blue-500 shrink-0 mt-0.5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
        <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z"/>
      </svg>
      <span class="text-blue-800 font-medium leading-snug">
        Las cuotas deben pagarse <strong>en orden</strong>. Solo puedes registrar la cuota inmediatamente siguiente.
        Si cometiste un error, puedes <strong>desmarcar</strong> únicamente la última cuota registrada.
      </span>
    </div>

    <!-- ── Estado vacío ── -->
    <div v-if="cuotas.length === 0"
      class="text-center py-10 text-slate-400 text-sm border border-dashed border-slate-200 rounded-2xl">
      <svg xmlns="http://www.w3.org/2000/svg" class="h-8 w-8 mx-auto mb-2 text-slate-300" fill="none" viewBox="0 0 24 24" stroke="currentColor">
        <path stroke-linecap="round" stroke-linejoin="round" stroke-width="1.5" d="M9 17v-2m3 2v-4m3 4v-6m2 10H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z"/>
      </svg>
      Completa los datos del préstamo para ver el cronograma proyectado.
    </div>

    <!-- ── Tabla (desktop) ── -->
    <div v-else class="overflow-hidden rounded-2xl border border-slate-200 shadow-sm">
      <div class="hidden sm:block overflow-x-auto">
        <table class="min-w-full text-sm">
          <thead>
            <tr class="bg-gradient-to-r from-slate-800 to-slate-700 text-white">
              <th class="px-3 py-3 text-left text-xs font-bold uppercase tracking-wider rounded-tl-2xl w-14">N°</th>
              <th class="px-3 py-3 text-left text-xs font-bold uppercase tracking-wider">Fecha</th>
              <th class="px-3 py-3 text-right text-xs font-bold uppercase tracking-wider">Cuota</th>
              <th class="px-3 py-3 text-right text-xs font-bold uppercase tracking-wider">Capital</th>
              <th class="px-3 py-3 text-right text-xs font-bold uppercase tracking-wider">Interés</th>
              <th class="px-3 py-3 text-right text-xs font-bold uppercase tracking-wider">Seguro</th>
              <th class="px-3 py-3 text-right text-xs font-bold uppercase tracking-wider">Saldo</th>
              <th class="px-3 py-3 text-center text-xs font-bold uppercase tracking-wider rounded-tr-2xl w-32">Pago</th>
            </tr>
          </thead>
          <tbody>
            <tr
              v-for="(cuota, idx) in cuotas"
              :key="cuota.id || cuota.numero"
              class="border-t border-slate-100 transition-colors"
              :class="{
                'bg-emerald-50/70': cuota.pagada && idx !== ultimaPagadaIdx,
                'bg-emerald-50 ring-1 ring-inset ring-emerald-200': idx === ultimaPagadaIdx,
                'bg-indigo-50/60 ring-1 ring-inset ring-indigo-200': idx === proximaIdx,
                'bg-white opacity-40': !cuota.pagada && idx !== proximaIdx,
              }"
            >
              <!-- N° -->
              <td class="px-3 py-3 font-bold">
                <div class="flex items-center gap-1.5">
                  <!-- Checkmark para pagadas (no la última) -->
                  <svg v-if="cuota.pagada && idx !== ultimaPagadaIdx" xmlns="http://www.w3.org/2000/svg" class="h-4 w-4 text-emerald-500 shrink-0" viewBox="0 0 20 20" fill="currentColor">
                    <path fill-rule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zm3.707-9.293a1 1 0 00-1.414-1.414L9 10.586 7.707 9.293a1 1 0 00-1.414 1.414l2 2a1 1 0 001.414 0l4-4z" clip-rule="evenodd"/>
                  </svg>
                  <span class="text-xs"
                    :class="{
                      'text-emerald-600': cuota.pagada,
                      'text-indigo-700 font-extrabold': idx === proximaIdx,
                      'text-slate-400': !cuota.pagada && idx !== proximaIdx,
                    }">
                    {{ String(cuota.numero).padStart(2, '0') }}
                  </span>
                </div>
              </td>
              <!-- Fecha + badges -->
              <td class="px-3 py-3 whitespace-nowrap">
                <div class="flex flex-col gap-0.5">
                  <span class="font-medium text-slate-700 text-xs">{{ fmtFecha(cuota.fecha) }}</span>
                  <div class="flex gap-1">
                    <span v-if="idx === proximaIdx"
                      class="text-xs font-extrabold text-indigo-700 bg-indigo-100 px-1.5 py-0.5 rounded-full leading-none">
                      ← Siguiente
                    </span>
                    <span v-if="idx === ultimaPagadaIdx"
                      class="text-xs font-bold text-emerald-700 bg-emerald-100 px-1.5 py-0.5 rounded-full leading-none">
                      Última ✓
                    </span>
                  </div>
                </div>
              </td>
              <!-- Cifras -->
              <td class="px-3 py-3 text-right font-bold text-slate-900 tabular-nums text-xs whitespace-nowrap">{{ fmt(cuota.total) }}</td>
              <td class="px-3 py-3 text-right text-slate-600 tabular-nums text-xs whitespace-nowrap">{{ fmt(cuota.capital) }}</td>
              <td class="px-3 py-3 text-right text-rose-600 tabular-nums text-xs whitespace-nowrap">{{ fmt(cuota.interes) }}</td>
              <td class="px-3 py-3 text-right text-slate-500 tabular-nums text-xs whitespace-nowrap">{{ fmt(cuota.seguro) }}</td>
              <td class="px-3 py-3 text-right tabular-nums text-xs whitespace-nowrap font-semibold"
                :class="cuota.saldo_pendiente === 0 ? 'text-emerald-600' : 'text-slate-600'">
                {{ fmt(cuota.saldo_pendiente) }}
              </td>
              <!-- Columna de acción -->
              <td class="px-3 py-3 text-center">
                <!-- Botón activo: próxima o última pagada -->
                <button
                  v-if="puedeAccionar(idx)"
                  @click="handleToggle(cuota, idx)"
                  :disabled="estaEnProceso(cuota)"
                  class="inline-flex items-center gap-1.5 px-2.5 py-1.5 rounded-xl text-xs font-bold transition-all disabled:opacity-60 disabled:cursor-wait"
                  :class="{
                    'bg-slate-100 text-slate-600 hover:bg-rose-100 hover:text-rose-700 border border-slate-200 hover:border-rose-300': cuota.pagada,
                    'bg-indigo-600 text-white hover:bg-indigo-700 shadow-sm shadow-indigo-300/40': !cuota.pagada,
                  }"
                  :aria-label="cuota.pagada ? `Desmarcar cuota ${cuota.numero}` : `Marcar cuota ${cuota.numero} como pagada`"
                >
                  <svg v-if="estaEnProceso(cuota)" class="animate-spin h-3.5 w-3.5" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
                    <circle class="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" stroke-width="4"/>
                    <path class="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"/>
                  </svg>
                  <template v-else-if="cuota.pagada">
                    <svg xmlns="http://www.w3.org/2000/svg" class="h-3.5 w-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                      <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M6 18L18 6M6 6l12 12"/>
                    </svg>
                    Deshacer
                  </template>
                  <template v-else>
                    <svg xmlns="http://www.w3.org/2000/svg" class="h-3.5 w-3.5" viewBox="0 0 20 20" fill="currentColor">
                      <path fill-rule="evenodd" d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z" clip-rule="evenodd"/>
                    </svg>
                    Pagada
                  </template>
                </button>

                <!-- Ícono para filas bloqueadas -->
                <span v-else class="inline-flex items-center justify-center w-7 h-7">
                  <!-- Cuota ya pagada pero no la última: checkmark estático -->
                  <svg v-if="cuota.pagada" xmlns="http://www.w3.org/2000/svg" class="h-4 w-4 text-emerald-400" viewBox="0 0 20 20" fill="currentColor">
                    <path fill-rule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zm3.707-9.293a1 1 0 00-1.414-1.414L9 10.586 7.707 9.293a1 1 0 00-1.414 1.414l2 2a1 1 0 001.414 0l4-4z" clip-rule="evenodd"/>
                  </svg>
                  <!-- Cuota futura: candado -->
                  <svg v-else xmlns="http://www.w3.org/2000/svg" class="h-4 w-4 text-slate-300" viewBox="0 0 20 20" fill="currentColor">
                    <path fill-rule="evenodd" d="M5 9V7a5 5 0 0110 0v2a2 2 0 012 2v5a2 2 0 01-2 2H5a2 2 0 01-2-2v-5a2 2 0 012-2zm8-2v2H7V7a3 3 0 016 0z" clip-rule="evenodd"/>
                  </svg>
                </span>
              </td>
            </tr>
          </tbody>

          <!-- Totales -->
          <tfoot>
            <tr class="border-t-2 border-slate-300 bg-slate-800 text-white">
              <td colspan="2" class="px-3 py-3 text-xs font-bold uppercase tracking-wider rounded-bl-2xl">
                Totales <span class="font-normal opacity-70">{{ prefijo }}</span>
              </td>
              <td class="px-3 py-3 text-right font-extrabold text-xs tabular-nums">{{ fmt(totales.total) }}</td>
              <td class="px-3 py-3 text-right font-bold text-xs tabular-nums opacity-90">{{ fmt(totales.capital) }}</td>
              <td class="px-3 py-3 text-right font-bold text-xs tabular-nums text-rose-300">{{ fmt(totales.interes) }}</td>
              <td class="px-3 py-3 text-right font-bold text-xs tabular-nums opacity-80">{{ fmt(totales.seguro) }}</td>
              <td colspan="2" class="rounded-br-2xl"></td>
            </tr>
          </tfoot>
        </table>
      </div>

      <!-- ── Cards (móvil) ── -->
      <div class="sm:hidden divide-y divide-slate-100">
        <div
          v-for="(cuota, idx) in cuotas"
          :key="cuota.id || cuota.numero"
          class="p-4 transition-colors"
          :class="{
            'bg-emerald-50/70': cuota.pagada && idx !== ultimaPagadaIdx,
            'bg-emerald-50': idx === ultimaPagadaIdx,
            'bg-indigo-50/50': idx === proximaIdx,
            'bg-white opacity-40': !cuota.pagada && idx !== proximaIdx,
          }"
        >
          <div class="flex items-start justify-between gap-3">
            <!-- Número + fecha -->
            <div class="flex items-center gap-3 min-w-0">
              <span class="w-9 h-9 inline-flex items-center justify-center rounded-xl text-sm font-extrabold shrink-0"
                :class="{
                  'bg-emerald-100 text-emerald-700': cuota.pagada,
                  'bg-indigo-200 text-indigo-800': idx === proximaIdx,
                  'bg-slate-100 text-slate-400': !cuota.pagada && idx !== proximaIdx,
                }">
                {{ cuota.numero }}
              </span>
              <div class="min-w-0">
                <p class="font-bold text-slate-800 text-sm">{{ fmtFecha(cuota.fecha) }}</p>
                <div class="flex flex-wrap gap-1 mt-0.5">
                  <span v-if="idx === proximaIdx" class="text-xs font-extrabold text-indigo-700 bg-indigo-100 px-1.5 py-0.5 rounded-full">← Siguiente</span>
                  <span v-if="idx === ultimaPagadaIdx" class="text-xs font-bold text-emerald-700 bg-emerald-100 px-1.5 py-0.5 rounded-full">Última ✓</span>
                </div>
              </div>
            </div>
            <!-- Botón / Ícono -->
            <div class="shrink-0">
              <button
                v-if="puedeAccionar(idx)"
                @click="handleToggle(cuota, idx)"
                :disabled="estaEnProceso(cuota)"
                class="inline-flex items-center gap-1.5 px-3 py-2 rounded-xl text-xs font-bold transition-all disabled:opacity-60"
                :class="{
                  'bg-slate-100 text-slate-600 hover:bg-rose-100 hover:text-rose-700 border border-slate-200': cuota.pagada,
                  'bg-indigo-600 text-white hover:bg-indigo-700 shadow-md shadow-indigo-300/30': !cuota.pagada,
                }"
              >
                <svg v-if="estaEnProceso(cuota)" class="animate-spin h-3.5 w-3.5" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
                  <circle class="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" stroke-width="4"/>
                  <path class="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"/>
                </svg>
                <template v-else>
                  {{ cuota.pagada ? '↩ Deshacer' : '✓ Pagada' }}
                </template>
              </button>
              <span v-else class="inline-flex items-center justify-center w-8 h-8 mt-0.5">
                <svg v-if="cuota.pagada" xmlns="http://www.w3.org/2000/svg" class="h-5 w-5 text-emerald-400" viewBox="0 0 20 20" fill="currentColor">
                  <path fill-rule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zm3.707-9.293a1 1 0 00-1.414-1.414L9 10.586 7.707 9.293a1 1 0 00-1.414 1.414l2 2a1 1 0 001.414 0l4-4z" clip-rule="evenodd"/>
                </svg>
                <svg v-else xmlns="http://www.w3.org/2000/svg" class="h-5 w-5 text-slate-300" viewBox="0 0 20 20" fill="currentColor">
                  <path fill-rule="evenodd" d="M5 9V7a5 5 0 0110 0v2a2 2 0 012 2v5a2 2 0 01-2 2H5a2 2 0 01-2-2v-5a2 2 0 012-2zm8-2v2H7V7a3 3 0 016 0z" clip-rule="evenodd"/>
                </svg>
              </span>
            </div>
          </div>
          <!-- Cifras -->
          <div class="mt-3 grid grid-cols-4 gap-1.5 text-xs">
            <div>
              <p class="text-slate-400 font-semibold">Cuota</p>
              <p class="font-mono font-extrabold text-slate-900">{{ fmt(cuota.total) }}</p>
            </div>
            <div>
              <p class="text-slate-400 font-semibold">Capital</p>
              <p class="font-mono text-slate-700">{{ fmt(cuota.capital) }}</p>
            </div>
            <div>
              <p class="text-slate-400 font-semibold">Interés</p>
              <p class="font-mono text-rose-600">{{ fmt(cuota.interes) }}</p>
            </div>
            <div>
              <p class="text-slate-400 font-semibold">Saldo</p>
              <p class="font-mono text-slate-600">{{ fmt(cuota.saldo_pendiente) }}</p>
            </div>
          </div>
        </div>
      </div>
    </div>

    <!-- Nota de aproximación -->
    <p v-if="esAproximado" class="text-xs text-slate-400 leading-relaxed">
      * Los montos son aproximados porque se calcularon usando la TCEA en lugar de la TEA pura. Pueden diferir ligeramente de tu contrato.
    </p>

  </div>
</template>

<style scoped>
.tabular-nums {
  font-variant-numeric: tabular-nums;
}
</style>
