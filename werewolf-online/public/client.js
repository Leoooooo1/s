const app=document.getElementById('app');
const esc=s=>String(s).replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
const ui=h=>{app.innerHTML=h;scrollTo(0,0)};
const TEAM={v:'ชาวบ้าน',w:'หมาป่า',n:'อิสระ'};
let S=null,es=null,mkMode=false,l1=null;
let ses=(()=>{try{return JSON.parse(localStorage.getItem('ww_ses'))}catch(e){return null}})();

async function api(p,b){const r=await fetch(p,{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify(b)});return r.json()}
const act=(type,o={})=>api('/api/act',{code:ses.code,token:ses.token,type,...o}).then(r=>{if(r.error)alert(r.error)});
function leave(){localStorage.removeItem('ww_ses');ses=null;S=null;if(es)es.close();home()}
function connect(){
 if(es)es.close();
 es=new EventSource(`/api/events?code=${ses.code}&token=${ses.token}`);
 es.onmessage=e=>{S=JSON.parse(e.data);if(!(S.prompt&&S.prompt.k==='link'))l1=null;if(!mkMode)render()};
 es.onerror=()=>{if(es.readyState===2)leave()};
}

/* ---------- หน้าแรก ---------- */
function home(){
 const rc=new URLSearchParams(location.search).get('r')||'';
 ui(`<h1>🐺 Werewolf Online</h1>
 <div class=card><label>ชื่อของคุณ<input id=nm maxlength=20 value="${esc(localStorage.getItem('ww_name')||'')}"></label>
 <button onclick="go('create')">สร้างห้องใหม่</button></div>
 <div class=card><label>รหัสห้อง<input id=cd maxlength=4 value="${esc(rc.toUpperCase())}" style="text-transform:uppercase;letter-spacing:.3em"></label>
 <button class=s onclick="go('join')">เข้าร่วมห้อง</button></div>`);
}
async function go(kind){
 const name=document.getElementById('nm').value.trim();localStorage.setItem('ww_name',name);
 const r=await api('/api/'+kind,{name,code:document.getElementById('cd').value.trim()});
 if(r.error)return alert(r.error);
 ses={code:r.code,token:r.token};localStorage.setItem('ww_ses',JSON.stringify(ses));connect();
}

/* ---------- ส่วนประกอบ ---------- */
const nm=i=>esc(S.players[i].name);
const rc=r=>`<div class="card c"><div class=big>${r.e}</div><h1>${esc(r.n)}</h1><div class="t-${r.t}">ฝ่าย${TEAM[r.t]}</div><p>${esc(r.d)}</p><div class=mu>${r.ab.map(esc).join('<br>')}</div></div>`;
const plist=()=>`<div class=card>${S.players.map(p=>`<div class="${p.alive?'':'dead'}">${p.on?'🟢':'⚪'} ${p.alive?'🙂':'💀'} ${esc(p.name)}${p.role?` <span class=mu>(${p.role.e} ${esc(p.role.n)})</span>`:''}</div>`).join('')}</div>`;
const dcard=d=>`<div class="card c">💀 <b>${esc(d.name)}</b> ${esc(d.why)}${d.role?`<div class=mu>เป็น ${d.role.e} ${esc(d.role.n)}</div>`:''}</div>`;
const noteUI=()=>S.note?`<div class="card c" style="white-space:pre-line">${esc(S.note)}</div>`:'';
const logUI=()=>S.log&&S.log.length?`<details class=card><summary>📝 บันทึกของฉัน</summary>${S.log.map(l=>`<div class=mu>${esc(l)}</div>`).join('')}</details>`:'';
const hostWait=()=>S.host&&S.wait&&S.wait.length?`<div class=card><div class=mu>กำลังรอ (ถ้าใครหลุดหรือค้าง กดข้ามให้ได้):</div>${S.wait.map(i=>`<div class=row style="margin:6px 0"><span>${nm(i)} ${S.players[i].on?'':'⚪ ออฟไลน์'}</span><button class="s sm rb" onclick="act('force',{i:${i}})">ข้ามให้</button></div>`).join('')}</div>`:'';
const bar=()=>`<div class="c mu" style="margin-bottom:6px">ห้อง <b>${S.code}</b> · คุณคือ ${nm(S.you)} <a onclick="if(confirm('ออกจากห้อง?'))leave()" style="text-decoration:underline">ออก</a></div>`;
const wait=(big,t)=>`<div class=c><div class=big>${big}</div>${t}</div>`;

/* ---------- เรนเดอร์ตามเฟส ---------- */
function render(){
 if(!S)return;
 const ph=S.phase;
 const body=({lobby,role:roleUI,night:nightUI,result:resultUI,rev:revUI,day:dayUI,vote:voteUI,end:endUI})[ph]();
 ui(bar()+body);
}
function lobby(){
 const t=Object.values(S.cnt).reduce((a,b)=>a+b,0),n=S.players.length,link=location.origin+'/?r='+S.code;
 const head=`<h1>🐺 ห้อง ${S.code}</h1><div class="card c"><div class=mu>ชวนเพื่อนด้วยลิงก์นี้ หรือบอกรหัสห้อง</div><div style="word-break:break-all"><b>${esc(link)}</b></div></div>
 <div class=card><b>ผู้เล่น (${n})</b>${S.players.map((p,i)=>`<div>${p.on?'🟢':'⚪'} ${esc(p.name)}${i===0?' 👑':''}</div>`).join('')}</div>`;
 if(!S.host){
  const r=S.roles.filter(r=>S.cnt[r.id]);
  return head+`<div class=card><b>บทบาทในเกม</b>${r.length?r.map(r=>`<div>${r.e} ${esc(r.n)} × ${S.cnt[r.id]}</div>`).join(''):'<div class=mu>ยังไม่ได้เลือก</div>'}</div><p class="c mu">รอหัวหน้าห้องเริ่มเกม...</p>`;
 }
 return head+`<div class=card><div class=row><b>บทบาท</b><span class="mu c" style="color:${t===n?'#6fcf97':'#e8833a'}">บทบาท ${t} / ผู้เล่น ${n}</span></div>
 ${S.roles.map(r=>`<div class=row style="margin:10px 0"><div style="flex:3">${r.e} ${esc(r.n)} <span class="mu t-${r.t}">${TEAM[r.t]}</span>${/^c\d/.test(r.id)?` <a onclick="if(confirm('ลบบทบาทนี้?'))act('delRole',{id:'${r.id}'})">🗑</a>`:''}<div class=mu>${esc(r.d)}</div></div>
 <button class="s sm rb" onclick="act('chg',{id:'${r.id}',d:-1})">−</button><span class=num>${S.cnt[r.id]||0}</span><button class="s sm rb" onclick="act('chg',{id:'${r.id}',d:1})">＋</button></div>`).join('')}
 <button class=s onclick="act('auto')">🎲 จัดบทบาทให้อัตโนมัติ</button></div>
 <div class=card><label><input type=checkbox ${S.rev?'checked':''} onchange="act('rev',{v:this.checked})">เปิดเผยบทบาทเมื่อผู้เล่นตาย</label></div>
 <button onclick="mk()">✨ สร้างบทบาทใหม่</button><button onclick="act('start')">เริ่มเกม</button>`;
}
function mk(){
 mkMode=true;
 ui(`<h1>สร้างบทบาท</h1><div class=card>
 <label>ชื่อบทบาท<input id=rn maxlength=20></label>
 <div class=row><label>ไอคอน<input id=re value="⭐" maxlength=4></label>
 <label>ฝ่าย<select id=rt><option value=v>ชาวบ้าน</option><option value=w>หมาป่า (ตื่นโหวตฆ่าตอนกลางคืน)</option><option value=n>อิสระ (ชนะคนเดียว)</option></select></label></div>
 <label>คำอธิบาย<textarea id=rd rows=2></textarea></label><b>ความสามารถ</b>
 ${Object.keys(S.abil).map(a=>`<label><input type=checkbox class=ab value=${a}>${esc(S.abil[a])}</label>`).join('')}
 </div><button onclick="saveRole()">บันทึกบทบาท</button><button class=s onclick="mkMode=false;render()">ยกเลิก</button>`);
}
async function saveRole(){
 const g=id=>document.getElementById(id).value;
 await act('addRole',{n:g('rn'),e:g('re'),t:g('rt'),d:g('rd'),a:[...document.querySelectorAll('.ab:checked')].map(x=>x.value)});
 mkMode=false;render();
}
function roleUI(){
 return `<h2 class=c>${nm(S.you)}</h2>${rc(S.role)}${S.mates?`<div class=card>${esc(S.mates)}</div>`:''}
 ${S.ready?'<p class="c mu">รอผู้เล่นคนอื่นดูบทบาทให้ครบ...</p>':`<button onclick="act('ready')">จำแล้ว เริ่มเกม</button>`}${hostWait()}`;
}
function promptUI(p){
 if(p.k==='heal')return `<h2 class=c>💚 ยาชุบ</h2><div class="card c">${p.v==null?'คืนนี้ไม่มีใครถูกโจมตี':`เหยื่อของหมาป่าคือ <b>${nm(p.v)}</b>`}</div>${p.v==null?'':`<button onclick="pk(${p.v})">ใช้ยาชุบช่วย</button>`}<button class=s onclick="act('skip')">ไม่ใช้</button>`;
 const two=p.k==='link'&&l1!=null;
 return `${p.fresh?`<div class="card c">🐺 คุณกลายเป็นหมาป่าแล้ว!<br>พวกเดียวกัน: ${esc(p.fresh)}</div>`:''}<h2 class=c>${esc(two?p.title2:p.title)}</h2>
 <div class=tg>${p.t.filter(i=>!two||i!==l1).map(i=>`<button class=s onclick="pk(${i})">${nm(i)}</button>`).join('')}</div>
 <button class=s onclick="l1=null;act('skip')" style="margin-top:14px">ข้าม</button>`;
}
function pk(i){
 if(S.prompt.k==='link'){if(l1==null){l1=i;return render()}const a=l1;l1=null;return act('pick',{i:[a,i]})}
 act('pick',{i});
}
function nightUI(){
 if(S.prompt)return promptUI(S.prompt);
 return wait('🌙',`<h2>คืนที่ ${S.n}</h2><p>ทุกคนหลับตา รอจนกว่าจะถึงเช้า</p>${S.dead?'<p class=mu>💀 คุณตายแล้ว ดูเกมต่อได้</p>':''}${S.woff?'<p>🤒 หมาป่ากินเหยื่อป่วย คืนนี้หมาป่าฆ่าไม่ได้</p>':''}`)+noteUI()+hostWait()+logUI();
}
function resultUI(){
 const r=S.res;
 return `<div class=c><h2>${esc(r.title)}</h2></div>
 ${r.tally?`<div class=card>${r.tally.length?r.tally.map(t=>`<div class=row><span>${esc(t.name)}</span><b class=c style="flex:0 0 3em">${t.c}</b></div>`).join(''):'<p class=mu>ไม่มีใครถูกโหวต</p>'}</div>`:''}
 ${r.msg?`<div class="card c">${esc(r.msg)}</div>`:''}${r.deaths.map(dcard).join('')}
 ${!r.deaths.length&&r.none?`<div class="card c">${esc(r.none)}</div>`:''}
 ${S.host?`<button onclick="act('next')">ต่อไป</button>`:'<p class="c mu">รอหัวหน้าห้องกดต่อไป...</p>'}`;
}
function revUI(){
 if(S.prompt)return promptUI(S.prompt);
 return wait('🏹',`<h2>${esc(S.revName)} กำลังเลือกคนที่จะยิง</h2>`)+hostWait();
}
function dayUI(){
 return wait('💬',`<h2>วันที่ ${S.n}</h2><p class=mu>ถกเถียงกันเพื่อหาหมาป่า (คุยกันผ่านเสียงหรือแชทนอกเกม)</p>`)+plist()
 +(S.sil.length?`<div class="card c">🤐 ถูกปิดปาก: ${esc(S.sil.join(', '))}<div class=mu>ห้ามพูดและโหวตวันนี้</div></div>`:'')
 +(S.host?`<button onclick="act('startVote')">เริ่มโหวตประหาร</button>`:'<p class="c mu">รอหัวหน้าห้องเริ่มโหวต...</p>')+logUI();
}
function voteUI(){
 const v=S.vote;
 if(!v.can)return wait('🗳️',`<h2>กำลังโหวต</h2><p class=mu>โหวตแล้ว ${v.done}/${v.total}</p>${S.dead?'<p class=mu>💀 คุณตายแล้ว</p>':'<p class=mu>คุณถูกปิดปาก โหวตไม่ได้</p>'}`)+hostWait();
 return `<h2 class=c>โหวตประหารใคร?</h2><div class=tg>${v.targets.filter(i=>i!==S.you).map(i=>`<button class="${v.mine===i?'':'s'}" onclick="act('vote',{i:${i}})">${nm(i)}</button>`).join('')}</div>
 <button class="${v.mine===-1?'':'s'}" onclick="act('vote',{i:-1})" style="margin-top:14px">งดออกเสียง</button>
 <p class="c mu">โหวตแล้ว ${v.done}/${v.total} · เปลี่ยนใจได้จนกว่าทุกคนจะโหวตครบ</p>${hostWait()}`;
}
function endUI(){
 const T={v:['🏡','ชาวบ้านชนะ!'],w:['🐺','หมาป่าชนะ!'],n:['🔪','ฝ่ายอิสระชนะ!'],d:['💀','ไม่มีผู้รอดชีวิต'],t:['🤡','ตัวตลกชนะ! ถูกโหวตประหารสำเร็จ']}[S.winner];
 return `<div class=c><div class=big>${T[0]}</div><h1>${T[1]}</h1></div>
 <div class=card>${S.players.map(p=>`<div class=row style="margin:6px 0"><span class="${p.alive?'':'dead'}">${esc(p.name)}</span><span class="t-${p.role.t}" style="text-align:right">${p.role.e} ${esc(p.role.n)}</span></div>`).join('')}</div>
 ${S.host?`<button onclick="act('again')">เล่นอีกรอบ (บทบาทเดิม สุ่มใหม่)</button><button class=s onclick="act('toLobby')">กลับไปตั้งค่า</button>`:'<p class="c mu">รอหัวหน้าห้องเลือกว่าจะเล่นต่อหรือไม่...</p>'}`;
}

if(ses)connect();else home();
