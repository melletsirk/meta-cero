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

  const cuotaTotalMes = computed(() => {
    if (!Array.isArray(deudas.value)) return 0
    const ahora = new Date()
    const mesActual = ahora.getMonth()
    const anoActual = ahora.getFullYear()
    
    return deudas.value.reduce((acc, deuda) => {
      const cuotas = cuotasPorDeuda.value[deuda.id] || []
      const cuotasDelMes = cuotas.filter(c => {
        if (c.pagada || !c.fecha) return false
        const parts = c.fecha.split('-')
        if (parts.length < 2) return false
        
        const year = Number(parts[0])
        const month = Number(parts[1])
        return (year === anoActual && (month - 1) === mesActual)
      })
      
      const sumaMes = cuotasDelMes.reduce((sum, c) => sum + Number(c.total || 0), 0)
      return acc + sumaMes
    }, 0)
  })

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
      // 1. Fetch resumen de deudas (Vista)
      const { data: resumenData, error: resumenError } = await supabase
        .from('v_resumen_deudas')
        .select('*')
        .order('fecha_inicio', { ascending: false })

      if (resumenError) throw resumenError

      // 2. Fetch cronograma consolidado (Vista)
      const { data: cuotasData, error: cuotasError } = await supabase
        .from('v_cronograma_consolidado')
        .select('*')
        .order('numero_cuota', { ascending: true })

      if (cuotasError) throw cuotasError

      // Mapear deuda_id a id para mantener compatibilidad con el resto de la app
      const normalizedDeudas = (resumenData || []).map(d => ({
        ...d,
        id: d.deuda_id
      }))

      deudas.value = normalizedDeudas

      // Llenar caché de cuotas usando la vista consolidada
      const mapCuotas = {}
      normalizedDeudas.forEach(d => { mapCuotas[d.id] = [] })
      
      ;(cuotasData || []).forEach(c => {
        // Mapeamos cuota_id a id, y numero_cuota a numero para compatibilidad
        const mappedCuota = {
          ...c,
          id: c.cuota_id,
          numero: c.numero_cuota
        }
        if (!mapCuotas[c.deuda_id]) mapCuotas[c.deuda_id] = []
        mapCuotas[c.deuda_id].push(mappedCuota)
      })
      
      // Ordenar cuotas
      for (const key in mapCuotas) {
        mapCuotas[key].sort((a, b) => a.numero - b.numero)
      }
      cuotasPorDeuda.value = mapCuotas

    } catch (error) {
      console.error('Error fetching deudas:', error)
    } finally {
      loading.value = false
    }
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
        const cuotasPayload = cuotas.map(c => ({
          deuda_id: deudaData.id,
          numero: c.numero,
          fecha: c.fecha || null,
          capital: c.capital,
          interes: c.interes,
          total: c.total,
          modo: c.modo || 'calculado',
        }))

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
      const { data: backupCuotas } = await supabase
        .from('cuotas')
        .select('*')
        .eq('deuda_id', id)
        .order('numero', { ascending: true })

      const { error: updateError } = await supabase
        .from('deudas')
        .update(deudaUpdates)
        .eq('id', id)
        
      if (updateError) throw updateError

      const { error: deleteError } = await supabase
        .from('cuotas')
        .delete()
        .eq('deuda_id', id)

      if (deleteError) throw deleteError

      if (cuotas.length > 0) {
        const cuotasPayload = cuotas.map(c => ({
          deuda_id: id,
          numero: c.numero,
          fecha: c.fecha || null,
          capital: c.capital,
          interes: c.interes,
          total: c.total,
          modo: c.modo || 'calculado',
        }))

        const { error: cuotasError } = await supabase
          .from('cuotas')
          .insert(cuotasPayload)

        if (cuotasError) {
          console.error('Insert cuotas falló, restaurando backup...', cuotasError)
          if (backupCuotas && backupCuotas.length > 0) {
            const restorePayload = backupCuotas.map(
              ({ id: _id, created_at: _ca, updated_at: _ua, pago_id: _pi, ...rest }) => rest
            )
            await supabase.from('cuotas').insert(restorePayload).catch(e =>
              console.error('No se pudo restaurar el backup de cuotas:', e)
            )
          }
          throw cuotasError
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
    // La vista v_cronograma_consolidado ya nos trae toda la info enriquecida
    const cuotas = cuotasPorDeuda.value[deudaId] || []
    return cuotas
  }

  async function toggleCuotaPagada(cuota, deuda) {
    const nuevaPagada = !cuota.pagada
    try {
      if (nuevaPagada) {
        // Registrar un pago real usando la RPC que automáticamente vincula la cuota
        const { error: rpcError } = await supabase.rpc('registrar_pago', {
          p_deuda_id: deuda.id,
          p_monto: cuota.total,
          p_fecha_pago: new Date().toISOString().split('T')[0],
          p_tipo: 'cuota_regular'
        })
        if (rpcError) throw rpcError
      } else {
        // Desmarcar: Borrar el registro de la tabla pagos si existe el pago_id
        if (cuota.pago_id) {
          const { error: deleteError } = await supabase
            .from('pagos')
            .delete()
            .eq('id', cuota.pago_id)
          if (deleteError) throw deleteError
        }
      }

      // Refrescar todo desde Supabase para tener saldos actualizados
      await fetchDeudas()
      return true
    } catch (error) {
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
    addDeuda,
    updateDeuda,
    updateDeudaYCuotas,
    deleteDeuda,
    fetchCuotas,
    toggleCuotaPagada,
  }
})
