<script setup>
import { ref, computed, watch, onMounted } from 'vue'
import { useRouter, useRoute } from 'vue-router'
import { useDeudasStore } from '../stores/deudas'
import { useNotificationsStore } from '../stores/notifications'
import { calcularTasaPeriodica, alertaTEA, simboloMoneda, FRECUENCIAS, generarCronogramaFrances } from '../lib/finanzas'
import EditableCronogramaTable from '../components/EditableCronogramaTable.vue'

const router = useRouter()
const route = useRoute()
const deudasStore = useDeudasStore()
const notificationsStore = useNotificationsStore()

const editId = route.params.id
const isEditMode = computed(() => !!editId)
const isInitializing = ref(false)


// ---------------------------------------------------------------------------
// Entidades financieras peruanas para autocompletado
// ---------------------------------------------------------------------------
const entidadesPeruanas = [
  { grupo: 'Bancos', items: ['BCP', 'BBVA', 'Interbank', 'Scotiabank', 'BanBif', 'Banco Pichincha', 'Mibanco', 'Banco Falabella', 'CrediScotia'] },
  { grupo: 'Cajas Municipales', items: ['Caja Arequipa', 'Caja Huancayo', 'Caja Piura', 'Caja Cusco', 'Caja Sullana', 'Caja Trujillo'] },
  { grupo: 'Financieras', items: ['Compartamos Financiera', 'Credinka', 'Confianza'] },
  { grupo: 'Fintechs', items: ['Prestamype', 'Afluenta', 'Facturedo'] },
]

const showEntityDropdown = ref(false)
const entitySearch = ref('')

const filteredEntidades = computed(() => {
  const q = entitySearch.value.toLowerCase()
  if (!q) return entidadesPeruanas
  return entidadesPeruanas
    .map(g => ({ grupo: g.grupo, items: g.items.filter(e => e.toLowerCase().includes(q)) }))
    .filter(g => g.items.length > 0)
})

const selectEntidad = (nombre) => {
  formData.value.entidad = nombre
  entitySearch.value = nombre
  showEntityDropdown.value = false
}

const onEntityInput = (e) => {
  entitySearch.value = e.target.value
  formData.value.entidad = e.target.value
  showEntityDropdown.value = true
}

const onEntityBlur = () => {
  // Small delay so click on dropdown item registers first
  setTimeout(() => { showEntityDropdown.value = false }, 200)
}

// ---------------------------------------------------------------------------
// Formulario
// ---------------------------------------------------------------------------
const formData = ref({
  nombre: '',
  tipo: 'formal',
  entidad: '',
  moneda: 'PEN',
  monto_original: null,
  cuotas_pagadas: 0,
  tea: null,
  tcea: null,
  tasa_mensual: 0,
  frecuencia_pago: 'mensual',
  fecha_inicio: '',
  fecha_primer_pago: '',
  fecha_vencimiento: '',
  num_cuotas: null,
  notas: '',
  base_calculo: 365,       // Base de días para tasa periódica: 360 (cooperativas) o 365 (bancos)
  redondear_cuota: false,  // Si true: cuota se redondea al entero superior (estilo cooperativa)
})

const loading = ref(false)
const showTceaTooltip = ref(false)

const cuotasManuales = ref([])


// ---------------------------------------------------------------------------
// Computed helpers
// ---------------------------------------------------------------------------
const prefijo = computed(() => simboloMoneda(formData.value.moneda))

const teaAlert = computed(() => alertaTEA(formData.value.tea))

const tasaAlertaClases = computed(() => {
  switch (teaAlert.value.level) {
    case 'yellow': return 'bg-yellow-50 border-yellow-300 text-yellow-800'
    case 'green': return 'bg-emerald-50 border-emerald-300 text-emerald-800'
    case 'orange': return 'bg-orange-50 border-orange-300 text-orange-800'
    case 'red': return 'bg-red-50 border-red-400 text-red-800'
    default: return ''
  }
}
)

const teaAlertaIcono = computed(() => {
  switch (teaAlert.value.level) {
    case 'yellow': return '⚠️'
    case 'green': return '✅'
    case 'orange': return '🟠'
    case 'red': return '🔴'
    default: return ''
  }
})

/** Si el usuario sólo tiene TCEA pero no TEA, el cronograma será aproximado */
const soloCon_TCEA = computed(() => !formData.value.tea && !!formData.value.tcea)

const esCuotaUnica = computed(() => formData.value.frecuencia_pago === 'cuota_unica')

// ---------------------------------------------------------------------------
// Preview del cronograma en tiempo real
// ---------------------------------------------------------------------------

watch(
  () => [
    formData.value.monto_original,
    formData.value.tea,
    formData.value.tcea,
    formData.value.num_cuotas,
    formData.value.fecha_inicio,
    formData.value.frecuencia_pago,
    formData.value.base_calculo,
    formData.value.redondear_cuota
  ],
  () => {
    if (isInitializing.value) return
    const { monto_original, tea, tcea, num_cuotas, fecha_inicio, frecuencia_pago } = formData.value
    const tasaUsada = tea || tcea
    if (!monto_original || !tasaUsada || (!num_cuotas && frecuencia_pago !== 'cuota_unica') || !fecha_inicio) {
      return
    }

    try {
      const fechaParaPrimeraCuota = frecuencia_pago === 'cuota_unica'
        ? formData.value.fecha_vencimiento || formData.value.fecha_inicio
        : formData.value.fecha_primer_pago || formData.value.fecha_inicio

      const nuevasCuotas = generarCronogramaFrances(
        Number(monto_original),
        Number(tasaUsada),
        Number(num_cuotas) || 1,
        fecha_inicio,
        fechaParaPrimeraCuota,
        frecuencia_pago,
        !tea && !!tcea, // es aproximado
        Number(formData.value.base_calculo) || 365,
        formData.value.redondear_cuota
      )

      // Preservar el estado 'pagada' que el usuario haya marcado previamente
      // al recalcular el cronograma por cambios en los inputs.
      const viejas = cuotasManuales.value || []
      cuotasManuales.value = nuevasCuotas.map((nc, i) => {
        if (viejas[i] && viejas[i].pagada) {
          nc.pagada = true
        }
        return nc
      })
    } catch {
      // Ignorar errores de cálculo en tiempo de escritura
    }
  },
  { deep: true, immediate: true }
)

const cuotasFinales = computed(() => cuotasManuales.value)

const previewListo = computed(() => cuotasFinales.value.length > 0)

onMounted(async () => {
  if (isEditMode.value) {
    loading.value = true
    isInitializing.value = true

    if (deudasStore.deudas.length === 0) {
      await deudasStore.fetchDeudas()
    }
    const deuda = deudasStore.deudas.find(d => d.id === editId)
    if (deuda) {
      Object.assign(formData.value, deuda)
      const data = await deudasStore.fetchCuotas(editId)
      cuotasManuales.value = data
    } else {
      notificationsStore.error('Deuda no encontrada')
      router.push('/')
    }

    setTimeout(() => {
      isInitializing.value = false
    }, 100)
    loading.value = false
  }
})

// ---------------------------------------------------------------------------
// Cálculo automático de tasa mensual al cambiar TEA
// ---------------------------------------------------------------------------
const calcularTasaMensualDesdeTEA = () => {
  const tea = formData.value.tea
  if (tea) {
    const tp = calcularTasaPeriodica(tea, 'mensual')
    formData.value.tasa_mensual = Number((tp * 100).toFixed(6))
  }
}

// ---------------------------------------------------------------------------
// Submit
// ---------------------------------------------------------------------------
const handleSubmit = async () => {
  loading.value = true
  try {
    if (formData.value.tea && !formData.value.tasa_mensual) {
      calcularTasaMensualDesdeTEA()
    }
    // Construir explícitamente el payload con las columnas reales de la tabla 'deudas' v3
    // Esto evita que se envíen accidentalmente columnas calculadas provenientes de 'v_resumen_deudas'
    // (como cuotas_pendientes, saldo_capital, total_pagado, etc.)
    const payload = {
      nombre: formData.value.nombre,
      tipo: formData.value.tipo,
      entidad: formData.value.entidad,
      moneda: formData.value.moneda,
      monto_original: Number(Number(formData.value.monto_original).toFixed(2)),
      frecuencia_pago: formData.value.frecuencia_pago,
      fecha_inicio: formData.value.fecha_inicio,
      fecha_primer_pago: formData.value.fecha_primer_pago || null,
      num_cuotas: formData.value.num_cuotas || null,
      tea: formData.value.tea || null,
      tcea: formData.value.tcea || null,
      notas: formData.value.notas || null,
    }

    // Tomamos las cuotas exactamente como están en la tabla, respetando
    // los clicks manuales del usuario en el checkbox de "pagada".
    const finalCuotasGuardar = cuotasFinales.value.map((c) => ({
      ...c
    }))

    if (isEditMode.value) {
      await deudasStore.updateDeudaYCuotas(editId, payload, finalCuotasGuardar)
      notificationsStore.success('Deuda actualizada exitosamente')
      router.push(`/deudas/${editId}`)
    } else {
      await deudasStore.addDeuda(payload, finalCuotasGuardar)
      notificationsStore.success('Deuda registrada exitosamente')
      router.push('/')
    }
  } catch (error) {
    notificationsStore.error('Error al guardar la deuda: ' + error.message)
  } finally {
    loading.value = false
  }
}
</script>

<template>

  <div class="flex-1 p-2 sm:p-4 lg:p-6 overflow-y-auto animate-fade-in relative z-10 w-full mx-auto">
    <!-- Header -->
    <div class="flex items-center gap-3 mb-4">
      <button @click="router.push('/')"
        class="p-2 text-slate-400 hover:text-indigo-600 hover:bg-indigo-50 rounded-xl transition-all">
        <svg xmlns="http://www.w3.org/2000/svg" class="h-8 w-8" fill="none" viewBox="0 0 24 24" stroke="currentColor">
          <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M10 19l-7-7m0 0l7-7m-7 7h18" />
        </svg>
      </button>
      <div>
        <h2 class="text-2xl font-extrabold text-slate-900 tracking-tight">
          {{ isEditMode ? 'Editar Deuda' : 'Datos del Préstamo' }}
        </h2>
        <p class="text-lg text-slate-600 mt-1 font-medium">Llene los datos básicos de su deuda.</p>
      </div>
    </div>

    <!-- Form -->
    <form @submit.prevent="handleSubmit"
      class="glass shadow-xl shadow-slate-200/40 rounded-2xl border border-white/60 p-4 sm:p-5 space-y-5 relative overflow-hidden w-full">
      <!-- Decoración de fondo del form -->
      <div
        class="absolute -top-40 -right-40 w-80 h-80 bg-indigo-50 rounded-full mix-blend-multiply filter blur-3xl opacity-50 pointer-events-none">
      </div>

      <!-- ── Sección 1: Información Básica ── -->
      <div class="relative z-10">
        <h3 class="text-base font-bold text-slate-900 mb-3 flex items-center gap-2">
          <span class="bg-indigo-100 text-indigo-600 p-1 rounded-md">
            <svg xmlns="http://www.w3.org/2000/svg" class="h-4 w-4" viewBox="0 0 20 20" fill="currentColor">
              <path d="M9 2a1 1 0 000 2h2a1 1 0 100-2H9z" />
              <path fill-rule="evenodd"
                d="M4 5a2 2 0 012-2 3 3 0 003 3h2a3 3 0 003-3 2 2 0 012 2v11a2 2 0 01-2 2H6a2 2 0 01-2-2V5zm3 4a1 1 0 000 2h.01a1 1 0 100-2H7zm3 0a1 1 0 000 2h3a1 1 0 100-2h-3zm-3 4a1 1 0 100 2h.01a1 1 0 100-2H7zm3 0a1 1 0 100 2h3a1 1 0 100-2h-3z"
                clip-rule="evenodd" />
            </svg>
          </span>
          Información Básica
        </h3>
        <div class="grid grid-cols-1 md:grid-cols-2 gap-4">
          <!-- Nombre (alias) -->
          <div class="group">
            <label
              class="block text-sm font-bold text-slate-800 mb-1 group-focus-within:text-indigo-600 transition-colors">¿Qué
              nombre le pondrás a esta deuda?</label>
            <input id="deuda-nombre" v-model="formData.nombre" type="text" required
              placeholder="Ej. Préstamo Personal BCP"
              class="w-full border border-slate-200 rounded-lg shadow-sm focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500 p-2.5 text-base bg-white/70 backdrop-blur-sm transition-all hover:bg-white" />
          </div>

          <!-- Entidad con autocompletado -->
          <div class="group relative">
            <label
              class="block text-sm font-bold text-slate-800 mb-1 group-focus-within:text-indigo-600 transition-colors">¿Con
              qué Banco o Caja?</label>
            <input id="deuda-entidad" :value="entitySearch || formData.entidad" @input="onEntityInput"
              @focus="showEntityDropdown = true" @blur="onEntityBlur" type="text" required
              placeholder="Escribe o elige (BCP, BBVA…)" autocomplete="off"
              class="w-full border border-slate-200 rounded-lg shadow-sm focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500 p-2.5 text-base bg-white/70 backdrop-blur-sm transition-all hover:bg-white" />
            <!-- Dropdown de sugerencias -->
            <transition name="dropdown">
              <div v-if="showEntityDropdown && filteredEntidades.length"
                class="absolute z-50 top-full mt-1 left-0 right-0 bg-white border border-slate-200 rounded-2xl shadow-xl shadow-slate-200/60 max-h-64 overflow-y-auto">
                <div v-for="grupo in filteredEntidades" :key="grupo.grupo">
                  <div class="px-4 pt-3 pb-1 text-xs font-bold text-slate-400 uppercase tracking-wider">{{ grupo.grupo
                    }}</div>
                  <button v-for="entidad in grupo.items" :key="entidad" type="button"
                    @mousedown.prevent="selectEntidad(entidad)"
                    class="w-full text-left px-4 py-2.5 text-sm text-slate-700 hover:bg-indigo-50 hover:text-indigo-700 transition-colors font-medium">
                    {{ entidad }}
                  </button>
                </div>
              </div>
            </transition>
          </div>

          <!-- Tipo de Deuda -->
          <div class="group">
            <label
              class="block text-sm font-bold text-slate-700 mb-1 group-focus-within:text-indigo-600 transition-colors">Tipo
              de Deuda</label>
            <div class="relative">
              <select id="deuda-tipo" v-model="formData.tipo"
                class="w-full border border-slate-200 rounded-lg shadow-sm focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500 p-2.5 text-base bg-white/70 backdrop-blur-sm transition-all hover:bg-white appearance-none pr-10">
                <option value="formal">Formal (Banco / Financiera / Caja)</option>
                <option value="informal">Informal (Persona / Prestamista)</option>
              </select>
              <div class="pointer-events-none absolute inset-y-0 right-0 flex items-center px-3 text-slate-500">
                <svg class="h-4 w-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M19 9l-7 7-7-7"></path>
                </svg>
              </div>
            </div>
          </div>

          <!-- Moneda -->
          <div class="group">
            <label class="block text-sm font-bold text-slate-700 mb-1">Moneda</label>
            <div class="flex gap-2">
              <label class="flex-1 cursor-pointer">
                <input type="radio" id="moneda-pen" v-model="formData.moneda" value="PEN" class="sr-only peer" />
                <div
                  class="flex items-center justify-center gap-1.5 p-2.5 rounded-lg border-2 border-slate-200 bg-white/70 text-slate-600 font-bold text-sm transition-all peer-checked:border-indigo-500 peer-checked:bg-indigo-50 peer-checked:text-indigo-700 hover:border-slate-300">
                  <span>🇵🇪</span> S/. Soles
                </div>
              </label>
              <label class="flex-1 cursor-pointer">
                <input type="radio" id="moneda-usd" v-model="formData.moneda" value="USD" class="sr-only peer" />
                <div
                  class="flex items-center justify-center gap-1.5 p-2.5 rounded-lg border-2 border-slate-200 bg-white/70 text-slate-600 font-bold text-sm transition-all peer-checked:border-indigo-500 peer-checked:bg-indigo-50 peer-checked:text-indigo-700 hover:border-slate-300">
                  <span>🇺🇸</span> $ Dólares
                </div>
              </label>
            </div>
          </div>
        </div>
      </div>

      <hr class="border-slate-100" />

      <!-- ── Sección 2: Montos y Plazos ── -->
      <div class="relative z-10">
        <h3 class="text-base font-bold text-slate-900 mb-3 flex items-center gap-2">
          <span class="bg-emerald-100 text-emerald-600 p-1 rounded-md">
            <svg xmlns="http://www.w3.org/2000/svg" class="h-4 w-4" viewBox="0 0 20 20" fill="currentColor">
              <path
                d="M8.433 7.418c.155-.103.346-.196.567-.267v1.698a2.305 2.305 0 01-.567-.267C8.07 8.34 8 8.114 8 8c0-.114.07-.34.433-.582zM11 12.849v-1.698c.22.071.412.164.567.267.364.243.433.468.433.582 0 .114-.07.34-.433.582a2.305 2.305 0 01-.567.267z" />
              <path fill-rule="evenodd"
                d="M10 18a8 8 0 100-16 8 8 0 000 16zm1-13a1 1 0 10-2 0v.092a4.535 4.535 0 00-1.676.662C6.602 6.234 6 7.009 6 8c0 .99.602 1.765 1.324 2.246.48.32 1.054.545 1.676.662v1.941c-.391-.127-.68-.317-.843-.504a1 1 0 10-1.5 1.32c.568.647 1.44 1.15 2.343 1.332V15a1 1 0 102 0v-.092a4.535 4.535 0 001.676-.662C13.398 13.766 14 12.991 14 12c0-.99-.602-1.765-1.324-2.246A4.535 4.535 0 0011 9.092V7.151c.391.127.68.317.843.504a1 1 0 101.5-1.32c-.568-.647-1.44-1.15-2.343-1.332V5z"
                clip-rule="evenodd" />
            </svg>
          </span>
          Montos y Plazos
        </h3>
        <div class="grid grid-cols-1 md:grid-cols-2 gap-4">
          <!-- Monto Original -->
          <div class="group relative">
            <label
              class="block text-sm font-bold text-slate-700 mb-1 group-focus-within:text-indigo-600 transition-colors">Monto
              Original</label>
            <div class="relative">
              <span class="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400 font-bold text-sm">{{ prefijo
                }}</span>
              <input id="deuda-monto-original" v-model.number="formData.monto_original" type="number" step="0.01"
                required min="0"
                class="w-full border border-slate-200 rounded-lg shadow-sm focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500 pl-8 p-2.5 text-base bg-white/70 backdrop-blur-sm transition-all hover:bg-white"
                placeholder="0.00" />
            </div>
          </div>

          <!-- Fecha de Inicio -->
          <div class="group">
            <label
              class="block text-sm font-bold text-slate-700 mb-1 group-focus-within:text-indigo-600 transition-colors">Fecha
              de Inicio (Desembolso)</label>
            <input id="deuda-fecha-inicio" v-model="formData.fecha_inicio" type="date" required
              class="w-full border border-slate-200 rounded-lg shadow-sm focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500 p-2.5 text-base bg-white/70 backdrop-blur-sm transition-all hover:bg-white" />
          </div>

          <!-- Frecuencia de Pago -->
          <div class="group">
            <label
              class="block text-sm font-bold text-slate-700 mb-1 group-focus-within:text-indigo-600 transition-colors">Frecuencia
              de Pago</label>
            <div class="relative">
              <select id="deuda-frecuencia" v-model="formData.frecuencia_pago"
                class="w-full border border-slate-200 rounded-lg shadow-sm focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500 p-2.5 text-base bg-white/70 backdrop-blur-sm transition-all hover:bg-white appearance-none pr-10">
                <option v-for="(info, key) in FRECUENCIAS" :key="key" :value="key">{{ info.label }}</option>
              </select>
              <div class="pointer-events-none absolute inset-y-0 right-0 flex items-center px-3 text-slate-500">
                <svg class="h-4 w-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M19 9l-7 7-7-7"></path>
                </svg>
              </div>
            </div>
          </div>

          <!-- Número de Cuotas (oculto para cuota única) -->
          <transition name="fade">
            <div v-if="!esCuotaUnica" class="group">
              <label
                class="block text-sm font-bold text-slate-800 mb-1 group-focus-within:text-indigo-600 transition-colors">
                ¿En cuántas cuotas lo va a pagar?
                <span class="text-xs text-slate-500 font-normal ml-1">({{ FRECUENCIAS[formData.frecuencia_pago]?.label
                  }})</span>
              </label>
              <input id="deuda-num-cuotas" v-model.number="formData.num_cuotas" type="number" :required="!esCuotaUnica"
                min="1"
                class="w-full border border-slate-200 rounded-lg shadow-sm focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500 p-2.5 text-base bg-white/70 backdrop-blur-sm transition-all hover:bg-white"
                placeholder="Ej. 12" />
            </div>
          </transition>

          <!-- Fecha de Vencimiento (cuota única) -->
          <transition name="fade">
            <div v-if="esCuotaUnica" class="group">
              <label
                class="block text-sm font-bold text-slate-700 mb-1 group-focus-within:text-indigo-600 transition-colors">Fecha
                de Vencimiento</label>
              <input id="deuda-fecha-vencimiento" v-model="formData.fecha_vencimiento" type="date"
                class="w-full border border-slate-200 rounded-lg shadow-sm focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500 p-2.5 text-base bg-white/70 backdrop-blur-sm transition-all hover:bg-white" />
            </div>
          </transition>

          <!-- Fecha del Primer Pago -->
          <div v-if="!esCuotaUnica" class="group">
            <label
              class="block text-sm font-bold text-slate-700 mb-1 group-focus-within:text-indigo-600 transition-colors">
              Fecha del Primer Pago
            </label>
            <input id="deuda-fecha-primer-pago" v-model="formData.fecha_primer_pago" type="date" required
              class="w-full border border-slate-200 rounded-lg shadow-sm focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500 p-2.5 text-base bg-white/70 backdrop-blur-sm transition-all hover:bg-white" />
          </div>
        </div>
      </div>

      <hr class="border-slate-100" />

      <!-- ── Sección 3: Tasas de Interés ── -->
      <div class="relative z-10">
        <h3 class="text-base font-bold text-slate-900 mb-3 flex items-center gap-2">
          <span class="bg-amber-100 text-amber-600 p-1 rounded-md">
            <svg xmlns="http://www.w3.org/2000/svg" class="h-4 w-4" viewBox="0 0 20 20" fill="currentColor">
              <path
                d="M2 11a1 1 0 011-1h2a1 1 0 011 1v5a1 1 0 01-1 1H3a1 1 0 01-1-1v-5zM8 7a1 1 0 011-1h2a1 1 0 011 1v9a1 1 0 01-1 1H9a1 1 0 01-1-1V7zM14 4a1 1 0 011-1h2a1 1 0 011 1v12a1 1 0 01-1 1h-2a1 1 0 01-1-1V4z" />
            </svg>
          </span>
          Tasas de Interés
        </h3>

        <div class="grid grid-cols-1 md:grid-cols-2 gap-4">
          <!-- TEA -->
          <div class="group relative">
            <label
              class="block text-sm font-bold text-slate-800 mb-1 group-focus-within:text-indigo-600 transition-colors">
              Porcentaje de Interés Anual (TEA)
            </label>
            <div class="relative">
              <input id="deuda-tea" v-model.number="formData.tea" type="number" step="0.01" min="0"
                @input="calcularTasaMensualDesdeTEA"
                class="w-full border border-slate-200 rounded-lg shadow-sm focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500 p-2.5 text-base pr-8 bg-white/70 backdrop-blur-sm transition-all hover:bg-white"
                placeholder="0.00" />
              <span class="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 font-medium">%</span>
            </div>
            <transition name="fade">
              <div v-if="teaAlert.level !== 'none'"
                :class="['mt-2 flex items-start gap-1 p-2 rounded-lg border text-xs font-medium leading-snug', tasaAlertaClases]">
                <span class="shrink-0 mt-0.5">{{ teaAlertaIcono }}</span>
                <span>{{ teaAlert.mensaje }}</span>
              </div>
            </transition>
          </div>

          <!-- TCEA -->
          <div class="group relative">
            <div class="flex items-center gap-1.5 mb-1">
              <label
                class="block text-sm font-bold text-slate-800 group-focus-within:text-indigo-600 transition-colors">
                Costo Total (TCEA)
              </label>
              <div class="relative inline-block">
                <button type="button" @mouseenter="showTceaTooltip = true" @mouseleave="showTceaTooltip = false"
                  @focus="showTceaTooltip = true" @blur="showTceaTooltip = false"
                  class="text-slate-400 hover:text-indigo-500 transition-colors focus:outline-none"
                  aria-label="Información sobre TCEA">
                  <svg xmlns="http://www.w3.org/2000/svg" class="h-4 w-4" fill="none" viewBox="0 0 24 24"
                    stroke="currentColor">
                    <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2"
                      d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                  </svg>
                </button>
                <transition name="tooltip">
                  <div v-if="showTceaTooltip"
                    class="absolute z-50 bottom-full mb-2 left-1/2 -translate-x-1/2 w-64 bg-slate-900 text-white text-xs rounded-lg p-3 shadow-xl leading-relaxed pointer-events-none">
                    <p><strong>La TCEA</strong> incluye todos los costos del crédito (intereses, seguros, comisiones).
                      Es el costo real que pagarás.</p>
                    <div
                      class="absolute top-full left-1/2 -translate-x-1/2 border-4 border-transparent border-t-slate-900">
                    </div>
                  </div>
                </transition>
              </div>
            </div>
            <div class="relative">
              <input id="deuda-tcea" v-model.number="formData.tcea" type="number" step="0.01" min="0"
                class="w-full border border-slate-200 rounded-lg shadow-sm focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500 p-2.5 text-base pr-8 bg-white/70 backdrop-blur-sm transition-all hover:bg-white"
                placeholder="0.00" />
              <span class="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 font-medium">%</span>
            </div>
          </div>

          <!-- Advertencia si sólo TCEA -->
          <transition name="fade">
            <div v-if="soloCon_TCEA"
              class="col-span-1 md:col-span-2 flex items-start gap-3 p-3 bg-yellow-50 border border-yellow-300 rounded-lg text-yellow-800 text-sm font-medium">
              <svg xmlns="http://www.w3.org/2000/svg" class="h-5 w-5 shrink-0 mt-0.5 text-yellow-500" fill="none"
                viewBox="0 0 24 24" stroke="currentColor">
                <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2"
                  d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
              </svg>
              <span>El cronograma será <strong>aproximado</strong> usando la TCEA. Para mayor exactitud, ingresa la
                TEA.</span>
            </div>
          </transition>
        </div>
      </div>

      <!-- ── Notas ── -->
      <div class="relative z-10 group">
        <label
          class="block text-sm font-bold text-slate-700 mb-1 group-focus-within:text-indigo-600 transition-colors">Notas
          u Observaciones</label>
        <textarea id="deuda-notas" v-model="formData.notas" rows="2"
          class="w-full border border-slate-200 rounded-lg shadow-sm focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500 p-2.5 text-base bg-white/70 backdrop-blur-sm transition-all hover:bg-white resize-none"
          placeholder="Opcional..."></textarea>
      </div>

      <hr class="border-slate-100" />

      <!-- ── Cronograma ── -->
      <div class="relative z-10">
        <div class="mb-3">
          <h3 class="text-lg font-bold text-slate-900">Tu Plan de Pagos</h3>
          <p class="text-xs text-slate-600 mt-0.5">Ingresa o ajusta las cuotas según tu contrato. Marca las que ya
            pagaste.</p>
        </div>

        <!-- Aviso cuando no hay datos suficientes -->
        <div v-if="!previewListo"
          class="flex items-center gap-4 p-4 bg-slate-50 border border-dashed border-slate-200 rounded-2xl text-sm text-slate-400">
          <svg xmlns="http://www.w3.org/2000/svg" class="h-5 w-5 shrink-0 text-slate-300" fill="none"
            viewBox="0 0 24 24" stroke="currentColor">
            <path stroke-linecap="round" stroke-linejoin="round" stroke-width="1.5"
              d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
          </svg>
          <span>Completa el número de cuotas y la fecha de inicio para generar la tabla.</span>
        </div>

        <!-- Tabla editable -->
        <EditableCronogramaTable v-if="previewListo" :model-value="cuotasFinales"
          @update:model-value="val => cuotasManuales = val" :moneda="formData.moneda" :es-aproximado="soloCon_TCEA" />
      </div>

      <!-- ── Botones ── -->
      <div
        class="flex flex-col-reverse sm:flex-row justify-end gap-3 text-sm pt-4 border-t border-slate-100 relative z-10">
        <button type="button" @click="router.push('/')"
          class="w-full sm:w-auto px-4 py-2 text-slate-600 bg-white border border-slate-200 rounded-lg hover:bg-slate-50 hover:text-slate-900 shadow-sm transition-all font-bold">
          Cancelar
        </button>
        <button type="submit" :disabled="loading"
          class="w-full sm:w-auto px-6 py-2 text-base bg-gradient-to-r from-indigo-600 to-purple-600 text-white rounded-lg hover:from-indigo-500 hover:to-purple-500 shadow-md shadow-indigo-500/30 transition-all font-bold flex items-center justify-center gap-2">
          <svg v-if="loading" class="animate-spin h-4 w-4 text-white" xmlns="http://www.w3.org/2000/svg" fill="none"
            viewBox="0 0 24 24">
            <circle class="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" stroke-width="4"></circle>
            <path class="opacity-75" fill="currentColor"
              d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z">
            </path>
          </svg>
          <template v-else>
            <svg xmlns="http://www.w3.org/2000/svg" class="h-4 w-4" viewBox="0 0 20 20" fill="currentColor">
              <path fill-rule="evenodd"
                d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z"
                clip-rule="evenodd" />
            </svg>
            {{ isEditMode ? 'Guardar Cambios' : 'Guardar Deuda' }}
          </template>
        </button>
      </div>
    </form>
  </div>
</template>

<style scoped>
.fade-enter-active,
.fade-leave-active {
  transition: opacity 0.25s ease, transform 0.25s ease;
}

.fade-enter-from,
.fade-leave-to {
  opacity: 0;
  transform: translateY(-6px);
}

.dropdown-enter-active,
.dropdown-leave-active {
  transition: opacity 0.15s ease, transform 0.15s ease;
}

.dropdown-enter-from,
.dropdown-leave-to {
  opacity: 0;
  transform: translateY(-8px) scale(0.98);
}

.tooltip-enter-active,
.tooltip-leave-active {
  transition: opacity 0.15s ease, transform 0.15s ease;
}

.tooltip-enter-from,
.tooltip-leave-to {
  opacity: 0;
  transform: translateX(-50%) translateY(4px);
}
</style>