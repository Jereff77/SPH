/**
 * Declaración mínima de `pdf-parse` v2 (clase PDFParse). El paquete expone sus
 * tipos vía `exports`, pero el backend usa moduleResolution "Node" (clásico),
 * que no los resuelve; declaramos aquí lo que usamos (extracción de texto).
 */
declare module 'pdf-parse' {
  export interface PdfTextResult {
    text: string;
    total: number;
  }
  export class PDFParse {
    constructor(options: { data: Uint8Array | Buffer | ArrayBuffer });
    getText(): Promise<PdfTextResult>;
    destroy(): Promise<void>;
  }
}
