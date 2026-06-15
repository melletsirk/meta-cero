import { createRouter, createWebHistory } from 'vue-router'
import { useAuthStore } from '../stores/auth'

const routes = [
  {
    path: '/',
    name: 'Dashboard',
    component: () => import('../views/Dashboard.vue'),
    meta: { requiresAuth: true }
  },
  {
    path: '/login',
    name: 'Login',
    component: () => import('../views/Login.vue'),
    meta: { requiresGuest: true }
  },
  {
    path: '/deudas/nueva',
    name: 'NuevaDeuda',
    component: () => import('../views/DeudaForm.vue'),
    meta: { requiresAuth: true }
  },
  {
    path: '/deudas/:id/editar',
    name: 'EditarDeuda',
    component: () => import('../views/DeudaForm.vue'),
    meta: { requiresAuth: true }
  },
  {
    path: '/deudas/:id',
    name: 'DeudaDetalle',
    component: () => import('../views/DeudaDetalle.vue'),
    meta: { requiresAuth: true }
  },
  {
    path: '/calendario',
    name: 'CalendarioMensual',
    component: () => import('../views/CalendarioMensual.vue'),
    meta: { requiresAuth: true }
  },
]

const router = createRouter({
  history: createWebHistory(),
  routes
})

router.beforeEach(async (to, from, next) => {
  const authStore = useAuthStore()
  
  if (!authStore.initialized) {
    await authStore.init()
  }

  const isAuthenticated = !!authStore.user

  if (to.meta.requiresAuth && !isAuthenticated) {
    next('/login')
  } else if (to.meta.requiresGuest && isAuthenticated) {
    next('/')
  } else {
    next()
  }
})

export default router
