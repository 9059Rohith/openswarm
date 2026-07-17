import axios from 'axios'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import type {
  Contract,
  ContractDetail,
  AnalysisStatus,
  Stats,
  Playbook,
  AuthToken,
  User,
  RecommendationsResponse,
  DailyBriefResponse,
} from './types'
import { useAuthStore } from './store'

const API_URL = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:8000'

const api = axios.create({
  baseURL: API_URL,
})

// Attach auth token - read from Zustand store (always fresh after hydration)
api.interceptors.request.use((config) => {
  if (typeof window !== 'undefined') {
    const token = useAuthStore.getState().token || localStorage.getItem('lexguard_token')
    if (token) {
      config.headers.Authorization = `Bearer ${token}`
    }
  }
  return config
})

// Handle 401 - clear auth state and redirect to login (skip auth endpoints)
api.interceptors.response.use(
  (response) => response,
  (error) => {
    if (error.response?.status === 401 && typeof window !== 'undefined') {
      const url: string = error.config?.url || ''
      // Don't redirect on the auth endpoints themselves (wrong password returns 401 too)
      const isAuthEndpoint = url.includes('/api/auth/login') || url.includes('/api/auth/register') || url.includes('/api/auth/me')
      if (!isAuthEndpoint) {
        useAuthStore.getState().clearAuth()
        window.location.href = '/login'
      }
    }
    return Promise.reject(error)
  }
)

// ─── Auth ─────────────────────────────────────────────────────────────────────
export const authApi = {
  register: (data: { email: string; full_name: string; password: string }) =>
    api.post<AuthToken>('/api/auth/register', data).then((r) => r.data),

  login: (data: { email: string; password: string }) =>
    api.post<AuthToken>('/api/auth/login', data).then((r) => r.data),

  me: () => api.get<User>('/api/auth/me').then((r) => r.data),
}

// ─── Analysis ─────────────────────────────────────────────────────────────────
export const analyzeApi = {
  upload: (file: File) => {
    const form = new FormData()
    form.append('file', file)
    return api.post<Contract>('/api/analyze/upload', form, {
      headers: { 'Content-Type': 'multipart/form-data' },
    }).then((r) => r.data)
  },

  status: (id: string) =>
    api.get<AnalysisStatus>(`/api/analyze/status/${id}`).then((r) => r.data),

  results: (id: string) =>
    api.get<ContractDetail>(`/api/analyze/results/${id}`).then((r) => {
      const d = r.data
      // Normalize clauses to component-friendly field names
      if (d.clauses) {
        d.clauses = d.clauses.map((c: any) => ({
          ...c,
          title: c.clause_type,
          original_text: c.raw_text,
          explanation: c.why_risky,
          suggested_text: c.redline_suggestion || null,
          likelihood: c.risk_likelihood,
          severity: c.risk_severity,
          // New enhanced fields (pass through if present)
          risk_score_adjusted: c.risk_score_adjusted ?? c.risk_score ?? null,
          requires_legal_review: c.requires_legal_review ?? false,
          bounding_box_json: c.bounding_box_json ?? null,
        }))
      }
      // Normalize scenarios
      const rawScenarios = d.scenarios_json ?? []
      d.scenarios = rawScenarios.map((s: any) => ({
        title: s.title ?? s.scenario_name ?? 'Scenario',
        description: s.description ?? s.consequence ?? s.trigger ?? '',
        severity: (s.probability ?? s.severity ?? 'medium').toLowerCase(),
        financial_impact: s.financial_impact ?? '',
        mitigation: s.mitigation ?? s.recommendation ?? '',
      }))
      return d
    }),
}

// ─── Contracts ────────────────────────────────────────────────────────────────
export const contractsApi = {
  list: (page = 1) =>
    api.get<Contract[]>('/api/contracts', { params: { page } }).then((r) => r.data),

  delete: (id: string) =>
    api.delete(`/api/contracts/${id}`).then((r) => r.data),

  stats: () =>
    api.get<Stats>('/api/contracts/stats').then((r) => r.data),

  acceptClause: (clauseId: string) =>
    api.patch(`/api/clauses/${clauseId}/accept`, { accepted: true }).then((r) => r.data),

  rejectClause: (clauseId: string) =>
    api.patch(`/api/clauses/${clauseId}/accept`, { accepted: false }).then((r) => r.data),
}

// ─── Playbooks ────────────────────────────────────────────────────────────────
export const recommendationsApi = {
  list: () =>
    api.get<RecommendationsResponse>('/api/recommendations').then((r) => r.data),
}

export const dailyBriefApi = {
  get: () =>
    api.get<DailyBriefResponse>('/api/daily-brief').then((r) => r.data),
}

export const playbooksApi = {
  list: () =>
    api.get<Playbook[]>('/api/playbooks').then((r) => r.data),

  create: (data: { name: string; description?: string; rules?: any[] }) =>
    api.post<Playbook>('/api/playbooks', data).then((r) => r.data),

  update: (id: string, data: Partial<Playbook>) =>
    api.put<Playbook>(`/api/playbooks/${id}`, data).then((r) => r.data),

  delete: (id: string) =>
    api.delete(`/api/playbooks/${id}`).then((r) => r.data),
}

// ─── Export ───────────────────────────────────────────────────────────────────
export const exportApi = {
  docx: (id: string, acceptedOnly = false) =>
    `${API_URL}/api/export/docx/${id}?accepted_only=${acceptedOnly}`,

  pdf: (id: string) =>
    `${API_URL}/api/export/pdf/${id}`,
}

// ─── React Query Hooks ────────────────────────────────────────────────────────
export function useContracts() {
  return useQuery({
    queryKey: ['contracts'],
    queryFn: () => contractsApi.list(),
  })
}

export function useContractDetail(id: string) {
  return useQuery({
    queryKey: ['contract', id],
    queryFn: () => analyzeApi.results(id),
    enabled: !!id,
  })
}

export function useAnalysisStatus(id: string, enabled: boolean) {
  const qc = useQueryClient()
  return useQuery({
    queryKey: ['status', id],
    queryFn: () => analyzeApi.status(id),
    enabled: enabled && !!id,
    refetchInterval: (query) => {
      const data = query.state.data
      if (data?.status === 'complete') {
        qc.invalidateQueries({ queryKey: ['contract', id] })
        qc.invalidateQueries({ queryKey: ['contracts'] })
        qc.invalidateQueries({ queryKey: ['recommendations'] })
        qc.invalidateQueries({ queryKey: ['daily-brief'] })
        return false
      }
      if (data?.status === 'failed') {
        qc.invalidateQueries({ queryKey: ['contract', id] })
        return false
      }
      return 2000
    },
  })
}

export function useStats() {
  return useQuery({
    queryKey: ['stats'],
    queryFn: () => contractsApi.stats(),
  })
}

export function useRecommendations() {
  return useQuery({
    queryKey: ['recommendations'],
    queryFn: () => recommendationsApi.list(),
  })
}

export function useDailyBrief() {
  return useQuery({
    queryKey: ['daily-brief'],
    queryFn: () => dailyBriefApi.get(),
  })
}

export function usePlaybooks() {
  return useQuery({
    queryKey: ['playbooks'],
    queryFn: () => playbooksApi.list(),
  })
}

export function useDeleteContract() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: contractsApi.delete,
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['contracts'] })
      qc.invalidateQueries({ queryKey: ['stats'] })
      qc.invalidateQueries({ queryKey: ['recommendations'] })
      qc.invalidateQueries({ queryKey: ['daily-brief'] })
    },
  })
}

export function useUploadContract() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: analyzeApi.upload,
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['contracts'] })
      qc.invalidateQueries({ queryKey: ['stats'] })
      qc.invalidateQueries({ queryKey: ['recommendations'] })
      qc.invalidateQueries({ queryKey: ['daily-brief'] })
    },
  })
}

export function useCreatePlaybook() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: playbooksApi.create,
    onSuccess: () => qc.invalidateQueries({ queryKey: ['playbooks'] }),
  })
}

export function useUpdatePlaybook() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: ({ id, data }: { id: string; data: Partial<Playbook> }) =>
      playbooksApi.update(id, data),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['playbooks'] }),
  })
}

export function useDeletePlaybook() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: playbooksApi.delete,
    onSuccess: () => qc.invalidateQueries({ queryKey: ['playbooks'] }),
  })
}

export { api }
