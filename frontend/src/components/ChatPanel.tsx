import { useState, useRef, useEffect } from 'react'
import { useAppStore } from '../stores/appStore'

const API_BASE = '/api/v1'

const SUGGESTED_QUESTIONS = [
  '这个知识库主要涵盖哪些内容？',
  '有哪些核心知识点？',
  '各文档之间有什么关联？',
]

function formatTime(ts: number): string {
  const d = new Date(ts)
  const now = new Date()
  const diff = now.getTime() - d.getTime()
  if (diff < 60000) return '刚刚'
  if (diff < 3600000) return `${Math.floor(diff / 60000)} 分钟前`
  if (diff < 86400000) return `${Math.floor(diff / 3600000)} 小时前`
  return d.toLocaleDateString('zh-CN', { month: 'short', day: 'numeric' })
}

export default function ChatPanel() {
  const chatMessages = useAppStore((s) => s.chatMessages)
  const chatSessions = useAppStore((s) => s.chatSessions)
  const activeSessionId = useAppStore((s) => s.activeSessionId)
  const addChatMessage = useAppStore((s) => s.addChatMessage)
  const newChatSession = useAppStore((s) => s.newChatSession)
  const switchSession = useAppStore((s) => s.switchSession)
  const deleteSession = useAppStore((s) => s.deleteSession)
  const setSelectedPage = useAppStore((s) => s.setSelectedPage)
  const kbId = useAppStore((s) => s.kbId)
  const pages = useAppStore((s) => s.pages)

  const [input, setInput] = useState('')
  const [sending, setSending] = useState(false)
  const [showHistory, setShowHistory] = useState(false)
  const messagesEndRef = useRef<HTMLDivElement>(null)

  // Scroll to bottom on new messages
  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' })
  }, [chatMessages])

  // 确保进入时选中最新会话
  useEffect(() => {
    if (kbId && chatSessions.length > 0 && !activeSessionId) {
      const last = chatSessions[chatSessions.length - 1]
      switchSession(last.id)
    }
  }, [kbId])

  const handleSend = async (question?: string) => {
    const q = (question || input).trim()
    if (!q || sending || !kbId) return

    const userMsg = { role: 'user' as const, content: q }
    addChatMessage(userMsg)
    if (!question) setInput('')
    setSending(true)

    try {
      const res = await fetch(`${API_BASE}/kb/${kbId}/wiki/query`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ question: q }),
      })
      const data = await res.json()
      addChatMessage({
        role: 'assistant',
        content: data.answer || '抱歉，未能获取到回答。',
        sources: data.sources || [],
      })
    } catch {
      addChatMessage({
        role: 'assistant',
        content: '请求失败，请检查后端服务是否运行。',
      })
    } finally {
      setSending(false)
    }
  }

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault()
      handleSend()
    }
  }

  const handleSourceClick = async (slug: string) => {
    if (!kbId) return
    try {
      const res = await fetch(`${API_BASE}/kb/${kbId}/wiki/pages/${slug}`)
      const data = await res.json()
      setSelectedPage(data)
    } catch (err) {
      console.error(err)
    }
  }

  return (
    <aside className="w-[420px] min-w-[420px] bg-white border-l border-gray-200 flex flex-col h-full">
      {/* Header */}
      <div className="px-5 py-4 border-b border-gray-200">
        <div className="flex items-center gap-2.5">
          <div className="w-9 h-9 bg-gradient-to-br from-purple-500 to-indigo-600 rounded-xl flex items-center justify-center">
            <span className="text-white text-base">✨</span>
          </div>
          <div className="flex-1 min-w-0">
            <h3 className="font-semibold text-gray-900 text-sm">知识库问答</h3>
            <p className="text-xs text-gray-400">
              向整个知识库提问
              {pages.length > 0 && <span> · {pages.length} 篇文档</span>}
            </p>
          </div>
          <button
            onClick={() => setShowHistory(!showHistory)}
            title="历史提问"
            className={`w-9 h-9 rounded-xl flex items-center justify-center text-base transition ${
              showHistory
                ? 'bg-purple-100 text-purple-600'
                : 'text-gray-400 hover:bg-gray-100 hover:text-gray-600'
            }`}
          >
            🕐
          </button>
          <button
            onClick={() => newChatSession()}
            title="新建对话"
            className="w-9 h-9 rounded-xl flex items-center justify-center text-gray-400 hover:bg-gray-100 hover:text-purple-600 transition text-lg"
          >
            ＋
          </button>
        </div>
      </div>

      {/* History Panel */}
      {showHistory && (
        <div className="border-b border-gray-200 bg-white">
          <div className="px-4 py-3 border-b border-gray-100">
            <div className="flex items-center justify-between">
              <span className="text-xs font-semibold text-gray-500">历史提问</span>
              <button
                onClick={() => newChatSession()}
                className="text-xs text-purple-600 hover:text-purple-700 font-medium"
              >
                ＋ 新建对话
              </button>
            </div>
          </div>
          <div className="max-h-[320px] overflow-y-auto">
            {chatSessions.length === 0 ? (
              <div className="px-4 py-8 text-center text-xs text-gray-400">
                暂无历史对话
              </div>
            ) : (
              [...chatSessions].reverse().map((s) => (
                <div
                  key={s.id}
                  className={`group flex items-center gap-3 px-4 py-3 cursor-pointer hover:bg-purple-50/50 transition border-b border-gray-50 ${
                    s.id === activeSessionId ? 'bg-purple-50' : ''
                  }`}
                >
                  <div
                    className="flex-1 min-w-0"
                    onClick={() => { switchSession(s.id); setShowHistory(false) }}
                  >
                    <div className="text-sm text-gray-800 truncate font-medium">
                      {s.id === activeSessionId && <span className="text-purple-500 mr-1">●</span>}
                      {s.title}
                    </div>
                    <div className="text-xs text-gray-400 mt-0.5">
                      {formatTime(s.createdAt)} · {s.messages.length} 条消息
                    </div>
                  </div>
                  <button
                    onClick={(e) => {
                      e.stopPropagation()
                      if (confirm('删除这条对话？')) deleteSession(s.id)
                    }}
                    className="opacity-0 group-hover:opacity-100 w-7 h-7 rounded-lg flex items-center justify-center text-red-400 hover:bg-red-50 hover:text-red-500 transition text-sm"
                  >
                    🗑
                  </button>
                </div>
              ))
            )}
          </div>
        </div>
      )}

      {/* Messages */}
      <div className="flex-1 overflow-y-auto px-4 py-4 space-y-5">
        {chatMessages.length === 0 && (
          <div className="flex flex-col items-center justify-center h-full px-4">
            <div className="w-16 h-16 bg-purple-50 rounded-2xl flex items-center justify-center mb-4">
              <span className="text-3xl">🤖</span>
            </div>
            <p className="text-gray-700 font-medium mb-1">你好，我是你的知识库助手</p>
            <p className="text-sm text-gray-400 text-center mb-6">
              我可以回答关于当前知识库的任何问题
            </p>

            {/* Suggested questions */}
            <div className="w-full space-y-2">
              <p className="text-xs text-gray-400 font-medium">💡 试试这样问我</p>
              {SUGGESTED_QUESTIONS.map((q, i) => (
                <button
                  key={i}
                  onClick={() => handleSend(q)}
                  className="w-full text-left px-4 py-2.5 bg-gray-50 hover:bg-purple-50 rounded-xl text-sm text-gray-600 hover:text-purple-700 transition border border-transparent hover:border-purple-200"
                >
                  {q}
                </button>
              ))}
            </div>
          </div>
        )}

        {chatMessages.map((msg, i) => (
          <div key={i} className={`flex gap-3 ${msg.role === 'user' ? 'flex-row-reverse' : ''}`}>
            {/* Avatar */}
            <div className={`w-8 h-8 rounded-lg flex items-center justify-center shrink-0 ${
              msg.role === 'user'
                ? 'bg-purple-600 text-white'
                : 'bg-gradient-to-br from-purple-100 to-indigo-100 text-purple-600'
            }`}>
              <span className="text-sm">{msg.role === 'user' ? '👤' : '✨'}</span>
            </div>

            {/* Bubble */}
            <div className={`flex-1 min-w-0 ${msg.role === 'user' ? 'flex justify-end' : ''}`}>
              <div className={`inline-block max-w-full px-4 py-3 rounded-2xl text-sm leading-relaxed ${
                msg.role === 'user'
                  ? 'bg-purple-600 text-white rounded-tr-md'
                  : 'bg-gray-50 text-gray-800 rounded-tl-md border border-gray-100'
              }`}>
                <div className="whitespace-pre-wrap">{msg.content}</div>

                {/* Sources */}
                {msg.sources && msg.sources.length > 0 && (
                  <div className="mt-3 pt-3 border-t border-gray-200">
                    <p className="text-xs text-gray-400 mb-2 font-medium">📎 参考文档</p>
                    <div className="flex flex-wrap gap-1.5">
                      {msg.sources.map((s, j) => (
                        <button
                          key={j}
                          onClick={() => handleSourceClick(s.slug)}
                          className="inline-flex items-center gap-1 px-2.5 py-1 bg-white border border-gray-200 rounded-lg text-xs text-gray-600 hover:border-purple-300 hover:text-purple-600 transition"
                        >
                          <span className="text-purple-400">📄</span>
                          {s.title}
                        </button>
                      ))}
                    </div>
                  </div>
                )}
              </div>
            </div>
          </div>
        ))}

        {sending && (
          <div className="flex gap-3">
            <div className="w-8 h-8 rounded-lg bg-gradient-to-br from-purple-100 to-indigo-100 flex items-center justify-center shrink-0">
              <span className="text-sm text-purple-400">✨</span>
            </div>
            <div className="px-4 py-3 rounded-2xl bg-gray-50 border border-gray-100 text-sm text-gray-400">
              <span className="flex items-center gap-2">
                <span className="w-2 h-2 bg-purple-400 rounded-full animate-bounce" style={{ animationDelay: '0ms' }} />
                <span className="w-2 h-2 bg-purple-400 rounded-full animate-bounce" style={{ animationDelay: '150ms' }} />
                <span className="w-2 h-2 bg-purple-400 rounded-full animate-bounce" style={{ animationDelay: '300ms' }} />
              </span>
            </div>
          </div>
        )}

        <div ref={messagesEndRef} />
      </div>

      {/* Input */}
      <div className="p-4 border-t border-gray-200">
        <div className="flex items-end gap-2 bg-gray-50 border border-gray-200 rounded-2xl px-4 py-2 focus-within:border-purple-400 focus-within:ring-2 focus-within:ring-purple-500/10 transition">
          <textarea
            value={input}
            onChange={(e) => setInput(e.target.value)}
            onKeyDown={handleKeyDown}
            placeholder="向知识库提问..."
            rows={1}
            className="flex-1 bg-transparent text-sm resize-none py-1.5 focus:outline-none placeholder-gray-400"
            style={{ maxHeight: '120px' }}
            onInput={(e) => {
              const target = e.target as HTMLTextAreaElement
              target.style.height = 'auto'
              target.style.height = Math.min(target.scrollHeight, 120) + 'px'
            }}
          />
          <button
            onClick={() => handleSend()}
            disabled={!input.trim() || sending}
            className="w-9 h-9 bg-purple-600 text-white rounded-xl flex items-center justify-center hover:bg-purple-700 transition disabled:opacity-40 disabled:cursor-not-allowed shrink-0"
          >
            <span className="text-base">➤</span>
          </button>
        </div>
      </div>
    </aside>
  )
}
