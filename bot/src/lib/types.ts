export interface Profile {
  id: string;
  discord_id: string | null;
  username: string | null;
  display_name: string | null;
}

export interface Team {
  id: string;
  name: string;
  slug: string;
  logo_url: string | null;
  league_id: string | null;
  division_id: string | null;
  budget: number;
  manager_id: string | null;
}

export interface Player {
  id: string;
  username: string;
  display_name: string | null;
  discord_id: string | null;
  team_id: string | null;
  loan_team_id: string | null;
  position: string | null;
  goals: number;
  assists: number;
  appearances: number;
}

export interface Division {
  id: string;
  league_id: string;
  name: string;
  season: string | null;
  status: string;
  tier: number;
  start_date: string | null;
  gameweek_interval_days: number;
}

export interface Fixture {
  id: string;
  league_id: string | null;
  division_id: string | null;
  home_team_id: string | null;
  away_team_id: string | null;
  gameweek: number | null;
  kickoff_at: string;
  status: string;
  home_score: number | null;
  away_score: number | null;
}

export interface Loan {
  id: string;
  player_id: string;
  parent_team_id: string | null;
  loan_team_id: string;
  division_id: string | null;
  start_gameweek: number;
  start_date: string;
  end_gameweek: number | null;
  end_date: string | null;
  status: string;
}

export interface TransferOffer {
  id: string;
  player_id: string;
  from_team_id: string | null;
  to_team_id: string;
  offered_by: string | null;
  fee: number;
  status: string;
}
