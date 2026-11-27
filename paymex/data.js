/* PAY MEX × KIILONOVA — catálogo de agentes, grafo dirigido y datos sintéticos.
 * Todos los identificadores LVP_*, SKU, pedidos, proveedores, importes y CLABE son ficticios.
 */
(function (global) {
  'use strict';

  // ---------------------------------------------------------------- agentes
  // col = fase del grafo (0 gobierno · 1 ingesta · 2 diagnóstico · 3 análisis · 4 diseño · 5 pruebas · 6 gobernanza)
  const AGENTS = [
    ['01', 'Orquestador raíz', 0, 'Recibe el objetivo, descompone tareas, crea subagentes y coordina dependencias.', 'Caso, alcance, políticas de corrida', 'Plan de tareas, run_id, subagentes', 'Crear tareas y subagentes · sin escritura de datos'],
    ['33', 'Master orchestrator', 0, 'Supervisa la red, resuelve conflictos entre agentes y cierra la corrida.', 'Estado de tareas, conflictos, bitácora', 'Resoluciones, cierre de corrida', 'Lectura global · revocar permisos de agentes'],
    ['13', 'Hermes research', 1, 'Investiga hipótesis en documentación autorizada.', 'Documentos autorizados', 'Cláusulas relevantes con cita', 'Lectura de documentos autorizados'],
    ['14', 'Knowledge graph', 1, 'Construye el grafo de conocimiento entre entidades, reglas y dependencias.', 'Salida de AG-13 y AG-01.1', 'Grafo de entidades y relaciones', 'Escritura en grafo de la corrida'],
    ['02', 'Auditor de datos', 1, 'Inventaria fuentes, estructuras y volúmenes de los 6 dominios.', 'Catálogo de dominios LVP_*', 'Inventario de tablas y conteos', 'Lectura entorno espejo'],
    ['03', 'Data profiler', 2, 'Detecta nulos, duplicados, tipos incompatibles y valores atípicos.', 'LVP_PRODUCT_MASTER', 'Perfil por columna', 'Lectura entorno espejo'],
    ['04', 'Detector de anomalías', 2, 'Identifica patrones fuera de norma en peso, dimensiones y clase.', 'Perfil de AG-03', 'Anomalías con puntaje', 'Lectura entorno espejo'],
    ['05', 'Orquestador de BD', 2, 'Coordina consultas y conciliación entre dominios.', 'Plan de AG-01', 'Plan de consultas y joins', 'Lectura entorno espejo'],
    ['06', 'Data governance', 2, 'Aplica políticas de calidad, propiedad y acceso.', 'Políticas de calidad', 'Incumplimientos de política', 'Lectura de metadatos'],
    ['08', 'Semantic engine', 2, 'Detecta contradicciones semánticas entre sistemas.', 'Categorías y clases logísticas', 'Contradicciones con evidencia', 'Lectura entorno espejo'],
    ['09', 'Integrity validator', 2, 'Verifica claves, relaciones y restricciones.', 'Esquemas y llaves', 'Huérfanos y violaciones', 'Lectura entorno espejo'],
    ['10', 'Database forensics', 2, 'Analiza cambios, versiones y registros incompletos.', 'Historial de versiones', 'Línea de tiempo del registro', 'Lectura de historial'],
    ['11', 'Schema reconciliation', 2, 'Compara estructuras y versiones de esquemas.', 'DDL de vistas e integraciones', 'Diferencias de esquema', 'Lectura de metadatos'],
    ['12', 'Data lineage', 2, 'Reconstruye el recorrido del dato hasta la decisión.', 'Pedido, SKU, regla', 'Ruta de linaje', 'Lectura entorno espejo'],
    ['07', 'Master data management', 2, 'Resuelve duplicados y entidades maestras.', 'Pares candidatos', 'Propuesta de fusión', 'Escritura entorno espejo (propuesta)'],
    ['19', 'Root cause analysis', 3, 'Consolida evidencia y separa causa confirmada, hipótesis y datos faltantes.', 'Hallazgos AG-04…AG-14', 'Árbol de causas con confianza', 'Lectura de evidencias'],
    ['15', 'Mirror server', 3, 'Administra el entorno aislado de reproducción.', 'Esquema + datos sintéticos', 'Entorno espejo activo', 'Administrar entorno espejo'],
    ['16', 'Data recovery', 3, 'Crea respaldos, puntos de restauración y reversión.', 'Estado del espejo', 'Snapshot con hash', 'Snapshot en espejo'],
    ['17', 'Reconciliation engine', 3, 'Concilia pedido, producto, inventario y logística.', 'Propuestas AG-07/10/11', 'Entidades conciliadas', 'Escritura entorno espejo'],
    ['18', 'Logistics intelligence', 3, 'Interpreta restricciones de entrega y transporte.', 'LVP_TRANSPORT_MASTER, SLA', 'Restricciones formales', 'Lectura entorno espejo'],
    ['23', 'Data quality', 4, 'Define reglas y umbrales de calidad.', 'Causas confirmadas', 'Controles de calidad', 'Escritura de reglas en espejo'],
    ['24', 'Logistics optimizer', 4, 'Diseña compatibilidad de carga y capacidad vehicular.', 'Restricciones AG-18, controles AG-23', 'Regla de asignación versionada', 'Escritura de reglas en espejo'],
    ['26', 'Autonomous engineer', 4, 'Implementa transformaciones solo en el entorno de prueba.', 'Reglas AG-24, conciliación AG-17', 'Rama de cambios', 'Escritura entorno espejo · sin staging ni producción'],
    ['25', 'API integration', 4, 'Diseña y valida contratos entre sistemas.', 'Rama AG-26', 'Contratos y códigos de error', 'Lectura entorno espejo'],
    ['20', 'Autonomous testing', 5, 'Genera y ejecuta pruebas unitarias, integración, regresión y límite.', 'Rama AG-26, contratos AG-25', 'Resultados de suite', 'Ejecutar pruebas en espejo'],
    ['27', 'Adversarial auditor', 5, 'Intenta reproducir fallas y encontrar bypasses.', 'Reglas candidatas', 'Casos de evasión', 'Ejecutar pruebas en espejo'],
    ['28', 'Simulation engine', 5, 'Ejecuta escenarios sintéticos y pruebas de estrés.', 'Conjunto sintético', 'Resultados por familia', 'Ejecutar escenarios en espejo'],
    ['29', 'Cost intelligence', 5, 'Estima costos e impactos con supuestos explícitos.', 'Resultados AG-28, supuestos', 'Estimación con supuestos', 'Lectura de resultados'],
    ['30', 'Self-evolution engine', 5, 'Compara desempeño y propone versiones candidatas.', 'Suites históricas', 'Candidata versionada', 'Proponer versión · no promueve · no edita permisos'],
    ['21', 'Security sentinel', 6, 'Revisa seguridad, permisos y aislamiento.', 'Matriz de permisos, conexiones', 'Bloqueos y alertas', 'Bloquear acciones de agentes'],
    ['22', 'Compliance agent', 6, 'Verifica políticas, cumplimiento y retención.', 'Políticas, bitácora', 'Dictamen de cumplimiento', 'Lectura de bitácora'],
    ['31', 'Human governance', 6, 'Presenta expedientes y gestiona aprobaciones humanas.', 'Expediente de cambio', 'Decisión humana registrada', 'Solicitar aprobación · nunca aprueba'],
    ['32', 'Audit & provenance', 6, 'Registra evidencia, versiones, hashes y decisiones.', 'Todos los eventos', 'Cadena de hashes', 'Escritura solo-anexar en bitácora']
  ].map(([id, name, col, fn, input, output, perms]) => ({ id: 'AG-' + id, short: id, name, col, fn, input, output, perms }));

  const COLS = ['Gobierno', 'Ingesta', 'Diagnóstico', 'Análisis', 'Diseño', 'Pruebas', 'Gobernanza'];

  // dependencias reales (dirigidas: origen entrega insumo a destino)
  const EDGES = [
    ['01', '02'], ['01', '13'], ['01', '05'], ['13', '14'], ['01', '33'],
    ['02', '03'], ['02', '05'], ['03', '04'],
    ['05', '06'], ['05', '07'], ['05', '08'], ['05', '09'], ['05', '10'], ['05', '11'], ['05', '12'], ['05', '18'],
    ['04', '19'], ['07', '19'], ['08', '19'], ['09', '19'], ['10', '19'], ['12', '19'], ['14', '19'],
    ['07', '17'], ['10', '17'], ['11', '17'],
    ['19', '15'], ['15', '16'], ['15', '20'], ['19', '23'],
    ['18', '24'], ['23', '24'], ['17', '26'], ['24', '26'], ['16', '26'], ['26', '25'],
    ['25', '20'], ['20', '27'], ['20', '28'], ['27', '28'], ['28', '29'], ['28', '30'], ['20', '30'],
    ['26', '21'], ['06', '22'], ['21', '31'], ['22', '31'], ['30', '31'],
    ['31', '32'], ['29', '32'], ['32', '33']
  ].map(([a, b]) => ['AG-' + a, 'AG-' + b]);

  // subagentes temporales (creados por AG-01)
  const SUBAGENTS = [
    { id: 'AG-01.1', parent: 'AG-01', reports: 'AG-13', goal: 'Procesar documentos autorizados de la corrida', tools: 'Parser documental (solo lectura)', input: '4 documentos autorizados', evidence: 'Cláusulas con página y hash', success: '100 % de documentos indexados', stop: 'Documentos procesados o 3 fallas de parseo', limits: '5 min · 3 iteraciones · USD 0.40' },
    { id: 'SA-01.2', parent: 'AG-01', reports: 'AG-07', goal: 'Investigar duplicidad de SKU por EAN', tools: 'Consulta SQL espejo (lectura)', input: 'LVP_PRODUCT_MASTER', evidence: 'Pares SKU/EAN con fecha de alta', success: 'Pares clasificados con confianza ≥ 0.9', stop: 'Sin nuevos pares en 2 pasadas', limits: '2 min · 4 iteraciones · USD 0.25' },
    { id: 'SA-01.3', parent: 'AG-01', reports: 'AG-10', goal: 'Verificar dimensiones y unidades', tools: 'Consulta SQL espejo, reglas de rango', input: 'Peso y dimensiones por categoría', evidence: 'Registros fuera de rango con regla violada', success: 'Todos los registros con veredicto', stop: 'Cobertura 100 %', limits: '2 min · 3 iteraciones · USD 0.25' },
    { id: 'SA-01.4', parent: 'AG-01', reports: 'AG-09', goal: 'Comprobar integridad referencial inventario ↔ catálogo', tools: 'Consulta SQL espejo (lectura)', input: 'LVP_INVENTORY, LVP_PRODUCT_MASTER', evidence: 'Movimientos huérfanos con llave', success: 'Huérfanos listados', stop: 'Join completo', limits: '2 min · 2 iteraciones · USD 0.15' },
    { id: 'SA-01.5', parent: 'AG-01', reports: 'AG-18', goal: 'Leer reglas de transporte vigentes', tools: 'Lectura LVP_LOGISTICS_RULES', input: 'Regla de asignación v1.0', evidence: 'Árbol de decisión de la regla', success: 'Ramas documentadas', stop: 'Regla recorrida completa', limits: '2 min · 2 iteraciones · USD 0.15' },
    { id: 'SA-01.6', parent: 'AG-01', reports: 'AG-12', goal: 'Trazar el pedido PED-SIM-000417 hasta la asignación', tools: 'Consulta de linaje (lectura)', input: 'Pedido, SKU, regla, asignación', evidence: 'Ruta de linaje con marcas de tiempo', success: 'Ruta sin saltos', stop: 'Asignación alcanzada', limits: '2 min · 2 iteraciones · USD 0.15' },
    { id: 'SA-01.7', parent: 'AG-01', reports: 'AG-24', goal: 'Cerrar bypass de unidades (metros / toneladas)', tools: 'Reglas de plausibilidad por categoría', input: 'Caso adversarial de AG-27', evidence: 'Suite adversarial en verde', success: 'FN = 0 en suite adversarial', stop: 'FN = 0 o 5 iteraciones', limits: '3 min · 5 iteraciones · USD 0.60' }
  ];

  // ---------------------------------------------------------------- transporte
  const VEHICLES = [
    { id: 'MOTO', name: 'Motocicleta', cap: 12, box: [45, 40, 40], crew: 1, cost: 95, zonas: ['NORMAL', 'CENTRO'] },
    { id: 'AUTO', name: 'Auto compacto', cap: 150, box: [110, 90, 70], crew: 1, cost: 180, zonas: ['NORMAL', 'CENTRO'] },
    { id: 'VAN', name: 'Camioneta de carga', cap: 900, box: [260, 160, 140], crew: 2, cost: 420, zonas: ['NORMAL', 'CENTRO'] },
    { id: 'CAMION_35', name: 'Camión 3.5 t', cap: 3500, box: [430, 210, 210], crew: 2, cost: 780, zonas: ['NORMAL'] }
  ];

  // familias de producto con rango plausible (para plausibilidad v1.2.1)
  const FAMILIES = {
    LAVADORA: { label: 'Lavadoras', clase: 'LINEA_BLANCA', crew: 2, peso: [40, 140], dimMax: [50, 120] },
    REFRI: { label: 'Refrigeradores', clase: 'LINEA_BLANCA', crew: 2, peso: [45, 180], dimMax: [120, 220] },
    MICRO: { label: 'Microondas', clase: 'MEDIANO', crew: 1, peso: [8, 30], dimMax: [40, 70] },
    TV: { label: 'Pantallas', clase: 'VOLUMINOSO', crew: 1, peso: [8, 45], dimMax: [90, 200] },
    SOFA: { label: 'Muebles', clase: 'VOLUMINOSO', crew: 2, peso: [25, 120], dimMax: [150, 280] },
    COLCHON: { label: 'Colchones', clase: 'VOLUMINOSO', crew: 2, peso: [15, 70], dimMax: [180, 210] },
    AUDIO: { label: 'Paquetes chicos', clase: 'PAQ_CHICO', crew: 1, peso: [0.1, 3], dimMax: [10, 35] },
    LIBRO: { label: 'Paquetes chicos', clase: 'PAQ_CHICO', crew: 1, peso: [0.1, 3], dimMax: [15, 35] }
  };

  // fixtures físicos verdaderos (para el validador y la suite)
  const FIXTURES = [
    { key: 'LAV', sku: 'LAV-FL-20', nombre: 'Lavadora carga frontal 20 kg', fam: 'LAVADORA', peso_kg: 72, dims: [85, 60, 66], fragil: false },
    { key: 'REF', sku: 'REF-DP-25', nombre: 'Refrigerador dos puertas 25 ft³', fam: 'REFRI', peso_kg: 96, dims: [178, 70, 75], fragil: true },
    { key: 'TV', sku: 'TV-75-QL', nombre: 'Pantalla 75"', fam: 'TV', peso_kg: 32, dims: [180, 108, 22], fragil: true },
    { key: 'SOFA', sku: 'SOF-3P-GR', nombre: 'Sofá 3 plazas', fam: 'SOFA', peso_kg: 58, dims: [212, 92, 86], fragil: false },
    { key: 'COL', sku: 'COL-KS-30', nombre: 'Colchón king size', fam: 'COLCHON', peso_kg: 41, dims: [200, 190, 32], fragil: false },
    { key: 'MIC', sku: 'MIC-1.2-IN', nombre: 'Microondas 1.2 ft³', fam: 'MICRO', peso_kg: 14, dims: [52, 40, 32], fragil: true },
    { key: 'AUD', sku: 'AUD-BT-NC', nombre: 'Audífonos inalámbricos', fam: 'AUDIO', peso_kg: 0.4, dims: [20, 18, 9], fragil: false },
    { key: 'LIB', sku: 'LIB-TD-01', nombre: 'Libro pasta dura', fam: 'LIBRO', peso_kg: 0.8, dims: [24, 17, 4], fragil: false }
  ];

  // ---------------------------------------------------------------- PRNG determinista
  function mulberry32(seed) {
    return function () {
      seed |= 0; seed = (seed + 0x6d2b79f5) | 0;
      let t = Math.imul(seed ^ (seed >>> 15), 1 | seed);
      t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
      return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
    };
  }

  // ---------------------------------------------------------------- conjunto sintético
  // Genera LVP_PRODUCT_MASTER, LVP_INVENTORY y LVP_ORDER_MANAGEMENT con defectos inyectados
  // de forma determinista. Cada registro guarda su verdad física en `truth` para medir FP/FN.
  function buildDataset(seed) {
    const rnd = mulberry32(seed);
    const pick = (arr) => arr[Math.floor(rnd() * arr.length)];
    const jitter = (v, p) => Math.round(v * (1 + (rnd() * 2 - 1) * p) * 10) / 10;
    const products = [];
    let n = 0;
    const fams = ['LAVADORA', 'LAVADORA', 'REFRI', 'MICRO', 'TV', 'TV', 'SOFA', 'COLCHON', 'AUDIO', 'AUDIO', 'LIBRO', 'LIBRO'];
    while (products.length < 236) {
      const fam = pick(fams);
      const fx = FIXTURES.find((f) => f.fam === fam);
      const dims = fx.dims.map((d) => jitter(d, 0.08));
      const peso = jitter(fx.peso_kg, 0.12);
      n += 1;
      const sku = fx.sku.split('-').slice(0, 2).join('-') + '-' + String(1000 + n);
      const ean = '750' + String(Math.floor(rnd() * 1e9)).padStart(9, '0') + String(n % 10);
      const rec = {
        sku, ean, nombre: fx.nombre, fam, categoria: FAMILIES[fam].label,
        peso_kg: peso, dims: dims.slice(), clase: FAMILIES[fam].clase,
        requiere_2: FAMILIES[fam].crew === 2, fragil: fx.fragil,
        defect: null, truth: { peso_kg: peso, dims: dims.slice(), crew: FAMILIES[fam].crew }
      };
      products.push(rec);
    }
    // registro protagonista y su duplicado
    const lav = { sku: 'LAV-FL-20', ean: '7501234567890', nombre: 'Lavadora carga frontal 20 kg', fam: 'LAVADORA', categoria: 'Lavadoras', peso_kg: 72, dims: [85, 60, 66], clase: 'LINEA_BLANCA', requiere_2: true, fragil: false, defect: null, truth: { peso_kg: 72, dims: [85, 60, 66], crew: 2 } };
    const lavDup = { sku: 'LAV-FL-20-B', ean: '7501234567890', nombre: 'Lavadora carga frontal 20kg', fam: 'LAVADORA', categoria: 'Lavadoras', peso_kg: null, dims: null, clase: null, requiere_2: null, fragil: false, defect: 'DUPLICADO+DIMS_NULAS', dupOf: 'LAV-FL-20', truth: lav.truth };
    products.unshift(lav);
    products.push(lavDup);

    // defectos deterministas
    const pool = products.filter((p) => !p.defect && p.sku !== 'LAV-FL-20');
    const take = (k, filt) => {
      const out = [];
      for (const p of pool) { if (out.length >= k) break; if (!p.defect && (!filt || filt(p))) out.push(p); }
      return out;
    };
    const big = (p) => ['LAVADORA', 'REFRI', 'SOFA', 'TV', 'COLCHON'].includes(p.fam);
    take(5, big).forEach((p) => { p.defect = 'DIMS_NULAS'; p.dims = null; });
    take(4).forEach((p) => {
      p.defect = 'DUPLICADO';
      const d = JSON.parse(JSON.stringify(p));
      d.sku = p.sku + '-B'; d.dupOf = p.sku; d.defect = 'DUPLICADO'; d.nombre = p.nombre.toUpperCase();
      products.push(d);
      p.defect = null; // el original queda sano
      p.hasDup = true;
    });
    take(4, big).forEach((p) => { p.defect = 'UNIDAD_GRAMOS'; p.peso_kg = Math.round(p.peso_kg * 1000); });
    take(7, big).forEach((p) => { p.defect = 'CLASE_INCONSISTENTE'; p.clase = 'PAQ_CHICO'; });
    take(2, big).forEach((p) => { p.defect = 'TIPO_TEXTO'; p.peso_kg = String(p.peso_kg) + ' kg'; });
    take(1, (p) => p.fam === 'LAVADORA').forEach((p) => {
      p.defect = 'UNIDAD_METROS'; p.dims = p.dims.map((d) => Math.round(d) / 100); p.peso_kg = Math.round(p.peso_kg) / 1000; p.requiere_2 = null;
    });

    // inventario: un movimiento por SKU + 3 huérfanos
    const inventory = products.map((p, i) => ({ mov: 'MOV-' + (5000 + i), sku: p.sku, cedis: pick(['CEDIS-NORTE', 'CEDIS-CENTRO', 'CEDIS-BAJIO']), qty: 1 + Math.floor(rnd() * 40) }));
    ['LAV-FL-20-C', 'TV-75-9999', 'SOF-3P-0000'].forEach((sku, i) => inventory.push({ mov: 'MOV-9' + i, sku, cedis: 'CEDIS-CENTRO', qty: 1, orphan: true }));

    // pedidos
    const orders = [{ id: 'PED-SIM-000417', sku: 'LAV-FL-20-B', zona: 'NORMAL', cliente: 'CLI-SIM-2291', cp: 'CP-SIM-03100' }];
    const sellable = products.filter((p) => p.sku !== 'LAV-FL-20-B');
    for (let i = 0; i < 71; i++) {
      const p = i < 18 ? sellable.filter((x) => x.defect || x.dupOf)[i % sellable.filter((x) => x.defect || x.dupOf).length] : pick(sellable);
      orders.push({ id: 'PED-SIM-' + String(418 + i).padStart(6, '0'), sku: p.sku, zona: rnd() < 0.12 ? 'CENTRO' : 'NORMAL', cliente: 'CLI-SIM-' + (3000 + i), cp: 'CP-SIM-' + String(10000 + Math.floor(rnd() * 89999)) });
    }
    return { products, inventory, orders, seed };
  }

  // ---------------------------------------------------------------- PAY MEX facturas sintéticas
  const INVOICES = [
    { id: 'FAC-SIM-7731', label: 'Flete reasignado · MXN', proveedor: 'Transportes FLT-0192 (ficticio)', rfc: 'TFL190312AB4', moneda: 'MXN', subtotal: 1850, iva: 296, oc: 'OC-SIM-88231', ocMonto: 2146, fecha: '2026-11-27', vence: '2026-12-04', conceptos: ['Servicio de flete VAN — PED-SIM-000417', 'Maniobra 2 personas'], ref: 'PED-SIM-000417', clabeBase: '01218000123456789' },
    { id: 'FAC-SIM-7744', label: 'Consolidado mensual · MXN', proveedor: 'Transportes FLT-0192 (ficticio)', rfc: 'TFL190312AB4', moneda: 'MXN', subtotal: 160689.66, iva: 25710.34, oc: 'OC-SIM-88190', ocMonto: 186400, fecha: '2026-11-27', vence: '2026-12-12', conceptos: ['Fletes línea blanca noviembre (412 entregas)', 'Maniobras especiales'], ref: 'Lote NOV-SIM', clabeBase: '01218000123456789' },
    { id: 'INV-SIM-2210', label: 'Refacciones · USD', proveedor: 'Parts Supplier PRT-77 (ficticio, EE. UU.)', rfc: 'XEXX010101000', moneda: 'USD', subtotal: 3120, iva: 0, oc: 'OC-SIM-88302', ocMonto: 3120, fecha: '2026-11-26', vence: '2026-12-10', conceptos: ['Kits de anclaje para transporte de lavadoras (240 u.)'], ref: 'Calidad de carga', clabeBase: null, swift: 'PRTSUS33XXX (ficticio)' }
  ];

  global.PMX_DATA = { AGENTS, COLS, EDGES, SUBAGENTS, VEHICLES, FAMILIES, FIXTURES, INVOICES, buildDataset, mulberry32 };
})(window);
