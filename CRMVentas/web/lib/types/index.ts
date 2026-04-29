// ── Roles ──────────────────────────────────────────────────────
export type UserRole = 'rc' | 'gerente' | 'admin'

export interface AuthUser {
  uid: string
  email: string
  nombre: string
  role: UserRole
}

// ── Lead ───────────────────────────────────────────────────────
export interface Lead {
  id: string
  nombreLead: string
  telefono?: string
  correo?: string
  idEtapa: number
  Etapa: string
  uidRC?: string
  nomRC: string
  valor: number
  idOrigen: number
  Origen: string
  tipoCliente?: string
  tipoOperacion?: string
  tipoVenta?: string
  heatLevel?: number       // 1=frío 2=tibio 3=caliente
  idCampania?: number
  mensaje?: string
  inmobiliaria?: string
  fc: string
  fum?: string
  fechaContacto?: string
}

// ── Actividad ──────────────────────────────────────────────────
export interface ActivityDoc {
  name: string
  path: string
  url?: string  // signed URL generada server-side, expira en 1h
}

export interface ActivityHistory {
  id: string
  lead_id: string
  type?: string
  message?: string
  activity_date?: string
  heat_level?: number
  fechaAgenda?: string
  uidr?: string
  nomRC?: string
  docs?: ActivityDoc[]
}

export interface CreateActivityDto {
  lead_id: string
  type: string
  message?: string
  heat_level?: number
  fechaAgenda?: string
  uidr: string
  docs?: ActivityDoc[]
}

// ── Etapas ─────────────────────────────────────────────────────
export interface CrmEtapa {
  id: number
  titulo: string
  orden: number
  bkColor: string
  txtColor: string
  status: boolean
}

// ── Catálogos ──────────────────────────────────────────────────
export interface CrmOrigen {
  id: number
  origen: string
  status: boolean
}

export interface CrmTipoActividad {
  id: number
  titulo: string
  icono: string
  status: boolean
}

// ── Kanban ─────────────────────────────────────────────────────
export interface KanbanColumn {
  etapa: CrmEtapa
  leads: Lead[]
  totalValor: number
}

export interface KanbanFilters {
  uidRC?: string
  idOrigen?: number
  tipoOperacion?: string
}

// ── Dashboard ──────────────────────────────────────────────────
export interface DashboardStats {
  totalLeads: number
  valorPipeline: number
  tasaConversion: number
  pendientesAprobacion: number
}

export interface LeadSinActividad {
  id: string
  nombreLead: string
  diasSinActividad: number
  nomRC: string
  Etapa: string
}

// ── Calendario ─────────────────────────────────────────────────
export interface CalendarEvent {
  id: string
  title: string
  start: Date
  end: Date
  activityType: string
  leadId: string
  leadNombre: string
  rcName: string
  color: string
}

// ── Naves ──────────────────────────────────────────────────────
export type ResultadoNave = 'presentada' | 'interesado' | 'propuesta_enviada' | 'descartada'

export interface CrmLeadNave {
  id: string
  idLead: string
  idNave: string
  precio: number
  condiciones?: string
  resultado: ResultadoNave
  status: boolean
  fc: string
}

// ── Aprobación ─────────────────────────────────────────────────
export interface LeadPorAprobar {
  id: string | number
  nombre: string
  telefono?: string
  superficie?: string
  kvas?: string
  ubicacion?: string
  fc: string
  similitud?: boolean
}

// ── Historial de etapas ────────────────────────────────────────
export interface HistorialEtapa {
  id: number
  fc: string
  idLead: string
  idEtapaAnt?: number
  idEtapaNva: number
  etapaAnt?: string
  etapaNva?: string
  uidr: string
  nomRC?: string
  motivo?: string
}
