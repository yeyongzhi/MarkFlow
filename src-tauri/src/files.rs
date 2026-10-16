use serde::{Deserialize, Serialize};
use sha2::{Digest, Sha256};
use std::{fs, io::Write, path::{Component, Path, PathBuf}};

#[derive(Debug, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct AppError { pub code: String, pub message: String }
pub type Result<T> = std::result::Result<T, AppError>;
pub fn error(code: &str, message: impl Into<String>) -> AppError { AppError { code: code.into(), message: message.into() } }
impl From<std::io::Error> for AppError {
    fn from(e: std::io::Error) -> Self {
        let code = if matches!(e.raw_os_error(),Some(28)|Some(112)){"DISK_FULL"}else{match e.kind() { std::io::ErrorKind::NotFound => "MISSING", std::io::ErrorKind::PermissionDenied => "PERMISSION", _ => "IO" }};
        error(code, if code=="DISK_FULL" {"磁盘空间不足。请释放空间后重试，或另存到其他磁盘。".into()}else if code=="PERMISSION" {format!("文件只读或没有写入权限。可另存副本，或检查文件权限。{e}")}else{format!("文件操作失败：{e}")})
    }
}
pub fn digest(bytes: &[u8]) -> String { format!("{:x}", Sha256::digest(bytes)) }

pub fn validate_name(name: &str) -> Result<()> {
    let stem = name.split('.').next().unwrap_or("").to_uppercase();
    let reserved = matches!(stem.as_str(), "CON" | "PRN" | "AUX" | "NUL") || (stem.len() == 4 && (stem.starts_with("COM") || stem.starts_with("LPT")) && matches!(stem.as_bytes()[3], b'1'..=b'9'));
    if name.is_empty() || name == "." || name == ".." || name.ends_with(['.', ' ']) || name.chars().any(|c| c.is_control() || "<>:\"/\\|?*".contains(c)) || reserved || name.chars().count() > 200 {
        return Err(error("NAME", "名称含有不支持的字符、保留名称，或长度超过 200 字符"));
    }
    Ok(())
}

/// Walk components to reject links before canonicalization, including Windows junctions.
pub fn resolve(root: &Path, relative: &str, must_exist: bool) -> Result<PathBuf> {
    let mut target = root.to_path_buf();
    for component in Path::new(relative).components() {
        match component { Component::Normal(name) => target.push(name), Component::CurDir => {}, _ => return Err(error("SCOPE", "路径超出工作区")) }
        if let Ok(meta) = fs::symlink_metadata(&target) {
            #[cfg(windows)]
            { use std::os::windows::fs::MetadataExt; if meta.file_attributes() & 0x400 != 0 { return Err(error("SCOPE", "暂不支持符号链接或目录联接")); } }
            if meta.file_type().is_symlink() { return Err(error("SCOPE", "暂不支持符号链接")); }
        }
    }
    let checked = if target.exists() { fs::canonicalize(&target)? } else {
        if must_exist { return Err(error("MISSING", "文件已不存在")); }
        let parent = target.parent().ok_or_else(|| error("SCOPE", "无效路径"))?;
        fs::canonicalize(parent)?.join(target.file_name().ok_or_else(|| error("SCOPE", "无效名称"))?)
    };
    if !checked.starts_with(root) { return Err(error("SCOPE", "路径超出工作区")); }
    Ok(checked)
}

#[derive(Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct TextFile { pub text: String, pub hash: String, pub bom: bool, pub crlf: bool, pub encoding: String }
pub fn read_text(path: &Path) -> Result<TextFile> {
    if fs::metadata(path)?.len() > 20 * 1024 * 1024 { return Err(error("LARGE", "文档超过 20MiB，暂不支持编辑")); }
    let bytes = fs::read(path)?;
    let (encoding,bom,raw)=if bytes.starts_with(&[0xff,0xfe])||bytes.starts_with(&[0xfe,0xff]){let little=bytes[0]==0xff;if bytes.len()%2!=0{return Err(error("ENCODING","UTF-16 文件字节不完整"));}let units:Vec<u16>=bytes[2..].chunks_exact(2).map(|b|if little{u16::from_le_bytes([b[0],b[1]])}else{u16::from_be_bytes([b[0],b[1]])}).collect();(if little{"UTF-16LE"}else{"UTF-16BE"},true,String::from_utf16(&units).map_err(|_|error("ENCODING","UTF-16 内容无效"))?)}else{let bom=bytes.starts_with(&[0xef,0xbb,0xbf]);("UTF-8",bom,std::str::from_utf8(if bom{&bytes[3..]}else{&bytes}).map_err(|_|error("ENCODING","无法识别编码。支持 UTF-8 与带 BOM 的 UTF-16；请另存为这些格式后重新打开。"))?.to_string())};
    Ok(TextFile { text: raw.replace("\r\n", "\n"), hash: digest(&bytes), bom, crlf: raw.contains("\r\n"),encoding:encoding.into() })
}
pub fn encode_with(text:&str,bom:bool,crlf:bool,encoding:&str)->Vec<u8>{if encoding=="UTF-8"{return encode(text,bom,crlf)}let text=text.replace("\r\n","\n");let text=if crlf{text.replace('\n',"\r\n")}else{text};let little=encoding=="UTF-16LE";let mut bytes=if little{vec![0xff,0xfe]}else{vec![0xfe,0xff]};for unit in text.encode_utf16(){bytes.extend_from_slice(&if little{unit.to_le_bytes()}else{unit.to_be_bytes()})}bytes}

pub fn encode(text: &str, bom: bool, crlf: bool) -> Vec<u8> {
    let normalized = text.replace("\r\n", "\n");
    let normalized = if crlf { normalized.replace('\n', "\r\n") } else { normalized };
    let mut bytes = if bom { vec![0xef, 0xbb, 0xbf] } else { vec![] };
    bytes.extend_from_slice(normalized.as_bytes()); bytes
}
pub fn atomic_write(path: &Path, bytes: &[u8]) -> Result<()> {
    let parent = path.parent().ok_or_else(|| error("IO", "无效目标目录"))?;
    if let Ok(meta) = fs::metadata(path) { if meta.permissions().readonly() { return Err(error("PERMISSION", "文件为只读，无法保存")); } }
    let mut temp = tempfile::Builder::new().prefix(".markflow-").tempfile_in(parent)?;
    temp.write_all(bytes)?;
    if let Ok(meta) = fs::metadata(path) { temp.as_file().set_permissions(meta.permissions())?; }
    temp.as_file().sync_all()?;
    temp.persist(path).map_err(|e| error("IO", format!("无法替换原文件：{}", e.error)))?;
    #[cfg(unix)]
    fs::File::open(parent)?.sync_all()?;
    Ok(())
}
pub fn checked_save(path: &Path, text: &str, expected: &str, bom: bool, crlf: bool) -> Result<String> {
    let current = fs::read(path)?;
    if digest(&current) != expected { return Err(error("CONFLICT", "磁盘文件已被其他程序修改，自动保存已暂停")); }
    let source=read_text(path)?;let bytes = encode_with(text, bom, crlf,&source.encoding);
    atomic_write(path, &bytes)?;
    Ok(digest(&bytes))
}

#[cfg(test)]
mod tests {
    use super::*;
    #[test] fn rejects_escaping_and_reserved_names() {
        let dir = tempfile::tempdir().unwrap(); let root = fs::canonicalize(dir.path()).unwrap();
        assert!(resolve(&root, "../secret.md", false).is_err());
        for name in ["CON.md", "a/b", "note.", "LPT1"] { assert!(validate_name(name).is_err()); }
        assert!(validate_name("中文笔记.md").is_ok());
    }
    #[test] fn external_edit_is_never_silently_overwritten() {
        let dir = tempfile::tempdir().unwrap(); let path = dir.path().join("a.md"); fs::write(&path, "original").unwrap();
        let original = digest(b"original"); fs::write(&path, "external").unwrap();
        assert_eq!(checked_save(&path, "local", &original, false, false).unwrap_err().code, "CONFLICT");
        assert_eq!(fs::read_to_string(path).unwrap(), "external");
    }
    #[test] fn preserves_bom_and_windows_newlines() {
        let dir = tempfile::tempdir().unwrap(); let path = dir.path().join("a.md"); let raw = b"\xef\xbb\xbf# Title\r\ntext\r\n";
        fs::write(&path, raw).unwrap(); let file = read_text(&path).unwrap();
        assert_eq!(encode(&file.text, file.bom, file.crlf), raw);
        checked_save(&path, "# New\ntext\n", &file.hash, file.bom, file.crlf).unwrap();
        assert_eq!(fs::read(path).unwrap(), b"\xef\xbb\xbf# New\r\ntext\r\n");
    }
    #[test] fn missing_file_is_not_recreated_by_save() {
        let dir = tempfile::tempdir().unwrap(); let path = dir.path().join("deleted.md");
        assert_eq!(checked_save(&path, "draft", "old", false, false).unwrap_err().code, "MISSING"); assert!(!path.exists());
    }
    #[test] fn atomic_save_replaces_complete_contents() {
        let dir = tempfile::tempdir().unwrap(); let path = dir.path().join("a.md"); fs::write(&path, "old").unwrap();
        atomic_write(&path, b"new complete content").unwrap(); assert_eq!(fs::read(&path).unwrap(), b"new complete content");
        assert_eq!(fs::read_dir(dir.path()).unwrap().count(), 1);
    }
}
