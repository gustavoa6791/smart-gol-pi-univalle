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

export interface Player {
  id: number;
  name: string;
  surname?: string;
  number?: number;
  position?: PlayerPosition;
  nationality?: string;
  birth_date?: string;   // ISO format: YYYY-MM-DD
  phone?: string;
  notes?: string;
  created_at: string;
  updated_at?: string;
}

export interface PlayerCreate {
  name: string;
  surname?: string;
  number?: number;
  position?: PlayerPosition;
  nationality?: string;
  birth_date?: string;
  phone?: string;
  notes?: string;
}

export type TeamCategory = 'sub_10' | 'sub_12' | 'sub_14' | 'sub_16' | 'sub_18' | 'senior';

export interface Team {
  id: number;
  name: string;
  category: TeamCategory;
  coach_name: string;
  created_at: string;
  updated_at?: string;
  players?: Player[];
  leader_id?: number | null;
  leader?: Player | null;
}

export interface TeamCreate {
  name: string;
  category: TeamCategory;
  coach_name: string;
  player_ids?: number[];
  leader_id?: number | null;
}

export interface TournamentTemplate {
  id: number;
  name: string;
  is_home_away: boolean;
  created_at: string;
}

export interface TournamentTemplateCreate {
  name: string;
  is_home_away?: boolean;
}

export interface Tournament {
  id: number;
  name: string;
  template_id: number;
  created_at: string;
}

export interface TournamentCreate {
  name: string;
  template_id: number;
}