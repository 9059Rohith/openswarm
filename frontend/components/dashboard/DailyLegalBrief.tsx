'use client'

import { useEffect, useMemo, useState } from 'react'
import Link from 'next/link'
import { motion } from 'framer-motion'
import {
  AlertTriangle,
  Bell,
  CalendarDays,
  CheckCircle2,
  Clock,
  FileSignature,
  Loader2,
  Mic2,
  RotateCcw,
  ShieldAlert,
  Square,
  TrendingUp,
  Volume2,
  VolumeX,
} from 'lucide-react'
import { Card } from '@/components/ui/Card'
import { useDailyBrief } from '@/lib/api'
import type { DailyTask, DailyTaskPriority } from '@/lib/types'
import { truncate } from '@/lib/utils'

type TaskActionState = {
  done?: boolean
  snoozedUntil?: string
  priority?: DailyTaskPriority
}

type TaskActionMap = Record<string, TaskActionState>

const ACTIONS_KEY = 'lexguard_daily_task_actions'

const priorityStyle: Record<DailyTaskPriority, { color: string; bg: string; border: string }> = {
  Critical: { color: '#FF4444', bg: 'rgba(255,68,68,0.10)', border: 'rgba(255,68,68,0.34)' },
  High: { color: '#FF8C00', bg: 'rgba(255,140,0,0.10)', border: 'rgba(255,140,0,0.30)' },
  Medium: { color: '#4D9EFF', bg: 'rgba(77,158,255,0.10)', border: 'rgba(77,158,255,0.28)' },
  Low: { color: '#00D084', bg: 'rgba(0,208,132,0.08)', border: 'rgba(0,208,132,0.26)' },
}

const priorityOrder: DailyTaskPriority[] = ['Critical', 'High', 'Medium', 'Low']
const timelineOrder = ['Today', 'Due Tomorrow', 'This Week', 'Upcoming'] as const

function taskKey(task: DailyTask) {
  return [
    task.title,
    task.related_contract_id ?? 'portfolio',
    task.due_date,
    task.category,
  ].join('|')
}

function addDays(dateStr: string, days: number) {
  const [year, month, day] = dateStr.split('-').map(Number)
  const date = year && month && day ? new Date(year, month - 1, day) : new Date()
  date.setDate(date.getDate() + days)
  return date.toISOString().slice(0, 10)
}

function formatDueDate(dateStr: string) {
  const [year, month, day] = dateStr.split('-').map(Number)
  if (!year || !month || !day) return dateStr
  return new Date(year, month - 1, day).toLocaleDateString('en-US', {
    month: 'short',
    day: 'numeric',
  })
}

function applyTaskAction(task: DailyTask, action?: TaskActionState): DailyTask {
  return {
    ...task,
    priority: action?.priority ?? task.priority,
    due_date: action?.snoozedUntil ?? task.due_date,
    due_label: action?.snoozedUntil ? 'Due Tomorrow' : task.due_label,
  }
}

function groupTimeline(tasks: DailyTask[]) {
  return timelineOrder.map((label) => ({
    label,
    tasks: tasks.filter((task) => task.due_label === label),
  }))
}

function TaskCard({
  task,
  action,
  onDone,
  onSnooze,
  onPriority,
}: {
  task: DailyTask
  action?: TaskActionState
  onDone: () => void
  onSnooze: () => void
  onPriority: (priority: DailyTaskPriority) => void
}) {
  const style = priorityStyle[task.priority]
  const isDone = !!action?.done

  return (
    <div
      className={`rounded-lg border bg-bg-elevated/60 p-3 transition-opacity ${isDone ? 'opacity-55' : ''}`}
      style={{ borderColor: isDone ? 'rgba(0,208,132,0.30)' : style.border }}
    >
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <p className={`text-sm font-semibold ${isDone ? 'text-safe line-through' : 'text-text-primary'}`}>
            {task.title}
          </p>
          <p className="mt-1 line-clamp-2 text-xs leading-relaxed text-text-secondary">{task.reason}</p>
        </div>
        <span
          className="shrink-0 rounded-full px-2 py-1 text-[10px] font-bold uppercase"
          style={{ color: style.color, background: style.bg, border: `1px solid ${style.border}` }}
        >
          {task.priority}
        </span>
      </div>

      <div className="mt-3 flex flex-wrap items-center gap-2 text-[11px] text-text-muted">
        <span className="inline-flex items-center gap-1">
          <Clock className="h-3 w-3" />
          {task.due_label} · {formatDueDate(task.due_date)}
        </span>
        <span className="rounded bg-bg-surface px-1.5 py-0.5">{task.category}</span>
        {task.related_contract_id ? (
          <Link href={`/analyze/${task.related_contract_id}`} className="text-gold hover:text-gold-hover">
            {truncate(task.related_contract_name || 'Open contract', 30)}
          </Link>
        ) : (
          <span>Portfolio-wide</span>
        )}
      </div>

      <div className="mt-3 flex flex-wrap items-center gap-2 border-t border-white/[0.05] pt-3">
        <button
          type="button"
          onClick={onDone}
          aria-label={isDone ? 'Reopen task' : 'Mark task done'}
          className="inline-flex items-center gap-1 rounded-md border border-safe/20 bg-safe/10 px-2 py-1 text-[11px] font-medium text-safe hover:bg-safe/15"
        >
          <CheckCircle2 className="h-3 w-3" />
          {isDone ? 'Reopen' : 'Done'}
        </button>
        <button
          type="button"
          onClick={onSnooze}
          aria-label="Snooze task until tomorrow"
          className="inline-flex items-center gap-1 rounded-md border border-gold/20 bg-gold/10 px-2 py-1 text-[11px] font-medium text-gold hover:bg-gold/15"
        >
          <RotateCcw className="h-3 w-3" />
          Snooze
        </button>
        <select
          value={task.priority}
          onChange={(event) => onPriority(event.target.value as DailyTaskPriority)}
          aria-label="Change task priority"
          className="ml-auto rounded-md border border-white/[0.08] bg-bg-surface px-2 py-1 text-[11px] text-text-secondary outline-none focus:border-gold/40"
        >
          {priorityOrder.map((priority) => (
            <option key={priority} value={priority}>{priority}</option>
          ))}
        </select>
      </div>
    </div>
  )
}

function LegalTimeline({ tasks }: { tasks: DailyTask[] }) {
  const groups = groupTimeline(tasks)
  return (
    <div className="rounded-lg border border-white/[0.06] bg-bg-elevated/50 p-3">
      <div className="mb-3 flex items-center gap-2">
        <CalendarDays className="h-3.5 w-3.5 text-blue" />
        <h3 className="text-xs font-semibold uppercase text-text-secondary">Legal Calendar</h3>
      </div>
      <div className="space-y-3">
        {groups.map((group) => (
          <div key={group.label} className="grid grid-cols-[76px_1fr] gap-3">
            <div className="text-[11px] font-semibold text-text-muted">{group.label}</div>
            <div className="space-y-2 border-l border-white/[0.08] pl-3">
              {group.tasks.length ? group.tasks.slice(0, 3).map((task) => {
                const style = priorityStyle[task.priority]
                return (
                  <div key={`${task.id}-${task.due_date}`} className="relative rounded-md bg-bg-surface px-2.5 py-2">
                    <span
                      className="absolute -left-[17px] top-3 h-2 w-2 rounded-full"
                      style={{ background: style.color }}
                    />
                    <p className="truncate text-xs font-medium text-text-primary">{task.title}</p>
                    <p className="mt-0.5 text-[10px] text-text-muted">{task.priority} · {formatDueDate(task.due_date)}</p>
                  </div>
                )
              }) : (
                <p className="py-1 text-[11px] text-text-muted">No scheduled legal work.</p>
              )}
            </div>
          </div>
        ))}
      </div>
    </div>
  )
}

export function DailyLegalBrief() {
  const { data, isLoading, isError } = useDailyBrief()
  const [actions, setActions] = useState<TaskActionMap>({})
  const [muted, setMuted] = useState(false)
  const [speaking, setSpeaking] = useState(false)

  useEffect(() => {
    try {
      const raw = localStorage.getItem(ACTIONS_KEY)
      if (raw) setActions(JSON.parse(raw))
    } catch {
      setActions({})
    }
  }, [])

  useEffect(() => {
    return () => {
      window.speechSynthesis?.cancel()
    }
  }, [])

  const saveActions = (next: TaskActionMap) => {
    setActions(next)
    localStorage.setItem(ACTIONS_KEY, JSON.stringify(next))
  }

  const baseTasks = data?.todays_tasks ?? []
  const originalTaskFor = (task: DailyTask) => baseTasks.find((item) => item.id === task.id) ?? task

  const tasks = useMemo(() => {
    return baseTasks
      .map((task) => applyTaskAction(task, actions[taskKey(task)]))
      .sort((a, b) => {
        const originalA = baseTasks.find((item) => item.id === a.id) ?? a
        const originalB = baseTasks.find((item) => item.id === b.id) ?? b
        const doneA = actions[taskKey(originalA)]?.done ? 1 : 0
        const doneB = actions[taskKey(originalB)]?.done ? 1 : 0
        if (doneA !== doneB) return doneA - doneB
        return priorityOrder.indexOf(a.priority) - priorityOrder.indexOf(b.priority)
      })
  }, [baseTasks, actions])

  const activeTasks = tasks.filter((task) => !actions[taskKey(originalTaskFor(task))]?.done)
  const completedCount = tasks.length - activeTasks.length

  const briefText = [
    data?.chief_legal_officer_summary,
    activeTasks.length ? `Top tasks: ${activeTasks.slice(0, 4).map((task) => task.title).join(', ')}.` : 'No active legal tasks remain.',
    `Weekly risk score is ${data?.weekly_risk_score ?? 0}. Risk trend is ${data?.risk_trend ?? 'not available'}.`,
  ].filter(Boolean).join(' ')

  const stopSpeaking = () => {
    if (!('speechSynthesis' in window)) return
    window.speechSynthesis.cancel()
    setSpeaking(false)
  }

  const speakBrief = () => {
    if (muted || !briefText || !('speechSynthesis' in window)) return
    window.speechSynthesis.cancel()
    const utterance = new SpeechSynthesisUtterance(briefText)
    utterance.rate = 0.96
    utterance.onstart = () => setSpeaking(true)
    utterance.onend = () => setSpeaking(false)
    utterance.onerror = () => setSpeaking(false)
    window.speechSynthesis.speak(utterance)
  }

  const updateTask = (task: DailyTask, patch: TaskActionState) => {
    const key = taskKey(task)
    const current = actions[key] ?? {}
    saveActions({ ...actions, [key]: { ...current, ...patch } })
  }

  return (
    <motion.section
      initial={{ opacity: 0, y: 12 }}
      animate={{ opacity: 1, y: 0 }}
      className="mb-8"
    >
      <Card hover={false} className="overflow-hidden">
        <div className="border-b border-white/[0.06] bg-bg-elevated/50 px-5 py-4">
          <div className="flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
            <div className="flex items-center gap-3">
              <div className="flex h-10 w-10 items-center justify-center rounded-xl border border-blue/30 bg-blue/10">
                <CalendarDays className="h-4.5 w-4.5 text-blue" />
              </div>
              <div>
                <h2 className="text-base font-semibold text-text-primary">Today's Legal Brief</h2>
                <p className="mt-0.5 text-xs text-text-muted">Daily Task Agent in the AI Legal Organization</p>
              </div>
            </div>
            <div className="grid grid-cols-2 gap-2 sm:grid-cols-4">
              {priorityOrder.map((priority) => {
                const style = priorityStyle[priority]
                const count = activeTasks.filter((task) => task.priority === priority).length
                return (
                  <div
                    key={priority}
                    className="rounded-lg border px-3 py-2 text-center"
                    style={{ borderColor: style.border, background: style.bg }}
                  >
                    <p className="font-mono text-lg font-bold" style={{ color: style.color }}>{count}</p>
                    <p className="text-[10px] uppercase text-text-muted">{priority}</p>
                  </div>
                )
              })}
            </div>
          </div>
        </div>

        {isLoading ? (
          <div className="flex items-center gap-2 px-5 py-8 text-sm text-text-secondary">
            <Loader2 className="h-4 w-4 animate-spin text-blue" />
            Preparing today's legal brief...
          </div>
        ) : isError ? (
          <div className="flex items-center gap-2 px-5 py-8 text-sm text-warning">
            <AlertTriangle className="h-4 w-4" />
            Today's legal brief is unavailable right now.
          </div>
        ) : (
          <div className="grid gap-5 p-5 xl:grid-cols-[1.5fr_1fr]">
            <div>
              <div className="mb-4 rounded-lg border border-gold/20 bg-gold/5 p-4">
                <div className="mb-2 flex flex-wrap items-center gap-2">
                  <ShieldAlert className="h-4 w-4 text-gold" />
                  <p className="text-xs font-semibold uppercase text-gold">Chief Legal Officer</p>
                  <div className="ml-auto flex items-center gap-2">
                    <button
                      type="button"
                      onClick={speakBrief}
                      disabled={muted || !briefText}
                      aria-label="Read today's legal brief aloud"
                      className="inline-flex items-center gap-1 rounded-md border border-gold/20 bg-gold/10 px-2 py-1 text-[11px] font-medium text-gold hover:bg-gold/15 disabled:opacity-40"
                    >
                      <Mic2 className="h-3 w-3" />
                      Read Brief
                    </button>
                    <button
                      type="button"
                      onClick={() => {
                        setMuted((value) => {
                          if (!value) stopSpeaking()
                          return !value
                        })
                      }}
                      aria-label={muted ? 'Unmute daily brief voice' : 'Mute daily brief voice'}
                      className="rounded-md border border-white/[0.08] bg-bg-surface p-1.5 text-text-secondary hover:text-text-primary"
                    >
                      {muted ? <VolumeX className="h-3.5 w-3.5" /> : <Volume2 className="h-3.5 w-3.5" />}
                    </button>
                    <button
                      type="button"
                      onClick={stopSpeaking}
                      disabled={!speaking}
                      aria-label="Stop reading daily brief"
                      className="rounded-md border border-white/[0.08] bg-bg-surface p-1.5 text-text-secondary hover:text-text-primary disabled:opacity-40"
                    >
                      <Square className="h-3.5 w-3.5" />
                    </button>
                  </div>
                </div>
                <p className="text-sm leading-relaxed text-text-secondary">{data?.chief_legal_officer_summary}</p>
                <p className="mt-2 text-[11px] text-text-muted" aria-live="polite">
                  {speaking ? 'Reading daily brief aloud...' : muted ? 'Voice brief muted' : 'Voice brief ready'}
                </p>
              </div>

              <LegalTimeline tasks={activeTasks} />

              <div className="mb-3 mt-5 flex items-center justify-between">
                <h3 className="text-sm font-semibold text-text-primary">Today's Tasks</h3>
                <span className="text-xs text-text-muted">
                  {activeTasks.length} active · {completedCount} done
                </span>
              </div>
              {tasks.length === 0 ? (
                <div className="flex items-center gap-2 rounded-lg border border-safe/20 bg-safe/5 p-4 text-sm text-text-secondary">
                  <CheckCircle2 className="h-4 w-4 text-safe" />
                  No contract work requires attention today.
                </div>
              ) : (
                <div className="grid gap-3 lg:grid-cols-2">
                  {tasks.map((task) => {
                    const original = originalTaskFor(task)
                    const key = taskKey(original)
                    return (
                      <TaskCard
                        key={key}
                        task={task}
                        action={actions[key]}
                        onDone={() => updateTask(original, { done: !actions[key]?.done })}
                        onSnooze={() => updateTask(original, { snoozedUntil: addDays(task.due_date, 1), done: false })}
                        onPriority={(priority) => updateTask(original, { priority })}
                      />
                    )
                  })}
                </div>
              )}
            </div>

            <div className="space-y-3">
              <div className="grid grid-cols-2 gap-3">
                <div className="rounded-lg border border-white/[0.06] bg-bg-elevated/50 p-3">
                  <div className="mb-2 flex items-center gap-2 text-text-muted">
                    <TrendingUp className="h-3.5 w-3.5" />
                    <span className="text-[10px] uppercase">Weekly Risk Score</span>
                  </div>
                  <p className="font-mono text-2xl font-bold text-text-primary">{data?.weekly_risk_score ?? 0}</p>
                  <p className="mt-1 text-xs text-text-muted">{data?.risk_trend ?? 'No trend'}</p>
                </div>
                <div className="rounded-lg border border-white/[0.06] bg-bg-elevated/50 p-3">
                  <div className="mb-2 flex items-center gap-2 text-text-muted">
                    <FileSignature className="h-3.5 w-3.5" />
                    <span className="text-[10px] uppercase">Pending Signatures</span>
                  </div>
                  <p className="font-mono text-2xl font-bold text-text-primary">{data?.pending_signatures?.length ?? 0}</p>
                  <p className="mt-1 text-xs text-text-muted">Review before signing</p>
                </div>
              </div>

              <div className="rounded-lg border border-white/[0.06] bg-bg-elevated/50 p-3">
                <div className="mb-2 flex items-center gap-2">
                  <Bell className="h-3.5 w-3.5 text-warning" />
                  <h3 className="text-xs font-semibold uppercase text-text-secondary">Alerts</h3>
                </div>
                <div className="space-y-2 text-xs text-text-secondary">
                  <p>Compliance Alerts: {data?.compliance_alerts?.length ?? 0}</p>
                  <p>Privacy Alerts: {data?.privacy_alerts?.length ?? 0}</p>
                  <p>Contract Expiry Alerts: {data?.contract_expiry_alerts?.length ?? 0}</p>
                  <p>Upcoming Deadlines: {activeTasks.length}</p>
                </div>
              </div>

              <div className="rounded-lg border border-white/[0.06] bg-bg-elevated/50 p-3">
                <h3 className="mb-2 text-xs font-semibold uppercase text-text-secondary">Recent Activities</h3>
                <div className="space-y-2">
                  {(data?.recent_activities ?? []).slice(0, 5).map((activity: any) => (
                    <div key={`${activity.id}-${activity.label}`} className="text-xs text-text-muted">
                      <span className="text-text-secondary">{activity.label}</span>
                      {activity.contract_type && <span> - {activity.contract_type}</span>}
                    </div>
                  ))}
                  {!data?.recent_activities?.length && (
                    <p className="text-xs text-text-muted">No recent activity yet.</p>
                  )}
                </div>
              </div>
            </div>
          </div>
        )}
      </Card>
    </motion.section>
  )
}
