import dayjs from 'dayjs'
import relativeTime from 'dayjs/plugin/relativeTime'
import yaml from 'js-yaml'

dayjs.extend(relativeTime)

export function formatAge(timestamp?: string): string {
  if (!timestamp) return '—'
  return dayjs(timestamp).fromNow()
}

export function formatBytes(bytes?: number): string {
  if (bytes === undefined) return '—'
  const units = ['B', 'Ki', 'Mi', 'Gi', 'Ti']
  let val = bytes
  let i = 0
  while (val >= 1024 && i < units.length - 1) {
    val /= 1024
    i++
  }
  return `${val.toFixed(1)} ${units[i]}`
}

export function parseMemory(mem?: string): number {
  if (!mem) return 0
  const m = mem.match(/^(\d+(?:\.\d+)?)(Ki|Mi|Gi|Ti|k|M|G|T)?$/)
  if (!m) return 0
  const val = parseFloat(m[1])
  const unit = m[2] ?? ''
  const multipliers: Record<string, number> = {
    Ki: 1024, Mi: 1024 ** 2, Gi: 1024 ** 3, Ti: 1024 ** 4,
    k: 1000, M: 1000 ** 2, G: 1000 ** 3, T: 1000 ** 4,
  }
  return val * (multipliers[unit] ?? 1)
}

export function parseCPU(cpu?: string): number {
  if (!cpu) return 0
  if (cpu.endsWith('m')) return parseInt(cpu) / 1000
  return parseFloat(cpu)
}

export function toYAML(obj: unknown): string {
  try {
    return yaml.dump(obj, { indent: 2, lineWidth: -1, noRefs: true })
  } catch {
    return JSON.stringify(obj, null, 2)
  }
}

export function fromYAML(str: string): unknown {
  return yaml.load(str)
}

export function getPodStatus(pod: {
  status?: { phase?: string; conditions?: Array<{ type: string; status: string }> }
}): string {
  const phase = pod.status?.phase ?? 'Unknown'
  return phase
}

export function getPodReadyCount(pod: {
  status?: { containerStatuses?: Array<{ ready: boolean }> }
}): string {
  const statuses = pod.status?.containerStatuses ?? []
  const ready = statuses.filter((s) => s.ready).length
  return `${ready}/${statuses.length}`
}

export function labelColor(type: 'Normal' | 'Warning' | string): string {
  if (type === 'Warning') return 'orange'
  return 'green'
}

export function getPodPhaseColor(phase?: string): string {
  switch (phase) {
    case 'Running': return '#52c41a'
    case 'Pending': return '#faad14'
    case 'Failed': return '#ff4d4f'
    case 'Succeeded': return '#1677ff'
    default: return '#8c8c8c'
  }
}

export function getDeploymentStatus(dep: {
  spec?: { replicas?: number }
  status?: { readyReplicas?: number; availableReplicas?: number }
}): 'healthy' | 'degraded' | 'unavailable' {
  const desired = dep.spec?.replicas ?? 0
  const ready = dep.status?.readyReplicas ?? 0
  if (ready === desired) return 'healthy'
  if (ready > 0) return 'degraded'
  return 'unavailable'
}

export function truncate(str: string, maxLen = 50): string {
  if (str.length <= maxLen) return str
  return str.slice(0, maxLen) + '…'
}

export function copyToClipboard(text: string): Promise<void> {
  return navigator.clipboard.writeText(text)
}
