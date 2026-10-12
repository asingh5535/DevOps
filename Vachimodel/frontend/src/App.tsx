import { useCallback, useEffect, useRef, useState } from 'react'
import {
  api,
  type ChatMessage,
  type ConversationSummary,
  type GenerationSettings,
  type ModelsResponse,
  type StreamEvent,
} from './api'
import { Composer } from './components/Composer'
import { Header, type Theme } from './components/Header'
import { Messages, type StreamingState } from './components/Messages'
import { Sidebar } from './components/Sidebar'

// Per-browser preferences. Storage can be unavailable (private mode), so never rely on it.
function loadPref<T>(key: string, fallback: T): T {
  try {
    const raw = localStorage.getItem(key)
    return raw ? (JSON.parse(raw) as T) : fallback
  } catch {
    return fallback
  }
}
function savePref(key: string, value: unknown) {
  try {
    localStorage.setItem(key, JSON.stringify(value))
  } catch {
    // ignore
  }
}

let tempId = -1

export default function App() {
  const [models, setModels] = useState<ModelsResponse | null>(null)
  const [conversations, setConversations] = useState<ConversationSummary[]>([])
  const [search, setSearch] = useState('')
  const [activeId, setActiveId] = useState<string | null>(() => location.hash.slice(1) || null)
  const [messages, setMessages] = useState<ChatMessage[]>([])
  const [model, setModel] = useState<string | null>(null)
  const [streams, setStreams] = useState<Record<string, StreamingState>>({})
  const [error, setError] = useState<string | null>(null)
  const [settings, setSettings] = useState<GenerationSettings>(() => loadPref('vachi.settings', {}))
  const [theme, setTheme] = useState<Theme>(() => loadPref('vachi.theme', 'system'))
  const [sidebarOpen, setSidebarOpen] = useState(false)

  const activeRef = useRef(activeId)
  useEffect(() => {
    activeRef.current = activeId
  }, [activeId])
  const controllers = useRef(new Map<string, AbortController>())
  const justCreated = useRef<string | null>(null) // don't reload a chat we just created; we already have its state

  const busy = activeId !== null && activeId in streams

  // ------------------------------------------------------------ loading

  const refreshConversations = useCallback(async (q = search) => {
    try {
      setConversations(await api.listConversations(q || undefined))
    } catch (e) {
      setError(`Couldn't load chats: ${(e as Error).message}`)
    }
  }, [search])

  const refreshModels = useCallback(async (force = false) => {
    try {
      const data = await api.models(force)
      setModels(data)
      setModel((current) => current ?? loadPref<string | null>('vachi.model', null) ?? data.default)
    } catch (e) {
      setError(`Couldn't load models: ${(e as Error).message}`)
    }
  }, [])

  useEffect(() => {
    void refreshModels()
  }, [refreshModels])

  useEffect(() => {
    void refreshConversations(search)
  }, [search, refreshConversations])

  useEffect(() => {
    history.replaceState(null, '', activeId ? `#${activeId}` : location.pathname)
    setError(null)
    if (!activeId) {
      setMessages([])
      return
    }
    if (justCreated.current === activeId) {
      justCreated.current = null
      return
    }
    let cancelled = false
    api
      .getConversation(activeId)
      .then((c) => {
        if (cancelled) return
        setMessages(c.messages)
        if (c.model) setModel(c.model)
      })
      .catch((e) => {
        if (cancelled) return
        setActiveId(null)
        setError(`Couldn't open that chat: ${(e as Error).message}`)
      })
    return () => {
      cancelled = true
    }
  }, [activeId])

  useEffect(() => {
    if (theme === 'system') delete document.documentElement.dataset.theme
    else document.documentElement.dataset.theme = theme
    savePref('vachi.theme', theme)
  }, [theme])

  useEffect(() => savePref('vachi.settings', settings), [settings])

  // ------------------------------------------------------------ streaming

  const runStream = useCallback(
    async (conversationId: string, events: (signal: AbortSignal) => AsyncGenerator<StreamEvent>) => {
      const controller = new AbortController()
      controllers.current.set(conversationId, controller)
      setStreams((s) => ({ ...s, [conversationId]: { text: '', notices: [], model: null } }))
      const isActive = () => activeRef.current === conversationId
      const updateStream = (fn: (s: StreamingState) => StreamingState) =>
        setStreams((all) => (all[conversationId] ? { ...all, [conversationId]: fn(all[conversationId]) } : all))

      try {
        for await (const event of events(controller.signal)) {
          switch (event.type) {
            case 'start':
              updateStream((s) => ({ ...s, model: event.model }))
              if (event.user_message && isActive()) {
                const real = event.user_message
                setMessages((ms) => ms.map((m) => (m.id < 0 && m.role === 'user' ? real : m)))
              }
              break
            case 'delta':
              updateStream((s) => ({ ...s, text: s.text + event.text }))
              break
            case 'notice':
              updateStream((s) => ({ ...s, notices: [...s.notices, event.text] }))
              break
            case 'done':
              if (event.message && isActive()) {
                const saved = event.message
                setMessages((ms) => [...ms, saved])
              }
              setStreams(({ [conversationId]: _done, ...rest }) => rest)
              break
            case 'title':
              setConversations((cs) => cs.map((c) => (c.id === conversationId ? { ...c, title: event.title } : c)))
              break
            case 'error':
              if (isActive()) setError(event.message)
              break
          }
        }
      } catch (e) {
        if ((e as Error).name !== 'AbortError' && isActive()) setError((e as Error).message)
        if (isActive()) setMessages((ms) => ms.filter((m) => m.id > 0)) // drop unsent optimistic message
      } finally {
        controllers.current.delete(conversationId)
        setStreams(({ [conversationId]: _gone, ...rest }) => rest)
        void refreshConversations()
      }
    },
    [refreshConversations],
  )

  const optimisticUserMessage = (content: string): ChatMessage => ({
    id: tempId--,
    role: 'user',
    content,
    model: null,
    stop_reason: null,
    input_tokens: null,
    output_tokens: null,
    created_at: new Date().toISOString(),
  })

  const send = async (content: string) => {
    setError(null)
    let id = activeId
    if (!id) {
      try {
        const created = await api.createConversation(model)
        id = created.id
        setConversations((cs) => [created, ...cs])
        activeRef.current = id
        justCreated.current = id
        setActiveId(id)
      } catch (e) {
        setError((e as Error).message)
        return
      }
    }
    setMessages((ms) => [...ms, optimisticUserMessage(content)])
    const conversationId = id
    await runStream(conversationId, (signal) => api.send(conversationId, content, { ...settings, model }, undefined, signal))
  }

  const edit = async (message: ChatMessage, content: string) => {
    if (!activeId) return
    setError(null)
    const conversationId = activeId
    setMessages((ms) => [...ms.slice(0, ms.findIndex((m) => m.id === message.id)), optimisticUserMessage(content)])
    await runStream(conversationId, (signal) =>
      api.send(conversationId, content, { ...settings, model }, message.id, signal),
    )
  }

  const regenerate = async () => {
    if (!activeId) return
    setError(null)
    const conversationId = activeId
    setMessages((ms) => (ms.at(-1)?.role === 'assistant' ? ms.slice(0, -1) : ms))
    await runStream(conversationId, (signal) => api.regenerate(conversationId, { ...settings, model }, signal))
  }

  const stop = async () => {
    if (!activeId) return
    try {
      await api.stop(activeId) // the server saves the partial answer and ends the stream
    } catch {
      controllers.current.get(activeId)?.abort()
    }
  }

  // ------------------------------------------------------------ conversations

  const changeModel = async (next: string) => {
    setModel(next)
    savePref('vachi.model', next)
    if (activeId) {
      try {
        await api.updateConversation(activeId, { model: next })
      } catch (e) {
        setError((e as Error).message)
      }
    }
  }

  const select = (id: string | null) => {
    setActiveId(id)
    setSidebarOpen(false)
  }

  const rename = async (id: string, title: string) => {
    try {
      const updated = await api.updateConversation(id, { title })
      setConversations((cs) => cs.map((c) => (c.id === id ? { ...c, title: updated.title } : c)))
    } catch (e) {
      setError((e as Error).message)
    }
  }

  const remove = async (id: string) => {
    try {
      await api.deleteConversation(id)
      setConversations((cs) => cs.filter((c) => c.id !== id))
      if (id === activeId) select(null)
    } catch (e) {
      setError((e as Error).message)
    }
  }

  return (
    <div className="app">
      <Sidebar
        conversations={conversations}
        activeId={activeId}
        search={search}
        onSearch={setSearch}
        onSelect={select}
        onNew={() => select(null)}
        onRename={rename}
        onDelete={remove}
        open={sidebarOpen}
        onClose={() => setSidebarOpen(false)}
      />
      <main className="main">
        <Header
          models={models}
          model={model}
          onModelChange={changeModel}
          onRefreshModels={() => void refreshModels(true)}
          settings={settings}
          onSettingsChange={setSettings}
          theme={theme}
          onThemeChange={setTheme}
          onMenu={() => setSidebarOpen(true)}
          disabled={busy}
        />
        <Messages
          messages={messages}
          streaming={activeId ? (streams[activeId] ?? null) : null}
          busy={busy}
          error={error}
          onEdit={edit}
          onRegenerate={regenerate}
          onSuggestion={send}
        />
        <Composer busy={busy} disabled={!model} onSend={send} onStop={stop} />
      </main>
    </div>
  )
}
