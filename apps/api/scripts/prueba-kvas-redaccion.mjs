// Pruebas de las funciones puras de redacción de KVA's y del esquema de plantillas (Fase 2).
// Uso (desde version2/):
//   pnpm --filter @erp/api build
//   node apps/api/scripts/prueba-kvas-redaccion.mjs
import {
  agruparNaves,
  redactarKvas,
  redactarNivel,
  redactarFecha,
  redactarParques,
  resolverCampos,
  resolverTodo,
  unirLista,
} from '../dist/modules/parques/kvas-redaccion.js';
import { contenidoSchema, crearPlantillaSchema, restaurarVersionSchema, numeroVersionSchema } from '../dist/modules/parques/kvas-plantillas.schemas.js';
import { clavesPermitidas } from '../dist/modules/parques/kvas-plantillas.campos.js';
import { vistaPreviaSchema } from '../dist/modules/parques/kvas-documentos.schemas.js';

let ok = 0;
let mal = 0;
function eq(nombre, real, esperado) {
  const a = JSON.stringify(real);
  const b = JSON.stringify(esperado);
  if (a === b) ok++;
  else {
    mal++;
    console.error(`FALLA ${nombre}\n  real:     ${a}\n  esperado: ${b}`);
  }
}

const nave = (idNave, numNave, kvas, parque = 'P1', nom = 'Acupark III', extra = {}) => ({
  idNave, numNave, idParque: parque, nomParque: nom, kvas, ...extra,
});
const bt = (c) => [{ nivel: 'BT', cantidad: c }];
const mt = (c) => [{ nivel: 'MT', cantidad: c }];
const codigos = (r) => r.advertencias.map((a) => a.codigo);

// 1-2. unión de lista
eq('unir 1', unirLista(['a']), 'a');
eq('unir 2 y 3', [unirLista(['a', 'b']), unirLista(['a', 'b', 'c'])], ['a y b', 'a, b y c']);

// 3. EM BAJÍO: 8 naves
const bajio = [107, 108, 109, 110, 119, 120, 121, 122].map((n) => nave('N' + n, String(n), bt(5)));
const rb = resolverTodo('EM BAJÍO EMPAQUES S.A. DE C.V.', [...bajio].reverse(), new Date('2026-10-07T18:00:00Z'));
eq('bajio naves', rb.resueltos.naves, '107, 108, 109, 110, 119, 120, 121 y 122');
eq('bajio kvas', rb.resueltos.kvas_por_nave, '5 KVAS');
eq('bajio nivel', rb.resueltos.nivel, 'baja tensión');
eq('bajio parque', rb.resueltos.parque, 'Acupark III');
eq('bajio empresa', rb.resueltos.empresa, 'EM BAJÍO EMPAQUES S.A. DE C.V.');
eq('bajio fecha', rb.resueltos.fecha, '7 de octubre de 2026');
eq('bajio sin advertencias', rb.advertencias, []);

// 4. orden natural y A12 al final
eq('orden natural', agruparNaves([nave('a', '10', bt(1)), nave('b', 'A12', bt(1)), nave('c', '2', bt(1))]).texto, '2, 10 y A12');

// 5. dedupe por idNave (misma nave dos veces)
eq('dedupe idNave', agruparNaves([nave('a', '5', bt(1)), nave('a', '5', bt(1))]).texto, '5');

// 6. dos naves distintas, mismo numNaveNAME y mismo parque: no se funden
const dupEt = [nave('x1', 'A1', bt(5)), nave('x2', 'A1', bt(5))];
eq('misma etiqueta no se funde', agruparNaves(dupEt).texto, 'A1 y A1');
eq('misma etiqueta advierte', codigos(redactarKvas(dupEt)), ['ETIQUETA_REPETIDA']);

// 7. una nave y singular/plural
eq('una nave 1 KVA', redactarKvas([nave('a', '1', bt(1))]).texto, '1 KVA');
eq('una nave 5', redactarKvas([nave('a', '1', bt(5))]).texto, '5 KVAS');

// 8. decimales
eq('decimales', redactarKvas([nave('a', '1', bt(2.5)), nave('b', '2', bt(2.5))]).texto, '2.5 KVAS');
eq('decimal .50 y entero .0', [redactarKvas([nave('a', '1', bt(2.5))]).texto, redactarKvas([nave('a', '1', bt(5.0))]).texto], ['2.5 KVAS', '5 KVAS']);

// 9. cantidades distintas (sin «y» dentro: se une con «y»)
const cd = redactarKvas([nave('a', '107', bt(5)), nave('b', '109', bt(10))]);
eq('cantidades distintas', cd.texto, '5 KVAS en la nave 107 y 10 KVAS en la nave 109');
eq('cantidades distintas adv', codigos(cd), ['CANTIDADES_DISTINTAS']);
// con «y» dentro de un grupo → «; »
const cd2 = redactarKvas([nave('a', '107', bt(5)), nave('b', '108', bt(5)), nave('c', '109', bt(10))]);
eq('cantidades distintas con y interna', cd2.texto, '5 KVAS en las naves 107 y 108; 10 KVAS en la nave 109');

// 10. mezcla BT/MT entre naves
const mezcla = [nave('a', '1', bt(5)), nave('b', '2', mt(5))];
eq('mezcla nivel', redactarNivel(mezcla), { texto: 'baja y media tensión', mixto: true });
eq('mezcla adv', codigos(redactarKvas(mezcla)).sort(), ['CANTIDADES_DISTINTAS', 'NIVEL_MIXTO']);
eq('mezcla texto', redactarKvas(mezcla).texto, '5 KVAS en baja tensión en la nave 1 y 5 KVAS en media tensión en la nave 2');
eq('solo MT', redactarNivel([nave('a', '1', mt(3))]).texto, 'media tensión');

// 11. una nave con BT y MT a la vez
const dosNiv = redactarKvas([nave('a', '1', [{ nivel: 'MT', cantidad: 2 }, { nivel: 'BT', cantidad: 3 }])]);
eq('BT y MT misma nave', dosNiv.texto, '3 KVAS en baja tensión y 2 KVAS en media tensión');
eq('BT y MT misma nave adv', codigos(dosNiv), ['NIVEL_MIXTO']);

// 12. varios parques
const vp = [
  nave('a', '108', bt(5), 'P1', 'Acupark III'),
  nave('b', '107', bt(5), 'P1', 'Acupark III'),
  nave('c', '12', bt(5), 'P2', 'Spartek I'),
];
eq('varios parques naves', agruparNaves(vp).texto, '107 y 108 del parque Acupark III; 12 del parque Spartek I');
eq('varios parques parque', redactarParques(vp), 'Acupark III y Spartek I');
eq('varios parques adv', codigos(redactarKvas(vp)), ['VARIOS_PARQUES']);
eq('3 parques', redactarParques([...vp, nave('d', '1', bt(1), 'P0', 'Norponiente')]), 'Acupark III, Norponiente y Spartek I');

// 13. dotación
eq('difiere dotación', codigos(redactarKvas([nave('a', '1', bt(5), 'P1', 'X', { dotacionBt: 7, dotacionMt: 0 })])), ['DIFIERE_DE_DOTACION']);
eq('coincide dotación', codigos(redactarKvas([nave('a', '1', bt(5), 'P1', 'X', { dotacionBt: 5, dotacionMt: 0 })])), []);

// 14. fecha en zona de México (23:30 del 31-dic en CDMX = 05:30Z del 1-ene)
eq('fecha zona MX', redactarFecha(new Date('2027-01-01T05:30:00Z')), '31 de diciembre de 2026');

// 15. resolverCampos conserva marcas y no toca el original
const orig = {
  type: 'doc',
  content: [{ type: 'paragraph', content: [
    { type: 'text', text: 'Empresa: ' },
    { type: 'campo', attrs: { clave: 'empresa' }, marks: [{ type: 'bold' }] },
    { type: 'campo', attrs: { clave: 'inexistente' } },
  ] }],
};
const copia = JSON.stringify(orig);
const res = resolverCampos(orig, { empresa: 'ACME' });
eq('resolverCampos', res.content[0].content, [
  { type: 'text', text: 'Empresa: ' },
  { type: 'text', text: 'ACME', marks: [{ type: 'bold' }] },
]);
eq('resolverCampos no muta', JSON.stringify(orig), copia);

// --- Esquema de plantillas ---
const parrafo = (...content) => ({ type: 'doc', content: [{ type: 'paragraph', content }] });
const contenidoCon = (inl) => ({ encabezado: parrafo(), cuerpo: parrafo(...inl), pie: parrafo() });
const campoOk = { type: 'campo', attrs: { clave: 'naves' }, marks: [{ type: 'italic' }] };

const sOk = contenidoSchema.safeParse(contenidoCon([campoOk]));
eq('esquema acepta campo', sOk.success, true);
eq('esquema conserva marcas del campo', sOk.success && sOk.data.cuerpo.content[0].content[0], campoOk);
eq('esquema rechaza clave fuera de catálogo', contenidoSchema.safeParse(contenidoCon([{ type: 'campo', attrs: { clave: 'figura' } }])).success, false);
eq('esquema rechaza atributos extra en campo', contenidoSchema.safeParse(contenidoCon([{ type: 'campo', attrs: { clave: 'naves', x: 1 } }])).success, false);
eq('esquema rechaza propiedad extra en nodo campo', contenidoSchema.safeParse(contenidoCon([{ type: 'campo', attrs: { clave: 'naves' }, html: '<b>' }])).success, false);
eq('esquema rechaza marca no permitida en campo', contenidoSchema.safeParse(contenidoCon([{ type: 'campo', attrs: { clave: 'naves' }, marks: [{ type: 'link' }] }])).success, false);
eq('esquema rechaza campo sin clave', contenidoSchema.safeParse(contenidoCon([{ type: 'campo' }])).success, false);
eq('esquema conserva listas cerradas (fuente fuera de lista)', contenidoSchema.safeParse(contenidoCon([{ type: 'text', text: 'a', marks: [{ type: 'textStyle', attrs: { fontFamily: 'Comic Sans' } }] }])).success, false);
eq('crear acepta ASIGNACION con campo', crearPlantillaSchema.safeParse({ tipo: 'ASIGNACION_CARGA', nombre: 'x', contenido: contenidoCon([campoOk]) }).success, true);

// Catálogo por tipo (DEVOLUCION no admite ningún campo)
eq('catálogo ASIGNACION admite los 6', clavesPermitidas('ASIGNACION_CARGA', ['empresa', 'parque', 'naves', 'kvas_por_nave', 'nivel', 'fecha']), true);
eq('catálogo DEVOLUCION rechaza campo', clavesPermitidas('DEVOLUCION', ['empresa']), false);
eq('catálogo DEVOLUCION sin campos ok', clavesPermitidas('DEVOLUCION', []), true);

// --- Cuerpo de vista previa ---
const base = { idPlantilla: '11111111-1111-4111-8111-111111111111', idInversionista: 'I1', naves: [{ idNave: 'N1', kvas: bt(5) }] };
eq('vista previa válida', vistaPreviaSchema.safeParse(base).success, true);
eq('vista previa rechaza nave repetida', vistaPreviaSchema.safeParse({ ...base, naves: [base.naves[0], base.naves[0]] }).success, false);
eq('vista previa rechaza 3 decimales', vistaPreviaSchema.safeParse({ ...base, naves: [{ idNave: 'N1', kvas: bt(1.234) }] }).success, false);
eq('vista previa rechaza cantidad 0', vistaPreviaSchema.safeParse({ ...base, naves: [{ idNave: 'N1', kvas: bt(0) }] }).success, false);
eq('vista previa rechaza niveles repetidos', vistaPreviaSchema.safeParse({ ...base, naves: [{ idNave: 'N1', kvas: [...bt(1), ...bt(2)] }] }).success, false);
eq('vista previa rechaza contenido del cliente', vistaPreviaSchema.safeParse({ ...base, contenido: {} }).success, false);
eq('vista previa rechaza 0 naves', vistaPreviaSchema.safeParse({ ...base, naves: [] }).success, false);


// --- Pulidos (M-1, M-2) ---
const vpDist = [nave('a', '5', bt(5), 'PA', 'Parque A'), nave('b', '5', bt(10), 'PB', 'Parque B')];
eq('M-1 mismo número, distintos parques', redactarKvas(vpDist).texto, '5 KVAS en la nave 5 del parque Parque A; 10 KVAS en la nave 5 del parque Parque B');
const vpIg = [nave('a', '5', bt(5), 'PA', 'A'), nave('b', '7', bt(5), 'PB', 'B')];
eq('M-1 cantidades iguales no cambia', redactarKvas(vpIg).texto, '5 KVAS');
eq('M-1 un parque no califica', redactarKvas([nave('a', '5', bt(5)), nave('b', '6', bt(9))]).texto, '5 KVAS en la nave 5 y 9 KVAS en la nave 6');
eq('M-1 agruparNaves forzarParque', agruparNaves([nave('a', '5', bt(1))], true).texto, '5 del parque Acupark III');
eq('M-1 agruparNaves por omisión', agruparNaves([nave('a', '5', bt(1))]).texto, '5');
const mixP = redactarKvas([nave('a', '5', bt(5), 'PA', 'A'), nave('b', '5', mt(5), 'PB', 'B')]);
eq('M-1+M-2 mixto en dos parques', mixP.texto, '5 KVAS en baja tensión en la nave 5 del parque A; 5 KVAS en media tensión en la nave 5 del parque B');
eq('M-2 mixto: nivel sigue "baja y media tensión"', resolverTodo('E', mezcla).resueltos.nivel, 'baja y media tensión');
eq('M-2 aviso orienta a quitar el nivel repetido', redactarKvas(mezcla).advertencias.find((a) => a.codigo === 'NIVEL_MIXTO').mensaje.includes('quita ese fragmento'), true);

// --- L2: anidamiento extremo → rechazo limpio (sin desbordar la pila) ---
let prof = { type: 'paragraph' };
for (let i = 0; i < 20000; i++) prof = { type: 'bulletList', content: [{ type: 'listItem', content: [prof] }] };
const hondo = { encabezado: parrafo(), cuerpo: { type: 'doc', content: [prof] }, pie: parrafo() };
let hondoRes;
try { hondoRes = contenidoSchema.safeParse(hondo); } catch (e) { hondoRes = { success: 'EXCEPCION ' + e.message }; }
eq('L2 anidamiento extremo → safeParse falso, sin excepción', hondoRes.success, false);
eq('L2 mensaje claro', JSON.stringify(hondoRes.error?.issues ?? '').includes('demasiado anidadas'), true);
const listas = (hoja, n) => {
  let x = hoja;
  for (let i = 0; i < n; i++) x = { type: 'bulletList', content: [{ type: 'listItem', content: [x] }] };
  return x;
};
const hojaMax = { type: 'paragraph', content: [{ type: 'text', text: 'a', marks: [{ type: 'textStyle', attrs: { fontFamily: 'Arial', fontSize: '12px' } }] }] };
const cuerpoCon = (x) => ({ encabezado: parrafo(), cuerpo: { type: 'doc', content: [x] }, pie: parrafo() });
eq('L2 profundidad legítima máxima (2 listas + texto con marcas) pasa', contenidoSchema.safeParse(cuerpoCon(listas(hojaMax, 2))).success, true);
eq('L2 un nivel más (3 listas) rechazado por la regla de nodos', contenidoSchema.safeParse(cuerpoCon(listas(hojaMax, 3))).success, false);

// --- Restaurar: esquema hostil ---
const okR = { version: 2, versionBase: 3 };
eq('restaurar válido', restaurarVersionSchema.safeParse(okR).success, true);
eq('restaurar con nota', restaurarVersionSchema.safeParse({ ...okR, nota: 'x' }).success, true);
eq('restaurar version negativa', restaurarVersionSchema.safeParse({ ...okR, version: -1 }).success, false);
eq('restaurar version 0', restaurarVersionSchema.safeParse({ ...okR, version: 0 }).success, false);
eq('restaurar version decimal', restaurarVersionSchema.safeParse({ ...okR, version: 1.5 }).success, false);
eq('restaurar version texto', restaurarVersionSchema.safeParse({ ...okR, version: '2' }).success, false);
eq('restaurar sin versionBase', restaurarVersionSchema.safeParse({ version: 2 }).success, false);
eq('restaurar atributo extra', restaurarVersionSchema.safeParse({ ...okR, contenido: {} }).success, false);
eq('restaurar nota > 200', restaurarVersionSchema.safeParse({ ...okR, nota: 'x'.repeat(201) }).success, false);
eq('restaurar version enorme', restaurarVersionSchema.safeParse({ ...okR, version: 1e12 }).success, false);
eq('restaurar vacío', restaurarVersionSchema.safeParse({}).success, false);
eq(':n válido', numeroVersionSchema.safeParse('12').data, 12);
for (const m of ['0', '-1', '1.5', 'abc', '1e3', '', '01', '99999999999', ' 1'])
  eq(`:n rechaza "${m}"`, numeroVersionSchema.safeParse(m).success, false);

// --- B-3: ids de documentos ---
eq('B-3 id con coma/comillas rechazado', vistaPreviaSchema.safeParse({ ...base, idInversionista: 'a",b(' }).success, false);


console.log(`\n${ok} correctas, ${mal} fallidas`);
process.exit(mal ? 1 : 0);
