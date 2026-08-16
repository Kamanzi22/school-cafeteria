import axios from 'axios'

const BACKEND = import.meta.env.VITE_BACKEND_URL || ''
const api = axios.create({ baseURL: `${BACKEND}/api`, timeout: 15000 })

const getToken = () => {
  try {
    const admin = JSON.parse(localStorage.getItem('cc-admin-v3') || '{}')
    const customer = JSON.parse(localStorage.getItem('cc-customer-v4') || '{}')
    const superadmin = JSON.parse(localStorage.getItem('cc-superadmin-v1') || '{}')
    return admin?.state?.token || customer?.state?.token || superadmin?.state?.token || null
  } catch { return null }
}

api.interceptors.request.use(cfg => {
  const token = getToken()
  if (token) cfg.headers.Authorization = `Bearer ${token}`
  return cfg
})

export const authAPI = {
  // Restaurant
  restaurantRegister: (d) => api.post('/auth/restaurant/register', d),
  restaurantLogin: (d) => api.post('/auth/restaurant/login', d),
  restaurantStaffLogin: (d) => api.post('/auth/restaurant/staff/login', d),
  changePassword: (d) => api.put('/auth/restaurant/password', d),
  // Customer
  customerRegister: (d) => api.post('/auth/customer/register', d),
  customerLogin: (d) => api.post('/auth/customer/login', d),
  guestSession: (d) => api.post('/auth/guest/session', d),
  // Super admin
  superAdminLogin: (d) => api.post('/auth/superadmin/login', d),
}

export const restaurantAPI = {
  list: () => api.get('/restaurants'),
  search: (q) => api.get('/restaurants/search', { params: { q } }),
  get: (id) => api.get(`/restaurants/${id}`),
  toggleOpen: () => api.patch('/restaurants/admin/toggle-open'),
  toggleAccepting: () => api.patch('/restaurants/admin/toggle-accepting'),
  updateSettings: (d) => api.put('/restaurants/admin/settings', d),
  deleteAccount: (d) => api.delete('/restaurants/admin/account', { data: d }),
  getReviews: (id) => api.get(`/restaurants/${id}/reviews`),
  replyReview: (reviewId, reply) => api.patch(`/restaurants/admin/reviews/${reviewId}/reply`, { reply }),
}

export const menuAPI = {
  search: (q) => api.get('/menu/search', { params: { q } }),
  list: () => api.get('/menu/admin'),
  create: (d) => api.post('/menu', d),
  update: (id, d) => api.put(`/menu/${id}`, d),
  delete: (id) => api.delete(`/menu/${id}`),
  toggleAvail: (id) => api.patch(`/menu/${id}/toggle-available`),
  toggleFeatured: (id) => api.patch(`/menu/${id}/toggle-featured`),
  createCategory: (d) => api.post('/menu/categories', d),
  updateCategory: (id, d) => api.put(`/menu/categories/${id}`, d),
  deleteCategory: (id) => api.delete(`/menu/categories/${id}`),
}

export const orderAPI = {
  place: (d) => api.post('/orders', d),
  get: (id) => api.get(`/orders/${id}`),
  customerHistory: (customerId) => api.get(`/orders/customer/${customerId}/history`),
  guestHistory: (guestToken) => api.get(`/orders/guest/${guestToken}/history`),
  restaurantOrders: (restaurantId, params) => api.get(`/orders/restaurant/${restaurantId}/all`, { params }),
  updateStatus: (id, d) => api.patch(`/orders/${id}/status`, d),
  cancel: (id, reason) => api.patch(`/orders/${id}/cancel`, { reason }),
}

export const customerAPI = {
  get: (id) => api.get(`/customers/${id}`),
  update: (id, d) => api.put(`/customers/${id}`, d),
  deleteGuest: (id) => api.delete(`/customers/${id}/guest`),
  favorite: (customerId, restaurantId) => api.post(`/customers/${customerId}/favorite/${restaurantId}`),
}

export const analyticsAPI = { salesReport: (range, params = {}) => api.get('/analytics/sales-report', { params: { range, ...params } }) }

export const promoAPI = {
  list: () => api.get('/promotions/admin'),
  create: (d) => api.post('/promotions', d),
  toggle: (id) => api.patch(`/promotions/${id}/toggle`),
  delete: (id) => api.delete(`/promotions/${id}`),
  validate: (d) => api.post('/promotions/validate', d),
}

export const reviewAPI = { create: (d) => api.post('/reviews', d) }

export const uploadAPI = {
  logo: (file) => { const fd = new FormData(); fd.append('file', file); return api.post('/upload', fd) }
}

export const superAdminAPI = {
  getRestaurants: () => api.get('/superadmin/restaurants'),
  toggleApprove: (id) => api.patch(`/superadmin/restaurants/${id}/approve`),
  deleteRestaurant: (id) => api.delete(`/superadmin/restaurants/${id}`),
  getStats: () => api.get('/superadmin/stats'),
  getViewToken: (id) => api.post(`/superadmin/restaurants/${id}/view-token`),
}

export default api
