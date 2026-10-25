import { useState } from 'react'
import type { GenerationSettings, ModelEntry, ModelsResponse } from '../api'
import { formatPrice, formatTokens } from '../format'
import { UsagePanel } from './UsagePanel'

export type Theme = 'system' | 'light' | 'dark'

interface Props {
  models: ModelsResponse | null
  model: string | null
  onModelChange: (model: string) => void
  onRefreshModels: () => void
  settings: GenerationSettings
  onSettingsChange: (settings: GenerationSettings) => void
  theme: Theme
  onThemeChange: (theme: Theme) => void
  onMenu: () => void
  disabled: boolean
}

const THEME_LABELS: Record<Theme, string> = { system: 'Auto', light: 'Light', dark: 'Dark' }
const NEXT_THEME: Record<Theme, Theme> = { system: 'light', light: 'dark', dark: 'system' }

export function Header(props: Props) {
  const { models, model, settings } = props
  const [settingsOpen, setSettingsOpen] = useState(false)
  const [usageOpen, setUsageOpen] = useState(false)

  const byProvider = new Map<string, ModelEntry[]>()
  for (const m of models?.models ?? []) {
    byProvider.set(m.provider, [...(byProvider.get(m.provider) ?? []), m])
  }
  const selected = models?.models.find((m) => m.id === model)
  const known = selected !== undefined
  const down = models?.providers.filter((p) => !p.ok) ?? []

  return (
    <header className="header">
      <button type="button" className="icon-button menu-button" onClick={props.onMenu} aria-label="Open chats">
        ☰
      </button>

      <label className="model-picker">
        <span className="visually-hidden">Model</span>
        <select
          className="input"
          value={model ?? ''}
          disabled={props.disabled}
          onChange={(e) => props.onModelChange(e.target.value)}
        >
          {!model && <option value="">Choose a model</option>}
          {model && !known && <option value={model}>{model} (unavailable)</option>}
          {[...byProvider].map(([provider, list]) => (
            <optgroup key={provider} label={provider}>
              {list.map((m) => (
                <option key={m.id} value={m.id}>
                  {m.name}
                  {m.price ? ` · ${m.price.input === 0 && m.price.output === 0 ? 'free' : `$${m.price.input}/$${m.price.output}`}` : ''}
                </option>
              ))}
            </optgroup>
          ))}
        </select>
      </label>

      {selected && <ModelDetails model={selected} />}

      {down.length > 0 && (
        <span className="provider-warning" title={down.map((p) => `${p.id}: ${p.error}`).join('\n')}>
          {down.length} provider{down.length > 1 ? 's' : ''} unavailable
        </span>
      )}

      <div className="header-actions">
        <div className="popover-anchor">
          <button
            type="button"
            className="button ghost"
            onClick={() => setSettingsOpen((v) => !v)}
            aria-expanded={settingsOpen}
          >
            Settings
          </button>
          {settingsOpen && (
            <div className="popover" role="dialog" aria-label="Generation settings">
              <label className="field">
                <span>
                  Temperature: <strong>{settings.temperature ?? 'model default'}</strong>
                </span>
                <input
                  type="range"
                  min={0}
                  max={2}
                  step={0.1}
                  value={settings.temperature ?? 0.7}
                  onChange={(e) => props.onSettingsChange({ ...settings, temperature: Number(e.target.value) })}
                />
              </label>
              <label className="field">
                <span>Max answer length (tokens)</span>
                <input
                  className="input"
                  type="number"
                  min={1}
                  placeholder="model default"
                  value={settings.max_tokens ?? ''}
                  onChange={(e) =>
                    props.onSettingsChange({
                      ...settings,
                      max_tokens: e.target.value ? Math.max(1, Number(e.target.value)) : null,
                    })
                  }
                />
              </label>
              <p className="muted small">
                Some models (including current Claude models) ignore temperature.
              </p>
              <div className="popover-actions">
                <button
                  type="button"
                  className="button ghost"
                  onClick={() => props.onSettingsChange({ temperature: null, max_tokens: null })}
                >
                  Reset
                </button>
                <button type="button" className="button ghost" onClick={props.onRefreshModels}>
                  Refresh models
                </button>
              </div>
            </div>
          )}
        </div>
        <button type="button" className="button ghost" onClick={() => setUsageOpen(true)}>
          Usage
        </button>
        <button
          type="button"
          className="button ghost"
          onClick={() => props.onThemeChange(NEXT_THEME[props.theme])}
          aria-label={`Theme: ${THEME_LABELS[props.theme]}. Click to change.`}
        >
          {THEME_LABELS[props.theme]}
        </button>
      </div>
      {usageOpen && <UsagePanel fallback={models?.fallback ?? []} onClose={() => setUsageOpen(false)} />}
    </header>
  )
}

function ModelDetails({ model }: { model: ModelEntry }) {
  const parts = [
    model.context_window ? `${formatTokens(model.context_window)} context` : null,
    ...model.capabilities,
    formatPrice(model.price),
  ].filter(Boolean)
  if (parts.length === 0) return null
  return (
    <span className="model-details" title="What this model can do, and its price">
      {parts.join(' · ')}
    </span>
  )
}
