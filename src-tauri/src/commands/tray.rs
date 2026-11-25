/// Tray menu entries whose text follows the app language.
#[cfg(desktop)]
pub struct TrayMenuItems {
    pub show: tauri::menu::MenuItem<tauri::Wry>,
    pub quit: tauri::menu::MenuItem<tauri::Wry>,
}

/// Renames the tray menu after the web layer changes language. Mobile builds
/// have no tray, so the command does nothing there.
#[tauri::command]
pub fn set_tray_labels(
    #[allow(unused_variables)] app: tauri::AppHandle,
    #[allow(unused_variables)] show: String,
    #[allow(unused_variables)] quit: String,
) -> Result<(), String> {
    #[cfg(desktop)]
    {
        use tauri::Manager;
        if let Some(items) = app.try_state::<TrayMenuItems>() {
            items.show.set_text(show).map_err(|e| e.to_string())?;
            items.quit.set_text(quit).map_err(|e| e.to_string())?;
        }
    }
    Ok(())
}
