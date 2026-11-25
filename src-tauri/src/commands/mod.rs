pub mod file_ops;
pub mod notifications;
pub mod session_alarm;
pub mod tray;
pub mod window;

#[tauri::command]
pub fn get_platform() -> String {
    std::env::consts::OS.to_string()
}

#[cfg(test)]
mod tests {
    use super::get_platform;

    #[test]
    fn get_platform_reports_the_compilation_target() {
        assert_eq!(get_platform(), std::env::consts::OS);
    }
}
