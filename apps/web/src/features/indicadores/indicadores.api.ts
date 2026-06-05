import { api } from '@/lib/api';

export interface TipoCambio {
  valor: number;
  fecha: string; // dd/MM/yyyy (formato Banxico)
}

export interface UltimoInpc {
  inpc: number;
  anio: number;
  mes: number;
  id: string; // "AAAA/MM"
}

/** Indicadores del landing (tipo de cambio Banxico + último INPC). */
export const indicadoresApi = {
  getTipoCambio: () => api.get<TipoCambio>('/indicadores/tipo-cambio'),
  getInpc: () => api.get<UltimoInpc | null>('/indicadores/inpc'),
};
