<script setup>
import { ref, computed, onMounted, watch } from 'vue'
import { useRouter } from 'vue-router'
import { useAuthStore } from '../stores/auth'
import { useDeudasStore } from '../stores/deudas'
import { useNotificationsStore } from '../stores/notifications'
import { formatearMoneda, alertaTEA } from '../lib/finanzas'
import { registerAndSubscribePush } from '../lib/push'

const authStore      = useAuthStore()
const deudasStore    = useDeudasStore()
const notificationsStore = useNotificationsStore()
const router         = useRouter()

// ── Estado local (independiente del store compartido) ──────────
const loading  = ref(false)
const hasError = ref(false)

// ── Carga de datos ─────────────────────────────────────────────
async function cargarDatos() {
  if (!authStore.user) return
  loading.value  = true
  hasError.value = false
  try {
    await Promise.all([
      deudasStore.fetchDeudas(),
      deudasStore.fetchCuotaTotalMes(),
    ])
    checkVencimientosHoy()
  } catch (e) {
    console.error('Dashboard: error cargando datos', e)
    hasError.value = true
  } finally {
    loading.value = false
  }
}

// Cargar al montar. Si el usuario no está listo aún, el watch lo captura.
onMounted(cargarDatos)

// Re-cargar si la sesión se inicializa tarde (ej. refresh de página lento)
watch(() => authStore.user, (u) => { if (u) cargarDatos() })

// ── Notificaciones de vencimiento ──────────────────────────────
function checkVencimientosHoy() {
  const hoy = new Date()
  const hoyStr = `${hoy.getFullYear()}-${String(hoy.getMonth() + 1).padStart(2, '0')}-${String(hoy.getDate()).padStart(2, '0')}`

  const vencenHoy = deudasStore.deudas
    .filter(d => d.estado === 'activa' && d.fecha_proxima_cuota === hoyStr)

  // Push notifications
  if ('Notification' in window) {
    if (Notification.permission === 'granted') {
      registerAndSubscribePush()
    } else if (Notification.permission !== 'denied') {
      Notification.requestPermission().then(p => { if (p === 'granted') registerAndSubscribePush() })
    }
  }

  if (vencenHoy.length > 0) {
    const nombres = vencenHoy.map(d => d.nombre).join(', ')
    const msg = `Tienes ${vencenHoy.length} cuota(s) que vencen HOY: ${nombres}`
    notificationsStore.info(`📅 ¡Aviso! ${msg}`, 12000)
    if ('Notification' in window && Notification.permission === 'granted') {
      new Notification('Meta Cero - Recordatorio', { body: msg })
    }
  }
}

// ── Helpers ────────────────────────────────────────────────────
const formatMonto = (monto, moneda) => formatearMoneda(Number(monto) || 0, moneda || 'PEN')

const frecuenciaLabel = (freq) => ({
  mensual: 'Mensual', quincenal: 'Quincenal', catorcenal: 'Catorcenal',
  semanal: 'Semanal', cuota_unica: 'Cuota Única',
}[freq] || 'Mensual')

const teaBadgeClasses = (deuda) => {
  const tasa = deuda.tea || deuda.tcea
  if (!tasa) return null
  const { level } = alertaTEA(tasa)
  const map = {
    green:  { badge: 'bg-emerald-100 text-emerald-800 border border-emerald-300', dot: 'bg-emerald-500' },
    yellow: { badge: 'bg-yellow-100  text-yellow-800  border border-yellow-300',  dot: 'bg-yellow-500'  },
    orange: { badge: 'bg-orange-100  text-orange-800  border border-orange-200',  dot: 'bg-orange-500'  },
    red:    { badge: 'bg-red-100     text-red-800     border border-red-300',     dot: 'bg-red-500'     },
  }
  return map[level] || null
}

// ── Acciones ───────────────────────────────────────────────────
const goDetalle = (id) => router.push(`/deudas/${id}`)

const handleEliminar = async (id) => {
  if (!confirm('¿Eliminar esta deuda? Esta acción no se puede deshacer.')) return
  try {
    await deudasStore.deleteDeuda(id)
    notificationsStore.success('Deuda eliminada')
  } catch (e) {
    notificationsStore.error('Error al eliminar: ' + e.message)
  }
}
</script>

<template>
  <div class="space-y-8 pb-12">

    <!-- ── Header ── -->
    <div class="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-6">
      <div>
        <h1 class="text-3xl font-extrabold text-slate-900 tracking-tight">
          Hola, <span class="text-indigo-600">{{ authStore.user?.user_metadata?.full_name || authStore.user?.email?.split('@')[0] }}</span> 👋
        </h1>
        <p class="text-slate-500 mt-1 font-medium">Aquí está el resumen de tus deudas activas.</p>
      </div>
      <button @click="router.push('/deudas/nueva')"
        class="bg-gradient-to-r from-indigo-600 to-purple-600 text-white px-5 py-2.5 rounded-xl hover:from-indigo-500 hover:to-purple-500 shadow-lg shadow-indigo-500/30 transition-all transform hover:-translate-y-0.5 font-bold flex items-center gap-2">
        <svg xmlns="http://www.w3.org/2000/svg" class="h-5 w-5" viewBox="0 0 20 20" fill="currentColor">
          <path fill-rule="evenodd" d="M10 5a1 1 0 011 1v3h3a1 1 0 110 2h-3v3a1 1 0 11-2 0v-3H6a1 1 0 110-2h3V6a1 1 0 011-1z" clip-rule="evenodd" />
        </svg>
        Nueva Deuda
      </button>
    </div>

    <!-- ── Métricas ── -->
    <div class="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-6">
      <div class="glass p-6 rounded-2xl shadow-sm border border-white/60 card-hover relative overflow-hidden group">
        <div class="absolute -right-4 -top-4 w-24 h-24 bg-red-400 rounded-full mix-blend-multiply filter blur-2xl opacity-10 group-hover:opacity-20 transition-opacity"></div>
        <h3 class="text-sm font-bold text-slate-500 mb-2 uppercase tracking-wider">Total adeudado</h3>
        <p class="text-3xl font-extrabold text-slate-900">{{ formatMonto(deudasStore.deudaTotal, 'PEN') }}</p>
      </div>

      <div class="glass p-6 rounded-2xl shadow-sm border border-white/60 card-hover relative overflow-hidden group">
        <div class="absolute -right-4 -top-4 w-24 h-24 bg-amber-400 rounded-full mix-blend-multiply filter blur-2xl opacity-10 group-hover:opacity-20 transition-opacity"></div>
        <h3 class="text-sm font-bold text-slate-500 mb-2 uppercase tracking-wider">Cuotas este mes</h3>
        <p class="text-3xl font-extrabold text-slate-900">{{ formatMonto(deudasStore.cuotaTotalMes, 'PEN') }}</p>
      </div>

      <div class="glass p-6 rounded-2xl shadow-sm border border-white/60 card-hover relative overflow-hidden group">
        <div class="absolute -right-4 -top-4 w-24 h-24 bg-emerald-400 rounded-full mix-blend-multiply filter blur-2xl opacity-10 group-hover:opacity-20 transition-opacity"></div>
        <h3 class="text-sm font-bold text-slate-500 mb-2 uppercase tracking-wider">Próximo pago</h3>
        <template v-if="deudasStore.proximosVencimientos.length > 0">
          <p class="text-2xl font-extrabold text-slate-900">Día {{ deudasStore.proximosVencimientos[0].dia_vencimiento }}</p>
          <p class="text-sm font-medium text-slate-500 mt-1 truncate">{{ deudasStore.proximosVencimientos[0].nombre }}</p>
        </template>
        <template v-else>
          <p class="text-2xl font-extrabold text-slate-900">Al día 🎉</p>
        </template>
      </div>

      <div class="glass p-6 rounded-2xl shadow-sm border border-white/60 card-hover relative overflow-hidden group">
        <div class="absolute -right-4 -top-4 w-24 h-24 bg-indigo-400 rounded-full mix-blend-multiply filter blur-2xl opacity-10 group-hover:opacity-20 transition-opacity"></div>
        <h3 class="text-sm font-bold text-slate-500 mb-2 uppercase tracking-wider">Préstamos activos</h3>
        <p class="text-3xl font-extrabold text-slate-900">{{ deudasStore.deudasActivas.length }}</p>
      </div>
    </div>

    <!-- ── Lista de deudas ── -->
    <div class="glass rounded-3xl shadow-sm border border-white/60 p-6 sm:p-8">
      <h2 class="text-xl font-bold text-slate-900 mb-6">Mis Deudas</h2>

      <!-- Loading -->
      <div v-if="loading" class="text-center py-16">
        <div class="animate-spin rounded-full h-10 w-10 border-b-2 border-indigo-600 mx-auto"></div>
        <p class="text-slate-500 mt-4 font-medium">Cargando tu información...</p>
      </div>

      <!-- Error -->
      <div v-else-if="hasError" class="text-center py-16 px-4">
        <div class="bg-red-50 border border-red-200 rounded-2xl p-8 max-w-sm mx-auto">
          <svg xmlns="http://www.w3.org/2000/svg" class="h-10 w-10 text-red-400 mx-auto mb-3" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
          </svg>
          <p class="font-bold text-red-700 mb-1">Error al cargar tus deudas</p>
          <p class="text-sm text-red-600 mb-4">Verifica tu conexión o intenta de nuevo.</p>
          <button @click="cargarDatos"
            class="bg-red-600 text-white px-4 py-2 rounded-xl text-sm font-bold hover:bg-red-700 transition-colors">
            Reintentar
          </button>
        </div>
      </div>

      <!-- Vacío -->
      <div v-else-if="deudasStore.deudas.length === 0"
        class="text-center py-16 px-4 border-2 border-dashed border-slate-200 rounded-2xl bg-slate-50/50">
        <div class="bg-white p-4 rounded-full inline-block mb-4 shadow-sm">
          <svg xmlns="http://www.w3.org/2000/svg" class="h-10 w-10 text-indigo-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2" />
          </svg>
        </div>
        <h3 class="text-lg font-bold text-slate-900 mb-1">No hay deudas registradas</h3>
        <p class="text-slate-500 max-w-sm mx-auto mb-6">Comienza a organizar tus finanzas registrando tu primera deuda.</p>
        <button @click="router.push('/deudas/nueva')"
          class="text-indigo-600 font-semibold hover:text-indigo-700 bg-indigo-50 px-4 py-2 rounded-lg transition-colors">
          Registrar ahora
        </button>
      </div>

      <!-- Lista -->
      <div v-else class="space-y-4">
        <div
          v-for="(deuda, index) in deudasStore.deudas"
          :key="deuda.id"
          @click="goDetalle(deuda.id)"
          class="group flex flex-col sm:flex-row justify-between items-start sm:items-center p-5 bg-white/60 border border-slate-100 rounded-2xl hover:bg-white hover:shadow-md transition-all cursor-pointer animate-slide-up"
          :style="{ animationDelay: `${index * 60}ms` }">

          <!-- Info izquierda -->
          <div class="flex items-center gap-4 w-full sm:w-auto">
            <div class="h-12 w-12 rounded-xl flex items-center justify-center shadow-sm shrink-0 transition-transform group-hover:scale-110"
              :class="deuda.tipo === 'formal'
                ? 'bg-gradient-to-br from-blue-50 to-indigo-100 text-indigo-600 border border-indigo-100'
                : 'bg-gradient-to-br from-purple-50 to-pink-100 text-purple-600 border border-purple-100'">
              <!-- Formal: banco -->
              <svg v-if="deuda.tipo === 'formal'" xmlns="http://www.w3.org/2000/svg" class="h-6 w-6" viewBox="0 0 20 20" fill="currentColor">
                <path fill-rule="evenodd" d="M10.496 2.132a1 1 0 00-.992 0l-7 4A1 1 0 003 7v10a1 1 0 001 1h12a1 1 0 001-1V7a1 1 0 00-.504-.868l-7-4zM5 9a1 1 0 00-1 1v4a1 1 0 102 0v-4a1 1 0 00-1-1zm3 0a1 1 0 00-1 1v4a1 1 0 102 0v-4a1 1 0 00-1-1zm4 1a1 1 0 11-2 0v4a1 1 0 112 0v-4zm2-1a1 1 0 00-1 1v4a1 1 0 102 0v-4a1 1 0 00-1-1z" clip-rule="evenodd" />
              </svg>
              <!-- Informal: persona -->
              <svg v-else xmlns="http://www.w3.org/2000/svg" class="h-6 w-6" viewBox="0 0 20 20" fill="currentColor">
                <path fill-rule="evenodd" d="M10 9a3 3 0 100-6 3 3 0 000 6zm-7 9a7 7 0 1114 0H3z" clip-rule="evenodd" />
              </svg>
            </div>

            <div class="flex-1 min-w-0">
              <h4 class="font-bold text-slate-900 truncate">{{ deuda.nombre }}</h4>
              <div class="flex flex-wrap items-center gap-x-2 gap-y-1 mt-1">
                <span class="text-sm font-medium text-slate-500">{{ deuda.entidad }}</span>
                <span class="text-slate-300">•</span>
                <span class="text-xs font-semibold text-slate-400 bg-slate-100 px-2 py-0.5 rounded-full">
                  {{ frecuenciaLabel(deuda.frecuencia_pago) }}
                </span>
                <span class="text-xs font-bold px-2 py-0.5 rounded-full"
                  :class="deuda.moneda === 'USD' ? 'bg-green-100 text-green-700' : 'bg-blue-100 text-blue-700'">
                  {{ deuda.moneda === 'USD' ? '$ USD' : 'S/ PEN' }}
                </span>
                <!-- TEA badge -->
                <template v-if="(deuda.tea || deuda.tcea) && teaBadgeClasses(deuda)">
                  <span class="inline-flex items-center gap-1 text-xs font-bold px-2 py-0.5 rounded-full"
                    :class="teaBadgeClasses(deuda).badge">
                    <span class="w-1.5 h-1.5 rounded-full" :class="teaBadgeClasses(deuda).dot"></span>
                    {{ deuda.tea ? `TEA ${deuda.tea}%` : `TCEA ${deuda.tcea}%` }}
                  </span>
                </template>
              </div>
            </div>
          </div>

          <!-- Info derecha -->
          <div class="mt-4 sm:mt-0 flex flex-col sm:items-end gap-2 border-t border-slate-100 sm:border-0 pt-3 sm:pt-0 w-full sm:w-auto">
            <div class="flex sm:flex-col justify-between sm:items-end w-full">
              <div>
                <span class="text-xs text-slate-400 font-medium">Monto Pendiente</span>
                <p class="font-extrabold text-lg text-slate-900 leading-tight">
                  {{ formatMonto(deuda.total_pendiente || 0, deuda.moneda) }}
                </p>
              </div>
              <span class="inline-flex items-center px-2.5 py-1 rounded-md text-xs font-bold uppercase tracking-wider"
                :class="{
                  'bg-emerald-100 text-emerald-700': deuda.estado === 'activa',
                  'bg-amber-100  text-amber-700':  deuda.estado === 'pausada',
                  'bg-slate-100  text-slate-600':  deuda.estado === 'cerrada',
                }">
                {{ deuda.estado }}
              </span>
            </div>

            <!-- Progress bar de cuotas -->
            <div v-if="deuda.total_cuotas > 0" class="w-full sm:w-36">
              <div class="flex justify-between text-xs font-medium text-slate-400 mb-1">
                <span>{{ deuda.cuotas_pagadas }}/{{ deuda.total_cuotas }} cuotas</span>
                <span>{{ Math.round((deuda.cuotas_pagadas / deuda.total_cuotas) * 100) }}%</span>
              </div>
              <div class="h-1.5 bg-slate-100 rounded-full overflow-hidden">
                <div class="h-full bg-indigo-500 rounded-full transition-all"
                  :style="{ width: `${Math.round((deuda.cuotas_pagadas / deuda.total_cuotas) * 100)}%` }">
                </div>
              </div>
            </div>

            <!-- Acciones -->
            <div class="flex items-center gap-2 justify-end w-full">
              <button @click.stop="handleEliminar(deuda.id)"
                class="p-2 text-slate-400 hover:text-red-600 hover:bg-red-50 rounded-lg transition-colors"
                title="Eliminar deuda"
                aria-label="Eliminar deuda">
                <svg xmlns="http://www.w3.org/2000/svg" class="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                </svg>
              </button>
            </div>
          </div>
        </div>
      </div>
    </div>

    <!-- ── Aviso SBS ── -->
    <div class="flex items-start gap-4 p-4 sm:p-5 bg-amber-50 border border-amber-300 rounded-2xl shadow-sm">
      <div class="shrink-0 mt-0.5 bg-amber-100 text-amber-600 rounded-xl p-2">
        <svg xmlns="http://www.w3.org/2000/svg" class="h-5 w-5" viewBox="0 0 20 20" fill="currentColor">
          <path fill-rule="evenodd" d="M8.257 3.099c.765-1.36 2.722-1.36 3.486 0l5.58 9.92c.75 1.334-.213 2.98-1.742 2.98H4.42c-1.53 0-2.493-1.646-1.743-2.98l5.58-9.92zM11 13a1 1 0 11-2 0 1 1 0 012 0zm-1-8a1 1 0 00-1 1v3a1 1 0 002 0V6a1 1 0 00-1-1z" clip-rule="evenodd" />
        </svg>
      </div>
      <div>
        <p class="text-sm font-bold text-amber-900 mb-0.5">Centrales de Riesgo — Infocorp / Equifax</p>
        <p class="text-sm text-amber-800 leading-relaxed">
          Un atraso de más de <strong>8 días</strong> puede cambiar tu categoría de
          <span class="inline-flex items-center gap-1 font-semibold"><span class="w-2 h-2 rounded-full bg-emerald-500 inline-block"></span>Normal</span>
          a <span class="inline-flex items-center gap-1 font-semibold"><span class="w-2 h-2 rounded-full bg-amber-500 inline-block"></span>CPP</span>.
          Cubre siempre el pago mínimo de todas tus deudas primero.
        </p>
        <p class="text-xs text-amber-700 mt-1.5 font-medium">Clasificación SBS: Normal → CPP → Deficiente → Dudoso → Pérdida</p>
      </div>
    </div>

  </div>
</template>
