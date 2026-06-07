import { useState } from 'react'
import { useAppStore } from '../stores/appStore'
import type { KBInfo } from '../stores/appStore'

const API_BASE = '/api/v1'

export default function Sidebar() {
  const navKey = useAppStore((s) => s.navKey)
  const setNavKey = useAppStore((s) => s.setNavKey)
  const searchQuery = useAppStore((s) => s.searchQuery)
  const setSearchQuery = useAppStore((s) => s.setSearchQuery)
  const pages = useAppStore((s) => s.pages)
  const kbId = useAppStore((s) => s.kbId)
  const setKbId = useAppStore((s) => s.setKbId)
  const kbList = useAppStore((s) => s.kbList)
  const setKbList = useAppStore((s) => s.setKbList)
  const setPages = useAppStore((s) => s.setPages)

  const [showCreateKb, setShowCreateKb] = useState(false)
  const [newKbName, setNewKbName] = useState('')

  // 文件夹标签（当前 KB 内）
  const folderTags = [...new Set(pages.flatMap(p => p.tags || []).filter(t => t && !t.includes('未解析') && !t.match(/^(file|text|web)$/)))].sort()
  const totalDocs = pages.length
  const folderCounts: Record<string, number> = {}
  for (const p of pages) {
    for (const t of p.tags || []) {
      folderCounts[t] = (folderCounts[t] || 0) + 1
    }
  }

  const currentKb = kbList.find(k => k.id === kbId)

  const handleCreateKb = async () => {
    if (!newKbName.trim()) return
    try {
      const res = await fetch(`${API_BASE}/kb`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ name: newKbName.trim() })
      })
      const data = await res.json()
      if (data.knowledge_base) {
        const kb: KBInfo = data.knowledge_base
        setKbList([...kbList, kb])
        setKbId(kb.id)
        setNavKey('all')
        setShowCreateKb(false)
        setNewKbName('')
      }
    } catch (err) {
      console.error(err)
    }
  }

  const handleDeleteKb = async (targetKbId: string, e: React.MouseEvent) => {
    e.stopPropagation()
    const target = kbList.find(k => k.id === targetKbId)
    if (!target) return
    if (!confirm(`确定删除「${target.name}」吗？所有文档将被永久删除！`)) return
    try {
      await fetch(`${API_BASE}/kb/${targetKbId}`, { method: 'DELETE' })
      const updated = kbList.filter(k => k.id !== targetKbId)
      setKbList(updated)
      if (targetKbId === kbId) {
        const next = updated.length > 0 ? updated[0] : null
        setKbId(next?.id || '')
        setPages([])
        if (!next) setNavKey('dashboard')
      }
    } catch (err) {
      console.error(err)
    }
  }

  const handleSelectKb = (id: string) => {
    if (id !== kbId) {
      setKbId(id)
    }
    setNavKey('all')
  }

  const kbNavActive = kbId && navKey !== 'dashboard'

  return (
    <aside className="w-[280px] min-w-[280px] bg-white border-r border-gray-200 flex flex-col h-full">
      {/* Brand */}
      <div className="px-5 py-4 bg-gradient-to-r from-purple-600 to-indigo-600">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 bg-white/20 rounded-lg flex items-center justify-center">
            <span className="text-white text-xl">📚</span>
          </div>
          <div>
            <h1 className="text-white font-bold text-lg">LLM Wiki</h1>
            <p className="text-white/70 text-xs">知识库问答系统</p>
          </div>
        </div>
      </div>

      {/* Dashboard */}
      <div className="p-3">
        <button
          onClick={() => setNavKey('dashboard')}
          className={`w-full flex items-center gap-3 px-4 py-2.5 rounded-lg text-sm font-medium transition ${
            navKey === 'dashboard'
              ? 'bg-purple-50 text-purple-700'
              : 'text-gray-700 hover:bg-gray-50'
          }`}
        >
          <span className="text-lg">🏠</span>
          仪表盘
        </button>
      </div>

      <div className="mx-3 border-t border-gray-100" />

      {/* Knowledge Base List */}
      <div className="flex-1 overflow-y-auto">
        <div className="px-3 pt-3 pb-1">
          <p className="px-4 py-1 text-xs font-semibold text-gray-400 uppercase tracking-wider">
            我的知识库
          </p>
        </div>
        <div className="px-3 space-y-0.5">
          {kbList.map((kb) => (
            <div key={kb.id} className="group relative">
              <button
                onClick={() => handleSelectKb(kb.id)}
                className={`w-full flex items-center gap-3 px-4 py-2.5 rounded-lg text-sm font-medium transition text-left ${
                  kb.id === kbId && navKey !== 'dashboard'
                    ? 'bg-purple-50 text-purple-700'
                    : 'text-gray-700 hover:bg-gray-50'
                }`}
              >
                <span className="text-lg">{kb.id === kbId && navKey !== 'dashboard' ? '📂' : '📁'}</span>
                <span className="truncate flex-1">{kb.name}</span>
              </button>
              <button
                onClick={(e) => handleDeleteKb(kb.id, e)}
                className="absolute right-2 top-1/2 -translate-y-1/2 opacity-0 group-hover:opacity-100 px-2 py-1 text-xs text-red-400 hover:bg-red-50 rounded transition"
                title="删除知识库"
              >
                🗑
              </button>
            </div>
          ))}

          {/* New KB Button */}
          {showCreateKb ? (
            <div className="p-2 bg-purple-50 rounded-lg mt-1">
              <input
                type="text"
                value={newKbName}
                onChange={e => setNewKbName(e.target.value)}
                onKeyDown={e => e.key === 'Enter' && handleCreateKb()}
                placeholder="知识库名称..."
                className="w-full text-sm px-3 py-2 border border-purple-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-purple-500/20 mb-2"
                autoFocus
              />
              <div className="flex gap-2">
                <button
                  onClick={handleCreateKb}
                  className="flex-1 px-3 py-1.5 bg-purple-600 text-white text-xs rounded-lg hover:bg-purple-700 transition"
                >
                  创建
                </button>
                <button
                  onClick={() => { setShowCreateKb(false); setNewKbName('') }}
                  className="px-3 py-1.5 bg-gray-200 text-gray-600 text-xs rounded-lg hover:bg-gray-300 transition"
                >
                  取消
                </button>
              </div>
            </div>
          ) : (
            <button
              onClick={() => setShowCreateKb(true)}
              className="w-full flex items-center gap-3 px-4 py-2.5 rounded-lg text-sm font-medium text-purple-600 hover:bg-purple-50 transition mt-1"
            >
              <span className="text-lg">＋</span>
              新建知识库
            </button>
          )}
        </div>

        {/* KB Sub-navigation (only shown when a KB is selected and not on dashboard) */}
        {kbNavActive && currentKb && (
          <>
            <div className="mx-3 my-2 border-t border-gray-100" />

            <div className="px-3 pb-1">
              <p className="px-4 py-1 text-xs font-semibold text-gray-400 uppercase tracking-wider truncate">
                {currentKb.name}
              </p>
            </div>

            {/* Search */}
            <div className="px-3 pb-2">
              <div className="relative">
                <span className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400 text-sm">🔍</span>
                <input
                  type="text"
                  placeholder="搜索文档..."
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  className="w-full pl-10 pr-4 py-2 bg-gray-100 border border-gray-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-purple-500/20 focus:border-purple-500 transition"
                />
              </div>
            </div>

            <div className="px-3 space-y-0.5">
              <button
                onClick={() => setNavKey('all')}
                className={`w-full flex items-center gap-3 px-4 py-2.5 rounded-lg text-sm font-medium transition ${
                  navKey === 'all' ? 'bg-purple-50 text-purple-700' : 'text-gray-700 hover:bg-gray-50'
                }`}
              >
                <span className="text-lg">📋</span>
                全部文档
                <span className="ml-auto text-xs bg-gray-200 text-gray-600 px-2 py-0.5 rounded-full">{totalDocs}</span>
              </button>

              <button
                onClick={() => setNavKey('graph')}
                className={`w-full flex items-center gap-3 px-4 py-2.5 rounded-lg text-sm font-medium transition ${
                  navKey === 'graph' ? 'bg-purple-50 text-purple-700' : 'text-gray-700 hover:bg-gray-50'
                }`}
              >
                <span className="text-lg">🕸️</span>
                知识图谱
              </button>

              <button
                onClick={() => setNavKey('ingest')}
                className={`w-full flex items-center gap-3 px-4 py-2.5 rounded-lg text-sm font-medium transition ${
                  navKey === 'ingest' ? 'bg-purple-50 text-purple-700' : 'text-gray-700 hover:bg-gray-50'
                }`}
              >
                <span className="text-lg">📥</span>
                导入文档
              </button>
            </div>

            {/* Tags / Folders */}
            {folderTags.length > 0 && (
              <div className="px-3 mt-3">
                <p className="px-4 py-1 text-xs font-semibold text-gray-400 uppercase tracking-wider">标签分类</p>
                <div className="space-y-0.5 mt-1">
                  {folderTags.map((tag) => (
                    <button
                      key={tag}
                      onClick={() => { setSearchQuery(tag); setNavKey('all') }}
                      className="w-full flex items-center gap-3 px-4 py-2 rounded-lg text-sm text-gray-600 hover:bg-gray-50 transition"
                    >
                      <span className="text-base">🏷️</span>
                      <span className="truncate">{tag}</span>
                      <span className="ml-auto text-xs text-gray-400">{folderCounts[tag] || 0}</span>
                    </button>
                  ))}
                </div>
              </div>
            )}
          </>
        )}
      </div>
    </aside>
  )
}
