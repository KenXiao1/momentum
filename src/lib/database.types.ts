export type Json =
  | string
  | number
  | boolean
  | null
  | { [key: string]: Json | undefined }
  | Json[];

export interface Database {
  public: {
    Tables: {
      chains: {
        Row: {
          id: string;
          name: string;
          parent_id: string | null;
          type: string;
          sort_order: number;
          trigger: string;
          duration: number;
          description: string;
          current_streak: number;
          auxiliary_streak: number;
          total_completions: number;
          total_failures: number;
          auxiliary_failures: number;
          exceptions: Json;
          auxiliary_exceptions: Json;
          auxiliary_signal: string;
          auxiliary_duration: number;
          auxiliary_completion_trigger: string;
          is_durationless: boolean | null;
          minimum_duration: number | null;
          is_task_group: boolean | null;
          task_repeat_count: number | null;
          group_repeat_count: number | null;
          time_limit_hours: number | null;
          time_limit_exceptions: Json;
          group_started_at: string | null;
          group_expires_at: string | null;
          deleted_at: string | null;
          created_at: string | null;
          last_completed_at: string | null;
          user_id: string;
        };
        Insert: {
          id?: string;
          name: string;
          parent_id?: string | null;
          type?: string;
          sort_order?: number;
          trigger: string;
          duration?: number;
          description: string;
          current_streak?: number;
          auxiliary_streak?: number;
          total_completions?: number;
          total_failures?: number;
          auxiliary_failures?: number;
          exceptions?: Json;
          auxiliary_exceptions?: Json;
          auxiliary_signal: string;
          auxiliary_duration?: number;
          auxiliary_completion_trigger: string;
          is_durationless?: boolean | null;
          minimum_duration?: number | null;
          is_task_group?: boolean | null;
          task_repeat_count?: number | null;
          group_repeat_count?: number | null;
          time_limit_hours?: number | null;
          time_limit_exceptions?: Json;
          group_started_at?: string | null;
          group_expires_at?: string | null;
          deleted_at?: string | null;
          created_at?: string | null;
          last_completed_at?: string | null;
          user_id: string;
        };
        Update: {
          id?: string;
          name?: string;
          parent_id?: string | null;
          type?: string;
          sort_order?: number;
          trigger?: string;
          duration?: number;
          description?: string;
          current_streak?: number;
          auxiliary_streak?: number;
          total_completions?: number;
          total_failures?: number;
          auxiliary_failures?: number;
          exceptions?: Json;
          auxiliary_exceptions?: Json;
          auxiliary_signal?: string;
          auxiliary_duration?: number;
          auxiliary_completion_trigger?: string;
          is_durationless?: boolean | null;
          minimum_duration?: number | null;
          is_task_group?: boolean | null;
          task_repeat_count?: number | null;
          group_repeat_count?: number | null;
          time_limit_hours?: number | null;
          time_limit_exceptions?: Json;
          group_started_at?: string | null;
          group_expires_at?: string | null;
          deleted_at?: string | null;
          created_at?: string | null;
          last_completed_at?: string | null;
          user_id?: string;
        };
        Relationships: [];
      };
      scheduled_sessions: {
        Row: {
          id: string;
          chain_id: string;
          scheduled_at: string;
          expires_at: string;
          auxiliary_signal: string;
          user_id: string;
        };
        Insert: {
          id?: string;
          chain_id: string;
          scheduled_at?: string;
          expires_at: string;
          auxiliary_signal: string;
          user_id: string;
        };
        Update: {
          id?: string;
          chain_id?: string;
          scheduled_at?: string;
          expires_at?: string;
          auxiliary_signal?: string;
          user_id?: string;
        };
        Relationships: [];
      };
      active_sessions: {
        Row: {
          id: string;
          chain_id: string;
          started_at: string;
          duration: number;
          is_paused: boolean;
          paused_at: string | null;
          total_paused_time: number;
          is_forward_timer: boolean | null;
          forward_elapsed_time: number | null;
          user_id: string;
        };
        Insert: {
          id?: string;
          chain_id: string;
          started_at?: string;
          duration: number;
          is_paused?: boolean;
          paused_at?: string | null;
          total_paused_time?: number;
          is_forward_timer?: boolean | null;
          forward_elapsed_time?: number | null;
          user_id: string;
        };
        Update: {
          id?: string;
          chain_id?: string;
          started_at?: string;
          duration?: number;
          is_paused?: boolean;
          paused_at?: string | null;
          total_paused_time?: number;
          is_forward_timer?: boolean | null;
          forward_elapsed_time?: number | null;
          user_id?: string;
        };
        Relationships: [];
      };
      completion_history: {
        Row: {
          id: string;
          chain_id: string;
          completed_at: string;
          duration: number;
          was_successful: boolean;
          reason_for_failure: string | null;
          user_id: string;
          description: string | null;
          notes: string | null;
          actual_duration: number | null;
          is_forward_timed: boolean | null;
        };
        Insert: {
          id?: string;
          chain_id: string;
          completed_at?: string;
          duration: number;
          was_successful: boolean;
          reason_for_failure?: string | null;
          user_id: string;
          description?: string | null;
          notes?: string | null;
          actual_duration?: number | null;
          is_forward_timed?: boolean | null;
        };
        Update: {
          id?: string;
          chain_id?: string;
          completed_at?: string;
          duration?: number;
          was_successful?: boolean;
          reason_for_failure?: string | null;
          user_id?: string;
          description?: string | null;
          notes?: string | null;
          actual_duration?: number | null;
          is_forward_timed?: boolean | null;
        };
        Relationships: [];
      };
      rsip_nodes: {
        Row: {
          id: string;
          user_id: string;
          parent_id: string | null;
          title: string;
          rule: string;
          sort_order: number;
          use_timer: boolean;
          timer_minutes: number | null;
          created_at: string;
          emoji: string | null;
          type: string | null;
          group_id: string | null;
          reinforcement_level: number;
          max_reinforcement_level: number;
          cumulative_execution_days: number;
          is_passive: boolean;
          split_from_goal: string | null;
          stability_phase: 'E0' | 'E1' | 'E2' | null;
          phase_started_at: string | null;
          last_executed_at: string | null;
          last_violated_at: string | null;
          consecutive_executions: number | null;
          consecutive_violations: number | null;
          total_executions: number | null;
          total_violations: number | null;
        };
        Insert: {
          id?: string;
          user_id: string;
          parent_id?: string | null;
          title: string;
          rule: string;
          sort_order?: number;
          use_timer?: boolean;
          timer_minutes?: number | null;
          created_at?: string;
          emoji?: string | null;
          type?: string | null;
          group_id?: string | null;
          reinforcement_level?: number;
          max_reinforcement_level?: number;
          cumulative_execution_days?: number;
          is_passive?: boolean;
          split_from_goal?: string | null;
          stability_phase?: 'E0' | 'E1' | 'E2' | null;
          phase_started_at?: string | null;
          last_executed_at?: string | null;
          last_violated_at?: string | null;
          consecutive_executions?: number | null;
          consecutive_violations?: number | null;
          total_executions?: number | null;
          total_violations?: number | null;
        };
        Update: {
          id?: string;
          user_id?: string;
          parent_id?: string | null;
          title?: string;
          rule?: string;
          sort_order?: number;
          use_timer?: boolean;
          timer_minutes?: number | null;
          created_at?: string;
          emoji?: string | null;
          type?: string | null;
          group_id?: string | null;
          reinforcement_level?: number;
          max_reinforcement_level?: number;
          cumulative_execution_days?: number;
          is_passive?: boolean;
          split_from_goal?: string | null;
          stability_phase?: 'E0' | 'E1' | 'E2' | null;
          phase_started_at?: string | null;
          last_executed_at?: string | null;
          last_violated_at?: string | null;
          consecutive_executions?: number | null;
          consecutive_violations?: number | null;
          total_executions?: number | null;
          total_violations?: number | null;
        };
        Relationships: [];
      };
      rsip_meta: {
        Row: {
          user_id: string;
          last_added_at: string | null;
          allow_multiple_per_day: boolean;
          last_tree_opened_at: string | null;
          daily_tree_open_required: boolean | null;
          tree_open_streak: number | null;
          current_run_number: number | null;
          current_run_started_at: string | null;
        };
        Insert: {
          user_id: string;
          last_added_at?: string | null;
          allow_multiple_per_day?: boolean;
          last_tree_opened_at?: string | null;
          daily_tree_open_required?: boolean | null;
          tree_open_streak?: number | null;
          current_run_number?: number | null;
          current_run_started_at?: string | null;
        };
        Update: {
          user_id?: string;
          last_added_at?: string | null;
          allow_multiple_per_day?: boolean;
          last_tree_opened_at?: string | null;
          daily_tree_open_required?: boolean | null;
          tree_open_streak?: number | null;
          current_run_number?: number | null;
          current_run_started_at?: string | null;
        };
        Relationships: [];
      };
      rsip_execution_records: {
        Row: {
          id: string;
          user_id: string;
          node_id: string;
          executed_at: string;
          status: 'pending' | 'executed' | 'violated' | 'skipped';
          notes: string | null;
          reason_code: string | null;
          repair_hint: string | null;
          source_chain_id: string | null;
          source_event: string | null;
          created_at: string;
        };
        Insert: {
          id?: string;
          user_id: string;
          node_id: string;
          executed_at?: string;
          status: 'pending' | 'executed' | 'violated' | 'skipped';
          notes?: string | null;
          reason_code?: string | null;
          repair_hint?: string | null;
          source_chain_id?: string | null;
          source_event?: string | null;
          created_at?: string;
        };
        Update: {
          id?: string;
          user_id?: string;
          node_id?: string;
          executed_at?: string;
          status?: 'pending' | 'executed' | 'violated' | 'skipped';
          notes?: string | null;
          reason_code?: string | null;
          repair_hint?: string | null;
          source_chain_id?: string | null;
          source_event?: string | null;
          created_at?: string;
        };
        Relationships: [];
      };
      rsip_groups: {
        Row: {
          id: string;
          user_id: string;
          title: string;
          fault_tolerance: number;
          fault_tolerance_used: number;
          emoji: string | null;
          created_at: string;
          updated_at: string;
        };
        Insert: {
          id?: string;
          user_id: string;
          title: string;
          fault_tolerance?: number;
          fault_tolerance_used?: number;
          emoji?: string | null;
          created_at?: string;
          updated_at?: string;
        };
        Update: {
          id?: string;
          user_id?: string;
          title?: string;
          fault_tolerance?: number;
          fault_tolerance_used?: number;
          emoji?: string | null;
          created_at?: string;
          updated_at?: string;
        };
        Relationships: [];
      };
      rsip_policy_library: {
        Row: {
          id: string;
          user_id: string;
          title: string;
          rule: string;
          type: string | null;
          emoji: string | null;
          cumulative_execution_days: number;
          internalization_progress: number;
          last_active_at: string;
          times_used: number;
          use_timer: boolean;
          timer_minutes: number | null;
          is_passive: boolean;
          updated_at: string;
        };
        Insert: {
          id: string;
          user_id: string;
          title: string;
          rule: string;
          type?: string | null;
          emoji?: string | null;
          cumulative_execution_days?: number;
          internalization_progress?: number;
          last_active_at?: string;
          times_used?: number;
          use_timer?: boolean;
          timer_minutes?: number | null;
          is_passive?: boolean;
          updated_at?: string;
        };
        Update: {
          id?: string;
          user_id?: string;
          title?: string;
          rule?: string;
          type?: string | null;
          emoji?: string | null;
          cumulative_execution_days?: number;
          internalization_progress?: number;
          last_active_at?: string;
          times_used?: number;
          use_timer?: boolean;
          timer_minutes?: number | null;
          is_passive?: boolean;
          updated_at?: string;
        };
        Relationships: [];
      };
      rsip_run_history: {
        Row: {
          user_id: string;
          run_number: number;
          started_at: string;
          ended_at: string | null;
          max_node_count: number;
          duration_days: number;
          collapse_reason: string | null;
          collapse_node_title: string | null;
          updated_at: string;
        };
        Insert: {
          user_id: string;
          run_number: number;
          started_at: string;
          ended_at?: string | null;
          max_node_count?: number;
          duration_days?: number;
          collapse_reason?: string | null;
          collapse_node_title?: string | null;
          updated_at?: string;
        };
        Update: {
          user_id?: string;
          run_number?: number;
          started_at?: string;
          ended_at?: string | null;
          max_node_count?: number;
          duration_days?: number;
          collapse_reason?: string | null;
          collapse_node_title?: string | null;
          updated_at?: string;
        };
        Relationships: [];
      };
      rsip_task_links: {
        Row: {
          id: string;
          user_id: string;
          rsip_node_id: string;
          chain_id: string;
          chain_kind: string;
          trigger_event: string;
          effect: string;
          automation: string;
          is_active: boolean;
          updated_at: string;
        };
        Insert: {
          id?: string;
          user_id: string;
          rsip_node_id: string;
          chain_id: string;
          chain_kind: string;
          trigger_event: string;
          effect: string;
          automation?: string;
          is_active?: boolean;
          updated_at?: string;
        };
        Update: {
          id?: string;
          user_id?: string;
          rsip_node_id?: string;
          chain_id?: string;
          chain_kind?: string;
          trigger_event?: string;
          effect?: string;
          automation?: string;
          is_active?: boolean;
          updated_at?: string;
        };
        Relationships: [];
      };
      user_points: {
        Row: {
          user_id: string;
          total_points: number;
          created_at: string;
          updated_at: string;
        };
        Insert: {
          user_id: string;
          total_points?: number;
          created_at?: string;
          updated_at?: string;
        };
        Update: {
          user_id?: string;
          total_points?: number;
          created_at?: string;
          updated_at?: string;
        };
        Relationships: [];
      };
      user_settings: {
        Row: {
          user_id: string;
          gambling_mode_enabled: boolean;
          daily_bet_limit: number | null;
          max_single_bet: number | null;
          settings_data: Json;
          created_at: string;
          updated_at: string;
        };
        Insert: {
          user_id: string;
          gambling_mode_enabled?: boolean;
          daily_bet_limit?: number | null;
          max_single_bet?: number | null;
          settings_data?: Json;
          created_at?: string;
          updated_at?: string;
        };
        Update: {
          user_id?: string;
          gambling_mode_enabled?: boolean;
          daily_bet_limit?: number | null;
          max_single_bet?: number | null;
          settings_data?: Json;
          created_at?: string;
          updated_at?: string;
        };
        Relationships: [];
      };
      daily_checkins: {
        Row: {
          id: string;
          user_id: string;
          checkin_date: string;
          points_earned: number;
          consecutive_days: number;
          created_at: string;
        };
        Insert: {
          id?: string;
          user_id: string;
          checkin_date?: string;
          points_earned?: number;
          consecutive_days?: number;
          created_at?: string;
        };
        Update: {
          id?: string;
          user_id?: string;
          checkin_date?: string;
          points_earned?: number;
          consecutive_days?: number;
          created_at?: string;
        };
        Relationships: [];
      };
      point_transactions: {
        Row: {
          id: string;
          user_id: string;
          transaction_type: string;
          points_change: number;
          points_before: number;
          points_after: number;
          description: string | null;
          reference_id: string | null;
          created_at: string;
        };
        Insert: {
          id?: string;
          user_id: string;
          transaction_type: string;
          points_change: number;
          points_before: number;
          points_after: number;
          description?: string | null;
          reference_id?: string | null;
          created_at?: string;
        };
        Update: {
          id?: string;
          user_id?: string;
          transaction_type?: string;
          points_change?: number;
          points_before?: number;
          points_after?: number;
          description?: string | null;
          reference_id?: string | null;
          created_at?: string;
        };
        Relationships: [];
      };
    };
    Views: {
      [_ in never]: never;
    };
    Functions: {
      perform_daily_checkin: {
        Args: {
          target_user_id: string;
        };
        Returns: {
          success: boolean;
          message: string;
          already_checked_in: boolean;
          checkin_date: string;
          points_earned: number;
          consecutive_days: number;
          total_points?: number | null;
          checkin_id?: string | null;
        };
      };
      get_user_checkin_stats: {
        Args: {
          target_user_id: string;
        };
        Returns: {
          user_id: string;
          total_points: number;
          total_checkins: number;
          current_streak: number;
          longest_streak: number;
          last_checkin_date: string | null;
          has_checked_in_today: boolean;
        };
      };
      get_user_checkin_history: {
        Args: {
          target_user_id: string;
          page_size?: number;
          page_offset?: number;
        };
        Returns: {
          checkins: Array<{
            id: string;
            checkin_date: string;
            points_earned: number;
            consecutive_days: number;
            created_at: string;
          }>;
          total_count: number;
          page_size: number;
          page_offset: number;
          has_more: boolean;
        };
      };
      create_write_session: {
        Args: {
          session_type: string;
          duration_minutes: number;
        };
        Returns: {
          success: boolean;
          session_token: string | null;
          error: string | null;
        };
      };
      complete_write_session: {
        Args: {
          p_session_token: string;
        };
        Returns: Json;
      };
      place_task_bet: {
        Args: {
          p_user_id: string;
          p_session_id: string;
          p_bet_amount: number;
          p_write_session_token: string;
        };
        Returns: {
          success: boolean;
          message: string;
          bet_id?: string;
          bet_amount?: number;
          potential_payout?: number;
          points_before?: number;
          points_after?: number;
          session_id?: string;
          chain_id?: string;
          error_code?: string;
          max_bet?: number;
          daily_limit?: number;
          daily_spent?: number;
          current_points?: number;
          required_points?: number;
          existing_bet_id?: string;
          existing_bet_amount?: number;
        };
      };
      complete_task_with_betting: {
        Args: {
          p_session_id: string;
          p_was_successful: boolean;
          p_completion_notes: string | null;
        };
        Returns: Json;
      };
      exec_sql: {
        Args: {
          sql: string;
        };
        Returns: Json;
      };
    };
    Enums: {
      [_ in never]: never;
    };
    CompositeTypes: {
      [_ in never]: never;
    };
  };
}
