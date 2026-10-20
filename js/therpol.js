/* Therpol website: Direction B "Proof", scroll-driven tensile test. Requires three.js r128 (js/vendor/three.min.js). */
(function(){
'use strict';
const $=id=>document.getElementById(id);
const clamp=(v,a,b)=>v<a?a:v>b?b:v, seg=(p,a,b)=>clamp((p-a)/(b-a),0,1), lerp=(a,b,t)=>a+(b-a)*t;
const eOut=t=>1-Math.pow(1-t,3), eIn=t=>t*t*t, eIO=t=>t<.5?4*t*t*t:1-Math.pow(-2*t+2,3)/2;
const sstep=(a,b,x)=>{const t=clamp((x-a)/(b-a),0,1);return t*t*(3-2*t);};
let reduce=false; try{reduce=matchMedia('(prefers-reduced-motion: reduce)').matches;}catch(e){}

/* monotone cubic keyframes: smooth velocity across segments, no overshoot */
function mono(K,flatEnds){
  const xs=K.map(k=>k[0]), ys=K.map(k=>k[1]), n=xs.length, d=[], m=new Array(n);
  for(let i=0;i<n-1;i++) d[i]=(ys[i+1]-ys[i])/(xs[i+1]-xs[i]);
  m[0]=flatEnds?0:d[0]; m[n-1]=flatEnds?0:d[n-2];
  for(let i=1;i<n-1;i++) m[i]=d[i-1]*d[i]<=0?0:(d[i-1]+d[i])/2;
  for(let i=0;i<n-1;i++){ if(d[i]===0){m[i]=m[i+1]=0;continue;} const a=m[i]/d[i], b=m[i+1]/d[i], s=a*a+b*b; if(s>9){const t=3/Math.sqrt(s); m[i]=t*a*d[i]; m[i+1]=t*b*d[i];} }
  return x=>{ if(x<=xs[0]) return ys[0]; if(x>=xs[n-1]) return ys[n-1]; let i=0; while(x>xs[i+1]) i++;
    const h=xs[i+1]-xs[i], t=(x-xs[i])/h, t2=t*t, t3=t2*t;
    return (2*t3-3*t2+1)*ys[i]+(t3-2*t2+t)*h*m[i]+(-2*t3+3*t2)*ys[i+1]+(t3-t2)*h*m[i+1]; };
}

/* ---------- the test, as a function of scroll ---------- */
const BRK=.245, DA=2.2, GAP=7, DMAX=110;
const dBk=mono([[.47,0],[.52,3],[.60,14],[.80,DMAX]],true);
const camH=mono([[0,345],[.07,330],[.245,215],[.30,270],[.36,390],[.41,460],[.47,345]],true);
const camTy=mono([[0,0],[.07,0],[.245,9],[.30,9],[.37,0],[.47,0]],true);
const camAz=mono([[0,18],[.07,14],[.245,6],[.33,3],[.41,-9],[.47,-12],[.80,-6],[.86,-1],[1,-1]],true);
const camEl=mono([[0,7],[.245,2],[.41,7],[.47,4],[.80,6],[1,5]],true);
function stateAt(p){
  const s={p};
  s.dA = DA*seg(p,.07,BRK);
  s.broken = p>=BRK;
  s.gap = s.broken ? GAP*eOut(seg(p,BRK,.32)) : 0;
  s.craze = sstep(.165,BRK,p);
  s.aOut = seg(p,.33,.38);
  s.mix = seg(p,.355,.47);
  s.bIn = sstep(.445,.472,p);
  s.dB = dBk(p);
  s.cross = p<.33 ? s.dA+s.gap : p<.47 ? (DA+GAP)*(1-eIO(seg(p,.34,.42))) : s.dB;
  s.cmp = eIO(seg(p,.80,.855));
  s.routes = seg(p,.885,.905);
  s.phaseB = p>=.445;
  return s;
}
function sigA(d){ return 1.2*(1-Math.exp(-d/2)); }
const SD=(function(){ // ductile curve shape, sampled and smoothed (illustrative)
  const st=.05, n=Math.ceil(126/st), raw=new Float32Array(n), out=new Float32Array(n);
  for(let i=0;i<n;i++){ const d=i*st; raw[i]= d<4 ? 1.0*(1-Math.exp(-d/1.7)) : .905-.17*sstep(4,13,d)+.085*Math.pow(clamp((d-13)/97,0,1),1.6); }
  const w=10; for(let i=0;i<n;i++){ let a=0,c=0; for(let k=-w;k<=w;k++){ const j=i+k; if(j>=0&&j<n){a+=raw[j];c++;} } out[i]= i<6?raw[i]:a/c; }
  return out;
})();
function sigB(d){ const i=d/.05, i0=Math.floor(i); if(i0>=SD.length-1) return SD[SD.length-1]; const t=i-i0; return SD[i0]*(1-t)+SD[i0+1]*t; }

/* ---------- UI refs ---------- */
const track=$('track'), stage=$('stage');
const chs=[...document.querySelectorAll('.chp')].map(el=>({el,a:+el.dataset.a,b:+el.dataset.b,lines:[...el.querySelectorAll('.ln>span')],fd:[...el.querySelectorAll('.fd')]}));
const railEls=[...$('rail').children], railFill=railEls.map(d=>d.querySelector('b'));
const RAIL=[[0,.33],[.33,.47],[.47,.80],[.80,.885],[.885,1]];
const cards=[...document.querySelectorAll('.card')];
let isMobile=innerWidth<=760;

/* ---------- 3D ---------- */
let R=null, scene, cam, A, B, rig, flakes, drops, shards, keyL, warmL, tex;
const rigMats=[];
const SEP=()=>isMobile?62:34;
function w0(s){ const a=Math.abs(s); if(a<=40) return 5; const x=a-40; if(x<14.7) return 29-Math.sqrt(576-x*x); return 10; }

function makeTexture(){
  const N=1024, c=document.createElement('canvas'); c.width=c.height=N; const g=c.getContext('2d');
  let seed=7; const rnd=()=>{seed=(seed*16807)%2147483647; return (seed-1)/2147483646;};
  g.fillStyle='#3d4348'; g.fillRect(0,0,N,N);
  const pal=['#2b2f34','#363b41','#5c636a','#7a8189','#9aa0a6','#c8c2b4','#3a4f5e','#4f5d44','#6a5444','#202326','#56606b'];
  const wrapDraw=f=>{ for(const ox of [-N,0,N]) for(const oy of [-N,0,N]) f(ox,oy); };
  // flow lines from moulding, running along the bar
  for(let i=0;i<320;i++){
    const col=pal[(rnd()*pal.length)|0], x0=rnd()*N, amp=6+rnd()*40, fr=1+rnd()*3, ph=rnd()*6.28, lw=1+rnd()*10, al=.05+rnd()*.16;
    wrapDraw((ox,oy)=>{ g.beginPath(); for(let y=-20;y<=N+20;y+=16){ const x=x0+amp*Math.sin(y/N*6.283*fr+ph); y===-20?g.moveTo(x+ox,y+oy):g.lineTo(x+ox,y+oy);} g.strokeStyle=col; g.globalAlpha=al; g.lineWidth=lw; g.stroke(); });
  }
  g.globalAlpha=1;
  // recycled flakes
  for(let i=0;i<3200;i++){
    const r=rnd(), col= r<.04?'#d9d3c3': r<.07?'#2f5a73': r<.09?'#5d6e3c': r<.11?'#7b5a3c': pal[(rnd()*pal.length)|0];
    const x=rnd()*N, y=rnd()*N, a=.6+rnd()*3.4, b=a*(.4+rnd()*1.8), rot=rnd()*3.14, al=.35+rnd()*.6;
    wrapDraw((ox,oy)=>{ if(x+ox<-10||x+ox>N+10||y+oy<-10||y+oy>N+10) return; g.globalAlpha=al; g.fillStyle=col; g.beginPath(); g.ellipse(x+ox,y+oy,a,b,rot,0,6.283); g.fill(); });
  }
  g.globalAlpha=1;
  const im=g.getImageData(0,0,N,N), d=im.data; for(let i=0;i<d.length;i+=4){ const n=(rnd()-.5)*14; d[i]+=n; d[i+1]+=n; d[i+2]+=n; } g.putImageData(im,0,0);
  const t=new THREE.CanvasTexture(c); t.wrapS=t.wrapT=THREE.RepeatWrapping; t.encoding=THREE.sRGBEncoding; t.anisotropy=Math.min(8,R.capabilities.getMaxAnisotropy()); return t;
}

function makeSpecimenMaterial(){
  const m=new THREE.MeshPhysicalMaterial({map:tex,roughness:.52,metalness:0,clearcoat:.35,clearcoatRoughness:.4,transparent:true});
  m.onBeforeCompile=sh=>{
    sh.vertexShader='attribute float aW;\nvarying float vW;\n'+sh.vertexShader.replace('#include <begin_vertex>','#include <begin_vertex>\n  vW=aW;');
    sh.fragmentShader='varying float vW;\n'+sh.fragmentShader.replace('#include <map_fragment>','#include <map_fragment>\n  diffuseColor.rgb=mix(diffuseColor.rgb,vec3(.86,.85,.81),clamp(vW,0.,1.)*.68);');
  };
  m.customProgramCacheKey=()=>'tpw';
  return m;
}

/* cross-section: rounded rectangle; ring = one cross-section at material coordinate s */
const PER=[{c:1}]; for(const [sx,sz,a0] of [[1,-1,-90],[1,1,0],[-1,1,90],[-1,-1,180]]) for(let k=0;k<=6;k++){ const a=(a0+90*k/6)*Math.PI/180; PER.push({sx,sz,ca:Math.cos(a),sa:Math.sin(a)}); } PER.push({c:1});
const NP=PER.length;
function ringPt(j,W,H,rc,o){ const q=PER[j]; if(q.c){o[0]=0;o[1]=-H;o[2]=0;o[3]=-1;return;} o[0]=q.sx*(W-rc)+rc*q.ca; o[1]=q.sz*(H-rc)+rc*q.sa; o[2]=q.ca; o[3]=q.sa; }
function rough(x,z){ return .55*Math.sin(x*1.7+z*3.1)+.3*Math.sin(x*4.3-z*2.2+1.3)+.18*Math.sin(x*9.1+z*7.7); }

class Specimen{
  constructor(mat,capMat,split){
    const S=[]; for(let i=0;i<=340;i++) S.push(-85+i*.5);
    let iS=-1; if(split!=null){ let k=S.findIndex(v=>v>=split); if(Math.abs(S[k]-split)>1e-6) S.splice(k,0,split); iS=k; }
    this.S=Float32Array.from(S); this.N=S.length; this.W0=Float32Array.from(S,w0); this.split=split; this.iS=iS;
    this.Y=new Float32Array(this.N); this.K=new Float32Array(this.N); this.Wt=new Float32Array(this.N);
    // static elastic weighting integral over the free length
    let J=0; for(let i=1;i<this.N;i++){ const sm=(S[i]+S[i-1])/2; if(Math.abs(sm)<55) J+=(5/w0(sm))*(S[i]-S[i-1]); } this.J=J;
    this.crz=new Float32Array(this.N);
    if(split!=null){ let sd=3; const r=()=>{sd=(sd*16807)%2147483647;return (sd-1)/2147483646;}; for(let i=0;i<this.N;i++){ const dd=Math.abs(S[i]-split); if(dd<9 && r()<.26) this.crz[i]=(.35+.5*r())*(1-dd/9)*.8; } }
    // static UVs
    this.U=new Float32Array(this.N*NP); const o=[0,0,0,0], pv=[0,0,0,0];
    for(let i=0;i<this.N;i++){ let L=0; for(let j=0;j<NP;j++){ ringPt(j,this.W0[i],2,.7,o); if(j>0) L+=Math.hypot(o[0]-pv[0],o[1]-pv[1]); this.U[i*NP+j]=L/60; pv[0]=o[0];pv[1]=o[1]; } }
    this.parts=[]; this.group=new THREE.Group();
    const ranges= split==null ? [[0,this.N-1]] : [[0,iS],[iS,this.N-1]];
    for(const [i0,i1] of ranges){
      const nr=i1-i0+1, nv=nr*NP, g=new THREE.BufferGeometry();
      const pos=new Float32Array(nv*3), nor=new Float32Array(nv*3), uv=new Float32Array(nv*2), aw=new Float32Array(nv);
      for(let r=0;r<nr;r++) for(let j=0;j<NP;j++){ const v=r*NP+j; uv[v*2]=this.U[(i0+r)*NP+j]; uv[v*2+1]=(this.S[i0+r]+85)/60; }
      const idx=[]; for(let r=0;r<nr-1;r++) for(let j=0;j<NP-1;j++){ const a=r*NP+j,b=a+1,c=a+NP,d=c+1; idx.push(a,c,b,b,c,d); }
      g.setIndex(idx); g.setAttribute('position',new THREE.BufferAttribute(pos,3)); g.setAttribute('normal',new THREE.BufferAttribute(nor,3)); g.setAttribute('uv',new THREE.BufferAttribute(uv,2)); g.setAttribute('aW',new THREE.BufferAttribute(aw,1));
      const mesh=new THREE.Mesh(g,mat); mesh.frustumCulled=false; this.group.add(mesh); this.parts.push({i0,i1,g,mesh});
    }
    if(split!=null){
      this.caps=[0,1].map(()=>{ const g=new THREE.BufferGeometry(), RS=[1,.78,.56,.34,.14], nu=NP-1, nv=RS.length*nu+1;
        g.setAttribute('position',new THREE.BufferAttribute(new Float32Array(nv*3),3)); g.setAttribute('aW',new THREE.BufferAttribute(new Float32Array(nv),1));
        g.setAttribute('uv',new THREE.BufferAttribute(new Float32Array(nv*2),2));
        const idx=[]; for(let r=0;r<RS.length-1;r++) for(let j=0;j<nu;j++){ const a=r*nu+j, b=r*nu+(j+1)%nu, c=a+nu, d=b+nu; idx.push(a,b,c,b,d,c); }
        const ctr=RS.length*nu, last=(RS.length-1)*nu; for(let j=0;j<nu;j++) idx.push(last+j,last+(j+1)%nu,ctr);
        g.setIndex(idx); g.userData.RS=RS; const m=new THREE.Mesh(g,capMat); m.frustumCulled=false; this.group.add(m); return m; });
    }
    this.mat=mat; this.capMat=capMat;
  }
  /* d: total extension, ductile: neck & cold draw, craze: 0..1, gap: upper-piece offset, wob: lateral recoil */
  deform(d,ductile,craze,gap,wob){
    const S=this.S,N=this.N,W0=this.W0,Y=this.Y,K=this.K,Wt=this.Wt, LD=2.3, BW=6;
    const dEl=ductile?Math.min(d,3):d, dDr=ductile?Math.max(0,d-3):0, c=dEl/this.J;
    let a=-BW;
    if(dDr>0){ let lo=-BW,hi=62; for(let it=0;it<22;it++){ const mid=(lo+hi)/2; let I=0; for(let i=1;i<N;i++){ const sm=(S[i]+S[i-1])/2; if(Math.abs(sm)<55) I+=sstep(mid+BW,mid-BW,Math.abs(sm))*(LD-1)*(S[i]-S[i-1]); } if(I<dDr) lo=mid; else hi=mid; } a=(lo+hi)/2; }
    const fAt=s=>dDr>0?sstep(a+BW,a-BW,Math.abs(s)):0;
    let y=S[0]; Y[0]=y;
    for(let i=0;i<N;i++){
      const s=S[i], free=Math.abs(s)<55;
      if(i>0){ const sm=(s+S[i-1])/2, fm=Math.abs(sm)<55; const lam= fm ? 1+c*5/w0(sm)+fAt(sm)*(LD-1) : 1; y+=lam*(s-S[i-1]); Y[i]=y; }
      const f=free?fAt(s):0, le=free?c*5/W0[i]:0;
      K[i]=(1-.35*le)/Math.sqrt(1+f*(LD-1));
      Wt[i]= ductile ? f*.95+.25*sstep(.6,1,f) : this.crz[i]*craze;
    }
    const o=[0,0,0,0]; const yTop=Y[N-1];
    for(let pi=0;pi<this.parts.length;pi++){
      const P=this.parts[pi], pos=P.g.attributes.position.array, nor=P.g.attributes.normal.array, aw=P.g.attributes.aW.array;
      const off= pi===1?gap:0, nr=P.i1-P.i0+1;
      for(let r=0;r<nr;r++){ const i=P.i0+r, k=K[i], W=W0[i]*k, H=2*k, rc=.7*k, yy=Y[i]+off;
        const sx= pi===1 ? wob*(yTop+off-yy)/120 : (this.split!=null? wob*-.35*(yy-Y[0])/120 : 0);
        for(let j=0;j<NP;j++){ ringPt(j,W,H,rc,o); const v=(r*NP+j)*3; pos[v]=o[0]+sx; pos[v+1]=yy; pos[v+2]=o[1]; nor[v]=o[2]; nor[v+2]=o[3]; aw[r*NP+j]=Wt[i]; } }
      // tilt normals with the local taper so the neck shoulders catch the light
      for(let r=0;r<nr;r++){ const r0=Math.max(0,r-1), r1=Math.min(nr-1,r+1); const dy=pos[(r1*NP)*3+1]-pos[(r0*NP)*3+1]||1;
        for(let j=0;j<NP;j++){ const v=(r*NP+j)*3, v0=(r0*NP+j)*3, v1=(r1*NP+j)*3; const dx=(pos[v1]-pos[v0])/dy, dz=(pos[v1+2]-pos[v0+2])/dy;
          const nx=nor[v], nz=nor[v+2], ny=-(nx*dx+nz*dz), l=Math.hypot(nx,ny,nz)||1; nor[v]=nx/l; nor[v+1]=ny/l; nor[v+2]=nz/l; } }
      P.g.attributes.position.needsUpdate=P.g.attributes.normal.needsUpdate=P.g.attributes.aW.needsUpdate=true;
    }
    if(this.caps){
      const i=this.iS, k=K[i], W=W0[i]*k, H=2*k, rc=.7*k;
      this.caps.forEach((m,ci)=>{ const g=m.geometry, RS=g.userData.RS, pos=g.attributes.position.array, aw=g.attributes.aW.array, uv=g.attributes.uv.array, nu=NP-1, off=ci===1?gap:0;
        const yy=Y[i]+off, sx= ci===1 ? wob*(yTop+off-yy)/120 : wob*-.35*(yy-Y[0])/120; let v=0;
        for(const rr of RS) for(let j=0;j<nu;j++){ ringPt(j,W,H,rc,o); const x=o[0]*rr, z=o[1]*rr; pos[v*3]=x+sx; pos[v*3+1]=yy+rough(x,z)*(1-rr*rr)*1.1; pos[v*3+2]=z; aw[v]=.22*(1-rr); uv[v*2]=x/40; uv[v*2+1]=z/40; v++; }
        pos[v*3]=sx; pos[v*3+1]=yy+rough(0,0)*1.1; pos[v*3+2]=0; aw[v]=.22;
        g.attributes.position.needsUpdate=g.attributes.aW.needsUpdate=g.attributes.uv.needsUpdate=true; g.computeVertexNormals(); });
    }
  }
  setOpacity(o){ this.mat.opacity=o; if(this.capMat) this.capMat.opacity=o; this.group.visible=o>.002; this.mat.depthWrite=o>.98; }
}

function rrect(w,h,r){ const s=new THREE.Shape(), x=-w/2, y=-h/2; s.moveTo(x+r,y); s.lineTo(x+w-r,y); s.quadraticCurveTo(x+w,y,x+w,y+r); s.lineTo(x+w,y+h-r); s.quadraticCurveTo(x+w,y+h,x+w-r,y+h); s.lineTo(x+r,y+h); s.quadraticCurveTo(x,y+h,x,y+h-r); s.lineTo(x,y+r); s.quadraticCurveTo(x,y,x+r,y); return s; }
function M(o){ const m=new THREE.MeshStandardMaterial(o); rigMats.push(m); return m; }

function buildRig(){
  const housing=M({color:0x23272c,metalness:.82,roughness:.33}), steel=M({color:0x9aa1a8,metalness:1,roughness:.3}), cell=M({color:0xb7bdc4,metalness:1,roughness:.4}),
        chrome=M({color:0xd6dbe0,metalness:1,roughness:.12}), paint=M({color:0x1c2024,metalness:.3,roughness:.68}), dark=M({color:0x111315,metalness:.4,roughness:.6});
  const hg=new THREE.ExtrudeGeometry(rrect(62,44,4),{depth:38,bevelEnabled:true,bevelThickness:1.4,bevelSize:1.4,bevelSegments:3,curveSegments:6}); hg.translate(0,0,-19);
  const bolt=new THREE.CylinderGeometry(3.3,3.3,2.4,6); bolt.rotateX(Math.PI/2);
  const seam=new THREE.BoxGeometry(56,.7,.6);
  function grip(){ const g=new THREE.Group(); g.add(new THREE.Mesh(hg,housing));
    for(const [x,y] of [[-22,12],[22,12],[-22,-12],[22,-12]]){ const b=new THREE.Mesh(bolt,steel); b.position.set(x,y,20.6); g.add(b); }
    const sm=new THREE.Mesh(seam,dark); sm.position.set(0,0,20.4); g.add(sm); return g; }
  const top=new THREE.Group(), bot=new THREE.Group(), frame=new THREE.Group();
  const gt=grip(); gt.position.y=79; top.add(gt);
  const a1=new THREE.Mesh(new THREE.CylinderGeometry(8,8,12,32),steel); a1.position.y=107; top.add(a1);
  const lc=new THREE.Mesh(new THREE.CylinderGeometry(20,20,24,64),cell); lc.position.y=125; top.add(lc);
  const lcb=new THREE.Mesh(new THREE.CylinderGeometry(20.4,20.4,2,64),dark); lcb.position.y=125; top.add(lcb);
  const a2=new THREE.Mesh(new THREE.CylinderGeometry(8,8,8,32),steel); a2.position.y=141; top.add(a2);
  const beamG=new THREE.BoxGeometry(400,26,70); const beam=new THREE.Mesh(beamG,paint); beam.position.y=158; top.add(beam);
  const gb=grip(); gb.position.y=-79; bot.add(gb);
  const a3=new THREE.Mesh(new THREE.CylinderGeometry(8,8,14,32),steel); a3.position.y=-108; bot.add(a3);
  const base=new THREE.Mesh(beamG,paint); base.position.y=-128; bot.add(base);
  const colG=new THREE.CylinderGeometry(9,9,1300,48);
  for(const x of [-175,175]){ const c=new THREE.Mesh(colG,chrome); c.position.set(x,360,0); frame.add(c); }
  const g=new THREE.Group(); g.add(top,bot,frame); return {g,top,bot,frame};
}

function buildFlakes(){
  const N=1100, ND=80;
  const fm=new THREE.MeshStandardMaterial({roughness:.6,metalness:0}); const fl=new THREE.InstancedMesh(new THREE.BoxGeometry(1,1,1),fm,N);
  const dm=new THREE.MeshStandardMaterial({color:0xc98a2e,roughness:.45,metalness:0}); const dr=new THREE.InstancedMesh(new THREE.IcosahedronGeometry(1,1),dm,ND);
  let sd=11; const r=()=>{sd=(sd*16807)%2147483647;return (sd-1)/2147483646;};
  const pal=[0x2b2f34,0x3a3f45,0x5c636a,0x7a8189,0x9aa0a6,0x4a5056,0x3a4f5e,0x4f5d44,0x6a5444,0xc8c2b4];
  function mk(n,isDrop){ const D=[]; for(let i=0;i<n;i++){
      const s=-85+170*r(), w=w0(s)*.92, tx=(r()*2-1)*w, tz=(r()*2-1)*1.6;
      const th=r()*6.283, rad=55+r()*150, sx=Math.cos(th)*rad, sz=-60+Math.sin(th)*rad*.8, sy=(r()*2-1)*260 + s*.6;
      const sw=th+1.2, cx=Math.cos(sw)*rad*.55, cz=Math.sin(sw)*rad*.45, cy=sy*.4+s*.4;
      const sc= isDrop? [1.3+r()*1.4] : [1.4+r()*3.2,.45+r()*.4,1.2+r()*2.6];
      D.push({t:[tx,s,tz],s0:[sx,sy,sz],c:[cx,cy,cz],sc,del:.05+.42*r()*.7+.3*(s+85)/170*.6,rot:[r()*6.3,r()*6.3,r()*6.3],spin:[(r()-.5)*7,(r()-.5)*7,(r()-.5)*7]});
      if(!isDrop) fl.setColorAt(i,new THREE.Color(pal[(r()*pal.length)|0]).convertSRGBToLinear()); }
    return D; }
  const FD=mk(N,false), DD=mk(ND,true); fl.instanceColor.needsUpdate=true; fl.frustumCulled=dr.frustumCulled=false;
  return {fl,dr,FD,DD};
}

function buildShards(){
  const n=26, m=new THREE.InstancedMesh(new THREE.TetrahedronGeometry(1),new THREE.MeshStandardMaterial({color:0x4b5157,roughness:.5}),n);
  let sd=5; const r=()=>{sd=(sd*16807)%2147483647;return (sd-1)/2147483646;};
  const D=[]; for(let i=0;i<n;i++) D.push({p:[(r()*2-1)*4.5,(r()-.5)*1.5,(r()*2-1)*2],v:[(r()*2-1)*90,30+r()*110,40+r()*170],s:.5+r()*1.4,w:[(r()-.5)*24,(r()-.5)*24,(r()-.5)*24]});
  m.frustumCulled=false; m.visible=false; return {m,D};
}

function initGL(){
  if(typeof THREE==='undefined') throw new Error('three missing');
  const cv=$('gl');
  R=new THREE.WebGLRenderer({canvas:cv,antialias:true,alpha:true,powerPreference:'high-performance'});
  R.setPixelRatio(Math.min(devicePixelRatio||1,isMobile?1.6:1.75));
  R.outputEncoding=THREE.sRGBEncoding; R.toneMapping=THREE.ACESFilmicToneMapping; R.toneMappingExposure=1.05; R.setClearColor(0x000000,0);
  scene=new THREE.Scene();
  cam=new THREE.PerspectiveCamera(28,1,5,8000);
  // studio environment: softboxes and rim strips, prefiltered once
  const pm=new THREE.PMREMGenerator(R), env=new THREE.Scene();
  env.add(new THREE.Mesh(new THREE.BoxGeometry(100,100,100),new THREE.MeshBasicMaterial({color:0x121417,side:THREE.BackSide})));
  const panel=(w,h,x,y,z,k,col)=>{ const m=new THREE.Mesh(new THREE.PlaneGeometry(w,h),new THREE.MeshBasicMaterial({color:new THREE.Color(col).multiplyScalar(k),side:THREE.DoubleSide})); m.position.set(x,y,z); m.lookAt(0,0,0); env.add(m); };
  panel(46,16,-22,30,26,7,0xffffff); panel(5,70,38,0,-12,5,0xdfe7ff); panel(5,70,-38,4,-16,3.2,0xffffff); panel(70,10,0,-42,18,.8,0xffe0b0); panel(30,30,10,10,45,.9,0xffffff);
  scene.environment=pm.fromScene(env,.02).texture; pm.dispose();
  keyL=new THREE.DirectionalLight(0xffffff,.9); keyL.position.set(-1,1.3,1.5); scene.add(keyL);
  warmL=new THREE.DirectionalLight(0xffb45a,0); warmL.position.set(1.2,.3,-1); scene.add(warmL);
  tex=makeTexture();
  const mA=makeSpecimenMaterial(), cA=makeSpecimenMaterial(); cA.side=THREE.DoubleSide;
  A=new Specimen(mA,cA,6.5);
  B=new Specimen(makeSpecimenMaterial(),null,null);
  rig=buildRig(); scene.add(rig.g, A.group, B.group);
  flakes=buildFlakes(); scene.add(flakes.fl, flakes.dr);
  shards=buildShards(); scene.add(shards.m);
}

/* ---------- per-frame scene update ---------- */
const O3=window.THREE?new THREE.Object3D():null;
let lastA='', lastB='', breakT=-1, prevP=0;
function bez(a,b,c,t,i){ const u=1-t; return u*u*a[i]+2*u*t*b[i]+t*t*c[i]; }
function updateScene(st,now){
  const p=st.p, tb= breakT>0 ? (now-breakT)/1000 : 99;
  // fracture recoil (time-based so the snap always has real speed)
  const wob = (st.broken && tb<2 && !reduce) ? 1.6*Math.exp(-5.5*tb)*Math.sin(42*tb) : 0;
  // without Therpol
  const aVis = p<.38 ? 1-st.aOut : st.cmp;
  A.setOpacity(aVis);
  if(A.group.visible){ const key=st.dA.toFixed(4)+'|'+st.gap.toFixed(3)+'|'+st.craze.toFixed(3)+'|'+wob.toFixed(4)+'|'+st.broken; if(key!==lastA){ A.deform(st.dA,false,st.craze,st.gap,wob); lastA=key; } }
  A.group.position.set(lerp(0,-SEP(),st.cmp), p<.38 ? -7*eIn(st.aOut) : 0, 0);
  A.caps.forEach(m=>m.visible=st.broken);
  // with Therpol
  B.setOpacity(st.bIn);
  if(B.group.visible){ const key=st.dB.toFixed(4); if(key!==lastB){ B.deform(st.dB,true,0,0,0); lastB=key; } }
  B.group.position.x=lerp(0,SEP(),st.cmp);
  // rig: crosshead travel, fade out for the comparison
  rig.top.position.y=st.cross; rig.top.position.x=0;
  const ro=1-st.cmp; rigMats.forEach(m=>{ m.opacity=ro; m.transparent=ro<.999; m.depthWrite=ro>.5; }); rig.g.visible=ro>.003;
  warmL.intensity = st.phaseB ? .9*sstep(.47,.6,p)*(1-st.cmp*.5) : 0;
  // flakes assemble into the new bar
  const fv=st.mix>0 && st.bIn<1; flakes.fl.visible=flakes.dr.visible=fv;
  if(fv){ const q=st.mix, shrink=1-st.bIn, t1=now/1000;
    const put=(D,mesh)=>{ for(let i=0;i<D.length;i++){ const d=D[i], t=eIO(clamp((q-d.del)/.5,0,1)), u=1-t;
        O3.position.set(bez(d.s0,d.c,d.t,t,0),bez(d.s0,d.c,d.t,t,1),bez(d.s0,d.c,d.t,t,2));
        O3.rotation.set(d.rot[0]*u+d.spin[0]*u*(reduce?0:t1*.15),d.rot[1]*u,d.rot[2]*u);
        const k=sstep(0,.18,t)*shrink;
        if(d.sc.length===1) O3.scale.setScalar(d.sc[0]*k); else O3.scale.set(d.sc[0]*k,d.sc[1]*k,d.sc[2]*k);
        O3.updateMatrix(); mesh.setMatrixAt(i,O3.matrix); } mesh.instanceMatrix.needsUpdate=true; };
    put(flakes.FD,flakes.fl); put(flakes.DD,flakes.dr); }
  // shards
  const sv=st.broken && tb<1.6 && p<.33; shards.m.visible=sv;
  if(sv){ const yC=A.Y[A.iS]; shards.D.forEach((d,i)=>{ const t=tb; O3.position.set(d.p[0]+d.v[0]*t, yC+d.p[1]+d.v[1]*t-450*t*t, d.p[2]+d.v[2]*t); O3.rotation.set(d.w[0]*t,d.w[1]*t,d.w[2]*t); O3.scale.setScalar(d.s*(1-sstep(1,1.6,t))); O3.updateMatrix(); shards.m.setMatrixAt(i,O3.matrix); }); shards.m.instanceMatrix.needsUpdate=true; }
  // camera
  let H = p<.47 ? camH(p) : 345+st.dB*1.3, ty = p<.47 ? camTy(p) : st.dB/2;
  H=lerp(H,470,st.cmp); ty=lerp(ty,48,st.cmp);
  if(isMobile) H*=1.6+.3*st.cmp;
  const az=(camAz(p)+(reduce?0:.8*Math.sin(now/4000)))*Math.PI/180, el=(camEl(p)+(reduce?0:.5*Math.sin(now/5300)))*Math.PI/180;
  const dist=H/(2*Math.tan(14*Math.PI/180));
  const shake=(st.broken && tb<.4 && !reduce)? 1.4*Math.exp(-12*tb)*Math.sin(80*tb):0;
  cam.position.set(Math.sin(az)*Math.cos(el)*dist+shake, ty+Math.sin(el)*dist, Math.cos(az)*Math.cos(el)*dist);
  cam.lookAt(0,ty,0);
}

/* ---------- live plot ---------- */
const cv=$('cv'), cx=cv.getContext('2d'); let CW=0,CH=0,DPR=1, xs=4.6;
function sizeChart(){ DPR=Math.min(2,devicePixelRatio||1); CW=cv.clientWidth; CH=cv.clientHeight; cv.width=Math.round(CW*DPR); cv.height=Math.round(CH*DPR); }
function nice(v){ const e=Math.pow(10,Math.floor(Math.log10(v))), f=v/e; return (f<1.5?1:f<3.5?2:f<7.5?5:10)*e; }
function drawChart(st,dt,now){
  const xt=st.dB>0?Math.max(4.6,st.dB*1.1):4.6; xs+= (xt-xs)*(reduce?1:1-Math.exp(-dt*5));
  cx.setTransform(DPR,0,0,DPR,0,0); cx.clearRect(0,0,CW,CH);
  const L=16,Rm=6,T=6,Bm=16,W=CW-L-Rm,H=CH-T-Bm, X=d=>L+d/xs*W, Y=s=>T+H*(1-s/1.08);
  const small=CW<260;
  // grid: minor/major like test software; spacing re-flows as the axis rescales
  cx.lineWidth=1;
  for(let k=1;k<=10;k++){ const y=Math.round(Y(k*.1))+.5; cx.strokeStyle= k%5===0?'rgba(255,255,255,.09)':'rgba(255,255,255,.04)'; cx.beginPath(); cx.moveTo(L,y); cx.lineTo(L+W,y); cx.stroke(); }
  const stp=nice(xs/7); for(let v=stp/2;v<xs;v+=stp/2){ const x=Math.round(X(v))+.5, maj=Math.abs(v/stp-Math.round(v/stp))<1e-6; cx.strokeStyle=maj?'rgba(255,255,255,.09)':'rgba(255,255,255,.04)'; cx.beginPath(); cx.moveTo(x,T); cx.lineTo(x,T+H); cx.stroke(); }
  cx.strokeStyle='rgba(255,255,255,.35)'; cx.beginPath(); cx.moveTo(L+.5,T); cx.lineTo(L+.5,T+H+.5); cx.lineTo(L+W,T+H+.5); cx.stroke();
  cx.fillStyle='#8a919a'; cx.font=(small?'8.5px ':'9.5px ')+getComputedStyle(document.body).getPropertyValue('--mono'); cx.textBaseline='alphabetic';
  cx.textAlign='right'; cx.fillText('STRAIN →',L+W,CH-3);
  cx.save(); cx.translate(10,T+H); cx.rotate(-Math.PI/2); cx.textAlign='left'; cx.fillText('STRESS →',0,0); cx.restore();
  const areaA=.07+.12*st.cmp, areaB=.08+.14*st.cmp;
  // without Therpol
  const dA=st.dA;
  if(dA>0){ const n=48; cx.beginPath(); cx.moveTo(X(0),Y(0)); for(let i=1;i<=n;i++){ const d=dA*i/n; cx.lineTo(X(d),Y(sigA(d))); }
    cx.lineTo(X(dA),Y(0)); cx.closePath(); cx.fillStyle=`rgba(170,177,185,${areaA})`; cx.fill();
    cx.beginPath(); cx.moveTo(X(0),Y(0)); for(let i=1;i<=n;i++){ const d=dA*i/n; cx.lineTo(X(d),Y(sigA(d))); } cx.strokeStyle='#aab1b9'; cx.lineWidth=small?1.5:2; cx.lineJoin='round'; cx.stroke(); }
  if(st.broken){ const x=X(DA), y=Y(sigA(DA)); cx.setLineDash([3,3]); cx.strokeStyle='rgba(255,107,74,.75)'; cx.lineWidth=1; cx.beginPath(); cx.moveTo(x,y); cx.lineTo(x,Y(0)); cx.stroke(); cx.setLineDash([]);
    const s=small?3.5:4.5; cx.strokeStyle='#ff6b4a'; cx.lineWidth=1.8; cx.beginPath(); cx.moveTo(x-s,y-s); cx.lineTo(x+s,y+s); cx.moveTo(x+s,y-s); cx.lineTo(x-s,y+s); cx.stroke();
    const lab=1-sstep(5,9,xs); if(lab>0 && !small){ cx.globalAlpha=lab; cx.fillStyle='#ff6b4a'; cx.textAlign='left'; cx.fillText('FRACTURE',x+8,y+3); cx.globalAlpha=1; } }
  // with Therpol
  const dB=st.dB;
  if(dB>0){ const n=Math.min(500,Math.max(40,Math.round(dB/.08))); const pts=[]; for(let i=0;i<=n;i++){ const d=dB*i/n; pts.push(X(d),Y(sigB(d))); }
    cx.beginPath(); cx.moveTo(pts[0],pts[1]); for(let i=2;i<pts.length;i+=2) cx.lineTo(pts[i],pts[i+1]); cx.lineTo(X(dB),Y(0)); cx.lineTo(X(0),Y(0)); cx.closePath();
    const gr=cx.createLinearGradient(0,T,0,T+H); gr.addColorStop(0,`rgba(233,162,59,${areaB*1.4})`); gr.addColorStop(1,`rgba(233,162,59,${areaB*.3})`); cx.fillStyle=gr; cx.fill();
    cx.beginPath(); cx.moveTo(pts[0],pts[1]); for(let i=2;i<pts.length;i+=2) cx.lineTo(pts[i],pts[i+1]);
    cx.strokeStyle='#e9a23b'; cx.lineWidth=small?1.8:2.4; cx.shadowColor='rgba(233,162,59,.55)'; cx.shadowBlur=8; cx.stroke(); cx.shadowBlur=0;
    if(st.cmp>0 && !small){ cx.globalAlpha=st.cmp; cx.fillStyle='#e9a23b'; cx.textAlign='center'; cx.fillText('ENERGY ABSORBED',X(dB*.55),Y(.42)); cx.globalAlpha=1; } }
  // live cursor on the active curve
  let cur=null;
  if(!st.broken && dA>0) cur=[X(dA),Y(sigA(dA)),'#cfd5db'];
  else if(dB>0 && st.cmp<1) cur=[X(dB),Y(sigB(dB)),'#e9a23b'];
  if(cur){ const [x,y,c]=cur, k=1-st.cmp; cx.globalAlpha=k; cx.setLineDash([2,3]); cx.strokeStyle='rgba(255,255,255,.22)'; cx.lineWidth=1; cx.beginPath(); cx.moveTo(L,y); cx.lineTo(x,y); cx.lineTo(x,T+H); cx.stroke(); cx.setLineDash([]);
    const pul=reduce?0:(Math.sin(now/180)+1)/2; cx.fillStyle=c; cx.beginPath(); cx.arc(x,y,small?2.6:3.2,0,6.283); cx.fill(); cx.strokeStyle=c; cx.globalAlpha=k*(.5-.4*pul); cx.beginPath(); cx.arc(x,y,(small?5:6)+pul*4,0,6.283); cx.stroke(); cx.globalAlpha=1; }
}

/* ---------- copy, rail, instrument ---------- */
function stateLabel(st){
  const p=st.p;
  if(p<.07) return ['TEST 01 · WITHOUT THERPOL','Specimen clamped · zero load',false];
  if(!st.broken) return ['TEST 01 · WITHOUT THERPOL', st.craze>.15?'Crazing':'Elastic loading',false];
  if(p<.33) return ['TEST 01 · WITHOUT THERPOL','Fracture · test ended',false];
  if(p<.47) return ['NEW SPECIMEN','Same recycled base + Therpol',true];
  if(p>=.80) return ['COMPARISON','Same base, same test',true];
  const d=st.dB; return ['TEST 02 · WITH THERPOL', d<2.6?'Elastic loading': d<6?'Yield': d<15?'Necking': p>.79?'Still drawing':'Cold drawing · neck travelling',true];
}
let lastLab='';
function updateUI(st){
  const p=st.p;
  for(const c of chs){
    const inT= c.a===0?1:seg(p,c.a,c.a+.02), outT= seg(p,c.b-.014,c.b);
    const vis= inT>0 && outT<1 && !(c.b<=.07 && p>=c.b);
    c.el.style.visibility=vis?'visible':'hidden'; if(!vis) continue;
    c.lines.forEach((l,i)=>{ const t=eOut(clamp(inT*1.35-i*.17,0,1)), o=eIn(outT); l.style.transform=`translate3d(0,${((1-t)*108-o*108).toFixed(2)}%,0)`; });
    const fo=eOut(clamp(inT*1.4-.3,0,1))*(1-outT); c.fd.forEach(f=>{ f.style.opacity=fo.toFixed(3); f.style.transform=`translate3d(0,${((1-fo)*10).toFixed(2)}px,0)`; });
  }
  RAIL.forEach(([a,b],i)=>{ const t=seg(p,a,b); railFill[i].style.transform=`scaleX(${t.toFixed(4)})`; railEls[i].classList.toggle('on',p>=a&&p<b); });
  $('hint').style.opacity=(1-seg(p,0,.025)).toFixed(3);
  // instrument
  const [t,s,amber]=stateLabel(st), key=t+s; if(key!==lastLab){ $('itest').textContent=t; $('itest').classList.toggle('a',amber); $('istate').textContent=s; $('cst').textContent=s; lastLab=key; }
  const load= st.phaseB ? sigB(st.dB) : (st.broken? 0 : sigA(st.dA));
  $('mload').style.transform=`scaleX(${clamp(load,0,1).toFixed(3)})`; $('mload').className=st.phaseB?'a':'';
  $('mtrav').style.transform=`scaleX(${clamp(st.cross/(DMAX+5),0,1).toFixed(4)})`; $('mtrav').className=st.phaseB?'a':'';
  // routes
  const r=st.routes, ro=$('routes'); ro.style.opacity=r.toFixed(3); ro.style.visibility=r>0?'visible':'hidden'; ro.style.pointerEvents=r>.6?'auto':'none';
  cards.forEach((c,i)=>{ const t=eOut(clamp(r*1.6-i*.2,0,1)); c.style.opacity=t.toFixed(3); c.style.transform=`translate3d(0,${((1-t)*24).toFixed(1)}px,0)`; });
  const uo=1-r; $('rail').style.opacity=$('copy').style.opacity=uo.toFixed(3); $('chart').style.opacity=(uo*sstep(.045,.075,p)).toFixed(3); $('inst').style.opacity=(uo*(1-st.cmp)).toFixed(3);
}
const v3=window.THREE?new THREE.Vector3():null;
function placeLabels(st){
  const k=st.cmp*(1-st.routes);
  for(const [id,x,y] of isMobile?[['labA',-SEP(),-96],['labB',SEP(),-96]]:[['labA',-SEP(),A?A.Y[A.N-1]+st.gap+14:0],['labB',SEP(),B?B.Y[B.N-1]+14:0]]){
    const el=$(id); if(!R||k<=0){ el.style.opacity=0; continue; }
    v3.set(x,y,0).project(cam); const w=stage.clientWidth, h=stage.clientHeight;
    const sx=(v3.x*.5+.5)*w, sy=(-v3.y*.5+.5)*h; el.style.opacity=k.toFixed(3); el.style.transform=`translate3d(${sx.toFixed(1)}px,${sy.toFixed(1)}px,0) translate(-50%,${isMobile?'0':'-100%'})`;
  }
}

/* ---------- sizing ---------- */
function resize(){
  isMobile=innerWidth<=760; sizeChart();
  if(!R) return; const w=stage.clientWidth, h=stage.clientHeight;
  R.setPixelRatio(Math.min(devicePixelRatio||1,isMobile?1.6:1.75)); R.setSize(w,h,false); cam.aspect=w/h;
  // frame the rig right of the copy on desktop; above the copy on phones
  if(isMobile) cam.setViewOffset(w,h,Math.round(w*.17),Math.round(h*.13),w,h); else cam.setViewOffset(w,h,-Math.round(w*.15),0,w,h);
  cam.updateProjectionMatrix();
}

/* ---------- loop ---------- */
let cur=0, last=performance.now(), started=false;
function progress(){ const m=track.offsetHeight-innerHeight; return m>0?clamp(scrollY/m,0,1):0; }
function frame(now){
  const dt=Math.min(.05,(now-last)/1000); last=now;
  const tgt=progress();
  cur += (tgt-cur)*(reduce?1:1-Math.exp(-dt*6.5)); if(Math.abs(tgt-cur)<1e-5) cur=tgt;
  if(cur>=BRK && prevP<BRK) breakT=now; if(cur<BRK) breakT=-1; prevP=cur;
  const st=stateAt(cur);
  if(R){ updateScene(st,now); R.render(scene,cam); if(!started){ started=true; $('ld').style.opacity=0; } }
  updateUI(st); drawChart(st,dt,now); placeLabels(st);
  requestAnimationFrame(frame);
}
try{ initGL(); }catch(e){ R=null; document.body.classList.add('nogl'); $('ld').textContent='THIS VIEW NEEDS WEBGL · THE TEST PLOT STILL RUNS'; }
addEventListener('resize',resize); resize();
requestAnimationFrame(t=>{ last=t; frame(t); });

/* CTAs */
document.querySelectorAll('.cta').forEach(b=>b.addEventListener('click',()=>{ $('done').textContent='On the live site this opens the '+b.textContent.trim().toLowerCase()+' form, routed to the Therpol sales team.'; if(progress()<.88){ const m=track.offsetHeight-innerHeight; scrollTo({top:m,behavior:reduce?'auto':'smooth'}); } }));
$('back').addEventListener('click',()=>scrollTo({top:0,behavior:reduce?'auto':'smooth'}));
window.__therpol={stateAt,get cur(){return cur;},set cur(v){cur=v;}};
})();
