import axios from 'axios'
import type { NamespaceInfo, PodInfo, CostSummary, ComplianceReport, QuotaStatus } from '../types'

const http = axios.create({ baseURL: '/api' })

export const api = {
  getNamespaces: () =>
    http.get<{ namespaces: NamespaceInfo[]; total: number }>('/namespaces').then(r => r.data),

  getPods: (namespace?: string) =>
    http.get<{ pods: PodInfo[]; total: number }>('/pods', { params: namespace ? { namespace } : {} })
      .then(r => r.data),

  getCosts: () =>
    http.get<CostSummary>('/costs').then(r => r.data),

  getCompliance: () =>
    http.get<ComplianceReport>('/compliance').then(r => r.data),

  getQuotas: (namespace?: string) =>
    http.get<{ quotas: QuotaStatus[]; total: number }>('/quotas', { params: namespace ? { namespace } : {} })
      .then(r => r.data),

  healthCheck: () =>
    http.get<{ status: string }>('/health').then(r => r.data),
}
