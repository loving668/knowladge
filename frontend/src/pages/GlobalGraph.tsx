import { useEffect, useRef, useCallback, useState } from 'react'
import { useAppStore } from '../stores/appStore'

const API_BASE = '/api/v1'

interface SimNode {
  id: string
  label: string
  tags: string[]
  color: string
  problem?: string
  approach?: string
  x: number
  y: number
  vx: number
  vy: number
  radius: number
}

interface SimLink {
  source: SimNode
  target: SimNode
  type: string
  reason: string
}

const EDGE_COLORS: Record<string, string> = {
  same_problem: '#EF4444',
  related_method: '#3B82F6',
  complementary: '#10B981',
  similar: '#F59E0B',
  same_tag: '#A78BFA',
  semantic: '#EC4899',
}

export default function GlobalGraph() {
  const graphData = useAppStore((s) => s.graphData)
  const setGraphData = useAppStore((s) => s.setGraphData)
  const setSelectedPage = useAppStore((s) => s.setSelectedPage)
  const setGraphMode = useAppStore((s) => s.setGraphMode)
  const setNavKey = useAppStore((s) => s.setNavKey)
  const kbId = useAppStore((s) => s.kbId)

  const canvasRef = useRef<HTMLCanvasElement>(null)
  const containerRef = useRef<HTMLDivElement>(null)
  const nodesRef = useRef<SimNode[]>([])
  const linksRef = useRef<SimLink[]>([])
  const hoverRef = useRef<string | null>(null)
  const animRef = useRef<number>(0)
  const [tooltip, setTooltip] = useState<{ text: string; x: number; y: number } | null>(null)
  const [legendOpen, setLegendOpen] = useState(false)
  // Right-click context menu
  const [ctxMenu, setCtxMenu] = useState<{ x: number; y: number; slug: string } | null>(null)

  const loadGraphData = useCallback(async () => {
    if (!kbId) return
    try {
      const res = await fetch(`${API_BASE}/kb/${kbId}/wiki/graph`)
      const data = await res.json()
      setGraphData(data)
    } catch (err) {
      console.error(err)
    }
  }, [setGraphData, kbId])

  useEffect(() => {
    loadGraphData()
  }, [loadGraphData])

  const handleNodeClick = useCallback(
    async (slug: string) => {
      if (!kbId) return
      try {
        const res = await fetch(`${API_BASE}/kb/${kbId}/wiki/pages/${slug}`)
        const data = await res.json()
        setSelectedPage(data)
      } catch (err) {
        console.error(err)
      }
    },
    [setSelectedPage, kbId]
  )

  const handleViewContent = useCallback((slug: string) => {
    setCtxMenu(null)
    handleNodeClick(slug)
  }, [handleNodeClick])

  const handleFocusGraph = useCallback(async (slug: string) => {
    setCtxMenu(null)
    if (!kbId) return
    try {
      const res = await fetch(`${API_BASE}/kb/${kbId}/wiki/pages/${slug}`)
      const data = await res.json()
      setSelectedPage(data)
      setGraphMode('focus')
      setNavKey('graph')
    } catch (err) {
      console.error(err)
    }
  }, [setSelectedPage, setGraphMode, setNavKey, kbId])

  useEffect(() => {
    if (!canvasRef.current || graphData.nodes.length === 0) return

    const canvas = canvasRef.current
    const ctx = canvas.getContext('2d')
    if (!ctx) return

    const dpr = window.devicePixelRatio || 1
    let width = 800
    let height = 520

    const resize = () => {
      const rect = canvas.parentElement?.getBoundingClientRect()
      if (rect) {
        width = rect.width
        height = Math.max(400, rect.height || 520)
        canvas.width = width * dpr
        canvas.height = height * dpr
        canvas.style.width = width + 'px'
        canvas.style.height = height + 'px'
        ctx.setTransform(dpr, 0, 0, dpr, 0, 0)
      }
    }
    resize()
    window.addEventListener('resize', resize)

    // Build nodes with connection count for sizing
    const connCount: Record<string, number> = {}
    for (const link of graphData.links) {
      connCount[link.source] = (connCount[link.source] || 0) + 1
      connCount[link.target] = (connCount[link.target] || 0) + 1
    }

    const nodeCount = graphData.nodes.length
    const nodes: SimNode[] = graphData.nodes.map((node, i) => ({
      id: node.id,
      label: node.label,
      tags: node.tags,
      color: node.color,
      problem: node.problem,
      approach: node.approach,
      x: width / 2 + Math.cos((i / nodeCount) * Math.PI * 2) * Math.min(200, width / 3),
      y: height / 2 + Math.sin((i / nodeCount) * Math.PI * 2) * 140,
      vx: 0,
      vy: 0,
      radius: 28 + Math.min((connCount[node.id] || 0) * 4, 16),
    }))

    const nodeMap = new Map<string, SimNode>()
    nodes.forEach((n) => nodeMap.set(n.id, n))

    const links: SimLink[] = []
    for (const link of graphData.links) {
      const source = nodeMap.get(link.source)
      const target = nodeMap.get(link.target)
      if (source && target) {
        links.push({ source, target, type: link.type || 'semantic', reason: link.reason || '' })
      }
    }

    nodesRef.current = nodes
    linksRef.current = links

    // ---- Drawing ----
    const drawDotGrid = () => {
      ctx.fillStyle = '#f1f5f9'
      const spacing = 25
      for (let x = spacing; x < width; x += spacing) {
        for (let y = spacing; y < height; y += spacing) {
          ctx.beginPath()
          ctx.arc(x, y, 1, 0, Math.PI * 2)
          ctx.fill()
        }
      }
    }

    const draw = () => {
      ctx.clearRect(0, 0, width, height)

      // Background dot grid
      drawDotGrid()

      const hoveredId = hoverRef.current

      // Draw edges
      for (const link of links) {
        const isHighlighted = hoveredId && (link.source.id === hoveredId || link.target.id === hoveredId)
        const color = EDGE_COLORS[link.type] || '#94A3B8'
        const alpha = hoveredId && !isHighlighted ? 0.12 : 0.55

        ctx.beginPath()
        ctx.moveTo(link.source.x, link.source.y)

        // Curved edges
        const mx = (link.source.x + link.target.x) / 2
        const my = (link.source.y + link.target.y) / 2
        const dx = link.target.x - link.source.x
        const dy = link.target.y - link.source.y
        const dist = Math.sqrt(dx * dx + dy * dy)
        const curve = Math.min(40, dist * 0.2)
        const cpx = mx - (dy / dist) * curve
        const cpy = my + (dx / dist) * curve
        ctx.quadraticCurveTo(cpx, cpy, link.target.x, link.target.y)

        ctx.strokeStyle = color
        ctx.globalAlpha = alpha
        ctx.lineWidth = isHighlighted ? 2.5 : link.type === 'same_tag' ? 1 : 1.8

        if (link.type === 'same_tag') {
          ctx.setLineDash([6, 4])
        } else {
          ctx.setLineDash([])
        }
        ctx.stroke()
        ctx.setLineDash([])
        ctx.globalAlpha = 1

        // Arrow on hover
        if (isHighlighted) {
          const t = 0.85
          const ax = link.source.x + (link.target.x - link.source.x) * t
          const ay = link.source.y + (link.target.y - link.source.y) * t
          const angle = Math.atan2(link.target.y - link.source.y, link.target.x - link.source.x)
          ctx.beginPath()
          ctx.moveTo(ax, ay)
          ctx.lineTo(ax - 6 * Math.cos(angle - 0.6), ay - 6 * Math.sin(angle - 0.6))
          ctx.lineTo(ax - 6 * Math.cos(angle + 0.6), ay - 6 * Math.sin(angle + 0.6))
          ctx.closePath()
          ctx.fillStyle = color
          ctx.fill()
        }
      }

      // Draw nodes
      for (const node of nodes) {
        const r = node.radius
        const isHovered = node.id === hoveredId
        const isDimmed = hoveredId && node.id !== hoveredId

        // Glow on hover
        if (isHovered) {
          const grad = ctx.createRadialGradient(node.x, node.y, r * 0.7, node.x, node.y, r * 2.2)
          grad.addColorStop(0, node.color + '50')
          grad.addColorStop(1, 'transparent')
          ctx.beginPath()
          ctx.arc(node.x, node.y, r * 2.2, 0, Math.PI * 2)
          ctx.fillStyle = grad
          ctx.fill()
        }

        // Shadow
        ctx.shadowColor = 'rgba(0,0,0,0.18)'
        ctx.shadowBlur = isHovered ? 16 : 8
        ctx.shadowOffsetY = 3

        // Node body
        ctx.beginPath()
        ctx.arc(node.x, node.y, r, 0, Math.PI * 2)
        const nodeAlpha = isDimmed ? 0.35 : 1
        ctx.globalAlpha = nodeAlpha
        ctx.fillStyle = node.color
        ctx.fill()
        ctx.shadowColor = 'transparent'
        ctx.shadowBlur = 0
        ctx.shadowOffsetY = 0

        // White ring
        ctx.strokeStyle = isHovered ? '#fff' : 'rgba(255,255,255,0.8)'
        ctx.lineWidth = isHovered ? 3.5 : 2.5
        ctx.stroke()
        ctx.globalAlpha = 1

        // Title text INSIDE the circle
        const maxChars = Math.floor(r / 5.5)
        const label = node.label.length > maxChars ? node.label.slice(0, maxChars - 1) + '…' : node.label
        ctx.fillStyle = '#fff'
        ctx.font = `bold ${Math.max(11, r / 2.6)}px system-ui, sans-serif`
        ctx.textAlign = 'center'
        ctx.textBaseline = 'middle'
        
        // Multiline if long
        if (label.length > 6 && r > 32) {
          const mid = Math.ceil(label.length / 2)
          const l1 = label.slice(0, mid)
          const l2 = label.slice(mid)
          ctx.fillText(l1, node.x, node.y - 5)
          ctx.fillText(l2, node.x, node.y + 8)
        } else {
          ctx.fillText(label, node.x, node.y)
        }
      }
    }

    // ---- Simulation ----
    let simRunning = true

    const simulate = () => {
      if (!simRunning) return
      const alpha = 0.08

      // Repulsion
      for (let i = 0; i < nodes.length; i++) {
        for (let j = i + 1; j < nodes.length; j++) {
          const dx = nodes[i].x - nodes[j].x
          const dy = nodes[i].y - nodes[j].y
          const dist = Math.sqrt(dx * dx + dy * dy) || 1
          const minDist = nodes[i].radius + nodes[j].radius + 50
          if (dist < minDist) {
            const force = (minDist - dist) * 0.15
            nodes[i].vx += (dx / dist) * force
            nodes[i].vy += (dy / dist) * force
            nodes[j].vx -= (dx / dist) * force
            nodes[j].vy -= (dy / dist) * force
          }
        }
      }

      // Attraction
      for (const link of links) {
        const dx = link.target.x - link.source.x
        const dy = link.target.y - link.source.y
        const dist = Math.sqrt(dx * dx + dy * dy) || 1
        const targetDist = link.source.radius + link.target.radius + 80
        const force = (dist - targetDist) * 0.008
        link.source.vx += (dx / dist) * force
        link.source.vy += (dy / dist) * force
        link.target.vx -= (dx / dist) * force
        link.target.vy -= (dy / dist) * force
      }

      // Center gravity
      for (const node of nodes) {
        node.vx += (width / 2 - node.x) * 0.001
        node.vy += (height / 2 - node.y) * 0.001

        node.x += node.vx * alpha
        node.y += node.vy * alpha
        node.vx *= 0.88
        node.vy *= 0.88
        node.x = Math.max(35, Math.min(width - 35, node.x))
        node.y = Math.max(50, Math.min(height - 50, node.y))
      }

      draw()
      animRef.current = requestAnimationFrame(simulate)
    }

    simulate()

    // ---- Event handlers ----
    const getPos = (e: MouseEvent) => {
      const rect = canvas.getBoundingClientRect()
      return { x: e.clientX - rect.left, y: e.clientY - rect.top }
    }

    const findNode = (x: number, y: number) => {
      for (const node of nodes) {
        const dx = x - node.x
        const dy = y - node.y
        if (Math.sqrt(dx * dx + dy * dy) < node.radius + 5) return node
      }
      return null
    }

    canvas.addEventListener('click', (e: MouseEvent) => {
      const { x, y } = getPos(e)
      const node = findNode(x, y)
      if (node) handleNodeClick(node.id)
      setCtxMenu(null)
    })

    canvas.addEventListener('contextmenu', (e: MouseEvent) => {
      e.preventDefault()
      const { x, y } = getPos(e)
      const node = findNode(x, y)
      if (node) {
        setCtxMenu({
          x: e.clientX,
          y: e.clientY,
          slug: node.id,
        })
      } else {
        setCtxMenu(null)
      }
    })

    canvas.addEventListener('mousemove', (e: MouseEvent) => {
      const { x, y } = getPos(e)
      const node = findNode(x, y)
      if (node) {
        hoverRef.current = node.id
        const parts = [node.label]
        if (node.problem) parts.push('问题：' + (node.problem.length > 60 ? node.problem.slice(0, 60) + '…' : node.problem))
        if (node.approach) parts.push('方案：' + (node.approach.length > 60 ? node.approach.slice(0, 60) + '…' : node.approach))
        setTooltip({ text: parts.join('\n'), x: x + 14, y: y - 14 })
        canvas.style.cursor = 'pointer'
      } else {
        hoverRef.current = null
        setTooltip(null)
        canvas.style.cursor = 'default'
      }
    })

    return () => {
      simRunning = false
      cancelAnimationFrame(animRef.current)
      window.removeEventListener('resize', resize)
    }
  }, [graphData, handleNodeClick])

  return (
    <div className="flex flex-col h-full">
      {/* Top bar */}
      <div className="flex items-center justify-between px-6 py-3 border-b border-gray-100 bg-white shrink-0">
        <div>
          <h2 className="text-sm font-semibold text-gray-800">知识图谱</h2>
          <p className="text-[11px] text-gray-400">{graphData.nodes.length} 节点 · {graphData.links.length} 关联</p>
        </div>
        <div className="flex items-center gap-2">
          <button
            onClick={() => setLegendOpen(!legendOpen)}
            className={`px-3 py-1.5 text-xs rounded-lg transition ${
              legendOpen ? 'bg-purple-100 text-purple-700' : 'bg-gray-100 text-gray-500 hover:bg-gray-200'
            }`}
          >
            图例
          </button>
          <button
            onClick={loadGraphData}
            className="px-3 py-1.5 text-xs bg-gray-100 text-gray-500 rounded-lg hover:bg-gray-200 transition"
          >
            🔄 刷新
          </button>
        </div>
      </div>

      {/* Canvas area */}
      <div className="flex-1 relative overflow-hidden bg-gray-50/50" ref={containerRef}>
        {graphData.nodes.length === 0 ? (
          <div className="flex items-center justify-center h-full text-gray-400">
            <div className="text-center">
              <div className="text-5xl mb-4">🕸️</div>
              <p className="text-base font-medium text-gray-500">还没有知识节点</p>
              <p className="text-sm mt-1 text-gray-400">导入文档后将自动生成知识图谱</p>
            </div>
          </div>
        ) : (
          <canvas ref={canvasRef} className="w-full h-full" />
        )}

        {/* Tooltip */}
        {tooltip && (
          <div
            className="absolute pointer-events-none bg-gray-900/95 backdrop-blur text-white text-xs px-3 py-2 rounded-xl shadow-xl z-10 max-w-[240px] whitespace-pre-line leading-relaxed"
            style={{ left: tooltip.x, top: tooltip.y }}
          >
            {tooltip.text}
          </div>
        )}

        {/* Right-click context menu */}
        {ctxMenu && (
          <>
            <div className="fixed inset-0 z-40" onClick={() => setCtxMenu(null)} />
            <div
              className="fixed z-50 bg-white rounded-xl shadow-xl border border-gray-200 py-1.5 w-44"
              style={{ left: Math.min(ctxMenu.x, window.innerWidth - 200), top: Math.min(ctxMenu.y, window.innerHeight - 120) }}
            >
              <button
                onClick={() => handleViewContent(ctxMenu.slug)}
                className="w-full text-left px-4 py-2.5 text-sm text-gray-700 hover:bg-purple-50 hover:text-purple-700 transition flex items-center gap-2"
              >
                <span>📄</span> 查看知识内容
              </button>
              <div className="border-t border-gray-100 my-1" />
              <button
                onClick={() => handleFocusGraph(ctxMenu.slug)}
                className="w-full text-left px-4 py-2.5 text-sm text-gray-700 hover:bg-blue-50 hover:text-blue-700 transition flex items-center gap-2"
              >
                <span>🎯</span> 生成聚焦图谱
              </button>
            </div>
          </>
        )}

        {/* Legend panel */}
        {legendOpen && (
          <div className="absolute bottom-4 left-4 bg-white/95 backdrop-blur rounded-xl shadow-lg border border-gray-200 p-4 z-10">
            <p className="text-xs font-semibold text-gray-500 mb-3 uppercase tracking-wider">标签颜色</p>
            <div className="flex flex-wrap gap-3 mb-4">
              {graphData.tag_groups && Object.entries(graphData.tag_groups).map(([tag, color]) => (
                <div key={tag} className="flex items-center gap-2">
                  <div className="w-3 h-3 rounded-full shadow-sm" style={{ backgroundColor: color }} />
                  <span className="text-xs text-gray-600">{tag}</span>
                </div>
              ))}
            </div>
            <p className="text-xs font-semibold text-gray-500 mb-2 uppercase tracking-wider">关联类型</p>
            <div className="space-y-1.5">
              {Object.entries(EDGE_COLORS).map(([type, color]) => (
                <div key={type} className="flex items-center gap-2">
                  <span className="w-5 h-0.5 rounded-full" style={{ backgroundColor: color, borderTop: type === 'same_tag' ? '2px dashed ' + color : 'none' }} />
                  <span className="text-xs text-gray-500">
                    {{ same_problem: '同类问题', related_method: '方法相关', complementary: '互补', similar: '相似', same_tag: '同标签', semantic: '语义关联' }[type] || type}
                  </span>
                </div>
              ))}
            </div>
          </div>
        )}
      </div>
    </div>
  )
}
