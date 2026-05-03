export interface NamespaceInfo {
  name: string
  labels: Record<string, string>
  phase: string
  hasTeam: boolean
  hasCostCenter: boolean
  hasEnv: boolean
  compliant: boolean
}

export interface PodInfo {
  name: string
  namespace: string
  phase: string
  labels: Record<string, string>
  node: string
  cpuRequest: string
  memRequest: string
  cpuLimit: string
  memLimit: string
  compliant: boolean
}

export interface ResourceCost {
  cpuRequestCores: number
  memRequestGB: number
  cpuLimitCores: number
  memLimitGB: number
  hourlyCost: number
  monthlyCost: number
}

export interface NamespaceCost {
  namespace: string
  labels: Record<string, string>
  cost: ResourceCost
  podCount: number
}

export interface TeamCost {
  team: string
  monthlyCost: number
  hourlyCost: number
  podCount: number
}

export interface CostCenterCost {
  costCenter: string
  monthlyCost: number
  hourlyCost: number
}

export interface CostSummary {
  totalMonthlyCost: number
  totalHourlyCost: number
  byNamespace: NamespaceCost[]
  byTeam: TeamCost[]
  byCostCenter: CostCenterCost[]
  totalPods: number
  compliantPods: number
  compliancePercent: number
}

export interface DeploymentCompliance {
  name: string
  namespace: string
  labels: Record<string, string>
  missingLabels: string[]
  compliant: boolean
}

export interface ComplianceReport {
  deployments: DeploymentCompliance[]
  totalDeployments: number
  compliant: number
  nonCompliant: number
  compliancePct: number
  requiredLabels: string[]
}

export interface QuotaStatus {
  name: string
  namespace: string
  hard: Record<string, string>
  used: Record<string, string>
}
