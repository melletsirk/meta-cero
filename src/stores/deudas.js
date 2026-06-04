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
  const deudaTotal = computed(() =>
    deudas.value.reduce((acc, deuda) => acc + Number(deuda.monto_pendiente), 0)
  )

  const cuotaTotalMes = computed(() =>
    deudas.value.reduce((acc, deuda) => acc + (Number(deuda.monto_cuota) || 0), 0)
  )

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
        .select('*')
        .order('created_at', { ascending: false })

      if (error) throw error
      deudas.value = data
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
          fecha: c.fecha,
          capital: c.capital,
          interes: c.interes,
          seguro: c.seguro,
          total: c.total,
          saldo_pendiente: c.saldo_pendiente,
          pagada: false,
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
          pagada: false,
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
   * También actualiza monto_pendiente de la deuda padre.
   */
  async function toggleCuotaPagada(cuota, deuda) {
    const nuevaPagada = !cuota.pagada
    try {
      const { error: cuotaError } = await supabase
        .from('cuotas')
        .update({ pagada: nuevaPagada })
        .eq('id', cuota.id)

      if (cuotaError) throw cuotaError

      // Actualizar caché local
      const cuotas = cuotasPorDeuda.value[deuda.id] || []
      const idx = cuotas.findIndex(c => c.id === cuota.id)
      if (idx !== -1) {
        cuotas[idx] = { ...cuotas[idx], pagada: nuevaPagada }
        cuotasPorDeuda.value[deuda.id] = [...cuotas]
      }

      // Recalcular monto_pendiente = saldo_pendiente de la primera cuota sin pagar
      // Eso equivale al capital restante que aún debe amortizarse.
      const cuotasActualizadas = cuotasPorDeuda.value[deuda.id] || []
      const ordenadas = [...cuotasActualizadas].sort((a, b) => a.numero - b.numero)
      const primeraPendiente = ordenadas.find(c => !c.pagada)
      // Si hay cuotas pendientes, el saldo es el saldo_pendiente de la cuota ANTERIOR a la primera pendiente
      // (o el monto original si ninguna fue pagada aún)
      let nuevoSaldo
      if (!primeraPendiente) {
        // Todas pagadas
        nuevoSaldo = 0
      } else {
        const idxPrimera = ordenadas.findIndex(c => c.id === primeraPendiente.id)
        if (idxPrimera === 0) {
          // Ninguna pagada — restaurar monto original
          nuevoSaldo = Number(deuda.monto_original)
        } else {
          // El saldo correcto es el saldo_pendiente de la última cuota pagada
          nuevoSaldo = Number(ordenadas[idxPrimera - 1].saldo_pendiente)
        }
      }

      await updateDeuda(deuda.id, { monto_pendiente: nuevoSaldo })

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
    deleteDeuda,
    fetchCuotas,
    toggleCuotaPagada,
  }
})
