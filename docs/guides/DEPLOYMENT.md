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

## Tauri

Native builds require Rust stable, Node from `.nvmrc`, and platform dependencies:

| Platform | Build prerequisites                                                      |
| -------- | ------------------------------------------------------------------------ |
| Windows  | Visual Studio Build Tools with C++ desktop development                   |
| macOS    | Xcode Command Line Tools                                                 |
| Linux    | WebKitGTK, AppIndicator, librsvg; exact packages in the release workflow |

```sh
npm run tauri dev
npm run quality:rust
npm run tauri build
```

Bundles are produced under `src-tauri/target/release/bundle/`.
Configuration lives in `src-tauri/tauri.conf.json`, Rust features/dependencies
in `src-tauri/Cargo.toml`, and permissions in `src-tauri/capabilities/`.
The [architecture guide](ARCHITECTURE.md#platform-and-tauri) describes the
browser/native boundary and why Tauri disables the PWA plugin.

## Native releases

The [Tauri release workflow](../../.github/workflows/tauri-build.yml) runs for
`v*` tags or manual dispatch and builds Windows, macOS, and Linux packages.
Mobile code paths exist, but mobile release packaging is still in progress.

Tagged versions must match `src-tauri/tauri.conf.json`. The workflow currently
requires Supabase build secrets, and tagged releases require an updater signing
key. Its environment declarations are the source for accepted secret names and
legacy aliases. Updater endpoint/public-key configuration lives in
`tauri.conf.json`; signing private keys belong in release secrets.

Native installers and updater artifacts have platform-specific packaging and
signing requirements. The workflow is the source of truth for the currently
configured release steps; a local build alone does not verify publication.
