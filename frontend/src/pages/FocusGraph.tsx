import { useEffect, useState } from 'react'
import { useAppStore } from '../stores/appStore'

const API_BASE = '/api/v1'

interface FocusData {
  center: string
  nodes: { id: string; label: string; tags: string[]; color: string; problem?: string; approach?: string }[]
  links: { source: string; target: string; type: string; reason: string }[]
}

const REL_LABELS: Record<string, string> = {
  same_problem: '同类问题',
  related_method: '方法相关',
  complementary: '互补',
  similar: '相似',
  same_tag: '同标签',
  semantic: '语义关联',
}

const REL_COLORS: Record<string, string> = {
  same_problem: '#EF4444',
  related_method: '#3B82F6',
  complementary: '#10B981',
  similar: '#F59E0B',
  same_tag: '#A78BFA',
  semantic: '#EC4899',
}

export default function FocusGraph() {
  const selectedPage = useAppStore((s) => s.selectedPage)
  const setSelectedPage = useAppStore((s) => s.setSelectedPage)
  const setNavKey = useAppStore((s) => s.setNavKey)
  const kbId = useAppStore((s) => s.kbId)

  const [focusData, setFocusData] = useState<FocusData | null>(null)
  const [loading, setLoading] = useState(false)

  useEffect(() => {
    if (!selectedPage || !kbId) {
      setFocusData(null)
      return
    }
    setLoading(true)
    fetch(`${API_BASE}/kb/${kbId}/wiki/graph/focus/${selectedPage.slug}`)
      .then((r) => r.json())
      .then((data) => setFocusData(data))
      .catch(console.error)
      .finally(() => setLoading(false))
  }, [selectedPage, kbId])

  if (!selectedPage) {
    return (
      <div className="flex flex-col items-center justify-center h-full text-gray-400 p-6">
        <span className="text-5xl mb-4">🎯</span>
        <p className="text-base font-medium text-gray-500">请先在文档列表中点击一个文档</p>
        <p className="text-sm mt-1 text-gray-400">即可查看该文档的关联图谱</p>
      </div>
    )
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center h-full">
        <span className="animate-spin text-xl mr-2">⏳</span>
        <span className="text-sm text-gray-400">分析关联中...</span>
      </div>
    )
  }

  const centerNode = focusData?.nodes.find(n => n.id === focusData.center)
  const relatedNodes = focusData?.nodes.filter(n => n.id !== focusData.center) || []

  const getRelLink = (nodeId: string) => {
    if (!focusData) return null
    return focusData.links.find(
      l => (l.source === nodeId && l.target === focusData.center) ||
           (l.target === nodeId && l.source === focusData.center)
    )
  }

  const handleNodeClick = async (slug: string) => {
    if (!kbId) return
    try {
      const res = await fetch(`${API_BASE}/kb/${kbId}/wiki/pages/${slug}`)
      setSelectedPage(await res.json())
    } catch (err) {
      console.error(err)
    }
  }

  // Group related nodes by relationship type
  const getRelType = (rel: { type: string } | null | undefined) => rel?.type || 'semantic'
  const grouped = relatedNodes.reduce((acc, node) => {
    const rel = getRelLink(node.id)
    const type = getRelType(rel)
    if (!acc[type]) acc[type] = []
    acc[type].push({ node, rel })
    return acc
  }, {} as Record<string, { node: typeof relatedNodes[0]; rel: ReturnType<typeof getRelLink> }[]>)

  return (
    <div className="h-full overflow-y-auto p-6">
      <div className="max-w-3xl mx-auto space-y-6">
        {/* Back button */}
        <button
          onClick={() => { setSelectedPage(null); setNavKey('all') }}
          className="flex items-center gap-1.5 text-sm text-gray-400 hover:text-gray-600 transition"
        >
          <span>←</span> 返回文档列表
        </button>

        {/* Center document card */}
        <div className="bg-white rounded-xl border border-gray-200 overflow-hidden shadow-sm">
          {/* Colored header bar */}
          <div className="h-2" style={{ backgroundColor: centerNode?.color || '#8B5CF6' }} />
          <div className="p-5">
            <div className="flex items-center gap-2 mb-3">
              <span className="px-2 py-0.5 rounded text-[10px] font-medium text-white"
                style={{ backgroundColor: centerNode?.color || '#8B5CF6' }}>
                中心文档
              </span>
              {centerNode?.tags.map(t => (
                <span key={t} className="px-2 py-0.5 rounded text-[10px] bg-gray-100 text-gray-500">{t}</span>
              ))}
            </div>
            <h3 className="text-base font-bold text-gray-800 mb-3">{selectedPage.title}</h3>

            {centerNode?.problem && (
              <div className="p-3 bg-purple-50 rounded-lg mb-2">
                <p className="text-[10px] text-purple-500 font-semibold uppercase tracking-wider mb-1">💡 解决的问题</p>
                <p className="text-xs text-gray-600 leading-relaxed">{centerNode.problem}</p>
              </div>
            )}
            {centerNode?.approach && (
              <div className="p-3 bg-blue-50 rounded-lg">
                <p className="text-[10px] text-blue-500 font-semibold uppercase tracking-wider mb-1">🔧 解决方法</p>
                <p className="text-xs text-gray-600 leading-relaxed">{centerNode.approach}</p>
              </div>
            )}
          </div>
        </div>

        {/* Related documents - grouped by type */}
        {relatedNodes.length > 0 ? (
          <div>
            <h3 className="text-sm font-semibold text-gray-500 mb-3">
              🔗 关联文档（{relatedNodes.length}）
            </h3>
            <div className="space-y-3">
              {Object.entries(grouped).map(([type, items]) => (
                <div key={type}>
                  <p className="text-[10px] text-gray-400 uppercase tracking-wider mb-2 ml-1">
                    <span className="inline-block w-2 h-2 rounded-full mr-1.5 align-middle"
                      style={{ backgroundColor: REL_COLORS[type] || '#94A3B8' }} />
                    {REL_LABELS[type] || type} · {items.length} 篇
                  </p>
                  {items.map(({ node, rel }) => (
                    <button
                      key={node.id}
                      onClick={() => handleNodeClick(node.id)}
                      className="w-full text-left mb-2 last:mb-0 flex items-center gap-3 p-3 bg-white border border-gray-100 rounded-lg hover:border-gray-200 hover:shadow-sm transition group"
                    >
                      {/* Color indicator */}
                      <div
                        className="w-2 h-10 rounded-full shrink-0"
                        style={{ backgroundColor: node.color || '#94A3B8' }}
                      />
                      <div className="flex-1 min-w-0">
                        <h4 className="text-sm font-medium text-gray-700 group-hover:text-purple-600 transition truncate">
                          {node.label}
                        </h4>
                        {rel?.reason && (
                          <p className="text-[11px] text-gray-400 mt-0.5 truncate">{rel.reason}</p>
                        )}
                        {node.tags.length > 0 && (
                          <div className="flex gap-1 mt-1.5">
                            {node.tags.slice(0, 3).map(t => (
                              <span key={t} className="px-1.5 py-px rounded text-[10px] bg-gray-100 text-gray-400">{t}</span>
                            ))}
                          </div>
                        )}
                      </div>
                      <span className="text-gray-300 group-hover:text-purple-400 transition shrink-0">→</span>
                    </button>
                  ))}
                </div>
              ))}
            </div>
          </div>
        ) : (
          <div className="flex items-center justify-center py-16 text-gray-400">
            <div className="text-center">
              <span className="text-4xl mb-3 block">🔗</span>
              <p className="text-sm">此文档暂无与其他文档的关联</p>
              <p className="text-xs mt-1 text-gray-300">添加更多文档后，AI 将自动发现语义关联</p>
            </div>
          </div>
        )}

        {/* Bottom legend */}
        <div className="flex justify-center gap-5 pt-4 border-t border-gray-100 flex-wrap">
          {Object.entries(REL_COLORS).map(([type, color]) => (
            <span key={type} className="text-[11px] text-gray-400 flex items-center gap-1.5">
              <span className="w-2 h-2 rounded-full" style={{ backgroundColor: color }} />
              {REL_LABELS[type] || type}
            </span>
          ))}
        </div>
      </div>
    </div>
  )
}
