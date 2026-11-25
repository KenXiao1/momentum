mod commands;
mod identifier_migration;

use tauri::Manager;

#[cfg_attr(mobile, tauri::mobile_entry_point)]
pub fn run() {
    let mut builder = tauri::Builder::default()
        .plugin(tauri_plugin_notification::init())
        .plugin(tauri_plugin_dialog::init())
        .plugin(tauri_plugin_fs::init())
        .plugin(tauri_plugin_process::init());

    #[cfg(desktop)]
    {
        builder = builder.plugin(tauri_plugin_updater::Builder::new().build());
    }

    #[cfg(mobile)]
    {
        builder = builder.plugin(tauri_plugin_haptics::init());
    }

    builder
        .manage(commands::session_alarm::SessionAlarms::default())
        .invoke_handler(tauri::generate_handler![
            commands::get_platform,
            commands::notifications::send_notification,
            commands::window::set_fullscreen,
            commands::window::minimize_to_tray,
            commands::file_ops::save_file,
            commands::file_ops::open_file,
            commands::tray::set_tray_labels,
            commands::session_alarm::schedule_session_end,
            commands::session_alarm::cancel_session_end,
        ])
        .setup(|app| {
            #[cfg(desktop)]
            identifier_migration::migrate_webview_data(app);

            // The main window is created here, after the data migration, so
            // its webview opens the migrated store. Config sets create: false.
            if let Some(config) = app.config().app.windows.first().cloned() {
                tauri::WebviewWindowBuilder::from_config(app.handle(), &config)?.build()?;
            }

            #[cfg(desktop)]
            {
                use tauri::menu::{Menu, MenuItem};
                use tauri::tray::TrayIconBuilder;

                let show = MenuItem::with_id(app, "show", "显示 Momentum", true, None::<&str>)?;
                let quit = MenuItem::with_id(app, "quit", "退出", true, None::<&str>)?;
                let menu = Menu::with_items(app, &[&show, &quit])?;
                app.manage(commands::tray::TrayMenuItems {
                    show: show.clone(),
                    quit: quit.clone(),
                });

                TrayIconBuilder::new()
                    .icon(app.default_window_icon().unwrap().clone())
                    .menu(&menu)
                    .on_menu_event(
                        |app_handle: &tauri::AppHandle, event| match event.id.as_ref() {
                            "show" => {
                                if let Some(w) = app_handle.get_webview_window("main") {
                                    let _ = w.show();
                                    let _ = w.set_focus();
                                }
                            }
                            "quit" => app_handle.exit(0),
                            _ => {}
                        },
                    )
                    .build(app)?;
            }
            Ok(())
        })
        .run(tauri::generate_context!())
        .expect("error while running tauri application");
}
