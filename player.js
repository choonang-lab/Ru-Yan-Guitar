/* VENDORED MIRROR of sheet-player/player.js (canonical: github.com/choonang-lab/sheet-player). Edit canonical, then re-copy. */
/* ============================================================================
   player.js — the Sheet Player ENGINE as a mountable module (window.SheetPlayer).
   Renders the jianpu+chords score, synthesises acoustic guitar (Karplus-Strong
   or samples), strums, and highlights — into ANY container element. Used by the
   standalone sheet-player shell AND embedded inline in the Mastery Path (no
   iframe). All CSS is scoped under a `.sp` root so it can't collide with a host
   app's styles/variables. Reads shared data from window.RUYAN_SONG / RUYAN_STRUM
   / RUYAN_CHORDS / chordDiagramSVG.

   API:
     SheetPlayer.mount(container, {embed?, hash?})  -> build UI + render the song
     SheetPlayer.play({section?, index?, to?, bpm?, chordsOnly?, melodyOnly?,
                       melody?, chords?, loop?, through?, autoplay?})
     SheetPlayer.stop()
     SheetPlayer.config({...})     // tempo / track toggles without playing
     SheetPlayer.onState(cb)       // cb('ready'|'playing'|'stopped', sectionName)
     SheetPlayer.unmount()         // stop audio + clear the container
   ========================================================================== */
(function(){
"use strict";

/* ---------- scoped styles (injected once) ---------- */
const CSS = `
.sp{--bg:#0f1115;--panel:#171a21;--line:#262b36;--ink:#e8ecf3;--dim:#95a0b3;--accent:#6ea8fe;--hot:#ffd166;--good:#5fd39b;
    background:var(--bg);color:var(--ink);font:15px/1.5 -apple-system,BlinkMacSystemFont,"Segoe UI",Roboto,sans-serif;-webkit-text-size-adjust:100%;display:block}
.sp *{box-sizing:border-box}
.sp header{padding:14px 18px;border-bottom:1px solid var(--line);display:flex;gap:14px;align-items:baseline;flex-wrap:wrap}
.sp h1{font-size:17px;margin:0;font-weight:650}
.sp header .sub{color:var(--dim);font-size:13px}
.sp main{max-width:860px;margin:0 auto;padding:18px}
.sp .card{background:var(--panel);border:1px solid var(--line);border-radius:12px;padding:16px;margin-bottom:16px}
.sp .row{display:flex;gap:10px;align-items:center;flex-wrap:wrap}
.sp button{background:#20242e;color:var(--ink);border:1px solid var(--line);border-radius:9px;padding:9px 15px;font-size:14px;cursor:pointer;font-family:inherit}
.sp button:hover{border-color:var(--accent)}
.sp button.primary{background:var(--accent);color:#0b0e14;border-color:var(--accent);font-weight:650}
.sp button:disabled{opacity:.4;cursor:default}
.sp label{color:var(--dim);font-size:13px}
.sp input[type=range]{accent-color:var(--accent)}
.sp .meta{color:var(--dim);font-size:13px;margin-top:4px}
.sp .sec{margin-top:18px}
.sp .sec-h{display:flex;gap:8px;align-items:baseline;margin:4px 0 6px;color:var(--dim);font-size:12px;border-top:1px dashed var(--line);padding-top:10px}
.sp .sec-h b{color:var(--accent);font-size:13px}
.sp .sec-h .kb{color:var(--good)}
.sp .score{display:flex;flex-wrap:wrap;gap:4px 2px;line-height:1}
.sp .note{display:inline-flex;flex-direction:column;align-items:center;min-width:24px;padding:6px 3px;border-radius:7px;transition:background .05s}
.sp .note .num{font-size:19px;font-variant-numeric:tabular-nums;position:relative}
.sp .note .num .dot{position:absolute;left:50%;transform:translateX(-50%);width:3px;height:3px;border-radius:50%;background:var(--ink)}
.sp .note .ly{font-size:13px;color:var(--dim);margin-top:6px;min-height:16px}
.sp .note.rest .num{color:#3a4150}
.sp .note.on{background:var(--hot)}
.sp .note.on .num,.sp .note.on .ly{color:#0b0e14}
.sp .note.on .num .dot{background:#0b0e14}
.sp .bar{width:1px;align-self:stretch;background:var(--line);margin:0 4px}
.sp .chordline{display:flex;flex-wrap:wrap;gap:6px;margin-bottom:6px}
.sp .chip{background:#20242e;border:1px solid var(--line);border-radius:6px;padding:2px 8px;font-size:12px;color:var(--accent)}
.sp textarea{width:100%;height:200px;background:#0b0e14;color:var(--ink);border:1px solid var(--line);border-radius:9px;padding:10px;font:12px/1.5 ui-monospace,Menlo,Consolas,monospace;resize:vertical}
.sp .drop{border:1.5px dashed var(--line);border-radius:11px;padding:20px;text-align:center;color:var(--dim);font-size:13px}
.sp details{margin-top:8px}.sp summary{cursor:pointer;color:var(--dim);font-size:13px}
.sp .err{color:#ff8080;font-size:13px;margin-top:6px;min-height:18px}
.sp .k{color:var(--good)}
.sp #secjump{display:flex;flex-wrap:wrap;gap:6px;margin-top:10px}
.sp #secjump button{padding:4px 9px;font-size:12px}
.sp.embed .embed-hide{display:none!important}
.sp.embed header{display:none}
.sp .chord-chip{cursor:pointer}
.sp .chord-chip:hover{border-color:var(--accent)}
.sp #chordpop{display:none;position:fixed;z-index:60;background:#fff;color:#1C1B18;border:1px solid #cfcfcf;border-radius:10px;padding:7px 9px 5px;box-shadow:0 10px 34px rgba(0,0,0,.45)}
.sp #chordpop .cpn{font-weight:800;font-family:ui-monospace,Menlo,monospace;text-align:center;font-size:14px;margin-bottom:2px}
.sp #chordpop .cps{font-size:10px;color:#8C8A84;text-align:center;margin-top:2px}
.sp #chordpop svg{width:70px;height:86px;display:block;margin:0 auto}
`;

/* ---------- markup injected into the mount container ---------- */
const HTML = `
<header><h1>🎼 Sheet Player</h1><span class="sub">jianpu (numbered) melody + chord accompaniment · offline · Web Audio</span></header>
<main>
  <div class="card">
    <div class="row" style="justify-content:space-between">
      <div><div id="title" style="font-size:16px;font-weight:650"></div><div class="meta" id="meta"></div></div>
      <div class="row"><button id="play" class="primary">▶ Play all</button><button id="stop" disabled>■ Stop</button></div>
    </div>
    <div class="row" style="margin-top:12px">
      <label>Tempo <b id="bpmLabel"></b></label>
      <input id="bpm" type="range" min="50" max="140" step="1" style="flex:1;min-width:160px">
      <label><input type="checkbox" id="chk-melody" checked> melody</label>
      <label><input type="checkbox" id="chk-chords" checked> chords</label>
    </div>
    <div class="row embed-hide" style="margin-top:8px">
      <label>Guitar <select id="tone"><option value="synth">Synth (modeled)</option><option value="sample">Sampled acoustic</option></select></label>
      <button id="loadsamp">Load sample pack</button>
      <button id="picksamp">…or pick files</button>
      <input id="sampfiles" type="file" accept="audio/*" multiple style="display:none">
      <span id="sampstatus" class="meta"></span>
    </div>
    <div id="secjump"></div>
  </div>
  <div class="card"><div id="book"></div></div>
  <div class="card embed-hide">
    <div class="drop" id="drop">Drop a sheet-music photo here to transcribe it.<br><span style="font-size:12px">(Hands the image to your Claude workflow.)</span></div>
    <details><summary>Edit song data (JSON)</summary>
      <p class="meta">Fix any wrong note/octave/lyric here, then Reload.</p>
      <textarea id="json" spellcheck="false"></textarea>
      <div class="row" style="margin-top:8px"><button id="reload" class="primary">Reload from JSON</button><span class="err" id="err"></span></div>
    </details>
  </div>
</main>
<div id="chordpop"></div>`;

/* ---------- module state ---------- */
let root=null, $=null, embedMode=false, stateCb=null, styleInjected=false, chordpopBound=false;
let current=null;

/* ---------- pitch maths ---------- */
const NOTE_IDX = {C:0,"C#":1,Db:1,D:2,"D#":3,Eb:3,E:4,F:5,"F#":6,Gb:6,G:7,"G#":8,Ab:8,A:9,"A#":10,Bb:10,B:11};
const MAJOR = [0,2,4,5,7,9,11];
function keyAnchorMidi(k){ const s=NOTE_IDX[k]; return 57 + ((s-9+12)%12); }
function jianpuMidi(n,o,keyRoot){ if(n===0) return null; return keyRoot + MAJOR[n-1] + o*12; }
function midiToFreq(m){ return 440*Math.pow(2,(m-57)/12); }
function chordNotes(name){
  const m = name.match(/^([A-G][#b]?)(.*)$/); if(!m) return [];
  const root0 = 48 + NOTE_IDX[m[1]];
  const q = m[2]; let iv=[0,4,7];
  if(/^m(?!aj)/.test(q)) iv=[0,3,7];
  if(/m7/.test(q)) iv=[0,3,7,10];
  else if(/maj7/.test(q)) iv=[0,4,7,11];
  else if(/7/.test(q)) iv=[0,4,7,10];
  return iv.map(i=>root0+i);
}

/* ---------- Web Audio: acoustic guitar via Karplus-Strong ---------- */
let ac, master, busIn;
function audio(){
  if(ac) return;
  ac = new (window.AudioContext||window.webkitAudioContext)();
  master = ac.createGain(); master.gain.value=0.7; master.connect(ac.destination);
  const hp = ac.createBiquadFilter(); hp.type="highpass"; hp.frequency.value=75;
  const lp = ac.createBiquadFilter(); lp.type="lowpass"; lp.frequency.value=5400; lp.Q.value=0.5;
  const body = ac.createBiquadFilter(); body.type="peaking"; body.frequency.value=115; body.Q.value=1.0; body.gain.value=4.5;
  const dry = ac.createGain(); dry.gain.value=0.9;
  const conv = ac.createConvolver(); conv.buffer = makeIR(1.7, 3.0);
  const wet = ac.createGain(); wet.gain.value=0.17;
  busIn = hp; hp.connect(lp); lp.connect(body);
  body.connect(dry).connect(master);
  body.connect(conv); conv.connect(wet).connect(master);
}
function makeIR(sec, decay){
  const sr=ac.sampleRate, len=Math.floor(sr*sec), b=ac.createBuffer(2,len,sr);
  for(let ch=0;ch<2;ch++){ const d=b.getChannelData(ch);
    for(let i=0;i<len;i++) d[i]=(Math.random()*2-1)*Math.pow(1-i/len, decay); }
  return b;
}
const _ks={};
function ksBuffer(freq, muted){
  const key=(muted?"m":"n")+Math.round(freq);
  if(_ks[key]) return _ks[key];
  const sr=ac.sampleRate, N=Math.max(2,Math.round(sr/freq));
  const len=Math.floor(sr*(muted?0.18:2.3));
  const buf=ac.createBuffer(1,len,sr), out=buf.getChannelData(0), line=new Float32Array(N);
  for(let i=0;i<N;i++) line[i]=Math.random()*2-1;
  for(let p=0;p<2;p++) for(let i=0;i<N;i++) line[i]=0.5*(line[i]+line[(i+1)%N]);
  const R = muted?0.85:(0.9955+Math.min(0.0035,0.4/freq));
  let idx=0;
  for(let i=0;i<len;i++){ const cur=line[idx];
    out[i]=cur; line[idx]=0.5*(cur+line[(idx+1)%N])*R; idx=(idx+1)%N; }
  _ks[key]=buf; return buf;
}
function ksPluck(freq,t,dur,gainv,muted){
  const src=ac.createBufferSource(); src.buffer=ksBuffer(freq,muted);
  src.detune.value=Math.random()*6-3;
  const g=ac.createGain(), rel=Math.max(0.04,dur);
  g.gain.setValueAtTime(0,t);
  g.gain.linearRampToValueAtTime(gainv, t+0.004);
  g.gain.setValueAtTime(gainv, t+Math.min(0.02,rel));
  g.gain.exponentialRampToValueAtTime(0.0001, t+rel);
  src.connect(g).connect(busIn); src.start(t); src.stop(t+rel+0.15);
}

/* ---------- sampled acoustic guitar ---------- */
let GUITAR="synth";
const SAMPLES={};
const NOTE_SEMI={C:0,D:2,E:4,F:5,G:7,A:9,B:11};
function noteToMidi(name){ const m=name.match(/^([A-G])(s?)(-?\d)$/); if(!m) return null; return 12*(+m[3]+1)+NOTE_SEMI[m[1]]+(m[2]?1:0); }
const midiFreq=m=>440*Math.pow(2,(m-69)/12);
const SAMPLE_FILES=["E2","F2","G2","A2","B2","C3","D3","E3","F3","G3","A3","B3","C4","D4","E4","F4","G4","A4","C5","D5"];
async function decodeInto(name, getBytes){
  const midi=noteToMidi(name); if(midi==null) return false;
  try{ SAMPLES[midi]=await ac.decodeAudioData(await getBytes()); return true; }catch(e){ return false; }
}
async function loadSamplePack(baseUrl){
  audio(); let ok=0;
  if(window.EMBEDDED_SAMPLES){
    for(const n in window.EMBEDDED_SAMPLES)
      if(await decodeInto(n, ()=>fetch(window.EMBEDDED_SAMPLES[n]).then(r=>r.arrayBuffer()))) ok++;
    return ok;
  }
  await Promise.all(SAMPLE_FILES.map(async n=>{
    for(const ext of ["mp3","ogg","wav"]){
      try{ const r=await fetch(baseUrl+n+"."+ext); if(!r.ok) continue;
        if(await decodeInto(n, ()=>r.arrayBuffer())){ ok++; break; } }catch(e){}
    }
  }));
  return ok;
}
function nearestSample(freq){
  const target=69+12*Math.log2(freq/440); let best=null,bd=1e9;
  for(const k in SAMPLES){ const d=Math.abs(k-target); if(d<bd){bd=d;best=+k;} }
  return best;
}
function samplePluck(freq,t,dur,gainv){
  const near=nearestSample(freq); if(near==null) return ksPluck(freq,t,dur,gainv,false);
  const src=ac.createBufferSource(); src.buffer=SAMPLES[near];
  src.playbackRate.value=freq/midiFreq(near);
  const g=ac.createGain(), rel=Math.max(0.05,dur);
  g.gain.setValueAtTime(0,t);
  g.gain.linearRampToValueAtTime(gainv, t+0.005);
  g.gain.setValueAtTime(gainv, t+Math.min(0.03,rel));
  g.gain.exponentialRampToValueAtTime(0.0001, t+rel);
  src.connect(g).connect(busIn); src.start(t); src.stop(t+rel+0.2);
}
function pluck(freq,t,dur,gainv,muted){
  if(GUITAR==="sample" && !muted && SAMPLES[nearestSample(freq)]) samplePluck(freq,t,dur,gainv);
  else ksPluck(freq,t,dur,gainv,muted);
}

/* ---------- strumming (patterns from shared RUYAN_STRUM) ---------- */
function guitarVoicing(name){
  const b=chordNotes(name); if(!b.length) return [];
  const r=b[0]; return [r-12].concat(b,[r+12]).sort((x,y)=>x-y);
}
function strumChord(name,t,dir,mute,spb,ring){
  const v=guitarVoicing(name); if(!v.length) return;
  const strings = dir==="D" ? v : v.slice(Math.max(0,v.length-4));
  const order = dir==="D" ? strings : [...strings].reverse();
  const stag = ring?0.06:(mute?0.012:0.018);
  order.forEach((mn,k)=>{
    const tt=t+k*stag, f=midiToFreq(mn);
    if(mute)      pluck(f, tt, 0.14, 0.14, true);
    else if(ring) pluck(f, tt, spb*3.0, 0.15, false);
    else          pluck(f, tt, Math.min(spb*0.95,0.9), dir==="D"?0.16:0.11, false);
  });
}

/* ---------- build flat index + render ---------- */
let flat = [];
function buildFlat(song){
  flat = []; let gi=0, beat=0;
  song.sections.forEach((sec,si)=>{
    sec._startBeat=beat; sec._i=si;
    const key = sec.key || song.key;
    let melBeats=0;
    sec.mel.forEach(m=>{
      flat.push({gi:gi++, n:m[0],o:m[1],d:m[2],ly:m[3]||"", key, secStartBeat:beat, atBeat:beat+melBeats, si});
      melBeats += m[2];
    });
    const chordBeats = sec.chords.reduce((a,c)=>a+c[1],0);
    sec._melBeats=melBeats;
    sec._secLen=Math.max(melBeats, chordBeats);
    beat += sec._secLen;
  });
  return beat;
}
function render(song){
  buildFlat(song);
  $("#title").textContent=song.title;
  $("#meta").textContent=`1 = ${song.key}  ·  ${song.beatsPerBar}/4  ·  ${song.bpm} BPM  ·  ${song.sections.length} sections`;
  $("#bpm").value=song.bpm; $("#bpmLabel").textContent=song.bpm;
  const jsonEl=$("#json"); if(jsonEl) jsonEl.value=JSON.stringify(song,null,0).replace(/\},\{/g,"},\n  {");
  const sj=$("#secjump"); sj.innerHTML="";
  song.sections.forEach((sec,si)=>{
    const b=document.createElement("button"); b.textContent="▶ "+sec.name;
    b.onclick=()=>play(song, si); sj.appendChild(b);
  });
  const book=$("#book"); book.innerHTML="";
  song.sections.forEach((sec,si)=>{
    const wrap=document.createElement("div"); wrap.className="sec";
    const h=document.createElement("div"); h.className="sec-h";
    h.innerHTML=`<b>${sec.name}</b>` + (sec.key?`<span class="kb">1=${sec.key}</span>`:"");
    wrap.appendChild(h);
    const cl=document.createElement("div"); cl.className="chordline";
    sec.chords.forEach(c=>{const s=document.createElement("span");s.className="chip";
      const hasDia=(window.RUYAN_CHORDS&&window.RUYAN_CHORDS[c[0]]);
      if(hasDia){ s.classList.add("chord-chip"); s.onclick=e=>{e.stopPropagation();showChordPop(c[0],s);}; }
      s.textContent=`${c[0]}·${c[1]}`;cl.appendChild(s);});
    wrap.appendChild(cl);
    const sc=document.createElement("div"); sc.className="score";
    let beatAcc=0;
    sec.mel.forEach(m=>{
      const el=document.createElement("div"); el.className="note"+(m[0]===0?" rest":"");
      el.dataset.i = flatIndexAt(si, beatAcc);
      const num=document.createElement("div"); num.className="num"; num.textContent=m[0];
      const oc=m[1]||0;
      for(let k=0;k<Math.abs(oc);k++){const d=document.createElement("span");d.className="dot";
        if(oc>0)d.style.top=(-5-k*4)+"px"; else d.style.bottom=(-6-k*4)+"px"; num.appendChild(d);}
      const ly=document.createElement("div"); ly.className="ly"; ly.textContent=m[3]||"";
      el.appendChild(num); el.appendChild(ly); sc.appendChild(el);
      beatAcc+=m[2];
      if(beatAcc % song.beatsPerBar < 0.001){const bb=document.createElement("div");bb.className="bar";sc.appendChild(bb);}
    });
    wrap.appendChild(sc); book.appendChild(wrap);
  });
}
function flatIndexAt(si, beatAcc){
  const sec=current.sections[si];
  const target=sec._startBeat+beatAcc;
  const f=flat.find(x=>x.si===si && Math.abs(x.atBeat-target)<0.001);
  return f?f.gi:-1;
}

/* ---------- transport ---------- */
let state={playing:false, timers:[]};
function play(song, fromSec, opts){
  opts=opts||{};
  audio(); ac.resume(); stop(true);
  state.playing=true; $("#play").disabled=true; $("#stop").disabled=false;
  const bpm=+$("#bpm").value, spb=60/bpm;
  const t0=ac.currentTime+0.15;
  const startSec = fromSec||0;
  const endSec = (opts.toSec!=null) ? Math.max(startSec, Math.min(opts.toSec, song.sections.length-1)) : song.sections.length-1;
  const secStart0 = song.sections[startSec]._startBeat;
  const melOn=$("#chk-melody").checked, chOn=$("#chk-chords").checked;
  const STRUM = window.RUYAN_STRUM||{};
  emit("playing", startSec);

  const events=[];
  song.sections.forEach((sec,si)=>{
    if(si<startSec || si>endSec) return;
    const key = keyAnchorMidi(sec.key || song.key);
    const secT = t0 + (sec._startBeat - secStart0)*spb;
    if(chOn){
      const pat = STRUM[sec.strum || (sec.name==="Intro"?"muted":"ballad")] || STRUM.ballad || [];
      const chordAt=[]; let cb=0;
      const lastName = sec.chords.length ? sec.chords[sec.chords.length-1][0] : null;
      sec.chords.forEach(c=>{ for(let b=0;b<c[1];b++) chordAt[cb+b]=c[0]; cb+=c[1]; });
      const total = sec._secLen;
      for(let base=0; base<total; base+=4){
        pat.forEach(s=>{
          const pos=base+s.p; if(pos>=total-0.01) return;
          const name = chordAt[Math.floor(pos+1e-6)] || lastName;
          if(!name) return;
          events.push({t:secT+pos*spb, kind:"strum", name, dir:s.d, mute:s.m, ring:s.r});
        });
      }
    }
    let mb=0;
    sec.mel.forEach(m=>{
      const t=secT+mb*spb;
      const mid=jianpuMidi(m[0],m[1],key);
      if(mid!==null && melOn) events.push({t, kind:"note", mid, dur:Math.min(m[2]*spb*0.95,1.5)});
      const gi=flatIndexAt(si, mb);
      state.timers.push(setTimeout(()=>highlight(gi), Math.max(0,(t-ac.currentTime)*1000)));
      mb+=m[2];
    });
  });
  events.sort((a,b)=>a.t-b.t);

  const LOOK=0.35; let idx=0;
  const tick=()=>{
    const horizon=ac.currentTime+LOOK;
    while(idx<events.length && events[idx].t<horizon){
      const e=events[idx++];
      if(e.kind==="note") pluck(midiToFreq(e.mid), e.t, e.dur, 0.32, false);
      else strumChord(e.name, e.t, e.dir, e.mute, spb, e.ring);
    }
  };
  tick();
  state.sched=setInterval(tick, 120);

  const endS=song.sections[endSec];
  const endBeat=(endS._startBeat+endS._secLen) - secStart0;
  const tailMs=(t0+endBeat*spb-ac.currentTime)*1000+400;
  state.timers.push(setTimeout(()=>{
    if(opts.loop && state.playing) play(song, fromSec, opts);
    else stop();
  }, tailMs));
}
function showChordPop(name, el){
  const pop=root && root.querySelector("#chordpop"); if(!pop) return;
  const svg=window.chordDiagramSVG?window.chordDiagramSVG(name):"";
  if(!svg){ pop.style.display="none"; return; }
  const sub=(window.RUYAN_CHORDS&&window.RUYAN_CHORDS[name]&&window.RUYAN_CHORDS[name].sub)||"";
  pop.innerHTML='<div class="cpn">'+name+'</div>'+svg+(sub?'<div class="cps">'+sub+'</div>':"");
  pop.style.display="block";
  const r=el.getBoundingClientRect(), pw=pop.offsetWidth||90, ph=pop.offsetHeight||120;
  let left=Math.min(r.left, window.innerWidth-pw-6);
  let top=r.bottom+6; if(top+ph>window.innerHeight) top=r.top-ph-6;
  pop.style.left=Math.max(6,left)+"px"; pop.style.top=Math.max(6,top)+"px";
}
function highlight(gi){
  if(!root) return;
  root.querySelectorAll(".note.on").forEach(e=>e.classList.remove("on"));
  const el=root.querySelector(`.note[data-i="${gi}"]`);
  if(el){el.classList.add("on"); el.scrollIntoView({block:"nearest",behavior:"smooth"});}
}
function stop(silent){
  if(state.sched){ clearInterval(state.sched); state.sched=null; }
  state.timers.forEach(clearTimeout); state.timers=[]; state.playing=false;
  if(root){ root.querySelectorAll(".note.on").forEach(e=>e.classList.remove("on"));
            const pl=$("#play"), st=$("#stop"); if(pl)pl.disabled=false; if(st)st.disabled=true; }
  if(silent!==true) emit("stopped");
}

/* ---------- control helpers ---------- */
function truthy(v){ return v===true||v===1||v==="1"||v==="true"; }
function sectionIndexByName(song,name){
  if(name==null) return -1;
  const n=String(name).trim();
  let i=song.sections.findIndex(s=>s.name===n);
  if(i<0) i=song.sections.findIndex(s=>s.name.indexOf(n)>=0);
  return i;
}
function targetIndex(o){
  if(o.section!=null){ const i=sectionIndexByName(current,o.section); return i<0?0:i; }
  if(o.index!=null && o.index!=="") return Math.max(0,Math.min(current.sections.length-1,+o.index||0));
  return 0;
}
function applyConfig(o){
  o=o||{};
  if(o.bpm!=null && o.bpm!==""){ const v=Math.max(50,Math.min(140,+o.bpm)); if(!isNaN(v)){ $("#bpm").value=v; $("#bpmLabel").textContent=v; } }
  if(o.melody!=null)     $("#chk-melody").checked=truthy(o.melody);
  if(o.chords!=null)     $("#chk-chords").checked=truthy(o.chords);
  if(truthy(o.chordsOnly)){ $("#chk-melody").checked=false; $("#chk-chords").checked=true; }
  if(truthy(o.melodyOnly)){ $("#chk-chords").checked=false; $("#chk-melody").checked=true; }
}
function emit(event,si){
  if(!stateCb) return;
  const sec=(si!=null && current && current.sections[si])?current.sections[si].name:null;
  try{ stateCb(event, sec); }catch(e){}
}
function playScoped(o){
  o=o||{}; if(!current) return; applyConfig(o);
  const from=targetIndex(o);
  const opts={};
  if(truthy(o.loop)) opts.loop=true;
  if((o.section!=null||o.index!=null) && !truthy(o.through)){
    let to=from; if(o.to!=null){ const j=sectionIndexByName(current,o.to); if(j>=0) to=j; }
    opts.toSec=Math.max(from,to);
  }
  play(current, from, opts);
}

/* ---------- wiring ---------- */
function wire(){
  $("#play").onclick=()=>playScoped({});
  $("#stop").onclick=()=>stop();
  $("#bpm").oninput=e=>$("#bpmLabel").textContent=e.target.value;
  const tone=$("#tone"); if(tone) tone.onchange=e=>{ GUITAR=e.target.value; };
  const loadsamp=$("#loadsamp"); if(loadsamp) loadsamp.onclick=async()=>{
    $("#sampstatus").textContent="loading…";
    const n=await loadSamplePack("samples/guitar/");
    if(n){ GUITAR="sample"; $("#tone").value="sample"; $("#sampstatus").textContent=`✓ ${n} samples loaded — using sampled guitar`; }
    else  $("#sampstatus").textContent="no samples in samples/guitar/ — download the free pack";
  };
  const picksamp=$("#picksamp"); if(picksamp) picksamp.onclick=()=>$("#sampfiles").click();
  const sampfiles=$("#sampfiles"); if(sampfiles) sampfiles.onchange=async e=>{
    audio(); let ok=0;
    for(const f of e.target.files){ if(await decodeInto(f.name.replace(/\.\w+$/,""), ()=>f.arrayBuffer())) ok++; }
    if(ok){ GUITAR="sample"; $("#tone").value="sample"; $("#sampstatus").textContent=`✓ ${ok} samples loaded — using sampled guitar`; }
    else $("#sampstatus").textContent="those files weren't recognised (need note-named files like A3.mp3)";
  };
  const reload=$("#reload"); if(reload) reload.onclick=()=>{
    try{ current=JSON.parse($("#json").value); $("#err").textContent=""; stop(); render(current); }
    catch(e){ $("#err").textContent="JSON error: "+e.message; }
  };
  const drop=$("#drop");
  if(drop){
    ["dragover","dragenter"].forEach(ev=>drop.addEventListener(ev,e=>{e.preventDefault();drop.style.borderColor="var(--accent)";}));
    ["dragleave","drop"].forEach(ev=>drop.addEventListener(ev,e=>{e.preventDefault();drop.style.borderColor="";}));
    drop.addEventListener("drop",e=>{ const f=e.dataTransfer.files[0];
      if(f) drop.innerHTML=`Got <b>${f.name}</b>. Show this image to Claude in chat and say “transcribe to Sheet Player JSON”, then paste into the editor.`; });
  }
  if(window.EMBEDDED_SAMPLES) loadSamplePack().then(n=>{ if(n){GUITAR="sample";$("#tone").value="sample";$("#sampstatus").textContent=`✓ ${n} samples (embedded)`;} });
}
function attachChordpopClose(){
  if(chordpopBound) return; chordpopBound=true;
  document.addEventListener("click", ()=>{ if(root){ const p=root.querySelector("#chordpop"); if(p) p.style.display="none"; } });
}
function applyHashLaunch(){
  if(!location.hash) return;
  const p=new URLSearchParams(location.hash.slice(1)), o={};
  ["section","index","to","bpm","chordsOnly","melodyOnly","melody","chords","loop","through","autoplay","embed"].forEach(k=>{ if(p.has(k)) o[k]=p.get(k); });
  if(truthy(o.embed)){ root.classList.add("embed"); embedMode=true; }
  applyConfig(o);
  if(o.section!=null||o.index!=null){
    const si=targetIndex(o), cards=root.querySelectorAll("#book .sec");
    if(cards[si]) cards[si].scrollIntoView({block:"start"});
    $("#play").onclick=()=>playScoped(o);
    $("#play").textContent="▶ Play section";
  }
  if(truthy(o.autoplay)) playScoped(o);
}

/* ---------- public API ---------- */
function ensureStyle(){ if(styleInjected) return; const st=document.createElement("style"); st.id="sp-style"; st.textContent=CSS; document.head.appendChild(st); styleInjected=true; }
function mount(container, opts){
  opts=opts||{};
  ensureStyle();
  if(root && root!==container) unmount();
  root=container; $=s=>root.querySelector(s);
  root.classList.add("sp"); embedMode=!!opts.embed; if(embedMode) root.classList.add("embed");
  root.innerHTML=HTML;
  current=window.RUYAN_SONG;
  render(current);
  wire();
  attachChordpopClose();
  emit("ready", null);
  if(opts.hash) applyHashLaunch();
  return api;
}
function unmount(){
  stop(true);
  if(root){ root.innerHTML=""; root.classList.remove("sp","embed"); }
  root=null;
}
const api = {
  mount,
  play: playScoped,
  stop: ()=>stop(),
  config: applyConfig,
  onState: cb=>{ stateCb=cb; return api; },
  unmount
};
window.SheetPlayer = api;
})();
