import { escapeHtml } from './partner-link.util';

export type ChauffeurStep = 'ACCEPTED' | 'ARRIVED' | 'ONBOARD' | 'DROPPED';

/** Button flow of the chauffeur page, in order. */
export const CHAUFFEUR_FLOW: { step: ChauffeurStep; label: string }[] = [
  { step: 'ACCEPTED', label: 'Confirmed' },
  { step: 'ARRIVED', label: 'In position' },
  { step: 'ONBOARD', label: 'Pax on board' },
  { step: 'DROPPED', label: 'Job completed' },
];

export function mapsDirectionsUrl(destination: string): string {
  return `https://www.google.com/maps/dir/?api=1&destination=${encodeURIComponent(destination)}&travelmode=driving`;
}

/** The next button to show, given the steps already recorded; null once the job is completed. */
export function nextChauffeurStep(done: string[]): ChauffeurStep | null {
  const set = new Set(done);
  return CHAUFFEUR_FLOW.find((f) => !set.has(f.step))?.step ?? null;
}

export interface ChauffeurView {
  ref: string;
  pickupTime: string;
  passenger: string;
  paxCount: number | null;
  pickup: string;
  dropoff: string | null;
  vehicle: string | null;
  instructions: string | null;
  done: string[];
}

export function chauffeurPage(view: ChauffeurView, token: string): string {
  const base = `/api/partner-links/${encodeURIComponent(view.ref)}/track`;
  const row = (label: string, value: string | null) =>
    value
      ? `<p class="row"><span>${escapeHtml(label)}</span>${escapeHtml(value)}</p>`
      : '';
  const data = JSON.stringify({
    base,
    token,
    done: view.done,
    pickupMaps: mapsDirectionsUrl(view.pickup),
    dropoffMaps: view.dropoff ? mapsDirectionsUrl(view.dropoff) : null,
    flow: CHAUFFEUR_FLOW,
  }).replace(/</g, '\\u003c');
  return `<!doctype html><html lang="en"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>Booking ${escapeHtml(view.ref)}</title><style>
body{margin:0;font-family:Arial,Helvetica,sans-serif;background:#f5f5f5;color:#111}
.card{max-width:480px;margin:0 auto;background:#fff;min-height:100vh;padding:20px}
h1{font-size:18px;margin:0 0 14px}
.row{margin:6px 0;font-size:14px;line-height:1.4}.row span{display:block;font-size:11px;text-transform:uppercase;color:#777}
.btn{display:block;width:100%;box-sizing:border-box;margin-top:14px;padding:16px;border:0;border-radius:8px;font-size:17px;font-weight:bold;color:#fff;background:#16a34a;text-align:center;text-decoration:none;cursor:pointer}
.btn.maps{background:#2563eb}.btn[disabled]{opacity:.5}
.thanks{margin-top:24px;font-size:22px;font-weight:bold;text-align:center;color:#16a34a}
.note{margin-top:16px;font-size:12px;color:#777;line-height:1.4}
#err{color:#b91c1c;font-size:13px;margin-top:10px}
</style></head><body><div class="card"><h1>Booking ${escapeHtml(view.ref)}</h1>
${row('Pickup time', view.pickupTime)}${row('Passenger', view.passenger + (view.paxCount ? ` · ${view.paxCount} pax` : ''))}${row('Pickup', view.pickup)}${row('Drop-off', view.dropoff)}${row('Vehicle', view.vehicle)}${row('Info', view.instructions)}
<div id="actions"></div><div id="err"></div>
<p class="note">While this page stays open, your position is shared with the dispatch team from the first button until the job is completed. Please allow location access when your browser asks.</p>
</div><script>
const D=${data};let watchId=null,lastSent=0;
function send(path,body){return fetch(D.base+path+'?t='+encodeURIComponent(D.token),{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify(body)})}
function startWatch(){if(watchId!==null||!navigator.geolocation)return;
watchId=navigator.geolocation.watchPosition(p=>{const n=Date.now();if(n-lastSent<10000)return;lastSent=n;send('/position',{lat:p.coords.latitude,lng:p.coords.longitude,accuracy:p.coords.accuracy}).catch(()=>{})},()=>{},{enableHighAccuracy:true,maximumAge:5000})}
function stopWatch(){if(watchId!==null){navigator.geolocation.clearWatch(watchId);watchId=null}}
function render(){const box=document.getElementById('actions');box.innerHTML='';
const next=D.flow.find(f=>!D.done.includes(f.step));
if(D.done.includes('ACCEPTED')&&!D.done.includes('ARRIVED')){const a=document.createElement('a');a.className='btn maps';a.target='_blank';a.href=D.pickupMaps;a.textContent='Open pickup in Google Maps';box.appendChild(a)}
if(D.done.includes('ARRIVED')&&!D.done.includes('DROPPED')&&D.dropoffMaps){const a=document.createElement('a');a.className='btn maps';a.target='_blank';a.href=D.dropoffMaps;a.textContent='Open drop-off in Google Maps';box.appendChild(a)}
if(next){const b=document.createElement('button');b.className='btn';b.textContent=next.label;b.onclick=async()=>{b.disabled=true;document.getElementById('err').textContent='';
if(next.step==='ACCEPTED'||D.done.includes('ACCEPTED'))startWatch();
try{const r=await send('/step',{step:next.step});if(!r.ok)throw new Error((await r.json().catch(()=>({}))).message||'Error');D.done.push(next.step);if(next.step==='DROPPED')stopWatch();render()}catch(e){document.getElementById('err').textContent=e.message;b.disabled=false}};box.appendChild(b)}
else{const t=document.createElement('div');t.className='thanks';t.textContent='Thank you';box.appendChild(t)}}
if(D.done.includes('ACCEPTED')&&!D.done.includes('DROPPED'))startWatch();
render();
</script></body></html>`;
}
