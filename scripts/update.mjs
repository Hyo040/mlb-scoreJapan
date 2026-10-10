// MLB公式データ（statsapi.mlb.com）からポストシーズンの日程・スコア・個人成績と
// レギュラーシーズンの最終順位を取得し、data.json と試合ページ（game-<試合ID>.html）を作り直す。
// 実行: node scripts/update.mjs   （GitHub Actions から1時間ごとに実行）
import fs from 'node:fs/promises';
import path from 'node:path';

const ROOT = path.resolve(path.dirname(new URL(import.meta.url).pathname), '..');
const API = 'https://statsapi.mlb.com/api/v1';
const SEASON = Number(process.env.SEASON || 2026);
const ROUND = { F: 'WC', D: 'DS', L: 'CS', W: 'WS' };
const DIV = { 201: ['AL', '東地区'], 202: ['AL', '中地区'], 200: ['AL', '西地区'], 204: ['NL', '東地区'], 205: ['NL', '中地区'], 203: ['NL', '西地区'] };
const DIV_ORDER = ['東地区', '中地区', '西地区'];
const BOXV = 2; // 個人成績の項目を変えたら上げる（取得済みの試合も取り直す）

const sleep = ms => new Promise(r => setTimeout(r, ms));
async function get(url) {
  let last;
  for (let i = 0; i < 3; i++) {
    try {
      const r = await fetch(url, { headers: { 'User-Agent': 'mlb-scorejapan (personal non-commercial fan site)' } });
      if (r.ok) return await r.json();
      last = new Error(`HTTP ${r.status} ${url}`);
    } catch (e) { last = e; }
    await sleep(2000 * (i + 1));
  }
  throw last;
}
const readJson = async (f, fallback) => { try { return JSON.parse(await fs.readFile(path.join(ROOT, f), 'utf8')); } catch { return fallback; } };

function team(t) {
  const tm = t?.team || {};
  const lid = tm.league?.id;
  return { ab: tm.abbreviation || null, name: tm.name || '未定', league: lid === 103 ? 'AL' : lid === 104 ? 'NL' : null };
}

export function fromSchedule(g) {
  const L = g.linescore || {};
  const a = team(g.teams.away), h = team(g.teams.home);
  const desc = g.description || '';
  const lg = g.gameType === 'W' ? 'WS' : /^AL/.test(desc) ? 'AL' : /^NL/.test(desc) ? 'NL' : (a.league || h.league || '');
  const letter = (desc.match(/'([A-Z])'/) || [])[1];
  const pair = [a.ab, h.ab].filter(Boolean).sort().join('-');
  const skey = `${ROUND[g.gameType]}-${lg}-${letter || (g.gameType === 'F' || g.gameType === 'D' ? pair : '')}`;
  const side = s => ({ ...(s === 'away' ? a : h), score: g.teams[s].score ?? null, win: !!g.teams[s].isWinner });
  const inn = L.innings || [];
  return {
    pk: g.gamePk, date: g.gameDate, state: g.status.abstractGameState, detail: g.status.detailedState,
    round: ROUND[g.gameType], lg, skey, num: g.seriesGameNumber || null, of: g.gamesInSeries || null, ifNec: g.ifNecessary === 'Y',
    venue: g.venue?.name || null,
    away: side('away'), home: side('home'),
    line: inn.length ? { away: inn.map(i => i.away?.runs ?? null), home: inn.map(i => i.home?.runs ?? null) } : null,
    rhe: L.teams ? { away: [L.teams.away?.runs ?? 0, L.teams.away?.hits ?? 0, L.teams.away?.errors ?? 0], home: [L.teams.home?.runs ?? 0, L.teams.home?.hits ?? 0, L.teams.home?.errors ?? 0] } : null,
    live: g.status.abstractGameState === 'Live' && L.currentInning ? { inning: L.currentInning, top: !!L.isTopInning } : null,
    dec: g.decisions ? { W: g.decisions.winner?.fullName || null, L: g.decisions.loser?.fullName || null, S: g.decisions.save?.fullName || null } : null,
  };
}

export function fromBox(b) {
  const side = s => {
    const t = b.teams[s];
    const P = id => t.players['ID' + id];
    const bat = (t.batters || []).map(P).filter(p => p && p.stats?.batting && Object.keys(p.stats.batting).length).map(p => {
      const x = p.stats.batting;
      return [p.person.fullName, p.position?.abbreviation || '', x.atBats ?? 0, x.hits ?? 0, x.rbi ?? 0, x.homeRuns ?? 0, x.baseOnBalls ?? 0, x.runs ?? 0, x.doubles ?? 0, x.triples ?? 0, x.hitByPitch ?? 0, x.sacFlies ?? 0, x.strikeOuts ?? 0, x.stolenBases ?? 0];
    });
    const pit = (t.pitchers || []).map(P).filter(p => p && p.stats?.pitching && Object.keys(p.stats.pitching).length).map(p => {
      const x = p.stats.pitching;
      return [p.person.fullName, Number(x.inningsPitched ?? 0), x.numberOfPitches ?? 0, x.hits ?? 0, x.runs ?? 0, x.earnedRuns ?? 0, x.strikeOuts ?? 0, x.baseOnBalls ?? 0, x.homeRuns ?? 0];
    });
    const f = (t.info || []).flatMap(i => i.fieldList || []).find(x => /RISP/.test(x.label || ''));
    const m = f && String(f.value).match(/(\d+)-for-(\d+)/);
    return { bat, pit, risp: m ? [Number(m[1]), Number(m[2])] : null };
  };
  return { away: side('away'), home: side('home') };
}

async function main() {
  const prev = await readJson('data.json', { games: [] });
  const prevByPk = new Map((prev.games || []).map(g => [g.pk, g]));
  const notes = await readJson('notes.json', {});
  const teams = await readJson('teams.json', {});
  const names = await readJson('names.json', {});

  // 1) ポストシーズン日程（スコア・イニング別得点・勝敗投手つき）
  const sch = await get(`${API}/schedule?sportId=1&season=${SEASON}&gameType=F,D,L,W&hydrate=linescore,decisions,team,venue`);
  const games = (sch.dates || []).flatMap(d => d.games)
    .filter(g => !/Cancel|Postponed/i.test(g.status?.detailedState || ''))
    .map(fromSchedule)
    .sort((x, y) => x.date.localeCompare(y.date) || x.pk - y.pk);

  // 2) 個人成績（終了済みで前回取得済みのものは再取得しない）
  for (const g of games) {
    const old = prevByPk.get(g.pk);
    if (g.state === 'Final' && old?.state === 'Final' && old.box && old.boxv === BOXV) { g.box = old.box; g.boxv = BOXV; if (notes[g.pk]) g.notes = notes[g.pk]; continue; }
    if (g.state === 'Final' || g.state === 'Live') {
      try { g.box = fromBox(await get(`${API}/game/${g.pk}/boxscore`)); g.boxv = BOXV; } catch (e) { console.warn('box failed', g.pk, e.message); if (old?.box) g.box = old.box; }
      await sleep(300);
    }
    if (notes[g.pk]) g.notes = notes[g.pk];
  }

  // 3) レギュラーシーズン順位
  const post = new Set(games.flatMap(g => [g.away.ab, g.home.ab]).filter(Boolean));
  const st = await get(`${API}/standings?leagueId=103,104&season=${SEASON}&standingsTypes=regularSeason&hydrate=team`);
  const standings = { AL: {}, NL: {} };
  const tmp = { AL: {}, NL: {} };
  for (const rec of st.records || []) {
    const d = DIV[rec.division?.id];
    if (!d) continue;
    tmp[d[0]][d[1]] = rec.teamRecords
      .slice().sort((x, y) => Number(x.divisionRank) - Number(y.divisionRank))
      .map(tr => [tr.team.abbreviation, tr.wins, tr.losses, tr.divisionChamp ? 'd' : post.has(tr.team.abbreviation) ? 'wc' : '']);
  }
  for (const lg of ['AL', 'NL']) for (const dn of DIV_ORDER) if (tmp[lg][dn]) standings[lg][dn] = tmp[lg][dn];

  const data = { updated: new Date().toISOString(), season: SEASON, teams, names, games, standings };

  // 前回と中身が同じなら更新時刻も変えない（不要なコミットを避ける）
  const strip = o => JSON.stringify({ ...o, updated: null });
  if (strip(prev) === strip(data)) { console.log('no changes'); return; }
  await fs.writeFile(path.join(ROOT, 'data.json'), JSON.stringify(data));

  // 4) 試合ページ（始まった試合だけ）を作り直す
  const tpl = await fs.readFile(path.join(ROOT, 'scripts', 'game-template.html'), 'utf8');
  const want = new Set();
  const jp = t => teams[t.ab] || t.name;
  for (const g of games) {
    if (g.state === 'Preview') continue;
    const file = `game-${g.pk}.html`;
    want.add(file);
    const label = `${g.round === 'WS' ? 'ワールドシリーズ' : g.lg + g.round} 第${g.num}戦`;
    await fs.writeFile(path.join(ROOT, file), tpl.replaceAll('{{PK}}', String(g.pk)).replaceAll('{{TITLE}}', `${jp(g.away)}対${jp(g.home)} ${label}`));
  }
  for (const f of await fs.readdir(ROOT)) if (/^game-\d+\.html$/.test(f) && !want.has(f)) await fs.unlink(path.join(ROOT, f));
  console.log(`updated: ${games.length} games, ${want.size} game pages`);
}

if (import.meta.url === `file://${process.argv[1]}`) main().catch(e => { console.error(e); process.exit(1); });
