import { defineStore } from 'pinia'
import { ref, computed } from 'vue'
import { supabase } from '../lib/supabase'
import { useAuthStore } from './auth'

export const usePerfilStore = defineStore('perfil', () => {
  const authStore = useAuthStore()

  const perfil = ref(null)
  const loading = ref(false)
  const saving = ref(false)

  // ── Computed ────────────────────────────────────────────────
  /**
   * Dinero disponible para deudas después de gastos fijos.
   * Si el usuario no llenó los campos, retorna null.
   */
  const capacidadCalculada = computed(() => {
    if (!perfil.value) return null
    const ingreso = Number(perfil.value.ingreso_mensual || 0)
    const gasto = Number(perfil.value.gasto_mensual_fijo || 0)
    if (!ingreso) return null
    return Math.max(0, ingreso - gasto)
  })

  // ── Fetch ────────────────────────────────────────────────────
  async function fetchPerfil() {
    if (!authStore.user) return
    loading.value = true
    try {
      const { data, error } = await supabase
        .from('perfiles_usuario')
        .select('*')
        .eq('user_id', authStore.user.id)
        .single()

      if (error && error.code !== 'PGRST116') {
        // PGRST116 = no rows found (perfil aún no creado)
        throw error
      }

      perfil.value = data || null
    } catch (err) {
      console.error('Error fetching perfil:', err)
    } finally {
      loading.value = false
    }
  }

  // ── Upsert ───────────────────────────────────────────────────
  async function savePerfil(updates) {
    if (!authStore.user) return
    saving.value = true
    try {
      const payload = {
        user_id: authStore.user.id,
        ...updates,
        // Calcular capacidad_pago_mensual automáticamente si hay datos
        capacidad_pago_mensual:
          updates.ingreso_mensual && updates.gasto_mensual_fijo !== undefined
            ? Math.max(0, Number(updates.ingreso_mensual) - Number(updates.gasto_mensual_fijo || 0))
            : updates.capacidad_pago_mensual ?? perfil.value?.capacidad_pago_mensual ?? null
      }

      const { data, error } = await supabase
        .from('perfiles_usuario')
        .upsert(payload, { onConflict: 'user_id' })
        .select()
        .single()

      if (error) throw error
      perfil.value = data
      return data
    } catch (err) {
      console.error('Error saving perfil:', err)
      throw err
    } finally {
      saving.value = false
    }
  }

  return {
    perfil,
    loading,
    saving,
    capacidadCalculada,
    fetchPerfil,
    savePerfil,
  }
})
