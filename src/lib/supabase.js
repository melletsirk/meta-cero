import { createClient } from '@supabase/supabase-js'

let supabaseUrl = import.meta.env.VITE_SUPABASE_URL || 'https://placeholder.supabase.co'
const supabaseAnonKey = import.meta.env.VITE_SUPABASE_ANON_KEY || 'placeholder_key'

// Validar que la URL tenga el formato correcto para no crashear la app entera
if (!supabaseUrl.startsWith('http')) {
  console.error('⚠️ ERROR CRÍTICO: La URL de Supabase en tu archivo .env no es válida. Asegúrate de que empiece con "https://"')
  // Usamos una URL temporal válida para que la UI al menos cargue y pueda mostrar errores
  supabaseUrl = 'https://placeholder.supabase.co'
}

if (supabaseUrl === 'https://placeholder.supabase.co') {
  console.warn('⚠️ Usando credenciales de Supabase de prueba. Verifica tu archivo .env')
}

export const supabase = createClient(supabaseUrl, supabaseAnonKey)
