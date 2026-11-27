/* Motor de reglas, perfilado, saneamiento y pruebas.
 * Todo se calcula en el navegador sobre el conjunto sintético; ninguna cifra está escrita a mano.
 */
(function (global) {
  'use strict';
  const D = global.PMX_DATA;
  const V = Object.fromEntries(D.VEHICLES.map((v) => [v.id, v]));

  // ---------------------------------------------------------------- utilidades
  const num = (x) => (typeof x === 'number' ? x : typeof x === 'string' ? parseFloat(x.replace(',', '.')) : NaN);
  const isNum = (x) => typeof x === 'number' && Number.isFinite(x);
  const sorted = (a) => a.slice().sort((x, y) => y - x);
  const fits = (dims, box) => { const d = sorted(dims), b = sorted(box); return d.every((x, i) => x <= b[i]); };

  // ---------------------------------------------------------------- reglas versionadas
  const LEGACY_MAP = {
    PAQ_CHICO: ['MOTO', 'AUTO', 'VAN', 'CAMION_35'],
    MEDIANO: ['AUTO', 'VAN', 'CAMION_35'],
    VOLUMINOSO: ['VAN', 'CAMION_35'],
    LINEA_BLANCA: ['VAN', 'CAMION_35']
  };

  function ruleLegacy(rec, veh) {
    const checks = [];
    const clase = rec.clase || 'PAQ_CHICO';
    checks.push({ name: 'Clase logística', ok: true, detail: rec.clase ? rec.clase : 'nula → se asume PAQ_CHICO (cláusula 4.2)' });
    const allowed = LEGACY_MAP[clase].includes(veh.id);
    checks.push({ name: 'Vehículo permitido por clase', ok: allowed, detail: clase + ' → ' + LEGACY_MAP[clase].join(', ') });
    checks.push({ name: 'Capacidad, dimensiones, tripulación, zona', ok: null, detail: 'no evaluado en v1.0' });
    return { ok: allowed, code: allowed ? 'OK' : 'CLASE_NO_PERMITIDA', checks };
  }

  // opts: { plausibility, inferCrew }
  function rulePhysical(rec, veh, zona, opts) {
    const checks = [];
    const fam = D.FAMILIES[rec.fam];
    const peso = num(rec.peso_kg);
    const dims = Array.isArray(rec.dims) ? rec.dims.map(num) : null;
    const complete = isNum(peso) && dims && dims.length === 3 && dims.every((d) => isNum(d) && d > 0);
    checks.push({ name: 'Completitud de datos', ok: complete, detail: complete ? 'peso y 3 dimensiones presentes' : 'falta peso o dimensiones — no se asume clase por defecto' });
    if (!complete) return { ok: false, code: 'DATO_FALTANTE', checks };
    if (typeof rec.peso_kg === 'string') checks.push({ name: 'Tipo numérico', ok: true, detail: '"' + rec.peso_kg + '" normalizado a ' + peso + ' kg' });

    if (opts.plausibility) {
      const mx = Math.max(...dims);
      const okP = peso >= fam.peso[0] && peso <= fam.peso[1];
      const okD = mx >= fam.dimMax[0] * 0.8 && mx <= fam.dimMax[1] * 1.2;
      checks.push({ name: 'Plausibilidad por categoría', ok: okP && okD, detail: fam.label + ': peso ' + fam.peso.join('–') + ' kg, lado mayor ' + fam.dimMax.join('–') + ' cm · registro: ' + peso + ' kg, ' + mx + ' cm' });
      if (!(okP && okD)) return { ok: false, code: 'MAGNITUD_IMPLAUSIBLE', checks };
    }
    const okW = peso <= veh.cap;
    checks.push({ name: 'Peso ≤ capacidad', ok: okW, detail: peso + ' kg vs ' + veh.cap + ' kg' });
    const okF = fits(dims, veh.box);
    checks.push({ name: 'Dimensiones caben (orden libre)', ok: okF, detail: sorted(dims).join('×') + ' cm vs ' + sorted(veh.box).join('×') + ' cm' });
    let crew = rec.requiere_2;
    if (crew == null) crew = opts.inferCrew ? fam.crew === 2 : false;
    const okC = !crew || veh.crew >= 2;
    checks.push({ name: 'Tripulación', ok: okC, detail: (crew ? 'requiere 2 personas' : '1 persona') + (rec.requiere_2 == null ? (opts.inferCrew ? ' (inferido por categoría)' : ' (nulo → 1 persona)') : '') + ' · vehículo ' + veh.crew });
    const okZ = veh.zonas.includes(zona);
    checks.push({ name: 'Restricción de zona', ok: okZ, detail: 'zona ' + zona + (okZ ? ' permitida' : ' restringe ' + veh.id) });
    const ok = okW && okF && okC && okZ;
    const code = ok ? 'OK' : !okW ? 'EXCEDE_PESO' : !okF ? 'NO_CABE' : !okC ? 'TRIPULACION' : 'ZONA_RESTRINGIDA';
    return { ok, code, checks };
  }

  const RULES = {
    'v1.0': { label: 'v1.0 vigente', fn: (r, v) => ruleLegacy(r, v) },
    'v1.2': { label: 'v1.2', fn: (r, v, z) => rulePhysical(r, v, z, { plausibility: false, inferCrew: false }) },
    'v1.2.1': { label: 'v1.2.1 candidata', fn: (r, v, z) => rulePhysical(r, v, z, { plausibility: true, inferCrew: true }) },
    'v1.3': { label: 'v1.3 propuesta AG-30', fn: (r, v, z) => rulePhysical(r, v, z, { plausibility: false, inferCrew: true }) }
  };

  function evaluate(version, rec, vehId, zona) { return RULES[version].fn(rec, V[vehId], zona || 'NORMAL'); }

  // asignación: vehículo compatible más barato
  function assign(version, rec, zona) {
    const byCost = D.VEHICLES.slice().sort((a, b) => a.cost - b.cost);
    const results = byCost.map((v) => ({ v, r: RULES[version].fn(rec, v, zona) }));
    const hit = results.find((x) => x.r.ok);
    return hit ? { vehicle: hit.v.id, result: hit.r, all: results } : { vehicle: null, result: results[0].r, all: results };
  }

  // ---------------------------------------------------------------- verdad (oráculo)
  const REVIEW_DEFECTS = ['DIMS_NULAS', 'DUPLICADO+DIMS_NULAS', 'UNIDAD_GRAMOS', 'UNIDAD_METROS'];
  function truthOk(rec, vehId, zona) {
    if (REVIEW_DEFECTS.includes(rec.defect)) return false; // política: debe ir a revisión
    const t = rec.truth || { peso_kg: num(rec.peso_kg), dims: rec.dims, crew: D.FAMILIES[rec.fam].crew };
    const v = V[vehId];
    return t.peso_kg <= v.cap && fits(t.dims, v.box) && (t.crew < 2 || v.crew >= 2) && v.zonas.includes(zona);
  }

  // ---------------------------------------------------------------- suite de pruebas
  function buildSuite() {
    const cases = [];
    const fx = (k) => D.FIXTURES.find((f) => f.key === k);
    const base = (f) => ({ sku: f.sku, nombre: f.nombre, fam: f.fam, peso_kg: f.peso_kg, dims: f.dims.slice(), clase: D.FAMILIES[f.fam].clase, requiere_2: D.FAMILIES[f.fam].crew === 2, fragil: f.fragil, defect: null, truth: { peso_kg: f.peso_kg, dims: f.dims.slice(), crew: D.FAMILIES[f.fam].crew } });
    D.FIXTURES.forEach((f) => D.VEHICLES.forEach((v) => cases.push({ group: 'Unitarias', name: f.key + ' → ' + v.id, rec: base(f), veh: v.id, zona: 'NORMAL' })));
    ['TV', 'REF'].forEach((k) => D.VEHICLES.forEach((v) => cases.push({ group: 'Zona', name: k + ' → ' + v.id + ' · CENTRO', rec: base(fx(k)), veh: v.id, zona: 'CENTRO' })));
    const lav = base(fx('LAV'));
    const variants = [
      ['Clase nula', Object.assign({}, lav, { clase: null })],
      ['Duplicado sin datos', Object.assign({}, lav, { sku: 'LAV-FL-20-B', clase: null, peso_kg: null, dims: null, requiere_2: null, defect: 'DUPLICADO+DIMS_NULAS' })],
      ['Peso como texto', Object.assign({}, lav, { peso_kg: '72 kg' })],
      ['Peso en gramos', Object.assign({}, lav, { peso_kg: 72000, defect: 'UNIDAD_GRAMOS' })],
      ['Metros + toneladas (adversarial)', Object.assign({}, lav, { dims: [0.85, 0.6, 0.66], peso_kg: 0.072, requiere_2: null, defect: 'UNIDAD_METROS' })],
      ['Clase inconsistente', Object.assign({}, lav, { clase: 'PAQ_CHICO' })]
    ];
    variants.forEach(([n, rec]) => D.VEHICLES.forEach((v) => cases.push({ group: n.includes('adversarial') ? 'Adversarial' : 'Regresión', name: 'LAV ' + n + ' → ' + v.id, rec, veh: v.id, zona: 'NORMAL' })));
    cases.forEach((c) => { c.expected = truthOk(c.rec, c.veh, c.zona); });
    return cases;
  }

  function runSuite(version, cases) {
    let pass = 0, fp = 0, fn = 0;
    const failures = [];
    cases.forEach((c) => {
      const r = evaluate(version, c.rec, c.veh, c.zona);
      if (r.ok === c.expected) pass++;
      else { if (r.ok) fn++; else fp++; failures.push({ name: c.name, group: c.group, got: r.code, expected: c.expected ? 'OK' : 'BLOQUEADO' }); }
    });
    return { version, total: cases.length, pass, fp, fn, pct: Math.round((pass / cases.length) * 1000) / 10, failures };
  }

  // ---------------------------------------------------------------- perfilado
  function profile(ds) {
    const P = ds.products;
    const byEan = {};
    P.forEach((p) => { (byEan[p.ean] = byEan[p.ean] || []).push(p.sku); });
    const dupGroups = Object.values(byEan).filter((g) => g.length > 1);
    const skuSet = new Set(P.map((p) => p.sku));
    const r = {
      products: P.length,
      nullDims: P.filter((p) => !Array.isArray(p.dims)).length,
      nullPeso: P.filter((p) => p.peso_kg == null).length,
      nullClase: P.filter((p) => p.clase == null).length,
      dupGroups: dupGroups.length,
      typeErr: P.filter((p) => typeof p.peso_kg === 'string').length,
      unitErr: P.filter((p) => isNum(p.peso_kg) && p.peso_kg > 1000).length,
      metres: P.filter((p) => Array.isArray(p.dims) && Math.max(...p.dims) < 5).length,
      classMismatch: P.filter((p) => p.clase && p.clase !== D.FAMILIES[p.fam].clase).length,
      orphans: ds.inventory.filter((m) => !skuSet.has(m.sku)).length,
      inventory: ds.inventory.length,
      orders: ds.orders.length,
      orderOnDup: ds.orders.filter((o) => { const p = P.find((x) => x.sku === o.sku); return p && p.dupOf; }).length
    };
    return r;
  }

  // ---------------------------------------------------------------- saneamiento en espejo
  function cleanse(ds) {
    const P = JSON.parse(JSON.stringify(ds.products));
    const out = [];
    const log = { merged: 0, units: 0, classFix: 0, typeFix: 0, rejected: [], remapped: 0 };
    const survivors = new Map();
    P.forEach((p) => {
      if (p.dupOf) { survivors.set(p.sku, p.dupOf); log.merged++; return; }
      const f = D.FAMILIES[p.fam];
      if (p.defect === 'DIMS_NULAS' || p.defect === 'UNIDAD_METROS') { log.rejected.push({ sku: p.sku, motivo: p.defect === 'DIMS_NULAS' ? 'Dimensiones nulas: requiere medición física' : 'Unidades ambiguas (m / t): requiere confirmación del responsable' }); out.push(p); return; }
      if (typeof p.peso_kg === 'string') { p.peso_kg = num(p.peso_kg); log.typeFix++; p.defect = null; }
      if (isNum(p.peso_kg) && p.peso_kg > 1000 && p.peso_kg / 1000 >= f.peso[0] && p.peso_kg / 1000 <= f.peso[1]) { p.peso_kg = Math.round(p.peso_kg) / 1000; log.units++; p.defect = null; }
      if (p.clase !== f.clase) { p.clase = f.clase; log.classFix++; if (p.defect === 'CLASE_INCONSISTENTE') p.defect = null; }
      out.push(p);
    });
    const orders = ds.orders.map((o) => { if (survivors.has(o.sku)) { log.remapped++; return Object.assign({}, o, { sku: survivors.get(o.sku), remappedFrom: o.sku }); } return o; });
    log.corrected = log.merged + log.units + log.classFix + log.typeFix;
    return { products: out, orders, inventory: ds.inventory, log };
  }

  // ---------------------------------------------------------------- evaluación de pedidos
  function evalOrders(version, products, orders) {
    const idx = new Map(products.map((p) => [p.sku, p]));
    const rows = orders.map((o) => {
      const p = idx.get(o.sku);
      const a = assign(version, p, o.zona);
      const correct = a.vehicle ? truthOk(p, a.vehicle, o.zona) : !D.VEHICLES.some((v) => truthOk(p, v.id, o.zona));
      return { order: o, product: p, vehicle: a.vehicle, code: a.result.code, correct };
    });
    return rows;
  }

  function scenarios(rowsLegacy, rowsNew) {
    const fam = {};
    rowsNew.forEach((r, i) => {
      const k = D.FAMILIES[r.product.fam].label;
      const f = (fam[k] = fam[k] || { familia: k, pedidos: 0, legacyIncorrectos: 0, asignados: 0, revision: 0, sinVehiculo: 0 });
      f.pedidos++;
      if (!rowsLegacy[i].correct) f.legacyIncorrectos++;
      if (r.vehicle) f.asignados++;
      else if (['DATO_FALTANTE', 'MAGNITUD_IMPLAUSIBLE'].includes(r.code)) f.revision++;
      else f.sinVehiculo++;
    });
    return Object.values(fam);
  }

  function stress(version, n) {
    const rnd = D.mulberry32(99);
    const recs = D.FIXTURES.map((f) => ({ sku: f.sku, fam: f.fam, peso_kg: f.peso_kg, dims: f.dims, clase: D.FAMILIES[f.fam].clase, requiere_2: D.FAMILIES[f.fam].crew === 2 }));
    const t0 = performance.now();
    let ok = 0;
    for (let i = 0; i < n; i++) { const a = assign(version, recs[Math.floor(rnd() * recs.length)], rnd() < 0.12 ? 'CENTRO' : 'NORMAL'); if (a.vehicle) ok++; }
    return { n, ms: Math.round((performance.now() - t0) * 10) / 10, assigned: ok };
  }

  // ---------------------------------------------------------------- hash (evidencia AG-32)
  async function sha256(text) {
    try {
      const buf = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(text));
      return Array.from(new Uint8Array(buf)).map((b) => b.toString(16).padStart(2, '0')).join('');
    } catch (e) {
      let h = 0x811c9dc5; for (let i = 0; i < text.length; i++) { h ^= text.charCodeAt(i); h = Math.imul(h, 0x01000193); }
      return 'fnv1a-' + (h >>> 0).toString(16).padStart(8, '0');
    }
  }

  // ---------------------------------------------------------------- CLABE (dígito de control)
  function clabeControl(d17) {
    const w = [3, 7, 1];
    let s = 0;
    for (let i = 0; i < 17; i++) s += (parseInt(d17[i], 10) * w[i % 3]) % 10;
    return String((10 - (s % 10)) % 10);
  }
  const clabeFull = (d17) => d17 + clabeControl(d17);
  const clabeValid = (c) => /^\d{18}$/.test(c) && clabeControl(c.slice(0, 17)) === c[17];
  const rfcValid = (r) => /^[A-ZÑ&]{3,4}\d{6}[A-Z0-9]{3}$/.test(r);

  global.PMX_ENGINE = { RULES, evaluate, assign, truthOk, buildSuite, runSuite, profile, cleanse, evalOrders, scenarios, stress, sha256, clabeFull, clabeValid, rfcValid, fits, V };
})(window);
