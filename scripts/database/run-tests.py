#!/usr/bin/env python3
"""Run real PostgreSQL migration, role, transaction, and concurrency tests.

No application or production credentials are read. With no URL, an ephemeral
Unix-socket-only cluster is created; with a loopback URL, only newly created
momentum_test_* databases are used and removed.
"""
from concurrent.futures import ThreadPoolExecutor
from pathlib import Path
from urllib.parse import urlparse, unquote
import hashlib
import json
import os
import shutil
import subprocess
import tempfile
import unittest
import uuid

ROOT = Path(__file__).resolve().parents[2]
BIN = next((p for p in [Path('/opt/homebrew/opt/postgresql@16/bin'),
    Path('/usr/lib/postgresql/16/bin'), Path('/usr/lib/postgresql/17/bin'),
    Path(shutil.which('psql') or '/missing').parent] if (p / 'psql').exists()), None)
if BIN is None:
    raise SystemExit('PostgreSQL client required (brew install postgresql@16 or apt install postgresql-client).')


def literal(value):
    return "'" + str(value).replace("'", "''") + "'"


class Database:
    def __init__(self, env):
        self.env = env

    def sql(self, sql, role=None, user=None):
        prefix = ''
        if role:
            assert role in ('anon', 'authenticated', 'service_role')
            prefix = f'SET ROLE {role}; SET request.jwt.claim.sub = {literal(user or "")};\n'
        result = subprocess.run([str(BIN / 'psql'), '-XqAt', '-v', 'ON_ERROR_STOP=1'],
            input=prefix + sql, text=True, capture_output=True, env=self.env)
        if result.returncode:
            raise RuntimeError(result.stderr.strip())
        return result.stdout.strip()

    def rpc(self, name, args, user=None, role='authenticated'):
        return json.loads(self.sql(f'SELECT public.{name}({args});', role, user))


BOOTSTRAP = """
CREATE SCHEMA auth;
CREATE TABLE auth.users(id uuid PRIMARY KEY);
CREATE FUNCTION auth.uid() RETURNS uuid LANGUAGE sql STABLE AS $$
  SELECT coalesce(nullif(current_setting('request.jwt.claim.sub', true), ''),
    nullif(current_setting('request.jwt.claims', true), '')::jsonb ->> 'sub')::uuid
$$;
GRANT USAGE ON SCHEMA auth, public TO anon, authenticated, service_role;
GRANT EXECUTE ON FUNCTION auth.uid() TO anon, authenticated, service_role;
ALTER DEFAULT PRIVILEGES IN SCHEMA public GRANT ALL ON TABLES TO anon, authenticated, service_role;
"""
A, B = 'aaaaaaaa-0000-4000-8000-000000000001', 'bbbbbbbb-0000-4000-8000-000000000002'
CA, CB = 'aaaaaaaa-1000-4000-8000-000000000001', 'bbbbbbbb-1000-4000-8000-000000000002'


class DatabaseContracts(unittest.TestCase):
    db = None

    def setUp(self):
        self.db.sql('TRUNCATE auth.users CASCADE;')
        self.db.sql(f"INSERT INTO auth.users VALUES('{A}'),('{B}');"
            f"INSERT INTO public.chains(id,user_id,name,trigger,description,duration,auxiliary_signal,auxiliary_completion_trigger) VALUES"
            f"('{CA}','{A}','A','start','A chain',25,'prepare','ready'),('{CB}','{B}','B','start','B chain',25,'prepare','ready');"
            f"INSERT INTO public.user_points(user_id,total_points) VALUES('{A}',1000),('{B}',1000);"
            f"INSERT INTO public.user_settings(user_id,gambling_mode_enabled) VALUES('{A}',true),('{B}',true);")

    def session(self, user=A, chain=CA):
        sid = str(uuid.uuid4())
        self.db.sql(f"INSERT INTO public.active_sessions(id,user_id,chain_id,duration,started_at)"
            f" VALUES('{sid}','{user}','{chain}',25,now());", 'authenticated', user)
        return sid

    def bet(self, sid, amount=100, user=A):
        return self.db.rpc('place_task_bet', f"'{user}','{sid}',{amount},NULL", user)

    def balance(self, user=A):
        return int(self.db.sql(f"SELECT total_points FROM public.user_points WHERE user_id='{user}';"))

    def denied(self, sql, user=None, role='authenticated'):
        with self.assertRaisesRegex(RuntimeError, '(permission denied|Access denied|Authentication required|access denied|ownership|row-level security|another user|Cross-user)'):
            self.db.sql(sql, role, user)

    def rows(self, table, user=A):
        return json.loads(self.db.sql(f"SELECT coalesce(jsonb_agg(to_jsonb(t)),'[]') FROM public.{table} t WHERE user_id='{user}';"))

    def operation(self, op, changes, user=A):
        return self.db.rpc('commit_storage_operation', f'{literal(op)}, {literal(json.dumps(changes))}::jsonb', user)

    def concurrent(self, work, count=8):
        from threading import Barrier
        barrier = Barrier(count)
        def run(_):
            barrier.wait()
            return work()
        with ThreadPoolExecutor(max_workers=count) as pool:
            return list(pool.map(run, range(count)))

    def test_acl_and_null_identity(self):
        functions = [f"perform_daily_checkin('{A}')", f"get_user_checkin_stats('{A}')",
            f"get_user_gambling_stats('{A}')", f"get_user_checkin_history('{A}',10,0)",
            f"get_user_betting_history('{A}',10,0)", f"place_task_bet('{A}',gen_random_uuid(),10,NULL)",
            'complete_task_with_betting(gen_random_uuid(),true,NULL)']
        for call in functions:
            for role, user in [('anon', None), ('authenticated', None), ('authenticated', B)]:
                self.denied('SELECT public.' + call, user, role)
        self.assertEqual(self.db.sql("SELECT count(*) FROM pg_proc p JOIN pg_namespace n ON n.oid=p.pronamespace WHERE n.nspname='public' AND p.prosecdef AND has_function_privilege('anon',p.oid,'EXECUTE');"), '0')

    def test_rls_and_ledger_write_permissions(self):
        self.assertEqual(self.db.sql('SELECT count(*) FROM public.chains;', 'anon'), '0')
        self.assertEqual(self.db.sql('SELECT name FROM public.chains;', 'authenticated', A), 'A')
        self.assertEqual(self.db.sql(f"WITH changed AS (UPDATE public.chains SET name='stolen' WHERE id='{CB}' RETURNING 1) SELECT count(*) FROM changed;", 'authenticated', A), '0')
        self.denied(f"UPDATE public.chains SET user_id='{B}' WHERE id='{CA}'", A)
        for table in ['user_points', 'daily_checkins', 'point_transactions', 'task_bets', 'audit_logs', 'write_sessions']:
            self.denied(f'DELETE FROM public.{table}', A)
        self.denied(f"UPDATE public.user_points SET total_points=999999 WHERE user_id='{A}'", A)
        self.denied(f"INSERT INTO public.user_points VALUES('{A}',999999,now(),now())", A)

    def test_clients_cannot_bypass_rls_with_table_administration(self):
        for role in ['anon','authenticated']:
            self.assertEqual(self.db.sql(f"SELECT count(*) FROM pg_class t JOIN pg_namespace n ON n.oid=t.relnamespace "
                f"WHERE n.nspname='public' AND t.relkind IN ('r','p') AND "
                f"has_table_privilege('{role}',t.oid,'TRUNCATE,REFERENCES,TRIGGER');"),'0')
            self.denied('TRUNCATE public.chains CASCADE',A if role=='authenticated' else None,role)
        self.assertEqual(self.db.sql('SELECT count(*) FROM public.chains'),'2')

    def test_checkin_concurrent_once(self):
        results = self.concurrent(lambda: self.db.rpc('perform_daily_checkin', f"'{A}'", A))
        self.assertEqual(sum(r['success'] for r in results), 1)
        self.assertEqual(self.balance(), 1010)
        self.assertEqual(self.db.sql('SELECT count(*) FROM public.daily_checkins'), '1')
        self.assertEqual(self.db.sql('SELECT count(*) FROM public.point_transactions'), '1')

    def test_history_rpc_pagination_and_caller_scope(self):
        self.db.sql(f"INSERT INTO public.daily_checkins(user_id,checkin_date,points_earned,consecutive_days) "
            f"SELECT '{A}',CURRENT_DATE-days,10,1 FROM generate_series(0,2) days; "
            f"INSERT INTO public.daily_checkins(user_id,checkin_date,points_earned,consecutive_days) "
            f"VALUES('{B}',CURRENT_DATE,10,1);")
        checkins = self.db.rpc('get_user_checkin_history',f"'{A}',1,1",A)
        self.assertEqual(checkins['total_count'],3)
        self.assertEqual(len(checkins['checkins']),1)
        self.assertEqual(checkins['checkins'][0]['checkin_date'],self.db.sql('SELECT CURRENT_DATE-1'))
        self.assertTrue(checkins['has_more'])
        empty = self.db.rpc('get_user_checkin_history',f"'{A}',1,3",A)
        self.assertEqual(empty['checkins'],[])
        self.assertFalse(empty['has_more'])
        bet_ids = []
        for days in range(3):
            bid = self.bet(self.session())['bet_id']
            bet_ids.append(bid)
            self.db.sql(f"UPDATE public.task_bets SET created_at=CURRENT_DATE-interval '{days} days' WHERE id='{bid}'")
        self.bet(self.session(B,CB),user=B)
        bets = self.db.rpc('get_user_betting_history',f"'{A}',1,1",A)
        self.assertEqual(bets['total_count'],3)
        self.assertEqual([row['id'] for row in bets['bets']],[bet_ids[1]])
        self.assertTrue(bets['has_more'])
        empty = self.db.rpc('get_user_betting_history',f"'{A}',1,3",A)
        self.assertEqual(empty['bets'],[])
        self.assertFalse(empty['has_more'])
        for rpc, key in [('get_user_checkin_history','checkins'),('get_user_betting_history','bets')]:
            default_page = self.db.rpc(rpc,f"'{A}',NULL,NULL",A)
            self.assertEqual(default_page['page_size'],20)
            self.assertEqual(default_page['page_offset'],0)
            self.assertEqual(len(default_page[key]),3)
        self.db.sql(f"UPDATE public.task_bets SET created_at=CURRENT_DATE WHERE user_id='{A}'")
        paged_ids = [self.db.rpc('get_user_betting_history',f"'{A}',1,{offset}",A)['bets'][0]['id']
            for offset in range(3)]
        self.assertEqual(paged_ids,sorted(bet_ids,reverse=True))

    def test_place_concurrent_and_limits(self):
        sid = self.session()
        results = self.concurrent(lambda: self.bet(sid))
        self.assertEqual(len({r['bet_id'] for r in results}), 1)
        self.assertTrue(all(r['success'] for r in results))
        self.assertEqual(self.balance(), 900)
        self.assertEqual(self.db.sql('SELECT count(*) FROM public.task_bets'), '1')
        with self.assertRaisesRegex(RuntimeError, 'conflicts'):
            self.bet(sid, 200)
        self.db.sql(f"UPDATE public.user_settings SET daily_bet_limit=150 WHERE user_id='{A}'")
        second = self.bet(self.session())
        self.assertEqual(second['error_code'], 'DAILY_LIMIT_EXCEEDED')

    def test_completion_concurrent_and_private_settlement(self):
        sid = self.session()
        bid = self.bet(sid)['bet_id']
        for who in [A, B, None]:
            self.denied(f"SELECT public.refund_task_bet('{bid}')", who)
            self.denied(f"SELECT public.settle_task_bet('{bid}',true,NULL)", who)
        results = self.concurrent(lambda: self.db.rpc('complete_task_with_betting', f"'{sid}',true,NULL", A))
        self.assertEqual(len({r['completion_history_id'] for r in results}), 1)
        self.assertEqual(self.balance(), 1100)
        self.assertEqual(self.db.sql(f"SELECT bet_status FROM public.task_bets WHERE id='{bid}'"), 'won')
        self.assertEqual(self.db.sql("SELECT count(*) FROM public.point_transactions WHERE transaction_type='bet_won'"), '1')
        self.assertEqual(self.db.sql('SELECT count(*) FROM public.completion_history'), '1')
        self.assertEqual(self.db.sql('SELECT count(*) FROM public.active_sessions'), '0')
        with self.assertRaisesRegex(RuntimeError, 'different outcome'):
            self.db.rpc('complete_task_with_betting', f"'{sid}',false,NULL", A)

    def test_loss_and_cancellation(self):
        sid = self.session(); bid = self.bet(sid)['bet_id']
        self.db.rpc('complete_task_with_betting', f"'{sid}',false,'failed'", A)
        self.assertEqual(self.balance(), 900)
        self.assertEqual(self.db.sql(f"SELECT bet_status FROM public.task_bets WHERE id='{bid}'"), 'lost')
        self.assertEqual(self.db.sql('SELECT count(*) FROM public.point_transactions WHERE points_change=0'), '0')
        sid = self.session(); bid = self.bet(sid)['bet_id']
        self.concurrent(lambda: self.db.sql(f"DELETE FROM public.active_sessions WHERE id='{sid}'", 'authenticated', A))
        self.assertEqual(self.balance(), 900)
        self.assertEqual(self.db.sql(f"SELECT bet_status FROM public.task_bets WHERE id='{bid}'"), 'refunded')
        self.assertEqual(self.db.sql("SELECT count(*) FROM public.point_transactions WHERE transaction_type='bet_refunded'"), '1')

    def test_trigger_failure_rolls_back_completion(self):
        sid = self.session(); bid = self.bet(sid)['bet_id']
        self.db.sql("CREATE FUNCTION public.test_reject_payout() RETURNS trigger LANGUAGE plpgsql AS $$ BEGIN RAISE EXCEPTION 'injected ledger failure'; END $$; CREATE TRIGGER test_reject_payout BEFORE INSERT ON public.point_transactions FOR EACH ROW EXECUTE FUNCTION public.test_reject_payout();")
        try:
            with self.assertRaisesRegex(RuntimeError, 'injected ledger failure'):
                self.db.rpc('complete_task_with_betting', f"'{sid}',true,NULL", A)
            self.assertEqual(self.db.sql('SELECT count(*) FROM public.active_sessions'), '1')
            self.assertEqual(self.db.sql('SELECT count(*) FROM public.completion_history'), '0')
            self.assertEqual(self.db.sql(f"SELECT bet_status FROM public.task_bets WHERE id='{bid}'"), 'pending')
            self.assertEqual(self.balance(), 900)
        finally:
            self.db.sql('DROP TRIGGER test_reject_payout ON public.point_transactions; DROP FUNCTION public.test_reject_payout();')
        self.db.rpc('complete_task_with_betting', f"'{sid}',true,NULL", A)
        self.assertEqual(self.balance(), 1100)

    def test_imported_history_does_not_settle_live_bet(self):
        sid = self.session(); self.bet(sid)
        self.db.sql(f"INSERT INTO public.completion_history(chain_id,user_id,duration,was_successful) VALUES('{CA}','{A}',25,true)", 'authenticated', A)
        self.assertEqual(self.balance(), 900)
        self.assertEqual(self.db.sql('SELECT bet_status FROM public.task_bets'), 'pending')

    def test_storage_operation_defaults_replay_and_conflict(self):
        after = [{'id': str(uuid.uuid4()), 'user_id': A, 'title': 'policy', 'rule': 'daily'}]
        changes = [{'table': 'rsip_policy_library', 'before': [], 'after': after}]
        results = self.concurrent(lambda: self.operation('policies-1', changes))
        self.assertEqual(sum(not r['replayed'] for r in results), 1)
        actual = self.rows('rsip_policy_library')
        self.assertEqual(len(actual), 1)
        self.assertEqual(actual[0]['times_used'], 0)
        self.assertIsNotNone(actual[0]['updated_at'])
        with self.assertRaisesRegex(RuntimeError, 'different content'):
            self.operation('policies-1', [{'table': 'rsip_policy_library', 'before': [], 'after': []}])
        with self.assertRaisesRegex(RuntimeError, 'Collection changed'):
            self.operation('stale', changes)
        self.assertEqual(self.rows('rsip_policy_library'), actual)

    def test_storage_rollback_and_cross_user(self):
        before = self.rows('chains')
        updated = [{**before[0], 'name': 'changed'}]
        broken = [{'table': 'chains', 'before': before, 'after': updated},
            {'table': 'rsip_policy_library', 'before': [], 'after': [{'id':str(uuid.uuid4()),'user_id':A,'title':'missing required rule'}]}]
        with self.assertRaisesRegex(RuntimeError, 'not-null constraint'):
            self.operation('broken-import', broken)
        self.assertEqual(self.rows('chains'), before)
        for after in [[{**before[0], 'user_id':B}], [{**before[0], 'id':CB}], [{**before[0], 'parent_id': CB}]]:
            with self.assertRaisesRegex(RuntimeError, '(ownership|another user|Cross-user)'):
                self.operation(str(uuid.uuid4()), [{'table':'chains','before':before,'after':after}])
        self.assertEqual(self.rows('chains'), before)
        self.assertEqual(self.db.sql('SELECT count(*) FROM public.storage_operation_commits'), '0')

    def test_storage_completion_transaction(self):
        sid = self.session(); self.bet(sid)
        chains = self.rows('chains'); sessions = self.rows('active_sessions')
        changes = [
            {'table':'chains','before':chains,'after':[{**chains[0],'total_completions':1}]},
            {'table':'completion_history','before':[],'after':[{'id':str(uuid.uuid4()), 'user_id':A,'chain_id':CA,'duration':25,'was_successful':True,'metadata':{'session_id':sid}}]},
            {'table':'active_sessions','before':sessions,'after':[]}]
        self.operation('complete-1',changes)
        self.operation('complete-1',changes)
        self.assertEqual(self.balance(),1100)
        self.assertEqual(self.db.sql('SELECT count(*) FROM public.active_sessions'),'0')
        self.assertEqual(self.db.sql('SELECT count(*) FROM public.completion_history'),'1')
        self.assertEqual(self.rows('chains')[0]['total_completions'],1)

    def test_storage_parallel_writers_detect_conflict(self):
        before = self.rows('chains')
        def write():
            try:
                self.operation(str(uuid.uuid4()), [{'table':'chains','before':before,'after':[{**before[0],'name':'new'}]}])
                return 'committed'
            except RuntimeError as error:
                if 'Collection changed' not in str(error): raise
                return 'conflict'
        result = self.concurrent(write)
        self.assertEqual(result.count('committed'),1)
        self.assertEqual(result.count('conflict'),7)


    def test_concurrent_limits_and_wallet_audit(self):
        self.db.sql(f"UPDATE public.user_settings SET daily_bet_limit=150 WHERE user_id='{A}'")
        sessions = [self.session(), self.session()]
        with ThreadPoolExecutor(max_workers=2) as pool:
            results = list(pool.map(self.bet, sessions))
        self.assertEqual(sum(r['success'] for r in results), 1)
        self.assertEqual(self.balance(), 900)
        self.db.sql(f"UPDATE public.user_settings SET daily_bet_limit=NULL WHERE user_id='{A}'")
        remaining = next(sid for sid, result in zip(sessions, results) if not result['success'])
        self.bet(remaining, 200)
        with ThreadPoolExecutor(max_workers=2) as pool:
            list(pool.map(lambda sid:self.db.rpc('complete_task_with_betting',f"'{sid}',true,NULL",A), sessions))
        self.assertEqual(self.balance(), 1300)
        ledger = self.rows('point_transactions')
        self.assertEqual(sum(row['points_change'] for row in ledger), 300)
        self.assertTrue(all(row['points_after']-row['points_before']==row['points_change'] for row in ledger))
        winners = [row for row in ledger if row['transaction_type']=='bet_won']
        self.assertEqual(min(row['points_before'] for row in winners), 700)
        self.assertEqual(max(row['points_after'] for row in winners), 1300)

    def test_completion_racing_cancellation_is_one_outcome(self):
        sid = self.session(); self.bet(sid)
        def finish(_):
            try:
                return self.db.rpc('complete_task_with_betting',f"'{sid}',true,NULL",A)
            except RuntimeError as error:
                if 'Session not found or access denied' not in str(error): raise
                return None
        def cancel(_):
            return self.db.sql(f"DELETE FROM public.active_sessions WHERE id='{sid}'",'authenticated',A)
        with ThreadPoolExecutor(max_workers=8) as pool:
            futures = [pool.submit(finish if i%2 else cancel, i) for i in range(8)]
            [future.result() for future in futures]
        status = self.db.sql('SELECT bet_status FROM public.task_bets')
        self.assertIn(status, ['won','refunded'])
        self.assertEqual(self.balance(), 1100 if status=='won' else 1000)
        self.assertEqual(self.db.sql("SELECT count(*) FROM public.point_transactions WHERE transaction_type IN ('bet_won','bet_refunded')"),'1')

    def test_rpc_search_path_and_private_receipts(self):
        self.db.rpc('create_write_session', "'betting',5", A)
        self.assertEqual(self.db.sql('SELECT count(*) FROM public.write_sessions','authenticated',B),'0')
        self.assertEqual(self.db.sql('SELECT count(*) FROM public.write_sessions','authenticated',A),'1')
        for table in ['rsip_atomic_intents','storage_operation_commits','betting_completion_operations','completed_session_receipts']:
            self.denied(f'SELECT * FROM public.{table}',A)
        self.assertEqual(self.db.sql("SELECT count(*) FROM pg_proc p JOIN pg_namespace n ON p.pronamespace=n.oid WHERE n.nspname='public' AND p.prosecdef AND NOT EXISTS(SELECT 1 FROM unnest(p.proconfig) c WHERE c LIKE 'search_path=%')"),'0')
        for rpc in ['get_user_checkin_stats','get_user_gambling_stats']:
            self.assertIsInstance(self.db.rpc(rpc, f"'{A}'",A),dict)

    def test_rsip_rpc_roles_ownership_and_retries(self):
        bid = str(uuid.uuid4())
        self.db.sql(f"INSERT INTO public.rsip_nodes(id,user_id,title,rule) VALUES('{bid}','{B}','B node','rule')")
        aid = str(uuid.uuid4())
        node = {'id':aid,'title':'A node','rule':'rule'}
        args = lambda nodes: f"'create-1',{literal(json.dumps(nodes))}::jsonb,'{{}}'::jsonb"
        for role in ['anon','authenticated']:
            self.denied('SELECT public.create_rsip_nodes_with_meta('+args([node])+')',None,role)
        for invalid in [{**node,'id':bid},{**node,'parent_id':bid}]:
            with self.assertRaisesRegex(RuntimeError,'another user'):
                self.db.rpc('create_rsip_nodes_with_meta',args([invalid]),A)
        results = self.concurrent(lambda:self.db.rpc('create_rsip_nodes_with_meta',args([node]),A))
        self.assertTrue(all(result['nodes'][0]['id']==aid for result in results))
        self.assertEqual(len(self.rows('rsip_nodes')),1)
        self.assertEqual(self.db.sql('SELECT count(*) FROM public.rsip_nodes','authenticated',A),'1')
        self.db.rpc('archive_rsip_nodes_and_remove',f"'archive-1',ARRAY['{aid}'::uuid]",A)
        self.db.rpc('archive_rsip_nodes_and_remove',f"'archive-1',ARRAY['{aid}'::uuid]",A)
        self.assertEqual(len(self.rows('rsip_nodes')),0)
        self.assertEqual(len(self.rows('rsip_policy_library')),1)

    def test_storage_primary_keys_and_parent_child_batch(self):
        parent, child, group = (str(uuid.uuid4()) for _ in range(3))
        changes = [
            {'table':'rsip_groups','before':[],'after':[{'id':group,'user_id':A,'title':'Group'}]},
            {'table':'rsip_nodes','before':[],'after':[
                {'id':child,'user_id':A,'title':'Child','rule':'rule','parent_id':parent,'group_id':group},
                {'id':parent,'user_id':A,'title':'Parent','rule':'rule','parent_id':None,'group_id':group}]},
            {'table':'rsip_meta','before':[],'after':[{'user_id':A,'tree_open_streak':1}]},
            {'table':'rsip_run_history','before':[],'after':[{'user_id':A,'run_number':1,'started_at':'2026-09-20T00:00:00Z'}]}]
        self.operation('tree-import',changes)
        self.assertEqual(len(self.rows('rsip_nodes')),2)
        self.assertEqual(self.rows('rsip_meta')[0]['tree_open_streak'],1)
        self.assertEqual(self.rows('rsip_run_history')[0]['max_node_count'],0)
        before = self.rows('rsip_nodes')
        self.operation('tree-remove',[{'table':'rsip_nodes','before':before,'after':[]}])
        self.assertEqual(len(self.rows('rsip_nodes')),0)


    def test_storage_deletion_cannot_silently_change_children(self):
        parent, child = str(uuid.uuid4()), str(uuid.uuid4())
        self.db.sql(f"INSERT INTO public.rsip_nodes(id,user_id,title,rule,parent_id) VALUES('{parent}','{A}','parent','rule',NULL),('{child}','{A}','child','rule','{parent}')")
        before = self.rows('rsip_nodes')
        retained = [row for row in before if row['id']==child]
        with self.assertRaisesRegex(RuntimeError, 'retained row or relation'):
            self.operation('delete-parent',[{'table':'rsip_nodes','before':before,'after':retained}])
        self.assertEqual(len(self.rows('rsip_nodes')),2)
        record = str(uuid.uuid4())
        self.db.sql(f"INSERT INTO public.rsip_execution_records(id,user_id,node_id,status,executed_at) VALUES('{record}','{A}','{child}','executed',now())")
        with self.assertRaisesRegex(RuntimeError, 'omitted collection'):
            self.operation('delete-tree',[{'table':'rsip_nodes','before':before,'after':[]}])
        self.assertEqual(len(self.rows('rsip_nodes')),2)
        self.assertEqual(len(self.rows('rsip_execution_records')),1)

    def test_storage_unchanged_rows_do_not_fire_update_triggers(self):
        self.db.sql("CREATE FUNCTION public.test_reject_chain_update() RETURNS trigger LANGUAGE plpgsql AS $$ BEGIN RAISE EXCEPTION 'unexpected chain update'; END $$; CREATE TRIGGER test_reject_chain_update BEFORE UPDATE ON public.chains FOR EACH ROW EXECUTE FUNCTION public.test_reject_chain_update();")
        try:
            before = self.rows('chains')
            self.operation('unchanged',[{'table':'chains','before':before,'after':before}])
            self.assertEqual(self.rows('chains'),before)
        finally:
            self.db.sql('DROP TRIGGER test_reject_chain_update ON public.chains; DROP FUNCTION public.test_reject_chain_update();')
        with self.assertRaisesRegex(RuntimeError,'Duplicate collection primary key'):
            self.operation('duplicate',[{'table':'chains','before':before,'after':before+before}])


    def test_privileged_account_removal_and_session_chain_guard(self):
        invalid = self.session(A, CB)
        self.denied(f"SELECT public.place_task_bet('{A}','{invalid}',100,NULL)",A)
        self.denied(f"SELECT public.complete_task_with_betting('{invalid}',true,NULL)",A)
        sid = self.session(); self.bet(sid)
        self.db.sql(f"DELETE FROM auth.users WHERE id='{A}'")
        self.assertEqual(self.db.sql(f"SELECT count(*) FROM public.user_points WHERE user_id='{A}'"),'0')
        self.assertEqual(self.db.sql(f"SELECT count(*) FROM public.active_sessions WHERE user_id='{A}'"),'0')
        self.assertEqual(self.balance(B),1000)


    def test_completed_session_cannot_be_resurrected(self):
        sid = self.session(); self.bet(sid)
        old = self.rows('active_sessions')[0]
        self.db.rpc('complete_task_with_betting',f"'{sid}',true,NULL",A)
        history = self.rows('completion_history')[0]
        self.assertIn('session_started_at',history['metadata'])
        self.assertEqual(self.db.sql('SELECT count(*) FROM public.completed_session_receipts'),'1')
        def reinsert(identity, started):
            self.db.sql(f"INSERT INTO public.active_sessions(id,user_id,chain_id,duration,started_at) VALUES('{identity}','{A}','{CA}',25,{started})",'authenticated',A)
        for identity, started in [(sid,literal(old['started_at'])),(str(uuid.uuid4()),literal(old['started_at'])),(str(uuid.uuid4()),f"date_trunc('milliseconds',{literal(old['started_at'])}::timestamptz)")]:
            with self.assertRaisesRegex(RuntimeError,'Session already completed'):
                reinsert(identity,started)
        self.db.sql('DELETE FROM public.completion_history','authenticated',A)
        with self.assertRaisesRegex(RuntimeError,'Session already completed'):
            reinsert(str(uuid.uuid4()),literal(old['started_at']))
        fresh = str(uuid.uuid4())
        reinsert(fresh,f"{literal(old['started_at'])}::timestamptz + interval '1 second'")
        with self.assertRaisesRegex(RuntimeError,'Session already completed'):
            self.db.sql(f"UPDATE public.active_sessions SET started_at={literal(old['started_at'])} WHERE id='{fresh}'",'authenticated',A)
        self.assertEqual(self.db.sql('SELECT count(*) FROM public.active_sessions'),'1')
        self.assertEqual(self.balance(),1100)

    def test_imported_history_does_not_block_new_sessions(self):
        self.db.sql(f"INSERT INTO public.completion_history(chain_id,user_id,duration,was_successful) VALUES('{CA}','{A}',25,true)",'authenticated',A)
        self.session()
        self.assertEqual(self.db.sql('SELECT count(*) FROM public.active_sessions'),'1')
        self.assertEqual(self.db.sql('SELECT count(*) FROM public.completed_session_receipts'),'0')


    def test_completion_serializes_stale_upserts(self):
        sid = self.session(); self.bet(sid)
        started = self.rows('active_sessions')[0]['started_at']
        def pause(_):
            try:
                self.db.sql(f"INSERT INTO public.active_sessions(id,user_id,chain_id,duration,started_at,is_paused) VALUES(gen_random_uuid(),'{A}','{CA}',25,{literal(started)},true)",'authenticated',A)
            except RuntimeError as error:
                if 'Session already completed' not in str(error): raise
        with ThreadPoolExecutor(max_workers=9) as pool:
            futures = [pool.submit(pause,i) for i in range(4)]
            completed = pool.submit(self.db.rpc,'complete_task_with_betting',f"'{sid}',true,NULL",A)
            futures.extend(pool.submit(pause,i) for i in range(4,8))
            [future.result() for future in futures]
            self.assertTrue(completed.result()['success'])
        self.assertEqual(self.db.sql('SELECT count(*) FROM public.active_sessions'),'0')
        self.assertEqual(self.db.sql('SELECT count(*) FROM public.completed_session_receipts'),'1')
        self.assertEqual(self.balance(),1100)


def main():
    manifest = json.loads((ROOT / 'supabase/baselines/manifest.json').read_text())
    if hashlib.sha256((ROOT / 'supabase/baselines/20260211000000.sql').read_bytes()).hexdigest() != manifest['baseline_sha256']:
        raise SystemExit('Controlled baseline hash does not match manifest.')
    for source in manifest['sources']:
        path = ROOT / 'supabase/migrations' / source['file']
        if hashlib.sha256(path.read_bytes()).hexdigest() != source['sha256']:
            raise SystemExit(f'Historical migration changed: {source["file"]}')
    configured = os.environ.get('MOMENTUM_TEST_DATABASE_URL')
    with tempfile.TemporaryDirectory(prefix='momentum-pg-') as directory:
        cluster = Path(directory)
        env = {key:value for key,value in os.environ.items() if not key.startswith('PG')}
        env.update(PGCONNECT_TIMEOUT='10', PGOPTIONS='-c statement_timeout=20000 -c lock_timeout=10000')
        started = False
        if configured:
            parsed = urlparse(configured)
            if parsed.scheme not in ('postgres', 'postgresql') or parsed.hostname not in ('127.0.0.1','localhost','::1') or parsed.query or parsed.fragment:
                raise SystemExit('MOMENTUM_TEST_DATABASE_URL must point to an isolated loopback PostgreSQL test server.')
            env.update(PGHOST=parsed.hostname, PGPORT=str(parsed.port or 5432),
                PGUSER=unquote(parsed.username or 'postgres'), PGPASSWORD=unquote(parsed.password or ''),
                PGDATABASE=unquote(parsed.path.lstrip('/') or 'postgres'))
        else:
            if not (BIN / 'initdb').exists():
                raise SystemExit('Local PostgreSQL server binaries required when no MOMENTUM_TEST_DATABASE_URL is set.')
            env.update(PGHOST=directory, PGPORT='55439', PGUSER=os.environ.get('USER','postgres'), PGDATABASE='postgres')
            subprocess.run([str(BIN / 'initdb'), '-D',str(cluster/'data'),'-A','trust','--no-locale','-E','UTF8'],check=True,stdout=subprocess.DEVNULL,stderr=subprocess.PIPE)
            subprocess.run([str(BIN / 'pg_ctl'), '-D',str(cluster/'data'), '-l',str(cluster/'server.log'),'-o',f'-k {directory} -p 55439 -h ""', '-w','start'],check=True,stdout=subprocess.DEVNULL)
            started = True
        admin = Database(env)
        try:
            version = admin.sql('SHOW server_version')
            print(f'Real PostgreSQL {version}: cold baseline + seeded old-schema upgrade',flush=True)
            for role in ['anon','authenticated','service_role']:
                admin.sql(f"DO $$ BEGIN IF NOT EXISTS(SELECT FROM pg_roles WHERE rolname='{role}') THEN CREATE ROLE {role}; END IF; END $$;")
            for lane in ['cold', 'upgrade']:
                database_name = 'momentum_test_' + uuid.uuid4().hex
                admin.sql(f'CREATE DATABASE {database_name}')
                test_env = dict(env)
                test_env['PGDATABASE'] = database_name
                db = Database(test_env)
                try:
                    db.sql(BOOTSTRAP)
                    db.sql((ROOT/'supabase/baselines/20260211000000.sql').read_text())
                    if lane == 'upgrade':
                        db.sql(f"INSERT INTO auth.users VALUES('{A}'); INSERT INTO public.user_points(user_id,total_points) VALUES('{A}',2147483640); INSERT INTO public.daily_checkins(user_id,points_earned,consecutive_days,checkin_date) VALUES('{A}',10,1,CURRENT_DATE-1);")
                    for migration in sorted((ROOT/'supabase/migrations').glob('*.sql')):
                        if migration.name[:14] > manifest['through']:
                            db.sql(migration.read_text())
                    if lane == 'upgrade':
                        assert db.sql(f"SELECT total_points FROM public.user_points WHERE user_id='{A}'") == '2147483640'
                        result = db.rpc('perform_daily_checkin',f"'{A}'",A)
                        assert result['total_points'] == 2147483650, result
                        assert db.sql('SELECT count(*) FROM public.daily_checkins') == '2'
                    print(f'[{lane}] migrated; running role/SQL/transaction/concurrency contracts',flush=True)
                    DatabaseContracts.db = db
                    result = unittest.TextTestRunner(verbosity=2).run(unittest.defaultTestLoader.loadTestsFromTestCase(DatabaseContracts))
                    if not result.wasSuccessful(): return 1
                finally:
                    admin.sql(f'DROP DATABASE {database_name} WITH (FORCE)')
            return 0
        finally:
            if started:
                subprocess.run([str(BIN/'pg_ctl'),'-D',str(cluster/'data'),'-m','immediate','-w','stop'],check=True,stdout=subprocess.DEVNULL)


if __name__ == '__main__':
    raise SystemExit(main())
