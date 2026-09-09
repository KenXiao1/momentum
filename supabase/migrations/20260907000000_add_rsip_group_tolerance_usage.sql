ALTER TABLE public.rsip_groups
  ADD COLUMN IF NOT EXISTS fault_tolerance_used integer NOT NULL DEFAULT 0
  CHECK (fault_tolerance_used >= 0);
