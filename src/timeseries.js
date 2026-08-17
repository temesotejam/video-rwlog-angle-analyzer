import { measurementRows, numericColumns } from './rwlog.js';

const EXCLUDED = new Set(['t_test_ms','log_time_s']);
const CATEGORY_ORDER=['video','angle','error','actuator','imu','beta','trial','state','other'];

export function unitForSeries(key){
  if(key.endsWith('_error_deg')||key.endsWith('_deg'))return 'deg';
  if(key.endsWith('_dps'))return 'deg/s';
  if(key.endsWith('_mA'))return 'mA';
  if(key.endsWith('_mV'))return 'mV';
  if(key.endsWith('_ms'))return 'ms';
  if(key.endsWith('_s'))return 's';
  if(key.endsWith('_g'))return 'g';
  if(key.includes('beta'))return 'beta';
  return 'value';
}

export function categoryForSeries(key){
  if(key==='video_white_angle_deg')return 'video';
  if(key.endsWith('_error_deg'))return 'error';
  if(key.startsWith('pitch_'))return 'angle';
  if(/motor|roller|current|pulse/.test(key))return 'actuator';
  if(/gyro|^g[xyz]_dps$|^a[xyz]_g$|acc_norm/.test(key))return 'imu';
  if(key.includes('beta'))return 'beta';
  if(key.startsWith('trial_')||key.startsWith('predicted_')||key.startsWith('input_interval')||key.startsWith('current_mA_setting')||key.startsWith('pulse_width_ms_setting'))return 'trial';
  if(/state|_id$|active$|direction$|status$|led_state|sync_event/.test(key))return 'state';
  return 'other';
}

export function labelForSeries(key){
  if(key==='video_white_angle_deg')return 'video_white_angle_deg';
  if(key.endsWith('_error_deg'))return `${key.replace(/_error_deg$/,'')} error`;
  if(key.startsWith('pitch_'))return `${key} (t=0 zeroed)`;
  return key;
}

export function buildTimeSeriesCatalog(rwlog,comparison){
  const logs=measurementRows(rwlog.rows),x=comparison.logT;
  const catalog=[{key:'video_white_angle_deg',label:'video_white_angle_deg',unit:'deg',category:'video',x,y:comparison.primary.videoAtLog,derived:true}];
  for(const key of numericColumns(logs)){
    if(EXCLUDED.has(key))continue;
    let y;
    if(key.startsWith('pitch_')&&key.endsWith('_deg')&&comparison.series[key])y=comparison.series[key];
    else y=logs.map(r=>Number.isFinite(r[key])?r[key]:NaN);
    catalog.push({key,label:labelForSeries(key),unit:unitForSeries(key),category:categoryForSeries(key),x,y,derived:key.startsWith('pitch_')&&key.endsWith('_deg')});
  }
  for(const key of comparison.columns){
    const errorKey=`${key}_error_deg`;
    catalog.push({key:errorKey,label:`${key.replace(/^pitch_/,'').replace(/_deg$/,'')} error`,unit:'deg',category:'error',x,y:comparison.primary.rows.map(r=>r[errorKey]),derived:true});
  }
  const order=new Map(CATEGORY_ORDER.map((c,i)=>[c,i]));
  catalog.sort((a,b)=>(order.get(a.category)??99)-(order.get(b.category)??99)||a.label.localeCompare(b.label));
  return catalog;
}

export function recommendedSeriesKeys(catalog){
  const have=new Set(catalog.map(s=>s.key)),out=[];
  for(const k of ['video_white_angle_deg','pitch_dynamic_turnfast_deg','pitch_dynamic_hold170_deg','motor_cmd_mA','roller_actual_current_mA','gyro_pitch_rate_dps'])if(have.has(k)&&!out.includes(k))out.push(k);
  if(out.length<2)for(const s of catalog){if(!out.includes(s.key)){out.push(s.key);if(out.length>=4)break;}}
  return out.slice(0,6);
}
