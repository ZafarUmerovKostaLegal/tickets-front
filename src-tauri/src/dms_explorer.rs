use base64::Engine;
use std::fs;
use std::path::PathBuf;
use std::process::Command;

#[derive(serde::Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct WriteTempArgs {
    pub file_name: String,
    pub bytes_base64: String,
}

fn sanitize_file_name(name: &str) -> String {
    let cleaned: String = name
        .chars()
        .map(|ch| match ch {
            '<' | '>' | ':' | '"' | '/' | '\\' | '|' | '?' | '*' => '_',
            c if c.is_control() => '_',
            c => c,
        })
        .collect();
    let trimmed = cleaned.trim().trim_matches('.');
    if trimmed.is_empty() {
        "document.bin".to_string()
    } else {
        trimmed.chars().take(180).collect()
    }
}

#[tauri::command]
pub fn show_dms_explorer(app: tauri::AppHandle) -> Result<(), String> {
    #[cfg(desktop)]
    {
        use tauri::{Manager, WebviewUrl, WebviewWindowBuilder};
        if let Some(window) = app.get_webview_window("dms-explorer") {
            let _ = window.show();
            let _ = window.unminimize();
            let _ = window.set_focus();
            return Ok(());
        }
        WebviewWindowBuilder::new(&app, "dms-explorer", WebviewUrl::App("/files/explorer".into()))
            .title("Kosta DMS Explorer")
            .inner_size(1280.0, 820.0)
            .min_inner_size(960.0, 640.0)
            .center()
            .build()
            .map_err(|err| err.to_string())?;
        Ok(())
    }
    #[cfg(not(desktop))]
    {
        let _ = app;
        Err("DMS Explorer is desktop-only".into())
    }
}

#[tauri::command]
pub fn dms_write_temp_file(args: WriteTempArgs) -> Result<String, String> {
    let bytes = base64::engine::general_purpose::STANDARD
        .decode(args.bytes_base64.trim())
        .map_err(|err| err.to_string())?;
    let dir = std::env::temp_dir().join("kosta-dms");
    fs::create_dir_all(&dir).map_err(|err| err.to_string())?;
    let path = dir.join(sanitize_file_name(&args.file_name));
    fs::write(&path, bytes).map_err(|err| err.to_string())?;
    Ok(path.to_string_lossy().to_string())
}

#[tauri::command]
pub fn dms_open_path(path: String) -> Result<(), String> {
    let path = PathBuf::from(path);
    if !path.exists() {
        return Err("file not found".into());
    }
    #[cfg(windows)]
    {
        Command::new("cmd")
            .args(["/C", "start", "", &path.to_string_lossy()])
            .spawn()
            .map_err(|err| err.to_string())?;
        return Ok(());
    }
    #[cfg(target_os = "macos")]
    {
        Command::new("open")
            .arg(&path)
            .spawn()
            .map_err(|err| err.to_string())?;
        return Ok(());
    }
    #[cfg(all(unix, not(target_os = "macos")))]
    {
        Command::new("xdg-open")
            .arg(&path)
            .spawn()
            .map_err(|err| err.to_string())?;
        return Ok(());
    }
    #[allow(unreachable_code)]
    Err("open not supported on this platform".into())
}

#[tauri::command]
pub fn dms_send_outlook_attachment(path: String, subject: Option<String>) -> Result<(), String> {
    let path = PathBuf::from(path);
    if !path.exists() {
        return Err("attachment not found".into());
    }
    let subject = subject.unwrap_or_else(|| "Kosta DMS".to_string());
    #[cfg(windows)]
    {
        let path_str = path.to_string_lossy().replace('\'', "''");
        let subject_safe = subject.replace('\'', "''");
        let script = format!(
            "$ol = New-Object -ComObject Outlook.Application; \
             $mail = $ol.CreateItem(0); \
             $mail.Subject = '{subject}'; \
             $null = $mail.Attachments.Add('{path}'); \
             $mail.Display()",
            subject = subject_safe,
            path = path_str
        );
        let status = Command::new("powershell")
            .args(["-NoProfile", "-ExecutionPolicy", "Bypass", "-Command", &script])
            .status()
            .map_err(|err| err.to_string())?;
        if !status.success() {
            // Fallback: open Outlook compose with attachment switch when COM fails.
            let _ = Command::new("outlook.exe")
                .args(["/a", &path.to_string_lossy()])
                .spawn();
        }
        return Ok(());
    }
    #[cfg(not(windows))]
    {
        let _ = subject;
        Err("Send Attachment via Outlook is supported on Windows only".into())
    }
}
