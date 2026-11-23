use base64::Engine;
use serde::{Deserialize, Serialize};
use std::collections::hash_map::DefaultHasher;
use std::collections::HashMap;
use std::fs;
use std::hash::{Hash, Hasher};
use std::path::{Path, PathBuf};
use std::sync::atomic::{AtomicBool, Ordering};
use std::sync::{Arc, Mutex, OnceLock};
use std::thread;
use std::time::{Duration, SystemTime};
use tauri::{AppHandle, Emitter};

const POLL: Duration = Duration::from_millis(1500);
pub const SAVED_EVENT: &str = "kf-edit-saved";

#[derive(Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct EditOpenArgs {
    pub document_id: String,
    pub file_name: String,
    pub bytes_base64: String,
}

#[derive(Serialize, Clone)]
#[serde(rename_all = "camelCase")]
pub struct EditSaved {
    pub document_id: String,
    pub file_name: String,
    pub path: String,
    pub size: u64,
}

#[derive(Serialize, Clone)]
#[serde(rename_all = "camelCase")]
pub struct EditInfo {
    pub document_id: String,
    pub file_name: String,
    pub path: String,
}

struct Session {
    file_name: String,
    path: PathBuf,
    stop: Arc<AtomicBool>,
}

fn sessions() -> &'static Mutex<HashMap<String, Session>> {
    static SESSIONS: OnceLock<Mutex<HashMap<String, Session>>> = OnceLock::new();
    SESSIONS.get_or_init(|| Mutex::new(HashMap::new()))
}

pub fn edit_root() -> PathBuf {
    let base = std::env::var_os("LOCALAPPDATA")
        .map(PathBuf::from)
        .unwrap_or_else(std::env::temp_dir);
    base.join("Kosta").join("KostaFile").join("Edit")
}

fn safe_part(raw: &str, fallback: &str) -> String {
    let cleaned: String = raw
        .chars()
        .map(|ch| match ch {
            '<' | '>' | ':' | '"' | '/' | '\\' | '|' | '?' | '*' => '_',
            c if c.is_control() => '_',
            c => c,
        })
        .collect();
    let trimmed = cleaned.trim().trim_matches('.').to_string();
    if trimmed.is_empty() {
        fallback.to_string()
    } else {
        trimmed.chars().take(180).collect()
    }
}

fn digest(bytes: &[u8]) -> u64 {
    let mut hasher = DefaultHasher::new();
    bytes.hash(&mut hasher);
    hasher.finish()
}

fn signature(path: &Path) -> Option<(SystemTime, u64)> {
    let meta = fs::metadata(path).ok()?;
    Some((meta.modified().ok()?, meta.len()))
}

fn open_with_default_app(path: &Path) -> Result<(), String> {
    #[cfg(windows)]
    {
        use std::os::windows::process::CommandExt;
        const CREATE_NO_WINDOW: u32 = 0x0800_0000;
        std::process::Command::new("cmd")
            .args(["/C", "start", ""])
            .arg(path)
            .creation_flags(CREATE_NO_WINDOW)
            .spawn()
            .map_err(|err| err.to_string())?;
        return Ok(());
    }
    #[cfg(target_os = "macos")]
    {
        std::process::Command::new("open").arg(path).spawn().map_err(|err| err.to_string())?;
        return Ok(());
    }
    #[allow(unreachable_code)]
    Err("opening files is not supported on this platform".into())
}

fn watch(app: AppHandle, document_id: String, file_name: String, path: PathBuf, stop: Arc<AtomicBool>, initial: u64) {
    thread::spawn(move || {
        let mut last_hash = initial;
        let mut last_sig = signature(&path);
        let mut pending: Option<(SystemTime, u64)> = None;
        while !stop.load(Ordering::Relaxed) {
            thread::sleep(POLL);
            let Some(sig) = signature(&path) else { continue };
            if Some(sig) == last_sig {
                pending = None;
                continue;
            }
            if pending != Some(sig) {
                pending = Some(sig);
                continue;
            }
            let Ok(bytes) = fs::read(&path) else { continue };
            last_sig = Some(sig);
            pending = None;
            let hash = digest(&bytes);
            if hash == last_hash || bytes.is_empty() {
                continue;
            }
            last_hash = hash;
            let _ = app.emit(SAVED_EVENT, EditSaved {
                document_id: document_id.clone(),
                file_name: file_name.clone(),
                path: path.to_string_lossy().to_string(),
                size: bytes.len() as u64,
            });
        }
    });
}

#[tauri::command]
pub fn kf_capabilities() -> serde_json::Value {
    serde_json::json!({ "editInOffice": true, "editRoot": edit_root().to_string_lossy() })
}

#[tauri::command]
pub fn kf_edit_open(app: AppHandle, args: EditOpenArgs) -> Result<EditInfo, String> {
    let bytes = base64::engine::general_purpose::STANDARD
        .decode(args.bytes_base64.trim())
        .map_err(|err| err.to_string())?;
    let document_id = safe_part(&args.document_id, "document");
    let file_name = safe_part(&args.file_name, "document.bin");
    let dir = edit_root().join(&document_id);
    fs::create_dir_all(&dir).map_err(|err| err.to_string())?;
    let path = dir.join(&file_name);

    let mut map = sessions().lock().map_err(|_| "edit sessions are unavailable".to_string())?;
    if let Some(existing) = map.get(&document_id) {
        open_with_default_app(&existing.path)?;
        return Ok(EditInfo {
            document_id,
            file_name: existing.file_name.clone(),
            path: existing.path.to_string_lossy().to_string(),
        });
    }
    fs::write(&path, &bytes).map_err(|err| format!("не удалось сохранить рабочую копию: {err}"))?;
    let stop = Arc::new(AtomicBool::new(false));
    watch(app, document_id.clone(), file_name.clone(), path.clone(), stop.clone(), digest(&bytes));
    map.insert(document_id.clone(), Session { file_name: file_name.clone(), path: path.clone(), stop });
    drop(map);
    open_with_default_app(&path)?;
    Ok(EditInfo { document_id, file_name, path: path.to_string_lossy().to_string() })
}

#[tauri::command]
pub fn kf_read_edit_file(path: String) -> Result<String, String> {
    let root = fs::canonicalize(edit_root()).map_err(|err| err.to_string())?;
    let target = fs::canonicalize(PathBuf::from(&path)).map_err(|err| err.to_string())?;
    if !target.starts_with(&root) {
        return Err("path is outside the edit folder".into());
    }
    let bytes = fs::read(&target).map_err(|err| err.to_string())?;
    Ok(base64::engine::general_purpose::STANDARD.encode(bytes))
}

#[tauri::command]
pub fn kf_edit_close(document_id: String) -> Result<bool, String> {
    let mut map = sessions().lock().map_err(|_| "edit sessions are unavailable".to_string())?;
    Ok(match map.remove(&safe_part(&document_id, "document")) {
        Some(session) => {
            session.stop.store(true, Ordering::Relaxed);
            true
        }
        None => false,
    })
}

#[tauri::command]
pub fn kf_edit_list() -> Vec<EditInfo> {
    let Ok(map) = sessions().lock() else { return Vec::new() };
    map.iter()
        .map(|(id, session)| EditInfo {
            document_id: id.clone(),
            file_name: session.file_name.clone(),
            path: session.path.to_string_lossy().to_string(),
        })
        .collect()
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn names_are_made_safe() {
        assert_eq!(safe_part("..\\..\\evil:name?.docx", "x"), "_.._evil_name_.docx");
        assert_eq!(safe_part("  ", "fallback"), "fallback");
        assert_eq!(safe_part("Договор №5.docx", "x"), "Договор №5.docx");
    }

    #[test]
    fn digest_changes_with_content() {
        assert_ne!(digest(b"v1"), digest(b"v2"));
        assert_eq!(digest(b"same"), digest(b"same"));
    }
}
