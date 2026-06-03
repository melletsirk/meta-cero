import { defineStore } from 'pinia'
import { ref } from 'vue'

export const useNotificationsStore = defineStore('notifications', () => {
  const notifications = ref([])
  let nextId = 1

  const addNotification = (message, type = 'success', timeout = 4000) => {
    const id = nextId++
    notifications.value.push({ id, message, type })

    if (timeout > 0) {
      setTimeout(() => {
        removeNotification(id)
      }, timeout)
    }
  }

  const success = (message, timeout = 4000) => {
    addNotification(message, 'success', timeout)
  }

  const error = (message, timeout = 5000) => {
    addNotification(message, 'error', timeout)
  }

  const info = (message, timeout = 4000) => {
    addNotification(message, 'info', timeout)
  }

  const removeNotification = (id) => {
    const index = notifications.value.findIndex(n => n.id === id)
    if (index > -1) {
      notifications.value.splice(index, 1)
    }
  }

  return {
    notifications,
    addNotification,
    success,
    error,
    info,
    removeNotification
  }
})
