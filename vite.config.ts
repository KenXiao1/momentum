import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import { VitePWA } from 'vite-plugin-pwa';
import { visualizer } from 'rollup-plugin-visualizer';
import { sentryVitePlugin } from '@sentry/vite-plugin';
import { readFileSync } from 'node:fs';

const isTauri = !!process.env.TAURI_ENV_PLATFORM;
const appVersion: string = JSON.parse(
  readFileSync(new URL('./package.json', import.meta.url), 'utf8'),
).version;
// Source maps are built and uploaded only when a release build can send them
// to Sentry; they are deleted from the output afterwards.
const uploadSourceMaps = Boolean(
  process.env.SENTRY_AUTH_TOKEN &&
  process.env.SENTRY_ORG &&
  process.env.SENTRY_PROJECT,
);

// 自定义插件：性能优化（预连接 + 首屏样式）
function performanceOptimizations() {
  let supabaseUrl: string | undefined;
  return {
    name: 'performance-optimizations',
    configResolved(config: { env: Record<string, string> }) {
      supabaseUrl = config.env.VITE_SUPABASE_URL;
    },
    transformIndexHtml(html: string) {
      // 1. 预连接放到 <head> 最前面
      const preconnect = supabaseUrl
        ? `<link rel="preconnect" href="${supabaseUrl}" crossorigin>\n    <link rel="dns-prefetch" href="${supabaseUrl}">\n    `
        : '';

      // 2. 首屏背景色 - 根据系统主题自动切换
      const criticalBg = `<style>
      @media(prefers-color-scheme:dark){html,body{background:#0F0F12}}
      @media(prefers-color-scheme:light){html,body{background:#f8fafc}}
    </style>\n    `;

      // 插入到 <meta charset> 之后
      return html.replace(
        '<meta charset="UTF-8" />',
        `<meta charset="UTF-8" />\n    ${preconnect}${criticalBg}`,
      );
    },
  };
}

// https://vitejs.dev/config/
export default defineConfig({
  define: {
    __APP_VERSION__: JSON.stringify(appVersion),
  },
  plugins: [
    performanceOptimizations(),
    react(),
    // Tauri 构建时禁用 PWA（Service Worker 与 Tauri WebView 冲突）
    ...(!isTauri
      ? [
          VitePWA({
            registerType: 'autoUpdate',
            includeAssets: [
              'favicon.svg',
              'apple-touch-icon.png',
              'icons/icon-192.png',
              'icons/icon-512.png',
            ],
            manifest: {
              name: 'Momentum - 心理学驱动的专注力应用',
              short_name: 'Momentum',
              description:
                '帮助您建立高效的工作习惯，通过任务链和专注模式提升生产力',
              lang: 'zh-CN',
              theme_color: '#6366F1',
              background_color: '#0F0F12',
              display: 'standalone',
              start_url: '/',
              scope: '/',
              icons: [
                {
                  src: 'icons/icon-192.png',
                  sizes: '192x192',
                  type: 'image/png',
                  purpose: 'any maskable',
                },
                {
                  src: 'icons/icon-512.png',
                  sizes: '512x512',
                  type: 'image/png',
                  purpose: 'any maskable',
                },
              ],
            },
            workbox: {
              globPatterns: ['**/*.{js,css,html,ico,png,svg,woff2}'],
              // Only the app shell is precached. Supabase responses carry one
              // user's data and must never outlive sign-out or stand in for a
              // failed read; src/utils/apiResponseCache.ts purges the cache
              // that earlier builds created.
            },
          }),
        ]
      : []),
    // Bundle 分析工具 - 运行 npm run build 后查看 stats.html
    visualizer({
      filename: 'stats.html',
      open: false,
      gzipSize: true,
      brotliSize: true,
    }),
    ...(uploadSourceMaps
      ? [
          sentryVitePlugin({
            org: process.env.SENTRY_ORG,
            project: process.env.SENTRY_PROJECT,
            authToken: process.env.SENTRY_AUTH_TOKEN,
            release: { name: `momentum@${appVersion}` },
            sourcemaps: { filesToDeleteAfterUpload: ['./dist/**/*.map'] },
            telemetry: false,
          }),
        ]
      : []),
  ],
  server: {
    host: isTauri ? '0.0.0.0' : undefined,
    port: 5173,
    strictPort: true,
  },
  optimizeDeps: {
    include: ['lucide-react'],
    // 强制预构建以避免开发时的延迟
    force: false,
  },
  build: {
    rolldownOptions: {
      output: {
        codeSplitting: {
          groups: [
            // 核心 React 库 - 首屏必需
            {
              name: 'vendor-react',
              test: /node_modules[\\/](react|react-dom|scheduler)[\\/]/,
            },
            // Supabase 客户端 - 延迟加载
            {
              name: 'vendor-supabase',
              test: /node_modules[\\/]@supabase[\\/]/,
            },
            // 图标库 - 单独分块以便tree-shaking
            {
              name: 'vendor-icons',
              test: /node_modules[\\/]lucide-react[\\/]/,
            },
          ],
        },
        // Merged into Vite's oxc minifier options; build-only, so no
        // NODE_ENV check. Legal comments are already stripped when minifying.
        minify: { compress: { dropConsole: true, dropDebugger: true } },
      },
    },
    // 调整警告阈值
    chunkSizeWarningLimit: 500,
    // Hidden maps (no sourceMappingURL) exist only for the Sentry upload.
    sourcemap: uploadSourceMaps ? 'hidden' : false,
    // 启用CSS代码分割
    cssCodeSplit: true,
    // 设置目标浏览器以减少polyfill
    target: 'es2020',
    // 资源内联阈值 - 小于4KB的资源内联
    assetsInlineLimit: 4096,
    // 启用 modulePreload polyfill
    modulePreload: {
      polyfill: true,
    },
  },
});
