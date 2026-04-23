import axios, { type AxiosInstance } from 'axios'
import { useAuthStore } from '@/store/auth'

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

// ── Auth ──────────────────────────────────────────────────────────────────────

export const authApi = {
  login: (data: { auth_type: string; server_url?: string; token?: string; kubeconfig_b64?: string }) =>
    api.post('/auth/login', data),
  verify: () => api.get('/auth/verify'),
}

// ── Cluster ───────────────────────────────────────────────────────────────────

export const clusterApi = {
  overview: () => api.get('/cluster/overview'),
  listNamespaces: () => api.get('/namespaces'),
  getNamespace: (name: string) => api.get(`/namespaces/${name}`),
  listNodes: () => api.get('/nodes'),
  getNode: (name: string) => api.get(`/nodes/${name}`),
}

// ── Workloads ─────────────────────────────────────────────────────────────────

export const workloadApi = {
  // Deployments
  listDeployments: (namespace?: string, labelSelector?: string) =>
    api.get('/deployments', { params: { namespace, labelSelector } }),
  getDeployment: (namespace: string, name: string) =>
    api.get(`/deployments/${namespace}/${name}`),
  createDeployment: (data: unknown) => api.post('/deployments', data),
  updateDeployment: (namespace: string, name: string, data: unknown) =>
    api.put(`/deployments/${namespace}/${name}`, data),
  deleteDeployment: (namespace: string, name: string) =>
    api.delete(`/deployments/${namespace}/${name}`),
  scaleDeployment: (namespace: string, name: string, replicas: number) =>
    api.post(`/deployments/${namespace}/${name}/scale`, { replicas }),
  restartDeployment: (namespace: string, name: string) =>
    api.post(`/deployments/${namespace}/${name}/restart`),

  // StatefulSets
  listStatefulSets: (namespace?: string) =>
    api.get('/statefulsets', { params: { namespace } }),
  getStatefulSet: (namespace: string, name: string) =>
    api.get(`/statefulsets/${namespace}/${name}`),
  deleteStatefulSet: (namespace: string, name: string) =>
    api.delete(`/statefulsets/${namespace}/${name}`),

  // DaemonSets
  listDaemonSets: (namespace?: string) =>
    api.get('/daemonsets', { params: { namespace } }),
  getDaemonSet: (namespace: string, name: string) =>
    api.get(`/daemonsets/${namespace}/${name}`),

  // ReplicaSets
  listReplicaSets: (namespace?: string) =>
    api.get('/replicasets', { params: { namespace } }),

  // Pods
  listPods: (namespace?: string, labelSelector?: string) =>
    api.get('/pods', { params: { namespace, labelSelector } }),
  getPod: (namespace: string, name: string) =>
    api.get(`/pods/${namespace}/${name}`),
  deletePod: (namespace: string, name: string) =>
    api.delete(`/pods/${namespace}/${name}`),
  listContainers: (namespace: string, name: string) =>
    api.get(`/pods/${namespace}/${name}/containers`),
  getLogs: (namespace: string, name: string, params?: { container?: string; tail?: number; previous?: boolean }) =>
    api.get(`/pods/${namespace}/${name}/logs`, { params }),

  // Jobs
  listJobs: (namespace?: string) => api.get('/jobs', { params: { namespace } }),
  getJob: (namespace: string, name: string) => api.get(`/jobs/${namespace}/${name}`),
  createJob: (data: unknown) => api.post('/jobs', data),
  deleteJob: (namespace: string, name: string) => api.delete(`/jobs/${namespace}/${name}`),

  // CronJobs
  listCronJobs: (namespace?: string) => api.get('/cronjobs', { params: { namespace } }),
  getCronJob: (namespace: string, name: string) =>
    api.get(`/cronjobs/${namespace}/${name}`),
  deleteCronJob: (namespace: string, name: string) =>
    api.delete(`/cronjobs/${namespace}/${name}`),

  // Generic apply
  applyYAML: (yaml: string) =>
    api.post('/apply', yaml, { headers: { 'Content-Type': 'application/x-yaml' } }),
}

// ── Services ──────────────────────────────────────────────────────────────────

export const serviceApi = {
  listServices: (namespace?: string) => api.get('/services', { params: { namespace } }),
  getService: (namespace: string, name: string) =>
    api.get(`/services/${namespace}/${name}`),
  createService: (data: unknown) => api.post('/services', data),
  deleteService: (namespace: string, name: string) =>
    api.delete(`/services/${namespace}/${name}`),

  listIngresses: (namespace?: string) => api.get('/ingresses', { params: { namespace } }),
  getIngress: (namespace: string, name: string) =>
    api.get(`/ingresses/${namespace}/${name}`),
  createIngress: (data: unknown) => api.post('/ingresses', data),
  deleteIngress: (namespace: string, name: string) =>
    api.delete(`/ingresses/${namespace}/${name}`),

  listNetworkPolicies: (namespace?: string) =>
    api.get('/networkpolicies', { params: { namespace } }),
  deleteNetworkPolicy: (namespace: string, name: string) =>
    api.delete(`/networkpolicies/${namespace}/${name}`),

  listEndpoints: (namespace?: string) => api.get('/endpoints', { params: { namespace } }),
}

// ── Config & Storage ──────────────────────────────────────────────────────────

export const configApi = {
  listConfigMaps: (namespace?: string) => api.get('/configmaps', { params: { namespace } }),
  getConfigMap: (namespace: string, name: string) =>
    api.get(`/configmaps/${namespace}/${name}`),
  createConfigMap: (data: unknown) => api.post('/configmaps', data),
  updateConfigMap: (namespace: string, name: string, data: unknown) =>
    api.put(`/configmaps/${namespace}/${name}`, data),
  deleteConfigMap: (namespace: string, name: string) =>
    api.delete(`/configmaps/${namespace}/${name}`),

  listSecrets: (namespace?: string) => api.get('/secrets', { params: { namespace } }),
  getSecret: (namespace: string, name: string, reveal?: boolean) =>
    api.get(`/secrets/${namespace}/${name}`, { params: { reveal } }),
  revealSecretKey: (namespace: string, name: string, key: string) =>
    api.get(`/secrets/${namespace}/${name}/keys/${key}`),
  createSecret: (data: unknown) => api.post('/secrets', data),
  deleteSecret: (namespace: string, name: string) =>
    api.delete(`/secrets/${namespace}/${name}`),

  listPVs: () => api.get('/persistentvolumes'),
  deletePV: (name: string) => api.delete(`/persistentvolumes/${name}`),

  listPVCs: (namespace?: string) =>
    api.get('/persistentvolumeclaims', { params: { namespace } }),
  createPVC: (data: unknown) => api.post('/persistentvolumeclaims', data),
  deletePVC: (namespace: string, name: string) =>
    api.delete(`/persistentvolumeclaims/${namespace}/${name}`),

  listStorageClasses: () => api.get('/storageclasses'),
  deleteStorageClass: (name: string) => api.delete(`/storageclasses/${name}`),
}

// ── RBAC ──────────────────────────────────────────────────────────────────────

export const rbacApi = {
  listClusterRoles: () => api.get('/clusterroles'),
  getClusterRole: (name: string) => api.get(`/clusterroles/${name}`),
  createClusterRole: (data: unknown) => api.post('/clusterroles', data),
  deleteClusterRole: (name: string) => api.delete(`/clusterroles/${name}`),

  listRoles: (namespace?: string) => api.get('/roles', { params: { namespace } }),
  getRole: (namespace: string, name: string) => api.get(`/roles/${namespace}/${name}`),
  createRole: (data: unknown) => api.post('/roles', data),
  deleteRole: (namespace: string, name: string) =>
    api.delete(`/roles/${namespace}/${name}`),

  listClusterRoleBindings: () => api.get('/clusterrolebindings'),
  createClusterRoleBinding: (data: unknown) => api.post('/clusterrolebindings', data),
  deleteClusterRoleBinding: (name: string) => api.delete(`/clusterrolebindings/${name}`),

  listRoleBindings: (namespace?: string) =>
    api.get('/rolebindings', { params: { namespace } }),
  createRoleBinding: (data: unknown) => api.post('/rolebindings', data),
  deleteRoleBinding: (namespace: string, name: string) =>
    api.delete(`/rolebindings/${namespace}/${name}`),

  listServiceAccounts: (namespace?: string) =>
    api.get('/serviceaccounts', { params: { namespace } }),
  deleteServiceAccount: (namespace: string, name: string) =>
    api.delete(`/serviceaccounts/${namespace}/${name}`),
}

// ── CRDs ──────────────────────────────────────────────────────────────────────

export const crdApi = {
  listCRDs: () => api.get('/crds'),
  getCRD: (name: string) => api.get(`/crds/${name}`),
  deleteCRD: (name: string) => api.delete(`/crds/${name}`),
  listCustomResources: (group: string, version: string, resource: string, namespace?: string) =>
    api.get(`/cr/${group}/${version}/${resource}`, { params: { namespace } }),
  deleteCustomResource: (group: string, version: string, resource: string, namespace: string, name: string) =>
    api.delete(`/cr/${group}/${version}/${resource}/${namespace}/${name}`),
}

// ── Events ────────────────────────────────────────────────────────────────────

export const eventApi = {
  listEvents: (namespace?: string) => api.get('/events', { params: { namespace } }),
  listEventsForResource: (namespace: string, kind?: string, name?: string) =>
    api.get(`/events/${namespace}`, { params: { kind, name } }),
}

// ── WebSocket helpers ─────────────────────────────────────────────────────────

export function buildWSUrl(path: string, params?: Record<string, string>): string {
  const token = useAuthStore.getState().token
  const wsBase = (import.meta.env.VITE_WS_URL ?? window.location.origin.replace(/^http/, 'ws')) + '/api'
  const url = new URL(wsBase + path)
  if (token) url.searchParams.set('token', token)
  if (params) Object.entries(params).forEach(([k, v]) => url.searchParams.set(k, v))
  return url.toString()
}
