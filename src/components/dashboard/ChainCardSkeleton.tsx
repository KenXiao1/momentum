/**
 * ChainCardSkeleton — 与 ChainCard 形状吻合的骨架屏
 * 使用 animate-pulse 代替转圈 spinner，让加载感觉更快更精致
 */

export function ChainCardSkeleton() {
  return (
    <div className="bento-card animate-pulse" aria-hidden="true">
      {/* 标题行 */}
      <div className="mb-6 flex items-start justify-between">
        <div className="flex flex-1 items-center space-x-3 pr-4">
          <div className="h-8 w-8 shrink-0 rounded-xl bg-gray-200 dark:bg-slate-700" />
          <div className="flex-1 space-y-2">
            <div className="h-6 w-3/4 rounded-lg bg-gray-200 dark:bg-slate-700" />
            <div className="h-3 w-1/2 rounded-sm bg-gray-100 dark:bg-slate-800" />
          </div>
        </div>
        <div className="h-8 w-8 rounded-lg bg-gray-100 dark:bg-slate-800" />
      </div>

      {/* 描述行 */}
      <div className="mb-6 space-y-2">
        <div className="h-3 w-full rounded-sm bg-gray-100 dark:bg-slate-800" />
        <div className="h-3 w-5/6 rounded-sm bg-gray-100 dark:bg-slate-800" />
      </div>

      {/* 两个 stat box */}
      <div className="mb-6 grid grid-cols-2 gap-4">
        <div className="h-20 rounded-2xl bg-gray-100 dark:bg-slate-800" />
        <div className="h-20 rounded-2xl bg-gray-100 dark:bg-slate-800" />
      </div>

      {/* 时长行 */}
      <div className="mb-6 h-10 rounded-xl bg-gray-100 dark:bg-slate-800" />

      {/* 操作按钮 */}
      <div className="flex space-x-3">
        <div className="h-12 flex-1 rounded-2xl bg-gray-200 dark:bg-slate-700" />
        <div className="h-12 flex-1 rounded-2xl bg-gray-100 dark:bg-slate-800" />
      </div>
    </div>
  );
}
