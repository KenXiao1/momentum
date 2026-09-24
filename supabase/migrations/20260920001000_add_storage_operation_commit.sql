-- A compare-and-swap transaction for bounded user collections. No HTTP delete/insert gap.
BEGIN;
CREATE TABLE public.storage_operation_commits (
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  operation_id text NOT NULL,
  payload_hash text NOT NULL CHECK (length(payload_hash) = 64),
  committed_at timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (user_id, operation_id),
  CHECK (length(operation_id) BETWEEN 1 AND 200)
);
ALTER TABLE public.storage_operation_commits ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON public.storage_operation_commits FROM PUBLIC, anon, authenticated;

CREATE FUNCTION public.commit_storage_operation(p_operation_id text, p_changes jsonb)
RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER
SET search_path = pg_catalog, public, pg_temp
AS $$
DECLARE
  caller uuid := auth.uid();
  allowed_tables text[] := ARRAY['chains', 'rsip_groups', 'rsip_nodes', 'rsip_meta',
    'rsip_policy_library', 'rsip_run_history', 'rsip_execution_records', 'rsip_task_links',
    'completion_history', 'active_sessions'];
  table_name text;
  change jsonb;
  prior_hash text;
  request_hash text;
  actual_rows jsonb;
  expected_rows jsonb;
  column_names text;
  update_columns text;
  primary_columns text;
  key_match text;
  primary_names text[];
  keys text[];
  grouped_rows jsonb;
  changed_columns text;
  incoming_key_match text;
  fk_match text;
  foreign_key record;
  invalid_reference boolean;
BEGIN
  IF caller IS NULL THEN RAISE EXCEPTION 'Authentication required' USING ERRCODE = '42501'; END IF;
  IF p_operation_id IS NULL OR length(p_operation_id) NOT BETWEEN 1 AND 200
    OR jsonb_typeof(p_changes) IS DISTINCT FROM 'array'
    OR jsonb_array_length(p_changes) NOT BETWEEN 1 AND 10 THEN
    RAISE EXCEPTION 'Invalid storage operation' USING ERRCODE = '22023';
  END IF;
  IF EXISTS(SELECT 1 FROM jsonb_array_elements(p_changes) c
    WHERE jsonb_typeof(c) <> 'object' OR NOT (c ->> 'table' = ANY(allowed_tables))
      OR c ->> 'table' IS NULL OR jsonb_typeof(c -> 'before') IS DISTINCT FROM 'array'
      OR jsonb_typeof(c -> 'after') IS DISTINCT FROM 'array')
    OR (SELECT count(DISTINCT c ->> 'table') FROM jsonb_array_elements(p_changes) c)
      <> jsonb_array_length(p_changes) THEN
    RAISE EXCEPTION 'Invalid or duplicate collection' USING ERRCODE = '22023';
  END IF;
  -- This lock also makes concurrent identical operation IDs wait for their receipt.
  PERFORM pg_advisory_xact_lock(hashtextextended('storage-operation:' || caller::text || ':' || p_operation_id, 0));
  request_hash := encode(sha256(convert_to(p_changes::text, 'UTF8')), 'hex');
  SELECT payload_hash INTO prior_hash FROM public.storage_operation_commits
    WHERE user_id = caller AND operation_id = p_operation_id;
  IF FOUND THEN
    IF prior_hash IS DISTINCT FROM request_hash THEN
      RAISE EXCEPTION 'Operation ID reused with different content' USING ERRCODE = '22023';
    END IF;
    RETURN jsonb_build_object('success', true, 'operation_id', p_operation_id, 'replayed', true);
  END IF;
  -- A fixed global order prevents deadlocks between collection transactions.
  -- Lock all affected FK parent/child collections, including those omitted by a
  -- caller, so cascades and ordinary table writes cannot interleave with the CAS.
  FOREACH table_name IN ARRAY allowed_tables LOOP
    EXECUTE format('LOCK TABLE public.%I IN SHARE ROW EXCLUSIVE MODE', table_name);
  END LOOP;
  FOR change IN SELECT value FROM jsonb_array_elements(p_changes) LOOP
    table_name := change ->> 'table';
    IF EXISTS(SELECT 1 FROM jsonb_array_elements((change -> 'before') || (change -> 'after')) r
      WHERE jsonb_typeof(r) <> 'object' OR (r ->> 'user_id') IS DISTINCT FROM caller::text) THEN
      RAISE EXCEPTION 'Collection ownership mismatch' USING ERRCODE = '42501';
    END IF;
    EXECUTE format('SELECT coalesce(jsonb_agg(to_jsonb(t) ORDER BY to_jsonb(t)::text), ''[]''::jsonb)
      FROM public.%I t WHERE user_id = $1', table_name) INTO actual_rows USING caller;
    SELECT coalesce(jsonb_agg(r ORDER BY r::text), '[]'::jsonb) INTO expected_rows
      FROM jsonb_array_elements(change -> 'before') r;
    IF actual_rows IS DISTINCT FROM expected_rows THEN
      RAISE EXCEPTION 'Collection changed: %', table_name USING ERRCODE = '40001';
    END IF;
  END LOOP;

  -- Upsert parents before children. Group rows by supplied fields so omitted
  -- fields on new rows retain PostgreSQL DEFAULT values.
  FOREACH table_name IN ARRAY allowed_tables LOOP
    SELECT value INTO change FROM jsonb_array_elements(p_changes) WHERE value ->> 'table' = table_name;
    IF NOT FOUND THEN CONTINUE; END IF;
    SELECT array_agg(a.attname ORDER BY k.ord), string_agg(format('%I', a.attname), ', ' ORDER BY k.ord)
    INTO primary_names, primary_columns
    FROM pg_index i CROSS JOIN LATERAL unnest(i.indkey) WITH ORDINALITY k(attnum, ord)
    JOIN pg_attribute a ON a.attrelid = i.indrelid AND a.attnum = k.attnum
    WHERE i.indrelid = format('public.%I', table_name)::regclass AND i.indisprimary;
    IF primary_names IS NULL THEN RAISE EXCEPTION 'Collection lacks primary key'; END IF;
    IF EXISTS(SELECT 1 FROM jsonb_array_elements(change -> 'after') r,
      unnest(primary_names) pk WHERE r ->> pk IS NULL) THEN
      RAISE EXCEPTION 'Stable collection primary key is required' USING ERRCODE = '22023';
    END IF;
    EXECUTE format('SELECT EXISTS(SELECT 1 FROM jsonb_populate_recordset(NULL::public.%I, $1)
      GROUP BY %s HAVING count(*) > 1)', table_name, primary_columns)
    INTO invalid_reference USING change -> 'after';
    IF invalid_reference THEN RAISE EXCEPTION 'Duplicate collection primary key' USING ERRCODE = '22023'; END IF;
    FOR keys, grouped_rows IN
      SELECT fields, jsonb_agg(row_value) FROM (
        SELECT r AS row_value, ARRAY(SELECT jsonb_object_keys(r) ORDER BY 1) AS fields
        FROM jsonb_array_elements(change -> 'after') r
      ) grouped GROUP BY fields
    LOOP
      IF EXISTS(SELECT 1 FROM unnest(keys) field WHERE NOT EXISTS(
        SELECT 1 FROM pg_attribute WHERE attrelid = format('public.%I', table_name)::regclass
          AND attname = field AND attnum > 0 AND NOT attisdropped)) THEN
        RAISE EXCEPTION 'Unknown collection field' USING ERRCODE = '22023';
      END IF;
      SELECT string_agg(format('%I', field), ', '),
        string_agg(format('%I = EXCLUDED.%I', field, field), ', ')
        FILTER (WHERE NOT(field = ANY(primary_names)))
      INTO column_names, update_columns FROM unnest(keys) field;
      SELECT string_agg(format('target.%1$I = incoming.%1$I', field), ' AND ')
      INTO incoming_key_match FROM unnest(primary_names) field;
      EXECUTE format('SELECT EXISTS(SELECT 1 FROM public.%1$I target
        JOIN jsonb_populate_recordset(NULL::public.%1$I, $1) incoming ON %2$s
        WHERE target.user_id IS DISTINCT FROM $2)', table_name, incoming_key_match)
      INTO invalid_reference USING grouped_rows, caller;
      IF invalid_reference THEN
        RAISE EXCEPTION 'Row belongs to another user' USING ERRCODE = '42501';
      END IF;
      SELECT string_agg(format('target.%1$I IS DISTINCT FROM EXCLUDED.%1$I', field), ' OR ')
      INTO changed_columns FROM unnest(keys) field;
      update_columns := coalesce(update_columns, 'user_id = EXCLUDED.user_id');
      EXECUTE format('INSERT INTO public.%1$I AS target (%2$s)
        SELECT %2$s FROM jsonb_populate_recordset(NULL::public.%1$I, $1)
        ON CONFLICT (%3$s) DO UPDATE SET %4$s
        WHERE target.user_id = $2 AND (%5$s)',
        table_name, column_names, primary_columns, update_columns, changed_columns)
      USING grouped_rows, caller;
    END LOOP;
  END LOOP;

  -- SECURITY DEFINER bypasses RLS: validate ownership across each actual FK too.
  FOR foreign_key IN
    SELECT c.conrelid::regclass AS source_table, c.confrelid::regclass AS target_table,
      string_agg(format('s.%I = t.%I', a.attname, b.attname), ' AND ' ORDER BY x.ord) AS predicate
    FROM pg_constraint c
    CROSS JOIN LATERAL unnest(c.conkey, c.confkey) WITH ORDINALITY x(src, dst, ord)
    JOIN pg_attribute a ON a.attrelid = c.conrelid AND a.attnum = x.src
    JOIN pg_attribute b ON b.attrelid = c.confrelid AND b.attnum = x.dst
    WHERE c.contype = 'f' AND c.connamespace = 'public'::regnamespace
      AND c.conrelid IN (SELECT format('public.%I', value ->> 'table')::regclass FROM jsonb_array_elements(p_changes))
      AND EXISTS(SELECT 1 FROM pg_attribute WHERE attrelid = c.confrelid AND attname = 'user_id')
    GROUP BY c.oid, c.conrelid, c.confrelid
  LOOP
    EXECUTE format('SELECT EXISTS(SELECT 1 FROM %s s JOIN %s t ON %s
      WHERE s.user_id = $1 AND t.user_id IS DISTINCT FROM $1)',
      foreign_key.source_table, foreign_key.target_table, foreign_key.predicate)
    INTO invalid_reference USING caller;
    IF invalid_reference THEN RAISE EXCEPTION 'Cross-user relation' USING ERRCODE = '42501'; END IF;
  END LOOP;

  -- Remove children before parents; active_sessions is always last so a new
  -- completion has settled its bet before cancellation/refund triggers can run.
  FOREACH table_name IN ARRAY ARRAY['rsip_task_links', 'rsip_execution_records',
    'rsip_nodes', 'rsip_groups', 'rsip_meta', 'rsip_policy_library', 'rsip_run_history',
    'completion_history', 'chains', 'active_sessions'] LOOP
    SELECT value INTO change FROM jsonb_array_elements(p_changes) WHERE value ->> 'table' = table_name;
    IF NOT FOUND THEN CONTINUE; END IF;
    SELECT string_agg(format('to_jsonb(t.%1$I) = r -> %2$L', a.attname, a.attname), ' AND ')
    INTO key_match FROM pg_index i
    CROSS JOIN LATERAL unnest(i.indkey) k(attnum)
    JOIN pg_attribute a ON a.attrelid = i.indrelid AND a.attnum = k.attnum
    WHERE i.indrelid = format('public.%I', table_name)::regclass AND i.indisprimary;
    -- Do not silently cascade into a collection absent from this operation.
    FOR foreign_key IN
      SELECT c.conrelid::regclass AS source_table,
        string_agg(format('s.%I = t.%I', a.attname, b.attname), ' AND ' ORDER BY x.ord) AS predicate
      FROM pg_constraint c
      CROSS JOIN LATERAL unnest(c.conkey, c.confkey) WITH ORDINALITY x(src, dst, ord)
      JOIN pg_attribute a ON a.attrelid = c.conrelid AND a.attnum = x.src
      JOIN pg_attribute b ON b.attrelid = c.confrelid AND b.attnum = x.dst
      WHERE c.contype = 'f' AND c.confrelid = format('public.%I', table_name)::regclass
        AND c.conrelid NOT IN (SELECT format('public.%I', value ->> 'table')::regclass
          FROM jsonb_array_elements(p_changes))
      GROUP BY c.oid, c.conrelid
    LOOP
      EXECUTE format('SELECT EXISTS(SELECT 1 FROM public.%I t JOIN %s s ON %s
        WHERE t.user_id = $1 AND NOT EXISTS(SELECT 1 FROM jsonb_array_elements($2) r WHERE %s))',
        table_name, foreign_key.source_table, foreign_key.predicate, key_match)
      INTO invalid_reference USING caller, change -> 'after';
      IF invalid_reference THEN
        RAISE EXCEPTION 'Deletion affects an omitted collection: %', foreign_key.source_table
          USING ERRCODE = '23000';
      END IF;
    END LOOP;
    EXECUTE format('DELETE FROM public.%I t WHERE t.user_id = $1
      AND NOT EXISTS(SELECT 1 FROM jsonb_array_elements($2) r WHERE %s)', table_name, key_match)
      USING caller, change -> 'after';
  END LOOP;
  -- Cascades within included collections must preserve every requested row
  -- and relation. A vanished child or implicit SET NULL aborts the transaction.
  FOR change IN SELECT value FROM jsonb_array_elements(p_changes) LOOP
    table_name := change ->> 'table';
    SELECT string_agg(format('t.%1$I = r.%1$I', a.attname), ' AND ')
    INTO key_match FROM pg_index i CROSS JOIN LATERAL unnest(i.indkey) k(attnum)
    JOIN pg_attribute a ON a.attrelid = i.indrelid AND a.attnum = k.attnum
    WHERE i.indrelid = format('public.%I', table_name)::regclass AND i.indisprimary;
    SELECT string_agg(format('(NOT (input ? %2$L) OR t.%1$I IS NOT DISTINCT FROM r.%1$I)', a.attname, a.attname), ' AND ')
    INTO fk_match FROM pg_attribute a WHERE a.attrelid = format('public.%I', table_name)::regclass
      AND a.attnum IN (SELECT unnest(c.conkey) FROM pg_constraint c
        WHERE c.conrelid = a.attrelid AND c.contype = 'f');
    EXECUTE format('SELECT EXISTS(SELECT 1 FROM jsonb_array_elements($1) input
      CROSS JOIN LATERAL jsonb_populate_record(NULL::public.%1$I, input) r
      WHERE NOT EXISTS(SELECT 1 FROM public.%1$I t WHERE t.user_id = $2 AND %2$s AND %3$s))',
      table_name, key_match, coalesce(fk_match, 'true'))
    INTO invalid_reference USING change -> 'after', caller;
    IF invalid_reference THEN
      RAISE EXCEPTION 'Deletion changed a retained row or relation in %', table_name USING ERRCODE = '23000';
    END IF;
  END LOOP;
  INSERT INTO public.storage_operation_commits(user_id, operation_id, payload_hash)
    VALUES(caller, p_operation_id, request_hash);
  RETURN jsonb_build_object('success', true, 'operation_id', p_operation_id, 'replayed', false);
END;
$$;
REVOKE ALL ON FUNCTION public.commit_storage_operation(text, jsonb) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.commit_storage_operation(text, jsonb) TO authenticated;
COMMIT;
