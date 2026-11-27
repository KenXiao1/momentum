//! Daily chain reminders, timed by Rust in local time.
//!
//! The desktop app often sits hidden in the tray, where the web layer's timers
//! are throttled or suspended. The web layer sends the whole reminder list
//! whenever it changes; one background thread posts each reminder once a day.

use chrono::{Duration as Span, NaiveDate, NaiveDateTime, NaiveTime};
use serde::Deserialize;
use std::collections::HashMap;
use std::sync::{Condvar, Mutex};
use std::time::Duration;

/// A reminder that fires late (the computer was asleep) still counts if it is
/// at most this many minutes past its time.
const GRACE_MINUTES: i64 = 5;
/// The thread re-checks at least this often, so clock changes and wake-ups
/// are noticed without a platform-specific hook.
const MAX_SLEEP: Duration = Duration::from_secs(60);

#[derive(Clone, Debug, Deserialize, PartialEq)]
pub struct Reminder {
    pub key: String,
    pub hour: u32,
    pub minute: u32,
    pub title: String,
    pub body: String,
}

#[derive(Default)]
struct State {
    reminders: Vec<Reminder>,
    /// The local day each reminder last fired, so it fires once per day.
    fired_on: HashMap<String, NaiveDate>,
}

#[derive(Default)]
pub struct DailyReminders {
    state: Mutex<State>,
    changed: Condvar,
}

/// Whether a reminder at `hour:minute` should fire at `now`.
pub fn is_due(now: NaiveDateTime, hour: u32, minute: u32, fired_on: Option<NaiveDate>) -> bool {
    let Some(at) = NaiveTime::from_hms_opt(hour, minute, 0) else {
        return false;
    };
    if fired_on == Some(now.date()) {
        return false;
    }
    let scheduled = now.date().and_time(at);
    now >= scheduled && now < scheduled + Span::minutes(GRACE_MINUTES)
}

/// How long to sleep before the next reminder, capped at `MAX_SLEEP`.
pub fn until_next(now: NaiveDateTime, reminders: &[Reminder]) -> Duration {
    let next = reminders
        .iter()
        .filter_map(|reminder| NaiveTime::from_hms_opt(reminder.hour, reminder.minute, 0))
        .map(|at| {
            let today = now.date().and_time(at);
            if today > now {
                today
            } else {
                today + Span::days(1)
            }
        })
        .min();
    next.and_then(|next| (next - now).to_std().ok())
        .map_or(MAX_SLEEP, |wait| wait.min(MAX_SLEEP))
        .max(Duration::from_millis(500))
}

impl DailyReminders {
    pub fn replace(&self, reminders: Vec<Reminder>) {
        let mut state = self.state.lock().unwrap_or_else(|e| e.into_inner());
        state.reminders = reminders;
        self.changed.notify_all();
    }

    /// The reminders due at `now`, each marked as fired for today.
    pub fn take_due(&self, now: NaiveDateTime) -> Vec<Reminder> {
        let mut state = self.state.lock().unwrap_or_else(|e| e.into_inner());
        let State {
            reminders,
            fired_on,
        } = &mut *state;
        let mut due = Vec::new();
        for reminder in reminders.iter() {
            let last = fired_on.get(&reminder.key).copied();
            if is_due(now, reminder.hour, reminder.minute, last) {
                fired_on.insert(reminder.key.clone(), now.date());
                due.push(reminder.clone());
            }
        }
        due
    }

    /// Sleeps until the next reminder or a change to the list.
    pub fn wait(&self, now: NaiveDateTime) {
        let state = self.state.lock().unwrap_or_else(|e| e.into_inner());
        let wait = until_next(now, &state.reminders);
        let _ = self.changed.wait_timeout(state, wait);
    }
}

/// Starts the thread that posts due reminders as system notifications.
#[cfg(desktop)]
pub fn start(app: tauri::AppHandle) {
    use tauri::Manager;
    use tauri_plugin_notification::NotificationExt;

    std::thread::spawn(move || loop {
        let reminders = app.state::<DailyReminders>();
        for reminder in reminders.take_due(chrono::Local::now().naive_local()) {
            let _ = app
                .notification()
                .builder()
                .title(&reminder.title)
                .body(&reminder.body)
                .show();
        }
        reminders.wait(chrono::Local::now().naive_local());
    });
}

/// Replaces the reminder list. Mobile builds keep no list.
#[tauri::command]
pub fn set_daily_reminders(
    #[allow(unused_variables)] app: tauri::AppHandle,
    #[allow(unused_variables)] reminders: Vec<Reminder>,
) {
    #[cfg(desktop)]
    {
        use tauri::Manager;
        app.state::<DailyReminders>().replace(reminders);
    }
}

#[cfg(test)]
mod tests {
    use super::{is_due, until_next, DailyReminders, Reminder, MAX_SLEEP};
    use chrono::{NaiveDate, NaiveDateTime};
    use std::time::Duration;

    fn at(day: u32, hour: u32, minute: u32) -> NaiveDateTime {
        NaiveDate::from_ymd_opt(2026, 11, day)
            .and_then(|date| date.and_hms_opt(hour, minute, 0))
            .expect("valid time")
    }

    fn reminder(key: &str, hour: u32, minute: u32) -> Reminder {
        Reminder {
            key: key.into(),
            hour,
            minute,
            title: "Time to write".into(),
            body: "Sit at your desk".into(),
        }
    }

    #[test]
    fn is_due_from_its_time_through_the_grace_period() {
        assert!(!is_due(at(25, 19, 59), 20, 0, None));
        assert!(is_due(at(25, 20, 0), 20, 0, None));
        assert!(is_due(at(25, 20, 4), 20, 0, None));
        assert!(!is_due(at(25, 20, 5), 20, 0, None));
        assert!(!is_due(at(25, 20, 0), 24, 0, None));
    }

    #[test]
    fn fires_once_per_day() {
        let reminders = DailyReminders::default();
        reminders.replace(vec![reminder("write", 20, 0), reminder("read", 21, 0)]);

        assert_eq!(
            reminders.take_due(at(25, 20, 0)),
            vec![reminder("write", 20, 0)]
        );
        assert!(reminders.take_due(at(25, 20, 1)).is_empty());
        // Sending the same list again does not repeat today's reminder.
        reminders.replace(vec![reminder("write", 20, 0), reminder("read", 21, 0)]);
        assert!(reminders.take_due(at(25, 20, 2)).is_empty());
        assert_eq!(reminders.take_due(at(26, 20, 0)).len(), 1);
    }

    #[test]
    fn sleeps_until_the_next_reminder_but_never_longer_than_a_minute() {
        let reminders = [reminder("write", 20, 0)];

        assert_eq!(
            until_next(at(25, 19, 59), &reminders),
            Duration::from_secs(60)
        );
        assert_eq!(until_next(at(25, 12, 0), &reminders), MAX_SLEEP);
        assert_eq!(until_next(at(25, 12, 0), &[]), MAX_SLEEP);
        assert_eq!(
            until_next(at(25, 19, 59) + chrono::Duration::seconds(30), &reminders),
            Duration::from_secs(30)
        );
    }
}
