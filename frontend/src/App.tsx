import { useEffect } from 'react'
import { useAppStore } from './stores/appStore'
import Sidebar from './components/Sidebar'
import TopBar from './components/TopBar'
import ChatPanel from './components/ChatPanel'
import Dashboard from './pages/Dashboard'
import DocumentList from './pages/DocumentList'
import DocumentDetail from './pages/DocumentDetail'
import GlobalGraph from './pages/GlobalGraph'
import FocusGraph from './pages/FocusGraph'
import IngestPanel from './pages/IngestPanel'

const API_BASE = '/api/v1'

export default function App() {
  const navKey = useAppStore((s) => s.navKey)
  const selectedPage = useAppStore((s) => s.selectedPage)
  const graphMode = useAppStore((s) => s.graphMode)
  const setPages = useAppStore((s) => s.setPages)
  const kbId = useAppStore((s) => s.kbId)
  const setKbId = useAppStore((s) => s.setKbId)
  const setKbList = useAppStore((s) => s.setKbList)
  const pageRefresh = useAppStore((s) => s.pageRefresh)

  // 首次加载 KB 列表
  useEffect(() => {
    fetch(`${API_BASE}/kb`)
      .then(r => r.json())
      .then(data => {
        const kbs = data.knowledge_bases || []
        setKbList(kbs)
        if (!kbId && kbs.length > 0) {
          setKbId(kbs[0].id)
        }
      })
      .catch(console.error)
  }, [])

  useEffect(() => {
    if (!kbId) return
    fetch(`${API_BASE}/kb/${kbId}/wiki/pages`)
      .then((r) => r.json())
      .then((data) => setPages(data.pages || []))
      .catch(console.error)
  }, [setPages, kbId, pageRefresh])

  const renderMain = () => {
    if (navKey === 'graph' && graphMode === 'focus') return <FocusGraph />
    if (selectedPage) return <DocumentDetail />
    switch (navKey) {
      case 'dashboard':
        return <Dashboard />
      case 'graph':
        return <GlobalGraph />
      case 'ingest':
        return <IngestPanel />
      default:
        return <DocumentList />
    }
  }

  return (
    <div className="flex h-screen bg-gray-100">
      <Sidebar />
      <main className="flex-1 flex flex-col min-w-0 overflow-hidden">
        <TopBar />
        <div className="flex-1 overflow-y-auto">{renderMain()}</div>
      </main>
      <ChatPanel />
    </div>
  )
}
