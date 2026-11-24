// Ages the raw UI-built state into a lived-in one: long streaks, used
// precedents, policies at different stability phases, earlier RSIP runs.
import { readFile, writeFile } from 'node:fs/promises';

const raw = JSON.parse(await readFile(new URL('./seed.raw.json', import.meta.url)));
const day = 86400000;
const now = Date.now();
const ago = (d, h = 0) => new Date(now - d * day - h * 3600000).toISOString();

const chains = JSON.parse(raw.momentum_chains);
const stats = {
  论文写作: { currentStreak: 36, auxiliaryStreak: 21, totalCompletions: 64, totalFailures: 5, auxiliaryFailures: 2, createdAt: ago(70) },
  阅读文献: { currentStreak: 12, auxiliaryStreak: 8, totalCompletions: 31, totalFailures: 3, auxiliaryFailures: 1, createdAt: ago(48) },
  晨跑: { currentStreak: 9, auxiliaryStreak: 4, totalCompletions: 22, totalFailures: 2, auxiliaryFailures: 0, createdAt: ago(30) },
};
for (const c of chains) Object.assign(c, stats[c.name], { lastCompletedAt: ago(1, 3) });
// keep the thesis chain first on the dashboard
chains.sort((a, b) => (a.name === '论文写作' ? -1 : b.name === '论文写作' ? 1 : 0));
chains.forEach((c, i) => (c.sortOrder = i));

const rules = JSON.parse(raw.momentum_exception_rules);
const uses = { 去洗手间: 12, 接家人电话: 3, 取快递: 1 };
for (const r of rules) Object.assign(r, { usageCount: uses[r.name], createdAt: ago(60), lastUsedAt: ago(2) });

const nodes = JSON.parse(raw.momentum_rsip_nodes);
const age = {
  吃完饭立刻洗碗: [41, '🍽️'],
  回家先洗澡: [39, '🚿'],
  不带手机上沙发: [33, '🛋️'],
  先发制人: [27, '🌅'],
  夜幕降临: [15, '🌙', true],
  预备仪式: [10, '🧍'],
  晨间书桌: [5, '🪑'],
  周日复盘: [2, '🗓️'],
};
for (const n of nodes) {
  const [d, emoji, passive] = age[n.title];
  const phase = d >= 21 ? 'E2' : d >= 7 ? 'E1' : 'E0';
  Object.assign(n, {
    emoji,
    isPassive: Boolean(passive),
    createdAt: ago(d),
    stabilityPhase: phase,
    phaseStartedAt: ago(phase === 'E2' ? d - 21 : phase === 'E1' ? d - 7 : d),
    consecutiveExecutions: d - 1,
    totalExecutions: d - 1,
    totalViolations: 0,
    lastExecutedAt: ago(1),
    cumulativeExecutionDays: d + (d > 20 ? 19 : 6),
    reinforcementLevel: n.title === '先发制人' ? 2 : 0,
  });
}

const meta = JSON.parse(raw.momentum_rsip_meta);
Object.assign(meta, {
  allowMultiplePerDay: false,
  lastAddedAt: ago(2),
  currentRunNumber: 3,
  currentRunStartedAt: ago(41),
  treeOpenStreak: 41,
  dailyTreeOpenRequired: true,
  lastTreeOpenedAt: ago(1),
});

const runs = [
  { runNumber: 1, startedAt: ago(83), endedAt: ago(71), maxNodeCount: 9, durationDays: 12, collapseReason: '通宵赶 DDL，作息国策连锁崩塌', collapseNodeTitle: '每天 23:30 睡觉' },
  { runNumber: 2, startedAt: ago(70), endedAt: ago(42), maxNodeCount: 16, durationDays: 28, collapseReason: '出差一周，晨间国策中断', collapseNodeTitle: '晨跑 5 公里' },
];
const library = [
  { id: 'lib-1', title: '每天 23:30 睡觉', rule: '23:30 前上床', emoji: '🛏️', cumulativeExecutionDays: 11, internalizationProgress: 34, lastActiveAt: ago(71), timesUsed: 1 },
  { id: 'lib-2', title: '晨跑 5 公里', rule: '起床后 30 分钟内出门跑步', emoji: '🏃', cumulativeExecutionDays: 23, internalizationProgress: 61, lastActiveAt: ago(42), timesUsed: 2 },
];

const pet = JSON.parse(raw.momentum_pet_state);
Object.assign(pet, { isVisible: false });

const seed = {
  ...raw,
  momentum_pet_state: JSON.stringify(pet),
  momentum_chains: JSON.stringify(chains),
  momentum_exception_rules: JSON.stringify(rules),
  momentum_rsip_nodes: JSON.stringify(nodes),
  momentum_rsip_meta: JSON.stringify(meta),
  momentum_rsip_run_history: JSON.stringify(runs),
  momentum_rsip_policy_library: JSON.stringify(library),
};
delete seed.momentum_diagnostics_v1;
await writeFile(new URL('./seed.json', import.meta.url), JSON.stringify(seed, null, 2));
console.log('seed.json written:', Object.keys(seed).join(', '));
