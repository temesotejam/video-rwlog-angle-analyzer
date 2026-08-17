import { decodeFrames } from './mp4.js';
import { measurementRows, extractRwlogAnchors, pitchColumns, t0Reference } from './rwlog.js';

export const START_PATTERN = [[0,1,0],[1,1.6,1],[1.6,1.9,0],[1.9,2.5,1],[2.5,2.8,0],[2.8,4,1],[4,5,0]];
export const END_PATTERN = [[0,1,0],[1,2.2,1],[2.2,2.5,0],[2.5,3.1,1],[3.1,3.4,0],[3.4,4,1],[4,5,0]];
export const MID_PATTERN = [[0,.3,1],[.3,.6,0],[.6,1.2,1]];

export function median(values){if(!values.length)return NaN;const a=[...values].sort((x,y)=>x-y),m=a.length>>1;return a.length%2?a[m]:(a[m-1]+a[m])/2;}
export function mean(values){let s=0,n=0;for(const v of values)if(Number.isFinite(v)){s+=v;n++;}return n?s/n:NaN;}

function template(fps, pattern, duration){const n=Math.round(duration*fps),v=new Float64Array(n);for(let i=0;i<n;i++){const t=i/fps;for(const [a,b,on] of pattern)if(t>=a&&t<b){v[i]=on;break;}}let m=0;for(const x of v)m+=x;m/=n;let q=0;for(let i=0;i<n;i++){v[i]-=m;q+=v[i]*v[i];}q=Math.sqrt(q);for(let i=0;i<n;i++)v[i]/=q;return v;}
function bestMatch(brightness,fps,pattern,duration,searchBegin,searchEnd){const tpl=template(fps,pattern,duration),first=Math.max(0,Math.ceil(searchBegin*fps)),last=Math.min(brightness.length-tpl.length,Math.floor(searchEnd*fps));if(last<first)throw new Error('LED探索範囲に対して動画が短すぎます');let best=-Infinity,bestStart=first;for(let start=first;start<=last;start++){let m=0;for(let j=0;j<tpl.length;j++)m+=brightness[start+j];m/=tpl.length;let norm=0,dot=0;for(let j=0;j<tpl.length;j++){const d=brightness[start+j]-m;norm+=d*d;dot+=tpl[j]*d;}if(norm>1e-16){const r=dot/Math.sqrt(norm);if(r>best){best=r;bestStart=start;}}}return {pattern_start_video_s:bestStart/fps,template_correlation:best,search_begin_video_s:first/fps,search_end_video_s:last/fps};}

export function findLedSync(brightness,fps,settings={}){
  const searchEnd=settings.searchEnd??10, midFirst=settings.midFirst??2.5, midInterval=settings.midInterval??5, tol=settings.midTolerance??.75, accept=settings.midCorrelation??.4;
  const videoEnd=(brightness.length-1)/fps;
  const start=bestMatch(brightness,fps,START_PATTERN,5,0,searchEnd);start.measurement_start_video_s=start.pattern_start_video_s+5;
  const end=bestMatch(brightness,fps,END_PATTERN,5,start.measurement_start_video_s+5,videoEnd);end.measurement_end_video_s=end.pattern_start_video_s;
  const mids=[];let expected=start.measurement_start_video_s+midFirst;
  while(expected+1.2<=end.measurement_end_video_s+1e-9){const r=bestMatch(brightness,fps,MID_PATTERN,1.2,Math.max(start.measurement_start_video_s,expected-tol),Math.min(end.measurement_end_video_s-1.2,expected+tol));r.expected_pattern_start_video_s=expected;r.offset_from_expected_s=r.pattern_start_video_s-expected;r.accepted=r.template_correlation>=accept;mids.push(r);expected+=midInterval;}
  return {fps,frame_count:brightness.length,start,end,mid_blinks:mids,acceptance_correlation:accept};
}

function canvas2d(w,h){const c=new OffscreenCanvas(w,h);const ctx=c.getContext('2d',{willReadFrequently:true,alpha:false});return {canvas:c,ctx};}
function grayscaleMean(data){let s=0;const n=data.length/4;for(let i=0;i<data.length;i+=4)s+=0.299*data[i]+0.587*data[i+1]+0.114*data[i+2];return s/n;}

export async function extractBrightness(mp4,onProgress=()=>{}){
  const w=Math.min(320,mp4.width),h=Math.max(1,Math.round(mp4.height*w/mp4.width));const {ctx}=canvas2d(w,h);const out=new Float64Array(mp4.samples.length);out.fill(NaN);let done=0;
  await decodeFrames(mp4,(frame,info)=>{ctx.drawImage(frame,0,0,w,h);out[info.index]=grayscaleMean(ctx.getImageData(0,0,w,h).data);done++;if(done%30===0)onProgress(done/mp4.samples.length);});
  const missing=[];for(let i=0;i<out.length;i++)if(!Number.isFinite(out[i]))missing.push(i);if(missing.length)throw new Error(`動画デコードで ${missing.length} フレーム欠落しました`);onProgress(1);return out;
}

function whiteMask(rgba,w,h,sMax,vMin){const out=new Uint8Array(w*h);for(let p=0,i=0;p<out.length;p++,i+=4){const r=rgba[i],g=rgba[i+1],b=rgba[i+2],max=Math.max(r,g,b),min=Math.min(r,g,b),sat=max===0?0:(max-min)*255/max;if(max>=vMin&&sat<=sMax)out[p]=1;}return out;}
function morphPass(mask,w,h,r,erode,horizontal){const out=new Uint8Array(mask.length);if(horizontal){for(let y=0;y<h;y++){const pref=new Int32Array(w+1);for(let x=0;x<w;x++)pref[x+1]=pref[x]+mask[y*w+x];for(let x=0;x<w;x++){const a=Math.max(0,x-r),b=Math.min(w,x+r+1),sum=pref[b]-pref[a],need=erode?(b-a):(2*r+1);out[y*w+x]=erode?(sum===need?1:0):(sum>0?1:0);}}}else{for(let x=0;x<w;x++){const pref=new Int32Array(h+1);for(let y=0;y<h;y++)pref[y+1]=pref[y]+mask[y*w+x];for(let y=0;y<h;y++){const a=Math.max(0,y-r),b=Math.min(h,y+r+1),sum=pref[b]-pref[a],need=erode?(b-a):(2*r+1);out[y*w+x]=erode?(sum===need?1:0):(sum>0?1:0);}}}return out;}
function morph(mask,w,h,op,r=2){if(op==='erode')return morphPass(morphPass(mask,w,h,r,true,true),w,h,r,true,false);return morphPass(morphPass(mask,w,h,r,false,true),w,h,r,false,false);}
function openClose(mask,w,h){let x=morph(mask,w,h,'erode');x=morph(x,w,h,'dilate');x=morph(x,w,h,'dilate');x=morph(x,w,h,'erode');return x;}
function components(mask,w,h){
  const visited=new Uint8Array(mask.length), queue=new Int32Array(mask.length), out=[];
  const dx=[-1,0,1,-1,1,-1,0,1], dy=[-1,-1,-1,0,0,1,1,1];
  for(let p=0;p<mask.length;p++){
    if(!mask[p]||visited[p]) continue;
    let head=0,tail=0; queue[tail++]=p; visited[p]=1;
    let area=0,sx=0,sy=0,minx=w,miny=h,maxx=-1,maxy=-1;
    while(head<tail){
      const q=queue[head++], y=Math.floor(q/w), x=q-y*w;
      area++; sx+=x; sy+=y; if(x<minx)minx=x; if(x>maxx)maxx=x; if(y<miny)miny=y; if(y>maxy)maxy=y;
      for(let k=0;k<8;k++){
        const nx=x+dx[k],ny=y+dy[k];
        if(nx<0||nx>=w||ny<0||ny>=h) continue;
        const np=ny*w+nx; if(mask[np]&&!visited[np]){visited[np]=1;queue[tail++]=np;}
      }
    }
    out.push({area,x:minx,y:miny,w:maxx-minx+1,h:maxy-miny+1,cx:sx/area,cy:sy/area});
  }
  return out;
}

function pyRound(x){const f=Math.floor(x),d=x-f;if(d<.5)return f;if(d>.5)return f+1;return f%2===0?f:f+1;}
function clampRoi(roi,fw,fh){let [x,y,w,h]=roi;w=Math.min(fw,Math.max(1,pyRound(w)));h=Math.min(fh,Math.max(1,pyRound(h)));x=Math.min(Math.max(0,pyRound(x)),fw-w);y=Math.min(Math.max(0,pyRound(y)),fh-h);return [x,y,w,h];}
function roiFromCenter(cx,cy,w,h,fw,fh){return clampRoi([cx-w/2,cy-h/2,w,h],fw,fh);}
function detectionFromFrame(ctx,roi,previous,initial=false){const [x0,y0,w,h]=roi,img=ctx.getImageData(x0,y0,w,h),mask0=whiteMask(img.data,w,h,initial?85:70,initial?120:145),mask=initial?mask0:openClose(mask0,w,h);const cs=components(mask,w,h),cands=[];for(const c of cs){if(initial){if(c.area<180||c.area>1600||c.w<12||c.w>55||c.h<12||c.h>55)continue;}else{if(c.area<140||c.area>2500||c.w<8||c.w>90||c.h<8||c.h>90)continue;}const fill=c.area/(c.w*c.h);if(fill<(initial?.35:.30))continue;cands.push({...c,cx:c.cx+x0,cy:c.cy+y0,x:c.x+x0,y:c.y+y0,fill});}if(!cands.length)return null;if(initial||!previous)return cands.reduce((a,b)=>(b.area>b.area||(b.area===a.area&&b.fill>a.fill))?b:a,cands[0]);return cands.reduce((a,b)=>((b.cx-previous.cx)**2+(b.cy-previous.cy)**2<(a.cx-previous.cx)**2+(a.cy-previous.cy)**2)?b:a,cands[0]);}

export function autoWhiteRoisFromFrame(frame, searchRegion=[300,380,700,140], roiW=96,roiH=90){const {ctx}=canvas2d(frame.displayWidth,frame.displayHeight);ctx.drawImage(frame,0,0);const [x0,y0,w,h]=clampRoi(searchRegion,frame.displayWidth,frame.displayHeight),img=ctx.getImageData(x0,y0,w,h),mask=whiteMask(img.data,w,h,85,120),cs=components(mask,w,h),cands=[];for(const c of cs){if(c.area<180||c.area>1600||c.w<12||c.w>55||c.h<12||c.h>55)continue;const fill=c.area/(c.w*c.h);if(fill<.35)continue;cands.push({...c,cx:c.cx+x0,cy:c.cy+y0});}let best=null;for(let i=0;i<cands.length;i++)for(let j=i+1;j<cands.length;j++){let [l,r]=cands[i].cx<cands[j].cx?[cands[i],cands[j]]:[cands[j],cands[i]],dx=r.cx-l.cx,dy=Math.abs(r.cy-l.cy);if(dx<180||dx>450||dy>45)continue;const areaSim=Math.min(l.area,r.area)/Math.max(l.area,r.area),shape=Math.min(l.w/r.w,r.w/l.w)*Math.min(l.h/r.h,r.h/l.h),score=Math.min(l.area,r.area)*(1+areaSim+shape)-12*dy;if(!best||score>best.score)best={score,l,r};}if(!best)throw new Error(`白丸ペアを自動選択できませんでした (候補 ${cands.length})`);return {white_l:roiFromCenter(best.l.cx,best.l.cy,roiW,roiH,frame.displayWidth,frame.displayHeight),white_r:roiFromCenter(best.r.cx,best.r.cy,roiW,roiH,frame.displayWidth,frame.displayHeight)};}

export async function getReferenceRois(mp4,referenceTime,searchRegion,onProgress=()=>{}){let rois=null,bestD=Infinity;await decodeFrames(mp4,(frame,info)=>{const d=Math.abs(info.nominalTime-referenceTime);if(d<=0.51/mp4.fps&&d<bestD){bestD=d;rois=autoWhiteRoisFromFrame(frame,searchRegion);}}, {startTime:Math.max(0,referenceTime-1.1),endTime:referenceTime+.1});onProgress(1);if(!rois)throw new Error('白丸基準フレームを取得できませんでした');return rois;}

export async function trackWhiteMarkers(mp4,measurementStart,measurementEnd,rois,settings={},onProgress=()=>{}){const refBegin=settings.referenceBegin??-.8,start=Math.max(0,measurementStart+refBegin-.12),end=Math.min(mp4.duration,measurementEnd+.05),{ctx}=canvas2d(mp4.width,mp4.height);let prev={white_l:null,white_r:null};const rows=[];let processed=0,expected=Math.max(1,Math.round((end-start)*mp4.fps));await decodeFrames(mp4,(frame,info)=>{ctx.drawImage(frame,0,0,mp4.width,mp4.height);const detections={},modes={};for(const name of ['white_l','white_r']){const base=rois[name],roi=prev[name]?roiFromCenter(prev[name].cx,prev[name].cy,base[2],base[3],mp4.width,mp4.height):base;let mode=prev[name]?'previous_center':'initial_static',d=detectionFromFrame(ctx,roi,prev[name],false);if(!d&&prev[name]){const big=roiFromCenter(prev[name].cx,prev[name].cy,base[2]*1.8,base[3]*1.8,mp4.width,mp4.height);d=detectionFromFrame(ctx,big,prev[name],false);if(d)mode='previous_center_expanded';}if(d)prev[name]=d;detections[name]=d;modes[name]=mode;}const l=detections.white_l,r=detections.white_r,valid=!!(l&&r),t=info.nominalTime-measurementStart,row={frame_index:info.index,video_time_s:info.nominalTime,t_from_measurement_start_s:t,valid:valid?1:0,in_measurement_window:(info.nominalTime>=measurementStart&&info.nominalTime<=measurementEnd)?1:0,white_l_x:l?.cx??null,white_l_y:l?.cy??null,white_r_x:r?.cx??null,white_r_y:r?.cy??null,white_l_roi_mode:modes.white_l,white_r_roi_mode:modes.white_r,white_line_raw_deg:null,white_line_length_px:null,video_white_angle_deg:null};if(valid){row.white_line_raw_deg=-Math.atan2(r.cy-l.cy,r.cx-l.cx)*180/Math.PI;row.white_line_length_px=Math.hypot(r.cx-l.cx,r.cy-l.cy);}rows.push(row);processed++;if(processed%20===0)onProgress(Math.min(1,processed/expected));},{startTime:start,endTime:end});const valid=rows.filter(r=>r.valid&&Number.isFinite(r.white_line_raw_deg)),reference=valid.filter(r=>r.t_from_measurement_start_s>=(settings.referenceBegin??-.8)&&r.t_from_measurement_start_s<=(settings.referenceEnd??-.2));if(reference.length<5)throw new Error('0°基準区間の有効白丸フレームが不足しています');const baseline=median(reference.map(r=>r.white_line_raw_deg));for(const r of valid)r.video_white_angle_deg=-(r.white_line_raw_deg-baseline);onProgress(1);return {rows,baseline,validCount:valid.length,validMeasurementCount:rows.filter(r=>r.in_measurement_window&&r.valid).length,measurementFrameCount:rows.filter(r=>r.in_measurement_window).length,rois};}

function linearFit(x,y){const mx=mean(x),my=mean(y);let num=0,den=0;for(let i=0;i<x.length;i++){num+=(x[i]-mx)*(y[i]-my);den+=(x[i]-mx)**2;}const scale=num/den,offset=my-scale*mx;return {scale,offset};}
function interp(x,xp,fp,nanOutside=true){if(xp.length<2)return NaN;if(x<xp[0])return nanOutside?NaN:fp[0];if(x>xp[xp.length-1])return nanOutside?NaN:fp[fp.length-1];let lo=0,hi=xp.length-1;while(hi-lo>1){const m=(lo+hi)>>1;if(xp[m]<=x)lo=m;else hi=m;}const d=xp[hi]-xp[lo];return d?fp[lo]+(fp[hi]-fp[lo])*(x-xp[lo])/d:fp[lo];}
function metrics(errors){const v=errors.filter(Number.isFinite);if(!v.length)return {sample_count:0,rmse_deg:NaN,mae_deg:NaN,bias_deg:NaN};return {sample_count:v.length,rmse_deg:Math.sqrt(mean(v.map(x=>x*x))),mae_deg:mean(v.map(Math.abs)),bias_deg:mean(v)};}

export function compareVideoRwlog(rwlog,tracking,led,minimumMidCorrelation=.4){const all=rwlog.rows,logs=measurementRows(all),rwAnchors=extractRwlogAnchors(all);if(led.mid_blinks.length!==6)throw new Error(`動画MID同期は6個必要です (検出 ${led.mid_blinks.length})`);for(let i=0;i<6;i++){const m=led.mid_blinks[i];if(!m.accepted||m.template_correlation<minimumMidCorrelation)throw new Error(`MID同期 #${i+1} の相関が不足しています (r=${m.template_correlation.toFixed(3)})`);}const videoAnchors=[led.start.measurement_start_video_s,...led.mid_blinks.map(x=>x.pattern_start_video_s),led.end.measurement_end_video_s],fit=linearFit(rwAnchors,videoAnchors),pred=rwAnchors.map(t=>fit.offset+fit.scale*t),residualMs=videoAnchors.map((v,i)=>(v-pred[i])*1000),segmentScales=videoAnchors.slice(1).map((v,i)=>(v-videoAnchors[i])/(rwAnchors[i+1]-rwAnchors[i]));const vr=tracking.rows.filter(r=>r.in_measurement_window&&r.valid&&Number.isFinite(r.video_white_angle_deg)),vAbs=vr.map(r=>r.video_time_s),vAngle=vr.map(r=>r.video_white_angle_deg),logT=logs.map(r=>r.t_test_ms/1000),cols=pitchColumns(logs),series={};for(const c of cols){const z=t0Reference(all,c);series[c]=logs.map(r=>r[c]-z);}function build(mode){const vt=vAbs.map(t=>mode==='global'?(t-fit.offset)/fit.scale:interp(t,videoAnchors,rwAnchors)),videoAtLog=logT.map(t=>interp(t,vt,vAngle)),videoTimeAtLog=logT.map(t=>mode==='global'?fit.offset+fit.scale*t:interp(t,rwAnchors,videoAnchors)),m={};for(const c of cols)m[c]=metrics(series[c].map((v,i)=>v-videoAtLog[i]));const rows=logT.map((t,i)=>{const row={t_test_s:t,video_time_s:videoTimeAtLog[i],video_white_angle_deg:videoAtLog[i]};for(const c of cols){row[`${c}_zeroed`]=series[c][i];row[`${c}_error_deg`]=series[c][i]-videoAtLog[i];}return row;});return {rows,metrics:m,videoAtLog,videoTimeAtLog};}const global=build('global'),piecewise=build('piecewise');return {logT,series,columns:cols,global,piecewise,sync:{rwlog_anchors_s:rwAnchors,video_anchors_s:videoAnchors,global_scale:fit.scale,global_offset_s:fit.offset,anchor_residual_ms:residualMs,anchor_residual_rmse_ms:Math.sqrt(mean(residualMs.map(x=>x*x))),segment_scales:segmentScales,mid_correlations:led.mid_blinks.map(x=>x.template_correlation)}};}
