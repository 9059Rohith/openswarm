'use client'

import { motion } from 'framer-motion'
import Link from 'next/link'
import { useRouter } from 'next/navigation'
import { Plus, TrendingUp, AlertTriangle, FileText, BarChart3, Clock } from 'lucide-react'
import { useContracts, useStats } from '@/lib/api'
import { useAppStore } from '@/lib/store'
import { Button } from '@/components/ui/Button'
import { Card } from '@/components/ui/Card'
import { RiskBadge } from '@/components/ui/Badge'
import { ContractCardSkeleton } from '@/components/ui/LoadingSkeleton'
import { DailyLegalBrief } from '@/components/dashboard/DailyLegalBrief'
import { RecommendationPanel } from '@/components/dashboard/RecommendationPanel'
import { riskColor, formatDate, truncate } from '@/lib/utils'

function MiniGauge({ score }: { score: number }) {
  const color = score > 70 ? '#FF4444' : score > 30 ? '#FF8C00' : '#00D084'
  const pct = Math.min(100, Math.max(0, score))
  return (
    <div className="flex items-center gap-2">
      <div className="flex-1 h-1.5 bg-bg-elevated rounded-full overflow-hidden">
        <div className="h-full rounded-full transition-all" style={{ width: `${pct}%`, background: color }} />
      </div>
      <span className="text-xs font-mono text-text-secondary w-8 text-right">{score.toFixed(0)}</span>
    </div>
  )
}

const stagger = {
  container: { animate: { transition: { staggerChildren: 0.06 } } },
  item: { initial: { opacity: 0, y: 16 }, animate: { opacity: 1, y: 0 } },
}

export default function DashboardPage() {
  const router = useRouter()
  const setUploadOpen = useAppStore((s) => s.setUploadModalOpen)
  const { data: contracts, isLoading: contractsLoading } = useContracts()
  const { data: stats, isLoading: statsLoading } = useStats()

  const statCards = [
    {
      label: 'Total Contracts',
      value: stats?.total_contracts ?? 0,
      icon: FileText,
      color: '#4D9EFF',
      bg: 'rgba(77,158,255,0.1)',
    },
    {
      label: 'High Risk Contracts',
      value: stats?.high_risk_contracts ?? 0,
      icon: AlertTriangle,
      color: '#FF4444',
      bg: 'rgba(255,68,68,0.1)',
    },
    {
      label: 'Avg Risk Score',
      value: `${(stats?.average_risk_score ?? 0).toFixed(0)}/100`,
      icon: BarChart3,
      color: '#E8C547',
      bg: 'rgba(232,197,71,0.1)',
    },
    {
      label: 'Clauses Flagged',
      value: stats?.total_clauses_flagged ?? 0,
      icon: TrendingUp,
      color: '#00D084',
      bg: 'rgba(0,208,132,0.1)',
    },
  ]

  return (
    <div className="p-6 max-w-7xl mx-auto">
      {/* Header */}
      <motion.div
        initial={{ opacity: 0, y: 12 }}
        animate={{ opacity: 1, y: 0 }}
        className="flex items-center justify-between mb-8"
      >
        <div>
          <h1 className="text-2xl font-bold text-text-primary">Dashboard</h1>
          <p className="text-text-secondary text-sm mt-0.5">Your contract intelligence overview</p>
        </div>
        <Button variant="gold" onClick={() => setUploadOpen(true)} className="gap-2">
          <Plus className="w-4 h-4" />
          Analyze New Contract
        </Button>
      </motion.div>

      {/* Stats Row */}
      <motion.div
        variants={stagger.container}
        initial="initial"
        animate="animate"
        className="grid grid-cols-2 lg:grid-cols-4 gap-4 mb-8"
      >
        {statCards.map((stat, i) => {
          const Icon = stat.icon
          return (
            <motion.div key={i} variants={stagger.item}>
              <Card className="p-5">
                <div className="flex items-start justify-between mb-3">
                  <div className="w-9 h-9 rounded-lg flex items-center justify-center" style={{ background: stat.bg }}>
                    <Icon className="w-4.5 h-4.5" style={{ color: stat.color }} />
                  </div>
                </div>
                <div className="text-2xl font-mono font-bold text-text-primary mb-0.5">
                  {statsLoading ? '—' : stat.value}
                </div>
                <div className="text-text-muted text-xs">{stat.label}</div>
              </Card>
            </motion.div>
          )
        })}
      </motion.div>

      <DailyLegalBrief />
      <RecommendationPanel />

      {/* Contracts Grid */}
      <div className="mb-4 flex items-center justify-between">
        <h2 className="text-lg font-semibold text-text-primary">Recent Contracts</h2>
        <Link href="/history" className="text-sm text-text-secondary hover:text-gold transition-colors">
          View all →
        </Link>
      </div>

      {contractsLoading ? (
        <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-4">
          {[1, 2, 3].map(i => <ContractCardSkeleton key={i} />)}
        </div>
      ) : !contracts?.length ? (
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          className="flex flex-col items-center justify-center py-20 text-center"
        >
          <div className="w-16 h-16 bg-bg-surface border border-white/[0.06] rounded-2xl flex items-center justify-center mb-4">
            <FileText className="w-8 h-8 text-text-muted" />
          </div>
          <h3 className="text-lg font-semibold text-text-primary mb-2">No contracts yet</h3>
          <p className="text-text-secondary text-sm mb-6 max-w-sm">
            Upload your first contract to start protecting yourself from hidden risks.
          </p>
          <Button variant="gold" onClick={() => setUploadOpen(true)}>
            <Plus className="w-4 h-4" />
            Analyze Your First Contract
          </Button>
        </motion.div>
      ) : (
        <motion.div
          variants={stagger.container}
          initial="initial"
          animate="animate"
          className="grid md:grid-cols-2 lg:grid-cols-3 gap-4"
        >
          {contracts.map((contract) => (
            <motion.div key={contract.id} variants={stagger.item}>
              <Card
                goldHover
                className="p-5 cursor-pointer group"
                style={{
                  borderLeft: `3px solid ${riskColor(contract.risk_level)}`,
                }}
                onClick={() => router.push(`/analyze/${contract.id}`)}
              >
                <div className="flex items-start justify-between mb-3">
                  <div className="flex-1 min-w-0">
                    <p className="text-text-primary font-medium text-sm truncate" title={contract.original_filename}>
                      {truncate(contract.original_filename, 35)}
                    </p>
                    <div className="flex items-center gap-2 mt-1">
                      <span className="text-xs bg-bg-elevated border border-white/[0.06] rounded px-2 py-0.5 text-text-muted">
                        {contract.contract_type}
                      </span>
                    </div>
                  </div>
                  <RiskBadge level={contract.risk_level} size="sm" pulse={contract.risk_level === 'high'} />
                </div>

                {/* Risk Score Bar */}
                {contract.status === 'complete' && (
                  <div className="mb-3">
                    <MiniGauge score={contract.aggregate_risk_index} />
                  </div>
                )}

                {contract.status === 'processing' && (
                  <div className="mb-3">
                    <div className="h-1.5 bg-bg-elevated rounded-full overflow-hidden">
                      <div className="h-full bg-gold/40 rounded-full animate-pulse w-2/3" />
                    </div>
                    <p className="text-text-muted text-xs mt-1">Analyzing...</p>
                  </div>
                )}

                {/* Clause counts */}
                {contract.status === 'complete' && (
                  <div className="flex gap-2 mb-3">
                    <span className="text-xs px-2 py-0.5 rounded-full bg-danger/10 text-danger font-mono">{contract.high_count} High</span>
                    <span className="text-xs px-2 py-0.5 rounded-full bg-warning/10 text-warning font-mono">{contract.moderate_count} Mod</span>
                    <span className="text-xs px-2 py-0.5 rounded-full bg-safe/10 text-safe font-mono">{contract.low_count} Low</span>
                  </div>
                )}

                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-1 text-text-muted text-xs">
                    <Clock className="w-3 h-3" />
                    {formatDate(contract.created_at)}
                  </div>
                  <span className="text-gold text-xs opacity-0 group-hover:opacity-100 transition-opacity font-medium">
                    View Analysis →
                  </span>
                </div>
              </Card>
            </motion.div>
          ))}
        </motion.div>
      )}
    </div>
  )
}
