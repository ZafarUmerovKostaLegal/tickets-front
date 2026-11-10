mod dms_explorer;

#[cfg(desktop)]
fn configure_main_window(app: &tauri::App) -> tauri::Result<()> {
  use tauri::menu::{Menu, MenuItem};
  use tauri::tray::{MouseButton, MouseButtonState, TrayIconBuilder, TrayIconEvent};
  use tauri::{LogicalSize, Manager, WindowEvent};

  let Some(window) = app.get_webview_window("main") else {
    return Ok(());
  };
  let _ = window.set_min_size(Some(LogicalSize::new(1024.0, 700.0)));
  let _ = window.center();

  let reopen = window.clone();
  window.on_window_event(move |event| {
    if let WindowEvent::CloseRequested { api, .. } = event {
      api.prevent_close();
      let _ = reopen.hide();
    }
  });

  let show = MenuItem::with_id(app, "show", "Открыть Hub", true, None::<&str>)?;
  let dms = MenuItem::with_id(app, "dms", "Kosta DMS Explorer", true, None::<&str>)?;
  let quit = MenuItem::with_id(app, "quit", "Выход", true, None::<&str>)?;
  let menu = Menu::with_items(app, &[&show, &dms, &quit])?;
  let mut tray = TrayIconBuilder::new()
    .menu(&menu)
    .show_menu_on_left_click(false)
    .tooltip("Kosta Legal")
    .on_menu_event(|app, event| match event.id.as_ref() {
      "show" => show_main(app),
      "dms" => {
        let _ = dms_explorer::show_dms_explorer(app.clone());
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

#[tauri::command]
fn show_chat_notification(app: tauri::AppHandle, title: String, body: String) -> Result<(), String> {
  use tauri_plugin_notification::NotificationExt;
  app.notification()
    .builder()
    .title(title)
    .body(body)
    .show()
    .map_err(|err| err.to_string())
}

#[cfg(desktop)]
fn show_main(app: &tauri::AppHandle) {
  use tauri::Manager;
  if let Some(window) = app.get_webview_window("main") {
    let _ = window.show();
    let _ = window.unminimize();
    let _ = window.set_focus();
  }
}

#[cfg_attr(mobile, tauri::mobile_entry_point)]
pub fn run() {
  tauri::Builder::default()
    .plugin(tauri_plugin_notification::init())
    .setup(|app| {
      if cfg!(debug_assertions) {
        app.handle().plugin(
          tauri_plugin_log::Builder::default()
            .level(log::LevelFilter::Info)
            .build(),
        )?;
      }

      #[cfg(desktop)]
      configure_main_window(app)?;

      Ok(())
    })
    .invoke_handler(tauri::generate_handler![
      dms_explorer::show_dms_explorer,
      dms_explorer::dms_write_temp_file,
      dms_explorer::dms_open_path,
      dms_explorer::dms_send_outlook_attachment,
      show_chat_notification,
    ])
    .run(tauri::generate_context!())
    .expect("error while running tauri application");
}
