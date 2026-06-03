<script setup>
import { useNotificationsStore } from '../stores/notifications'

const store = useNotificationsStore()
</script>

<template>
  <div class="fixed top-4 right-4 z-[100] flex flex-col gap-3 max-w-sm w-full pointer-events-none">
    <TransitionGroup name="toast">
      <div 
        v-for="notification in store.notifications" 
        :key="notification.id"
        class="pointer-events-auto flex items-start gap-3 p-4 rounded-xl shadow-lg border backdrop-blur-md transition-all"
        :class="{
          'bg-emerald-50/90 border-emerald-200 text-emerald-800 shadow-emerald-500/10': notification.type === 'success',
          'bg-red-50/90 border-red-200 text-red-800 shadow-red-500/10': notification.type === 'error',
          'bg-indigo-50/90 border-indigo-200 text-indigo-800 shadow-indigo-500/10': notification.type === 'info',
        }"
      >
        <!-- Icon -->
        <div class="shrink-0">
          <svg v-if="notification.type === 'success'" xmlns="http://www.w3.org/2000/svg" class="h-6 w-6 text-emerald-500" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
          </svg>
          <svg v-else-if="notification.type === 'error'" xmlns="http://www.w3.org/2000/svg" class="h-6 w-6 text-red-500" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M12 8v4m0 4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
          </svg>
          <svg v-else xmlns="http://www.w3.org/2000/svg" class="h-6 w-6 text-indigo-500" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
          </svg>
        </div>

        <!-- Message -->
        <div class="flex-1 text-sm font-semibold mt-0.5">
          {{ notification.message }}
        </div>

        <!-- Close Button -->
        <button @click="store.removeNotification(notification.id)" class="shrink-0 text-slate-400 hover:text-slate-600 transition-colors p-0.5 rounded-md hover:bg-black/5">
          <svg xmlns="http://www.w3.org/2000/svg" class="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M6 18L18 6M6 6l12 12" />
          </svg>
        </button>
      </div>
    </TransitionGroup>
  </div>
</template>

<style scoped>
.toast-enter-active,
.toast-leave-active {
  transition: all 0.4s cubic-bezier(0.4, 0, 0.2, 1);
}
.toast-enter-from {
  opacity: 0;
  transform: translateX(100%) scale(0.95);
}
.toast-leave-to {
  opacity: 0;
  transform: translateX(100%) scale(0.95);
}
.toast-move {
  transition: transform 0.4s ease;
}
</style>
