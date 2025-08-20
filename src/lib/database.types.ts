export type Json =
  | string
  | number
  | boolean
  | null
  | { [key: string]: Json | undefined }
  | Json[]

export interface Database {
  public: {
    Tables: {
      chains: {
        Row: {
          id: string
          name: string
          parent_id: string | null
          type: string
          sort_order: number
          trigger: string
          duration: number
          description: string
          current_streak: number
          auxiliary_streak: number
          total_completions: number
          total_failures: number
          auxiliary_failures: number
          exceptions: Json
          auxiliary_exceptions: Json
          auxiliary_signal: string
          auxiliary_duration: number
          auxiliary_completion_trigger: string
          is_durationless: boolean | null
          time_limit_hours: number | null
          time_limit_exceptions: Json
          group_started_at: string | null
          group_expires_at: string | null
          deleted_at: string | null
          created_at: string | null
          last_completed_at: string | null
          user_id: string
        }
        Insert: {
          id?: string
          name: string
          parent_id?: string | null
          type?: string
          sort_order?: number
          trigger: string
          duration?: number
          description: string
          current_streak?: number
          auxiliary_streak?: number
          total_completions?: number
          total_failures?: number
          auxiliary_failures?: number
          exceptions?: Json
          auxiliary_exceptions?: Json
          auxiliary_signal: string
          auxiliary_duration?: number
          auxiliary_completion_trigger: string
          is_durationless?: boolean | null
          time_limit_hours?: number | null
          time_limit_exceptions?: Json
          group_started_at?: string | null
          group_expires_at?: string | null
          deleted_at?: string | null
          created_at?: string | null
          last_completed_at?: string | null
          user_id: string
        }
        Update: {
          id?: string
          name?: string
          parent_id?: string | null
          type?: string
          sort_order?: number
          trigger?: string
          duration?: number
          description?: string
          current_streak?: number
          auxiliary_streak?: number
          total_completions?: number
          total_failures?: number
          auxiliary_failures?: number
          exceptions?: Json
          auxiliary_exceptions?: Json
          auxiliary_signal?: string
          auxiliary_duration?: number
          auxiliary_completion_trigger?: string
          is_durationless?: boolean | null
          time_limit_hours?: number | null
          time_limit_exceptions?: Json
          group_started_at?: string | null
          group_expires_at?: string | null
          deleted_at?: string | null
          created_at?: string | null
          last_completed_at?: string | null
          user_id?: string
        }
      }
      scheduled_sessions: {
        Row: {
          id: string
          chain_id: string
          scheduled_at: string
          expires_at: string
          auxiliary_signal: string
          user_id: string
        }
        Insert: {
          id?: string
          chain_id: string
          scheduled_at?: string
          expires_at: string
          auxiliary_signal: string
          user_id: string
        }
        Update: {
          id?: string
          chain_id?: string
          scheduled_at?: string
          expires_at?: string
          auxiliary_signal?: string
          user_id?: string
        }
      }
      active_sessions: {
        Row: {
          id: string
          chain_id: string
          started_at: string
          duration: number
          is_paused: boolean
          paused_at: string | null
          total_paused_time: number
          user_id: string
        }
        Insert: {
          id?: string
          chain_id: string
          started_at?: string
          duration: number
          is_paused?: boolean
          paused_at?: string | null
          total_paused_time?: number
          user_id: string
        }
        Update: {
          id?: string
          chain_id?: string
          started_at?: string
          duration?: number
          is_paused?: boolean
          paused_at?: string | null
          total_paused_time?: number
          user_id?: string
        }
      }
      completion_history: {
        Row: {
          id: string
          chain_id: string
          completed_at: string
          duration: number
          was_successful: boolean
          reason_for_failure: string | null
          user_id: string
          description: string | null
          notes: string | null
          actual_duration: number | null
          is_forward_timed: boolean | null
        }
        Insert: {
          id?: string
          chain_id: string
          completed_at?: string
          duration: number
          was_successful: boolean
          reason_for_failure?: string | null
          user_id: string
          description?: string | null
          notes?: string | null
          actual_duration?: number | null
          is_forward_timed?: boolean | null
        }
        Update: {
          id?: string
          chain_id?: string
          completed_at?: string
          duration?: number
          was_successful?: boolean
          reason_for_failure?: string | null
          user_id?: string
          description?: string | null
          notes?: string | null
          actual_duration?: number | null
          is_forward_timed?: boolean | null
        }
      }
      rsip_nodes: {
        Row: {
          id: string
          user_id: string
          parent_id: string | null
          title: string
          rule: string
          sort_order: number
          use_timer: boolean
          timer_minutes: number | null
          created_at: string
        }
        Insert: {
          id?: string
          user_id: string
          parent_id?: string | null
          title: string
          rule: string
          sort_order?: number
          use_timer?: boolean
          timer_minutes?: number | null
          created_at?: string
        }
        Update: {
          id?: string
          user_id?: string
          parent_id?: string | null
          title?: string
          rule?: string
          sort_order?: number
          use_timer?: boolean
          timer_minutes?: number | null
          created_at?: string
        }
      }
      rsip_meta: {
        Row: {
          user_id: string
          last_added_at: string | null
          allow_multiple_per_day: boolean
        }
        Insert: {
          user_id: string
          last_added_at?: string | null
          allow_multiple_per_day?: boolean
        }
        Update: {
          user_id?: string
          last_added_at?: string | null
          allow_multiple_per_day?: boolean
        }
      }
    }
    Views: {
      [_ in never]: never
    }
    Functions: {
      [_ in never]: never
    }
    Enums: {
      [_ in never]: never
    }
    CompositeTypes: {
      [_ in never]: never
    }
  }
}