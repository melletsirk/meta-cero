import { defineStore } from 'pinia'
import { ref, computed } from 'vue'
import { supabase } from '../lib/supabase'
import { useAuthStore } from './auth'

export const useDeudasStore = defineStore('deudas', () => {
  const deudas = ref([])
  const loading = ref(false)
  const authStore = useAuthStore()

  // Mapa local: deudaId -> array de cuotas
  const cuotasPorDeuda = ref({})

  // ---------------------------------------------------------------------------
  // Computed - Dashboard
  // ---------------------------------------------------------------------------
  const deudaTotal = computed(() => {
    if (!Array.isArray(deudas.value)) return 0
    return deudas.value.reduce((acc, deuda) => acc + Number(deuda.total_pendiente || 0), 0)
  })

  // Ya no se calcula en memoria iterando miles de cuotas.
  // Idealmente esto debería venir de una vista SQL, pero por compatibilidad rápida
  // lo calcularemos cuando el Dashboard lo necesite explícitamente consultando la DB.
  const cuotaTotalMes = ref(0)

  const deudasActivas = computed(() =>
    deudas.value.filter(d => d.estado === 'activa')
  )

  const proximosVencimientos = computed(() => {
    return [...deudasActivas.value]
      .filter(d => d.fecha_proxima_cuota)
      .sort((a, b) => new Date(a.fecha_proxima_cuota) - new Date(b.fecha_proxima_cuota))
      .map(d => {
        const dia = new Date(d.fecha_proxima_cuota + 'T12:00:00').getDate()
        return { ...d, dia_vencimiento: dia }
      })
  })

  // ---------------------------------------------------------------------------
  // Deudas - CRUD
  // ---------------------------------------------------------------------------
  async function fetchDeudas() {
    if (!authStore.user) return
    loading.value = true
    try {
      // Fetch SOLO resumen de deudas (Vista ligera). O(1) carga de red.
      const { data: resumenData, error: resumenError } = await supabase
        .from('v_resumen_deudas')
        .select('*')
        .order('fecha_inicio', { ascending: false })

      if (resumenError) throw resumenError

      deudas.value = (resumenData || []).map(d => ({ ...d, id: d.deuda_id }))

    } catch (error) {
      console.error('Error fetching deudas:', error)
    } finally {
      loading.value = false
    }
  }

  // Carga las cuotas de un mes en particular (para el dashboard)
  async function fetchCuotaTotalMes() {
    if (!authStore.user) return
    const { data } = await supabase.rpc('obtener_total_mes_actual') // Podemos crearlo, o hacer fetch ligero
    // Para no crear RPC ahora, hacemos un query ligero a v_cronograma_consolidado
    const ahora = new Date()
    const primerDia = new Date(ahora.getFullYear(), ahora.getMonth(), 1).toISOString().split('T')[0]
    const ultimoDia = new Date(ahora.getFullYear(), ahora.getMonth() + 1, 0).toISOString().split('T')[0]

    const { data: cuotasMes } = await supabase
      .from('v_cronograma_consolidado')
      .select('total')
      .gte('fecha', primerDia)
      .lte('fecha', ultimoDia)
      .eq('pagada', false)
      
    cuotaTotalMes.value = (cuotasMes || []).reduce((acc, c) => acc + Number(c.total || 0), 0)
  }

  // Carga todas las cuotas de un mes específico para el Calendario
  async function fetchCalendario(ano, mes) {
    if (!authStore.user) return []
    const primerDia = new Date(ano, mes, 1).toISOString().split('T')[0]
    const ultimoDia = new Date(ano, mes + 1, 0).toISOString().split('T')[0]

    const { data: cuotasMes, error } = await supabase
      .from('v_cronograma_consolidado')
      .select('*')
      .gte('fecha', primerDia)
      .lte('fecha', ultimoDia)
      .order('fecha', { ascending: true })

    if (error) {
      console.error('Error fetching calendario:', error)
      return []
    }

    return (cuotasMes || []).map(c => ({
      ...c,
      id: c.cuota_id,
      numero: c.numero_cuota
    }))
  }

  async function addDeuda(deuda, cuotas = []) {
    if (!authStore.user) return
    loading.value = true
    try {
      // Limpiar campos que no van en la v3 para evitar errores de schema
      const { 
        saldo_capital, tasa_mensual, fecha_vencimiento, dia_vencimiento, 
        cuotas_pagadas, monto_cuota, ...deudaLimpia 
      } = deuda

      const { data: deudaData, error: deudaError } = await supabase
        .from('deudas')
        .insert([{ ...deudaLimpia, user_id: authStore.user.id }])
        .select()
        .single()

      if (deudaError) throw deudaError

      if (cuotas.length > 0) {
        const cuotasPayload = cuotas.map(c => {
          const cap = Number(Number(c.capital || 0).toFixed(2))
          const int = Number(Number(c.interes || 0).toFixed(2))
          const tot = Number((cap + int).toFixed(2))
          return {
            deuda_id: deudaData.id,
            numero: c.numero,
            fecha: c.fecha || null,
            capital: cap,
            interes: int,
            total: tot,
            modo: c.modo || 'calculado',
          }
        })

        const { error: cuotasError } = await supabase
          .from('cuotas')
          .insert(cuotasPayload)

        if (cuotasError) throw cuotasError

        // Registrar pagos para las cuotas marcadas como pagadas inicialmente
        const paidCuotas = cuotas.filter(c => c.pagada)
        for (const c of paidCuotas) {
          await supabase.rpc('registrar_pago', {
            p_deuda_id: deudaData.id,
            p_monto: c.total,
            p_fecha_pago: c.fecha || new Date().toISOString().split('T')[0],
            p_tipo: 'cuota_regular'
          })
        }
      }

      await fetchDeudas()
      return deudaData
    } catch (error) {
      console.error('Error adding deuda:', error)
      throw error
    } finally {
      loading.value = false
    }
  }

  async function updateDeuda(id, updates) {
    try {
      const { error } = await supabase
        .from('deudas')
        .update(updates)
        .eq('id', id)

      if (error) throw error
      await fetchDeudas()
    } catch (error) {
      console.error('Error updating deuda:', error)
      throw error
    }
  }

  async function updateDeudaYCuotas(id, deudaUpdates, cuotas = []) {
    loading.value = true
    try {
      const { error: updateError } = await supabase
        .from('deudas')
        .update(deudaUpdates)
        .eq('id', id)
        
      if (updateError) throw updateError

      if (cuotas.length > 0) {
        // Obtenemos cuotas existentes para preservar sus IDs y vínculos con pagos (pago_id)
        const { data: existingCuotas } = await supabase
          .from('cuotas')
          .select('id, numero, pago_id')
          .eq('deuda_id', id)

        const existingMap = {}
        ;(existingCuotas || []).forEach(c => { existingMap[c.numero] = c })

        const cuotasPayload = cuotas.map(c => {
          const existing = existingMap[c.numero]
          const cap = Number(Number(c.capital || 0).toFixed(2))
          const int = Number(Number(c.interes || 0).toFixed(2))
          const tot = Number((cap + int).toFixed(2))
          
          const payload = {
            deuda_id: id,
            numero: c.numero,
            fecha: c.fecha || null,
            capital: cap,
            interes: int,
            total: tot,
            modo: c.modo || 'calculado',
          }
          if (existing) {
            payload.id = existing.id
            payload.pago_id = existing.pago_id
          }
          return payload
        })

        // Upsert inteligente: actualiza las que existen, inserta las nuevas
        const { error: cuotasError } = await supabase
          .from('cuotas')
          .upsert(cuotasPayload)

        if (cuotasError) throw cuotasError

        // Limpiar cuotas sobrantes si el usuario redujo el número de cuotas (ej. de 12 a 6)
        // SOLO eliminamos las que NO están pagadas para proteger el historial financiero.
        const newNumeros = cuotasPayload.map(c => c.numero)
        const toDeleteIds = (existingCuotas || [])
          .filter(c => !newNumeros.includes(c.numero) && !c.pago_id)
          .map(c => c.id)

        if (toDeleteIds.length > 0) {
          await supabase
            .from('cuotas')
            .delete()
            .in('id', toDeleteIds)
        }
      }

      await fetchDeudas()
    } catch (error) {
      console.error('Error updating deuda y cuotas:', error)
      throw error
    } finally {
      loading.value = false
    }
  }

  async function deleteDeuda(id) {
    try {
      const { error } = await supabase
        .from('deudas')
        .delete()
        .eq('id', id)

      if (error) throw error
      deudas.value = deudas.value.filter(d => d.id !== id)
      delete cuotasPorDeuda.value[id]
    } catch (error) {
      console.error('Error deleting deuda:', error)
      throw error
    }
  }

  // ---------------------------------------------------------------------------
  // Cuotas - Fetch y toggle
  // ---------------------------------------------------------------------------
  async function fetchCuotas(deudaId) {
    if (!authStore.user || !deudaId) return []
    // Lazy load: solo traemos el cronograma de ESTA deuda desde la DB
    const { data: cuotasData, error } = await supabase
      .from('v_cronograma_consolidado')
      .select('*')
      .eq('deuda_id', deudaId)
      .order('numero_cuota', { ascending: true })

    if (error) {
      console.error('Error fetching cuotas:', error)
      return []
    }

    const cuotasNormalizadas = (cuotasData || []).map(c => ({
      ...c,
      id: c.cuota_id,
      numero: c.numero_cuota
    }))
    
    // Guardamos en caché local para transiciones rápidas
    cuotasPorDeuda.value[deudaId] = cuotasNormalizadas
    return cuotasNormalizadas
  }

  async function toggleCuotaPagada(cuota, deuda) {
    const nuevaPagada = !cuota.pagada
    
    // Optimistic UI update: actualizar inmediatamente en la UI local para que se sienta instantáneo
    cuota.pagada = nuevaPagada
    if (cuotasPorDeuda.value[deuda.id]) {
      const idx = cuotasPorDeuda.value[deuda.id].findIndex(c => c.id === cuota.id)
      if (idx !== -1) cuotasPorDeuda.value[deuda.id][idx].pagada = nuevaPagada
    }

    try {
      if (nuevaPagada) {
        const { error: rpcError } = await supabase.rpc('registrar_pago', {
          p_deuda_id: deuda.id,
          p_monto: cuota.total,
          p_fecha_pago: new Date().toISOString().split('T')[0],
          p_tipo: 'cuota_regular'
        })
        if (rpcError) throw rpcError
      } else {
        if (cuota.pago_id) {
          const { error: deleteError } = await supabase
            .from('pagos')
            .delete()
            .eq('id', cuota.pago_id)
          if (deleteError) throw deleteError
        }
      }

      // Sync final en background
      await fetchDeudas()
      fetchCuotaTotalMes()
      return true
    } catch (error) {
      // Revert Optimistic UI en caso de error
      cuota.pagada = !nuevaPagada
      if (cuotasPorDeuda.value[deuda.id]) {
        const idx = cuotasPorDeuda.value[deuda.id].findIndex(c => c.id === cuota.id)
        if (idx !== -1) cuotasPorDeuda.value[deuda.id][idx].pagada = !nuevaPagada
      }
      console.error('Error toggling cuota:', error)
      throw error
    }
  }

  return {
    deudas,
    loading,
    cuotasPorDeuda,
    deudaTotal,
    cuotaTotalMes,
    deudasActivas,
    proximosVencimientos,
    fetchDeudas,
    fetchCuotaTotalMes,
    fetchCalendario,
    addDeuda,
    updateDeuda,
    updateDeudaYCuotas,
    deleteDeuda,
    fetchCuotas,
    toggleCuotaPagada,
  }
})
