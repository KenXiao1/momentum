//! Carries the webview's stored data over from the previous app identifier.
//!
//! The webview keeps local-mode data (localStorage) in a directory named after
//! the app identifier, so renaming the identifier would make an upgraded app
//! start empty. Before the first window opens, an empty new directory receives
//! a copy of the old one. The old directory is left in place as a backup.

use std::fs;
use std::io;
use std::path::{Path, PathBuf};

/// The identifier releases up to 0.3.6 shipped with.
pub const LEGACY_IDENTIFIER: &str = "com.momentum.app";

/// Copies `from` into `to` when `from` exists and `to` is missing or empty.
/// Returns whether anything was copied.
pub fn copy_if_unclaimed(from: &Path, to: &Path) -> io::Result<bool> {
    if !from.is_dir() {
        return Ok(false);
    }
    if to.is_dir() && fs::read_dir(to)?.next().is_some() {
        return Ok(false);
    }
    copy_dir(from, to)?;
    Ok(true)
}

fn copy_dir(from: &Path, to: &Path) -> io::Result<()> {
    fs::create_dir_all(to)?;
    for entry in fs::read_dir(from)? {
        let entry = entry?;
        let target = to.join(entry.file_name());
        let file_type = entry.file_type()?;
        if file_type.is_dir() {
            copy_dir(&entry.path(), &target)?;
        } else if file_type.is_file() {
            fs::copy(entry.path(), &target)?;
        }
        // Symlinks are skipped: webview stores do not need them.
    }
    Ok(())
}

/// The directory named after `legacy` next to `current`, whose last component
/// is the current identifier.
pub fn legacy_sibling(current: &Path, legacy: &str) -> Option<PathBuf> {
    current.parent().map(|parent| parent.join(legacy))
}

/// Pairs of (legacy, current) webview data directories for this platform.
#[cfg(desktop)]
pub fn webview_data_dirs(app: &tauri::App) -> Vec<(PathBuf, PathBuf)> {
    use tauri::Manager;

    let mut pairs = Vec::new();
    // Windows and Linux: Tauri stores webview data in the app-local data dir.
    #[cfg(any(target_os = "windows", target_os = "linux"))]
    if let Ok(current) = app.path().app_local_data_dir() {
        if let Some(legacy) = legacy_sibling(&current, LEGACY_IDENTIFIER) {
            pairs.push((legacy, current));
        }
    }
    // macOS: WKWebView's default store lives under ~/Library/WebKit/<bundle id>.
    #[cfg(target_os = "macos")]
    if let Ok(home) = app.path().home_dir() {
        let current = home
            .join("Library")
            .join("WebKit")
            .join(&app.config().identifier);
        if let Some(legacy) = legacy_sibling(&current, LEGACY_IDENTIFIER) {
            pairs.push((legacy, current));
        }
    }
    pairs
}

/// Copies each legacy webview directory that the current identifier has not
/// used yet. Failures are logged and leave the app starting with empty data.
#[cfg(desktop)]
pub fn migrate_webview_data(app: &tauri::App) {
    for (legacy, current) in webview_data_dirs(app) {
        match copy_if_unclaimed(&legacy, &current) {
            Ok(true) => eprintln!(
                "momentum: copied webview data from {} to {}",
                legacy.display(),
                current.display()
            ),
            Ok(false) => {}
            Err(error) => eprintln!(
                "momentum: could not copy webview data from {}: {error}",
                legacy.display()
            ),
        }
    }
}

#[cfg(test)]
mod tests {
    use super::{copy_if_unclaimed, legacy_sibling};
    use std::fs;
    use std::path::{Path, PathBuf};
    use std::sync::atomic::{AtomicU64, Ordering};

    static NEXT: AtomicU64 = AtomicU64::new(0);

    struct Scratch(PathBuf);

    impl Scratch {
        fn new() -> Self {
            let path = std::env::temp_dir().join(format!(
                "momentum-identifier-tests-{}-{}",
                std::process::id(),
                NEXT.fetch_add(1, Ordering::Relaxed)
            ));
            fs::create_dir_all(&path).expect("scratch directory");
            Self(path)
        }
    }

    impl Drop for Scratch {
        fn drop(&mut self) {
            let _ = fs::remove_dir_all(&self.0);
        }
    }

    fn write(path: &Path, contents: &str) {
        fs::create_dir_all(path.parent().expect("parent")).expect("dirs");
        fs::write(path, contents).expect("write");
    }

    #[test]
    fn copies_a_legacy_store_into_a_missing_directory() {
        let scratch = Scratch::new();
        let legacy = scratch.0.join("com.momentum.app");
        let current = scratch.0.join("io.github.example.momentum");
        write(
            &legacy.join("EBWebView/Default/Local Storage/leveldb/000003.log"),
            "chains",
        );

        assert!(copy_if_unclaimed(&legacy, &current).expect("copy"));
        assert_eq!(
            fs::read_to_string(current.join("EBWebView/Default/Local Storage/leveldb/000003.log"))
                .expect("copied file"),
            "chains"
        );
        assert!(legacy.join("EBWebView").is_dir(), "the legacy copy stays");
    }

    #[test]
    fn copies_into_an_empty_directory_but_never_over_data() {
        let scratch = Scratch::new();
        let legacy = scratch.0.join("legacy");
        let current = scratch.0.join("current");
        write(&legacy.join("store"), "old");
        fs::create_dir_all(&current).expect("empty current");

        assert!(copy_if_unclaimed(&legacy, &current).expect("first launch"));
        write(&current.join("store"), "new");
        assert!(!copy_if_unclaimed(&legacy, &current).expect("later launch"));
        assert_eq!(
            fs::read_to_string(current.join("store")).expect("kept"),
            "new"
        );
    }

    #[test]
    fn does_nothing_without_a_legacy_store() {
        let scratch = Scratch::new();
        let current = scratch.0.join("current");

        assert!(!copy_if_unclaimed(&scratch.0.join("missing"), &current).expect("no-op"));
        assert!(!current.exists());
    }

    #[test]
    fn finds_the_legacy_directory_beside_the_current_one() {
        assert_eq!(
            legacy_sibling(
                Path::new("/data/io.github.example.momentum"),
                "com.momentum.app"
            ),
            Some(PathBuf::from("/data/com.momentum.app"))
        );
    }
}
