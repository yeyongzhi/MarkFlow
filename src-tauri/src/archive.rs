use super::*;
const ARCHIVE_DIR: &str = ".markflow-archive";
const LEGACY_ARCHIVE_DIR: &str = ".lexly-archive";
#[derive(Serialize,Deserialize)]
#[serde(rename_all="camelCase")]
pub struct Archived { id: String, original_path: String, archived_at: u64 }
fn container(root: &Path, create: bool) -> Result<PathBuf> {
    let target = root.join(ARCHIVE_DIR);
    if !create && !target.exists() && root.join(LEGACY_ARCHIVE_DIR).exists() { return files::resolve(root,LEGACY_ARCHIVE_DIR,true); }
    if create && !target.exists() { fs::create_dir(&target)?; }
    files::resolve(root,ARCHIVE_DIR,true)
}
fn item(root: &Path, id: &str) -> Result<PathBuf> {
    uuid::Uuid::parse_str(id).map_err(|_| error("ARCHIVE","无效归档标识"))?;
    for directory in [ARCHIVE_DIR, LEGACY_ARCHIVE_DIR] {
        let candidate = root.join(directory).join(id);
        if candidate.exists() { return files::resolve(root,&format!("{directory}/{id}"),true); }
    }
    files::resolve(root,&format!("{ARCHIVE_DIR}/{id}"),true)
}
#[tauri::command]
pub async fn archive_document(state: State<'_,AppState>, workspace_id: String, path: String) -> Result<()> {
    let mut core = state.core.lock().unwrap(); let root = root(&core,&workspace_id)?;
    let source = files::resolve(&root,&path,true)?;
    if path.starts_with(".markflow-") || path.starts_with(".lexly-") || !source.is_file() || !source.extension().is_some_and(|e| e.eq_ignore_ascii_case("md")) { return Err(error("TYPE","只能归档工作区中的 Markdown 文档")); }
    let source_path=relative(&root,&source);
    if let Some(doc)=core.documents.values().find(|d|d.workspace_id==workspace_id && d.path==source_path) { if files::read_text(&source)?.hash!=doc.hash {return Err(error("CONFLICT","文档发生外部变化，请刷新后再归档"));} }
    let folder = container(&root,true)?.join(uuid::Uuid::new_v4().to_string()); fs::create_dir(&folder)?;
    let entry = Archived { id: folder.file_name().unwrap().to_string_lossy().into(), original_path: relative(&root,&source), archived_at: now() };
    if let Err(e) = write_json(&folder.join("manifest.json"),&entry).and_then(|_| fs::rename(&source,folder.join("document.md")).map_err(Into::into)) { let _=fs::remove_file(folder.join("manifest.json")); let _=fs::remove_dir(folder); return Err(e); }
    let ids: Vec<String> = core.documents.values().filter(|d| d.workspace_id==workspace_id && d.path==entry.original_path).map(|d| d.id.clone()).collect();
    for id in ids { core.documents.remove(&id); } remove_draft(&core,&workspace_id,&entry.original_path); Ok(())
}
#[tauri::command]
pub async fn list_archives(state: State<'_,AppState>, workspace_id: String) -> Result<Vec<Archived>> {
    let root = { let core=state.core.lock().unwrap(); root(&core,&workspace_id)? };
    let mut entries=vec![];
    for directory in [ARCHIVE_DIR, LEGACY_ARCHIVE_DIR] {
      if !root.join(directory).exists() { continue; }
      let folder=files::resolve(&root,directory,true)?;
      for dir in fs::read_dir(folder)? { let dir=dir?; let id=dir.file_name().to_string_lossy().to_string(); let Ok(path)=item(&root,&id) else { continue; };
        if path.parent().and_then(|parent| parent.file_name()).and_then(|name| name.to_str()) != Some(directory) { continue; }
        let manifest=files::resolve(&root,&relative(&root,&path.join("manifest.json")),true)?;
        let entry: Archived=serde_json::from_slice(&fs::read(manifest)?).map_err(|_| error("ARCHIVE",format!("归档记录 {id} 损坏，请检查归档目录")))?;
        if entry.id != id { return Err(error("ARCHIVE","归档记录标识不一致")); } entries.push(entry);
      }
    }
    entries.sort_by(|a,b| b.archived_at.cmp(&a.archived_at)); Ok(entries)
}
#[tauri::command]
pub async fn restore_archive(state: State<'_,AppState>, workspace_id: String, id: String) -> Result<String> {
    let core=state.core.lock().unwrap(); let root=root(&core,&workspace_id)?; restore(&root,&id)
}
fn restore(root: &Path,id: &str) -> Result<String> {
    let folder=item(root,id)?;
    let manifest=files::resolve(root,&relative(root,&folder.join("manifest.json")),true)?;
    let entry: Archived=serde_json::from_slice(&fs::read(&manifest)?).map_err(|_| error("ARCHIVE","归档记录损坏"))?;
    if entry.id != id || entry.original_path.starts_with(".markflow-") || entry.original_path.starts_with(".lexly-") || !Path::new(&entry.original_path).extension().is_some_and(|e|e.eq_ignore_ascii_case("md")) { return Err(error("ARCHIVE","无效归档记录")); }
    let relative_path=Path::new(&entry.original_path); let mut parent=root.to_path_buf();
    for component in relative_path.parent().unwrap_or(Path::new("")).components() {
        let std::path::Component::Normal(name)=component else { return Err(error("SCOPE","原路径超出工作区")); };
        parent.push(name); let rel=relative(root,&parent); let checked=files::resolve(root,&rel,false)?; if !checked.exists() { fs::create_dir(&checked)?; }
    }
    let mut target=files::resolve(root,&entry.original_path,false)?;
    if target.exists() { let stem=target.file_stem().unwrap().to_string_lossy().to_string(); let mut found=false; for index in 1..=10000 { let name=format!("{stem}（恢复{index}）.md"); let candidate=files::resolve(root,&relative(root,&parent.join(name)),false)?; if !candidate.exists() { target=candidate; found=true; break; } }; if !found { return Err(error("EXISTS","无法生成恢复文件名")); } }
    let source=files::resolve(root,&relative(root,&folder.join("document.md")),true)?;
    // create_new avoids overwriting a file created after the collision check.
    let mut input=fs::File::open(&source)?; let mut output=fs::OpenOptions::new().write(true).create_new(true).open(&target)?;
    if let Err(e)=std::io::copy(&mut input,&mut output).and_then(|_| output.sync_all()) { drop(output); let _=fs::remove_file(&target); return Err(e.into()); } drop(output);
    fs::remove_file(source)?; fs::remove_file(manifest)?; let _=fs::remove_dir(folder); Ok(relative(root,&target))
}
#[tauri::command]
pub async fn delete_archive(state: State<'_,AppState>, workspace_id: String, id: String) -> Result<()> {
    let core=state.core.lock().unwrap(); let root=root(&core,&workspace_id)?; let folder=item(&root,&id)?;
    let paths:Vec<PathBuf>=fs::read_dir(&folder)?.map(|entry| entry.map(|e|e.path())).collect::<std::io::Result<_>>()?;
    for path in &paths { let name=path.file_name().unwrap().to_string_lossy(); if !["document.md","manifest.json"].contains(&name.as_ref()) { return Err(error("ARCHIVE","归档目录包含未知内容，未执行删除")); } let target=files::resolve(&root,&relative(&root,path),true)?; if !target.is_file() { return Err(error("SCOPE","归档内容类型异常")); } }
    for path in paths { fs::remove_file(path)?; } fs::remove_dir(folder)?; Ok(())
}
#[cfg(test)] mod tests {
    use super::*;
    #[test] fn restore_preserves_bytes_and_does_not_overwrite() {
        let temp=tempfile::tempdir().unwrap(); let root=fs::canonicalize(temp.path()).unwrap(); let id=uuid::Uuid::new_v4().to_string(); let dir=container(&root,true).unwrap().join(&id); fs::create_dir(&dir).unwrap();
        write_json(&dir.join("manifest.json"),&Archived{id:id.clone(),original_path:"a.md".into(),archived_at:0}).unwrap(); fs::write(dir.join("document.md"),b"\xef\xbb\xbf# archived\r\n").unwrap(); fs::write(root.join("a.md"),b"keep").unwrap();
        let restored=restore(&root,&id).unwrap(); assert_eq!(restored,"a（恢复1）.md"); assert_eq!(fs::read(root.join(restored)).unwrap(),b"\xef\xbb\xbf# archived\r\n"); assert_eq!(fs::read(root.join("a.md")).unwrap(),b"keep");
    }
    #[test] fn archive_manifest_cannot_escape_root() {
        let temp=tempfile::tempdir().unwrap(); let root=fs::canonicalize(temp.path()).unwrap(); let id=uuid::Uuid::new_v4().to_string(); let dir=container(&root,true).unwrap().join(&id);fs::create_dir(&dir).unwrap();write_json(&dir.join("manifest.json"),&Archived{id:id.clone(),original_path:"../outside.md".into(),archived_at:0}).unwrap();fs::write(dir.join("document.md"),b"safe").unwrap();assert!(restore(&root,&id).is_err());assert!(dir.join("document.md").exists());assert!(item(&root,"../unsafe").is_err());
    }
}
