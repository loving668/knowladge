import { useAppStore } from '../stores/appStore'

const CATEGORY_META: Record<string, { name: string; icon: string; color: string }> = {
  dashboard: { name: '仪表盘', icon: '🏠', color: '#8B5CF6' },
  all: { name: '全部文档', icon: '📋', color: '#6B7280' },
  entities: { name: '实体', icon: '👥', color: '#3B82F6' },
  concepts: { name: '概念', icon: '💡', color: '#10B981' },
  summaries: { name: '摘要', icon: '📝', color: '#8B5CF6' },
  synthesis: { name: '综合', icon: '📊', color: '#F59E0B' },
  queries: { name: '问答', icon: '💬', color: '#EF4444' },
  graph: { name: '知识图谱', icon: '🕸️', color: '#EC4899' },
  ingest: { name: '文档摄入', icon: '📥', color: '#6366F1' },
}

export default function TopBar() {
  const navKey = useAppStore((s) => s.navKey)
  const selectedPage = useAppStore((s) => s.selectedPage)
  const setSelectedPage = useAppStore((s) => s.setSelectedPage)
  const graphMode = useAppStore((s) => s.graphMode)
  const setGraphMode = useAppStore((s) => s.setGraphMode)

  const meta = CATEGORY_META[navKey] || { name: '文档', icon: '📄', color: '#6B7280' }

  return (
    <header className="h-16 min-h-[64px] bg-white border-b border-gray-200 flex items-center justify-between px-6">
      <div className="flex items-center gap-4 min-w-0">
        {selectedPage && (
          <button
            onClick={() => setSelectedPage(null)}
            className="flex items-center gap-1.5 px-3 py-1.5 text-sm text-gray-600 hover:bg-gray-100 rounded-lg transition shrink-0"
          >
            <span>←</span>
            <span>返回</span>
          </button>
        )}
        <div className="flex items-center gap-3 min-w-0">
          <span className="text-2xl">{selectedPage ? '📄' : meta.icon}</span>
          <div className="min-w-0">
            <h2 className="text-lg font-bold text-gray-900 truncate">
              {selectedPage ? selectedPage.title : meta.name}
            </h2>
            {!selectedPage && (
              <p className="text-xs text-gray-500">
                {navKey === 'dashboard'
                  ? '知识库概览'
                  : navKey === 'graph'
                  ? '可视化探索知识网络'
                  : navKey === 'ingest'
                  ? '导入文档构建知识库'
                  : '浏览和管理知识文档'}
              </p>
            )}
          </div>
        </div>
      </div>

      {/* Graph Mode Tabs */}
      {navKey === 'graph' && !selectedPage && (
        <div className="flex bg-gray-100 rounded-lg p-1">
          <button
            onClick={() => setGraphMode('global')}
            className={`px-4 py-1.5 rounded-md text-sm font-medium transition ${
              graphMode === 'global'
                ? 'bg-white text-purple-700 shadow-sm'
                : 'text-gray-600 hover:text-gray-900'
            }`}
          >
            🌐 全局
          </button>
          <button
            onClick={() => setGraphMode('focus')}
            className={`px-4 py-1.5 rounded-md text-sm font-medium transition ${
              graphMode === 'focus'
                ? 'bg-white text-purple-700 shadow-sm'
                : 'text-gray-600 hover:text-gray-900'
            }`}
          >
            🎯 聚焦
          </button>
        </div>
      )}

      {/* Spacer when no right content */}
      {!(navKey === 'graph' && !selectedPage) && <div />}
    </header>
  )
}
