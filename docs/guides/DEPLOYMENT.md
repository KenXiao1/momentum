# Momentum deployment

## Web

Use the Node version in [.nvmrc](../../.nvmrc); supported versions are declared
in [package.json](../../package.json). Build and inspect the bundle locally:

```sh
npm ci
npm run typecheck
npm run build
npm run preview
```

[netlify.toml](../../netlify.toml) owns the build command, output directory
(`dist/`), Node version, and SPA redirect. Cloud mode reads
`VITE_SUPABASE_URL` and `VITE_SUPABASE_ANON_KEY` at build time; local mode does
not require Supabase. See [.env.example](../../.env.example).

The existing deployment is [momentumctdp](https://momentumctdp.netlify.app).
For a requested Netlify deployment, use the CLI's `netlify status` to verify the
linked site, then `netlify deploy --prod --dir=dist` to publish the prepared
bundle. The PowerShell helper [deploy.ps1](../../deploy.ps1) builds and deploys
to its configured site; inspect that target before using it.

Database deployment is separate: follow the
[migration guide](apply-migration.md) for schema changes.

### Error reporting

Error reports go to Sentry only from production builds with `VITE_SENTRY_DSN`
set, and only after a user turns on "Send error reports" in Settings (off by
default). The SDK is loaded on demand when reporting starts, and
`src/utils/errorReporting.ts` drops the user, cookies, headers, bodies, URL
queries and console breadcrumbs before sending. Errors passed to
`logger.error` are reported with their category; logged context objects stay
local. Both CSPs allow `https://*.sentry.io`.

Source maps are built (hidden, with no `sourceMappingURL`) and uploaded only
when `SENTRY_AUTH_TOKEN`, `SENTRY_ORG` and `SENTRY_PROJECT` are all set; the
plugin deletes the `.map` files after upload, so none are deployed. Set them in
Netlify's environment for the web build. The release workflow reads
`VITE_SENTRY_DSN`, `SENTRY_ORG` and `SENTRY_PROJECT` from repository variables
and `SENTRY_AUTH_TOKEN` from secrets; all are optional.

## Tauri

Native builds require Rust stable, Node from `.nvmrc`, and platform dependencies:

| Platform | Build prerequisites                                                      |
| -------- | ------------------------------------------------------------------------ |
| Windows  | Visual Studio Build Tools with C++ desktop development                   |
| macOS    | Xcode Command Line Tools                                                 |
| Linux    | WebKitGTK, AppIndicator, librsvg; exact packages in the release workflow |

The macOS app requires macOS 13.3 or later (`bundle.macOS.minimumSystemVersion`).
Its WebView is the system WebKit, and Tailwind CSS 4 needs Safari 16.4 features
such as `@property` and `color-mix()`. Windows (WebView2) and Android System
WebView update independently of the OS; Tailwind 4 needs Chromium 111 or later.

```sh
npm run tauri dev
npm run quality:rust
npm run tauri build
```

Bundles are produced under `src-tauri/target/release/bundle/`.

The app identifier is `io.github.kenxiao1.momentum`; releases up to 0.3.6 used
`com.momentum.app`. The webview stores local-mode data in a directory named
after the identifier (`~/Library/WebKit/<id>` on macOS, the app-local data
directory on Windows and Linux), so on desktop startup, before the main window
is created, `src-tauri/src/identifier_migration.rs` copies the old directory
into an unused new one and leaves the old copy in place. Android and iOS treat
a new identifier as a different app, and their data cannot be carried over:
mobile users of an old build should export a backup before installing.
Capabilities name the `main` window; a capability without `windows` grants
nothing.
Configuration lives in `src-tauri/tauri.conf.json`, Rust features/dependencies
in `src-tauri/Cargo.toml`, and permissions in `src-tauri/capabilities/`.
The [architecture guide](ARCHITECTURE.md#platform-and-tauri) describes the
browser/native boundary and why Tauri disables the PWA plugin.

## Native releases

The [Tauri release workflow](../../.github/workflows/tauri-build.yml) runs for
`v*` tags or manual dispatch and builds Windows, macOS, and Linux packages.
Only a pushed `v*` tag can publish a GitHub release. Manual dispatch produces
workflow artifacts only, even when dispatched at an existing version tag.
Android also builds in CI and keeps its original APK filenames in the
`android-development-artifacts` workflow artifact. Android release signing is
not configured, so these development artifacts are excluded from GitHub releases
and are not advertised as installable packages. Mobile release packaging remains
in progress.

Both tag and manual runs first require successful `CI` for the exact checked-out
commit from a push to the default branch, including its `required` job. The
commit must be on the default branch's history. A failed, cancelled, pending, or
missing latest run blocks all package builds. Publication repeats this check so
a failed rerun during packaging cannot reuse earlier success. Merge through a
pull request, wait for default-branch CI to succeed, then create the version tag.
Do not rename the stable `required` job without updating branch protection and
`tools/quality/release-gate.mjs` together. Only the publication job receives
write access to repository contents.

Tagged versions must match `src-tauri/tauri.conf.json`. The workflow currently
requires Supabase build secrets, and tagged releases require an updater signing
key. Its environment declarations are the source for accepted secret names and
legacy aliases. Updater endpoint/public-key configuration lives in
`tauri.conf.json`; signing private keys belong in release secrets.

Native installers and updater artifacts have platform-specific packaging and
signing requirements. The workflow is the source of truth for the currently
configured release steps; a local build alone does not verify publication.
