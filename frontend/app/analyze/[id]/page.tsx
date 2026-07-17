'use client'

import { useEffect, useRef, useCallback } from 'react'
import { useRouter } from 'next/navigation'
import { useParams } from 'next/navigation'
import { motion, AnimatePresence } from 'framer-motion'
import Navbar from '@/components/layout/Navbar'
import Sidebar from '@/components/layout/Sidebar'
import { LegalFooter } from '@/components/layout/LegalFooter'
import { DropZoneModal } from '@/components/upload/DropZoneModal'
import { RiskScoreGauge } from '@/components/analysis/RiskScoreGauge'
import { RiskRadarChart } from '@/components/analysis/RiskRadarChart'
import { ClauseList } from '@/components/analysis/ClauseList'
import { ChatPanel } from '@/components/chat/ChatPanel'
import { RedlineCard } from '@/components/redline/RedlineCard'
import { ScenariosTab } from '@/components/workspace/ScenariosTab'
import { SwarmOrganization } from '@/components/analysis/SwarmOrganization'
import { useContractDetail, useAnalysisStatus } from '@/lib/api'
import { useAuthStore, useAppStore } from '@/lib/store'
import { Spinner } from '@/components/ui/Spinner'
import { useState } from 'react'
import {
  FileText, MessageCircle, GitBranch, Zap, AlertTriangle,
  AlertCircle, ChevronDown, ChevronUp, Scale
} from 'lucide-react'
import { cn } from '@/lib/utils'
import type { RadarDataPoint } from '@/lib/types'

type Tab = 'analysis' | 'chat' | 'redlines' | 'scenarios' | 'contradictions'

const TABS: { id: Tab; label: string; icon: React.FC<any> }[] = [
  { id: 'analysis', label: 'Analysis', icon: FileText },
  { id: 'chat', label: 'AI Chat', icon: MessageCircle },
  { id: 'redlines', label: 'Redlines', icon: GitBranch },
  { id: 'scenarios', label: 'Scenarios', icon: Zap },
  { id: 'contradictions', label: 'Conflicts', icon: Scale },
]

/** Bounding-box clause overlay on the document canvas */
function ClauseOverlay({ clause, isSelected, onSelect }: { clause: any; isSelected: boolean; onSelect: () => void }) {
  const bbox = clause.bounding_box_json
  if (!bbox) return null
  const color = clause.risk_level === 'high' ? '#FF4444' : clause.risk_level === 'moderate' ? '#FF8C00' : '#00D084'
  return (
    <div
      role="button"
      tabIndex={0}
      onClick={onSelect}
      onKeyDown={(e) => e.key === 'Enter' && onSelect()}
      title={clause.clause_type}
      className="absolute cursor-pointer rounded-sm transition-all"
      style={{
        left: `${bbox.x_min * 100}%`,
        top: `${bbox.y_min * 100}%`,
        width: `${(bbox.x_max - bbox.x_min) * 100}%`,
        height: `${Math.max(1, (bbox.y_max - bbox.y_min) * 100)}%`,
        background: `${color}22`,
        border: `1.5px solid ${color}${isSelected ? 'EE' : '60'}`,
        boxShadow: isSelected ? `0 0 8px ${color}55` : 'none',
        zIndex: isSelected ? 10 : 1,
      }}
    />
  )
}

function ContradictionsPanel({ contradictions }: { contradictions: any[] }) {
  const [expanded, setExpanded] = useState<number | null>(null)
  if (!contradictions?.length) {
    return (
      <div className="p-6 text-center text-text-muted text-sm">
        <Scale className="w-8 h-8 mx-auto mb-2 opacity-30" />
        <p>No logical contradictions detected.</p>
        <p className="text-xs mt-1 text-text-muted">This is a good sign — the contract is internally consistent.</p>
      </div>
    )
  }
  const severityColor = { high: '#FF4444', moderate: '#FF8C00', low: '#00D084' }
  return (
    <div className="p-4 space-y-3 overflow-y-auto h-full">
      <div className="mb-1">
        <h3 className="text-sm font-semibold text-text-primary">Pairwise Contradiction Audit</h3>
        <p className="text-xs text-text-muted mt-0.5">{contradictions.length} logical inconsistencies detected</p>
      </div>
      {contradictions.map((c, i) => {
        const color = (severityColor as any)[c.severity] ?? '#888'
        return (
          <motion.div
            key={i}
            initial={{ opacity: 0, y: 8 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: i * 0.06 }}
            className="bg-bg-elevated border rounded-xl overflow-hidden"
            style={{ borderColor: `${color}40` }}
          >
            <button
              className="w-full flex items-center justify-between p-4 text-left"
              onClick={() => setExpanded(expanded === i ? null : i)}
            >
              <div className="flex items-center gap-3">
                <div className="w-7 h-7 rounded-lg flex items-center justify-center flex-shrink-0"
                  style={{ background: `${color}15`, border: `1px solid ${color}30` }}>
                  <AlertCircle className="w-3.5 h-3.5" style={{ color }} />
                </div>
                <div>
                  <p className="text-text-primary text-sm font-medium">{c.category}</p>
                  <p className="text-text-muted text-xs mt-0.5">{c.clause_a} ↔ {c.clause_b}</p>
                </div>
              </div>
              <div className="flex items-center gap-2 flex-shrink-0">
                <span className="text-[10px] font-medium px-1.5 py-0.5 rounded-full border capitalize"
                  style={{ color, background: `${color}15`, borderColor: `${color}30` }}>
                  {c.severity}
                </span>
                {expanded === i ? <ChevronUp className="w-4 h-4 text-text-muted" /> : <ChevronDown className="w-4 h-4 text-text-muted" />}
              </div>
            </button>
            <AnimatePresence>
              {expanded === i && (
                <motion.div
                  initial={{ height: 0 }}
                  animate={{ height: 'auto' }}
                  exit={{ height: 0 }}
                  className="overflow-hidden border-t border-white/[0.06]"
                >
                  <div className="p-4">
                    <p className="text-text-secondary text-sm leading-relaxed">{c.description}</p>
                  </div>
                </motion.div>
              )}
            </AnimatePresence>
          </motion.div>
        )
      })}
    </div>
  )
}

function AnalysisContent({ contractId, contract }: any) {
  const [tab, setTab] = useState<Tab>('analysis')
  const setSelectedClauseId = useAppStore((s) => s.setSelectedClauseId)
  const selectedClauseId = useAppStore((s) => s.selectedClauseId)
  const clauseRefs = useRef<Record<string, HTMLDivElement | null>>({})
  const docPanelRef = useRef<HTMLDivElement>(null)

  const radarData: RadarDataPoint[] = [
    { category: 'Liability', score: contract?.category_scores?.Liability ?? 0 },
    { category: 'Termination', score: contract?.category_scores?.Termination ?? 0 },
    { category: 'IP', score: contract?.category_scores?.IP ?? 0 },
    { category: 'Privacy', score: contract?.category_scores?.Privacy ?? 0 },
    { category: 'Payment', score: contract?.category_scores?.Payment ?? 0 },
    { category: 'Dispute', score: contract?.category_scores?.Dispute ?? 0 },
  ]

  const clauses = contract?.clauses ?? []
  const redlineClauses = clauses.filter((c: any) => c.suggested_text)
  const contradictions = contract?.contradictions_json ?? []

  // Bidirectional sync: scroll right panel to selected clause card
  useEffect(() => {
    if (selectedClauseId && clauseRefs.current[selectedClauseId]) {
      clauseRefs.current[selectedClauseId]?.scrollIntoView({ behavior: 'smooth', block: 'center' })
    }
  }, [selectedClauseId])

  // Click on doc overlay → select clause and switch to analysis tab
  const handleOverlayClick = useCallback((clauseId: string) => {
    setSelectedClauseId(clauseId)
    setTab('analysis')
  }, [setSelectedClauseId])

  const clausesWithBbox = clauses.filter((c: any) => c.bounding_box_json)

  return (
    <div className="flex" style={{ height: 'calc(100vh - 56px)' }}>
      {/* Left: Document Canvas (1/3) */}
      <div className="w-[38%] flex-shrink-0 border-r border-white/[0.06] flex flex-col">
        <div className="flex-shrink-0 px-4 py-2.5 border-b border-white/[0.06] bg-bg-surface flex items-center gap-2">
          <FileText className="w-3.5 h-3.5 text-text-muted" />
          <span className="text-text-secondary text-xs truncate flex-1">{contract?.original_filename}</span>
          <span className="text-xs text-text-muted font-mono">{contract?.page_count ?? 0}p</span>
        </div>

        {/* Document viewer with bounding box overlays */}
        <div ref={docPanelRef} className="flex-1 overflow-y-auto p-4 relative">
          {/* Executive summary card */}
          {contract?.executive_summary && (
            <div className="mb-4 bg-bg-elevated border border-gold/20 rounded-xl p-4">
              <h3 className="text-gold text-xs font-semibold mb-2 flex items-center gap-1.5">
                <AlertTriangle className="w-3.5 h-3.5" />
                Executive Summary
              </h3>
              <p className="text-text-secondary text-xs leading-relaxed">{contract.executive_summary}</p>
            </div>
          )}

          {/* Clause blocks with coordinate overlay visualization */}
          <div className="space-y-2">
            {clauses.map((clause: any) => {
              const color = clause.risk_level === 'high' ? '#FF4444' : clause.risk_level === 'moderate' ? '#FF8C00' : '#00D084'
              const isSelected = selectedClauseId === clause.id
              return (
                <div
                  key={clause.id}
                  role="button"
                  tabIndex={0}
                  onClick={() => { setSelectedClauseId(clause.id); setTab('analysis') }}
                  onKeyDown={(e) => e.key === 'Enter' && setSelectedClauseId(clause.id)}
                  className={cn(
                    'text-text-muted text-xs leading-relaxed rounded-lg p-3 cursor-pointer transition-all border',
                    isSelected
                      ? 'border-opacity-80 bg-opacity-10'
                      : 'border-white/[0.04] bg-bg-surface hover:border-white/10'
                  )}
                  style={{
                    borderLeftWidth: '3px',
                    borderLeftColor: `${color}${isSelected ? 'EE' : '50'}`,
                    background: isSelected ? `${color}10` : undefined,
                    boxShadow: isSelected ? `inset 0 0 0 1px ${color}30` : undefined,
                  }}
                >
                  <div className="flex items-center gap-1.5 mb-1">
                    <span className="text-[10px] font-medium px-1.5 py-0.5 rounded"
                      style={{ color, background: `${color}20` }}>
                      {clause.risk_level?.toUpperCase()}
                    </span>
                    <span className="text-[10px] text-text-muted">{clause.category}</span>
                    {clause.bounding_box_json && (
                      <span className="text-[10px] text-text-muted font-mono ml-auto">
                        p{clause.bounding_box_json.page}
                      </span>
                    )}
                  </div>
                  <p className="text-text-secondary">{clause.original_text?.slice(0, 140)}…</p>
                </div>
              )
            })}
          </div>
        </div>
      </div>

      {/* Right: Agentic Workspace Panel (2/3) */}
      <div className="flex-1 min-w-0 flex flex-col overflow-y-auto">
        {/* AI Legal Organization — Swarm Visualization */}
        <SwarmOrganization
          contractId={contractId}
          contractStatus={contract?.status ?? 'complete'}
        />

        {/* Tabs */}
        <div className="flex border-b border-white/[0.06] flex-shrink-0 overflow-x-auto">
          {TABS.map((t) => {
            const Icon = t.icon
            return (
              <button
                key={t.id}
                onClick={() => setTab(t.id)}
                className={cn(
                  'flex-shrink-0 flex items-center justify-center gap-1.5 py-3 px-4 text-xs font-medium transition-all border-b-2',
                  tab === t.id
                    ? 'text-gold border-gold bg-gold/5'
                    : 'text-text-muted border-transparent hover:text-text-secondary'
                )}
              >
                <Icon className="w-3.5 h-3.5" />
                {t.label}
                {t.id === 'redlines' && redlineClauses.length > 0 && (
                  <span className="bg-gold text-bg-base text-[10px] rounded-full px-1.5 font-bold leading-tight">
                    {redlineClauses.length}
                  </span>
                )}
                {t.id === 'contradictions' && contradictions.length > 0 && (
                  <span className="bg-danger text-white text-[10px] rounded-full px-1.5 font-bold leading-tight">
                    {contradictions.length}
                  </span>
                )}
              </button>
            )
          })}
        </div>

        {/* Tab Content */}
        <div className="flex-1 overflow-hidden">
          <AnimatePresence mode="wait">
            <motion.div
              key={tab}
              initial={{ opacity: 0, x: 8 }}
              animate={{ opacity: 1, x: 0 }}
              exit={{ opacity: 0, x: -8 }}
              transition={{ duration: 0.15 }}
              className="h-full"
            >
              {tab === 'analysis' && (
                <div className="h-full overflow-y-auto">
                  <div className="p-4 grid grid-cols-2 gap-4 border-b border-white/[0.06]">
                    <div className="text-center">
                      <p className="text-xs text-text-muted mb-2 font-mono uppercase tracking-wider">Contract Risk Index</p>
                      <RiskScoreGauge score={contract?.aggregate_risk_index ?? 0} size={180} />
                    </div>
                    <div>
                      <p className="text-xs text-text-muted mb-2 font-mono uppercase tracking-wider">Risk by Category</p>
                      <RiskRadarChart data={radarData} />
                    </div>
                  </div>
                  {/* Clause List with bidirectional sync refs */}
                  <div className="h-[calc(100vh-320px)]">
                    <ClauseList
                      clauses={clauses}
                      contractId={contractId}
                      selectedClauseId={selectedClauseId}
                      onClauseSelect={(id) => {
                        setSelectedClauseId(id)
                        // Scroll doc panel to the highlighted clause
                        if (docPanelRef.current) {
                          const el = docPanelRef.current.querySelector(`[data-clause-id="${id}"]`)
                          el?.scrollIntoView({ behavior: 'smooth', block: 'center' })
                        }
                      }}
                      clauseRefs={clauseRefs}
                    />
                  </div>
                </div>
              )}

              {tab === 'chat' && (
                <div className="h-full">
                  <ChatPanel contractId={contractId} executiveSummary={contract?.executive_summary ?? ''} />
                </div>
              )}

              {tab === 'redlines' && (
                <div className="h-full overflow-y-auto p-4 space-y-4">
                  {redlineClauses.length === 0 ? (
                    <div className="text-center py-16 text-text-muted text-sm">
                      No redline suggestions available.
                    </div>
                  ) : (
                    redlineClauses.map((clause: any) => (
                      <RedlineCard key={clause.id} clause={clause} contractId={contractId} />
                    ))
                  )}
                </div>
              )}

              {tab === 'scenarios' && (
                <ScenariosTab contract={contract} />
              )}

              {tab === 'contradictions' && (
                <ContradictionsPanel contradictions={contradictions} />
              )}
            </motion.div>
          </AnimatePresence>
        </div>
      </div>
    </div>
  )
}

function AnalyzingState({ progress, contractId }: { progress: string; contractId: string }) {
  return (
    <div className="flex flex-col h-full overflow-y-auto">
      {/* Swarm Organization — live during analysis */}
      <div className="border-b border-white/[0.06]">
        <SwarmOrganization contractId={contractId} contractStatus="processing" />
      </div>

      {/* Original spinner UI */}
      <div className="flex flex-col items-center justify-center flex-1 text-center p-8">
        <motion.div
          animate={{ rotate: 360 }}
          transition={{ duration: 3, repeat: Infinity, ease: 'linear' }}
          className="w-16 h-16 rounded-full border-2 border-gold/30 border-t-gold mb-6"
        />
        <h2 className="text-xl font-semibold text-text-primary mb-2">Analyzing Contract...</h2>
        <p className="text-text-secondary text-sm max-w-sm">{progress || 'Running AI analysis pipeline. This takes 30-60 seconds.'}</p>
      </div>
    </div>
  )
}

export default function AnalyzePage() {
  const params = useParams()
  const router = useRouter()
  const contractId = params.id as string
  const isAuthenticated = useAuthStore((s) => s.isAuthenticated)
  const collapsed = useAppStore((s) => s.sidebarCollapsed)
  const setCurrentContractId = useAppStore((s) => s.setCurrentContractId)

  const { data: contract, isLoading } = useContractDetail(contractId)
  const { data: status } = useAnalysisStatus(
    contractId,
    contract?.status !== 'complete' && contract?.status !== 'failed'
  )

  useEffect(() => {
    if (!isAuthenticated()) router.push('/login')
    setCurrentContractId(contractId)
    return () => setCurrentContractId(null)
  }, [contractId])

  const isComplete = contract?.status === 'complete'
  const isFailed = contract?.status === 'failed'

  return (
    <div className="min-h-screen bg-bg-base flex flex-col">
      <Navbar contract={isComplete ? contract : null} />
      <Sidebar />
      <DropZoneModal />

      <main
        className="transition-all duration-200 pt-14 flex-1"
        style={{ marginLeft: collapsed ? 64 : 220 }}
      >
        <div style={{ height: 'calc(100vh - 56px)' }}>
          {isLoading ? (
            <div className="flex items-center justify-center h-full">
              <Spinner />
            </div>
          ) : isFailed ? (
            <div className="flex flex-col items-center justify-center h-full text-center">
              <div className="text-danger text-5xl mb-4">⚠</div>
              <h2 className="text-xl font-semibold text-text-primary mb-2">Analysis Failed</h2>
              <p className="text-text-secondary text-sm">There was an error processing this contract. Please try uploading again.</p>
            </div>
          ) : isComplete && contract ? (
            <AnalysisContent contractId={contractId} contract={contract} />
          ) : (
            <AnalyzingState progress={status?.message ?? ''} contractId={contractId} />
          )}
        </div>
      </main>
    </div>
  )
}
