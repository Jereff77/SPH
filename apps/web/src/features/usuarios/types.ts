export interface Usuario {
  uid: string;
  nombre: string | null;
  apellidos: string | null;
  nomCompleto: string | null;
  email: string | null;
  telefono: string | null;
  status: boolean;
  isSupport: boolean;
  esRC: boolean;
}
