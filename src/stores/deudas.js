import { defineStore } from 'pinia'
import { ref, computed } from 'vue'
import { supabase } from '../lib/supabase'
import { useAuthStore } from './auth'

export const useDeudasStore = defineStore('deudas', () => {
  const deudas = ref([])
  const loading = ref(false)
  const authStore = useAuthStore()

  // Mapa local: deudaId → array de cuotas
  const cuotasPorDeuda = ref({})

  // ---------------------------------------------------------------------------
  // Computed — Dashboard
  // ---------------------------------------------------------------------------
  const deudaTotal = computed(() => {
    if (!Array.isArray(deudas.value)) return 0
    return deudas.value.reduce((acc, deuda) => {
      const cuotas = cuotasPorDeuda.value[deuda.id] || []
      const pendientes = cuotas.filter(c => !c.pagada)
      
      if (cuotas.length === 0) {
        return acc + Number(deuda.saldo_capital || 0)
      }
      
      const sumaConIntereses = pendientes.reduce((sum, c) => sum + Number(c.total || 0), 0)
      return acc + sumaConIntereses
    }, 0)
  })

  const cuotaTotalMes = computed(() => {
    if (!Array.isArray(deudas.value)) return 0
    const ahora = new Date()
    const mesActual = ahora.getMonth()
    const anoActual = ahora.getFullYear()
    
    return deudas.value.reduce((acc, deuda) => {
      const cuotas = cuotasPorDeuda.value[deuda.id] || []
      
      const cuotasDelMes = cuotas.filter(c => {
        if (c.pagada || !c.fecha || typeof c.fecha !== 'string') return false
        
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
    return [...deudasActivas.value].sort((a, b) => {
      return (a.dia_vencimiento || 31) - (b.dia_vencimiento || 31)
    })
  })

  // ---------------------------------------------------------------------------
  // Deudas — CRUD
  // ---------------------------------------------------------------------------
  async function fetchDeudas() {
    if (!authStore.user) return
    loading.value = true
    try {
      const { data, error } = await supabase
        .from('deudas')
        .select('*, cuotas(*)')
        .order('created_at', { ascending: false })

      if (error) throw error
      deudas.value = data || []
      
      // Llenamos la caché de cuotas
      ;(data || []).forEach(d => {
        if (d.cuotas) {
          cuotasPorDeuda.value[d.id] = d.cuotas.sort((a,b) => a.numero - b.numero)
        }
      })
    } catch (error) {
      console.error('Error fetching deudas:', error)
    } finally {
      loading.value = false
    }
  }

  /**
   * Crea la deuda y guarda el cronograma de cuotas en Supabase.
   * @param {Object} deuda      - Campos del formulario
   * @param {Array}  cuotas     - Cronograma generado por generarCronogramaFrances
   */
  async function addDeuda(deuda, cuotas = []) {
    if (!authStore.user) return
    loading.value = true
    try {
      // 1. Insertar la deuda
      const { data: deudaData, error: deudaError } = await supabase
        .from('deudas')
        .insert([{ ...deuda, user_id: authStore.user.id }])
        .select()
        .single()

      if (deudaError) throw deudaError

      // 2. Insertar las cuotas vinculadas
      if (cuotas.length > 0) {
        const cuotasPayload = cuotas.map(c => ({
          deuda_id: deudaData.id,
          numero: c.numero,
          fecha: c.fecha || null,
          capital: c.capital,
          interes: c.interes,
          total: c.total,
          capital_pendiente: c.capital_pendiente,
          pagada: c.pagada || false,
          modo: c.modo || 'calculado',
        }))

        const { error: cuotasError } = await supabase
          .from('cuotas')
          .insert(cuotasPayload)

        if (cuotasError) throw cuotasError

        // Guardar en caché local
        cuotasPorDeuda.value[deudaData.id] = cuotas.map((c, i) => ({
          ...c,
          id: null, // no tenemos el UUID aún, se cargará en fetchCuotas
          pagada: c.pagada || false,
        }))
      }

      deudas.value.unshift(deudaData)
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
      const { data, error } = await supabase
        .from('deudas')
        .update(updates)
        .eq('id', id)
        .select()
        .single()

      if (error) throw error
      const index = deudas.value.findIndex(d => d.id === id)
      if (index !== -1) {
        deudas.value[index] = data
      }
      return data
    } catch (error) {
      console.error('Error updating deuda:', error)
      throw error
    }
  }

  async function updateDeudaYCuotas(id, deudaUpdates, cuotas = []) {
    loading.value = true
    try {
      // 1. Update deuda
      const deudaData = await updateDeuda(id, deudaUpdates)

      // 2. Delete existing cuotas
      const { error: deleteError } = await supabase
        .from('cuotas')
        .delete()
        .eq('deuda_id', id)

      if (deleteError) throw deleteError

      // 3. Insert new cuotas
      if (cuotas.length > 0) {
        const cuotasPayload = cuotas.map(c => ({
          deuda_id: id,
          numero: c.numero,
          fecha: c.fecha || null,
          capital: c.capital,
          interes: c.interes,
          total: c.total,
          capital_pendiente: c.capital_pendiente,
          pagada: c.pagada || false,
          modo: c.modo || 'calculado',
        }))

        const { error: cuotasError } = await supabase
          .from('cuotas')
          .insert(cuotasPayload)

        if (cuotasError) throw cuotasError

        cuotasPorDeuda.value[id] = cuotas.map((c) => ({
          ...c,
          id: null,
          pagada: c.pagada || false,
        }))
      } else {
        cuotasPorDeuda.value[id] = []
      }

      return deudaData
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
  // Cuotas — Fetch y toggle
  // ---------------------------------------------------------------------------

  /**
   * Carga las cuotas de una deuda desde Supabase y las cachea localmente.
   */
  async function fetchCuotas(deudaId) {
    if (!authStore.user || !deudaId) return []
    try {
      const { data, error } = await supabase
        .from('cuotas')
        .select('*')
        .eq('deuda_id', deudaId)
        .order('numero', { ascending: true })

      if (error) throw error
      cuotasPorDeuda.value[deudaId] = data
      return data
    } catch (error) {
      console.error('Error fetching cuotas:', error)
      return []
    }
  }

  /**
   * Marca o desmarca una cuota como pagada.
   * También actualiza saldo_capital de la deuda padre y registra fecha_pago.
   */
  async function toggleCuotaPagada(cuota, deuda) {
    const nuevaPagada = !cuota.pagada
    const fechaPago = nuevaPagada ? new Date().toISOString().split('T')[0] : null
    try {
      const { error: cuotaError } = await supabase
        .from('cuotas')
        .update({ pagada: nuevaPagada, fecha_pago: fechaPago })
        .eq('id', cuota.id)

      if (cuotaError) throw cuotaError

      // Actualizar caché local
      const cuotas = cuotasPorDeuda.value[deuda.id] || []
      const idx = cuotas.findIndex(c => c.id === cuota.id)
      if (idx !== -1) {
        cuotas[idx] = { ...cuotas[idx], pagada: nuevaPagada, fecha_pago: fechaPago }
        cuotasPorDeuda.value[deuda.id] = [...cuotas]
      }

      // Recalcular saldo_capital = capital_pendiente de la última cuota pagada
      const cuotasActualizadas = cuotasPorDeuda.value[deuda.id] || []
      const ordenadas = [...cuotasActualizadas].sort((a, b) => a.numero - b.numero)
      const primeraPendiente = ordenadas.find(c => !c.pagada)
      let nuevoSaldo
      if (!primeraPendiente) {
        nuevoSaldo = 0
      } else {
        const idxPrimera = ordenadas.findIndex(c => c.id === primeraPendiente.id)
        if (idxPrimera === 0) {
          nuevoSaldo = Number(deuda.monto_original)
        } else {
          nuevoSaldo = Number(ordenadas[idxPrimera - 1].capital_pendiente)
        }
      }

      await updateDeuda(deuda.id, { saldo_capital: nuevoSaldo })

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
