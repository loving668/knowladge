import { useEffect, useState } from 'react'
import { useAppStore } from '../stores/appStore'

const API_BASE = '/api/v1'

interface KBStats {
  id: string
  name: string
  doc_count: number
  created_at: string
}

export default function Dashboard() {
  const setNavKey = useAppStore((s) => s.setNavKey)
  const setKbId = useAppStore((s) => s.setKbId)
  const kbList = useAppStore((s) => s.kbList)

  const [stats, setStats] = useState<{ total_kbs: number; total_docs: number; knowledge_bases: KBStats[] } | null>(null)

  useEffect(() => {
    fetch(`${API_BASE}/kb/stats`)
      .then(r => r.json())
      .then(data => setStats(data))
      .catch(console.error)
  }, [kbList])

  const handleEnterKB = (id: string) => {
    setKbId(id)
    setNavKey('all')
  }

  return (
    <div className="p-6 overflow-y-auto h-full">
      <div className="max-w-5xl mx-auto space-y-6">
        {/* Header */}
        <div>
          <h2 className="text-2xl font-bold text-gray-900">仪表盘</h2>
          <p className="text-sm text-gray-500 mt-1">知识库总览</p>
        </div>

        {/* Global Stats */}
        <div className="grid grid-cols-3 gap-4">
          <div className="p-5 bg-white rounded-xl border border-gray-200">
            <div className="text-sm font-medium text-gray-500 mb-1">知识库总数</div>
            <div className="text-3xl font-bold text-purple-600">
              {stats ? stats.total_kbs : '--'}
            </div>
          </div>
          <div className="p-5 bg-white rounded-xl border border-gray-200">
            <div className="text-sm font-medium text-gray-500 mb-1">文档总数</div>
            <div className="text-3xl font-bold text-indigo-600">
              {stats ? stats.total_docs : '--'}
            </div>
          </div>
          <div className="p-5 bg-gradient-to-br from-purple-500 to-indigo-600 rounded-xl">
            <div className="text-2xl mb-2">💬</div>
            <div className="font-semibold text-white">智能问答</div>
            <div className="text-xs text-white/70 mt-1">向知识库提问</div>
          </div>
        </div>

        {/* Quick Actions */}
        <div className="grid grid-cols-3 gap-4">
          <button
            onClick={() => {
              if (kbList.length > 0) {
                setKbId(kbList[0].id)
                setNavKey('ingest')
              }
            }}
            className="p-5 bg-white rounded-xl border border-gray-200 hover:border-purple-300 hover:shadow-md transition text-left group"
          >
            <div className="text-3xl mb-3">📥</div>
            <h3 className="font-semibold text-gray-900 group-hover:text-purple-600 transition">导入文档</h3>
            <p className="text-xs text-gray-500 mt-1">上传文件到知识库</p>
          </button>
          <button
            onClick={() => {
              if (kbList.length > 0) {
                setKbId(kbList[0].id)
                setNavKey('graph')
              }
            }}
            className="p-5 bg-white rounded-xl border border-gray-200 hover:border-purple-300 hover:shadow-md transition text-left group"
          >
            <div className="text-3xl mb-3">🕸️</div>
            <h3 className="font-semibold text-gray-900 group-hover:text-purple-600 transition">知识图谱</h3>
            <p className="text-xs text-gray-500 mt-1">可视化知识关联</p>
          </button>
          <button
            onClick={() => {
              if (kbList.length > 0) {
                setKbId(kbList[0].id)
                setNavKey('all')
              }
            }}
            className="p-5 bg-white rounded-xl border border-gray-200 hover:border-purple-300 hover:shadow-md transition text-left group"
          >
            <div className="text-3xl mb-3">📋</div>
            <h3 className="font-semibold text-gray-900 group-hover:text-purple-600 transition">浏览文档</h3>
            <p className="text-xs text-gray-500 mt-1">查看全部知识文档</p>
          </button>
        </div>

        {/* Knowledge Base Cards */}
        <div>
          <h3 className="text-lg font-semibold text-gray-900 mb-4">📚 我的知识库</h3>
          {!stats ? (
            <div className="text-center py-12 text-gray-400">加载中...</div>
          ) : stats.knowledge_bases.length === 0 ? (
            <div className="text-center py-12 bg-white rounded-xl border border-gray-200">
              <div className="text-4xl mb-3">📭</div>
              <p className="text-gray-500 mb-4">还没有知识库</p>
              <button
                onClick={() => {
                  // Click the "新建知识库" button in sidebar
                  const sidebarBtn = document.querySelector('[data-action="create-kb"]') as HTMLButtonElement
                  sidebarBtn?.click()
                }}
                className="px-4 py-2 bg-purple-600 text-white rounded-lg text-sm font-medium hover:bg-purple-700 transition"
              >
                ＋ 新建知识库
              </button>
            </div>
          ) : (
            <div className="grid grid-cols-1 gap-2">
              {stats.knowledge_bases.map((kb) => (
                <div
                  key={kb.id}
                  className="bg-white rounded-lg border border-gray-100 hover:border-purple-200 hover:bg-purple-50/30 transition px-4 py-3 flex items-center gap-3 cursor-pointer group"
                  onClick={() => handleEnterKB(kb.id)}
                >
                  <span className="text-xl shrink-0">📁</span>
                  <div className="flex-1 min-w-0">
                    <h4 className="text-sm font-medium text-gray-800 group-hover:text-purple-600 transition truncate">
                      {kb.name}
                    </h4>
                    <p className="text-[11px] text-gray-400 mt-0.5">
                      {new Date(kb.created_at).toLocaleDateString('zh-CN')} · {kb.doc_count} 篇文档
                    </p>
                  </div>
                  <span className="text-gray-300 group-hover:text-purple-400 transition">→</span>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  )
}
