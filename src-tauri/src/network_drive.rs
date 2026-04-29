use serde::Deserialize;
use serde::Serialize;

#[derive(Debug, Clone, Serialize, serde::Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct UncEntry {
    pub name: String,
    pub is_dir: bool,
}

#[derive(Debug, Clone, Serialize, serde::Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct AclLine {
    pub identity: String,
    pub icacls_identity: String,
    pub rights: String,
    pub access: String,
    pub inherited: bool,
}

fn strip_verbatim_prefix(s: &str) -> &str {
    s.strip_prefix(r"\\?\").unwrap_or(s)
}

#[tauri::command]
pub fn list_unc_entries(path: String) -> Result<Vec<UncEntry>, String> {
    use std::fs;
    use std::path::Path;
    if path.trim().is_empty() {
        return Err("Путь пуст".into());
    }
    #[cfg(not(windows))]
    {
        let _p = path;
        return Err("Список каталога доступен только в Tauri на Windows".into());
    }
    #[cfg(windows)]
    {
        let p = Path::new(strip_verbatim_prefix(path.trim()));
        if !p.exists() {
            return Err(format!("Путь не найден или нет доступа: {}", p.display()));
        }
        if !p.is_dir() {
            return Err("Указанный путь не является папкой".into());
        }
        let read = fs::read_dir(p).map_err(|e| format!("read_dir: {e}"))?;
        let mut v = Vec::new();
        for e in read {
            let e = e.map_err(|e| format!("{e}"))?;
            let t = e.file_type().map_err(|e| format!("{e}"))?;
            let is_dir = t.is_dir();
            let name = e.file_name().to_string_lossy().into_owned();
            v.push(UncEntry { name, is_dir });
        }
        v.sort_by(|a, b| a.name.cmp(&b.name));
        Ok(v)
    }
}

#[tauri::command]
pub fn get_folder_acl(path: String) -> Result<Vec<AclLine>, String> {
    if path.trim().is_empty() {
        return Err("Путь пуст".into());
    }
    #[cfg(not(windows))]
    {
        let _p = path;
        return Err("Чтение ACL доступно только в Tauri на Windows".into());
    }
    #[cfg(windows)]
    {
        get_folder_acl_icacls(path.trim().to_string())
    }
}

#[cfg(windows)]
use windows::Win32::Security::PSID;

#[cfg(windows)]
fn strip_path_prefix_ignoring_case<'a>(line: &'a str, path: &str) -> &'a str {
    let line = line.trim_start();
    let p = path.trim();
    if p.len() > line.len() {
        return line;
    }
    if line
        .get(..p.len())
        .is_some_and(|head| head.eq_ignore_ascii_case(p))
    {
        return line.get(p.len()..).unwrap_or("").trim_start();
    }
    line
}

#[cfg(windows)]
fn unc_server_name_null_wide(unc: &str) -> Option<Vec<u16>> {
    let t = unc.trim();
    if !t.starts_with(r"\\") {
        return None;
    }
    let r = t.strip_prefix(r"\\")?;
    let host = r.split(['\\', '/']).next()?.trim();
    if host.is_empty() {
        return None;
    }
    Some(
        host
            .encode_utf16()
            .chain(std::iter::once(0u16))
            .collect(),
    )
}

#[cfg(windows)]
fn unc_system_name_double_backslash_wide(unc: &str) -> Option<Vec<u16>> {
    let t = unc.trim();
    if !t.starts_with(r"\\") {
        return None;
    }
    let r = t.strip_prefix(r"\\")?;
    let host = r.split(['\\', '/']).next()?.trim();
    if host.is_empty() {
        return None;
    }
    let mut s = String::new();
    s.push_str("\\\\");
    s.push_str(host);
    Some(s.encode_utf16().chain(std::iter::once(0u16)).collect())
}

#[cfg(windows)]
struct LocalSid(PSID);

#[cfg(windows)]
impl Drop for LocalSid {
    fn drop(&mut self) {
        if !self.0.0.is_null() {
            use windows::Win32::Foundation::HLOCAL;
            use windows::Win32::Foundation::LocalFree;
            let _ = unsafe { LocalFree(Some(HLOCAL(self.0.0))) };
        }
    }
}

#[cfg(windows)]
fn resolve_identity_display(unc_path: &str, identity: &str) -> String {
    let t = identity.trim();
    if !t.starts_with("S-1-") {
        return identity.to_string();
    }
    match sid_string_to_display_name(unc_path, t) {
        Some(s) if !s.is_empty() => s,
        _ => identity.to_string(),
    }
}

#[cfg(windows)]
fn sid_string_to_display_name(unc_path: &str, sid: &str) -> Option<String> {
    use std::iter::once;
    use windows::core::PCWSTR;
    use windows::core::PWSTR;
    use windows::Win32::Security::Authorization::ConvertStringSidToSidW;
    use windows::Win32::Security::LookupAccountSidW;
    use windows::Win32::Security::SID_NAME_USE;

    const BUF: u32 = 1024;
    let wide: Vec<u16> = sid.encode_utf16().chain(once(0)).collect();
    let mut psid = PSID::default();
    unsafe { ConvertStringSidToSidW(PCWSTR::from_raw(wide.as_ptr()), &mut psid).ok()? };
    if psid.0.is_null() {
        return None;
    }
    let sid = LocalSid(psid);
    let try_one = |system: PCWSTR, sid: PSID| -> Option<String> {
        let mut name = vec![0u16; BUF as usize];
        let mut dom = vec![0u16; BUF as usize];
        let mut nlen = BUF;
        let mut dlen = BUF;
        let mut use_ = SID_NAME_USE::default();
        unsafe {
            LookupAccountSidW(
                system,
                sid,
                Some(PWSTR::from_raw(name.as_mut_ptr())),
                &mut nlen,
                Some(PWSTR::from_raw(dom.as_mut_ptr())),
                &mut dlen,
                &mut use_,
            )
            .ok()?
        };
        let name_s = u16s_to_str_trim(&name, nlen);
        if name_s.is_empty() {
            return None;
        }
        let dom_s = u16s_to_str_trim(&dom, dlen);
        if dom_s.is_empty() {
            Some(name_s)
        } else {
            Some(format!("{dom_s}\\{name_s}"))
        }
    };
    if let Some(ref sw) = unc_server_name_null_wide(unc_path) {
        let host = PCWSTR::from_raw(sw.as_ptr());
        return try_one(host, sid.0).or_else(|| try_one(PCWSTR::null(), sid.0));
    }
    try_one(PCWSTR::null(), sid.0)
}

#[cfg(windows)]
fn u16s_to_str_trim(buf: &[u16], char_count: u32) -> String {
    let n = (char_count as usize).min(buf.len());
    String::from_utf16_lossy(&buf[..n])
        .trim_end_matches('\0')
        .trim()
        .to_string()
}

#[cfg(windows)]
fn is_string_sid(s: &str) -> bool {
    let t = s.trim();
    t.starts_with("S-1-")
        && t.len() >= 8
        && t.chars().all(|c| c.is_ascii_alphanumeric() || c == '-')
}

#[cfg(windows)]
fn icacls_output_suggests_failure(combined: &str) -> bool {
    let t = combined.to_lowercase();
    if t.contains("no mapping between account names and security")
        || t.contains("невозможно сопоставить")
    {
        return true;
    }
    for line in t.lines() {
        let l = line.trim();
        if !l.contains("failed processing") {
            continue;
        }
        if let Some(low) = l.rfind("failed processing") {
            let after = l[low + "failed processing".len()..]
                .trim_start_matches(|c: char| c == ':')
                .trim_start();
            let num: String = after.chars().take_while(|c| c.is_ascii_digit()).collect();
            if let Ok(n) = num.parse::<u32>() {
                if n > 0 {
                    return true;
                }
            }
        }
    }
    false
}

#[cfg(windows)]
fn lookup_account_name_to_sid_w(system: windows::core::PCWSTR, acc_w: &[u16]) -> Option<String> {
    use windows::core::PCWSTR;
    use windows::core::PWSTR;
    use windows::Win32::Foundation::LocalFree;
    use windows::Win32::Foundation::HLOCAL;
    use windows::Win32::Security::Authorization::ConvertSidToStringSidW;
    use windows::Win32::Security::LookupAccountNameW;
    use windows::Win32::Security::SID_NAME_USE;

    let acc_pcw = PCWSTR::from_raw(acc_w.as_ptr());
    let mut sid_buf: Vec<u8> = vec![0u8; 8192];
    let mut cb_sid: u32 = sid_buf.len() as u32;
    let mut dom: Vec<u16> = vec![0u16; 1024];
    let mut cch_dom: u32 = dom.len() as u32;
    let mut use_ = SID_NAME_USE::default();
    let res = unsafe {
        LookupAccountNameW(
            system,
            acc_pcw,
            Some(PSID(sid_buf.as_mut_ptr() as *mut _)),
            &mut cb_sid,
            Some(PWSTR::from_raw(dom.as_mut_ptr())),
            &mut cch_dom,
            &mut use_,
        )
    };
    if res.is_err() {
        return None;
    }
    let psid = PSID(sid_buf.as_ptr() as *mut _);
    let mut str_sid: PWSTR = PWSTR::null();
    unsafe { ConvertSidToStringSidW(psid, &mut str_sid).ok()? };
    let s = pwstr_to_string_lossy(str_sid.0);
    if !str_sid.0.is_null() {
        let _ = unsafe { LocalFree(Some(HLOCAL(str_sid.0 as *mut _))) };
    }
    let out = s.trim();
    if out.starts_with("S-1-") {
        Some(out.to_string())
    } else {
        None
    }
}

#[cfg(windows)]
fn try_lookup_name_to_string_sid(unc: &str, name: &str) -> Option<String> {
    use std::iter::once;
    use windows::core::PCWSTR;

    let t = name.trim();
    if t.is_empty() {
        return None;
    }
    if is_string_sid(t) {
        return Some(t.to_string());
    }
    let t0 = t.trim_start_matches('*');
    if is_string_sid(t0) {
        return Some(t0.to_string());
    }
    let acc_w: Vec<u16> = t.encode_utf16().chain(once(0)).collect();
    if let Some(s) = lookup_account_name_to_sid_w(PCWSTR::null(), &acc_w) {
        return Some(s);
    }
    if let Some(w) = unc_system_name_double_backslash_wide(unc) {
        if let Some(s) = lookup_account_name_to_sid_w(PCWSTR::from_raw(w.as_ptr()), &acc_w) {
            return Some(s);
        }
    }
    if let Some(w) = unc_server_name_null_wide(unc) {
        lookup_account_name_to_sid_w(PCWSTR::from_raw(w.as_ptr()), &acc_w)
    } else {
        None
    }
}

#[cfg(windows)]
fn account_string_for_icacls_cmd(unc: &str, user_input: &str) -> String {
    if let Some(s) = try_lookup_name_to_string_sid(unc, user_input) {
        return s;
    }
    user_input.trim().to_string()
}

#[cfg(windows)]
fn enrich_icacls_error_text(text: &str) -> String {
    let t = text.trim();
    if t.is_empty() {
        return t.to_string();
    }
    if t.to_lowercase().contains("no mapping")
        || t.contains("1332")
        || t.to_lowercase().contains("сопостав")
    {
        return format!(
            "{t}\n\n\
Подсказка: введите учётную запись как DOMAIN\\пользователь или UPN (user@domain), либо SID вида S-1-5-… \
(как в списке ACL / icacls). На ПК вне Active Directory без доступа к DC имя не сопоставляется с SID \
— в этом случае используйте SID из той же выдачи, что в проводнике, или введите его вручную."
        );
    }
    t.to_string()
}

#[cfg(windows)]
fn map_icacls_outcome(
    out: &std::process::Output,
    combined: &str,
    empty_err: &str,
) -> Result<(), String> {
    if out.status.success() && !icacls_output_suggests_failure(combined) {
        return Ok(());
    }
    let t = combined.trim();
    if t.is_empty() {
        return Err(empty_err.to_string());
    }
    Err(enrich_icacls_error_text(t))
}

#[cfg(windows)]
fn parse_icacls_ace(segment: &str) -> Option<AclLine> {
    const ACE_AFTER_COLON: &str = ":(";
    let s = segment.trim();
    if s.is_empty() {
        return None;
    }
    let pos = s.rfind(ACE_AFTER_COLON)?;
    if pos == 0 {
        return None;
    }
    let identity = s[..pos].trim();
    if identity.is_empty() {
        return None;
    }
    let rights = s[pos + 1..].trim().to_string();
    if !rights.starts_with('(') {
        return None;
    }
    let inherited = rights.contains("(I)");
    let access = if rights.contains("(D)") {
        "Deny"
    } else {
        "Allow"
    };
    let id = identity.to_string();
    Some(AclLine {
        identity: id.clone(),
        icacls_identity: id,
        rights,
        access: access.to_string(),
        inherited,
    })
}

#[cfg(windows)]
fn get_folder_acl_icacls(unc_path: String) -> Result<Vec<AclLine>, String> {
    use std::os::windows::process::CommandExt;
    use std::process::Command;
    const CREATE_NO_WINDOW: u32 = 0x08000000;
    let system_root = std::env::var("SystemRoot").map_err(|e| format!("SystemRoot: {e}"))?;
    let icacls = std::path::Path::new(&system_root)
        .join("System32")
        .join("icacls.exe");
    if !icacls.exists() {
        return Err("icacls.exe не найден".into());
    }
    let p = unc_path.as_str();
    let out = Command::new(&icacls)
        .arg(p)
        .creation_flags(CREATE_NO_WINDOW)
        .output()
        .map_err(|e| format!("icacls: {e}"))?;
    let all = [
        String::from_utf8_lossy(&out.stdout).as_ref(),
        String::from_utf8_lossy(&out.stderr).as_ref(),
    ]
    .join("");
    if !out.status.success() {
        let t = all.trim();
        if t.is_empty() {
            return Err("icacls: неуспех без текста".into());
        }
        return Err(t.into());
    }
    if icacls_output_suggests_failure(&all) {
        return Err(enrich_icacls_error_text(all.trim()));
    }
    let text = all.trim();
    if text.is_empty() {
        return Ok(vec![]);
    }
    let mut out_lines: Vec<AclLine> = Vec::new();
    let mut is_first_ace_block = true;
    for line in text.lines() {
        let t = line.trim();
        if t.is_empty() {
            continue;
        }
        if t.to_lowercase().contains("successfully processed")
            || t.contains("успешно обработано")
            || t.to_lowercase().contains("0 files failed")
        {
            continue;
        }
        if is_first_ace_block {
            let rem = strip_path_prefix_ignoring_case(t, p);
            let ace = parse_icacls_ace(rem)
                .or_else(|| parse_icacls_ace(t));
            if let Some(ace) = ace {
                out_lines.push(AclLine {
                    identity: resolve_identity_display(p, &ace.icacls_identity),
                    ..ace
                });
            }
            is_first_ace_block = false;
        } else if let Some(ace) = parse_icacls_ace(t) {
            out_lines.push(AclLine {
                identity: resolve_identity_display(p, &ace.icacls_identity),
                ..ace
            });
        }
    }
    out_lines.sort_by(|a, b| a.identity.cmp(&b.identity));
    Ok(out_lines)
}

#[derive(Deserialize)]
pub struct ConnectShareArgs {
    #[serde(rename = "uncRoot", alias = "unc_root")]
    pub unc_root: String,
    pub username: String,
    pub password: String,
}

#[cfg(windows)]
fn disconnect_smb_for_new_credentials(net_exe: &str, unc_root: &str) {
    use std::os::windows::process::CommandExt;
    use std::process::Command;
    const CREATE_NO_WINDOW: u32 = 0x08000000;
    let _ = Command::new(net_exe)
        .args(["use", unc_root, "/delete", "/y"])
        .creation_flags(CREATE_NO_WINDOW)
        .output();
}

#[tauri::command]
pub fn connect_unc_share(args: ConnectShareArgs) -> Result<(), String> {
    if args.unc_root.trim().is_empty() || args.username.trim().is_empty() {
        return Err("UNC и логин обязательны".into());
    }
    let unc_root = args.unc_root;
    let username = args.username;
    let password = args.password;
    #[cfg(not(windows))]
    {
        let _u = (unc_root, username, password);
        return Err("Подключение сети только на Windows (Tauri)".into());
    }
    #[cfg(windows)]
    {
        use std::os::windows::process::CommandExt;
        use std::process::Command;
        const CREATE_NO_WINDOW: u32 = 0x08000000;
        let root = unc_root.trim().to_string();
        if !root.starts_with(r"\\") {
            return Err("UNC должен начинаться с \\".into());
        }
        let u = format!("/user:{}", username.trim());
        let net_exe = std::env::var("SystemRoot")
            .map(|p| std::path::Path::new(&p).join("System32").join("net.exe"))
            .map(|p| p.to_string_lossy().to_string())
            .unwrap_or_else(|_| "net.exe".to_string());
        disconnect_smb_for_new_credentials(&net_exe, &root);
        let mut c = Command::new(&net_exe);
        c.args(["use", root.as_str(), u.as_str()]);
        if !password.is_empty() {
            c.arg(password.as_str());
        }
        c.creation_flags(CREATE_NO_WINDOW);
        let out = c.output().map_err(|e| format!("net: {e}"))?;
        if out.status.success() {
            return Ok(());
        }
        let all = format!("{}{}", String::from_utf8_lossy(&out.stdout), String::from_utf8_lossy(&out.stderr));
        let t = all.trim();
        if t.is_empty() {
            return Err("net use: ошибка (код выхода)".into());
        }
        let mut err = t.to_string();
        if err.contains("1219") {
            err.push_str(
                "\n\nСовет: к этому серверу уже было подключение под другим пользователем. \
Закройте в Проводнике окна с сетевыми папками на этом IP, \
выполните в cmd «net use» и вручную «net use \\\\сервер\\... /delete /y» для лишних записей, затем подключитесь снова.",
            );
        }
        Err(err)
    }
}

#[derive(Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct GrantFolderAccessArgs {
    pub path: String,
    pub account: String,
    pub permission: String,
}

#[derive(Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct RevokeFolderAccessArgs {
    pub path: String,
    pub account: String,
}

#[cfg(windows)]
fn system_icacls_exe() -> Result<std::path::PathBuf, String> {
    let system_root = std::env::var("SystemRoot").map_err(|e| format!("SystemRoot: {e}"))?;
    let p = std::path::Path::new(&system_root)
        .join("System32")
        .join("icacls.exe");
    if !p.exists() {
        return Err("icacls.exe не найден".into());
    }
    Ok(p)
}

#[cfg(windows)]
fn validate_icacls_permission_token(p: &str) -> Result<String, String> {
    let u = p.trim().to_uppercase();
    match u.as_str() {
        "F" | "M" | "RX" | "R" | "W" => Ok(u),
        _ => Err(
            "Недопустимый тип прав. Используйте: F, M, RX, R или W (см. icacls /save /restore)."
                .into(),
        ),
    }
}

#[tauri::command]
pub fn grant_folder_access(args: GrantFolderAccessArgs) -> Result<(), String> {
    if args.path.trim().is_empty() || args.account.trim().is_empty() {
        return Err("Путь и учётная запись обязательны".into());
    }
    #[cfg(not(windows))]
    {
        let _a = args;
        return Err("Изменение ACL только в Tauri на Windows".into());
    }
    #[cfg(windows)]
    {
        use std::os::windows::process::CommandExt;
        use std::process::Command;
        const CREATE_NO_WINDOW: u32 = 0x08000000;
        let path = args.path.trim().to_string();
        let account_raw = args.account.trim().to_string();
        let acc = account_string_for_icacls_cmd(&path, &account_raw);
        let perm = validate_icacls_permission_token(&args.permission)?;
        let grant_token = format!("{acc}:({perm})");
        let ic = system_icacls_exe()?;
        let out = Command::new(&ic)
            .arg(&path)
            .arg("/grant:r")
            .arg(&grant_token)
            .creation_flags(CREATE_NO_WINDOW)
            .output()
            .map_err(|e| format!("icacls: {e}"))?;
        let all = format!(
            "{}{}",
            String::from_utf8_lossy(&out.stdout),
            String::from_utf8_lossy(&out.stderr)
        );
        map_icacls_outcome(&out, &all, "icacls /grant: операция не выполнена (код выхода).")
    }
}

#[tauri::command]
pub fn revoke_folder_access(args: RevokeFolderAccessArgs) -> Result<(), String> {
    if args.path.trim().is_empty() || args.account.trim().is_empty() {
        return Err("Путь и субъект обязательны".into());
    }
    #[cfg(not(windows))]
    {
        let _a = args;
        return Err("Изменение ACL только в Tauri на Windows".into());
    }
    #[cfg(windows)]
    {
        use std::os::windows::process::CommandExt;
        use std::process::Command;
        const CREATE_NO_WINDOW: u32 = 0x08000000;
        let path = args.path.trim().to_string();
        let account_raw = args.account.trim().to_string();
        let acc = account_string_for_icacls_cmd(&path, &account_raw);
        let ic = system_icacls_exe()?;
        let out = Command::new(&ic)
            .arg(&path)
            .arg("/remove")
            .arg(&acc)
            .creation_flags(CREATE_NO_WINDOW)
            .output()
            .map_err(|e| format!("icacls: {e}"))?;
        let all = format!(
            "{}{}",
            String::from_utf8_lossy(&out.stdout),
            String::from_utf8_lossy(&out.stderr)
        );
        map_icacls_outcome(&out, &all, "icacls /remove: операция не выполнена (код выхода).")
    }
}

#[derive(Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct SetFolderOwnerArgs {
    pub path: String,
    pub account: String,
}

#[cfg(windows)]
fn win32_error_message(code: u32) -> String {
    format!("код {code:#x} ({code})")
}

#[tauri::command]
pub fn get_folder_owner(path: String) -> Result<String, String> {
    if path.trim().is_empty() {
        return Err("Путь пуст".into());
    }
    #[cfg(not(windows))]
    {
        let _ = path;
        return Err("Владелец доступен только в Tauri на Windows".into());
    }
    #[cfg(windows)]
    {
        get_folder_owner_inner(path.trim())
    }
}

#[cfg(windows)]
fn get_folder_owner_inner(path: &str) -> Result<String, String> {
    use std::iter::once;
    use windows::core::PCWSTR;
    use windows::core::PWSTR;
    use windows::Win32::Foundation::HLOCAL;
    use windows::Win32::Foundation::LocalFree;
    use windows::Win32::Security::Authorization::{ConvertSidToStringSidW, GetNamedSecurityInfoW, SE_FILE_OBJECT};
    use windows::Win32::Security::{OWNER_SECURITY_INFORMATION, PSECURITY_DESCRIPTOR};

    let wide: Vec<u16> = path.encode_utf16().chain(once(0)).collect();
    let mut powner = PSID::default();
    let mut psd = PSECURITY_DESCRIPTOR::default();
    let st = unsafe {
        GetNamedSecurityInfoW(
            PCWSTR::from_raw(wide.as_ptr()),
            SE_FILE_OBJECT,
            OWNER_SECURITY_INFORMATION,
            Some(std::ptr::addr_of_mut!(powner)),
            None,
            None,
            None,
            &mut psd,
        )
    };
    if st.0 != 0 {
        return Err(format!("GetNamedSecurityInfoW: {}", win32_error_message(st.0)));
    }
    if powner.0.is_null() {
        return Err("Владелец не определён".into());
    }
    let mut str_sid = PWSTR::null();
    let sid_string = {
        if unsafe { ConvertSidToStringSidW(powner, &mut str_sid).is_err() } {
            if !psd.0.is_null() {
                let _ = unsafe { LocalFree(Some(HLOCAL(psd.0))) };
            }
            return Err("ConvertSidToStringSidW".into());
        }
        pwstr_to_string_lossy(str_sid.0)
    };
    if !str_sid.0.is_null() {
        let _ = unsafe { LocalFree(Some(HLOCAL(str_sid.0 as *mut _))) };
    }
    if !psd.0.is_null() {
        let _ = unsafe { LocalFree(Some(HLOCAL(psd.0))) };
    }
    let t = sid_string.trim();
    if t.starts_with("S-1-") {
        if let Some(name) = sid_string_to_display_name(path, t) {
            return Ok(name);
        }
    }
    Ok(sid_string)
}

#[cfg(windows)]
fn pwstr_to_string_lossy(p: *mut u16) -> String {
    if p.is_null() {
        return String::new();
    }
    let mut v = Vec::new();
    unsafe {
        let mut i = 0usize;
        loop {
            let c = *p.add(i);
            if c == 0 {
                break;
            }
            v.push(c);
            i += 1;
        }
    }
    String::from_utf16_lossy(&v).to_string()
}

#[tauri::command]
pub fn set_folder_owner(args: SetFolderOwnerArgs) -> Result<(), String> {
    if args.path.trim().is_empty() || args.account.trim().is_empty() {
        return Err("Путь и новый владелец обязательны".into());
    }
    #[cfg(not(windows))]
    {
        let _a = args;
        return Err("Смена владельца только в Tauri на Windows".into());
    }
    #[cfg(windows)]
    {
        use std::os::windows::process::CommandExt;
        use std::process::Command;
        const CREATE_NO_WINDOW: u32 = 0x08000000;
        let path = args.path.trim().to_string();
        let account_raw = args.account.trim().to_string();
        let acc = account_string_for_icacls_cmd(&path, &account_raw);
        let ic = system_icacls_exe()?;
        let out = Command::new(&ic)
            .arg(&path)
            .arg("/setowner")
            .arg(&acc)
            .creation_flags(CREATE_NO_WINDOW)
            .output()
            .map_err(|e| format!("icacls: {e}"))?;
        let all = format!(
            "{}{}",
            String::from_utf8_lossy(&out.stdout),
            String::from_utf8_lossy(&out.stderr)
        );
        map_icacls_outcome(
            &out,
            &all,
            "icacls /setowner: операция не выполнена (код выхода).",
        )
    }
}
