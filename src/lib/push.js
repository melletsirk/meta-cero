import { supabase } from './supabase'

const VAPID_PUBLIC_KEY = 'BKaK8L3Kq6oQuuJGZBgb9vfXa10AKIraOFf3OQLgV8YK2x69tFYcXrxRZsxbM1OaUPW291aD1hDXaqyUvhGkhQY'

function urlBase64ToUint8Array(base64String) {
  const padding = '='.repeat((4 - base64String.length % 4) % 4)
  const base64 = (base64String + padding)
    .replace(/\-/g, '+')
    .replace(/_/g, '/')

  const rawData = window.atob(base64)
  const outputArray = new Uint8Array(rawData.length)

  for (let i = 0; i < rawData.length; ++i) {
    outputArray[i] = rawData.charCodeAt(i)
  }
  return outputArray
}

export async function registerAndSubscribePush() {
  if (!('serviceWorker' in navigator) || !('PushManager' in window)) {
    console.warn('Push notifications no soportadas')
    return null
  }

  try {
    // 1. Registrar Service Worker
    const registration = await navigator.serviceWorker.register('/sw.js')
    
    // 2. Esperar a que esté listo
    await navigator.serviceWorker.ready

    // 3. Suscribirse a Push
    let subscription = await registration.pushManager.getSubscription()
    if (!subscription) {
      subscription = await registration.pushManager.subscribe({
        userVisibleOnly: true,
        applicationServerKey: urlBase64ToUint8Array(VAPID_PUBLIC_KEY)
      })
    }

    // 4. Guardar en Supabase
    const { data: { user } } = await supabase.auth.getUser()
    if (user) {
      await supabase
        .from('push_subscriptions')
        .upsert({
          user_id: user.id,
          endpoint: subscription.endpoint,
          auth_key: btoa(String.fromCharCode.apply(null, new Uint8Array(subscription.getKey('auth')))),
          p256dh_key: btoa(String.fromCharCode.apply(null, new Uint8Array(subscription.getKey('p256dh'))))
        }, { onConflict: 'endpoint' })
    }

    return subscription
  } catch (err) {
    console.error('Error suscribiéndose a Push:', err)
    return null
  }
}
