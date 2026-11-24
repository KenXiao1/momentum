// The film's bilingual script. Each scene lists its subtitle cues as
// [zh, en, options]. Cue durations are derived from reading length unless a
// cue sets `dur`; `hold` adds dwell time after a cue so the picture can
// breathe. Scene timing (and therefore the score) is derived from this file.
//
// Source: Edmond, 《如何提高自制力？》 (Zhihu, 2025), adapted under the
// author's MIT-style licence with attribution.

export const TITLE = {
  zh: '意志的工程学',
  en: 'Engineering the Will',
};

export const SCENES = [
  {
    id: 'cold',
    pre: 2.4,
    post: 0.4,
    cues: [
      ['晚上七点。你刚吃完饭，坐在书桌前。', '7 p.m. Dinner is over. You sit down at your desk.'],
      ['作业摊在面前。手边，手机亮了一下。', 'Your work lies open. Beside it, your phone lights up.', { hold: 0.4 }],
      ['一个选项让你此刻快乐，另一个让你明天轻松。', 'One option pays off now. The other, tomorrow.'],
      ['几乎所有缺乏自制力的人，都会拿起手机——然后后悔一整晚。', 'Most of us pick up the phone — and regret it all night.', { hold: 0.3 }],
      ['为什么？', 'Why?', { hold: 1.0 }],
    ],
  },
  {
    id: 'title',
    pre: 4.4,
    post: 0.8,
    cues: [
      ['自制力，未必只是一个心理学问题。', 'Self-control may not be only a matter of psychology.'],
      ['它也可以是一个工程问题——能用数学和物理去解决。', 'It can be an engineering problem — one that maths and physics can solve.', { hold: 0.6 }],
    ],
  },

  // ───────────────────────── I. The integral of choice
  {
    id: 'ch1',
    chapter: { num: 'I', zh: '选择的积分', en: 'The Integral of Choice' },
    pre: 3.6,
    post: 0.2,
    cues: [],
  },
  {
    id: 'formula',
    pre: 0.8,
    post: 0.4,
    cues: [
      ['假设：你对一个选项的真实倾向，可以写成一个积分。', 'Suppose your true pull toward an option can be written as an integral.', { hold: 0.5 }],
      ['V(τ)：这个行为在未来每一刻带来的价值。', 'V(τ): the value the action brings at each future moment τ.'],
      ['W(τ)：你对未来每一刻的重视程度。', 'W(τ): how much weight you give to each of those moments.'],
      ['两者相乘，从此刻积分到无穷远，就是你最终的选择。', 'Multiply, integrate from now to infinity — and that is what you choose.', { hold: 0.4 }],
    ],
  },
  {
    id: 'curves',
    pre: 0.5,
    post: 0.6,
    cues: [
      ['学习：先是枯燥与疲惫，然后是安心与满足，最后慢慢归零。', 'Studying: effort first, then relief and satisfaction, then a slow fade.', { hold: 0.3 }],
      ['刷手机正好相反：先是快乐，然后是焦虑和愧疚。', 'Scrolling is the mirror image: pleasure first, then anxiety and guilt.', { hold: 0.3 }],
      ['如果对未来一视同仁，学习显然更划算。', 'If every moment counted equally, studying would clearly win.', { hold: 0.6 }],
      ['但大脑极度短视：W(τ) 在眼前极高，往远处迅速跌向零。', 'But the brain is short-sighted: W(τ) is huge now and collapses further out.', { hold: 0.5 }],
      ['乘上这样的权重，短期的快乐被放大——积分翻转了。', 'Weighted like that, the quick pleasure is magnified — and the integral flips.', { hold: 0.6 }],
      ['这就是行为经济学里的“双曲贴现”。', 'This is hyperbolic discounting.', { hold: 0.3 }],
    ],
  },
  {
    id: 'impulse',
    pre: 0.3,
    post: 0.4,
    cues: [
      ['另外，切换本身就有阻力——就像在 τ = 0 处插入一个负向的冲激。', 'Switching itself has a cost — like a negative impulse at τ = 0.', { hold: 0.5 }],
      ['所以手机拿起来就放不下；而学习一旦开始，反而越来越轻松。', 'So the phone is hard to put down — and study, once begun, gets easier.', { hold: 0.3 }],
    ],
  },
  {
    id: 'transform',
    pre: 0.3,
    post: 0.8,
    cues: [
      ['W(τ) 是天生的。所以，一切有效的自控策略，都是对 V(τ) 的一次变换。', 'W(τ) is innate. So every working strategy is a transformation of V(τ).', { hold: 0.5 }],
      ['远期的奖励与惩罚，落在权重几乎为零的地方，几乎不起作用。', 'Distant rewards and punishments land where the weight is near zero. They barely register.', { hold: 0.5 }],
      ['真正有效的，是把远方的价值，压缩到此时此刻。', 'What works is compressing distant value into the present moment.', { hold: 0.9 }],
    ],
  },

  // ───────────────────────── II. CTDP
  {
    id: 'ch2',
    chapter: { num: 'II', zh: '链式时延协议', en: 'The Chained Time-Delay Protocol' },
    pre: 3.8,
    post: 0.2,
    cues: [],
  },
  {
    id: 'seat',
    pre: 0.6,
    post: 0.5,
    cues: [
      ['第一个原理：神圣座位。', 'Principle one: the Sacred Seat.', { hold: 0.3 }],
      ['给一个座位立下规则：坐上去，就必须以最好的状态专注满一小时。', 'Give a seat one rule: sit here, and you focus at your best for a full hour.'],
      ['没有把握，就别坐。', 'Not sure you can? Then don’t sit.', { hold: 0.4 }],
      ['每成功一次，链上多一个节点：#1、#2、#3……', 'Each success adds a node: #1, #2, #3…', { hold: 1.0 }],
      ['失败一次，所有纪录清零，从 #1 重新开始。', 'Fail once, and the record resets to #1.', { hold: 0.6 }],
      ['链条越长，这个座位就越“神圣”。', 'The longer the chain, the more sacred the seat.', { hold: 0.8 }],
    ],
  },
  {
    id: 'compress',
    pre: 0.3,
    post: 0.6,
    cues: [
      ['因为纪录天生“一损俱损”：放弃的那一刻，过去的投入和未来的期望同时失去。', 'A record is all-or-nothing: quit, and its past and its promise are lost at once.', { hold: 0.4 }],
      ['整条链的价值，被压缩成一根贴着原点的尖峰。', 'The whole chain’s value is compressed into one spike at the origin.', { hold: 0.9 }],
      ['没有哪种诱惑能越过这道屏障——你甚至感觉不到“放弃”这个选项。', 'No temptation can clear that wall. You stop even feeling the option to quit.', { hold: 0.3 }],
      ['于是，反而平静地进入了心流。', 'And, strangely calm, you slip into flow.', { hold: 0.9 }],
    ],
  },
  {
    id: 'demo-seat',
    footage: 'seat',
    pre: 0.6,
    post: 0.5,
    cues: [
      ['在 Momentum 里，每条任务链都有自己的神圣座位：一个明确的触发动作。', 'In Momentum, every chain has its sacred seat: one unmistakable trigger.', { hold: 2.2 }],
      ['做出这个动作，计时开始；坚持到底，链条 +1。', 'Perform it and the timer starts. Finish, and the chain grows by one.', { hold: 2.2 }],
    ],
  },
  {
    id: 'precedent',
    pre: 0.5,
    post: 0.5,
    cues: [
      ['第二个原理：下必为例。', 'Principle two: Precedent Is Binding.', { hold: 0.3 }],
      ['中途去洗手间，还算“最好的状态”吗？回条消息呢？刷两分钟视频呢？', 'A bathroom break — still your best? A quick reply? Two minutes of videos?', { hold: 0.3 }],
      ['“下不为例”，规则就在侥幸中被腐蚀；毫不通融，又会在某次忍无可忍时崩溃。', '“Just this once” erodes a rule. “Never” makes it shatter.', { hold: 0.4 }],
      ['所以，面对任何疑似违规，只能二选一——', 'So for any questionable act, choose one of two:', { hold: 0.2 }],
      ['判定违规：链条断裂，从 #1 重来。', 'Rule it a violation: the chain breaks, back to #1.', { hold: 0.3 }],
      ['或者判定允许：但从此以后，同样的情况必须永远允许。', 'Or allow it — but from now on, it is allowed forever.', { hold: 0.7 }],
      ['此刻的你是运动员，未来的你是裁判；两者达成了跨越时间的纳什均衡。', 'You now are the player; you later, the referee. A Nash equilibrium across time.', { hold: 0.4 }],
      ['判例一条条积累，规则的边界慢慢收敛到理性的边界。', 'Ruling by ruling, the rule’s boundary converges on the rational one.', { hold: 1.0 }],
    ],
  },
  {
    id: 'demo-precedent',
    footage: 'precedent',
    pre: 0.5,
    post: 0.5,
    cues: [
      ['Momentum 的例外规则就是你的判例库：暂停时援引一条，它会被永久记录。', 'Exception rules are your casebook: pause by citing one, and it is kept for good.', { hold: 2.4 }],
      ['不愿援引？那就长按中断——链条清零。', 'Won’t cite one? Hold to interrupt — and the chain resets.', { hold: 1.8 }],
    ],
  },
  {
    id: 'delay',
    pre: 0.5,
    post: 0.6,
    cues: [
      ['新的问题来了：座位越神圣，你越不敢坐上去。', 'A new problem: the more sacred the seat, the less you dare to sit.', { hold: 0.4 }],
      ['第三个原理：线性时延。', 'Principle three: Linear Time Delay.', { hold: 0.3 }],
      ['“现在开始吗？”——不。“十五分钟后呢？”——多半会答应。', '“Start now?” — No. “In fifteen minutes?” — Probably, yes.', { hold: 0.3 }],
      ['因为这把 V(τ) 向右平移了十五分钟，移进了 W(τ) 平缓的区域。', 'Because it shifts V(τ) fifteen minutes right — to where W(τ) is flat.', { hold: 1.0 }],
      ['于是建立第二条链：预约链。一个响指，意味着十五分钟内必须坐上神圣座位。', 'So add a second chain. A snap of the fingers means: take the seat within fifteen minutes.', { hold: 0.4 }],
      ['十五分钟后，预约链的价值压缩成一根撞针，刺穿启动的阻力。', 'Fifteen minutes later, its value compresses into a firing pin — and breaks through.', { hold: 1.2 }],
    ],
  },
  {
    id: 'demo-delay',
    footage: 'delay',
    pre: 0.5,
    post: 0.5,
    cues: [
      ['在 Momentum 中点一下“预约”，十五分钟倒计时随即开始。', 'In Momentum, tap “Book” and a fifteen-minute countdown begins.', { hold: 2.2 }],
      ['在倒计时结束前触发神圣座位，预约链 +1。', 'Take the seat before it ends, and the booking chain grows by one.', { hold: 1.8 }],
    ],
  },
  {
    id: 'ctdp',
    pre: 0.5,
    post: 1.0,
    cues: [
      ['非线性压缩 · 判例法约束 · 线性时间平移。', 'Nonlinear compression. Case law. Linear time shift.', { hold: 0.5 }],
      ['合在一起，就是第一代技术：链式时延协议，CTDP。', 'Together: the Chained Time-Delay Protocol — CTDP.', { hold: 0.4 }],
      ['容易开始，容易坚持，长期不失效。', 'Easy to start. Easy to sustain. It does not wear out.', { hold: 0.6 }],
      ['节点还能层层编组：三个单元成一组，三组成一群……像指挥军队一样调度时间。', 'Nodes group into units, groups, clusters — command your hours like an army.', { hold: 1.4 }],
    ],
  },

  // ───────────────────────── III. Scale
  {
    id: 'ch3',
    chapter: { num: 'III', zh: '尺度', en: 'Scale' },
    pre: 3.6,
    post: 0.2,
    cues: [],
  },
  {
    id: 'limits',
    pre: 0.5,
    post: 0.5,
    cues: [
      ['CTDP 曾让作者连续两个月，每天专注八到十小时。', 'CTDP once gave the author two straight months of ten-hour focused days.', { hold: 0.3 }],
      ['可一旦大状态不利——疲惫、闲散、没有目标——它连按下预约的意愿都唤不起来。', 'But when the larger state turned — tired, idle, aimless — he could not even book a session.', { hold: 0.5 }],
      ['问题不在动力，也不在奖惩。问题在“尺度”。', 'The problem was not motivation. It was scale.', { hold: 0.9 }],
    ],
  },
  {
    id: 'tree',
    pre: 0.4,
    post: 0.5,
    cues: [
      ['生活不是一串孤立的决定，而是一棵由无数决策组成的行为树。', 'Life is not a string of isolated decisions. It is a tree of linked choices.', { hold: 0.3 }],
      ['躺上沙发、打开短视频之后，每一个节点都是 99% 对 1%。', 'On the sofa, video playing, every node runs 99% to 1%.', { hold: 0.5 }],
      ['有限自由意志：60 : 40 时意志尚可干预；到了 99 : 1，它几乎无能为力。', 'Bounded free will: at 60 : 40 it can intervene. At 99 : 1 it is nearly powerless.', { hold: 0.5 }],
      ['这样一整段时间，可以“粗粒化”为一个不可逃逸区。', 'Such a stretch can be coarse-grained into one inescapable zone.', { hold: 0.9 }],
    ],
  },
  {
    id: 'rg',
    pre: 0.5,
    post: 0.6,
    cues: [
      ['物理学里，有一个思想专门处理这件事：重整化群。', 'Physics has an idea for exactly this: the renormalization group.', { hold: 0.3 }],
      ['一张棋盘，每格一个箭头，朝上或朝下。', 'A grid of arrows, each pointing up or down.', { hold: 0.6 }],
      ['把相邻的 2×2 合并成一格，少数服从多数。然后，再合并一次。', 'Merge every 2×2 block into one cell, majority rules. Then again.', { hold: 1.8 }],
      ['视角越拉越远，微观的杂乱被平均掉，宏观的结构浮现出来。', 'Zooming out, the noise averages away and structure emerges.', { hold: 1.0 }],
      ['强而短程的力主宰小尺度；弱而长程的力层层累积，最终主宰大尺度。', 'Strong, short-range forces rule small scales; weak, long-range ones accumulate and rule the large.', { hold: 0.6 }],
      ['一个因素有多重要，取决于你在什么尺度上看它。', 'How much a factor matters depends on the scale you view it from.', { hold: 1.0 }],
    ],
  },
  {
    id: 'scales',
    pre: 0.4,
    post: 0.6,
    cues: [
      ['生活也是如此：一分钟有成百上千种过法，一小时只剩几十种，一天十几种。', 'So is life: a minute can go a thousand ways; an hour, dozens; a day, a dozen.', { hold: 0.6 }],
      ['拉到一年，也许只剩下三四种剧本。', 'Across a year, perhaps three or four scripts remain.', { hold: 0.5 }],
      ['每个尺度都被自己的边界条件锁定：睡眠、情绪、作息、环境、身份。', 'Each scale is locked by its own boundary conditions: sleep, mood, routine, place, identity.', { hold: 0.5 }],
      ['我们每一秒都拥有自由意志；可每一天呢？未必。', 'We have free will every second. Every day? Not necessarily.', { hold: 1.2 }],
    ],
  },
  {
    id: 'bottleneck',
    pre: 0.3,
    post: 0.8,
    cues: [
      ['这就是 CTDP 的天花板。', 'This is CTDP’s ceiling.', { hold: 0.2 }],
      ['尺度受限：撬得动一小时，撬不动决定一整天的因素。', 'Limited scale: it moves an hour, not what decides the day.', { hold: 0.3 }],
      ['稳态回落：几小时的高效，终会淹没在原来的稳态里。', 'Relapse: a few good hours sink back into the old steady state.', { hold: 0.3 }],
      ['约束耗散：维持亚稳态要持续消耗资源，而资源终会耗尽。', 'Dissipation: holding a metastable state burns resources, and they run out.', { hold: 1.2 }],
    ],
  },

  // ───────────────────────── IV. RSIP
  {
    id: 'ch4',
    chapter: { num: 'IV', zh: '递归稳态迭代协议', en: 'Recursive Stabilization Iteration Protocol' },
    pre: 3.8,
    post: 0.2,
    cues: [],
  },
  {
    id: 'chess',
    pre: 0.5,
    post: 0.5,
    cues: [
      ['象棋里有个说法：三步杀——进入这个局面，怎么应对都必败。', 'Chess has “mate in three”: reach it, and every reply loses.', { hold: 0.3 }],
      ['但一步一步往回悔棋，总能退到某一步，让胜机重新出现。', 'But take the moves back one by one, and hope always returns somewhere.', { hold: 0.6 }],
      ['不想刷一整晚？那就别在沙发上拿着手机；再往前——别把手机带上沙发。', 'Don’t want to scroll all night? Don’t hold the phone on the sofa. Earlier still: don’t bring it.', { hold: 0.6 }],
      ['越早的节点，选项之间的差距越小。', 'The earlier the node, the narrower the gap.', { hold: 0.4 }],
      ['每一个强大的宏观稳态，都能映射到一个弱小的、仍可干预的节点。', 'Every powerful steady state maps onto a small node you can still change.', { hold: 0.9 }],
    ],
  },
  {
    id: 'policies',
    pre: 0.3,
    post: 0.6,
    cues: [
      ['在这些节点上设计的局部最优解，就像棋手的“定式”——RSIP 称之为“国策”。', 'A best local move at such a node is like a joseki. RSIP calls it a policy.', { hold: 0.3 }],
      ['国策会彼此联动：不在沙发上玩手机，洗澡拖延 81% → 62%，睡前刷手机 95% → 87%。', 'Policies interact: no phone on the sofa, and shower-delay falls from 81% to 62%; bedtime scrolling, 95% to 87%.', { hold: 0.9 }],
      ['每立住一个国策，系统就跃迁到一个稍好的亚稳态：E₀ → E₁ → E₂……', 'Each policy that holds lifts the system to a slightly better state: E₀ → E₁ → E₂…', { hold: 0.7 }],
      ['解决了简单的问题，中等的问题就变简单了。我们始终只解决简单的问题。', 'Solve the easy problems, and the medium ones become easy. We only ever solve easy problems.', { hold: 0.9 }],
    ],
  },
  {
    id: 'backtrack',
    pre: 0.3,
    post: 0.6,
    cues: [
      ['可维护国策也要消耗资源，加入的顺序决定成败。解法是递归回溯：', 'But policies cost upkeep, and order decides everything. The answer: recursive backtracking.', { hold: 0.3 }],
      ['把国策组织成一棵树。每天最多加入一个，挂在某个已有节点之下。', 'Arrange policies as a tree. Add at most one a day, beneath an existing node.', { hold: 1.2 }],
      ['一旦某个国策失败，就删除它——连同它的所有子节点。', 'If a policy fails, delete it — with all of its descendants.', { hold: 1.2 }],
      ['于是，最容易维持的国策沉淀在根部；越靠近根部，失败代价越大，保护得也越好。', 'The easiest policies settle at the root — where failure costs the most, and so they are guarded best.', { hold: 0.4 }],
      ['久而久之，根部的国策内化为习惯，几乎不再消耗资源。', 'In time, root policies harden into habit and cost almost nothing.', { hold: 1.0 }],
    ],
  },
  {
    id: 'demo-rsip',
    footage: 'rsip',
    pre: 0.5,
    post: 0.5,
    cues: [
      ['在 Momentum 中，国策树就是你的 RSIP。', 'In Momentum, the policy tree is your RSIP.', { hold: 2.0 }],
      ['每个国策都会经历 E0 新建、E1 稳定、E2 内化三个阶段。', 'Each policy passes through phases: E0 new, E1 stable, E2 internalised.', { hold: 1.8 }],
      ['标记失败，整棵子树随之回滚；轮次历史记下每一次崩塌的原因。', 'Mark one failed and its subtree rolls back; run history records why.', { hold: 2.4 }],
    ],
  },
  {
    id: 'split',
    pre: 0.4,
    post: 0.6,
    cues: [
      ['好的国策，应当在你最糟糕的一天也能存活。', 'A good policy survives even your worst day.', { hold: 0.3 }],
      ['与其要求“每天 23:30 睡觉”，不如把它拆成五个小国策：', 'Instead of “in bed by 23:30”, split it into five small policies:', { hold: 3.4 }],
      ['从“玩手机”，到“站着玩”，到“站着玩黑白屏”，再到“放下手机”——每一步都很容易。', 'Phone → phone while standing → standing, in greyscale → phone down. Every step is easy.', { hold: 0.6 }],
      ['久攻不下的“城市”就先绕过去；占领足够多的“农村”后，它会变成一层窗户纸。', 'If a city won’t fall, go around it. Take enough villages, and it turns to paper.', { hold: 0.9 }],
    ],
  },
  {
    id: 'rogue',
    pre: 0.3,
    post: 0.8,
    cues: [
      ['崩塌不是失败，而是调试器。习惯的进度条，也不会随之清零。', 'A collapse is not a failure; it is a debugger. And habit progress survives it.', { hold: 0.5 }],
      ['就像 Roguelike：每一轮的死亡，都让下一轮走得更深。', 'Like a roguelike: every death carries you deeper on the next run.', { hold: 0.9 }],
      ['你在和一个更强的对手下棋。但 RSIP 给了你无限次悔棋的权利。', 'You are playing a stronger opponent. But RSIP grants unlimited take-backs.', { hold: 1.4 }],
    ],
  },

  // ───────────────────────── Coda
  {
    id: 'coda',
    pre: 1.2,
    post: 1.0,
    cues: [
      ['自控方法不是灵丹妙药。它只是拐杖——对自制力缺口的代偿。', 'A self-control method is no miracle cure. It is a crutch, compensating for a gap.', { hold: 0.5 }],
      ['人的主观努力，从来不能脱离客观条件而存在。', 'Effort never exists apart from circumstance.', { hold: 0.5 }],
      ['愿我们对条件不如自己的人，多一分尊重和同理心。', 'May we offer more respect and empathy to those whose circumstances are harder.', { hold: 0.7 }],
      ['如果它能帮到哪怕一个人——那就足够了。', 'If this helps even one person, that is enough.', { hold: 1.6 }],
    ],
  },
  {
    id: 'outro',
    footage: 'outro',
    pre: 1.0,
    post: 0.0,
    minDur: 20,
    cues: [
      ['Momentum——把 CTDP 与 RSIP，带进你的每一天。', 'Momentum — CTDP and RSIP, built into every day.', { hold: 3.0 }],
    ],
  },
];

// Reading-time model for bilingual subtitles: whichever line takes longer
// to read sets the pace (about 7.4 hanzi or 16.5 Latin characters a second).
export function cueDuration(zh, en) {
  const zhChars = [...zh].filter((c) => /[㐀-鿿]/.test(c)).length;
  const zhOther = [...zh].filter((c) => !/[㐀-鿿\s]/.test(c)).length;
  const read = Math.max((zhChars + zhOther * 0.35) / 7.4, en.length / 16.5);
  return Math.min(7.2, Math.max(2.0, 0.7 + read));
}

export const CUE_GAP = 0.3;
