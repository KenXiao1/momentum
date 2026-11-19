import { z } from 'zod';

// JSON columns may be absent on databases with pending migrations. zod 4 no
// longer treats `z.unknown()` keys as optional, so say so explicitly.
const jsonValue = z.unknown().optional();

export const chainRowSchema = z.object({
  id: z.string(),
  name: z.string(),
  parent_id: z.string().nullable(),
  type: z.string(),
  sort_order: z.number(),
  trigger: z.string(),
  duration: z.number(),
  description: z.string(),
  current_streak: z.number(),
  auxiliary_streak: z.number(),
  total_completions: z.number(),
  total_failures: z.number(),
  auxiliary_failures: z.number(),
  exceptions: jsonValue,
  auxiliary_exceptions: jsonValue,
  auxiliary_signal: z.string(),
  auxiliary_duration: z.number(),
  auxiliary_completion_trigger: z.string(),
  is_durationless: z.boolean().nullable().optional(),
  minimum_duration: z.number().nullable().optional(),
  is_task_group: z.boolean().nullable().optional(),
  task_repeat_count: z.number().nullable().optional(),
  group_repeat_count: z.number().nullable().optional(),
  time_limit_hours: z.number().nullable().optional(),
  time_limit_exceptions: jsonValue,
  group_started_at: z.string().nullable().optional(),
  group_expires_at: z.string().nullable().optional(),
  deleted_at: z.string().nullable().optional(),
  created_at: z.string().nullable().optional(),
  last_completed_at: z.string().nullable().optional(),
  user_id: z.string(),
});
