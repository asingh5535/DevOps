import axios, { type AxiosInstance } from 'axios'
import { useAuthStore } from '@/store/auth'
import type {
  Cluster, ConnectorTypeInfo, DashboardSummary, KeyResult, MetricSample, MetricSpec, Objective,
} from '@/types'

const BASE_URL = import.meta.env.VITE_API_URL ?? '/api'

function createClient(): AxiosInstance {
  const client = axios.create({ baseURL: BASE_URL })

  client.interceptors.request.use((config) => {
    const token = useAuthStore.getState().token
    if (token) config.headers.Authorization = `Bearer ${token}`
    return config
  })

  client.interceptors.response.use(
    (r) => r,
    (err) => {
      if (err.response?.status === 401) {
        useAuthStore.getState().logout()
        window.location.href = '/login'
      }
      return Promise.reject(err)
    }
  )

  return client
}

export const api = createClient()

export const authApi = {
  login: (username: string, password: string) =>
    api.post<{ token: string; username: string }>('/auth/login', { username, password }),
}

export const connectorApi = {
  listTypes: () => api.get<ConnectorTypeInfo[]>('/connectors/types'),
  listMetrics: (type: string) => api.get<MetricSpec[]>(`/connectors/${type}/metrics`),
}

export const clusterApi = {
  list: () => api.get<Cluster[]>('/clusters'),
  create: (data: {
    name: string; type: string; host: string; port: number
    username?: string; password?: string; extra?: Record<string, string>
  }) => api.post<Cluster>('/clusters', data),
  remove: (id: string) => api.delete(`/clusters/${id}`),
  test: (id: string) => api.post<{ ok: boolean; error?: string }>(`/clusters/${id}/test`),
}

export const objectiveApi = {
  list: () => api.get<Objective[]>('/objectives'),
  get: (id: string) => api.get<Objective>(`/objectives/${id}`),
  create: (data: { title: string; description?: string; owner?: string; team?: string; quarter?: string }) =>
    api.post<Objective>('/objectives', data),
  update: (id: string, data: { title: string; description?: string; owner?: string; team?: string; quarter?: string }) =>
    api.patch<Objective>(`/objectives/${id}`, data),
  remove: (id: string) => api.delete(`/objectives/${id}`),
}

export const keyResultApi = {
  create: (objectiveId: string, data: {
    title: string; clusterId: string; metricKey: string
    comparator: 'lt' | 'lte' | 'gt' | 'gte'; baselineValue: number; targetValue: number; unit?: string
  }) => api.post<KeyResult>(`/objectives/${objectiveId}/key-results`, data),
  remove: (id: string) => api.delete(`/key-results/${id}`),
  evaluate: (id: string) => api.post<KeyResult & { ok?: boolean; error?: string }>(`/key-results/${id}/evaluate`),
  history: (id: string) => api.get<MetricSample[]>(`/key-results/${id}/history`),
}

export const dashboardApi = {
  summary: () => api.get<DashboardSummary>('/dashboard/summary'),
}
