// Kubernetes resource types matching the Go API responses

export interface KubeMetadata {
  name: string
  namespace?: string
  uid?: string
  resourceVersion?: string
  creationTimestamp?: string
  labels?: Record<string, string>
  annotations?: Record<string, string>
  ownerReferences?: OwnerReference[]
  finalizers?: string[]
}

export interface OwnerReference {
  apiVersion: string
  kind: string
  name: string
  uid: string
  controller?: boolean
}

export interface KubeResource {
  apiVersion?: string
  kind?: string
  metadata: KubeMetadata
}

export interface KubeList<T> {
  apiVersion: string
  kind: string
  items: T[]
  metadata?: {
    resourceVersion?: string
    continue?: string
  }
}

// ── Workloads ─────────────────────────────────────────────────────────────────

export interface PodStatus {
  phase?: 'Pending' | 'Running' | 'Succeeded' | 'Failed' | 'Unknown'
  conditions?: Array<{ type: string; status: string; reason?: string }>
  containerStatuses?: ContainerStatus[]
  initContainerStatuses?: ContainerStatus[]
  podIP?: string
  podIPs?: Array<{ ip: string }>
  hostIP?: string
  startTime?: string
  message?: string
  reason?: string
}

export interface ContainerStatus {
  name: string
  ready: boolean
  restartCount: number
  image: string
  state?: {
    running?: { startedAt: string }
    waiting?: { reason: string; message?: string }
    terminated?: { reason: string; exitCode: number; finishedAt: string }
  }
}

export interface Container {
  name: string
  image: string
  ports?: Array<{ containerPort: number; protocol?: string; name?: string }>
  env?: Array<{ name: string; value?: string; valueFrom?: unknown }>
  resources?: {
    requests?: { cpu?: string; memory?: string }
    limits?: { cpu?: string; memory?: string }
  }
  volumeMounts?: Array<{ name: string; mountPath: string; readOnly?: boolean }>
  readinessProbe?: unknown
  livenessProbe?: unknown
}

export interface Pod extends KubeResource {
  spec?: {
    containers: Container[]
    initContainers?: Container[]
    nodeName?: string
    serviceAccountName?: string
    restartPolicy?: string
    volumes?: unknown[]
  }
  status?: PodStatus
}

export interface DeploymentStatus {
  replicas?: number
  readyReplicas?: number
  availableReplicas?: number
  updatedReplicas?: number
  unavailableReplicas?: number
  conditions?: Array<{ type: string; status: string; reason?: string; message?: string }>
}

export interface Deployment extends KubeResource {
  spec?: {
    replicas?: number
    selector?: { matchLabels?: Record<string, string> }
    template?: unknown
    strategy?: unknown
  }
  status?: DeploymentStatus
}

export interface StatefulSet extends KubeResource {
  spec?: {
    replicas?: number
    serviceName?: string
    selector?: { matchLabels?: Record<string, string> }
  }
  status?: {
    replicas?: number
    readyReplicas?: number
    currentReplicas?: number
    updatedReplicas?: number
  }
}

export interface DaemonSet extends KubeResource {
  spec?: { selector?: { matchLabels?: Record<string, string> } }
  status?: {
    desiredNumberScheduled?: number
    numberReady?: number
    numberAvailable?: number
    numberUnavailable?: number
  }
}

export interface Job extends KubeResource {
  spec?: {
    completions?: number
    parallelism?: number
    backoffLimit?: number
  }
  status?: {
    active?: number
    succeeded?: number
    failed?: number
    completionTime?: string
    startTime?: string
    conditions?: Array<{ type: string; status: string }>
  }
}

export interface CronJob extends KubeResource {
  spec?: {
    schedule: string
    suspend?: boolean
    jobTemplate?: unknown
    successfulJobsHistoryLimit?: number
    failedJobsHistoryLimit?: number
  }
  status?: {
    lastScheduleTime?: string
    lastSuccessfulTime?: string
    active?: Array<{ name: string; namespace: string }>
  }
}

// ── Services & Networking ─────────────────────────────────────────────────────

export interface Service extends KubeResource {
  spec?: {
    type?: 'ClusterIP' | 'NodePort' | 'LoadBalancer' | 'ExternalName'
    selector?: Record<string, string>
    ports?: Array<{
      name?: string
      port: number
      targetPort?: number | string
      nodePort?: number
      protocol?: string
    }>
    clusterIP?: string
    externalIPs?: string[]
    loadBalancerIP?: string
  }
  status?: {
    loadBalancer?: {
      ingress?: Array<{ ip?: string; hostname?: string }>
    }
  }
}

export interface Ingress extends KubeResource {
  spec?: {
    ingressClassName?: string
    rules?: Array<{
      host?: string
      http?: {
        paths: Array<{
          path?: string
          pathType?: string
          backend?: unknown
        }>
      }
    }>
    tls?: Array<{ hosts?: string[]; secretName?: string }>
  }
  status?: {
    loadBalancer?: { ingress?: Array<{ ip?: string; hostname?: string }> }
  }
}

// ── Config & Storage ──────────────────────────────────────────────────────────

export interface ConfigMap extends KubeResource {
  data?: Record<string, string>
  binaryData?: Record<string, string>
}

export interface Secret extends KubeResource {
  type?: string
  data?: Record<string, string>
  stringData?: Record<string, string>
}

export interface PersistentVolume extends KubeResource {
  spec?: {
    capacity?: { storage?: string }
    accessModes?: string[]
    persistentVolumeReclaimPolicy?: string
    storageClassName?: string
    volumeMode?: string
    claimRef?: { name?: string; namespace?: string }
  }
  status?: { phase?: string }
}

export interface PersistentVolumeClaim extends KubeResource {
  spec?: {
    accessModes?: string[]
    resources?: { requests?: { storage?: string } }
    storageClassName?: string
    volumeName?: string
  }
  status?: {
    phase?: string
    capacity?: { storage?: string }
  }
}

export interface StorageClass extends KubeResource {
  provisioner?: string
  reclaimPolicy?: string
  volumeBindingMode?: string
  allowVolumeExpansion?: boolean
  parameters?: Record<string, string>
}

// ── RBAC ─────────────────────────────────────────────────────────────────────

export interface PolicyRule {
  apiGroups?: string[]
  resources?: string[]
  verbs: string[]
  resourceNames?: string[]
  nonResourceURLs?: string[]
}

export interface Role extends KubeResource {
  rules?: PolicyRule[]
}

export interface ClusterRole extends KubeResource {
  rules?: PolicyRule[]
  aggregationRule?: unknown
}

export interface Subject {
  kind: 'User' | 'Group' | 'ServiceAccount'
  name: string
  namespace?: string
  apiGroup?: string
}

export interface RoleBinding extends KubeResource {
  subjects?: Subject[]
  roleRef?: { kind: string; name: string; apiGroup: string }
}

export interface ClusterRoleBinding extends KubeResource {
  subjects?: Subject[]
  roleRef?: { kind: string; name: string; apiGroup: string }
}

export interface ServiceAccount extends KubeResource {
  secrets?: Array<{ name: string }>
  imagePullSecrets?: Array<{ name: string }>
  automountServiceAccountToken?: boolean
}

// ── CRDs ─────────────────────────────────────────────────────────────────────

export interface CRD extends KubeResource {
  spec?: {
    group: string
    names: { plural: string; singular: string; kind: string; shortNames?: string[] }
    scope: 'Namespaced' | 'Cluster'
    versions?: Array<{
      name: string
      served: boolean
      storage: boolean
      schema?: unknown
    }>
  }
  status?: {
    conditions?: Array<{ type: string; status: string; reason?: string }>
    acceptedNames?: { plural: string; kind: string }
  }
}

// ── Node ─────────────────────────────────────────────────────────────────────

export interface Node extends KubeResource {
  spec?: {
    podCIDR?: string
    taints?: Array<{ key: string; effect: string; value?: string }>
    unschedulable?: boolean
  }
  status?: {
    conditions?: Array<{ type: string; status: string; reason?: string; message?: string }>
    addresses?: Array<{ type: string; address: string }>
    allocatable?: { cpu?: string; memory?: string; pods?: string }
    capacity?: { cpu?: string; memory?: string; pods?: string }
    nodeInfo?: {
      kernelVersion?: string
      osImage?: string
      kubeletVersion?: string
      containerRuntimeVersion?: string
      architecture?: string
    }
  }
}

// ── Events ───────────────────────────────────────────────────────────────────

export interface KubeEvent extends KubeResource {
  reason?: string
  message?: string
  type?: 'Normal' | 'Warning'
  count?: number
  firstTimestamp?: string
  lastTimestamp?: string
  involvedObject?: {
    kind?: string
    name?: string
    namespace?: string
    uid?: string
  }
  source?: { component?: string; host?: string }
}

// ── API responses ─────────────────────────────────────────────────────────────

export interface ClusterOverview {
  server_version: string
  nodes: { total: number; ready: number; not_ready: number }
  namespaces: number
  pods: { total: number; running: number; pending: number; failed: number; succeeded: number }
  deployments: number
  services: number
  pvcs: number
}

export interface LoginResponse {
  access_token: string
  server_version: string
  server_url: string
}

export interface AuthState {
  token: string | null
  serverVersion: string | null
  serverUrl: string | null
  isAuthenticated: boolean
}
