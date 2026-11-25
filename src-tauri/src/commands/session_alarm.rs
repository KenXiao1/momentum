//! A system notification for the end of a focus session, timed by Rust.
//!
//! The web layer's timers are throttled or suspended while the window is
//! hidden, so the moment a session ends could pass unnoticed. Scheduling here
//! fires on time; pausing, finishing or interrupting the session cancels it.

use std::collections::HashMap;
use std::sync::Mutex;
use std::time::{Duration, SystemTime, UNIX_EPOCH};

/// The latest schedule per session key; a sleeping timer fires only if its
/// token is still the current one when it wakes.
#[derive(Default)]
pub struct SessionAlarms {
    tokens: Mutex<HashMap<String, u64>>,
    next_token: Mutex<u64>,
}

impl SessionAlarms {
    pub fn arm(&self, key: &str) -> u64 {
        let mut next = self.next_token.lock().unwrap_or_else(|e| e.into_inner());
        *next += 1;
        let token = *next;
        self.tokens
            .lock()
            .unwrap_or_else(|e| e.into_inner())
            .insert(key.to_string(), token);
        token
    }

    pub fn disarm(&self, key: &str) {
        self.tokens
            .lock()
            .unwrap_or_else(|e| e.into_inner())
            .remove(key);
    }

    /// Consumes the schedule if `token` is still current for `key`.
    pub fn take_if_current(&self, key: &str, token: u64) -> bool {
        let mut tokens = self.tokens.lock().unwrap_or_else(|e| e.into_inner());
        if tokens.get(key) == Some(&token) {
            tokens.remove(key);
            true
        } else {
            false
        }
    }
}

/// Time left until `fire_at_ms` (Unix milliseconds); zero once it has passed.
pub fn delay_until(fire_at_ms: u64, now: SystemTime) -> Duration {
    let now_ms = now
        .duration_since(UNIX_EPOCH)
        .map(|elapsed| elapsed.as_millis() as u64)
        .unwrap_or(0);
    Duration::from_millis(fire_at_ms.saturating_sub(now_ms))
}

#[tauri::command]
pub fn schedule_session_end(
    #[allow(unused_variables)] app: tauri::AppHandle,
    #[allow(unused_variables)] key: String,
    #[allow(unused_variables)] fire_at_ms: u64,
    #[allow(unused_variables)] title: String,
    #[allow(unused_variables)] body: String,
) {
    #[cfg(desktop)]
    {
        use tauri::Manager;
        use tauri_plugin_notification::NotificationExt;

        let token = app.state::<SessionAlarms>().arm(&key);
        std::thread::spawn(move || {
            std::thread::sleep(delay_until(fire_at_ms, SystemTime::now()));
            if !app.state::<SessionAlarms>().take_if_current(&key, token) {
                return;
            }
            // A focused window already shows the completion dialog and sound.
            let focused = app
                .get_webview_window("main")
                .and_then(|window| window.is_focused().ok())
                .unwrap_or(false);
            if !focused {
                let _ = app
                    .notification()
                    .builder()
                    .title(&title)
                    .body(&body)
                    .show();
            }
        });
    }
}

#[tauri::command]
pub fn cancel_session_end(
    #[allow(unused_variables)] app: tauri::AppHandle,
    #[allow(unused_variables)] key: String,
) {
    #[cfg(desktop)]
    {
        use tauri::Manager;
        app.state::<SessionAlarms>().disarm(&key);
    }
}

#[cfg(test)]
mod tests {
    use super::{delay_until, SessionAlarms};
    use std::time::{Duration, UNIX_EPOCH};

    #[test]
    fn only_the_latest_schedule_for_a_session_fires() {
        let alarms = SessionAlarms::default();
        let first = alarms.arm("session-1");
        let second = alarms.arm("session-1");

        assert!(!alarms.take_if_current("session-1", first));
        assert!(alarms.take_if_current("session-1", second));
        assert!(!alarms.take_if_current("session-1", second));
    }

    #[test]
    fn a_cancelled_schedule_does_not_fire() {
        let alarms = SessionAlarms::default();
        let token = alarms.arm("session-1");
        alarms.disarm("session-1");

        assert!(!alarms.take_if_current("session-1", token));
    }

    #[test]
    fn sessions_are_scheduled_independently() {
        let alarms = SessionAlarms::default();
        let one = alarms.arm("session-1");
        let two = alarms.arm("session-2");
        alarms.disarm("session-1");

        assert!(!alarms.take_if_current("session-1", one));
        assert!(alarms.take_if_current("session-2", two));
    }

    #[test]
    fn the_delay_counts_down_to_the_end_and_never_goes_negative() {
        let now = UNIX_EPOCH + Duration::from_millis(10_000);
        assert_eq!(delay_until(70_000, now), Duration::from_millis(60_000));
        assert_eq!(delay_until(5_000, now), Duration::ZERO);
    }
}
