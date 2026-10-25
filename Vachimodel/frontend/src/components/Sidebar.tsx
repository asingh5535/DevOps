import { useEffect, useState } from 'react'
import { api, type ConversationSummary } from '../api'

interface Props {
  conversations: ConversationSummary[]
  activeId: string | null
  search: string
  onSearch: (q: string) => void
  onSelect: (id: string) => void
  onNew: () => void
  onRename: (id: string, title: string) => void
  onDelete: (id: string) => void
  open: boolean
  onClose: () => void
}

export function Sidebar(props: Props) {
  const { conversations, activeId, search, onSearch, onSelect, onNew, open, onClose } = props
  const [query, setQuery] = useState(search)

  useEffect(() => {
    const timer = setTimeout(() => onSearch(query.trim()), 250)
    return () => clearTimeout(timer)
  }, [query, onSearch])

  return (
    <>
      <div className={`sidebar-backdrop ${open ? 'visible' : ''}`} onClick={onClose} aria-hidden="true" />
      <aside className={`sidebar ${open ? 'open' : ''}`} aria-label="Conversations">
        <div className="sidebar-top">
          <div className="brand">
            <img src="/favicon.svg" alt="" width={24} height={24} />
            <span>Vachi</span>
          </div>
          <button type="button" className="button primary full" onClick={onNew}>
            + New chat
          </button>
          <input
            className="input"
            type="search"
            placeholder="Search chats"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            aria-label="Search chats"
          />
        </div>
        <nav className="conversation-list">
          {conversations.length === 0 && (
            <p className="muted small padded">{search ? 'No chats match your search.' : 'No chats yet.'}</p>
          )}
          {conversations.map((c) => (
            <ConversationRow
              key={c.id}
              conversation={c}
              active={c.id === activeId}
              onSelect={() => onSelect(c.id)}
              onRename={(title) => props.onRename(c.id, title)}
              onDelete={() => props.onDelete(c.id)}
            />
          ))}
        </nav>
      </aside>
    </>
  )
}

function ConversationRow({
  conversation,
  active,
  onSelect,
  onRename,
  onDelete,
}: {
  conversation: ConversationSummary
  active: boolean
  onSelect: () => void
  onRename: (title: string) => void
  onDelete: () => void
}) {
  const [editing, setEditing] = useState(false)
  const [title, setTitle] = useState(conversation.title)
  const [menuOpen, setMenuOpen] = useState(false)

  if (editing) {
    const save = () => {
      setEditing(false)
      if (title.trim() && title !== conversation.title) onRename(title.trim())
    }
    return (
      <div className="conversation-row active">
        <input
          className="input rename-input"
          value={title}
          autoFocus
          onChange={(e) => setTitle(e.target.value)}
          onBlur={save}
          onKeyDown={(e) => {
            if (e.key === 'Enter') save()
            if (e.key === 'Escape') {
              setTitle(conversation.title)
              setEditing(false)
            }
          }}
          aria-label="Chat title"
        />
      </div>
    )
  }

  return (
    <div className={`conversation-row ${active ? 'active' : ''}`}>
      <button type="button" className="conversation-title" onClick={onSelect} title={conversation.title}>
        {conversation.title}
      </button>
      <button
        type="button"
        className="icon-button row-menu-button"
        aria-label="Chat options"
        onClick={() => setMenuOpen((v) => !v)}
      >
        ⋯
      </button>
      {menuOpen && (
        <div className="row-menu" onMouseLeave={() => setMenuOpen(false)}>
          <button
            type="button"
            onClick={() => {
              setMenuOpen(false)
              setTitle(conversation.title)
              setEditing(true)
            }}
          >
            Rename
          </button>
          <a href={api.exportUrl(conversation.id, 'markdown')} onClick={() => setMenuOpen(false)}>
            Export Markdown
          </a>
          <a href={api.exportUrl(conversation.id, 'json')} onClick={() => setMenuOpen(false)}>
            Export JSON
          </a>
          <button
            type="button"
            className="danger"
            onClick={() => {
              setMenuOpen(false)
              if (confirm(`Delete "${conversation.title}"? This can't be undone.`)) onDelete()
            }}
          >
            Delete
          </button>
        </div>
      )}
    </div>
  )
}
