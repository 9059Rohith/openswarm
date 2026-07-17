'use client'

import { useState, useEffect, useCallback, useRef, memo } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import {
  Brain, FileSearch, Tag, ListChecks, DollarSign, Shield, Scale,
  Crown, ChevronDown, ChevronUp, Clock, Zap, CheckCircle2,
  AlertTriangle, Loader2, Network
} from 'lucide-react'
import { cn } from '@/lib/utils'
import { api } from '@/lib/api'

// ─── Types ──────────────────────────────────────────────────────────────────────

type TeamStatus = 'waiting' | 'running' | 'completed' | 'blocked' | 'error'

interface TeamResult {
  team_name: string
  specialization: string
  status: TeamStatus
  dependencies: string[]
  duration: number
  confidence: number | null
  reasoning_summary: string
  start_time?: number | null
  end_time?: number | null
  wave?: number
  parallel_group?: string
  error?: string | null
}

interface TeamDefinition {
  team_name: string
  specialization: string
  dependencies: string[]
  wave: number
  parallel_group?: string
}

interface SwarmStatusResponse {
  contract_id: string
  swarm_status: string
  teams: TeamResult[]
  team_definitions: TeamDefinition[]
  final_results?: TeamResult[]
}

// ─── Constants ──────────────────────────────────────────────────────────────────

const STATUS_CONFIG: Record<TeamStatus, { color: string; bg: string; border: string; label: string; glow: string }> = {
  waiting:   { color: '#6B7280', bg: 'rgba(107,114,128,0.08)', border: 'rgba(107,114,128,0.20)', label: 'Waiting',   glow: 'none' },
  running:   { color: '#4D9EFF', bg: 'rgba(77,158,255,0.10)',  border: 'rgba(77,158,255,0.40)',  label: 'Running',   glow: '0 0 20px rgba(77,158,255,0.25)' },
  completed: { color: '#00D084', bg: 'rgba(0,208,132,0.08)',   border: 'rgba(0,208,132,0.30)',   label: 'Completed', glow: 'none' },
  blocked:   { color: '#FF8C00', bg: 'rgba(255,140,0,0.08)',   border: 'rgba(255,140,0,0.25)',   label: 'Blocked',   glow: 'none' },
  error:     { color: '#FF4444', bg: 'rgba(255,68,68,0.10)',   border: 'rgba(255,68,68,0.35)',   label: 'Error',     glow: '0 0 15px rgba(255,68,68,0.20)' },
}

const TEAM_ICONS: Record<string, typeof Brain> = {
  'Chief Legal Officer':          Crown,
  'Document Intelligence Team':   FileSearch,
  'Contract Classification Team': Tag,
  'Clause Analysis Team':         ListChecks,
  'Financial Risk Team':          DollarSign,
  'Privacy / Compliance Team':    Shield,
  'Litigation Prediction Team':   Scale,
  'Chief Review Board':           Brain,
}

const SHORT_NAMES: Record<string, string> = {
  'Chief Legal Officer':          'CLO',
  'Document Intelligence Team':   'Doc Intel',
  'Contract Classification Team': 'Classification',
  'Clause Analysis Team':         'Clause Analysis',
  'Financial Risk Team':          'Financial Risk',
  'Privacy / Compliance Team':    'Privacy',
  'Litigation Prediction Team':   'Litigation',
  'Chief Review Board':           'Review Board',
}


// ─── Team Card ──────────────────────────────────────────────────────────────────

const TeamCard = memo(function TeamCard({
  team, isParallel, index
}: {
  team: TeamResult
  isParallel?: boolean
  index: number
}) {
  const config = STATUS_CONFIG[team.status] || STATUS_CONFIG.waiting
  const Icon = TEAM_ICONS[team.team_name] || Brain

  return (
    <motion.div
      initial={{ opacity: 0, y: 12, scale: 0.97 }}
      animate={{ opacity: 1, y: 0, scale: 1 }}
      transition={{ delay: index * 0.05, duration: 0.3, ease: 'easeOut' }}
      className={cn(
        'relative rounded-xl border transition-all duration-300',
        isParallel ? 'flex-1 min-w-[180px]' : 'w-full'
      )}
      style={{
        background: config.bg,
        borderColor: config.border,
        boxShadow: config.glow,
      }}
    >
      {/* Running pulse indicator */}
      {team.status === 'running' && (
        <div className="absolute -top-1 -right-1 w-3 h-3">
          <span className="absolute inline-flex h-full w-full rounded-full opacity-75 animate-ping"
            style={{ backgroundColor: config.color }} />
          <span className="relative inline-flex rounded-full h-3 w-3"
            style={{ backgroundColor: config.color }} />
        </div>
      )}

      <div className="p-3">
        {/* Header row */}
        <div className="flex items-center gap-2.5 mb-2">
          <div
            className="w-8 h-8 rounded-lg flex items-center justify-center flex-shrink-0"
            style={{
              background: `${config.color}18`,
              border: `1px solid ${config.color}30`,
            }}
          >
            {team.status === 'running' ? (
              <Loader2 className="w-4 h-4 animate-spin" style={{ color: config.color }} />
            ) : team.status === 'completed' ? (
              <CheckCircle2 className="w-4 h-4" style={{ color: config.color }} />
            ) : (
              <Icon className="w-4 h-4" style={{ color: config.color }} />
            )}
          </div>
          <div className="flex-1 min-w-0">
            <h4 className="text-xs font-semibold text-text-primary truncate">
              {team.team_name}
            </h4>
            <p className="text-[10px] text-text-muted truncate">
              {team.specialization}
            </p>
          </div>
          <span
            className="text-[9px] font-bold px-1.5 py-0.5 rounded-full uppercase tracking-wider flex-shrink-0"
            style={{
              color: config.color,
              background: `${config.color}15`,
              border: `1px solid ${config.color}25`,
            }}
          >
            {config.label}
          </span>
        </div>

        {/* Metrics row */}
        <div className="flex items-center gap-3 text-[10px]">
          {team.duration > 0 && (
            <span className="flex items-center gap-1 text-text-secondary">
              <Clock className="w-3 h-3" style={{ color: config.color }} />
              {team.duration.toFixed(1)}s
            </span>
          )}
          {team.confidence !== null && team.confidence !== undefined && (
            <span className="flex items-center gap-1 text-text-secondary">
              <Zap className="w-3 h-3" style={{ color: config.color }} />
              {(team.confidence * 100).toFixed(0)}%
            </span>
          )}
          {team.dependencies?.length > 0 && (
            <span className="text-text-muted ml-auto truncate max-w-[120px]">
              ← {team.dependencies.map(d => SHORT_NAMES[d] || d).join(', ')}
            </span>
          )}
        </div>

        {/* Reasoning summary */}
        {team.reasoning_summary && team.status === 'completed' && (
          <p className="mt-1.5 text-[10px] text-text-muted leading-relaxed line-clamp-2 border-t border-white/[0.04] pt-1.5">
            {team.reasoning_summary}
          </p>
        )}
      </div>
    </motion.div>
  )
})

// ─── Flow Connector (vertical line between waves) ───────────────────────────────

function FlowConnector({ completed }: { completed: boolean }) {
  return (
    <div className="flex justify-center py-1">
      <div className="relative h-5 w-px">
        <div
          className="absolute inset-0 w-px transition-colors duration-500"
          style={{
            background: completed
              ? 'linear-gradient(to bottom, rgba(0,208,132,0.4), rgba(0,208,132,0.15))'
              : 'linear-gradient(to bottom, rgba(107,114,128,0.3), rgba(107,114,128,0.1))',
          }}
        />
        {!completed && (
          <motion.div
            className="absolute top-0 left-0 w-px h-2"
            style={{ background: 'rgba(77,158,255,0.6)' }}
            animate={{ top: ['0%', '100%'] }}
            transition={{ duration: 1.5, repeat: Infinity, ease: 'linear' }}
          />
        )}
      </div>
    </div>
  )
}

// ─── Dependency Graph ───────────────────────────────────────────────────────────

const DependencyGraph = memo(function DependencyGraph({
  teams,
}: {
  teams: TeamResult[]
}) {
  const teamsByName = new Map(teams.map(t => [t.team_name, t]))

  const getStatus = (name: string) => teamsByName.get(name)?.status || 'waiting'
  const getColor = (name: string) => STATUS_CONFIG[getStatus(name)]?.color || '#6B7280'

  const nodeStyle = (name: string): React.CSSProperties => ({
    background: `${getColor(name)}12`,
    border: `1.5px solid ${getColor(name)}40`,
    color: getColor(name),
  })

  return (
    <div className="mt-4 p-4 rounded-xl bg-bg-surface border border-white/[0.06]">
      <div className="flex items-center gap-2 mb-3">
        <Network className="w-3.5 h-3.5 text-text-muted" />
        <span className="text-xs font-semibold text-text-secondary">Dependency Graph</span>
      </div>
      <div className="flex flex-col items-center gap-1">
        {/* CLO */}
        <div className="px-3 py-1.5 rounded-lg text-[10px] font-semibold text-center" style={nodeStyle('Chief Legal Officer')}>
          Chief Legal Officer
        </div>
        <div className="w-px h-3" style={{ background: `${getColor('Chief Legal Officer')}30` }} />

        {/* Doc Intel */}
        <div className="px-3 py-1.5 rounded-lg text-[10px] font-semibold text-center" style={nodeStyle('Document Intelligence Team')}>
          Document Intelligence
        </div>
        <div className="w-px h-3" style={{ background: `${getColor('Document Intelligence Team')}30` }} />

        {/* Classification */}
        <div className="px-3 py-1.5 rounded-lg text-[10px] font-semibold text-center" style={nodeStyle('Contract Classification Team')}>
          Classification
        </div>
        <div className="w-px h-3" style={{ background: `${getColor('Contract Classification Team')}30` }} />

        {/* Clause Analysis */}
        <div className="px-3 py-1.5 rounded-lg text-[10px] font-semibold text-center" style={nodeStyle('Clause Analysis Team')}>
          Clause Analysis
        </div>
        <div className="w-px h-3" style={{ background: `${getColor('Clause Analysis Team')}30` }} />

        {/* Fan-out bar */}
        <div className="relative w-full max-w-[400px]">
          <div className="h-px w-full" style={{ background: 'rgba(77,158,255,0.25)' }} />
          <div className="absolute left-0 top-0 w-1 h-1 rounded-full -translate-y-1/2" style={{ background: '#4D9EFF' }} />
          <div className="absolute right-0 top-0 w-1 h-1 rounded-full -translate-y-1/2" style={{ background: '#4D9EFF' }} />
          <div className="absolute left-1/2 top-0 w-1 h-1 rounded-full -translate-x-1/2 -translate-y-1/2" style={{ background: '#4D9EFF' }} />
        </div>

        {/* Parallel specialists */}
        <div className="flex gap-3 mt-1">
          <div className="px-2.5 py-1.5 rounded-lg text-[10px] font-semibold text-center" style={nodeStyle('Financial Risk Team')}>
            Financial Risk
          </div>
          <div className="px-2.5 py-1.5 rounded-lg text-[10px] font-semibold text-center" style={nodeStyle('Privacy / Compliance Team')}>
            Privacy
          </div>
          <div className="px-2.5 py-1.5 rounded-lg text-[10px] font-semibold text-center" style={nodeStyle('Litigation Prediction Team')}>
            Litigation
          </div>
        </div>

        {/* Fan-in bar */}
        <div className="relative w-full max-w-[400px] mt-1">
          <div className="h-px w-full" style={{ background: 'rgba(77,158,255,0.25)' }} />
        </div>
        <div className="w-px h-3" style={{ background: `${getColor('Chief Review Board')}30` }} />

        {/* Chief Review Board */}
        <div className="px-3 py-1.5 rounded-lg text-[10px] font-semibold text-center" style={nodeStyle('Chief Review Board')}>
          Chief Review Board
        </div>
      </div>
    </div>
  )
})

// ─── Execution Timeline ─────────────────────────────────────────────────────────

const ExecutionTimeline = memo(function ExecutionTimeline({
  teams,
}: {
  teams: TeamResult[]
}) {
  const completedTeams = teams.filter(t => t.status === 'completed' && t.duration > 0)
  if (completedTeams.length === 0) return null

  const maxDuration = Math.max(...completedTeams.map(t => t.duration))

  return (
    <div className="mt-4 p-4 rounded-xl bg-bg-surface border border-white/[0.06]">
      <div className="flex items-center gap-2 mb-3">
        <Clock className="w-3.5 h-3.5 text-text-muted" />
        <span className="text-xs font-semibold text-text-secondary">Execution Timeline</span>
        <span className="text-[10px] text-text-muted ml-auto font-mono">
          Total: {completedTeams.reduce((s, t) => s + t.duration, 0).toFixed(1)}s
        </span>
      </div>
      <div className="space-y-1.5">
        {completedTeams.map((team, i) => {
          const config = STATUS_CONFIG[team.status]
          const widthPct = maxDuration > 0 ? (team.duration / maxDuration) * 100 : 0
          const isParallel = team.parallel_group === 'specialists' || [
            'Financial Risk Team', 'Privacy / Compliance Team', 'Litigation Prediction Team'
          ].includes(team.team_name)

          return (
            <motion.div
              key={team.team_name}
              initial={{ opacity: 0, x: -10 }}
              animate={{ opacity: 1, x: 0 }}
              transition={{ delay: i * 0.04 }}
              className="flex items-center gap-2"
            >
              <span className="text-[10px] text-text-muted w-[90px] truncate text-right font-mono flex-shrink-0">
                {SHORT_NAMES[team.team_name] || team.team_name}
              </span>
              <div className="flex-1 h-4 bg-white/[0.03] rounded-full overflow-hidden relative">
                <motion.div
                  className="h-full rounded-full relative"
                  initial={{ width: 0 }}
                  animate={{ width: `${Math.max(widthPct, 8)}%` }}
                  transition={{ duration: 0.6, delay: i * 0.05, ease: 'easeOut' }}
                  style={{
                    background: `linear-gradient(90deg, ${config.color}50, ${config.color}90)`,
                  }}
                >
                  {isParallel && (
                    <div className="absolute right-1 top-1/2 -translate-y-1/2">
                      <span className="text-[8px] font-bold px-1 py-px rounded bg-blue/20 text-blue border border-blue/30">
                        PARALLEL
                      </span>
                    </div>
                  )}
                </motion.div>
              </div>
              <span className="text-[10px] text-text-secondary w-[40px] text-right font-mono flex-shrink-0">
                {team.duration.toFixed(1)}s
              </span>
            </motion.div>
          )
        })}
      </div>
    </div>
  )
})

// ─── Board Consensus Panel ──────────────────────────────────────────────────────

function BoardConsensusPanel({ teams }: { teams: TeamResult[] }) {
  const board = teams.find(t => t.team_name === 'Chief Review Board')
  if (!board || board.status !== 'completed') return null

  const output = (board as any).output
  if (!output) return null

  const finalReport = output.final_report
  if (!finalReport) return null

  const riskColor = (risk: string) => {
    switch (risk?.toLowerCase()) {
      case 'high': return '#FF4444'
      case 'moderate': return '#FF8C00'
      case 'low': return '#00D084'
      default: return '#8A8A9A'
    }
  }

  return (
    <motion.div
      initial={{ opacity: 0, y: 12 }}
      animate={{ opacity: 1, y: 0 }}
      className="mt-4 rounded-xl border border-gold/20 bg-bg-elevated overflow-hidden"
    >
      <div className="px-4 py-3 border-b border-gold/10 bg-gold/5">
        <div className="flex items-center gap-2">
          <Crown className="w-4 h-4 text-gold" />
          <h3 className="text-xs font-semibold text-gold">Chief Review Board — Consensus</h3>
        </div>
      </div>

      <div className="p-4 space-y-3">
        {/* Key metrics */}
        <div className="grid grid-cols-3 gap-3">
          <div className="text-center p-2 rounded-lg bg-bg-surface border border-white/[0.06]">
            <p className="text-[10px] text-text-muted uppercase tracking-wider mb-1">Overall Risk</p>
            <p className="text-sm font-bold" style={{ color: riskColor(finalReport.overall_risk) }}>
              {finalReport.overall_risk?.toUpperCase() || 'N/A'}
            </p>
          </div>
          <div className="text-center p-2 rounded-lg bg-bg-surface border border-white/[0.06]">
            <p className="text-[10px] text-text-muted uppercase tracking-wider mb-1">Recommendation</p>
            <p className="text-[11px] font-semibold text-text-primary leading-tight">
              {finalReport.signing_recommendation || 'N/A'}
            </p>
          </div>
          <div className="text-center p-2 rounded-lg bg-bg-surface border border-white/[0.06]">
            <p className="text-[10px] text-text-muted uppercase tracking-wider mb-1">Confidence</p>
            <p className="text-sm font-bold text-gold">
              {finalReport.confidence ? `${(finalReport.confidence * 100).toFixed(0)}%` : 'N/A'}
            </p>
          </div>
        </div>

        {/* Critical Issues */}
        {finalReport.critical_issues?.length > 0 && (
          <div>
            <h4 className="text-[10px] font-semibold text-text-secondary uppercase tracking-wider mb-1.5 flex items-center gap-1">
              <AlertTriangle className="w-3 h-3 text-danger" />
              Critical Issues
            </h4>
            <ul className="space-y-1">
              {finalReport.critical_issues.slice(0, 5).map((issue: string, i: number) => (
                <li key={i} className="text-[10px] text-text-muted pl-3 relative before:absolute before:left-0 before:top-1.5 before:w-1 before:h-1 before:rounded-full before:bg-danger/60">
                  {issue}
                </li>
              ))}
            </ul>
          </div>
        )}

        {/* Supporting Evidence */}
        {finalReport.supporting_evidence?.length > 0 && (
          <div>
            <h4 className="text-[10px] font-semibold text-text-secondary uppercase tracking-wider mb-1.5">
              Supporting Evidence
            </h4>
            <ul className="space-y-1">
              {finalReport.supporting_evidence.slice(0, 4).map((ev: string, i: number) => (
                <li key={i} className="text-[10px] text-text-muted pl-3 relative before:absolute before:left-0 before:top-1.5 before:w-1 before:h-1 before:rounded-full before:bg-safe/60">
                  {ev}
                </li>
              ))}
            </ul>
          </div>
        )}

        {/* What Changed */}
        {finalReport.what_changed?.length > 0 && (
          <div>
            <h4 className="text-[10px] font-semibold text-text-secondary uppercase tracking-wider mb-1.5">
              What Changed in Review
            </h4>
            <ul className="space-y-1">
              {finalReport.what_changed.slice(0, 4).map((item: string, i: number) => (
                <li key={i} className="text-[10px] text-text-muted pl-3 relative before:absolute before:left-0 before:top-1.5 before:w-1 before:h-1 before:rounded-full before:bg-gold/60">
                  {item}
                </li>
              ))}
            </ul>
          </div>
        )}
      </div>
    </motion.div>
  )
}


// ─── Main Exported Component ────────────────────────────────────────────────────

export function SwarmOrganization({
  contractId,
  contractStatus,
}: {
  contractId: string
  contractStatus: string
}) {
  const [teams, setTeams] = useState<TeamResult[]>([])
  const [definitions, setDefinitions] = useState<TeamDefinition[]>([])
  const [swarmStatus, setSwarmStatus] = useState<string>('idle')
  const [isExpanded, setIsExpanded] = useState(true)
  const [hasEverLoaded, setHasEverLoaded] = useState(false)
  const pollRef = useRef<ReturnType<typeof setInterval> | null>(null)

  // Merge team_definitions with live team data
  const mergedTeams = useCallback((): TeamResult[] => {
    if (teams.length > 0) {
      // We have live data — enhance with definitions
      const defMap = new Map(definitions.map(d => [d.team_name, d]))
      return teams.map(t => ({
        ...t,
        wave: defMap.get(t.team_name)?.wave ?? 0,
        parallel_group: defMap.get(t.team_name)?.parallel_group,
        dependencies: t.dependencies?.length ? t.dependencies : (defMap.get(t.team_name)?.dependencies ?? []),
        specialization: t.specialization || defMap.get(t.team_name)?.specialization || '',
      }))
    }
    // No live data — show definitions as waiting (for completed contracts)
    return definitions.map(d => ({
      team_name: d.team_name,
      specialization: d.specialization,
      status: 'completed' as TeamStatus,
      dependencies: d.dependencies,
      duration: 0,
      confidence: null,
      reasoning_summary: '',
      wave: d.wave,
      parallel_group: d.parallel_group,
    }))
  }, [teams, definitions])

  // Fetch swarm status
  const fetchStatus = useCallback(async () => {
    try {
      const res = await api.get<SwarmStatusResponse>(`/api/swarm/status/${contractId}`)
      const data = res.data
      setSwarmStatus(data.swarm_status)
      setDefinitions(data.team_definitions)
      setHasEverLoaded(true)

      if (data.final_results) {
        // Analysis complete — use finalized results
        setTeams(data.final_results)
      } else if (data.teams?.length > 0) {
        setTeams(Array.isArray(data.teams) ? data.teams : Object.values(data.teams))
      }

      // Stop polling when analysis is done
      if (data.swarm_status === 'complete' || data.swarm_status === 'idle') {
        if (pollRef.current) {
          clearInterval(pollRef.current)
          pollRef.current = null
        }
      }
    } catch {
      // Silently handle — the endpoint might not exist yet in dev
    }
  }, [contractId])

  // Polling lifecycle
  useEffect(() => {
    fetchStatus()

    // Poll every 1s while analysis is in progress
    if (contractStatus === 'processing' || contractStatus === 'pending') {
      pollRef.current = setInterval(fetchStatus, 1000)
    }

    return () => {
      if (pollRef.current) {
        clearInterval(pollRef.current)
        pollRef.current = null
      }
    }
  }, [contractId, contractStatus, fetchStatus])

  const displayTeams = mergedTeams()
  const sequentialTeams = displayTeams.filter(t => t.wave !== 4)
  const parallelTeams = displayTeams.filter(t => t.wave === 4)
  const allCompleted = displayTeams.every(t => t.status === 'completed')
  const runningCount = displayTeams.filter(t => t.status === 'running').length
  const completedCount = displayTeams.filter(t => t.status === 'completed').length

  if (!hasEverLoaded && definitions.length === 0) {
    return null // Don't render until we have data
  }

  return (
    <div className="border-b border-white/[0.06]">
      {/* Header */}
      <button
        onClick={() => setIsExpanded(!isExpanded)}
        className="w-full px-4 py-3 flex items-center gap-3 hover:bg-white/[0.02] transition-colors"
      >
        <div className="relative">
          <div className="w-9 h-9 rounded-xl bg-gradient-to-br from-gold/20 to-gold/5 border border-gold/30 flex items-center justify-center">
            <Brain className="w-4.5 h-4.5 text-gold" />
          </div>
          {runningCount > 0 && (
            <span className="absolute -top-1 -right-1 w-4 h-4 bg-blue text-white text-[8px] font-bold rounded-full flex items-center justify-center animate-pulse">
              {runningCount}
            </span>
          )}
        </div>
        <div className="text-left flex-1">
          <h2 className="text-sm font-semibold text-text-primary flex items-center gap-2">
            AI Legal Organization
            {allCompleted && (
              <CheckCircle2 className="w-3.5 h-3.5 text-safe" />
            )}
          </h2>
          <p className="text-[10px] text-text-muted">
            Powered by OpenSwarm Multi-Agent Collaboration
            <span className="text-text-muted ml-2">
              — {completedCount}/{displayTeams.length} teams
            </span>
          </p>
        </div>

        {/* Progress mini-bar */}
        <div className="w-20 h-1.5 bg-white/[0.06] rounded-full overflow-hidden">
          <motion.div
            className="h-full rounded-full"
            style={{
              background: allCompleted
                ? 'linear-gradient(90deg, #00D084, #00D084)'
                : 'linear-gradient(90deg, #4D9EFF, #E8C547)',
            }}
            animate={{
              width: `${displayTeams.length > 0 ? (completedCount / displayTeams.length) * 100 : 0}%`,
            }}
            transition={{ duration: 0.4 }}
          />
        </div>

        {isExpanded ? (
          <ChevronUp className="w-4 h-4 text-text-muted flex-shrink-0" />
        ) : (
          <ChevronDown className="w-4 h-4 text-text-muted flex-shrink-0" />
        )}
      </button>

      {/* Expandable body */}
      <AnimatePresence>
        {isExpanded && (
          <motion.div
            initial={{ height: 0, opacity: 0 }}
            animate={{ height: 'auto', opacity: 1 }}
            exit={{ height: 0, opacity: 0 }}
            transition={{ duration: 0.3, ease: 'easeInOut' }}
            className="overflow-hidden"
          >
            <div className="px-4 pb-4">
              {/* Team cards in pipeline order */}
              <div className="space-y-0">
                {/* Wave 0-3: Sequential teams */}
                {sequentialTeams
                  .filter(t => (t.wave ?? 0) < 4)
                  .sort((a, b) => (a.wave ?? 0) - (b.wave ?? 0))
                  .map((team, i) => (
                    <div key={team.team_name}>
                      {i > 0 && (
                        <FlowConnector completed={team.status === 'completed'} />
                      )}
                      <TeamCard team={team} index={i} />
                    </div>
                  ))}

                {/* Wave 4: Parallel specialists */}
                {parallelTeams.length > 0 && (
                  <>
                    <FlowConnector
                      completed={parallelTeams.every(t => t.status === 'completed')}
                    />
                    <div className="relative">
                      {/* Parallel label */}
                      <div className="absolute -top-0.5 right-0 z-10">
                        <span className="text-[8px] font-bold px-1.5 py-0.5 rounded-full bg-blue/10 text-blue border border-blue/20 uppercase tracking-widest">
                          Parallel Execution
                        </span>
                      </div>
                      <div className="flex gap-2">
                        {parallelTeams.map((team, i) => (
                          <TeamCard
                            key={team.team_name}
                            team={team}
                            isParallel
                            index={sequentialTeams.filter(t => (t.wave ?? 0) < 4).length + i}
                          />
                        ))}
                      </div>
                    </div>
                  </>
                )}

                {/* Wave 5: Chief Review Board */}
                {sequentialTeams
                  .filter(t => (t.wave ?? 0) >= 5)
                  .map((team, i) => (
                    <div key={team.team_name}>
                      <FlowConnector completed={team.status === 'completed'} />
                      <TeamCard
                        team={team}
                        index={sequentialTeams.filter(t => (t.wave ?? 0) < 4).length + parallelTeams.length + i}
                      />
                    </div>
                  ))}
              </div>

              {/* Board Consensus Panel */}
              <BoardConsensusPanel teams={displayTeams} />

              {/* Timeline + Dependency Graph side by side */}
              <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
                <ExecutionTimeline teams={displayTeams} />
                <DependencyGraph teams={displayTeams} />
              </div>
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  )
}
