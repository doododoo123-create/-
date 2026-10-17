import { createDemoWorld } from './data/demo-world.js';
import { clone, blankWorld, newId, validateWorld, removeCountry, PERSONALITIES, MINISTER_STYLES, DEFAULT_RULES, neighbors, ROLES, landCount, countryPeople, findCountry, totalTroops, production } from './model/world.js';
import { createRun, nextTurn, currentActor, livingCountries, ENGINE_VERSION } from './engine/simulation.js';
import { saveWorld, loadWorld, serializeWorld, parseWorld, downloadFile, fileName } from './storage/world-store.js';
import { saveRun, loadRun, clearRun } from './storage/run-store.js';
import { icon, esc, format } from './ui/icons.js';
import { portraitImage, portraitSource, portraitChoices, portraitLabel } from './ui/portraits.js';
import { renderAtlas, renderNationCards, renderCommanders } from './ui/atlas-view.js';
import { renderArena } from './ui/arena-view.js';
import { TurnPlayback } from './ui/playback.js';

const $ = selector => document.querySelector(selector);
let initialError = '';
let world;
try { world = loadWorld(localStorage) || createDemoWorld(); } catch (error) { world = createDemoWorld(); initialError = error.message + ' 시작 예제를 표시합니다. 기존 저장 데이터는 덮어쓰지 않았습니다.'; }
const ui = { page: 'overview', selected: world.territories[0]?.id, paint: false, brush: world.countries[0]?.id || '', countryFilter: '', roleFilter: '', search: '', showNames: true, recording: false, seed: '20261017', speed: 1, mapStyle: 'atlas', focusedCountry: null };
let auto = false;
let run = null, timer = null, saveStatus = initialError ? '저장 복구 확인 필요' : '브라우저에 자동 저장', toastTimer;
const playback = new TurnPlayback({
  onChange: () => { if (ui.page === 'simulation') render(); },
  onFinish: () => {
    try { if(run)saveRun(localStorage,run); } catch(error) { notify(error.message,true); }
    if (auto && !run?.result) timer = setTimeout(() => { timer = null; beginTurn(); }, 850 / ui.speed);
    else auto = false;
    if (ui.page === 'simulation') render();
  },
  speed: () => ui.speed,
  reducedMotion: () => window.matchMedia('(prefers-reduced-motion: reduce)').matches,
});
const pages = { overview: ['globe', '세계 개요'], countries: ['flag', '국가 관리'], people: ['people', '인물 관리'], map: ['map', '지도 · 영토'], simulation: ['play', '시뮬레이션'], rules: ['settings', '규칙 설정'] };
const dot = color => `<span class="dot" style="--color:${esc(color)}"></span>`;
const countryOptions = (selected, empty = '무소속') => `<option value="">${empty}</option>${world.countries.map(c => `<option value="${esc(c.id)}" ${selected === c.id ? 'selected' : ''}>${esc(c.name)}</option>`).join('')}`;
const traitOptions = selected => Object.entries(PERSONALITIES).map(([v, label]) => `<option value="${v}" ${v === selected ? 'selected' : ''}>${label}</option>`).join('');
const button = (action, label, glyph = '', cls = '', extra = '') => `<button type="button" class="button ${cls}" data-action="${action}" ${extra}>${glyph ? icon(glyph, 16) : ''}${label}</button>`;
function notify(message, error = false) {
  clearTimeout(toastTimer); const el = $('#toast'); el.hidden = false; el.className = `toast ${error ? 'error' : ''}`;
  el.textContent = message; toastTimer = setTimeout(() => { el.hidden = true; }, error ? 9000 : 3500);
}
function persist(showMessage = false) {
  try { saveWorld(localStorage, world); saveStatus = '브라우저에 자동 저장'; if (showMessage) notify('현재 세계를 이 브라우저에 저장했습니다. 다른 기기로 옮길 때는 파일 내보내기를 사용하세요.'); }
  catch (error) { saveStatus = '저장 실패 · 파일로 내보내 주세요'; notify(error.message, true); }
}
function updateWorld(next) { world = validateWorld(next); persist(); render(); }
function stop() { if (timer) clearTimeout(timer); timer = null; auto = false; playback.pause(); }
function navigate(page) { if (!Object.hasOwn(pages, page)) return; stop(); ui.page = page; ui.recording = false; render(); }
function setNewWorld(next) {
  stop(); playback.reset(); world = validateWorld(next); run = null; clearRun(localStorage); ui.selected = world.territories[0]?.id; ui.brush = world.countries[0]?.id || ''; ui.paint = false; ui.search = ''; ui.countryFilter = ''; ui.roleFilter = ''; ui.page = 'overview'; persist(); render();
}
function render() {
  document.title = `${world.name} · 사국쟁패 Studio`;
  $('#app').className = ui.recording ? 'recording-mode' : '';
  $('#app').innerHTML = `
    <aside class="sidebar">
      <a class="brand" href="#" data-page="overview" aria-label="사국쟁패 Studio 세계 개요"><span class="brand-symbol">${icon('compass', 29)}</span><span><strong>사국쟁패</strong><small>HISTORY STUDIO</small></span></a>
      <div class="workspace-label">WORKSPACE <span>v0.2.0</span></div>
      <button class="world-switch" data-action="world-meta"><span class="world-icon">${icon('globe', 19)}</span><span><b>${esc(world.name)}</b><small>나의 세계 · 편집 가능</small></span>${icon('edit', 13)}</button>
      <div class="nav-label">세계 만들기</div>
      <nav aria-label="주요 메뉴">${Object.entries(pages).slice(0, 4).map(([key, [glyph, label]]) => navItem(key, glyph, label)).join('')}<div class="nav-label nav-second">역사 관찰하기</div>${Object.entries(pages).slice(4).map(([key, [glyph, label]]) => navItem(key, glyph, label)).join('')}</nav>
      <div class="sidebar-bottom"><div class="local-note">${icon('save', 15)}<div><b>당신의 세계는 이곳에</b><small>데이터는 이 브라우저에 보관됩니다.</small></div></div><a href="./docs/reference/legacy-play.html" target="_blank" rel="noopener" class="legacy-link">${icon('book', 15)}기존 시뮬레이터 열기 ${icon('arrow', 13)}</a><p>만들고, 관찰하고, 다시 쓰는 역사.</p></div>
    </aside>
    <div class="workspace">
      <header class="topbar"><div class="breadcrumb">내 작업실 ${icon('chevron', 12)} <span>${esc(world.name)}</span></div><div class="top-actions"><span class="save-status">${icon('check', 13)}${esc(saveStatus)}</span>${button('save', '세계 저장', 'save', 'subtle')}${button('import', '불러오기', 'upload', 'subtle')}${button('export', '파일 내보내기', 'download', 'outline')}</div></header>
      <main id="main-content" class="${ui.page === 'simulation' ? 'simulation-page' : ''} ${playback.state&&!playback.playing&&!playback.complete?'playback-paused':''}" tabindex="-1">
        ${pageHeading()}
        ${ui.page === 'overview' ? overview() : ui.page === 'countries' ? countriesPage() : ui.page === 'people' ? peoplePage() : ui.page === 'map' ? mapPage() : ui.page === 'simulation' ? simulationPage() : rulesPage()}
        <footer class="page-footer"><span>사국쟁패 Studio <b>v0.2.0</b></span><span>모든 역사는 당신의 세계에서 시작됩니다.</span><span>LOCAL FIRST ${dot('#91a67a')}</span></footer>
      </main>
    </div>`;
}
function navItem(key, glyph, label) { return `<button class="nav-item ${ui.page === key ? 'active' : ''}" data-page="${key}" ${ui.page === key ? 'aria-current="page"' : ''}>${icon(glyph, 19)}${label}${key === 'countries' || key === 'people' ? `<span class="nav-count">${key === 'countries' ? world.countries.length : world.people.length}</span>` : ''}</button>`; }
function pageHeading() {
  const descriptions = { overview: '세계를 설계하고, 아직 쓰이지 않은 역사를 시작하세요.', countries: '서로 다른 국가들이 만들어 갈 역사의 출발점을 정하세요.', people: '나라를 다스릴 국왕과 승상, 전장을 이끌 장군을 구성하세요.', map: '영토를 선택해 이름과 소유 국가를 직접 정하세요.', simulation: '주사위가 만드는 새로운 역사를 한 턴씩 관찰하세요.', rules: '첨부 룰북 v11과 HTML의 시스템을 기준으로 실행합니다.' };
  const actions = ui.page === 'overview' ? button('new-world', '새 세계 만들기', 'plus', 'outline') + button('go-simulation', '시뮬레이션 시작', 'play', 'primary') : ui.page === 'countries' ? button('add-country', '국가 추가', 'plus', 'primary') : ui.page === 'people' ? button('add-person', '인물 추가', 'plus', 'primary') : ui.page === 'map' ? `<label class="toggle-label"><input type="checkbox" id="show-names" ${ui.showNames ? 'checked' : ''}> 영토 이름 표시</label>` : ui.page === 'simulation' ? button('recording', ui.recording ? '편집 화면으로' : '관찰 화면', 'expand', 'outline') : '';
  return `<div class="page-heading"><div><div class="eyebrow">${ui.page === 'simulation' ? 'OBSERVE YOUR HISTORY' : 'BUILD YOUR WORLD'}<span class="version-tag">SYSTEM v11</span></div><h1>${pages[ui.page][1]}</h1><p>${descriptions[ui.page]}</p></div><div class="heading-actions">${actions}</div></div>`;
}
function statsBar(data = world, simulation = false) {
  return `<div class="stats-grid">${[
    ['flag', '국가', `${simulation ? livingCountries(data).length : data.countries.length}`, '개국', simulation ? '생존 국가' : '자유롭게 추가하고 편집하세요'],
    ['people', '등장인물', format(data.people.length), '명', '국왕 · 승상 · 장군'],
    ['map', '전체 영토', format(data.territories.length), '개', `${data.mapKind==='v11'?'원본 v11 대륙 지도':`${data.cols} × ${data.rows} 격자 지도`}`],
    ['sword', '총병력', format(totalTroops(data)), '만', simulation ? `현재 ${run.round}라운드 · ${run.turn}턴 진행` : '국가별 초기 병력 합계'],
  ].map(([glyph, label, value, unit, sub]) => `<section class="stat-card"><div><span>${label}</span><span class="stat-icon">${icon(glyph, 19)}</span></div><strong>${value}<small>${unit}</small></strong><p>${sub}</p></section>`).join('')}</div>`;
}
const previews=new WeakMap();
function previewWorld(data){if(data!==world)return data;if(!previews.has(data)){try{previews.set(data,createRun(data,123456).world);}catch{previews.set(data,data);}}return previews.get(data);}
function mapPanel(data, editing = false, simulation = false) {
  if (!editing && ui.mapStyle === 'atlas') {
    data=previewWorld(data);
    const presentation = simulation ? playback.state : null;
    return `<section class="panel map-panel atlas-panel"><div class="panel-head"><div><span class="eyebrow">ATLAS OF YOUR WORLD</span><h2>${esc(data.name)} <span class="tiny-badge">대륙 전도</span></h2></div><label class="map-view-select">지도 표시<select id="map-style" aria-label="지도 표시 방식"><option value="atlas" selected>대륙형</option><option value="grid">격자형</option></select></label></div>${renderAtlas(data, {selected: ui.selected, observe: simulation, showNames: ui.showNames, presentation, focusedCountry: ui.focusedCountry})}<div class="atlas-map-note"><span>${icon('sword',14)} 국왕: 수도 예비병 · 장군: 개별 주둔군 · 화살표: 전투 경로</span><span>${data.mapKind==='v11'?'원본 지도 인접 관계':'상하좌우 인접 관계'}</span></div><div class="map-legend">${data.countries.map(c => `<span>${dot(c.color)}${esc(c.name)}</span>`).join('')}</div>${!simulation ? `<div class="map-panel-footer"><span>영토를 선택해 정보를 확인하세요.</span><button class="text-button" data-page="map">지도 편집하기 ${icon('arrow', 15)}</button></div>` : ''}</section>`;
  }

  const last = simulation ? run?.history.at(-1) : null;
  const changed = new Set(last?.changes.map(c => c.territoryId) || []);
  return `<section class="panel map-panel"><div class="panel-head"><div><span class="eyebrow">WORLD MAP</span><h2>${esc(data.name)} <span class="tiny-badge">${editing ? '편집 모드' : simulation ? '관찰 모드' : '격자 지도'}</span></h2></div><span class="map-dimensions">${icon('layers', 14)} ${data.cols} × ${data.rows} · ${data.territories.length}개 영토</span>${!editing ? '<label class="map-view-select">지도 표시<select id="map-style" aria-label="지도 표시 방식"><option value="atlas">대륙형</option><option value="grid" selected>격자형</option></select></label>' : ''}</div>
  ${editing ? `<div class="map-tools"><div class="segmented"><button data-action="select-mode" class="${!ui.paint ? 'selected' : ''}">${icon('edit', 14)} 하나씩 편집</button><button data-action="paint-mode" class="${ui.paint ? 'selected' : ''}">${icon('flag', 14)} 소유권 칠하기</button></div>${ui.paint ? `<label>칠할 국가 <select id="paint-owner" aria-label="칠할 국가">${countryOptions(ui.brush, '무주지')}</select></label>` : '<span>영토를 누르면 오른쪽에서 수정할 수 있어요.</span>'}</div>` : ''}
    <div class="map-canvas ${editing ? 'editable' : ''}"><div class="map-coordinate-top">${Array.from({length: data.cols}, (_, i) => `<span>${String.fromCharCode(65 + i)}</span>`).join('')}</div><div class="grid-frame"><div class="map-coordinate-left">${Array.from({length: data.rows}, (_, i) => `<span>${String(i + 1).padStart(2, '0')}</span>`).join('')}</div><div class="territory-grid ${ui.showNames ? '' : 'hide-names'}" style="--cols:${data.cols};--rows:${data.rows}">${data.territories.map(t => {
      const c = findCountry(data, t.ownerId);
      const countryColor = c?.color || '#657066';
      const left = data.territories.find(n => n.row === t.row && n.col === t.col - 1), top = data.territories.find(n => n.row === t.row - 1 && n.col === t.col);
      return `<button class="territory ${ui.selected === t.id && !simulation ? 'selected' : ''} ${changed.has(t.id) ? 'captured' : ''} ${left && left.ownerId !== t.ownerId ? 'border-left' : ''} ${top && top.ownerId !== t.ownerId ? 'border-top' : ''}" style="--nation:${countryColor}" data-territory="${esc(t.id)}" ${simulation ? 'data-observe="true"' : ''} aria-label="${esc(t.name)} · ${esc(c?.name || '무주지')}" title="${esc(t.name)} · ${esc(c?.name || '무주지')}"><span class="territory-name">${esc(t.name)}</span><span class="territory-owner">${esc(c?.name.replace(/국$/, '') || '무주지')}</span></button>`;
    }).join('')}</div></div><div class="map-caption"><span>${icon('compass', 13)} N</span><span>${simulation ? '직전 턴에 점령된 영토는 밝은 테두리로 표시됩니다.' : data.mapKind==='v11'?'편집 위치를 격자로 표시합니다. 실제 인접 관계는 원본 대륙 지도 기준입니다.':'격자 상하좌우로 경계를 공유하는 영토가 인접합니다.'}</span><span>GRID / 01</span></div></div>
    <div class="map-legend">${data.countries.map(c => `<span>${dot(c.color)}${esc(c.name)}</span>`).join('')}<span>${dot('#657066')}무주지</span></div>
    ${!editing && !simulation ? `<div class="map-panel-footer"><span>${icon('info', 14)} 지도를 클릭하면 영토 정보를 확인할 수 있습니다.</span><button class="text-button" data-page="map">지도 편집하기 ${icon('arrow', 15)}</button></div>` : ''}
  </section>`;
}
function nationStandings(data, full = false) {
  const max = Math.max(1, ...data.countries.map(c => landCount(data, c.id)));
  return `<section class="panel standings"><div class="panel-head"><div><span class="eyebrow">NATIONS</span><h2>국가 현황 <span class="count-badge">${data.countries.length}</span></h2></div>${!full ? '<button class="icon-button" data-page="countries" aria-label="국가 관리로 이동">' + icon('arrow', 17) + '</button>' : ''}</div><div class="standings-labels"><span>국가 / 영토</span><span>병력</span></div><div class="nation-list">${data.countries.length ? [...data.countries].sort((a, b) => landCount(data, b.id) - landCount(data, a.id)).map((c, i) => {
    const land = landCount(data, c.id);
    return `<div class="nation-row ${!land ? 'no-land' : ''}"><span class="rank">${String(i + 1).padStart(2, '0')}</span><div class="nation-info"><div>${dot(c.color)}<b>${esc(c.name)}</b>${!land ? '<span class="micro-label">영토 없음</span>' : ''}</div><div class="land-progress"><span style="--nation:${c.color};width:${(land / max) * 100}%"></span></div><small>${land}개 영토 · ${PERSONALITIES[c.personality]}</small></div><strong>${format(c.troops)}<small>만</small></strong></div>`;
  }).join('') : '<div class="empty compact">아직 국가가 없습니다.<br>국가 관리에서 첫 나라를 추가하세요.</div>'}</div><div class="standings-footer">${icon('flag', 14)} 영토는 지도에서 국가에 배정할 수 있어요.</div></section>`;
}
function overview() {
  const selected = world.territories.find(t => t.id === ui.selected), country = findCountry(world, selected?.ownerId);
  return `${statsBar()}<div class="overview-layout">${mapPanel(world)}${nationStandings(world)}</div><div class="overview-bottom"><section class="panel world-note"><div class="note-art">${icon('compass', 46)}</div><div><div class="eyebrow">YOUR WORLD, YOUR STORY</div><h2>세계의 다음 장은 아직 비어 있습니다.</h2><p>${esc(world.description || '국가와 인물, 영토를 직접 구성한 다음 새로운 역사를 시작하세요.')}</p></div><button class="text-button" data-action="world-meta">세계 정보 수정 ${icon('arrow', 15)}</button></section><section class="panel selected-summary"><span class="eyebrow">SELECTED TERRITORY</span><h3>${esc(selected?.name || '선택한 영토 없음')}</h3><p>${dot(country?.color || '#657066')}${esc(country?.name || '무주지')}<span>${selected ? `${String.fromCharCode(65 + selected.col)}${selected.row + 1}` : ''}</span></p><button class="text-button" data-page="map">이 영토 편집하기 ${icon('arrow', 15)}</button></section></div>`;
}
function definitionNote() { return run ? `<div class="notice">${icon('info', 16)} 지금 수정하는 것은 시작 세계입니다. 진행 중인 시뮬레이션에는 영향을 주지 않으며, ‘새 실행’부터 반영됩니다.</div>` : ''; }
function countriesPage() {
  return `${definitionNote()}<div class="section-toolbar"><span>등록된 국가 <b>${world.countries.length}개</b></span><span class="muted">병력 단위는 만 명입니다. 국가 수는 고정되어 있지 않습니다.</span></div>${world.countries.length ? `<div class="country-grid">${world.countries.map(c => `<article class="panel country-card" style="--nation:${c.color}"><div class="country-card-head"><span class="country-emblem">${icon('flag', 25)}</span><div><h2>${esc(c.name)}</h2><span>${PERSONALITIES[c.personality]}</span></div><button class="icon-button" data-action="edit-country" data-id="${esc(c.id)}" aria-label="${esc(c.name)} 수정">${icon('edit', 17)}</button></div><div class="country-portrait-strip">${countryPeople(world,c.id).slice(0,4).map(p=>`<span title="${esc(p.name)} · ${ROLES[p.role]}">${portraitImage(p,c,p.role)}<small>${esc(p.name)}</small></span>`).join('')}</div><div class="country-metrics"><div><small>초기 병력</small><strong>${format(c.troops)}<span>만</span></strong></div><div><small>초기 영토</small><strong>${landCount(world, c.id)}<span>개</span></strong></div><div><small>추가 충원 / 회</small><strong>${format(c.recruitment)}<span>만</span></strong></div></div><div class="country-personnel">${icon('people', 16)} 소속 인물 ${countryPeople(world, c.id).length}명<span>생산 ${production(world, c)}만 / 라운드</span></div><div class="country-actions">${button('edit-country', '국가 수정', 'edit', 'subtle', `data-id="${esc(c.id)}"`)}${button('delete-country', '삭제', 'trash', 'danger subtle', `data-id="${esc(c.id)}"`)}</div></article>`).join('')}<button class="add-card" data-action="add-country">${icon('plus', 26)}<b>새로운 국가</b><span>또 다른 역사의 주인공을 추가하세요.</span></button></div>` : empty('flag', '아직 국가가 없습니다', '국가를 추가하고 지도에서 영토를 배정해 주세요.', 'add-country', '첫 국가 추가')}`;
}
function peoplePage() {
  const people = world.people.filter(p => (!ui.countryFilter || (ui.countryFilter === '_none' ? p.countryId === null : p.countryId === ui.countryFilter)) && (!ui.roleFilter || p.role === ui.roleFilter) && (!ui.search || p.name.toLowerCase().includes(ui.search.toLowerCase())));
  return `${definitionNote()}<div class="people-toolbar"><div class="search-field">${icon('search', 17)}<input id="person-search" type="search" placeholder="인물 이름 검색" aria-label="인물 이름 검색" value="${esc(ui.search)}"></div><select id="person-country-filter" aria-label="소속 국가 필터"><option value="">모든 국가</option>${world.countries.map(c => `<option value="${esc(c.id)}" ${ui.countryFilter === c.id ? 'selected' : ''}>${esc(c.name)}</option>`).join('')}<option value="_none" ${ui.countryFilter === '_none' ? 'selected' : ''}>무소속</option></select><select id="person-role-filter" aria-label="직책 필터"><option value="">모든 직책</option>${Object.entries(ROLES).map(([k, v]) => `<option value="${k}" ${ui.roleFilter === k ? 'selected' : ''}>${v}</option>`).join('')}</select><span>총 <b>${people.length}명</b></span></div><div id="people-results">${people.length ? `<div class="people-grid">${people.map(p => { const c = findCountry(world, p.countryId); return `<article class="panel person-card" style="--nation:${c?.color || '#b1bba6'}"><div class="person-top"><span class="role-badge">${icon(p.role === 'king' ? 'crown' : p.role === 'general' ? 'sword' : 'book', 13)}${ROLES[p.role]}</span><button class="icon-button" data-action="edit-person" data-id="${esc(p.id)}" aria-label="${esc(p.name)} 수정">${icon('edit', 16)}</button></div><div class="person-avatar photo-avatar">${portraitImage(p,c,p.role)}<span>${icon(p.role === 'king' ? 'crown' : p.role === 'general' ? 'sword' : 'book', 15)}</span></div><h2>${esc(p.name)}</h2><p>${dot(c?.color || '#657066')}${esc(c?.name || '무소속')}</p><div class="person-stats"><span>능력 보정<b>${p.ability > 0 ? '+' : ''}${p.ability}</b></span><span>성향<b>${PERSONALITIES[p.personality]}</b></span></div><div class="person-actions">${button('edit-person', '수정', '', 'subtle', `data-id="${esc(p.id)}"`)}${button('delete-person', '삭제', '', 'danger subtle', `data-id="${esc(p.id)}"`)}</div></article>`; }).join('')}</div>` : empty('people', '표시할 인물이 없습니다', ui.search || ui.countryFilter || ui.roleFilter ? '검색어와 필터를 바꾸거나 새 인물을 추가해 주세요.' : '국왕·승상·장군을 자유롭게 추가해 주세요.', 'add-person', '인물 추가')}</div><div class="notice">${icon('info', 16)} 국왕은 국가의 행동 성향을, 승상은 내정 판정을, 장군은 전투 판정을 맡습니다. 직책이 비어 있어도 기본 보정 0으로 진행됩니다.</div>`;
}
function mapPage() {
  const t = world.territories.find(x => x.id === ui.selected) || world.territories[0];
  return `${definitionNote()}<div class="editor-layout">${mapPanel(world, true)}<aside class="panel territory-inspector"><div class="panel-head"><div><span class="eyebrow">TERRITORY EDITOR</span><h2>영토 정보</h2></div>${icon('map', 18)}</div><div class="inspector-preview" style="--nation:${findCountry(world, t?.ownerId)?.color || '#657066'}">${icon('flag', 34)}<strong>${esc(t?.name || '')}</strong><span>${t ? `${String.fromCharCode(65 + t.col)}${t.row + 1} · ${t.row + 1}행 ${t.col + 1}열` : ''}</span></div><form id="territory-form"><label>영토 이름<input name="name" maxlength="24" required value="${esc(t?.name)}"></label><label>소유 국가<select name="ownerId">${countryOptions(t?.ownerId, '무주지')}</select></label><div class="field-help">${world.mapKind==='v11'?`인접 영토: ${neighbors(world,t).map(n=>esc(n.name)).join(' · ')}`:'상하좌우 영토와 자동으로 인접합니다.'}<br>국가를 삭제하면 해당 영토는 무주지가 됩니다.</div><button type="submit" class="button primary full">${icon('check', 16)}영토 변경 적용</button></form><div class="inspector-tip">${icon('info', 16)}<p>여러 영토를 빠르게 배정하려면 <b>소유권 칠하기</b>를 선택한 후 지도를 클릭하세요.</p></div></aside></div>`;
}
function historyList() {
  const history = run?.history || [];
  const pending = playback.state && !playback.complete ? playback.state.record.turn : null;
  return `<section class="panel history-panel"><div class="panel-head"><div><span class="eyebrow">CHRONICLE</span><h2>역사 기록 <span class="count-badge">${history.length}턴</span></h2></div>${button('export-history', '기록 내보내기', 'download', 'subtle', !history.length || pending ? 'disabled' : '')}</div><div class="history-scroll">${history.length ? history.slice(-100).reverse().map(r => {
    if(r.turn === pending) return `<article class="history-entry pending-entry"><div class="history-time"><b>${String(r.turn).padStart(3,'0')}</b><small>R${r.round}</small></div><span class="event-icon">${icon('dice',17)}</span><div class="history-content"><h3>${esc(r.actorName)}의 판정 진행 중</h3><p>눈금과 결과는 장면이 끝나면 기록됩니다.</p></div></article>`;
    return `<article class="history-entry"><div class="history-time"><b>${String(r.turn).padStart(3, '0')}</b><small>R${r.round}</small></div><span class="event-icon ${r.type}">${icon(r.type === 'war' ? 'sword' : 'flag', 17)}</span><div class="history-content"><h3>${esc(r.title)}</h3><p>${esc(r.detail)}</p><div class="roll-pills">${r.rolls.map(d => `<span>${icon('dice', 12)}${esc(d.label)} <b>${d.value}</b><small>/D${d.sides}</small></span>`).join('')}</div>${r.production.length ? `<div class="production-note">라운드 ${r.round} 종료 · ${r.production.map(p => `${esc(p.name)} +${p.gain}만`).join(' / ')}</div>` : ''}</div></article>`;
  }).join('') : '<div class="empty history-empty"><span class="empty-icon">' + icon('clock', 29) + '</span><h3>아직 쓰이지 않은 역사</h3><p>‘한 턴 진행’을 누르면 국가의 첫 행동이 기록됩니다.</p></div>'}</div>${history.length > 100 ? '<p class="history-limit">최근 100턴을 표시합니다. 전체 기록은 내보내기에 포함됩니다.</p>' : ''}</section>`;
}
function simulationPage() {
  const active = playback.state && !playback.complete;
  const data = playback.displayWorld || run?.world || previewWorld(world);
  const actor = active ? findCountry(data,playback.state.record.actorId) : run ? currentActor(run) : null;
  const shownResult = run?.result && (!playback.state || playback.complete);
  const winners = shownResult ? run.result.winnerIds.map(id=>findCountry(data,id)?.name).join(' · ') : '';
  const focused = findCountry(data,ui.focusedCountry)?.id || actor?.id || data.countries[0]?.id;
  const running = auto || playback.playing;
  return `<div class="notice simulation-notice">${icon('info',16)}원본 v11: 국왕 선택 → 승상의 내정 또는 장군별 원정 → 손실·점령 → 전사·재편. 각 부대의 병력을 따로 계산합니다.<button class="text-button" data-page="rules">규칙 보기 ${icon('arrow',13)}</button></div>
  <section class="simulation-controls"><div class="round-display"><small>ROUND</small><strong>${String(active?playback.state.record.round:run?.round||1).padStart(2,'0')}</strong><span>/ ${data.rules.roundLimit}</span></div><div class="simulation-meta"><b>${shownResult?'역사 기록 완료':running?'역사를 기록하는 중':run?.turn?'일시정지':'새로운 역사를 시작할 준비'}</b><span>${active?`${esc(actor?.name)} 판정 중`:actor?`${esc(actor.name)} 행동 대기`:shownResult?`${run.turn}턴 진행`:'당신의 세계가 역사의 무대가 됩니다.'}</span></div><div class="simulation-buttons"><label class="speed-label">배속<select id="sim-speed" aria-label="자동 진행 배속">${[.5,1,2,4].map(v=>`<option value="${v}" ${ui.speed===v?'selected':''}>${v}×</option>`).join('')}</select></label>${button('step',active&&!playback.playing?'이어서 보기':'한 턴 진행','chevron','outline',running||shownResult?'disabled':'')}${button('auto',running?'일시정지':'자동 진행',running?'pause':'play','primary',shownResult?'disabled':'')}</div></section>
  <div class="run-settings"><label>역사 시드 <input id="sim-seed" type="number" min="0" max="4294967295" value="${esc(ui.seed)}" aria-label="역사 시드" ${run?'disabled':''}></label><span>${run?`시드 ${esc(run.seed)} · 완료된 턴 자동 저장 · 새로고침 후 이어서 실행`:'같은 세계와 시드는 같은 역사를 만듭니다.'}</span>${button('new-run','새 실행','reset','subtle')}${button('replay-run','같은 역사 처음부터','play','subtle',!run?'disabled':'')}</div>
  ${shownResult?`<div class="result-banner">${icon('crown',27)}<div><h2>${esc(winners)} ${run.result.winnerIds.length>1?'공동 승리':'승리'}</h2><p>${run.result.reason==='unification'?'경쟁 국가의 모든 영토를 정복했습니다.':'제한 라운드 종료 · 영토 수, 총병력 순으로 승자를 정했습니다.'}</p></div></div>`:''}
  <div class="simulation-layout visual-layout"><div class="visual-map-column">${mapPanel(data,false,true)}${renderNationCards(data,focused)}${renderCommanders(data,focused)}</div>${renderArena({world:data,run,playback})}</div>${historyList()}`;
}
function rulesPage() {
  const r=world.rules;
  const field=(name,label,value,min,max,help='')=>`<label>${label}<input type="number" name="${name}" value="${value}" min="${min}" max="${max}" required><small>${help}</small></label>`;
  return `${definitionNote()}<div class="notice">${icon('book',17)}원본 시스템 v11 · <span>기본값은 첨부 원본 v11과 같습니다. 변경한 값은 새 실행에 반영됩니다.</span></div><form id="rules-form"><div class="rules-grid"><section class="panel rules-section"><h2>국왕의 행동 · D10</h2><p>눈금 이하 내정, 초과 전쟁. 공격 가능한 국가가 없으면 다시 굴립니다.</p><div class="fields-three">${Object.entries(PERSONALITIES).map(([k,v])=>field(`threshold-${k}`,v,r.domesticThresholds[k],0,10)).join('')}</div>${field('successTarget','승상 실행 성공 기준',r.successTarget,1,12,'선택 주사위와 별도로 D10 + 승상 능력 판정')}</section><section class="panel rules-section"><h2>승상 행동 선택 · D10</h2><p>모병 / 충원 강화 / 보급 강화의 눈금 수입니다. 각 행의 합계는 10입니다.</p>${Object.entries(MINISTER_STYLES).map(([k,v])=>`<h3>${v}</h3><div class="fields-three">${['모병','충원','보급'].map((label,i)=>field(`weight-${k}-${i}`,label,r.ministerWeights[k][i],0,10)).join('')}</div>`).join('')}</section><section class="panel rules-section"><h2>병력 · 지휘한도</h2><div class="fields-two">${field('recruitGain','모병 성공: 수도 예비병 증가',r.recruitGain,0,10000)}${field('productionGain','충원 강화: 매 라운드 추가 생산',r.productionGain,0,10000)}${field('supplyGain','보급 강화: 모든 장군 한도 증가',r.supplyGain,0,10000)}${field('baseCapacity','장군 기본 지휘한도',r.baseCapacity,1,10000,'기본 + 국가 보정 + 개인 보정 + 보급 강화')}${field('minimumReserve','수도에 남길 예비병',r.minimumReserve,0,10000,'초과분을 연결된 장군에게 1만씩 무작위 배분')}${field('territoryProduction','영토당 라운드 생산',r.territoryProduction,0,10000)}${field('armyAdvantageBonus','부대 병력 우세 보정',r.armyAdvantageBonus,0,10)}</div><p>수도 단절 지역은 자체 영토 생산만 지역 장군에게 배분합니다. 남는 병력은 소멸합니다.</p></section><section class="panel rules-section"><h2>전투 · 종료</h2><p>연결된 장군들이 선택한 한 국가를 차례로 공격합니다. 승리 점수 차 1~3 / 4~6 / 7 이상에 따라 같은 방어 장군의 연결 영토를 최대 1 / 2 / 3개 점령합니다.</p><div class="fields-three">${['win','tie','loss'].map((k,i)=>field(`loss-${k}`,['승리 기본 손실률 %','무승부 %','패배 %'][i],Math.round(r.lossRates[k]*100),0,100)).join('')}</div><p>손실 = 내 부대 병력 × 기본률 × 상대 병력 × 2 ÷ 양측 부대 병력 합. 반올림, 최소 1만, 최대 자기 병력입니다. 방어 병력 0은 주사위·손실 없이 1개 점령합니다.</p><p>패배하여 0만이 된 장군만 D10 1~3 전사 판정을 합니다. 이후 자기 차례 3턴을 채운 뒤 다음 차례에 후임을 임명합니다.</p>${field('roundLimit','제한 라운드',r.roundLimit,1,100,'전국 통일 또는 제한 종료. 영토 → 총병력 순위, 동률 공동 승리.')}</section></div><div class="form-footer"><span>D10 · 장군당 최대 4개 영토 · 실제 부대 단위 전투</span>${button('reset-rules','원본 v11 기본값 복원','refresh','outline')}<button type="submit" class="button primary">규칙 저장</button></div></form>`;
}
function empty(glyph, title, description, action, label) { return `<div class="panel empty"><span class="empty-icon">${icon(glyph, 32)}</span><h2>${title}</h2><p>${description}</p>${button(action, label, 'plus', 'primary')}</div>`; }

function openDialog(title, subtitle, form, submit = '변경 저장') {
  const dialog = $('#editor-dialog');
  dialog.innerHTML = `<form id="dialog-form"><div class="dialog-heading"><div><span class="eyebrow">WORLD EDITOR</span><h2 id="dialog-title">${title}</h2></div><button type="button" class="icon-button" data-action="close-dialog" aria-label="닫기">${icon('x', 21)}</button></div><p class="dialog-description">${subtitle}</p><div class="dialog-fields">${form}</div><p id="dialog-error" class="form-error" role="alert" hidden></p><div class="dialog-footer">${button('close-dialog', '취소', '', 'outline')}<button type="submit" class="button primary">${icon('check', 16)}${submit}</button></div></form>`;
  dialog.showModal();
}
let dialogHandler = null,editingPersonId=null;
function countryDialog(id) {
  stop(); render();
  const original = world.countries.find(c => c.id === id), c = original || { name: '', color: ['#8caa88', '#cb9b65', '#a896c8', '#78a9b2'][world.countries.length % 4], troops: 10, recruitment: 0, personality: 'balanced', commandBonus:0, capitalId:null, feature:'' };
  openDialog(original ? '국가 수정' : '새 국가 추가', '초기 병력과 성향을 정하세요. 영토는 지도에서 배정합니다.', `<label>국가 이름<input name="name" maxlength="40" required placeholder="예: 청람국" value="${esc(c.name)}"></label><div class="fields-two"><label>국가 색상<div class="color-field"><input type="color" name="color" value="${c.color}" aria-label="국가 색상"><span>${c.color.toUpperCase()}</span></div></label><label>기본 성향<select name="personality">${traitOptions(c.personality)}</select></label></div><div class="fields-two"><label>초기 병력 (만 명)<input type="number" name="troops" min="0" max="1000000" required value="${c.troops}"></label><label>추가 충원 / 라운드 (만 명)<input type="number" name="recruitment" min="0" max="10000" required value="${c.recruitment}"></label></div><div class="field-help">국왕이 있으면 국왕의 성향이 우선합니다. 총 생산량 = 보유 영토 × 영토당 생산 + 추가 충원입니다.</div>`, original ? '변경 저장' : '국가 추가');
  $('#editor-dialog .dialog-fields').insertAdjacentHTML('beforeend',`<div class="fields-two"><label>국가 지휘한도 보정<select name="commandBonus">${[-1,0,1].map(v=>`<option value="${v}" ${c.commandBonus===v?'selected':''}>${v>0?'+':''}${v}</option>`).join('')}</select></label><label>수도 영토<select name="capitalId"><option value="">첫 보유 영토에 배치</option>${world.territories.filter(t=>t.ownerId===c.id).map(t=>`<option value="${esc(t.id)}" ${c.capitalId===t.id?'selected':''}>${esc(t.name)}</option>`).join('')}</select></label></div><label>특성 설명<input name="feature" value="${esc(c.feature||'')}" maxlength="150"></label>`);
  dialogHandler = data => {
    const updated = { ...c, id: original?.id || newId('nation'), commandBonus:Number(data.get('commandBonus')), capitalId:data.get('capitalId')||null, feature:data.get('feature'), name: data.get('name'), color: data.get('color'), troops: Number(data.get('troops')), recruitment: Number(data.get('recruitment')), personality: data.get('personality') };
    const next = clone(world);
    if (original) next.countries[next.countries.findIndex(c => c.id === id)] = updated; else next.countries.push(updated);
    updateWorld(next); notify(original ? '국가 정보를 수정했습니다.' : '국가를 추가했습니다. 지도에서 영토를 배정해 주세요.');
  };
}
function personDialog(id) {
  stop(); render();editingPersonId=id||null;
  const original = world.people.find(p => p.id === id), p = original || { name: '', countryId: world.countries[0]?.id || null, role: 'general', ability: 0, personality: 'balanced' };
  openDialog(original ? '인물 수정' : '새 인물 추가', '인물의 소속과 역할, 판정에 더할 능력치를 정하세요.', `<label>인물 이름<input name="name" maxlength="40" required placeholder="예: 진우" value="${esc(p.name)}"></label><div class="fields-two"><label>소속 국가<select name="countryId">${countryOptions(p.countryId)}</select></label><label>직책<select name="role">${Object.entries(ROLES).map(([k, v]) => `<option value="${k}" ${p.role === k ? 'selected' : ''}>${v}</option>`).join('')}</select></label><label>능력 보정<select name="ability">${[-2,0,2].map(v=>`<option value="${v}" ${p.ability===v?'selected':''}>${v>0?'+':''}${v}</option>`).join('')}</select></label><label>성향<select name="personality">${traitOptions(p.personality)}</select></label></div><div class="field-help">국왕·승상은 국가당 각 1명, 장군은 여러 명을 둘 수 있습니다. 국왕 성향은 행동 선택에, 승상 능력은 내정에, 각 장군이 자신의 주둔군으로 전투합니다. 장군 자리 번호가 행동 순서를 정합니다. 영토 수에 따라 필요한 장군만 활성화됩니다.</div>`);
  const nextSlot=original?.slot??Math.max(-1,...world.people.filter(g=>g.countryId===p.countryId&&g.role==='general').map(g=>g.slot))+1;
  $('#editor-dialog .dialog-fields').insertAdjacentHTML('beforeend',`<div class="fields-two"><label>승상 행동 성향<select name="ministerStyle">${Object.entries(MINISTER_STYLES).map(([k,v])=>`<option value="${k}" ${p.ministerStyle===k?'selected':''}>${v}</option>`).join('')}</select><small>승상에게 적용</small></label><label>장군 자리 번호<input type="number" name="slot" min="1" max="${Math.max(20,Math.ceil(world.territories.length/4))}" value="${nextSlot+1}"><small>장군에게 적용 · 같은 나라에서 중복 불가</small></label><label>개인 지휘한도 보정<select name="commandBonus">${[-1,0,1].map(v=>`<option value="${v}" ${(p.commandBonus||0)===v?'selected':''}>${v>0?'+':''}${v}</option>`).join('')}</select></label><label>특성 설명<input name="feature" maxlength="150" value="${esc(p.feature||'')}"></label></div>`);
  $('#editor-dialog .dialog-fields').insertAdjacentHTML('beforeend', `<fieldset class="portrait-picker"><legend>인물 초상화</legend><label class="auto-portrait"><input type="radio" name="portraitKey" value="" ${!p.portraitKey?'checked':''}> 소속 국가와 직책에 맞춰 자동 배정</label><div class="portrait-options">${portraitChoices().map(key=>`<label title="${esc(portraitLabel(key))}"><input type="radio" name="portraitKey" value="${key}" ${p.portraitKey===key?'checked':''}><img src="${portraitSource({portraitKey:key},null)}" alt="${esc(portraitLabel(key))} 초상화" width="60" height="78"></label>`).join('')}</div></fieldset>`);
  dialogHandler = data => {
    const updated = { ...p, feature:data.get('feature'), slot:Number(data.get('slot'))-1, commandBonus:Number(data.get('commandBonus')), ministerStyle:data.get('ministerStyle'), id: original?.id || newId('person'), name: data.get('name'), countryId: data.get('countryId') || null, role: data.get('role'), ability: Number(data.get('ability')), personality: data.get('personality') };
    if (data.get('portraitKey')) updated.portraitKey = data.get('portraitKey');else delete updated.portraitKey;
    const next = clone(world);
    if (original) next.people[next.people.findIndex(p => p.id === id)] = updated; else next.people.push(updated);
    updateWorld(next); notify(original ? '인물 정보를 수정했습니다.' : '새 인물을 추가했습니다.');
  };
}
function newWorldDialog() {
  stop();
  openDialog('새 세계 만들기', '현재 세계는 먼저 파일로 내보내 보관해 주세요. 빈 격자에서 직접 시작합니다.', `<label>세계 이름<input name="name" maxlength="80" required placeholder="예: 삼국의 시대"></label><div class="fields-two"><label>가로 영토 수<input type="number" name="cols" min="2" max="24" value="10" required></label><label>세로 영토 수<input type="number" name="rows" min="2" max="20" value="8" required></label></div><div class="notice">현재 작업 공간의 세계와 실행 기록이 새 세계로 교체됩니다. 파일로 내보낸 세계는 다시 불러올 수 있습니다.</div>`, '새 세계 만들기');
  dialogHandler = data => { setNewWorld(blankWorld({ name: data.get('name'), cols: Number(data.get('cols')), rows: Number(data.get('rows')) })); notify('빈 세계를 만들었습니다. 국가를 추가하고 영토를 배정해 보세요.'); };
}
function metaDialog() {
  stop(); render();
  openDialog('세계 정보 수정', '나만의 세계에 이름과 간단한 소개를 남겨 주세요.', `<label>세계 이름<input name="name" required maxlength="80" value="${esc(world.name)}"></label><label>세계 소개<textarea name="description" maxlength="300" rows="4">${esc(world.description)}</textarea></label>`);
  dialogHandler = data => updateWorld({ ...world, name: data.get('name'), description: data.get('description') });
}
function ensureRun() { if (!run) run = createRun(world, ui.seed.trim() || '20261017'); }
function beginTurn(play=true) {
  ensureRun();
  if(!playback.complete) { if(play) playback.resume(); return; }
  if(run.result) return;
  const before=run.world;run=nextTurn(run);const record=run.history.at(-1);
  ui.focusedCountry=record.actorId;playback.load(record,before,run.world,play);
}
function step() { stop();beginTurn(); }
function startAuto() { ensureRun();auto=true;beginTurn();render(); }
function newRunDialog() {
  stop(); render();
  openDialog('새 역사 실행', '진행 중인 역사는 교체됩니다. 필요하면 먼저 기록을 내보내 주세요.', `<label>역사 시드<input name="seed" required type="number" min="0" max="4294967295" value="${esc(ui.seed)}"></label><div class="field-help">같은 세계와 설정, 같은 시드로 실행하면 같은 결과가 나옵니다. 다른 역사를 만들려면 시드를 바꿔 주세요.</div>`, '새 실행 준비');
  dialogHandler = data => { const seed = data.get('seed').trim(); const next = createRun(world, seed); playback.reset(); run = next; saveRun(localStorage,run); ui.seed = seed; render(); notify('현재 편집한 세계로 새 실행을 준비했습니다.'); };
}
const actions = {
  'save': () => { persist(true); render(); },
  'export': () => { downloadFile(`${fileName(world.name)}.world.json`, serializeWorld(world)); notify('세계 파일을 내보냈습니다. 국가·인물·지도·규칙이 모두 포함됩니다.'); },
  'import': () => { stop(); render(); $('#world-file').click(); },
  'new-world': newWorldDialog, 'world-meta': metaDialog,
  'go-simulation': () => navigate('simulation'),
  'add-country': () => countryDialog(), 'edit-country': id => countryDialog(id),
  'add-person': () => personDialog(), 'edit-person': id => { if(id&&!world.people.some(p=>p.id===id)) { notify('이 인물은 현재 편집 세계에 없습니다. 새 실행에서 확인해 주세요.',true); return; } personDialog(id); },
  'close-dialog': () => { $('#editor-dialog').close(); dialogHandler = null; },
  'delete-country': id => {
    const c = findCountry(world, id);
    if (c && confirm(`‘${c.name}’을 삭제할까요? 영토 ${landCount(world, id)}개는 무주지가 되고 소속 인물은 삭제되지 않고 무소속으로 남습니다.`)) { updateWorld(removeCountry(world, id)); if (ui.brush === id) ui.brush = ''; notify('국가를 삭제했습니다. 소속 인물은 무소속으로 보존했습니다.'); }
  },
  'delete-person': id => { const p = world.people.find(p => p.id === id); if (p && confirm(`‘${p.name}’ 인물을 삭제할까요?`)) { updateWorld({ ...world, people: world.people.filter(p => p.id !== id) }); notify('인물을 삭제했습니다.'); } },
  'select-mode': () => { ui.paint = false; render(); }, 'paint-mode': () => { ui.paint = true; render(); },
  'step': () => { step(); render(); },
  'auto': () => { if (auto || playback.playing) { stop(); render(); } else startAuto(); },
  'scene-step': () => { stop(); if(playback.complete)beginTurn(false);playback.playGroup();render(); },
  'scene-skip': () => { stop(); playback.finish(); render(); },
  'focus-country': id => { ui.focusedCountry=id; render(); },
  'new-run': newRunDialog,
  'replay-run': () => {stop();if(!run)return;const next=createRun(run.initialWorld,run.seed);playback.reset();run=next;saveRun(localStorage,run);render();notify('같은 시작 세계와 시드로 처음부터 재생합니다.');},
  'reset-rules': () => {if(confirm('규칙 설정을 첨부 원본 v11 기본값으로 복원할까요?'))updateWorld({...world,rules:clone(DEFAULT_RULES)});},
  'recording': () => { ui.recording = !ui.recording; render(); },
  'export-history': () => { if (run?.history.length) { downloadFile(`${fileName(run.initialWorld.name)}-${fileName(run.seed)}.history.json`, JSON.stringify({ kind: 'saguk-studio-history', engineVersion: ENGINE_VERSION, seed: run.seed, world: run.initialWorld, history: run.history, result: run.result, finalWorld: run.world }, null, 2)); notify('전체 역사와 시작 세계, 시드, 최종 상태를 내보냈습니다. 기록 가져오기와 재생은 후속 버전에서 지원합니다.'); } },
};
document.addEventListener('click', event => {
  const page = event.target.closest('[data-page]');
  if (page) { event.preventDefault(); navigate(page.dataset.page); return; }
  const action = event.target.closest('[data-action]');
  if (action) { if (action.disabled) return; try { actions[action.dataset.action]?.(action.dataset.id); } catch (error) { notify(error.message, true); } return; }
  const tile = event.target.closest('[data-territory]');
  if (tile) {
    if (tile.dataset.observe) { const t = run?.world.territories.find(t => t.id === tile.dataset.territory); const c = findCountry(run?.world || world, t?.ownerId); notify(`${t?.name} · ${c?.name || '무주지'}`); return; }
    ui.selected = tile.dataset.territory;
    if (ui.page === 'map' && ui.paint) { const next = clone(world); next.territories.find(t => t.id === ui.selected).ownerId = ui.brush || null; updateWorld(next); }
    else render();
  }
});
document.addEventListener('submit', event => {
  event.preventDefault();
  const form = event.target, data = new FormData(form);
  try {
    if (form.id === 'dialog-form') { dialogHandler?.(data); $('#editor-dialog').close(); dialogHandler = null; }
    else if (form.id === 'territory-form') {
      const next = clone(world), t = next.territories.find(t => t.id === ui.selected);
      if (!t) throw new Error('수정할 영토를 선택해 주세요.');
      t.name = data.get('name'); t.ownerId = data.get('ownerId') || null; updateWorld(next); notify('영토 정보를 저장했습니다.');
    } else if (form.id === 'rules-form') {
      const next = clone(world), r = next.rules;
      for (const k of ['successTarget', 'recruitGain', 'productionGain', 'territoryProduction', 'armyAdvantageBonus', 'roundLimit', 'supplyGain', 'baseCapacity', 'minimumReserve']) r[k] = Number(data.get(k));
      r.diceSides=10;for(const k of Object.keys(MINISTER_STYLES))r.ministerWeights[k]=[0,1,2].map(i=>Number(data.get(`weight-${k}-${i}`)));
      for (const k of Object.keys(PERSONALITIES)) r.domesticThresholds[k] = Number(data.get(`threshold-${k}`));
      for (const k of ['win', 'tie', 'loss']) r.lossRates[k] = Number(data.get(`loss-${k}`)) / 100;
      updateWorld(next); notify('규칙을 저장했습니다. 새 실행부터 적용됩니다.');
    }
  } catch (error) {
    if (form.id === 'dialog-form') { $('#dialog-error').hidden = false; $('#dialog-error').textContent = error.message; }
    else notify(error.message, true);
  }
});
document.addEventListener('change', async event => {
  const target = event.target;
  if (target.id === 'world-file') {
    const file = target.files?.[0]; target.value = '';
    if (!file) return;
    try {
      if (file.size > 5 * 1024 * 1024) throw new Error('세계 파일은 5MB 이하여야 합니다.');
      const next = parseWorld(await file.text());
      if (confirm(`‘${next.name}’ 세계를 불러올까요? 현재 세계와 실행 기록이 교체됩니다. 보관하려면 취소하고 먼저 파일로 내보내 주세요.`)) { setNewWorld(next); notify('세계의 국가·인물·영토·규칙을 모두 불러왔습니다.'); }
    } catch (error) { notify(error.message, true); }
  } else if(target.name==='countryId'&&target.closest('#editor-dialog')){const field=$('#editor-dialog [name="slot"]');if(field){const used=new Set(world.people.filter(p=>p.id!==editingPersonId&&p.role==='general'&&p.countryId===target.value).map(p=>p.slot));let slot=0;while(used.has(slot))slot++;field.value=slot+1;}}
  else if (target.id === 'show-names') { ui.showNames = target.checked; render(); }
  else if (target.id === 'paint-owner') ui.brush = target.value;
  else if (target.id === 'person-country-filter') { ui.countryFilter = target.value; render(); }
  else if (target.id === 'person-role-filter') { ui.roleFilter = target.value; render(); }
  else if (target.id === 'map-style') { ui.mapStyle=target.value; render(); }
  else if (target.id === 'sim-speed') { const wasAuto=auto, wasPlaying=playback.playing; stop(); ui.speed=Number(target.value); if(wasAuto)startAuto();else if(wasPlaying)playback.resume();else render(); }
  else if (target.id === 'sim-seed') ui.seed = target.value;
});
document.addEventListener('input', event => {
  if (event.target.id === 'sim-seed') ui.seed = event.target.value;
  if (event.target.id === 'person-search') {
    const start = event.target.selectionStart, end = event.target.selectionEnd;
    ui.search = event.target.value; render(); const field = $('#person-search'); field.focus(); field.setSelectionRange(start, end);
  }
  if (event.target.name === 'color') event.target.nextElementSibling.textContent = event.target.value.toUpperCase();
  if (event.target.name === 'diceSides' && event.target.closest('#rules-form')) {
    const sides = Number(event.target.value);
    if (sides >= 2 && sides <= 100) {
      for (const field of document.querySelectorAll('[name^="threshold-"]')) field.max = sides;
      document.querySelector('[name="successTarget"]').max = sides + 5;
    }
  }
});
document.addEventListener('visibilitychange', () => { if (document.hidden && (auto || playback.playing)) { stop(); render(); } });
document.addEventListener('keydown', event => { if((event.key==='Enter'||event.key===' ') && event.target.matches('.atlas-cell')) { event.preventDefault();event.target.dispatchEvent(new MouseEvent('click',{bubbles:true}));return; } if(ui.page==='simulation'&&!event.target.closest('input,select,textarea,button,dialog')&&(event.code==='Space'||event.code==='Enter')){event.preventDefault();try{actions[event.code==='Space'?'scene-step':'step']();}catch(error){notify(error.message,true);}return;} if (event.key === 'Escape' && ui.recording) { ui.recording = false; render(); } });
window.addEventListener('beforeunload', event => { if (playback.state&&!playback.complete) { event.preventDefault(); event.returnValue = ''; } });
$('#editor-dialog').addEventListener('click', event => { if (event.target === $('#editor-dialog')) { $('#editor-dialog').close(); dialogHandler = null; } });
try { const saved=loadRun(localStorage);if(saved&&saved.initialWorld.id===world.id){run=saved;ui.seed=saved.seed;} } catch(error){initialError ||= error.message;}
if (!initialError) persist();
render();
if (initialError) notify(initialError, true);
