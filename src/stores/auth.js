import { defineStore } from 'pinia'
import { ref } from 'vue'
import { supabase } from '../lib/supabase'

export const useAuthStore = defineStore('auth', () => {
  const user = ref(null)
  const initialized = ref(false)

  async function init() {
    if (initialized.value) return
    const { data } = await supabase.auth.getSession()
    user.value = data.session?.user || null
    
    supabase.auth.onAuthStateChange((event, session) => {
      user.value = session?.user || null
    })
    
    initialized.value = true
  }

  async function signIn(email, password) {
    const { data, error } = await supabase.auth.signInWithPassword({ email, password })
    if (error) throw error
    user.value = data.user
    return data
  }

  async function signUp(email, password, nombre) {
    const { data, error } = await supabase.auth.signUp({ 
      email, 
      password,
      options: {
        data: {
          full_name: nombre
        }
      }
    })
    if (error) throw error
    return data
  }

  async function signOut() {
    const { error } = await supabase.auth.signOut()
    if (error) throw error
    user.value = null
  }

  return { user, initialized, init, signIn, signUp, signOut }
})
