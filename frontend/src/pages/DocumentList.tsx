import { useState, useEffect, useRef } from 'react'
import { useAppStore } from '../stores/appStore'

const API_BASE = '/api/v1'

const CATEGORY_META: Record<string, { name: string; color: string }> = {
  summaries: { name: '文档', color: '#8B5CF6' },
  synthesis: { name: '综合', color: '#F59E0B' },
  queries: { name: '问答', color: '#EF4444' },
}

interface ContextMenuState {
  x: number
  y: number
  page: { slug: string; title: string; tags: string[] }
}

export default function DocumentList() {
  const navKey = useAppStore((s) => s.navKey)
  const searchQuery = useAppStore((s) => s.searchQuery)
  const pages = useAppStore((s) => s.pages)
  const setSelectedPage = useAppStore((s) => s.setSelectedPage)
  const kbId = useAppStore((s) => s.kbId)
  const triggerRefresh = useAppStore((s) => s.triggerRefresh)

  // Right-click context menu
  const [ctxMenu, setCtxMenu] = useState<ContextMenuState | null>(null)
  // Tag edit modal
  const [tagModal, setTagModal] = useState<{ slug: string; title: string; tags: string[] } | null>(null)
  const [newTag, setNewTag] = useState('')
  const [tagSaving, setTagSaving] = useState(false)
  // Delete confirm
  const [deleteTarget, setDeleteTarget] = useState<{ slug: string; title: string } | null>(null)
  const [deleting, setDeleting] = useState(false)

  const menuRef = useRef<HTMLDivElement>(null)

  // Close context menu on click outside
  useEffect(() => {
    if (!ctxMenu) return
    const handler = () => setCtxMenu(null)
    document.addEventListener('click', handler)
    return () => document.removeEventListener('click', handler)
  }, [ctxMenu])

  const filteredPages = pages.filter((p) => {
    // 排除归档查询，不混入知识库文档
    if (p.category === 'queries') return false
    const matchSearch =
      !searchQuery ||
      p.title.toLowerCase().includes(searchQuery.toLowerCase()) ||
      p.tags?.some((t) => t.toLowerCase().includes(searchQuery.toLowerCase()))
    const matchCategory = navKey === 'all' || p.category === navKey
    return matchSearch && matchCategory
  })

  const handlePageClick = async (slug: string) => {
    try {
      const res = await fetch(`${API_BASE}/kb/${kbId}/wiki/pages/${slug}`)
      const data = await res.json()
      setSelectedPage(data)
    } catch (err) {
      console.error(err)
    }
  }

  const handleContextMenu = (e: React.MouseEvent, page: typeof filteredPages[0]) => {
    e.preventDefault()
    // Ensure menu stays within viewport
    const x = Math.min(e.clientX, window.innerWidth - 180)
    const y = Math.min(e.clientY, window.innerHeight - 120)
    setCtxMenu({ x, y, page: { slug: page.slug, title: page.title, tags: page.tags || [] } })
  }

  // Tag operations
  const openTagModal = () => {
    if (!ctxMenu) return
    setTagModal({ slug: ctxMenu.page.slug, title: ctxMenu.page.title, tags: [...ctxMenu.page.tags] })
    setNewTag('')
    setCtxMenu(null)
  }

  const addTag = () => {
    const t = newTag.trim()
    if (t && tagModal && !tagModal.tags.includes(t)) {
      setTagModal({ ...tagModal, tags: [...tagModal.tags, t] })
      setNewTag('')
    }
  }

  const removeTag = (tag: string) => {
    if (tagModal) {
      setTagModal({ ...tagModal, tags: tagModal.tags.filter((t) => t !== tag) })
    }
  }

  const saveTags = async () => {
    if (!tagModal || !kbId) return
    setTagSaving(true)
    try {
      await fetch(`${API_BASE}/kb/${kbId}/wiki/pages/${tagModal.slug}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ tags: tagModal.tags }),
      })
      setTagModal(null)
      triggerRefresh()
    } catch (err) {
      console.error(err)
    }
    setTagSaving(false)
  }

  // Delete operations
  const confirmDelete = () => {
    if (!ctxMenu) return
    setDeleteTarget({ slug: ctxMenu.page.slug, title: ctxMenu.page.title })
    setCtxMenu(null)
  }

  const doDelete = async () => {
    if (!deleteTarget || !kbId) return
    setDeleting(true)
    try {
      await fetch(`${API_BASE}/kb/${kbId}/wiki/pages/${deleteTarget.slug}`, {
        method: 'DELETE',
      })
      setDeleteTarget(null)
      triggerRefresh()
    } catch (err) {
      console.error(err)
    }
    setDeleting(false)
  }

  const categoryName = navKey === 'all' ? '全部文档' : CATEGORY_META[navKey]?.name || navKey

  return (
    <div className="p-6 overflow-y-auto h-full">
      <div className="max-w-4xl mx-auto">
        <div className="mb-6">
          <h2 className="text-xl font-bold text-gray-900">{categoryName}</h2>
          <p className="text-sm text-gray-500 mt-1">共 {filteredPages.length} 个文档，右键可操作</p>
        </div>

        {filteredPages.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-24 text-gray-400">
            <span className="text-6xl mb-4">📚</span>
            <p className="text-lg">暂无文档</p>
            <p className="text-sm mt-1">
              {searchQuery ? '尝试修改搜索条件' : '点击左侧"文档摄入"开始添加'}
            </p>
          </div>
        ) : (
          <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 gap-3">
            {filteredPages.map((page) => (
              <button
                key={page.slug}
                onClick={() => handlePageClick(page.slug)}
                onContextMenu={(e) => handleContextMenu(e, page)}
                className="text-left p-3 bg-white border border-gray-100 rounded-lg hover:border-purple-200 hover:shadow-sm transition group"
              >
                <div className="text-2xl mb-2">📄</div>
                <h3 className="text-xs font-medium text-gray-700 group-hover:text-purple-600 transition line-clamp-2 leading-snug">
                  {page.title}
                </h3>
                {page.tags && page.tags.length > 0 && (
                  <div className="flex flex-wrap gap-1 mt-2">
                    {page.tags.slice(0, 2).map((tag) => (
                      <span key={tag} className="px-1.5 py-px rounded text-[10px] bg-gray-100 text-gray-400">
                        {tag}
                      </span>
                    ))}
                    {page.tags.length > 2 && (
                      <span className="text-[10px] text-gray-300">+{page.tags.length - 2}</span>
                    )}
                  </div>
                )}
              </button>
            ))}
          </div>
        )}

        {/* Context Menu */}
        {ctxMenu && (
          <div
            ref={menuRef}
            className="fixed z-50 bg-white rounded-xl shadow-lg border border-gray-200 py-1.5 w-40"
            style={{ left: ctxMenu.x, top: ctxMenu.y }}
          >
            <button
              onClick={openTagModal}
              className="w-full text-left px-4 py-2.5 text-sm text-gray-700 hover:bg-purple-50 hover:text-purple-700 transition flex items-center gap-2"
            >
              <span>🏷️</span> 编辑标签
            </button>
            <div className="border-t border-gray-100 my-1" />
            <button
              onClick={confirmDelete}
              className="w-full text-left px-4 py-2.5 text-sm text-red-600 hover:bg-red-50 transition flex items-center gap-2"
            >
              <span>🗑️</span> 删除文档
            </button>
          </div>
        )}

        {/* Tag Edit Modal */}
        {tagModal && (
          <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40" onClick={() => setTagModal(null)}>
            <div
              className="bg-white rounded-2xl shadow-2xl w-full max-w-md mx-4 p-6"
              onClick={(e) => e.stopPropagation()}
            >
              <h3 className="text-lg font-bold text-gray-900 mb-1">编辑标签</h3>
              <p className="text-sm text-gray-500 mb-4">{tagModal.title}</p>

              {/* Current tags */}
              <div className="flex flex-wrap gap-2 mb-4">
                {tagModal.tags.map((tag) => (
                  <span
                    key={tag}
                    className="inline-flex items-center gap-1.5 px-3 py-1.5 bg-purple-100 text-purple-700 rounded-lg text-sm"
                  >
                    {tag}
                    <button
                      onClick={() => removeTag(tag)}
                      className="text-purple-400 hover:text-purple-700"
                    >✕</button>
                  </span>
                ))}
                {tagModal.tags.length === 0 && (
                  <span className="text-sm text-gray-400">暂无标签</span>
                )}
              </div>

              {/* Add tag input */}
              <div className="flex gap-2 mb-6">
                <input
                  type="text"
                  value={newTag}
                  onChange={(e) => setNewTag(e.target.value)}
                  onKeyDown={(e) => e.key === 'Enter' && addTag()}
                  placeholder="输入标签名"
                  className="flex-1 px-3 py-2 border border-gray-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-purple-500/20 focus:border-purple-500"
                />
                <button
                  onClick={addTag}
                  disabled={!newTag.trim()}
                  className="px-4 py-2 bg-gray-100 text-gray-700 rounded-lg text-sm hover:bg-gray-200 transition disabled:opacity-50"
                >添加</button>
              </div>

              <div className="flex gap-3 justify-end">
                <button
                  onClick={() => setTagModal(null)}
                  className="px-4 py-2 text-sm text-gray-600 hover:bg-gray-100 rounded-lg transition"
                >取消</button>
                <button
                  onClick={saveTags}
                  disabled={tagSaving}
                  className="px-4 py-2 bg-purple-600 text-white text-sm rounded-lg hover:bg-purple-700 transition disabled:opacity-50"
                >
                  {tagSaving ? '保存中...' : '保存'}
                </button>
              </div>
            </div>
          </div>
        )}

        {/* Delete Confirm Dialog */}
        {deleteTarget && (
          <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40" onClick={() => setDeleteTarget(null)}>
            <div
              className="bg-white rounded-2xl shadow-2xl w-full max-w-sm mx-4 p-6"
              onClick={(e) => e.stopPropagation()}
            >
              <div className="text-center mb-4">
                <span className="text-4xl">⚠️</span>
              </div>
              <h3 className="text-lg font-bold text-gray-900 text-center mb-2">确认删除</h3>
              <p className="text-sm text-gray-500 text-center mb-6">
                删除后将无法恢复「{deleteTarget.title}」
              </p>
              <div className="flex gap-3 justify-center">
                <button
                  onClick={() => setDeleteTarget(null)}
                  className="px-6 py-2 text-sm text-gray-600 bg-gray-100 rounded-lg hover:bg-gray-200 transition"
                >取消</button>
                <button
                  onClick={doDelete}
                  disabled={deleting}
                  className="px-6 py-2 bg-red-600 text-white text-sm rounded-lg hover:bg-red-700 transition disabled:opacity-50"
                >
                  {deleting ? '删除中...' : '确认删除'}
                </button>
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  )
}
