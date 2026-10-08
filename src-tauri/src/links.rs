use crate::*;
use pulldown_cmark::{Event,Options,Parser,Tag,LinkType};
fn mapped(path:&Path,from:&Path,to:&Path)->PathBuf{if path==from{to.to_path_buf()}else if let Ok(suffix)=path.strip_prefix(from){to.join(suffix)}else{path.to_path_buf()}}
fn new_url(url:&str,wiki:bool,root:&Path,source:&Path,from:&Path,to:&Path,paths:&[PathBuf])->Option<String>{
 let (raw,anchor)=url.split_once('#').map(|(a,b)|(a,format!("#{b}"))).unwrap_or((url,String::new()));
 if raw.is_empty()||raw.contains(':')||raw.starts_with('/') {return None}
 let target=if wiki{let name=raw.trim_end_matches(".md");let exact=root.join(format!("{name}.md"));let near=source.parent()?.join(format!("{name}.md"));if paths.contains(&exact){exact}else if paths.contains(&near){near}else{let candidates:Vec<_>=paths.iter().filter(|p|p.file_stem().is_some_and(|s|s.to_string_lossy()==name)).collect();if candidates.len()!=1{return None}candidates[0].clone()}}
 else{resolve_link(root,source.parent()?,raw).ok()?};
 if !target.extension().is_some_and(|e|e.eq_ignore_ascii_case("md")){return None}
 let destination=mapped(&target,from,to);let moved_source=mapped(source,from,to);if destination==target&&moved_source==source{return None}
 let result=if wiki{relative(root,&destination).trim_end_matches(".md").to_string()}else{pathdiff::diff_paths(destination,moved_source.parent()?)?.to_string_lossy().replace('\\',"/").replace('%',"%25").replace(' ',"%20").replace('#',"%23").replace('(',"%28").replace(')',"%29")};Some(result+&anchor)
}
pub fn rewrite(text:&str,root:&Path,source:&Path,from:&Path,to:&Path,paths:&[PathBuf])->String{
 let parser=Parser::new_ext(text,Options::ENABLE_WIKILINKS|Options::ENABLE_TABLES|Options::ENABLE_FOOTNOTES|Options::ENABLE_TASKLISTS);let mut edits:Vec<(std::ops::Range<usize>,String)>=vec![];
 for(_,reference)in parser.reference_definitions().iter(){if let Some(next)=new_url(&reference.dest,false,root,source,from,to,paths){let raw=&text[reference.span.clone()];if let Some(colon)=raw.find("]:"){if let Some(offset)=raw[colon+2..].find(reference.dest.as_ref()){let start=reference.span.start+colon+2+offset;edits.push((start..start+reference.dest.len(),next))}}}}
 for(event,range)in parser.into_offset_iter(){if let Event::Start(Tag::Link{link_type,dest_url,..})=event{let wiki=matches!(link_type,LinkType::WikiLink{..});if !wiki&&!matches!(link_type,LinkType::Inline){continue}if let Some(next)=new_url(&dest_url,wiki,root,source,from,to,paths){let raw=&text[range.clone()];let begin=if wiki{raw.find("[[").map(|i|i+2)}else{raw.rfind("](").map(|i|i+2)};if let Some(begin)=begin{if let Some(offset)=raw[begin..].find(dest_url.as_ref()){let start=range.start+begin+offset;edits.push((start..start+dest_url.len(),next))}}}}}
 edits.sort_by_key(|(r,_)|r.start);edits.dedup_by_key(|(r,_)|r.start);let mut result=text.to_owned();for(range,value)in edits.into_iter().rev(){result.replace_range(range,&value)}result
}
#[cfg(test)]mod tests{use super::*;#[test]fn rename_preserves_link_format_and_code(){let temp=tempfile::tempdir().unwrap();let r=fs::canonicalize(temp.path()).unwrap();fs::write(r.join("old.md"),"# Title").unwrap();let from=r.join("old.md");let to=r.join("new.md");let source=r.join("note.md");let raw="[**label**](old.md#Title) [[old#Title|Alias]]\n\n[x][ref]\n\n[ref]: old.md \"title\"\n\n`[[old]]`\n\n```text\n[code](old.md)\n```\n";let value=rewrite(raw,&r,&source,&from,&to,&[from.clone(),source.clone()]);assert!(value.contains("[**label**](new.md#Title)"));assert!(value.contains("[[new#Title|Alias]]"));assert!(value.contains("[ref]: new.md \"title\""));assert!(value.contains("`[[old]]`"));assert!(value.contains("[code](old.md)"));}}
