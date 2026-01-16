export interface CatUser {
  uid: string;
  nombre: string | null;
  apellidos: string | null;
  idEmpresa: string | null;
  email: string | null;
  idPerfil: string | null;
}

export interface CatPerfil {
  idPerfil: string;
  nombre: string;
}

export interface Empresa {
  idEmpresa: string;
  nombreEmpresa: string;
  qrDiarios: number | null;
  qrLigero: number | null;
  qrCarga: number | null;
}

export interface QrEmpresa {
  idQrEmpresas: string;
  tipoQR: string | null;
  idEmpresa: string | null;
  disponibles: number | null;
  vigente: boolean | null;
}

export interface DatosVisitante {
  idVisitante: string;
  nomVisitante: string | null;
  telefonoVisitante: string | null;
  tipoVehiculo: string | null;
  placasVehiculo: string | null;
  idEmpresa: string;
  uidr: string; // User who registered
}

export interface QrGenerado {
  idQR: string;
  claveAcceso: string;
  idVisitante: string | null;
  idQrEmpresas: string | null;
  fechaValidez: string | null; // Date string
  tipoQR: string | null;
  status: boolean;
  vigencia: boolean;
  tipoVehiculo?: string | null;
  placasVehiculo?: string | null;
  estado?: number;
  limiteUsos?: number;
  usos?: number;
}