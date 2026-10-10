// data.json を読み込んでトップページ・試合ページを描画する
const ROUND_NAME = { WC: 'ワイルドカードシリーズ', DS: '地区シリーズ', CS: 'リーグ優勝決定シリーズ', WS: 'ワールドシリーズ' };
const ROUND_FMT = { WC: '3回戦制', DS: '5回戦制', CS: '7回戦制', WS: '7回戦制' };
const ROUND_ORDER = ['WC', 'DS', 'CS', 'WS'];
const LG_NAME = { AL: 'ア・リーグ', NL: 'ナ・リーグ', WS: 'ワールドシリーズ' };
const POS = { C: '捕', '1B': '一', '2B': '二', '3B': '三', SS: '遊', LF: '左', CF: '中', RF: '右', DH: '指', PH: '代打', PR: '代走', P: '投' };
let D;

const $ = id => document.getElementById(id);
const esc = s => String(s ?? '').replace(/[&<>"]/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));
const tname = ab => !ab ? '未定' : D.teams[ab] || { AL: 'ア・リーグ代表', NL: 'ナ・リーグ代表' }[ab] || (ab.includes('/') ? ab.split('/').map(x => D.teams[x] || x).join('／') + 'の勝者' : ab);
const jp = t => esc(tname(t.ab));
const nm = n => esc(D.names[n] || n);
const ip = v => { const w = Math.floor(v), o = Math.round((v - w) * 10); return o ? `${w ? w + ' ' : ''}${o}/3` : `${w}`; };
const jst = (iso, opt) => new Date(iso).toLocaleString('ja-JP', { timeZone: 'Asia/Tokyo', ...opt });
const when = iso => jst(iso, { month: 'numeric', day: 'numeric', weekday: 'short', hour: 'numeric', minute: '2-digit' });
const label = g => `${g.round === 'WS' ? 'ワールドシリーズ' : g.lg + g.round} 第${g.num}戦`;
const hasPage = g => g.state !== 'Preview';

async function load() {
  const r = await fetch('data.json', { cache: 'no-cache' });
  if (!r.ok) throw new Error('data.json を読み込めませんでした');
  D = await r.json();
}

function seriesList() {
  const m = new Map();
  for (const g of D.games) {
    if (!m.has(g.skey)) m.set(g.skey, { key: g.skey, round: g.round, lg: g.lg, games: [], wins: {} });
    m.get(g.skey).games.push(g);
  }
  for (const s of m.values()) {
    const known = s.games.find(g => g.away.ab && g.home.ab) || s.games[0];
    s.teams = [known.away, known.home];
    for (const g of s.games) if (g.state === 'Final') { const w = g.away.win ? g.away.ab : g.home.win ? g.home.ab : null; if (w) s.wins[w] = (s.wins[w] || 0) + 1; }
    const need = { WC: 2, DS: 3, CS: 4, WS: 4 }[s.round];
    s.winner = s.teams.find(t => t.ab && (s.wins[t.ab] || 0) >= need)?.ab || null;
    s.next = s.games.find(g => g.state !== 'Final');
  }
  return [...m.values()];
}

function stamp() {
  const el = $('stamp');
  if (el) el.textContent = `${jst(D.updated, { year: 'numeric', month: 'numeric', day: 'numeric', hour: 'numeric', minute: '2-digit' })}（日本時間）更新`;
}

/* ---------- トップページ ---------- */
function renderIndex() {
  stamp();
  const S = seriesList();
  const sOf = g => S.find(s => s.key === g.skey);

  // 次の試合・試合中
  const live = D.games.filter(g => g.state === 'Live');
  const upcoming = D.games.filter(g => g.state === 'Preview').slice(0, Math.max(0, 3 - live.length));
  const cards = [...live, ...upcoming];
  $('next').innerHTML = cards.length ? cards.map(g => {
    const s = sOf(g);
    const rec = t => D.teams[t.ab] ? `${t.ab} ・ ${s.wins[t.ab] || 0}勝` : '';
    const tag = g.state === 'Live' ? `試合中${g.live ? ` ・ ${g.live.inning}回${g.live.top ? '表' : '裏'}` : ''}` : `${label(g)}${g.ifNec ? '（必要な場合）' : ''}`;
    const score = g.state === 'Live' && g.rhe ? `<div class="vs">${g.rhe.away[0]} - ${g.rhe.home[0]}</div>` : '<div class="vs">@</div>';
    return `<div class="next"><div class="tag">${esc(tag)}</div><div class="when num">${when(g.date)}</div>
      <div class="matchup"><div class="t"><span class="jp">${jp(g.away)}</span><span class="ab">${rec(g.away)}</span></div>${score}
      <div class="t"><span class="jp">${jp(g.home)}</span><span class="ab">${rec(g.home)}</span></div></div>
      ${g.state === 'Live' ? `<div class="note"><a class="more" href="game-${g.pk}.html">試合詳細 →</a></div>` : ''}</div>`;
  }).join('') : '<div class="next"><div class="tag">予定されている試合はありません</div></div>';

  // 勝ち上がり
  const rounds = ROUND_ORDER.filter(r => S.some(s => s.round === r));
  $('bracket').style.gridTemplateColumns = `repeat(${rounds.length},minmax(200px,1fr))`;
  $('bracket').style.minWidth = `${rounds.length * 215}px`;
  $('bracket').innerHTML = rounds.map(r => `<div class="round"><h3>${ROUND_NAME[r]}（${ROUND_FMT[r]}）</h3>${
    S.filter(s => s.round === r).sort((a, b) => a.lg.localeCompare(b.lg)).map(s => {
      const row = t => `<div class="srow${s.winner && t.ab !== s.winner ? ' lost' : ''}"><span class="n"${D.teams[t.ab] ? '' : ' style="color:var(--muted);font-weight:500"'}>${jp(t)}</span><span class="w">${D.teams[t.ab] ? (s.wins[t.ab] || 0) : ''}</span></div>`;
      const st = s.winner ? '<span class="status">決着</span>' : s.next ? `<span class="status live">${s.next.state === 'Live' ? '試合中' : `第${s.next.num}戦 ${jst(s.next.date, { month: 'numeric', day: 'numeric' })}`}</span>` : '';
      return `<div class="series"><span class="lg">${LG_NAME[s.lg] || ''}</span>${row(s.teams[0])}${row(s.teams[1])}${st}</div>`;
    }).join('')}</div>`).join('');

  // 最新の試合結果（新しい順に6試合）
  const latest = D.games.filter(hasPage).slice().sort((x, y) => y.date.localeCompare(x.date)).slice(0, 6);
  $('latest').innerHTML = latest.length ? `<div class="res"><table>${latest.map(g => resultRow(g, true)).join('')}</table></div>` : '<p class="fineprint">まだ試合結果はありません。</p>';

  // 順位表
  const draw = lg => {
    $('divs').innerHTML = Object.entries(D.standings[lg] || {}).map(([d, rows]) => {
      const [, w0, l0] = rows[0];
      return `<div class="div"><h3>${d}</h3><table><thead><tr><th>チーム</th><th>勝</th><th>敗</th><th>勝率</th><th>差</th></tr></thead><tbody>${rows.map(([c, w, l, m]) => {
        const gb = ((w0 - w) + (l - l0)) / 2;
        return `<tr class="${m ? '' : 'out'}"><td>${jp({ ab: c })}${m === 'd' ? '<span class="mark d">地区</span>' : m === 'wc' ? '<span class="mark wc">WC</span>' : ''}</td><td>${w}</td><td>${l}</td><td>${(w / (w + l)).toFixed(3).replace(/^0/, '')}</td><td>${gb === 0 ? '-' : gb}</td></tr>`;
      }).join('')}</tbody></table></div>`;
    }).join('');
    document.querySelectorAll('.tabs button').forEach(b => b.setAttribute('aria-selected', b.dataset.lg === lg));
    try { localStorage.setItem('lg', lg); } catch (e) {}
  };
  document.querySelectorAll('.tabs button').forEach(b => b.addEventListener('click', () => draw(b.dataset.lg)));
  let start = 'AL'; try { start = localStorage.getItem('lg') === 'NL' ? 'NL' : 'AL'; } catch (e) {}
  draw(start);
}


/* ---------- 試合結果 ---------- */
function resultRow(g, withLabel) {
  const r = g.rhe || { away: [g.away.score ?? 0], home: [g.home.score ?? 0] };
  const homeWin = r.home[0] > r.away[0];
  const W = homeWin ? g.home : g.away, L = homeWin ? g.away : g.home, ws = homeWin ? r.home[0] : r.away[0], ls = homeWin ? r.away[0] : r.home[0];
  const live = g.state === 'Live';
  const head = withLabel ? `<td class="g wide">${esc(label(g))}<br><span class="num">${jst(g.date, { month: 'numeric', day: 'numeric' })}</span></td>` : `<td class="g">第${g.num}戦</td>`;
  return `<tr>${head}<td>${live ? `${jp(g.away)} 対 ${jp(g.home)} <span class="ls">（試合中）</span>` : `<span class="wn">${jp(W)}</span> <span class="ls">対 ${jp(L)}</span>`}<a class="more" href="game-${g.pk}.html">詳細 →</a></td>
    <td class="sc">${live ? `${r.away[0]} - ${r.home[0]}` : `<span class="wn">${ws}</span> - <span class="ls">${ls}</span>`}</td></tr>`;
}
function renderResults() {
  stamp();
  const S = seriesList();
  const rounds = ROUND_ORDER.slice().reverse().filter(r => S.some(s => s.round === r && s.games.some(hasPage)));
  $('jump').innerHTML = rounds.map(r => `<a href="#r-${r}">${ROUND_NAME[r]}</a>`).join('');
  $('all').innerHTML = rounds.map(r => `<section class="round-block" id="r-${r}"><h2>${ROUND_NAME[r]}<small>${ROUND_FMT[r]}</small></h2><div class="results">${
    S.filter(s => s.round === r && s.games.some(hasPage)).sort((a, b) => a.lg.localeCompare(b.lg)).map(s => {
      const [a, b] = s.teams;
      const sum = s.winner ? `${jp({ ab: s.winner })}が${s.wins[s.winner]}勝${(s.wins[s.winner === a.ab ? b.ab : a.ab] || 0)}敗で突破` : `${s.wins[a.ab] || 0}勝${s.wins[b.ab] || 0}敗`;
      return `<div class="res"><div class="res-head"><b>${s.lg !== 'WS' ? LG_NAME[s.lg] + ' ' : ''}${jp(a)} 対 ${jp(b)}</b><span>${sum}</span></div><table>${s.games.filter(hasPage).map(g => resultRow(g)).join('')}</table></div>`;
    }).join('')}</div></section>`).join('') || '<p class="fineprint">まだ試合結果はありません。</p>';
}


/* ---------- 選手成績（ポストシーズン通算） ---------- */
function aggregate() {
  const bat = new Map(), pit = new Map();
  for (const g of D.games) {
    if (!g.box || g.state !== 'Final') continue;
    for (const s of ['away', 'home']) {
      const ab = g[s].ab;
      for (const b of g.box[s].bat) {
        const k = b[0] + '|' + ab;
        const o = bat.get(k) || { name: b[0], team: ab, pos: b[1], G: 0, AB: 0, H: 0, RBI: 0, HR: 0, BB: 0, R: 0, D2: 0, D3: 0, HBP: 0, SF: 0, SO: 0, SB: 0 };
        if (!['PH', 'PR'].includes(b[1])) o.pos = b[1];
        o.G++; o.AB += b[2]; o.H += b[3]; o.RBI += b[4]; o.HR += b[5]; o.BB += b[6]; o.R += b[7]; o.D2 += b[8]; o.D3 += b[9];
        o.HBP += b[10] || 0; o.SF += b[11] || 0; o.SO += b[12] || 0; o.SB += b[13] || 0;
        bat.set(k, o);
      }
      for (const p of g.box[s].pit) {
        const k = p[0] + '|' + ab;
        const o = pit.get(k) || { name: p[0], team: ab, G: 0, outs: 0, NP: 0, H: 0, R: 0, ER: 0, SO: 0, BB: 0, HR: 0, W: 0, L: 0, S: 0 };
        const w = Math.floor(p[1]);
        o.G++; o.outs += w * 3 + Math.round((p[1] - w) * 10); o.NP += p[2]; o.H += p[3]; o.R += p[4]; o.ER += p[5]; o.SO += p[6]; o.BB += p[7]; o.HR += p[8];
        if (g.dec) { if (g.dec.W === p[0]) o.W++; if (g.dec.L === p[0]) o.L++; if (g.dec.S === p[0]) o.S++; }
        pit.set(k, o);
      }
    }
  }
  for (const o of bat.values()) {
    const PA = o.AB + o.BB + o.HBP + o.SF, TB = o.H + o.D2 + 2 * o.D3 + 3 * o.HR;
    o.PA = PA; o.AVG = o.AB ? o.H / o.AB : null; o.OBP = PA ? (o.H + o.BB + o.HBP) / PA : null; o.SLG = o.AB ? TB / o.AB : null;
    o.OPS = o.OBP !== null && o.SLG !== null ? o.OBP + o.SLG : null;
  }
  for (const o of pit.values()) { const ipf = o.outs / 3; o.IP = ipf; o.ERA = ipf ? o.ER * 9 / ipf : null; o.WHIP = ipf ? (o.BB + o.H) / ipf : null; }
  return { bat: [...bat.values()], pit: [...pit.values()] };
}
const rate = v => v === null || v === undefined ? '-' : v.toFixed(3).replace(/^0/, '');
const era = v => v === null || v === undefined ? '-' : v.toFixed(2);
const ipOuts = o => `${Math.floor(o / 3)}${o % 3 ? ` ${o % 3}/3` : ''}`;
const BAT_COLS = [['G', '試合'], ['PA', '打席'], ['AB', '打数'], ['H', '安打'], ['HR', '本塁打'], ['RBI', '打点'], ['R', '得点'], ['BB', '四球'], ['SO', '三振'], ['SB', '盗塁'], ['AVG', '打率', rate], ['OBP', '出塁率', rate], ['SLG', '長打率', rate], ['OPS', 'OPS', rate]];
const PIT_COLS = [['G', '登板'], ['W', '勝'], ['L', '敗'], ['S', 'S'], ['outs', '投球回', ipOuts], ['NP', '球数'], ['H', '被安打'], ['HR', '被本'], ['BB', '四球'], ['SO', '奪三振'], ['ER', '自責'], ['ERA', '防御率', era], ['WHIP', 'WHIP', era]];
const ASC = new Set(['ERA', 'WHIP']);
const RATE_KEYS = new Set(['AVG', 'OBP', 'SLG', 'OPS', 'ERA', 'WHIP']);

function renderPlayers() {
  stamp();
  const A = aggregate();
  const games = D.games.filter(g => g.state === 'Final').length;
  $('summary').textContent = `終了した${games}試合の合計。打率などの率は、打者は10打席以上、投手は投球回5回以上の選手に絞って並べています。`;
  const st = { tab: 'bat', key: { bat: 'HR', pit: 'SO' }, team: '' };
  try { const t = localStorage.getItem('ptab'); if (t === 'pit') st.tab = 'pit'; } catch (e) {}

  // 日本人選手
  const jpBat = A.bat.filter(o => D.names[o.name]), jpPit = A.pit.filter(o => D.names[o.name]);
  $('japanese').innerHTML = (jpBat.length || jpPit.length) ? [
    ...jpBat.map(o => `<div class="pcard"><div class="pname">${nm(o.name)}<small>${jp({ ab: o.team })} ・ ${POS[o.pos] || esc(o.pos)}</small></div><div class="pline num">${o.G}試合 ${o.AB}打数${o.H}安打 ${o.HR}本塁打 ${o.RBI}打点</div><div class="pstat"><span>打率 <b class="num">${rate(o.AVG)}</b></span><span>OPS <b class="num">${rate(o.OPS)}</b></span></div></div>`),
    ...jpPit.map(o => `<div class="pcard"><div class="pname">${nm(o.name)}<small>${jp({ ab: o.team })} ・ 投手</small></div><div class="pline num">${o.G}登板 ${o.W}勝${o.L}敗${o.S ? o.S + 'S' : ''} ${ipOuts(o.outs)}回 ${o.SO}奪三振</div><div class="pstat"><span>防御率 <b class="num">${era(o.ERA)}</b></span><span>WHIP <b class="num">${era(o.WHIP)}</b></span></div></div>`)
  ].join('') : '<p class="fineprint">日本人選手の出場はまだありません。</p>';

  // チーム絞り込み
  const teamsIn = [...new Set([...A.bat, ...A.pit].map(o => o.team))].sort((a, b) => tname(a).localeCompare(tname(b), 'ja'));
  $('team').innerHTML = `<option value="">すべてのチーム</option>${teamsIn.map(t => `<option value="${esc(t)}">${jp({ ab: t })}</option>`).join('')}`;
  $('team').addEventListener('change', e => { st.team = e.target.value; draw(); });

  function draw() {
    const cols = st.tab === 'bat' ? BAT_COLS : PIT_COLS, key = st.key[st.tab];
    let rows = (st.tab === 'bat' ? A.bat : A.pit).filter(o => !st.team || o.team === st.team);
    if (RATE_KEYS.has(key)) rows = rows.filter(o => st.tab === 'bat' ? o.PA >= 10 : o.outs >= 15);
    const asc = ASC.has(key);
    rows.sort((x, y) => {
      const a = x[key] ?? (asc ? Infinity : -Infinity), b = y[key] ?? (asc ? Infinity : -Infinity);
      return (asc ? a - b : b - a) || (st.tab === 'bat' ? y.PA - x.PA : y.outs - x.outs);
    });
    const label = cols.find(c => c[0] === key)[1];
    $('caption').textContent = `${label}の${asc ? '低い' : '高い'}順${RATE_KEYS.has(key) ? `（${st.tab === 'bat' ? '10打席以上' : '投球回5回以上'}）` : ''} ・ ${rows.length}人`;
    $('ptable').innerHTML = `<thead><tr><th class="rk">#</th><th>${st.tab === 'bat' ? '打者' : '投手'}</th><th>チーム</th>${cols.map(([k, l]) => `<th><button class="sort" data-k="${k}" aria-pressed="${k === key}">${l}${k === key ? (asc ? ' ▲' : ' ▼') : ''}</button></th>`).join('')}</tr></thead>
      <tbody>${rows.map((o, i) => `<tr class="${D.names[o.name] ? 'jpn' : ''}"><td class="rk">${i + 1}</td><td>${nm(o.name)}</td><td class="tm">${jp({ ab: o.team })}</td>${cols.map(([k, , f]) => `<td class="${k === key ? 'on' : ''}">${f ? f(o[k]) : o[k]}</td>`).join('')}</tr>`).join('')}</tbody>`;
    document.querySelectorAll('#ptable .sort').forEach(b => b.addEventListener('click', () => { st.key[st.tab] = b.dataset.k; draw(); }));
    document.querySelectorAll('.ptabs button').forEach(b => b.setAttribute('aria-selected', b.dataset.t === st.tab));
    try { localStorage.setItem('ptab', st.tab); } catch (e) {}
  }
  document.querySelectorAll('.ptabs button').forEach(b => b.addEventListener('click', () => { st.tab = b.dataset.t; draw(); }));
  draw();
}

/* ---------- 試合ページ ---------- */
function autoPoints(g) {
  const out = [];
  const B = g.box; if (!B) return out;
  for (const [s, t] of [['away', g.away], ['home', g.home]]) {
    for (const b of B[s].bat) {
      const p = []; if (b[5]) p.push(b[5] > 1 ? `本塁打${b[5]}本` : '本塁打'); if (b[9]) p.push('三塁打'); if (b[8]) p.push(b[8] > 1 ? `二塁打${b[8]}本` : '二塁打');
      if (b[5] || b[4] >= 2 || (b[3] >= 2 && (b[4] || b[8] || b[9])) || b[3] >= 3) out.push(`${jp(t)}の${nm(b[0])}：${b[2]}打数${b[3]}安打${b[4] ? b[4] + '打点' : ''}${p.length ? '（' + p.join('・') + '）' : ''}`);
    }
    for (const p of B[s].pit) if (p[6] >= 6 || (p[1] >= 6 && p[5] <= 1)) out.push(`${jp(t)}の${nm(p[0])}：${ip(p[1])}回を${p[3]}安打${p[5]}自責点、${p[6]}奪三振`);
  }
  return out;
}
function batTable(rows) {
  return `<div class="tbl"><table><thead><tr><th>打者</th><th>守</th><th>打数</th><th>安打</th><th>打点</th><th>本</th><th>四球</th><th>得点</th></tr></thead><tbody>${rows.map(b => {
    const hot = b[5] || b[4] >= 2 || b[3] >= 2;
    return `<tr class="${hot ? 'hot' : ''}"><td>${nm(b[0])}</td><td class="pos">${POS[b[1]] || esc(b[1])}</td><td>${b[2]}</td><td class="${b[3] >= 2 ? 'hl' : ''}">${b[3]}</td><td class="${b[4] >= 2 ? 'hl' : ''}">${b[4]}</td><td class="${b[5] ? 'hl' : ''}">${b[5] || ''}</td><td>${b[6] || ''}</td><td>${b[7] || ''}</td></tr>`;
  }).join('')}</tbody></table></div>`;
}
function pitTable(rows, dec) {
  const mark = n => !dec ? '' : n === dec.W ? ' (勝)' : n === dec.L ? ' (敗)' : n === dec.S ? ' (S)' : '';
  return `<div class="tbl"><table><thead><tr><th>投手</th><th>投球回</th><th>球数</th><th>被安打</th><th>失点</th><th>自責</th><th>奪三振</th><th>四球</th></tr></thead><tbody>${rows.map(p => `<tr class="${mark(p[0]) ? 'hot' : ''}"><td>${nm(p[0])}${mark(p[0])}</td><td>${ip(p[1])}</td><td>${p[2]}</td><td>${p[3]}</td><td>${p[4]}</td><td>${p[5]}</td><td class="${p[6] >= 5 ? 'hl' : ''}">${p[6]}</td><td>${p[7] || ''}</td></tr>`).join('')}</tbody></table></div>`;
}
function renderGame(pk) {
  stamp();
  const g = D.games.find(x => x.pk === pk);
  if (!g) { $('detail').innerHTML = '<p>この試合のデータが見つかりませんでした。</p>'; return; }
  const n = Math.max(9, g.line ? g.line.away.length : 9);
  const cell = v => v === null || v === undefined ? '<td class="zero">x</td>' : `<td class="${v === 0 ? 'zero' : ''}">${v}</td>`;
  const row = s => `<tr><td>${jp(g[s])}</td>${Array.from({ length: n }, (_, i) => g.line ? cell(g.line[s][i]) : '<td class="zero"></td>').join('')}${(g.rhe ? g.rhe[s] : ['', '', '']).map(v => `<td class="tot">${v}</td>`).join('')}</tr>`;
  const status = g.state === 'Live' ? `試合中${g.live ? ` ・ ${g.live.inning}回${g.live.top ? '表' : '裏'}` : ''}` : g.state === 'Final' ? '試合終了' : '';
  const pts = g.notes?.pts || autoPoints(g);
  const d = g.dec || {};
  $('detail').innerHTML = `
   <div class="linescore-wrap">
    <div class="ls-title"><b>${esc(label(g))}</b><span class="num">${when(g.date)}（日本時間）</span><span>${esc(g.notes?.note || status)}</span></div>
    <div class="ls-scroll"><table class="linescore"><thead><tr><th></th>${Array.from({ length: n }, (_, i) => `<th>${i + 1}</th>`).join('')}<th>計</th><th>安</th><th>失</th></tr></thead><tbody>${row('away')}${row('home')}</tbody></table></div>
    ${d.W || d.L ? `<div class="decisions"><span><b>勝</b>${nm(d.W)}</span><span><b>敗</b>${nm(d.L)}</span>${d.S ? `<span><b>S</b>${nm(d.S)}</span>` : ''}</div>` : `<div class="decisions"><span>${esc(status)}</span></div>`}
   </div>
   ${pts.length ? `<div><h3 style="font-size:15px;margin-bottom:6px">${g.notes?.pts ? '試合の流れ' : 'この試合のポイント'}</h3><ul class="points">${pts.map(p => `<li>${g.notes?.pts ? esc(p) : p}</li>`).join('')}</ul></div>` : ''}
   ${g.box ? `<div class="teams2">${['away', 'home'].map(s => `<div class="box"><h3>${jp(g[s])}<span>${s === 'away' ? 'ビジター' : 'ホーム'}${g.box[s].risp ? ` ・ 得点圏 ${g.box[s].risp[1]}打数${g.box[s].risp[0]}安打` : ''}</span></h3><h4>打撃成績</h4>${batTable(g.box[s].bat)}<h4>投手成績</h4>${pitTable(g.box[s].pit, g.dec)}</div>`).join('')}</div>` : ''}`;

  const list = D.games.filter(hasPage);
  const i = list.findIndex(x => x.pk === pk), p = list[i - 1], q = list[i + 1];
  const lnk = (x, dir) => x ? `<a class="gnav-${dir}" href="game-${x.pk}.html"><small>${dir === 'prev' ? '← 前の試合' : '次の試合 →'}</small><span>${jp(x.away)} 対 ${jp(x.home)}（${esc(label(x))}）</span></a>` : '<span></span>';
  $('gnav').innerHTML = lnk(p, 'prev') + lnk(q, 'next');
}

window.MLB = { start: async (page, pk) => {
  try { await load(); page === 'game' ? renderGame(pk) : page === 'results' ? renderResults() : page === 'players' ? renderPlayers() : renderIndex(); }
  catch (e) { const el = $('detail') || $('next') || $('all') || $('summary'); if (el) el.innerHTML = `<p>${esc(e.message)}。時間をおいて再読み込みしてください。</p>`; }
} };
