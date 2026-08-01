import { useEffect, useState } from 'react'
import { ReloadOutlined } from '@ant-design/icons'
import { api } from '../services/api'
import type { PodInfo, QuotaStatus } from '../types'

export default function Resources() {
  const [pods, setPods] = useState<PodInfo[]>([])
  const [quotas, setQuotas] = useState<QuotaStatus[]>([])
  const [loading, setLoading] = useState(true)
  const [search, setSearch] = useState('')

  const load = async () => {
    setLoading(true)
    try {
      const [p, q] = await Promise.all([api.getPods(), api.getQuotas()])
      setPods(p.pods ?? [])
      setQuotas(q.quotas ?? [])
    } catch (e) { console.error(e) } finally { setLoading(false) }
  }

  useEffect(() => { load() }, [])

  const filtered = pods.filter(p =>
    p.name.includes(search) || p.namespace.includes(search)
  )

  const phaseColor = (phase: string) => {
    switch (phase) {
      case 'Running': return 'tag-green'
      case 'Pending': return 'tag-orange'
      case 'Failed': return 'tag-red'
      default: return 'tag-blue'
    }
  }

  return (
    <div>
      <div className="topbar">
        <span className="topbar-title">Resource Inventory</span>
        <ReloadOutlined className="refresh-btn" spin={loading} onClick={load} style={{ fontSize: 16 }} />
      </div>

      <div className="page">
        {quotas.length > 0 && (
          <div className="card" style={{ marginBottom: 16 }}>
            <div className="card-header">Resource Quotas</div>
            <div className="card-body" style={{ padding: 0 }}>
              <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 13 }}>
                <thead>
                  <tr style={{ background: '#fafafa' }}>
                    <th style={th}>Namespace</th>
                    <th style={th}>Quota</th>
                    <th style={th}>CPU Used / Hard</th>
                    <th style={th}>Memory Used / Hard</th>
                    <th style={th}>Pods Used / Hard</th>
                  </tr>
                </thead>
                <tbody>
                  {quotas.map(q => (
                    <tr key={`${q.namespace}/${q.name}`} style={{ borderBottom: '1px solid #f0f0f0' }}>
                      <td style={td}>{q.namespace}</td>
                      <td style={td}>{q.name}</td>
                      <td style={td}>
                        {q.used['requests.cpu'] ?? '0'} / {q.hard['requests.cpu'] ?? '∞'}
                      </td>
                      <td style={td}>
                        {q.used['requests.memory'] ?? '0'} / {q.hard['requests.memory'] ?? '∞'}
                      </td>
                      <td style={td}>
                        {q.used['count/pods'] ?? '0'} / {q.hard['count/pods'] ?? '∞'}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        )}

        <div className="card">
          <div className="card-header">
            Pods ({filtered.length})
            <input
              placeholder="Search pods..."
              value={search}
              onChange={e => setSearch(e.target.value)}
              style={{
                marginLeft: 'auto',
                padding: '4px 10px',
                border: '1px solid #d9d9d9',
                borderRadius: 4,
                fontSize: 13,
                outline: 'none',
                width: 220,
              }}
            />
          </div>
          <div className="card-body" style={{ padding: 0, maxHeight: 600, overflowY: 'auto' }}>
            <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 13 }}>
              <thead style={{ position: 'sticky', top: 0 }}>
                <tr style={{ background: '#fafafa' }}>
                  <th style={th}>Pod</th>
                  <th style={th}>Namespace</th>
                  <th style={th}>Phase</th>
                  <th style={th}>Node</th>
                  <th style={th}>CPU Req / Limit</th>
                  <th style={th}>Mem Req / Limit</th>
                  <th style={th}>Labels OK?</th>
                </tr>
              </thead>
              <tbody>
                {filtered.map(p => (
                  <tr key={`${p.namespace}/${p.name}`} style={{ borderBottom: '1px solid #f0f0f0' }}>
                    <td style={td}><strong>{p.name}</strong></td>
                    <td style={td}>{p.namespace}</td>
                    <td style={td}><span className={`tag ${phaseColor(p.phase)}`}>{p.phase}</span></td>
                    <td style={{ ...td, fontSize: 11, color: '#8c8c8c' }}>{p.node}</td>
                    <td style={td}>{p.cpuRequest} / {p.cpuLimit}</td>
                    <td style={td}>{p.memRequest} / {p.memLimit}</td>
                    <td style={td}>
                      {p.compliant
                        ? <span className="tag tag-green">Yes</span>
                        : <span className="tag tag-red">No</span>}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      </div>
    </div>
  )
}

const th: React.CSSProperties = { padding: '10px 16px', textAlign: 'left', fontWeight: 600, color: '#595959', borderBottom: '1px solid #f0f0f0' }
const td: React.CSSProperties = { padding: '10px 16px', color: '#262626' }
