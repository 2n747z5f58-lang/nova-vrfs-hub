export type Json =
  | string
  | number
  | boolean
  | null
  | { [key: string]: Json | undefined }
  | Json[]

export type Database = {
  // Allows to automatically instantiate createClient with right options
  // instead of createClient<Database, { PostgrestVersion: 'XX' }>(URL, KEY)
  __InternalSupabase: {
    PostgrestVersion: "14.15"
  }
  public: {
    Tables: {
      budget_transactions: {
        Row: {
          amount: number
          created_at: string
          created_by: string | null
          description: string | null
          id: string
          related_transfer_id: string | null
          team_id: string
          transaction_type: string
        }
        Insert: {
          amount: number
          created_at?: string
          created_by?: string | null
          description?: string | null
          id?: string
          related_transfer_id?: string | null
          team_id: string
          transaction_type: string
        }
        Update: {
          amount?: number
          created_at?: string
          created_by?: string | null
          description?: string | null
          id?: string
          related_transfer_id?: string | null
          team_id?: string
          transaction_type?: string
        }
        Relationships: [
          {
            foreignKeyName: "budget_transactions_created_by_fkey"
            columns: ["created_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "budget_transactions_related_transfer_id_fkey"
            columns: ["related_transfer_id"]
            isOneToOne: false
            referencedRelation: "transfers"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "budget_transactions_team_id_fkey"
            columns: ["team_id"]
            isOneToOne: false
            referencedRelation: "teams"
            referencedColumns: ["id"]
          },
        ]
      }
      divisions: {
        Row: {
          created_at: string
          ended_at: string | null
          gameweek_interval_days: number
          id: string
          league_id: string
          name: string
          season: string | null
          start_date: string | null
          status: string
          tier: number
        }
        Insert: {
          created_at?: string
          ended_at?: string | null
          gameweek_interval_days?: number
          id?: string
          league_id: string
          name: string
          season?: string | null
          start_date?: string | null
          status?: string
          tier?: number
        }
        Update: {
          created_at?: string
          ended_at?: string | null
          gameweek_interval_days?: number
          id?: string
          league_id?: string
          name?: string
          season?: string | null
          start_date?: string | null
          status?: string
          tier?: number
        }
        Relationships: [
          {
            foreignKeyName: "divisions_league_id_fkey"
            columns: ["league_id"]
            isOneToOne: false
            referencedRelation: "leagues"
            referencedColumns: ["id"]
          },
        ]
      }
      favourites: {
        Row: {
          created_at: string
          id: string
          item_id: string
          item_type: string
          user_id: string
        }
        Insert: {
          created_at?: string
          id?: string
          item_id: string
          item_type: string
          user_id: string
        }
        Update: {
          created_at?: string
          id?: string
          item_id?: string
          item_type?: string
          user_id?: string
        }
        Relationships: []
      }
      fixtures: {
        Row: {
          away_score: number | null
          away_team_id: string | null
          competition: string | null
          created_at: string
          division_id: string | null
          gameweek: number | null
          home_score: number | null
          home_team_id: string | null
          id: string
          kickoff_at: string
          league_id: string | null
          status: string
          updated_at: string
        }
        Insert: {
          away_score?: number | null
          away_team_id?: string | null
          competition?: string | null
          created_at?: string
          division_id?: string | null
          gameweek?: number | null
          home_score?: number | null
          home_team_id?: string | null
          id?: string
          kickoff_at: string
          league_id?: string | null
          status?: string
          updated_at?: string
        }
        Update: {
          away_score?: number | null
          away_team_id?: string | null
          competition?: string | null
          created_at?: string
          division_id?: string | null
          gameweek?: number | null
          home_score?: number | null
          home_team_id?: string | null
          id?: string
          kickoff_at?: string
          league_id?: string | null
          status?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "fixtures_away_team_id_fkey"
            columns: ["away_team_id"]
            isOneToOne: false
            referencedRelation: "teams"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "fixtures_division_id_fkey"
            columns: ["division_id"]
            isOneToOne: false
            referencedRelation: "divisions"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "fixtures_home_team_id_fkey"
            columns: ["home_team_id"]
            isOneToOne: false
            referencedRelation: "teams"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "fixtures_league_id_fkey"
            columns: ["league_id"]
            isOneToOne: false
            referencedRelation: "leagues"
            referencedColumns: ["id"]
          },
        ]
      }
      gameweeks: {
        Row: {
          created_at: string
          division_id: string
          id: string
          number: number
          starts_at: string
        }
        Insert: {
          created_at?: string
          division_id: string
          id?: string
          number: number
          starts_at: string
        }
        Update: {
          created_at?: string
          division_id?: string
          id?: string
          number?: number
          starts_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "gameweeks_division_id_fkey"
            columns: ["division_id"]
            isOneToOne: false
            referencedRelation: "divisions"
            referencedColumns: ["id"]
          },
        ]
      }
      leagues: {
        Row: {
          created_at: string
          description: string | null
          id: string
          logo_url: string | null
          name: string
          season: string | null
          slug: string
          status: string
        }
        Insert: {
          created_at?: string
          description?: string | null
          id?: string
          logo_url?: string | null
          name: string
          season?: string | null
          slug: string
          status?: string
        }
        Update: {
          created_at?: string
          description?: string | null
          id?: string
          logo_url?: string | null
          name?: string
          season?: string | null
          slug?: string
          status?: string
        }
        Relationships: []
      }
      loan_events: {
        Row: {
          created_at: string
          details: string | null
          event_type: string
          gameweek: number | null
          id: string
          loan_id: string
        }
        Insert: {
          created_at?: string
          details?: string | null
          event_type: string
          gameweek?: number | null
          id?: string
          loan_id: string
        }
        Update: {
          created_at?: string
          details?: string | null
          event_type?: string
          gameweek?: number | null
          id?: string
          loan_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "loan_events_loan_id_fkey"
            columns: ["loan_id"]
            isOneToOne: false
            referencedRelation: "loans"
            referencedColumns: ["id"]
          },
        ]
      }
      loans: {
        Row: {
          created_at: string
          division_id: string | null
          end_date: string | null
          end_gameweek: number | null
          id: string
          loan_team_id: string
          parent_team_id: string | null
          player_id: string
          start_date: string
          start_gameweek: number
          status: string
        }
        Insert: {
          created_at?: string
          division_id?: string | null
          end_date?: string | null
          end_gameweek?: number | null
          id?: string
          loan_team_id: string
          parent_team_id?: string | null
          player_id: string
          start_date?: string
          start_gameweek?: number
          status?: string
        }
        Update: {
          created_at?: string
          division_id?: string | null
          end_date?: string | null
          end_gameweek?: number | null
          id?: string
          loan_team_id?: string
          parent_team_id?: string | null
          player_id?: string
          start_date?: string
          start_gameweek?: number
          status?: string
        }
        Relationships: [
          {
            foreignKeyName: "loans_division_id_fkey"
            columns: ["division_id"]
            isOneToOne: false
            referencedRelation: "divisions"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "loans_loan_team_id_fkey"
            columns: ["loan_team_id"]
            isOneToOne: false
            referencedRelation: "teams"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "loans_parent_team_id_fkey"
            columns: ["parent_team_id"]
            isOneToOne: false
            referencedRelation: "teams"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "loans_player_id_fkey"
            columns: ["player_id"]
            isOneToOne: false
            referencedRelation: "players"
            referencedColumns: ["id"]
          },
        ]
      }
      match_events: {
        Row: {
          created_at: string
          event_type: string
          fixture_id: string
          id: string
          minute: number | null
          player_id: string | null
          team_id: string | null
        }
        Insert: {
          created_at?: string
          event_type?: string
          fixture_id: string
          id?: string
          minute?: number | null
          player_id?: string | null
          team_id?: string | null
        }
        Update: {
          created_at?: string
          event_type?: string
          fixture_id?: string
          id?: string
          minute?: number | null
          player_id?: string | null
          team_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "match_events_fixture_id_fkey"
            columns: ["fixture_id"]
            isOneToOne: false
            referencedRelation: "fixtures"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "match_events_player_id_fkey"
            columns: ["player_id"]
            isOneToOne: false
            referencedRelation: "players"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "match_events_team_id_fkey"
            columns: ["team_id"]
            isOneToOne: false
            referencedRelation: "teams"
            referencedColumns: ["id"]
          },
        ]
      }
      notifications: {
        Row: {
          created_at: string
          id: string
          message: string | null
          read: boolean
          related_id: string | null
          related_type: string | null
          title: string
          type: string
          user_id: string
        }
        Insert: {
          created_at?: string
          id?: string
          message?: string | null
          read?: boolean
          related_id?: string | null
          related_type?: string | null
          title: string
          type: string
          user_id: string
        }
        Update: {
          created_at?: string
          id?: string
          message?: string | null
          read?: boolean
          related_id?: string | null
          related_type?: string | null
          title?: string
          type?: string
          user_id?: string
        }
        Relationships: []
      }
      players: {
        Row: {
          appearances: number
          assists: number
          avatar_url: string | null
          created_at: string
          discord_id: string | null
          discord_username: string | null
          display_name: string | null
          goals: number
          id: string
          loan_team_id: string | null
          position: string | null
          profile_id: string | null
          team_id: string | null
          username: string
        }
        Insert: {
          appearances?: number
          assists?: number
          avatar_url?: string | null
          created_at?: string
          discord_id?: string | null
          discord_username?: string | null
          display_name?: string | null
          goals?: number
          id?: string
          loan_team_id?: string | null
          position?: string | null
          profile_id?: string | null
          team_id?: string | null
          username: string
        }
        Update: {
          appearances?: number
          assists?: number
          avatar_url?: string | null
          created_at?: string
          discord_id?: string | null
          discord_username?: string | null
          display_name?: string | null
          goals?: number
          id?: string
          loan_team_id?: string | null
          position?: string | null
          profile_id?: string | null
          team_id?: string | null
          username?: string
        }
        Relationships: [
          {
            foreignKeyName: "players_loan_team_id_fkey"
            columns: ["loan_team_id"]
            isOneToOne: false
            referencedRelation: "teams"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "players_profile_id_fkey"
            columns: ["profile_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "players_team_id_fkey"
            columns: ["team_id"]
            isOneToOne: false
            referencedRelation: "teams"
            referencedColumns: ["id"]
          },
        ]
      }
      profiles: {
        Row: {
          avatar_url: string | null
          created_at: string
          discord_id: string | null
          discord_username: string | null
          display_name: string | null
          id: string
          preferences: Json
          updated_at: string
          username: string | null
        }
        Insert: {
          avatar_url?: string | null
          created_at?: string
          discord_id?: string | null
          discord_username?: string | null
          display_name?: string | null
          id: string
          preferences?: Json
          updated_at?: string
          username?: string | null
        }
        Update: {
          avatar_url?: string | null
          created_at?: string
          discord_id?: string | null
          discord_username?: string | null
          display_name?: string | null
          id?: string
          preferences?: Json
          updated_at?: string
          username?: string | null
        }
        Relationships: []
      }
      releases: {
        Row: {
          created_at: string
          id: string
          player_id: string
          reason: string | null
          released_by: string | null
          team_id: string | null
        }
        Insert: {
          created_at?: string
          id?: string
          player_id: string
          reason?: string | null
          released_by?: string | null
          team_id?: string | null
        }
        Update: {
          created_at?: string
          id?: string
          player_id?: string
          reason?: string | null
          released_by?: string | null
          team_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "releases_player_id_fkey"
            columns: ["player_id"]
            isOneToOne: false
            referencedRelation: "players"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "releases_released_by_fkey"
            columns: ["released_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "releases_team_id_fkey"
            columns: ["team_id"]
            isOneToOne: false
            referencedRelation: "teams"
            referencedColumns: ["id"]
          },
        ]
      }
      results: {
        Row: {
          away_score: number
          completed_at: string
          fixture_id: string
          home_score: number
          id: string
          notes: string | null
          recorded_at: string
          replay_code: string | null
          submitted_by: string | null
        }
        Insert: {
          away_score?: number
          completed_at?: string
          fixture_id: string
          home_score?: number
          id?: string
          notes?: string | null
          recorded_at?: string
          replay_code?: string | null
          submitted_by?: string | null
        }
        Update: {
          away_score?: number
          completed_at?: string
          fixture_id?: string
          home_score?: number
          id?: string
          notes?: string | null
          recorded_at?: string
          replay_code?: string | null
          submitted_by?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "results_fixture_id_fkey"
            columns: ["fixture_id"]
            isOneToOne: true
            referencedRelation: "fixtures"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "results_submitted_by_fkey"
            columns: ["submitted_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      signings: {
        Row: {
          created_at: string
          details: string | null
          id: string
          player_id: string
          previous_team_id: string | null
          season: string | null
          signed_by: string | null
          team_id: string
        }
        Insert: {
          created_at?: string
          details?: string | null
          id?: string
          player_id: string
          previous_team_id?: string | null
          season?: string | null
          signed_by?: string | null
          team_id: string
        }
        Update: {
          created_at?: string
          details?: string | null
          id?: string
          player_id?: string
          previous_team_id?: string | null
          season?: string | null
          signed_by?: string | null
          team_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "signings_player_id_fkey"
            columns: ["player_id"]
            isOneToOne: false
            referencedRelation: "players"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "signings_previous_team_id_fkey"
            columns: ["previous_team_id"]
            isOneToOne: false
            referencedRelation: "teams"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "signings_signed_by_fkey"
            columns: ["signed_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "signings_team_id_fkey"
            columns: ["team_id"]
            isOneToOne: false
            referencedRelation: "teams"
            referencedColumns: ["id"]
          },
        ]
      }
      staff: {
        Row: {
          created_at: string
          id: string
          name: string
          role: string
          team_id: string | null
        }
        Insert: {
          created_at?: string
          id?: string
          name: string
          role: string
          team_id?: string | null
        }
        Update: {
          created_at?: string
          id?: string
          name?: string
          role?: string
          team_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "staff_team_id_fkey"
            columns: ["team_id"]
            isOneToOne: false
            referencedRelation: "teams"
            referencedColumns: ["id"]
          },
        ]
      }
      standings: {
        Row: {
          division_id: string
          drawn: number
          goal_difference: number
          goals_against: number
          goals_for: number
          id: string
          lost: number
          played: number
          points: number
          team_id: string
          updated_at: string
          won: number
        }
        Insert: {
          division_id: string
          drawn?: number
          goal_difference?: number
          goals_against?: number
          goals_for?: number
          id?: string
          lost?: number
          played?: number
          points?: number
          team_id: string
          updated_at?: string
          won?: number
        }
        Update: {
          division_id?: string
          drawn?: number
          goal_difference?: number
          goals_against?: number
          goals_for?: number
          id?: string
          lost?: number
          played?: number
          points?: number
          team_id?: string
          updated_at?: string
          won?: number
        }
        Relationships: [
          {
            foreignKeyName: "standings_division_id_fkey"
            columns: ["division_id"]
            isOneToOne: false
            referencedRelation: "divisions"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "standings_team_id_fkey"
            columns: ["team_id"]
            isOneToOne: false
            referencedRelation: "teams"
            referencedColumns: ["id"]
          },
        ]
      }
      team_members: {
        Row: {
          created_at: string
          id: string
          joined_at: string
          left_at: string | null
          player_id: string | null
          profile_id: string | null
          role: string
          status: string
          team_id: string
        }
        Insert: {
          created_at?: string
          id?: string
          joined_at?: string
          left_at?: string | null
          player_id?: string | null
          profile_id?: string | null
          role?: string
          status?: string
          team_id: string
        }
        Update: {
          created_at?: string
          id?: string
          joined_at?: string
          left_at?: string | null
          player_id?: string | null
          profile_id?: string | null
          role?: string
          status?: string
          team_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "team_members_player_id_fkey"
            columns: ["player_id"]
            isOneToOne: false
            referencedRelation: "players"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "team_members_profile_id_fkey"
            columns: ["profile_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "team_members_team_id_fkey"
            columns: ["team_id"]
            isOneToOne: false
            referencedRelation: "teams"
            referencedColumns: ["id"]
          },
        ]
      }
      team_staff: {
        Row: {
          created_at: string
          id: string
          role: string
          team_id: string
          user_id: string
        }
        Insert: {
          created_at?: string
          id?: string
          role?: string
          team_id: string
          user_id: string
        }
        Update: {
          created_at?: string
          id?: string
          role?: string
          team_id?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "team_staff_team_id_fkey"
            columns: ["team_id"]
            isOneToOne: false
            referencedRelation: "teams"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "team_staff_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      teams: {
        Row: {
          budget: number
          created_at: string
          division_id: string | null
          id: string
          league_id: string | null
          logo_url: string | null
          manager_id: string | null
          name: string
          slug: string
        }
        Insert: {
          budget?: number
          created_at?: string
          division_id?: string | null
          id?: string
          league_id?: string | null
          logo_url?: string | null
          manager_id?: string | null
          name: string
          slug: string
        }
        Update: {
          budget?: number
          created_at?: string
          division_id?: string | null
          id?: string
          league_id?: string | null
          logo_url?: string | null
          manager_id?: string | null
          name?: string
          slug?: string
        }
        Relationships: [
          {
            foreignKeyName: "teams_division_id_fkey"
            columns: ["division_id"]
            isOneToOne: false
            referencedRelation: "divisions"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "teams_league_id_fkey"
            columns: ["league_id"]
            isOneToOne: false
            referencedRelation: "leagues"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "teams_manager_id_fkey"
            columns: ["manager_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      transfer_offers: {
        Row: {
          created_at: string
          discord_message_id: string | null
          fee: number
          from_team_id: string | null
          id: string
          offered_by: string | null
          player_id: string
          responded_at: string | null
          responded_by: string | null
          status: string
          to_team_id: string
        }
        Insert: {
          created_at?: string
          discord_message_id?: string | null
          fee?: number
          from_team_id?: string | null
          id?: string
          offered_by?: string | null
          player_id: string
          responded_at?: string | null
          responded_by?: string | null
          status?: string
          to_team_id: string
        }
        Update: {
          created_at?: string
          discord_message_id?: string | null
          fee?: number
          from_team_id?: string | null
          id?: string
          offered_by?: string | null
          player_id?: string
          responded_at?: string | null
          responded_by?: string | null
          status?: string
          to_team_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "transfer_offers_from_team_id_fkey"
            columns: ["from_team_id"]
            isOneToOne: false
            referencedRelation: "teams"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "transfer_offers_offered_by_fkey"
            columns: ["offered_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "transfer_offers_player_id_fkey"
            columns: ["player_id"]
            isOneToOne: false
            referencedRelation: "players"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "transfer_offers_responded_by_fkey"
            columns: ["responded_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "transfer_offers_to_team_id_fkey"
            columns: ["to_team_id"]
            isOneToOne: false
            referencedRelation: "teams"
            referencedColumns: ["id"]
          },
        ]
      }
      transfers: {
        Row: {
          completed_at: string | null
          created_at: string
          details: string | null
          fee: number
          from_team_id: string | null
          id: string
          player_id: string
          status: string
          to_team_id: string | null
          transfer_date: string
        }
        Insert: {
          completed_at?: string | null
          created_at?: string
          details?: string | null
          fee?: number
          from_team_id?: string | null
          id?: string
          player_id: string
          status?: string
          to_team_id?: string | null
          transfer_date?: string
        }
        Update: {
          completed_at?: string | null
          created_at?: string
          details?: string | null
          fee?: number
          from_team_id?: string | null
          id?: string
          player_id?: string
          status?: string
          to_team_id?: string | null
          transfer_date?: string
        }
        Relationships: [
          {
            foreignKeyName: "transfers_from_team_id_fkey"
            columns: ["from_team_id"]
            isOneToOne: false
            referencedRelation: "teams"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "transfers_player_id_fkey"
            columns: ["player_id"]
            isOneToOne: false
            referencedRelation: "players"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "transfers_to_team_id_fkey"
            columns: ["to_team_id"]
            isOneToOne: false
            referencedRelation: "teams"
            referencedColumns: ["id"]
          },
        ]
      }
      user_roles: {
        Row: {
          created_at: string
          id: string
          role: Database["public"]["Enums"]["app_role"]
          user_id: string
        }
        Insert: {
          created_at?: string
          id?: string
          role: Database["public"]["Enums"]["app_role"]
          user_id: string
        }
        Update: {
          created_at?: string
          id?: string
          role?: Database["public"]["Enums"]["app_role"]
          user_id?: string
        }
        Relationships: []
      }
    }
    Views: {
      [_ in never]: never
    }
    Functions: {
      current_gameweek: { Args: { _division_id: string }; Returns: number }
      has_role: {
        Args: {
          _role: Database["public"]["Enums"]["app_role"]
          _user_id: string
        }
        Returns: boolean
      }
      is_staff: { Args: { _user_id: string }; Returns: boolean }
      recalculate_player_stats: { Args: never; Returns: undefined }
      recalculate_standings: { Args: never; Returns: undefined }
    }
    Enums: {
      app_role: "admin" | "overseer" | "user" | "manager" | "co_manager"
    }
    CompositeTypes: {
      [_ in never]: never
    }
  }
}

type DatabaseWithoutInternals = Omit<Database, "__InternalSupabase">

type DefaultSchema = DatabaseWithoutInternals[Extract<keyof Database, "public">]

export type Tables<
  DefaultSchemaTableNameOrOptions extends
    | keyof (DefaultSchema["Tables"] & DefaultSchema["Views"])
    | { schema: keyof DatabaseWithoutInternals },
  TableName extends DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof (DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"] &
        DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Views"])
    : never = never,
> = DefaultSchemaTableNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? (DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"] &
      DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Views"])[TableName] extends {
      Row: infer R
    }
    ? R
    : never
  : DefaultSchemaTableNameOrOptions extends keyof (DefaultSchema["Tables"] &
        DefaultSchema["Views"])
    ? (DefaultSchema["Tables"] &
        DefaultSchema["Views"])[DefaultSchemaTableNameOrOptions] extends {
        Row: infer R
      }
      ? R
      : never
    : never

export type TablesInsert<
  DefaultSchemaTableNameOrOptions extends
    | keyof DefaultSchema["Tables"]
    | { schema: keyof DatabaseWithoutInternals },
  TableName extends DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"]
    : never = never,
> = DefaultSchemaTableNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"][TableName] extends {
      Insert: infer I
    }
    ? I
    : never
  : DefaultSchemaTableNameOrOptions extends keyof DefaultSchema["Tables"]
    ? DefaultSchema["Tables"][DefaultSchemaTableNameOrOptions] extends {
        Insert: infer I
      }
      ? I
      : never
    : never

export type TablesUpdate<
  DefaultSchemaTableNameOrOptions extends
    | keyof DefaultSchema["Tables"]
    | { schema: keyof DatabaseWithoutInternals },
  TableName extends DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"]
    : never = never,
> = DefaultSchemaTableNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"][TableName] extends {
      Update: infer U
    }
    ? U
    : never
  : DefaultSchemaTableNameOrOptions extends keyof DefaultSchema["Tables"]
    ? DefaultSchema["Tables"][DefaultSchemaTableNameOrOptions] extends {
        Update: infer U
      }
      ? U
      : never
    : never

export type Enums<
  DefaultSchemaEnumNameOrOptions extends
    | keyof DefaultSchema["Enums"]
    | { schema: keyof DatabaseWithoutInternals },
  EnumName extends DefaultSchemaEnumNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaEnumNameOrOptions["schema"]]["Enums"]
    : never = never,
> = DefaultSchemaEnumNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[DefaultSchemaEnumNameOrOptions["schema"]]["Enums"][EnumName]
  : DefaultSchemaEnumNameOrOptions extends keyof DefaultSchema["Enums"]
    ? DefaultSchema["Enums"][DefaultSchemaEnumNameOrOptions]
    : never

export type CompositeTypes<
  PublicCompositeTypeNameOrOptions extends
    | keyof DefaultSchema["CompositeTypes"]
    | { schema: keyof DatabaseWithoutInternals },
  CompositeTypeName extends PublicCompositeTypeNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[PublicCompositeTypeNameOrOptions["schema"]]["CompositeTypes"]
    : never = never,
> = PublicCompositeTypeNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[PublicCompositeTypeNameOrOptions["schema"]]["CompositeTypes"][CompositeTypeName]
  : PublicCompositeTypeNameOrOptions extends keyof DefaultSchema["CompositeTypes"]
    ? DefaultSchema["CompositeTypes"][PublicCompositeTypeNameOrOptions]
    : never

export const Constants = {
  public: {
    Enums: {
      app_role: ["admin", "overseer", "user", "manager", "co_manager"],
    },
  },
} as const
