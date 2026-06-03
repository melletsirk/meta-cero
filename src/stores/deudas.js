import { defineStore } from 'pinia'
import { ref, computed } from 'vue'
import { supabase } from '../lib/supabase'
import { useAuthStore } from './auth'

export const useDeudasStore = defineStore('deudas', () => {
  const deudas = ref([])
  const loading = ref(false)
  const authStore = useAuthStore()

  // Computed properties para el dashboard
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
    // Esto es un ejemplo, se ordenaría basado en el día_vencimiento respecto a hoy
    return [...deudasActivas.value].sort((a, b) => {
      return (a.dia_vencimiento || 31) - (b.dia_vencimiento || 31)
    })
  })

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

  async function addDeuda(deuda) {
    if (!authStore.user) return
    loading.value = true
    try {
      const { data, error } = await supabase
        .from('deudas')
        .insert([{ ...deuda, user_id: authStore.user.id }])
        .select()
        .single()
      
      if (error) throw error
      deudas.value.unshift(data)
      return data
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
    } catch (error) {
      console.error('Error deleting deuda:', error)
      throw error
    }
  }

  return { 
    deudas, 
    loading, 
    deudaTotal, 
    cuotaTotalMes, 
    deudasActivas,
    proximosVencimientos,
    fetchDeudas, 
    addDeuda, 
    updateDeuda, 
    deleteDeuda 
  }
})
