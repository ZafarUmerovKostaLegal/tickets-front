mod network_drive;

#[cfg_attr(mobile, tauri::mobile_entry_point)]
pub fn run() {
  tauri::Builder::default()
    .setup(|app| {
      if cfg!(debug_assertions) {
        app.handle().plugin(
          tauri_plugin_log::Builder::default()
            .level(log::LevelFilter::Info)
            .build(),
        )?;
      }
      Ok(())
    })
    .invoke_handler(tauri::generate_handler![
      network_drive::list_unc_entries,
      network_drive::get_folder_acl,
      network_drive::connect_unc_share,
      network_drive::grant_folder_access,
      network_drive::revoke_folder_access,
      network_drive::get_folder_owner,
      network_drive::set_folder_owner,
    ])
    .run(tauri::generate_context!())
    .expect("error while running tauri application");
}
