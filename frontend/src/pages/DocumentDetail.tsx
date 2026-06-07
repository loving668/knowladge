import { useState } from 'react'
import { useAppStore } from '../stores/appStore'

const API_BASE = '/api/v1'

const CATEGORY_META: Record<string, { name: string; color: string }> = {
  entities: { name: '实体', color: '#3B82F6' },
  concepts: { name: '概念', color: '#10B981' },
  summaries: { name: '摘要', color: '#8B5CF6' },
  synthesis: { name: '综合', color: '#F59E0B' },
  queries: { name: '问答', color: '#EF4444' },
}

export default function DocumentDetail() {
  const selectedPage = useAppStore((s) => s.selectedPage)
  const setSelectedPage = useAppStore((s) => s.setSelectedPage)
  const kbId = useAppStore((s) => s.kbId)
  const triggerRefresh = useAppStore((s) => s.triggerRefresh)

  const [docQuestion, setDocQuestion] = useState('')
  const [docAnswer, setDocAnswer] = useState('')
  const [docAsking, setDocAsking] = useState(false)

  if (!selectedPage) {
    return (
      <div className="flex items-center justify-center h-full text-gray-400">
        <p>未选择文档</p>
      </div>
    )
  }

  const handleDelete = async () => {
    if (!confirm(`确定删除「${selectedPage.title}」？此操作不可撤销。`)) return
    try {
      await fetch(`${API_BASE}/kb/${kbId}/wiki/pages/${selectedPage.slug}`, { method: 'DELETE' })
      setSelectedPage(null)
      triggerRefresh()
    } catch (err) {
      console.error(err)
    }
  }

  const handleBacklinkClick = async (slug: string) => {
    try {
      const res = await fetch(`${API_BASE}/kb/${kbId}/wiki/pages/${slug}`)
      const data = await res.json()
      setSelectedPage(data)
    } catch (err) {
      console.error(err)
    }
  }

  const handleDocAsk = async () => {
    if (!docQuestion.trim() || docAsking || !kbId) return
    setDocAsking(true)
    setDocAnswer('')
    try {
      const res = await fetch(`${API_BASE}/kb/${kbId}/wiki/query`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          question: docQuestion,
          context_slug: selectedPage?.slug,
        }),
      })
      const data = await res.json()
      setDocAnswer(data.answer || '抱歉，未能获取到回答。')
    } catch {
      setDocAnswer('请求失败，请重试。')
    } finally {
      setDocAsking(false)
    }
  }

  const catMeta = CATEGORY_META[selectedPage.category]

  return (
    <div className="flex flex-col h-full bg-white">
      {/* Header */}
      <div className="px-8 py-5 border-b border-gray-200">
        <button
          onClick={() => setSelectedPage(null)}
          className="flex items-center gap-1.5 text-sm text-gray-500 hover:text-gray-700 mb-3 transition"
        >
          <span>←</span>
          <span>返回列表</span>
        </button>
        <div className="flex items-start justify-between">
          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-2 mb-2 flex-wrap">
              {catMeta && (
                <span
                  className="px-2.5 py-0.5 rounded text-xs font-medium text-white"
                  style={{ backgroundColor: catMeta.color }}
                >
                  {catMeta.name}
                </span>
              )}
              {selectedPage.frontmatter.tags?.map((tag) => (
                <span
                  key={tag}
                  className="px-2.5 py-0.5 rounded text-xs bg-gray-100 text-gray-700"
                >
                  {tag}
                </span>
              ))}
            </div>
            <h1 className="text-2xl font-bold text-gray-900">{selectedPage.title}</h1>
          </div>
          <div className="flex gap-2 shrink-0 ml-4">
            <button
              onClick={handleDelete}
              className="px-4 py-2 text-red-600 hover:bg-red-50 rounded-lg text-sm font-medium transition"
            >
              🗑️ 删除
            </button>
          </div>
        </div>
      </div>

      {/* Content */}
      <div className="flex-1 overflow-y-auto px-8 py-6">
        <div className="max-w-3xl">
          <div className="text-gray-700 whitespace-pre-wrap leading-relaxed text-base">
            {selectedPage.content || '（无内容）'}
          </div>

          {/* Inline document Q&A */}
          <div className="mt-10 pt-6 border-t border-gray-200">
            <h3 className="text-lg font-semibold text-gray-900 mb-3">💬 针对本文档提问</h3>
            <div className="flex gap-2">
              <input
                type="text"
                value={docQuestion}
                onChange={e => setDocQuestion(e.target.value)}
                onKeyDown={e => { if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); handleDocAsk() } }}
                placeholder="例如：这个文档的主要内容是什么？"
                className="flex-1 px-4 py-2.5 border border-gray-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-purple-500/20 focus:border-purple-500 transition"
              />
              <button
                onClick={handleDocAsk}
                disabled={docAsking || !docQuestion.trim()}
                className="px-4 py-2.5 bg-purple-600 text-white rounded-lg text-sm font-medium hover:bg-purple-700 transition disabled:opacity-50"
              >
                {docAsking ? '…' : '提问'}
              </button>
            </div>
            {docAnswer && (
              <div className="mt-3 p-4 bg-purple-50 rounded-xl text-sm text-gray-700 leading-relaxed">
                {docAnswer}
              </div>
            )}
          </div>

          {/* Backlinks */}
          {selectedPage.backlinks && selectedPage.backlinks.length > 0 && (
            <div className="mt-10 pt-6 border-t border-gray-200">
              <h3 className="text-lg font-semibold text-gray-900 mb-3">🔗 相关页面</h3>
              <div className="flex flex-wrap gap-2">
                {selectedPage.backlinks.map((bl) => (
                  <button
                    key={bl.slug}
                    onClick={() => handleBacklinkClick(bl.slug)}
                    className="px-4 py-2 bg-purple-50 text-purple-700 rounded-lg hover:bg-purple-100 transition text-sm"
                  >
                    {bl.title}
                  </button>
                ))}
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  )
}
