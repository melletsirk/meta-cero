<script setup>
import { computed, ref, watch } from 'vue'

const props = defineProps({
  modelValue: { type: Array, default: () => [] },
  moneda: { type: String, default: 'PEN' }
})

const emit = defineEmits(['update:modelValue'])

const cuotas = computed({
  get: () => props.modelValue,
  set: (val) => emit('update:modelValue', val)
})

const montoFijo = ref(false)
const montoGlobal = ref(null)

const aplicarMontoGlobal = () => {
  if (montoFijo.value && montoGlobal.value !== null && montoGlobal.value !== '') {
    const newCuotas = cuotas.value.map(c => ({
      ...c,
      total: Number(montoGlobal.value)
    }))
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
  const newCuotas = [...cuotas.value]
  newCuotas[idx][field] = value
  emit('update:modelValue', newCuotas)
}
</script>

<template>
  <div class="space-y-3">
    <!-- Opción para aplicar monto a todas las cuotas -->
    <div class="flex items-center justify-between bg-slate-50 p-3 rounded-xl border border-slate-200">
      <label class="flex items-center gap-2 cursor-pointer text-sm font-bold text-slate-700 select-none hover:text-indigo-700 transition-colors">
        <input type="checkbox" v-model="montoFijo" class="w-5 h-5 text-indigo-600 border-slate-300 rounded focus:ring-indigo-500 transition-colors" />
        Todas las cuotas tienen el mismo monto
      </label>
      <div v-if="montoFijo" class="flex items-center gap-2 animate-fade-in">
        <span class="text-sm font-bold text-slate-600">Monto:</span>
        <input type="number" step="0.01" v-model="montoGlobal" placeholder="Ej. 500" min="0"
          class="border border-slate-300 rounded-lg text-sm w-32 p-2 focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500 shadow-sm transition-all bg-white" />
      </div>
    </div>

    <!-- Tabla -->
    <div class="overflow-x-auto rounded-2xl border border-slate-200 shadow-sm bg-white">
      <table class="min-w-full text-sm">
        <thead class="bg-indigo-50 border-b-2 border-indigo-100">
          <tr class="text-indigo-900">
            <th class="px-3 py-3 text-left text-sm font-extrabold uppercase tracking-wider rounded-tl-2xl w-14">N°</th>
            <th class="px-3 py-3 text-left text-sm font-extrabold uppercase tracking-wider">Fecha de Vencimiento</th>
            <th class="px-3 py-3 text-right text-sm font-extrabold uppercase tracking-wider">Cuota Total</th>
            <th class="px-3 py-3 text-right text-sm font-extrabold uppercase tracking-wider rounded-tr-2xl">Monto Pendiente</th>
          </tr>
        </thead>
        <tbody class="divide-y divide-slate-100">
          <tr v-for="(cuota, idx) in cuotas" :key="idx" class="hover:bg-slate-50 transition-colors">
            <td class="px-3 py-2 font-bold text-slate-700 text-center">{{ cuota.numero }}</td>
            <td class="px-2 py-2">
              <input type="date" :value="cuota.fecha" @input="e => updateCuota(idx, 'fecha', e.target.value)"
                class="w-full border-slate-200 rounded-lg text-xs p-1.5 focus:ring-indigo-500 focus:border-indigo-500" />
            </td>
            <td class="px-2 py-2">
              <input type="number" step="0.01" :value="cuota.total" @input="e => updateCuota(idx, 'total', Number(e.target.value))"
                class="w-full text-right border-slate-200 rounded-lg text-xs font-bold p-1.5 focus:ring-indigo-500 focus:border-indigo-500" />
            </td>
            <td class="px-2 py-2">
              <input type="number" step="0.01" :value="cuota.saldo_pendiente" @input="e => updateCuota(idx, 'saldo_pendiente', Number(e.target.value))"
                class="w-full text-right border-slate-200 rounded-lg text-xs p-1.5 focus:ring-indigo-500 focus:border-indigo-500" />
            </td>
          </tr>
        </tbody>
      </table>
    </div>
  </div>
</template>
