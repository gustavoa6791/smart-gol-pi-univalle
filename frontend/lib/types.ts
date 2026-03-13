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
