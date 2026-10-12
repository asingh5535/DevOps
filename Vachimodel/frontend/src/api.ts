// Typed client for the Vachi backend's /api routes.
import { readSse } from './sse'

export interface ChatMessage {
  id: number
  role: 'user' | 'assistant'
  content: string
  model: string | null
  stop_reason: string | null
  input_tokens: number | null
  output_tokens: number | null
  created_at: string
}

export interface ConversationSummary {
  id: string
  title: string
  model: string | null
  created_at: string
  updated_at: string
}

export interface Conversation extends ConversationSummary {
  messages: ChatMessage[]
}

export interface ModelEntry {
  id: string
  provider: string
  name: string
  context_window: number | null
}

export interface ProviderStatus {
  id: string
  type?: string
  ok: boolean
  error?: string
}

export interface ModelsResponse {
  default: string | null
  models: ModelEntry[]
  providers: ProviderStatus[]
}

export interface GenerationSettings {
  model?: string | null
  temperature?: number | null
  max_tokens?: number | null
}

export type StreamEvent =
  | { type: 'start'; user_message: ChatMessage | null; model: string }
  | { type: 'delta'; text: string }
  | { type: 'notice'; text: string }
  | { type: 'done'; message: ChatMessage | null }
  | { type: 'title'; title: string }
  | { type: 'error'; message: string }

export class ApiError extends Error {
  status: number
  constructor(status: number, message: string) {
    super(message)
    this.status = status
  }
}

async function request<T>(path: string, init?: RequestInit): Promise<T> {
  const response = await fetch(path, {
    ...init,
    headers: { 'Content-Type': 'application/json', ...init?.headers },
  })
  if (!response.ok) throw await toError(response)
  if (response.status === 204) return undefined as T
  return response.json() as Promise<T>
}

async function toError(response: Response): Promise<ApiError> {
  let message = `${response.status} ${response.statusText}`
  try {
    const body = await response.json()
    if (typeof body.detail === 'string') message = body.detail
    else if (Array.isArray(body.detail)) message = body.detail.map((d: { msg: string }) => d.msg).join('; ')
  } catch {
    // not JSON; keep the status text
  }
  return new ApiError(response.status, message)
}

export const api = {
  models: (refresh = false) => request<ModelsResponse>(`/api/models${refresh ? '?refresh=true' : ''}`),
  listConversations: (q?: string) =>
    request<ConversationSummary[]>(`/api/conversations${q ? `?q=${encodeURIComponent(q)}` : ''}`),
  createConversation: (model?: string | null) =>
    request<Conversation>('/api/conversations', { method: 'POST', body: JSON.stringify({ model }) }),
  getConversation: (id: string) => request<Conversation>(`/api/conversations/${id}`),
  updateConversation: (id: string, changes: { title?: string; model?: string }) =>
    request<ConversationSummary>(`/api/conversations/${id}`, { method: 'PATCH', body: JSON.stringify(changes) }),
  deleteConversation: (id: string) => request<void>(`/api/conversations/${id}`, { method: 'DELETE' }),
  stop: (id: string) => request<{ stopped: boolean }>(`/api/conversations/${id}/stop`, { method: 'POST' }),
  exportUrl: (id: string, format: 'markdown' | 'json') => `/api/conversations/${id}/export?format=${format}`,

  /** Send (or edit) a message and stream the answer. */
  send: (id: string, content: string, settings: GenerationSettings, editMessageId?: number, signal?: AbortSignal) =>
    stream(`/api/conversations/${id}/messages`, { content, edit_message_id: editMessageId, ...settings }, signal),

  /** Drop the last answer (if any) and answer the last question again. */
  regenerate: (id: string, settings: GenerationSettings, signal?: AbortSignal) =>
    stream(`/api/conversations/${id}/regenerate`, settings, signal),
}

async function* stream(path: string, body: object, signal?: AbortSignal): AsyncGenerator<StreamEvent> {
  const response = await fetch(path, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', Accept: 'text/event-stream' },
    body: JSON.stringify(body),
    signal,
  })
  if (!response.ok) throw await toError(response)
  for await (const { event, data } of readSse(response)) {
    yield { type: event, ...JSON.parse(data) } as StreamEvent
  }
}
