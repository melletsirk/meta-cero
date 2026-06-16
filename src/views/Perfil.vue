<script setup>
import { ref, computed, watch, onMounted } from 'vue'
import { useAuthStore } from '../stores/auth'
import { usePerfilStore } from '../stores/perfil'
import { useDeudasStore } from '../stores/deudas'
import { useNotificationsStore } from '../stores/notifications'
import { formatearMoneda } from '../lib/finanzas'

const authStore = useAuthStore()
const perfilStore = usePerfilStore()
const deudasStore = useDeudasStore()
const notificationsStore = useNotificationsStore()

// ── Formulario local ─────────────────────────────────────────
const form = ref({
  ingreso_mensual: '',
  gasto_mensual_fijo: '',
  meta_cero_activa: false,
  fecha_meta_objetivo: '',
  moneda_preferida: 'PEN',
})

const saving = ref(false)

// ── Cargar datos existentes al montar ────────────────────────
onMounted(async () => {
  await Promise.all([perfilStore.fetchPerfil(), deudasStore.fetchDeudas()])
  if (perfilStore.perfil) {
    const p = perfilStore.perfil
    form.value = {
      ingreso_mensual:    p.ingreso_mensual    ?? '',
      gasto_mensual_fijo: p.gasto_mensual_fijo ?? '',
      meta_cero_activa:   p.meta_cero_activa   ?? false,
      fecha_meta_objetivo: p.fecha_meta_objetivo ? p.fecha_meta_objetivo.substring(0, 10) : '',
      moneda_preferida:   p.moneda_preferida   ?? 'PEN',
    }
  }
})

// ── Computed financieros ──────────────────────────────────────
const ingreso = computed(() => Number(form.value.ingreso_mensual) || 0)
const gasto   = computed(() => Number(form.value.gasto_mensual_fijo) || 0)

const capacidadDisponible = computed(() => Math.max(0, ingreso.value - gasto.value))

const deudaTotal = computed(() => deudasStore.deudaTotal)
const cuotasMes  = computed(() => deudasStore.cuotaTotalMes)

/**
 * Porcentaje del ingreso comprometido en cuotas mensuales.
 * Benchmark: < 30% saludable, 30–50% ajustado, > 50% riesgo.
 */
const porcentajeCompromiso = computed(() => {
  if (!ingreso.value || !cuotasMes.value) return 0
  return Math.min(100, (cuotasMes.value / ingreso.value) * 100)
})

const nivelCompromiso = computed(() => {
  const p = porcentajeCompromiso.value
  if (p === 0) return { label: 'Sin datos', color: 'slate', bg: 'bg-slate-200', text: 'text-slate-600', bar: 'bg-slate-400' }
  if (p < 30)  return { label: 'Saludable',  color: 'emerald', bg: 'bg-emerald-50', text: 'text-emerald-700', bar: 'bg-emerald-500' }
  if (p < 50)  return { label: 'Ajustado',   color: 'amber',   bg: 'bg-amber-50',   text: 'text-amber-700',   bar: 'bg-amber-500'   }
  return               { label: 'En riesgo', color: 'red',     bg: 'bg-red-50',     text: 'text-red-700',     bar: 'bg-red-500'     }
})

/**
 * Estimación optimista de meses para llegar a deuda = 0.
 * Solo válida si hay capacidad > cuota mensual (ahorro neto positivo).
 */
const mesesParaMeta = computed(() => {
  const sobrante = capacidadDisponible.value - cuotasMes.value
  if (!deudaTotal.value || sobrante <= 0) return null
  return Math.ceil(deudaTotal.value / sobrante)
})

const fmt = (n, moneda) => formatearMoneda(Number(n) || 0, moneda || form.value.moneda_preferida || 'PEN')

// ── Submit ────────────────────────────────────────────────────
const handleSubmit = async () => {
  saving.value = true
  try {
    await perfilStore.savePerfil({
      ingreso_mensual:    form.value.ingreso_mensual    ? Number(form.value.ingreso_mensual)    : null,
      gasto_mensual_fijo: form.value.gasto_mensual_fijo ? Number(form.value.gasto_mensual_fijo) : null,
      meta_cero_activa:   form.value.meta_cero_activa,
      fecha_meta_objetivo: form.value.fecha_meta_objetivo || null,
      moneda_preferida:   form.value.moneda_preferida,
    })
    notificationsStore.success('Perfil guardado correctamente ✓')
  } catch {
    notificationsStore.error('Error al guardar el perfil. Intenta de nuevo.')
  } finally {
    saving.value = false
  }
}

const nombreUsuario = computed(() =>
  authStore.user?.user_metadata?.full_name || authStore.user?.email?.split('@')[0] || 'Usuario'
)

const emailUsuario = computed(() => authStore.user?.email || '')
</script>

<template>
  <div class="space-y-8 pb-12 animate-fade-in">

    <!-- ── Header ── -->
    <div class="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4 stagger-1">
      <div>
        <h1 class="text-3xl font-extrabold text-slate-900 tracking-tight">
          Mi <span class="text-indigo-600">Perfil</span>
        </h1>
        <p class="text-slate-500 mt-1 font-medium">Configura tu situación financiera para obtener mejores insights.</p>
      </div>
    </div>

    <!-- ── Tarjeta de usuario ── -->
    <div class="glass rounded-3xl border border-white/60 shadow-xl shadow-slate-200/40 p-6 sm:p-8 stagger-1 relative overflow-hidden">
      <div class="absolute -top-16 -right-16 w-48 h-48 bg-indigo-100 rounded-full mix-blend-multiply filter blur-3xl opacity-50 pointer-events-none"></div>
      <div class="flex items-center gap-5 relative z-10">
        <!-- Avatar generado con iniciales -->
        <div class="h-16 w-16 rounded-2xl bg-gradient-to-br from-indigo-500 to-purple-600 flex items-center justify-center shadow-lg shadow-indigo-500/30 shrink-0">
          <span class="text-2xl font-extrabold text-white">
            {{ nombreUsuario.charAt(0).toUpperCase() }}
          </span>
        </div>
        <div>
          <h2 class="text-xl font-extrabold text-slate-900">{{ nombreUsuario }}</h2>
          <p class="text-slate-500 font-medium text-sm mt-0.5">{{ emailUsuario }}</p>
        </div>
      </div>
    </div>

    <!-- ── Panel de salud financiera (solo si hay datos) ── -->
    <div v-if="ingreso > 0" class="stagger-2">
      <h2 class="text-lg font-bold text-slate-700 mb-4 flex items-center gap-2">
        <svg xmlns="http://www.w3.org/2000/svg" class="h-5 w-5 text-indigo-500" viewBox="0 0 20 20" fill="currentColor">
          <path fill-rule="evenodd" d="M3 3a1 1 0 000 2v8a2 2 0 002 2h2.586l-1.293 1.293a1 1 0 101.414 1.414L10 15.414l2.293 2.293a1 1 0 001.414-1.414L12.414 15H15a2 2 0 002-2V5a1 1 0 100-2H3zm11 4a1 1 0 10-2 0v4a1 1 0 102 0V7zm-3 1a1 1 0 10-2 0v3a1 1 0 102 0V8zM8 9a1 1 0 00-2 0v2a1 1 0 102 0V9z" clip-rule="evenodd" />
        </svg>
        Salud Financiera
      </h2>

      <div class="grid grid-cols-1 sm:grid-cols-3 gap-4 mb-6">
        <!-- Ingreso -->
        <div class="glass p-5 rounded-2xl border border-white/60 shadow-sm relative overflow-hidden">
          <div class="absolute -right-4 -top-4 w-20 h-20 bg-emerald-400 rounded-full mix-blend-multiply filter blur-2xl opacity-10"></div>
          <p class="text-xs font-semibold text-slate-400 uppercase tracking-wider mb-1">Ingreso Mensual</p>
          <p class="text-2xl font-extrabold text-emerald-600">{{ fmt(ingreso) }}</p>
        </div>
        <!-- Gastos fijos -->
        <div class="glass p-5 rounded-2xl border border-white/60 shadow-sm relative overflow-hidden">
          <div class="absolute -right-4 -top-4 w-20 h-20 bg-amber-400 rounded-full mix-blend-multiply filter blur-2xl opacity-10"></div>
          <p class="text-xs font-semibold text-slate-400 uppercase tracking-wider mb-1">Gastos Fijos</p>
          <p class="text-2xl font-extrabold text-amber-600">{{ fmt(gasto) }}</p>
        </div>
        <!-- Disponible para deudas -->
        <div class="glass p-5 rounded-2xl border border-white/60 shadow-sm relative overflow-hidden"
          :class="capacidadDisponible >= cuotasMes ? 'border-emerald-100' : 'border-red-100'">
          <div class="absolute -right-4 -top-4 w-20 h-20 rounded-full mix-blend-multiply filter blur-2xl opacity-10"
            :class="capacidadDisponible >= cuotasMes ? 'bg-indigo-400' : 'bg-red-400'"></div>
          <p class="text-xs font-semibold text-slate-400 uppercase tracking-wider mb-1">Disponible para Deudas</p>
          <p class="text-2xl font-extrabold" :class="capacidadDisponible >= cuotasMes ? 'text-indigo-600' : 'text-red-600'">
            {{ fmt(capacidadDisponible) }}
          </p>
        </div>
      </div>

      <!-- Barra de compromiso -->
      <div class="glass rounded-2xl border border-white/60 shadow-sm p-5">
        <div class="flex items-center justify-between mb-3">
          <p class="text-sm font-bold text-slate-700">Porcentaje del ingreso comprometido en cuotas</p>
          <span class="text-sm font-extrabold px-2.5 py-1 rounded-lg"
            :class="[nivelCompromiso.bg, nivelCompromiso.text]">
            {{ nivelCompromiso.label }} — {{ porcentajeCompromiso.toFixed(1) }}%
          </span>
        </div>
        <div class="h-3 bg-slate-100 rounded-full overflow-hidden">
          <div class="h-full rounded-full transition-all duration-700"
            :class="nivelCompromiso.bar"
            :style="{ width: `${porcentajeCompromiso}%` }">
          </div>
        </div>
        <p class="text-xs text-slate-400 mt-2 font-medium">
          Referencia SBS: &lt;30% saludable · 30–50% ajustado · &gt;50% en riesgo
        </p>
      </div>

      <!-- Estimación de meses para Meta Cero -->
      <div v-if="mesesParaMeta" class="mt-4 glass rounded-2xl border border-indigo-100 shadow-sm p-5 bg-indigo-50/50">
        <div class="flex items-center gap-3">
          <div class="h-10 w-10 bg-indigo-100 rounded-xl flex items-center justify-center shrink-0">
            <svg xmlns="http://www.w3.org/2000/svg" class="h-5 w-5 text-indigo-600" viewBox="0 0 20 20" fill="currentColor">
              <path fill-rule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zm1-12a1 1 0 10-2 0v4a1 1 0 00.293.707l2.828 2.829a1 1 0 101.415-1.415L11 9.586V6z" clip-rule="evenodd" />
            </svg>
          </div>
          <div>
            <p class="text-sm font-bold text-indigo-900">
              A este ritmo, podrías llegar a Meta Cero en aprox.
              <span class="text-indigo-600">{{ mesesParaMeta }} {{ mesesParaMeta === 1 ? 'mes' : 'meses' }}</span>
            </p>
            <p class="text-xs text-indigo-600 font-medium mt-0.5">
              Basado en tu capacidad disponible vs. deuda total actual.
            </p>
          </div>
        </div>
      </div>

      <!-- Alerta si las cuotas superan la capacidad -->
      <div v-else-if="cuotasMes > capacidadDisponible && ingreso > 0"
        class="mt-4 flex items-start gap-3 p-4 bg-red-50 border border-red-200 rounded-2xl">
        <svg xmlns="http://www.w3.org/2000/svg" class="h-5 w-5 text-red-500 shrink-0 mt-0.5" viewBox="0 0 20 20" fill="currentColor">
          <path fill-rule="evenodd" d="M8.257 3.099c.765-1.36 2.722-1.36 3.486 0l5.58 9.92c.75 1.334-.213 2.98-1.742 2.98H4.42c-1.53 0-2.493-1.646-1.743-2.98l5.58-9.92zM11 13a1 1 0 11-2 0 1 1 0 012 0zm-1-8a1 1 0 00-1 1v3a1 1 0 002 0V6a1 1 0 00-1-1z" clip-rule="evenodd"/>
        </svg>
        <div>
          <p class="text-sm font-bold text-red-800">Tus cuotas superan tu capacidad disponible</p>
          <p class="text-xs text-red-600 mt-0.5 font-medium">
            Cuotas del mes: {{ fmt(cuotasMes) }} · Disponible: {{ fmt(capacidadDisponible) }}
            — Diferencia: {{ fmt(cuotasMes - capacidadDisponible) }}
          </p>
        </div>
      </div>
    </div>

    <!-- ── Formulario de configuración ── -->
    <form @submit.prevent="handleSubmit" class="stagger-2">
      <h2 class="text-lg font-bold text-slate-700 mb-4 flex items-center gap-2">
        <svg xmlns="http://www.w3.org/2000/svg" class="h-5 w-5 text-indigo-500" viewBox="0 0 20 20" fill="currentColor">
          <path fill-rule="evenodd" d="M11.49 3.17c-.38-1.56-2.6-1.56-2.98 0a1.532 1.532 0 01-2.286.948c-1.372-.836-2.942.734-2.106 2.106.54.886.061 2.042-.947 2.287-1.561.379-1.561 2.6 0 2.978a1.532 1.532 0 01.947 2.287c-.836 1.372.734 2.942 2.106 2.106a1.532 1.532 0 012.287.947c.379 1.561 2.6 1.561 2.978 0a1.533 1.533 0 012.287-.947c1.372.836 2.942-.734 2.106-2.106a1.533 1.533 0 01.947-2.287c1.561-.379 1.561-2.6 0-2.978a1.532 1.532 0 01-.947-2.287c.836-1.372-.734-2.942-2.106-2.106a1.532 1.532 0 01-2.287-.947zM10 13a3 3 0 100-6 3 3 0 000 6z" clip-rule="evenodd" />
        </svg>
        Configuración Financiera
      </h2>

      <div class="glass rounded-3xl border border-white/60 shadow-xl shadow-slate-200/40 p-6 sm:p-8 space-y-6">

        <!-- Ingresos y Gastos -->
        <div class="grid grid-cols-1 sm:grid-cols-2 gap-5">
          <div>
            <label for="ingreso" class="block text-sm font-bold text-slate-700 mb-1.5">
              Ingreso Neto Mensual
            </label>
            <p class="text-xs text-slate-400 font-medium mb-2">Lo que recibes después de impuestos y descuentos.</p>
            <div class="relative">
              <span class="absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-400 font-bold text-sm">
                {{ form.moneda_preferida === 'USD' ? '$' : 'S/' }}
              </span>
              <input
                id="ingreso"
                v-model="form.ingreso_mensual"
                type="number"
                min="0"
                step="0.01"
                placeholder="0.00"
                class="w-full pl-9 pr-4 py-3 bg-white/70 border border-slate-200 rounded-xl text-slate-900 font-semibold focus:outline-none focus:ring-2 focus:ring-indigo-400 focus:border-transparent transition-all"
              />
            </div>
          </div>

          <div>
            <label for="gastos" class="block text-sm font-bold text-slate-700 mb-1.5">
              Gastos Fijos Mensuales
            </label>
            <p class="text-xs text-slate-400 font-medium mb-2">Alquiler, alimentación, transporte y otros fijos.</p>
            <div class="relative">
              <span class="absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-400 font-bold text-sm">
                {{ form.moneda_preferida === 'USD' ? '$' : 'S/' }}
              </span>
              <input
                id="gastos"
                v-model="form.gasto_mensual_fijo"
                type="number"
                min="0"
                step="0.01"
                placeholder="0.00"
                class="w-full pl-9 pr-4 py-3 bg-white/70 border border-slate-200 rounded-xl text-slate-900 font-semibold focus:outline-none focus:ring-2 focus:ring-indigo-400 focus:border-transparent transition-all"
              />
            </div>
          </div>
        </div>

        <!-- Moneda preferida -->
        <div>
          <label class="block text-sm font-bold text-slate-700 mb-3">Moneda Preferida</label>
          <div class="flex gap-3">
            <label
              class="flex items-center gap-3 cursor-pointer px-4 py-3 rounded-xl border-2 transition-all flex-1"
              :class="form.moneda_preferida === 'PEN'
                ? 'border-indigo-400 bg-indigo-50 text-indigo-700'
                : 'border-slate-200 bg-white/60 text-slate-600 hover:border-slate-300'">
              <input type="radio" v-model="form.moneda_preferida" value="PEN" class="sr-only" />
              <span class="text-xl">🇵🇪</span>
              <div>
                <p class="font-bold text-sm">Soles</p>
                <p class="text-xs opacity-70 font-medium">S/ PEN</p>
              </div>
            </label>
            <label
              class="flex items-center gap-3 cursor-pointer px-4 py-3 rounded-xl border-2 transition-all flex-1"
              :class="form.moneda_preferida === 'USD'
                ? 'border-emerald-400 bg-emerald-50 text-emerald-700'
                : 'border-slate-200 bg-white/60 text-slate-600 hover:border-slate-300'">
              <input type="radio" v-model="form.moneda_preferida" value="USD" class="sr-only" />
              <span class="text-xl">🇺🇸</span>
              <div>
                <p class="font-bold text-sm">Dólares</p>
                <p class="text-xs opacity-70 font-medium">$ USD</p>
              </div>
            </label>
          </div>
        </div>

        <!-- Separador -->
        <div class="border-t border-slate-100"></div>

        <!-- Meta Cero -->
        <div>
          <div class="flex items-start justify-between gap-4">
            <div>
              <label for="meta-activa" class="block text-sm font-bold text-slate-700">Activar Meta Cero</label>
              <p class="text-xs text-slate-400 font-medium mt-0.5">
                Estás comprometido a llegar a cero deudas. Esto activa el seguimiento hacia tu meta.
              </p>
            </div>
            <!-- Toggle switch -->
            <button
              id="meta-activa"
              type="button"
              role="switch"
              :aria-checked="form.meta_cero_activa"
              @click="form.meta_cero_activa = !form.meta_cero_activa"
              class="relative shrink-0 inline-flex h-7 w-12 items-center rounded-full transition-colors focus:outline-none focus:ring-2 focus:ring-indigo-400 focus:ring-offset-2"
              :class="form.meta_cero_activa ? 'bg-indigo-600' : 'bg-slate-200'">
              <span
                class="inline-block h-5 w-5 transform rounded-full bg-white shadow transition-transform"
                :class="form.meta_cero_activa ? 'translate-x-6' : 'translate-x-1'">
              </span>
            </button>
          </div>

          <!-- Fecha objetivo (solo si meta activa) -->
          <div v-if="form.meta_cero_activa" class="mt-4">
            <label for="fecha-meta" class="block text-sm font-bold text-slate-700 mb-1.5">
              Fecha Objetivo (opcional)
            </label>
            <p class="text-xs text-slate-400 font-medium mb-2">
              ¿Para cuándo quieres haber saldado todas tus deudas?
            </p>
            <input
              id="fecha-meta"
              v-model="form.fecha_meta_objetivo"
              type="date"
              class="px-4 py-3 bg-white/70 border border-slate-200 rounded-xl text-slate-900 font-semibold focus:outline-none focus:ring-2 focus:ring-indigo-400 focus:border-transparent transition-all"
            />
          </div>
        </div>

        <!-- Submit -->
        <div class="flex justify-end pt-2">
          <button
            type="submit"
            :disabled="saving"
            class="bg-gradient-to-r from-indigo-600 to-purple-600 text-white px-6 py-3 rounded-xl hover:from-indigo-500 hover:to-purple-500 shadow-lg shadow-indigo-500/30 transition-all transform hover:-translate-y-0.5 font-bold flex items-center gap-2 disabled:opacity-60 disabled:cursor-not-allowed disabled:transform-none">
            <svg v-if="saving" class="animate-spin h-4 w-4" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
              <circle class="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" stroke-width="4" />
              <path class="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8v8H4z" />
            </svg>
            <svg v-else xmlns="http://www.w3.org/2000/svg" class="h-4 w-4" viewBox="0 0 20 20" fill="currentColor">
              <path fill-rule="evenodd" d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z" clip-rule="evenodd" />
            </svg>
            {{ saving ? 'Guardando...' : 'Guardar Cambios' }}
          </button>
        </div>
      </div>
    </form>

  </div>
</template>
