/* PAY MEX × KIILONOVA — interfaz. Consola de corrida, validador, PAY MEX, arquitectura e informe. */
(function () {
  'use strict';
  const D = window.PMX_DATA, E = window.PMX_ENGINE;
  const $ = (s, r) => (r || document).querySelector(s);
  const $$ = (s, r) => Array.from((r || document).querySelectorAll(s));
  const esc = (s) => String(s == null ? '' : s).replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
  const fmt = (n, d) => Number(n).toLocaleString('es-MX', { minimumFractionDigits: d || 0, maximumFractionDigits: d || 0 });
  const money = (n, cur) => (cur === 'USD' ? 'USD ' : '$') + fmt(n, 2) + (cur === 'USD' ? '' : ' MXN');
  const hhmm = (sec) => '00:' + String(Math.floor(sec / 60)).padStart(2, '0');
  const reduced = window.matchMedia('(prefers-reduced-motion: reduce)').matches;

  // ================================================================ estado calculado
  const SEED = 417;
  const ds = D.buildDataset(SEED);
  const prof = E.profile(ds);
  const clean = E.cleanse(ds);
  const cases = E.buildSuite();
  const suite = {};
  ['v1.0', 'v1.2', 'v1.2.1', 'v1.3'].forEach((v) => { suite[v] = E.runSuite(v, cases); });
  const rowsLegacy = E.evalOrders('v1.0', ds.products, ds.orders);
  const rowsNew = E.evalOrders('v1.2.1', clean.products, clean.orders);
  const S = {
    seed: SEED, prof, clean, suite, cases,
    legacyBad: rowsLegacy.filter((r) => !r.correct).length,
    newBad: rowsNew.filter((r) => !r.correct).length,
    scen: E.scenarios(rowsLegacy, rowsNew),
    stress: E.stress('v1.2.1', 5000),
    edges: D.EDGES.length,
    runId: 'RUN-KN-' + new Date().toISOString().slice(2, 10).replace(/-/g, '') + '-0417'
  };
  const EVENTS = window.PMX_EVENTS.buildEvents(S);
  const AG = Object.fromEntries(D.AGENTS.map((a) => [a.id, a]));
  const PAYNAMES = { 'PAY-01': 'Document intake', 'PAY-02': 'Semantic extraction', 'PAY-03': 'Supplier verification', 'PAY-04': 'Risk & compliance', 'PAY-05': 'Payment rail discovery', 'PAY-06': 'FX & fee optimizer', 'PAY-07': 'Payment recommendation', 'PAY-08': 'Human approval gateway', 'PAY-09': 'Payment execution connector', 'PAY-10': 'Reconciliation & audit' };
  const nameOf = (id) => (AG[id] ? AG[id].name : PAYNAMES[id] || (D.SUBAGENTS.find((s) => s.id === id) || {}).goal || id);

  let snapshotHash = '';
  E.sha256(JSON.stringify(ds)).then((h) => { snapshotHash = h; });

  // ================================================================ utilidades UI
  let toastT;
  function toast(msg) { const t = $('#toast'); t.textContent = msg; t.classList.add('is-on'); clearTimeout(toastT); toastT = setTimeout(() => t.classList.remove('is-on'), 2600); }
  function download(name, text, type) {
    const a = document.createElement('a');
    a.href = URL.createObjectURL(new Blob([text], { type: type || 'text/plain;charset=utf-8' }));
    a.download = name; document.body.appendChild(a); a.click();
    setTimeout(() => { URL.revokeObjectURL(a.href); a.remove(); }, 400);
  }
  function tabs(container, onSelect) {
    const btns = $$('[role="tab"]', container);
    btns.forEach((b, i) => {
      b.addEventListener('click', () => select(i));
      b.addEventListener('keydown', (e) => {
        if (e.key === 'ArrowRight' || e.key === 'ArrowLeft') { e.preventDefault(); const n = (i + (e.key === 'ArrowRight' ? 1 : -1) + btns.length) % btns.length; select(n); btns[n].focus({ preventScroll: true }); }
      });
    });
    function select(i) { btns.forEach((b, j) => { b.setAttribute('aria-selected', String(i === j)); b.tabIndex = i === j ? 0 : -1; }); onSelect(btns[i], i); }
    btns.forEach((b, j) => { b.tabIndex = b.getAttribute('aria-selected') === 'true' ? 0 : -1; });
    return select;
  }

  // ================================================================ hero
  function renderHeroFacts() {
    $('#hero-facts').innerHTML = [
      ['Agentes', '33'], ['Dependencias', String(S.edges)], ['Pruebas en verde', suite['v1.2.1'].pass + '/' + suite['v1.2.1'].total], ['Pedidos', String(prof.orders)]
    ].map(([k, v]) => '<div><dt>' + k + '</dt><dd>' + v + '</dd></div>').join('');
  }
  function j(v) {
    if (typeof v === 'string') return '<span class="tok-s">"' + esc(v) + '"</span>';
    if (typeof v === 'number') return '<span class="tok-n">' + v + '</span>';
    if (v === null) return '<span class="tok-p">null</span>';
    return esc(String(v));
  }
  function jsonHtml(obj, ind) {
    ind = ind || '';
    const pad = ind + '  ';
    if (Array.isArray(obj)) return '[' + obj.map((x) => '\n' + pad + jsonHtml(x, pad)).join('<span class="tok-p">,</span>') + '\n' + ind + ']';
    if (obj && typeof obj === 'object') return '<span class="tok-p">{</span>' + Object.keys(obj).map((k) => '\n' + pad + '<span class="tok-k">"' + esc(k) + '"</span><span class="tok-p">:</span> ' + jsonHtml(obj[k], pad)).join('<span class="tok-p">,</span>') + '\n' + ind + '<span class="tok-p">}</span>';
    return j(obj);
  }
  let heroTyped = false;
  function renderHero(ver) {
    const raw = ds.products.find((p) => p.sku === 'LAV-FL-20-B');
    const rec = ver === 'v1.0' ? raw : clean.products.find((p) => p.sku === 'LAV-FL-20');
    const t0 = performance.now();
    const a = E.assign(ver, rec, 'NORMAL');
    const ms = performance.now() - t0;
    const req = { pedido: 'PED-SIM-000417', sku: rec.sku, zona: 'NORMAL', regla: ver };
    if (ver !== 'v1.0') req.sku_origen = 'LAV-FL-20-B';
    const res = ver === 'v1.0'
      ? { asignado: a.vehicle, clase_usada: 'PAQ_CHICO', validaciones: [], nota: 'clase nula tratada como PAQ_CHICO' }
      : { asignado: a.vehicle, rechazados: a.all.filter((x) => !x.r.ok).map((x) => ({ vehiculo: x.v.id, motivo: x.r.code })), validaciones: a.result.checks.length };
    $('#hero-req').innerHTML = jsonHtml(req);
    const st = $('#hero-status');
    st.className = 'status ' + (ver === 'v1.0' ? 'status--bad' : 'status--ok');
    st.textContent = ver === 'v1.0' ? '200 · ASIGNACIÓN INCOMPATIBLE' : '200 OK · VAN';
    $('#hero-latency').textContent = (ms < 0.1 ? '< 0.1' : ms.toFixed(2)) + ' ms en este navegador';
    const out = jsonHtml(res);
    const target = $('#hero-res');
    if (!heroTyped && !reduced) {
      heroTyped = true;
      const plain = out.replace(/<[^>]+>/g, '');
      let i = 0;
      const step = () => { i += 6; target.textContent = plain.slice(0, i); if (i < plain.length) requestAnimationFrame(step); else target.innerHTML = out; };
      step();
    } else target.innerHTML = out;
  }
  tabs($('.code-card .seg'), (b) => renderHero(b.dataset.heroVer));

  // ================================================================ grafo
  const svg = $('#graph');
  const NS = 'http://www.w3.org/2000/svg';
  const POS = {};
  const W = 1040, TOP = 60, BOT = 590;
  (function layout() {
    D.COLS.forEach((_, c) => {
      const list = D.AGENTS.filter((a) => a.col === c);
      list.forEach((a, i) => { POS[a.id] = { x: 46 + c * 150, y: TOP + (i + 0.5) * ((BOT - TOP) / list.length) }; });
    });
  })();
  function el(tag, attrs, parent) { const n = document.createElementNS(NS, tag); for (const k in attrs) n.setAttribute(k, attrs[k]); if (parent) parent.appendChild(n); return n; }
  const edgeEls = [];
  const nodeEls = {};
  let gSuper, gSubs;
  function edgePath(a, b) {
    const p = POS[a], q = POS[b];
    if (Math.abs(p.x - q.x) < 2) { const bulge = 34; return 'M' + (p.x - 15) + ',' + p.y + ' C' + (p.x - 15 - bulge) + ',' + p.y + ' ' + (q.x - 15 - bulge) + ',' + q.y + ' ' + (q.x - 17) + ',' + q.y; }
    const x1 = p.x + 15, x2 = q.x - 18, mx = (x1 + x2) / 2;
    if (q.x < p.x) return 'M' + (p.x - 15) + ',' + p.y + ' C' + (p.x - 60) + ',' + p.y + ' ' + (q.x + 60) + ',' + q.y + ' ' + (q.x + 18) + ',' + q.y;
    return 'M' + x1 + ',' + p.y + ' C' + mx + ',' + p.y + ' ' + mx + ',' + q.y + ' ' + x2 + ',' + q.y;
  }
  function renderGraph() {
    svg.innerHTML = '';
    edgeEls.length = 0;
    const defs = el('defs', {}, svg);
    [['ar', 'var(--color-rule-dark)'], ['ar-hot', 'var(--color-accent-on-dark)'], ['ar-done', 'var(--color-on-dark-3)']].forEach(([id, c]) => {
      const m = el('marker', { id, viewBox: '0 0 8 8', refX: '7', refY: '4', markerWidth: '6', markerHeight: '6', orient: 'auto-start-reverse' }, defs);
      el('path', { d: 'M0,0 L8,4 L0,8 z', style: 'fill:' + c }, m);
    });
    D.COLS.forEach((c, i) => { const t = el('text', { x: 46 + i * 150 - 14, y: 26, class: 'g-col' }, svg); t.textContent = c; });
    gSuper = el('g', { 'aria-hidden': 'true' }, svg);
    gSuper.style.display = $('#show-super').checked ? '' : 'none';
    D.AGENTS.forEach((a) => { if (a.id !== 'AG-33') el('line', { x1: POS['AG-33'].x, y1: POS['AG-33'].y, x2: POS[a.id].x, y2: POS[a.id].y, class: 'g-super' }, gSuper); });
    const gE = el('g', {}, svg);
    D.EDGES.forEach(([a, b]) => { const p = el('path', { d: edgePath(a, b), class: 'g-edge', 'marker-end': 'url(#ar)' }, gE); edgeEls.push({ a, b, p }); });
    gSubs = el('g', {}, svg);
    const gN = el('g', {}, svg);
    D.AGENTS.forEach((a) => {
      const g = el('g', { class: 'g-node', tabindex: '0', role: 'button', 'aria-label': a.id + ' ' + a.name, transform: 'translate(' + POS[a.id].x + ',' + POS[a.id].y + ')' }, gN);
      el('circle', { r: 15 }, g);
      const t = el('text', { class: 'g-id' }, g); t.textContent = a.short;
      const nm = el('text', { class: 'g-name', x: 20, y: 0, style: 'text-anchor:start' }, g); nm.textContent = a.name.length > 17 ? a.name.slice(0, 16) + '…' : a.name;
      g.addEventListener('click', () => selectAgent(a.id));
      g.addEventListener('keydown', (e) => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); selectAgent(a.id); } });
      nodeEls[a.id] = g;
    });
    $('#graph-foot').textContent = D.AGENTS.length + ' nodos · ' + D.EDGES.length + ' dependencias dirigidas (de 528 enlaces posibles en una red completa) · ' + (topo().ok ? 'sin ciclos' : 'ciclo detectado');
  }
  function addSubNode(sid) {
    const sa = D.SUBAGENTS.find((s) => s.id === sid);
    if (!sa || $('[data-sub="' + sid + '"]', svg)) return;
    const target = POS[sa.reports];
    const idx = D.SUBAGENTS.filter((s) => s.reports === sa.reports).indexOf(sa);
    const x = target.x + 4 + idx * 20, y = target.y - 26;
    el('path', { d: 'M' + x + ',' + (y + 8) + ' L' + target.x + ',' + (target.y - 15), class: 'g-sub-edge' }, gSubs);
    const g = el('g', { class: 'g-node g-sub', 'data-sub': sid, tabindex: '0', role: 'button', 'aria-label': 'Subagente ' + sid, transform: 'translate(' + x + ',' + y + ')' }, gSubs);
    const inner = el('g', { class: reduced ? '' : 'g-sub-in' }, g);
    el('circle', { r: 8 }, inner);
    const t = el('text', { y: -14 }, inner); t.textContent = sid.replace('AG-', '').replace('SA-', '');
    g.addEventListener('click', () => { sideSelect(1); });
  }
  function topo() {
    const indeg = {}, adj = {};
    D.AGENTS.forEach((a) => { indeg[a.id] = 0; adj[a.id] = []; });
    D.EDGES.forEach(([a, b]) => { adj[a].push(b); indeg[b]++; });
    const q = Object.keys(indeg).filter((k) => indeg[k] === 0), order = [], level = {};
    q.forEach((k) => { level[k] = 0; });
    while (q.length) { const n = q.shift(); order.push(n); adj[n].forEach((m) => { level[m] = Math.max(level[m] || 0, level[n] + 1); if (--indeg[m] === 0) q.push(m); }); }
    return { ok: order.length === D.AGENTS.length, order, level };
  }
  $('#show-super').addEventListener('change', (e) => { gSuper.style.display = e.target.checked ? '' : 'none'; });

  // ================================================================ corrida
  const R = { t: 0, idx: 0, playing: false, speed: 1, last: 0, emitted: [], agentState: {}, spawned: [], gateOpen: false, decision: null, done: false, startedAt: null, endedAt: null, chain: '0'.repeat(64), selected: null, extra: [] };
  const END = EVENTS[EVENTS.length - 1].t;
  const SIM_PER_SEC = 20; // 1× = 20 s simulados por segundo real

  function resetRun() {
    Object.assign(R, { t: 0, idx: 0, playing: false, last: 0, emitted: [], agentState: {}, spawned: [], gateOpen: false, decision: null, done: false, startedAt: null, endedAt: null, chain: '0'.repeat(64), selected: null, extra: [], pinned: false });
    $('#log').innerHTML = ''; $('#log-empty').hidden = false;
    $('#evid').innerHTML = '<p class="muted-dark">Selecciona un evento de la bitácora.</p>'; $('#evid-hash').textContent = '';
    renderGraph(); paintClock(); updateToggle(); renderSide(); renderReport();
  }
  function paintClock() {
    const t = Math.min(R.t, END);
    $('#clock').textContent = hhmm(t) + ':' + String(Math.floor(t % 60)).padStart(2, '0');
    $('#progress-bar').style.width = (t / END) * 100 + '%';
  }
  function updateToggle() {
    const b = $('#run-toggle');
    b.textContent = R.done ? 'Repetir' : R.playing ? 'Pausar' : R.t > 0 ? 'Continuar' : 'Iniciar';
    $('#run-step').disabled = R.done || R.gateOpen;
  }
  function play() {
    if (R.done) { resetRun(); }
    if (R.gateOpen) return;
    R.playing = true; R.last = performance.now(); R.startedAt = R.startedAt || Date.now();
    updateToggle(); requestAnimationFrame(tick);
  }
  function pause() { R.playing = false; updateToggle(); }
  function tick(now) {
    if (!R.playing) return;
    const dt = (now - R.last) / 1000; R.last = now;
    R.t += dt * SIM_PER_SEC * R.speed;
    while (R.idx < EVENTS.length && EVENTS[R.idx].t <= R.t) { if (!emitNext()) break; }
    paintClock();
    if (R.playing) requestAnimationFrame(tick);
  }
  function stepOnce() {
    if (R.done || R.gateOpen) return;
    R.startedAt = R.startedAt || Date.now();
    const e = EVENTS[R.idx]; if (!e) return;
    R.t = Math.max(R.t, e.t); emitNext(); paintClock();
  }
  // devuelve false si la corrida debe detenerse (compuerta)
  function emitNext() {
    const e = Object.assign({}, EVENTS[R.idx]);
    R.idx++;
    if (e.final) applyDecisionToFinal(e);
    pushEvent(e);
    if (e.gate) { R.playing = false; R.gateOpen = true; updateToggle(); openGate(); return false; }
    if (R.idx >= EVENTS.length) finish();
    return true;
  }
  function applyDecisionToFinal(e) {
    const d = R.decision;
    if (d && d.type === 'approve') e.hal += ' Expediente aprobado por ' + d.label + ' para staging controlado; producción requiere ventana de cambio propia.';
    else e.hal += ' Sin aprobación de promoción: la corrida permanece en modo espejo.';
  }
  function pushEvent(e) {
    if (e.hashOf === 'snapshot') e.ev += ' · SNAP-001 sha256:' + (snapshotHash || 'calculando').slice(0, 16) + '…';
    R.emitted.push(e);
    const payload = JSON.stringify({ t: e.t, ag: e.ag, act: e.act, hal: e.hal, dec: e.dec, st: e.st });
    const prev = R.chain;
    E.sha256(prev + payload).then((h) => { e.hash = h; R.chain = h; if (R.selected === e) renderEvid(e); if (e.hashOf === 'chain') { e.ev = 'Hash final de bitácora sha256:' + h.slice(0, 16) + '…'; const li = $('[data-ev="' + e.i + '"] .line-ev'); if (li) li.textContent = 'Evidencia: ' + e.ev; } });
    // estado del grafo
    if (AG[e.ag]) {
      Object.values(nodeEls).forEach((n) => n.classList.remove('is-active'));
      const n = nodeEls[e.ag]; n.classList.add('is-active'); n.classList.toggle('is-blocked', e.st === 'BLOQUEADO');
      R.agentState[e.ag] = e.st;
      edgeEls.forEach((x) => {
        x.p.classList.remove('is-hot');
        if (x.b === e.ag && R.agentState[x.a]) { x.p.classList.add('is-hot'); x.p.setAttribute('marker-end', 'url(#ar-hot)'); }
        else if (R.agentState[x.a] && R.agentState[x.b]) { x.p.classList.add('is-done'); x.p.setAttribute('marker-end', 'url(#ar-done)'); }
      });
      Object.keys(R.agentState).forEach((id) => { if (id !== e.ag && nodeEls[id]) nodeEls[id].classList.add('is-done'); });
      if (!R.selected || R.follow !== false) renderAgent(e.ag);
    } else R.agentState[e.ag] = e.st;
    if (e.spawn) [].concat(e.spawn).forEach((s) => { R.spawned.push(s); addSubNode(s); });
    appendLog(e);
    if (!R.pinned) { R.selected = e; renderEvid(e); }
    renderSide(true);
  }
  function finish() {
    R.done = true; R.playing = false; R.endedAt = Date.now();
    Object.values(nodeEls).forEach((n) => n.classList.remove('is-active'));
    updateToggle(); renderReport(); renderRecon();
    toast('Corrida cerrada. Informe actualizado.');
  }

  // ---------------------------------------------------------------- bitácora
  function whoClass(id) { return id.startsWith('PAY') ? 'who who--pay' : id.startsWith('SA') || id.includes('.') ? 'who who--sa' : 'who'; }
  function stChip(st) { return '<span class="chip st-' + st.replace(' ', '_') + '">' + st + '</span>'; }
  function passesFilter(e) {
    const f = $('#log-filter').value;
    return f === 'all' || (f === 'BLOQUEADO' && e.st === 'BLOQUEADO') || (f === 'sev' && e.sev) || (f === 'PAY' && e.ag.startsWith('PAY')) || (f === 'SA' && (e.ag.startsWith('SA') || e.ag.includes('.')));
  }
  function appendLog(e) {
    $('#log-empty').hidden = true;
    const li = document.createElement('li');
    li.dataset.ev = e.i;
    li.hidden = !passesFilter(e);
    if (!reduced) li.classList.add('log-new');
    li.innerHTML = '<button type="button"><span class="t">' + hhmm(e.t) + '</span><span class="row1"><span class="' + whoClass(e.ag) + '">[' + e.ag + ']</span> ' + stChip(e.st) + (e.sev ? ' <span class="chip sev sev-' + e.sev + '">' + e.sev + '</span>' : '') + '</span><span class="act">' + esc(e.act) + '</span><span class="line">Hallazgo: ' + esc(e.hal) + '</span><span class="line line-ev">Evidencia: ' + esc(e.ev) + '</span><span class="line">Siguiente: ' + esc(e.next) + '</span></button>';
    li.querySelector('button').addEventListener('click', () => { R.selected = e; R.pinned = true; $$('#log li').forEach((x) => x.classList.toggle('is-selected', x === li)); renderEvid(e); if (AG[e.ag]) renderAgent(e.ag); });
    const log = $('#log');
    const nearBottom = log.scrollHeight - log.scrollTop - log.clientHeight < 80;
    log.appendChild(li);
    if (nearBottom) log.scrollTop = log.scrollHeight;
  }
  $('#log-filter').addEventListener('change', () => { $$('#log li').forEach((li) => { const e = R.emitted.find((x) => String(x.i) === li.dataset.ev); li.hidden = !(e && passesFilter(e)); }); });
  function eventText(e) {
    return hhmm(e.t) + ' [' + e.ag + ']\nAcción: ' + e.act + '\nEntrada: ' + e.in + '\nHallazgo: ' + e.hal + '\nEvidencia: ' + e.ev + '\nDecisión: ' + e.dec + '\nAgente siguiente: ' + e.next + '\nEstado: ' + e.st + (e.sev ? '\nSeveridad: ' + e.sev : '') + '\nHash: ' + (e.hash || 'calculando');
  }
  function renderEvid(e) {
    $('#evid-hash').textContent = e.hash ? 'sha256 ' + e.hash.slice(0, 10) + '…' : '';
    $('#evid').innerHTML = '<dl class="kv"><dt>Agente</dt><dd>' + esc(e.ag) + ' · ' + esc(nameOf(e.ag)) + '</dd><dt>Estado</dt><dd>' + stChip(e.st) + '</dd>' + (e.sev ? '<dt>Severidad</dt><dd>' + e.sev + '</dd>' : '') + '</dl><pre>' + esc(eventText(e)) + '</pre>';
  }

  // ---------------------------------------------------------------- panel lateral
  let sideIdx = 0;
  const sideSelect = tabs($('.panel--side .tabs'), (b, i) => { sideIdx = i; ['agent', 'sub', 'tasks'].forEach((k, j) => { $('#side-' + k).hidden = j !== i; }); renderSide(); });
  function selectAgent(id) {
    $$('.g-node').forEach((n) => n.classList.remove('is-selected'));
    if (nodeEls[id]) nodeEls[id].classList.add('is-selected');
    R.follow = false; renderAgent(id); sideSelect(0);
  }
  function renderAgent(id) {
    const a = AG[id]; if (!a) return;
    const evs = R.emitted.filter((e) => e.ag === id);
    const deps = D.EDGES.filter((x) => x.b === id).map((x) => x[0]);
    const outs = D.EDGES.filter((x) => x[0] === id).map((x) => x[1]);
    $('#side-agent').innerHTML = '<p class="side-sub">' + a.id + ' · ' + D.COLS[a.col] + '</p><p class="side-title">' + esc(a.name) + '</p><p class="muted-dark" style="margin-top:6px">' + esc(a.fn) + '</p><dl class="kv"><dt>Entradas</dt><dd>' + esc(a.input) + '</dd><dt>Salidas</dt><dd>' + esc(a.output) + '</dd><dt>Permisos</dt><dd>' + esc(a.perms) + '</dd><dt>Depende de</dt><dd>' + (deps.join(', ').replace(/,([^,]*)$/, ',$1') || '—') + '</dd><dt>Entrega a</dt><dd>' + (outs.join(', ') || '—') + '</dd><dt>Estado</dt><dd>' + (R.agentState[id] ? stChip(R.agentState[id]) : 'sin actividad') + '</dd><dt>Eventos</dt><dd>' + evs.length + '</dd></dl>';
  }
  function renderSide(soft) {
    if (!soft || sideIdx === 1) {
      $('#side-sub').innerHTML = '<ul class="sublist">' + D.SUBAGENTS.map((s) => '<li class="' + (R.spawned.includes(s.id) ? '' : 'is-pending') + '"><p class="side-sub">' + s.id + ' · padre ' + s.parent + ' · reporta a ' + s.reports + '</p><p style="color:var(--color-on-dark)">' + esc(s.goal) + '</p><dl class="kv"><dt>Herramientas</dt><dd>' + esc(s.tools) + '</dd><dt>Entrada</dt><dd>' + esc(s.input) + '</dd><dt>Evidencia</dt><dd>' + esc(s.evidence) + '</dd><dt>Éxito</dt><dd>' + esc(s.success) + '</dd><dt>Parada</dt><dd>' + esc(s.stop) + '</dd><dt>Límites</dt><dd>' + esc(s.limits) + '</dd></dl></li>').join('') + '</ul>';
    }
    if (!soft || sideIdx === 2) {
      const ids = Object.keys(R.agentState);
      $('#side-tasks').innerHTML = ids.length ? '<ul class="tasks">' + ids.map((id) => '<li><span>' + id + ' · ' + esc(nameOf(id)) + '</span>' + stChip(R.agentState[id]) + '</li>').join('') + '</ul>' : '<p class="muted-dark">Sin tareas activas.</p>';
    }
  }

  // ---------------------------------------------------------------- compuerta humana
  const gate = $('#gate');
  function openGate() {
    $('#gate-list').innerHTML = [
      'Regla de asignación v1.2.1 (suite ' + suite['v1.2.1'].pass + '/' + suite['v1.2.1'].total + ', FN ' + suite['v1.2.1'].fn + ')',
      'Fusión de ' + clean.log.merged + ' duplicados y re-apunte de ' + clean.log.remapped + ' pedido',
      clean.log.units + ' conversiones de unidad, ' + clean.log.typeFix + ' tipos y ' + clean.log.classFix + ' clases recalculadas',
      clean.log.rejected.length + ' registros enviados a revisión del responsable de datos',
      'Autor del cambio: AG-26. Revisión: AG-21, AG-22. Snapshot de reversión: SNAP-001'
    ].map((x) => '<li>' + esc(x) + '</li>').join('');
    $('#gate-who').value = ''; $('#gate-msg').textContent = '';
    if (typeof gate.showModal === 'function') gate.showModal(); else gate.setAttribute('open', '');
  }
  $('#gate-form').addEventListener('submit', (ev) => {
    const action = ev.submitter ? ev.submitter.value : 'reject';
    const who = $('#gate-who').value;
    const label = $('#gate-who').selectedOptions[0].textContent;
    if (action === 'approve') {
      if (!who) { ev.preventDefault(); $('#gate-msg').textContent = 'Selecciona quién aprueba.'; return; }
      if (who.startsWith('AG-')) {
        ev.preventDefault();
        $('#gate-msg').textContent = 'Bloqueado: un agente no puede aprobar cambios críticos' + (who === 'AG-26' ? ', y el autor no puede aprobar su propio cambio.' : '.');
        pushEvent({ i: 1000 + R.extra.length, t: R.t, ag: 'AG-21', act: 'Rechaza intento de aprobación por agente.', in: 'Aprobación solicitada con identidad ' + who, hal: 'Segregación de funciones: la aprobación de cambios críticos es exclusiva de personas autorizadas.', ev: 'Política de gobierno §5', dec: 'Mantener compuerta abierta.', next: 'AG-31', st: 'BLOQUEADO', sev: 'Alta' });
        R.extra.push(1);
        return;
      }
      R.decision = { type: 'approve', who, label };
    } else R.decision = { type: 'reject', who: who || 'sin identidad', label: 'mantener en espejo' };
    R.gateOpen = false;
    const d = R.decision;
    pushEvent({ i: 2000, t: R.t + 20, ag: 'AG-31', act: 'Registra la decisión humana.', in: 'Expediente EXP-0417', hal: d.type === 'approve' ? 'Aprobado por ' + d.label + ' para staging controlado.' : 'Decisión: mantener en espejo. No se promueve ningún cambio.', ev: 'Decisión firmada en bitácora', dec: d.type === 'approve' ? 'Promoción a staging habilitada; producción requiere ventana de cambio.' : 'Corrida continúa en modo espejo.', next: 'AG-32', st: d.type === 'approve' ? 'APROBADO' : 'COMPLETADO' });
    setTimeout(play, 250);
  });
  gate.addEventListener('cancel', (ev) => { ev.preventDefault(); });

  // controles
  $('#run-toggle').addEventListener('click', () => (R.playing ? pause() : play()));
  $('#run-step').addEventListener('click', stepOnce);
  $('#run-reset').addEventListener('click', resetRun);
  $$('[data-speed]').forEach((b) => b.addEventListener('click', () => { R.speed = +b.dataset.speed; $$('[data-speed]').forEach((x) => x.setAttribute('aria-checked', String(x === b))); }));
  $$('[data-action="start"]').forEach((a) => a.addEventListener('click', () => { setTimeout(() => { if (!R.playing && !R.gateOpen) play(); }, 450); }));

  // ================================================================ validador
  const VARIANTS = [
    ...D.FIXTURES.map((f) => ({ id: f.key, label: f.nombre + ' · ' + f.sku, rec: { sku: f.sku, nombre: f.nombre, fam: f.fam, peso_kg: f.peso_kg, dims: f.dims.slice(), clase: D.FAMILIES[f.fam].clase, requiere_2: D.FAMILIES[f.fam].crew === 2 } })),
    { id: 'DUP', label: 'LAV-FL-20-B · duplicado sin datos', rec: { sku: 'LAV-FL-20-B', fam: 'LAVADORA', peso_kg: null, dims: null, clase: null, requiere_2: null } },
    { id: 'ADV', label: 'LAV-FL-20 · metros + toneladas (adversarial)', rec: { sku: 'LAV-FL-20', fam: 'LAVADORA', peso_kg: 0.072, dims: [0.85, 0.6, 0.66], clase: 'LINEA_BLANCA', requiere_2: null } }
  ];
  const vp = $('#val-prod');
  vp.innerHTML = VARIANTS.map((v) => '<option value="' + v.id + '">' + esc(v.label) + '</option>').join('');
  $('#val-veh').innerHTML = D.VEHICLES.map((v, i) => '<label><input type="radio" name="veh" value="' + v.id + '"' + (i === 0 ? ' checked' : '') + ' /><span>' + v.name + '</span></label>').join('');
  let valRec = null;
  function loadVariant() {
    const v = VARIANTS.find((x) => x.id === vp.value);
    valRec = JSON.parse(JSON.stringify(v.rec));
    $('#val-peso').value = valRec.peso_kg == null ? '' : valRec.peso_kg;
    [0, 1, 2].forEach((i) => { $('#val-d' + i).value = valRec.dims ? valRec.dims[i] : ''; });
    renderVerdict();
  }
  function readForm() {
    const peso = $('#val-peso').value.trim();
    const dims = [0, 1, 2].map((i) => $('#val-d' + i).value.trim());
    const rec = Object.assign({}, valRec);
    rec.peso_kg = peso === '' ? null : isNaN(+peso) ? peso : +peso;
    rec.dims = dims.some((d) => d === '') ? null : dims.map((d) => +d);
    [['#val-peso', peso], ['#val-d0', dims[0]], ['#val-d1', dims[1]], ['#val-d2', dims[2]]].forEach(([s, v]) => $(s).setAttribute('aria-invalid', String(v !== '' && isNaN(+v.replace(/\s*kg$/i, '')))));
    return rec;
  }
  function renderVerdict() {
    const rec = readForm();
    const veh = $('input[name="veh"]:checked').value;
    const zona = $('#val-zona').value, ver = $('#val-ver').value;
    const r = E.evaluate(ver, rec, veh, zona);
    const best = E.assign(ver, rec, zona);
    const fam = D.FAMILIES[rec.fam];
    const pesoN = typeof rec.peso_kg === 'number' ? rec.peso_kg : parseFloat(String(rec.peso_kg || ''));
    let defect = null;
    if (!rec.dims || isNaN(pesoN)) defect = 'DIMS_NULAS';
    else if (pesoN < fam.peso[0] || pesoN > fam.peso[1] || Math.max(...rec.dims) < fam.dimMax[0] * 0.8 || Math.max(...rec.dims) > fam.dimMax[1] * 1.2) defect = 'UNIDAD_METROS';
    const truth = E.truthOk(Object.assign({}, rec, { defect, truth: defect ? null : { peso_kg: pesoN, dims: rec.dims, crew: rec.requiere_2 == null ? fam.crew : rec.requiere_2 ? 2 : 1 } }), veh, zona);
    const mismatch = r.ok && !truth;
    $('#verdict').innerHTML = '<div class="verdict__head"><span class="verdict__word ' + (r.ok ? 'is-ok' : 'is-bad') + '">' + (r.ok ? 'Permitido' : 'Bloqueado') + '</span><span class="verdict__code">' + r.code + ' · ' + E.RULES[ver].label + '</span></div><p class="note">' + esc(E.V[veh].name) + ' · capacidad ' + E.V[veh].cap + ' kg · caja ' + E.V[veh].box.join('×') + ' cm · tripulación ' + E.V[veh].crew + '</p><ul class="checks">' + r.checks.map((c) => '<li><span class="mark ' + (c.ok === null ? 'mark--na' : c.ok ? 'mark--ok' : 'mark--bad') + '">' + (c.ok === null ? '–' : c.ok ? '✓' : '✕') + '</span><span><b>' + esc(c.name) + '</b><small>' + esc(c.detail) + '</small></span></li>').join('') + '</ul><p class="verdict__foot">' + (best.vehicle ? 'Vehículo compatible más económico: <b>' + esc(E.V[best.vehicle].name) + '</b>.' : 'Ningún vehículo compatible: el pedido pasa a revisión.') + (mismatch ? ' <span class="msg msg--bad">Esta versión permite una asignación que la política rechaza (falso negativo).</span>' : '') + '</p>';
  }
  vp.addEventListener('change', loadVariant);
  $('#val-form').addEventListener('input', renderVerdict);
  $('#val-form').addEventListener('change', (e) => { if (e.target !== vp) renderVerdict(); });

  // ================================================================ PAY MEX
  const RAILS = [
    { id: 'SPEI', name: 'SPEI', cur: ['MXN'], fijo: 6, pct: 0, fx: 0, tiempo: 'minutos', dias: 0, limite: null },
    { id: 'TARJ', name: 'Tarjeta corporativa', cur: ['MXN', 'USD'], fijo: 0, pct: 2.9, fx: 1.5, tiempo: 'inmediato', dias: 0, limite: 50000 },
    { id: 'SWIFT', name: 'Transferencia internacional', cur: ['USD'], fijo: 650, pct: 0, fx: 0.8, tiempo: '1–3 días hábiles', dias: 3, limite: null },
    { id: 'XB', name: 'Proveedor transfronterizo autorizado', cur: ['USD'], fijo: 90, pct: 0.35, fx: 0.3, tiempo: 'mismo día', dias: 1, limite: null }
  ];
  const PAY = { inv: 0, step: 0, tamper: false, approvals: [], results: [], halted: false, idem: '' };
  const STEP_DEFS = [
    ['PAY-01', 'Recepción de factura y orden de compra'], ['PAY-02', 'Extracción semántica'], ['PAY-03', 'Validación de identidad y datos del proveedor'], ['PAY-04', 'Riesgo, fraude y cumplimiento'], ['PAY-05', 'Rieles disponibles y autorizados'], ['PAY-06', 'Comisiones, tipo de cambio y costo total'], ['PAY-07', 'Recomendación de ruta'], ['PAY-08', 'Aprobación humana según política'], ['PAY-09', 'Ejecución con proveedor autorizado'], ['PAY-10', 'Confirmación y conciliación']
  ];
  const inv = () => D.INVOICES[PAY.inv];
  const total = (i) => Math.round((i.subtotal + i.iva) * 100) / 100;
  const fxRate = () => { const v = parseFloat($('#fx').value); return v > 0 ? v : NaN; };
  const totalMXN = (i) => (i.moneda === 'USD' ? total(i) * fxRate() : total(i));
  const masterClabe = (i) => (i.clabeBase ? E.clabeFull(i.clabeBase) : null);
  const docClabe = (i) => { if (!i.clabeBase) return null; if (!PAY.tamper) return masterClabe(i); return E.clabeFull('01218000987654321'); };
  const needApprovals = (i) => (totalMXN(i) > 50000 ? 2 : 1);

  $('#inv-tabs').innerHTML = D.INVOICES.map((x, k) => '<button role="tab" aria-selected="' + (k === 0) + '">' + esc(x.label) + '</button>').join('');
  tabs($('#inv-tabs'), (b, k) => { PAY.inv = k; payReset(); });

  function railCost(r, i) {
    const base = totalMXN(i);
    return r.fijo + base * (r.pct / 100) + (i.moneda === 'USD' ? base * (r.fx / 100) : 0);
  }
  function railEligible(r, i) {
    if (!r.cur.includes(i.moneda)) return 'moneda no soportada';
    if (r.limite && totalMXN(i) > r.limite) return 'excede límite de ' + money(r.limite);
    if (i.moneda === 'USD' && r.id === 'TARJ') return 'no autorizado para proveedor extranjero';
    return null;
  }
  function recommend(i) {
    const ok = RAILS.filter((r) => !railEligible(r, i)).sort((a, b) => railCost(a, i) - railCost(b, i));
    return ok[0] || null;
  }
  function renderRails() {
    const i = inv(); const rec = PAY.step >= 7 ? recommend(i) : null;
    $('#rails').innerHTML = '<thead><tr><th>Riel</th><th class="num">Fijo</th><th class="num">%</th><th class="num">FX %</th><th>Tiempo</th><th class="num">Costo</th></tr></thead><tbody>' + RAILS.map((r) => {
      const no = railEligible(r, i);
      return '<tr class="' + (no ? 'is-na' : rec && rec.id === r.id ? 'is-rec' : '') + '"><td>' + r.name + (no ? '<br><small>' + esc(no) + '</small>' : rec && rec.id === r.id ? '<br><small>recomendado</small>' : '') + '</td><td class="num"><input class="input" data-rail="' + r.id + '" data-k="fijo" value="' + r.fijo + '" aria-label="Comisión fija ' + r.name + '" inputmode="decimal" /></td><td class="num"><input class="input" data-rail="' + r.id + '" data-k="pct" value="' + r.pct + '" aria-label="Porcentaje ' + r.name + '" inputmode="decimal" /></td><td class="num">' + (i.moneda === 'USD' ? r.fx : '—') + '</td><td>' + r.tiempo + '</td><td class="num">' + (no || isNaN(railCost(r, i)) ? '—' : money(railCost(r, i))) + '</td></tr>';
    }).join('') + '</tbody>';
  }
  $('#rails').addEventListener('change', (e) => { const t = e.target; if (!t.dataset.rail) return; const v = parseFloat(t.value); const r = RAILS.find((x) => x.id === t.dataset.rail); if (!isNaN(v) && v >= 0) { r[t.dataset.k] = v; t.setAttribute('aria-invalid', 'false'); } else { t.setAttribute('aria-invalid', 'true'); return; } renderRails(); refreshPayOutputs(); });
  $('#fx').addEventListener('input', () => { $('#fx').setAttribute('aria-invalid', String(isNaN(fxRate()))); renderRails(); renderDoc(); renderApprovals(); });

  function renderDoc() {
    const i = inv(); const x = PAY.step >= 2;
    const hl = (s) => (x ? '<span class="extract">' + esc(s) + '</span>' : esc(s));
    $('#pay-doc').innerHTML = '<div class="doc__top"><div><p class="mono-label">Factura comercial</p><p class="doc__id">' + esc(i.id) + '</p></div><div><p class="mono-label">Orden de compra</p><p>' + esc(i.oc) + '</p></div></div><dl class="kv"><dt>Proveedor</dt><dd>' + hl(i.proveedor) + '</dd><dt>RFC</dt><dd>' + hl(i.rfc) + '</dd><dt>Moneda</dt><dd>' + hl(i.moneda) + '</dd><dt>Fecha</dt><dd>' + hl(i.fecha) + '</dd><dt>Vence</dt><dd>' + esc(i.vence) + '</dd><dt>' + (i.clabeBase ? 'CLABE' : 'SWIFT/BIC') + '</dt><dd class="mono">' + hl(i.clabeBase ? docClabe(i) : i.swift) + '</dd><dt>Referencia</dt><dd>' + esc(i.ref) + '</dd></dl><div class="doc__lines">' + i.conceptos.map((c) => '<p>' + hl(c) + '</p>').join('') + '<p class="note">Subtotal ' + money(i.subtotal, i.moneda) + (i.iva ? ' · IVA ' + money(i.iva, i.moneda) : '') + '</p></div><div class="doc__total"><span>Total</span><span>' + (x ? '<span class="extract">' : '') + money(total(i), i.moneda) + (x ? '</span>' : '') + '</span></div>' + (i.moneda === 'USD' ? '<p class="note">Equivalente con tipo de cambio supuesto: ' + (isNaN(totalMXN(i)) ? '—' : money(totalMXN(i))) + '</p>' : '') + (i.clabeBase ? '<label class="doc__tamper"><input type="checkbox" id="tamper"' + (PAY.tamper ? ' checked' : '') + ' /><span>Probar fraude: la factura trae una CLABE distinta a la registrada en el maestro de proveedores.</span></label>' : '');
    const t = $('#tamper'); if (t) t.addEventListener('change', () => { PAY.tamper = t.checked; payReset(true); });
  }
  function runStep(k) {
    const i = inv();
    const out = (st, txt) => ({ st, txt });
    switch (k) {
      case 0: return out('COMPLETADO', 'Recibidos ' + i.id + ' y ' + i.oc + '. Documento con hash registrado.');
      case 1: return out('COMPLETADO', 'Extraídos: proveedor, RFC, moneda ' + i.moneda + ', total ' + money(total(i), i.moneda) + ', fecha, ' + i.conceptos.length + ' concepto(s). Confianza mínima por campo 0.94 (umbral 0.90).');
      case 2: {
        const rfcOk = E.rfcValid(i.rfc);
        if (!i.clabeBase) return out('COMPLETADO', 'RFC genérico de extranjero ' + i.rfc + ' (' + (rfcOk ? 'formato válido' : 'formato inválido') + '). SWIFT registrado en maestro coincide. Requiere constancia fiscal extranjera en expediente.');
        const c = docClabe(i), m = masterClabe(i);
        if (c !== m) return out('BLOQUEADO', 'CLABE de la factura ' + c + ' (dígito ' + (E.clabeValid(c) ? 'válido' : 'inválido') + ') no coincide con la registrada ' + m + '. Cambio de cuenta requiere verificación por canal independiente.');
        return out('COMPLETADO', 'RFC ' + (rfcOk ? 'con formato válido' : 'inválido') + '. CLABE con dígito de control ' + (E.clabeValid(c) ? 'válido' : 'inválido') + ' y coincidente con el maestro de proveedores.');
      }
      case 3: {
        let score = 8; const why = [];
        if (PAY.tamper) { score += 70; why.push('cambio de cuenta'); }
        if (totalMXN(i) > 50000) { score += 15; why.push('importe > $50,000'); }
        if (i.moneda !== 'MXN') { score += 10; why.push('proveedor extranjero'); }
        const ocOk = Math.abs(i.ocMonto - total(i)) < 0.01; if (!ocOk) { score += 30; why.push('importe ≠ OC'); }
        const lvl = score >= 60 ? 'alto' : score >= 25 ? 'medio' : 'bajo';
        return out(lvl === 'alto' ? 'BLOQUEADO' : 'COMPLETADO', 'Puntaje ' + score + '/100 · riesgo ' + lvl + (why.length ? ' (' + why.join(', ') + ')' : '') + '. Factura ↔ OC: ' + (ocOk ? 'coinciden' : 'no coinciden') + '.' + (lvl === 'alto' ? ' Flujo detenido.' : ''));
      }
      case 4: { const ok = RAILS.filter((r) => !railEligible(r, i)); return out('COMPLETADO', ok.length + ' riel(es) autorizados: ' + ok.map((r) => r.name).join(', ') + '.'); }
      case 5: { if (isNaN(totalMXN(i))) return out('BLOQUEADO', 'Tipo de cambio supuesto inválido.'); const ok = RAILS.filter((r) => !railEligible(r, i)); return out('COMPLETADO', ok.map((r) => r.name + ' ' + money(railCost(r, i))).join(' · ') + '. Tarifas supuestas.'); }
      case 6: { const r = recommend(i); return r ? out('COMPLETADO', r.name + ': menor costo total (' + money(railCost(r, i)) + ') dentro de la fecha de vencimiento ' + i.vence + '.') : out('BLOQUEADO', 'Sin riel elegible.'); }
      case 7: { const n = needApprovals(i); const have = PAY.approvals.length; return have >= n ? out('APROBADO', have + '/' + n + ' aprobaciones de personas distintas al solicitante.') : out('PENDIENTE', 'Política: ' + (n === 2 ? 'doble aprobación (importe > $50,000 MXN)' : 'una aprobación') + '. Registradas ' + have + '/' + n + '.'); }
      case 8: return out('BLOQUEADO', 'Orden preparada, no enviada. Ejecutar requiere proveedor financiero autorizado, credenciales en bóveda y ventana operativa. Clave de idempotencia: ' + (PAY.idem || '…'));
      case 9: return out('PENDIENTE', 'Factura ↔ OC conciliadas. Comprobante de pago pendiente: no existe pago ejecutado.');
    }
  }
  function renderSteps() {
    $('#pay-steps').innerHTML = STEP_DEFS.map(([id, n], k) => {
      const r = PAY.results[k];
      const cls = r ? 'is-done' : k === PAY.step ? 'is-current' : '';
      const st = r ? r.st : k === PAY.step && !PAY.halted ? 'EN ESPERA' : '';
      return '<li class="' + cls + '"><span class="sid">' + id + '</span><span><span class="sname">' + n + '</span>' + (r ? '<span class="sout">' + esc(r.txt) + '</span>' : '') + '</span>' + (st ? '<span class="chip chip--l cl-' + st.split(' ')[0] + '">' + st + '</span>' : '<span></span>') + '</li>';
    }).join('');
    const atApproval = PAY.step === 7 && PAY.results[7] && PAY.results[7].st === 'PENDIENTE';
    $('#pay-next').disabled = PAY.halted || PAY.step >= STEP_DEFS.length || atApproval;
    $('#pay-all').disabled = PAY.halted || PAY.step >= 7;
  }
  async function payNext() {
    if (PAY.halted || PAY.step >= STEP_DEFS.length) return;
    if (PAY.step === 8) { const i = inv(); const r = recommend(i); PAY.idem = (await E.sha256([i.id, total(i), r && r.id, docClabe(i) || i.swift, PAY.approvals.map((a) => a.who).join('+')].join('|'))).slice(0, 32); }
    const r = runStep(PAY.step);
    PAY.results[PAY.step] = r;
    if (r.st === 'BLOQUEADO' && PAY.step < 8) PAY.halted = true;
    if (!(PAY.step === 7 && r.st === 'PENDIENTE')) PAY.step++;
    renderAll();
  }
  async function payAll() { while (!PAY.halted && PAY.step < 7) await payNext(); if (!PAY.halted && PAY.step === 7) await payNext(); }
  function payReset(keepTamper) { PAY.step = 0; PAY.results = []; PAY.approvals = []; PAY.halted = false; PAY.idem = ''; if (!keepTamper) PAY.tamper = false; renderAll(); }
  function refreshPayOutputs() { for (let k = 4; k < PAY.results.length; k++) if (PAY.results[k] && k < 8) PAY.results[k] = runStep(k); renderSteps(); }
  function renderApprovals() {
    const i = inv(); const n = needApprovals(i);
    const active = PAY.step === 7 && !PAY.halted;
    $('#approvals').innerHTML = '<h3 class="h3">Aprobación de pago</h3><p class="note">Solicitante: Analista de cuentas por pagar. Política: ' + (n === 2 ? 'dos aprobadores distintos (importe > $50,000 MXN)' : 'un aprobador') + '. La aprobación logística de la consola no autoriza pagos.</p><div class="approver"><div class="approver__row"><select class="select" id="ap-who" aria-label="Aprobador"' + (active ? '' : ' disabled') + '><option value="">Selecciona aprobador</option><option value="teso">Tesorería (persona)</option><option value="contra">Contraloría (persona)</option><option value="cxp">Analista CxP (solicitante)</option><option value="pay07">PAY-07 (agente)</option></select><button class="btn btn--primary btn--sm" id="ap-add" type="button"' + (active ? '' : ' disabled') + '>Registrar</button></div><p class="msg" id="ap-msg">' + (PAY.approvals.length ? 'Aprobaciones: ' + PAY.approvals.map((a) => esc(a.label)).join(', ') + ' (' + PAY.approvals.length + '/' + n + ')' : active ? 'Esperando aprobación.' : 'Disponible al llegar a PAY-08.') + '</p></div>';
    const add = $('#ap-add');
    if (add) add.addEventListener('click', () => {
      const s = $('#ap-who'); const v = s.value; const m = $('#ap-msg');
      if (!v) { m.className = 'msg msg--warn'; m.textContent = 'Selecciona un aprobador.'; return; }
      if (v === 'pay07') { m.className = 'msg msg--bad'; m.textContent = 'Bloqueado: un agente no puede aprobar pagos.'; return; }
      if (v === 'cxp') { m.className = 'msg msg--bad'; m.textContent = 'Bloqueado: el solicitante no puede aprobar su propia solicitud.'; return; }
      if (PAY.approvals.some((a) => a.who === v)) { m.className = 'msg msg--bad'; m.textContent = 'Esa persona ya aprobó; se requiere un aprobador distinto.'; return; }
      PAY.approvals.push({ who: v, label: s.selectedOptions[0].textContent });
      PAY.results[7] = runStep(7);
      if (PAY.results[7].st === 'APROBADO') PAY.step = 8;
      renderAll();
    });
  }
  function renderRecon() {
    const i = inv();
    const ocOk = Math.abs(i.ocMonto - total(i)) < 0.01;
    const delivered = i.ref === 'PED-SIM-000417' ? (R.done ? 'VAN asignado en espejo' : 'pendiente de corrida') : 'lote fuera de esta corrida';
    const rows = [['Factura ↔ orden de compra', ocOk ? 'coincide' : 'diferencia'], ['Proveedor ↔ maestro', PAY.results[2] ? (PAY.results[2].st === 'BLOQUEADO' ? 'no coincide' : 'coincide') : 'sin validar'], ['Servicio ↔ entrega', delivered], ['Comprobante de pago', 'pendiente · no ejecutado']];
    $('#recon').innerHTML = '<h3 class="h3">Conciliación</h3><ul class="recon">' + rows.map(([k, v]) => '<li><span>' + k + '</span><span class="mono">' + esc(v) + '</span></li>').join('') + '</ul>' + (PAY.idem ? '<p class="idem">Idempotency-Key ' + PAY.idem + '</p><p class="msg msg--warn">Estado: PREPARADO · NO EJECUTADO</p>' : '');
  }
  function renderAll() { renderDoc(); renderSteps(); renderRails(); renderApprovals(); renderRecon(); }
  $('#pay-next').addEventListener('click', payNext);
  $('#pay-all').addEventListener('click', payAll);
  $('#pay-reset').addEventListener('click', () => payReset());

  // ================================================================ arquitectura
  const ARCH = [
    ['A', 'Arquitectura', () => '<p class="arch__label">A · Diagrama textual</p><pre>' + esc(`┌──────────────────────── Interfaz ────────────────────────┐
│ Consola · Grafo de agentes · Bitácora · Evidencias · Informe │
└───────────────┬──────────────────────────────┬───────────┘
                │ eventos (append-only)         │ decisiones humanas
┌───────────────▼────────────── KIILONOVA ─────▼───────────┐
│ AG-01 Orquestador raíz ── crea subagentes SA-01.x          │
│ AG-33 Master orchestrator ── supervisa y resuelve          │
│ Diagnóstico AG-02…12 · Análisis AG-15…19 · Diseño AG-23…26 │
│ Pruebas AG-20, 27…30 · Gobernanza AG-21, 22, 31, 32        │
└──────┬───────────────────────┬───────────────────┬────────┘
       │ lectura/escritura      │ costo de flete    │ hashes
┌──────▼──────── Entorno espejo ┐ ┌────▼──── PAY MEX ────────┐
│ réplica aislada · seed ${SEED}  │ │ PAY-01…07 preparan       │
│ LVP_PRODUCT_MASTER  LVP_INVENTORY│ │ PAY-08 aprobación humana │
│ LVP_ORDER_MANAGEMENT LVP_WAREHOUSE_WMS│ PAY-09 conector (inactivo)│
│ LVP_TRANSPORT_MASTER LVP_LOGISTICS_RULES│ PAY-10 conciliación    │
└──────┬──────────────────────────┘ └────┬────────────────────┘
       │ promoción solo con expediente aprobado
┌──────▼──────────── Gobernanza ───────────▼────────────────┐
│ identidad · permisos por agente · AG-21 bloqueo · AG-31     │
│ aprobación humana · SNAP-001 reversión · AG-32 auditoría    │
└───────────────────────────────────────────────────────────┘`) + '</pre>'],
    ['B', 'Dependencias', () => { const t = topo(); const lv = {}; t.order.forEach((id) => { (lv[t.level[id]] = lv[t.level[id]] || []).push(id); }); return '<p class="arch__label">B · Grafo dirigido · orden topológico calculado</p><p>' + D.EDGES.length + ' aristas dirigidas, ' + (t.ok ? 'sin ciclos' : 'con ciclos') + '. Una red completa no dirigida de 33 nodos tendría 528 enlaces; la red de supervisión de AG-33 se muestra como capa visual y no transporta datos.</p><pre>' + esc(Object.keys(lv).map((k) => 'Nivel ' + k.padStart(2, ' ') + ' · ' + lv[k].join('  ')).join('\n') + '\n\nAristas\n' + D.EDGES.map(([a, b]) => a + ' → ' + b).join('\n')) + '</pre>'; }],
    ['C', 'Agentes', () => '<p class="arch__label">C · Agentes, funciones, entradas, salidas y permisos</p><div class="table-wrap"><table class="table"><thead><tr><th>ID</th><th>Agente</th><th>Función</th><th>Entradas</th><th>Salidas</th><th>Permisos</th></tr></thead><tbody>' + D.AGENTS.slice().sort((a, b) => a.id.localeCompare(b.id)).map((a) => '<tr><td class="mono">' + a.id + '</td><td>' + esc(a.name) + '</td><td>' + esc(a.fn) + '</td><td>' + esc(a.input) + '</td><td>' + esc(a.output) + '</td><td>' + esc(a.perms) + '</td></tr>').join('') + Object.keys(PAYNAMES).map((k) => '<tr><td class="mono">' + k + '</td><td>' + PAYNAMES[k] + '</td><td colspan="3">Ver flujo PAY MEX</td><td>' + (k === 'PAY-08' ? 'Solicita aprobación · nunca aprueba' : k === 'PAY-09' ? 'Ejecuta solo con credenciales en bóveda y aprobación válida' : 'Lectura de documentos y maestro de proveedores') + '</td></tr>').join('') + '</tbody></table></div>'],
    ['D', 'Datos', () => '<p class="arch__label">D · Esquema mínimo</p><pre>' + esc(`LVP_PRODUCT_MASTER (sku PK, ean UNIQUE NOT NULL, nombre, categoria, familia,
  peso_kg DECIMAL(9,3) NOT NULL CHECK > 0, largo_cm, ancho_cm, alto_cm DECIMAL(7,2) NOT NULL,
  clase_logistica ENUM(PAQ_CHICO, MEDIANO, VOLUMINOSO, LINEA_BLANCA) NOT NULL,
  requiere_2_personas BOOL NOT NULL, fragil BOOL, data_owner NOT NULL, version INT, updated_at)

LVP_INVENTORY (mov_id PK, sku FK→PRODUCT_MASTER.sku, cedis_id FK→WAREHOUSE, qty INT, ts)
LVP_ORDER_MANAGEMENT (pedido_id PK, sku FK→PRODUCT_MASTER.sku, zona_id FK, cliente_ref, estado, ts)
LVP_WAREHOUSE_WMS (ubicacion_id PK, cedis_id, sku FK, movimiento, ts)
LVP_TRANSPORT_MASTER (vehiculo_tipo PK, capacidad_kg, caja_largo/ancho/alto_cm, tripulacion, costo_ref)
LVP_ZONE_RULES (zona_id PK, vehiculo_tipo FK, permitido BOOL, horario)
LVP_LOGISTICS_RULES (regla_id, version, hash, estado ENUM(candidata, aprobada, retirada), autor, aprobador)
ASSIGNMENT (pedido_id FK, vehiculo_tipo FK, regla_version FK, codigo_motivo, run_id, ts)

PAY_INVOICE (factura_id PK, proveedor_id FK, oc_id FK, moneda, subtotal, iva, total, hash_doc)
PAY_SUPPLIER (proveedor_id PK, rfc, clabe_registrada, swift, verificado_en, canal_verificacion)
PAY_INTENT (intent_id PK, factura_id FK, riel, costo_total, idempotency_key UNIQUE, estado)
PAY_APPROVAL (intent_id FK, aprobador_id, rol, ts)  -- aprobador ≠ solicitante, distinto por intent
PAY_RECON (intent_id FK, factura_ok, oc_ok, entrega_ok, comprobante_ref)`) + '</pre>'],
    ['E', 'Reglas', () => '<p class="arch__label">E · Validación logística v1.2.1 · pseudocódigo</p><pre>' + esc(`función asignar(pedido, regla = v1.2.1):
  p ← catálogo[resolver_sobreviviente(pedido.sku)]
  si p.peso = nulo o alguna(p.dims) = nulo:        devolver BLOQUEADO(DATO_FALTANTE)   # nunca clase por defecto
  peso ← a_número(p.peso)   si falla: BLOQUEADO(TIPO_INVALIDO)
  fam ← familia(p.categoria)
  si peso ∉ fam.rango_peso o max(p.dims) ∉ fam.rango_lado × [0.8, 1.2]:
                                                    devolver BLOQUEADO(MAGNITUD_IMPLAUSIBLE) → revisión
  tripulación ← p.requiere_2 ?? fam.tripulación
  para v en flota ordenada por costo:
    si peso ≤ v.capacidad
     y ordenar_desc(p.dims) ≤ ordenar_desc(v.caja) componente a componente
     y (tripulación < 2 o v.tripulación ≥ 2)
     y v ∈ zona(pedido).permitidos:
        devolver ASIGNADO(v, traza)
  devolver BLOQUEADO(SIN_VEHICULO_COMPATIBLE) → planeación

v1.0 (vigente):  clase ← p.clase ?? PAQ_CHICO; devolver más_barato(mapa_clase[clase])`) + '</pre>'],
    ['F', 'Contratos API', () => '<p class="arch__label">F · Contratos ilustrativos</p><pre>' + esc(`POST /v1/logistics/assign
Headers: Authorization: Bearer <token de servicio>, Idempotency-Key: <uuid>
{ "pedido": "PED-SIM-000417", "zona": "NORMAL", "regla": "v1.2.1" }
200 { "asignado": "VAN", "rechazados": [{"vehiculo":"MOTO","motivo":"EXCEDE_PESO"}], "traza_id": "…" }
422 { "codigo": "DATO_FALTANTE" | "MAGNITUD_IMPLAUSIBLE" | "TIPO_INVALIDO", "sku": "…", "revision": true }
409 { "codigo": "IDEMPOTENCIA_CONFLICTO" }

POST /v1/payments/intents            { factura_id, oc_id }        → 201 { intent_id, estado: "PREPARADO" }
POST /v1/payments/intents/{id}/approvals { aprobador_id, rol }    → 200 { aprobaciones: n, requeridas: m }
     403 si aprobador = solicitante, aprobador es agente o ya aprobó
POST /v1/payments/intents/{id}/execute   Idempotency-Key requerido
     412 si aprobaciones < requeridas · 503 si conector sin credenciales
GET  /v1/payments/intents/{id}/reconciliation → { factura_ok, oc_ok, entrega_ok, comprobante }`) + '</pre>'],
    ['G', 'Pruebas', () => '<p class="arch__label">G · Estrategia de pruebas · resultados calculados en este navegador</p><ul class="list"><li>Unitarias: 8 productos × 4 vehículos.</li><li>Zona: pantalla y refrigerador en centro histórico.</li><li>Regresión: clase nula, duplicado sin datos, peso como texto, gramos, clase inconsistente.</li><li>Adversarial: metros + toneladas con tripulación nula (ADV-005).</li><li>Escenarios: ' + prof.orders + ' pedidos sintéticos por familia; estrés de ' + fmt(S.stress.n) + ' asignaciones.</li></ul><div class="table-wrap"><table class="table"><thead><tr><th>Versión</th><th class="num">Aprobadas</th><th class="num">%</th><th class="num">FP</th><th class="num">FN</th><th>Fallas</th></tr></thead><tbody>' + Object.values(suite).map((r) => '<tr><td class="mono">' + r.version + '</td><td class="num">' + r.pass + '/' + r.total + '</td><td class="num">' + r.pct + '</td><td class="num">' + r.fp + '</td><td class="num">' + r.fn + '</td><td>' + (r.failures.slice(0, 4).map((f) => esc(f.name)).join('; ') + (r.failures.length > 4 ? '; +' + (r.failures.length - 4) : '') || '—') + '</td></tr>').join('') + '</tbody></table></div>'],
    ['H', 'Seguridad', () => '<p class="arch__label">H · Seguridad y gobernanza</p><div class="arch-cols"><ul class="list"><li>Identidad por agente con permisos mínimos; ningún agente tiene credenciales de producción.</li><li>AG-21 puede bloquear acciones; AG-33 resuelve conflictos pero no amplía permisos.</li><li>AG-30 propone versiones; no promueve código ni modifica permisos, incluidos los propios.</li><li>Segregación: autor ≠ revisor ≠ aprobador. Ningún agente aprueba cambios críticos.</li><li>Bitácora solo-anexar con hashes SHA-256 encadenados (AG-32).</li></ul><ul class="list"><li>Datos sintéticos o anonimizados en espejo; sin datos personales.</li><li>Pagos: credenciales en bóveda, proveedor autorizado según jurisdicción, límites, doble aprobación sobre umbral, idempotencia, conciliación.</li><li>Cambio de cuenta bancaria del proveedor = verificación por canal independiente.</li><li>Reversión: snapshot previo a cada transformación; regla anterior queda versionada.</li><li>Retención de bitácora y expedientes según política del cliente (dato por confirmar).</li></ul></div>'],
    ['I', 'Despliegue', () => '<p class="arch__label">I · Plan por etapas · cada salida exige aprobación humana</p><div class="table-wrap"><table class="table"><thead><tr><th>Etapa</th><th>Alcance</th><th>Condición de salida</th></tr></thead><tbody>' + [
      ['0 · Espejo', 'Datos sintéticos, reglas candidatas', 'Suite 100 %, FN = 0, expediente aprobado'],
      ['1 · Staging', 'Copia anonimizada de catálogo y flota reales', 'Paridad de esquema, 0 regresiones, revisión de datos maestros'],
      ['2 · Sombra', 'v1.2.1 calcula en paralelo sin decidir', 'Discrepancias v1.0 vs v1.2.1 revisadas 2 semanas'],
      ['3 · Piloto', 'Un CEDIS, una familia (línea blanca)', 'Tasa de entregas fallidas no empeora; reversión probada'],
      ['4 · Ampliación', 'Todas las familias y CEDIS', 'Monitoreo y alertas activas, umbrales acordados'],
      ['5 · PAY MEX', 'Conector con proveedor autorizado', 'Contrato, credenciales en bóveda, pruebas de idempotencia y conciliación']
    ].map((r) => '<tr><td>' + r.join('</td><td>') + '</td></tr>').join('') + '</tbody></table></div>'],
    ['J', 'Equipo y costos', () => '<p class="arch__label">J · Estimación · hechos separados de supuestos</p><div class="arch-cols"><div><p><b>Hechos de esta corrida</b></p><ul class="list"><li>' + D.AGENTS.length + ' agentes, ' + D.SUBAGENTS.length + ' subagentes, ' + D.EDGES.length + ' dependencias.</li><li>' + cases.length + ' casos de prueba; v1.2.1 aprueba ' + suite['v1.2.1'].pass + '.</li><li>' + prof.products + ' registros sintéticos evaluados.</li><li>No hay costos reales de operación ni de nómina disponibles.</li></ul></div><div><p><b>Supuestos (sustituir con datos del cliente)</b></p><ul class="list"><li>Equipo: 1 líder técnico, 2 ingenieros de datos, 1 ingeniero de plataforma, 1 especialista de pagos, 0.5 seguridad.</li><li>Tiempo: 10–14 semanas hasta piloto (etapas 0–3).</li><li>Costo de inferencia: ver informe; depende de tarifas y tokens por evento.</li><li>Infraestructura y proveedor financiero: por cotizar.</li></ul></div></div>'],
    ['K', 'Criterios', () => '<p class="arch__label">K · Aceptación, detención y reversión</p><div class="arch-cols"><div><p><b>Aceptación</b></p><ul class="list"><li>FN = 0 en suite adversarial y de regresión.</li><li>Ningún producto de línea blanca o voluminoso asignado a MOTO o AUTO.</li><li>Todo dato faltante produce BLOQUEADO con motivo; nunca clase por defecto.</li><li>Cada decisión con traza, versión de regla y hash.</li><li>Pagos: ninguna ejecución sin aprobaciones válidas e idempotencia.</li></ul></div><div><p><b>Detener o revertir si</b></p><ul class="list"><li>Aparece un FN en sombra o piloto.</li><li>La cola de revisión supera la capacidad acordada del equipo de datos.</li><li>Un agente intenta operar fuera de su permiso más de una vez.</li><li>Diferencia en conciliación de pagos mayor a $0.01.</li><li>Reversión: restaurar SNAP previo y regla v1.0 marcada; registrar causa.</li></ul></div></div>']
  ];
  $('#arch-tabs').innerHTML = ARCH.map((a, k) => '<button role="tab" aria-selected="' + (k === 0) + '"><span class="mono">' + a[0] + '</span> ' + a[1] + '</button>').join('');
  const archSelect = tabs($('#arch-tabs'), (b, k) => { $('#arch-body').innerHTML = ARCH[k][2](); });

  // ================================================================ informe
  const TOK_IN = 6000, TOK_OUT = 900;
  function renderReport() {
    const done = R.done;
    const ev = R.emitted;
    const lastByAgent = {};
    ev.forEach((e) => { lastByAgent[e.ag] = e.st; });
    const states = Object.values(lastByAgent);
    const sevs = { Crítica: 0, Alta: 0, Media: 0, Baja: 0 };
    ev.forEach((e) => { if (e.sev) sevs[e.sev]++; });
    const agentsUsed = new Set(ev.filter((e) => AG[e.ag]).map((e) => e.ag)).size;
    const pend = (v) => (done ? v : '—');
    const elapsed = R.endedAt && R.startedAt ? Math.round((R.endedAt - R.startedAt) / 1000) : null;
    const m = [
      ['Agentes principales', pend(agentsUsed + ' / 33'), 'con actividad registrada'],
      ['Subagentes', pend(R.spawned.length), 'creados por AG-01'],
      ['Tareas cerradas', pend(states.filter((s) => s === 'COMPLETADO' || s === 'APROBADO').length), done ? states.filter((s) => s === 'BLOQUEADO').length + ' bloqueadas · ' + states.filter((s) => s === 'PENDIENTE').length + ' pendientes' : 'al cierre'],
      ['Hallazgos', pend(sevs.Crítica + sevs.Alta + sevs.Media + sevs.Baja), done ? sevs.Crítica + ' crít. · ' + sevs.Alta + ' altas · ' + sevs.Media + ' medias · ' + sevs.Baja + ' bajas' : 'por severidad'],
      ['Pruebas v1.2.1', suite['v1.2.1'].pct + ' %', suite['v1.2.1'].pass + '/' + suite['v1.2.1'].total + ' · FP ' + suite['v1.2.1'].fp + ' · FN ' + suite['v1.2.1'].fn],
      ['Línea base v1.0', suite['v1.0'].pct + ' %', 'FN ' + suite['v1.0'].fn + ' en la misma suite'],
      ['Registros evaluados', fmt(prof.products), 'conjunto sintético'],
      ['Corregidos', clean.log.corrected, clean.log.merged + ' fusiones · ' + clean.log.units + ' unidades · ' + clean.log.typeFix + ' tipos · ' + clean.log.classFix + ' clases'],
      ['Rechazados', clean.log.rejected.length, 'a revisión del responsable'],
      ['Asignaciones incorrectas', S.legacyBad + ' → ' + S.newBad, 'de ' + prof.orders + ' pedidos, v1.0 → v1.2.1'],
      ['Tiempo de corrida', pend('00:20'), done ? 'reloj de corrida · ' + elapsed + ' s reales' : 'reloj de corrida'],
      ['Decisión humana', pend(R.decision ? (R.decision.type === 'approve' ? 'Aprobado' : 'En espejo') : 'Sin decisión'), done && R.decision ? (R.decision.type === 'approve' ? R.decision.label : 'sin promoción') : 'expediente EXP-0417']
    ];
    $('#metrics').innerHTML = m.map(([k, v, s]) => '<dl class="metric' + (v === '—' ? ' is-pending' : '') + '"><dt>' + k + '</dt><dd>' + v + '</dd><small>' + esc(s) + '</small></dl>').join('');
    $('#report-state').textContent = done ? 'Corrida ' + S.runId + ' cerrada. Todas las cifras se calcularon en este navegador sobre el conjunto sintético seed ' + SEED + '.' : 'La corrida aún no cierra. Las métricas de pruebas y datos se calculan al cargar; las de tareas se llenan al cerrar la corrida.';
    $('#scen').innerHTML = '<thead><tr><th>Familia</th><th class="num">Pedidos</th><th class="num">Incorrectos v1.0</th><th class="num">Asignados v1.2.1</th><th class="num">A revisión</th><th class="num">Sin vehículo</th></tr></thead><tbody>' + S.scen.map((f) => '<tr><td>' + f.familia + '</td><td class="num">' + f.pedidos + '</td><td class="num">' + f.legacyIncorrectos + '</td><td class="num">' + f.asignados + '</td><td class="num">' + f.revision + '</td><td class="num">' + f.sinVehiculo + '</td></tr>').join('') + '</tbody>';
    renderImpact();
    $('#risks').innerHTML = [
      clean.log.rejected.length + ' registros siguen sin datos confiables; sus pedidos quedan bloqueados hasta medición o confirmación.',
      'El origen del duplicado (sincronización nocturna) es hipótesis: falta la bitácora del job.',
      'La flota, capacidades y restricciones de zona son sintéticas; deben sustituirse por las reales.',
      'Los rangos de plausibilidad pueden generar falsos positivos con productos nuevos fuera de rango.',
      'Tarifas de rieles y tipo de cambio son supuestos; el conector de pagos no está configurado.',
      'La distribución del conjunto sintético no representa la operación real.'
    ].map((x) => '<li>' + esc(x) + '</li>').join('');
    $('#human').innerHTML = [
      'Promoción de la regla v1.2.1 a staging y luego a producción (ventanas separadas).',
      'Fusión de duplicados y re-apunte de pedidos en datos maestros reales.',
      'Confirmación de conversiones de unidad antes de aplicarlas fuera del espejo.',
      'Modificación de la cláusula 4.2 de la política de asignación.',
      'Asignación de responsables de dato para registros sin dueño.',
      'Cada pago: aprobación según umbral, y alta del proveedor financiero autorizado.'
    ].map((x) => '<li>' + esc(x) + '</li>').join('');
    $('#questions').innerHTML = [
      '¿Existe bitácora del job de sincronización nocturna del catálogo y quién es su responsable?',
      '¿Cuál es la capacidad real de cada tipo de vehículo propio y de terceros: peso, caja interior y tripulación?',
      '¿Qué zonas restringen tipos de vehículo y en qué horarios?',
      '¿Qué rangos de peso y dimensiones por categoría acepta el área de datos maestros como plausibles?',
      '¿Qué umbral de importe exige doble aprobación de pagos y quiénes son los aprobadores?',
      '¿Qué proveedor financiero autorizado y qué rieles están contratados, con qué tarifas?',
      '¿Existe un ambiente de staging con datos anonimizados para la etapa 1?',
      '¿Cuál es el costo real por entrega fallida o reprogramada, para sustituir el supuesto?'
    ].map((x) => '<li>' + esc(x) + '</li>').join('');
  }
  function renderImpact() {
    const fail = parseFloat($('#as-fail').value), vol = parseFloat($('#as-vol').value), rate = parseFloat($('#as-rate').value);
    const ok = fail >= 0 && vol >= 0 && rate >= 0 && rate <= 100;
    $('#impact').innerHTML = '<p class="calc">Impacto mensual estimado: <b>' + (ok ? money((rate / 100) * vol * fail) : '—') + '</b><code>' + (ok ? fmt(vol) + ' pedidos/mes × ' + rate + ' % × ' + money(fail) : 'Ingresa la tasa observada de asignaciones incompatibles para calcular.') + ' Referencia: en el conjunto sintético la tasa fue ' + fmt(((S.legacyBad - S.newBad) / prof.orders) * 100, 1) + ' %, inflada a propósito con registros defectuosos; no usarla como tasa real.</code></p>';
    const tin = parseFloat($('#as-tin').value), tout = parseFloat($('#as-tout').value);
    const n = EVENTS.length;
    const usd = (n * TOK_IN * tin + n * TOK_OUT * tout) / 1e6;
    $('#infer').innerHTML = '<p class="calc">Costo estimado por corrida: <b>' + (tin >= 0 && tout >= 0 ? 'USD ' + fmt(usd, 2) : '—') + '</b><code>' + n + ' eventos × (' + fmt(TOK_IN) + ' tokens de entrada × ' + tin + ' + ' + TOK_OUT + ' de salida × ' + tout + ') / 1,000,000. Tokens por evento y tarifas son supuestos; no incluye herramientas ni infraestructura.</code></p>';
  }
  ['#as-rate', '#as-fail', '#as-vol', '#as-tin', '#as-tout'].forEach((s) => $(s).addEventListener('input', renderImpact));

  function reportMarkdown() {
    const metrics = $$('#metrics .metric').map((d) => '- **' + d.querySelector('dt').textContent + ':** ' + d.querySelector('dd').textContent + ' (' + d.querySelector('small').textContent + ')').join('\n');
    const list = (s) => $$(s + ' li').map((l, i) => (s === '#questions' ? i + 1 + '. ' : '- ') + l.textContent).join('\n');
    return '# Informe de corrida ' + S.runId + '\n\nEntorno espejo · conjunto sintético seed ' + SEED + '. Las etiquetas LVP_*, SKU, pedidos, proveedores e importes son ficticios.\n\n## Métricas\n' + metrics + '\n\n## Causa raíz\n- Confirmada en espejo: regla v1.0 §4.2 asigna PAQ_CHICO a clase nula; la regla no valida capacidad; duplicado LAV-FL-20-B sin datos referenciado por el pedido.\n- Hipótesis: el job de sincronización nocturna originó el duplicado.\n- Dato faltante: bitácora del job.\n\n## Pruebas\n' + Object.values(suite).map((r) => '- ' + r.version + ': ' + r.pass + '/' + r.total + ' (' + r.pct + ' %), FP ' + r.fp + ', FN ' + r.fn).join('\n') + '\n\n## Riesgos residuales\n' + list('#risks') + '\n\n## Cambios que requieren aprobación humana\n' + list('#human') + '\n\n## Preguntas abiertas\n' + list('#questions') + '\n\n## Bitácora\n\n' + R.emitted.map(eventText).join('\n\n') + '\n';
  }
  $('#dl-log').addEventListener('click', () => { if (!R.emitted.length) { toast('La bitácora está vacía: inicia la corrida.'); return; } download(S.runId + '-bitacora.txt', R.emitted.map(eventText).join('\n\n')); });
  $('#dl-report').addEventListener('click', () => download(S.runId + '-informe.md', reportMarkdown(), 'text/markdown;charset=utf-8'));

  // ================================================================ ⌘K
  const cmdk = $('#cmdk'), input = $('#cmdk-input'), list = $('#cmdk-list');
  const go = (id) => () => document.getElementById(id).scrollIntoView({ behavior: reduced ? 'auto' : 'smooth' });
  const CMDS = [
    ['Corrida', 'Iniciar o continuar la corrida', 'consola', () => { go('consola')(); play(); }],
    ['Corrida', 'Pausar la corrida', 'consola', pause],
    ['Corrida', 'Reiniciar la corrida', 'consola', () => { resetRun(); go('consola')(); }],
    ['Corrida', 'Descargar bitácora', '.txt', () => $('#dl-log').click()],
    ['Corrida', 'Descargar informe', '.md', () => $('#dl-report').click()],
    ['Ir a', 'Consola de corrida', '#consola', go('consola')],
    ['Ir a', 'Validador de asignación', '#validador', go('validador')],
    ['Ir a', 'PAY MEX', '#paymex', go('paymex')],
    ['Ir a', 'Informe', '#informe', go('informe')],
    ...ARCH.map((a, k) => ['Arquitectura', a[0] + ' · ' + a[1], 'tab', () => { go('arquitectura')(); archSelect(k); }]),
    ['Validador', 'Probar lavadora en motocicleta con v1.0', 'v1.0', () => { vp.value = 'DUP'; loadVariant(); $('input[name="veh"][value="MOTO"]').checked = true; $('#val-ver').value = 'v1.0'; renderVerdict(); go('validador')(); }],
    ['Validador', 'Probar caso adversarial con v1.2', 'v1.2', () => { vp.value = 'ADV'; loadVariant(); $('input[name="veh"][value="MOTO"]').checked = true; $('#val-ver').value = 'v1.2'; renderVerdict(); go('validador')(); }],
    ['PAY MEX', 'Procesar factura hasta aprobación', 'flujo', () => { go('paymex')(); payAll(); }]
  ];
  let active = 0, shown = [], lastFocus = null;
  function renderCmds() {
    const q = input.value.trim().toLowerCase();
    shown = CMDS.filter((c) => !q || (c[0] + ' ' + c[1]).toLowerCase().includes(q));
    active = Math.min(active, Math.max(0, shown.length - 1));
    if (!shown.length) { list.innerHTML = '<p class="cmdk__empty">Sin resultados para «' + esc(input.value) + '».</p>'; return; }
    let g = '', html = '';
    shown.forEach((c, k) => { if (c[0] !== g) { g = c[0]; html += '<p class="cmdk__group">' + g + '</p>'; } html += '<button class="cmdk__item' + (k === active ? ' is-active' : '') + '" role="option" aria-selected="' + (k === active) + '" data-k="' + k + '">' + esc(c[1]) + '<small>' + esc(c[2]) + '</small></button>'; });
    list.innerHTML = html;
    $$('.cmdk__item', list).forEach((b) => b.addEventListener('click', () => runCmd(+b.dataset.k)));
    const a = $('.cmdk__item.is-active', list); if (a) a.scrollIntoView({ block: 'nearest' });
  }
  function openCmdk() { lastFocus = document.activeElement; cmdk.classList.add('is-open'); cmdk.setAttribute('aria-hidden', 'false'); input.value = ''; active = 0; renderCmds(); document.body.style.overflow = 'hidden'; setTimeout(() => input.focus(), 10); }
  function closeCmdk() { cmdk.classList.remove('is-open'); cmdk.setAttribute('aria-hidden', 'true'); document.body.style.overflow = ''; if (lastFocus) lastFocus.focus({ preventScroll: true }); }
  function runCmd(k) { const c = shown[k]; closeCmdk(); if (c) setTimeout(c[3], 30); }
  $('#cmdk-open').addEventListener('click', openCmdk);
  $('[data-close]', cmdk).addEventListener('click', closeCmdk);
  input.addEventListener('input', () => { active = 0; renderCmds(); });
  input.addEventListener('keydown', (e) => {
    if (e.key === 'ArrowDown') { e.preventDefault(); active = (active + 1) % Math.max(1, shown.length); renderCmds(); }
    else if (e.key === 'ArrowUp') { e.preventDefault(); active = (active - 1 + shown.length) % Math.max(1, shown.length); renderCmds(); }
    else if (e.key === 'Enter') { e.preventDefault(); runCmd(active); }
  });
  document.addEventListener('keydown', (e) => {
    if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === 'k') { e.preventDefault(); cmdk.classList.contains('is-open') ? closeCmdk() : openCmdk(); }
    else if (e.key === 'Escape' && cmdk.classList.contains('is-open')) closeCmdk();
    else if (e.key === 'Tab' && cmdk.classList.contains('is-open')) { const f = [input, ...$$('.cmdk__item', list)]; const i = f.indexOf(document.activeElement); if (e.shiftKey && i <= 0) { e.preventDefault(); f[f.length - 1].focus(); } else if (!e.shiftKey && i === f.length - 1) { e.preventDefault(); input.focus(); } }
  });
  if (/Mac|iPhone|iPad/.test(navigator.platform || navigator.userAgent)) $('#kbd-mod').textContent = '⌘';

  // ================================================================ nav + reveal
  const nav = $('#nav');
  const onScroll = () => nav.classList.toggle('is-scrolled', window.scrollY > 8);
  window.addEventListener('scroll', onScroll, { passive: true }); onScroll();
  const links = $$('.nav__links a');
  if ('IntersectionObserver' in window) {
    const io = new IntersectionObserver((ents) => ents.forEach((en) => { if (en.isIntersecting) links.forEach((l) => l.classList.toggle('is-active', l.getAttribute('href') === '#' + en.target.id)); }), { rootMargin: '-45% 0px -50% 0px' });
    ['consola', 'validador', 'paymex', 'arquitectura', 'informe'].forEach((id) => io.observe(document.getElementById(id)));
    if (!reduced) {
      const rv = new IntersectionObserver((ents) => ents.forEach((en) => { if (en.isIntersecting) { en.target.classList.add('is-in'); rv.unobserve(en.target); } }), { rootMargin: '0px 0px -8% 0px' });
      $$('.section .section__title, .layers__list, .pay, .metrics').forEach((n) => { n.classList.add('reveal'); rv.observe(n); });
    }
  }

  // ================================================================ arranque
  $('#run-id').textContent = S.runId; $('#run-seed').textContent = SEED;
  renderHeroFacts(); renderHero('v1.0'); resetRun(); loadVariant(); renderAll(); archSelect(0);
})();
