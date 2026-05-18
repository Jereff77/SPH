export interface IaSesion {
  uuid: string
  titulo: string | null
  fc: string
}

export interface GraficoData {
  tipo: 'bar' | 'pie' | 'line'
  titulo: string
  labels: string[]
  datos: number[]
  formato?: 'moneda' | 'numero' | 'porcentaje'
}

export interface ChatMessage {
  tipo: 'user' | 'ai'
  texto: string
  fc: string
  grafico?: GraficoData
}

export interface Prompt {
  parametro: string
  valor: string
  detalle: string | null
}
