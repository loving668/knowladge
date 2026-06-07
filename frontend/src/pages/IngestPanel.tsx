import { useState, useRef } from 'react'
import { useAppStore } from '../stores/appStore'

const API_BASE = '/api/v1'

type IngestTab = 'file' | 'text' | 'url'

export default function IngestPanel() {
  const [activeTab, setActiveTab] = useState<IngestTab>('file')
  const [loading, setLoading] = useState(false)
  const [toast, setToast] = useState<{ type: 'success' | 'error'; msg: string } | null>(null)

  // File mode — multi-file
  const [selectedFiles, setSelectedFiles] = useState<File[]>([])
  const fileInputRef = useRef<HTMLInputElement>(null)

  // Text mode
  const [textTitle, setTextTitle] = useState('')
  const [textContent, setTextContent] = useState('')

  // URL mode
  const [urlTitle, setUrlTitle] = useState('')
  const [urlLink, setUrlLink] = useState('')

  const kbId = useAppStore((s) => s.kbId)
  const triggerRefresh = useAppStore((s) => s.triggerRefresh)

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = e.target.files
    if (files) {
      setSelectedFiles(Array.from(files))
      setToast(null)
    }
  }

  const handleUpload = async () => {
    if (!selectedFiles.length || !kbId) return
    setLoading(true)
    setToast(null)

    try {
      const formData = new FormData()
      for (const file of selectedFiles) {
        formData.append('files', file)
      }

      const res = await fetch(`${API_BASE}/kb/${kbId}/sources/ingest/batch`, {
        method: 'POST',
        body: formData,
      })
      const data = await res.json()

      if (data.results) {
        const ok = data.results.filter((r: { source_id: string }) => r.source_id).length
        setToast({ type: 'success', msg: `已上传 ${ok} 个文件，后台解析中...` })
      }
      if (data.detail) {
        setToast({ type: 'error', msg: data.detail })
      }

      setSelectedFiles([])
      triggerRefresh()
    } catch (err) {
      console.error(err)
      setToast({ type: 'error', msg: '上传失败，请重试' })
    }
    setLoading(false)
  }

  const removeFile = (idx: number) => {
    setSelectedFiles(prev => prev.filter((_, i) => i !== idx))
  }

  const handleTextIngest = async () => {
    if (!textTitle.trim() || !textContent.trim() || !kbId) return
    setLoading(true)
    setToast(null)
    try {
      const res = await fetch(`${API_BASE}/kb/${kbId}/sources/ingest`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ title: textTitle, content: textContent }),
      })
      if (!res.ok) {
        const data = await res.json()
        setToast({ type: 'error', msg: data.detail || '添加失败，请重试' })
      } else {
        setToast({ type: 'success', msg: `"${textTitle}" 已添加` })
        setTextTitle('')
        setTextContent('')
        triggerRefresh()
      }
    } catch (err) {
      console.error(err)
      setToast({ type: 'error', msg: '添加失败，请重试' })
    }
    setLoading(false)
  }

  const handleUrlIngest = async () => {
    if (!urlTitle.trim() || !urlLink.trim() || !kbId) return
    setLoading(true)
    setToast(null)
    try {
      const res = await fetch(`${API_BASE}/kb/${kbId}/sources/ingest/url`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ title: urlTitle, url: urlLink }),
      })
      const data = await res.json()
      if (!res.ok) {
        setToast({ type: 'error', msg: data.detail || '抓取失败，请确认网址可访问' })
      } else {
        setToast({ type: 'success', msg: `"${urlTitle}" 已抓取` })
        setUrlTitle('')
        setUrlLink('')
        triggerRefresh()
      }
    } catch (err) {
      console.error(err)
      setToast({ type: 'error', msg: '抓取失败，请确认网址可访问' })
    }
    setLoading(false)
  }

  const formatBytes = (bytes: number) => {
    if (bytes < 1024) return `${bytes} B`
    if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`
    return `${(bytes / (1024 * 1024)).toFixed(1)} MB`
  }

  return (
    <div className="p-6 overflow-y-auto h-full">
      <div className="max-w-3xl mx-auto">
        <div className="mb-6">
          <h2 className="text-xl font-bold text-gray-900">导入文档</h2>
          <p className="text-sm text-gray-500 mt-1">上传文件后后台自动解析，稍后即可在知识库中检索</p>
        </div>

        {/* Toast */}
        {toast && (
          <div className={`mb-6 p-4 rounded-xl border text-sm ${
            toast.type === 'error' ? 'bg-red-50 border-red-200 text-red-700' : 'bg-green-50 border-green-200 text-green-700'
          }`}>
            <div className="flex items-center gap-2">
              <span>{toast.type === 'error' ? '❌' : '✅'}</span>
              <span>{toast.msg}</span>
              <button
                onClick={() => setToast(null)}
                className="ml-auto text-gray-400 hover:text-gray-600"
              >✕</button>
            </div>
          </div>
        )}

        {/* Tabs */}
        <div className="flex bg-gray-100 rounded-xl p-1 mb-6">
          {(
            [
              ['file', '📁 批量文件'],
              ['text', '📝 文本输入'],
              ['url', '🌐 URL 抓取'],
            ] as [IngestTab, string][]
          ).map(([key, label]) => (
            <button
              key={key}
              onClick={() => {
                setActiveTab(key)
                setToast(null)
              }}
              className={`flex-1 py-2.5 rounded-lg text-sm font-medium transition ${
                activeTab === key
                  ? 'bg-white text-purple-700 shadow-sm'
                  : 'text-gray-600 hover:text-gray-900'
              }`}
            >
              {label}
            </button>
          ))}
        </div>

        {/* File Upload — Multi-file */}
        {activeTab === 'file' && (
          <div className="bg-white rounded-xl border border-gray-200 p-6 space-y-4">
            <label>
              <div
                className="border-2 border-dashed border-gray-300 rounded-xl p-8 text-center hover:border-purple-400 transition cursor-pointer"
                onDragOver={(e) => e.preventDefault()}
                onDrop={(e) => {
                  e.preventDefault()
                  const files = e.dataTransfer.files
                  if (files.length > 0) {
                    setSelectedFiles(prev => [...prev, ...Array.from(files)])
                    setToast(null)
                  }
                }}
              >
                <div className="text-4xl mb-3">📂</div>
                <div className="text-gray-600 font-medium">拖拽文件到此处或点击选择</div>
                <div className="text-xs text-gray-400 mt-2">支持 TXT、MD、PDF、DOCX 等格式，可多选</div>
              </div>
              <input
                ref={fileInputRef}
                type="file"
                className="hidden"
                multiple
                onChange={handleFileChange}
              />
            </label>

            {/* Selected files list */}
            {selectedFiles.length > 0 && (
              <div className="border border-gray-200 rounded-lg divide-y divide-gray-100 max-h-48 overflow-y-auto">
                {selectedFiles.map((file, i) => (
                  <div key={i} className="flex items-center justify-between px-4 py-2.5">
                    <div className="flex items-center gap-3 min-w-0">
                      <span className="text-lg">📄</span>
                      <span className="text-sm text-gray-800 truncate">{file.name}</span>
                      <span className="text-xs text-gray-400 shrink-0">{formatBytes(file.size)}</span>
                    </div>
                    <button
                      onClick={() => removeFile(i)}
                      className="ml-2 px-2 py-1 text-xs text-red-400 hover:bg-red-50 rounded transition"
                    >
                      ✕
                    </button>
                  </div>
                ))}
              </div>
            )}

            <button
              onClick={handleUpload}
              disabled={loading || !selectedFiles.length}
              className="w-full px-4 py-3 bg-purple-600 text-white rounded-xl text-sm font-medium hover:bg-purple-700 transition disabled:opacity-50 disabled:cursor-not-allowed"
            >
              {loading ? '上传中...' : `📤 上传文件 (${selectedFiles.length} 个)`}
            </button>
          </div>
        )}

        {/* Text Input */}
        {activeTab === 'text' && (
          <div className="bg-white rounded-xl border border-gray-200 p-6 space-y-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1.5">标题</label>
              <input
                type="text"
                value={textTitle}
                onChange={(e) => setTextTitle(e.target.value)}
                placeholder="输入文档标题"
                className="w-full px-4 py-2.5 border border-gray-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-purple-500/20 focus:border-purple-500 transition"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1.5">内容</label>
              <textarea
                value={textContent}
                onChange={(e) => setTextContent(e.target.value)}
                placeholder="输入文档内容..."
                rows={10}
                className="w-full px-4 py-2.5 border border-gray-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-purple-500/20 focus:border-purple-500 resize-none transition"
              />
            </div>
            <button
              onClick={handleTextIngest}
              disabled={loading || !textTitle.trim() || !textContent.trim()}
              className="w-full px-4 py-3 bg-purple-600 text-white rounded-xl text-sm font-medium hover:bg-purple-700 transition disabled:opacity-50 disabled:cursor-not-allowed"
            >
              {loading ? '添加中...' : '📝 添加文本'}
            </button>
          </div>
        )}

        {/* URL Input */}
        {activeTab === 'url' && (
          <div className="bg-white rounded-xl border border-gray-200 p-6 space-y-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1.5">标题</label>
              <input
                type="text"
                value={urlTitle}
                onChange={(e) => setUrlTitle(e.target.value)}
                placeholder="输入文档标题"
                className="w-full px-4 py-2.5 border border-gray-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-purple-500/20 focus:border-purple-500 transition"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1.5">URL 地址</label>
              <input
                type="url"
                value={urlLink}
                onChange={(e) => setUrlLink(e.target.value)}
                placeholder="https://example.com/article"
                className="w-full px-4 py-2.5 border border-gray-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-purple-500/20 focus:border-purple-500 transition"
              />
            </div>
            <button
              onClick={handleUrlIngest}
              disabled={loading || !urlTitle.trim() || !urlLink.trim()}
              className="w-full px-4 py-3 bg-purple-600 text-white rounded-xl text-sm font-medium hover:bg-purple-700 transition disabled:opacity-50 disabled:cursor-not-allowed"
            >
              {loading ? '抓取中...' : '🌐 抓取内容'}
            </button>
          </div>
        )}
      </div>
    </div>
  )
}
