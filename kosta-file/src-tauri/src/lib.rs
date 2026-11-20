//! Kosta File — the DMS desktop app (MacroView-style): matters, folders and Disk in its own
//! window, documents edited in Word / Excel with every save going back to Kosta as a new version.
//! Runs once per user, lives in the tray, and the window opens on the DMS Explorer.

#[path = "../../../src-tauri/src/dms_explorer.rs"]
#[allow(dead_code)]
mod dms_explorer;
#[path = "../../../src-tauri/src/edit_session.rs"]
mod edit_session;

use tauri::menu::{Menu, MenuItem};
use tauri::tray::{MouseButton, MouseButtonState, TrayIconBuilder, TrayIconEvent};
use tauri::{AppHandle, LogicalSize, Manager, WindowEvent};

fn show_main(app: &AppHandle) {
    if let Some(window) = app.get_webview_window("main") {
        let _ = window.show();
        let _ = window.unminimize();
        let _ = window.set_focus();
    }
}

fn setup_window_and_tray(app: &tauri::App) -> tauri::Result<()> {
    if let Some(window) = app.get_webview_window("main") {
        let _ = window.set_min_size(Some(LogicalSize::new(1024.0, 680.0)));
        let hide = window.clone();
        // Closing the window keeps Kosta File in the tray: Office saves still reach Kosta.
        window.on_window_event(move |event| {
            if let WindowEvent::CloseRequested { api, .. } = event {
                api.prevent_close();
                let _ = hide.hide();
            }
        });
    }

    let open = MenuItem::with_id(app, "open", "Открыть Kosta File", true, None::<&str>)?;
    let edits = MenuItem::with_id(app, "edits", "Открыть папку редактирования", true, None::<&str>)?;
    let quit = MenuItem::with_id(app, "quit", "Выход", true, None::<&str>)?;
    let menu = Menu::with_items(app, &[&open, &edits, &quit])?;
    let mut tray = TrayIconBuilder::with_id("kosta-file")
        .menu(&menu)
        .show_menu_on_left_click(false)
        .tooltip("Kosta File")
        .on_menu_event(|app, event| match event.id.as_ref() {
            "open" => show_main(app),
            "edits" => {
                let root = edit_session::edit_root();
                let _ = std::fs::create_dir_all(&root);
                let _ = dms_explorer::dms_open_path(root.to_string_lossy().to_string());
            }
            "quit" => app.exit(0),
            _ => {}
        })
        .on_tray_icon_event(|tray, event| {
            if let TrayIconEvent::Click {
                button: MouseButton::Left,
                button_state: MouseButtonState::Up,
                ..
            } = event
            {
                show_main(tray.app_handle());
            }
        });
    if let Some(icon) = app.default_window_icon() {
        tray = tray.icon(icon.clone());
    }
    tray.build(app)?;
    Ok(())
}

#[cfg_attr(mobile, tauri::mobile_entry_point)]
pub fn run() {
    tauri::Builder::default()
        // A second launch (desktop shortcut, Start menu) just brings the running window back.
        .plugin(tauri_plugin_single_instance::init(|app, _args, _cwd| show_main(app)))
        .setup(|app| {
            setup_window_and_tray(app)?;
            Ok(())
        })
        .invoke_handler(tauri::generate_handler![
            dms_explorer::dms_write_temp_file,
            dms_explorer::dms_open_path,
            dms_explorer::dms_send_outlook_attachment,
            edit_session::kf_capabilities,
            edit_session::kf_edit_open,
            edit_session::kf_read_edit_file,
            edit_session::kf_edit_close,
            edit_session::kf_edit_list,
        ])
        .run(tauri::generate_context!())
        .expect("error while running Kosta File");
}
