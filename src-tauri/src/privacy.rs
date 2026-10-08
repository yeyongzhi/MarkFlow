use crate::*;
use argon2::{Argon2,password_hash::{PasswordHasher,PasswordVerifier,phc::PasswordHash}};
use std::sync::atomic::{AtomicBool,Ordering};
pub struct Privacy { pub locked:AtomicBool, attempts:Mutex<(u32,u64)> }
impl Privacy { pub fn new(data:&Path)->Self { Self{locked:AtomicBool::new(read_json(&data.join("privacy.json")).and_then(|v|v["hash"].as_str().map(str::to_owned)).is_some()),attempts:Mutex::new((0,0))} } }
fn hash(state:&AppState)->Option<String>{read_json(&state.core.lock().unwrap().data.join("privacy.json")).and_then(|v|v["hash"].as_str().map(str::to_owned))}
fn verify(state:&AppState,password:&str)->Result<()> {
 let mut attempts=state.privacy.attempts.lock().unwrap();
 if now()<attempts.1{return Err(error("LOCKED","尝试过于频繁，请稍后再试"))}
 let value=hash(state).ok_or_else(||error("PASSWORD","尚未设置密码"))?;
 let valid=PasswordHash::new(&value).ok().is_some_and(|h|Argon2::default().verify_password(password.as_bytes(),&h).is_ok());
 if !valid{attempts.0+=1;if attempts.0>=5{attempts.1=now()+30}return Err(error("PASSWORD","密码错误"))}*attempts=(0,0);Ok(())
}
#[tauri::command] pub fn privacy_status(state:State<'_,AppState>)->Value{json!({"configured":hash(&state).is_some(),"locked":state.privacy.locked.load(Ordering::SeqCst)})}
#[tauri::command] pub fn privacy_lock(state:State<'_,AppState>)->Result<()>{if hash(&state).is_none(){return Err(error("PASSWORD","请先在设置中设置锁屏密码"))}state.privacy.locked.store(true,Ordering::SeqCst);Ok(())}
#[tauri::command] pub fn privacy_unlock(state:State<'_,AppState>,password:String)->Result<()>{verify(&state,&password)?;state.privacy.locked.store(false,Ordering::SeqCst);Ok(())}
#[tauri::command] pub fn privacy_password(state:State<'_,AppState>,current:String,password:String)->Result<()>{
 if state.privacy.locked.load(Ordering::SeqCst){return Err(error("LOCKED","请先解锁"))}
 if hash(&state).is_some(){verify(&state,&current)?}
 if !password.is_empty()&&(password.chars().count()<6||password.chars().count()>256||password.len()>1024){return Err(error("PASSWORD","密码须为 6–256 个字符"))}
 let data=state.core.lock().unwrap().data.clone();
 if password.is_empty(){if data.join("privacy.json").exists(){fs::remove_file(data.join("privacy.json"))?}}
 else{let hash=Argon2::default().hash_password(password.as_bytes()).map_err(|_|error("PASSWORD","密码设置失败"))?.to_string();write_json(&data.join("privacy.json"),&json!({"hash":hash}))?}Ok(())
}

#[cfg(test)] mod tests {use super::*;
 #[test] fn password_verification_limits_repeated_attempts(){let temp=tempfile::tempdir().unwrap();let value=Argon2::default().hash_password(b"test-secret").unwrap().to_string();write_json(&temp.path().join("privacy.json"),&json!({"hash":value})).unwrap();let state=AppState{privacy:Privacy::new(temp.path()),core:Mutex::new(Core{data:temp.path().to_path_buf(),workspaces:vec![],documents:HashMap::new(),preferences:json!({})}),watchers:Mutex::new(HashMap::new())};assert!(state.privacy.locked.load(Ordering::SeqCst));assert!(verify(&state,"test-secret").is_ok());for _ in 0..5{assert_eq!(verify(&state,"incorrect").unwrap_err().code,"PASSWORD")}assert_eq!(verify(&state,"test-secret").unwrap_err().code,"LOCKED");state.privacy.attempts.lock().unwrap().1=0;assert!(verify(&state,"test-secret").is_ok());}
}
