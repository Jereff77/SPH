import type { MatrizPermisos, PermisoCatalogo, UsuarioMatriz } from './permisos.api';
import { descripcionPermiso } from './permisos-descripciones';

/**
 * Exportación a Excel de la **matriz de usuarios × permisos** (Configuraciones →
 * Permisos, clave 220). Cuatro hojas:
 *
 * - **Matriz**: usuarios en las filas, los permisos en las columnas encabezadas
 *   por su **clave** (`segModulos.clave`), agrupadas por módulo. `✔` = concedido.
 * - **Catálogo de permisos**: los permisos con módulo/sección/área y cuántos
 *   usuarios activos los tienen (detecta permisos que nadie usa).
 * - **Detalle**: la misma información en lista plana, para tablas dinámicas.
 * - **Resumen**: cifras de control.
 *
 * ⚠️ Los usuarios con `isSupport` hacen **bypass** del RBAC: se marcan con `★` en
 * ámbar y cuentan con acceso total, porque sus marcas individuales no reflejan lo
 * que realmente pueden abrir.
 *
 * Reutiliza el patrón de `contabilidad-export.ts`: ExcelJS por **carga diferida**
 * (chunk lazy, no entra al bundle inicial) y descarga por Blob.
 */

const AZUL = 'FF1F2A4D';
const AZUL2 = 'FF3A3F5C';
const VERDE = 'FF1A6B4A';
const VERDE_SUAVE = 'FFD9EFE4';
const GRIS_SUAVE = 'FFF2F2F4';
const GRIS_COL = 'FFE0E1E5';
const GRIS_TXT = 'FF6B6C7E';
const AMBAR = 'FFFFF4D6';
const AMBAR_TXT = 'FF9A6B00';
const BORDE = 'FFB8B9BE';

/** Columnas fijas de la matriz: Usuario | Correo | Estatus | Soporte | Total. */
const FIJAS = 5;

const fill = (argb: string) =>
  ({ type: 'pattern', pattern: 'solid', fgColor: { argb } }) as const;

const borde = () => ({
  top: { style: 'thin' as const, color: { argb: BORDE } },
  left: { style: 'thin' as const, color: { argb: BORDE } },
  bottom: { style: 'thin' as const, color: { argb: BORDE } },
  right: { style: 'thin' as const, color: { argb: BORDE } },
});

/** ¿El usuario puede entrar a ese permiso? (soporte = todo, por bypass). */
const tieneAcceso = (u: UsuarioMatriz, clave: number) =>
  u.soporte || u.claves.includes(clave);

/** Cuántos usuarios **activos** pueden entrar a un permiso. */
const cuantosActivos = (usuarios: UsuarioMatriz[], clave: number) =>
  usuarios.filter((u) => u.activo && tieneAcceso(u, clave)).length;

export async function exportarMatrizPermisosExcel(
  datos: MatrizPermisos,
  archivo: string,
): Promise<void> {
  const ExcelJS = (await import('exceljs')).default;
  const wb = new ExcelJS.Workbook();
  wb.creator = 'ERP SPH v2';
  wb.created = new Date();

  const { permisos, usuarios } = datos;
  const generado = new Date(datos.generado).toLocaleString('es-MX');

  /* Alterna un tono por módulo para separar los bloques de columnas. */
  const modulos = [...new Set(permisos.map((p) => p.modulo))];
  const tono = new Map(modulos.map((m, i) => [m, i % 2 === 0 ? null : GRIS_SUAVE]));

  construirMatriz(wb, permisos, usuarios, modulos, tono, generado);
  construirCatalogo(wb, permisos, usuarios);
  construirDetalle(wb, permisos, usuarios);
  construirResumen(wb, permisos, usuarios);

  const buf = await wb.xlsx.writeBuffer();
  const blob = new Blob([buf], {
    type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
  });
  const link = document.createElement('a');
  link.href = URL.createObjectURL(blob);
  link.download = `${archivo}.xlsx`;
  link.click();
  URL.revokeObjectURL(link.href);
}

/* ───────────────────────── Hoja 1: Matriz ───────────────────────── */

function construirMatriz(
  wb: import('exceljs').Workbook,
  permisos: PermisoCatalogo[],
  usuarios: UsuarioMatriz[],
  modulos: string[],
  tono: Map<string, string | null>,
  generado: string,
) {
  const ws = wb.addWorksheet('Matriz', {
    views: [{ state: 'frozen', xSplit: FIJAS, ySplit: 4 }],
    pageSetup: { orientation: 'landscape', fitToPage: true, fitToWidth: 1, fitToHeight: 0 },
  });
  const totalCols = FIJAS + permisos.length;

  // Fila 1 — título
  ws.mergeCells(1, 1, 1, totalCols);
  const t = ws.getCell(1, 1);
  t.value = `Matriz de usuarios y permisos — ERP SPH v2   ·   generado el ${generado}`;
  t.font = { bold: true, size: 13, color: { argb: 'FFFFFFFF' } };
  t.fill = fill(AZUL);
  t.alignment = { vertical: 'middle', horizontal: 'left', indent: 1 };
  ws.getRow(1).height = 26;

  // Filas 2-4 — encabezados fijos (combinados en vertical)
  ['Usuario', 'Correo', 'Estatus', 'Soporte', 'Total permisos'].forEach((txt, i) => {
    ws.mergeCells(2, i + 1, 4, i + 1);
    const c = ws.getCell(2, i + 1);
    c.value = txt;
    c.font = { bold: true, size: 10, color: { argb: 'FFFFFFFF' } };
    c.fill = fill(AZUL2);
    c.alignment = { vertical: 'middle', horizontal: 'center', wrapText: true };
    c.border = borde();
  });

  // Fila 2 — módulo (combinado por bloque de columnas)
  let col = FIJAS + 1;
  for (const m of modulos) {
    const n = permisos.filter((p) => p.modulo === m).length;
    ws.mergeCells(2, col, 2, col + n - 1);
    const c = ws.getCell(2, col);
    c.value = m;
    c.font = { bold: true, size: 10, color: { argb: 'FFFFFFFF' } };
    c.fill = fill(AZUL);
    c.alignment = { vertical: 'middle', horizontal: 'center' };
    c.border = borde();
    col += n;
  }

  // Filas 3-4 — clave (número) y sección · área (rotado 90°)
  permisos.forEach((p, i) => {
    const c = FIJAS + 1 + i;
    const bg = tono.get(p.modulo) ?? GRIS_COL;

    const clave = ws.getCell(3, c);
    clave.value = p.clave;
    clave.font = { bold: true, size: 11 };
    clave.alignment = { vertical: 'middle', horizontal: 'center' };
    clave.fill = fill(bg);
    clave.border = borde();
    // La descripción no cabe como columna en la matriz (una columna = un permiso),
    // así que viaja como nota flotante sobre la clave: se lee al pasar el mouse.
    const desc = descripcionPermiso(p.clave);
    if (desc) {
      clave.note = {
        texts: [
          { font: { bold: true, size: 10 }, text: `${p.clave} — ${p.modulo} · ${p.seccion}\n` },
          { font: { size: 10 }, text: desc },
        ],
        margins: { insetmode: 'custom', inset: [0.1, 0.1, 0.1, 0.1] },
      };
    }

    const det = ws.getCell(4, c);
    det.value = p.area === 'Modulo' ? p.seccion : `${p.seccion} · ${p.area}`;
    det.font = { size: 8 };
    det.alignment = { textRotation: 90, vertical: 'bottom', horizontal: 'center', wrapText: true };
    det.fill = fill(bg);
    det.border = borde();

    ws.getColumn(c).width = 4.5;
  });
  ws.getRow(2).height = 18;
  ws.getRow(3).height = 20;
  ws.getRow(4).height = 118;

  // Filas de usuarios
  usuarios.forEach((u, idx) => {
    const row = ws.getRow(5 + idx);
    row.getCell(1).value = u.nombre;
    row.getCell(2).value = u.correo;
    row.getCell(3).value = u.activo ? 'Activo' : 'Inactivo';
    row.getCell(4).value = u.soporte ? 'SÍ' : '';
    row.getCell(5).value = u.soporte ? permisos.length : u.claves.length;

    for (let i = 1; i <= FIJAS; i++) {
      const c = row.getCell(i);
      c.border = borde();
      c.font = { size: 10, bold: i === 1 };
      c.alignment = {
        vertical: 'middle',
        horizontal: i <= 2 ? 'left' : 'center',
        indent: i <= 2 ? 1 : 0,
      };
      if (!u.activo) c.fill = fill(GRIS_SUAVE);
      if (u.soporte) c.fill = fill(AMBAR);
    }
    if (!u.activo) row.getCell(3).font = { size: 10, color: { argb: 'FF9A9AA5' } };

    permisos.forEach((p, i) => {
      const c = row.getCell(FIJAS + 1 + i);
      const tiene = u.claves.includes(p.clave);
      c.value = u.soporte ? '★' : tiene ? '✔' : '';
      c.alignment = { vertical: 'middle', horizontal: 'center' };
      c.border = borde();
      c.font = { size: 10, bold: true, color: { argb: u.soporte ? AMBAR_TXT : VERDE } };
      if (u.soporte) c.fill = fill(AMBAR);
      else if (tiene) c.fill = fill(VERDE_SUAVE);
      else if (!u.activo) c.fill = fill(GRIS_SUAVE);
      else if (tono.get(p.modulo)) c.fill = fill(GRIS_SUAVE);
    });
    row.height = 17;
  });

  // Fila de totales por permiso
  const rTot = 5 + usuarios.length;
  const filaTot = ws.getRow(rTot);
  ws.mergeCells(rTot, 1, rTot, FIJAS);
  const cTot = ws.getCell(rTot, 1);
  cTot.value = 'Usuarios activos con el permiso →';
  cTot.font = { bold: true, size: 10, color: { argb: 'FFFFFFFF' } };
  cTot.fill = fill(AZUL2);
  cTot.alignment = { vertical: 'middle', horizontal: 'right', indent: 1 };
  cTot.border = borde();
  permisos.forEach((p, i) => {
    const c = filaTot.getCell(FIJAS + 1 + i);
    c.value = cuantosActivos(usuarios, p.clave);
    c.font = { bold: true, size: 10, color: { argb: 'FFFFFFFF' } };
    c.fill = fill(AZUL2);
    c.alignment = { vertical: 'middle', horizontal: 'center' };
    c.border = borde();
  });
  filaTot.height = 18;

  ws.getColumn(1).width = 34;
  ws.getColumn(2).width = 30;
  ws.getColumn(3).width = 10;
  ws.getColumn(4).width = 9;
  ws.getColumn(5).width = 8;
  ws.autoFilter = {
    from: { row: 4, column: 1 },
    to: { row: 4 + usuarios.length, column: FIJAS },
  };

  // Leyenda al pie
  const rLey = rTot + 2;
  ws.mergeCells(rLey, 1, rLey, 12);
  const ley = ws.getCell(rLey, 1);
  ley.value =
    '✔ = permiso asignado (segModulosUsuarios.acceso = true)   ·   ★ = usuario de Soporte: acceso TOTAL por bypass ' +
    'del sistema, sin importar lo que tenga marcado   ·   filas grises = usuario inactivo (no puede entrar)   ·   ' +
    'el número de la fila 3 es la clave del permiso (segModulos.clave): pasa el mouse sobre él para leer para qué ' +
    'sirve, o consulta la hoja «Catálogo de permisos».';
  ley.font = { size: 9, italic: true, color: { argb: GRIS_TXT } };
  ley.alignment = { wrapText: true, vertical: 'top' };
  ws.getRow(rLey).height = 30;
}

/* ─────────────────── Hoja 2: Catálogo de permisos ─────────────────── */

function construirCatalogo(
  wb: import('exceljs').Workbook,
  permisos: PermisoCatalogo[],
  usuarios: UsuarioMatriz[],
) {
  const ws = wb.addWorksheet('Catálogo de permisos', {
    views: [{ state: 'frozen', ySplit: 1 }],
  });
  ws.columns = [
    { header: 'Clave', key: 'clave', width: 9 },
    { header: 'Módulo', key: 'modulo', width: 22 },
    { header: 'Sección', key: 'seccion', width: 28 },
    { header: 'Área / acción', key: 'area', width: 26 },
    { header: '¿Para qué sirve?', key: 'desc', width: 78 },
    { header: 'Usuarios activos con el permiso', key: 'n', width: 30 },
  ];
  permisos.forEach((p) => {
    ws.addRow({
      clave: p.clave,
      modulo: p.modulo,
      seccion: p.seccion,
      area: p.area,
      desc: descripcionPermiso(p.clave),
      n: cuantosActivos(usuarios, p.clave),
    });
  });
  encabezar(ws);
  ws.eachRow((row, i) => {
    if (i === 1) return;
    row.eachCell((c) => {
      c.border = borde();
      c.font = { size: 10 };
    });
    row.getCell(1).alignment = { horizontal: 'center' };
    row.getCell(5).alignment = { vertical: 'middle', wrapText: true, indent: 1 };
    row.getCell(6).alignment = { horizontal: 'center' };
    row.height = 28;
    // Ámbar cuando NADIE puede entrar: permiso huérfano, candidato a revisión.
    if (row.getCell(6).value === 0) row.getCell(6).fill = fill(AMBAR);
  });
  ws.autoFilter = { from: { row: 1, column: 1 }, to: { row: 1 + permisos.length, column: 6 } };
}

/* ───────────────── Hoja 3: Detalle (para dinámicas) ───────────────── */

function construirDetalle(
  wb: import('exceljs').Workbook,
  permisos: PermisoCatalogo[],
  usuarios: UsuarioMatriz[],
) {
  const ws = wb.addWorksheet('Detalle', { views: [{ state: 'frozen', ySplit: 1 }] });
  ws.columns = [
    { header: 'Usuario', key: 'u', width: 34 },
    { header: 'Correo', key: 'e', width: 30 },
    { header: 'Estatus', key: 's', width: 10 },
    { header: 'Soporte', key: 'sp', width: 9 },
    { header: 'Clave', key: 'c', width: 9 },
    { header: 'Módulo', key: 'm', width: 22 },
    { header: 'Sección', key: 'se', width: 28 },
    { header: 'Área / acción', key: 'a', width: 26 },
    { header: '¿Para qué sirve?', key: 'd', width: 78 },
  ];
  for (const u of usuarios) {
    for (const p of permisos) {
      if (!tieneAcceso(u, p.clave)) continue;
      ws.addRow({
        u: u.nombre,
        e: u.correo,
        s: u.activo ? 'Activo' : 'Inactivo',
        sp: u.soporte ? 'SÍ' : 'No',
        c: p.clave,
        m: p.modulo,
        se: p.seccion,
        a: p.area,
        d: descripcionPermiso(p.clave),
      });
    }
  }
  encabezar(ws);
  ws.autoFilter = { from: { row: 1, column: 1 }, to: { row: ws.rowCount, column: 9 } };
}

/* ───────────────────────── Hoja 4: Resumen ───────────────────────── */

function construirResumen(
  wb: import('exceljs').Workbook,
  permisos: PermisoCatalogo[],
  usuarios: UsuarioMatriz[],
) {
  const ws = wb.addWorksheet('Resumen');
  ws.columns = [{ width: 46 }, { width: 16 }];
  const filas: [string, string | number][] = [
    ['Concepto', 'Valor'],
    ['Usuarios en el sistema', usuarios.length],
    ['Usuarios activos', usuarios.filter((u) => u.activo).length],
    ['Usuarios inactivos', usuarios.filter((u) => !u.activo).length],
    ['Usuarios de Soporte (acceso total)', usuarios.filter((u) => u.soporte).length],
    [
      'Usuarios ACTIVOS sin ningún permiso',
      usuarios.filter((u) => u.activo && !u.soporte && u.claves.length === 0).length,
    ],
    ['Permisos en el catálogo', permisos.length],
    [
      'Permisos que nadie activo tiene (sin contar Soporte)',
      permisos.filter(
        (p) => !usuarios.some((u) => u.activo && !u.soporte && u.claves.includes(p.clave)),
      ).length,
    ],
    ['Asignaciones vigentes (acceso = true)', usuarios.reduce((a, u) => a + u.claves.length, 0)],
  ];
  filas.forEach((f, i) => {
    const row = ws.addRow(f);
    row.height = 19;
    row.eachCell((c, j) => {
      c.border = borde();
      if (i === 0) {
        c.font = { bold: true, color: { argb: 'FFFFFFFF' } };
        c.fill = fill(AZUL);
        c.alignment = { horizontal: 'center', vertical: 'middle' };
      } else {
        c.font = { size: 10, bold: j === 2 };
        c.alignment = {
          horizontal: j === 2 ? 'center' : 'left',
          indent: j === 1 ? 1 : 0,
          vertical: 'middle',
        };
      }
    });
  });
  ws.addRow([]);
  const nota = ws.addRow([
    'Fuente: catUsers · segModulos · segModulosUsuarios. Reporte de solo lectura.',
  ]);
  nota.getCell(1).font = { size: 9, italic: true, color: { argb: GRIS_TXT } };
}

/** Encabezado azul de las hojas de lista (fila 1). */
function encabezar(ws: import('exceljs').Worksheet) {
  ws.getRow(1).eachCell((c) => {
    c.font = { bold: true, color: { argb: 'FFFFFFFF' } };
    c.fill = fill(AZUL);
    c.alignment = { vertical: 'middle', horizontal: 'center' };
  });
  ws.getRow(1).height = 22;
}
