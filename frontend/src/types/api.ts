export interface Season {
  id: string
  name: string
  is_current: boolean
  start_date: string | null
  end_date: string | null
}

export interface SeasonStats {
  total_sessions: number
  total_players: number
  total_groups: number
  avg_sr: number | null
  avg_dqi: number | null
  avg_ai: number | null
  avg_trs: number | null
  avg_vci: number | null
}

export interface Group {
  id: string
  name: string
  category: string
  birth_year: number | null
  level: string
  sub_group: string | null
  max_players: number
}

export interface Target {
  parameter: string
  insufficient_max: number
  ottimo_min: number
}

export interface PlayerInGroup {
  id: string
  first_name: string
  last_name: string
  birth_year: number | null
}

export interface GroupDetail extends Group {
  players: PlayerInGroup[]
  targets: Target[]
}

export interface GroupHistoryItem {
  session_id: string
  session_date: string
  session_type: string
  avg_sr: number | null
  avg_dqi: number | null
  avg_ai: number | null
  avg_trs: number | null
  avg_vci: number | null
  player_count: number
}

export interface PlayerStats {
  player_id: string
  first_name: string
  last_name: string
  session_count: number
  avg_sr: number | null
  avg_dqi: number | null
  avg_ai: number | null
  avg_trs: number | null
  avg_vci: number | null
}

export interface GroupChangeLog {
  id: string
  changed_at: string
  field: string
  old_value: string | null
  new_value: string | null
  changed_by: string | null
}

export interface Player {
  id: string
  first_name: string
  last_name: string
  birth_year: number | null
  position: string | null
  nationality: string | null
  foot: string | null
  jersey_number: number | null
  phone: string | null
  is_active: boolean
  notes: string | null
  current_group_name: string | null
  availability: string
}

export interface PlayerAssignment {
  id: string
  group_id: string
  group_name: string
  start_date: string
  end_date: string | null
  is_current: boolean
}

export interface PlayerHistoryItem {
  session_id: string
  session_date: string
  session_type: string
  group_id: string
  group_name: string
  scanning_rate: number | null
  decision_quality: number | null
  anticipation: number | null
  transition_reset: number | null
  verbal_comm: number | null
}

export interface Session {
  id: string
  group_id: string
  session_date: string
  session_type: string
  duration_min: number | null
  notes: string | null
  created_at: string
}

export interface Measurement {
  id: string
  player_id: string
  first_name: string
  last_name: string
  scanning_rate: number | null
  decision_quality: number | null
  anticipation: number | null
  transition_reset: number | null
  verbal_comm: number | null
  is_absent: boolean
  notes: string | null
}

export interface Match {
  id: string
  group_id: string
  season_id: string
  match_date: string
  opponent: string
  home_away: string
  match_type: string
  score_home: number | null
  score_away: number | null
  notes: string | null
  created_at: string
}

export interface MatchLineup {
  player_id: string
  player_first_name: string
  player_last_name: string
  minutes_played: number | null
  position: string | null
  notes: string | null
}

export interface MatchDetail extends Match {
  lineups: MatchLineup[]
}

export interface InjuryLog {
  id: string
  player_id: string
  injury_type: string
  start_date: string
  expected_return: string | null
  actual_return: string | null
  severity: string
  notes: string | null
  created_at: string
}

export interface User {
  id: string
  email: string
  full_name: string | null
  is_active: boolean
  status: string
  roles: string[]
  assigned_group_ids: string[]
}

export interface AtRiskPlayer {
  player_id: string
  first_name: string
  last_name: string
  group_name: string
  avg_score_last_session: number
  threshold: number
}

export interface RecentSession {
  id: string
  group_id: string
  session_date: string
  session_type: string
}
