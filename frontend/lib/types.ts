export interface User {
  id: number;
  name: string;
  email: string;
  created_at: string;
}

export interface TokenResponse {
  access_token: string;
  token_type: string;
}

export type PlayerPosition = 'goalkeeper' | 'defender' | 'midfielder' | 'forward';
export type DocumentType = 'CC' | 'TI' | 'CE' | 'PA';
export type Gender = 'M' | 'F' | 'O';

export interface PlayerDocument {
  id: number;
  player_id: number;
  filename: string;
  original_name: string;
  created_at: string;
}

export interface Player {
  id: number;
  first_name: string;
  second_name?: string;
  first_surname: string;
  second_surname?: string;
  document_type?: DocumentType;
  document_number?: string;
  position?: PlayerPosition;
  birth_date?: string;
  phone?: string;
  email?: string;
  address?: string;
  gender?: Gender;
  photo_url?: string;
  notes?: string;
  documents?: PlayerDocument[];
  created_at: string;
  updated_at?: string;
}

export interface PlayerCreate {
  first_name: string;
  second_name?: string;
  first_surname: string;
  second_surname?: string;
  document_type?: DocumentType;
  document_number?: string;
  position?: PlayerPosition;
  birth_date?: string;
  phone?: string;
  email?: string;
  address?: string;
  gender?: Gender;
  notes?: string;
}

export type TeamCategory = 'sub_10' | 'sub_12' | 'sub_14' | 'sub_16' | 'sub_18' | 'senior';

export interface Team {
  id: number;
  name: string;
  category?: TeamCategory | null;
  coach_name: string;
  shield_url?: string | null;
  created_at: string;
  updated_at?: string;
  players?: Player[];
  leader_id?: number | null;
  leader?: Player | null;
}

export interface TeamCreate {
  name: string;
  coach_name: string;
  player_ids?: number[];
  leader_id?: number | null;
}

export type TournamentType = 'round_robin' | 'knockout' | 'mixed';
export type MatchPhase = 'group' | 'round_of_16' | 'quarterfinal' | 'semifinal' | 'third_place' | 'final';

export interface TournamentTemplate {
  id: number;
  name: string;
  type: TournamentType;
  is_home_away: boolean;
  points_win: number;
  points_draw: number;
  points_loss: number;
  num_groups?: number | null;
  teams_advance_per_group?: number | null;
  third_place_match: boolean;
  final_legs: number;
  third_place_legs: number;
  created_at: string;
}

export interface TournamentTemplateCreate {
  name: string;
  type: TournamentType;
  is_home_away?: boolean;
  points_win?: number;
  points_draw?: number;
  points_loss?: number;
  num_groups?: number | null;
  teams_advance_per_group?: number | null;
  third_place_match?: boolean;
  final_legs?: number;
  third_place_legs?: number;
}

export interface Tournament {
  id: number;
  name: string;
  template_id: number;
  template?: TournamentTemplate;
  created_at: string;
}

export interface TournamentCreate {
  name: string;
  template_id: number;
}

export interface BracketMatch {
  id: number;
  round: number;
  phase: MatchPhase;
  bracket_position: number;
  next_match_id?: number | null;
  home_team?: { id: number; name: string } | null;
  away_team?: { id: number; name: string } | null;
  home_score?: number | null;
  away_score?: number | null;
  status: 'pending' | 'played';
}