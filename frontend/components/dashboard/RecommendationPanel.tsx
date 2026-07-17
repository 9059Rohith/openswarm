'use client'

import Link from 'next/link'
import { motion } from 'framer-motion'
import { CalendarClock, CheckCircle2, Lightbulb, Loader2, Sparkles } from 'lucide-react'
import { Card } from '@/components/ui/Card'
import { useRecommendations } from '@/lib/api'
import { cn, truncate } from '@/lib/utils'
import type { Recommendation } from '@/lib/types'

const priorityStyles = {
  'High Priority': {
    color: '#FF4444',
    bg: 'rgba(255,68,68,0.10)',
    border: 'rgba(255,68,68,0.30)',
  },
  'Medium Priority': {
    color: '#FF8C00',
    bg: 'rgba(255,140,0,0.10)',
    border: 'rgba(255,140,0,0.28)',
  },
  'Low Priority': {
    color: '#00D084',
    bg: 'rgba(0,208,132,0.08)',
    border: 'rgba(0,208,132,0.26)',
  },
} as const

const priorityOrder = ['High Priority', 'Medium Priority', 'Low Priority'] as const

function formatDueDate(dateStr: string) {
  const [year, month, day] = dateStr.split('-').map(Number)
  if (!year || !month || !day) return dateStr
  return new Date(year, month - 1, day).toLocaleDateString('en-US', {
    year: 'numeric',
    month: 'short',
    day: 'numeric',
  })
}

function PriorityBadge({ label }: { label: Recommendation['priority_label'] }) {
  const style = priorityStyles[label]
  return (
    <span
      className="inline-flex w-fit items-center rounded-full px-2 py-1 text-[10px] font-semibold uppercase"
      style={{
        color: style.color,
        background: style.bg,
        border: `1px solid ${style.border}`,
      }}
    >
      {label}
    </span>
  )
}

function RecommendationRow({ recommendation }: { recommendation: Recommendation }) {
  return (
    <div className="grid gap-3 border-t border-white/[0.05] px-4 py-3 text-sm lg:grid-cols-[1.25fr_1.6fr_0.8fr_1fr_0.8fr]">
      <div>
        <p className="font-medium text-text-primary">{recommendation.action}</p>
        <p className="mt-1 text-[11px] text-text-muted">{recommendation.category}</p>
      </div>
      <p className="leading-relaxed text-text-secondary">{recommendation.reason}</p>
      <div className="flex items-start lg:justify-start">
        <PriorityBadge label={recommendation.priority_label} />
      </div>
      <div className="text-text-secondary">
        {recommendation.related_contract_id ? (
          <Link
            href={`/analyze/${recommendation.related_contract_id}`}
            className="text-gold transition-colors hover:text-gold-hover"
            title={recommendation.related_contract_name || 'Related contract'}
          >
            {truncate(recommendation.related_contract_name || 'Open contract', 28)}
          </Link>
        ) : (
          <span className="text-text-muted">Portfolio-wide</span>
        )}
      </div>
      <div className="flex items-center gap-2 text-text-secondary">
        <CalendarClock className="h-3.5 w-3.5 text-text-muted" />
        <span>{formatDueDate(recommendation.suggested_due_date)}</span>
      </div>
    </div>
  )
}

export function RecommendationPanel() {
  const { data, isLoading, isError } = useRecommendations()

  const total = data?.total ?? 0
  const categories = data?.categories

  return (
    <motion.section
      initial={{ opacity: 0, y: 12 }}
      animate={{ opacity: 1, y: 0 }}
      className="mb-8"
    >
      <Card hover={false} className="overflow-hidden">
        <div className="flex flex-col gap-3 border-b border-white/[0.06] bg-bg-elevated/50 px-5 py-4 md:flex-row md:items-center md:justify-between">
          <div className="flex items-center gap-3">
            <div className="flex h-10 w-10 items-center justify-center rounded-xl border border-gold/30 bg-gold/10">
              <Sparkles className="h-4.5 w-4.5 text-gold" />
            </div>
            <div>
              <h2 className="text-base font-semibold text-text-primary">Personalized Recommendations</h2>
              <p className="mt-0.5 text-xs text-text-muted">Recommendation Agent in the AI Legal Organization</p>
            </div>
          </div>
          <div className="flex flex-wrap gap-2">
            <span className="rounded-full border border-danger/25 bg-danger/10 px-2.5 py-1 text-xs font-mono text-danger">
              {data?.high_count ?? 0} High
            </span>
            <span className="rounded-full border border-warning/25 bg-warning/10 px-2.5 py-1 text-xs font-mono text-warning">
              {data?.medium_count ?? 0} Medium
            </span>
            <span className="rounded-full border border-safe/25 bg-safe/10 px-2.5 py-1 text-xs font-mono text-safe">
              {data?.low_count ?? 0} Low
            </span>
          </div>
        </div>

        {isLoading ? (
          <div className="flex items-center gap-2 px-5 py-8 text-sm text-text-secondary">
            <Loader2 className="h-4 w-4 animate-spin text-gold" />
            Preparing recommendations...
          </div>
        ) : isError ? (
          <div className="flex items-center gap-2 px-5 py-8 text-sm text-warning">
            <Lightbulb className="h-4 w-4" />
            Recommendations are unavailable right now.
          </div>
        ) : total === 0 ? (
          <div className="flex items-center gap-2 px-5 py-8 text-sm text-text-secondary">
            <CheckCircle2 className="h-4 w-4 text-safe" />
            Analyze contracts to receive daily legal advisor recommendations.
          </div>
        ) : (
          <div>
            <div className="hidden grid-cols-[1.25fr_1.6fr_0.8fr_1fr_0.8fr] gap-3 px-4 py-2 text-[10px] font-semibold uppercase text-text-muted lg:grid">
              <span>Recommended Action</span>
              <span>Reason</span>
              <span>Priority</span>
              <span>Related Contract</span>
              <span>Suggested Due Date</span>
            </div>
            {priorityOrder.map((label) => {
              const recommendations = categories?.[label] ?? []
              if (recommendations.length === 0) return null
              const style = priorityStyles[label]
              return (
                <div key={label}>
                  <div
                    className={cn(
                      'border-t px-4 py-2 text-[11px] font-bold uppercase tracking-wider'
                    )}
                    style={{
                      color: style.color,
                      background: style.bg,
                      borderColor: style.border,
                    }}
                  >
                    {label}
                  </div>
                  {recommendations.map((recommendation) => (
                    <RecommendationRow key={recommendation.id} recommendation={recommendation} />
                  ))}
                </div>
              )
            })}
          </div>
        )}
      </Card>
    </motion.section>
  )
}
