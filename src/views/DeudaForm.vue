<script setup>
import { ref, computed } from 'vue'
import { useRouter } from 'vue-router'
import { useDeudasStore } from '../stores/deudas'
import { useNotificationsStore } from '../stores/notifications'
import { calcularTasaPeriodica, alertaTEA, simboloMoneda, FRECUENCIAS, generarCronogramaFrances } from '../lib/finanzas'
import CronogramaTable from '../components/CronogramaTable.vue'
import EditableCronogramaTable from '../components/EditableCronogramaTable.vue'
import { watch } from 'vue'

const router = useRouter()
const deudasStore = useDeudasStore()
const notificationsStore = useNotificationsStore()


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
  monto_pendiente: null,
  tea: null,
  tcea: null,
  tasa_mensual: 0,
  frecuencia_pago: 'mensual',
  fecha_inicio: '',
  fecha_primer_pago: '',
  fecha_vencimiento: '',
  num_cuotas: null,
  tiene_seguro: false,
  monto_seguro: 0,
  otros_cargos: 0,
  notas: '',
  tasa_moratoria: null,
  base_calculo: 365,       // Base de días para tasa periódica: 360 (cooperativas) o 365 (bancos)
  redondear_cuota: false,  // Si true: cuota se redondea al entero superior (estilo cooperativa)
})

const loading = ref(false)
const showTceaTooltip = ref(false)
const showMoratoriaTooltip = ref(false)

const modoIngreso = ref('automatico')
const cuotasManuales = ref([])

watch(modoIngreso, (newVal) => {
  if (newVal === 'manual' && cuotasManuales.value.length === 0) {
    if (cronogramaPreview.value.length > 0) {
      cuotasManuales.value = JSON.parse(JSON.stringify(cronogramaPreview.value))
    } else {
      const num = formData.value.num_cuotas || 1
      const blank = []
      for (let i = 1; i <= num; i++) {
        blank.push({ numero: i, fecha: '', capital: 0, interes: 0, seguro: 0, total: 0, saldo_pendiente: 0, modo: 'manual' })
      }
      cuotasManuales.value = blank
    }
  }
})

watch(() => formData.value.num_cuotas, (newNum) => {
  if (modoIngreso.value === 'manual' && newNum > 0) {
    const current = cuotasManuales.value.length
    if (newNum > current) {
      for (let i = current + 1; i <= newNum; i++) {
        cuotasManuales.value.push({ numero: i, fecha: '', capital: 0, interes: 0, seguro: 0, total: 0, saldo_pendiente: 0, modo: 'manual' })
      }
    } else if (newNum < current) {
      cuotasManuales.value = cuotasManuales.value.slice(0, newNum)
    }
  }
})

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

/** Tasa periódica calculada en tiempo real para mostrarla al usuario */
const tasaPeriodicaDisplay = computed(() => {
  const tea = formData.value.tea || formData.value.tcea
  if (!tea) return null
  const tp = calcularTasaPeriodica(tea, formData.value.frecuencia_pago, Number(formData.value.base_calculo) || 365)
  return (tp * 100).toFixed(4)
})

const esCuotaUnica = computed(() => formData.value.frecuencia_pago === 'cuota_unica')

// ---------------------------------------------------------------------------
// Preview del cronograma en tiempo real
// ---------------------------------------------------------------------------
const cronogramaPreview = computed(() => {
  const { monto_original, tea, tcea, num_cuotas, fecha_inicio, frecuencia_pago, tiene_seguro, monto_seguro } = formData.value
  const tasaUsada = tea || tcea
  if (!monto_original || !tasaUsada || (!num_cuotas && frecuencia_pago !== 'cuota_unica') || !fecha_inicio) return []
  try {
    const seguro = tiene_seguro ? (Number(monto_seguro) || 0) : 0
    return generarCronogramaFrances(
      Number(monto_original),
      Number(tasaUsada),
      Number(num_cuotas) || 1,
      fecha_inicio,
      frecuencia_pago,
      seguro,
      !tea && !!tcea,
      Number(formData.value.base_calculo) || 365,
      formData.value.redondear_cuota
    )
  } catch { return [] }
})

const cuotasFinales = computed(() => modoIngreso.value === 'manual' ? cuotasManuales.value : cronogramaPreview.value)

const previewListo = computed(() => cuotasFinales.value.length > 0)

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
    const { base_calculo, redondear_cuota, ...payloadLimpio } = formData.value
    const payload = { ...payloadLimpio }
    if (payload.fecha_vencimiento === '') payload.fecha_vencimiento = null
    if (payload.tea === '') payload.tea = null
    if (payload.tcea === '') payload.tcea = null
    if (payload.tasa_moratoria === '') payload.tasa_moratoria = null
    await deudasStore.addDeuda(payload, cuotasFinales.value)
    notificationsStore.success('Deuda registrada exitosamente')
    router.push('/')
  } catch (error) {
    notificationsStore.error('Error al guardar la deuda: ' + error.message)
  } finally {
    loading.value = false
  }
}
</script>

<template>

  <div class="flex-1 p-4 sm:p-6 lg:p-8 overflow-y-auto animate-fade-in relative z-10 w-full mx-auto">
    <!-- Header -->
    <div class="flex items-center gap-4 mb-8">
      <button @click="router.push('/')"
        class="p-2 text-slate-400 hover:text-indigo-600 hover:bg-indigo-50 rounded-xl transition-all">
        <svg xmlns="http://www.w3.org/2000/svg" class="h-8 w-8" fill="none" viewBox="0 0 24 24" stroke="currentColor">
          <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M10 19l-7-7m0 0l7-7m-7 7h18" />
        </svg>
      </button>
      <div>
        <h1 class="text-4xl font-extrabold text-slate-900 tracking-tight">Añadir Préstamo</h1>
        <p class="text-lg text-slate-600 mt-1 font-medium">Llene los datos básicos de su deuda.</p>
      </div>
    </div>

    <!-- Form -->
    <form @submit.prevent="handleSubmit"
      class="glass shadow-xl shadow-slate-200/40 rounded-3xl border border-white/60 p-6 sm:p-8 space-y-8 relative overflow-hidden w-full">
      <!-- Decoración de fondo del form -->
      <div
        class="absolute -top-40 -right-40 w-80 h-80 bg-indigo-50 rounded-full mix-blend-multiply filter blur-3xl opacity-50 pointer-events-none">
      </div>

      <!-- ── Sección 1: Información Básica ── -->
      <div class="relative z-10">
        <h3 class="text-lg font-bold text-slate-900 mb-5 flex items-center gap-2">
          <span class="bg-indigo-100 text-indigo-600 p-1.5 rounded-lg">
            <svg xmlns="http://www.w3.org/2000/svg" class="h-5 w-5" viewBox="0 0 20 20" fill="currentColor">
              <path d="M9 2a1 1 0 000 2h2a1 1 0 100-2H9z" />
              <path fill-rule="evenodd"
                d="M4 5a2 2 0 012-2 3 3 0 003 3h2a3 3 0 003-3 2 2 0 012 2v11a2 2 0 01-2 2H6a2 2 0 01-2-2V5zm3 4a1 1 0 000 2h.01a1 1 0 100-2H7zm3 0a1 1 0 000 2h3a1 1 0 100-2h-3zm-3 4a1 1 0 100 2h.01a1 1 0 100-2H7zm3 0a1 1 0 100 2h3a1 1 0 100-2h-3z"
                clip-rule="evenodd" />
            </svg>
          </span>
          Información Básica
        </h3>
        <div class="grid grid-cols-1 md:grid-cols-2 gap-6">
          <!-- Nombre (alias) -->
          <div class="group">
            <label
              class="block text-xl font-bold text-slate-800 mb-1.5 group-focus-within:text-indigo-600 transition-colors">¿Qué
              nombre le pondrás a esta deuda?</label>
            <input id="deuda-nombre" v-model="formData.nombre" type="text" required
              placeholder="Ej. Préstamo Personal BCP"
              class="w-full border border-slate-200 rounded-xl shadow-sm focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500 p-4 text-lg bg-white/70 backdrop-blur-sm transition-all hover:bg-white" />
          </div>

          <!-- Entidad con autocompletado -->
          <div class="group relative">
            <label
              class="block text-xl font-bold text-slate-800 mb-1.5 group-focus-within:text-indigo-600 transition-colors">¿Con
              qué Banco o Caja?</label>
            <input id="deuda-entidad" :value="entitySearch || formData.entidad" @input="onEntityInput"
              @focus="showEntityDropdown = true" @blur="onEntityBlur" type="text" required
              placeholder="Escribe o elige (BCP, BBVA…)" autocomplete="off"
              class="w-full border border-slate-200 rounded-xl shadow-sm focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500 p-4 text-lg bg-white/70 backdrop-blur-sm transition-all hover:bg-white" />
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
              class="block text-base font-bold text-slate-700 mb-1.5 group-focus-within:text-indigo-600 transition-colors">Tipo
              de Deuda</label>
            <div class="relative">
              <select id="deuda-tipo" v-model="formData.tipo"
                class="w-full border border-slate-200 rounded-xl shadow-sm focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500 p-4 text-lg bg-white/70 backdrop-blur-sm transition-all hover:bg-white appearance-none pr-10">
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
            <label class="block text-base font-bold text-slate-700 mb-2">Moneda</label>
            <div class="flex gap-4 text-lg">
              <label class="flex-1 cursor-pointer">
                <input type="radio" id="moneda-pen" v-model="formData.moneda" value="PEN" class="sr-only peer" />
                <div
                  class="flex items-center justify-center gap-2 p-4 text-lg rounded-xl border-2 border-slate-200 bg-white/70 text-slate-600 font-bold text-sm transition-all peer-checked:border-indigo-500 peer-checked:bg-indigo-50 peer-checked:text-indigo-700 hover:border-slate-300">
                  <span class="text-base">🇵🇪</span> S/. Soles
                </div>
              </label>
              <label class="flex-1 cursor-pointer">
                <input type="radio" id="moneda-usd" v-model="formData.moneda" value="USD" class="sr-only peer" />
                <div
                  class="flex items-center justify-center gap-2 p-4 text-lg rounded-xl border-2 border-slate-200 bg-white/70 text-slate-600 font-bold text-sm transition-all peer-checked:border-indigo-500 peer-checked:bg-indigo-50 peer-checked:text-indigo-700 hover:border-slate-300">
                  <span class="text-base">🇺🇸</span> $ Dólares
                </div>
              </label>
            </div>
          </div>
        </div>
      </div>

      <hr class="border-slate-100" />

      <!-- ── Sección 2: Montos y Plazos ── -->
      <div class="relative z-10">
        <h3 class="text-lg font-bold text-slate-900 mb-5 flex items-center gap-2">
          <span class="bg-emerald-100 text-emerald-600 p-1.5 rounded-lg">
            <svg xmlns="http://www.w3.org/2000/svg" class="h-5 w-5" viewBox="0 0 20 20" fill="currentColor">
              <path
                d="M8.433 7.418c.155-.103.346-.196.567-.267v1.698a2.305 2.305 0 01-.567-.267C8.07 8.34 8 8.114 8 8c0-.114.07-.34.433-.582zM11 12.849v-1.698c.22.071.412.164.567.267.364.243.433.468.433.582 0 .114-.07.34-.433.582a2.305 2.305 0 01-.567.267z" />
              <path fill-rule="evenodd"
                d="M10 18a8 8 0 100-16 8 8 0 000 16zm1-13a1 1 0 10-2 0v.092a4.535 4.535 0 00-1.676.662C6.602 6.234 6 7.009 6 8c0 .99.602 1.765 1.324 2.246.48.32 1.054.545 1.676.662v1.941c-.391-.127-.68-.317-.843-.504a1 1 0 10-1.5 1.32c.568.647 1.44 1.15 2.343 1.332V15a1 1 0 102 0v-.092a4.535 4.535 0 001.676-.662C13.398 13.766 14 12.991 14 12c0-.99-.602-1.765-1.324-2.246A4.535 4.535 0 0011 9.092V7.151c.391.127.68.317.843.504a1 1 0 101.5-1.32c-.568-.647-1.44-1.15-2.343-1.332V5z"
                clip-rule="evenodd" />
            </svg>
          </span>
          Montos y Plazos
        </h3>
        <div class="grid grid-cols-1 md:grid-cols-2 gap-6">
          <!-- Monto Original -->
          <div class="group relative">
            <label
              class="block text-base font-bold text-slate-700 mb-1.5 group-focus-within:text-indigo-600 transition-colors">Monto
              Original</label>
            <div class="relative">
              <span class="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400 font-bold text-sm">{{ prefijo
              }}</span>
              <input id="deuda-monto-original" v-model.number="formData.monto_original" type="number" step="0.01"
                required min="0"
                class="w-full border border-slate-200 rounded-xl shadow-sm focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500 pl-10 p-4 text-lg bg-white/70 backdrop-blur-sm transition-all hover:bg-white"
                placeholder="0.00" />
            </div>
          </div>

          <!-- Monto Pendiente -->
          <div class="group relative">
            <label
              class="block text-base font-bold text-slate-700 mb-1.5 group-focus-within:text-indigo-600 transition-colors">Monto
              Pendiente Actual</label>
            <div class="relative">
              <span class="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400 font-bold text-sm">{{ prefijo
              }}</span>
              <input id="deuda-monto-pendiente" v-model.number="formData.monto_pendiente" type="number" step="0.01"
                required min="0"
                class="w-full border border-slate-200 rounded-xl shadow-sm focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500 pl-10 p-4 text-lg bg-white/70 backdrop-blur-sm transition-all hover:bg-white"
                placeholder="0.00" />
            </div>
          </div>

          <!-- Fecha de Inicio -->
          <div class="group">
            <label
              class="block text-base font-bold text-slate-700 mb-1.5 group-focus-within:text-indigo-600 transition-colors">Fecha
              de Inicio</label>
            <input id="deuda-fecha-inicio" v-model="formData.fecha_inicio" type="date" required
              class="w-full border border-slate-200 rounded-xl shadow-sm focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500 p-4 text-lg bg-white/70 backdrop-blur-sm transition-all hover:bg-white" />
          </div>

          <!-- Frecuencia de Pago -->
          <div class="group">
            <label
              class="block text-base font-bold text-slate-700 mb-1.5 group-focus-within:text-indigo-600 transition-colors">Frecuencia
              de Pago</label>
            <div class="relative">
              <select id="deuda-frecuencia" v-model="formData.frecuencia_pago"
                class="w-full border border-slate-200 rounded-xl shadow-sm focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500 p-4 text-lg bg-white/70 backdrop-blur-sm transition-all hover:bg-white appearance-none pr-10">
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
                class="block text-xl font-bold text-slate-800 mb-1.5 group-focus-within:text-indigo-600 transition-colors">
                ¿En cuántas cuotas lo va a pagar?
                <span class="text-sm text-slate-500 font-normal ml-1">({{ FRECUENCIAS[formData.frecuencia_pago]?.label
                }})</span>
              </label>
              <input id="deuda-num-cuotas" v-model.number="formData.num_cuotas" type="number" :required="!esCuotaUnica"
                min="1"
                class="w-full border border-slate-200 rounded-xl shadow-sm focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500 p-4 text-lg bg-white/70 backdrop-blur-sm transition-all hover:bg-white"
                placeholder="Ej. 12" />
            </div>
          </transition>

          <!-- Fecha de Vencimiento (cuota única) -->
          <transition name="fade">
            <div v-if="esCuotaUnica" class="group">
              <label
                class="block text-base font-bold text-slate-700 mb-1.5 group-focus-within:text-indigo-600 transition-colors">Fecha
                de Vencimiento</label>
              <input id="deuda-fecha-vencimiento" v-model="formData.fecha_vencimiento" type="date"
                class="w-full border border-slate-200 rounded-xl shadow-sm focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500 p-4 text-lg bg-white/70 backdrop-blur-sm transition-all hover:bg-white" />
            </div>
          </transition>

          <!-- Fecha del Primer Pago -->
          <div v-if="!esCuotaUnica" class="group">
            <label
              class="block text-base font-bold text-slate-700 mb-1.5 group-focus-within:text-indigo-600 transition-colors">
              Fecha del Primer Pago
            </label>
            <input id="deuda-fecha-primer-pago" v-model="formData.fecha_primer_pago" type="date" required
              class="w-full border border-slate-200 rounded-xl shadow-sm focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500 p-4 text-lg bg-white/70 backdrop-blur-sm transition-all hover:bg-white" />
          </div>
        </div>
      </div>

      <hr class="border-slate-100" />

      <!-- ── Sección 3: Tasas de Interés ── -->
      <div v-show="modoIngreso === 'automatico'" class="relative z-10">
        <h3 class="text-lg font-bold text-slate-900 mb-5 flex items-center gap-2">
          <span class="bg-amber-100 text-amber-600 p-1.5 rounded-lg">
            <svg xmlns="http://www.w3.org/2000/svg" class="h-5 w-5" viewBox="0 0 20 20" fill="currentColor">
              <path
                d="M2 11a1 1 0 011-1h2a1 1 0 011 1v5a1 1 0 01-1 1H3a1 1 0 01-1-1v-5zM8 7a1 1 0 011-1h2a1 1 0 011 1v9a1 1 0 01-1 1H9a1 1 0 01-1-1V7zM14 4a1 1 0 011-1h2a1 1 0 011 1v12a1 1 0 01-1 1h-2a1 1 0 01-1-1V4z" />
            </svg>
          </span>
          Tasas de Interés
        </h3>

        <div class="grid grid-cols-1 md:grid-cols-2 gap-6">
          <!-- TEA -->
          <div class="group relative">
            <label
              class="block text-xl font-bold text-slate-800 mb-1.5 group-focus-within:text-indigo-600 transition-colors">
              Porcentaje de Interés Anual (TEA)
            </label>
            <div class="relative">
              <input id="deuda-tea" v-model.number="formData.tea" type="number" step="0.01" min="0"
                @input="calcularTasaMensualDesdeTEA"
                class="w-full border border-slate-200 rounded-xl shadow-sm focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500 p-4 text-lg pr-10 bg-white/70 backdrop-blur-sm transition-all hover:bg-white"
                placeholder="0.00" />
              <span class="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 font-medium">%</span>
            </div>
            <transition name="fade">
              <div v-if="teaAlert.level !== 'none'"
                :class="['mt-2 flex items-start gap-2 p-2.5 rounded-xl border text-xs font-medium leading-snug', tasaAlertaClases]">
                <span class="shrink-0 mt-0.5">{{ teaAlertaIcono }}</span>
                <span>{{ teaAlert.mensaje }}</span>
              </div>
            </transition>
          </div>

          <!-- TCEA -->
          <div class="group relative">
            <div class="flex items-center gap-2 mb-1.5">
              <label
                class="block text-xl font-bold text-slate-800 group-focus-within:text-indigo-600 transition-colors">
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
                    class="absolute z-50 bottom-full mb-2 left-1/2 -translate-x-1/2 w-72 bg-slate-900 text-white text-xs rounded-xl p-4 text-lg shadow-xl leading-relaxed pointer-events-none">
                    <p><strong>La TCEA</strong> incluye todos los costos del crédito (intereses, seguros, comisiones).
                      Es el costo real que pagarás.</p>
                    <p class="mt-1 text-slate-300">Exigida por la SBS a todas las entidades financieras peruanas.</p>
                    <div
                      class="absolute top-full left-1/2 -translate-x-1/2 border-4 border-transparent border-t-slate-900">
                    </div>
                  </div>
                </transition>
              </div>
            </div>
            <div class="relative">
              <input id="deuda-tcea" v-model.number="formData.tcea" type="number" step="0.01" min="0"
                class="w-full border border-slate-200 rounded-xl shadow-sm focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500 p-4 text-lg pr-10 bg-white/70 backdrop-blur-sm transition-all hover:bg-white"
                placeholder="0.00" />
              <span class="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 font-medium">%</span>
            </div>
          </div>

          <!-- Tasa Moratoria -->
          <div class="group relative">
            <div class="flex items-center gap-2 mb-1.5">
              <label
                class="block text-base font-bold text-slate-700 group-focus-within:text-indigo-600 transition-colors">
                Tasa Moratoria <span class="text-sm text-slate-500 font-normal">(TNA — opcional)</span>
              </label>
              <div class="relative inline-block">
                <button type="button" @mouseenter="showMoratoriaTooltip = true"
                  @mouseleave="showMoratoriaTooltip = false" @focus="showMoratoriaTooltip = true"
                  @blur="showMoratoriaTooltip = false"
                  class="text-slate-400 hover:text-indigo-500 transition-colors focus:outline-none"
                  aria-label="Información sobre tasa moratoria">
                  <svg xmlns="http://www.w3.org/2000/svg" class="h-4 w-4" fill="none" viewBox="0 0 24 24"
                    stroke="currentColor">
                    <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2"
                      d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                  </svg>
                </button>
                <transition name="tooltip">
                  <div v-if="showMoratoriaTooltip"
                    class="absolute z-50 bottom-full mb-2 left-1/2 -translate-x-1/2 w-72 bg-slate-900 text-white text-xs rounded-xl p-4 text-lg shadow-xl leading-relaxed pointer-events-none">
                    <p><strong>Tasa moratoria</strong>: se aplica sobre cuotas vencidas e impagas. El banco la cobra por
                      cada día de atraso, encima del interés normal.</p>
                    <p class="mt-1 text-slate-300">Encuéntrala en tu contrato o en el cronograma que te entregó la
                      entidad.</p>
                    <div
                      class="absolute top-full left-1/2 -translate-x-1/2 border-4 border-transparent border-t-slate-900">
                    </div>
                  </div>
                </transition>
              </div>
            </div>
            <div class="relative">
              <input id="deuda-tasa-moratoria" v-model.number="formData.tasa_moratoria" type="number" step="0.01"
                min="0"
                class="w-full border border-slate-200 rounded-xl shadow-sm focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500 p-4 text-lg pr-10 bg-white/70 backdrop-blur-sm transition-all hover:bg-white"
                placeholder="0.00" />
              <span class="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 font-medium">%</span>
            </div>
            <!-- Simulador rápido de mora -->
            <transition name="fade">
              <div v-if="formData.tasa_moratoria && formData.monto_original && formData.num_cuotas"
                class="mt-2 p-2.5 bg-red-50 border border-red-200 rounded-xl text-xs text-red-700 font-medium">
                ⚠️ Si te atrasas <strong>7 días</strong> en una cuota de
                <strong>{{ prefijo }} {{ ((formData.monto_original / formData.num_cuotas) || 0).toFixed(2) }}</strong>,
                pagarías <strong>{{ prefijo }} {{ ((formData.monto_original / formData.num_cuotas) *
                  (formData.tasa_moratoria / 100 / 360) * 7).toFixed(2) }}</strong> extra en intereses moratorios.
              </div>
            </transition>
          </div>
        </div>

        <!-- Advertencia si sólo TCEA -->
        <transition name="fade">
          <div v-if="soloCon_TCEA"
            class="mt-4 flex items-start gap-4 text-lg p-4 text-lg.5 bg-yellow-50 border border-yellow-300 rounded-xl text-yellow-800 text-sm font-medium">
            <svg xmlns="http://www.w3.org/2000/svg" class="h-5 w-5 shrink-0 mt-0.5 text-yellow-500" fill="none"
              viewBox="0 0 24 24" stroke="currentColor">
              <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2"
                d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
            </svg>
            <span>El cronograma será <strong>aproximado</strong> porque se está usando la TCEA en lugar de la TEA pura.
              Para mayor exactitud, ingresa también la TEA.</span>
          </div>
        </transition>

        <!-- Base de cálculo: 360 vs 365 días -->
        <div class="mt-4 p-4 bg-slate-50 border border-slate-200 rounded-2xl">
          <p class="text-sm font-bold text-slate-700 mb-3">⚙️ Configuración del Cronograma</p>
          <div class="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <!-- Base de días -->
            <div>
              <label class="block text-xs font-semibold text-slate-600 mb-2">
                Base de cálculo
                <span class="ml-1 text-slate-400 font-normal">(días por año)</span>
              </label>
              <div class="flex gap-2">
                <label class="flex-1 cursor-pointer">
                  <input type="radio" v-model.number="formData.base_calculo" :value="365" class="sr-only peer" />
                  <div
                    class="text-center p-2.5 rounded-xl border-2 border-slate-200 bg-white text-slate-600 font-bold text-sm transition-all peer-checked:border-indigo-500 peer-checked:bg-indigo-50 peer-checked:text-indigo-700 hover:border-slate-300">
                    365 días
                    <span class="block text-xs font-normal text-slate-400 peer-checked:text-indigo-500">Bancos /
                      SBS</span>
                  </div>
                </label>
                <label class="flex-1 cursor-pointer">
                  <input type="radio" v-model.number="formData.base_calculo" :value="360" class="sr-only peer" />
                  <div
                    class="text-center p-2.5 rounded-xl border-2 border-slate-200 bg-white text-slate-600 font-bold text-sm transition-all peer-checked:border-indigo-500 peer-checked:bg-indigo-50 peer-checked:text-indigo-700 hover:border-slate-300">
                    360 días
                    <span class="block text-xs font-normal text-slate-400">Cooperativas / Cajas</span>
                  </div>
                </label>
              </div>
            </div>

            <!-- Redondeo de cuota -->
            <div class="flex flex-col justify-center">
              <label class="block text-xs font-semibold text-slate-600 mb-2">Redondeo de cuota</label>
              <label class="flex items-center gap-4 text-lg cursor-pointer group">
                <div class="relative flex items-center justify-center">
                  <input v-model="formData.redondear_cuota" type="checkbox" class="peer sr-only" />
                  <div
                    class="w-11 h-6 bg-slate-200 peer-focus:ring-4 peer-focus:ring-indigo-300 rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-slate-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-indigo-600 transition-colors">
                  </div>
                </div>
                <span class="text-sm text-slate-600 font-medium">
                  Redondear al sol entero
                  <span class="block text-sm text-slate-500 font-normal">Ej: S/ 145.30 → S/ 146.00</span>
                </span>
              </label>
            </div>
          </div>
        </div>

        <!-- Tasa periódica calculada (readonly) -->
        <transition name="fade">
          <div v-if="tasaPeriodicaDisplay" class="mt-4 grid grid-cols-1 md:grid-cols-2 gap-4">
            <div class="group relative">
              <label class="block text-base font-bold text-slate-700 mb-1.5">Tasa Periódica Calculada</label>
              <div class="relative">
                <input :value="tasaPeriodicaDisplay" type="number" readonly
                  class="w-full border border-slate-200 rounded-xl shadow-sm p-4 text-lg pr-10 bg-slate-50 text-slate-500 cursor-not-allowed" />
                <span class="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 font-medium">%</span>
              </div>
              <p class="text-sm text-slate-500 mt-1">Tasa {{ FRECUENCIAS[formData.frecuencia_pago]?.label?.toLowerCase()
              }} equivalente</p>
            </div>
          </div>
        </transition>
      </div>

      <!-- ── Sección 4: Extras (Seguro y Cargos) ── -->
      <div v-show="modoIngreso === 'automatico'" class="relative z-10">
        <h3 class="text-lg font-bold text-slate-900 mb-5 flex items-center gap-2">
          <span class="bg-purple-100 text-purple-600 p-1.5 rounded-lg">
            <svg xmlns="http://www.w3.org/2000/svg" class="h-5 w-5" viewBox="0 0 20 20" fill="currentColor">
              <path fill-rule="evenodd"
                d="M2.166 4.999A11.954 11.954 0 0010 1.944 11.954 11.954 0 0017.834 5c.11.65.166 1.32.166 2.001 0 5.225-3.34 9.67-8 11.317C5.34 16.67 2 12.225 2 7c0-.682.057-1.35.166-2.001zm11.541 3.708a1 1 0 00-1.414-1.414L9 10.586 7.707 9.293a1 1 0 00-1.414 1.414l2 2a1 1 0 001.414 0l4-4z"
                clip-rule="evenodd" />
            </svg>
          </span>
          Seguros y Cargos
        </h3>
        <div class="grid grid-cols-1 md:grid-cols-2 gap-6">
          <!-- Toggle seguro -->
          <div class="flex flex-col gap-4 text-lg justify-center">
            <label class="flex items-center gap-4 text-lg text-sm font-bold text-slate-700 cursor-pointer group">
              <div class="relative flex items-center justify-center">
                <input id="deuda-tiene-seguro" v-model="formData.tiene_seguro" type="checkbox" class="peer sr-only" />
                <div
                  class="w-11 h-6 bg-slate-200 peer-focus:outline-none peer-focus:ring-4 peer-focus:ring-indigo-300 rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-slate-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-indigo-600 transition-colors">
                </div>
              </div>
              ¿Tiene seguro de desgravamen?
            </label>

            <transition name="fade">
              <div v-if="formData.tiene_seguro" class="relative group mt-1">
                <input id="deuda-monto-seguro" v-model.number="formData.monto_seguro" type="number" step="0.001"
                  placeholder="Porcentaje mensual"
                  class="w-full border border-slate-200 rounded-xl shadow-sm focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500 pr-10 p-2.5 bg-white/70 backdrop-blur-sm transition-all hover:bg-white text-sm" />
                <span class="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 font-bold text-sm">%</span>
              </div>
            </transition>
          </div>

          <!-- Otros cargos -->
          <div class="group relative">
            <label
              class="block text-base font-bold text-slate-700 mb-1.5 group-focus-within:text-indigo-600 transition-colors">
              Otros Cargos / Comisiones
              <span class="text-sm text-slate-500 font-normal ml-1">(por cuota)</span>
            </label>
            <div class="relative">
              <span class="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400 font-bold text-sm">{{ prefijo
              }}</span>
              <input id="deuda-otros-cargos" v-model.number="formData.otros_cargos" type="number" step="0.01" min="0"
                class="w-full border border-slate-200 rounded-xl shadow-sm focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500 pl-10 p-4 text-lg bg-white/70 backdrop-blur-sm transition-all hover:bg-white"
                placeholder="0.00" />
            </div>
          </div>
        </div>
      </div>

      <hr class="border-slate-100" />

      <!-- ── Notas ── -->
      <div class="relative z-10 group">
        <label
          class="block text-base font-bold text-slate-700 mb-1.5 group-focus-within:text-indigo-600 transition-colors">Notas
          u Observaciones</label>
        <textarea id="deuda-notas" v-model="formData.notas" rows="3"
          class="w-full border border-slate-200 rounded-xl shadow-sm focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500 p-4 text-lg bg-white/70 backdrop-blur-sm transition-all hover:bg-white resize-none"
          placeholder="Opcional..."></textarea>
      </div>

      <hr class="border-slate-100" />

      <!-- ── Vista Previa Cronograma ── -->
      <div class="relative z-10">
        <div class="mb-4 flex flex-col sm:flex-row sm:items-center justify-between gap-4">
          <div>
            <h3 class="text-2xl font-bold text-slate-900">Tu Plan de Pagos</h3>
            <p class="text-sm text-slate-600 mt-0.5">Revisa cómo quedarán tus cuotas antes de guardar.</p>
          </div>
          <div class="flex bg-slate-100 p-1.5 rounded-xl shrink-0 gap-1 border border-slate-200">
            <button type="button" @click="modoIngreso = 'automatico'"
              class="px-4 py-2 text-base font-bold rounded-lg transition-colors"
              :class="modoIngreso === 'automatico' ? 'bg-white text-indigo-700 shadow-md border border-slate-200' : 'text-slate-600 hover:text-slate-800'">
              Calculado por la App
            </button>
            <button type="button" @click="modoIngreso = 'manual'"
              class="px-4 py-2 text-base font-bold rounded-lg transition-colors"
              :class="modoIngreso === 'manual' ? 'bg-white text-indigo-700 shadow-md border border-slate-200' : 'text-slate-600 hover:text-slate-800'">
              Copiar de mi Banco
            </button>
          </div>
        </div>

        <!-- Aviso cuando no hay datos suficientes -->
        <div v-if="!previewListo"
          class="flex items-center gap-4 text-lg p-4 bg-slate-50 border border-dashed border-slate-200 rounded-2xl text-sm text-slate-400">
          <svg xmlns="http://www.w3.org/2000/svg" class="h-5 w-5 shrink-0 text-slate-300" fill="none"
            viewBox="0 0 24 24" stroke="currentColor">
            <path stroke-linecap="round" stroke-linejoin="round" stroke-width="1.5"
              d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
          </svg>
          <span v-if="modoIngreso === 'automatico'">Completa monto, tasa, nro. cuotas y fecha de inicio para ver la
            proyección.</span>
          <span v-else>Completa nro. cuotas para generar la tabla y llenarla manualmente.</span>
        </div>

        <!-- Tabla siempre visible cuando hay datos -->
        <div v-if="previewListo">
          <CronogramaTable v-if="modoIngreso === 'automatico'" :cuotas="cronogramaPreview" :moneda="formData.moneda"
            :es-aproximado="soloCon_TCEA" />
          <EditableCronogramaTable v-else v-model="cuotasManuales" :moneda="formData.moneda" />
        </div>
      </div>

      <!-- ── Botones ── -->
      <div
        class="flex flex-col-reverse sm:flex-row justify-end gap-4 text-lg pt-6 border-t border-slate-100 relative z-10">
        <button type="button" @click="router.push('/')"
          class="w-full sm:w-auto px-6 py-3 text-slate-600 bg-white border border-slate-200 rounded-xl hover:bg-slate-50 hover:text-slate-900 shadow-sm transition-all font-bold">
          Cancelar
        </button>
        <button type="submit" :disabled="loading"
          class="w-full sm:w-auto px-8 py-4 text-lg bg-gradient-to-r from-indigo-600 to-purple-600 text-white rounded-xl hover:from-indigo-500 hover:to-purple-500 shadow-lg shadow-indigo-500/30 transition-all font-bold flex items-center justify-center gap-2">
          <svg v-if="loading" class="animate-spin h-5 w-5 text-white" xmlns="http://www.w3.org/2000/svg" fill="none"
            viewBox="0 0 24 24">
            <circle class="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" stroke-width="4"></circle>
            <path class="opacity-75" fill="currentColor"
              d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z">
            </path>
          </svg>
          <template v-else>
            <svg xmlns="http://www.w3.org/2000/svg" class="h-5 w-5" viewBox="0 0 20 20" fill="currentColor">
              <path fill-rule="evenodd"
                d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z"
                clip-rule="evenodd" />
            </svg>
            Guardar Deuda
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
