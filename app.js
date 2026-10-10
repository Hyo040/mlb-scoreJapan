// data.json を読み込んでトップページ・試合ページを描画する
const ROUND_NAME = { WC: 'ワイルドカードシリーズ', DS: '地区シリーズ', CS: 'リーグ優勝決定シリーズ', WS: 'ワールドシリーズ' };
const ROUND_FMT = { WC: '3回戦制', DS: '5回戦制', CS: '7回戦制', WS: '7回戦制' };
const ROUND_ORDER = ['WC', 'DS', 'CS', 'WS'];
const LG_NAME = { AL: 'ア・リーグ', NL: 'ナ・リーグ', WS: 'ワールドシリーズ' };
const POS = { C: '捕', '1B': '一', '2B': '二', '3B': '三', SS: '遊', LF: '左', CF: '中', RF: '右', DH: '指', PH: '代打', PR: '代走', P: '投' };
let D;

const $ = id => document.getElementById(id);
const esc = s => String(s ?? '').replace(/[&<>"]/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));
const jp = t => esc(D.teams[t.ab] || (t.ab ? t.ab : '未定'));
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
    const rec = t => t.ab ? `${t.ab} ・ ${s.wins[t.ab] || 0}勝` : '';
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
      const row = t => `<div class="srow${s.winner && t.ab !== s.winner ? ' lost' : ''}"><span class="n">${jp(t)}</span><span class="w">${t.ab ? (s.wins[t.ab] || 0) : ''}</span></div>`;
      const st = s.winner ? '<span class="status">決着</span>' : s.next ? `<span class="status live">${s.next.state === 'Live' ? '試合中' : `第${s.next.num}戦 ${jst(s.next.date, { month: 'numeric', day: 'numeric' })}`}</span>` : '';
      return `<div class="series"><span class="lg">${LG_NAME[s.lg] || ''}</span>${row(s.teams[0])}${row(s.teams[1])}${st}</div>`;
    }).join('')}</div>`).join('');

  // 試合結果（新しいラウンドから）
  const played = S.filter(s => s.games.some(hasPage)).sort((a, b) => ROUND_ORDER.indexOf(b.round) - ROUND_ORDER.indexOf(a.round) || a.lg.localeCompare(b.lg));
  $('results').innerHTML = played.map(s => {
    const [a, b] = s.teams;
    const sum = s.winner ? `${jp({ ab: s.winner })}が${s.wins[s.winner]}勝${(s.wins[s.winner === a.ab ? b.ab : a.ab] || 0)}敗で突破` : `${s.wins[a.ab] || 0}勝${s.wins[b.ab] || 0}敗`;
    const rows = s.games.filter(hasPage).map(g => {
      const r = g.rhe || { away: [g.away.score ?? 0], home: [g.home.score ?? 0] };
      const homeWin = r.home[0] > r.away[0];
      const W = homeWin ? g.home : g.away, L = homeWin ? g.away : g.home, ws = homeWin ? r.home[0] : r.away[0], ls = homeWin ? r.away[0] : r.home[0];
      const live = g.state === 'Live';
      return `<tr><td class="g">第${g.num}戦</td><td>${live ? `${jp(g.away)} 対 ${jp(g.home)} <span class="ls">（試合中）</span>` : `<span class="wn">${jp(W)}</span> <span class="ls">対 ${jp(L)}</span>`}<a class="more" href="game-${g.pk}.html">詳細 →</a></td>
        <td class="sc">${live ? `${r.away[0]} - ${r.home[0]}` : `<span class="wn">${ws}</span> - <span class="ls">${ls}</span>`}</td></tr>`;
    }).join('');
    return `<div class="res"><div class="res-head"><b>${LG_NAME[s.lg] && s.lg !== 'WS' ? LG_NAME[s.lg] + ' ' : ''}${ROUND_NAME[s.round]}</b><span>${jp(a)} 対 ${jp(b)} ・ ${sum}</span></div><table>${rows}</table></div>`;
  }).join('');

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
  try { await load(); page === 'game' ? renderGame(pk) : renderIndex(); }
  catch (e) { const el = $('detail') || $('next'); if (el) el.innerHTML = `<p>${esc(e.message)}。時間をおいて再読み込みしてください。</p>`; }
} };
