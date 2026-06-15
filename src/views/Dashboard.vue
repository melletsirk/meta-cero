<script setup>
import { onMounted, computed } from 'vue'
import { useRouter } from 'vue-router'
import { useAuthStore } from '../stores/auth'
import { useDeudasStore } from '../stores/deudas'
import { useNotificationsStore } from '../stores/notifications'
import { formatearMoneda, alertaTEA } from '../lib/finanzas'
import { registerAndSubscribePush } from '../lib/push'

const authStore = useAuthStore()
const deudasStore = useDeudasStore()
const notificationsStore = useNotificationsStore()
const router = useRouter()

onMounted(async () => {
  await Promise.all([
    deudasStore.fetchDeudas(),
    deudasStore.fetchCuotaTotalMes()
  ])
  checkVencimientosHoy()
})

const checkVencimientosHoy = () => {
  const hoyStr = new Date().toISOString().split('T')[0]
  let cuotasDeHoy = 0
  const deudasVencenHoy = []

  deudasStore.deudas.forEach(deuda => {
    if (deuda.estado !== 'activa') return
    // Usamos el campo directo de la base de datos O(1) en vez de iterar arrays O(N)
    if (deuda.fecha_proxima_cuota === hoyStr) {
      cuotasDeHoy++
      deudasVencenHoy.push(deuda.nombre)
    }
  })

  // Siempre pedimos permiso para suscribir al usuario a Push Notifications (Offline)
  if ('Notification' in window) {
    if (Notification.permission === 'granted') {
      registerAndSubscribePush()
    } else if (Notification.permission !== 'denied') {
      Notification.requestPermission().then(permission => {
        if (permission === 'granted') {
          registerAndSubscribePush()
        }
      })
    }
  }

  // Notificación local e in-app solo si hay cuotas hoy
  if (cuotasDeHoy > 0) {
    const mensaje = `Tienes ${cuotasDeHoy} cuota(s) que vencen HOY: ${deudasVencenHoy.join(', ')}`
    
    // 1. Notificación en la interfaz (Toast)
    notificationsStore.info(`📅 ¡Aviso! ${mensaje}`, 12000)

    // 2. Notificación Push Nativa del Sistema Operativo
    if ('Notification' in window && Notification.permission === 'granted') {
      new Notification('Meta Cero - Recordatorio', { body: mensaje })
    }
  }
}

const goNuevaDeuda = () => {
  router.push('/deudas/nueva')
}

const goDetalle = (id) => {
  router.push(`/deudas/${id}`)
}

const handleEliminar = async (id) => {
  if (confirm('¿Estás seguro de que deseas eliminar esta deuda? Esta acción no se puede deshacer.')) {
    try {
      await deudasStore.deleteDeuda(id)
      notificationsStore.success('Deuda eliminada exitosamente')
    } catch (error) {
      notificationsStore.error('Error al eliminar: ' + error.message)
    }
  }
}

const handleTogglePagada = async (deuda) => {
  const nuevoEstado = deuda.estado === 'cerrada' ? 'activa' : 'cerrada'
  try {
    await deudasStore.updateDeuda(deuda.id, { estado: nuevoEstado })
    notificationsStore.success(`Deuda marcada como ${nuevoEstado}`)
  } catch (error) {
    notificationsStore.error('Error al actualizar: ' + error.message)
  }
}

/** Clases CSS para el badge de alerta de TEA en las tarjetas */
const teaBadgeClasses = (deuda) => {
  const tea = deuda.tea || deuda.tcea
  if (!tea) return null
  const { level } = alertaTEA(tea)
  switch (level) {
    case 'yellow': return { badge: 'bg-yellow-100 text-yellow-800 border border-yellow-300', dot: 'bg-yellow-500' }
    case 'green': return { badge: 'bg-emerald-100 text-emerald-800 border border-emerald-300', dot: 'bg-emerald-500' }
    case 'orange': return { badge: 'bg-orange-100 text-orange-800 border border-orange-200', dot: 'bg-orange-500' }
    case 'red': return { badge: 'bg-red-100 text-red-800 border border-red-300', dot: 'bg-red-500' }
    default: return null
  }
}

/** Etiqueta de frecuencia abreviada */
const frecuenciaLabel = (freq) => {
  const labels = {
    mensual: 'Mensual', quincenal: 'Quincenal', catorcenal: 'Catorcenal',
    semanal: 'Semanal', cuota_unica: 'Cuota Única'
  }
  return labels[freq] || 'Mensual'
}

/** Formatea monto usando la moneda guardada por deuda */
const formatMonto = (monto, moneda) => formatearMoneda(monto, moneda || 'PEN')

// El monto pendiente ahora viene directamente de v_resumen_deudas
</script>

<template>
  <div class="space-y-8 pb-12">
    <!-- Header Section -->
    <div class="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-6 stagger-1">
      <div>
        <h1 class="text-3xl font-extrabold text-slate-900 tracking-tight">Hola, <span class="text-indigo-600">{{
          authStore.user?.user_metadata?.full_name || authStore.user?.email?.split('@')[0] }}</span> 👋</h1>
        <p class="text-slate-500 mt-1 font-medium">Aquí está el resumen de tus deudas activas.</p>
      </div>
      <button @click="goNuevaDeuda"
        class="bg-gradient-to-r from-indigo-600 to-purple-600 text-white px-5 py-2.5 rounded-xl hover:from-indigo-500 hover:to-purple-500 shadow-lg shadow-indigo-500/30 transition-all transform hover:-translate-y-0.5 font-bold flex items-center gap-2">
        <svg xmlns="http://www.w3.org/2000/svg" class="h-5 w-5" viewBox="0 0 20 20" fill="currentColor">
          <path fill-rule="evenodd"
            d="M10 5a1 1 0 011 1v3h3a1 1 0 110 2h-3v3a1 1 0 11-2 0v-3H6a1 1 0 110-2h3V6a1 1 0 011-1z"
            clip-rule="evenodd" />
        </svg>
        Nueva Deuda
      </button>
    </div>

    <!-- Metrics Cards -->
    <div class="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-6 stagger-2">
      <div class="glass p-6 rounded-2xl shadow-sm border border-white/60 card-hover relative overflow-hidden group">
        <div
          class="absolute -right-4 -top-4 w-24 h-24 bg-red-400 rounded-full mix-blend-multiply filter blur-2xl opacity-10 group-hover:opacity-20 transition-opacity">
        </div>
        <h3 class="text-base font-bold text-slate-600 mb-2 leading-tight">¿Cuánto debes en total?</h3>
        <p class="text-3xl font-extrabold text-slate-900">{{ formatMonto(deudasStore.deudaTotal, 'PEN') }}</p>
      </div>

      <div class="glass p-6 rounded-2xl shadow-sm border border-white/60 card-hover relative overflow-hidden group">
        <div
          class="absolute -right-4 -top-4 w-24 h-24 bg-amber-400 rounded-full mix-blend-multiply filter blur-2xl opacity-10 group-hover:opacity-20 transition-opacity">
        </div>
        <h3 class="text-base font-bold text-slate-600 mb-2 leading-tight">¿Cuánto debes pagar este mes?</h3>
        <p class="text-3xl font-extrabold text-slate-900">{{ formatMonto(deudasStore.cuotaTotalMes, 'PEN') }}</p>
      </div>

      <div class="glass p-6 rounded-2xl shadow-sm border border-white/60 card-hover relative overflow-hidden group">
        <div
          class="absolute -right-4 -top-4 w-24 h-24 bg-emerald-400 rounded-full mix-blend-multiply filter blur-2xl opacity-10 group-hover:opacity-20 transition-opacity">
        </div>
        <h3 class="text-base font-bold text-slate-600 mb-2 leading-tight">Tu próximo pago</h3>
        <template v-if="deudasStore.proximosVencimientos.length > 0">
          <p class="text-2xl font-bold text-slate-900">Día {{ deudasStore.proximosVencimientos[0].dia_vencimiento }}</p>
          <p class="text-base font-medium text-slate-500 mt-1 truncate">{{ deudasStore.proximosVencimientos[0].nombre }}
          </p>
        </template>
        <template v-else>
          <p class="text-2xl font-bold text-slate-900">Al día 🎉</p>
        </template>
      </div>

      <div class="glass p-6 rounded-2xl shadow-sm border border-white/60 card-hover relative overflow-hidden group">
        <div
          class="absolute -right-4 -top-4 w-24 h-24 bg-indigo-400 rounded-full mix-blend-multiply filter blur-2xl opacity-10 group-hover:opacity-20 transition-opacity">
        </div>
        <h3 class="text-base font-bold text-slate-600 mb-2 leading-tight">Préstamos activos</h3>
        <p class="text-3xl font-extrabold text-slate-900">{{ deudasStore.deudasActivas.length }}</p>
      </div>
    </div>

    <!-- Deudas List -->
    <div class="glass rounded-3xl shadow-sm border border-white/60 p-6 sm:p-8 stagger-3">
      <div class="flex items-center justify-between mb-6">
        <h2 class="text-xl font-bold text-slate-900">Mis Deudas</h2>
      </div>

      <div v-if="deudasStore.loading" class="text-center py-12">
        <div class="animate-spin rounded-full h-10 w-10 border-b-2 border-indigo-600 mx-auto"></div>
        <p class="text-slate-500 mt-4 font-medium">Cargando tu información...</p>
      </div>

      <div v-else-if="deudasStore.deudas.length === 0"
        class="text-center py-16 px-4 border-2 border-dashed border-slate-200 rounded-2xl bg-slate-50/50">
        <div class="bg-white p-4 rounded-full inline-block mb-4 shadow-sm">
          <svg xmlns="http://www.w3.org/2000/svg" class="h-10 w-10 text-indigo-400" fill="none" viewBox="0 0 24 24"
            stroke="currentColor">
            <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2"
              d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2" />
          </svg>
        </div>
        <h3 class="text-lg font-bold text-slate-900 mb-1">No hay deudas registradas</h3>
        <p class="text-slate-500 max-w-sm mx-auto mb-6">Comienza a organizar tus finanzas registrando tu primera deuda.
        </p>
        <button @click="goNuevaDeuda"
          class="text-indigo-600 font-semibold hover:text-indigo-700 bg-indigo-50 px-4 py-2 rounded-lg transition-colors">
          Registrar ahora
        </button>
      </div>

      <div v-else class="space-y-4">
        <!-- Deuda Items -->
        <div v-for="(deuda, index) in deudasStore.deudas" :key="deuda.id" @click="goDetalle(deuda.id)"
          class="group flex flex-col sm:flex-row justify-between items-start sm:items-center p-5 bg-white/60 border border-slate-100 rounded-2xl hover:bg-white hover:shadow-md transition-all cursor-pointer animate-slide-up"
          :style="{ animationDelay: `${index * 100}ms` }">

          <div class="flex items-center gap-5 w-full sm:w-auto">
            <div
              class="h-12 w-12 rounded-xl flex items-center justify-center shadow-sm shrink-0 transition-transform group-hover:scale-110"
              :class="deuda.tipo === 'formal' ? 'bg-gradient-to-br from-blue-50 to-indigo-100 text-indigo-600 border border-indigo-100' : 'bg-gradient-to-br from-purple-50 to-pink-100 text-purple-600 border border-purple-100'">
              <svg v-if="deuda.tipo === 'formal'" xmlns="http://www.w3.org/2000/svg" class="h-6 w-6" viewBox="0 0 20 20"
                fill="currentColor">
                <path fill-rule="evenodd"
                  d="M10.496 2.132a1 1 0 00-.992 0l-7 4A1 1 0 003 7v10a1 1 0 001 1h12a1 1 0 001-1V7a1 1 0 00-.504-.868l-7-4zM5 9a1 1 0 00-1 1v4a1 1 0 102 0v-4a1 1 0 00-1-1zm3 0a1 1 0 00-1 1v4a1 1 0 102 0v-4a1 1 0 00-1-1zm4 1a1 1 0 11-2 0v4a1 1 0 112 0v-4zm2-1a1 1 0 00-1 1v4a1 1 0 102 0v-4a1 1 0 00-1-1z"
                  clip-rule="evenodd" />
              </svg>
              <svg v-else xmlns="http://www.w3.org/2000/svg" class="h-6 w-6" viewBox="0 0 20 20" fill="currentColor">
                <path fill-rule="evenodd" d="M10 9a3 3 0 100-6 3 3 0 000 6zm-7 9a7 7 0 1114 0H3z" clip-rule="evenodd" />
              </svg>
            </div>
            <div class="flex-1 min-w-0">
              <h4 class="font-bold text-slate-900 truncate">{{ deuda.nombre }}</h4>
              <div class="flex flex-wrap items-center gap-x-2 gap-y-1 mt-1">
                <span class="text-sm font-medium text-slate-500">{{ deuda.entidad }}</span>
                <span class="text-slate-300">•</span>
                <!-- Frecuencia -->
                <span class="text-xs font-semibold text-slate-400 bg-slate-100 px-2 py-0.5 rounded-full">
                  {{ frecuenciaLabel(deuda.frecuencia_pago) }}
                </span>
                <!-- Moneda badge -->
                <span class="text-xs font-bold px-2 py-0.5 rounded-full"
                  :class="deuda.moneda === 'USD' ? 'bg-green-100 text-green-700' : 'bg-blue-100 text-blue-700'">
                  {{ deuda.moneda === 'USD' ? '$ USD' : 'S/ PEN' }}
                </span>
                <!-- TEA / TCEA Alert badge -->
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

          <div
            class="mt-4 sm:mt-0 text-left sm:text-right w-full sm:w-auto flex flex-col sm:items-end justify-between border-t border-slate-100 sm:border-0 pt-3 sm:pt-0 gap-3 sm:gap-2">
            <div class="flex sm:flex-col justify-between items-center sm:items-end w-full">
              <p class="font-extrabold text-lg text-slate-900">{{ formatMonto(deuda.total_pendiente || 0, deuda.moneda) }}
              </p>
              <span
                class="inline-flex items-center px-2.5 py-1 rounded-md text-xs font-bold uppercase tracking-wider mt-0 sm:mt-1"
                :class="{
                  'bg-emerald-100 text-emerald-700': deuda.estado === 'activa',
                  'bg-amber-100 text-amber-700': deuda.estado === 'pausada',
                  'bg-slate-100 text-slate-600': deuda.estado === 'cerrada'
                }">
                {{ deuda.estado }}
              </span>
            </div>

            <!-- Actions -->
            <div class="flex items-center gap-2 justify-end w-full">
              <button @click.stop="handleTogglePagada(deuda)"
                class="p-2 rounded-lg transition-colors flex items-center justify-center"
                :class="deuda.estado === 'cerrada' ? 'text-emerald-600 hover:bg-emerald-50' : 'text-slate-400 hover:text-emerald-600 hover:bg-emerald-50'"
                :title="deuda.estado === 'cerrada' ? 'Marcar como activa' : 'Marcar como pagada'">
                <svg xmlns="http://www.w3.org/2000/svg" class="h-5 w-5" fill="none" viewBox="0 0 24 24"
                  stroke="currentColor">
                  <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M5 13l4 4L19 7" />
                </svg>
              </button>
              <button @click.stop="handleEliminar(deuda.id)"
                class="p-2 text-slate-400 hover:text-red-600 hover:bg-red-50 rounded-lg transition-colors flex items-center justify-center"
                title="Eliminar deuda">
                <svg xmlns="http://www.w3.org/2000/svg" class="h-5 w-5" fill="none" viewBox="0 0 24 24"
                  stroke="currentColor">
                  <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2"
                    d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                </svg>
              </button>
            </div>
          </div>
        </div>
      </div>
    </div>
    <!-- ⚠️ Advertencia SBS — Centrales de Riesgo -->
    <div class="flex items-start gap-4 p-4 sm:p-5 bg-amber-50 border border-amber-300 rounded-2xl shadow-sm stagger-3">
      <div class="shrink-0 mt-0.5 bg-amber-100 text-amber-600 rounded-xl p-2">
        <svg xmlns="http://www.w3.org/2000/svg" class="h-5 w-5" viewBox="0 0 20 20" fill="currentColor">
          <path fill-rule="evenodd"
            d="M8.257 3.099c.765-1.36 2.722-1.36 3.486 0l5.58 9.92c.75 1.334-.213 2.98-1.742 2.98H4.42c-1.53 0-2.493-1.646-1.743-2.98l5.58-9.92zM11 13a1 1 0 11-2 0 1 1 0 012 0zm-1-8a1 1 0 00-1 1v3a1 1 0 002 0V6a1 1 0 00-1-1z"
            clip-rule="evenodd" />
        </svg>
      </div>
      <div>
        <p class="text-sm font-bold text-amber-900 mb-0.5">Centrales de Riesgo — Infocorp / Equifax</p>
        <p class="text-sm text-amber-800 leading-relaxed">
          Pagar tarde puede afectar tu clasificación en las centrales de riesgo (Infocorp/Equifax).
          <strong>Un atraso de más de 8 días</strong> puede cambiar tu categoría de
          <span class="inline-flex items-center gap-1 font-semibold"><span
              class="w-2 h-2 rounded-full bg-emerald-500 inline-block"></span>Normal</span>
          a
          <span class="inline-flex items-center gap-1 font-semibold"><span
              class="w-2 h-2 rounded-full bg-amber-500 inline-block"></span>CPP</span>.
          Cubre siempre el pago mínimo de todas tus deudas primero.
        </p>
        <p class="text-xs text-amber-700 mt-2 font-medium">
          Clasificación SBS: Normal → CPP → Deficiente → Dudoso → Pérdida
        </p>
      </div>
    </div>
  </div>
</template>
