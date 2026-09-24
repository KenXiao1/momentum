export type Language = 'en' | 'zh';

const enTranslations = {
  'rsip.splitTemplate.message1': 'Sleep early and wake early',
  'rsip.splitTemplate.message2': 'Sleep before 23:00',
  'rsip.splitTemplate.message3':
    'Start wind-down at 22:45 and be in bed before 23:00.',
  'rsip.splitTemplate.message4': 'No-screen before sleep',
  'rsip.splitTemplate.message5': 'After 22:30, keep phone only for alarm use.',
  'rsip.splitTemplate.message6': 'Stable exercise habit',
  'rsip.splitTemplate.message7': 'Change into workout clothes',
  'rsip.splitTemplate.message8':
    'Change into workout clothes within 10 minutes after getting home.',
  'rsip.splitTemplate.message9': 'Minimum exercise dose',
  'rsip.splitTemplate.message10':
    'Complete at least 10 minutes of walking or stretching daily.',
  'rsip.splitTemplate.message11': 'Diet control',
  'rsip.splitTemplate.message12': 'Prep meals in advance',
  'rsip.splitTemplate.message13':
    'Prepare next-day lunch during weekday evenings.',
  'rsip.splitTemplate.message14': 'Night snack cutoff',
  'rsip.splitTemplate.message15': 'No high-sugar snacks after 21:00.',
  'rsip.interaction.message1':
    'Policy executed. Trigger linked task "{targetChainName}"?',
  'rsip.interaction.message2':
    'Group "{groupTitle}" still has tolerance remaining. This violation will not collapse the whole group.',
  'rsip.interaction.message3':
    'Group "{groupTitle}" has exhausted tolerance. This violation will collapse the group.',
  'rsip.rsipPolicyLibrary.status':
    'Internalization {progress}% · Executed {days} days · Used {times} times',
  'rsip.rsipModeSwitch.mode': 'RSIP mode',
  'rsip.rsipModeSwitch.strictMode': 'Strict mode',
  'rsip.rsipModeSwitch.description':
    'Enable the full Recursive Stabilization and Iteration Protocol: policy execution tracking, stability phase upgrades, constraint visualization, and daily check-in reminders.',
  'rsip.rsipModeSwitch.free': 'Free',
  'rsip.rsipModeSwitch.strict': 'Strict',
  'rsip.rsipPhaseBadge.new': 'E0 New',
  'rsip.rsipPhaseBadge.stable': 'E1 Stable',
  'rsip.rsipPhaseBadge.internalized': 'E2 Internalized',
  'rsip.rsipConstraintIndicator.descendants': '{count} descendants',
  'rsip.rsipConstraintIndicator.failureCost': 'Cost {cost}',
  'rsip.rsipDailyReminder.notOpenedToday':
    'You have not viewed the policy tree today',
  'rsip.rsipDailyReminder.streak': '{days} consecutive check-in days',
  'rsip.rsipDailyReminder.checkInNow': 'Check in now',
  'rsip.rsipPhaseProgress.internalized': 'Internalized',
  'rsip.rsipPhaseProgress.complete': 'Complete',
  'rsip.rsipPhaseProgress.days': '{days}/{threshold} days',
  'rsip.rsipViolationDialog.reinforcementWarning':
    'This node has reinforcement. Violation will remove 1 layer first (+{currentLevel} -> +{nextLevel}).',
  'rsip.rsipViolationDialog.removalWarning':
    'This will remove {count} node(s), including descendants.',
  'rsip.rsipRunHistory.collapseNodeTitle': ' ({title})',
  'rsip.rsipRunHistory.durationDays': '{days} days',
  'rsip.rsipRunHistory.runNumber': 'Run #{number}',
  'rsip.rsipRunHistory.runSummary': 'Duration {days} days · Peak nodes {count}',
  'rsip.rsipStrictModeCard.reinforce': 'Reinforce +1',
  'rsip.rsipStrictModeCard.executed': 'Executed',
  'rsip.rsipStrictModeCard.violated': 'Violated',
  'errors.detail.databaseReadOnly':
    'The database is read-only and rejected the write (possibly due to Supabase quota, disk space, or project status). Check usage and project status in the Supabase Dashboard.',
  'errors.detail.network':
    'Network error: unable to connect to Supabase. Check your connection or try again later.',
  'errors.detail.auth':
    'Your login session is invalid or expired. Sign in again and retry.',
  'errors.detail.rls':
    'Permission denied by RLS. Ensure you are signed in and that the Supabase RLS policy permits this operation.',
  'errors.detail.timeLimitRequired':
    'Task group could not be saved: a time limit (timeLimitHours) is required. You can use the default of 24 hours.',
  'errors.detail.timeLimitPositive':
    'Task group could not be saved: the time limit must be positive (1–168 hours recommended).',
  'errors.detail.rateLimited':
    'Too many requests (429). Please try again later.',
  'errors.detail.projectPaused':
    'The Supabase project may be paused or waking up. Wait a moment and try again.',
  'errors.detail.code': 'Error code: {code}',

  'rsipInsights.recommendations.grouping.title':
    'Create policy groups with fault tolerance',
  'rsipInsights.recommendations.grouping.rationale':
    'Many independent nodes without grouping make cascade risk harder to control.',
  'rsipInsights.recommendations.grouping.createGroups':
    'Create 1-2 policy groups for related branches.',
  'rsipInsights.recommendations.grouping.faultTolerance':
    'Start with fault tolerance = 1 for each group.',
  'rsipInsights.recommendations.grouping.relatedNodes':
    'Move high-correlation nodes into the same group.',
  'rsipInsights.recommendations.reinforcement.title':
    'Reinforce stable E2 nodes',
  'rsipInsights.recommendations.reinforcement.rationale':
    'Stable nodes without reinforcement can improve rollback resilience with small extra effort.',
  'rsipInsights.recommendations.reinforcement.prioritizeNodes':
    'Reinforce these nodes first: {nodes}',
  'rsipInsights.recommendations.reinforcement.weeklyLevel':
    'Increase one reinforcement level per successful week.',
  'rsipInsights.recommendations.passive.title': 'Add passive guardrails',
  'rsipInsights.recommendations.passive.rationale':
    'Passive policy coverage is low while recent violations exist. Environment guardrails can reduce friction.',
  'rsipInsights.recommendations.passive.unstableBranches':
    'Add at least one passive policy for each unstable branch.',
  'rsipInsights.recommendations.passive.preferAutomation':
    'Prefer automation/environment changes over willpower-heavy actions.',
  'rsipInsights.recommendations.passive.markNodes':
    'Mark passive nodes explicitly for tracking.',
  'rsipInsights.recommendations.automation.title':
    'Enable RSIP-task process links',
  'rsipInsights.recommendations.automation.rationale':
    'No active links detected. Event-driven synchronization improves consistency and execution speed.',
  'rsipInsights.recommendations.automation.startWithTaskCompleted':
    'Start with task_completed -> mark_rsip_executed.',
  'rsipInsights.recommendations.automation.addPromptStartChain':
    'Add rsip_mark_executed -> prompt_start_chain for key tasks.',
  'rsipInsights.recommendations.automation.keepConfirmMode':
    'Keep RSIP->task side in confirm mode initially.',
  'rsipInsights.recommendations.rebuild.title': 'Use library-assisted rebuild',
  'rsipInsights.recommendations.rebuild.rationale':
    'Run trends are declining. Reintroduce proven policies from library instead of adding only new ones.',
  'rsipInsights.recommendations.rebuild.restoreLibraryEntries':
    'Restore 1-2 high-internalization entries from policy library.',
  'rsipInsights.recommendations.rebuild.limitNewHighRiskPolicies':
    'Avoid introducing more than one new high-risk policy this week.',
  'rsipInsights.recommendations.fallback.sleep':
    'Fallback: lock wake-up time first, then shift bedtime.',
  'rsipInsights.recommendations.fallback.exercise':
    'Fallback: use a 5-minute minimum exercise version.',
  'rsipInsights.recommendations.fallback.diet':
    'Fallback: replace one high-sugar item per day.',
  'rsipInsights.recommendations.fallback.default':
    'Fallback: reduce to a 10-minute version for 7 days.',
  'rsipInsights.recommendations.ruralFirst.title':
    'Rural-first reboot: stabilize low-cost policies first',
  'rsipInsights.recommendations.ruralFirst.rationale':
    'Recent violations/collapses suggest central high-cost nodes are unstable. Rebuild from low-cost, high-success edge policies.',
  'rsipInsights.recommendations.ruralFirst.freezeNodes':
    'Temporarily freeze high-risk nodes: {nodes}',
  'rsipInsights.recommendations.ruralFirst.freezeUnstablePolicy':
    'Freeze one unstable central policy for 3-7 days.',
  'rsipInsights.recommendations.ruralFirst.prioritizeCandidates':
    'Prioritize these low-cost candidates: {nodes}',
  'rsipInsights.recommendations.ruralFirst.promoteLowCostPolicies':
    'Promote 2-3 low-cost policies with failure cost <= 2.5.',
  'rsipInsights.recommendations.split.title': 'Split high-risk policy: {title}',
  'rsipInsights.recommendations.split.rationale':
    'High failure cost combined with frequent violations indicates this policy is oversized.',
  'rsipInsights.recommendations.split.microPolicies':
    'Use split workflow to break into 3-5 micro policies.',
  'rsipInsights.recommendations.split.passiveGuardrail':
    'Ensure at least one passive guardrail is included.',
  'rsipInsights.recommendations.split.executionTime':
    'Keep each sub-policy executable within 10-20 minutes.',
  'rsipInsights.listSeparator': ', ',
  'chainEditor.presets.trigger.headphones':
    'Put on noise-cancelling headphones',
  'chainEditor.presets.trigger.ide': 'Open your IDE',
  'chainEditor.presets.trigger.desk': 'Sit at your desk',
  'chainEditor.presets.trigger.workoutClothes': 'Put on workout clothes',
  'chainEditor.presets.trigger.coffee': 'Make a cup of coffee',
  'chainEditor.presets.trigger.custom': 'Custom trigger',
  'chainEditor.presets.signal.snapFingers': 'Snap your fingers',
  'chainEditor.presets.signal.phoneAlarm': 'Set a phone alarm',
  'chainEditor.presets.signal.deskBell': 'Ring the desk bell',
  'chainEditor.presets.signal.startBooking': 'Say “Start booking”',
  'chainEditor.presets.signal.custom': 'Custom signal',
  'chainEditor.presets.trigger.taskGroupContainer': 'Task group container',
  'chainEditor.presets.trigger.firstSubtask': 'Start the first subtask',
  'chainTree.types.unit': 'Unit',
  'chainTree.types.group': 'Group',
  'chainTree.types.assault': 'Assault',
  'chainTree.types.recon': 'Recon',
  'chainTree.types.command': 'Command',
  'chainTree.types.special_ops': 'Special ops',
  'chainTree.types.engineering': 'Engineering',
  'chainTree.types.quartermaster': 'Quartermaster',
  'intro.nav.signIn': 'Sign In',
  'intro.nav.signUp': 'Sign Up',
  'intro.nav.startJourney': 'Start Journey',
  'intro.nav.startJourneySubtext': 'Open-source on GitHub. Free to use.',
  'intro.hero.tag': 'MOMENTUM v2.0',
  'intro.hero.titleline1': 'Master Your',
  'intro.hero.titleline2': 'Focus Protocol',
  'intro.hero.desc':
    'The mathematical solution to self-control. Solving procrastination through the CTDP scientific model.',
  'intro.theory.title': 'Theoretical Basis',
  'intro.theory.desc': 'Mathematical framework for behavioral economics.',
  'intro.theory.modelTitle': 'The Integral Model',
  'intro.theory.insightTitle': 'Key Insight',
  'intro.theory.insightDesc':
    'The brain rewards short-term dopamine. We fix the weight function W(τ) to prioritize long-term value.',
  'intro.theory.valueFunc.title': 'Value V(τ)',
  'intro.theory.valueFunc.desc': 'Future value estimation',
  'intro.theory.weightFunc.title': 'Weight W(τ)',
  'intro.theory.weightFunc.desc': 'Time preference discounting',
  'intro.theory.cards.social.title': 'Distraction',
  'intro.theory.cards.social.desc': 'High Impulse, Net Negative',
  'intro.theory.cards.work.title': 'Deep Work',
  'intro.theory.cards.work.desc': 'Low Impulse, Net Positive',
  'intro.principles.title': 'Core Principles',
  'intro.principles.list.0.title': 'SACRED SEAT',
  'intro.principles.list.0.desc': 'Value Compression',
  'intro.principles.list.0.detail':
    "Bind the entire chain's value to a single trigger action.",
  'intro.principles.list.1.title': 'PRECEDENT LAW',
  'intro.principles.list.1.desc': 'Binary Constraints',
  'intro.principles.list.1.detail':
    'Zero tolerance for broken windows. Reset or Allow.',
  'intro.principles.list.2.title': 'TIME DELAY',
  'intro.principles.list.2.desc': 'Resistance Shifting',
  'intro.principles.list.2.detail':
    'Use 15-min buffers to bypass startup inertia.',
  'intro.features.title': 'System Modules',
  'intro.features.desc': 'Engineered for flow state.',
  'intro.features.list.0.title': 'Chain Mgmt',
  'intro.features.list.0.desc': 'Independent execution threads.',
  'intro.features.list.1.title': 'Reservation',
  'intro.features.list.1.desc': 'Startup inertia buffer.',
  'intro.features.list.2.title': 'Adjudication',
  'intro.features.list.2.desc': 'Strict logic enforcement.',
  'intro.features.list.3.title': 'Analytics',
  'intro.features.list.3.desc': 'Visualized progression.',
  'intro.benefits.title': 'Why Momentum',
  'intro.benefits.list.0.title': 'Scientific',
  'intro.benefits.list.0.desc': 'Math-proven models.',
  'intro.benefits.list.1.title': 'Instant',
  'intro.benefits.list.1.desc': 'Zero adaptation time.',
  'intro.benefits.list.2.title': 'Durable',
  'intro.benefits.list.2.desc': 'Anti-fragile design.',
  'intro.openProject': 'Open project on GitHub',
  'intro.features.heading': 'Engineered for Flow State',
  'intro.localMode': 'Switch to local mode',
  'intro.scrollDown': 'Scroll down',
  'intro.theory.heading': 'Re-engineering Willpower',
  'intro.principles.heading': 'The Trinity',
  'intro.illustration.title': 'Proof, not vibes.',
  'intro.illustration.diagramAlt': 'CTDP integral model diagram',
  'time.hoursMinutes': '{hours}h {minutes}m',
  'time.hours': '{hours}h',
  'time.minutes': '{minutes}m',
  'time.minutesSeconds': '{minutes}m {seconds}s',
  'time.seconds': '{seconds}s',
  'time.lessThanMinute': 'less than 1 minute',
  'time.spent': 'Time spent: {duration}',
  'time.last': 'Last time: {duration}',
  'time.first': 'First time',
  'time.expired': 'Expired',
  'time.unlimited': 'No time limit',
  'time.noFixedDuration': 'No fixed duration',
  'time.minimumDuration': '{label} (minimum {minimum})',
  'time.dayAgo': '{count} day ago',
  'time.daysAgo': '{count} days ago',
  'time.hourAgo': '{count} hour ago',
  'time.hoursAgo': '{count} hours ago',
  'pet.stage.egg': 'Egg',
  'pet.stage.baby': 'Baby',
  'pet.stage.child': 'Child',
  'pet.stage.teen': 'Teen',
  'pet.stage.adult': 'Adult',
  'pet.stage.elder': 'Elder',
  'pet.stats.fullness': 'Fullness',
  'pet.stats.happiness': 'Happiness',
  'pet.stats.health': 'Health',
  'rsip.type.policy': 'Policy',
  'rsip.type.habit': 'Habit',
  'rsip.type.reward': 'Reward',
  'rsip.type.penalty': 'Penalty',
  'rsip.type.ritual': 'Ritual',
  'rsip.type.goal': 'Goal',
  'rsip.type.trigger': 'Trigger',
  'rsip.type.reminder': 'Reminder',
  'duplication.nameSuffix.new': 'New',
  'duplication.nameSuffix.spare': 'Spare',
  'duplication.nameSuffix.temp': 'Temp',
  'duplication.nameSuffix.special': 'Special',
  'counts.completion': '{count} completion',
  'counts.completions': '{count} completions',
  'counts.ruleAvailable': '{count} available rule',
  'counts.rulesAvailable': '{count} available rules',
  'counts.recycleItem': 'RECYCLE BIN • {count} ITEM',
  'counts.recycleItems': 'RECYCLE BIN • {count} ITEMS',
  'counts.ruleUsedOnce': 'Used {count} time',
  'counts.ruleUsedMany': 'Used {count} times',
  'counts.rulePreviouslyUsedOnce': 'Used {count} time',
  'counts.rulePreviouslyUsedMany': 'Used {count} times',
  'counts.entries': '{count}',
  'dashboard.hero.protocolDescription':
    'Built on the Chained Time-Delay Protocol (CTDP), using {sacredSeat}, {precedent}, and {timeDelay} to help you build powerful habit chains.',
  'dashboard.hero.sacredSeat': 'the Sacred Seat Principle',
  'dashboard.hero.precedent': 'the Precedent Principle',
  'dashboard.hero.timeDelay': 'the Linear Time-Delay Principle',
  'export.chainCountOne': 'You have {count} chain',
  'export.chainCountMany': 'You have {count} chains',
  'sessions.pauseResume.saveFailed':
    'Pause or resume was not saved. Please try again.',
  'chainEditor.description.title': 'Task description',
  'chainEditor.description.hint':
    'Describe what you will do and what success looks like',
  'chainEditor.description.placeholder':
    'What exactly will you do? e.g. Finish Part 1 of CS61A',
  'common.loading': 'Loading…',
  'common.back': 'Back',
  'chainEditor.editTitle': 'Edit chain',
  'chainEditor.createTitle': 'Create a new chain',
  'chainEditor.editSubtitle': 'EDIT CHAIN',
  'chainEditor.createSubtitle': 'CREATE CHAIN',
  'language.english': 'English',
  'language.chinese': 'Chinese',
  'settings.diagnostics.title': 'Local diagnostics',
  'settings.diagnostics.description':
    'Up to 200 error categories and timing measurements from the last 7 days stay on this device. No account details, task content, URLs, or raw errors are included. Nothing is sent automatically.',
  'settings.diagnostics.export': 'Export diagnostics',
  'settings.diagnostics.clear': 'Clear diagnostics',
  'settings.diagnostics.saved': 'Diagnostics exported.',
  'settings.diagnostics.failed': 'Export failed. Please try again.',
  'settings.diagnostics.cleared': 'Diagnostics cleared.',
  'settings.title': 'Personal Settings',
  'settings.button': 'Settings',
  'settings.language.title': 'Language',
  'settings.language.description': 'Choose the display language',
  'dashboard.hero.nextStep': 'Choose a chain and begin',
  'app.appShell.appShellView.initializing': 'Initializing…',
  'app.appShell.appShellView.initializingApplication':
    'INITIALIZING APPLICATION',
  'app.appShell.appShellView.skipToMainContent': 'Skip to main content',
  'app.appShell.appShellView.unknownTask': 'Unknown Task',
  'accountModal.usingLocalStorageNoAccountRequired':
    'Using local storage - no account required.',
  'accountModal.loadingAccount': 'Loading account...',
  'accountModal.retryLoadingUserInfo': 'Retry loading user info',
  'accountModal.retry': 'Retry',
  'accountModal.userInfoNotFound': 'User info not found',
  'accountModal.close': 'Close',
  'authForm.accountCreatedPleaseCheckYourEmailToConfirm':
    'Account created! Please check your email to confirm.',
  'authForm.signUpFailedCheckTheConsoleForDetailsThen':
    'Sign up failed. Check the console for details, then try again.',
  'authForm.signInFailedCheckTheConsoleForDetailsThen':
    'Sign in failed. Check the console for details, then try again.',
  'authForm.anUnexpectedErrorOccurredCheckTheConsoleForDetails':
    'An unexpected error occurred. Check the console for details.',
  'authForm.goBack': 'Go back',
  'authForm.createAccount': 'Create Account',
  'authForm.welcomeBack': 'Welcome Back',
  'authForm.startYourJourneyToMastery': 'Start your journey to mastery',
  'authForm.enterYourCredentialsToContinue':
    'Enter your credentials to continue',
  'authForm.email': 'Email',
  'authForm.enterYourEmail': 'Enter your email',
  'authForm.password': 'Password',
  'authForm.enterYourPassword': 'Enter your password',
  'authForm.hidePassword': 'Hide password',
  'authForm.showPassword': 'Show password',
  'authForm.signIn': 'Sign In',
  'authForm.alreadyHaveAnAccount': 'Already have an account?',
  'authForm.donTHaveAnAccount': "Don't have an account?",
  'authForm.switchToSignIn': 'Switch to sign in',
  'authForm.switchToSignUp': 'Switch to sign up',
  'authForm.signUp': 'Sign Up',
  'authForm.switchToLocalMode': 'Switch to local mode',
  'authWrapper.authenticating': 'Authenticating…',
  'authWrapper.authenticatingVariant2': 'AUTHENTICATING',
  'auxiliaryJudgment.bookingRuleAdjudication': 'Booking rule adjudication',
  'auxiliaryJudgment.bookingRuleAdjudicationVariant2':
    'BOOKING RULE ADJUDICATION',
  'auxiliaryJudgment.itLooksLikeYourBehaviorDidNotMatchTheBooking':
    'It looks like your behavior didn’t match the booking commitment. Please describe what happened and choose how to handle it:',
  'auxiliaryJudgment.signal': 'Signal',
  'auxiliaryJudgment.completion': 'Completion',
  'auxiliaryJudgment.duration': 'Duration',
  'auxiliaryJudgment.chainAuxiliaryDurationMin': '{chainAuxiliaryDuration} min',
  'auxiliaryJudgment.userInterruptedBooking': 'User interrupted booking',
  'chunkLoadErrorBoundary.theAppWasUpdatedPleaseReload':
    'The app was updated. Please reload.',
  'chunkLoadErrorBoundary.theAppHitAnErrorPleaseReload':
    'The app hit an error. Please reload.',
  'chunkLoadErrorBoundary.aVersionMismatchWasDetectedThisUsuallyHappensAfter':
    'A version mismatch was detected. This usually happens after a deployment.',
  'chunkLoadErrorBoundary.theCurrentViewCannotContinueRenderingReloadUsuallyRecovers':
    'The current view cannot continue rendering. Reload usually recovers.',
  'chunkLoadErrorBoundary.reloadApp': 'Reload app',
  'dailyCheckin.loadingCheckInData': 'Loading check-in data...',
  'dailyCheckin.dailyCheckInUnavailable': 'Daily check-in unavailable',
  'dailyCheckin.toggleCheckIn': 'Toggle check-in',
  'dailyCheckin.dailyCheckIn': 'Daily Check-in',
  'dailyCheckin.refresh': 'Refresh',
  'dailyCheckin.checkInNow': 'Check in now',
  'dailyCheckin.checkingIn': 'Checking in...',
  'dailyCheckin.bestStreak': 'Best streak:',
  'dailyCheckin.days': 'days',
  'dailyCheckinDemo.demoMode': '🚀 Demo mode',
  'dailyCheckinDemo.dailyCheckIn10Points': 'Daily check-in +10 points',
  'dailyCheckinDemo.checkInDailyToEarn10PointsStreaksEarn':
    'Check in daily to earn 10 points. Streaks earn more rewards.',
  'dailyCheckinDemo.demoNotes': 'Demo notes',
  'dailyCheckinDemo.thisIsADemoVersionOfDailyCheckInTo':
    'This is a demo version of Daily Check-in. To use the real feature, configure Supabase env vars and run the database migrations. Once configured, this demo will be replaced automatically.',
  'deletedChainCard.currentStreak': 'CURRENT STREAK',
  'deletedChainCard.totalCompletions': 'TOTAL COMPLETIONS',
  'deletedChainCard.deleted': 'Deleted',
  'deletedChainCard.automaticallyDeletedAfter30Days':
    'Automatically deleted after 30 days',
  'deletedChainCard.restore': 'Restore',
  'deletedChainCard.delete': 'Delete',
  'importExportModalView.dataManagement': 'Data management',
  'importExportModalView.dataManagementVariant2': 'DATA MANAGEMENT',
  'importExportModalView.export': 'Export',
  'importExportModalView.import': 'Import',
  'importExportModalView.useSystemFilePicker': 'Use system file picker',
  'importUnitsModal.copy': 'Copy',
  'importUnitsModal.move': 'Move',
  'notificationToggle.systemNotifications': 'System notifications',
  'notificationToggle.toggleSystemNotifications': 'Toggle system notifications',
  'rsipView.rsipPolicyTree': 'RSIP Policy Tree',
  'rsipView.rsipProcessCollaboration': 'RSIP PROCESS COLLABORATION',
  'rsipView.tree': 'Tree',
  'rsipView.library': 'Library',
  'rsipView.runs': 'Runs',
  'rsipView.insights': 'Insights',
  'ruleItem.pauseOnly': 'Pause only',
  'ruleItem.earlyCompletionOnly': 'Early completion only',
  'ruleItem.neverUsed': 'Never used',
  'ruleItem.today': 'Today',
  'ruleItem.yesterday': 'Yesterday',
  'ruleSelectionDialog.failedToSelectRule': 'Failed to select rule',
  'ruleSelectionDialog.ruleNameCleanNameAlreadyExists':
    'Rule name "{cleanName}" already exists',
  'ruleSelectionDialog.failedToCreateRule': 'Failed to create rule',
  'themeToggle.toggleTheme': 'Toggle theme',
  'virtualizedChainList.taskChainsList': 'Task chains list',
  'accountModal.accountModalStorageSection.dataMode': 'Data mode',
  'accountModal.accountModalStorageSection.localModeWorksOfflineCloudModeEnablesSignInAnd':
    'Local mode works offline; cloud mode enables sign-in and multi-device sync',
  'accountModal.accountModalStorageSection.localMode': 'Local mode',
  'accountModal.accountModalStorageSection.cloudMode': 'Cloud mode',
  'accountModal.accountModalStorageSection.supabaseIsNotConfiguredSoOnlyLocalModeIs':
    'Supabase is not configured, so only local mode is available.',
  'accountModal.accountModalUserContent.account': 'Account',
  'accountModal.accountModalUserContent.created': 'Created',
  'accountModal.accountModalUserContent.lastSignIn': 'Last sign in',
  'accountModal.accountModalUserContent.firstSignIn': 'First sign in',
  'accountModal.accountModalUserContent.gamblingMode': 'Gambling mode',
  'accountModal.accountModalUserContent.betPointsOnTasksForExtraRewards':
    'Bet points on tasks for extra rewards',
  'accountModal.accountModalUserContent.toggleGamblingMode':
    'Toggle gambling mode',
  'accountModal.accountModalUserContent.enabledYouCanBetWhenStartingATask':
    'Enabled — you can bet when starting a task',
  'accountModal.accountModalUserContent.disabledBettingIsUnavailable':
    'Disabled — betting is unavailable',
  'accountModal.accountModalUserContent.dismissError': 'Dismiss error',
  'accountModal.accountModalUserContent.signOut': 'Sign out',
  'accountModal.accountModalUserContent.signingOut': 'Signing out...',
  'accountModal.useAccountModalController.failedToLoadUserInfoCheckTheConsoleFor':
    'Failed to load user info. Check the console for details, then try again.',
  'accountModal.useAccountModalController.failedToLoadUserInfo':
    'Failed to load user info',
  'accountModal.useAccountModalController.failedToLoadSettingsCheckTheConsoleForDetails':
    'Failed to load settings. Check the console for details, then try again.',
  'accountModal.useAccountModalController.failedToLoadSettings':
    'Failed to load settings',
  'accountModal.useAccountModalController.gamblingModeEnabled':
    'Gambling mode enabled',
  'accountModal.useAccountModalController.gamblingModeDisabled':
    'Gambling mode disabled',
  'accountModal.useAccountModalController.failedToUpdateSettingsCheckTheConsoleForDetails':
    'Failed to update settings. Check the console for details, then try again.',
  'accountModal.useAccountModalController.signOutFailedCheckTheConsoleForDetailsThen':
    'Sign out failed. Check the console for details, then try again.',
  'accountModal.useAccountModalController.signOutFailedPleaseTryAgain':
    'Sign out failed. Please try again.',
  'auxiliaryJudgment.auxiliaryJudgmentActions.markAsFailed': 'Mark as failed',
  'auxiliaryJudgment.auxiliaryJudgmentActions.allowPrecedent':
    'Allow (Precedent)',
  'auxiliaryJudgment.auxiliaryJudgmentActions.thisBehaviorIsAllowedUnderAnExistingRule':
    'This behavior is allowed under an existing rule',
  'auxiliaryJudgment.auxiliaryJudgmentActions.thisWillBeSavedAsANewExceptionFor':
    'This will be saved as a new exception for future bookings',
  'auxiliaryJudgment.auxiliaryJudgmentActions.cancelContinueBooking':
    'Cancel — continue booking',
  'auxiliaryJudgment.auxiliaryJudgmentActions.currentBookingExceptions':
    'Current booking exceptions:',
  'auxiliaryJudgment.auxiliaryRuleChoice.useAnExistingException':
    'Use an existing exception',
  'auxiliaryJudgment.auxiliaryRuleChoice.addANewException':
    'Add a new exception',
  'auxiliaryJudgment.auxiliaryRuleChoice.chooseAnApplicableException':
    'Choose an applicable exception:',
  'auxiliaryJudgment.auxiliaryRuleChoice.thisBehaviorIsAllowedYouMayEndTheBooking':
    'This behavior is allowed; you may end the booking.',
  'auxiliaryJudgment.auxiliaryRuleChoice.describeWhatHappened':
    'Describe what happened:',
  'auxiliaryJudgment.auxiliaryRuleChoice.eGForgotTheBookingGotInterruptedByAnUrgent':
    'e.g. Forgot the booking, got interrupted by an urgent issue, felt unwell, had a sudden schedule change, etc.',
  'auxiliaryJudgment.auxiliaryRuleChoice.thisRuleAlreadyExistsConsiderChoosingUseAn':
    '⚠️ This rule already exists. Consider choosing “Use an existing exception”.',
  'bettingModal.bettingFormSections.chain': 'Chain',
  'bettingModal.bettingFormSections.duration': 'Duration',
  'bettingModal.bettingFormSections.taskDurationMin': '{taskDuration} min',
  'bettingModal.bettingFormSections.available': 'Available',
  'bettingModal.bettingFormSections.betToday': 'Bet today',
  'bettingModal.bettingFormSections.betAmount': 'Bet amount',
  'bettingModal.bettingFormSections.enterPointsToBet': 'Enter points to bet',
  'bettingModal.bettingFormSections.quickBetAmountPoints':
    'Quick bet {amount} points',
  'bettingModal.bettingFormSections.betAllAvailablePointsPoints':
    'Bet all {availablePoints} points',
  'bettingModal.bettingFormSections.all': 'All',
  'bettingModal.bettingFormSections.rules': 'Rules',
  'bettingModal.bettingFormSections.ifCompleted11PayoutDoubleReturn':
    '• If completed: 1:1 payout (double return)',
  'bettingModal.bettingFormSections.ifFailedLoseTheBet':
    '• If failed: lose the bet',
  'bettingModal.bettingFormSections.onlyOneBetPerSession':
    '• Only one bet per session',
  'bettingModal.bettingFormSections.placingBet': 'Placing bet...',
  'bettingModal.bettingFormSections.notEnoughPoints': 'Not enough points',
  'bettingModal.bettingFormSections.confirmBet': 'Confirm bet',
  'bettingModal.bettingFormSections.cancelBet': 'Cancel bet',
  'bettingModal.bettingFormSections.cancel': 'Cancel',
  'bettingModal.bettingHeader.taskBet': 'Task bet',
  'bettingModal.bettingStates.loadingBettingData': 'Loading betting data...',
  'bettingModal.bettingStates.reloadData': 'Reload data',
  'bettingModal.bettingStates.reload': 'Reload',
  'bettingModal.bettingStates.betPlaced': 'Bet placed!',
  'bettingModal.betPlacementRules.enterABetAmount': 'Enter a bet amount',
  'bettingModal.betPlacementRules.enterAValidBetAmount':
    'Enter a valid bet amount',
  'bettingModal.betPlacementRules.betAmountMustBeAnInteger':
    'Bet amount must be an integer',
  'bettingModal.betPlacementRules.betAmountMustBeGreaterThan0':
    'Bet amount must be greater than 0',
  'bettingModal.betPlacementRules.notEnoughPointsAvailableAvailablePoints':
    'Not enough points. Available: {availablePoints}',
  'bettingModal.betPlacementRules.exceedsMaxSingleBetSettingsMaxSingleBet':
    'Exceeds max single bet: {settingsMaxSingleBet}',
  'bettingModal.betPlacementRules.exceedsDailyLimitSettingsDailyBetLimitUsedTodayTodayBetAmount':
    'Exceeds daily limit: {settingsDailyBetLimit} (used today: {todayBetAmount})',
  'bettingModal.useBetPlacementForm.bettingIsNotSupportedForTheCurrentStorage':
    'Betting is not supported for the current storage',
  'bettingModal.useBetPlacementForm.betFailed': 'Bet failed',
  'bettingModal.useBetPlacementForm.betFailedCheckTheConsoleForDetailsThenTry':
    'Bet failed. Check the console for details, then try again.',
  'bettingModal.useBettingModalData.failedToLoadDataCheckTheConsoleForDetails':
    'Failed to load data. Check the console for details, then try again.',
  'chainCard.chainCardView.viewDetailsChainName': 'View details: {chainName}',
  'chainCard.chainCardView.moreOptions': 'More options',
  'chainCard.chainCardView.deleteChain': 'Delete chain',
  'chainCard.chainCardView.signal': 'Signal: ',
  'chainCard.chainCardView.completeBeforeTimeRunsOut':
    'Complete before time runs out: ',
  'chainCard.chainCardView.completeBooking': 'Complete booking',
  'chainCard.chainCardView.interruptAdjudicate': 'Interrupt / Adjudicate',
  'chainCard.chainCardView.start': 'Start',
  'chainCard.chainCardView.schedule': 'Schedule',
  'chainCard.chainCardMetrics.firstTime': 'First time',
  'chainCard.chainCardMetrics.last': 'Last: ',
  'chainCard.chainCardMetrics.startFirstChain': 'Start first chain',
  'chainCard.chainCardMetrics.mainStreak': 'Main streak',
  'chainCard.chainCardMetrics.noBookingsYet': 'No bookings yet',
  'chainCard.chainCardMetrics.bookingStreak': 'Booking streak',
  'chainCard.chainDeleteConfirmModal.deleteChain': 'Delete chain?',
  'chainCard.chainDeleteConfirmModal.areYouSureYouWantToDeleteTheChain':
    'Are you sure you want to delete the chain "',
  'chainCard.chainDeleteConfirmModal.label': '"?',
  'chainCard.chainDeleteConfirmModal.thisWillPermanentlyDelete':
    'This will permanently delete:',
  'chainCard.chainDeleteConfirmModal.mainChain': 'Main chain',
  'chainCard.chainDeleteConfirmModal.streak': 'Streak: ',
  'chainCard.chainDeleteConfirmModal.completions': 'Completions: ',
  'chainCard.chainDeleteConfirmModal.failures': 'Failures: ',
  'chainCard.chainDeleteConfirmModal.booking': 'Booking',
  'chainCard.chainDeleteConfirmModal.exceptions': 'Exceptions: ',
  'chainCard.chainDeleteConfirmModal.history': 'History',
  'chainCard.chainDeleteConfirmModal.successRate': 'Success rate: ',
  'chainCard.chainDeleteConfirmModal.rules': 'Rules',
  'chainCard.chainDeleteConfirmModal.bookingExceptions': 'Booking exceptions: ',
  'chainCard.chainDeleteConfirmModal.allSettings': 'All settings',
  'chainCard.chainDeleteConfirmModal.cancel': 'Cancel',
  'chainCard.chainDeleteConfirmModal.delete': 'Delete',
  'chainCard.useChainCard.minutesMin': '{minutes} min',
  'chainDetail.chainDetailDescription.taskDescription': 'TASK DESCRIPTION',
  'chainDetail.chainDetailExceptions.ruleHandbook': 'Rule handbook',
  'chainDetail.chainDetailExceptions.ruleHandbookVariant2': 'RULE HANDBOOK',
  'chainDetail.chainDetailExceptions.mainChainExceptions':
    'Main chain exceptions:',
  'chainDetail.chainDetailExceptions.bookingExceptions': 'Booking exceptions:',
  'chainDetail.chainDetailHeader.chainDetails': 'CHAIN DETAILS',
  'chainDetail.chainDetailHeader.edit': 'Edit',
  'chainDetail.chainDetailHistory.noCompletionRecordsYet':
    'No completion records yet',
  'chainDetail.chainDetailHistory.noCompletionRecordsYetVariant2':
    'NO COMPLETION RECORDS YET',
  'chainDetail.chainDetailHistory.completed': 'Completed',
  'chainDetail.chainDetailHistory.failed': 'Failed',
  'chainDetail.chainDetailHistory.notes': 'Notes',
  'chainDetail.chainDetailHistory.recentHistory': 'Recent history',
  'chainDetail.chainDetailHistory.recentHistoryVariant2': 'RECENT HISTORY',
  'chainDetail.chainDetailStats.mainStreak': 'Main streak',
  'chainDetail.chainDetailStats.bookingStreak': 'Booking streak',
  'chainDetail.chainDetailStats.trigger': 'Trigger',
  'chainDetail.chainDetailStats.duration': 'Duration',
  'chainDetail.chainDetailStats.totalCompletions': 'Total completions',
  'chainDetail.chainDetailStats.failures': 'Failures',
  'chainDetail.chainDetailStats.bookingFailures': 'Booking failures',
  'chainDetail.chainDetailStats.bookingSignal': 'Booking signal',
  'chainDetail.chainDetailStats.bookingDuration': 'Booking duration',
  'chainDetail.chainDetailStats.bookingCompletionTrigger':
    'Booking completion trigger',
  'chainDetail.chainDetailStats.successRate': 'Success rate',
  'chainDetail.deleteConfirmModal.theChainWillMoveToTheRecycleBinThese':
    'The chain will move to the recycle bin. These data will be kept and can be restored within 30 days:',
  'chainDetail.deleteConfirmModal.mainChain': 'Main chain',
  'chainDetail.deleteConfirmModal.streak': 'Streak: ',
  'chainDetail.deleteConfirmModal.completions': 'Completions: ',
  'chainDetail.deleteConfirmModal.failures': 'Failures: ',
  'chainDetail.deleteConfirmModal.booking': 'Booking',
  'chainDetail.deleteConfirmModal.exceptions': 'Exceptions: ',
  'chainDetail.deleteConfirmModal.history': 'History',
  'chainDetail.deleteConfirmModal.records': 'Records: ',
  'chainDetail.deleteConfirmModal.successRate': 'Success rate: ',
  'chainDetail.deleteConfirmModal.timeStats': 'Time stats',
  'chainDetail.deleteConfirmModal.rules': 'Rules',
  'chainDetail.deleteConfirmModal.bookingExceptions': 'Booking exceptions: ',
  'chainDetail.deleteConfirmModal.allSettings': 'All settings',
  'chainDetail.deleteConfirmModal.deleteChain': 'Delete chain?',
  'chainDetail.deleteConfirmModal.areYouSureYouWantToDeleteTheChain':
    'Are you sure you want to delete the chain "',
  'chainDetail.deleteConfirmModal.label': '"?',
  'chainDetail.deleteConfirmModal.delete': 'Delete',
  'chainEditor.chainEditorActions.createCopy': 'Create copy',
  'chainEditor.chainEditorActions.saveChanges': 'Save changes',
  'chainEditor.chainEditorActions.createChain': 'Create chain',
  'chainEditor.chainEditorActions.saveAsCopy': 'Save as copy',
  'chainEditor.chainEditorView.rsipIntegration': 'RSIP Integration',
  'chainEditor.chainEditorView.taskSideRsipLinks': 'Task-side RSIP links',
  'chainEditor.chainEditorView.configureLinksForThisTaskDirectlyInTheEditor':
    'Configure links for this task directly in the editor. Conflicts use last-write-wins.',
  'chainEditor.chainEditorView.saveThisTaskFirstThenConfigureRsipLinksHere':
    'Save this task first, then configure RSIP links here.',
  'chainEditor.auxiliaryChainSettingsSection.auxiliaryBooking':
    'Auxiliary booking',
  'chainEditor.auxiliaryChainSettingsSection.configureBookingAndCompletionConditions':
    'Configure booking and completion conditions',
  'chainEditor.auxiliaryChainSettingsSection.bookingSignal': 'BOOKING SIGNAL',
  'chainEditor.auxiliaryChainSettingsSection.chooseABookingSignal':
    'Choose a booking signal',
  'chainEditor.auxiliaryChainSettingsSection.enterYourCustomBookingSignal':
    'Enter your custom booking signal',
  'chainEditor.auxiliaryChainSettingsSection.bookingDuration':
    'BOOKING DURATION',
  'chainEditor.auxiliaryChainSettingsSection.presetMin': '{preset} min',
  'chainEditor.auxiliaryChainSettingsSection.customDuration': 'Custom duration',
  'chainEditor.auxiliaryChainSettingsSection.customBookingDuration':
    'Custom booking duration',
  'chainEditor.auxiliaryChainSettingsSection.setHowLongTheBookingPhaseLasts':
    'Set how long the booking phase lasts',
  'chainEditor.auxiliaryChainSettingsSection.min': 'min',
  'chainEditor.auxiliaryChainSettingsSection.nextValueMin': '{nextValue} min',
  'chainEditor.auxiliaryChainSettingsSection.bookingCompletionCondition':
    'Booking completion condition',
  'chainEditor.auxiliaryChainSettingsSection.completionCondition':
    'COMPLETION CONDITION',
  'chainEditor.auxiliaryChainSettingsSection.eGOpenYourIdeSitAtYourDesk':
    'e.g. Open your IDE, sit at your desk',
  'chainEditor.auxiliaryChainSettingsSection.note': 'Note',
  'chainEditor.auxiliaryChainSettingsSection.thisIsTheActionYouMustCompleteDuringBookingUsually':
    'This is the action you must complete during booking—usually the main chain’s “Sacred Seat” trigger.',
  'chainEditor.basicInfoSection.basicInfo': 'Basic info',
  'chainEditor.basicInfoSection.setTheBasicDetailsOfThisChain':
    'Set the basic details of this chain',
  'chainEditor.basicInfoSection.chainName': 'Chain name',
  'chainEditor.basicInfoSection.giveYourChainAClearAndRecognizableName':
    'Give your chain a clear and recognizable name',
  'chainEditor.basicInfoSection.eGLearnPythonWorkout30MinutesDistractionFreeWriting':
    'e.g. Learn Python, Workout 30 minutes, Distraction-free writing',
  'chainEditor.basicInfoSection.taskType': 'Task type',
  'chainEditor.basicInfoSection.chooseTheMostSuitableTaskType':
    'Choose the most suitable task type',
  'chainEditor.basicInfoSection.unit': 'Unit',
  'chainEditor.basicInfoSection.assaultStudyExperimentsPapers':
    'Assault (study, experiments, papers)',
  'chainEditor.basicInfoSection.reconResearchInformationGathering':
    'Recon (research, information gathering)',
  'chainEditor.basicInfoSection.commandPlanningStrategy':
    'Command (planning, strategy)',
  'chainEditor.basicInfoSection.specialOpsMiscellaneousTasks':
    'Special ops (miscellaneous tasks)',
  'chainEditor.basicInfoSection.engineeringExerciseTraining':
    'Engineering (exercise, training)',
  'chainEditor.basicInfoSection.quartermasterCookingMealPrep':
    'Quartermaster (cooking, meal prep)',
  'chainEditor.basicInfoSection.groupMembership': 'Group membership',
  'chainEditor.basicInfoSection.thisTaskCurrentlyBelongsToAGroup':
    'This task currently belongs to a group',
  'chainEditor.basicInfoSection.duplicateThisTaskAndRemoveItFromTheGroup':
    'Duplicate this task and remove it from the group (original stays)',
  'chainEditor.basicInfoSection.copyOut': 'Copy out',
  'chainEditor.basicInfoSection.removeThisTaskFromTheGroup':
    'Remove this task from the group',
  'chainEditor.basicInfoSection.remove': 'Remove',
  'chainEditor.mainChainSettingsSection.mainChain': 'Main chain',
  'chainEditor.mainChainSettingsSection.configureTheMainTaskExecutionSettings':
    'Configure the main task execution settings',
  'chainEditor.mainChainSettings.minimumDurationSettings.whenEnabledThisTaskWillNotCountDownIn':
    'When enabled, this task will not count down. In Focus Mode, you can end it by tapping “Complete task”.',
  'chainEditor.mainChainSettings.minimumDurationSettings.minimumDuration':
    'Minimum duration',
  'chainEditor.mainChainSettings.minimumDurationSettings.formMinimumDurationMin':
    '{formMinimumDuration} min',
  'chainEditor.mainChainSettings.minimumDurationSettings.notSet': 'Not set',
  'chainEditor.mainChainSettings.minimumDurationSettings.customMinutes':
    'Custom minutes',
  'chainEditor.mainChainSettings.minimumDurationSettings.clear': 'Clear',
  'chainEditor.mainChainSettings.minimumDurationSettings.onceTheMinimumIsReachedYouCanCompleteEarly':
    'Once the minimum is reached, you can complete early.',
  'chainEditor.mainChainSettings.sacredSeatSettings.sacredSeat': 'Sacred Seat',
  'chainEditor.mainChainSettings.sacredSeatSettings.chooseAClearSignalThatStartsThisTask':
    'Choose a clear signal that starts this task',
  'chainEditor.mainChainSettings.sacredSeatSettings.chooseATrigger':
    'Choose a trigger',
  'chainEditor.mainChainSettings.sacredSeatSettings.enterYourCustomTrigger':
    'Enter your custom trigger',
  'chainEditor.mainChainSettings.taskDurationSettings.taskDuration':
    'Task duration',
  'chainEditor.mainChainSettings.taskDurationSettings.setAPracticalTimeBoundary':
    'Set a practical time boundary',
  'chainEditor.mainChainSettings.taskDurationSettings.noTimer': 'No timer',
  'chainEditor.mainChainSettings.taskDurationSettings.dragTheSliderOrUseKeyboardInputToSet':
    'Drag the slider or use keyboard input to set the duration',
  'chainEditor.mainChainSettings.taskDurationSettings.valueMin': '{value} min',
  'dailyCheckin.dailyCheckinShared.totalPoints': 'Total points',
  'dailyCheckin.dailyCheckinShared.streak': 'Streak',
  'dailyCheckin.dailyCheckinShared.totalCheckIns': 'Total check-ins',
  'dailyCheckin.dailyCheckinShared.checkedInToday': 'Checked in today',
  'dailyCheckin.dailyCheckinShared.comeBackTomorrowForMorePoints':
    'Come back tomorrow for more points!',
  'dashboard.dashboardChainsSection.yourTaskChains': 'Your Task Chains',
  'dashboard.dashboardChainsSection.chooseWhatYouWantToMoveForwardNow':
    'Choose what you want to move forward now',
  'dashboard.dashboardChainsSection.newChain': 'New Chain',
  'dashboard.dashboardChainsSection.newGroup': 'New Group',
  'dashboard.dashboardChainsSection.recycleBin': 'Recycle bin',
  'dashboard.dashboardChainsSection.data': 'Data',
  'dashboard.dashboardChainsSection.rsipTree': 'RSIP Tree',
  'dashboard.dashboardEmptyState.createYourFirstChain':
    'Create your first chain',
  'dashboard.dashboardEmptyState.aChainRepresentsATaskYouWantToKeep':
    'A chain represents a task you want to keep doing. Every successful completion grows your streak.',
  'dashboard.dashboardEmptyState.createChain': 'Create chain',
  'dashboard.dashboardHero.ctdpProtocol': 'CTDP Protocol',
  'dashboard.dashboardRecommendSection.streakAtRisk': 'Streak at risk!',
  'dashboard.dashboardRecommendSection.keepTheStreak': 'Keep the streak',
  'dashboard.dashboardRecommendSection.newChain': 'New chain',
  'dashboard.dashboardRecommendSection.todaySPicks': "Today's picks",
  'dashboard.dashboardRecommendSection.todaySPicksVariant2': "Today's picks",
  'dashboard.dashboardView.chooseYourDataMode': 'Choose your data mode',
  'dashboard.dashboardView.localModeIsTheDefaultYouCanAlsoConnect':
    'Local mode is the default. You can also connect Supabase for sign-in and multi-device sync.',
  'dashboard.dashboardView.continueWithLocalMode': 'Continue with local mode',
  'dashboard.dashboardView.connectCloudSync': 'Connect cloud sync',
  'focusMode.focusModeContainer.userInterrupted': 'User interrupted',
  'focusMode.focusModeControls.pause': 'Pause',
  'focusMode.focusModeControls.complete': 'Complete',
  'focusMode.focusModeControls.completeEarly': 'Complete early',
  'focusMode.focusModeControls.pausedAutoResumeInResumeCountdownMinutesMResumeCountdownSecondsS':
    'Paused. Auto-resume in {resumeCountdownMinutes}m {resumeCountdownSeconds}s',
  'focusMode.focusModeControls.pausedForElapsedPauseTimeMinutesMElapsedPauseTimeSecondsS':
    'Paused for {elapsedPauseTimeMinutes}m {elapsedPauseTimeSeconds}s',
  'focusMode.focusModeControls.resume': 'Resume',
  'focusMode.focusModeControls.cancelAutoResume': 'Cancel auto-resume',
  'focusMode.focusModeView.holdToInterrupt': 'Hold to interrupt',
  'focusMode.focusSessionHeader.exitFullscreen': 'Exit fullscreen',
  'focusMode.focusSessionHeader.enterFullscreen': 'Enter fullscreen',
  'focusMode.focusSessionHeader.exitFullscreenEsc': 'Exit fullscreen (ESC)',
  'focusMode.focusSessionHeader.enterFullscreenF11': 'Enter fullscreen (F11)',
  'focusMode.focusTimerPanel.elapsed': 'Elapsed: ',
  'focusMode.focusTimerPanel.elapsedWholeMinutesMinSessionDurationMin':
    '{elapsedWholeMinutes} min / {sessionDuration} min',
  'focusMode.focusTimerPanel.needMinimumCountdownMinutesMMinimumCountdownSecondsSToReachTheMinimum':
    'Need {minimumCountdownMinutes}m {minimumCountdownSeconds}s to reach the minimum duration',
  'focusMode.focusTimerPanel.minimumDurationReachedChainMinimumDurationMinYouCanComplete':
    'Minimum duration reached ({chainMinimumDuration} min). You can complete the task.',
  'focusMode.interruptConfirmDialog.interruptTask': 'Interrupt task?',
  'focusMode.interruptConfirmDialog.interruptingWillFailTheTaskAndResetYourMain':
    'Interrupting will fail the task and reset your main streak to zero. Are you sure you want to interrupt?',
  'focusMode.interruptConfirmDialog.interrupt': 'Interrupt',
  'focusMode.useExceptionRuleFlow.cancelled': 'Cancelled',
  'focusMode.useExceptionRuleFlow.youCanContinueTheTaskOrChooseAnotherAction':
    'You can continue the task or choose another action.',
  'focusMode.useExceptionRuleOperations.issueResolved': 'Issue resolved',
  'focusMode.useExceptionRuleOperations.unknownError': 'Unknown error',
  'focusMode.useExceptionRuleOperations.retry': 'Retry',
  'focusMode.useExceptionRuleOperations.refresh': 'Refresh',
  'focusMode.useExceptionRuleOperations.operationFailedPleaseTryAgain':
    'Operation failed. Please try again.',
  'focusMode.useExceptionRuleOperations.systemError': 'System error',
  'focusMode.useExceptionRuleOperations.somethingWentWrongWhileHandlingTheErrorRefreshThe':
    'Something went wrong while handling the error. Refresh the page and try again.',
  'focusMode.useExceptionRuleOperations.invalidRule': 'Invalid rule',
  'focusMode.useExceptionRuleOperations.pausingTask': 'Pausing task...',
  'focusMode.useExceptionRuleOperations.completingTask': 'Completing task...',
  'focusMode.useExceptionRuleOperations.appliedRuleRuleNameToPauseTheTask':
    'Applied rule "{ruleName}" to pause the task',
  'focusMode.useExceptionRuleOperations.appliedRuleRuleNameToCompleteTheTask':
    'Applied rule "{ruleName}" to complete the task early',
  'focusMode.useExceptionRuleOperations.success': 'Success',
  'focusMode.useExceptionRuleOperations.ruleNameCannotBeEmpty':
    'Rule name cannot be empty',
  'focusMode.useExceptionRuleOperations.creatingRule': 'Creating rule...',
  'focusMode.useExceptionRuleOperations.validating': 'Validating...',
  'focusMode.useExceptionRuleOperations.saving': 'Saving...',
  'focusMode.useExceptionRuleOperations.ruleCreated': 'Rule created',
  'focusMode.useExceptionRuleOperations.ruleResultRuleNameHasBeenCreatedAndApplied':
    'Rule "{resultRuleName}" has been created and applied',
  'focusMode.useExceptionRuleOperations.notes': 'Notes',
  'groupCard.groupCard.viewDetailsGroupName': 'View details: {groupName}',
  'groupCard.groupCard.deleteGroup': 'Delete group',
  'groupCard.groupCardActions.startNext': 'Start next',
  'groupCard.groupCardSummary.progress': 'Progress',
  'groupCard.groupCardSummary.tasks': 'Tasks',
  'groupCard.groupCardSummary.groupStreak': 'Group streak',
  'groupCard.groupDeleteConfirmDialog.deleteGroup': 'Delete group?',
  'groupCard.groupDeleteConfirmDialog.areYouSureYouWantToDeleteTheGroup':
    'Are you sure you want to delete the group "',
  'groupCard.groupDeleteConfirmDialog.thisWillDeleteTheEntireGroupAndAllChild':
    'This will delete the entire group and all child tasks:',
  'groupView.groupOverview.groupOverview': 'Group overview',
  'groupView.groupOverview.groupChildrenCountUnits':
    '{groupChildrenCount} units',
  'groupView.groupOverview.completed': 'completed',
  'groupView.groupOverview.timeExpired': 'Time expired',
  'groupView.groupOverview.timeLimit': 'Time limit',
  'groupView.groupOverview.thisGroupHasExpiredProgressWillBeClearedPlease':
    'This group has expired. Progress will be cleared. Please restart the group.',
  'groupView.groupUnitList.units': 'Units',
  'groupView.groupUnitList.nextUp': 'Next up: ',
  'groupView.groupUnitList.thisGroupHasNoUnitsYet':
    'This group has no units yet',
  'groupView.groupUnitList.addYourFirstUnit': 'Add your first unit',
  'groupView.groupViewHeader.cycles': 'cycles',
  'groupView.groupViewHeader.addUnit': 'Add unit',
  'groupView.groupViewHeader.importUnits': 'Import units',
  'groupView.groupViewHeader.editGroup': 'Edit group',
  'groupView.groupViewHeader.startNewCycle': 'Start new cycle',
  'groupView.repeatCountModal.setRepeatCount': 'Set repeat count',
  'groupView.repeatCountModal.repeatCount199': 'Repeat count (1-99)',
  'groupView.repeatCountModal.setHowManyTimesThisUnitMustBeRepeated':
    'Set how many times this unit must be repeated in the group',
  'groupView.repeatCountModal.save': 'Save',
  'groupView.unitCard.viewTaskUnitName': 'View task: {unitName}',
  'groupView.unitCard.next': 'Next',
  'groupView.unitCard.completions': 'Completions',
  'groupView.unitCard.bookings': 'Bookings',
  'groupView.unitCard.moveUp': 'Move up',
  'groupView.unitCard.moveDown': 'Move down',
  'groupView.unitCard.editUnit': 'Edit unit',
  'groupView.unitCard.deleteUnit': 'Delete unit',
  'groupView.unitCard.start': 'Start',
  'groupView.unitCard.setRepeatCountCurrentCurrentRepeatCount':
    'Set repeat count (current: {currentRepeatCount})',
  'importExportModal.exportTab.exportYourData': 'Export your data',
  'importExportModal.exportTab.exportSavesAllYourCurrentDataIncludingChainsStats':
    'Export saves all your current data, including chains, stats, extended RSIP data, pet state, and exception rules.',
  'importExportModal.exportTab.chainConfigStats': 'Chain config & stats',
  'importExportModal.exportTab.completionHistory': 'Completion history',
  'importExportModal.exportTab.fullRsipDataset': 'Full RSIP dataset',
  'importExportModal.exportTab.petState': 'Pet state',
  'importExportModal.exportTab.exceptionRules': 'Exception rules',
  'importExportModal.exportTab.exportAsJson': 'Export as JSON',
  'importExportModal.importFields.importData': 'Import data',
  'importExportModal.importFields.importAddsNewDataToYourSystemIncludingChains':
    'Import adds new data to your system, including chains, extended RSIP data, pet state, and exception rules. Imported chains get new IDs and will not overwrite existing data.',
  'importExportModal.importFields.chainsNewIds': 'Chains (new IDs)',
  'importExportModal.importFields.rsipNodesExtendedRecords':
    'RSIP nodes & extended records',
  'importExportModal.importFields.petStateOverwriteOnImport':
    'Pet state (overwrite on import)',
  'importExportModal.importFields.exceptionRulesSkipDuplicates':
    'Exception rules (skip duplicates)',
  'importExportModal.importFields.makeSureTheJsonFileWasExportedFromMomentum':
    'Make sure the JSON file was exported from Momentum',
  'importExportModal.importFields.chooseAFile': 'Choose a file',
  'importExportModal.importFields.chooseAFileToImport':
    'Choose a file to import',
  'importExportModal.importFields.orPasteJsonManually':
    'Or paste JSON manually',
  'importExportModal.importFields.pasteTheJsonExportedFromMomentum':
    'Paste the JSON exported from Momentum...',
  'importExportModal.importFields.jsonData': 'JSON data',
  'importExportModal.importFields.preserveStatisticsStreaksCompletionsEtc':
    'Preserve statistics (streaks, completions, etc.)',
  'importExportModal.importFields.preserveStatistics': 'Preserve statistics',
  'importExportModal.importFields.preserveOriginalTimestampsCreatedAtCompletedAtEtc':
    'Preserve original timestamps (createdAt, completedAt, etc.)',
  'importExportModal.importFields.preserveOriginalTimestamps':
    'Preserve original timestamps',
  'importExportModal.importFields.importCompletionHistory':
    'Import completion history',
  'importExportModal.importFields.importOptions': 'Import options',
  'importExportModal.importFields.safeImport': 'Safe import',
  'importExportModal.importFields.importedDataIsAutomaticallyAssociatedWithYourAccount':
    '• Imported data is automatically associated with your account',
  'importExportModal.importFields.idConflictsAreResolvedAutomaticallyWithNewUnique':
    '• ID conflicts are resolved automatically with new unique IDs',
  'importExportModal.importFields.importSessionsExpireAutomaticallyAfter30Minutes':
    '• Import sessions expire automatically after 30 minutes',
  'importExportModal.importStatusControls.verifyingYourAccount':
    'Verifying your account...',
  'importExportModal.importStatusControls.creatingASafeImportSession':
    'Creating a safe import session...',
  'importExportModal.importStatusControls.importingDataSafely':
    'Importing data safely...',
  'importExportModal.importStatusControls.importSuccessfulTheChainsHaveBeenAdded':
    'Import successful! The chains have been added.',
  'importExportModal.importStatusControls.importFailed': 'Import failed',
  'importExportModal.importStatusControls.verifying': 'Verifying...',
  'importExportModal.importStatusControls.creatingSession':
    'Creating session...',
  'importExportModal.importStatusControls.importing': 'Importing...',
  'importExportModal.importStatusControls.importData': 'Import data',
  'importExportModal.importStatusControls.importDataVariant2': 'Import data',
  'importExportModal.useImportWorkflow.invalidImportFormatPleaseMakeSureYouUploadedA':
    'Invalid import format: please make sure you uploaded a valid JSON file.',
  'importExportModal.useImportWorkflow.importFailedUnknownError':
    'Import failed: unknown error',
  'importExportModal.useImportWorkflow.authenticationFailedPleaseMakeSureYouAreSignedIn':
    'Authentication failed: please make sure you are signed in and try importing again.',
  'importExportModal.useImportWorkflow.invalidImportFormatNoValidChainsFoundPleaseMake':
    'Invalid import format: no valid chains found. Please make sure this file was exported from Momentum.',
  'importExportModal.useImportWorkflow.importFailedDetail':
    'Import failed: {detail}',
  'importExportModal.useImportWorkflow.importFailedCheckTheConsoleForDetailsThenTry':
    'Import failed. Check the console for details, then try again.',
  'importExportModal.useImportWorkflow.authenticationFailedPleaseMakeSureYouAreSignedInVariant2':
    'Authentication failed. Please make sure you are signed in and try importing again.',
  'importUnitsModal.importUnitOption.selectUnitUnitName':
    'Select unit: {unitName}',
  'importUnitsModal.importUnitsModalView.importUnits': 'Import units',
  'importUnitsModal.importUnitsModalView.selectUnitsToCopyOrMoveIntoThisGroup':
    'Select units to copy or move into this group',
  'importUnitsModal.importUnitsModalView.importMode': 'Import mode',
  'importUnitsModal.importUnitsModalView.createACopyInTheGroupKeepTheOriginal':
    'Create a copy in the group; keep the original unit independent',
  'importUnitsModal.importUnitsModalView.moveTheUnitIntoTheGroupItWillNo':
    'Move the unit into the group; it will no longer appear independently',
  'importUnitsModal.importUnitsModalView.searchUnits': 'Search units',
  'importUnitsModal.importUnitsModalView.searchUnitsVariant2':
    'Search units...',
  'importUnitsModal.importUnitsModalView.noImportableUnitsFound':
    'No importable units found',
  'importUnitsModal.importUnitsModalView.tryAdjustingYourSearch':
    'Try adjusting your search',
  'importUnitsModal.importUnitsModalView.allUnitsAreAlreadyInAGroup':
    'All units are already in a group',
  'importUnitsModal.importUnitsModalView.import': 'Import',
  'mobile.mobileBottomNav.home': 'Home',
  'mobile.mobileBottomNav.focus': 'Focus',
  'mobile.mobileBottomNav.rsip': 'RSIP',
  'mobile.mobileBottomNav.bottomNavigation': 'Bottom navigation',
  'pet.petCreationDialog.pleaseEnterAPetName': 'Please enter a pet name',
  'pet.petCreationDialog.nameCannotExceed20Characters':
    'Name cannot exceed 20 characters',
  'pet.petCreationDialog.adoptYourPet': 'Adopt Your Pet',
  'pet.petCreationDialog.giveYourNewCompanionAName':
    'Give your new companion a name!',
  'pet.petCreationDialog.petName': 'Pet name...',
  'pet.petCreationDialog.petNameVariant2': 'Pet name',
  'pet.petCreationDialog.maybeLater': 'Maybe Later',
  'pet.petCreationDialog.adopt': 'Adopt',
  'pet.petCreationDialog.completeTasksToFeedYourPetAndHelpIt':
    'Complete tasks to feed your pet and help it grow!',
  'pet.widget.petWidget.adoptAPet': 'Adopt a pet',
  'pet.widget.petWidget.adoptAPetVariant2': 'Adopt a pet',
  'pet.widget.petWidget.nameYourNewCompanion': 'Name your new companion',
  'pet.widget.petWidget.expandPet': 'Expand pet',
  'pet.widget.petWidget.dragToMovePet': 'Drag to move pet',
  'pet.widget.petWidget.dragToMove': 'Drag to move',
  'pet.widget.petWidget.minimize': 'Minimize',
  'pet.widget.petWidget.feed': 'Feed',
  'pet.widget.petWidget.feeding': 'Feeding...',
  'pet.widget.usePetWidgetController.fedFullnessResultHungerReduced':
    'Fed! Fullness +{resultHungerReduced}',
  'pet.widget.usePetWidgetController.petIsAlreadyFull': 'Pet is already full~',
  'pet.widget.usePetWidgetController.welcomeName': 'Welcome {name}!',
  'recycleBinModal.bulkActionsBar.clearSelection': 'Clear selection',
  'recycleBinModal.bulkActionsBar.selectAll': 'Select all',
  'recycleBinModal.bulkActionsBar.restoreSelected': 'Restore selected',
  'recycleBinModal.bulkActionsBar.deletePermanently': 'Delete permanently',
  'recycleBinModal.confirmDialog.confirmRestore': 'Confirm restore',
  'recycleBinModal.confirmDialog.confirmPermanentDeletion':
    'Confirm permanent deletion',
  'recycleBinModal.confirmDialog.restoreTheFollowingShowConfirmDialogChainIdsCountChainSShowConfirmDialogChainNames':
    'Restore the following {showConfirmDialogChainIdsCount} chain(s)?\n\n{showConfirmDialogChainNames}',
  'recycleBinModal.confirmDialog.permanentlyDeleteTheFollowingShowConfirmDialogChainIdsCountChainSShowConfirmDialogChainNamesThis':
    'Permanently delete the following {showConfirmDialogChainIdsCount} chain(s)?\n\n{showConfirmDialogChainNames}\n\n⚠️ This cannot be undone. All data will be permanently deleted!',
  'recycleBinModal.emptyState.recycleBinIsEmpty': 'Recycle bin is empty',
  'recycleBinModal.emptyState.deletedChainsAppearHereYouCanRestoreThemOr':
    'Deleted chains appear here. You can restore them or delete them permanently.',
  'recycleBinModal.loadingState.loading': 'Loading…',
  'recycleBinModal.operations.restoredChainIdsCountChainSTookDurationMs':
    'Restored {chainIdsCount} chain(s) (took {duration}ms)',
  'recycleBinModal.operations.restoreFailedSafeDetail':
    'Restore failed: {safeDetail}',
  'recycleBinModal.operations.restoreFailedCheckTheConsoleForDetailsThenTry':
    'Restore failed. Check the console for details, then try again.',
  'recycleBinModal.operations.someChainsMayNotHaveBeenRestoredPleaseCheck':
    'Some chains may not have been restored. Please check the dashboard. If needed, refresh the page.',
  'recycleBinModal.operations.permanentlyDeletedChainIdsCountChainSTookDurationMs':
    'Permanently deleted {chainIdsCount} chain(s) (took {duration}ms)',
  'recycleBinModal.operations.permanentDeleteFailedSafeDetail':
    'Permanent delete failed: {safeDetail}',
  'recycleBinModal.operations.permanentDeleteFailedCheckTheConsoleForDetailsThen':
    'Permanent delete failed. Check the console for details, then try again.',
  'recycleBinModal.timeFormat.justNow': 'just now',
  'recycleBinModal.useRecycleBinModal.failedToLoadRecycleBinPleaseTryAgain':
    'Failed to load recycle bin. Please try again.',
  'recycleBinModal.useRecycleBinModal.operationFailedSafeDetail':
    'Operation failed: {safeDetail}',
  'recycleBinModal.useRecycleBinModal.operationFailedCheckTheConsoleForDetailsThenTry':
    'Operation failed. Check the console for details, then try again.',
  'rsip.rsipCanvasView.stopTimer': 'Stop timer',
  'rsip.rsipCanvasView.stopTheTimer': 'Stop the timer?',
  'rsip.rsipCanvasView.stop': 'Stop',
  'rsip.rsipCanvasView.confirmRollback': 'Confirm rollback',
  'rsip.rsipCanvasView.childNode': 'child node',
  'rsip.rsipCanvasView.childNodes': 'child nodes',
  'rsip.rsipCanvasView.markedAsFailedThisWillDeleteConfirmActionNodeTitle':
    'Marked as failed: this will delete "{confirmActionNodeTitle}" and its {confirmActionDescendants} {childNodesLabel}. Roll back?',
  'rsip.rsipCanvasView.rollBack': 'Roll back',
  'rsip.rsipControls.zoomIn': 'Zoom in',
  'rsip.rsipControls.zoomOut': 'Zoom out',
  'rsip.rsipControls.fitToContent': 'Fit to content',
  'rsip.rsipFilters.filterByType': 'Filter by type:',
  'rsip.rsipFilters.clear': 'Clear',
  'rsip.rsipForm.parentOptionalEmptyNewBranch':
    'Parent (optional; empty = new branch)',
  'rsip.rsipForm.noParentCreateNewRoot': '(No parent; create new root)',
  'rsip.rsipForm.policyTitle': 'Policy title',
  'rsip.rsipForm.eGStartShoweringWithin15MinutesOfGettingHome':
    'e.g. Start showering within 15 minutes of getting home',
  'rsip.rsipForm.rule': 'Rule',
  'rsip.rsipForm.eGStartA15MinuteTimerWhenHomeEnterThe':
    'e.g. Start a 15-minute timer when home; enter the bathroom before it ends',
  'rsip.rsipForm.enableTimer': 'Enable timer',
  'rsip.rsipForm.timerMinutes': 'Timer minutes',
  'rsip.rsipForm.nodeType': 'Node type',
  'rsip.rsipForm.policyGroup': 'Policy group',
  'rsip.rsipForm.noGroup': 'No group',
  'rsip.rsipForm.tolerance': 'Tolerance',
  'rsip.rsipForm.newGroup': 'New group',
  'rsip.rsipForm.passivePolicy': 'Passive policy',
  'rsip.rsipForm.multiplePerDayIsEnabledYouCanAddMore':
    'Multiple per day is enabled. You can add more today.',
  'rsip.rsipForm.addAtMostOnePolicyPerDay': 'Add at most one policy per day.',
  'rsip.rsipForm.youCanAddToday': 'You can add today.',
  'rsip.rsipForm.alreadyAddedTodayTryAgainTomorrow':
    'Already added today. Try again tomorrow.',
  'rsip.rsipForm.addPolicy': 'Add policy',
  'rsip.rsipinsightsPanel.nA': 'N/A',
  'rsip.rsipinsightsPanel.up': 'Up',
  'rsip.rsipinsightsPanel.down': 'Down',
  'rsip.rsipinsightsPanel.flat': 'Flat',
  'rsip.rsipinsightsPanel.insufficientData': 'Insufficient data',
  'rsip.rsipinsightsPanel.high': 'High',
  'rsip.rsipinsightsPanel.medium': 'Medium',
  'rsip.rsipinsightsPanel.low': 'Low',
  'rsip.rsipinsightsPanel.activePolicies': 'Active Policies',
  'rsip.rsipinsightsPanel.14dSuccessRate': '14d Success Rate',
  'rsip.rsipinsightsPanel.passiveCoverage': 'Passive Coverage',
  'rsip.rsipinsightsPanel.reinforcementCoverage': 'Reinforcement Coverage',
  'rsip.rsipinsightsPanel.maxNodeTrend': 'Max-node trend',
  'rsip.rsipinsightsPanel.runDurationTrend': 'Run-duration trend',
  'rsip.rsipinsightsPanel.collapsesIn14Days': 'Collapses in 14 days',
  'rsip.rsipinsightsPanel.ruralFirstCandidateQueue':
    'Rural-first candidate queue',
  'rsip.rsipinsightsPanel.noLowCostCandidatesDetectedYet':
    'No low-cost candidates detected yet.',
  'rsip.rsipinsightsPanel.failureCost': 'Failure cost',
  'rsip.rsipinsightsPanel.violationRate': 'Violation rate',
  'rsip.rsipinsightsPanel.recommendationAssistant': 'Recommendation assistant',
  'rsip.rsipinsightsPanel.noRecommendationYetContinueExecutionToCollectMoreSignal':
    'No recommendation yet. Continue execution to collect more signal.',
  'rsip.rsipNodeCard.cancelReparent': 'Cancel reparent',
  'rsip.rsipNodeCard.changeParent': 'Change parent',
  'rsip.rsipNodeCard.markAsFailedDeleteThisNodeAndAllDescendants':
    'Mark as failed (delete this node and all descendants)',
  'rsip.rsipPolicyLibrary.policyLibrary': 'Policy Library',
  'rsip.rsipPolicyLibrary.noArchivedPoliciesYetRemovedNodesWillBeStored':
    'No archived policies yet. Removed nodes will be stored here and can be restored anytime.',
  'rsip.rsipPolicyLibrary.archivedEntriesPreserveInternalizationProgressAndCanBeRestored':
    'Archived entries preserve internalization progress and can be restored under any parent.',
  'rsip.rsipPolicyLibrary.restoreAsNewRoot': 'Restore as new root',
  'rsip.rsipRunHistory.runHistory': 'Run History',
  'rsip.rsipRunHistory.noCollapseRecordsYetSignificantRollbacksWillBeRecorded':
    'No collapse records yet. Significant rollbacks will be recorded here.',
  'rsip.rsipRunHistory.totalRuns': 'Total runs',
  'rsip.rsipRunHistory.longestDuration': 'Longest duration',
  'rsip.rsipRunHistory.avgPeakNodes': 'Avg. peak nodes',
  'rsip.rsipRunHistory.inProgress': 'In progress',
  'rsip.rsipRunHistory.collapseReason': 'Collapse reason:',
  'rsip.rsipSplitModeSection.sleepTemplate': 'Sleep template',
  'rsip.rsipSplitModeSection.exerciseTemplate': 'Exercise template',
  'rsip.rsipSplitModeSection.dietTemplate': 'Diet template',
  'rsip.rsipSplitModeSection.splitModeShatterOversizedPolicies':
    'Split mode (shatter oversized policies)',
  'rsip.rsipSplitModeSection.enable': 'Enable',
  'rsip.rsipSplitModeSection.goalEGSleepEarlyAndWakeEarly':
    'Goal, e.g. Sleep early and wake early',
  'rsip.rsipSplitModeSection.addSubPolicy': 'Add sub-policy',
  'rsip.rsipSplitModeSection.subPolicyTitle': 'Sub-policy title',
  'rsip.rsipSplitModeSection.subPolicyRule': 'Sub-policy rule',
  'rsip.rsipSplitModeSection.passive': 'Passive',
  'rsip.rsipSplitModeSection.createSplitPolicies': 'Create split policies',
  'rsip.rsipTaskLinkConfirmationDialog.confirmTaskIntegration':
    'Confirm task integration',
  'rsip.rsipTaskLinkConfirmationDialog.markPolicyNodeTitleAsViolatedThisMay':
    'Mark policy "{nodeTitle}" as violated? This may remove nodes and their descendants and consume group tolerance.',
  'rsip.rsipTaskLinkConfirmationDialog.markPolicyNodeTitleAsExecutedToday':
    'Mark policy "{nodeTitle}" as executed today?',
  'rsip.rsipTaskLinkConfirmationDialog.confirm': 'Confirm',
  'rsip.rsipTaskLinkPanel.rsipTaskIntegration': 'RSIP <-> Task Integration',
  'rsip.rsipTaskLinkPanel.taskEventsCanAutoUpdateRsipRsipTaskActionsDefaultTo':
    'Task events can auto-update RSIP. RSIP->task actions default to confirmation. Link conflicts use last-write-wins (latest update).',
  'rsip.rsipTaskLinkPanel.taskRsip': 'Task -> RSIP',
  'rsip.rsipTaskLinkPanel.rsipTask': 'RSIP -> Task',
  'rsip.rsipTree.noPoliciesYetAddOneFromTheFormAbove':
    'No policies yet. Add one from the form above.',
  'rsip.rsipTree.cannotChooseThisNodeAsParentWouldCreateA':
    'Cannot choose this node as parent (would create a cycle).',
  'rsip.rsipTree.selectANewParent': 'Select a new parent',
  'rsip.rsipTree.moving': 'Moving: ',
  'rsip.rsipTree.tapANodeToSetAsParentOr':
    '. Tap a node to set as parent, or make it a root.',
  'rsip.rsipTree.makeRoot': 'Make root',
  'rsip.rsipTreeTab.policyExecutionTracking': 'Policy Execution Tracking',
  'rsip.rsipViolationDialog.closeDialog': 'Close dialog',
  'rsip.rsipViolationDialog.confirmViolation': 'Confirm violation',
  'rsip.rsipViolationDialog.thisActionCannotBeUndone':
    'This action cannot be undone',
  'rsip.rsipViolationDialog.impactedDescendants': 'Impacted descendants:',
  'rsip.rsipViolationDialog.violationReasonOptional':
    'Violation reason (optional)',
  'rsip.rsipViolationDialog.repairHintOptional': 'Repair hint (optional)',
  'rsip.rsipViolationDialog.confirmViolationVariant2': 'Confirm violation',
  'rsip.useRsipreparent.aPreviousReparentSaveIsStillInProgressTry':
    'A previous reparent save is still in progress. Try again when it finishes.',
  'rsip.useRsipreparent.theNodeToMoveNoLongerExistsRefreshAnd':
    'The node to move no longer exists. Refresh and try again.',
  'rsip.useRsipreparent.theSelectedParentNoLongerExistsChooseAnotherParent':
    'The selected parent no longer exists. Choose another parent.',
  'rsip.useRsipreparent.cannotSelectTheNodeItselfAsParent':
    'Cannot select the node itself as parent.',
  'rsip.useRsipreparent.cannotMoveANodeUnderItsDescendant':
    'Cannot move a node under its descendant.',
  'rsip.useRsipreparent.couldNotSaveTheNewParentTryAgain':
    'Could not save the new parent. Try again.',
  'rsip.useRsiptimers.timerComplete': 'Timer complete',
  'rsip.useRsiptimers.rsipTimerHasEnded': 'RSIP timer has ended',
  'rsip.useRsiptimers.minutesMin': '{minutes} min',
  'rsip.useRsipviewCreationActions.enterPolicyGroupName':
    'Enter policy group name',
  'rsip.useRsipviewCreationActions.enterFaultToleranceInteger':
    'Enter fault tolerance (integer)',
  'rsip.useRsipviewCreationActions.optionalInputGroupEmoji':
    'Optional: input group emoji',
  'rsip.useRsipviewCreationActions.strictModeAllowsOneNewPolicyPerDayKeep':
    'Strict mode allows one new policy per day. Keep one valid item or switch to free mode.',
  'rsip.taskLink.rsipTaskLinkForm.selectRsipNode': 'Select RSIP node',
  'rsip.taskLink.rsipTaskLinkForm.selectTaskGroup': 'Select task/group',
  'rsip.taskLink.rsipTaskLinkForm.group': 'Group',
  'rsip.taskLink.rsipTaskLinkForm.task': 'Task',
  'rsip.taskLink.rsipTaskLinkForm.addLink': 'Add link',
  'rsip.taskLink.rsipTaskLinkList.noIntegrationLinksYet':
    'No integration links yet.',
  'rsip.taskLink.rsipTaskLinkList.node': 'Node',
  'rsip.taskLink.rsipTaskLinkList.target': 'Target',
  'rsip.taskLink.rsipTaskLinkList.enabled': 'Enabled',
  'rsip.taskLink.rsipTaskLinkList.disabled': 'Disabled',
  'rsip.taskLink.taskLinkUi.taskCompleted': 'Task completed',
  'rsip.taskLink.taskLinkUi.taskInterrupted': 'Task interrupted',
  'rsip.taskLink.taskLinkUi.groupCycleCompleted': 'Group cycle completed',
  'rsip.taskLink.taskLinkUi.rsipMarkedExecuted': 'RSIP marked executed',
  'rsip.taskLink.taskLinkUi.markRsipExecuted': 'Mark RSIP executed',
  'rsip.taskLink.taskLinkUi.markRsipViolated': 'Mark RSIP violated',
  'rsip.taskLink.taskLinkUi.promptStartTask': 'Prompt start task',
  'rsip.taskLink.taskLinkUi.promptScheduleTask': 'Prompt schedule task',
  'rsip.taskLink.taskLinkUi.auto': 'Auto',
  'rsip.taskLink.taskLinkUi.confirm': 'Confirm',
  'ruleManager.ruleManagerViewView.loadingRules': 'Loading rules...',
  'ruleManager.ruleManagerViewView.confirmDeletion': 'Confirm deletion',
  'ruleManager.ruleManagerViewView.deleteRuleDeleteConfirmationRuleName':
    'Delete rule "{deleteConfirmationRuleName}"?',
  'ruleManager.ruleManagerViewView.exceptionRules': 'Exception Rules',
  'ruleManager.ruleManagerViewView.manageExceptionRulesForPausingOrEarlyCompletion':
    'Manage exception rules for pausing or early completion',
  'ruleManager.ruleManagerViewView.export': 'Export',
  'ruleManager.ruleManagerViewView.createChainSpecificRule':
    'Create chain-specific rule',
  'ruleManager.ruleManagerViewView.searchRuleNameOrDescription':
    'Search rule name or description...',
  'ruleManager.ruleManagerViewView.allTypes': 'All types',
  'ruleManager.ruleManagerViewView.mostUsed': 'Most used',
  'ruleManager.ruleManagerViewView.name': 'Name',
  'ruleManager.ruleManagerViewView.lastUsed': 'Last used',
  'ruleManager.ruleManagerViewView.noMatchingRules': 'No matching rules',
  'ruleManager.ruleManagerViewView.noRulesYet': 'No rules yet',
  'ruleManager.ruleManagerViewView.tryAdjustingYourSearchOrFilters':
    'Try adjusting your search or filters',
  'ruleManager.ruleManagerViewView.createYourFirstExceptionRuleToGetStarted':
    'Create your first exception rule to get started',
  'ruleManager.ruleManagerViewView.createRule': 'Create rule',
  'ruleManager.ruleManagerFormModal.editRule': 'Edit rule',
  'ruleManager.ruleManagerFormModal.createRule': 'Create rule',
  'ruleManager.ruleManagerFormModal.suggestedRuleNames':
    'Suggested rule names:',
  'ruleManager.ruleManagerFormModal.ruleName': 'Rule name *',
  'ruleManager.ruleManagerFormModal.eGBathroomBreakWaterPhoneCall':
    'e.g. bathroom break, water, phone call',
  'ruleManager.ruleManagerFormModal.ruleType': 'Rule type *',
  'ruleManager.ruleManagerFormModal.pauseOnlyCanOnlyPauseTheTimer':
    'Pause only — can only pause the timer',
  'ruleManager.ruleManagerFormModal.earlyCompletionOnlyCanOnlyCompleteTasksEarly':
    'Early completion only — can only complete tasks early',
  'ruleManager.ruleManagerFormModal.descriptionOptional':
    'Description (optional)',
  'ruleManager.ruleManagerFormModal.describeThisException':
    'Describe this exception...',
  'ruleManager.ruleManagerFormModal.update': 'Update',
  'ruleManager.ruleManagerFormModal.create': 'Create',
  'ruleManager.useRuleManagerActions.failedToCreateRulePleaseTryAgain':
    'Failed to create rule. Please try again.',
  'ruleManager.useRuleManagerActions.failedToUpdateRulePleaseTryAgain':
    'Failed to update rule. Please try again.',
  'ruleManager.useRuleManagerActions.failedToUpdateRule':
    'Failed to update rule',
  'ruleManager.useRuleManagerActions.failedToDeleteRule':
    'Failed to delete rule',
  'ruleManager.useRuleManagerActions.failedToExportRules':
    'Failed to export rules',
  'ruleManager.useRuleManagerData.failedToLoadRules': 'Failed to load rules',
  'ruleSelectionDialog.dialogFooter.cancel': 'Cancel',
  'ruleSelectionDialog.dialogHeader.chooseExceptionRule':
    'Choose exception rule',
  'ruleSelectionDialog.errorBanner.dismissError': 'Dismiss error',
  'ruleSelectionDialog.pauseDurationCard.pauseDuration': 'Pause duration',
  'ruleSelectionDialog.pauseDurationCard.pauseDurationInMinutes':
    'Pause duration in minutes',
  'ruleSelectionDialog.pauseDurationCard.minutes': 'Minutes',
  'ruleSelectionDialog.pauseDurationCard.indefinite': 'Indefinite',
  'ruleSelectionDialog.searchBar.searchRules': 'Search rules',
  'ruleSelectionDialog.searchBar.searchRulesOrTypeANewRuleName':
    'Search rules or type a new rule name...',
  'ruleSelectionDialog.pauseTimer': 'Pause timer',
  'ruleSelectionDialog.earlyCompletion': 'Early completion',
  'taskCompletionDialog.notesSection.notesOptional': 'Notes (optional)',
  'taskCompletionDialog.notesSection.addMoreDetailsOrThoughts':
    'Add more details or thoughts…',
  'taskCompletionDialog.notesSection.ctrlEnterToCompleteEscToCancel':
    'Ctrl+Enter to complete, Esc to cancel',
  'taskCompletionDialog.notesSection.addNotes': 'Add notes',
  'taskCompletionDialog.notesSection.addNotesVariant2': '+ Add notes',
  'taskCompletionDialog.taskCompletionDialogFooter.completeTask':
    'Complete task',
  'taskCompletionDialog.taskDescriptionSection.optional': ' (optional)',
  'taskCompletionDialog.taskDescriptionSection.showHistory': 'Show history',
  'taskCompletionDialog.taskDescriptionSection.history': 'History',
  'taskCompletionDialog.taskDescriptionSection.eGFinishCs61aPart1TabToAddNotes':
    'e.g. Finish CS61A Part 1 (Tab to add notes or auto-fill)',
  'taskCompletionDialog.taskDescriptionSection.eGFinishCs61aPart1OptionalTabToAdd':
    'e.g. Finish CS61A Part 1 (optional, Tab to add notes)',
  'taskCompletionDialog.taskDescriptionSection.recentDescriptions':
    'Recent descriptions',
  'taskCompletionDialog.taskDescriptionSection.tabToAddNotesOrAutoFillShiftTabForHistory':
    'Tab to add notes or auto-fill, Shift+Tab for history, Enter to complete',
  'taskCompletionDialog.taskDescriptionSection.descriptionOptionalTabToAddNotesEnterToComplete':
    'Description optional; Tab to add notes; Enter to complete',
  'taskGroupEditor.actionButtons.createGroup': 'Create group',
  'taskGroupEditor.basicInfoSection.setTheBasicInformationForThisGroup':
    'Set the basic information for this group',
  'taskGroupEditor.basicInfoSection.groupName': 'Group name',
  'taskGroupEditor.basicInfoSection.giveYourGroupAClearAndRecognizableName':
    'Give your group a clear and recognizable name',
  'taskGroupEditor.basicInfoSection.eGFinalsStudyPlanWebsiteProjectWorkoutPlan':
    'e.g. Finals study plan, Website project, Workout plan',
  'taskGroupEditor.basicInfoSection.groupDescription': 'Group description',
  'taskGroupEditor.basicInfoSection.describeTheGoalAndScopeOfThisGroup':
    'Describe the goal and scope of this group',
  'taskGroupEditor.basicInfoSection.describeTheGoalAndScopeEGFinalsStudyPlan':
    'Describe the goal and scope, e.g. Finals study plan with review, practice problems, and mock exams.',
  'taskGroupEditor.bookingSettingsSection.bookingSettings': 'Booking settings',
  'taskGroupEditor.bookingSettingsSection.configureBookingSignalDurationAndCompletionCondition':
    'Configure booking signal, duration, and completion condition',
  'taskGroupEditor.bookingSettingsSection.completionCondition':
    'Completion condition',
  'taskGroupEditor.bookingSettingsSection.eGOpenTheFirstSubtaskPrepareYourMaterials':
    'e.g. Open the first subtask, prepare your materials',
  'taskGroupEditor.bookingSettingsSection.thisIsTheActionYouMustCompleteDuringBookingSignaling':
    'This is the action you must complete during booking—signaling the start of the group execution.',
  'taskGroupEditor.durationSection.howLongTheBookingPhaseLastsForPreparationAnd':
    'How long the booking phase lasts for preparation and alignment',
  'taskGroupEditor.taskGroupEditorView.editGroup': 'Edit group',
  'taskGroupEditor.taskGroupEditorView.createGroup': 'Create group',
  'taskGroupEditor.taskGroupEditorView.editGroupVariant2': 'EDIT GROUP',
  'taskGroupEditor.taskGroupEditorView.createGroupVariant2': 'CREATE GROUP',
  'taskGroupEditor.taskGroupEditorView.groupSideRsipLinks':
    'Group-side RSIP links',
  'taskGroupEditor.taskGroupEditorView.configureLinksForThisTaskGroupDirectlyInThe':
    'Configure links for this task group directly in the editor. Conflicts use last-write-wins.',
  'taskGroupEditor.taskGroupEditorView.saveThisTaskGroupFirstThenConfigureRsipLinks':
    'Save this task group first, then configure RSIP links here.',
  'useChainDetail.interruptedByUser': 'Interrupted by user',
  'useTaskGroupEditor.pleaseEnterAGroupName': 'Please enter a group name',
  'useTaskGroupEditor.pleaseEnterAGroupDescription':
    'Please enter a group description',
  'useTaskGroupEditor.pleaseChooseABookingSignal':
    'Please choose a booking signal',
  'useTaskGroupEditor.pleaseEnterACustomBookingSignal':
    'Please enter a custom booking signal',
  'useTaskGroupEditor.pleaseEnterABookingCompletionCondition':
    'Please enter a booking completion condition',
  'virtualizedRuleList.createNewRuleItem.createNewRuleSearchQuery':
    'Create new rule: "{searchQuery}"',
  'virtualizedRuleList.createNewRuleItem.createAChainSpecificRule':
    'Create a chain-specific rule',
  'virtualizedRuleList.emptyState.noMatchingRulesFound':
    'No matching rules found',
  'virtualizedRuleList.emptyState.noRulesAvailable': 'No rules available',
  'virtualizedRuleList.emptyState.createSearchQuery': 'Create "{searchQuery}"',
  'virtualizedRuleList.formatting.justNow': 'Just now',
  'virtualizedRuleList.formatting.prefixMatch': 'Prefix match',
  'virtualizedRuleList.formatting.containsMatch': 'Contains match',
  'virtualizedRuleList.formatting.fuzzyMatch': 'Fuzzy match',
  'sessions.completion.saveIsNotConfirmedYourTaskIsRetainedRetry':
    'Save is not confirmed. Your task is retained; retry completion.',
  'sessions.completion.groupCompletedACycle': 'Group completed a cycle',
  'sessions.groupStartFlow.groupHasExpired': 'Group has expired',
  'sessions.groupStartFlow.cycleUpdatedGroupTotalCompletionsCompletedStartingCycleUpdatedGroupTotalCompletionsNext':
    'Cycle {updatedGroupTotalCompletions} completed. Starting cycle {updatedGroupTotalCompletionsNext}.',
  'sessions.scheduling.failedToSchedulePleaseTryAgain':
    'Failed to schedule. Please try again.',
  'sessions.scheduling.scheduleCompleted': 'Schedule completed',
  'sessions.scheduling.failedToCompleteBookingPleaseTryAgain':
    'Failed to complete booking. Please try again.',
  'sessions.start.failedToPersistSessionDatabaseMayBeReadOnlyOr':
    'Failed to persist session: database may be read-only or write is denied (check console).',
  'sessions.start.failedToCreateBettingSessionDatabaseMayBeReadOnly':
    'Failed to create betting session: database may be read-only (check console).',
  'useChainsDomain.saveFailedSafeDetail': 'Save failed: {safeDetail}',
  'useChainsDomain.saveFailedCheckTheConsoleForDetailsThenTry':
    'Save failed. Check the console for details, then try again.',
  'useCheckinDomain.dailyCheckInRequiresLogin': 'Daily check-in requires login',
  'useCheckinDomain.failedToLoadCheckInDataCheckTheConsoleFor':
    'Failed to load check-in data. Check the console for details, then try again.',
  'useCheckinDomain.checkInFailedCheckTheConsoleForDetailsThenTry':
    'Check-in failed. Check the console for details, then try again.',
  'useCheckinDomain.checkedInEarnedResultPointsEarnedPointsStreakResultConsecutiveDaysDays':
    'Checked in! Earned {resultPointsEarned} points. Streak: {resultConsecutiveDays} days.',
  'useCheckinDomain.checkInFailed': 'Check-in failed',
  'useGroupDomain.toastPrefixSafeDetailCheckTheConsoleForDetails':
    '{toastPrefix}: {safeDetail}\n\nCheck the console for details, then try again.',
  'useGroupDomain.copy': '(Copy)',
  'useGroupDomain.failedToUpdateRepeatCount': 'Failed to update repeat count',
  'useGroupDomain.failedToUpdateRepeatCountCheckTheConsoleFor':
    'Failed to update repeat count. Check the console for details, then try again.',
  'useImportExportDomain.authenticationFailedDuringImportPleaseMakeSureYouAre':
    'Authentication failed during import. Please make sure you are signed in and try again.',
  'useImportExportDomain.noValidChainsFoundToImport':
    'No valid chains found to import',
  'useRecycleBinDomain.deleteFailedSafeDetail': 'Delete failed: {safeDetail}',
  'useRecycleBinDomain.deleteFailedCheckTheConsoleForDetailsThenTry':
    'Delete failed. Check the console for details, then try again.',
  'useRecycleBinDomain.couldNotRestoreStateAfterTheErrorRefreshThePage':
    "Couldn't restore state after the error. Refresh the page to recover.",
  'enhancedDuplicationHandler.continue': 'Continue',
  'enhancedDuplicationHandler.checkFailedButYouCanTryCreatingIt':
    'Check failed, but you can try creating it',
  'enhancedDuplicationHandler.duplicateCheckFailed': 'Duplicate check failed',
  'enhancedDuplicationHandler.cannotCreateARuleWithADuplicateName':
    'Cannot create a rule with a duplicate name: "{name}"',
  'errorRecoveryManager.errorRecoveryFailed': 'Error recovery failed',
  'errorRecoveryManager.manualFix': 'Manual fix',
  'errorRecoveryManager.thisRequiresManualIntervention':
    'This requires manual intervention',
  'errorRecoveryManager.manualInterventionRequired':
    'Manual intervention required',
  'duplication.enhancedHandler.creationHandlers.thisIsACommonRulePatternConsiderCheckingFor':
    'This is a common rule pattern; consider checking for existing similar rules',
  'duplication.enhancedHandler.creationHandlers.ruleTypeRuleTypeDoesNotMatchRequested':
    'Rule type ({ruleType}) does not match requested type ({requestedType})',
  'duplication.enhancedHandler.creationHandlers.unableToGenerateAUsableNameSuggestion':
    'Unable to generate a usable name suggestion',
  'duplication.enhancedHandler.creationHandlers.nameChangedToNewName':
    'Name changed to "{newName}"',
  'duplication.enhancedHandler.creationHandlers.similarRulesFoundSimilarNames':
    'Similar rules found: "{similarNames}"',
  'duplication.enhancedHandler.suggestionHelpers.useExistingRule':
    'Use existing rule',
  'duplication.enhancedHandler.suggestionHelpers.useTheExistingRuleExistingRuleName':
    'Use the existing rule "{existingRuleName}"',
  'duplication.enhancedHandler.suggestionHelpers.changeName': 'Change name',
  'duplication.enhancedHandler.suggestionHelpers.useTheSuggestedNameSuggestedName':
    'Use the suggested name "{suggestedName}"',
  'duplication.enhancedHandler.suggestionHelpers.nameIsSimilarButNotIdenticalYouCanContinue':
    'Name is similar but not identical; you can continue creating it',
  'duplication.enhancedHandler.suggestionHelpers.useSimilarRule':
    'Use similar rule',
  'duplication.enhancedHandler.suggestionHelpers.considerUsingTheSimilarRuleMostSimilarName':
    'Consider using the similar rule "{mostSimilarName}"',
  'duplication.enhancedHandler.suggestionHelpers.ruleNameExistingRules0nameAlreadyExists':
    'Rule name "{existingRules0Name}" already exists',
  'duplication.enhancedHandler.suggestionHelpers.foundSimilarRuleNameSSimilarNames':
    'Found similar rule name(s): "{similarNames}"',
  'duplication.enhancedHandler.suggestionHelpers.noConflictDetected':
    'No conflict detected',
  'feedback.errorMessageFormatter.invalidRuleTypePleaseCheckTheRuleSettings':
    'Invalid rule type. Please check the rule settings.',
  'feedback.errorMessageFormatter.validationFailedSafeDetail':
    'Validation failed: {safeDetail}',
  'feedback.errorMessageFormatter.validationFailed': 'Validation failed',
  'feedback.errorMessageFormatter.failedToSaveDataPleaseCheckYourConnectionOr':
    'Failed to save data. Please check your connection or try again.',
  'feedback.errorMessageFormatter.anUnknownErrorOccurred':
    'An unknown error occurred.',
  'feedback.errorMessageFormatter.ruleNotFound': 'Rule not found',
  'feedback.errorMessageFormatter.duplicateRuleName': 'Duplicate rule name',
  'feedback.errorMessageFormatter.ruleTypeMismatch': 'Rule type mismatch',
  'feedback.errorMessageFormatter.invalidRuleType': 'Invalid rule type',
  'feedback.errorMessageFormatter.saveFailed': 'Save failed',
  'feedback.errorMessageFormatter.operationFailed': 'Operation failed',
  'feedback.errorMessageFormatter.theSelectedRuleNoLongerExistsItMayHave':
    'The selected rule no longer exists. It may have been deleted. Please choose another rule or create a new one.',
  'feedback.errorMessageFormatter.theRuleDoesNotExistOrHasBeenDeleted':
    'The rule does not exist or has been deleted. Please choose another rule or create a new one.',
  'feedback.errorMessageFormatter.thisRuleNameAlreadyExistsYouCanUseThe':
    'This rule name already exists. You can use the existing rule or choose a different name.',
  'feedback.errorMessageFormatter.thisRuleNameAlreadyExistsPleaseChooseADifferent':
    'This rule name already exists. Please choose a different name or use the existing rule.',
  'feedback.errorMessageFormatter.thisRuleTypeDoesNotMatchTheCurrentAction':
    'This rule type does not match the current action. Please choose a compatible rule type.',
  'feedback.feedbackPresenter.notCompleted': 'Not completed',
  'feedback.interactiveFeedback.chooseARecoveryAction':
    'Choose a recovery action',
  'feedback.interactiveFeedback.chooseHowToHandleThisIssue':
    'Choose how to handle this issue:',
  'feedback.interactiveFeedback.confirm': 'Confirm',
  'feedback.interactiveFeedback.viewErrorDetails': 'View error details',
  'feedback.interactiveFeedback.errorDetails': 'Error details',
  'importExport.import.chains.invalidImportFormatNoValidChainsFound':
    'Invalid import format: no valid chains found',
  'importExport.import.chains.importDataContainsDuplicateChainIdSourceId':
    'Import data contains duplicate chain ID: {sourceId}',
  'importExport.import.chains.untitledChain': 'Untitled chain',
  'importExport.import.payload.invalidImportFormatFileContentIsNotAnObject':
    'Invalid import format: file content is not an object.',
  'importExport.import.rsipCore.untitledPolicy': 'Untitled policy',
  'migration.migrationAnalyzer.failedToGetMigrationSuggestionsCheckDataIntegrity':
    'Failed to get migration suggestions. Check data integrity.',
  'migration.migrationAnalyzer.foundDuplicateRulesCountDuplicatedRuleSDuplicatesWillBeMergedAfter':
    'Found {duplicateRulesCount} duplicated rule(s); duplicates will be merged after migration',
  'migration.migrationAnalyzer.manyRulesDetectedConsiderOrganizingAndCategorizingThemAfter':
    'Many rules detected; consider organizing and categorizing them after migration',
  'migration.migrationAnalyzer.foundCommonPatternsCountCommonPatternRuleSConsiderStandardizingNaming':
    'Found {commonPatternsCount} common-pattern rule(s); consider standardizing naming',
  'migration.migrationAnalyzer.dataLooksGoodYouCanMigrateDirectly':
    'Data looks good; you can migrate directly',
  'migration.migrationAnalyzer.missingMigrationRecord':
    'Missing migration record',
  'migration.migrationAnalyzer.migratedRuleCountMismatchExpectedMigrationInfoTotalRulesGotMigratedRulesCount':
    'Migrated rule count mismatch: expected {migrationInfoTotalRules}, got {migratedRulesCount}',
  'migration.migrationAnalyzer.ruleRuleIdDataIsIncomplete':
    'Rule {ruleId} data is incomplete',
  'migration.migrationAnalyzer.validationErrorOccurredCheckConsoleForDetails':
    'Validation error occurred. Check console for details.',
  'migration.migrationAnalyzer.exceptionRuleMigrationReport':
    'Exception Rule Migration Report',
  'migration.migrationExecutor.analyzingExistingData':
    'Analyzing existing data...',
  'migration.migrationExecutor.noDataToMigrate': 'No data to migrate',
  'migration.migrationExecutor.startingMigrationForExceptionRulesFromResultTotalChainsChainS':
    'Starting migration for exception rules from {resultTotalChains} chain(s)...',
  'migration.migrationExecutor.migrationDoneSavingMigrationInfo':
    'Migration done. Saving migration info...',
  'migration.migrationExecutor.migrationCompletedCreatedResultMigratedRulesRuleS':
    'Migration completed! Created {resultMigratedRules} rule(s)',
  'migration.migrationExecutor.creatingRuleRuleName':
    'Creating rule: {ruleName}',
  'migration.migrationExecutor.noMigrationRecordFound':
    'No migration record found',
  'migration.migrationExecutor.rollbackSucceededDeletedDeletedCountRuleS':
    'Rollback succeeded. Deleted {deletedCount} rule(s)',
  'migration.migrationExecutor.rollbackFailed': 'Rollback failed',
  'migration.migrationExecutor.operationFailedCheckConsoleForDetails':
    'Operation failed. Check console for details.',
  'platform.systemNotificationService.taskFailed': 'Task failed',
  'platform.systemNotificationService.taskEndingSoon': 'Task ending soon',
  'platform.systemNotificationService.scheduleExpiring': 'Schedule expiring',
  'platform.systemNotificationService.scheduleFailed': 'Schedule failed',
  'recovery.defaultStrategies.unableToAutoRecoverTheMissingRule':
    'Unable to auto-recover the missing rule',
  'recovery.defaultStrategies.duplicateRuleNameDetected':
    'Duplicate rule name detected',
  'recovery.defaultStrategies.ruleTypeDoesNotMatchTheAction':
    'Rule type does not match the action',
  'recovery.defaultStrategies.autoFixedSuccessCountDataIssueS':
    'Auto-fixed {successCount} data issue(s)',
  'recovery.defaultStrategies.storageErrorRequiresManualHandling':
    'Storage error requires manual handling',
  'recovery.defaultStrategies.validationRequiresYourConfirmation':
    'Validation requires your confirmation',
  'recovery.defaultStrategies.fixValidationIssues': 'Fix validation issues',
  'recovery.defaultStrategies.tryToFixValidationIssues':
    'Try to fix validation issues',
  'recovery.defaultStrategies.unknownErrorTypeErrorType':
    'Unknown error type: {errorType}',
  'recovery.defaultStrategies.checkDataIntegrity': 'Check data integrity',
  'recovery.defaultStrategies.checkAndRepairRuleData':
    'Check and repair rule data',
  'recovery.defaultStrategies.allAutoRecoveryStrategiesFailed':
    'All auto-recovery strategies failed',
  'recovery.defaultStrategies.resetSystem': 'Reset system',
  'recovery.defaultStrategies.resetTheRuleSystemToTheInitialState':
    'Reset the rule system to the initial state',
  'recovery.recoveryHandlers.pleaseCreateANewRule': 'Please create a new rule',
  'recovery.recoveryHandlers.pleaseSelectAnExistingRule':
    'Please select an existing rule',
  'recovery.recoveryHandlers.usingExistingRule': 'Using existing rule',
  'recovery.recoveryHandlers.noUsableExistingRuleFound':
    'No usable existing rule found',
  'recovery.recoveryHandlers.suggestedNameSuggestionsItem':
    'Suggested name: {suggestionsItem}',
  'recovery.recoveryHandlers.unableToGenerateANewRuleName':
    'Unable to generate a new rule name',
  'recovery.recoveryHandlers.pleaseCreateARuleWithTheCorrectType':
    'Please create a rule with the correct type',
  'recovery.recoveryHandlers.pleaseSelectARuleWithAMatchingType':
    'Please select a rule with a matching type',
  'recovery.recoveryHandlers.pleaseRetryTheOperation':
    'Please retry the operation',
  'recovery.recoveryHandlers.dataIntegrityCheckPassed':
    'Data integrity check passed',
  'recovery.recoveryHandlers.foundReportIssuesCountIssueSAutoFixableCountCanBeAutoFixed':
    'Found {reportIssuesCount} issue(s), {autoFixableCount} can be auto-fixed',
  'recovery.recoveryHandlers.autoFix': 'Auto-fix',
  'recovery.recoveryHandlers.automaticallyFixTheFixableIssues':
    'Automatically fix the fixable issues',
  'recovery.recoveryHandlers.fixedSuccessCountIssueS':
    'Fixed {successCount} issue(s)',
  'recovery.recoveryHandlers.dataIntegrityCheckFailed':
    'Data integrity check failed',
  'recovery.recoveryHandlers.fixingValidationRequiresYourInput':
    'Fixing validation requires your input',
  'recovery.recoveryHandlers.systemResetIsRiskyAndRequiresConfirmation':
    'System reset is risky and requires confirmation',
  'recovery.recoveryOptionsProvider.createNewRule': 'Create new rule',
  'recovery.recoveryOptionsProvider.createANewRuleToReplaceTheMissingOne':
    'Create a new rule to replace the missing one',
  'recovery.recoveryOptionsProvider.selectExistingRule': 'Select existing rule',
  'recovery.recoveryOptionsProvider.chooseOneFromExistingRules':
    'Choose one from existing rules',
  'recovery.recoveryOptionsProvider.useTheExistingRuleWithTheSameName':
    'Use the existing rule with the same name',
  'recovery.recoveryOptionsProvider.renameRule': 'Rename rule',
  'recovery.recoveryOptionsProvider.generateADifferentNameForTheNewRule':
    'Generate a different name for the new rule',
  'recovery.recoveryOptionsProvider.createCorrectType': 'Create correct type',
  'recovery.recoveryOptionsProvider.createANewRuleWithAMatchingType':
    'Create a new rule with a matching type',
  'recovery.recoveryOptionsProvider.selectMatchingRule': 'Select matching rule',
  'recovery.recoveryOptionsProvider.selectAnExistingRuleWithAMatchingType':
    'Select an existing rule with a matching type',
  'recovery.recoveryOptionsProvider.tryTheOperationAgain':
    'Try the operation again',
  'recovery.recoveryOptionsProvider.runADataIntegrityCheckAndAutoFixIfPossible':
    'Run a data integrity check and auto-fix if possible',
  'ruleManager.ruleCreator.ruleCreatedViaErrorRecovery':
    'Rule created via error recovery',
  'ruleManager.ruleMaintenanceService.similarRulesFoundSimilarRuleNames':
    'Similar rules found: {similarRuleNames}',
  'ruleManager.ruleMaintenanceService.noActiveExceptionRules':
    'No active exception rules',
  'ruleManager.ruleMaintenanceService.rulesExistButNoUsageRecords':
    'Rules exist but no usage records',
  'ruleManager.ruleMaintenanceService.noRulesUsedInTheLast30Days':
    'No rules used in the last 30 days',
  'ruleManager.ruleMaintenanceService.duplicateRuleNamesFoundDuplicateNames':
    'Duplicate rule names found: {duplicateNames}',
  'ruleManager.ruleMaintenanceService.systemCheckFailed':
    'System check failed: ',
  'storage.storageContext.supabaseIsNotConfiguredSoCloudModeIsUnavailable':
    'Supabase is not configured, so cloud mode is unavailable.',
  'storage.storageContext.failedToLoadCloudStorageSwitchedBackToLocal':
    'Failed to load cloud storage. Switched back to local mode.',
  'storage.storageContext.initializingStorage': 'Initializing storage…',
  'types.exceptionRuleErrors.contactSupport': 'Contact support',
  'types.exceptionRuleErrors.aCriticalErrorOccurredPleaseContactSupport':
    'A critical error occurred. Please contact support.',
  'platformAdapters.updater.newVersionFoundUpdatingAndRestarting':
    'New version found. Updating and restarting…',
  'importUnitsModal.controllerSelectedUnitsSizeSelectedModeLabel':
    '{controllerSelectedUnitsSize} selected ({modeLabel})',
  'ruleItem.diffDaysDAgo': '{diffDays}d ago',
  'ruleItem.weeksWAgo': '{weeks}w ago',
  'ruleItem.monthsMoAgo': '{months}mo ago',
  'auxiliaryJudgment.auxiliaryJudgmentActions.bookingStreakResetsFromPropsChainAuxiliaryStreakTo0':
    'Booking streak resets from #{propsChainAuxiliaryStreak} to #0',
  'bettingModal.bettingFormSections.betAmountPts': '≈ {betAmount} pts',
  'bettingModal.useBetPlacementForm.betPlacedBetNumAmountPointsPotentialPayoutResultValuePotentialPayoutPoints':
    'Bet placed! Bet {numAmount} points, potential payout {resultValuePotentialPayout} points',
  'groupCard.groupCardSummary.groupTotalCompletionsCycles':
    '#{groupTotalCompletions} cycles',
  'groupCard.groupCardSummary.cycleGroupTotalCompletions1InProgress':
    '• Cycle {groupTotalCompletions1} in progress',
  'groupView.groupOverview.completedGroupTotalCompletionsCycles':
    'Completed {groupTotalCompletions} cycles',
  'groupView.groupOverview.progressCompletedProgressTotalRepeats':
    '({progressCompleted}/{progressTotal} repeats)',
  'groupView.groupViewHeader.cyclePropsGroupTotalCompletions1InProgress':
    '🔄 Cycle {propsGroupTotalCompletions1} in progress',
  'recycleBinModal.bulkActionsBar.selectedChainsCountSelected':
    '{selectedChainsCount} selected',
  'recycleBinModal.timeFormat.diffMinutesMinAgo': '{diffMinutes} min ago',
  'ruleSelectionDialog.chainInfoCard.elapsedMathFloorSessionContextElapsedTime60Min':
    'Elapsed {mathFloorSessionContextElapsedTime60} min',
  'ruleSelectionDialog.chainInfoCard.mathFloorSessionContextRemainingTime60MinRemaining':
    ', {mathFloorSessionContextRemainingTime60} min remaining',
  'ruleSelectionDialog.dialogHeader.chooseARuleForActionLabel':
    'Choose a rule for {actionLabel}',
  'virtualizedRuleList.formatting.diffHoursHAgo': '{diffHours}h ago',
  'feedback.interactiveFeedback.operationCompleted': '{operation} completed',
  'feedback.interactiveFeedback.totalTotalSucceededSuccess':
    'Total {total}, succeeded {success}',
  'feedback.interactiveFeedback.failedFailed': ', failed {failed}',
  'platform.systemNotificationService.quotedChainNameReason':
    '{quotedChainName}: {reason}',
  'platform.systemNotificationService.chainNameCompletedSuffixCurrentStreakStreak':
    '"{chainName}" completed!{suffix} Current streak: #{streak}',
  'platform.systemNotificationService.chainNameHasTimeRemainingLeftStayFocused':
    '"{chainName}" has {timeRemaining} left. Stay focused!',
  'platform.systemNotificationService.chainNameScheduleHasTimeRemainingLeftGetReady':
    '"{chainName}" schedule has {timeRemaining} left. Get ready to start!',
  'platform.systemNotificationService.chainNameScheduleExpiredAdjudicationRequired':
    '"{chainName}" schedule expired. Adjudication required.',
} as const;

export type TranslationKey = keyof typeof enTranslations;

const zhTranslations = {
  'rsip.splitTemplate.message1': '早睡早起',
  'rsip.splitTemplate.message2': '23:00 前入睡',
  'rsip.splitTemplate.message3': '22:45 开始睡前流程，23:00 前上床。',
  'rsip.splitTemplate.message4': '睡前断屏',
  'rsip.splitTemplate.message5': '22:30 后手机仅保留闹钟功能。',
  'rsip.splitTemplate.message6': '稳定运动',
  'rsip.splitTemplate.message7': '回家立刻换运动服',
  'rsip.splitTemplate.message8': '下班到家 10 分钟内换好运动服。',
  'rsip.splitTemplate.message9': '最低运动量',
  'rsip.splitTemplate.message10': '每天至少完成 10 分钟步行或拉伸。',
  'rsip.splitTemplate.message11': '饮食控制',
  'rsip.splitTemplate.message12': '提前备餐',
  'rsip.splitTemplate.message13': '工作日晚间准备次日午餐。',
  'rsip.splitTemplate.message14': '晚间零食拦截',
  'rsip.splitTemplate.message15': '21:00 后不摄入高糖零食。',
  'rsip.interaction.message1':
    '国策已执行，是否联动任务「{targetChainName}」？',
  'rsip.interaction.message2':
    '国策组「{groupTitle}」仍有容错余量，本次违反不会导致整组崩溃。',
  'rsip.interaction.message3':
    '国策组「{groupTitle}」容错已耗尽，本次违反会触发整组崩溃。',
  'rsip.rsipPolicyLibrary.status':
    '内化进度 {progress}% · 累计执行 {days} 天 · 使用 {times} 次',
  'rsip.rsipModeSwitch.mode': 'RSIP 模式',
  'rsip.rsipModeSwitch.strictMode': '严格模式',
  'rsip.rsipModeSwitch.description':
    '启用完整的递归稳态迭代协议：定式执行追踪、稳态阶段升级、约束力可视化、每日打卡提醒。',
  'rsip.rsipModeSwitch.free': '自由',
  'rsip.rsipModeSwitch.strict': '严格',
  'rsip.rsipPhaseBadge.new': 'E0 新建',
  'rsip.rsipPhaseBadge.stable': 'E1 稳定',
  'rsip.rsipPhaseBadge.internalized': 'E2 内化',
  'rsip.rsipConstraintIndicator.descendants': '{count} 子节点',
  'rsip.rsipConstraintIndicator.failureCost': '代价 {cost}',
  'rsip.rsipDailyReminder.notOpenedToday': '今日尚未查看国策树',
  'rsip.rsipDailyReminder.streak': '连续 {days} 天打卡',
  'rsip.rsipDailyReminder.checkInNow': '立即打卡',
  'rsip.rsipPhaseProgress.internalized': '已内化',
  'rsip.rsipPhaseProgress.complete': '完成',
  'rsip.rsipPhaseProgress.days': '{days}/{threshold} 天',
  'rsip.rsipViolationDialog.reinforcementWarning':
    '当前节点有强化层，违反后将先扣除 1 层（+{currentLevel} -> +{nextLevel}）。',
  'rsip.rsipViolationDialog.removalWarning':
    '将删除 {count} 个节点（当前节点及其子孙）。',
  'rsip.rsipRunHistory.collapseNodeTitle': '（{title}）',
  'rsip.rsipRunHistory.durationDays': '{days} 天',
  'rsip.rsipRunHistory.runNumber': '第 {number} 轮',
  'rsip.rsipRunHistory.runSummary': '持续 {days} 天 · 峰值节点 {count}',
  'rsip.rsipStrictModeCard.reinforce': '强化 +1',
  'rsip.rsipStrictModeCard.executed': '已执行',
  'rsip.rsipStrictModeCard.violated': '已违反',
  'errors.detail.databaseReadOnly':
    '数据库处于只读模式，写入被拒绝（可能是 Supabase 免费额度/磁盘空间/项目状态导致）。请到 Supabase Dashboard 检查用量与项目状态。',
  'errors.detail.network':
    '网络错误：无法连接到 Supabase，请检查网络或稍后重试。',
  'errors.detail.auth': '登录状态异常或已过期，请重新登录后再试。',
  'errors.detail.rls':
    '权限不足（RLS 拒绝）。请确认已登录，并检查 Supabase 的 RLS Policy 是否允许当前操作。',
  'errors.detail.timeLimitRequired':
    '任务群保存失败：需要设置时间限制（timeLimitHours）。可先用默认值 24 小时。',
  'errors.detail.timeLimitPositive':
    '任务群保存失败：时间限制必须是正数（建议 1-168 小时）。',
  'errors.detail.rateLimited': '请求过于频繁（429），请稍后重试。',
  'errors.detail.projectPaused':
    'Supabase 项目可能处于暂停/唤醒中，请等待片刻再试。',
  'errors.detail.code': '错误码: {code}',

  'rsipInsights.recommendations.grouping.title': '建立国策组并配置容错',
  'rsipInsights.recommendations.grouping.rationale':
    '节点多且未分组时，级联风险难以控制。',
  'rsipInsights.recommendations.grouping.createGroups':
    '先为相关分支建立 1-2 个国策组。',
  'rsipInsights.recommendations.grouping.faultTolerance':
    '每组先从容错 = 1 开始。',
  'rsipInsights.recommendations.grouping.relatedNodes':
    '将高度相关的节点放入同一组。',
  'rsipInsights.recommendations.reinforcement.title': '强化稳定 E2 节点',
  'rsipInsights.recommendations.reinforcement.rationale':
    '稳定但未强化的节点，通过少量投入即可显著提高抗回滚能力。',
  'rsipInsights.recommendations.reinforcement.prioritizeNodes':
    '优先强化这些节点：{nodes}',
  'rsipInsights.recommendations.reinforcement.weeklyLevel':
    '每成功执行一周增加 1 层强化。',
  'rsipInsights.recommendations.passive.title': '增加被动护栏',
  'rsipInsights.recommendations.passive.rationale':
    '近期存在违约且被动国策覆盖率偏低，环境护栏可以降低摩擦。',
  'rsipInsights.recommendations.passive.unstableBranches':
    '每条不稳定分支至少增加 1 条被动国策。',
  'rsipInsights.recommendations.passive.preferAutomation':
    '优先使用自动化/环境改造，降低意志力负担。',
  'rsipInsights.recommendations.passive.markNodes':
    '显式标记被动节点，便于追踪。',
  'rsipInsights.recommendations.automation.title': '启用 RSIP-任务流程联动',
  'rsipInsights.recommendations.automation.rationale':
    '当前未检测到活动链接，事件驱动同步可提升一致性与执行效率。',
  'rsipInsights.recommendations.automation.startWithTaskCompleted':
    '先配置 task_completed -> mark_rsip_executed。',
  'rsipInsights.recommendations.automation.addPromptStartChain':
    '关键任务再加 rsip_mark_executed -> prompt_start_chain。',
  'rsipInsights.recommendations.automation.keepConfirmMode':
    'RSIP->任务侧初期保持 confirm 模式。',
  'rsipInsights.recommendations.rebuild.title': '使用国策库辅助重建',
  'rsipInsights.recommendations.rebuild.rationale':
    '轮次趋势下滑，优先恢复已验证国策，而不是只新增新国策。',
  'rsipInsights.recommendations.rebuild.restoreLibraryEntries':
    '从国策库恢复 1-2 条高内化条目。',
  'rsipInsights.recommendations.rebuild.limitNewHighRiskPolicies':
    '本周避免引入超过 1 条新的高风险国策。',
  'rsipInsights.recommendations.fallback.sleep':
    '替代方案：先固定起床时间，再逐步提前入睡。',
  'rsipInsights.recommendations.fallback.exercise':
    '替代方案：使用 5 分钟最低运动版本。',
  'rsipInsights.recommendations.fallback.diet':
    '替代方案：每天先替换 1 个高糖项目。',
  'rsipInsights.recommendations.fallback.default':
    '替代方案：先降级为 10 分钟版本，持续 7 天。',
  'rsipInsights.recommendations.ruralFirst.title':
    '农村包围城市重启：先稳住低成本国策',
  'rsipInsights.recommendations.ruralFirst.rationale':
    '近期违约/崩溃表明高成本中心节点不稳定，应从低成本、高成功率的边缘国策重建。',
  'rsipInsights.recommendations.ruralFirst.freezeNodes':
    '临时冻结高风险节点：{nodes}',
  'rsipInsights.recommendations.ruralFirst.freezeUnstablePolicy':
    '先冻结 1 个不稳定核心国策 3-7 天。',
  'rsipInsights.recommendations.ruralFirst.prioritizeCandidates':
    '优先推进这些低成本候选：{nodes}',
  'rsipInsights.recommendations.ruralFirst.promoteLowCostPolicies':
    '优先推进 2-3 个 failure cost <= 2.5 的低成本国策。',
  'rsipInsights.recommendations.split.title': '拆分高风险国策：{title}',
  'rsipInsights.recommendations.split.rationale':
    '高失败成本叠加高违约频率，说明该国策粒度过大。',
  'rsipInsights.recommendations.split.microPolicies':
    '使用拆分流程拆成 3-5 条微国策。',
  'rsipInsights.recommendations.split.passiveGuardrail':
    '至少包含 1 条被动护栏型国策。',
  'rsipInsights.recommendations.split.executionTime':
    '确保每条子国策能在 10-20 分钟内执行。',
  'rsipInsights.listSeparator': '、',
  'chainEditor.presets.trigger.headphones': '戴上降噪耳机',
  'chainEditor.presets.trigger.ide': '打开编程软件',
  'chainEditor.presets.trigger.desk': '坐到书房书桌前',
  'chainEditor.presets.trigger.workoutClothes': '换上运动服',
  'chainEditor.presets.trigger.coffee': '准备一杯咖啡',
  'chainEditor.presets.trigger.custom': '自定义触发器',
  'chainEditor.presets.signal.snapFingers': '打响指',
  'chainEditor.presets.signal.phoneAlarm': '设置手机闹钟',
  'chainEditor.presets.signal.deskBell': '按桌上的铃铛',
  'chainEditor.presets.signal.startBooking': '说"开始预约"',
  'chainEditor.presets.signal.custom': '自定义信号',
  'chainEditor.presets.trigger.taskGroupContainer': '任务群容器',
  'chainEditor.presets.trigger.firstSubtask': '开始第一个子任务',
  'chainTree.types.unit': '基础单元',
  'chainTree.types.group': '任务群',
  'chainTree.types.assault': '突击单元',
  'chainTree.types.recon': '侦查单元',
  'chainTree.types.command': '指挥单元',
  'chainTree.types.special_ops': '特勤单元',
  'chainTree.types.engineering': '工程单元',
  'chainTree.types.quartermaster': '炊事单元',
  'intro.nav.signIn': '登录',
  'intro.nav.signUp': '注册',
  'intro.nav.startJourney': '开启旅程',
  'intro.nav.startJourneySubtext': '开源项目，免费使用。',
  'intro.hero.tag': 'MOMENTUM v2.0',
  'intro.hero.titleline1': '掌控你的',
  'intro.hero.titleline2': '专注协议',
  'intro.hero.desc':
    '基于数学模型的自制力解决方案。通过 CTDP 科学模型彻底破解拖延症。',
  'intro.theory.title': '理论基石',
  'intro.theory.desc': '行为经济学的数学框架。',
  'intro.theory.modelTitle': '积分模型',
  'intro.theory.insightTitle': '关键洞察',
  'intro.theory.insightDesc':
    '大脑倾向于短期多巴胺奖励。我们修正权重函数 W(τ) 以重塑长期价值优先级。',
  'intro.theory.valueFunc.title': '价值函数 V(τ)',
  'intro.theory.valueFunc.desc': '未来价值估算',
  'intro.theory.weightFunc.title': '权重函数 W(τ)',
  'intro.theory.weightFunc.desc': '时间偏好贴现',
  'intro.theory.cards.social.title': '干扰源',
  'intro.theory.cards.social.desc': '高冲动 · 净负值',
  'intro.theory.cards.work.title': '深度工作',
  'intro.theory.cards.work.desc': '低冲动 · 净正值',
  'intro.principles.title': '核心法则',
  'intro.principles.list.0.title': '神圣座位',
  'intro.principles.list.0.desc': '价值压缩',
  'intro.principles.list.0.detail': '将整个链条的价值绑定到单一触发动作。',
  'intro.principles.list.1.title': '判例法',
  'intro.principles.list.1.desc': '二元约束',
  'intro.principles.list.1.detail': '对破窗效应零容忍。要么重置，要么允许。',
  'intro.principles.list.2.title': '线性时延',
  'intro.principles.list.2.desc': '阻力平移',
  'intro.principles.list.2.detail': '利用15分钟缓冲期绕过启动惯性。',
  'intro.features.title': '系统模块',
  'intro.features.desc': '为心流状态而工程化设计。',
  'intro.features.list.0.title': '链条管理',
  'intro.features.list.0.desc': '独立的执行线程。',
  'intro.features.list.1.title': '预约系统',
  'intro.features.list.1.desc': '启动惯性缓冲。',
  'intro.features.list.2.title': '规则判决',
  'intro.features.list.2.desc': '严格的逻辑执行。',
  'intro.features.list.3.title': '数据分析',
  'intro.features.list.3.desc': '可视化的进阶。',
  'intro.benefits.title': '为何选择',
  'intro.benefits.list.0.title': '科学构建',
  'intro.benefits.list.0.desc': '经数学验证的模型。',
  'intro.benefits.list.1.title': '即时生效',
  'intro.benefits.list.1.desc': '零适应时间。',
  'intro.benefits.list.2.title': '持久稳固',
  'intro.benefits.list.2.desc': '反脆弱设计。',
  'intro.openProject': '在 GitHub 打开项目',
  'intro.features.heading': '为心流状态而工程化设计的系统',
  'intro.localMode': '切换到本地模式',
  'intro.scrollDown': '向下滚动',
  'intro.theory.heading': '用数学重构自制力',
  'intro.principles.heading': '三大法则',
  'intro.illustration.title': 'Proof, not vibes.',
  'intro.illustration.diagramAlt': 'CTDP 积分模型图',
  'time.hoursMinutes': '{hours}小时{minutes}分钟',
  'time.hours': '{hours}小时',
  'time.minutes': '{minutes}分钟',
  'time.minutesSeconds': '{minutes}分钟{seconds}秒',
  'time.seconds': '{seconds}秒',
  'time.lessThanMinute': '不到1分钟',
  'time.spent': '完成用时：{duration}',
  'time.last': '上次用时：{duration}',
  'time.first': '首次执行',
  'time.expired': '已过期',
  'time.unlimited': '无时间限制',
  'time.noFixedDuration': '无固定时长',
  'time.minimumDuration': '{label}（至少 {minimum}）',
  'time.dayAgo': '{count}天前',
  'time.daysAgo': '{count}天前',
  'time.hourAgo': '{count}小时前',
  'time.hoursAgo': '{count}小时前',
  'pet.stage.egg': '蛋',
  'pet.stage.baby': '幼崽',
  'pet.stage.child': '幼年',
  'pet.stage.teen': '少年',
  'pet.stage.adult': '成年',
  'pet.stage.elder': '元老',
  'pet.stats.fullness': '饱食度',
  'pet.stats.happiness': '快乐值',
  'pet.stats.health': '健康值',
  'rsip.type.policy': '国策',
  'rsip.type.habit': '习惯',
  'rsip.type.reward': '奖励',
  'rsip.type.penalty': '惩罚',
  'rsip.type.ritual': '仪式',
  'rsip.type.goal': '目标',
  'rsip.type.trigger': '触发器',
  'rsip.type.reminder': '提醒',
  'duplication.nameSuffix.new': '新',
  'duplication.nameSuffix.spare': '备用',
  'duplication.nameSuffix.temp': '临时',
  'duplication.nameSuffix.special': '特殊',
  'counts.completion': '{count} 次完成',
  'counts.completions': '{count} 次完成',
  'counts.ruleAvailable': '{count} 个可用规则',
  'counts.rulesAvailable': '{count} 个可用规则',
  'counts.recycleItem': '回收箱 • {count} 项',
  'counts.recycleItems': '回收箱 • {count} 项',
  'counts.ruleUsedOnce': '使用 {count} 次',
  'counts.ruleUsedMany': '使用 {count} 次',
  'counts.rulePreviouslyUsedOnce': '使用过 {count} 次',
  'counts.rulePreviouslyUsedMany': '使用过 {count} 次',
  'counts.entries': '{count} 条',
  'dashboard.hero.protocolDescription':
    '基于链式时延协议理论，通过{sacredSeat}、{precedent}和{timeDelay}，帮助你建立强大的习惯链条',
  'dashboard.hero.sacredSeat': '神圣座位原理',
  'dashboard.hero.precedent': '下必为例原理',
  'dashboard.hero.timeDelay': '线性时延原理',
  'export.chainCountOne': '当前共有 {count} 条任务链',
  'export.chainCountMany': '当前共有 {count} 条任务链',
  'sessions.pauseResume.saveFailed': '暂停或恢复尚未保存，请重试。',
  'chainEditor.description.title': '任务描述',
  'chainEditor.description.hint': '详细描述任务内容和目标',
  'chainEditor.description.placeholder':
    '具体要做什么？例如：完成 CS61A 项目的第一部分',
  'common.loading': '加载中…',
  'common.back': '返回',
  'chainEditor.editTitle': '编辑链条',
  'chainEditor.createTitle': '创建新链条',
  'chainEditor.editSubtitle': '编辑链条',
  'chainEditor.createSubtitle': '创建链条',
  'language.english': '英文',
  'language.chinese': '中文',
  'settings.diagnostics.title': '本地诊断',
  'settings.diagnostics.description':
    '仅在此设备保留最近 7 天最多 200 条错误类别和耗时记录，不含账号信息、任务内容、网址或错误原文，不会自动发送。',
  'settings.diagnostics.export': '导出诊断',
  'settings.diagnostics.clear': '清除诊断',
  'settings.diagnostics.saved': '诊断已导出。',
  'settings.diagnostics.failed': '导出失败，请重试。',
  'settings.diagnostics.cleared': '诊断已清除。',
  'settings.title': '个人设置',
  'settings.button': '设置',
  'settings.language.title': '语言',
  'settings.language.description': '选择界面显示语言',
  'dashboard.hero.nextStep': '选择一条任务链开始',
  'app.appShell.appShellView.initializing': '正在初始化…',
  'app.appShell.appShellView.initializingApplication': '正在初始化应用',
  'app.appShell.appShellView.skipToMainContent': '跳转到主要内容',
  'app.appShell.appShellView.unknownTask': '未知任务',
  'accountModal.usingLocalStorageNoAccountRequired':
    '当前使用本地存储模式，无需账号登录',
  'accountModal.loadingAccount': '正在获取账号信息...',
  'accountModal.retryLoadingUserInfo': '重试加载用户信息',
  'accountModal.retry': '重试',
  'accountModal.userInfoNotFound': 'User info not found',
  'accountModal.close': '关闭',
  'authForm.accountCreatedPleaseCheckYourEmailToConfirm':
    '账号已创建！请检查邮箱完成确认。',
  'authForm.signUpFailedCheckTheConsoleForDetailsThen':
    '注册失败，请重试（详情见控制台）',
  'authForm.signInFailedCheckTheConsoleForDetailsThen':
    '登录失败，请重试（详情见控制台）',
  'authForm.anUnexpectedErrorOccurredCheckTheConsoleForDetails':
    '发生了意外错误（详情见控制台）',
  'authForm.goBack': '返回',
  'authForm.createAccount': '创建账号',
  'authForm.welcomeBack': '欢迎回来',
  'authForm.startYourJourneyToMastery': '开启你的掌控之旅',
  'authForm.enterYourCredentialsToContinue': '输入账号信息以继续',
  'authForm.email': '邮箱',
  'authForm.enterYourEmail': '输入邮箱地址',
  'authForm.password': '密码',
  'authForm.enterYourPassword': '输入密码',
  'authForm.hidePassword': '隐藏密码',
  'authForm.showPassword': '显示密码',
  'authForm.signIn': '登录',
  'authForm.alreadyHaveAnAccount': '已有账号？',
  'authForm.donTHaveAnAccount': '没有账号？',
  'authForm.switchToSignIn': '切换到登录',
  'authForm.switchToSignUp': '切换到注册',
  'authForm.signUp': '注册',
  'authForm.switchToLocalMode': '切换到本地模式',
  'authWrapper.authenticating': '正在验证身份…',
  'authWrapper.authenticatingVariant2': '验证中',
  'auxiliaryJudgment.bookingRuleAdjudication': '辅助链规则判定',
  'auxiliaryJudgment.bookingRuleAdjudicationVariant2': '辅助链规则判定',
  'auxiliaryJudgment.itLooksLikeYourBehaviorDidNotMatchTheBooking':
    '你似乎做出了与预约承诺不符的行为。请描述具体情况并选择处理方式：',
  'auxiliaryJudgment.signal': '预约信号',
  'auxiliaryJudgment.completion': '完成条件',
  'auxiliaryJudgment.duration': '预约时长',
  'auxiliaryJudgment.chainAuxiliaryDurationMin': '{chainAuxiliaryDuration}分钟',
  'auxiliaryJudgment.userInterruptedBooking': '用户主动中断预约',
  'chunkLoadErrorBoundary.theAppWasUpdatedPleaseReload':
    '应用资源已更新，请重新加载。',
  'chunkLoadErrorBoundary.theAppHitAnErrorPleaseReload':
    '页面出现异常，请重新加载。',
  'chunkLoadErrorBoundary.aVersionMismatchWasDetectedThisUsuallyHappensAfter':
    '检测到资源版本不一致，这通常发生在新版本发布后。',
  'chunkLoadErrorBoundary.theCurrentViewCannotContinueRenderingReloadUsuallyRecovers':
    '当前页面无法继续渲染，刷新后通常可以恢复。',
  'chunkLoadErrorBoundary.reloadApp': '重新加载应用',
  'dailyCheckin.loadingCheckInData': '加载签到数据...',
  'dailyCheckin.dailyCheckInUnavailable': '签到功能暂不可用',
  'dailyCheckin.toggleCheckIn': '展开/折叠签到',
  'dailyCheckin.dailyCheckIn': '每日签到',
  'dailyCheckin.refresh': '刷新数据',
  'dailyCheckin.checkInNow': '立即签到',
  'dailyCheckin.checkingIn': '签到中...',
  'dailyCheckin.bestStreak': '最佳记录：连续',
  'dailyCheckin.days': '天',
  'dailyCheckinDemo.demoMode': '🚀 演示模式',
  'dailyCheckinDemo.dailyCheckIn10Points': '每日签到 +10 积分',
  'dailyCheckinDemo.checkInDailyToEarn10PointsStreaksEarn':
    '每日签到获得 10 积分，连续签到获得更多奖励',
  'dailyCheckinDemo.demoNotes': '演示模式说明',
  'dailyCheckinDemo.thisIsADemoVersionOfDailyCheckInTo':
    '这是签到功能的演示版本。要使用真实功能，请配置 Supabase 环境变量并运行数据库迁移。配置完成后，此演示版本将被正式版本自动替换。',
  'deletedChainCard.currentStreak': '当前连击',
  'deletedChainCard.totalCompletions': '总完成数',
  'deletedChainCard.deleted': '删除时间',
  'deletedChainCard.automaticallyDeletedAfter30Days': '30天后将自动永久删除',
  'deletedChainCard.restore': '恢复',
  'deletedChainCard.delete': '删除',
  'importExportModalView.dataManagement': '数据管理',
  'importExportModalView.dataManagementVariant2': '数据管理',
  'importExportModalView.export': '导出数据',
  'importExportModalView.import': '导入数据',
  'importExportModalView.useSystemFilePicker': '使用系统文件选择器',
  'importUnitsModal.copy': '复制模式',
  'importUnitsModal.move': '移动模式',
  'notificationToggle.systemNotifications': '系统通知',
  'notificationToggle.toggleSystemNotifications': '切换系统通知',
  'rsipView.rsipPolicyTree': '国策树 · RSIP',
  'rsipView.rsipProcessCollaboration': 'RSIP 流程协同',
  'rsipView.tree': '国策树',
  'rsipView.library': '国策库',
  'rsipView.runs': '轮次历史',
  'rsipView.insights': '高级分析',
  'ruleItem.pauseOnly': '仅暂停',
  'ruleItem.earlyCompletionOnly': '仅提前完成',
  'ruleItem.neverUsed': '从未使用',
  'ruleItem.today': '今天',
  'ruleItem.yesterday': '昨天',
  'ruleSelectionDialog.failedToSelectRule': '选择规则失败',
  'ruleSelectionDialog.ruleNameCleanNameAlreadyExists':
    'Rule name "{cleanName}" already exists',
  'ruleSelectionDialog.failedToCreateRule': '创建规则失败',
  'themeToggle.toggleTheme': '切换主题',
  'virtualizedChainList.taskChainsList': '任务链列表',
  'accountModal.accountModalStorageSection.dataMode': '数据模式',
  'accountModal.accountModalStorageSection.localModeWorksOfflineCloudModeEnablesSignInAnd':
    '本地模式离线可用；云端模式支持登录与多端同步',
  'accountModal.accountModalStorageSection.localMode': '本地模式',
  'accountModal.accountModalStorageSection.cloudMode': '云端模式',
  'accountModal.accountModalStorageSection.supabaseIsNotConfiguredSoOnlyLocalModeIs':
    '未检测到 Supabase 配置，当前仅支持本地模式。',
  'accountModal.accountModalUserContent.account': '当前账号',
  'accountModal.accountModalUserContent.created': '注册时间',
  'accountModal.accountModalUserContent.lastSignIn': '最后登录',
  'accountModal.accountModalUserContent.firstSignIn': '首次登录',
  'accountModal.accountModalUserContent.gamblingMode': '狂赌模式',
  'accountModal.accountModalUserContent.betPointsOnTasksForExtraRewards':
    '在任务上押注积分以获得额外奖励',
  'accountModal.accountModalUserContent.toggleGamblingMode': '切换狂赌模式',
  'accountModal.accountModalUserContent.enabledYouCanBetWhenStartingATask':
    '已启用 - 可在任务开始时进行押注',
  'accountModal.accountModalUserContent.disabledBettingIsUnavailable':
    '已禁用 - 无法进行任务押注',
  'accountModal.accountModalUserContent.dismissError': '关闭错误消息',
  'accountModal.accountModalUserContent.signOut': '退出登录',
  'accountModal.accountModalUserContent.signingOut': '正在退出...',
  'accountModal.useAccountModalController.failedToLoadUserInfoCheckTheConsoleFor':
    '获取用户信息失败，请重试（详情见控制台）',
  'accountModal.useAccountModalController.failedToLoadUserInfo':
    '获取用户信息失败',
  'accountModal.useAccountModalController.failedToLoadSettingsCheckTheConsoleForDetails':
    '获取设置失败，请重试（详情见控制台）',
  'accountModal.useAccountModalController.failedToLoadSettings': '获取设置失败',
  'accountModal.useAccountModalController.gamblingModeEnabled':
    'Gambling mode enabled',
  'accountModal.useAccountModalController.gamblingModeDisabled':
    'Gambling mode disabled',
  'accountModal.useAccountModalController.failedToUpdateSettingsCheckTheConsoleForDetails':
    '设置更新失败，请重试（详情见控制台）',
  'accountModal.useAccountModalController.signOutFailedCheckTheConsoleForDetailsThen':
    'Sign out failed. Check the console for details, then try again.',
  'accountModal.useAccountModalController.signOutFailedPleaseTryAgain':
    'Sign out failed. Please try again.',
  'auxiliaryJudgment.auxiliaryJudgmentActions.markAsFailed': '判定失败',
  'auxiliaryJudgment.auxiliaryJudgmentActions.allowPrecedent':
    '判定允许（下必为例）',
  'auxiliaryJudgment.auxiliaryJudgmentActions.thisBehaviorIsAllowedUnderAnExistingRule':
    '根据已有规则，此行为被允许',
  'auxiliaryJudgment.auxiliaryJudgmentActions.thisWillBeSavedAsANewExceptionFor':
    '此情况将永久添加到辅助链例外规则中',
  'auxiliaryJudgment.auxiliaryJudgmentActions.cancelContinueBooking':
    '取消 - 继续预约',
  'auxiliaryJudgment.auxiliaryJudgmentActions.currentBookingExceptions':
    '当前辅助链例外规则：',
  'auxiliaryJudgment.auxiliaryRuleChoice.useAnExistingException':
    '使用已有例外规则',
  'auxiliaryJudgment.auxiliaryRuleChoice.addANewException': '添加新例外规则',
  'auxiliaryJudgment.auxiliaryRuleChoice.chooseAnApplicableException':
    '选择适用的例外规则：',
  'auxiliaryJudgment.auxiliaryRuleChoice.thisBehaviorIsAllowedYouMayEndTheBooking':
    '此行为已被允许，可以直接结束预约',
  'auxiliaryJudgment.auxiliaryRuleChoice.describeWhatHappened':
    '请描述具体行为：',
  'auxiliaryJudgment.auxiliaryRuleChoice.eGForgotTheBookingGotInterruptedByAnUrgent':
    '例如：忘记了预约、被紧急事务打断、身体不适、临时有其他安排等',
  'auxiliaryJudgment.auxiliaryRuleChoice.thisRuleAlreadyExistsConsiderChoosingUseAn':
    '⚠️ 此规则已存在，建议选择“使用已有例外规则”',
  'bettingModal.bettingFormSections.chain': '任务链',
  'bettingModal.bettingFormSections.duration': '时长',
  'bettingModal.bettingFormSections.taskDurationMin': '{taskDuration} 分钟',
  'bettingModal.bettingFormSections.available': '可用积分',
  'bettingModal.bettingFormSections.betToday': '今日已押',
  'bettingModal.bettingFormSections.betAmount': '押注金额',
  'bettingModal.bettingFormSections.enterPointsToBet': '输入押注积分数',
  'bettingModal.bettingFormSections.quickBetAmountPoints':
    '快速押注 {amount} 积分',
  'bettingModal.bettingFormSections.betAllAvailablePointsPoints':
    '押注全部 {availablePoints} 积分',
  'bettingModal.bettingFormSections.all': '全部',
  'bettingModal.bettingFormSections.rules': '押注规则',
  'bettingModal.bettingFormSections.ifCompleted11PayoutDoubleReturn':
    '• 任务成功完成：获得 1:1 奖励（双倍回报）',
  'bettingModal.bettingFormSections.ifFailedLoseTheBet':
    '• 任务失败：损失押注积分',
  'bettingModal.bettingFormSections.onlyOneBetPerSession':
    '• 每个任务会话只能押注一次',
  'bettingModal.bettingFormSections.placingBet': '押注中...',
  'bettingModal.bettingFormSections.notEnoughPoints': '积分不足',
  'bettingModal.bettingFormSections.confirmBet': '确认押注',
  'bettingModal.bettingFormSections.cancelBet': '取消押注',
  'bettingModal.bettingFormSections.cancel': '取消',
  'bettingModal.bettingHeader.taskBet': '任务押注',
  'bettingModal.bettingStates.loadingBettingData': '加载押注数据...',
  'bettingModal.bettingStates.reloadData': '重新加载数据',
  'bettingModal.bettingStates.reload': '重新加载',
  'bettingModal.bettingStates.betPlaced': '押注成功！',
  'bettingModal.betPlacementRules.enterABetAmount': '请输入押注金额',
  'bettingModal.betPlacementRules.enterAValidBetAmount': '请输入有效的押注金额',
  'bettingModal.betPlacementRules.betAmountMustBeAnInteger':
    '押注金额必须是整数',
  'bettingModal.betPlacementRules.betAmountMustBeGreaterThan0':
    '押注金额必须大于 0',
  'bettingModal.betPlacementRules.notEnoughPointsAvailableAvailablePoints':
    '可用积分不足，当前可用：{availablePoints}',
  'bettingModal.betPlacementRules.exceedsMaxSingleBetSettingsMaxSingleBet':
    '超出单次押注限制：{settingsMaxSingleBet}',
  'bettingModal.betPlacementRules.exceedsDailyLimitSettingsDailyBetLimitUsedTodayTodayBetAmount':
    '超出每日押注限制：{settingsDailyBetLimit}（今日已用：{todayBetAmount}）',
  'bettingModal.useBetPlacementForm.bettingIsNotSupportedForTheCurrentStorage':
    '当前存储不支持押注功能',
  'bettingModal.useBetPlacementForm.betFailed': '押注失败',
  'bettingModal.useBetPlacementForm.betFailedCheckTheConsoleForDetailsThenTry':
    '押注失败，请重试（详情见控制台）',
  'bettingModal.useBettingModalData.failedToLoadDataCheckTheConsoleForDetails':
    '加载数据失败，请重试（详情见控制台）',
  'chainCard.chainCardView.viewDetailsChainName': '查看详情：{chainName}',
  'chainCard.chainCardView.moreOptions': '更多选项',
  'chainCard.chainCardView.deleteChain': '删除链条',
  'chainCard.chainCardView.signal': '预约信号: ',
  'chainCard.chainCardView.completeBeforeTimeRunsOut': '请在时间结束前完成: ',
  'chainCard.chainCardView.completeBooking': '完成预约',
  'chainCard.chainCardView.interruptAdjudicate': '中断/规则判定',
  'chainCard.chainCardView.start': '开始任务',
  'chainCard.chainCardView.schedule': '预约',
  'chainCard.chainCardMetrics.firstTime': '首次执行',
  'chainCard.chainCardMetrics.last': '上次：',
  'chainCard.chainCardMetrics.startFirstChain': '开始第一链',
  'chainCard.chainCardMetrics.mainStreak': '主链记录',
  'chainCard.chainCardMetrics.noBookingsYet': '尚无预约',
  'chainCard.chainCardMetrics.bookingStreak': '预约链记录',
  'chainCard.chainDeleteConfirmModal.deleteChain': 'Delete chain?',
  'chainCard.chainDeleteConfirmModal.areYouSureYouWantToDeleteTheChain':
    'Are you sure you want to delete the chain "',
  'chainCard.chainDeleteConfirmModal.label': '"?',
  'chainCard.chainDeleteConfirmModal.thisWillPermanentlyDelete':
    'This will permanently delete:',
  'chainCard.chainDeleteConfirmModal.mainChain': 'Main chain',
  'chainCard.chainDeleteConfirmModal.streak': 'Streak: ',
  'chainCard.chainDeleteConfirmModal.completions': 'Completions: ',
  'chainCard.chainDeleteConfirmModal.failures': 'Failures: ',
  'chainCard.chainDeleteConfirmModal.booking': 'Booking',
  'chainCard.chainDeleteConfirmModal.exceptions': 'Exceptions: ',
  'chainCard.chainDeleteConfirmModal.history': 'History',
  'chainCard.chainDeleteConfirmModal.successRate': 'Success rate: ',
  'chainCard.chainDeleteConfirmModal.rules': 'Rules',
  'chainCard.chainDeleteConfirmModal.bookingExceptions': 'Booking exceptions: ',
  'chainCard.chainDeleteConfirmModal.allSettings': 'All settings',
  'chainCard.chainDeleteConfirmModal.cancel': 'Cancel',
  'chainCard.chainDeleteConfirmModal.delete': 'Delete',
  'chainCard.useChainCard.minutesMin': '{minutes}分钟',
  'chainDetail.chainDetailDescription.taskDescription': '任务描述',
  'chainDetail.chainDetailExceptions.ruleHandbook': '规则手册',
  'chainDetail.chainDetailExceptions.ruleHandbookVariant2': '规则手册',
  'chainDetail.chainDetailExceptions.mainChainExceptions': '主链例外规则：',
  'chainDetail.chainDetailExceptions.bookingExceptions': '预约链例外规则：',
  'chainDetail.chainDetailHeader.chainDetails': '链条详情',
  'chainDetail.chainDetailHeader.edit': '编辑链条',
  'chainDetail.chainDetailHistory.noCompletionRecordsYet': '还没有完成记录',
  'chainDetail.chainDetailHistory.noCompletionRecordsYetVariant2': '暂无记录',
  'chainDetail.chainDetailHistory.completed': '任务完成',
  'chainDetail.chainDetailHistory.failed': '任务失败',
  'chainDetail.chainDetailHistory.notes': '备注',
  'chainDetail.chainDetailHistory.recentHistory': '最近记录',
  'chainDetail.chainDetailHistory.recentHistoryVariant2': '最近记录',
  'chainDetail.chainDetailStats.mainStreak': '主链当前记录',
  'chainDetail.chainDetailStats.bookingStreak': '预约链当前记录',
  'chainDetail.chainDetailStats.trigger': '触发动作',
  'chainDetail.chainDetailStats.duration': '任务时长',
  'chainDetail.chainDetailStats.totalCompletions': '总完成次数',
  'chainDetail.chainDetailStats.failures': '失败次数',
  'chainDetail.chainDetailStats.bookingFailures': '预约链失败',
  'chainDetail.chainDetailStats.bookingSignal': '预约信号',
  'chainDetail.chainDetailStats.bookingDuration': '预约时长',
  'chainDetail.chainDetailStats.bookingCompletionTrigger': '预约完成条件',
  'chainDetail.chainDetailStats.successRate': '成功率',
  'chainDetail.deleteConfirmModal.theChainWillMoveToTheRecycleBinThese':
    '链条将移入回收箱，以下数据将保留，30 天内可恢复：',
  'chainDetail.deleteConfirmModal.mainChain': '主链数据',
  'chainDetail.deleteConfirmModal.streak': '记录: ',
  'chainDetail.deleteConfirmModal.completions': '完成: ',
  'chainDetail.deleteConfirmModal.failures': '失败: ',
  'chainDetail.deleteConfirmModal.booking': '预约链数据',
  'chainDetail.deleteConfirmModal.exceptions': '例外: ',
  'chainDetail.deleteConfirmModal.history': '历史记录',
  'chainDetail.deleteConfirmModal.records': '记录: ',
  'chainDetail.deleteConfirmModal.successRate': '成功率: ',
  'chainDetail.deleteConfirmModal.timeStats': '时间统计',
  'chainDetail.deleteConfirmModal.rules': '规则设置',
  'chainDetail.deleteConfirmModal.bookingExceptions': '预约例外: ',
  'chainDetail.deleteConfirmModal.allSettings': '所有配置',
  'chainDetail.deleteConfirmModal.deleteChain': '确认删除链条',
  'chainDetail.deleteConfirmModal.areYouSureYouWantToDeleteTheChain':
    '你确定要删除链条 "',
  'chainDetail.deleteConfirmModal.label': '" 吗？',
  'chainDetail.deleteConfirmModal.delete': '确认删除',
  'chainEditor.chainEditorActions.createCopy': '创建副本',
  'chainEditor.chainEditorActions.saveChanges': '保存更改',
  'chainEditor.chainEditorActions.createChain': '创建链条',
  'chainEditor.chainEditorActions.saveAsCopy': '另存为副本',
  'chainEditor.chainEditorView.rsipIntegration': 'RSIP 流程联动',
  'chainEditor.chainEditorView.taskSideRsipLinks': '任务侧 RSIP 联动',
  'chainEditor.chainEditorView.configureLinksForThisTaskDirectlyInTheEditor':
    '可在编辑器中直接为该任务配置联动。冲突采用最后写入生效（LWW）。',
  'chainEditor.chainEditorView.saveThisTaskFirstThenConfigureRsipLinksHere':
    '请先保存任务，再在这里配置 RSIP 联动。',
  'chainEditor.auxiliaryChainSettingsSection.auxiliaryBooking': '辅助链设置',
  'chainEditor.auxiliaryChainSettingsSection.configureBookingAndCompletionConditions':
    '配置预约和完成条件',
  'chainEditor.auxiliaryChainSettingsSection.bookingSignal': '预约信号',
  'chainEditor.auxiliaryChainSettingsSection.chooseABookingSignal':
    '选择预约信号',
  'chainEditor.auxiliaryChainSettingsSection.enterYourCustomBookingSignal':
    '输入你的自定义预约信号',
  'chainEditor.auxiliaryChainSettingsSection.bookingDuration': '预约时长',
  'chainEditor.auxiliaryChainSettingsSection.presetMin': '{preset}分钟',
  'chainEditor.auxiliaryChainSettingsSection.customDuration': '自定义时长',
  'chainEditor.auxiliaryChainSettingsSection.customBookingDuration':
    '自定义预约时长',
  'chainEditor.auxiliaryChainSettingsSection.setHowLongTheBookingPhaseLasts':
    '设置预约阶段的持续时间',
  'chainEditor.auxiliaryChainSettingsSection.min': '分钟',
  'chainEditor.auxiliaryChainSettingsSection.nextValueMin': '{nextValue}分钟',
  'chainEditor.auxiliaryChainSettingsSection.bookingCompletionCondition':
    '预约完成条件',
  'chainEditor.auxiliaryChainSettingsSection.completionCondition': '完成条件',
  'chainEditor.auxiliaryChainSettingsSection.eGOpenYourIdeSitAtYourDesk':
    '例如：打开编程软件、坐到书房书桌前',
  'chainEditor.auxiliaryChainSettingsSection.note': '说明',
  'chainEditor.auxiliaryChainSettingsSection.thisIsTheActionYouMustCompleteDuringBookingUsually':
    '这是你在预约时间内必须完成的动作，通常就是主链的“神圣座位”触发器。',
  'chainEditor.basicInfoSection.basicInfo': '基础信息',
  'chainEditor.basicInfoSection.setTheBasicDetailsOfThisChain':
    '设置链条的基本信息',
  'chainEditor.basicInfoSection.chainName': '链名称',
  'chainEditor.basicInfoSection.giveYourChainAClearAndRecognizableName':
    '为您的链条起一个清晰易懂的名称',
  'chainEditor.basicInfoSection.eGLearnPythonWorkout30MinutesDistractionFreeWriting':
    '例如：学习 Python、健身 30 分钟、无干扰写作',
  'chainEditor.basicInfoSection.taskType': '任务类型',
  'chainEditor.basicInfoSection.chooseTheMostSuitableTaskType':
    '选择最适合的任务类型',
  'chainEditor.basicInfoSection.unit': '基础单元',
  'chainEditor.basicInfoSection.assaultStudyExperimentsPapers':
    '突击单元（学习、实验、论文）',
  'chainEditor.basicInfoSection.reconResearchInformationGathering':
    '侦查单元（信息搜集）',
  'chainEditor.basicInfoSection.commandPlanningStrategy':
    '指挥单元（制定计划）',
  'chainEditor.basicInfoSection.specialOpsMiscellaneousTasks':
    '特勤单元（处理杂事）',
  'chainEditor.basicInfoSection.engineeringExerciseTraining':
    '工程单元（运动锻炼）',
  'chainEditor.basicInfoSection.quartermasterCookingMealPrep':
    '炊事单元（备餐做饭）',
  'chainEditor.basicInfoSection.groupMembership': '任务群归属',
  'chainEditor.basicInfoSection.thisTaskCurrentlyBelongsToAGroup':
    '当前属于一个任务群',
  'chainEditor.basicInfoSection.duplicateThisTaskAndRemoveItFromTheGroup':
    '复制此任务并移出任务群（原任务保留）',
  'chainEditor.basicInfoSection.copyOut': '复制出群',
  'chainEditor.basicInfoSection.removeThisTaskFromTheGroup':
    '将此任务移出任务群',
  'chainEditor.basicInfoSection.remove': '移出',
  'chainEditor.mainChainSettingsSection.mainChain': '主链设置',
  'chainEditor.mainChainSettingsSection.configureTheMainTaskExecutionSettings':
    '配置主要任务的执行参数',
  'chainEditor.mainChainSettings.minimumDurationSettings.whenEnabledThisTaskWillNotCountDownIn':
    '开启后，本任务不会倒计时，你可以在专注模式中自行点击“完成任务”结束。',
  'chainEditor.mainChainSettings.minimumDurationSettings.minimumDuration':
    '最小时长',
  'chainEditor.mainChainSettings.minimumDurationSettings.formMinimumDurationMin':
    '{formMinimumDuration}分钟',
  'chainEditor.mainChainSettings.minimumDurationSettings.notSet': '未设置',
  'chainEditor.mainChainSettings.minimumDurationSettings.customMinutes':
    '自定义分钟数',
  'chainEditor.mainChainSettings.minimumDurationSettings.clear': '不设置',
  'chainEditor.mainChainSettings.minimumDurationSettings.onceTheMinimumIsReachedYouCanCompleteEarly':
    '设置最小时长后，达到时间后会出现提前完成按钮。',
  'chainEditor.mainChainSettings.sacredSeatSettings.sacredSeat': '神圣座位',
  'chainEditor.mainChainSettings.sacredSeatSettings.chooseAClearSignalThatStartsThisTask':
    '选择开始这项任务的明确信号',
  'chainEditor.mainChainSettings.sacredSeatSettings.chooseATrigger':
    '选择触发动作',
  'chainEditor.mainChainSettings.sacredSeatSettings.enterYourCustomTrigger':
    '输入你的自定义触发动作',
  'chainEditor.mainChainSettings.taskDurationSettings.taskDuration': '任务时长',
  'chainEditor.mainChainSettings.taskDurationSettings.setAPracticalTimeBoundary':
    '设置一个可执行的时间边界',
  'chainEditor.mainChainSettings.taskDurationSettings.noTimer': '无时长任务',
  'chainEditor.mainChainSettings.taskDurationSettings.dragTheSliderOrUseKeyboardInputToSet':
    '拖动滑块或使用键盘输入设置任务时长',
  'chainEditor.mainChainSettings.taskDurationSettings.valueMin': '{value}分钟',
  'dailyCheckin.dailyCheckinShared.totalPoints': '总积分',
  'dailyCheckin.dailyCheckinShared.streak': '连续天数',
  'dailyCheckin.dailyCheckinShared.totalCheckIns': '总签到',
  'dailyCheckin.dailyCheckinShared.checkedInToday': '今天已签到',
  'dailyCheckin.dailyCheckinShared.comeBackTomorrowForMorePoints':
    '明天再来获取更多积分吧！',
  'dashboard.dashboardChainsSection.yourTaskChains': '你的任务链',
  'dashboard.dashboardChainsSection.chooseWhatYouWantToMoveForwardNow':
    '选择当前要推进的任务',
  'dashboard.dashboardChainsSection.newChain': '新建链',
  'dashboard.dashboardChainsSection.newGroup': '新建任务群',
  'dashboard.dashboardChainsSection.recycleBin': '回收箱',
  'dashboard.dashboardChainsSection.data': '数据管理',
  'dashboard.dashboardChainsSection.rsipTree': '国策树',
  'dashboard.dashboardEmptyState.createYourFirstChain': '创建你的第一条链',
  'dashboard.dashboardEmptyState.aChainRepresentsATaskYouWantToKeep':
    '链代表你想要持续做的任务。每次成功完成，你的记录就会增长一点。',
  'dashboard.dashboardEmptyState.createChain': '创建第一条链',
  'dashboard.dashboardHero.ctdpProtocol': 'CTDP 协议',
  'dashboard.dashboardRecommendSection.streakAtRisk': '条纹快断了！',
  'dashboard.dashboardRecommendSection.keepTheStreak': '保持势头',
  'dashboard.dashboardRecommendSection.newChain': '新任务',
  'dashboard.dashboardRecommendSection.todaySPicks': '今日推荐',
  'dashboard.dashboardRecommendSection.todaySPicksVariant2': '今日推荐先做',
  'dashboard.dashboardView.chooseYourDataMode': '选择你的数据模式',
  'dashboard.dashboardView.localModeIsTheDefaultYouCanAlsoConnect':
    '默认是本地模式。你也可以连接 Supabase 开启登录与多端同步。',
  'dashboard.dashboardView.continueWithLocalMode': '继续本地模式',
  'dashboard.dashboardView.connectCloudSync': '连接云端同步',
  'focusMode.focusModeContainer.userInterrupted': '用户主动中断',
  'focusMode.focusModeControls.pause': '暂停',
  'focusMode.focusModeControls.complete': '完成任务',
  'focusMode.focusModeControls.completeEarly': '提前完成',
  'focusMode.focusModeControls.pausedAutoResumeInResumeCountdownMinutesMResumeCountdownSecondsS':
    '已暂停，将于 {resumeCountdownMinutes}分{resumeCountdownSeconds}秒 内自动继续',
  'focusMode.focusModeControls.pausedForElapsedPauseTimeMinutesMElapsedPauseTimeSecondsS':
    '已暂停 {elapsedPauseTimeMinutes}分{elapsedPauseTimeSeconds}秒',
  'focusMode.focusModeControls.resume': '继续',
  'focusMode.focusModeControls.cancelAutoResume': '取消自动继续',
  'focusMode.focusModeView.holdToInterrupt': '长按中断',
  'focusMode.focusSessionHeader.exitFullscreen': '退出全屏',
  'focusMode.focusSessionHeader.enterFullscreen': '进入全屏',
  'focusMode.focusSessionHeader.exitFullscreenEsc': '退出全屏 (ESC)',
  'focusMode.focusSessionHeader.enterFullscreenF11': '进入全屏 (F11)',
  'focusMode.focusTimerPanel.elapsed': '已用时 ',
  'focusMode.focusTimerPanel.elapsedWholeMinutesMinSessionDurationMin':
    '{elapsedWholeMinutes}分钟 / {sessionDuration}分钟',
  'focusMode.focusTimerPanel.needMinimumCountdownMinutesMMinimumCountdownSecondsSToReachTheMinimum':
    '还需 {minimumCountdownMinutes}分{minimumCountdownSeconds}秒 达到最小时长',
  'focusMode.focusTimerPanel.minimumDurationReachedChainMinimumDurationMinYouCanComplete':
    '已达到最小时长 {chainMinimumDuration} 分钟，可以完成任务',
  'focusMode.interruptConfirmDialog.interruptTask': '确认中断任务',
  'focusMode.interruptConfirmDialog.interruptingWillFailTheTaskAndResetYourMain':
    '中断任务将导致任务失败，主链记录将清空为零。你确定要中断当前任务吗？',
  'focusMode.interruptConfirmDialog.interrupt': '确认中断',
  'focusMode.useExceptionRuleFlow.cancelled': '操作已取消',
  'focusMode.useExceptionRuleFlow.youCanContinueTheTaskOrChooseAnotherAction':
    '您可以继续任务或重新选择操作',
  'focusMode.useExceptionRuleOperations.issueResolved': '问题已解决',
  'focusMode.useExceptionRuleOperations.unknownError': '未知错误',
  'focusMode.useExceptionRuleOperations.retry': '重试操作',
  'focusMode.useExceptionRuleOperations.refresh': '刷新页面',
  'focusMode.useExceptionRuleOperations.operationFailedPleaseTryAgain':
    '操作失败，请重试',
  'focusMode.useExceptionRuleOperations.systemError': '系统错误',
  'focusMode.useExceptionRuleOperations.somethingWentWrongWhileHandlingTheErrorRefreshThe':
    '处理错误时发生问题，请刷新页面重试',
  'focusMode.useExceptionRuleOperations.invalidRule': '规则对象无效',
  'focusMode.useExceptionRuleOperations.pausingTask': '正在暂停任务...',
  'focusMode.useExceptionRuleOperations.completingTask': '正在完成任务...',
  'focusMode.useExceptionRuleOperations.appliedRuleRuleNameToPauseTheTask':
    '已使用规则 "{ruleName}" 暂停任务',
  'focusMode.useExceptionRuleOperations.appliedRuleRuleNameToCompleteTheTask':
    '已使用规则 "{ruleName}" 提前完成任务',
  'focusMode.useExceptionRuleOperations.success': '操作成功',
  'focusMode.useExceptionRuleOperations.ruleNameCannotBeEmpty':
    '规则名称不能为空',
  'focusMode.useExceptionRuleOperations.creatingRule': '正在创建规则...',
  'focusMode.useExceptionRuleOperations.validating': '验证规则信息...',
  'focusMode.useExceptionRuleOperations.saving': '保存规则...',
  'focusMode.useExceptionRuleOperations.ruleCreated': '规则创建成功',
  'focusMode.useExceptionRuleOperations.ruleResultRuleNameHasBeenCreatedAndApplied':
    '规则 "{resultRuleName}" 已创建并应用',
  'focusMode.useExceptionRuleOperations.notes': '注意事项',
  'groupCard.groupCard.viewDetailsGroupName': '查看详情：{groupName}',
  'groupCard.groupCard.deleteGroup': '删除任务群',
  'groupCard.groupCardActions.startNext': '开始下一个',
  'groupCard.groupCardSummary.progress': '任务进度',
  'groupCard.groupCardSummary.tasks': '子任务数',
  'groupCard.groupCardSummary.groupStreak': '群组记录',
  'groupCard.groupDeleteConfirmDialog.deleteGroup': 'Delete group?',
  'groupCard.groupDeleteConfirmDialog.areYouSureYouWantToDeleteTheGroup':
    'Are you sure you want to delete the group "',
  'groupCard.groupDeleteConfirmDialog.thisWillDeleteTheEntireGroupAndAllChild':
    'This will delete the entire group and all child tasks:',
  'groupView.groupOverview.groupOverview': '任务群概览',
  'groupView.groupOverview.groupChildrenCountUnits':
    '{groupChildrenCount} 个单元',
  'groupView.groupOverview.completed': '已完成',
  'groupView.groupOverview.timeExpired': '任务群已超时',
  'groupView.groupOverview.timeLimit': '时间限制',
  'groupView.groupOverview.thisGroupHasExpiredProgressWillBeClearedPlease':
    '任务群已超时，进度将被清空。请重新开始任务群。',
  'groupView.groupUnitList.units': '任务单元',
  'groupView.groupUnitList.nextUp': '下一个待执行：',
  'groupView.groupUnitList.thisGroupHasNoUnitsYet': '此任务群还没有子单元',
  'groupView.groupUnitList.addYourFirstUnit': '添加第一个单元',
  'groupView.groupViewHeader.cycles': '轮',
  'groupView.groupViewHeader.addUnit': '添加单元',
  'groupView.groupViewHeader.importUnits': '导入单元',
  'groupView.groupViewHeader.editGroup': '编辑任务群',
  'groupView.groupViewHeader.startNewCycle': '开始新一轮',
  'groupView.repeatCountModal.setRepeatCount': '设置重复次数',
  'groupView.repeatCountModal.repeatCount199': '重复次数 (1-99)',
  'groupView.repeatCountModal.setHowManyTimesThisUnitMustBeRepeated':
    '设置该任务单元在任务群中需要重复执行的次数',
  'groupView.repeatCountModal.save': '确认设置',
  'groupView.unitCard.viewTaskUnitName': '查看任务：{unitName}',
  'groupView.unitCard.next': '下一个',
  'groupView.unitCard.completions': '完成次数',
  'groupView.unitCard.bookings': '预约次数',
  'groupView.unitCard.moveUp': '上移',
  'groupView.unitCard.moveDown': '下移',
  'groupView.unitCard.editUnit': '编辑单元',
  'groupView.unitCard.deleteUnit': '删除单元',
  'groupView.unitCard.start': '开始',
  'groupView.unitCard.setRepeatCountCurrentCurrentRepeatCount':
    '设置重复次数 (当前: {currentRepeatCount})',
  'importExportModal.exportTab.exportYourData': '导出全部数据',
  'importExportModal.exportTab.exportSavesAllYourCurrentDataIncludingChainsStats':
    '导出功能将保存您当前的所有数据，包括任务链配置、统计数据、国策树扩展数据、宠物状态和例外规则。',
  'importExportModal.exportTab.chainConfigStats': '任务链配置与统计',
  'importExportModal.exportTab.completionHistory': '完成历史记录',
  'importExportModal.exportTab.fullRsipDataset': '国策树（RSIP）完整数据',
  'importExportModal.exportTab.petState': '宠物状态',
  'importExportModal.exportTab.exceptionRules': '例外规则配置',
  'importExportModal.exportTab.exportAsJson': '导出为 JSON 文件',
  'importExportModal.importFields.importData': '导入任务链数据',
  'importExportModal.importFields.importAddsNewDataToYourSystemIncludingChains':
    '导入功能将添加新的数据到您的系统中，包括任务链、国策树扩展数据、宠物状态和例外规则。导入的链条将生成新的ID，不会覆盖现有数据。',
  'importExportModal.importFields.chainsNewIds': '任务链数据（生成新ID）',
  'importExportModal.importFields.rsipNodesExtendedRecords':
    '国策树节点与扩展记录',
  'importExportModal.importFields.petStateOverwriteOnImport':
    '宠物状态（覆盖导入）',
  'importExportModal.importFields.exceptionRulesSkipDuplicates':
    '例外规则（跳过重复）',
  'importExportModal.importFields.makeSureTheJsonFileWasExportedFromMomentum':
    '请确保导入的是从 Momentum 导出的有效 JSON 文件',
  'importExportModal.importFields.chooseAFile': '选择文件导入',
  'importExportModal.importFields.chooseAFileToImport': '选择要导入的文件',
  'importExportModal.importFields.orPasteJsonManually': '或手动粘贴 JSON 数据',
  'importExportModal.importFields.pasteTheJsonExportedFromMomentum':
    '粘贴从 Momentum 导出的 JSON 数据...',
  'importExportModal.importFields.jsonData': 'JSON 数据',
  'importExportModal.importFields.preserveStatisticsStreaksCompletionsEtc':
    '保留统计数据（连击数、完成次数等）',
  'importExportModal.importFields.preserveStatistics': '保留统计数据',
  'importExportModal.importFields.preserveOriginalTimestampsCreatedAtCompletedAtEtc':
    '保留原始时间戳（创建时间、完成时间等）',
  'importExportModal.importFields.preserveOriginalTimestamps': '保留原始时间戳',
  'importExportModal.importFields.importCompletionHistory': '导入完成历史记录',
  'importExportModal.importFields.importOptions': '导入选项',
  'importExportModal.importFields.safeImport': '安全导入机制',
  'importExportModal.importFields.importedDataIsAutomaticallyAssociatedWithYourAccount':
    '• 所有导入数据将自动归属到您的账户',
  'importExportModal.importFields.idConflictsAreResolvedAutomaticallyWithNewUnique':
    '• ID 冲突将自动解决，生成新的唯一标识',
  'importExportModal.importFields.importSessionsExpireAutomaticallyAfter30Minutes':
    '• 导入会话 30 分钟后自动过期',
  'importExportModal.importStatusControls.verifyingYourAccount':
    '正在验证用户身份...',
  'importExportModal.importStatusControls.creatingASafeImportSession':
    '正在创建安全导入会话...',
  'importExportModal.importStatusControls.importingDataSafely':
    '正在安全导入数据，请稍候...',
  'importExportModal.importStatusControls.importSuccessfulTheChainsHaveBeenAdded':
    '导入成功！任务链已添加到您的系统中。',
  'importExportModal.importStatusControls.importFailed': '导入失败',
  'importExportModal.importStatusControls.verifying': '验证身份中...',
  'importExportModal.importStatusControls.creatingSession': '创建会话中...',
  'importExportModal.importStatusControls.importing': '安全导入中...',
  'importExportModal.importStatusControls.importData': '安全导入数据',
  'importExportModal.importStatusControls.importDataVariant2': '导入数据',
  'importExportModal.useImportWorkflow.invalidImportFormatPleaseMakeSureYouUploadedA':
    '导入数据格式错误：请确保上传的是有效的JSON格式文件。',
  'importExportModal.useImportWorkflow.importFailedUnknownError':
    '导入失败：未知错误',
  'importExportModal.useImportWorkflow.authenticationFailedPleaseMakeSureYouAreSignedIn':
    '用户身份验证失败：请确保您已正确登录，然后重试导入操作。',
  'importExportModal.useImportWorkflow.invalidImportFormatNoValidChainsFoundPleaseMake':
    '导入数据格式错误：文件中未找到有效的链条数据。请确保文件是从Momentum导出的有效数据。',
  'importExportModal.useImportWorkflow.importFailedDetail':
    '导入失败：{detail}',
  'importExportModal.useImportWorkflow.importFailedCheckTheConsoleForDetailsThenTry':
    '导入失败，请重试（详情见控制台）',
  'importExportModal.useImportWorkflow.authenticationFailedPleaseMakeSureYouAreSignedInVariant2':
    '用户身份验证失败。请确保您已正确登录，然后重试导入操作。',
  'importUnitsModal.importUnitOption.selectUnitUnitName':
    '选择任务单元：{unitName}',
  'importUnitsModal.importUnitsModalView.importUnits': '导入任务单元',
  'importUnitsModal.importUnitsModalView.selectUnitsToCopyOrMoveIntoThisGroup':
    '选择要复制或移动到任务群的单元',
  'importUnitsModal.importUnitsModalView.importMode': '导入模式',
  'importUnitsModal.importUnitsModalView.createACopyInTheGroupKeepTheOriginal':
    '创建副本加入任务群，原单元保持独立',
  'importUnitsModal.importUnitsModalView.moveTheUnitIntoTheGroupItWillNo':
    '将单元移入任务群，不再独立显示',
  'importUnitsModal.importUnitsModalView.searchUnits': '搜索任务单元',
  'importUnitsModal.importUnitsModalView.searchUnitsVariant2':
    '搜索任务单元...',
  'importUnitsModal.importUnitsModalView.noImportableUnitsFound':
    '没有找到可导入的任务单元',
  'importUnitsModal.importUnitsModalView.tryAdjustingYourSearch':
    '尝试调整搜索条件',
  'importUnitsModal.importUnitsModalView.allUnitsAreAlreadyInAGroup':
    '所有单元都已在任务群中',
  'importUnitsModal.importUnitsModalView.import': '导入',
  'mobile.mobileBottomNav.home': '首页',
  'mobile.mobileBottomNav.focus': '专注',
  'mobile.mobileBottomNav.rsip': 'RSIP',
  'mobile.mobileBottomNav.bottomNavigation': '底部导航',
  'pet.petCreationDialog.pleaseEnterAPetName': '请输入宠物名称',
  'pet.petCreationDialog.nameCannotExceed20Characters': '名称不能超过20个字符',
  'pet.petCreationDialog.adoptYourPet': '领养你的宠物',
  'pet.petCreationDialog.giveYourNewCompanionAName': '给你的新伙伴起个名字吧！',
  'pet.petCreationDialog.petName': '宠物名称...',
  'pet.petCreationDialog.petNameVariant2': '宠物名称',
  'pet.petCreationDialog.maybeLater': '稍后再说',
  'pet.petCreationDialog.adopt': '领养',
  'pet.petCreationDialog.completeTasksToFeedYourPetAndHelpIt':
    '完成任务可以喂养宠物，让它成长进化！',
  'pet.widget.petWidget.adoptAPet': '领养宠物',
  'pet.widget.petWidget.adoptAPetVariant2': '领养一只宠物',
  'pet.widget.petWidget.nameYourNewCompanion': '给新伙伴起个名字',
  'pet.widget.petWidget.expandPet': '展开宠物',
  'pet.widget.petWidget.dragToMovePet': '拖拽移动宠物',
  'pet.widget.petWidget.dragToMove': '拖拽移动',
  'pet.widget.petWidget.minimize': '最小化',
  'pet.widget.petWidget.feed': '喂食',
  'pet.widget.petWidget.feeding': '喂食中...',
  'pet.widget.usePetWidgetController.fedFullnessResultHungerReduced':
    '喂食成功！饱食度+{resultHungerReduced}',
  'pet.widget.usePetWidgetController.petIsAlreadyFull': '宠物已经吃饱啦~',
  'pet.widget.usePetWidgetController.welcomeName': '欢迎 {name} 加入！',
  'recycleBinModal.bulkActionsBar.clearSelection': '取消全选',
  'recycleBinModal.bulkActionsBar.selectAll': '全选',
  'recycleBinModal.bulkActionsBar.restoreSelected': '批量恢复',
  'recycleBinModal.bulkActionsBar.deletePermanently': '永久删除',
  'recycleBinModal.confirmDialog.confirmRestore': '确认恢复',
  'recycleBinModal.confirmDialog.confirmPermanentDeletion': '确认永久删除',
  'recycleBinModal.confirmDialog.restoreTheFollowingShowConfirmDialogChainIdsCountChainSShowConfirmDialogChainNames':
    '确定要恢复以下 {showConfirmDialogChainIdsCount} 个链条吗？\n\n{showConfirmDialogChainNames}',
  'recycleBinModal.confirmDialog.permanentlyDeleteTheFollowingShowConfirmDialogChainIdsCountChainSShowConfirmDialogChainNamesThis':
    '确定要永久删除以下 {showConfirmDialogChainIdsCount} 个链条吗？\n\n{showConfirmDialogChainNames}\n\n⚠️ 此操作无法撤销，所有数据将被永久删除！',
  'recycleBinModal.emptyState.recycleBinIsEmpty': '回收箱为空',
  'recycleBinModal.emptyState.deletedChainsAppearHereYouCanRestoreThemOr':
    '删除的链条会出现在这里，你可以选择恢复或永久删除它们。',
  'recycleBinModal.loadingState.loading': '正在加载…',
  'recycleBinModal.operations.restoredChainIdsCountChainSTookDurationMs':
    '成功恢复 {chainIdsCount} 个链条（耗时 {duration}ms）',
  'recycleBinModal.operations.restoreFailedSafeDetail':
    '恢复失败: {safeDetail}',
  'recycleBinModal.operations.restoreFailedCheckTheConsoleForDetailsThenTry':
    '恢复失败，请重试（详情见控制台）',
  'recycleBinModal.operations.someChainsMayNotHaveBeenRestoredPleaseCheck':
    '部分链条恢复可能失败，请检查主界面确认结果。如有问题请刷新页面。',
  'recycleBinModal.operations.permanentlyDeletedChainIdsCountChainSTookDurationMs':
    '成功永久删除 {chainIdsCount} 个链条（耗时 {duration}ms）',
  'recycleBinModal.operations.permanentDeleteFailedSafeDetail':
    '永久删除失败: {safeDetail}',
  'recycleBinModal.operations.permanentDeleteFailedCheckTheConsoleForDetailsThen':
    '永久删除失败，请重试（详情见控制台）',
  'recycleBinModal.timeFormat.justNow': '刚刚',
  'recycleBinModal.useRecycleBinModal.failedToLoadRecycleBinPleaseTryAgain':
    '加载回收箱失败，请重试',
  'recycleBinModal.useRecycleBinModal.operationFailedSafeDetail':
    '操作失败: {safeDetail}',
  'recycleBinModal.useRecycleBinModal.operationFailedCheckTheConsoleForDetailsThenTry':
    '操作失败，请重试（详情见控制台）',
  'rsip.rsipCanvasView.stopTimer': '停止计时',
  'rsip.rsipCanvasView.stopTheTimer': '确定要停止计时吗？',
  'rsip.rsipCanvasView.stop': '停止',
  'rsip.rsipCanvasView.confirmRollback': '确认回溯',
  'rsip.rsipCanvasView.childNode': '个子节点',
  'rsip.rsipCanvasView.childNodes': '个子节点',
  'rsip.rsipCanvasView.markedAsFailedThisWillDeleteConfirmActionNodeTitle':
    '判定失败：将删除「{confirmActionNodeTitle}」及其 {confirmActionDescendants} {childNodesLabel}。确认回溯？',
  'rsip.rsipCanvasView.rollBack': '回溯',
  'rsip.rsipControls.zoomIn': '放大',
  'rsip.rsipControls.zoomOut': '缩小',
  'rsip.rsipControls.fitToContent': '适应内容',
  'rsip.rsipFilters.filterByType': '按类型筛选：',
  'rsip.rsipFilters.clear': '清除',
  'rsip.rsipForm.parentOptionalEmptyNewBranch': '父节点（可空，表示新分支）',
  'rsip.rsipForm.noParentCreateNewRoot': '（无父节点，建立新根）',
  'rsip.rsipForm.policyTitle': '国策标题',
  'rsip.rsipForm.eGStartShoweringWithin15MinutesOfGettingHome':
    '例如：进门5分钟内开始洗澡',
  'rsip.rsipForm.rule': '精准规则',
  'rsip.rsipForm.eGStartA15MinuteTimerWhenHomeEnterThe':
    '例如：回家即启动15分钟计时，计时内进浴室',
  'rsip.rsipForm.enableTimer': '启用计时',
  'rsip.rsipForm.timerMinutes': '计时分钟数',
  'rsip.rsipForm.nodeType': '节点类型',
  'rsip.rsipForm.policyGroup': '所属国策组',
  'rsip.rsipForm.noGroup': '不分组',
  'rsip.rsipForm.tolerance': '容错',
  'rsip.rsipForm.newGroup': '新建组',
  'rsip.rsipForm.passivePolicy': '被动国策',
  'rsip.rsipForm.multiplePerDayIsEnabledYouCanAddMore':
    '已开启“一天可多条”。今日可继续新增。',
  'rsip.rsipForm.addAtMostOnePolicyPerDay': '每天最多新增一个国策。',
  'rsip.rsipForm.youCanAddToday': '今日可新增。',
  'rsip.rsipForm.alreadyAddedTodayTryAgainTomorrow': '今日已新增，明日继续。',
  'rsip.rsipForm.addPolicy': '新增国策',
  'rsip.rsipinsightsPanel.nA': '无数据',
  'rsip.rsipinsightsPanel.up': '上升',
  'rsip.rsipinsightsPanel.down': '下降',
  'rsip.rsipinsightsPanel.flat': '持平',
  'rsip.rsipinsightsPanel.insufficientData': '数据不足',
  'rsip.rsipinsightsPanel.high': '高',
  'rsip.rsipinsightsPanel.medium': '中',
  'rsip.rsipinsightsPanel.low': '低',
  'rsip.rsipinsightsPanel.activePolicies': '活跃国策数',
  'rsip.rsipinsightsPanel.14dSuccessRate': '近14天成功率',
  'rsip.rsipinsightsPanel.passiveCoverage': '被动覆盖率',
  'rsip.rsipinsightsPanel.reinforcementCoverage': '强化覆盖率',
  'rsip.rsipinsightsPanel.maxNodeTrend': '节点规模趋势',
  'rsip.rsipinsightsPanel.runDurationTrend': '轮次时长趋势',
  'rsip.rsipinsightsPanel.collapsesIn14Days': '近14天崩溃次数',
  'rsip.rsipinsightsPanel.ruralFirstCandidateQueue': '农村包围城市候选队列',
  'rsip.rsipinsightsPanel.noLowCostCandidatesDetectedYet':
    '暂未检测到低成本候选。',
  'rsip.rsipinsightsPanel.failureCost': '失败成本',
  'rsip.rsipinsightsPanel.violationRate': '违约率',
  'rsip.rsipinsightsPanel.recommendationAssistant': '推荐助手',
  'rsip.rsipinsightsPanel.noRecommendationYetContinueExecutionToCollectMoreSignal':
    '暂时没有建议，继续执行以积累更多信号。',
  'rsip.rsipNodeCard.cancelReparent': '取消更改继承',
  'rsip.rsipNodeCard.changeParent': '更改继承关系',
  'rsip.rsipNodeCard.markAsFailedDeleteThisNodeAndAllDescendants':
    '判定失败（删除此节点及其所有子节点）',
  'rsip.rsipPolicyLibrary.policyLibrary': '国策库',
  'rsip.rsipPolicyLibrary.noArchivedPoliciesYetRemovedNodesWillBeStored':
    '暂无归档国策。违反后删除的节点会保留在这里，可随时恢复。',
  'rsip.rsipPolicyLibrary.archivedEntriesPreserveInternalizationProgressAndCanBeRestored':
    '归档条目会保留内化进度，恢复时可选择挂接到任意父节点。',
  'rsip.rsipPolicyLibrary.restoreAsNewRoot': '恢复为新根节点',
  'rsip.rsipRunHistory.runHistory': '轮次历史',
  'rsip.rsipRunHistory.noCollapseRecordsYetSignificantRollbacksWillBeRecorded':
    '暂无崩溃轮次记录。出现重大回滚后会在这里沉淀历史数据。',
  'rsip.rsipRunHistory.totalRuns': '总轮次',
  'rsip.rsipRunHistory.longestDuration': '最长持续',
  'rsip.rsipRunHistory.avgPeakNodes': '平均峰值节点',
  'rsip.rsipRunHistory.inProgress': '进行中',
  'rsip.rsipRunHistory.collapseReason': '崩溃原因：',
  'rsip.rsipSplitModeSection.sleepTemplate': '作息模板',
  'rsip.rsipSplitModeSection.exerciseTemplate': '运动模板',
  'rsip.rsipSplitModeSection.dietTemplate': '饮食模板',
  'rsip.rsipSplitModeSection.splitModeShatterOversizedPolicies':
    '拆分模式（零散牛皮糖）',
  'rsip.rsipSplitModeSection.enable': '启用',
  'rsip.rsipSplitModeSection.goalEGSleepEarlyAndWakeEarly':
    '目标，例如：早睡早起',
  'rsip.rsipSplitModeSection.addSubPolicy': '新增子国策',
  'rsip.rsipSplitModeSection.subPolicyTitle': '子国策标题',
  'rsip.rsipSplitModeSection.subPolicyRule': '子国策规则',
  'rsip.rsipSplitModeSection.passive': '被动',
  'rsip.rsipSplitModeSection.createSplitPolicies': '批量创建拆分国策',
  'rsip.rsipTaskLinkConfirmationDialog.confirmTaskIntegration': '确认任务联动',
  'rsip.rsipTaskLinkConfirmationDialog.markPolicyNodeTitleAsViolatedThisMay':
    '是否将国策「{nodeTitle}」标记为已违反？这可能移除节点及其子节点，并消耗国策组容错。',
  'rsip.rsipTaskLinkConfirmationDialog.markPolicyNodeTitleAsExecutedToday':
    '是否将国策「{nodeTitle}」标记为今日已执行？',
  'rsip.rsipTaskLinkConfirmationDialog.confirm': '确认联动',
  'rsip.rsipTaskLinkPanel.rsipTaskIntegration': 'RSIP × 任务流程协同',
  'rsip.rsipTaskLinkPanel.taskEventsCanAutoUpdateRsipRsipTaskActionsDefaultTo':
    '任务事件可自动更新 RSIP；RSIP -> 任务动作默认需确认。冲突采用最后写入生效（LWW）。',
  'rsip.rsipTaskLinkPanel.taskRsip': '任务 -> RSIP',
  'rsip.rsipTaskLinkPanel.rsipTask': 'RSIP -> 任务',
  'rsip.rsipTree.noPoliciesYetAddOneFromTheFormAbove':
    '尚无国策，先从上方表单添加一个吧。',
  'rsip.rsipTree.cannotChooseThisNodeAsParentWouldCreateA':
    '不能选择该节点作为父节点（会形成循环）。',
  'rsip.rsipTree.selectANewParent': '选择新的父节点',
  'rsip.rsipTree.moving': '正在移动：',
  'rsip.rsipTree.tapANodeToSetAsParentOr':
    '。点击目标节点作为父节点，或设为根。',
  'rsip.rsipTree.makeRoot': '设为根',
  'rsip.rsipTreeTab.policyExecutionTracking': '定式执行追踪',
  'rsip.rsipViolationDialog.closeDialog': '关闭对话框',
  'rsip.rsipViolationDialog.confirmViolation': '确认违反国策',
  'rsip.rsipViolationDialog.thisActionCannotBeUndone': '该操作不可撤销',
  'rsip.rsipViolationDialog.impactedDescendants': '受影响的子节点：',
  'rsip.rsipViolationDialog.violationReasonOptional': '违反原因（可选）',
  'rsip.rsipViolationDialog.repairHintOptional': '修复提示（可选）',
  'rsip.rsipViolationDialog.confirmViolationVariant2': '确认违反',
  'rsip.useRsipreparent.aPreviousReparentSaveIsStillInProgressTry':
    '上一次父子关系保存仍在进行，请稍后重试。',
  'rsip.useRsipreparent.theNodeToMoveNoLongerExistsRefreshAnd':
    '要移动的节点已不存在，请刷新后重试。',
  'rsip.useRsipreparent.theSelectedParentNoLongerExistsChooseAnotherParent':
    '所选父节点已不存在，请重新选择。',
  'rsip.useRsipreparent.cannotSelectTheNodeItselfAsParent':
    '不能选择自身作为父节点。',
  'rsip.useRsipreparent.cannotMoveANodeUnderItsDescendant':
    '不能把节点移动到自己的后代下面。',
  'rsip.useRsipreparent.couldNotSaveTheNewParentTryAgain':
    '保存父子关系失败，请重试。',
  'rsip.useRsiptimers.timerComplete': '计时完成',
  'rsip.useRsiptimers.rsipTimerHasEnded': 'RSIP 定式计时已结束',
  'rsip.useRsiptimers.minutesMin': '{minutes} 分钟',
  'rsip.useRsipviewCreationActions.enterPolicyGroupName': '请输入国策组名称',
  'rsip.useRsipviewCreationActions.enterFaultToleranceInteger':
    '请输入容错值（整数）',
  'rsip.useRsipviewCreationActions.optionalInputGroupEmoji':
    '可选：输入国策组 Emoji',
  'rsip.useRsipviewCreationActions.strictModeAllowsOneNewPolicyPerDayKeep':
    '严格模式每天最多新增一条国策，请只保留一条有效条目，或切换自由模式。',
  'rsip.taskLink.rsipTaskLinkForm.selectRsipNode': '选择 RSIP 节点',
  'rsip.taskLink.rsipTaskLinkForm.selectTaskGroup': '选择任务/任务组',
  'rsip.taskLink.rsipTaskLinkForm.group': '任务组',
  'rsip.taskLink.rsipTaskLinkForm.task': '任务',
  'rsip.taskLink.rsipTaskLinkForm.addLink': '新增联动',
  'rsip.taskLink.rsipTaskLinkList.noIntegrationLinksYet': '尚未配置任何联动。',
  'rsip.taskLink.rsipTaskLinkList.node': '节点',
  'rsip.taskLink.rsipTaskLinkList.target': '目标',
  'rsip.taskLink.rsipTaskLinkList.enabled': '已启用',
  'rsip.taskLink.rsipTaskLinkList.disabled': '已禁用',
  'rsip.taskLink.taskLinkUi.taskCompleted': '任务完成',
  'rsip.taskLink.taskLinkUi.taskInterrupted': '任务中断',
  'rsip.taskLink.taskLinkUi.groupCycleCompleted': '任务组周期完成',
  'rsip.taskLink.taskLinkUi.rsipMarkedExecuted': 'RSIP 标记已执行',
  'rsip.taskLink.taskLinkUi.markRsipExecuted': '标记国策已执行',
  'rsip.taskLink.taskLinkUi.markRsipViolated': '标记国策已违反',
  'rsip.taskLink.taskLinkUi.promptStartTask': '提示立即开始任务',
  'rsip.taskLink.taskLinkUi.promptScheduleTask': '提示安排任务',
  'rsip.taskLink.taskLinkUi.auto': '自动',
  'rsip.taskLink.taskLinkUi.confirm': '需确认',
  'ruleManager.ruleManagerViewView.loadingRules': '加载规则中...',
  'ruleManager.ruleManagerViewView.confirmDeletion': '确认删除',
  'ruleManager.ruleManagerViewView.deleteRuleDeleteConfirmationRuleName':
    '确定要删除规则 "{deleteConfirmationRuleName}" 吗？',
  'ruleManager.ruleManagerViewView.exceptionRules': '例外规则管理',
  'ruleManager.ruleManagerViewView.manageExceptionRulesForPausingOrEarlyCompletion':
    '管理暂停和提前完成的例外规则',
  'ruleManager.ruleManagerViewView.export': '导出',
  'ruleManager.ruleManagerViewView.createChainSpecificRule': '创建链专属规则',
  'ruleManager.ruleManagerViewView.searchRuleNameOrDescription':
    '搜索规则名称或描述...',
  'ruleManager.ruleManagerViewView.allTypes': '所有类型',
  'ruleManager.ruleManagerViewView.mostUsed': '按使用频率',
  'ruleManager.ruleManagerViewView.name': '按名称',
  'ruleManager.ruleManagerViewView.lastUsed': '按最近使用',
  'ruleManager.ruleManagerViewView.noMatchingRules': '没有找到匹配的规则',
  'ruleManager.ruleManagerViewView.noRulesYet': '还没有规则',
  'ruleManager.ruleManagerViewView.tryAdjustingYourSearchOrFilters':
    '尝试调整搜索条件或筛选器',
  'ruleManager.ruleManagerViewView.createYourFirstExceptionRuleToGetStarted':
    '创建第一个例外规则来开始使用',
  'ruleManager.ruleManagerViewView.createRule': '创建规则',
  'ruleManager.ruleManagerFormModal.editRule': '编辑规则',
  'ruleManager.ruleManagerFormModal.createRule': '创建新规则',
  'ruleManager.ruleManagerFormModal.suggestedRuleNames': '建议的规则名称：',
  'ruleManager.ruleManagerFormModal.ruleName': '规则名称 *',
  'ruleManager.ruleManagerFormModal.eGBathroomBreakWaterPhoneCall':
    '例如：上厕所、喝水、接电话',
  'ruleManager.ruleManagerFormModal.ruleType': '规则类型 *',
  'ruleManager.ruleManagerFormModal.pauseOnlyCanOnlyPauseTheTimer':
    '仅暂停 - 只能用于暂停计时',
  'ruleManager.ruleManagerFormModal.earlyCompletionOnlyCanOnlyCompleteTasksEarly':
    '仅提前完成 - 只能用于提前完成任务',
  'ruleManager.ruleManagerFormModal.descriptionOptional': '描述（可选）',
  'ruleManager.ruleManagerFormModal.describeThisException':
    '详细描述这个例外情况...',
  'ruleManager.ruleManagerFormModal.update': '更新',
  'ruleManager.ruleManagerFormModal.create': '创建',
  'ruleManager.useRuleManagerActions.failedToCreateRulePleaseTryAgain':
    '创建规则失败，请重试',
  'ruleManager.useRuleManagerActions.failedToUpdateRulePleaseTryAgain':
    '更新规则失败，请重试',
  'ruleManager.useRuleManagerActions.failedToUpdateRule': '更新规则失败',
  'ruleManager.useRuleManagerActions.failedToDeleteRule': '删除规则失败',
  'ruleManager.useRuleManagerActions.failedToExportRules': '导出规则失败',
  'ruleManager.useRuleManagerData.failedToLoadRules': '加载规则失败',
  'ruleSelectionDialog.dialogFooter.cancel': '取消操作',
  'ruleSelectionDialog.dialogHeader.chooseExceptionRule': '选择例外规则',
  'ruleSelectionDialog.errorBanner.dismissError': '关闭错误提示',
  'ruleSelectionDialog.pauseDurationCard.pauseDuration': '暂停时长设置',
  'ruleSelectionDialog.pauseDurationCard.pauseDurationInMinutes':
    '暂停时长（分钟）',
  'ruleSelectionDialog.pauseDurationCard.minutes': '输入分钟',
  'ruleSelectionDialog.pauseDurationCard.indefinite': '无限时间',
  'ruleSelectionDialog.searchBar.searchRules': '搜索规则',
  'ruleSelectionDialog.searchBar.searchRulesOrTypeANewRuleName':
    '搜索规则或输入新规则名称...',
  'ruleSelectionDialog.pauseTimer': '暂停计时',
  'ruleSelectionDialog.earlyCompletion': '提前完成',
  'taskCompletionDialog.notesSection.notesOptional': '备注（可选）',
  'taskCompletionDialog.notesSection.addMoreDetailsOrThoughts':
    '添加更多详细信息或感想…',
  'taskCompletionDialog.notesSection.ctrlEnterToCompleteEscToCancel':
    '按 Ctrl+Enter 完成，按 Esc 取消',
  'taskCompletionDialog.notesSection.addNotes': '添加备注',
  'taskCompletionDialog.notesSection.addNotesVariant2': '+ 添加备注',
  'taskCompletionDialog.taskCompletionDialogFooter.completeTask': '完成任务',
  'taskCompletionDialog.taskDescriptionSection.optional': '（可选）',
  'taskCompletionDialog.taskDescriptionSection.showHistory': '显示历史描述',
  'taskCompletionDialog.taskDescriptionSection.history': '历史',
  'taskCompletionDialog.taskDescriptionSection.eGFinishCs61aPart1TabToAddNotes':
    '例如：完成 CS61A 的第一部分（按 Tab 添加备注或自动填充）',
  'taskCompletionDialog.taskDescriptionSection.eGFinishCs61aPart1OptionalTabToAdd':
    '例如：完成 CS61A 的第一部分（可选，按 Tab 添加备注）',
  'taskCompletionDialog.taskDescriptionSection.recentDescriptions':
    '最近的任务描述',
  'taskCompletionDialog.taskDescriptionSection.tabToAddNotesOrAutoFillShiftTabForHistory':
    '按 Tab 添加备注或自动填充，按 Shift+Tab 显示历史，按 Enter 完成',
  'taskCompletionDialog.taskDescriptionSection.descriptionOptionalTabToAddNotesEnterToComplete':
    '任务描述可选，按 Tab 添加备注，按 Enter 完成',
  'taskGroupEditor.actionButtons.createGroup': '创建任务群',
  'taskGroupEditor.basicInfoSection.setTheBasicInformationForThisGroup':
    '设置任务群的基本信息',
  'taskGroupEditor.basicInfoSection.groupName': '任务群名称',
  'taskGroupEditor.basicInfoSection.giveYourGroupAClearAndRecognizableName':
    '为您的任务群起一个清晰易懂的名称',
  'taskGroupEditor.basicInfoSection.eGFinalsStudyPlanWebsiteProjectWorkoutPlan':
    '例如：期末复习计划、网站开发项目、健身训练计划',
  'taskGroupEditor.basicInfoSection.groupDescription': '任务群描述',
  'taskGroupEditor.basicInfoSection.describeTheGoalAndScopeOfThisGroup':
    '详细描述这个任务群的目标和范围',
  'taskGroupEditor.basicInfoSection.describeTheGoalAndScopeEGFinalsStudyPlan':
    '描述这个任务群的目标和范围，例如：期末复习计划，包含各科目的复习、练习题和模拟考试等',
  'taskGroupEditor.bookingSettingsSection.bookingSettings': '预约功能设置',
  'taskGroupEditor.bookingSettingsSection.configureBookingSignalDurationAndCompletionCondition':
    '配置预约信号、时长和完成条件',
  'taskGroupEditor.bookingSettingsSection.completionCondition': '预约完成条件',
  'taskGroupEditor.bookingSettingsSection.eGOpenTheFirstSubtaskPrepareYourMaterials':
    '例如：打开第一个子任务、准备好工作材料',
  'taskGroupEditor.bookingSettingsSection.thisIsTheActionYouMustCompleteDuringBookingSignaling':
    '这是你在预约时间内必须完成的动作，标志着正式开始执行任务群。',
  'taskGroupEditor.durationSection.howLongTheBookingPhaseLastsForPreparationAnd':
    '预约阶段的持续时间，用于准备和调整状态',
  'taskGroupEditor.taskGroupEditorView.editGroup': '编辑任务组',
  'taskGroupEditor.taskGroupEditorView.createGroup': '新建任务组',
  'taskGroupEditor.taskGroupEditorView.editGroupVariant2': '编辑任务组',
  'taskGroupEditor.taskGroupEditorView.createGroupVariant2': '新建任务组',
  'taskGroupEditor.taskGroupEditorView.groupSideRsipLinks':
    '任务组侧 RSIP 联动',
  'taskGroupEditor.taskGroupEditorView.configureLinksForThisTaskGroupDirectlyInThe':
    '可在编辑器中直接为该任务组配置联动。冲突采用最后写入生效（LWW）。',
  'taskGroupEditor.taskGroupEditorView.saveThisTaskGroupFirstThenConfigureRsipLinks':
    '请先保存任务组，再在这里配置 RSIP 联动。',
  'useChainDetail.interruptedByUser': '用户主动中断',
  'useTaskGroupEditor.pleaseEnterAGroupName': '请输入任务群名称',
  'useTaskGroupEditor.pleaseEnterAGroupDescription': '请输入任务群描述',
  'useTaskGroupEditor.pleaseChooseABookingSignal': '请选择预约信号',
  'useTaskGroupEditor.pleaseEnterACustomBookingSignal': '请输入自定义预约信号',
  'useTaskGroupEditor.pleaseEnterABookingCompletionCondition':
    '请输入预约完成条件',
  'virtualizedRuleList.createNewRuleItem.createNewRuleSearchQuery':
    '创建新规则: "{searchQuery}"',
  'virtualizedRuleList.createNewRuleItem.createAChainSpecificRule':
    '为当前任务链创建专属规则',
  'virtualizedRuleList.emptyState.noMatchingRulesFound': '未找到匹配的规则',
  'virtualizedRuleList.emptyState.noRulesAvailable': '暂无可用规则',
  'virtualizedRuleList.emptyState.createSearchQuery': '创建 "{searchQuery}"',
  'virtualizedRuleList.formatting.justNow': '刚刚',
  'virtualizedRuleList.formatting.prefixMatch': '前缀匹配',
  'virtualizedRuleList.formatting.containsMatch': '包含匹配',
  'virtualizedRuleList.formatting.fuzzyMatch': '模糊匹配',
  'sessions.completion.saveIsNotConfirmedYourTaskIsRetainedRetry':
    '保存尚未确认，请重试完成操作；任务已保留。',
  'sessions.completion.groupCompletedACycle': '任务群完成一轮',
  'sessions.groupStartFlow.groupHasExpired': '任务群已超时',
  'sessions.groupStartFlow.cycleUpdatedGroupTotalCompletionsCompletedStartingCycleUpdatedGroupTotalCompletionsNext':
    '第{updatedGroupTotalCompletions}轮已完成，正在开始第{updatedGroupTotalCompletionsNext}轮',
  'sessions.scheduling.failedToSchedulePleaseTryAgain': '预约失败，请重试',
  'sessions.scheduling.scheduleCompleted': '预约已完成',
  'sessions.scheduling.failedToCompleteBookingPleaseTryAgain':
    '完成预约失败，请重试',
  'sessions.start.failedToPersistSessionDatabaseMayBeReadOnlyOr':
    '无法保存任务会话：数据库可能处于只读状态或写入被拒绝（查看控制台）',
  'sessions.start.failedToCreateBettingSessionDatabaseMayBeReadOnly':
    '无法创建押注会话：数据库可能处于只读状态（查看控制台）',
  'useChainsDomain.saveFailedSafeDetail': '保存失败: {safeDetail}',
  'useChainsDomain.saveFailedCheckTheConsoleForDetailsThenTry':
    '保存失败，请重试（详情见控制台）',
  'useCheckinDomain.dailyCheckInRequiresLogin': '签到功能需要登录后使用',
  'useCheckinDomain.failedToLoadCheckInDataCheckTheConsoleFor':
    '加载签到数据失败，请重试（详情见控制台）',
  'useCheckinDomain.checkInFailedCheckTheConsoleForDetailsThenTry':
    '签到失败，请重试（详情见控制台）',
  'useCheckinDomain.checkedInEarnedResultPointsEarnedPointsStreakResultConsecutiveDaysDays':
    '签到成功！获得{resultPointsEarned} 积分，连续签到{resultConsecutiveDays} 天',
  'useCheckinDomain.checkInFailed': '签到失败',
  'useGroupDomain.toastPrefixSafeDetailCheckTheConsoleForDetails':
    '{toastPrefix}: {safeDetail}\n\n请查看控制台了解详细信息，然后重试',
  'useGroupDomain.copy': '(副本)',
  'useGroupDomain.failedToUpdateRepeatCount': '重复次数更新失败',
  'useGroupDomain.failedToUpdateRepeatCountCheckTheConsoleFor':
    '重复次数更新失败，请重试（详情见控制台）',
  'useImportExportDomain.authenticationFailedDuringImportPleaseMakeSureYouAre':
    '导入时身份验证失败：请确保您已正确登录，然后重试导入操作。',
  'useImportExportDomain.noValidChainsFoundToImport':
    '没有有效的链条数据可导入',
  'useRecycleBinDomain.deleteFailedSafeDetail': '删除失败: {safeDetail}',
  'useRecycleBinDomain.deleteFailedCheckTheConsoleForDetailsThenTry':
    '删除失败，请重试（详情见控制台）',
  'useRecycleBinDomain.couldNotRestoreStateAfterTheErrorRefreshThePage':
    '发生错误后无法恢复状态，建议刷新页面。',
  'enhancedDuplicationHandler.continue': '继续创建',
  'enhancedDuplicationHandler.checkFailedButYouCanTryCreatingIt':
    '检查失败，但可以尝试创建',
  'enhancedDuplicationHandler.duplicateCheckFailed': '重复检查失败',
  'enhancedDuplicationHandler.cannotCreateARuleWithADuplicateName':
    '不能创建重复名称的规则: "{name}"',
  'errorRecoveryManager.errorRecoveryFailed': '错误恢复过程失败',
  'errorRecoveryManager.manualFix': '手动处理',
  'errorRecoveryManager.thisRequiresManualIntervention': '需要手动解决此问题',
  'errorRecoveryManager.manualInterventionRequired': '需要手动处理',
  'duplication.enhancedHandler.creationHandlers.thisIsACommonRulePatternConsiderCheckingFor':
    '这是一个常见的规则模式，建议检查是否已有类似规则',
  'duplication.enhancedHandler.creationHandlers.ruleTypeRuleTypeDoesNotMatchRequested':
    '使用的规则类型 ({ruleType}) 与请求的类型 ({requestedType}) 不匹配',
  'duplication.enhancedHandler.creationHandlers.unableToGenerateAUsableNameSuggestion':
    '无法生成可用的名称建议',
  'duplication.enhancedHandler.creationHandlers.nameChangedToNewName':
    '名称已修改为 "{newName}"',
  'duplication.enhancedHandler.creationHandlers.similarRulesFoundSimilarNames':
    '发现相似规则: "{similarNames}"',
  'duplication.enhancedHandler.suggestionHelpers.useExistingRule':
    '使用现有规则',
  'duplication.enhancedHandler.suggestionHelpers.useTheExistingRuleExistingRuleName':
    '使用已存在的规则 "{existingRuleName}"',
  'duplication.enhancedHandler.suggestionHelpers.changeName': '修改名称',
  'duplication.enhancedHandler.suggestionHelpers.useTheSuggestedNameSuggestedName':
    '使用建议的名称 "{suggestedName}"',
  'duplication.enhancedHandler.suggestionHelpers.nameIsSimilarButNotIdenticalYouCanContinue':
    '名称相似但不完全相同，可以继续创建',
  'duplication.enhancedHandler.suggestionHelpers.useSimilarRule':
    '使用相似规则',
  'duplication.enhancedHandler.suggestionHelpers.considerUsingTheSimilarRuleMostSimilarName':
    '考虑使用相似的规则 "{mostSimilarName}"',
  'duplication.enhancedHandler.suggestionHelpers.ruleNameExistingRules0nameAlreadyExists':
    '规则名称 "{existingRules0Name}" 已存在',
  'duplication.enhancedHandler.suggestionHelpers.foundSimilarRuleNameSSimilarNames':
    '发现相似的规则名称: "{similarNames}"',
  'duplication.enhancedHandler.suggestionHelpers.noConflictDetected':
    '没有发现冲突',
  'feedback.errorMessageFormatter.invalidRuleTypePleaseCheckTheRuleSettings':
    '规则类型无效，请检查规则设置',
  'feedback.errorMessageFormatter.validationFailedSafeDetail':
    '输入验证失败：{safeDetail}',
  'feedback.errorMessageFormatter.validationFailed': '输入验证失败',
  'feedback.errorMessageFormatter.failedToSaveDataPleaseCheckYourConnectionOr':
    '数据保存失败，请检查网络连接或重试',
  'feedback.errorMessageFormatter.anUnknownErrorOccurred': '发生了未知错误',
  'feedback.errorMessageFormatter.ruleNotFound': '规则不存在',
  'feedback.errorMessageFormatter.duplicateRuleName': '规则名称重复',
  'feedback.errorMessageFormatter.ruleTypeMismatch': '规则类型不匹配',
  'feedback.errorMessageFormatter.invalidRuleType': '规则类型无效',
  'feedback.errorMessageFormatter.saveFailed': '数据保存失败',
  'feedback.errorMessageFormatter.operationFailed': '操作失败',
  'feedback.errorMessageFormatter.theSelectedRuleNoLongerExistsItMayHave':
    '所选的规则不存在，可能已被删除。请选择其他规则或创建新规则。',
  'feedback.errorMessageFormatter.theRuleDoesNotExistOrHasBeenDeleted':
    '规则不存在或已被删除，请选择其他规则或创建新规则。',
  'feedback.errorMessageFormatter.thisRuleNameAlreadyExistsYouCanUseThe':
    '规则名称已存在。您可以使用现有规则或为新规则选择不同的名称。',
  'feedback.errorMessageFormatter.thisRuleNameAlreadyExistsPleaseChooseADifferent':
    '规则名称已存在，请选择不同的名称或使用现有规则。',
  'feedback.errorMessageFormatter.thisRuleTypeDoesNotMatchTheCurrentAction':
    '规则类型与当前操作不匹配，请选择正确类型的规则。',
  'feedback.feedbackPresenter.notCompleted': '操作未完成',
  'feedback.interactiveFeedback.chooseARecoveryAction': '选择恢复操作',
  'feedback.interactiveFeedback.chooseHowToHandleThisIssue':
    '请选择如何处理这个问题：',
  'feedback.interactiveFeedback.confirm': '确认',
  'feedback.interactiveFeedback.viewErrorDetails': '查看错误详情',
  'feedback.interactiveFeedback.errorDetails': '错误详情',
  'importExport.import.chains.invalidImportFormatNoValidChainsFound':
    '导入数据格式错误：未找到有效的链条数据。',
  'importExport.import.chains.importDataContainsDuplicateChainIdSourceId':
    '导入数据包包含重复的链条ID: {sourceId}',
  'importExport.import.chains.untitledChain': '未命名链条',
  'importExport.import.payload.invalidImportFormatFileContentIsNotAnObject':
    '导入数据格式错误：文件内容不是对象。',
  'importExport.import.rsipCore.untitledPolicy': '未命名国策',
  'migration.migrationAnalyzer.failedToGetMigrationSuggestionsCheckDataIntegrity':
    '获取迁移建议失败，请检查数据完整性',
  'migration.migrationAnalyzer.foundDuplicateRulesCountDuplicatedRuleSDuplicatesWillBeMergedAfter':
    '发现 {duplicateRulesCount} 个重复使用的规则，迁移后将合并为单个规则',
  'migration.migrationAnalyzer.manyRulesDetectedConsiderOrganizingAndCategorizingThemAfter':
    '规则数量较多，建议迁移后进行整理和分类',
  'migration.migrationAnalyzer.foundCommonPatternsCountCommonPatternRuleSConsiderStandardizingNaming':
    '发现 {commonPatternsCount} 个常见模式的规则，建议统一命名规范',
  'migration.migrationAnalyzer.dataLooksGoodYouCanMigrateDirectly':
    '数据结构良好，可以直接进行迁移',
  'migration.migrationAnalyzer.missingMigrationRecord': '缺少迁移记录',
  'migration.migrationAnalyzer.migratedRuleCountMismatchExpectedMigrationInfoTotalRulesGotMigratedRulesCount':
    '迁移规则数量不匹配：期望 {migrationInfoTotalRules}，实际 {migratedRulesCount}',
  'migration.migrationAnalyzer.ruleRuleIdDataIsIncomplete':
    '规则 {ruleId} 数据不完整',
  'migration.migrationAnalyzer.validationErrorOccurredCheckConsoleForDetails':
    '验证过程中发生错误，请查看控制台',
  'migration.migrationAnalyzer.exceptionRuleMigrationReport':
    '例外规则迁移报告',
  'migration.migrationExecutor.analyzingExistingData': '分析现有数据...',
  'migration.migrationExecutor.noDataToMigrate': '没有需要迁移的数据',
  'migration.migrationExecutor.startingMigrationForExceptionRulesFromResultTotalChainsChainS':
    '开始迁移 {resultTotalChains} 个链条的例外规则...',
  'migration.migrationExecutor.migrationDoneSavingMigrationInfo':
    '完成迁移，保存迁移信息...',
  'migration.migrationExecutor.migrationCompletedCreatedResultMigratedRulesRuleS':
    '迁移完成！创建了 {resultMigratedRules} 个规则',
  'migration.migrationExecutor.creatingRuleRuleName': '创建规则: {ruleName}',
  'migration.migrationExecutor.noMigrationRecordFound': '没有找到迁移记录',
  'migration.migrationExecutor.rollbackSucceededDeletedDeletedCountRuleS':
    '成功回滚迁移，删除了 {deletedCount} 个规则',
  'migration.migrationExecutor.rollbackFailed': '回滚失败',
  'migration.migrationExecutor.operationFailedCheckConsoleForDetails':
    '操作失败，请查看控制台',
  'platform.systemNotificationService.taskFailed': '任务失败',
  'platform.systemNotificationService.taskEndingSoon': '任务即将结束',
  'platform.systemNotificationService.scheduleExpiring': '预约即将到期',
  'platform.systemNotificationService.scheduleFailed': '预约失败',
  'recovery.defaultStrategies.unableToAutoRecoverTheMissingRule':
    '无法自动恢复缺失的规则',
  'recovery.defaultStrategies.duplicateRuleNameDetected': '发现重复的规则名称',
  'recovery.defaultStrategies.ruleTypeDoesNotMatchTheAction':
    '规则类型与操作不匹配',
  'recovery.defaultStrategies.autoFixedSuccessCountDataIssueS':
    '已自动修复 {successCount} 个数据问题',
  'recovery.defaultStrategies.storageErrorRequiresManualHandling':
    '存储错误需要手动处理',
  'recovery.defaultStrategies.validationRequiresYourConfirmation':
    '验证错误需要用户确认',
  'recovery.defaultStrategies.fixValidationIssues': '修复验证问题',
  'recovery.defaultStrategies.tryToFixValidationIssues': '尝试修复数据验证问题',
  'recovery.defaultStrategies.unknownErrorTypeErrorType':
    '未知错误类型: {errorType}',
  'recovery.defaultStrategies.checkDataIntegrity': '检查数据完整性',
  'recovery.defaultStrategies.checkAndRepairRuleData': '检查并修复规则数据',
  'recovery.defaultStrategies.allAutoRecoveryStrategiesFailed':
    '所有自动恢复策略都失败了',
  'recovery.defaultStrategies.resetSystem': '重置系统',
  'recovery.defaultStrategies.resetTheRuleSystemToTheInitialState':
    '重置规则系统到初始状态',
  'recovery.recoveryHandlers.pleaseCreateANewRule': '请创建新规则',
  'recovery.recoveryHandlers.pleaseSelectAnExistingRule': '请选择现有规则',
  'recovery.recoveryHandlers.usingExistingRule': '使用现有规则',
  'recovery.recoveryHandlers.noUsableExistingRuleFound':
    '无法找到可用的现有规则',
  'recovery.recoveryHandlers.suggestedNameSuggestionsItem':
    '建议使用名称: {suggestionsItem}',
  'recovery.recoveryHandlers.unableToGenerateANewRuleName':
    '无法生成新的规则名称',
  'recovery.recoveryHandlers.pleaseCreateARuleWithTheCorrectType':
    '请创建正确类型的规则',
  'recovery.recoveryHandlers.pleaseSelectARuleWithAMatchingType':
    '请选择类型匹配的规则',
  'recovery.recoveryHandlers.pleaseRetryTheOperation': '请重试操作',
  'recovery.recoveryHandlers.dataIntegrityCheckPassed': '数据完整性检查通过',
  'recovery.recoveryHandlers.foundReportIssuesCountIssueSAutoFixableCountCanBeAutoFixed':
    '发现 {reportIssuesCount} 个问题，其中 {autoFixableCount} 个可自动修复',
  'recovery.recoveryHandlers.autoFix': '自动修复',
  'recovery.recoveryHandlers.automaticallyFixTheFixableIssues':
    '自动修复可修复的问题',
  'recovery.recoveryHandlers.fixedSuccessCountIssueS':
    '已修复 {successCount} 个问题',
  'recovery.recoveryHandlers.dataIntegrityCheckFailed': '数据完整性检查失败',
  'recovery.recoveryHandlers.fixingValidationRequiresYourInput':
    '验证修复需要用户输入',
  'recovery.recoveryHandlers.systemResetIsRiskyAndRequiresConfirmation':
    '系统重置是危险操作，需要用户确认',
  'recovery.recoveryOptionsProvider.createNewRule': '创建新规则',
  'recovery.recoveryOptionsProvider.createANewRuleToReplaceTheMissingOne':
    '创建一个新的规则来替代缺失的规则',
  'recovery.recoveryOptionsProvider.selectExistingRule': '选择现有规则',
  'recovery.recoveryOptionsProvider.chooseOneFromExistingRules':
    '从现有规则中选择一个',
  'recovery.recoveryOptionsProvider.useTheExistingRuleWithTheSameName':
    '使用已存在的同名规则',
  'recovery.recoveryOptionsProvider.renameRule': '重命名规则',
  'recovery.recoveryOptionsProvider.generateADifferentNameForTheNewRule':
    '为新规则生成一个不同的名称',
  'recovery.recoveryOptionsProvider.createCorrectType': '创建正确类型的规则',
  'recovery.recoveryOptionsProvider.createANewRuleWithAMatchingType':
    '创建一个类型匹配的新规则',
  'recovery.recoveryOptionsProvider.selectMatchingRule': '选择匹配的规则',
  'recovery.recoveryOptionsProvider.selectAnExistingRuleWithAMatchingType':
    '选择一个类型匹配的现有规则',
  'recovery.recoveryOptionsProvider.tryTheOperationAgain': '重新尝试执行操作',
  'recovery.recoveryOptionsProvider.runADataIntegrityCheckAndAutoFixIfPossible':
    '运行数据完整性检查和修复',
  'ruleManager.ruleCreator.ruleCreatedViaErrorRecovery':
    '通过错误恢复创建了规则',
  'ruleManager.ruleMaintenanceService.similarRulesFoundSimilarRuleNames':
    '发现相似规则: {similarRuleNames}',
  'ruleManager.ruleMaintenanceService.noActiveExceptionRules':
    '没有活跃的例外规则',
  'ruleManager.ruleMaintenanceService.rulesExistButNoUsageRecords':
    '有规则但没有使用记录',
  'ruleManager.ruleMaintenanceService.noRulesUsedInTheLast30Days':
    '超过30天未使用任何规则',
  'ruleManager.ruleMaintenanceService.duplicateRuleNamesFoundDuplicateNames':
    '发现重复规则名称: {duplicateNames}',
  'ruleManager.ruleMaintenanceService.systemCheckFailed': '系统检查失败: ',
  'storage.storageContext.supabaseIsNotConfiguredSoCloudModeIsUnavailable':
    '未检测到 Supabase 配置，无法切换到云端模式。',
  'storage.storageContext.failedToLoadCloudStorageSwitchedBackToLocal':
    '加载云端存储失败，已自动切回本地模式。',
  'storage.storageContext.initializingStorage': '初始化存储…',
  'types.exceptionRuleErrors.contactSupport': '联系技术支持',
  'types.exceptionRuleErrors.aCriticalErrorOccurredPleaseContactSupport':
    '系统遇到严重错误，请联系技术支持',
  'platformAdapters.updater.newVersionFoundUpdatingAndRestarting':
    '检测到新版本，正在自动更新并重启…',
  'importUnitsModal.controllerSelectedUnitsSizeSelectedModeLabel':
    '已选择 {controllerSelectedUnitsSize} 个任务单元（{modeLabel}）',
  'ruleItem.diffDaysDAgo': '{diffDays}天前',
  'ruleItem.weeksWAgo': '{weeks}周前',
  'ruleItem.monthsMoAgo': '{months}个月前',
  'auxiliaryJudgment.auxiliaryJudgmentActions.bookingStreakResetsFromPropsChainAuxiliaryStreakTo0':
    '辅助链记录将从 #{propsChainAuxiliaryStreak} 清零为 #0',
  'bettingModal.bettingFormSections.betAmountPts': '≈ {betAmount} 积分',
  'bettingModal.useBetPlacementForm.betPlacedBetNumAmountPointsPotentialPayoutResultValuePotentialPayoutPoints':
    '押注成功！押注 {numAmount} 积分，潜在收益 {resultValuePotentialPayout} 积分',
  'groupCard.groupCardSummary.groupTotalCompletionsCycles':
    '#{groupTotalCompletions}轮',
  'groupCard.groupCardSummary.cycleGroupTotalCompletions1InProgress':
    '• 第{groupTotalCompletions1}轮进行中',
  'groupView.groupOverview.completedGroupTotalCompletionsCycles':
    '已完成 {groupTotalCompletions} 轮',
  'groupView.groupOverview.progressCompletedProgressTotalRepeats':
    '({progressCompleted}/{progressTotal} 重复次数)',
  'groupView.groupViewHeader.cyclePropsGroupTotalCompletions1InProgress':
    '🔄 第{propsGroupTotalCompletions1}轮进行中',
  'recycleBinModal.bulkActionsBar.selectedChainsCountSelected':
    '已选择 {selectedChainsCount} 项',
  'recycleBinModal.timeFormat.diffMinutesMinAgo': '{diffMinutes}分钟前',
  'ruleSelectionDialog.chainInfoCard.elapsedMathFloorSessionContextElapsedTime60Min':
    '已进行 {mathFloorSessionContextElapsedTime60} 分钟',
  'ruleSelectionDialog.chainInfoCard.mathFloorSessionContextRemainingTime60MinRemaining':
    '，剩余 {mathFloorSessionContextRemainingTime60} 分钟',
  'ruleSelectionDialog.dialogHeader.chooseARuleForActionLabel':
    '为{actionLabel}操作选择适用的规则',
  'virtualizedRuleList.formatting.diffHoursHAgo': '{diffHours}小时前',
  'feedback.interactiveFeedback.operationCompleted': '{operation}完成',
  'feedback.interactiveFeedback.totalTotalSucceededSuccess':
    '总计 {total} 项，成功 {success} 项',
  'feedback.interactiveFeedback.failedFailed': '，失败 {failed} 项',
  'platform.systemNotificationService.quotedChainNameReason':
    '{quotedChainName}：{reason}',
  'platform.systemNotificationService.chainNameCompletedSuffixCurrentStreakStreak':
    '"{chainName}"已完成！{suffix}当前记录: #{streak}',
  'platform.systemNotificationService.chainNameHasTimeRemainingLeftStayFocused':
    '"{chainName}"还剩{timeRemaining}，请继续保持专注！',
  'platform.systemNotificationService.chainNameScheduleHasTimeRemainingLeftGetReady':
    '"{chainName}"预约还剩{timeRemaining}，请准备开始任务！',
  'platform.systemNotificationService.chainNameScheduleExpiredAdjudicationRequired':
    '"{chainName}"预约时间已到期，需要进行规则判定。',
} satisfies Record<TranslationKey, string>;

export const translations = {
  en: enTranslations,
  zh: zhTranslations,
} satisfies Record<Language, Record<TranslationKey, string>>;
