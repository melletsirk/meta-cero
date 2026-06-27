<script setup>
import { computed, ref, watch } from 'vue'
import { formatearMoneda, simboloMoneda } from '../lib/finanzas'

const props = defineProps({
  modelValue: { type: Array, default: () => [] },
  moneda: { type: String, default: 'PEN' },
  readonly: { type: Boolean, default: false },
  togglingId: { type: [Number, String], default: null },
  esAproximado: { type: Boolean, default: false },
})

const emit = defineEmits(['update:modelValue', 'toggle'])

const cuotas = computed({
  get: () => props.modelValue,
  set: (val) => emit('update:modelValue', val)
})

const montoFijo = ref(false)
const montoGlobal = ref(null)

const fmt = (n) => formatearMoneda(Number(n) || 0, props.moneda)
const prefijo = computed(() => simboloMoneda(props.moneda))

const fmtFecha = (iso) => {
  if (!iso) return '-'
  return new Date(iso + 'T12:00:00').toLocaleDateString('es-PE', {
    day: '2-digit', month: 'short', year: 'numeric'
  })
}

const totales = computed(() =>
  cuotas.value.reduce(
    (acc, c) => {
      acc.total += Number(c.total) || 0
      return acc
    },
    { total: 0 }
  )
)

/**
 * Para cada índice i, el saldo real restante CON intereses =
 * suma del `total` de todas las cuotas posteriores a i.
 * Así el usuario ve cuánto le falta pagar en total, no solo capital.
 */
const saldosConIntereses = computed(() => {
  const result = new Array(cuotas.value.length)
  let currentSum = 0
  for (let i = cuotas.value.length - 1; i >= 0; i--) {
    result[i] = currentSum
    currentSum += Number(cuotas.value[i].total || 0)
  }
  return result
})

const aplicarMontoGlobal = () => {
  if (montoFijo.value && montoGlobal.value !== null && montoGlobal.value !== '') {
    const newCuotas = cuotas.value.map(c => {
      const newVal = Number(Number(montoGlobal.value).toFixed(2))
      const oldInteres = Number(c.interes || 0)
      let newCapital = newVal - oldInteres
      if (newCapital < 0) newCapital = 0
      const finalCapital = Number(newCapital.toFixed(2))
      const finalInteres = Number((newVal - finalCapital).toFixed(2))
      
      return {
        ...c,
        total: newVal,
        capital: finalCapital,
        interes: finalInteres
      }
    })
    emit('update:modelValue', newCuotas)
  }
}

watch(montoGlobal, aplicarMontoGlobal)

watch(montoFijo, (isFijo) => {
  if (isFijo) {
    if (cuotas.value.length > 0) {
      montoGlobal.value = cuotas.value[0].total || 0;
    }
    aplicarMontoGlobal();
  }
})

const updateCuota = (idx, field, value) => {
  if (props.readonly) return
  const newCuotas = [...cuotas.value]
  
  let finalValue = value
  if (field === 'total') {
    finalValue = Number(Number(value).toFixed(2))
  }
  
  const cuotaObj = { ...newCuotas[idx], [field]: finalValue }
  
  // Si el usuario modificó el total manualmente, debemos ajustar capital/interés 
  // para que siga pasando la validación de la base de datos (total = capital + interes)
  if (field === 'total') {
    const oldInteres = Number(cuotaObj.interes || 0)
    let newCapital = finalValue - oldInteres
    if (newCapital < 0) newCapital = 0
    cuotaObj.capital = Number(newCapital.toFixed(2))
    cuotaObj.interes = Number((finalValue - cuotaObj.capital).toFixed(2))
  }
  
  newCuotas[idx] = cuotaObj
  emit('update:modelValue', newCuotas)
}

const handlePagoClick = (cuota, idx) => {
  if (props.readonly) {
    emit('toggle', cuota)
  } else {
    const newPagada = !cuota.pagada
    
    // Regla Secuencial: Los bancos exigen pagar en orden.
    if (newPagada) {
      // Al marcar como pagada, verificar que las anteriores estén pagadas
      for (let i = 0; i < idx; i++) {
        if (!cuotas.value[i].pagada) {
          alert('Debes marcar primero las cuotas anteriores.')
          return
        }
      }
    } else {
      // Al desmarcar, verificar que las siguientes no estén pagadas
      for (let i = idx + 1; i < cuotas.value.length; i++) {
        if (cuotas.value[i].pagada) {
          alert('Debes desmarcar primero las cuotas posteriores.')
          return
        }
      }
    }
    
    updateCuota(idx, 'pagada', newPagada)
  }
}
</script>

<template>
  <div class="space-y-3">
    <!-- Aviso + control de monto fijo -->
    <div v-if="!readonly"
      class="flex flex-col sm:flex-row sm:items-center justify-between bg-indigo-50 border border-indigo-200 p-3 rounded-xl gap-3">
      <div class="flex items-start gap-2 text-sm text-indigo-800">
        <svg xmlns="http://www.w3.org/2000/svg" class="h-4 w-4 shrink-0 mt-0.5 text-indigo-500" fill="none"
          viewBox="0 0 24 24" stroke="currentColor">
          <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2"
            d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
        </svg>
        <span class="font-medium leading-snug">
          Los montos vienen del cálculo automático. Edítalos para que coincidan con tu contrato del banco.
        </span>
      </div>
      <label
        class="flex items-center gap-2 cursor-pointer text-sm font-bold text-indigo-700 select-none shrink-0 hover:text-indigo-900 transition-colors">
        <input type="checkbox" v-model="montoFijo"
          class="w-4 h-4 text-indigo-600 border-slate-300 rounded focus:ring-indigo-500 transition-colors" />
        Misma cuota para todas
      </label>
    </div>

    <!-- Input de monto global cuando aplica -->
    <div v-if="!readonly && montoFijo"
      class="flex items-center gap-3 bg-white border border-indigo-200 shadow-sm p-3 rounded-xl animate-fade-in">
      <span class="text-sm font-bold text-slate-600">Monto fijo por cuota:</span>
      <div class="relative">
        <span class="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400 font-bold text-sm">{{ prefijo }}</span>
        <input type="number" step="0.01" v-model="montoGlobal" placeholder="0.00" min="0"
          class="border border-slate-200 rounded-lg text-sm w-36 pl-8 pr-3 py-2 focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500 shadow-sm transition-all bg-white font-bold" />
      </div>
    </div>

    <!-- Tabla -->
    <div class="bg-white sm:rounded-2xl sm:shadow-sm sm:border sm:border-slate-200">
      <table class="w-full text-sm block sm:table">
        <thead class="hidden sm:table-header-group bg-slate-700 text-white">
          <tr>
            <th class="px-4 py-3 text-left text-xs font-extrabold uppercase tracking-wider rounded-tl-2xl w-14">N°</th>
            <th class="px-4 py-3 text-left text-xs font-extrabold uppercase tracking-wider">Vencimiento</th>
            <th class="px-4 py-3 text-right text-xs font-extrabold uppercase tracking-wider">Cuota</th>
            <th class="px-4 py-3 text-right text-xs font-extrabold uppercase tracking-wider">Saldo c/ int.</th>
            <th class="px-4 py-3 text-center text-xs font-extrabold uppercase tracking-wider rounded-tr-2xl w-20">Pago</th>
          </tr>
        </thead>
        <tbody class="block sm:table-row-group divide-y-0 sm:divide-y sm:divide-slate-100 bg-transparent space-y-4 sm:space-y-0 p-2 sm:p-0">
          <tr v-for="(cuota, idx) in cuotas" :key="cuota.id || cuota.numero || idx"
            class="block sm:table-row bg-white sm:bg-transparent rounded-2xl border sm:border-0 border-slate-200 shadow-sm sm:shadow-none p-4 sm:p-0 transition-colors group relative"
            :class="cuota.pagada ? 'bg-emerald-50/40' : 'sm:hover:bg-slate-50/70'">
            
            <!-- N° -->
            <td class="flex sm:table-cell justify-between items-center sm:px-4 sm:py-3 mb-3 sm:mb-0">
              <span class="sm:hidden text-xs font-bold text-slate-400 uppercase">N° Cuota</span>
              <span class="font-bold text-slate-600 text-base sm:text-center block sm:w-full">
                {{ String(cuota.numero).padStart(2, '0') }}
              </span>
            </td>

            <!-- Fecha -->
            <td class="flex sm:table-cell justify-between items-center sm:px-3 sm:py-2 mb-3 sm:mb-0 border-t border-slate-100 sm:border-0 pt-3 sm:pt-0">
              <span class="sm:hidden text-xs font-bold text-slate-400 uppercase">Fecha</span>
              <div class="text-right sm:text-left w-1/2 sm:w-auto">
                <template v-if="readonly">
                  <span class="text-base sm:text-lg font-bold block"
                    :class="cuota.pagada ? 'text-slate-500 line-through' : 'text-slate-700'">
                    {{ fmtFecha(cuota.fecha) }}
                  </span>
                </template>
                <template v-else>
                  <input type="date" :value="cuota.fecha" @input="e => updateCuota(idx, 'fecha', e.target.value)"
                    class="w-full text-right sm:text-left border-0 bg-transparent text-base sm:text-lg text-slate-700 p-1 focus:outline-none focus:ring-1 focus:ring-indigo-400 rounded" />
                </template>
              </div>
            </td>

            <!-- Monto de cuota -->
            <td class="flex sm:table-cell justify-between items-center sm:px-3 sm:py-2 mb-3 sm:mb-0 border-t border-slate-100 sm:border-0 pt-3 sm:pt-0 text-right">
              <span class="sm:hidden text-xs font-bold text-slate-400 uppercase">Monto</span>
              <div>
                <template v-if="readonly">
                  <span class="text-xl sm:text-lg font-extrabold sm:font-bold"
                    :class="cuota.pagada ? 'text-slate-400 line-through' : 'text-slate-900'">
                    {{ fmt(cuota.total) }}
                  </span>
                </template>
                <template v-else>
                  <div class="relative flex items-center justify-end">
                    <span class="text-slate-400 text-base sm:text-lg font-bold mr-1">{{ prefijo }}</span>
                    <input type="number" step="0.01" :value="cuota.total"
                      @input="e => updateCuota(idx, 'total', Number(e.target.value))"
                      class="w-24 sm:w-24 text-right border-0 bg-transparent text-xl sm:text-lg font-extrabold sm:font-bold text-slate-900 p-1 focus:outline-none focus:ring-1 focus:ring-indigo-400 rounded" />
                  </div>
                </template>
              </div>
            </td>

            <!-- Saldo pendiente con intereses -->
            <td class="flex sm:table-cell justify-between items-center sm:px-3 sm:py-2 mb-4 sm:mb-0 border-t border-slate-100 sm:border-0 pt-3 sm:pt-0 text-right">
              <span class="sm:hidden text-xs font-bold text-slate-400 uppercase">Saldo Restante</span>
              <span class="text-base sm:text-lg font-bold"
                :class="cuota.pagada ? 'text-slate-400 line-through' : (saldosConIntereses[idx] === 0 ? 'text-emerald-600' : 'text-slate-600')">
                {{ fmt(saldosConIntereses[idx]) }}
              </span>
            </td>

            <!-- Pago -->
            <td class="flex sm:table-cell justify-center sm:px-3 sm:py-2 border-t border-slate-100 sm:border-0 pt-4 sm:pt-0 text-center relative">
              <div v-if="togglingId === cuota.id"
                class="absolute inset-0 flex items-center justify-center bg-white/50 backdrop-blur-sm rounded-xl sm:rounded-none z-10">
                <div class="animate-spin rounded-full h-6 w-6 border-b-2 border-indigo-600"></div>
              </div>
              <button type="button" @click="handlePagoClick(cuota, idx)"
                class="w-full sm:w-8 h-12 sm:h-8 mx-auto rounded-xl sm:rounded-full border-2 flex items-center justify-center gap-2 font-bold transition-all relative z-20" 
                :class="cuota.pagada
                  ? 'bg-emerald-500 border-emerald-500 text-white shadow-md shadow-emerald-200'
                  : 'bg-indigo-50 border-indigo-100 text-indigo-600 hover:border-indigo-300'" :disabled="togglingId === cuota.id"
                :aria-label="cuota.pagada ? 'Desmarcar cuota' : 'Marcar como pagada'">
                <svg xmlns="http://www.w3.org/2000/svg" class="h-6 w-6 sm:h-4 sm:w-4" viewBox="0 0 20 20" fill="currentColor">
                  <path fill-rule="evenodd"
                    d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z"
                    clip-rule="evenodd" />
                </svg>
                <span class="sm:hidden">{{ cuota.pagada ? 'Pagado' : 'Marcar Pago' }}</span>
              </button>
            </td>
          </tr>
        </tbody>

        <!-- Totales -->
        <tfoot class="block sm:table-footer-group p-4 sm:p-0">
          <tr class="block sm:table-row border-t-2 border-slate-200 bg-slate-50 rounded-xl sm:rounded-none">
            <td colspan="2"
              class="hidden sm:table-cell px-4 py-3 text-xs font-extrabold uppercase tracking-wider text-slate-700 rounded-bl-2xl">
              Totales <span class="font-normal text-slate-400">{{ prefijo }}</span>
            </td>
            <td class="flex sm:table-cell justify-between sm:justify-end items-center px-4 py-3 text-right font-extrabold tabular-nums text-slate-900">
              <span class="sm:hidden text-xs font-extrabold uppercase tracking-wider text-slate-700">Total</span>
              <span class="text-lg sm:text-xs">{{ fmt(totales.total) }}</span>
            </td>
            <td class="hidden sm:table-cell px-4 py-3 text-right text-xs tabular-nums font-semibold text-slate-400">—</td>
            <td class="hidden sm:table-cell rounded-br-2xl"></td>
          </tr>
        </tfoot>
      </table>
    </div>
  </div>
</template>

<style scoped>
.tabular-nums {
  font-variant-numeric: tabular-nums;
}
</style>
