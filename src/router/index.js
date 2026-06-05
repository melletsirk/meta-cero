import { createRouter, createWebHistory } from 'vue-router'
import { useAuthStore } from '../stores/auth'

import Dashboard from '../views/Dashboard.vue'
import Login from '../views/Login.vue'
import DeudaForm from '../views/DeudaForm.vue'
import DeudaDetalle from '../views/DeudaDetalle.vue'
import CalendarioMensual from '../views/CalendarioMensual.vue'

const routes = [
  {
    path: '/',
    name: 'Dashboard',
    component: Dashboard,
    meta: { requiresAuth: true }
  },
  {
    path: '/login',
    name: 'Login',
    component: Login,
    meta: { requiresGuest: true }
  },
  {
    path: '/deudas/nueva',
    name: 'NuevaDeuda',
    component: DeudaForm,
    meta: { requiresAuth: true }
  },
  {
    path: '/deudas/:id',
    name: 'DeudaDetalle',
    component: DeudaDetalle,
    meta: { requiresAuth: true }
  },
  {
    path: '/calendario',
    name: 'CalendarioMensual',
    component: CalendarioMensual,
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
