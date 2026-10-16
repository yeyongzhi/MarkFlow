use super::*;
use std::io::Read;
#[derive(Serialize)]
#[serde(rename_all="camelCase")]
pub struct Candidate { workspace_id:String,path:String,text:String,hash:String }
#[derive(Deserialize)]
#[serde(rename_all="camelCase")]
pub struct Change { workspace_id:String,path:String,text:String,expected_hash:String }
#[tauri::command]
pub async fn tag_candidates(state:State<'_,AppState>) -> Result<Vec<Candidate>> {
    let roots:Vec<(String,PathBuf)>={let core=state.core.lock().unwrap();core.workspaces.iter().filter(|w|!w.id.starts_with("file-")).map(|w| root(&core,&w.id).map(|r|(w.id.clone(),r))).collect::<Result<_>>()?};
    tauri::async_runtime::spawn_blocking(move || {let mut results=vec![];let mut bytes=0;let mut visited=0;
        for (id,root) in roots {let mut pending=vec![root.clone()];while let Some(dir)=pending.pop(){for entry in fs::read_dir(dir)? {let entry=entry?;visited+=1;if visited>50000{return Err(error("LARGE","工作区超过 50000 个条目，本次标签批量操作未执行"));}
            let name=entry.file_name().to_string_lossy().to_string();if [".git",".DS_Store","node_modules","target"].contains(&name.as_str()) || (name.starts_with(".lexly-")&&name!=".lexly-archive") || (name.starts_with(".markflow-")&&name!=".markflow-archive"){continue;}
            let path=entry.path();let relative=relative(&root,&path);let Ok(path)=files::resolve(&root,&relative,true) else {continue;};if path.is_dir(){pending.push(path);continue;}if !path.extension().is_some_and(|e| e.eq_ignore_ascii_case("md")){continue;}
            let mut header=[0u8;8];let count=fs::File::open(&path)?.read(&mut header)?;let prefix=&header[..count];if !prefix.starts_with(b"---") && !prefix.starts_with(b"\xef\xbb\xbf---") && !prefix.starts_with(&[0xff,0xfe]) && !prefix.starts_with(&[0xfe,0xff]){continue;}let file=files::read_text(&path)?;if file.text.lines().next().map(str::trim_end)!=Some("---"){continue;}bytes+=file.text.len();if bytes>64*1024*1024 || results.len()>=10000{return Err(error("LARGE","带元数据的文档总量过大，本次标签批量操作未执行"));}
            results.push(Candidate{workspace_id:id.clone(),path:relative,text:file.text,hash:file.hash});
        }}}
        Ok(results)
    }).await.map_err(|e|error("TAGS",e.to_string()))?
}
#[tauri::command]
pub async fn apply_tag_changes(state:State<'_,AppState>,changes:Vec<Change>) -> Result<Vec<Document>> {
    if changes.len()>10000 || changes.iter().map(|c|c.text.len()).sum::<usize>()>64*1024*1024 {return Err(error("LARGE","标签批量更新内容过大"));}
    if changes.is_empty(){return Ok(vec![]);}
    let mut core=state.core.lock().unwrap();let backup=core.data.join("backups").join(format!("tags-{}",uuid::Uuid::new_v4()));fs::create_dir(&backup)?;
    let journal=core.data.join("operations").join(format!("tags-{}.json",uuid::Uuid::new_v4()));let mut records:Vec<(PathBuf,Vec<u8>,Vec<u8>)>=vec![];
    let mut seen=std::collections::HashSet::new();
    for (i,change) in changes.iter().enumerate(){
        if !seen.insert((&change.workspace_id,&change.path)){return Err(error("TAGS","重复文档变更"));}
        if change.path.starts_with(".lexly-") || change.path.starts_with(".markflow-") {let parts:Vec<_>=change.path.split('/').collect();if parts.len()!=3 || ![".lexly-archive",".markflow-archive"].contains(&parts[0]) || uuid::Uuid::parse_str(parts[1]).is_err() || parts[2]!="document.md"{return Err(error("SCOPE","不能修改内部元数据文件"));}}
        let root=root(&core,&change.workspace_id)?;let target=files::resolve(&root,&change.path,true)?;
        if !target.extension().is_some_and(|e|e.eq_ignore_ascii_case("md")){return Err(error("TYPE","只能更新 Markdown 标签"));}
        let file=files::read_text(&target)?;if file.hash!=change.expected_hash{return Err(error("CONFLICT",format!("{} 已被外部修改，标签更新未执行",change.path)));}
        let original=fs::read(&target)?;let next=files::encode_with(&change.text,file.bom,file.crlf,&file.encoding);files::atomic_write(&backup.join(format!("{i}.md")),&original)?;records.push((target,original,next));
    }
    write_json(&journal,&json!({"kind":"tags","backup":backup,"files":records.iter().enumerate().map(|(i,(path,_,next))|json!({"path":path,"backup":format!("{i}.md"),"writtenHash":files::digest(next)})).collect::<Vec<_>>()}))?;
    for (index,(target,original,next)) in records.iter().enumerate(){
        let result=fs::read(target).map_err(Into::into).and_then(|current|if files::digest(&current)!=files::digest(original){Err(error("CONFLICT","文档在标签更新期间发生外部变化"))}else{files::atomic_write(target,next)});
        if let Err(e)=result{let mut complete=true;for (path,old,written) in records[..index].iter().rev(){if fs::read(path).map(|b|files::digest(&b)==files::digest(written)).unwrap_or(false){if files::atomic_write(path,old).is_err(){complete=false;}}else{complete=false;}}
            if complete{let _=fs::remove_file(&journal);return Err(e);}return Err(error("TAGS",format!("部分标签更新无法回滚，原文件备份保留在 {}",backup.display())));
        }
    }
    let mut updated=vec![];
    for (change,(_,_,bytes)) in changes.iter().zip(records.iter()){for doc in core.documents.values_mut(){if doc.workspace_id==change.workspace_id && doc.path==change.path{doc.text=change.text.clone();doc.hash=files::digest(bytes);updated.push(doc.clone());}}}
    write_json(&backup.join("manifest.json"),&json!({"kind":"tags","id":backup.file_name().unwrap().to_string_lossy(),"createdAt":now(),"tags":core.preferences["tags"],"files":records.iter().enumerate().map(|(i,(path,_,next))|json!({"path":path,"backup":format!("{i}.md"),"writtenHash":files::digest(next)})).collect::<Vec<_>>()}))?;
    let _=fs::remove_file(journal);Ok(updated)
}
