// ============================================================
// STATE + API
// ============================================================
let state = { clubs: [], meetings: [], pathways: [], mentors: [], directors: {}, strength: [] };
let isAdmin = false; // only ever true on the admin page, after a verified server session

const DEFAULT_DIRECTORS = { B1: "TM Karthick Rajendran", B2: "Atchayashiri", B3: "Jonathan", B4: "Sunita Rajaseelan" };
const uid = () => Date.now().toString(36) + Math.random().toString(36).slice(2,7);

async function apiGet(url){
  const res = await fetch(url);
  if(!res.ok) throw new Error('Request failed: ' + url);
  return res.json();
}
async function apiSend(url, method, body){
  const res = await fetch(url, {
    method,
    headers: body ? { 'Content-Type': 'application/json' } : undefined,
    body: body ? JSON.stringify(body) : undefined
  });
  let data = null;
  try{ data = await res.json(); }catch(e){}
  if(!res.ok){
    if(res.status === 401){
      isAdmin = false;
      setAdminUI();
      alert('🔒 Your admin session has expired. Please log in again.');
    } else {
      alert((data && data.error) || 'Something went wrong. Please try again.');
    }
    throw new Error((data && data.error) || 'Request failed');
  }
  return data;
}
async function refreshState(){
  state = await apiGet('/api/state');
}

// ============================================================
// ADMIN AUTH (server-verified session — admin page only)
// ============================================================
function setAdminUI(){
  document.body.classList.toggle('is-admin', isAdmin);
  const box = document.getElementById('adminBox');
  const statusText = document.getElementById('adminStatusText');
  const logoutBtn = document.getElementById('adminLogoutBtn');
  if(box) box.classList.toggle('on', isAdmin);
  if(statusText) statusText.textContent = isAdmin ? '🔓 Admin mode' : '🔒 Viewer mode';
  if(logoutBtn) logoutBtn.style.display = isAdmin ? 'block' : 'none';
  const gate = document.getElementById('loginGate');
  const appEl = document.querySelector('.app');
  if(gate && appEl){
    gate.style.display = isAdmin ? 'none' : 'flex';
    appEl.style.display = isAdmin ? 'flex' : 'none';
  }
}
async function checkSession(){
  try{
    const data = await apiGet('/api/session');
    isAdmin = !!data.authenticated;
  }catch(e){ isAdmin = false; }
  setAdminUI();
}
async function handleLoginSubmit(e){
  e.preventDefault();
  const f = new FormData(e.target);
  const username = f.get('username');
  const password = f.get('password');
  const errEl = document.getElementById('loginError');
  const submitBtn = e.target.querySelector('button[type="submit"]');
  if(errEl) errEl.textContent = '';
  if(submitBtn){ submitBtn.disabled = true; submitBtn.textContent = 'Signing in…'; }
  try{
    const res = await fetch('/api/login', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ username, password })
    });
    const data = await res.json();
    if(!res.ok || !data.ok){
      if(errEl) errEl.textContent = (data && data.error) || 'Incorrect username or password.';
      return;
    }
    isAdmin = true;
    setAdminUI();
    document.getElementById('clubGrid').innerHTML = `<div class="loading">Loading club data…</div>`;
    await refreshState();
    renderAll();
  }catch(err){
    if(errEl) errEl.textContent = 'Could not reach the server. Please try again.';
  }finally{
    if(submitBtn){ submitBtn.disabled = false; submitBtn.textContent = 'Sign in'; }
  }
}
async function handleLogout(){
  await fetch('/api/logout', { method:'POST' });
  isAdmin = false;
  setAdminUI();
}
function requireAdmin(){
  if(!isAdmin){ alert('🔒 Admin login required to make changes.'); return false; }
  return true;
}
const loginFormEl = document.getElementById('loginForm');
if(loginFormEl) loginFormEl.addEventListener('submit', handleLoginSubmit);
const adminLogoutBtnEl = document.getElementById('adminLogoutBtn');
if(adminLogoutBtnEl) adminLogoutBtnEl.addEventListener('click', handleLogout);

async function loadAll(){
  await refreshState();
}

// ---------- Nav ----------
function switchView(viewName){
  document.querySelectorAll('#nav button').forEach(b=>b.classList.toggle('active', b.dataset.view===viewName));
  document.querySelectorAll('.view').forEach(v=>v.classList.remove('active'));
  document.getElementById('view-'+viewName).classList.add('active');
}
document.getElementById('nav').addEventListener('click', (e)=>{
  const btn = e.target.closest('button[data-view]');
  if(!btn) return;
  document.querySelectorAll('#nav button').forEach(b=>b.classList.remove('active'));
  btn.classList.add('active');
  document.querySelectorAll('.view').forEach(v=>v.classList.remove('active'));
  document.getElementById('view-'+btn.dataset.view).classList.add('active');
});

function escapeHtml(s){ return String(s).replace(/[&<>"']/g, m => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[m])); }

function populateClubSelects(){
  const selects = document.querySelectorAll('select[name="club"]');
  const sorted = [...state.clubs].sort((a,b)=> (a.area+a.name).localeCompare(b.area+b.name));
  selects.forEach(sel=>{
    const current = sel.value;
    sel.innerHTML = sorted.length
      ? sorted.map(c=>`<option value="${escapeHtml(c.name)}">${escapeHtml(c.name)} — ${escapeHtml(c.area)}</option>`).join('')
      : `<option value="">Add a club first</option>`;
    if(sorted.some(c=>c.name===current)) sel.value = current;
  });
}

// ---------- Scoring helpers ----------
function meetingScore(m){
  return (m.onTime?1:0) + (m.speeches>=2?1:0) + (m.guests>=2?1:0) + (m.agenda?1:0) + (m.flyer?1:0);
}
function pct(numer, denom){ return denom>0 ? Math.round((numer/denom)*100) : null; }
function pillClass(value, good, ok){
  if(value===null) return 'flat';
  if(value>=good) return 'sage';
  if(value>=ok) return 'amber';
  return 'clay';
}
function latestByClub(arr, club){
  const rows = arr.filter(r=>r.club===club).sort((a,b)=> (a.month||a.date) < (b.month||b.date) ? 1 : -1);
  return rows[0] || null;
}
function monthLabel(dateStr){
  const d = new Date(dateStr + 'T00:00:00');
  return d.toLocaleString('en', { month:'short', year:'numeric' });
}

function clubFiveStarRate(clubName){
  const ms = state.meetings.filter(m=>m.club===clubName);
  return { rate: pct(ms.filter(m=>meetingScore(m)===5).length, ms.length), count: ms.length };
}
function clubPathwaysPct(clubName){ const r = latestByClub(state.pathways, clubName); return r ? pct(r.active, r.total) : null; }
function clubMentorPct(clubName){ const r = latestByClub(state.mentors, clubName); return r ? pct(r.assigned, r.total) : null; }

function computeClubStatus(clubName){
  const fs = clubFiveStarRate(clubName).rate;
  const pw = clubPathwaysPct(clubName);
  const mt = clubMentorPct(clubName);
  const vals = [fs, pw, mt].filter(v=>v!==null);
  if(vals.length===0) return 'No Data';
  const avg = vals.reduce((a,b)=>a+b,0) / vals.length;
  if(avg >= 80) return 'Excellent';
  if(avg >= 50) return 'Watch';
  return 'At Risk';
}
function statusColor(status){
  return status==='Excellent' ? 'var(--sage)' : status==='Watch' ? 'var(--amber)' : status==='At Risk' ? 'var(--clay)' : 'var(--grey)';
}
function statusPillClass(status){
  return status==='Excellent' ? 'sage' : status==='Watch' ? 'amber' : status==='At Risk' ? 'clay' : 'flat';
}

// ---------- Risk detection (Overview) ----------
function computeClubRisk(clubObj){
  const club = clubObj.name;
  const reasons = [];
  const clubMeetings = state.meetings.filter(m=>m.club===club);
  const hasAnyData = clubMeetings.length || state.pathways.some(r=>r.club===club) || state.mentors.some(r=>r.club===club);
  if(!hasAnyData) return { level:'watch', reasons:['No data logged yet for this club'] };

  if(clubMeetings.length){
    const mostRecent = [...clubMeetings].sort((a,b)=> a.date<b.date?1:-1)[0];
    const daysSince = Math.floor((Date.now() - new Date(mostRecent.date).getTime()) / 86400000);
    if(daysSince >= 21) reasons.push(`No meeting logged in ${daysSince} days`);
    const rate = pct(clubMeetings.filter(m=>meetingScore(m)===5).length, clubMeetings.length);
    if(rate!==null && rate < 50) reasons.push(`5-Star rate is ${rate}%`);
  } else {
    reasons.push('No meetings logged yet');
  }
  const pw = clubPathwaysPct(club);
  if(pw!==null && pw < 40) reasons.push(`Pathways adoption is ${pw}%`);
  const mt = clubMentorPct(club);
  if(mt!==null && mt < 60) reasons.push(`Mentor coverage is ${mt}%`);

  if(reasons.length===0) return { level:'ok', reasons:[] };
  return { level: reasons.length>=2 ? 'critical' : 'watch', reasons };
}

// ---------- Small chart builders ----------
const PALETTE = ['#4C7A63','#D9A441','#1B4B6B','#B5533C','#9A9284','#7C9E82'];

function buildDonut(segments){
  // segments: [{label, value, color}]
  const total = segments.reduce((a,s)=>a+s.value,0);
  if(total===0){
    return `<div class="empty" style="padding:30px 0;">No data yet</div>`;
  }
  let acc = 0;
  const stops = segments.map(s=>{
    const startPct = (acc/total)*100;
    acc += s.value;
    const endPct = (acc/total)*100;
    return `${s.color} ${startPct}% ${endPct}%`;
  }).join(', ');
  const legend = segments.map(s=>{
    const p = Math.round((s.value/total)*100);
    return `<div class="item"><span class="swatch" style="background:${s.color};"></span><span class="txt">${escapeHtml(s.label)}</span><span class="n">${s.value} (${p}%)</span></div>`;
  }).join('');
  return `
    <div class="donut-flex">
      <div class="donut" style="background:conic-gradient(${stops});">
        <div class="donut-hole"><span class="n">${total}</span><span class="lbl">total</span></div>
      </div>
      <div class="donut-legend">${legend}</div>
    </div>`;
}

function buildBarChart(bars){
  // bars: [{label, value}]
  const max = Math.max(1, ...bars.map(b=>b.value));
  return `<div class="barchart">${bars.map(b=>`
    <div class="bar-col">
      <span class="bar-val">${b.value}</span>
      <div class="bar" style="height:${Math.max(4,(b.value/max)*100)}%;"></div>
      <span class="bar-label">${escapeHtml(b.label)}</span>
    </div>`).join('')}</div>`;
}

// ============================================================
// OVERVIEW
// ============================================================
function renderOverview(){
  const totalClubs = state.clubs.length;
  const allMeetings = state.meetings;
  const fiveStarCount = allMeetings.filter(m=>meetingScore(m)===5).length;
  const fiveStarRate = pct(fiveStarCount, allMeetings.length);
  const pathwaysAvg = avgLatestPct(state.pathways, r=>pct(r.active, r.total));
  const mentorAvg = avgLatestPct(state.mentors, r=>pct(r.assigned, r.total));
  const { totalMembers, membersAsOf } = divisionTotalMembers();
  const retentionPct = divisionRetentionPct();

  document.getElementById('statStrip').innerHTML = `
    <div class="stat-card"><div class="label">Clubs Tracked</div><div class="value">${totalClubs}</div><div class="sub">Division B</div></div>
    <div class="stat-card"><div class="label">Total Membership</div><div class="value">${totalMembers===null?'—':totalMembers}</div><div class="sub">${membersAsOf?'latest strength logged per club':'no strength logged yet'}</div></div>
    <div class="stat-card"><div class="label">Retention</div><div class="value">${retentionPct===null?'—':retentionPct+'%'}</div><div class="sub">month-over-month, clubs with 2+ months logged</div></div>
    <div class="stat-card"><div class="label">5-Star Meeting Rate</div><div class="value">${fiveStarRate===null?'—':fiveStarRate+'%'}</div><div class="sub">${allMeetings.length} meetings logged</div></div>
    <div class="stat-card"><div class="label">Pathways Adoption</div><div class="value">${pathwaysAvg===null?'—':pathwaysAvg+'%'}</div><div class="sub">avg across clubs, latest month</div></div>
    <div class="stat-card"><div class="label">Mentor Coverage</div><div class="value">${mentorAvg===null?'—':mentorAvg+'%'}</div><div class="sub">avg across clubs, latest month</div></div>
  `;

  const grid = document.getElementById('clubGrid');
  if(state.clubs.length===0){
    document.getElementById('riskPanel').innerHTML = '';
    grid.innerHTML = `<div class="empty">No clubs yet. Go to <strong>Manage Clubs &amp; Areas</strong> to add Division B's clubs.</div>`;
    return;
  }
  renderRiskPanel();
  const areas = [...new Set(state.clubs.map(c=>c.area))].sort();
  grid.innerHTML = areas.map(area=>{
    const areaClubs = state.clubs.filter(c=>c.area===area).sort((a,b)=>a.name.localeCompare(b.name));
    return `
      <div class="area-block" style="grid-column:1/-1;">
        <div class="area-heading"><span class="tag">${escapeHtml(area)}</span><span class="count">${areaClubs.length} club${areaClubs.length===1?'':'s'}</span></div>
        <div class="club-grid">${areaClubs.map(clubObj=>renderClubCard(clubObj)).join('')}</div>
      </div>`;
  }).join('');
}
function avgLatestPct(arr, fn){
  const clubs = [...new Set(arr.map(r=>r.club))];
  const vals = clubs.map(c=>{ const latest = latestByClub(arr, c); return latest ? fn(latest) : null; }).filter(v=>v!==null);
  if(vals.length===0) return null;
  return Math.round(vals.reduce((a,b)=>a+b,0)/vals.length);
}
function renderRiskPanel(){
  const panel = document.getElementById('riskPanel');
  const flagged = state.clubs.map(c=>({ club:c, risk:computeClubRisk(c) })).filter(r=>r.risk.level!=='ok');
  if(flagged.length===0){ panel.innerHTML = `<div class="risk-panel ok"><h4>✓ No clubs currently flagged</h4></div>`; return; }
  const critical = flagged.filter(r=>r.risk.level==='critical');
  const watch = flagged.filter(r=>r.risk.level==='watch');
  panel.innerHTML = `
    <div class="risk-panel">
      <h4>⚠ ${flagged.length} club${flagged.length===1?'':'s'} need${flagged.length===1?'s':''} attention (${critical.length} critical, ${watch.length} watch)</h4>
      ${flagged.sort((a,b)=> a.risk.level==='critical'?-1:1).map(r=>`
        <div class="risk-row">
          <span><strong>${escapeHtml(r.club.name)}</strong> <span style="color:var(--text-muted);">(${escapeHtml(r.club.area)})</span></span>
          <span class="reasons">${r.risk.reasons.map(escapeHtml).join(' · ')}</span>
        </div>`).join('')}
    </div>`;
}
function renderClubCard(clubObj){
  const club = clubObj.name;
  const risk = computeClubRisk(clubObj);
  const { rate: clubFiveStarRateVal, count: clubMeetingCount } = clubFiveStarRate(club);
  const clubMeetings = state.meetings.filter(m=>m.club===club);
  const recentScore = clubMeetings.length ? meetingScore([...clubMeetings].sort((a,b)=> a.date<b.date?1:-1)[0]) : null;
  const pwPct = clubPathwaysPct(club);
  const mtPct = clubMentorPct(club);
  const starsHtml = recentScore===null
    ? '<span style="color:var(--text-muted);font-size:12px;">No meetings logged</span>'
    : Array.from({length:5}).map((_,i)=>`<span class="${i<recentScore?'on':'off'}">★</span>`).join('');
  return `
    <div class="club-card" style="cursor:pointer;" data-open-club="${escapeHtml(club)}" title="Open ${escapeHtml(club)}'s dashboard">
      ${risk.level==='critical' ? '<span class="risk-badge">Critical</span>' : risk.level==='watch' ? '<span class="risk-badge" style="color:var(--amber);background:var(--amber-bg);">Watch</span>' : ''}
      <h3>${escapeHtml(club)}</h3>
      <div class="club-no">Club No. ${escapeHtml(clubObj.number)}</div>
      <div class="stars" style="margin-top:10px;">${starsHtml}</div>
      <div class="metric-row"><span class="m-label">5-Star meeting rate</span><span class="pill ${pillClass(clubFiveStarRateVal,80,50)}">${clubFiveStarRateVal===null?'—':clubFiveStarRateVal+'%'}</span></div>
      <div class="metric-row"><span class="m-label">Pathways adoption</span><span class="pill ${pillClass(pwPct,70,40)}">${pwPct===null?'—':pwPct+'%'}</span></div>
      <div class="metric-row"><span class="m-label">Mentor coverage</span><span class="pill ${pillClass(mtPct,90,60)}">${mtPct===null?'—':mtPct+'%'}</span></div>
    </div>`;
}

// ============================================================
// CLUB DASHBOARDS (individual, PowerBI-style)
// ============================================================
function populateClubDashSelect(){
  const sel = document.getElementById('clubDashSelect');
  const sorted = [...state.clubs].sort((a,b)=> (a.area+a.name).localeCompare(b.area+b.name));
  const current = sel.value;
  sel.innerHTML = sorted.length
    ? sorted.map(c=>`<option value="${escapeHtml(c.name)}">${escapeHtml(c.name)} — ${escapeHtml(c.area)}</option>`).join('')
    : `<option value="">Add a club first</option>`;
  if(sorted.some(c=>c.name===current)) sel.value = current;
}
document.getElementById('clubDashSelect').addEventListener('change', renderClubDashboard);

function renderClubDashboard(){
  const sel = document.getElementById('clubDashSelect');
  const body = document.getElementById('clubDashBody');
  if(!sel.value){ body.innerHTML = `<div class="empty">Add a club first in Manage Clubs &amp; Areas.</div>`; return; }
  const clubObj = state.clubs.find(c=>c.name===sel.value);
  if(!clubObj){ body.innerHTML = `<div class="empty">Club not found.</div>`; return; }
  const club = clubObj.name;
  const meetings = state.meetings.filter(m=>m.club===club);
  const fiveStarCount = meetings.filter(m=>meetingScore(m)===5).length;
  const fsRate = pct(fiveStarCount, meetings.length);
  const pwPct = clubPathwaysPct(club);
  const mtPct = clubMentorPct(club);
  const status = computeClubStatus(club);
  const growth = clubGrowth(club);

  // Score distribution donut
  const scoreCounts = {};
  meetings.forEach(m=>{ const s = meetingScore(m); scoreCounts[s] = (scoreCounts[s]||0)+1; });
  const scoreColors = {0:'#B5533C',1:'#C9714F',2:'#C98A2B',3:'#B7A25A',4:'#7C9E82',5:'#4C7A63'};
  const scoreSegments = Object.keys(scoreCounts).sort().map(s=>({ label:`Score ${s}`, value:scoreCounts[s], color:scoreColors[s]||'#9A9284' }));

  // 5-star yes/no donut
  const yn = [
    { label:'5-Star', value: fiveStarCount, color:'#4C7A63' },
    { label:'Not 5-Star', value: meetings.length - fiveStarCount, color:'#B5533C' }
  ];

  // Meetings per month bar chart
  const byMonth = {};
  meetings.forEach(m=>{ const lbl = monthLabel(m.date); byMonth[lbl] = (byMonth[lbl]||0)+1; });
  const monthBars = Object.keys(byMonth).sort((a,b)=> new Date('1 '+a) - new Date('1 '+b)).map(lbl=>({label:lbl, value:byMonth[lbl]}));

  // Attendance per meeting (members vs guests) — stacked as two bar charts side by side for readability
  const attendanceMeetings = [...meetings].sort((a,b)=> a.date<b.date?-1:1).slice(-8);
  const attendanceBars = attendanceMeetings.map(m=>({ label: m.date.slice(5), value: (m.membersPresent||0)+(m.guests||0) }));
  const totalMembersPresent = meetings.reduce((s,m)=> s+(m.membersPresent||0), 0);
  const totalGuests = meetings.reduce((s,m)=> s+(m.guests||0), 0);
  const avgAttendance = meetings.length ? Math.round((totalMembersPresent+totalGuests)/meetings.length) : null;

  // Strength trend
  const strengthHist = strengthHistory(club);
  const strengthBars = strengthHist.map(r=>({ label: r.month.slice(2), value: r.strength }));

  // Matrix: month x metrics (now includes strength where logged)
  const months = [...new Set([
    ...meetings.map(m=>m.date.slice(0,7)),
    ...state.pathways.filter(r=>r.club===club).map(r=>r.month),
    ...state.mentors.filter(r=>r.club===club).map(r=>r.month),
    ...strengthHist.map(r=>r.month)
  ])].sort();
  const matrixRows = months.map(mo=>{
    const mMeetings = meetings.filter(m=>m.date.slice(0,7)===mo);
    const mFive = mMeetings.filter(m=>meetingScore(m)===5).length;
    const mMembers = mMeetings.reduce((s,m)=> s+(m.membersPresent||0), 0);
    const mGuests = mMeetings.reduce((s,m)=> s+(m.guests||0), 0);
    const pw = state.pathways.find(r=>r.club===club && r.month===mo);
    const mt = state.mentors.find(r=>r.club===club && r.month===mo);
    const st = strengthHist.find(r=>r.month===mo);
    return { mo, held: mMeetings.length, five: mFive, members: mMembers, guests: mGuests, pw: pw?pct(pw.active,pw.total):null, mt: mt?pct(mt.assigned,mt.total):null, strength: st ? st.strength : null };
  });

  body.innerHTML = `
    <div class="dash-head">
      <div>
        <h2>${escapeHtml(club)}</h2>
        <div class="meta">Club No. ${escapeHtml(clubObj.number)} · Area ${escapeHtml(clubObj.area)}${state.directors[clubObj.area] ? ' · Director: '+escapeHtml(state.directors[clubObj.area]) : ''}</div>
      </div>
      <div style="display:flex;align-items:center;gap:10px;">
        <span class="status-badge pill ${statusPillClass(status)}">${status}</span>
        <button class="primary" id="exportClubBtn" type="button" style="background:var(--gold);color:var(--ink);">⬇ Export This Club</button>
      </div>
    </div>
    <div class="stat-strip">
      <div class="stat-card"><div class="label">Meetings Logged</div><div class="value">${meetings.length}</div></div>
      <div class="stat-card"><div class="label">5-Star Rate</div><div class="value">${fsRate===null?'—':fsRate+'%'}</div></div>
      <div class="stat-card"><div class="label">Pathways Adoption</div><div class="value">${pwPct===null?'—':pwPct+'%'}</div></div>
      <div class="stat-card"><div class="label">Mentor Coverage</div><div class="value">${mtPct===null?'—':mtPct+'%'}</div></div>
      <div class="stat-card"><div class="label">Club Strength</div><div class="value">${growth.latest ? growth.latest.strength : '—'}</div><div class="sub">${growth.latest ? 'as of '+growth.latest.month : 'not logged yet'}</div></div>
      <div class="stat-card"><div class="label">Net Growth</div><div class="value" style="color:${growth.delta>0?'var(--sage)':growth.delta<0?'var(--clay)':'inherit'};">${growth.delta===null?'—':(growth.delta>0?'▲ +':growth.delta<0?'▼ ':'– ')+growth.delta}</div><div class="sub">${growth.previous ? 'vs '+growth.previous.month : 'need 2+ months logged'}</div></div>
      <div class="stat-card"><div class="label">Avg Attendance / Meeting</div><div class="value">${avgAttendance===null?'—':avgAttendance}</div><div class="sub">${totalMembersPresent} members + ${totalGuests} guests total</div></div>
    </div>
    <div class="viz-row">
      <div class="viz-card"><h4>Meeting Score Distribution</h4>${buildDonut(scoreSegments)}</div>
      <div class="viz-card"><h4>5-Star vs Not</h4>${buildDonut(yn)}</div>
      <div class="viz-card"><h4>Meetings per Month</h4>${monthBars.length ? buildBarChart(monthBars) : '<div class="empty" style="padding:30px 0;">No meetings logged</div>'}</div>
    </div>
    <div class="viz-row">
      <div class="viz-card" style="flex:1.4;"><h4>Attendance, Last 8 Meetings (members + guests)</h4>${attendanceBars.length ? buildBarChart(attendanceBars) : '<div class="empty" style="padding:30px 0;">No meetings logged</div>'}</div>
      <div class="viz-card"><h4>Club Strength Trend</h4>${strengthBars.length ? buildBarChart(strengthBars) : '<div class="empty" style="padding:30px 0;">No strength records logged — add one in Attendance &amp; Strength</div>'}</div>
    </div>
    <div class="panel">
      <h3>Monthly Matrix</h3>
      ${matrixRows.length ? `<table><thead><tr><th>Month</th><th>Meetings</th><th>5-Star</th><th>Members</th><th>Guests</th><th>Pathways</th><th>Mentor</th><th>Strength</th></tr></thead><tbody>
        ${matrixRows.map(r=>`<tr>
          <td>${r.mo}</td><td>${r.held}</td><td>${r.five}</td><td>${r.members}</td><td>${r.guests}</td>
          <td>${r.pw===null?'—':r.pw+'%'}</td><td>${r.mt===null?'—':r.mt+'%'}</td><td>${r.strength===null?'—':r.strength}</td>
        </tr>`).join('')}
      </tbody></table>` : `<div class="empty">No data logged for this club yet.</div>`}
    </div>
  `;
  const exportBtn = document.getElementById('exportClubBtn');
  if(exportBtn) exportBtn.addEventListener('click', ()=> exportClubToExcel(clubObj, { meetings, fsRate, pwPct, mtPct, status, matrixRows, growth }));
}

// ============================================================
// AREA DASHBOARDS (individual, PowerBI-style)
// ============================================================
// ============================================================
// AREA COMPARISON (all areas side by side)
// ============================================================
function renderAreaComparison(){
  const wrap = document.getElementById('areaComparisonWrap');
  if(!wrap) return;
  const areas = [...new Set(state.clubs.map(c=>c.area))].sort();
  if(areas.length===0){
    wrap.innerHTML = `<div class="empty">Add clubs to at least one area to see a comparison.</div>`;
    return;
  }

  const rows = areas.map(area=>{
    const areaClubs = state.clubs.filter(c=>c.area===area);
    const rates = areaClubs.map(c=>clubFiveStarRate(c.name).rate).filter(v=>v!==null);
    const pwVals = areaClubs.map(c=>clubPathwaysPct(c.name)).filter(v=>v!==null);
    const mtVals = areaClubs.map(c=>clubMentorPct(c.name)).filter(v=>v!==null);
    const avg = (arr)=> arr.length ? Math.round(arr.reduce((a,b)=>a+b,0)/arr.length) : null;
    const atRisk = areaClubs.filter(c=>computeClubRisk(c).level!=='ok').length;
    const meetingsCount = areaClubs.reduce((sum,c)=> sum + state.meetings.filter(m=>m.club===c.name).length, 0);
    return {
      area, director: state.directors[area] || '—', clubs: areaClubs.length,
      fiveStar: avg(rates), pathways: avg(pwVals), mentor: avg(mtVals),
      atRisk, meetingsCount
    };
  });

  // Rank areas by composite score (average of the three metrics, missing = 0) for a quick leaderboard signal
  const scored = rows.map(r=>{
    const parts = [r.fiveStar, r.pathways, r.mentor].filter(v=>v!==null);
    const composite = parts.length ? Math.round(parts.reduce((a,b)=>a+b,0)/parts.length) : null;
    return { ...r, composite };
  }).sort((a,b)=> (b.composite ?? -1) - (a.composite ?? -1));

  const metricBars = (key, label) => {
    const bars = rows.map(r=>({ label: r.area, value: r[key] ?? 0 }));
    const max = Math.max(1, ...bars.map(b=>b.value));
    return `
      <div class="viz-card">
        <h4>${label}</h4>
        <div class="barchart">${bars.map(b=>`
          <div class="bar-col">
            <span class="bar-val">${b.value===0 && rows.find(r=>r.area===b.label)?.[key]===null ? '—' : b.value+'%'}</span>
            <div class="bar" style="height:${Math.max(4,(b.value/max)*100)}%;background:var(--ink-2);"></div>
            <span class="bar-label">${escapeHtml(b.label)}</span>
          </div>`).join('')}
        </div>
      </div>`;
  };

  wrap.innerHTML = `
    <div class="panel" style="margin-bottom:20px;">
      <h3>Division B — Area Leaderboard</h3>
      <p class="page-sub" style="margin-bottom:14px;">Ranked by composite score (average of 5-Star rate, Pathways adoption, and Mentor coverage).</p>
      <table>
        <thead><tr><th>Area</th><th>Director</th><th>Clubs</th><th>Meetings Logged</th><th>5-Star Rate</th><th>Pathways</th><th>Mentor</th><th>Composite</th><th>Flagged Clubs</th></tr></thead>
        <tbody>
          ${scored.map((r,i)=>`
            <tr${i===0 && r.composite!==null ? ' style="background:var(--sage-bg);"' : ''}>
              <!--<td>${i===0 && r.composite!==null ? '🥇' : i===1 ? '🥈' : i===2 ? '🥉' : i+1}</td>-->
              <td><strong>${escapeHtml(r.area)}</strong></td>
              <td>${escapeHtml(r.director)}</td>
              <td>${r.clubs}</td>
              <td>${r.meetingsCount}</td>
              <td>${r.fiveStar===null?'—':r.fiveStar+'%'}</td>
              <td>${r.pathways===null?'—':r.pathways+'%'}</td>
              <td>${r.mentor===null?'—':r.mentor+'%'}</td>
              <td><strong>${r.composite===null?'—':r.composite+'%'}</strong></td>
              <td>${r.atRisk>0 ? `<span class="pill clay">${r.atRisk} flagged</span>` : `<span class="pill sage">Clear</span>`}</td>
            </tr>`).join('')}
        </tbody>
      </table>
    </div>
    <div class="viz-row">
      ${metricBars('fiveStar','5-Star Meeting Rate by Area')}
      ${metricBars('pathways','Pathways Adoption by Area')}
      ${metricBars('mentor','Mentor Coverage by Area')}
    </div>
  `;
}

function populateAreaDashSelect(){
  const sel = document.getElementById('areaDashSelect');
  const areas = [...new Set(state.clubs.map(c=>c.area))].sort();
  const current = sel.value;
  sel.innerHTML = areas.length ? areas.map(a=>`<option value="${escapeHtml(a)}">${escapeHtml(a)}</option>`).join('') : `<option value="">Add clubs first</option>`;
  if(areas.includes(current)) sel.value = current;
}
document.getElementById('areaDashSelect').addEventListener('change', renderAreaDashboard);

function renderAreaDashboard(){
  const sel = document.getElementById('areaDashSelect');
  const body = document.getElementById('areaDashBody');
  if(!sel.value){ body.innerHTML = `<div class="empty">Add clubs first in Manage Clubs &amp; Areas.</div>`; return; }
  const area = sel.value;
  const areaClubs = state.clubs.filter(c=>c.area===area);
  const director = state.directors[area];

  const clubMetrics = areaClubs.map(c=>{
    const { rate, count } = clubFiveStarRate(c.name);
    return {
      club: c, fiveStar: rate, meetings: count,
      pathways: clubPathwaysPct(c.name), mentor: clubMentorPct(c.name),
      status: computeClubStatus(c.name), risk: computeClubRisk(c)
    };
  });

  const rates = clubMetrics.map(m=>m.fiveStar).filter(v=>v!==null);
  const pwVals = clubMetrics.map(m=>m.pathways).filter(v=>v!==null);
  const mtVals = clubMetrics.map(m=>m.mentor).filter(v=>v!==null);
  const avgRate = rates.length ? Math.round(rates.reduce((a,b)=>a+b,0)/rates.length) : null;
  const avgPw = pwVals.length ? Math.round(pwVals.reduce((a,b)=>a+b,0)/pwVals.length) : null;
  const avgMt = mtVals.length ? Math.round(mtVals.reduce((a,b)=>a+b,0)/mtVals.length) : null;

  const statusCounts = { Excellent:0, Watch:0, 'At Risk':0, 'No Data':0 };
  clubMetrics.forEach(m=>{ statusCounts[m.status]++; });
  const statusSegments = [
    { label:'Excellent', value: statusCounts.Excellent, color:'#4C7A63' },
    { label:'Watch', value: statusCounts.Watch, color:'#C98A2B' },
    { label:'At Risk', value: statusCounts['At Risk'], color:'#B5533C' },
    { label:'No Data', value: statusCounts['No Data'], color:'#9A9284' },
  ];

  const strengthBars = clubMetrics.map(m=>({
    label: m.club.name.length>16 ? m.club.name.slice(0,14)+'…' : m.club.name,
    value: m.meetings
  }));

  // Best/worst performers by 5-Star rate (only clubs with data)
  const ranked = [...clubMetrics].filter(m=>m.fiveStar!==null).sort((a,b)=> b.fiveStar-a.fiveStar);
  const top3 = ranked.slice(0,3);
  const bottom3 = ranked.length>3 ? ranked.slice(-3).reverse() : [];

  const flagged = clubMetrics.filter(m=>m.risk.level!=='ok');

  body.innerHTML = `
    <div class="director-card">
      <div class="avatar">${escapeHtml(area)}</div>
      <div>
        <div class="role">Area Director</div>
        <div class="name">${director ? escapeHtml(director) : 'Not assigned — add one in Manage Clubs & Areas'}</div>
      </div>
    </div>
    <div class="dash-head">
      <div><h2>Area ${escapeHtml(area)}</h2><div class="meta">${areaClubs.length} club${areaClubs.length===1?'':'s'} tracked</div></div>
    </div>
    <div class="stat-strip">
      <div class="stat-card"><div class="label">Clubs in Area</div><div class="value">${areaClubs.length}</div></div>
      <div class="stat-card"><div class="label">Avg 5-Star Rate</div><div class="value">${avgRate===null?'—':avgRate+'%'}</div></div>
      <div class="stat-card"><div class="label">Avg Pathways Adoption</div><div class="value">${avgPw===null?'—':avgPw+'%'}</div></div>
      <div class="stat-card"><div class="label">Avg Mentor Coverage</div><div class="value">${avgMt===null?'—':avgMt+'%'}</div></div>
    </div>
    <div class="viz-row">
      <div class="viz-card"><h4>Club Status Breakdown</h4>${buildDonut(statusSegments)}</div>
      <div class="viz-card" style="flex:1.4;"><h4>Club Strength (meetings logged)</h4>${strengthBars.length ? buildBarChart(strengthBars) : '<div class="empty" style="padding:30px 0;">No clubs in this area</div>'}</div>
    </div>
    ${ranked.length ? `
    <div class="viz-row">
      <div class="viz-card">
        <h4>Top Performers (5-Star Rate)</h4>
        ${top3.map((m,i)=>`<div style="display:flex;justify-content:space-between;padding:8px 0;border-bottom:1px solid var(--border);"><span>${['🥇','🥈','🥉'][i]||''} ${escapeHtml(m.club.name)}</span><strong>${m.fiveStar}%</strong></div>`).join('')}
      </div>
      ${bottom3.length ? `<div class="viz-card">
        <h4>Needs Attention (5-Star Rate)</h4>
        ${bottom3.map(m=>`<div style="display:flex;justify-content:space-between;padding:8px 0;border-bottom:1px solid var(--border);"><span>${escapeHtml(m.club.name)}</span><strong style="color:var(--clay);">${m.fiveStar}%</strong></div>`).join('')}
      </div>` : ''}
    </div>` : ''}
    ${flagged.length ? `
    <div class="panel" style="border-color:var(--amber-bg);background:#FFFBF3;">
      <h3>⚠ Flagged in ${escapeHtml(area)}</h3>
      ${flagged.map(m=>`<div style="padding:8px 0;border-bottom:1px solid var(--border);"><strong>${escapeHtml(m.club.name)}</strong> <span class="pill ${m.risk.level==='critical'?'clay':'amber'}">${m.risk.level==='critical'?'Critical':'Watch'}</span><div style="font-size:12.5px;color:var(--text-muted);margin-top:3px;">${escapeHtml(m.risk.reasons.join(' · '))}</div></div>`).join('')}
    </div>` : ''}
    <div class="panel">
      <h3>Clubs in ${escapeHtml(area)}</h3>
      ${areaClubs.length ? `<table><thead><tr><th>Club</th><th>Meetings</th><th>5-Star Rate</th><th>Pathways</th><th>Mentor</th><th>Status</th></tr></thead><tbody>
        ${clubMetrics.map(m=>`<tr>
            <td>${escapeHtml(m.club.name)}</td><td>${m.meetings}</td>
            <td>${m.fiveStar===null?'—':m.fiveStar+'%'}</td><td>${m.pathways===null?'—':m.pathways+'%'}</td><td>${m.mentor===null?'—':m.mentor+'%'}</td>
            <td><span class="pill ${statusPillClass(m.status)}">${m.status}</span></td>
          </tr>`).join('')}
      </tbody></table>` : `<div class="empty">No clubs in this area yet.</div>`}
    </div>
  `;
}

// ============================================================
// Meetings / Pathways / Mentors logs (tables)
// ============================================================
function renderMeetings(){
  const wrap = document.getElementById('meetingsTableWrap');
  if(state.meetings.length===0){ wrap.innerHTML = `<div class="empty">No meetings logged yet.</div>`; return; }
  const rows = [...state.meetings].sort((a,b)=> a.date<b.date?1:-1);
  wrap.innerHTML = `<table><thead><tr>
    <th>Club</th><th>Date</th><th>On time</th><th>Speeches</th><th>Members</th><th>Guests</th><th>Agenda</th><th>Flyer</th><th>Score</th><th></th>
  </tr></thead><tbody>
  ${rows.map(m=>{
    const score = meetingScore(m);
    return `<tr>
      <td>${escapeHtml(m.club)}</td><td>${m.date}</td><td>${m.onTime?'Yes':'No'}</td>
      <td>${m.speeches}</td><td>${m.membersPresent ?? '—'}</td><td>${m.guests}</td><td>${m.agenda?'Yes':'No'}</td><td>${m.flyer?'Yes':'No'}</td>
      <td><span class="pill ${score===5?'sage':score>=3?'amber':'clay'}">${score}/5${score===5?' ★':''}</span></td>
      <td><button class="ghost admin-only" data-del-meeting="${m.id}">Remove</button></td>
    </tr>`;
  }).join('')}
  </tbody></table>`;
}
function renderSimpleTable(wrapId, arr, cols, delAttr){
  const wrap = document.getElementById(wrapId);
  if(arr.length===0){ wrap.innerHTML = `<div class="empty">No records logged yet.</div>`; return; }
  const rows = [...arr].sort((a,b)=> a.month<b.month?1:-1);
  wrap.innerHTML = `<table><thead><tr>${cols.map(c=>`<th>${c.label}</th>`).join('')}<th></th></tr></thead><tbody>
  ${rows.map(r=>`<tr>${cols.map(c=>`<td>${c.render(r)}</td>`).join('')}<td><button class="ghost admin-only" data-${delAttr}="${r.id}">Remove</button></td></tr>`).join('')}
  </tbody></table>`;
}
function renderPathways(){
  renderSimpleTable('pathwaysTableWrap', state.pathways, [
    {label:'Club', render:r=>escapeHtml(r.club)}, {label:'Month', render:r=>r.month},
    {label:'Active in path', render:r=>r.active}, {label:'Total members', render:r=>r.total},
    {label:'Adoption', render:r=>{ const p=pct(r.active,r.total); return `<span class="pill ${pillClass(p,70,40)}">${p}%</span>`; }},
  ], 'del-pathways');
}
function renderMentors(){
  renderSimpleTable('mentorsTableWrap', state.mentors, [
    {label:'Club', render:r=>escapeHtml(r.club)}, {label:'Month', render:r=>r.month},
    {label:'Assigned', render:r=>r.assigned}, {label:'Total members', render:r=>r.total},
    {label:'Coverage', render:r=>{ const p=pct(r.assigned,r.total); return `<span class="pill ${pillClass(p,90,60)}">${p}%</span>`; }},
  ], 'del-mentors');
}

// ---------- Club Strength (membership) helpers ----------
function strengthHistory(club){
  return state.strength.filter(r=>r.club===club).sort((a,b)=> a.month<b.month?-1:1);
}
function clubGrowth(club){
  const hist = strengthHistory(club);
  if(hist.length===0) return { latest:null, previous:null, delta:null, deltaPct:null };
  const latest = hist[hist.length-1];
  const previous = hist.length>1 ? hist[hist.length-2] : null;
  const delta = previous ? latest.strength - previous.strength : null;
  const deltaPct = previous && previous.strength>0 ? Math.round((delta/previous.strength)*1000)/10 : null;
  return { latest, previous, delta, deltaPct };
}
// Sum of each club's latest logged strength (total members across the division).
function divisionTotalMembers(){
  if(state.clubs.length===0) return { totalMembers: null, membersAsOf: false };
  let sum = 0, any = false;
  state.clubs.forEach(c=>{
    const g = clubGrowth(c.name);
    if(g.latest){ sum += g.latest.strength; any = true; }
  });
  return { totalMembers: any ? sum : null, membersAsOf: any };
}
// Division-wide retention: sum(latest strength) / sum(previous strength) for clubs
// that have at least two months logged. This measures month-over-month persistence
// of total membership (new joins can offset losses) — not per-member renewal rate,
// since renewal/departure isn't tracked separately from total strength.
function divisionRetentionPct(){
  let latestSum = 0, previousSum = 0, any = false;
  state.clubs.forEach(c=>{
    const g = clubGrowth(c.name);
    if(g.latest && g.previous){ latestSum += g.latest.strength; previousSum += g.previous.strength; any = true; }
  });
  if(!any || previousSum===0) return null;
  return Math.round((latestSum/previousSum)*1000)/10;
}
function renderStrength(){
  const wrap = document.getElementById('strengthTableWrap');
  if(state.strength.length===0){ wrap.innerHTML = `<div class="empty">No strength records logged yet.</div>`; return; }
  const rows = [...state.strength].sort((a,b)=> a.month<b.month?1:-1);
  wrap.innerHTML = `<table><thead><tr>
    <th>Club</th><th>Month</th><th>Strength</th><th>Net Growth vs Prior Month</th><th></th>
  </tr></thead><tbody>
  ${rows.map(r=>{
    const hist = strengthHistory(r.club);
    const idx = hist.findIndex(h=>h.id===r.id);
    const prior = idx>0 ? hist[idx-1] : null;
    const delta = prior ? r.strength - prior.strength : null;
    const deltaTxt = delta===null ? '—' : (delta>0 ? `▲ +${delta}` : delta<0 ? `▼ ${delta}` : '– 0');
    const deltaClass = delta===null ? 'flat' : delta>0 ? 'sage' : delta<0 ? 'clay' : 'flat';
    return `<tr>
      <td>${escapeHtml(r.club)}</td><td>${r.month}</td><td>${r.strength}</td>
      <td><span class="pill ${deltaClass}">${deltaTxt}</span></td>
      <td><button class="ghost admin-only" data-del-strength="${r.id}">Remove</button></td>
    </tr>`;
  }).join('')}
  </tbody></table>`;
}
function renderAttendance(){
  const wrap = document.getElementById('attendanceTableWrap');
  if(state.meetings.length===0){ wrap.innerHTML = `<div class="empty">No meetings logged yet — attendance shows here once meetings are added.</div>`; return; }
  const rows = [...state.meetings].sort((a,b)=> a.date<b.date?1:-1);
  wrap.innerHTML = `<table><thead><tr>
    <th>Club</th><th>Date</th><th>Members Present</th><th>Guests</th><th>Total Attendance</th><th>Guests as % of Attendance</th>
  </tr></thead><tbody>
  ${rows.map(m=>{
    const members = m.membersPresent||0, guests = m.guests||0, total = members+guests;
    const guestShare = total>0 ? Math.round((guests/total)*100) : null;
    return `<tr>
      <td>${escapeHtml(m.club)}</td><td>${m.date}</td><td>${members}</td><td>${guests}</td>
      <td><strong>${total}</strong></td><td>${guestShare===null?'—':guestShare+'%'}</td>
    </tr>`;
  }).join('')}
  </tbody></table>`;
}

// ============================================================
// Roster & Directors management
// ============================================================
function renderClubRoster(){
  const wrap = document.getElementById('clubRosterWrap');
  if(state.clubs.length===0){ wrap.innerHTML = `<div class="empty">No clubs added yet.</div>`; return; }
  const sorted = [...state.clubs].sort((a,b)=> (a.area+a.name).localeCompare(b.area+b.name));
  wrap.innerHTML = `<table><thead><tr><th>Club No</th><th>Club Name</th><th>Area</th><th></th></tr></thead><tbody>
  ${sorted.map(c=>`<tr>
    <td class="club-no">${escapeHtml(c.number)}</td><td>${escapeHtml(c.name)}</td><td>${escapeHtml(c.area)}</td>
    <td><button class="ghost admin-only" data-del-club="${escapeHtml(c.name)}">Remove</button></td>
  </tr>`).join('')}
  </tbody></table>`;
}
function renderDirectors(){
  const wrap = document.getElementById('directorsWrap');
  const areas = [...new Set(state.clubs.map(c=>c.area))].sort();
  if(areas.length===0){ wrap.innerHTML = `<div class="empty">Add clubs first to assign area directors.</div>`; return; }
  wrap.innerHTML = areas.map(a=>`
    <div class="drow">
      <span class="tag">${escapeHtml(a)}</span>
      <input type="text" data-director-area="${escapeHtml(a)}" placeholder="Director name" value="${escapeHtml(state.directors[a]||'')}">
    </div>`).join('');
}
document.getElementById('directorsWrap').addEventListener('change', async (e)=>{
  const input = e.target.closest('[data-director-area]');
  if(!input) return;
  if(!requireAdmin()){ renderDirectors(); return; }
  try{
    await apiSend('/api/directors', 'POST', { area: input.dataset.directorArea, name: input.value.trim() });
    await refreshState();
    renderDirectors();
  }catch(err){ renderDirectors(); }
});
document.getElementById('loadDirectorsBtn').addEventListener('click', async ()=>{
  if(!requireAdmin()) return;
  try{
    await apiSend('/api/directors', 'POST', { loadDefaults: true });
    await refreshState();
    renderDirectors();
  }catch(err){}
});

function renderAll(){
  populateClubSelects();
  populateClubDashSelect();
  populateAreaDashSelect();
  renderOverview();
  renderClubDashboard();
  renderAreaComparison();
  renderAreaDashboard();
  renderMeetings();
  renderPathways();
  renderMentors();
  renderStrength();
  renderAttendance();
  renderClubRoster();
  renderDirectors();
}

// ---------- Form handlers ----------
document.getElementById('form-meeting').addEventListener('submit', async (e)=>{
  e.preventDefault();
  if(!requireAdmin()) return;
  const f = new FormData(e.target);
  if(!f.get('club')) return;
  try{
    await apiSend('/api/meetings', 'POST', {
      club: f.get('club'), date: f.get('date'),
      onTime: f.get('onTime')==='1', speeches: Number(f.get('speeches')), guests: Number(f.get('guests')),
      membersPresent: Number(f.get('membersPresent')),
      agenda: f.get('agenda')==='1', flyer: f.get('flyer')==='1'
    });
    await refreshState();
    e.target.reset(); renderAll();
  }catch(err){}
});
document.getElementById('form-pathways').addEventListener('submit', async (e)=>{
  e.preventDefault();
  if(!requireAdmin()) return;
  const f = new FormData(e.target);
  if(!f.get('club')) return;
  try{
    await apiSend('/api/pathways', 'POST', { club: f.get('club'), month: f.get('month'), active: Number(f.get('active')), total: Number(f.get('total')) });
    await refreshState();
    e.target.reset(); renderAll();
  }catch(err){}
});
document.getElementById('form-mentors').addEventListener('submit', async (e)=>{
  e.preventDefault();
  if(!requireAdmin()) return;
  const f = new FormData(e.target);
  if(!f.get('club')) return;
  try{
    await apiSend('/api/mentors', 'POST', { club: f.get('club'), month: f.get('month'), assigned: Number(f.get('assigned')), total: Number(f.get('total')) });
    await refreshState();
    e.target.reset(); renderAll();
  }catch(err){}
});
document.getElementById('form-strength').addEventListener('submit', async (e)=>{
  e.preventDefault();
  if(!requireAdmin()) return;
  const f = new FormData(e.target);
  if(!f.get('club')) return;
  try{
    await apiSend('/api/strength', 'POST', { club: f.get('club'), month: f.get('month'), strength: Number(f.get('strength')) });
    await refreshState();
    e.target.reset(); renderAll();
  }catch(err){}
});
document.getElementById('form-club').addEventListener('submit', async (e)=>{
  e.preventDefault();
  if(!requireAdmin()) return;
  const f = new FormData(e.target);
  const name = (f.get('name')||'').trim(); const number = (f.get('number')||'').trim(); const area = (f.get('area')||'').trim();
  if(!name || !number || !area) { e.target.reset(); return; }
  try{
    await apiSend('/api/clubs', 'POST', { number, name, area });
    await refreshState();
    e.target.reset(); renderAll();
  }catch(err){ e.target.reset(); }
});
document.getElementById('bulkAddBtn').addEventListener('click', async ()=>{
  if(!requireAdmin()) return;
  const raw = document.getElementById('bulkClubText').value;
  try{
    const data = await apiSend('/api/bulk-clubs', 'POST', { text: raw });
    await refreshState();
    document.getElementById('bulkAddMsg').textContent = `Added ${data.added} club${data.added===1?'':'s'}${data.skipped?`, skipped ${data.skipped} (duplicate or malformed)`:''}.`;
    renderAll();
  }catch(err){}
});

// ---------- Delete handlers ----------
document.addEventListener('click', (e)=>{
  const openClub = e.target.closest('[data-open-club]');
  if(openClub){
    const club = openClub.dataset.openClub;
    switchView('clubdash');
    const sel = document.getElementById('clubDashSelect');
    if([...sel.options].some(o=>o.value===club)) sel.value = club;
    renderClubDashboard();
  }
});
document.addEventListener('click', async (e)=>{
  const dm = e.target.closest('[data-del-meeting]');
  if(dm){ if(!requireAdmin()) return; try{ await apiSend('/api/meetings?id='+encodeURIComponent(dm.dataset.delMeeting), 'DELETE'); await refreshState(); renderAll(); }catch(err){} return; }
  const dp = e.target.closest('[data-del-pathways]');
  if(dp){ if(!requireAdmin()) return; try{ await apiSend('/api/pathways?id='+encodeURIComponent(dp.dataset.delPathways), 'DELETE'); await refreshState(); renderAll(); }catch(err){} return; }
  const dme = e.target.closest('[data-del-mentors]');
  if(dme){ if(!requireAdmin()) return; try{ await apiSend('/api/mentors?id='+encodeURIComponent(dme.dataset.delMentors), 'DELETE'); await refreshState(); renderAll(); }catch(err){} return; }
  const ds = e.target.closest('[data-del-strength]');
  if(ds){ if(!requireAdmin()) return; try{ await apiSend('/api/strength?id='+encodeURIComponent(ds.dataset.delStrength), 'DELETE'); await refreshState(); renderAll(); }catch(err){} return; }
  const dc = e.target.closest('[data-del-club]');
  if(dc){ if(!requireAdmin()) return; try{ await apiSend('/api/clubs?name='+encodeURIComponent(dc.dataset.delClub), 'DELETE'); await refreshState(); renderAll(); }catch(err){} return; }
});

// ============================================================
// EXPORT — SINGLE CLUB
// ============================================================
function exportClubToExcel(clubObj, computed){
  if(typeof XLSX === 'undefined'){
    alert('Excel export library failed to load. Check your internet connection and try again.');
    return;
  }
  const club = clubObj.name;
  const { meetings, fsRate, pwPct, mtPct, status, matrixRows, growth } = computed;
  const today = new Date().toISOString().slice(0,10);
  const wb = XLSX.utils.book_new();
  const risk = computeClubRisk(clubObj);
  const g = growth || clubGrowth(club);

  // --- Sheet 1: Summary ---
  const summaryRows = [
    [club, ''],
    ['Club No.', clubObj.number],
    ['Area', clubObj.area],
    ['Area Director', state.directors[clubObj.area] || '—'],
    ['Exported', today],
    [],
    ['Metric', 'Value'],
    ['Meetings Logged', meetings.length],
    ['5-Star Meeting Rate', fsRate===null?'—':fsRate+'%'],
    ['Pathways Adoption (latest month)', pwPct===null?'—':pwPct+'%'],
    ['Mentor Coverage (latest month)', mtPct===null?'—':mtPct+'%'],
    ['Club Strength (latest)', g.latest ? `${g.latest.strength} (as of ${g.latest.month})` : 'Not logged yet'],
    ['Net Growth vs Prior Month', g.delta===null?'—':(g.delta>0?'+':'')+g.delta+(g.previous ? ' vs '+g.previous.month : '')],
    ['Status', status],
    ['Risk Level', risk.level==='ok'?'OK':risk.level==='critical'?'Critical':'Watch'],
    ['Risk Reasons', risk.reasons.join(' · ') || '—'],
  ];
  const wsSummary = XLSX.utils.aoa_to_sheet(summaryRows);
  wsSummary['!cols'] = [{wch:30},{wch:36}];
  XLSX.utils.book_append_sheet(wb, wsSummary, 'Summary');

  // --- Sheet 2: Meetings (incl. attendance) ---
  const meetingRows = [['Date', 'On Time', 'Speeches', 'Members Present', 'Guests', 'Total Attendance', 'Agenda 3+ Days Early', 'Flyer 2+ Days Early', 'Score (/5)', '5-Star?']];
  [...meetings].sort((a,b)=> a.date<b.date?1:-1).forEach(m=>{
    const score = meetingScore(m);
    const members = m.membersPresent||0, guests = m.guests||0;
    meetingRows.push([m.date, m.onTime?'Yes':'No', m.speeches, members, guests, members+guests, m.agenda?'Yes':'No', m.flyer?'Yes':'No', score, score===5?'Yes':'No']);
  });
  if(meetingRows.length===1) meetingRows.push(['No meetings logged yet','','','','','','','','','']);
  const wsMeetings = XLSX.utils.aoa_to_sheet(meetingRows);
  wsMeetings['!cols'] = [{wch:12},{wch:9},{wch:10},{wch:14},{wch:8},{wch:16},{wch:20},{wch:20},{wch:10},{wch:9}];
  XLSX.utils.book_append_sheet(wb, wsMeetings, 'Meetings & Attendance');

  // --- Sheet 3: Pathways & Mentors ---
  const pwRows = state.pathways.filter(r=>r.club===club).sort((a,b)=> a.month<b.month?1:-1);
  const mtRows = state.mentors.filter(r=>r.club===club).sort((a,b)=> a.month<b.month?1:-1);
  const pmRows = [['— Pathways Adoption —','','',''],['Month','Active in Path','Total Members','Adoption %']];
  pwRows.forEach(r=> pmRows.push([r.month, r.active, r.total, pct(r.active,r.total)]));
  if(pwRows.length===0) pmRows.push(['No records logged yet','','','']);
  pmRows.push([]);
  pmRows.push(['— Mentor Coverage —','','','']);
  pmRows.push(['Month','Assigned a Mentor','Total Members','Coverage %']);
  mtRows.forEach(r=> pmRows.push([r.month, r.assigned, r.total, pct(r.assigned,r.total)]));
  if(mtRows.length===0) pmRows.push(['No records logged yet','','','']);
  const wsPM = XLSX.utils.aoa_to_sheet(pmRows);
  wsPM['!cols'] = [{wch:20},{wch:18},{wch:16},{wch:12}];
  XLSX.utils.book_append_sheet(wb, wsPM, 'Pathways & Mentors');

  // --- Sheet 4: Club Strength ---
  const strengthHist = strengthHistory(club);
  const strengthRows = [['Month', 'Strength (Total Members)', 'Net Growth vs Prior Month']];
  strengthHist.forEach((r,i)=>{
    const prior = i>0 ? strengthHist[i-1] : null;
    const delta = prior ? r.strength - prior.strength : null;
    strengthRows.push([r.month, r.strength, delta===null?'—':(delta>0?'+':'')+delta]);
  });
  if(strengthHist.length===0) strengthRows.push(['No strength records logged yet','','']);
  const wsStrength = XLSX.utils.aoa_to_sheet(strengthRows);
  wsStrength['!cols'] = [{wch:12},{wch:22},{wch:24}];
  XLSX.utils.book_append_sheet(wb, wsStrength, 'Club Strength');

  // --- Sheet 5: Monthly Matrix ---
  const matrixHeader = [['Month', 'Meetings Held', '5-Star Meetings', 'Members Present', 'Guests', 'Pathways Adoption %', 'Mentor Coverage %', 'Club Strength']];
  const matrixData = matrixRows.map(r=> [r.mo, r.held, r.five, r.members ?? '—', r.guests ?? '—', r.pw===null?'—':r.pw, r.mt===null?'—':r.mt, r.strength===null||r.strength===undefined?'—':r.strength]);
  if(matrixData.length===0) matrixData.push(['No data logged for this club yet.','','','','','','','']);
  const wsMatrix = XLSX.utils.aoa_to_sheet([...matrixHeader, ...matrixData]);
  wsMatrix['!cols'] = [{wch:10},{wch:14},{wch:16},{wch:16},{wch:8},{wch:20},{wch:18},{wch:14}];
  XLSX.utils.book_append_sheet(wb, wsMatrix, 'Monthly Matrix');

  const safeName = club.replace(/[\\/:*?"<>|]/g, '').slice(0,60);
  XLSX.writeFile(wb, `${safeName}_${today}.xlsx`);
}

// ---------- Shared: per-club monthly matrix (meetings/5-star/pathways/mentor by month) ----------
function computeClubMonthlyMatrix(club){
  const meetings = state.meetings.filter(m=>m.club===club);
  const strengthHist = strengthHistory(club);
  const months = [...new Set([
    ...meetings.map(m=>m.date.slice(0,7)),
    ...state.pathways.filter(r=>r.club===club).map(r=>r.month),
    ...state.mentors.filter(r=>r.club===club).map(r=>r.month),
    ...strengthHist.map(r=>r.month)
  ])].sort();
  return months.map(mo=>{
    const mMeetings = meetings.filter(m=>m.date.slice(0,7)===mo);
    const mFive = mMeetings.filter(m=>meetingScore(m)===5).length;
    const mMembers = mMeetings.reduce((s,m)=> s+(m.membersPresent||0), 0);
    const mGuests = mMeetings.reduce((s,m)=> s+(m.guests||0), 0);
    const pw = state.pathways.find(r=>r.club===club && r.month===mo);
    const mt = state.mentors.find(r=>r.club===club && r.month===mo);
    const st = strengthHist.find(r=>r.month===mo);
    return { mo, held: mMeetings.length, five: mFive, members: mMembers, guests: mGuests, pw: pw?pct(pw.active,pw.total):null, mt: mt?pct(mt.assigned,mt.total):null, strength: st ? st.strength : null };
  });
}

function exportAllClubsMonthly(){
  if(typeof XLSX === 'undefined'){
    alert('Excel export library failed to load. Check your internet connection and try again.');
    return;
  }
  if(state.clubs.length===0){
    alert('Add clubs first in Manage Clubs & Areas.');
    return;
  }
  const wb = XLSX.utils.book_new();
  const today = new Date().toISOString().slice(0,10);
  const usedNames = new Set();

  // --- Index sheet: one row per club, links the rest of the workbook together ---
  const rosterSorted = [...state.clubs].sort((a,b)=> (a.area+a.name).localeCompare(b.area+b.name));
  const indexRows = [['Club No', 'Club Name', 'Area', 'Sheet Name', 'Months Logged', '5-Star Rate', 'Pathways', 'Mentor', 'Latest Strength', 'Net Growth', 'Status']];

  rosterSorted.forEach(c=>{
    const { rate } = clubFiveStarRate(c.name);
    const pw = clubPathwaysPct(c.name);
    const mt = clubMentorPct(c.name);
    const status = computeClubStatus(c.name);
    const matrix = computeClubMonthlyMatrix(c.name);
    const g = clubGrowth(c.name);

    // Excel sheet names: max 31 chars, no \ / ? * [ ] :, and must be unique
    let sheetName = c.name.replace(/[\\/?*\[\]:]/g, '').slice(0, 28).trim() || 'Club';
    let finalName = sheetName;
    let n = 2;
    while(usedNames.has(finalName)){ finalName = `${sheetName.slice(0, 26)}~${n}`; n++; }
    usedNames.add(finalName);

    indexRows.push([
      c.number, c.name, c.area, finalName, matrix.length,
      rate===null?'—':rate+'%', pw===null?'—':pw+'%', mt===null?'—':mt+'%',
      g.latest ? g.latest.strength : '—', g.delta===null?'—':(g.delta>0?'+':'')+g.delta,
      status
    ]);

    const sheetRows = [
      [c.name, ''],
      ['Club No.', c.number],
      ['Area', c.area],
      ['Area Director', state.directors[c.area] || '—'],
      ['Status', status],
      ['Latest Strength', g.latest ? `${g.latest.strength} (${g.latest.month})` : 'Not logged'],
      [],
      ['Month', 'Meetings Held', '5-Star Meetings', 'Members Present', 'Guests', 'Pathways Adoption %', 'Mentor Coverage %', 'Club Strength']
    ];
    if(matrix.length===0){
      sheetRows.push(['No data logged for this club yet.', '', '', '', '', '', '', '']);
    } else {
      matrix.forEach(r=> sheetRows.push([r.mo, r.held, r.five, r.members, r.guests, r.pw===null?'—':r.pw, r.mt===null?'—':r.mt, r.strength===null?'—':r.strength]));
    }
    const ws = XLSX.utils.aoa_to_sheet(sheetRows);
    ws['!cols'] = [{wch:22},{wch:16},{wch:16},{wch:16},{wch:8},{wch:20},{wch:18},{wch:14}];
    XLSX.utils.book_append_sheet(wb, ws, finalName);
  });

  const wsIndex = XLSX.utils.aoa_to_sheet(indexRows);
  wsIndex['!cols'] = [{wch:14},{wch:36},{wch:8},{wch:22},{wch:14},{wch:12},{wch:12},{wch:12},{wch:14},{wch:12},{wch:12}];
  XLSX.utils.book_append_sheet(wb, wsIndex, 'Index — All Clubs');
  // Move index sheet to the front
  wb.SheetNames.unshift(wb.SheetNames.pop());

  XLSX.writeFile(wb, `Division_B_Monthly_By_Club_${today}.xlsx`);
}

// ============================================================
// EXPORT TO EXCEL
// ============================================================
function exportToExcel(){
  if(typeof XLSX === 'undefined'){
    alert('Excel export library failed to load. Check your internet connection and try again.');
    return;
  }
  const wb = XLSX.utils.book_new();
  const today = new Date().toISOString().slice(0,10);

  // --- Sheet 1: Overview ---
  const totalClubs = state.clubs.length;
  const allMeetings = state.meetings;
  const fiveStarCount = allMeetings.filter(m=>meetingScore(m)===5).length;
  const fiveStarRate = pct(fiveStarCount, allMeetings.length);
  const pathwaysAvg = avgLatestPct(state.pathways, r=>pct(r.active, r.total));
  const mentorAvg = avgLatestPct(state.mentors, r=>pct(r.assigned, r.total));
  const flagged = state.clubs.map(c=>({ club:c, risk:computeClubRisk(c) })).filter(r=>r.risk.level!=='ok');
  const overviewRows = [
    ['Division B — At a Glance', ''],
    ['Exported', today],
    [],
    ['Metric', 'Value'],
    ['Clubs Tracked', totalClubs],
    ['5-Star Meeting Rate', fiveStarRate===null?'—':fiveStarRate+'%'],
    ['Total Meetings Logged', allMeetings.length],
    ['Pathways Adoption (avg, latest month)', pathwaysAvg===null?'—':pathwaysAvg+'%'],
    ['Mentor Coverage (avg, latest month)', mentorAvg===null?'—':mentorAvg+'%'],
    ['Clubs Flagged (Watch/Critical)', flagged.length],
  ];
  const wsOverview = XLSX.utils.aoa_to_sheet(overviewRows);
  wsOverview['!cols'] = [{wch:36},{wch:18}];
  XLSX.utils.book_append_sheet(wb, wsOverview, 'Overview');

  // --- Sheet 2: Risk Flags ---
  const riskRows = [['Club', 'Area', 'Risk Level', 'Reasons']];
  flagged.sort((a,b)=> a.risk.level==='critical'?-1:1).forEach(r=>{
    riskRows.push([r.club.name, r.club.area, r.risk.level==='critical'?'Critical':'Watch', r.risk.reasons.join(' · ')]);
  });
  if(riskRows.length===1) riskRows.push(['No clubs currently flagged', '', '', '']);
  const wsRisk = XLSX.utils.aoa_to_sheet(riskRows);
  wsRisk['!cols'] = [{wch:32},{wch:8},{wch:12},{wch:60}];
  XLSX.utils.book_append_sheet(wb, wsRisk, 'Risk Flags');

  // --- Sheet 3: Club Roster ---
  const rosterSorted = [...state.clubs].sort((a,b)=> (a.area+a.name).localeCompare(b.area+b.name));
  const rosterRows = [['Club No', 'Club Name', 'Area']];
  rosterSorted.forEach(c=> rosterRows.push([c.number, c.name, c.area]));
  const wsRoster = XLSX.utils.aoa_to_sheet(rosterRows);
  wsRoster['!cols'] = [{wch:14},{wch:42},{wch:8}];
  XLSX.utils.book_append_sheet(wb, wsRoster, 'Club Roster');

  // --- Sheet 4: Area Directors ---
  const areasList = [...new Set(state.clubs.map(c=>c.area))].sort();
  const dirRows = [['Area', 'Director']];
  areasList.forEach(a=> dirRows.push([a, state.directors[a] || '']));
  const wsDir = XLSX.utils.aoa_to_sheet(dirRows);
  wsDir['!cols'] = [{wch:8},{wch:28}];
  XLSX.utils.book_append_sheet(wb, wsDir, 'Area Directors');

  // --- Sheet 5: Club Summary ---
  const clubSummaryRows = [['Club No', 'Club Name', 'Area', 'Meetings Logged', '5-Star Rate', 'Pathways Adoption', 'Mentor Coverage', 'Latest Strength', 'Net Growth', 'Status', 'Risk Level', 'Risk Reasons']];
  rosterSorted.forEach(c=>{
    const { rate, count } = clubFiveStarRate(c.name);
    const pw = clubPathwaysPct(c.name);
    const mt = clubMentorPct(c.name);
    const st = computeClubStatus(c.name);
    const risk = computeClubRisk(c);
    const g = clubGrowth(c.name);
    clubSummaryRows.push([
      c.number, c.name, c.area, count,
      rate===null?'—':rate+'%', pw===null?'—':pw+'%', mt===null?'—':mt+'%',
      g.latest ? g.latest.strength : '—', g.delta===null?'—':(g.delta>0?'+':'')+g.delta,
      st, risk.level==='ok'?'OK':risk.level==='critical'?'Critical':'Watch', risk.reasons.join(' · ')
    ]);
  });
  const wsClubSummary = XLSX.utils.aoa_to_sheet(clubSummaryRows);
  wsClubSummary['!cols'] = [{wch:14},{wch:36},{wch:8},{wch:14},{wch:12},{wch:16},{wch:14},{wch:14},{wch:12},{wch:12},{wch:10},{wch:50}];
  XLSX.utils.book_append_sheet(wb, wsClubSummary, 'Club Summary');

  // --- Sheet 6: Area Summary ---
  const areaSummaryRows = [['Area', 'Director', 'Clubs', 'Avg 5-Star Rate', 'Avg Pathways Adoption', 'Avg Mentor Coverage', 'Excellent', 'Watch', 'At Risk', 'No Data']];
  areasList.forEach(area=>{
    const areaClubs = state.clubs.filter(c=>c.area===area);
    const rates = areaClubs.map(c=>clubFiveStarRate(c.name).rate).filter(v=>v!==null);
    const pwVals = areaClubs.map(c=>clubPathwaysPct(c.name)).filter(v=>v!==null);
    const mtVals = areaClubs.map(c=>clubMentorPct(c.name)).filter(v=>v!==null);
    const avgRate = rates.length ? Math.round(rates.reduce((a,b)=>a+b,0)/rates.length) : null;
    const avgPw = pwVals.length ? Math.round(pwVals.reduce((a,b)=>a+b,0)/pwVals.length) : null;
    const avgMt = mtVals.length ? Math.round(mtVals.reduce((a,b)=>a+b,0)/mtVals.length) : null;
    const statusCounts = { Excellent:0, Watch:0, 'At Risk':0, 'No Data':0 };
    areaClubs.forEach(c=>{ statusCounts[computeClubStatus(c.name)]++; });
    areaSummaryRows.push([
      area, state.directors[area] || '', areaClubs.length,
      avgRate===null?'—':avgRate+'%', avgPw===null?'—':avgPw+'%', avgMt===null?'—':avgMt+'%',
      statusCounts.Excellent, statusCounts.Watch, statusCounts['At Risk'], statusCounts['No Data']
    ]);
  });
  const wsAreaSummary = XLSX.utils.aoa_to_sheet(areaSummaryRows);
  wsAreaSummary['!cols'] = [{wch:8},{wch:22},{wch:8},{wch:14},{wch:18},{wch:16},{wch:10},{wch:8},{wch:8},{wch:8}];
  XLSX.utils.book_append_sheet(wb, wsAreaSummary, 'Area Summary');

  // --- Sheet 7: Meetings & Attendance Log ---
  const meetingRows = [['Club', 'Date', 'On Time', 'Speeches', 'Members Present', 'Guests', 'Total Attendance', 'Agenda 3+ Days Early', 'Flyer 2+ Days Early', 'Score (/5)', '5-Star?']];
  [...state.meetings].sort((a,b)=> a.date<b.date?1:-1).forEach(m=>{
    const score = meetingScore(m);
    const members = m.membersPresent||0, guests = m.guests||0;
    meetingRows.push([m.club, m.date, m.onTime?'Yes':'No', m.speeches, members, guests, members+guests, m.agenda?'Yes':'No', m.flyer?'Yes':'No', score, score===5?'Yes':'No']);
  });
  if(meetingRows.length===1) meetingRows.push(['No meetings logged yet','','','','','','','','','','']);
  const wsMeetings = XLSX.utils.aoa_to_sheet(meetingRows);
  wsMeetings['!cols'] = [{wch:32},{wch:12},{wch:9},{wch:10},{wch:14},{wch:8},{wch:16},{wch:20},{wch:20},{wch:10},{wch:9}];
  XLSX.utils.book_append_sheet(wb, wsMeetings, 'Meetings & Attendance');

  // --- Sheet 8: Pathways Log ---
  const pathwaysRows = [['Club', 'Month', 'Active in Path', 'Total Members', 'Adoption %']];
  [...state.pathways].sort((a,b)=> a.month<b.month?1:-1).forEach(r=>{
    pathwaysRows.push([r.club, r.month, r.active, r.total, pct(r.active, r.total)]);
  });
  if(pathwaysRows.length===1) pathwaysRows.push(['No records logged yet','','','','']);
  const wsPathways = XLSX.utils.aoa_to_sheet(pathwaysRows);
  wsPathways['!cols'] = [{wch:32},{wch:10},{wch:16},{wch:16},{wch:12}];
  XLSX.utils.book_append_sheet(wb, wsPathways, 'Pathways Log');

  // --- Sheet 9: Mentors Log ---
  const mentorsRows = [['Club', 'Month', 'Assigned a Mentor', 'Total Members', 'Coverage %']];
  [...state.mentors].sort((a,b)=> a.month<b.month?1:-1).forEach(r=>{
    mentorsRows.push([r.club, r.month, r.assigned, r.total, pct(r.assigned, r.total)]);
  });
  if(mentorsRows.length===1) mentorsRows.push(['No records logged yet','','','','']);
  const wsMentors = XLSX.utils.aoa_to_sheet(mentorsRows);
  wsMentors['!cols'] = [{wch:32},{wch:10},{wch:18},{wch:16},{wch:12}];
  XLSX.utils.book_append_sheet(wb, wsMentors, 'Mentors Log');

  // --- Sheet 10: Club Strength Log ---
  const strengthRows = [['Club', 'Area', 'Month', 'Strength (Total Members)', 'Net Growth vs Prior Month']];
  rosterSorted.forEach(c=>{
    const hist = strengthHistory(c.name);
    hist.forEach((r,i)=>{
      const prior = i>0 ? hist[i-1] : null;
      const delta = prior ? r.strength - prior.strength : null;
      strengthRows.push([c.name, c.area, r.month, r.strength, delta===null?'—':(delta>0?'+':'')+delta]);
    });
  });
  if(strengthRows.length===1) strengthRows.push(['No strength records logged yet','','','','']);
  const wsStrengthLog = XLSX.utils.aoa_to_sheet(strengthRows);
  wsStrengthLog['!cols'] = [{wch:32},{wch:8},{wch:10},{wch:22},{wch:24}];
  XLSX.utils.book_append_sheet(wb, wsStrengthLog, 'Club Strength Log');

  XLSX.writeFile(wb, `Division_B_Club_Health_${today}.xlsx`);
}
document.getElementById('exportExcelBtn').addEventListener('click', exportToExcel);
const exportAllMonthlyBtn = document.getElementById('exportAllMonthlyBtn');
if(exportAllMonthlyBtn) exportAllMonthlyBtn.addEventListener('click', exportAllClubsMonthly);

// ---------- Init ----------
(async function init(){
  if(window.APP_MODE === 'admin'){
    await checkSession();
    if(isAdmin){
      document.getElementById('clubGrid').innerHTML = `<div class="loading">Loading club data…</div>`;
      await loadAll();
      renderAll();
    }
  } else {
    document.getElementById('clubGrid').innerHTML = `<div class="loading">Loading club data…</div>`;
    await loadAll();
    renderAll();
  }
})();
