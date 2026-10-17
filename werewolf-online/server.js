'use strict';
const http=require('http'),fs=require('fs'),path=require('path'),crypto=require('crypto');
const {ABIL,PRI,DEF,EXTRA}=require('./roles');
const rooms=new Map();
let RM,G; // ห้อง/เกมปัจจุบันที่กำลังประมวลผล (handler ทำงานแบบ synchronous จึงปลอดภัย)
const R=id=>DEF.concat(EXTRA,RM.custom).find(r=>r.id===id)||DEF[0];
const isW=r=>(r.t==='w'&&!r.a.includes('looksVillage'))||r.a.includes('looksWolf');
const shuf=a=>{for(let i=a.length-1;i>0;i--){const j=Math.floor(Math.random()*(i+1));[a[i],a[j]]=[a[j],a[i]]}return a};
const sl=()=>(G.sil||[]).filter(i=>G.p[i].alive);
const alive=()=>G.p.map((p,i)=>i).filter(i=>G.p[i].alive);

/* ---------- เริ่มเกม ---------- */
function startGame(){
 const nm=RM.players,ids=[];
 for(const id in RM.cnt)for(let i=0;i<RM.cnt[id];i++)ids.push(id);
 if(nm.length<3)return 'ต้องมีผู้เล่นอย่างน้อย 3 คน';
 if(ids.length!==nm.length)return `จำนวนบทบาท (${ids.length}) ต้องเท่ากับจำนวนผู้เล่น (${nm.length})`;
 if(!ids.some(i=>R(i).t==='w'))return 'ต้องมีบทบาทฝ่ายหมาป่าอย่างน้อย 1';
 shuf(ids);
 G=RM.g={p:nm.map((x,i)=>({name:x.name,role:ids[i],alive:true,log:[]})),used:{},n:0,rq:[],dn:[],cur:[]};
 RM.phase='role';
}

/* ---------- กลางคืน (ขั้นที่ลำดับความสำคัญเท่ากันทำพร้อมกัน) ---------- */
function night(){
 G.n++;G.t={prot:[],wolf:[],kills:[],saves:[],pois:[],blk:[],sil:[],l1:null,rv:[],cv:null};
 const st=[],dw=G.p.some(x=>!x.alive&&R(x.role).t==='w');
 G.p.forEach(p=>{p.note=null;if(!p.alive)return;const r=R(p.role);
  if(r.t==='w'&&!r.a.includes('minion')&&G.woff!==G.n)st.push({p,t:'wolf',o:2});
  r.a.forEach(a=>{const b=a==='bigbad'?'kill':a;if(b in PRI&&!(a==='bigbad'&&(dw||G.woff===G.n)))st.push({p,t:b,o:PRI[b]})})});
 const os=[...new Set(st.map(s=>s.o))].sort((a,b)=>a-b);
 G.groups=os.map(o=>st.filter(s=>s.o===o));G.gi=-1;G.cur=[];
 RM.phase='night';nextGroup();
}
function nextGroup(){
 while(++G.gi<G.groups.length){
  G.cur=[];
  for(const s of G.groups[G.gi]){
   const me=G.p.indexOf(s.p);
   if(['heal','poison','link','convert'].includes(s.t)&&G.used[me+s.t])continue;
   if(G.t.blk.includes(me)&&s.t!=='block'){s.p.note='🕸️ คืนนี้คุณถูกบล็อก ใช้ความสามารถไม่ได้';if(s.t==='wolf')s.p.fresh=0;continue}
   G.cur.push({s,done:false});
  }
  if(G.cur.length)return;
 }
 dawn();
}
const mine=pi=>G.cur.find(c=>!c.done&&c.s.p===G.p[pi]);
function wv(){
 const T=G.t;if(T.wv!==undefined)return T.wv;
 const c={};T.wolf.forEach(i=>c[i]=(c[i]||0)+1);
 const m=Math.max(0,...Object.values(c)),top=Object.keys(c).filter(k=>c[k]===m);
 return T.wv=top.length?+top[Math.floor(Math.random()*top.length)]:null;
}
const targets=(s,pi)=>alive().filter(i=>s.t==='wolf'||s.t==='convert'?R(G.p[i].role).t!=='w':s.t==='link'||s.t==='protect'?true:i!==pi);
function promptOf(pi){
 const c=mine(pi);if(!c)return null;const s=c.s;
 if(s.t==='heal')return{k:'heal',v:wv()};
 const L={convert:'🐺 เลือกคนที่จะเปลี่ยนเป็นหมาป่า',inspectAura:'🌈 เลือกคนที่จะตรวจออร่า',reveal:'📢 เลือกคนที่คิดว่าเป็นหมาป่า',block:'🕸️ เลือกคนที่จะบล็อก',silence:'🤐 เลือกคนที่จะปิดปาก',inspectRole:'🔎 เลือกคนที่จะตรวจบทบาท',link:'💘 เลือกคู่รักคนที่ 1',protect:'🛡️ เลือกคนที่จะปกป้อง',wolf:'🐺 เลือกเหยื่อ'+(G.dbl===G.n?' (คืนนี้ได้ 2 ศพ: เสียงรองคือเหยื่อที่สอง)':''),kill:'🔪 เลือกเหยื่อ',poison:'☠️ เลือกคนที่จะวางยาพิษ',inspect:'🔮 เลือกคนที่จะตรวจ'};
 const o={k:s.t,title:L[s.t],t:targets(s,pi)};
 if(s.t==='link')o.title2='💘 เลือกคู่รักคนที่ 2';
 if(s.t==='wolf'&&s.p.fresh)o.fresh=G.p.filter(x=>x!==s.p&&R(x.role).t==='w').map(x=>x.name).join(', ')||'ไม่มี';
 return o;
}
function pick(pi,b){
 const c=mine(pi);if(!c)return;const s=c.s,T=G.t,p=G.p[pi];
 if(b.skip)c.done=true;
 else{
  let i=b.i,m='เรียบร้อย';
  if(s.t==='heal'){if(i==null||i!==wv())return;T.saves.push(i);G.used[pi+'heal']=1}
  else if(s.t==='link'){if(!Array.isArray(i)||i.length!==2||i[0]===i[1]||!i.every(x=>targets(s,pi).includes(x)))return;G.lk=i;G.used[pi+'link']=1;m='💘 จับคู่เรียบร้อย'}
  else{
   if(!targets(s,pi).includes(i))return;
   const q=G.p[i],r=R(q.role);
   if(s.t==='protect')T.prot.push(i);
   else if(s.t==='wolf')T.wolf.push(i);
   else if(s.t==='block')T.blk.push(i);
   else if(s.t==='convert'){T.cv=i;G.used[pi+'convert']=1}
   else if(s.t==='reveal'){T.rv.push(isW(r)?i:pi);m=isW(r)?'🎯 คุณเดาถูก!':'💀 คุณเดาผิด...'}
   else if(s.t==='silence')T.sil.push(i);
   else if(s.t==='kill')T.kills.push(i);
   else if(s.t==='poison'){T.pois.push(i);G.used[pi+'poison']=1}
   else if(s.t==='inspectAura')m=`${q.name}\n${r.a.length||r.t!=='v'?'✨ มีออร่าพิเศษ':'⚪ ชาวบ้านธรรมดา'}`;
   else if(s.t==='inspectRole')m=`${q.name} คือ\n${r.e} ${r.n}`;
   else if(s.t==='inspect')m=`${q.name} เป็น\n${isW(r)?'🐺 ฝ่ายหมาป่า':'✅ ไม่ใช่หมาป่า'}`;
  }
  c.done=true;p.note=m;
  if(s.t.startsWith('inspect'))p.log.push(`คืน ${G.n}: ${m.replace(/\n/g,' ')}`);
 }
 if(s.t==='wolf')p.fresh=0;
 if(G.cur.every(x=>x.done))nextGroup();
}

/* ---------- เช้า ---------- */
function atk(i,why){const p=G.p[i];if(p.alive&&R(p.role).a.includes('tough')&&!G.used[i+'tough']){G.used[i+'tough']=1;return}die(i,why)}
function die(i,why){
 const p=G.p[i];if(!p.alive)return;
 p.alive=false;G.dn.push({i,why});
 if(R(p.role).a.includes('revenge'))G.rq.push(i);
 if(R(p.role).a.includes('cub'))G.dbl=G.n+1;
 if(G.lk&&G.lk.includes(i))die(G.lk.find(k=>k!==i),'ตายตามคนรัก');
 if(R(p.role).a.includes('takeone')){const al=alive();if(al.length)die(al[Math.floor(Math.random()*al.length)],'ถูกระเบิดพลีชีพ')}
}
const show=(title,deaths,cb,o)=>{G.res=Object.assign({title,deaths:deaths.slice(),cb},o);RM.phase='result'};
function dawn(){
 const T=G.t,v=wv();G.dn=[];
 const safe=i=>T.prot.includes(i)||T.saves.includes(i);
 if(v!=null&&!safe(v)){if(R(G.p[v].role).a.includes('cursed')){G.p[v].role='wolf';G.p[v].fresh=1}else{atk(v,'ถูกหมาป่าฆ่า');if(!G.p[v].alive&&R(G.p[v].role).a.includes('diseased'))G.woff=G.n+1}}
 if(G.dbl===G.n){const c={};T.wolf.forEach(i=>{if(i!==v)c[i]=(c[i]||0)+1});const k=Object.keys(c).sort((a,b)=>c[b]-c[a])[0];if(k!=null&&!safe(+k))atk(+k,'ถูกหมาป่าฆ่า')}
 T.kills.forEach(i=>{if(!safe(i))atk(i,'ถูกฆ่าตาย')});
 T.pois.forEach(i=>atk(i,'ถูกวางยาพิษ'));
 G.sil=T.sil;
 T.rv.forEach(i=>die(i,'ตายจากการเปิดโปง'));
 if(T.cv!=null&&G.p[T.cv].alive&&R(G.p[T.cv].role).t!=='w'){G.p[T.cv].role='wolf';G.p[T.cv].fresh=1}
 show('☀️ เช้าวันใหม่',G.dn,'day',{none:'🕊️ คืนนี้ไม่มีใครตาย'});
}
function aft(cb){
 if(G.rq.length){G.cb=cb;G.rev=G.rq.shift();RM.phase='rev';return}
 const w=G.tan?'t':win();
 if(w){G.winner=w;RM.phase='end'}else cb==='day'?(RM.phase='day'):night();
}
function revShoot(k){G.dn=[];die(k,'ถูกยิงแก้แค้น');show(`🏹 ${G.p[G.rev].name} ยิงแก้แค้น`,G.dn,G.cb)}

/* ---------- โหวต ---------- */
function vstart(){
 G.vl=alive();G.vv=G.vl.filter(i=>!sl().includes(i));G.vote={};RM.phase='vote';
 if(!G.vv.length)tally();
}
function castVote(pi,t){
 G.vote[pi]=t;
 if(G.vv.every(i=>i in G.vote))tally();
}
function tally(){
 const vc={};for(const v in G.vote){const t=G.vote[v];if(t>=0)vc[t]=(vc[t]||0)+(R(G.p[v].role).a.includes('mayor')?2:1)}
 const e=Object.entries(vc).sort((a,b)=>b[1]-a[1]);G.dn=[];
 let msg='⚖️ คะแนนเสมอ ไม่มีใครถูกประหาร';
 if(e.length&&(e.length===1||e[0][1]>e[1][1])){
  const t=+e[0][0];
  if(R(G.p[t].role).a.includes('noexec')&&!G.used[t+'noexec']){G.used[t+'noexec']=1;msg=`🕊️ ${G.p[t].name} รอดจากการประหาร!`}
  else{die(t,'ถูกประหารโดยการโหวต');if(R(G.p[t].role).a.includes('tanner'))G.tan=1;msg=null}
 }
 show('ผลโหวต',G.dn,'night',{tally:e.map(([i,c])=>({name:G.p[i].name,c})),msg});
}
function win(){
 const a=G.p.filter(x=>x.alive),w=a.filter(x=>R(x.role).t==='w').length,n=a.filter(x=>R(x.role).t==='n'&&R(x.role).a.includes('kill')).length,v=a.length-w-n;
 if(!a.length)return 'd';
 if(w===0&&n===0)return 'v';
 if(w===0&&(v===0||a.length<=2))return 'n';
 if(n===0&&w>=v)return 'w';
 return null;
}

/* ---------- มุมมองของผู้เล่นแต่ละคน (ไม่ส่งข้อมูลลับของคนอื่น) ---------- */
function waitList(){
 const ph=RM.phase;
 if(ph==='role')return G.p.map((p,i)=>i).filter(i=>!G.p[i].ready);
 if(ph==='night')return[...new Set(G.cur.filter(c=>!c.done).map(c=>G.p.indexOf(c.s.p)))];
 if(ph==='vote')return G.vv.filter(i=>!(i in G.vote));
 if(ph==='rev')return[G.rev];
 return[];
}
function view(room,pi){
 RM=room;G=room.g;const ph=room.phase;
 const v={code:room.code,you:pi,host:room.host===pi,phase:ph,players:room.players.map((p,i)=>({name:p.name,on:!!p.res,alive:G?G.p[i].alive:true}))};
 if(ph==='lobby'){Object.assign(v,{roles:DEF.concat(EXTRA,room.custom),cnt:room.cnt,rev:room.rev,abil:ABIL});return v}
 const gp=G.p[pi],r=R(gp.role),rv=x=>{const q=R(x.role);return{e:q.e,n:q.n,t:q.t}};
 v.n=G.n;v.dead=!gp.alive;v.note=gp.note||null;v.log=gp.log;
 v.role=Object.assign({},r,{ab:r.a.map(a=>ABIL[a])});
 const nm=f=>G.p.filter(x=>x!==gp&&f(R(x.role))).map(x=>x.name).join(', ')||'ไม่มี';
 v.mates=r.t==='w'?'🐺 พวกเดียวกัน: '+nm(q=>q.t==='w'&&!q.a.includes('minion')):r.a.includes('mason')?'🧱 เมสันด้วยกัน: '+nm(q=>q.a.includes('mason')):null;
 v.players.forEach((p,i)=>{if(ph==='end'||(!G.p[i].alive&&room.rev))p.role=rv(G.p[i])});
 if(ph==='role')v.ready=!!gp.ready;
 else if(ph==='night'){v.prompt=promptOf(pi);v.woff=G.woff===G.n}
 else if(ph==='result')v.res=Object.assign({},G.res,{deaths:G.res.deaths.map(d=>({name:G.p[d.i].name,why:d.why,role:room.rev?rv(G.p[d.i]):null}))});
 else if(ph==='rev'){v.revName=G.p[G.rev].name;if(pi===G.rev)v.prompt={k:'rev',title:'🏹 เลือกคนที่จะยิง',t:alive()}}
 else if(ph==='day')v.sil=sl().map(i=>G.p[i].name);
 else if(ph==='vote')v.vote={can:G.vv.includes(pi),mine:G.vote[pi],done:Object.keys(G.vote).length,total:G.vv.length,targets:G.vl};
 else if(ph==='end')v.winner=G.winner;
 if(v.host)v.wait=waitList();
 return v;
}
function broadcast(room){
 room.players.forEach((p,i)=>{if(p.res)try{p.res.write(`data: ${JSON.stringify(view(room,i))}\n\n`)}catch(e){console.error('broadcast',i,e)}});
}

/* ---------- คำสั่งจากผู้เล่น ---------- */
function act(room,pi,b){
 RM=room;G=room.g;const ph=room.phase,host=room.host===pi,NH='เฉพาะหัวหน้าห้องเท่านั้น';
 const ids=()=>DEF.concat(EXTRA,room.custom).map(r=>r.id);
 switch(b.type){
  case'chg':if(!host||ph!=='lobby')return NH;if(!ids().includes(b.id))return;room.cnt[b.id]=Math.max(0,Math.min(30,(room.cnt[b.id]||0)+(b.d>0?1:-1)));break;
  case'rev':if(!host||ph!=='lobby')return NH;room.rev=!!b.v;break;
  case'auto':{if(!host||ph!=='lobby')return NH;const n=room.players.length;if(n<3)return'ต้องมีผู้เล่นอย่างน้อย 3 คนก่อน';
   const w=Math.max(1,Math.round(n/4)),c={wolf:w};if(n>=5)c.seer=1;if(n>=6)c.doctor=1;
   c.villager=n-Object.values(c).reduce((a,x)=>a+x,0);room.cnt=c;break}
  case'addRole':{if(!host||ph!=='lobby')return NH;if(room.custom.length>=30)return'สร้างได้สูงสุด 30 บทบาท';
   const n=String(b.n||'').trim().slice(0,20);if(!n)return'ใส่ชื่อบทบาทก่อน';
   room.custom.push({id:'c'+Date.now(),n,e:String(b.e||'⭐').slice(0,4),t:['v','w','n'].includes(b.t)?b.t:'v',a:(Array.isArray(b.a)?b.a:[]).filter(a=>a in ABIL),d:String(b.d||'').trim().slice(0,200)||'บทบาทที่สร้างเอง'});break}
  case'delRole':if(!host||ph!=='lobby')return NH;room.custom=room.custom.filter(r=>r.id!==b.id);delete room.cnt[b.id];break;
  case'start':case'again':{if(!host)return NH;if(b.type==='start'?ph!=='lobby':ph!=='end')return;return startGame()}
  case'toLobby':if(!host||ph!=='end')return NH;room.phase='lobby';room.g=null;break;
  case'ready':if(ph!=='role')return;G.p[pi].ready=true;if(G.p.every(p=>p.ready))night();break;
  case'pick':case'skip':{
   const skip=b.type==='skip';
   if(ph==='night')pick(pi,skip?{skip:1}:{i:b.i});
   else if(ph==='rev'&&pi===G.rev){if(skip)aft(G.cb);else if(alive().includes(b.i))revShoot(b.i)}
   break}
  case'next':if(!host)return NH;if(ph==='result')aft(G.res.cb);break;
  case'startVote':if(!host)return NH;if(ph==='day')vstart();break;
  case'vote':if(ph!=='vote'||!G.vv.includes(pi))return;if(b.i===-1||(G.vl.includes(b.i)&&b.i!==pi))castVote(pi,b.i);break;
  case'force':{ // หัวหน้าห้องข้ามให้คนที่หลุด/ค้าง
   if(!host)return NH;const i=b.i;if(!waitList().includes(i))return;
   if(ph==='role'){G.p[i].ready=true;if(G.p.every(p=>p.ready))night()}
   else if(ph==='night')while(mine(i)&&RM.phase==='night')pick(i,{skip:1});
   else if(ph==='vote')castVote(i,-1);
   else if(ph==='rev')aft(G.cb);
   break}
 }
}

/* ---------- HTTP ---------- */
const send=(res,code,o)=>{res.writeHead(code,{'Content-Type':'application/json'});res.end(JSON.stringify(o))};
const clean=s=>String(s||'').replace(/\s+/g,' ').trim().slice(0,20);
const find=(code,token)=>{const room=rooms.get(String(code||'').toUpperCase());if(!room)return[];const pi=room.players.findIndex(p=>p.token===token);return pi<0?[]:[room,pi]};
const newCode=()=>{let c;do{c=Array.from({length:4},()=>'ABCDEFGHJKMNPQRSTUVWXYZ'[crypto.randomInt(23)]).join('')}while(rooms.has(c));return c};
const mkPlayer=name=>({name,token:crypto.randomBytes(12).toString('hex'),res:null});
const FILES={'/':['index.html','text/html; charset=utf-8'],'/client.js':['client.js','text/javascript; charset=utf-8']};

http.createServer((req,res)=>{
 const u=new URL(req.url,'http://x');
 if(req.method==='GET'&&u.pathname==='/api/events'){
  const [room,pi]=find(u.searchParams.get('code'),u.searchParams.get('token'));
  if(!room){res.writeHead(404);return res.end()}
  const p=room.players[pi];if(p.res)try{p.res.end()}catch(e){}
  res.writeHead(200,{'Content-Type':'text/event-stream','Cache-Control':'no-cache','Connection':'keep-alive','X-Accel-Buffering':'no'});
  res.write('retry: 2000\n\n');p.res=res;room.t=Date.now();
  broadcast(room);
  req.on('close',()=>{if(p.res===res){p.res=null;broadcast(room)}});
  return;
 }
 if(req.method==='GET'){
  const f=FILES[u.pathname];
  if(!f){res.writeHead(404);return res.end('Not found')}
  res.writeHead(200,{'Content-Type':f[1]});return res.end(fs.readFileSync(path.join(__dirname,'public',f[0])));
 }
 if(req.method!=='POST'||!u.pathname.startsWith('/api/')){res.writeHead(405);return res.end()}
 let body='';
 req.on('data',d=>{body+=d;if(body.length>20000)req.destroy()});
 req.on('end',()=>{
  let b;try{b=JSON.parse(body||'{}')}catch(e){return send(res,400,{error:'bad request'})}
  if(u.pathname==='/api/create'){
   const name=clean(b.name);if(!name)return send(res,200,{error:'ใส่ชื่อก่อน'});
   const p=mkPlayer(name),room={code:newCode(),players:[p],host:0,phase:'lobby',cnt:{},rev:true,custom:[],g:null,t:Date.now()};
   rooms.set(room.code,room);return send(res,200,{code:room.code,token:p.token});
  }
  if(u.pathname==='/api/join'){
   const room=rooms.get(String(b.code||'').toUpperCase()),name=clean(b.name);
   if(!room)return send(res,200,{error:'ไม่พบห้องนี้'});
   if(!name)return send(res,200,{error:'ใส่ชื่อก่อน'});
   const ex=room.players.find(p=>p.name.toLowerCase()===name.toLowerCase());
   if(room.phase!=='lobby'){ // เกมเริ่มแล้ว: เข้ากลับได้เฉพาะที่นั่งเดิมที่หลุดอยู่
    if(ex&&!ex.res){ex.token=crypto.randomBytes(12).toString('hex');return send(res,200,{code:room.code,token:ex.token})}
    return send(res,200,{error:'เกมเริ่มไปแล้ว'});
   }
   if(ex)return send(res,200,{error:'ชื่อนี้มีคนใช้แล้ว'});
   if(room.players.length>=20)return send(res,200,{error:'ห้องเต็มแล้ว'});
   const p=mkPlayer(name);room.players.push(p);broadcast(room);
   return send(res,200,{code:room.code,token:p.token});
  }
  if(u.pathname==='/api/act'){
   const [room,pi]=find(b.code,b.token);if(!room)return send(res,404,{error:'ไม่พบห้อง'});
   room.t=Date.now();const err=act(room,pi,b);broadcast(room);return send(res,200,err?{error:err}:{});
  }
  send(res,404,{error:'not found'});
 });
}).listen(process.env.PORT||3000,()=>console.log('Werewolf online: http://localhost:'+(process.env.PORT||3000)));
setInterval(()=>{const now=Date.now();rooms.forEach((r,c)=>{r.players.forEach(p=>{if(p.res)try{p.res.write(': ping\n\n')}catch(e){}});if(now-r.t>3*3600e3&&!r.players.some(p=>p.res))rooms.delete(c)})},20000);
