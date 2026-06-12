import { Injectable, Logger, OnModuleInit } from '@nestjs/common';
import { readdirSync, readFileSync, existsSync } from 'node:fs';
import { join, dirname } from 'node:path';

/** Metadatos (frontmatter) + cuerpo de un documento de módulo de la KB. */
export interface DocModuloKb {
  archivo: string; // nombre del .md (sin extensión), p. ej. "cxp"
  modulo: string; // nombre legible
  estado: string; // desarrollado | parcial | stub
  rutas: string[];
  clavesPermiso: number[];
  tablas: string[];
  palabrasClave: string[];
  relacionadoCon: string[];
  cuerpo: string; // markdown sin el frontmatter
}

/** Resultado del enrutador: qué documentos de la KB son relevantes para una pregunta. */
export interface SeleccionKb {
  modulos: string[]; // archivos seleccionados (para trazabilidad del RAG)
  contenido: string; // cuerpos concatenados, listos para inyectar en el prompt
}

/** Normaliza para comparar: minúsculas, sin acentos, sin signos. */
function normalizar(texto: string): string {
  return texto
    .toLowerCase()
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .replace(/[^a-z0-9\s/]/gi, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

/**
 * Router de la Base de Conocimiento (RAG fase 1, por palabras clave).
 *
 * Replica en código lo que `base-conocimiento/INDICE.md` describe en prosa:
 * parsea el frontmatter de los `modulos/*.md` (palabras_clave, tablas, rutas,
 * claves_permiso, relacionado_con) y, ante una pregunta del usuario + la ruta
 * actual, selecciona los 1-3 documentos más relevantes para inyectarlos en el
 * prompt del agente. NO usa embeddings (eso es la fase 2 con pgvector): este
 * contrato se diseñó para poder cambiar la implementación de `seleccionar` sin
 * tocar el resto.
 *
 * La KB es la ÚNICA fuente de conocimiento del agente (regla 8). Solo se LEE del
 * filesystem; nunca se escribe.
 */
@Injectable()
export class KbService implements OnModuleInit {
  private readonly logger = new Logger(KbService.name);
  private docs: DocModuloKb[] = [];
  private glosarioTexto = '';

  onModuleInit(): void {
    this.cargar();
  }

  /** (Re)carga la KB desde disco. Idempotente; tolerante a fallos. */
  cargar(): void {
    const dir = this.resolverDirKb();
    if (!dir) {
      this.logger.warn(
        'No se encontró la carpeta base-conocimiento. El agente operará sin KB (define KB_PATH si hace falta).',
      );
      this.docs = [];
      this.glosarioTexto = '';
      return;
    }
    this.docs = this.cargarModulos(join(dir, 'modulos'));
    this.glosarioTexto = this.leerArchivo(join(dir, 'GLOSARIO.md')) ?? '';
    this.logger.log(
      `KB cargada desde ${dir}: ${this.docs.length} módulos, glosario ${this.glosarioTexto ? 'OK' : 'ausente'}.`,
    );
  }

  /** Texto del glosario (se inyecta siempre: es corto y transversal). */
  glosario(): string {
    return this.glosarioTexto;
  }

  /** Documentos cargados (para diagnóstico/tests). */
  modulos(): DocModuloKb[] {
    return this.docs;
  }

  /**
   * Selecciona los documentos de la KB relevantes para una pregunta.
   * @param texto  la pregunta del usuario.
   * @param ruta   ruta/pantalla actual del usuario (señal fuerte de contexto).
   * @param max    máximo de documentos a devolver (por defecto 3).
   */
  seleccionar(texto: string, ruta?: string, max = 3): SeleccionKb {
    if (this.docs.length === 0) return { modulos: [], contenido: '' };

    const q = normalizar(texto);
    const rutaNorm = ruta ? normalizar(ruta) : '';

    const puntajes = this.docs.map((doc) => ({
      doc,
      score: this.puntuar(doc, q, rutaNorm),
    }));

    // Ordena por score desc y toma los que superan 0.
    const ganadores = puntajes
      .filter((p) => p.score > 0)
      .sort((a, b) => b.score - a.score)
      .slice(0, max)
      .map((p) => p.doc);

    // Si nada coincidió pero la ruta apunta a un módulo, inclúyelo.
    if (ganadores.length === 0 && rutaNorm) {
      const porRuta = this.docs.find((d) =>
        d.rutas.some((r) => r && rutaNorm.startsWith(normalizar(r))),
      );
      if (porRuta) ganadores.push(porRuta);
    }

    // Agrega los relacionados del documento top (contexto cruzado, peso ligero).
    if (ganadores.length > 0 && ganadores.length < max) {
      const top = ganadores[0]!;
      for (const rel of top.relacionadoCon) {
        if (ganadores.length >= max) break;
        const docRel = this.docs.find((d) => d.archivo === rel);
        if (docRel && !ganadores.includes(docRel)) ganadores.push(docRel);
      }
    }

    const contenido = ganadores
      .map((d) => `# Documento KB: ${d.modulo} (${d.archivo})\n\n${d.cuerpo.trim()}`)
      .join('\n\n---\n\n');

    return { modulos: ganadores.map((d) => d.archivo), contenido };
  }

  // --- internos -------------------------------------------------------------

  /** Puntúa la relevancia de un documento para la consulta (palabras/ruta/tablas). */
  private puntuar(doc: DocModuloKb, q: string, rutaNorm: string): number {
    let score = 0;

    // Palabras clave: cada coincidencia suma; las frases largas valen más.
    for (const palabra of doc.palabrasClave) {
      const p = normalizar(palabra);
      if (!p) continue;
      if (q.includes(p)) score += p.includes(' ') ? 3 : 2;
    }

    // Nombre del módulo y archivo mencionados explícitamente.
    if (q.includes(normalizar(doc.modulo))) score += 3;

    // Tablas mencionadas (señal técnica de diagnóstico).
    for (const tabla of doc.tablas) {
      const t = normalizar(tabla);
      if (t && q.includes(t)) score += 2;
    }

    // Ruta actual: señal de contexto muy fuerte.
    if (rutaNorm) {
      for (const r of doc.rutas) {
        const rn = normalizar(r);
        if (rn && rutaNorm.startsWith(rn)) {
          score += 5;
          break;
        }
      }
    }

    return score;
  }

  /** Lee y parsea todos los `modulos/*.md`. */
  private cargarModulos(dirModulos: string): DocModuloKb[] {
    if (!existsSync(dirModulos)) return [];
    const docs: DocModuloKb[] = [];
    for (const archivo of readdirSync(dirModulos)) {
      if (!archivo.endsWith('.md')) continue;
      const texto = this.leerArchivo(join(dirModulos, archivo));
      if (!texto) continue;
      const doc = this.parsear(archivo.replace(/\.md$/, ''), texto);
      if (doc) docs.push(doc);
    }
    return docs;
  }

  /** Parsea el frontmatter YAML simple + cuerpo de un documento de módulo. */
  private parsear(archivo: string, texto: string): DocModuloKb | null {
    const m = /^---\s*\n([\s\S]*?)\n---\s*\n?([\s\S]*)$/.exec(texto);
    if (!m) {
      // Sin frontmatter: lo tratamos como cuerpo con metadatos mínimos.
      return {
        archivo,
        modulo: archivo,
        estado: 'desconocido',
        rutas: [],
        clavesPermiso: [],
        tablas: [],
        palabrasClave: [],
        relacionadoCon: [],
        cuerpo: texto,
      };
    }
    const meta = this.parsearFrontmatter(m[1]!);
    return {
      archivo,
      modulo: (meta['modulo'] as string) || archivo,
      estado: (meta['estado'] as string) || 'desconocido',
      rutas: [
        ...this.comoLista(meta['rutas']),
        ...this.comoLista(meta['rutas_v2']),
      ],
      clavesPermiso: this.comoLista(meta['claves_permiso'])
        .map((x) => Number(x))
        .filter((n) => Number.isFinite(n)),
      tablas: this.comoLista(meta['tablas']),
      palabrasClave: this.comoLista(meta['palabras_clave']),
      relacionadoCon: this.comoLista(meta['relacionado_con']),
      cuerpo: m[2] ?? '',
    };
  }

  /** Parser mínimo de frontmatter: `clave: valor` y `clave: [a, b, "c d"]`. */
  private parsearFrontmatter(bloque: string): Record<string, unknown> {
    const out: Record<string, unknown> = {};
    for (const linea of bloque.split('\n')) {
      const idx = linea.indexOf(':');
      if (idx < 0 || /^\s/.test(linea)) continue; // ignora continuaciones indentadas
      const clave = linea.slice(0, idx).trim();
      const valor = linea.slice(idx + 1).trim();
      if (!clave) continue;
      out[clave] = valor;
    }
    return out;
  }

  /** Convierte un valor de frontmatter a lista de strings (acepta `[a, b]` o escalar). */
  private comoLista(valor: unknown): string[] {
    if (valor == null) return [];
    let s = String(valor).trim();
    if (s.startsWith('[') && s.endsWith(']')) s = s.slice(1, -1);
    return s
      .split(',')
      .map((x) => x.trim().replace(/^["']|["']$/g, '').trim())
      .filter(Boolean);
  }

  private leerArchivo(ruta: string): string | null {
    try {
      return existsSync(ruta) ? readFileSync(ruta, 'utf8') : null;
    } catch (e) {
      this.logger.warn(`No se pudo leer ${ruta}: ${(e as Error).message}`);
      return null;
    }
  }

  /**
   * Resuelve la carpeta `base-conocimiento`. Orden: env KB_PATH → búsqueda hacia
   * arriba desde el cwd. En dev el cwd es `apps/api` (la encuentra subiendo a
   * `version2/base-conocimiento`); en producción es `/app` (la imagen la copia a
   * `/app/base-conocimiento`, ver apps/api/Dockerfile).
   */
  private resolverDirKb(): string | null {
    const candidatos: string[] = [];
    if (process.env.KB_PATH) candidatos.push(process.env.KB_PATH);

    let dir = process.cwd();
    for (let i = 0; i < 7; i++) {
      candidatos.push(join(dir, 'base-conocimiento'));
      const padre = dirname(dir);
      if (padre === dir) break;
      dir = padre;
    }

    for (const c of candidatos) {
      if (c && existsSync(join(c, 'INDICE.md'))) return c;
    }
    return null;
  }
}
