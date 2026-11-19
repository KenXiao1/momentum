import fs from 'node:fs';
import { pathToFileURL } from 'node:url';

// `tauri build` refuses mismatched major.minor versions between each Rust
// crate and its @tauri-apps npm package, but it only runs on release tags.
// This check fails the PR that introduces the mismatch instead.

const NPM_FOR_CRATE = {
  tauri: '@tauri-apps/api',
};

function npmNameFor(crate) {
  if (NPM_FOR_CRATE[crate]) return NPM_FOR_CRATE[crate];
  if (crate.startsWith('tauri-plugin-')) {
    return `@tauri-apps/${crate.slice('tauri-'.length)}`;
  }
  return null;
}

export function parseCargoLockVersions(cargoLock) {
  const versions = new Map();
  for (const block of cargoLock.split('[[package]]')) {
    const name = /^name = "([^"]+)"$/m.exec(block)?.[1];
    const version = /^version = "([^"]+)"$/m.exec(block)?.[1];
    if (name && version) versions.set(name, version);
  }
  return versions;
}

export function findTauriMismatches(crateVersions, packageLock) {
  const minor = (version) => version.split('.').slice(0, 2).join('.');
  const mismatches = [];
  for (const [crate, crateVersion] of crateVersions) {
    const npmName = npmNameFor(crate);
    const npmVersion =
      npmName && packageLock.packages?.[`node_modules/${npmName}`]?.version;
    if (npmVersion && minor(npmVersion) !== minor(crateVersion)) {
      mismatches.push({ crate, crateVersion, npmName, npmVersion });
    }
  }
  return mismatches;
}

if (
  process.argv[1] &&
  import.meta.url === pathToFileURL(process.argv[1]).href
) {
  const mismatches = findTauriMismatches(
    parseCargoLockVersions(fs.readFileSync('src-tauri/Cargo.lock', 'utf8')),
    JSON.parse(fs.readFileSync('package-lock.json', 'utf8')),
  );
  for (const m of mismatches) {
    console.error(
      `${m.crate} ${m.crateVersion} (Cargo.lock) vs ${m.npmName} ${m.npmVersion} (package-lock.json)`,
    );
  }
  if (mismatches.length > 0) {
    console.error('Upgrade both sides to the same major.minor version.');
    process.exitCode = 1;
  } else {
    console.log('Tauri npm and Cargo versions are aligned');
  }
}
