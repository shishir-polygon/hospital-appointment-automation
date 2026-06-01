import axios from 'axios'
import Cookies from 'js-cookie'

const API_URL = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:8000/api/v1'

export const api = axios.create({
  baseURL: API_URL,
  headers: { 'Content-Type': 'application/json' },
})

api.interceptors.request.use((config) => {
  const token = Cookies.get('token')
  if (token) config.headers.Authorization = `Bearer ${token}`
  return config
})

api.interceptors.response.use(
  (res) => res,
  (err) => {
    if (err.response?.status === 401) {
      Cookies.remove('token')
      window.location.href = '/auth/login'
    }
    return Promise.reject(err)
  }
)

// Auth
export const login = (email: string, password: string) =>
  api.post('/auth/login', { email, password }).then((r) => r.data)

export const getMe = () => api.get('/auth/me').then((r) => r.data)
export const updateProfile = (data: object) => api.put('/auth/profile', data).then((r) => r.data)

// Analytics
export const getDashboard = () => api.get('/analytics/dashboard').then((r) => r.data)
export const getCallTrends = (days = 7) => api.get(`/analytics/call-trends?days=${days}`).then((r) => r.data)
export const getTopDoctors = () => api.get('/analytics/top-doctors').then((r) => r.data)
export const getPeakHours = () => api.get('/analytics/peak-hours').then((r) => r.data)

// Hospitals
export const getHospitals = (params?: object) => api.get('/hospitals', { params }).then((r) => r.data)
export const getHospital = (id: number) => api.get(`/hospitals/${id}`).then((r) => r.data)
export const createHospital = (data: object) => api.post('/hospitals', data).then((r) => r.data)
export const updateHospital = (id: number, data: object) => api.put(`/hospitals/${id}`, data).then((r) => r.data)
export const updateHospitalAdmin = (id: number, data: object) => api.put(`/hospitals/${id}/admin`, data).then((r) => r.data)

// Doctors
export const getDoctors = (params?: object) => api.get('/doctors', { params }).then((r) => r.data)
export const getDoctor = (id: number) => api.get(`/doctors/${id}`).then((r) => r.data)
export const createDoctor = (data: object) => api.post('/doctors', data).then((r) => r.data)
export const updateDoctor = (id: number, data: object) => api.put(`/doctors/${id}`, data).then((r) => r.data)
export const getDoctorQueue = (id: number) => api.get(`/doctors/${id}/queue`).then((r) => r.data)
export const getDoctorSlots = (id: number, date: string) =>
  api.get(`/doctors/${id}/slots?date=${date}`).then((r) => r.data)

// Appointments
export const getAppointments = (params?: object) => api.get('/appointments', { params }).then((r) => r.data)
export const createAppointment = (data: object) => api.post('/appointments', data).then((r) => r.data)
export const updateAppointment = (id: number, data: object) => api.put(`/appointments/${id}`, data).then((r) => r.data)
export const getTodayStats = () => api.get('/appointments-today-stats').then((r) => r.data)

// Call Logs
export const getCallLogs = (params?: object) => api.get('/call-logs', { params }).then((r) => r.data)
export const getCallLog = (id: number) => api.get(`/call-logs/${id}`).then((r) => r.data)
