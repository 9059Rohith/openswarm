// All TypeScript types for LexGuard

export interface User {
  id: string
  email: string
  full_name: string
  is_active: boolean
  created_at: string
}

export interface AuthToken {
  access_token: string
  token_type: string
  user: User
}

export interface Contract {
  id: string
  filename: string
  original_filename: string
  contract_type: string
  status: 'pending' | 'processing' | 'complete' | 'failed'
  page_count: number
  aggregate_risk_index: number
  risk_level: 'low' | 'moderate' | 'high' | 'unknown'
  high_count: number
  moderate_count: number
  low_count: number
  executive_summary: string
  created_at: string
}

export interface Clause {
  id: string
  contract_id: string
  clause_type: string
  raw_text: string
  plain_english: string
  risk_likelihood: number
  risk_severity: number
  risk_score: number
  risk_level: 'low' | 'moderate' | 'high'
  category: string
  page_estimate: number
  redline_suggestion: string
  why_risky: string
  is_accepted: boolean | null
  order_index: number
  // New fields from enhanced backend
  risk_score_adjusted?: number
  requires_legal_review?: boolean
  bounding_box_json?: { x_min: number; x_max: number; y_min: number; y_max: number; page: number } | null
  // Alias helpers (same as above, for component convenience)
  title?: string
  original_text?: string
  explanation?: string
  suggested_text?: string
  likelihood?: number
  severity?: number
}

export interface Scenario {
  title: string
  description: string
  severity: 'low' | 'medium' | 'high'
  financial_impact?: string
  mitigation?: string
}

export interface ContractDetail extends Contract {
  full_text: string
  scenarios: Scenario[]
  scenarios_json?: any[]
  clauses: Clause[]
  category_scores?: Record<string, number>
  counterparty?: string
  jurisdiction?: string
  contradictions_json?: any[]
}

export type ClauseCategory = 
  | 'Employment' 
  | 'Financial' 
  | 'IP' 
  | 'Privacy' 
  | 'Compliance' 
  | 'Operational'

export type RiskLevel = 'low' | 'moderate' | 'high' | 'unknown'
export type RiskFilter = 'all' | 'high' | 'moderate' | 'low'

export interface AnalysisStatus {
  contract_id: string
  status: string
  progress: number
  message: string
}

export interface Stats {
  total_contracts: number
  high_risk_contracts: number
  average_risk_score: number
  total_clauses_flagged: number
}

export type RecommendationPriority = 'high' | 'medium' | 'low'

export interface Recommendation {
  id: string
  action: string
  reason: string
  priority: RecommendationPriority
  priority_label: 'High Priority' | 'Medium Priority' | 'Low Priority'
  category: string
  related_contract_id: string | null
  related_contract_name: string | null
  suggested_due_date: string
}

export interface RecommendationsResponse {
  recommendations: Recommendation[]
  categories: Record<'High Priority' | 'Medium Priority' | 'Low Priority', Recommendation[]>
  total: number
  high_count: number
  medium_count: number
  low_count: number
  agent: Record<string, unknown>
  agent_name: string
}

export type DailyTaskPriority = 'Critical' | 'High' | 'Medium' | 'Low'

export interface DailyTask {
  id: string
  title: string
  priority: DailyTaskPriority
  due_label: string
  category: string
  reason: string
  related_contract_id: string | null
  related_contract_name: string | null
  due_date: string
}

export interface DailyBriefResponse {
  agent: Record<string, unknown>
  recommendation_agent: Record<string, unknown>
  agent_name: string
  brief_date: string
  chief_legal_officer_summary: string
  todays_tasks: DailyTask[]
  todays_legal_priorities: DailyTask[]
  pending_contract_reviews: any[]
  high_risk_contracts: any[]
  upcoming_deadlines: DailyTask[]
  pending_signatures: any[]
  compliance_alerts: DailyTask[]
  privacy_alerts: DailyTask[]
  contract_expiry_alerts: any[]
  recommended_actions: Recommendation[]
  new_legal_recommendations: Recommendation[]
  risk_trend: string
  weekly_risk_score: number
  recent_activities: any[]
  priority_counts: Record<DailyTaskPriority, number>
}

export interface ChatMessage {
  id: string
  role: 'user' | 'assistant'
  content: string
  timestamp: number
}

export interface PlaybookRule {
  id: string
  rule_text: string
  category?: string
  enabled: boolean
  label?: string
  value?: string
}

export interface Playbook {
  id: string
  name: string
  description: string
  rules: PlaybookRule[]
  is_active: boolean
  created_at: string
}

export interface RadarDataPoint {
  category: string
  score: number
  fullMark?: number
}
