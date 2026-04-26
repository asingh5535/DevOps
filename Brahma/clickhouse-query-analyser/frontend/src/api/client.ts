import axios from 'axios'

const api = axios.create({ baseURL: '/api', timeout: 30000 })

export interface Cluster {
  id: string
  name: string
  type: 'kubernetes' | 'standalone'
  host: string
  port: number
  user: string
  database: string
  k8s_namespace?: string
  k8s_service?: string
  description?: string
  status?: string
  reachable?: boolean
  server_info?: { hostname: string; version: string; uptime: number }
  error?: string
}

export interface SlowQuery {
  query_id: string
  user: string
  query: string
  event_time: string
  duration_sec: number
  read_rows: number
  read_size: string
  memory: string
  exception: string
}

export interface FullScan {
  query: string
  duration_sec: number
  read_rows: number
  bytes_read: string
}

export interface MemoryHog {
  query_id: string
  query: string
  memory: string
  duration_sec: number
}

export interface ClusterStats {
  cluster_id: string
  cluster_name: string
  total_queries: number
  slow_queries: number
  full_scans: number
  memory_hogs: number
  avg_duration_sec: number
  max_duration_sec: number
  hours: number
}

export interface OptimizationPattern {
  id: string
  title: string
  why: string
  severity: 'critical' | 'high' | 'medium'
  bad: string
  good: string
}

export const clustersApi = {
  list: () => api.get<{ clusters: Cluster[]; total: number }>('/clusters'),
  health: (id: string) => api.get<Cluster>(`/clusters/${id}/health`),
  add: (data: Partial<Cluster>) => api.post('/clusters', data),
  remove: (id: string) => api.delete(`/clusters/${id}`),
}

export const queriesApi = {
  slowQueries: (id: string, params?: { duration_ms?: number; hours?: number; limit?: number }) =>
    api.get<{ queries: SlowQuery[]; total: number }>(`/clusters/${id}/slow-queries`, { params }),
  fullScans: (id: string, params?: { hours?: number; limit?: number }) =>
    api.get<{ queries: FullScan[]; total: number }>(`/clusters/${id}/full-scans`, { params }),
  memoryHogs: (id: string, params?: { hours?: number; limit?: number }) =>
    api.get<{ queries: MemoryHog[]; total: number }>(`/clusters/${id}/memory-hogs`, { params }),
  stats: (id: string, hours?: number) =>
    api.get<ClusterStats>(`/clusters/${id}/stats`, { params: { hours } }),
  explain: (id: string, query: string, mode: string) =>
    api.post<{ lines: string[]; mode: string }>(`/clusters/${id}/explain`, { query, mode }),
  runQuery: (id: string, query: string) =>
    api.post<{ rows: any[]; columns: string[]; total: number }>(`/clusters/${id}/query`, { query }),
}

export const reportsApi = {
  daily: () => api.get('/reports/daily'),
  schedule: () => api.get<{ schedule: any[] }>('/reports/schedule'),
  patterns: () => api.get<{ patterns: OptimizationPattern[] }>('/optimization/patterns'),
  checklist: () => api.get<{ checklist: { id: number; item: string }[] }>('/optimization/checklist'),
}

export default api
