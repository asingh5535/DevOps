export interface AuthState {
  token: string | null
  username: string | null
  isAuthenticated: boolean
}

export interface ConnectorField {
  key: string
  label: string
  required: boolean
  secret?: boolean
  placeholder?: string
}

export interface ConnectorTypeInfo {
  type: string
  label: string
  defaultPort: number
  usesUsername?: boolean
  passwordLabel?: string
  fields: ConnectorField[] | null
}

export interface MetricSpec {
  key: string
  name: string
  description: string
  unit: string
}

export interface Cluster {
  id: string
  name: string
  type: string
  host: string
  port: number
  username: string
  extra: Record<string, string> | null
  createdAt: string
}

export interface KeyResult {
  id: string
  objectiveId: string
  title: string
  clusterId: string
  clusterName?: string
  connectorType?: string
  metricKey: string
  comparator: 'lt' | 'lte' | 'gt' | 'gte'
  baselineValue: number
  targetValue: number
  currentValue: number
  unit: string
  progress: number
  lastEvaluatedAt?: string
  lastError?: string
  createdAt: string
}

export interface Objective {
  id: string
  title: string
  description: string
  owner: string
  team: string
  quarter: string
  createdAt: string
  updatedAt: string
  keyResults?: KeyResult[]
}

export interface MetricSample {
  id: number
  keyResultId: string
  value: number
  sampledAt: string
}

export interface TeamQuarterGroup {
  team: string
  quarter: string
  objectiveCount: number
  keyResultCount: number
  averageProgress: number
}

export interface DashboardSummary {
  objectiveCount: number
  keyResultCount: number
  overallProgress: number
  teamQuarterGroups: TeamQuarterGroup[]
  atRiskKeyResults: (KeyResult & { objectiveTitle: string; team: string; quarter: string })[]
}
