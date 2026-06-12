// Verificador ejecutable del router de la KB (sin runner de pruebas).
// Uso (desde version2/):
//   pnpm --filter @erp/api build
//   node apps/api/scripts/verificar-kb.mjs
// Prueba el enrutamiento real de KbService contra base-conocimiento/.
import { KbService } from '../dist/modules/soporte/kb.service.js';

const kb = new KbService();
kb.cargar();

const casos = [
  { q: '¿cómo apruebo una solicitud de pago?', espera: 'cxp' },
  { q: '¿por qué no veo la pestaña de Claves SAT?', espera: 'configuraciones' },
  { q: '¿cómo doy de alta un cliente nuevo?', espera: 'clientes' },
  { q: 'no me deja guardar', ruta: '/arrendatarios/planes', espera: 'arrendatarios' },
  { q: 'qué es el INPC y el tipo de cambio', espera: 'landing-indicadores' },
  { q: 'dispersión y kardex del fideicomiso', espera: 'fideicomiso' },
];

let ok = 0;
console.log(`KB cargada: ${kb.modulos().length} módulos.\n`);
for (const c of casos) {
  const sel = kb.seleccionar(c.q, c.ruta);
  const pasa = sel.modulos.includes(c.espera);
  if (pasa) ok++;
  console.log(
    `${pasa ? '✅' : '❌'} "${c.q}"${c.ruta ? ` [${c.ruta}]` : ''}\n   esperado: ${c.espera} · seleccionado: [${sel.modulos.join(', ') || '—'}]`,
  );
}
console.log(`\nResultado: ${ok}/${casos.length} casos correctos.`);
process.exit(ok === casos.length ? 0 : 1);
