export function jsonBlob(obj){return new Blob([JSON.stringify(obj,null,2)],{type:'application/json;charset=utf-8'});}
export function textBlob(text,type='text/plain;charset=utf-8'){return new Blob([text],{type});}
function esc(v){if(v==null||Number.isNaN(v))return '';const s=String(v);return /[",\n]/.test(s)?`"${s.replaceAll('"','""')}"`:s;}
export function rowsToCsv(rows){if(!rows.length)return '';const keys=Object.keys(rows[0]);return [keys.join(','),...rows.map(r=>keys.map(k=>esc(r[k])).join(','))].join('\r\n')+'\r\n';}
export function downloadBlob(blob,name){const url=URL.createObjectURL(blob),a=document.createElement('a');a.href=url;a.download=name;document.body.appendChild(a);a.click();a.remove();setTimeout(()=>URL.revokeObjectURL(url),1000);}
export function canvasToBlob(canvas){return new Promise((resolve,reject)=>canvas.toBlob(b=>b?resolve(b):reject(new Error('PNG生成に失敗しました')),'image/png'));}
