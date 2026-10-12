mod links;
mod knowledge;
use knowledge::knowledge_index;
mod privacy;
use privacy::{privacy_status,privacy_lock,privacy_unlock,privacy_password};
mod safety;
use safety::{save_window_geometry,valid_file_references,check_release,check_signed_update,convert_document_format,list_operation_backups,restore_operation_backup,read_version,list_versions,snapshot_document,read_disk_document,choose_backup_directory,backup_workspace,list_workspace_backups,open_backup_directory,reconnect_workspace,open_local_paths};
mod files;
mod archive;
mod tags;
use tags::{tag_candidates,apply_tag_changes};
use archive::{archive_document,list_archives,restore_archive,delete_archive};
use files::{error, Result};
use base64::{engine::general_purpose::STANDARD, Engine};
use notify::{RecommendedWatcher, RecursiveMode, Watcher};
use serde::{Deserialize, Serialize};
use serde_json::{json, Value};
use std::{collections::HashMap, fs, io::Write, path::{Path, PathBuf}, sync::Mutex, time::{SystemTime, UNIX_EPOCH}};
use tauri::{Emitter, Manager, State};
use tauri_plugin_dialog::DialogExt;

#[derive(Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
struct Workspace { id: String, name: String, path: String, #[serde(default)] available: bool }
#[derive(Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
struct Document { id: String, workspace_id: String, path: String, text: String, hash: String, bom: bool, crlf: bool }
#[derive(Serialize)]
#[serde(rename_all = "camelCase")]
struct Entry { name: String, path: String, is_dir: bool }
#[derive(Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
struct Draft { id: String, workspace_id: String, path: String, text: String, hash: String, updated_at: u64 }
struct Core { data: PathBuf, workspaces: Vec<Workspace>, documents: HashMap<String, Document>, preferences: Value }
struct AppState { privacy:privacy::Privacy, core: Mutex<Core>, watchers: Mutex<HashMap<String, RecommendedWatcher>> }

fn now() -> u64 { SystemTime::now().duration_since(UNIX_EPOCH).unwrap_or_default().as_secs() }
fn read_json(path: &Path) -> Option<Value> { fs::read(path).ok().and_then(|b| serde_json::from_slice(&b).ok()) }
fn write_json(path: &Path, value: &impl Serialize) -> Result<()> { files::atomic_write(path, &serde_json::to_vec_pretty(value).map_err(|_| error("CONFIG", "配置序列化失败"))?) }
fn root(core: &Core, id: &str) -> Result<PathBuf> {
    let ws = core.workspaces.iter().find(|w| w.id == id).ok_or_else(|| error("SCOPE", "工作区未注册"))?;
    let canonical = fs::canonicalize(&ws.path)?;
    if !canonical.is_dir() { return Err(error("MISSING", "工作区不是目录")); } Ok(canonical)
}
fn relative(root: &Path, path: &Path) -> String { path.strip_prefix(root).unwrap_or(path).to_string_lossy().replace('\\', "/") }
fn doc_path(core: &Core, doc: &Document) -> Result<PathBuf> { files::resolve(&root(core, &doc.workspace_id)?, &doc.path, true) }
fn draft_id(workspace: &str, path: &str) -> String { files::digest(format!("{workspace}\0{path}").as_bytes()) }
fn draft_path(core: &Core, workspace: &str, path: &str) -> PathBuf { core.data.join("recovery").join(format!("{}.json", draft_id(workspace, path))) }
fn remove_draft(core: &Core, workspace: &str, path: &str) { let _ = fs::remove_file(draft_path(core, workspace, path)); }
fn persist_workspaces(core: &Core) -> Result<()> { write_json(&core.data.join("workspaces.json"), &core.workspaces.iter().filter(|w|!w.id.starts_with("file-")).collect::<Vec<_>>()) }
fn sidecar_data_dir() -> Option<PathBuf> {
    // Installed Windows builds keep every non-document file beside Lexly.exe, so an install
    // folder such as D:\Program\Lexly holds settings, history versions and backups together.
    if !cfg!(all(target_os = "windows", not(debug_assertions))) { return None; }
    let exe = std::env::current_exe().ok()?;
    let dir = exe.parent()?.join("data");
    if writable_data_dir(&dir) { Some(dir) } else { None }
}
fn writable_data_dir(dir: &Path) -> bool {
    // An existing directory may be read-only even when create_dir_all succeeds.
    fs::create_dir_all(dir).is_ok()
        && tempfile::Builder::new().prefix(".lexly-write-probe-").tempfile_in(dir).is_ok()
}
fn env_dir(name: &str) -> Option<PathBuf> { std::env::var_os(name).filter(|value| !value.is_empty()).map(PathBuf::from) }
fn preferred_data_dir() -> Option<PathBuf> {
    env_dir("LEXLY_DATA_DIR")
        .or_else(|| if cfg!(debug_assertions) { env_dir("LEXLY_DEV_DATA_DIR") } else { None })
        .or_else(sidecar_data_dir)
}
const MIGRATABLE: [&str; 9] = ["workspaces.json", "preferences.json", "window.json", "privacy.json", "recovery", "history", "backups", "operations", "workspace-backups"];
fn copy_tree(from: &Path, to: &Path) -> Result<usize> {
    if from.is_dir() {
        fs::create_dir_all(to)?; let mut count = 0;
        for entry in fs::read_dir(from)? { let path = entry?.path(); count += copy_tree(&path, &to.join(path.file_name().ok_or_else(|| error("CONFIG", "无法读取文件名"))?))?; }
        Ok(count)
    } else { files::atomic_write(to, &fs::read(from)?)?; Ok(1) }
}
fn migrate_legacy_data(data: &Path, legacy: &Path) -> Result<()> {
    if data == legacy || data.join("migration.json").exists() { return Ok(()); }
    if !MIGRATABLE.iter().any(|name| legacy.join(name).exists()) { return Ok(()); }
    if data.join("workspaces.json").exists() || data.join("preferences.json").exists() { return Ok(()); }
    let mut entries: Vec<&str> = vec![]; let mut copied = 0;
    for name in MIGRATABLE {
        if !legacy.join(name).exists() { continue; }
        copied += copy_tree(&legacy.join(name), &data.join(name))?;
        entries.push(name);
    }
    write_json(&data.join("migration.json"), &json!({ "from": legacy, "at": now(), "entries": entries, "files": copied }))
}
fn start_watch(app: &tauri::AppHandle, ws: &Workspace) {
    let app_handle = app.clone(); let id = ws.id.clone();
    let Ok(mut watcher) = notify::recommended_watcher(move |event: std::result::Result<notify::Event, notify::Error>| {
        if let Ok(event) = event {
            // Temporary saves are not tree entries; final replacement events remain visible.
            if event.paths.iter().all(|p| p.file_name().is_some_and(|n| n.to_string_lossy().starts_with(".lexly-"))) { return; }
            let _ = app_handle.emit("workspace-changed", json!({ "workspaceId": id }));
        }
    }) else { return; };
    if watcher.watch(Path::new(&ws.path), RecursiveMode::Recursive).is_ok() { app.state::<AppState>().watchers.lock().unwrap().insert(ws.id.clone(), watcher); }
}

#[tauri::command]
async fn bootstrap(state: State<'_, AppState>) -> Result<Value> {
    let mut core = state.core.lock().unwrap();
    for ws in &mut core.workspaces { ws.available = Path::new(&ws.path).is_dir(); }
    let drafts: Vec<Draft> = fs::read_dir(core.data.join("recovery"))?.filter_map(|e| e.ok()).filter_map(|e| fs::read(e.path()).ok()).filter_map(|b| serde_json::from_slice(&b).ok()).collect();
    let pending = fs::read_dir(core.data.join("operations"))?.filter_map(|e| e.ok()).count();
    Ok(json!({ "workspaces": core.workspaces, "preferences": core.preferences, "drafts": drafts, "pendingOperations": pending }))
}
#[tauri::command]
async fn data_directory(state: State<'_, AppState>) -> Result<String> { Ok(state.core.lock().unwrap().data.to_string_lossy().into_owned()) }
#[tauri::command]
async fn open_data_directory(state: State<'_, AppState>) -> Result<()> {
    let path = state.core.lock().unwrap().data.clone();
    tauri_plugin_opener::open_path(&path, None::<&str>).map_err(|e| error("OPEN", format!("无法打开数据目录：{e}")))
}
#[tauri::command]
async fn select_workspace(app: tauri::AppHandle, state: State<'_, AppState>) -> Result<Option<Workspace>> {
    let Some(folder) = app.dialog().file().set_title("选择笔记工作区").blocking_pick_folder() else { return Ok(None); };
    let path = fs::canonicalize(folder.into_path().map_err(|_| error("PATH", "不支持此目录"))?)?;
    let mut core = state.core.lock().unwrap();
    for ws in &core.workspaces {
        if let Ok(existing) = fs::canonicalize(&ws.path) {
            if existing == path { return Ok(Some(ws.clone())); }
            if path.starts_with(&existing) || existing.starts_with(&path) { return Err(error("OVERLAP", "此目录与已有工作区包含关系，请选择独立工作区")); }
        }
    }
    let ws = Workspace { id: uuid::Uuid::new_v4().to_string(), name: path.file_name().unwrap_or(path.as_os_str()).to_string_lossy().into(), path: path.to_string_lossy().into(), available: true };
    core.workspaces.push(ws.clone());
    if let Err(e) = persist_workspaces(&core) { core.workspaces.pop(); return Err(e); }
    drop(core); start_watch(&app, &ws); Ok(Some(ws))
}
#[tauri::command]
async fn remove_workspace(state: State<'_, AppState>, workspace_id: String) -> Result<()> {
    let mut core = state.core.lock().unwrap(); let previous = core.workspaces.clone();
    core.workspaces.retain(|w| w.id != workspace_id);
    if let Err(e) = persist_workspaces(&core) { core.workspaces = previous; return Err(e); }
    core.documents.retain(|_, d| d.workspace_id != workspace_id);
    state.watchers.lock().unwrap().remove(&workspace_id); Ok(())
}
#[tauri::command]
async fn list_directory(state: State<'_, AppState>, workspace_id: String, path: String) -> Result<Vec<Entry>> {
    let (root, target) = { let core = state.core.lock().unwrap(); let root = root(&core, &workspace_id)?; let target = files::resolve(&root, &path, true)?; (root,target) };
    tauri::async_runtime::spawn_blocking(move || {
    let mut entries = vec![];
    for entry in fs::read_dir(target)? {
        let entry = entry?; let name = entry.file_name().to_string_lossy().to_string();
        if name.starts_with(".lexly-") || name == ".git" || name == ".DS_Store" { continue; }
        if files::resolve(&root, &relative(&root, &entry.path()), true).is_err() { continue; }
        let is_dir = entry.file_type()?.is_dir();
        if is_dir || entry.path().extension().is_some_and(|e| e.to_string_lossy().eq_ignore_ascii_case("md")) { entries.push(Entry { name, path: relative(&root, &entry.path()), is_dir }); }
    }
    entries.sort_by(|a, b| b.is_dir.cmp(&a.is_dir).then(a.name.to_lowercase().cmp(&b.name.to_lowercase()))); Ok(entries)
    }).await.map_err(|e| error("IO",e.to_string()))?
}
#[tauri::command]
async fn open_in_system_directory(state: State<'_, AppState>, workspace_id: String, path: String) -> Result<()> {
    let target = { let core = state.core.lock().unwrap(); files::resolve(&root(&core, &workspace_id)?, &path, true)? };
    let result = if target.is_dir() { tauri_plugin_opener::open_path(&target, None::<&str>) } else { tauri_plugin_opener::reveal_item_in_dir(&target) };
    result.map_err(|e| error("OPEN", format!("无法打开系统目录：{e}")))
}
#[tauri::command]
async fn open_document(state: State<'_, AppState>, workspace_id: String, path: String) -> Result<Document> {
    let mut core = state.core.lock().unwrap(); let root = root(&core, &workspace_id)?; let target = files::resolve(&root, &path, true)?;
    if !target.extension().is_some_and(|e| e.to_string_lossy().eq_ignore_ascii_case("md")) { return Err(error("TYPE", "只能编辑 .md 文档")); }
    let path = relative(&root, &target); let text = files::read_text(&target)?;
    let existing_id = core.documents.values().find(|d| d.workspace_id == workspace_id && d.path == path).map(|d| d.id.clone());
    let doc = Document { id: existing_id.unwrap_or_else(|| uuid::Uuid::new_v4().to_string()), workspace_id, path, text: text.text, hash: text.hash, bom: text.bom, crlf: text.crlf };
    core.documents.insert(doc.id.clone(), doc.clone()); Ok(doc)
}
#[tauri::command]
async fn document_metadata(state: State<'_, AppState>, workspace_id: String, path: String) -> Result<Value> {
    let target = {
        let core = state.core.lock().unwrap();
        files::resolve(&root(&core, &workspace_id)?, &path, true)?
    };
    let format=files::read_text(&target)?;let metadata = fs::metadata(target)?;
    let timestamp = |time: std::io::Result<std::time::SystemTime>| time.ok().and_then(|t| t.duration_since(std::time::UNIX_EPOCH).ok()).map(|t| t.as_millis() as u64);
    Ok(json!({ "createdAt": timestamp(metadata.created()), "modifiedAt": timestamp(metadata.modified()),"encoding":format.encoding,"bom":format.bom,"crlf":format.crlf,"readonly":metadata.permissions().readonly() }))
}
#[tauri::command]
async fn check_document(state: State<'_, AppState>, document_id: String) -> Result<String> {
    let core = state.core.lock().unwrap(); let doc = core.documents.get(&document_id).ok_or_else(|| error("MISSING", "文档已关闭"))?;
    Ok(files::digest(&fs::read(doc_path(&core, doc)?)?))
}
#[tauri::command]
async fn close_document(state: State<'_, AppState>, document_id: String) -> Result<()> { state.core.lock().unwrap().documents.remove(&document_id); Ok(()) }
#[tauri::command]
async fn save_document(state: State<'_, AppState>, document_id: String, text: String, expected_hash: String, revision: u64, backup: bool) -> Result<Value> {
    let mut core = state.core.lock().unwrap(); let doc = core.documents.get(&document_id).cloned().ok_or_else(|| error("MISSING", "文档已关闭"))?;
    let path = doc_path(&core, &doc)?;
    if backup {
        let bytes = fs::read(&path)?;
        if files::digest(&bytes) != expected_hash { return Err(error("CONFLICT", "磁盘内容再次发生变化，请重新确认")); }
        files::atomic_write(&core.data.join("backups").join(format!("{}-{}.md", now(), uuid::Uuid::new_v4())), &bytes)?;
    }
    let previous = files::read_text(&path)?; if previous.hash != expected_hash { return Err(error("CONFLICT", "磁盘内容已发生变化")); }
    safety::snapshot(&core, &doc, &previous.text, "保存前")?;
    let hash = files::checked_save(&path, &text, &expected_hash, doc.bom, doc.crlf)?;
    let _ = safety::snapshot(&core, &doc, &text, "自动保存");
    let meta = core.documents.get_mut(&document_id).unwrap(); meta.hash = hash.clone(); meta.text = text;
    // A newer recovery snapshot may exist; only remove a matching saved snapshot.
    let recovery = draft_path(&core, &doc.workspace_id, &doc.path);
    if let Some(draft) = read_json(&recovery) { if draft["text"] == core.documents[&document_id].text { let _ = fs::remove_file(recovery); } }
    Ok(json!({ "hash": hash, "revision": revision }))
}
#[tauri::command]
async fn write_recovery(state: State<'_, AppState>, document_id: String, text: String, hash: String) -> Result<()> {
    let core = state.core.lock().unwrap(); let doc = core.documents.get(&document_id).ok_or_else(|| error("MISSING", "文档已关闭"))?;
    let id = draft_id(&doc.workspace_id, &doc.path);
    write_json(&draft_path(&core, &doc.workspace_id, &doc.path), &Draft { id, workspace_id: doc.workspace_id.clone(), path: doc.path.clone(), text, hash, updated_at: now() })
}
#[tauri::command]
async fn discard_recovery(state: State<'_, AppState>, draft_id: String) -> Result<()> {
    if !draft_id.chars().all(|c| c.is_ascii_hexdigit()) || draft_id.len() != 64 { return Err(error("SCOPE", "无效恢复条目")); }
    let core = state.core.lock().unwrap(); let path = core.data.join("recovery").join(format!("{draft_id}.json")); if path.exists() {let dir=core.data.join("backups").join(format!("draft-{}",uuid::Uuid::new_v4()));fs::create_dir(&dir)?;files::atomic_write(&dir.join("draft.json"),&fs::read(&path)?)?;write_json(&dir.join("manifest.json"),&json!({"id":dir.file_name().unwrap().to_string_lossy(),"kind":"draft","createdAt":now(),"draftId":draft_id}))?;fs::remove_file(path)?; } Ok(())
}
#[tauri::command]
async fn open_recovery(state: State<'_, AppState>, draft_id: String) -> Result<Document> {
    if draft_id.len() != 64 || !draft_id.chars().all(|c| c.is_ascii_hexdigit()) { return Err(error("SCOPE", "无效恢复条目")); }
    let mut core = state.core.lock().unwrap();
    let draft: Draft = serde_json::from_slice(&fs::read(core.data.join("recovery").join(format!("{draft_id}.json")))?).map_err(|_| error("CONFIG", "无法读取草稿"))?;
    let format=root(&core,&draft.workspace_id).and_then(|r|files::resolve(&r,&draft.path,true)).and_then(|p|files::read_text(&p)).ok();
    let doc = Document { id: uuid::Uuid::new_v4().to_string(), workspace_id: draft.workspace_id, path: draft.path, text: draft.text, hash: draft.hash, bom: format.as_ref().is_some_and(|f|f.bom), crlf: format.as_ref().is_some_and(|f|f.crlf) };
    core.documents.insert(doc.id.clone(), doc.clone()); Ok(doc)
}
#[tauri::command]
async fn save_preferences(state: State<'_, AppState>, preferences: Value) -> Result<()> {
    // Preferences include bounded user templates, navigation and display settings.
    if serde_json::to_vec(&preferences).unwrap_or_default().len() > 1024 * 1024 { return Err(error("CONFIG", "设置内容过大")); }
    let mut core = state.core.lock().unwrap(); write_json(&core.data.join("preferences.json"), &preferences)?; core.preferences = preferences; Ok(())
}
#[tauri::command]
async fn create_entry(state: State<'_, AppState>, workspace_id: String, parent: String, name: String, is_dir: bool) -> Result<String> {
    files::validate_name(&name)?; let core = state.core.lock().unwrap(); let root = root(&core, &workspace_id)?;
    let directory = files::resolve(&root, &parent, true)?; let target = directory.join(&name);
    if target.exists() { return Err(error("EXISTS", "已存在同名文件或目录")); }
    if is_dir { fs::create_dir(&target)?; } else { fs::OpenOptions::new().write(true).create_new(true).open(&target)?.sync_all()?; }
    Ok(relative(&root, &target))
}

fn collect_markdown(root: &Path, entry: &Path, files: &mut Vec<PathBuf>) -> Result<()> {
    let entry = files::resolve(root, &relative(root, entry), true)?;
    if entry.is_dir() { for child in fs::read_dir(entry)? { collect_markdown(root, &child?.path(), files)?; } }
    else if entry.extension().is_some_and(|e| e.to_string_lossy().eq_ignore_ascii_case("md")) { files.push(entry); }
    if files.len() > 10_000 { return Err(error("LARGE", "单次移动涉及过多文档")); } Ok(())
}
fn resolve_link(root: &Path, base: &Path, link: &str) -> Result<PathBuf> {
    if link.contains("://") || link.starts_with("data:") || link.starts_with('/') || link.contains('\\') { return Err(error("SCOPE", "仅支持工作区内的相对资源")); }
    let decoded = percent_encoding::percent_decode_str(link.split('#').next().unwrap_or(link)).decode_utf8().map_err(|_| error("PATH", "资源路径编码不正确"))?;
    let mut path = base.to_path_buf();
    for part in Path::new(decoded.as_ref()).components() {
        match part { std::path::Component::Normal(name) => path.push(name), std::path::Component::ParentDir => { if !path.pop() || !path.starts_with(root) { return Err(error("SCOPE", "资源超出工作区")); } }, std::path::Component::CurDir => {}, _ => return Err(error("SCOPE", "资源超出工作区")) }
    }
    files::resolve(root, &relative(root, &path), true)
}
fn rewrite_images(text: &str, root: &Path, old: &Path, new: &Path) -> String {
    use pulldown_cmark::{Event, Options, Parser, Tag, TagEnd};
    let mut edits = vec![]; let mut image: Option<(std::ops::Range<usize>, String, String, String)> = None;
    for (event, range) in Parser::new_ext(text, Options::ENABLE_TABLES | Options::ENABLE_STRIKETHROUGH | Options::ENABLE_TASKLISTS).into_offset_iter() {
        match event {
            Event::Start(Tag::Image { dest_url, title, .. }) => { image = Some((range, dest_url.to_string(), title.to_string(), String::new())); },
            Event::Text(t) | Event::Code(t) => { if let Some((_, _, _, alt)) = &mut image { alt.push_str(&t); } },
            Event::End(TagEnd::Image) => {
                if let Some((range, url, title, alt)) = image.take() {
                    if let Ok(asset) = resolve_link(root, old.parent().unwrap(), &url) {
                        if asset.starts_with(root.join("assets")) {
                            if let Some(diff) = pathdiff::diff_paths(asset, new.parent().unwrap()) {
                                let link = diff.to_string_lossy().replace('\\', "/").replace('%', "%25").replace(' ', "%20").replace('(', "%28").replace(')', "%29").replace('#', "%23");
                                let title = if title.is_empty() { String::new() } else { format!(" \"{}\"", title.replace('"', "\\\"")) };
                                edits.push((range, format!("![{}]({link}{title})", alt.replace('[', "\\[").replace(']', "\\]"))));
                            }
                        }
                    }
                }
            }, _ => {}
        }
    }
    let mut result = text.to_string(); for (range, replacement) in edits.into_iter().rev() { result.replace_range(range, &replacement); } result
}

#[tauri::command]
async fn relocate_entry(state: State<'_, AppState>, workspace_id: String, path: String, destination: String, name: Option<String>) -> Result<Value> {
    let mut core = state.core.lock().unwrap(); let root = root(&core, &workspace_id)?;
    let from = files::resolve(&root, &path, true)?; if from == root { return Err(error("SCOPE", "不能移动工作区根目录")); }
    let target_name = name.unwrap_or_else(|| from.file_name().unwrap().to_string_lossy().into()); files::validate_name(&target_name)?;
    let target = files::resolve(&root, &destination, true)?.join(target_name);
    if target.exists() { return Err(error("EXISTS", "目标位置已存在同名对象")); }
    if target.starts_with(&from) { return Err(error("PATH", "不能移动到自身子目录")); }
    let mut documents = vec![]; collect_markdown(&root, &from, &mut documents)?;
    let mut replacements = vec![];
    let linked_documents=knowledge::paths(&root)?;
    for original in &linked_documents {
        let relocated=if original==&from{target.clone()}else if let Ok(suffix)=original.strip_prefix(&from){target.join(suffix)}else{original.clone()};
        let text = files::read_text(&original)?; let rewritten = rewrite_images(&links::rewrite(&text.text,&root,original,&from,&target,&linked_documents), &root, &original, &relocated);
        if rewritten != text.text { let original_bytes = fs::read(&original)?; replacements.push((original.clone(), relocated, original_bytes, files::encode_with(&rewritten, text.bom, text.crlf, &text.encoding))); }
    }
    let backup=core.data.join("backups").join(format!("links-{}",uuid::Uuid::new_v4()));fs::create_dir_all(&backup)?;for (i,(_,_,bytes,_))in replacements.iter().enumerate(){files::atomic_write(&backup.join(format!("{i}.md")),bytes)?;}write_json(&backup.join("manifest.json"),&json!({"id":backup.file_name().unwrap().to_string_lossy(),"kind":"links","createdAt":now(),"files":replacements.iter().enumerate().map(|(i,(_,path,_,written))|json!({"path":path,"backup":format!("{i}.md"),"writtenHash":files::digest(written)})).collect::<Vec<_>>()}))?;
    let journal = core.data.join("operations").join(format!("{}.json", uuid::Uuid::new_v4()));
    write_json(&journal, &json!({ "from": from, "to": target, "files": replacements.iter().map(|(o,n,bytes,_)| json!({"from":o,"to":n,"original":STANDARD.encode(bytes)})).collect::<Vec<_>>() }))?;
    for original in &documents { let relocated = if from.is_dir() || original != &from {target.join(original.strip_prefix(&from).unwrap())}else{target.clone()}; safety::copy_history(&core,&workspace_id,&relative(&root,original),&relative(&root,&relocated))?; }
    if let Err(e) = fs::rename(&from, &target) { let _ = fs::remove_file(&journal); return Err(e.into()); }
    for (index,(_, relocated, original, bytes)) in replacements.iter().enumerate() {
        let written=fs::read(relocated).map_err(Into::into).and_then(|current|if files::digest(&current)!=files::digest(original){Err(error("CONFLICT","重命名期间文档被外部修改"))}else{files::atomic_write(relocated,bytes)});
        if let Err(e) = written {
            let restored = replacements[..index].iter().all(|(_, n, original, written)| fs::read(n).is_ok_and(|current|files::digest(&current)==files::digest(written))&&files::atomic_write(n, original).is_ok());
            if restored && fs::rename(&target, &from).is_ok() { let _ = fs::remove_file(journal); return Err(e); }
            return Err(error("PARTIAL", "移动未完全完成，恢复材料已保存在应用 operations 目录。请勿继续整理这些文件。"));
        }
    }
    let old_path = relative(&root, &from); let new_path = relative(&root, &target); let mut updated = vec![];
    let ids: Vec<String> = core.documents.values().filter(|d| d.workspace_id == workspace_id).map(|d| d.id.clone()).collect();
    for id in ids {
        let mut doc = core.documents[&id].clone(); remove_draft(&core, &workspace_id, &doc.path);
        if doc.path==old_path||doc.path.starts_with(&format!("{old_path}/")){doc.path = format!("{}{}", new_path, &doc.path[old_path.len()..]);} let file = files::read_text(&files::resolve(&root, &doc.path, true)?)?;
        doc.text = file.text; doc.hash = file.hash; core.documents.insert(id, doc.clone()); updated.push(doc);
    }
    let _ = fs::remove_file(journal); Ok(json!({ "oldPath": old_path, "newPath": new_path, "documents": updated }))
}
#[tauri::command]
async fn trash_entry(state: State<'_, AppState>, workspace_id: String, path: String) -> Result<()> {
    let mut core = state.core.lock().unwrap(); let root = root(&core, &workspace_id)?; let target = files::resolve(&root, &path, true)?;
    if target == root { return Err(error("SCOPE", "不能删除工作区根目录，请使用移除工作区")); }
    safety::protect_deletion(&core,&workspace_id,&path,&target)?;
    trash::delete(&target).map_err(|e| error("TRASH", format!("无法移入系统回收站，原对象保留：{e}")))?;
    let docs: Vec<Document> = core.documents.values().filter(|d| d.workspace_id == workspace_id && (d.path == path || d.path.starts_with(&format!("{path}/")))).cloned().collect();
    for doc in docs { remove_draft(&core, &workspace_id, &doc.path); core.documents.remove(&doc.id); } Ok(())
}
fn image_type(bytes: &[u8]) -> Option<(&'static str, &'static str)> {
    if bytes.starts_with(b"\x89PNG\r\n\x1a\n") { Some(("png", "image/png")) }
    else if bytes.starts_with(&[0xff, 0xd8, 0xff]) { Some(("jpg", "image/jpeg")) }
    else if bytes.starts_with(b"GIF87a") || bytes.starts_with(b"GIF89a") { Some(("gif", "image/gif")) }
    else if bytes.starts_with(b"RIFF") && bytes.get(8..12) == Some(b"WEBP") { Some(("webp", "image/webp")) } else { None }
}
#[tauri::command]
async fn import_image(state: State<'_, AppState>, document_id: String, data: String) -> Result<String> {
    if data.len() > 28 * 1024 * 1024 { return Err(error("LARGE", "单张图片不能超过 20MiB")); }
    let bytes = STANDARD.decode(data).map_err(|_| error("IMAGE", "无效图片数据"))?;
    if bytes.len() > 20 * 1024 * 1024 { return Err(error("LARGE", "单张图片不能超过 20MiB")); }
    let (ext, _) = image_type(&bytes).ok_or_else(|| error("IMAGE", "支持 PNG、JPEG、GIF 和 WebP 图片"))?;
    let core = state.core.lock().unwrap(); let doc = core.documents.get(&document_id).ok_or_else(|| error("MISSING", "文档已关闭"))?;
    let doc_path = doc_path(&core, doc)?; if fs::metadata(&doc_path)?.permissions().readonly() { return Err(error("PERMISSION", "文档为只读")); }
    let root = root(&core, &doc.workspace_id)?; let assets = root.join("assets");
    if !assets.exists() { fs::create_dir(&assets)?; } let assets = files::resolve(&root, "assets", true)?;
    let image = assets.join(format!("img-{}.{}", uuid::Uuid::new_v4(), ext)); let mut file = fs::OpenOptions::new().write(true).create_new(true).open(&image)?; file.write_all(&bytes)?; file.sync_all()?;
    Ok(pathdiff::diff_paths(image, doc_path.parent().unwrap()).ok_or_else(|| error("PATH", "无法生成图片链接"))?.to_string_lossy().replace('\\', "/"))
}
#[tauri::command]
async fn open_image_directory(state: State<'_, AppState>, document_id: String, url: String) -> Result<()> {
    let target = {
        let core = state.core.lock().unwrap();
        let doc = core.documents.get(&document_id).ok_or_else(|| error("MISSING", "文档已关闭"))?;
        let root = root(&core, &doc.workspace_id)?;
        resolve_link(&root, doc_path(&core, doc)?.parent().unwrap(), &url)?
    };
    tauri_plugin_opener::reveal_item_in_dir(&target).map_err(|e| error("OPEN", format!("无法打开图片目录：{e}")))
}
#[tauri::command]
async fn resolve_image(state: State<'_, AppState>, document_id: String, url: String) -> Result<String> {
    let core = state.core.lock().unwrap(); let doc = core.documents.get(&document_id).ok_or_else(|| error("MISSING", "文档已关闭"))?;
    let root = root(&core, &doc.workspace_id)?; let target = resolve_link(&root, doc_path(&core, doc)?.parent().unwrap(), &url)?;
    if fs::metadata(&target)?.len() > 20 * 1024 * 1024 { return Err(error("LARGE", "图片过大")); }
    let bytes = fs::read(target)?; let (_, mime) = image_type(&bytes).ok_or_else(|| error("IMAGE", "不支持此资源类型"))?;
    Ok(format!("data:{mime};base64,{}", STANDARD.encode(bytes)))
}
#[tauri::command]
async fn resolve_markdown_link(state: State<'_, AppState>, document_id: String, url: String) -> Result<String> {
    let core = state.core.lock().unwrap(); let doc = core.documents.get(&document_id).ok_or_else(|| error("MISSING", "文档已关闭"))?;
    let root = root(&core, &doc.workspace_id)?; let target = resolve_link(&root, doc_path(&core, doc)?.parent().unwrap(), &url)?;
    if !target.extension().is_some_and(|e| e.to_string_lossy().eq_ignore_ascii_case("md")) { return Err(error("TYPE", "仅支持打开 Markdown 文档链接")); }
    Ok(relative(&root, &target))
}
#[tauri::command]
async fn save_document_as(app: tauri::AppHandle, state: State<'_, AppState>, document_id: String, text: String) -> Result<bool> {
    let doc = state.core.lock().unwrap().documents.get(&document_id).cloned().ok_or_else(|| error("MISSING", "文档已关闭"))?;
    let Some(target) = app.dialog().file().set_title("另存 Markdown 副本").set_file_name(Path::new(&doc.path).file_name().unwrap().to_string_lossy()).add_filter("Markdown", &["md"]).blocking_save_file() else { return Ok(false); };
    let target = target.into_path().map_err(|_| error("PATH", "不支持此位置"))?;
    files::atomic_write(&target, &files::encode(&text, doc.bom, doc.crlf))?; Ok(true)
}

#[tauri::command]
async fn list_system_fonts() -> Result<Vec<String>> {
    tauri::async_runtime::spawn_blocking(|| {
        #[cfg(target_os = "windows")]
        {
            use std::os::windows::process::CommandExt;
            let output = std::process::Command::new("powershell.exe")
                .args(["-NoProfile", "-NonInteractive", "-Command", "[Console]::OutputEncoding=[System.Text.UTF8Encoding]::new(); Add-Type -AssemblyName System.Drawing; $fonts=[System.Drawing.Text.InstalledFontCollection]::new(); try { ConvertTo-Json -Compress -InputObject @($fonts.Families | ForEach-Object { $_.Name } | Sort-Object -Unique) } finally { $fonts.Dispose() }"])
                .creation_flags(0x08000000).output()?;
            if !output.status.success() { return Err(error("FONTS", "无法读取系统字体")); }
            serde_json::from_slice::<Vec<String>>(&output.stdout).map_err(|_| error("FONTS", "无法解析系统字体列表"))
        }
        #[cfg(not(target_os = "windows"))]
        { Ok(Vec::<String>::new()) }
    }).await.map_err(|_| error("FONTS", "读取系统字体失败"))?
}

#[tauri::command]
async fn save_temporary_document(app: tauri::AppHandle, name: String, text: String) -> Result<Option<String>> {
    let Some(target) = app.dialog().file().set_title("保存 Markdown 文档").set_file_name(name).add_filter("Markdown", &["md"]).blocking_save_file() else { return Ok(None); };
    let mut target = target.into_path().map_err(|_| error("PATH", "不支持此位置"))?;
    if target.extension().is_none() { target.set_extension("md"); }
    files::atomic_write(&target, text.as_bytes())?;
    Ok(Some(target.to_string_lossy().into_owned()))
}

#[derive(Serialize)]
#[serde(rename_all = "camelCase")]
struct SearchHit { workspace_id: String, path: String, line: usize, snippet: String }
#[derive(Serialize)]
struct SearchResults { hits: Vec<SearchHit>, truncated: bool, skipped: usize }
fn search_roots(roots: Vec<(String, PathBuf)>, query: String, content: bool, sensitive: bool) -> SearchResults {
    let started = std::time::Instant::now(); let mut result = SearchResults { hits: vec![], truncated: false, skipped: 0 }; let mut visited = 0;
    let needle = if sensitive { query.clone() } else { query.to_lowercase() };
    for (id, root) in roots {
        let mut pending = vec![root.clone()];
        while let Some(dir) = pending.pop() {
            let Ok(entries) = fs::read_dir(dir) else { result.skipped += 1; continue; };
            for entry in entries.flatten() {
                visited += 1;
                if visited > 20000 || started.elapsed().as_secs() >= 3 || result.hits.len() >= 300 { result.truncated = true; return result; }
                let name = entry.file_name().to_string_lossy().to_string();
                if name.starts_with(".lexly-") || [".git", ".DS_Store", "node_modules", "target"].contains(&name.as_str()) { continue; }
                let rel = relative(&root, &entry.path());
                let Ok(path) = files::resolve(&root, &rel, true) else { result.skipped += 1; continue; };
                if path.is_dir() { pending.push(path); continue; }
                if !path.extension().is_some_and(|e| e.eq_ignore_ascii_case("md")) { continue; }
                if !content {
                    if {let value=if sensitive { rel.clone() } else { rel.to_lowercase() };let mut chars=needle.chars();let mut next=chars.next();for c in value.chars(){if next==Some(c){next=chars.next();}}next.is_none()} { result.hits.push(SearchHit { workspace_id: id.clone(), path: rel, line: 1, snippet: String::new() }); }
                    continue;
                }
                if fs::metadata(&path).map(|m| m.len() > 2 * 1024 * 1024).unwrap_or(true) { result.skipped += 1; continue; }
                let Ok(file) = files::read_text(&path) else { result.skipped += 1; continue; };
                for (index, line) in file.text.lines().enumerate() {
                    let normalized = if sensitive { line.to_string() } else { line.to_lowercase() };
                    if let Some(offset) = normalized.find(&needle) {
                        let prefix = normalized[..offset].chars().count().saturating_sub(50);
                        result.hits.push(SearchHit { workspace_id: id.clone(), path: rel.clone(), line: index + 1, snippet: line.chars().skip(prefix).take(160).collect() });
                        if result.hits.len() >= 300 { result.truncated = true; return result; }
                    }
                }
            }
        }
    }
    result.hits.sort_by(|a, b| a.path.cmp(&b.path).then(a.line.cmp(&b.line))); result
}
#[tauri::command]
async fn search_workspace(state: State<'_, AppState>, query: String, content: bool, sensitive: bool) -> Result<SearchResults> {
    if query.len() > 500 { return Err(error("SEARCH", "搜索内容不能超过 500 字节")); }
    let roots = { let core = state.core.lock().unwrap(); core.workspaces.iter().filter(|w|!w.id.starts_with("file-")).filter_map(|w| root(&core, &w.id).ok().map(|r| (w.id.clone(), r))).collect() };
    tauri::async_runtime::spawn_blocking(move || search_roots(roots, query, content, sensitive)).await.map_err(|e| error("SEARCH", e.to_string()))
}
#[tauri::command]
async fn export_file(app: tauri::AppHandle, state: State<'_, AppState>, document_id: String, format: String, data: String) -> Result<bool> {
    if !["html", "pdf", "zip"].contains(&format.as_str()) { return Err(error("EXPORT", "不支持的导出格式")); }
    if data.len() > 140 * 1024 * 1024 { return Err(error("LARGE", "导出文件不能超过 100MiB")); }
    let bytes = STANDARD.decode(data).map_err(|_| error("EXPORT", "导出数据无效"))?;
    if bytes.len() > 100 * 1024 * 1024 { return Err(error("LARGE", "导出文件不能超过 100MiB")); }
    let doc = state.core.lock().unwrap().documents.get(&document_id).cloned().ok_or_else(|| error("MISSING", "文档已关闭"))?;
    let name = format!("{}.{}", Path::new(&doc.path).file_stem().unwrap().to_string_lossy(), format);
    let mut fixture_target: Option<PathBuf> = None;
    #[cfg(debug_assertions)]
    if std::env::var_os("LEXLY_DEV_HEADLESS").is_some() && std::env::var_os("LEXLY_DEV_DATA_DIR").is_some() {
        let data = state.core.lock().unwrap().data.join("exports"); fs::create_dir_all(&data)?; files::validate_name(&name)?; fixture_target = Some(data.join(&name));
    }
    let mut target = if let Some(path) = fixture_target.take() { path } else {
        let Some(target) = app.dialog().file().set_title("导出文档").set_file_name(name).add_filter("导出文件", &[format.as_str()]).blocking_save_file() else { return Ok(false); };
        target.into_path().map_err(|_| error("PATH", "不支持此位置"))?
    };
    if target.extension().is_none() { target.set_extension(&format); }
    if !target.extension().is_some_and(|ext| ext.eq_ignore_ascii_case(&format)) { return Err(error("TYPE", "请选择与导出格式一致的文件扩展名")); }
    files::atomic_write(&target, &bytes)?; Ok(true)
}

pub fn run() {
    if let Some(dir) = preferred_data_dir() {
        // WebView2 reads this before Tauri forces its own default, keeping the browser profile inside the data directory.
        if std::env::var_os("WEBVIEW2_USER_DATA_FOLDER").is_none() { std::env::set_var("WEBVIEW2_USER_DATA_FOLDER", dir.join("webview")); }
    }
    let builder = tauri::Builder::default();
    // Debug integration fixtures use independent app-data and must not interrupt the user's window.
    let isolated = cfg!(debug_assertions) && std::env::var_os("LEXLY_DEV_DATA_DIR").is_some();
    let builder = if isolated { builder } else { builder.plugin(tauri_plugin_single_instance::init(|app, _, _| { if let Some(window) = app.get_webview_window("main") { let _ = window.set_focus(); } })) };
    builder
        .plugin(tauri_plugin_dialog::init())
        .plugin(tauri_plugin_opener::init())
        .plugin(tauri_plugin_updater::Builder::new().build())
        .plugin(tauri_plugin_process::init())
        .on_window_event(|window, event| {
            if matches!(event, tauri::WindowEvent::CloseRequested { .. }) {
                let state = window.state::<AppState>(); let core = state.core.lock().unwrap();
                if let (Ok(size), Ok(position), Ok(scale)) = (window.inner_size(), window.outer_position(), window.scale_factor()) {
                    let maximized = window.is_maximized().unwrap_or(false);
                    let previous = read_json(&core.data.join("window.json")).unwrap_or(json!({}));
                    let value = if maximized { json!({ "width": previous["width"], "height": previous["height"], "x": previous["x"], "y": previous["y"], "maximized": true }) } else { json!({ "width": size.width as f64 / scale, "height": size.height as f64 / scale, "x": position.x, "y": position.y, "maximized": false }) };
                    let _ = write_json(&core.data.join("window.json"), &value);
                }
            }
        })
        .setup(move |app| {
            let legacy = app.path().app_local_data_dir()?;
            let data = preferred_data_dir().unwrap_or_else(|| legacy.clone());
            fs::create_dir_all(&data)?;
            migrate_legacy_data(&data, &legacy).map_err(|e| std::io::Error::new(std::io::ErrorKind::Other, e.message))?;
            for folder in ["recovery", "backups", "operations"] { fs::create_dir_all(data.join(folder))?; }
            let workspaces: Vec<Workspace> = read_json(&data.join("workspaces.json")).and_then(|v| serde_json::from_value(v).ok()).unwrap_or_default();
            let preferences = read_json(&data.join("preferences.json")).unwrap_or(json!({}));
            app.manage(AppState { privacy:privacy::Privacy::new(&data), core: Mutex::new(Core { data, workspaces: workspaces.clone(), documents: HashMap::new(), preferences }), watchers: Mutex::new(HashMap::new()) });
            if let Some(window) = app.get_webview_window("main") {
                let state = app.state::<AppState>(); let core = state.core.lock().unwrap();
                if let Some(value) = read_json(&core.data.join("window.json")) {
                    let width = value["width"].as_f64().unwrap_or(1280.0).clamp(820.0, 4000.0);
                    let height = value["height"].as_f64().unwrap_or(820.0).clamp(560.0, 2400.0);
                    let _ = window.set_size(tauri::LogicalSize::new(width, height));
                    if let (Some(x),Some(y)) = (value["x"].as_i64(), value["y"].as_i64()) {
                        let visible = window.available_monitors().unwrap_or_default().iter().any(|monitor| { let p = monitor.position(); let size = monitor.size(); x >= p.x as i64 && y >= p.y as i64 && x + 100 < p.x as i64 + size.width as i64 && y + 100 < p.y as i64 + size.height as i64 });
                        if visible { let _ = window.set_position(tauri::PhysicalPosition::new(x as i32,y as i32)); } else { let _ = window.center(); }
                    }
                    if value["maximized"].as_bool() == Some(true) { let _ = window.maximize(); }
                }
            }
            if !isolated {
                use tauri::{menu::{Menu,MenuItem},tray::TrayIconBuilder};
                let show=MenuItem::with_id(app,"show","显示 Lexly",true,None::<&str>)?;let quit=MenuItem::with_id(app,"quit","退出 Lexly",true,None::<&str>)?;let menu=Menu::with_items(app,&[&show,&quit])?;
                let mut tray=TrayIconBuilder::new().tooltip("Lexly").menu(&menu).show_menu_on_left_click(true).on_menu_event(|app,event|{if let Some(window)=app.get_webview_window("main"){let _=window.show();let _=window.unminimize();let _=window.set_focus();if event.id.as_ref()=="quit"{let _=window.emit("tray-exit",());}}});
                if let Some(icon)=app.default_window_icon(){tray=tray.icon(icon.clone());}tray.build(app)?;
            }
            if let Some(window)=app.get_webview_window("main"){if let Some(monitor)=window.current_monitor().ok().flatten().or_else(||window.primary_monitor().ok().flatten()){let scale=monitor.scale_factor();let maximum_width=(monitor.size().width as f64/scale-32.0).max(560.0);let maximum_height=(monitor.size().height as f64/scale-64.0).max(400.0);let _=window.set_min_size(Some(tauri::LogicalSize::new(680.0_f64.min(maximum_width),480.0_f64.min(maximum_height))));if !window.is_maximized().unwrap_or(false){if let Ok(size)=window.inner_size(){let _=window.set_size(tauri::LogicalSize::new((size.width as f64/scale).min(maximum_width),(size.height as f64/scale).min(maximum_height)));}}}}
            for ws in &workspaces { start_watch(app.handle(), ws); }
            #[cfg(debug_assertions)]
            if std::env::var_os("LEXLY_DEV_HEADLESS").is_some() { if let Some(window) = app.get_webview_window("main") { window.hide()?; } }
            Ok(())
        })
        .invoke_handler({let handler:Box<dyn Fn(tauri::ipc::Invoke<tauri::Wry>)->bool+Send+Sync>=Box::new(tauri::generate_handler![list_system_fonts,knowledge_index,privacy_status,privacy_lock,privacy_unlock,privacy_password,save_window_geometry,valid_file_references,check_release,check_signed_update,convert_document_format,list_operation_backups,restore_operation_backup,read_version,list_versions,snapshot_document,read_disk_document,choose_backup_directory,backup_workspace,list_workspace_backups,open_backup_directory,reconnect_workspace,open_local_paths,bootstrap, data_directory, open_data_directory, select_workspace, remove_workspace, list_directory, open_in_system_directory, document_metadata, open_document, check_document, close_document, save_document, write_recovery, discard_recovery, open_recovery, save_preferences, create_entry, relocate_entry, trash_entry, import_image, open_image_directory, resolve_image, resolve_markdown_link, save_temporary_document, save_document_as, search_workspace, export_file, archive_document, list_archives, restore_archive, delete_archive, tag_candidates, apply_tag_changes]); move |invoke:tauri::ipc::Invoke<tauri::Wry>| {let locked=invoke.message.webview().state::<AppState>().privacy.locked.load(std::sync::atomic::Ordering::SeqCst);if locked&&!matches!(invoke.message.command(),"privacy_status"|"privacy_unlock"|"save_window_geometry"){invoke.resolver.reject(json!({"code":"LOCKED","message":"请先解锁应用"}));return true}handler(invoke)}})
        .run(tauri::generate_context!())
        .expect("Lexly failed to start");
}

#[cfg(test)]
mod tests {
    #[test] fn data_directory_requires_file_creation() {
        let dir = tempfile::tempdir().unwrap();
        assert!(writable_data_dir(dir.path()));
        assert_eq!(fs::read_dir(dir.path()).unwrap().count(), 0);
        let file = dir.path().join("not-a-directory");
        fs::write(&file, "fixture").unwrap();
        assert!(!writable_data_dir(&file));
    }
    use super::*;
    #[test] fn moving_document_rewrites_reference_style_managed_image() {
        let dir = tempfile::tempdir().unwrap(); let root = fs::canonicalize(dir.path()).unwrap(); fs::create_dir(root.join("assets")).unwrap(); fs::write(root.join("assets/a.png"), b"image").unwrap(); fs::create_dir(root.join("nested")).unwrap();
        let text = "# Test\n![alt][pic]\n\n[pic]: assets/a.png\n";
        let rewritten = rewrite_images(text, &root, &root.join("a.md"), &root.join("nested/a.md"));
        assert!(rewritten.contains("![alt](../assets/a.png)"));
    }
    #[test] fn workspace_search_is_bounded_and_ignores_non_markdown() {
        let dir = tempfile::tempdir().unwrap(); let root = fs::canonicalize(dir.path()).unwrap();
        fs::write(root.join("a.md"), "# Hello\n你好 World\nworld").unwrap(); fs::write(root.join("private.txt"), "world").unwrap();
        fs::create_dir(root.join(".git")).unwrap(); fs::write(root.join(".git/hidden.md"), "world").unwrap();
        let result = search_roots(vec![("test".into(),root.clone())], "WORLD".into(),true,false);
        assert_eq!(result.hits.len(),2); assert_eq!(result.hits[0].line,2); assert_eq!(result.hits[0].snippet,"你好 World");
        assert_eq!(search_roots(vec![("test".into(),root.clone())],"WORLD".into(),true,true).hits.len(),0);
        assert_eq!(search_roots(vec![("test".into(),root)],"A.MD".into(),false,false).hits.len(),1);
    }
    #[test] fn resource_cannot_escape_root() {
        let dir = tempfile::tempdir().unwrap(); let root = fs::canonicalize(dir.path()).unwrap();
        assert!(resolve_link(&root, &root, "../../private.png").is_err()); assert!(resolve_link(&root, &root, "file:///etc/passwd").is_err());
    }
    #[test] fn legacy_data_copies_once_without_touching_the_source() {
        let dir = tempfile::tempdir().unwrap();
        let legacy = dir.path().join("legacy"); let data = dir.path().join("install").join("data");
        fs::create_dir_all(legacy.join("history/abc")).unwrap(); fs::create_dir_all(&data).unwrap();
        fs::write(legacy.join("preferences.json"), b"{\"tags\":[\"x\"]}").unwrap();
        fs::write(legacy.join("workspaces.json"), b"[]").unwrap();
        fs::write(legacy.join("history/abc/index.json"), b"[]").unwrap();
        migrate_legacy_data(&data, &legacy).unwrap();
        assert!(data.join("preferences.json").exists() && data.join("history/abc/index.json").exists() && !data.join("workspace-backups").exists());
        let manifest: Value = serde_json::from_slice(&fs::read(data.join("migration.json")).unwrap()).unwrap();
        assert_eq!(manifest["files"].as_u64().unwrap(), 3);
        fs::write(data.join("preferences.json"), b"{\"tags\":[\"newer\"]}").unwrap();
        fs::write(legacy.join("preferences.json"), b"{\"tags\":[\"older\"]}").unwrap();
        fs::remove_file(data.join("migration.json")).unwrap();
        migrate_legacy_data(&data, &legacy).unwrap();
        assert_eq!(fs::read(data.join("preferences.json")).unwrap(), b"{\"tags\":[\"newer\"]}");
        assert!(legacy.join("preferences.json").exists());
    }
}

