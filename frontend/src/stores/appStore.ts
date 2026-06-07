import { create } from 'zustand'

export interface WikiPageItem {
  slug: string
  title: string
  category: string
  tags: string[]
  updated_at: string
  problem?: string
  approach?: string
}

export interface PageDetail {
  slug: string
  title: string
  category: string
  content: string
  backlinks: { slug: string; title: string }[]
  frontmatter: {
    tags: string[]
    source_id?: string
    source_url?: string
    problem?: string
    approach?: string
  }
}

export interface GraphNode {
  id: string
  label: string
  tags: string[]
  color: string
  problem?: string
  approach?: string
}

export interface GraphLink {
  source: string
  target: string
  type: string
  reason: string
}

export interface ChatMessage {
  role: 'user' | 'assistant'
  content: string
  sources?: { slug: string; title: string }[]
}

export interface ChatSession {
  id: string
  title: string
  messages: ChatMessage[]
  createdAt: number
}

export interface KBInfo {
  id: string
  name: string
  created_at: string
  updated_at: string
}

export type NavKey = 'dashboard' | 'all' | 'graph' | 'ingest'

export type GraphMode = 'global' | 'focus'

// localStorage persistence
function loadSessions(kbId: string): ChatSession[] {
  try {
    const raw = localStorage.getItem(`chat_sessions_${kbId}`)
    return raw ? JSON.parse(raw) : []
  } catch {
    return []
  }
}
function saveSessions(kbId: string, sessions: ChatSession[]) {
  try {
    localStorage.setItem(`chat_sessions_${kbId}`, JSON.stringify(sessions.slice(0, 50)))
  } catch { /* quota exceeded */ }
}

interface AppState {
  // KB
  kbId: string
  setKbId: (id: string) => void
  kbList: KBInfo[]
  setKbList: (list: KBInfo[]) => void

  // Navigation
  navKey: NavKey
  setNavKey: (key: NavKey) => void

  searchQuery: string
  setSearchQuery: (q: string) => void

  pages: WikiPageItem[]
  setPages: (pages: WikiPageItem[]) => void

  selectedPage: PageDetail | null
  setSelectedPage: (page: PageDetail | null) => void

  graphData: { nodes: GraphNode[]; links: GraphLink[]; tag_groups: Record<string, string> }
  setGraphData: (data: { nodes: GraphNode[]; links: GraphLink[]; tag_groups?: Record<string, string> }) => void

  graphMode: GraphMode
  setGraphMode: (mode: GraphMode) => void

  // Chat sessions
  chatSessions: ChatSession[]
  activeSessionId: string | null
  chatMessages: ChatMessage[]
  addChatMessage: (msg: ChatMessage) => void
  clearChat: () => void
  newChatSession: () => void
  switchSession: (id: string) => void
  deleteSession: (id: string) => void

  pageRefresh: number
  triggerRefresh: () => void
}

export const useAppStore = create<AppState>((set) => ({
  // KB
  kbId: '',
  setKbId: (id) => {
    const sessions = id ? loadSessions(id) : []
    const last = sessions.length > 0 ? sessions[sessions.length - 1] : null
    set({
      kbId: id,
      pages: [],
      selectedPage: null,
      graphData: { nodes: [], links: [], tag_groups: {} },
      chatSessions: sessions,
      activeSessionId: last ? last.id : null,
      chatMessages: last ? last.messages : []
    })
  },
  kbList: [],
  setKbList: (list) => set({ kbList: list }),

  // Navigation
  navKey: 'dashboard',
  setNavKey: (key) => set((s) => ({ navKey: key, selectedPage: key === 'graph' ? s.selectedPage : null })),

  searchQuery: '',
  setSearchQuery: (q) => set({ searchQuery: q }),

  pages: [],
  setPages: (pages) => set({ pages }),

  selectedPage: null,
  setSelectedPage: (page) => set({ selectedPage: page }),

  graphData: { nodes: [], links: [], tag_groups: {} },
  setGraphData: (data) => set({ graphData: { nodes: data.nodes, links: data.links, tag_groups: data.tag_groups || {} } }),

  graphMode: 'global',
  setGraphMode: (mode) => set({ graphMode: mode }),

  chatSessions: [],
  activeSessionId: null,
  chatMessages: [],
  addChatMessage: (msg) => set((s) => {
    const kbId = s.kbId
    if (!kbId) return {}

    let sessions = s.chatSessions.length > 0 ? [...s.chatSessions] : loadSessions(kbId)
    const activeId = s.activeSessionId || (sessions.length > 0 ? sessions[sessions.length - 1].id : null)

    // auto-title from first user message
    let title = '新对话'
    if (activeId) {
      const session = sessions.find((ss) => ss.id === activeId)
      if (session && session.messages.length === 0 && msg.role === 'user') {
        title = msg.content.slice(0, 30)
      } else if (session) {
        title = session.title
      }
    } else if (msg.role === 'user') {
      title = msg.content.slice(0, 30)
    }

    if (activeId) {
      const idx = sessions.findIndex((ss) => ss.id === activeId)
      if (idx >= 0) {
        sessions[idx] = { ...sessions[idx], messages: [...sessions[idx].messages, msg], title }
      }
    } else {
      const newId = Date.now().toString(36) + Math.random().toString(36).slice(2, 6)
      sessions = [...sessions, { id: newId, title, messages: [msg], createdAt: Date.now() }]
      saveSessions(kbId, sessions)
      return { chatSessions: sessions, activeSessionId: newId, chatMessages: [msg] }
    }

    saveSessions(kbId, sessions)
    const active = sessions.find((ss) => ss.id === activeId)
    return { chatSessions: sessions, activeSessionId: activeId, chatMessages: active ? active.messages : [] }
  }),
  clearChat: () => set((s) => {
    const kbId = s.kbId
    const sessions = s.chatSessions.filter((ss) => ss.id !== s.activeSessionId)
    saveSessions(kbId, sessions)
    const last = sessions.length > 0 ? sessions[sessions.length - 1] : null
    return {
      chatSessions: sessions,
      activeSessionId: last ? last.id : null,
      chatMessages: last ? last.messages : []
    }
  }),
  newChatSession: () => set((s) => {
    const kbId = s.kbId
    if (!kbId) return {}
    const newId = Date.now().toString(36) + Math.random().toString(36).slice(2, 6)
    const session: ChatSession = { id: newId, title: '新对话', messages: [], createdAt: Date.now() }
    const sessions = [...s.chatSessions, session]
    saveSessions(kbId, sessions)
    return { chatSessions: sessions, activeSessionId: newId, chatMessages: [] }
  }),
  switchSession: (id) => set((s) => {
    const session = s.chatSessions.find((ss) => ss.id === id)
    return session
      ? { activeSessionId: id, chatMessages: session.messages }
      : {}
  }),
  deleteSession: (id) => set((s) => {
    const kbId = s.kbId
    const sessions = s.chatSessions.filter((ss) => ss.id !== id)
    saveSessions(kbId, sessions)
    if (s.activeSessionId === id) {
      const last = sessions.length > 0 ? sessions[sessions.length - 1] : null
      return {
        chatSessions: sessions,
        activeSessionId: last ? last.id : null,
        chatMessages: last ? last.messages : []
      }
    }
    return { chatSessions: sessions }
  }),

  pageRefresh: 0,
  triggerRefresh: () => set((s) => ({ pageRefresh: s.pageRefresh + 1 })),
}))
