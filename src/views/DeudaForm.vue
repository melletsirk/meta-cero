<script setup>
import { ref } from 'vue'
import { useRouter } from 'vue-router'
import { useDeudasStore } from '../stores/deudas'
import { useNotificationsStore } from '../stores/notifications'

const router = useRouter()
const deudasStore = useDeudasStore()
const notificationsStore = useNotificationsStore()

const formData = ref({
  nombre: '',
  tipo: 'formal',
  entidad: '',
  monto_original: null,
  monto_pendiente: null,
  tea: null,
  tasa_mensual: 0,
  fecha_inicio: '',
  fecha_vencimiento: '',
  num_cuotas: null,
  dia_vencimiento: 1,
  tiene_seguro: false,
  monto_seguro: 0,
  otros_cargos: 0,
  notas: ''
})

const loading = ref(false)

const calcularTasaMensualDesdeTEA = () => {
  if (formData.value.tea) {
    const teaDecimal = formData.value.tea / 100
    formData.value.tasa_mensual = (Math.pow(1 + teaDecimal, 1 / 12) - 1) * 100
  }
}

const handleSubmit = async () => {
  loading.value = true
  try {
    if (formData.value.tea && !formData.value.tasa_mensual) {
      calcularTasaMensualDesdeTEA()
    }
    const payload = { ...formData.value }
    if (payload.fecha_vencimiento === '') payload.fecha_vencimiento = null;
    if (payload.tea === '') payload.tea = null;
    await deudasStore.addDeuda(payload)
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
  <div class="max-w-3xl mx-auto pb-12 animate-slide-up">
    <!-- Header -->
    <div class="flex items-center gap-4 mb-8">
      <button @click="router.push('/')" class="p-2 text-slate-400 hover:text-indigo-600 hover:bg-indigo-50 rounded-xl transition-all">
        <svg xmlns="http://www.w3.org/2000/svg" class="h-6 w-6" fill="none" viewBox="0 0 24 24" stroke="currentColor">
          <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M10 19l-7-7m0 0l7-7m-7 7h18" />
        </svg>
      </button>
      <div>
        <h1 class="text-3xl font-extrabold text-slate-900 tracking-tight">Registrar Nueva Deuda</h1>
        <p class="text-slate-500 mt-1 font-medium">Completa los datos para llevar el control.</p>
      </div>
    </div>

    <!-- Form -->
    <form @submit.prevent="handleSubmit" class="glass shadow-xl shadow-slate-200/40 rounded-3xl border border-white/60 p-6 sm:p-10 space-y-10 relative overflow-hidden">
      <!-- Decoración de fondo del form -->
      <div class="absolute -top-40 -right-40 w-80 h-80 bg-indigo-50 rounded-full mix-blend-multiply filter blur-3xl opacity-50 pointer-events-none"></div>

      <!-- Sección: Información Básica -->
      <div class="relative z-10">
        <h3 class="text-lg font-bold text-slate-900 mb-5 flex items-center gap-2">
          <span class="bg-indigo-100 text-indigo-600 p-1.5 rounded-lg">
            <svg xmlns="http://www.w3.org/2000/svg" class="h-5 w-5" viewBox="0 0 20 20" fill="currentColor">
              <path d="M9 2a1 1 0 000 2h2a1 1 0 100-2H9z" />
              <path fill-rule="evenodd" d="M4 5a2 2 0 012-2 3 3 0 003 3h2a3 3 0 003-3 2 2 0 012 2v11a2 2 0 01-2 2H6a2 2 0 01-2-2V5zm3 4a1 1 0 000 2h.01a1 1 0 100-2H7zm3 0a1 1 0 000 2h3a1 1 0 100-2h-3zm-3 4a1 1 0 100 2h.01a1 1 0 100-2H7zm3 0a1 1 0 100 2h3a1 1 0 100-2h-3z" clip-rule="evenodd" />
            </svg>
          </span>
          Información Básica
        </h3>
        <div class="grid grid-cols-1 md:grid-cols-2 gap-6">
          <div class="group">
            <label class="block text-sm font-semibold text-slate-700 mb-1.5 group-focus-within:text-indigo-600 transition-colors">Nombre (Alias)</label>
            <input v-model="formData.nombre" type="text" required placeholder="Ej. Préstamo Personal BCP" class="w-full border-slate-200 rounded-xl shadow-sm focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500 p-3 bg-white/70 backdrop-blur-sm transition-all hover:bg-white" />
          </div>
          
          <div class="group">
            <label class="block text-sm font-semibold text-slate-700 mb-1.5 group-focus-within:text-indigo-600 transition-colors">Entidad Acreedora</label>
            <input v-model="formData.entidad" type="text" required placeholder="Ej. Banco de Crédito" class="w-full border-slate-200 rounded-xl shadow-sm focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500 p-3 bg-white/70 backdrop-blur-sm transition-all hover:bg-white" />
          </div>

          <div class="group">
            <label class="block text-sm font-semibold text-slate-700 mb-1.5 group-focus-within:text-indigo-600 transition-colors">Tipo de Deuda</label>
            <div class="relative">
              <select v-model="formData.tipo" class="w-full border-slate-200 rounded-xl shadow-sm focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500 p-3 bg-white/70 backdrop-blur-sm transition-all hover:bg-white appearance-none pr-10">
                <option value="formal">Formal (Banco/Financiera)</option>
                <option value="informal">Informal (Persona/Prestamista)</option>
              </select>
              <div class="pointer-events-none absolute inset-y-0 right-0 flex items-center px-3 text-slate-500">
                <svg class="h-4 w-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M19 9l-7 7-7-7"></path></svg>
              </div>
            </div>
          </div>
        </div>
      </div>

      <hr class="border-slate-100" />

      <!-- Sección: Montos y Plazos -->
      <div class="relative z-10">
        <h3 class="text-lg font-bold text-slate-900 mb-5 flex items-center gap-2">
          <span class="bg-emerald-100 text-emerald-600 p-1.5 rounded-lg">
            <svg xmlns="http://www.w3.org/2000/svg" class="h-5 w-5" viewBox="0 0 20 20" fill="currentColor">
              <path d="M8.433 7.418c.155-.103.346-.196.567-.267v1.698a2.305 2.305 0 01-.567-.267C8.07 8.34 8 8.114 8 8c0-.114.07-.34.433-.582zM11 12.849v-1.698c.22.071.412.164.567.267.364.243.433.468.433.582 0 .114-.07.34-.433.582a2.305 2.305 0 01-.567.267z" />
              <path fill-rule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zm1-13a1 1 0 10-2 0v.092a4.535 4.535 0 00-1.676.662C6.602 6.234 6 7.009 6 8c0 .99.602 1.765 1.324 2.246.48.32 1.054.545 1.676.662v1.941c-.391-.127-.68-.317-.843-.504a1 1 0 10-1.5 1.32c.568.647 1.44 1.15 2.343 1.332V15a1 1 0 102 0v-.092a4.535 4.535 0 001.676-.662C13.398 13.766 14 12.991 14 12c0-.99-.602-1.765-1.324-2.246A4.535 4.535 0 0011 9.092V7.151c.391.127.68.317.843.504a1 1 0 101.5-1.32c-.568-.647-1.44-1.15-2.343-1.332V5z" clip-rule="evenodd" />
            </svg>
          </span>
          Montos y Plazos
        </h3>
        <div class="grid grid-cols-1 md:grid-cols-2 gap-6">
          <div class="group relative">
            <label class="block text-sm font-semibold text-slate-700 mb-1.5 group-focus-within:text-indigo-600 transition-colors">Monto Original</label>
            <div class="relative">
              <span class="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400 font-medium">S/</span>
              <input v-model.number="formData.monto_original" type="number" step="0.01" required min="0" class="w-full border-slate-200 rounded-xl shadow-sm focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500 pl-10 p-3 bg-white/70 backdrop-blur-sm transition-all hover:bg-white" placeholder="0.00" />
            </div>
          </div>
          
          <div class="group relative">
            <label class="block text-sm font-semibold text-slate-700 mb-1.5 group-focus-within:text-indigo-600 transition-colors">Monto Pendiente Actual</label>
            <div class="relative">
              <span class="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400 font-medium">S/</span>
              <input v-model.number="formData.monto_pendiente" type="number" step="0.01" required min="0" class="w-full border-slate-200 rounded-xl shadow-sm focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500 pl-10 p-3 bg-white/70 backdrop-blur-sm transition-all hover:bg-white" placeholder="0.00" />
            </div>
          </div>

          <div class="group">
            <label class="block text-sm font-semibold text-slate-700 mb-1.5 group-focus-within:text-indigo-600 transition-colors">Fecha de Inicio</label>
            <input v-model="formData.fecha_inicio" type="date" required class="w-full border-slate-200 rounded-xl shadow-sm focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500 p-3 bg-white/70 backdrop-blur-sm transition-all hover:bg-white" />
          </div>

          <div class="group">
            <label class="block text-sm font-semibold text-slate-700 mb-1.5 group-focus-within:text-indigo-600 transition-colors">Total de Cuotas (Meses)</label>
            <input v-model.number="formData.num_cuotas" type="number" required min="1" class="w-full border-slate-200 rounded-xl shadow-sm focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500 p-3 bg-white/70 backdrop-blur-sm transition-all hover:bg-white" placeholder="Ej. 12" />
          </div>
        </div>
      </div>

      <hr class="border-slate-100" />

      <!-- Sección: Intereses y Extras -->
      <div class="relative z-10">
        <h3 class="text-lg font-bold text-slate-900 mb-5 flex items-center gap-2">
          <span class="bg-amber-100 text-amber-600 p-1.5 rounded-lg">
            <svg xmlns="http://www.w3.org/2000/svg" class="h-5 w-5" viewBox="0 0 20 20" fill="currentColor">
              <path d="M2 11a1 1 0 011-1h2a1 1 0 011 1v5a1 1 0 01-1 1H3a1 1 0 01-1-1v-5zM8 7a1 1 0 011-1h2a1 1 0 011 1v9a1 1 0 01-1 1H9a1 1 0 01-1-1V7zM14 4a1 1 0 011-1h2a1 1 0 011 1v12a1 1 0 01-1 1h-2a1 1 0 01-1-1V4z" />
            </svg>
          </span>
          Intereses y Extras
        </h3>
        <div class="grid grid-cols-1 md:grid-cols-2 gap-6">
          <div class="group relative">
            <label class="block text-sm font-semibold text-slate-700 mb-1.5 group-focus-within:text-indigo-600 transition-colors">TEA <span class="text-xs text-slate-400 font-normal">(Opcional)</span></label>
            <div class="relative">
              <input v-model.number="formData.tea" type="number" step="0.01" @change="calcularTasaMensualDesdeTEA" class="w-full border-slate-200 rounded-xl shadow-sm focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500 p-3 pr-10 bg-white/70 backdrop-blur-sm transition-all hover:bg-white" placeholder="0.00" />
              <span class="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 font-medium">%</span>
            </div>
          </div>
          
          <div class="group relative">
            <label class="block text-sm font-semibold text-slate-700 mb-1.5 group-focus-within:text-indigo-600 transition-colors">Tasa Mensual Calculada</label>
            <div class="relative">
              <input v-model.number="formData.tasa_mensual" type="number" step="0.001" class="w-full border-slate-200 rounded-xl shadow-sm p-3 pr-10 bg-slate-50 text-slate-500 cursor-not-allowed" readonly />
              <span class="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 font-medium">%</span>
            </div>
          </div>

          <div class="group">
            <label class="block text-sm font-semibold text-slate-700 mb-1.5 group-focus-within:text-indigo-600 transition-colors">Día de Vencimiento Mensual</label>
            <input v-model.number="formData.dia_vencimiento" type="number" min="1" max="31" required class="w-full border-slate-200 rounded-xl shadow-sm focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500 p-3 bg-white/70 backdrop-blur-sm transition-all hover:bg-white" />
          </div>

          <div class="flex flex-col gap-3 justify-center sm:pl-4">
            <label class="flex items-center gap-3 text-sm font-bold text-slate-700 cursor-pointer group">
              <div class="relative flex items-center justify-center">
                <input v-model="formData.tiene_seguro" type="checkbox" class="peer sr-only" />
                <div class="w-11 h-6 bg-slate-200 peer-focus:outline-none peer-focus:ring-4 peer-focus:ring-indigo-300 rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-slate-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-indigo-600 transition-colors"></div>
              </div>
              ¿Tiene seguro de desgravamen?
            </label>
            
            <transition name="fade">
              <div v-if="formData.tiene_seguro" class="relative group mt-1">
                <span class="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400 font-medium text-sm">S/</span>
                <input v-model.number="formData.monto_seguro" type="number" step="0.01" placeholder="Monto mensual" class="w-full border-slate-200 rounded-xl shadow-sm focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500 pl-9 p-2.5 bg-white/70 backdrop-blur-sm transition-all hover:bg-white text-sm" />
              </div>
            </transition>
          </div>
        </div>
      </div>

      <hr class="border-slate-100" />

      <!-- Notas -->
      <div class="relative z-10 group">
        <label class="block text-sm font-semibold text-slate-700 mb-1.5 group-focus-within:text-indigo-600 transition-colors">Notas u Observaciones</label>
        <textarea v-model="formData.notas" rows="3" class="w-full border-slate-200 rounded-xl shadow-sm focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500 p-3 bg-white/70 backdrop-blur-sm transition-all hover:bg-white resize-none" placeholder="Opcional..."></textarea>
      </div>

      <!-- Botones -->
      <div class="flex flex-col-reverse sm:flex-row justify-end gap-3 pt-6 border-t border-slate-100 relative z-10">
        <button type="button" @click="router.push('/')" class="w-full sm:w-auto px-6 py-3 text-slate-600 bg-white border border-slate-200 rounded-xl hover:bg-slate-50 hover:text-slate-900 shadow-sm transition-all font-bold">
          Cancelar
        </button>
        <button type="submit" :disabled="loading" class="w-full sm:w-auto px-6 py-3 bg-gradient-to-r from-indigo-600 to-purple-600 text-white rounded-xl hover:from-indigo-500 hover:to-purple-500 shadow-lg shadow-indigo-500/30 transition-all transform hover:-translate-y-0.5 font-bold flex items-center justify-center gap-2 disabled:opacity-50 disabled:transform-none">
          <svg v-if="loading" class="animate-spin h-5 w-5 text-white" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
            <circle class="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" stroke-width="4"></circle>
            <path class="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
          </svg>
          <span v-else>
            <svg xmlns="http://www.w3.org/2000/svg" class="h-5 w-5 inline-block -mt-0.5 mr-1" viewBox="0 0 20 20" fill="currentColor">
              <path fill-rule="evenodd" d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z" clip-rule="evenodd" />
            </svg>
          </span>
          Guardar Deuda
        </button>
      </div>

    </form>
  </div>
</template>

<style scoped>
.fade-enter-active,
.fade-leave-active {
  transition: opacity 0.3s ease, transform 0.3s ease;
}

.fade-enter-from,
.fade-leave-to {
  opacity: 0;
  transform: translateY(-5px);
}
</style>
