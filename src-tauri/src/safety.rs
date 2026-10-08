use super::*;

#[derive(Clone, Serialize, Deserialize)]
#[serde(rename_all="camelCase")]
pub struct Version { pub id:String, pub created_at:u64, pub reason:String, pub text:String, pub hash:String }
fn history_dir(core:&Core, workspace:&str, path:&str) -> PathBuf { core.data.join("history").join(draft_id(workspace,path)) }
fn version_index(dir:&Path)->Result<Vec<Value>>{if let Some(value)=read_json(&dir.join("index.json")){if let Some(rows)=value.as_array(){return Ok(rows.clone());}}if !dir.exists(){return Ok(vec![]);}let mut rows:Vec<Value>=fs::read_dir(dir)?.filter_map(|e|e.ok()).filter_map(|e|fs::read(e.path()).ok()).filter_map(|b|serde_json::from_slice::<Version>(&b).ok()).map(|v|json!({"id":v.id,"createdAt":v.created_at,"reason":v.reason,"hash":v.hash,"size":v.text.len()})).collect();rows.sort_by_key(|v|std::cmp::Reverse(v["createdAt"].as_u64()));Ok(rows)}
pub fn snapshot(core:&Core,doc:&Document,text:&str,reason:&str)->Result<()>{
 let dir=history_dir(core,&doc.workspace_id,&doc.path);fs::create_dir_all(&dir)?;let mut rows=version_index(&dir)?;let hash=files::digest(text.as_bytes());if rows.first().is_some_and(|v|v["hash"].as_str()==Some(&hash)){return Ok(());}
 let id=uuid::Uuid::new_v4().to_string();let created=SystemTime::now().duration_since(UNIX_EPOCH).unwrap_or_default().as_millis() as u64;write_json(&dir.join(format!("{id}.json")),&Version{id:id.clone(),created_at:created,reason:reason.into(),text:text.into(),hash:hash.clone()})?;
 rows.insert(0,json!({"id":id,"createdAt":created,"reason":reason,"hash":hash,"size":text.len()}));let keep=core.preferences["historyRetention"].as_u64().unwrap_or(100).clamp(10,500)as usize;let removed=if rows.len()>keep{rows.split_off(keep)}else{vec![]};write_json(&dir.join("index.json"),&rows)?;
 for row in removed{if let Some(id)=row["id"].as_str(){if uuid::Uuid::parse_str(id).is_ok(){let _=fs::remove_file(dir.join(format!("{id}.json")));}}}Ok(())
}
#[tauri::command]
pub async fn list_versions(state:State<'_,AppState>,document_id:String)->Result<Vec<Value>>{let core=state.core.lock().unwrap();let doc=core.documents.get(&document_id).ok_or_else(||error("MISSING","文档已关闭"))?;version_index(&history_dir(&core,&doc.workspace_id,&doc.path))}
#[tauri::command]
pub async fn read_version(state:State<'_,AppState>,document_id:String,id:String)->Result<Version>{uuid::Uuid::parse_str(&id).map_err(|_|error("SCOPE","无效版本"))?;let core=state.core.lock().unwrap();let doc=core.documents.get(&document_id).ok_or_else(||error("MISSING","文档已关闭"))?;serde_json::from_slice(&fs::read(history_dir(&core,&doc.workspace_id,&doc.path).join(format!("{id}.json")))?).map_err(|_|error("CONFIG","无法读取版本"))}
#[tauri::command]
pub async fn snapshot_document(state:State<'_,AppState>,document_id:String,text:String,reason:String)->Result<()>{
    let core=state.core.lock().unwrap();let doc=core.documents.get(&document_id).ok_or_else(||error("MISSING","文档已关闭"))?;
    if text.len()>20*1024*1024{return Err(error("LARGE","快照超过 20MiB"));}snapshot(&core,doc,&text,&reason)
}
#[tauri::command]
pub async fn read_disk_document(state:State<'_,AppState>,document_id:String)->Result<files::TextFile>{let core=state.core.lock().unwrap();let doc=core.documents.get(&document_id).ok_or_else(||error("MISSING","文档已关闭"))?;files::read_text(&doc_path(&core,doc)?)}
#[tauri::command]
pub async fn choose_backup_directory(app:tauri::AppHandle)->Result<Option<String>>{Ok(app.dialog().file().set_title("选择工作区备份目录").blocking_pick_folder().map(|p|p.into_path()).transpose().map_err(|_|error("PATH","无效目录"))?.map(|p|p.to_string_lossy().into()))}
fn backup_root(core:&Core)->Result<PathBuf>{let configured=core.preferences["backupDirectory"].as_str().unwrap_or("");let p=if configured.is_empty(){core.data.join("workspace-backups")}else{PathBuf::from(configured).join("LexlyBackups")};fs::create_dir_all(&p)?;let p=fs::canonicalize(p)?;for ws in core.workspaces.iter().filter(|w|!w.id.starts_with("file-")){if let Ok(r)=root(core,&ws.id){if p.starts_with(&r)||r.starts_with(&p){return Err(error("SCOPE","备份目录不能位于工作区内或包含工作区"));}}}Ok(p)}
fn copy_tree(source:&Path,dest:&Path,scope:&Path, count:&mut usize,total:&mut u64)->Result<()>{
    fs::create_dir_all(dest)?;
    for e in fs::read_dir(source)?{let e=e?;let name=e.file_name();if (name.to_string_lossy().starts_with(".lexly-")&&name!=".lexly-archive") || [".git","node_modules","target"].contains(&name.to_string_lossy().as_ref()){continue;}
        let path=files::resolve(scope,&relative(scope,&e.path()),true)?;*count+=1;if *count>100000{return Err(error("LARGE","备份超过 100000 个条目"));}
        if path.is_dir(){copy_tree(&path,&dest.join(name),scope,count,total)?;}else{*total+=fs::metadata(&path)?.len();if *total>5*1024*1024*1024{return Err(error("LARGE","单次备份超过 5GiB"));}fs::copy(path,dest.join(name))?;}
    }Ok(())
}
#[tauri::command]
pub async fn backup_workspace(state:State<'_,AppState>,workspace_id:String)->Result<Value>{
    if workspace_id.starts_with("file-"){return Err(error("SCOPE","独立文件请另存副本；工作区备份仅用于已添加的目录"));}
    let (source,base,keep,name)={let core=state.core.lock().unwrap();(root(&core,&workspace_id)?,backup_root(&core)?,core.preferences["backupRetention"].as_u64().unwrap_or(10).clamp(1,100),core.workspaces.iter().find(|w|w.id==workspace_id).unwrap().name.clone())};
    tauri::async_runtime::spawn_blocking(move||{let namespace=base.join(files::digest(workspace_id.as_bytes()));fs::create_dir_all(&namespace)?;let id=format!("{}-{}",now(),uuid::Uuid::new_v4());let target=namespace.join(&id);let mut count=0;let mut bytes=0;
        copy_tree(&source,&target.join("files"),&source,&mut count,&mut bytes)?;write_json(&target.join("manifest.json"),&json!({"workspaceId":workspace_id,"name":name,"createdAt":now(),"source":source,"files":count,"bytes":bytes}))?;
        let mut completed:Vec<PathBuf>=fs::read_dir(&namespace)?.filter_map(|e|e.ok()).map(|e|e.path()).filter(|p|p.join("manifest.json").is_file()).collect();completed.sort();let remove=completed.len().saturating_sub(keep as usize);for p in completed.into_iter().take(remove){if p.parent()==Some(namespace.as_path())&&!fs::symlink_metadata(&p)?.file_type().is_symlink(){fs::remove_dir_all(p)?;}}
        Ok(json!({"path":target,"files":count,"bytes":bytes,"createdAt":now()}))
    }).await.map_err(|e|error("BACKUP",e.to_string()))?
}
#[tauri::command]
pub async fn list_workspace_backups(state:State<'_,AppState>,workspace_id:String)->Result<Vec<Value>>{let core=state.core.lock().unwrap();let dir=backup_root(&core)?.join(files::digest(workspace_id.as_bytes()));if !dir.exists(){return Ok(vec![]);}let mut entries:Vec<Value>=fs::read_dir(dir)?.filter_map(|e|e.ok()).filter_map(|e|read_json(&e.path().join("manifest.json")).map(|mut v|{v["path"]=json!(e.path());v})).collect();entries.sort_by_key(|v|std::cmp::Reverse(v["createdAt"].as_u64()));Ok(entries)}
#[tauri::command]
pub async fn open_backup_directory(state:State<'_,AppState>)->Result<()>{let path=backup_root(&state.core.lock().unwrap())?;tauri_plugin_opener::open_path(path,None::<&str>).map_err(|e|error("OPEN",e.to_string()))}
#[tauri::command]
pub async fn reconnect_workspace(app:tauri::AppHandle,state:State<'_,AppState>,workspace_id:String)->Result<Option<Workspace>>{
    let Some(p)=app.dialog().file().set_title("重新选择此工作区目录").blocking_pick_folder()else{return Ok(None);};let path=fs::canonicalize(p.into_path().map_err(|_|error("PATH","无效目录"))?)?;
    let mut core=state.core.lock().unwrap();for ws in core.workspaces.iter().filter(|w|w.id!=workspace_id){if let Ok(r)=root(&core,&ws.id){if path.starts_with(&r)||r.starts_with(&path){return Err(error("OVERLAP","目录与已有工作区重叠"));}}}
    let ws=core.workspaces.iter_mut().find(|w|w.id==workspace_id).ok_or_else(||error("MISSING","工作区不存在"))?;ws.path=path.to_string_lossy().into();ws.available=true;let result=ws.clone();persist_workspaces(&core)?;drop(core);start_watch(&app,&result);Ok(Some(result))
}
#[tauri::command]
pub async fn open_local_paths(app:tauri::AppHandle,state:State<'_,AppState>,paths:Option<Vec<String>>)->Result<Value>{
    let paths=match paths{Some(p)=>p,None=>{match app.dialog().file().add_filter("Markdown",&["md"]).blocking_pick_file(){Some(p)=>vec![p.into_path().map_err(|_|error("PATH","无效文件"))?.to_string_lossy().into()],None=>return Ok(json!({"workspaces":[],"documents":[]}))}}};
    if paths.len()>100{return Err(error("LARGE","一次最多打开 100 项"));}let mut core=state.core.lock().unwrap();let mut opened=vec![];let mut changed=vec![];
    for p in paths{let target=fs::canonicalize(p)?;let directory=if target.is_dir(){target.clone()}else{if !target.extension().is_some_and(|e|e.eq_ignore_ascii_case("md")){continue;}target.parent().ok_or_else(||error("PATH","文件无父目录"))?.into()};
        let existing=core.workspaces.iter().filter(|w|target.is_file()||!w.id.starts_with("file-")).find(|w|fs::canonicalize(&w.path).ok().is_some_and(|r|target.starts_with(r))).cloned();
        let ws=if let Some(ws)=existing{ws}else{if target.is_dir()&&core.workspaces.iter().any(|w|fs::canonicalize(&w.path).ok().is_some_and(|r|r.starts_with(&directory))){return Err(error("OVERLAP","目录包含已有工作区"));}let ws=Workspace{id:if target.is_file(){format!("file-{}",files::digest(directory.to_string_lossy().as_bytes()))}else{uuid::Uuid::new_v4().to_string()},name:directory.file_name().unwrap_or(directory.as_os_str()).to_string_lossy().into(),path:directory.to_string_lossy().into(),available:true};core.workspaces.push(ws.clone());changed.push(ws.clone());ws};
        if target.is_file(){let r=root(&core,&ws.id)?;let path=relative(&r,&target);let file=files::read_text(&files::resolve(&r,&path,true)?)?;let id=core.documents.values().find(|d|d.workspace_id==ws.id&&d.path==path).map(|d|d.id.clone()).unwrap_or_else(||uuid::Uuid::new_v4().to_string());let d=Document{id,workspace_id:ws.id,path,text:file.text,hash:file.hash,bom:file.bom,crlf:file.crlf};core.documents.insert(d.id.clone(),d.clone());opened.push(d);}
    }persist_workspaces(&core)?;drop(core);for w in &changed{start_watch(&app,w);}Ok(json!({"workspaces":changed,"documents":opened}))
}

#[tauri::command]
pub async fn list_operation_backups(state:State<'_,AppState>)->Result<Vec<Value>>{let core=state.core.lock().unwrap();let mut rows:Vec<Value>=fs::read_dir(core.data.join("backups"))?.filter_map(|e|e.ok()).filter_map(|e|read_json(&e.path().join("manifest.json"))).collect();rows.sort_by_key(|v|std::cmp::Reverse(v["createdAt"].as_u64()));Ok(rows)}
#[tauri::command]
pub async fn restore_operation_backup(state:State<'_,AppState>,id:String)->Result<Value>{
 files::validate_name(&id)?;let mut core=state.core.lock().unwrap();let dir=core.data.join("backups").join(&id);let mut manifest=read_json(&dir.join("manifest.json")).ok_or_else(||error("MISSING","备份不存在"))?;
 if manifest["kind"]=="draft"{let draft:Draft=serde_json::from_slice(&fs::read(dir.join("draft.json"))?).map_err(|_|error("CONFIG","草稿备份无效"))?;if draft.id!=draft_id(&draft.workspace_id,&draft.path){return Err(error("CONFIG","草稿标识不一致"));}let target=draft_path(&core,&draft.workspace_id,&draft.path);if target.exists(){return Err(error("CONFLICT","已有更新的恢复草稿，不会覆盖"));}write_json(&target,&draft)?;manifest["restoredAt"]=json!(now());write_json(&dir.join("manifest.json"),&manifest)?;return Ok(json!({"drafts":[draft]}));}
 let rows=manifest["files"].as_array().ok_or_else(||error("CONFIG","备份记录无效"))?;let mut records=vec![];
 for row in rows{let target=PathBuf::from(row["path"].as_str().ok_or_else(||error("CONFIG","路径缺失"))?);restorable(&core,&target)?;
 let current=fs::read(&target).ok();let expected=row["writtenHash"].as_str().unwrap_or("");if !expected.is_empty()&&current.as_ref().map(|b|files::digest(b)).as_deref()!=Some(expected){return Err(error("CONFLICT","文件已再次修改，恢复未执行。请从备份目录另存副本。"));}if expected.is_empty()&&current.is_some(){return Err(error("CONFLICT","目标已有文件，恢复不会覆盖它。"));}
 let name=row["backup"].as_str().ok_or_else(||error("CONFIG","备份路径缺失"))?;let bytes=fs::read(files::resolve(&fs::canonicalize(&dir)?,name,true)?)?;records.push((target,current,bytes));}
 let directories:Vec<PathBuf>=manifest["directories"].as_array().cloned().unwrap_or_default().iter().filter_map(|v|v.as_str().map(PathBuf::from)).collect();for p in &directories{restorable(&core,p)?;if p.exists(){return Err(error("CONFLICT","目标目录已重新创建，恢复不会合并或覆盖。"));}}
 for p in &directories{fs::create_dir_all(p)?;}for(target,_,_)in &records{if let Some(parent)=target.parent(){restorable(&core,parent)?;fs::create_dir_all(parent)?;}}
 for(index,(target,_,bytes))in records.iter().enumerate(){if let Err(e)=files::atomic_write(target,bytes){for(p,old,written)in records[..index].iter().rev(){if fs::read(p).map(|b|b==*written).unwrap_or(false){if let Some(old)=old{let _=files::atomic_write(p,old);}else{let _=fs::remove_file(p);}}}return Err(e);}}
 let original_tags=manifest["tags"].as_array().cloned().unwrap_or_default();if let Some(tags)=core.preferences["tags"].as_array_mut(){for t in original_tags{if !tags.contains(&t){tags.push(t)}}}write_json(&core.data.join("preferences.json"),&core.preferences)?;
 let updates:Vec<(String,files::TextFile)>=core.documents.values().filter_map(|doc|doc_path(&core,doc).ok().and_then(|p|if records.iter().any(|(target,_,_)|*target==p){files::read_text(&p).ok().map(|file|(doc.id.clone(),file))}else{None})).collect();for(id,file)in updates{if let Some(doc)=core.documents.get_mut(&id){doc.text=file.text;doc.hash=file.hash;doc.bom=file.bom;doc.crlf=file.crlf;}}

 manifest["restoredAt"]=json!(now());write_json(&dir.join("manifest.json"),&manifest)?;
 Ok(json!({"tags":core.preferences["tags"]}))
}

#[tauri::command]
pub async fn convert_document_format(state:State<'_,AppState>,document_id:String,expected_hash:String,encoding:String,bom:bool,crlf:bool)->Result<Document>{
 if !["UTF-8","UTF-16LE","UTF-16BE"].contains(&encoding.as_str()){return Err(error("ENCODING","不支持此编码"));}let mut core=state.core.lock().unwrap();let doc=core.documents.get(&document_id).cloned().ok_or_else(||error("MISSING","文档已关闭"))?;let path=doc_path(&core,&doc)?;let source=files::read_text(&path)?;if source.hash!=expected_hash{return Err(error("CONFLICT","磁盘内容已变化，转换未执行"));}snapshot(&core,&doc,&source.text,"编码转换前")?;let bytes=files::encode_with(&source.text,bom,crlf,&encoding);let backup=core.data.join("backups").join(format!("format-{}",uuid::Uuid::new_v4()));fs::create_dir(&backup)?;files::atomic_write(&backup.join("0.md"),&fs::read(&path)?)?;write_json(&backup.join("manifest.json"),&json!({"id":backup.file_name().unwrap().to_string_lossy(),"kind":"format","createdAt":now(),"files":[{"path":path,"backup":"0.md","writtenHash":files::digest(&bytes)}]}))?;files::atomic_write(&path,&bytes)?;let result=core.documents.get_mut(&document_id).unwrap();result.hash=files::digest(&bytes);result.bom=bom||encoding!="UTF-8";result.crlf=crlf;Ok(result.clone())
}

#[tauri::command]
pub async fn check_release(state:State<'_,AppState>)->Result<Value>{
 let endpoint={state.core.lock().unwrap().preferences["updateEndpoint"].as_str().unwrap_or("").to_string()};if endpoint.is_empty(){return Ok(json!({"configured":false,"current":env!("CARGO_PKG_VERSION")}));}
 let url=reqwest::Url::parse(&endpoint).map_err(|_|error("UPDATE","发布地址无效"))?;if url.scheme()!="https"||!url.username().is_empty()||url.password().is_some(){return Err(error("UPDATE","发布地址必须使用 HTTPS"));}
 let client=reqwest::Client::builder().timeout(std::time::Duration::from_secs(15)).redirect(reqwest::redirect::Policy::none()).build().map_err(|e|error("UPDATE",e.to_string()))?;let mut response=client.get(url).send().await.map_err(|e|error("UPDATE",format!("无法连接更新服务：{e}")))?.error_for_status().map_err(|e|error("UPDATE",e.to_string()))?;
 let mut bytes=Vec::new();while let Some(chunk)=response.chunk().await.map_err(|e|error("UPDATE",e.to_string()))?{if bytes.len()+chunk.len()>1024*1024{return Err(error("UPDATE","发布信息超过 1MiB"));}bytes.extend_from_slice(&chunk)}
 let value:Value=serde_json::from_slice(&bytes).map_err(|_|error("UPDATE","发布信息不是有效 JSON"))?;let version=value["version"].as_str().ok_or_else(||error("UPDATE","发布信息缺少 version"))?;let remote=semver::Version::parse(version.trim_start_matches('v')).map_err(|_|error("UPDATE","版本号无效"))?;let current=semver::Version::parse(env!("CARGO_PKG_VERSION")).unwrap();let download=value["url"].as_str().unwrap_or("");if !download.is_empty()&&reqwest::Url::parse(download).map(|u|u.scheme()!="https").unwrap_or(true){return Err(error("UPDATE","下载链接必须使用 HTTPS"));}
 Ok(json!({"configured":true,"available":remote>current,"current":current.to_string(),"version":remote.to_string(),"notes":value["notes"],"url":download}))
}

pub fn protect_deletion(core:&Core,workspace_id:&str,path:&str,target:&Path)->Result<()>{
 let r=root(core,workspace_id)?;let dir=core.data.join("backups").join(format!("delete-{}",uuid::Uuid::new_v4()));fs::create_dir(&dir)?;let mut pending=vec![target.to_path_buf()];let mut rows=vec![];let mut directories=vec![];let mut bytes=0_u64;
 while let Some(p)=pending.pop(){let checked=files::resolve(&r,&relative(&r,&p),true)?;if checked.is_dir(){directories.push(checked.clone());for e in fs::read_dir(checked)?{pending.push(e?.path())}}else{bytes+=fs::metadata(&checked)?.len();if rows.len()>100000||bytes>5*1024*1024*1024{return Err(error("LARGE","删除前备份超过 5GiB 或 100000 个文件，原目录未删除"));}let name=format!("{}.bin",rows.len());fs::copy(&checked,dir.join(&name))?;rows.push(json!({"path":checked,"backup":name,"writtenHash":""}));}}
 write_json(&dir.join("manifest.json"),&json!({"id":dir.file_name().unwrap().to_string_lossy(),"kind":"delete","workspaceId":workspace_id,"path":path,"createdAt":now(),"files":rows,"directories":directories}))
}
fn restorable(core:&Core,target:&Path)->Result<PathBuf>{
 for ws in &core.workspaces{if let Ok(r)=root(core,&ws.id){if let Ok(rel)=target.strip_prefix(&r){if rel.components().any(|c|!matches!(c,std::path::Component::Normal(_))){continue;}let mut ancestor=target;while !ancestor.exists(){ancestor=ancestor.parent().ok_or_else(||error("SCOPE","目标缺少父目录"))?;}files::resolve(&r,&relative(&r,ancestor),true)?;return Ok(target.to_path_buf());}}}Err(error("SCOPE","恢复目标不在已注册工作区内"))
}


pub fn copy_history(core:&Core,workspace:&str,old:&str,new:&str)->Result<()> {
 let source=history_dir(core,workspace,old);if !source.exists(){return Ok(());}let target=history_dir(core,workspace,new);fs::create_dir_all(&target)?;
 let mut rows=version_index(&target)?;for row in version_index(&source)? {let Some(id)=row["id"].as_str()else{continue};if uuid::Uuid::parse_str(id).is_err()||rows.iter().any(|v|v["id"]==id){continue;}fs::copy(source.join(format!("{id}.json")),target.join(format!("{id}.json")))?;rows.push(row);}
 rows.sort_by_key(|v|std::cmp::Reverse(v["createdAt"].as_u64()));write_json(&target.join("index.json"),&rows)
}
#[tauri::command]
pub async fn valid_file_references(state:State<'_,AppState>)->Result<Value> {
 let core=state.core.lock().unwrap();let mut result=serde_json::Map::new();for key in ["recentFiles","favorites"] {let refs=core.preferences[key].as_array().cloned().unwrap_or_default();let valid:Vec<Value>=refs.into_iter().take(200).filter(|v|{
  if let Some(p)=v["absolutePath"].as_str(){return Path::new(p).is_file();}
  let (Some(ws),Some(path))=(v["workspaceId"].as_str(),v["path"].as_str())else{return false;};
  root(&core,ws).and_then(|r|files::resolve(&r,path,true)).is_ok_and(|p|p.is_file())
 }).collect();result.insert(key.into(),json!(valid));}Ok(Value::Object(result))
}

#[tauri::command]
pub async fn save_window_geometry(window:tauri::WebviewWindow,state:State<'_,AppState>)->Result<()> {
 let core=state.core.lock().unwrap();let size=window.inner_size().map_err(|e|error("WINDOW",e.to_string()))?;let position=window.outer_position().map_err(|e|error("WINDOW",e.to_string()))?;let scale=window.scale_factor().map_err(|e|error("WINDOW",e.to_string()))?;let maximized=window.is_maximized().unwrap_or(false);let previous=read_json(&core.data.join("window.json")).unwrap_or(json!({}));
 let value=if maximized {json!({"width":previous["width"],"height":previous["height"],"x":previous["x"],"y":previous["y"],"maximized":true})}else{json!({"width":size.width as f64/scale,"height":size.height as f64/scale,"x":position.x,"y":position.y,"maximized":false})};write_json(&core.data.join("window.json"),&value)
}
