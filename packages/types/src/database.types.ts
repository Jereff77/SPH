/**
 * Tipos de la base de datos Supabase (esquema de PRODUCCION).
 * AUTOGENERADO - NO EDITAR A MANO.
 *
 * Regenerar (solo lectura del esquema):
 *   supabase gen types typescript --project-id szjlkvakwljssdnysazp > src/database.types.ts
 *   (o via el MCP de Supabase: generate_typescript_types)
 *
 * Proyecto: szjlkvakwljssdnysazp  |  Generado: 2026-06-03
 */

export type Json =
  | string
  | number
  | boolean
  | null
  | { [key: string]: Json | undefined }
  | Json[]

export type Database = {
  // Allows to automatically instantiate createClient with right options
  // instead of createClient<Database, { PostgrestVersion: 'XX' }>(URL, KEY)
  __InternalSupabase: {
    PostgrestVersion: "14.5"
  }
  public: {
    Tables: {
      arre_incrementos: {
        Row: {
          anioAplicado: number
          correoNotificado: string[] | null
          desfaseMeses: number | null
          detalle: Json
          estado: string
          fc: string
          fecNotificacion: string | null
          fecReversion: string | null
          id: string
          idArrePdp: string
          idInpc: string
          inpcAplicado: number
          motivoReversion: string | null
          origen: string
          ptsAplicados: number
          revertidoPor: string | null
          uidr: string
        }
        Insert: {
          anioAplicado: number
          correoNotificado?: string[] | null
          desfaseMeses?: number | null
          detalle: Json
          estado?: string
          fc?: string
          fecNotificacion?: string | null
          fecReversion?: string | null
          id?: string
          idArrePdp: string
          idInpc: string
          inpcAplicado: number
          motivoReversion?: string | null
          origen: string
          ptsAplicados?: number
          revertidoPor?: string | null
          uidr: string
        }
        Update: {
          anioAplicado?: number
          correoNotificado?: string[] | null
          desfaseMeses?: number | null
          detalle?: Json
          estado?: string
          fc?: string
          fecNotificacion?: string | null
          fecReversion?: string | null
          id?: string
          idArrePdp?: string
          idInpc?: string
          inpcAplicado?: number
          motivoReversion?: string | null
          origen?: string
          ptsAplicados?: number
          revertidoPor?: string | null
          uidr?: string
        }
        Relationships: []
      }
      arre_ordenante: {
        Row: {
          id: string
          idArrendador: string
          ordenante: string
          primeraVez: string
          ultimaVez: string
          ultimoImporte: number | null
          veces: number
        }
        Insert: {
          id?: string
          idArrendador: string
          ordenante: string
          primeraVez?: string
          ultimaVez?: string
          ultimoImporte?: number | null
          veces?: number
        }
        Update: {
          id?: string
          idArrendador?: string
          ordenante?: string
          primeraVez?: string
          ultimaVez?: string
          ultimoImporte?: number | null
          veces?: number
        }
        Relationships: []
      }
      arre_pagos: {
        Row: {
          aplicadoEn: string
          comprobante: string | null
          desaplicadoEn: string | null
          desaplicadoPor: string | null
          estado: string
          fc: string
          fecPago: string
          id: string
          idArrePdp: string | null
          idArrePdpDet: string
          idArrendador: string | null
          idmov: string
          monto: number
          motivoDesaplicacion: string | null
          uid: string | null
          uidPago: string
        }
        Insert: {
          aplicadoEn?: string
          comprobante?: string | null
          desaplicadoEn?: string | null
          desaplicadoPor?: string | null
          estado?: string
          fc?: string
          fecPago: string
          id?: string
          idArrePdp?: string | null
          idArrePdpDet: string
          idArrendador?: string | null
          idmov: string
          monto: number
          motivoDesaplicacion?: string | null
          uid?: string | null
          uidPago: string
        }
        Update: {
          aplicadoEn?: string
          comprobante?: string | null
          desaplicadoEn?: string | null
          desaplicadoPor?: string | null
          estado?: string
          fc?: string
          fecPago?: string
          id?: string
          idArrePdp?: string | null
          idArrePdpDet?: string
          idArrendador?: string | null
          idmov?: string
          monto?: number
          motivoDesaplicacion?: string | null
          uid?: string | null
          uidPago?: string
        }
        Relationships: []
      }
      actividad: {
        Row: {
          comentario: string | null
          correo: string | null
          entorno: number | null
          fc: string
          id: number
          logeado: boolean | null
          nomwidget: string | null
          p: string | null
          pantalla: string | null
          resolucion: string | null
          uid: string | null
          version: string | null
          widget: string | null
        }
        Insert: {
          comentario?: string | null
          correo?: string | null
          entorno?: number | null
          fc?: string
          id?: number
          logeado?: boolean | null
          nomwidget?: string | null
          p?: string | null
          pantalla?: string | null
          resolucion?: string | null
          uid?: string | null
          version?: string | null
          widget?: string | null
        }
        Update: {
          comentario?: string | null
          correo?: string | null
          entorno?: number | null
          fc?: string
          id?: number
          logeado?: boolean | null
          nomwidget?: string | null
          p?: string | null
          pantalla?: string | null
          resolucion?: string | null
          uid?: string | null
          version?: string | null
          widget?: string | null
        }
        Relationships: []
      }
      activity_history: {
        Row: {
          activity_date: string | null
          created_at: string
          docs: Json | null
          fechaAgenda: string | null
          heat_level: number | null
          id: string
          lead_id: string
          message: string | null
          name: string | null
          type: string | null
          uidr: string | null
        }
        Insert: {
          activity_date?: string | null
          created_at?: string
          docs?: Json | null
          fechaAgenda?: string | null
          heat_level?: number | null
          id?: string
          lead_id: string
          message?: string | null
          name?: string | null
          type?: string | null
          uidr?: string | null
        }
        Update: {
          activity_date?: string | null
          created_at?: string
          docs?: Json | null
          fechaAgenda?: string | null
          heat_level?: number | null
          id?: string
          lead_id?: string
          message?: string | null
          name?: string | null
          type?: string | null
          uidr?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "activity_history_lead_id_fkey"
            columns: ["lead_id"]
            isOneToOne: false
            referencedRelation: "crm_Agenda"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "activity_history_lead_id_fkey"
            columns: ["lead_id"]
            isOneToOne: false
            referencedRelation: "leads"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "activity_history_lead_id_fkey"
            columns: ["lead_id"]
            isOneToOne: false
            referencedRelation: "v_leads_completo"
            referencedColumns: ["lead_id"]
          },
          {
            foreignKeyName: "activity_user_id_fkey"
            columns: ["uidr"]
            isOneToOne: false
            referencedRelation: "catUsers"
            referencedColumns: ["uid"]
          },
        ]
      }
      agenda: {
        Row: {
          created_at: string
          date: string | null
          description: string | null
          duration: number | null
          id: string | null
          lead_name: string | null
          name: string | null
          ref: string | null
          user_ref: string | null
        }
        Insert: {
          created_at?: string
          date?: string | null
          description?: string | null
          duration?: number | null
          id?: string | null
          lead_name?: string | null
          name?: string | null
          ref?: string | null
          user_ref?: string | null
        }
        Update: {
          created_at?: string
          date?: string | null
          description?: string | null
          duration?: number | null
          id?: string | null
          lead_name?: string | null
          name?: string | null
          ref?: string | null
          user_ref?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "agenda_user_ref_fkey"
            columns: ["user_ref"]
            isOneToOne: false
            referencedRelation: "catUsers"
            referencedColumns: ["uid"]
          },
        ]
      }
      arreConceptos: {
        Row: {
          concepto: string | null
          fc: string
          idArreConcepto: string
          idArrendador: string | null
          idArrePdp: string
          mInicio: number | null
          monto: number | null
          periodo: number | null
          status: boolean | null
          uid: string | null
        }
        Insert: {
          concepto?: string | null
          fc?: string
          idArreConcepto: string
          idArrendador?: string | null
          idArrePdp: string
          mInicio?: number | null
          monto?: number | null
          periodo?: number | null
          status?: boolean | null
          uid?: string | null
        }
        Update: {
          concepto?: string | null
          fc?: string
          idArreConcepto?: string
          idArrendador?: string | null
          idArrePdp?: string
          mInicio?: number | null
          monto?: number | null
          periodo?: number | null
          status?: boolean | null
          uid?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "arreConceptos_idArrePdp_fkey"
            columns: ["idArrePdp"]
            isOneToOne: false
            referencedRelation: "arre_ContratosDosMeses"
            referencedColumns: ["idArrePdp"]
          },
          {
            foreignKeyName: "arreConceptos_idArrePdp_fkey"
            columns: ["idArrePdp"]
            isOneToOne: false
            referencedRelation: "arrePdp"
            referencedColumns: ["idArrePdp"]
          },
          {
            foreignKeyName: "arreConceptos_idArrePdp_fkey"
            columns: ["idArrePdp"]
            isOneToOne: false
            referencedRelation: "v_arrecontratosproximos"
            referencedColumns: ["idArrePdp"]
          },
          {
            foreignKeyName: "arreConceptos_idArrePdp_fkey"
            columns: ["idArrePdp"]
            isOneToOne: false
            referencedRelation: "v_arreContratosUnMes"
            referencedColumns: ["idArrePdp"]
          },
          {
            foreignKeyName: "arreConceptos_idArrePdp_fkey"
            columns: ["idArrePdp"]
            isOneToOne: false
            referencedRelation: "v_ContratosTresMeses"
            referencedColumns: ["idArrePdp"]
          },
        ]
      }
      arrenPropiedades: {
        Row: {
          fc: string
          idArrendador: string
          idArrePdp: string | null
          idNavArrend: string
          idNave: string
          idParque: string
          motivoBaja: string | null
          pdpActivo: boolean
          pdpVigente: boolean | null
          status: boolean
          tienePdp: boolean
          uid: string
        }
        Insert: {
          fc?: string
          idArrendador: string
          idArrePdp?: string | null
          idNavArrend: string
          idNave: string
          idParque: string
          motivoBaja?: string | null
          pdpActivo?: boolean
          pdpVigente?: boolean | null
          status?: boolean
          tienePdp?: boolean
          uid: string
        }
        Update: {
          fc?: string
          idArrendador?: string
          idArrePdp?: string | null
          idNavArrend?: string
          idNave?: string
          idParque?: string
          motivoBaja?: string | null
          pdpActivo?: boolean
          pdpVigente?: boolean | null
          status?: boolean
          tienePdp?: boolean
          uid?: string
        }
        Relationships: [
          {
            foreignKeyName: "arrendadasNaves_idArrendatario_fkey"
            columns: ["idArrendador"]
            isOneToOne: false
            referencedRelation: "inversionista"
            referencedColumns: ["idInversionista"]
          },
          {
            foreignKeyName: "arrendadasNaves_idArrendatario_fkey"
            columns: ["idArrendador"]
            isOneToOne: false
            referencedRelation: "v_detClientes"
            referencedColumns: ["idInversionista"]
          },
          {
            foreignKeyName: "arrendadasNaves_idArrendatario_fkey"
            columns: ["idArrendador"]
            isOneToOne: false
            referencedRelation: "v_pagos"
            referencedColumns: ["idInversionista"]
          },
          {
            foreignKeyName: "arrendadasNaves_idNave_fkey"
            columns: ["idNave"]
            isOneToOne: false
            referencedRelation: "naves"
            referencedColumns: ["idNave"]
          },
          {
            foreignKeyName: "arrendadasNaves_idNave_fkey"
            columns: ["idNave"]
            isOneToOne: false
            referencedRelation: "v_disponibilidad"
            referencedColumns: ["idNave"]
          },
          {
            foreignKeyName: "arrendadasNaves_idNave_fkey"
            columns: ["idNave"]
            isOneToOne: false
            referencedRelation: "v_naves"
            referencedColumns: ["idNave"]
          },
          {
            foreignKeyName: "arrendadasNaves_idParque_fkey"
            columns: ["idParque"]
            isOneToOne: false
            referencedRelation: "parques"
            referencedColumns: ["idParque"]
          },
          {
            foreignKeyName: "arrendadasNaves_idParque_fkey"
            columns: ["idParque"]
            isOneToOne: false
            referencedRelation: "v_pdpdetalle"
            referencedColumns: ["idParque"]
          },
          {
            foreignKeyName: "arrendadasNaves_idParque_fkey"
            columns: ["idParque"]
            isOneToOne: false
            referencedRelation: "v_pdpdetalle2"
            referencedColumns: ["idParque"]
          },
        ]
      }
      arrePdp: {
        Row: {
          arrePdpVigente: Database["public"]["Enums"]["arrePdpVigente"]
          canceladoAnticipado: boolean
          canceladoPor: string | null
          construccionM2: number | null
          deposito: number | null
          fc: string
          fecCancelacion: string | null
          fecFin: string | null
          fecInicio: string | null
          idArrendador: string
          idArrePdp: string
          idNavArrend: string
          INPC: number
          INPCPlus: number
          mesGracia: Json
          Moneda: string
          motivoCancelacion: string | null
          plazo: number | null
          pm2Admin: number
          pm2Mtto: number
          pm2Vig: number
          precioM2: number | null
          rtaBase: number | null
          status: boolean | null
          uid: string | null
          vigente: boolean | null
        }
        Insert: {
          arrePdpVigente?: Database["public"]["Enums"]["arrePdpVigente"]
          canceladoAnticipado?: boolean
          canceladoPor?: string | null
          construccionM2?: number | null
          deposito?: number | null
          fc?: string
          fecCancelacion?: string | null
          fecFin?: string | null
          fecInicio?: string | null
          idArrendador: string
          idArrePdp: string
          idNavArrend: string
          INPC?: number
          INPCPlus?: number
          mesGracia?: Json
          Moneda?: string
          motivoCancelacion?: string | null
          plazo?: number | null
          pm2Admin?: number
          pm2Mtto?: number
          pm2Vig?: number
          precioM2?: number | null
          rtaBase?: number | null
          status?: boolean | null
          uid?: string | null
          vigente?: boolean | null
        }
        Update: {
          arrePdpVigente?: Database["public"]["Enums"]["arrePdpVigente"]
          canceladoAnticipado?: boolean
          canceladoPor?: string | null
          construccionM2?: number | null
          deposito?: number | null
          fc?: string
          fecCancelacion?: string | null
          fecFin?: string | null
          fecInicio?: string | null
          idArrendador?: string
          idArrePdp?: string
          idNavArrend?: string
          INPC?: number
          INPCPlus?: number
          mesGracia?: Json
          Moneda?: string
          motivoCancelacion?: string | null
          plazo?: number | null
          pm2Admin?: number
          pm2Mtto?: number
          pm2Vig?: number
          precioM2?: number | null
          rtaBase?: number | null
          status?: boolean | null
          uid?: string | null
          vigente?: boolean | null
        }
        Relationships: [
          {
            foreignKeyName: "arrePdp_idArrendador_fkey"
            columns: ["idArrendador"]
            isOneToOne: false
            referencedRelation: "inversionista"
            referencedColumns: ["idInversionista"]
          },
          {
            foreignKeyName: "arrePdp_idArrendador_fkey"
            columns: ["idArrendador"]
            isOneToOne: false
            referencedRelation: "v_detClientes"
            referencedColumns: ["idInversionista"]
          },
          {
            foreignKeyName: "arrePdp_idArrendador_fkey"
            columns: ["idArrendador"]
            isOneToOne: false
            referencedRelation: "v_pagos"
            referencedColumns: ["idInversionista"]
          },
          {
            foreignKeyName: "arrePdp_idNavArrend_fkey"
            columns: ["idNavArrend"]
            isOneToOne: false
            referencedRelation: "arrenPropiedades"
            referencedColumns: ["idNavArrend"]
          },
          {
            foreignKeyName: "arrePdp_idNavArrend_fkey"
            columns: ["idNavArrend"]
            isOneToOne: false
            referencedRelation: "v_arreNavConPdp"
            referencedColumns: ["idNavArrend"]
          },
          {
            foreignKeyName: "arrePdp_idNavArrend_fkey"
            columns: ["idNavArrend"]
            isOneToOne: false
            referencedRelation: "v_arrendadasNaves"
            referencedColumns: ["idNavArrend"]
          },
          {
            foreignKeyName: "arrePdp_uid_fkey"
            columns: ["uid"]
            isOneToOne: false
            referencedRelation: "catUsers"
            referencedColumns: ["uid"]
          },
        ]
      }
      arrePdp_duplicate: {
        Row: {
          arrePdpVigente: Database["public"]["Enums"]["arrePdpVigente"]
          construccionM2: number | null
          deposito: number | null
          fc: string
          fecFin: string | null
          fecInicio: string | null
          idArrendador: string
          idArrePdp: string
          idNavArrend: string
          INPC: number
          INPCPlus: number
          mesGracia: Json
          Moneda: string
          plazo: number | null
          pm2Admin: number
          pm2Mtto: number
          pm2Vig: number
          precioM2: number | null
          rtaBase: number | null
          status: boolean | null
          uid: string | null
          vigente: boolean | null
        }
        Insert: {
          arrePdpVigente?: Database["public"]["Enums"]["arrePdpVigente"]
          construccionM2?: number | null
          deposito?: number | null
          fc?: string
          fecFin?: string | null
          fecInicio?: string | null
          idArrendador: string
          idArrePdp: string
          idNavArrend: string
          INPC?: number
          INPCPlus?: number
          mesGracia?: Json
          Moneda?: string
          plazo?: number | null
          pm2Admin?: number
          pm2Mtto?: number
          pm2Vig?: number
          precioM2?: number | null
          rtaBase?: number | null
          status?: boolean | null
          uid?: string | null
          vigente?: boolean | null
        }
        Update: {
          arrePdpVigente?: Database["public"]["Enums"]["arrePdpVigente"]
          construccionM2?: number | null
          deposito?: number | null
          fc?: string
          fecFin?: string | null
          fecInicio?: string | null
          idArrendador?: string
          idArrePdp?: string
          idNavArrend?: string
          INPC?: number
          INPCPlus?: number
          mesGracia?: Json
          Moneda?: string
          plazo?: number | null
          pm2Admin?: number
          pm2Mtto?: number
          pm2Vig?: number
          precioM2?: number | null
          rtaBase?: number | null
          status?: boolean | null
          uid?: string | null
          vigente?: boolean | null
        }
        Relationships: [
          {
            foreignKeyName: "arrePdp_duplicate_idArrendador_fkey"
            columns: ["idArrendador"]
            isOneToOne: false
            referencedRelation: "inversionista"
            referencedColumns: ["idInversionista"]
          },
          {
            foreignKeyName: "arrePdp_duplicate_idArrendador_fkey"
            columns: ["idArrendador"]
            isOneToOne: false
            referencedRelation: "v_detClientes"
            referencedColumns: ["idInversionista"]
          },
          {
            foreignKeyName: "arrePdp_duplicate_idArrendador_fkey"
            columns: ["idArrendador"]
            isOneToOne: false
            referencedRelation: "v_pagos"
            referencedColumns: ["idInversionista"]
          },
          {
            foreignKeyName: "arrePdp_duplicate_idNavArrend_fkey"
            columns: ["idNavArrend"]
            isOneToOne: false
            referencedRelation: "arrenPropiedades"
            referencedColumns: ["idNavArrend"]
          },
          {
            foreignKeyName: "arrePdp_duplicate_idNavArrend_fkey"
            columns: ["idNavArrend"]
            isOneToOne: false
            referencedRelation: "v_arreNavConPdp"
            referencedColumns: ["idNavArrend"]
          },
          {
            foreignKeyName: "arrePdp_duplicate_idNavArrend_fkey"
            columns: ["idNavArrend"]
            isOneToOne: false
            referencedRelation: "v_arrendadasNaves"
            referencedColumns: ["idNavArrend"]
          },
          {
            foreignKeyName: "arrePdp_duplicate_uid_fkey"
            columns: ["uid"]
            isOneToOne: false
            referencedRelation: "catUsers"
            referencedColumns: ["uid"]
          },
        ]
      }
      arrePdpDetalle: {
        Row: {
          anio: number
          aplicaInpc: boolean
          cantidad: number | null
          cantidad2: number | null
          cantidadAplicada: number | null
          ciclo: number | null
          comprobantePago: string | null
          comSPH: number | null
          concepto: string | null
          constM2: number
          fc: string
          fecha: string | null
          fecPago: string | null
          idArrePdp: string
          idArrePdpDet: string
          idRtaA: string | null
          inc_x_inpc: number
          INPC: number
          inpcTotal: number | null
          iva: number
          moneda: string
          montoDividido: boolean
          numPartida: number | null
          pm2: number
          ptsINPC: number
          status: boolean
          tieneMesGratis: Database["public"]["Enums"]["mesGratis"] | null
          tipoOperacion: number
          uidc: string
          uidPago: string | null
          UltimoPago: boolean
        }
        Insert: {
          anio?: number
          aplicaInpc?: boolean
          cantidad?: number | null
          cantidad2?: number | null
          cantidadAplicada?: number | null
          ciclo?: number | null
          comprobantePago?: string | null
          comSPH?: number | null
          concepto?: string | null
          constM2?: number
          fc?: string
          fecha?: string | null
          fecPago?: string | null
          idArrePdp: string
          idArrePdpDet: string
          idRtaA?: string | null
          inc_x_inpc?: number
          INPC?: number
          inpcTotal?: number | null
          iva?: number
          moneda?: string
          montoDividido?: boolean
          numPartida?: number | null
          pm2?: number
          ptsINPC?: number
          status?: boolean
          tieneMesGratis?: Database["public"]["Enums"]["mesGratis"] | null
          tipoOperacion: number
          uidc: string
          uidPago?: string | null
          UltimoPago?: boolean
        }
        Update: {
          anio?: number
          aplicaInpc?: boolean
          cantidad?: number | null
          cantidad2?: number | null
          cantidadAplicada?: number | null
          ciclo?: number | null
          comprobantePago?: string | null
          comSPH?: number | null
          concepto?: string | null
          constM2?: number
          fc?: string
          fecha?: string | null
          fecPago?: string | null
          idArrePdp?: string
          idArrePdpDet?: string
          idRtaA?: string | null
          inc_x_inpc?: number
          INPC?: number
          inpcTotal?: number | null
          iva?: number
          moneda?: string
          montoDividido?: boolean
          numPartida?: number | null
          pm2?: number
          ptsINPC?: number
          status?: boolean
          tieneMesGratis?: Database["public"]["Enums"]["mesGratis"] | null
          tipoOperacion?: number
          uidc?: string
          uidPago?: string | null
          UltimoPago?: boolean
        }
        Relationships: [
          {
            foreignKeyName: "arrepdpdetalle_idarrepdp_fkey"
            columns: ["idArrePdp"]
            isOneToOne: false
            referencedRelation: "arre_ContratosDosMeses"
            referencedColumns: ["idArrePdp"]
          },
          {
            foreignKeyName: "arrepdpdetalle_idarrepdp_fkey"
            columns: ["idArrePdp"]
            isOneToOne: false
            referencedRelation: "arrePdp"
            referencedColumns: ["idArrePdp"]
          },
          {
            foreignKeyName: "arrepdpdetalle_idarrepdp_fkey"
            columns: ["idArrePdp"]
            isOneToOne: false
            referencedRelation: "v_arrecontratosproximos"
            referencedColumns: ["idArrePdp"]
          },
          {
            foreignKeyName: "arrepdpdetalle_idarrepdp_fkey"
            columns: ["idArrePdp"]
            isOneToOne: false
            referencedRelation: "v_arreContratosUnMes"
            referencedColumns: ["idArrePdp"]
          },
          {
            foreignKeyName: "arrepdpdetalle_idarrepdp_fkey"
            columns: ["idArrePdp"]
            isOneToOne: false
            referencedRelation: "v_ContratosTresMeses"
            referencedColumns: ["idArrePdp"]
          },
          {
            foreignKeyName: "arrepdpdetalle_tipooperacion_fkey"
            columns: ["tipoOperacion"]
            isOneToOne: false
            referencedRelation: "catTipoOperacion"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "arrepdpdetalle_uidc_fkey"
            columns: ["uidc"]
            isOneToOne: false
            referencedRelation: "catUsers"
            referencedColumns: ["uid"]
          },
        ]
      }
      auditoria: {
        Row: {
          accion: string
          cambios: Json | null
          comentario: string | null
          entidad: string
          fc: string
          id: number
          id_entidad: string | null
          origen: number
          registro_anterior: Json | null
          registro_nuevo: Json | null
          uid: string | null
        }
        Insert: {
          accion: string
          cambios?: Json | null
          comentario?: string | null
          entidad: string
          fc?: string
          id?: never
          id_entidad?: string | null
          origen?: number
          registro_anterior?: Json | null
          registro_nuevo?: Json | null
          uid?: string | null
        }
        Update: {
          accion?: string
          cambios?: Json | null
          comentario?: string | null
          entidad?: string
          fc?: string
          id?: never
          id_entidad?: string | null
          origen?: number
          registro_anterior?: Json | null
          registro_nuevo?: Json | null
          uid?: string | null
        }
        Relationships: []
      }
      autorizaciones: {
        Row: {
          autorizacion: string | null
          fAutorizacion: string | null
          fc: string
          idAutorizaciones: number
          idReferencia: string | null
          justificacion: string | null
          nivelAutorizacion: number | null
          pantalla: string | null
          status: boolean | null
          statusAutorizacion: number | null
          uidAutorizo: string | null
          uidSolicito: string | null
        }
        Insert: {
          autorizacion?: string | null
          fAutorizacion?: string | null
          fc?: string
          idAutorizaciones?: number
          idReferencia?: string | null
          justificacion?: string | null
          nivelAutorizacion?: number | null
          pantalla?: string | null
          status?: boolean | null
          statusAutorizacion?: number | null
          uidAutorizo?: string | null
          uidSolicito?: string | null
        }
        Update: {
          autorizacion?: string | null
          fAutorizacion?: string | null
          fc?: string
          idAutorizaciones?: number
          idReferencia?: string | null
          justificacion?: string | null
          nivelAutorizacion?: number | null
          pantalla?: string | null
          status?: boolean | null
          statusAutorizacion?: number | null
          uidAutorizo?: string | null
          uidSolicito?: string | null
        }
        Relationships: []
      }
      catAsesoresInm: {
        Row: {
          a: string
          correo: string | null
          fc: string
          id: string
          idInmobiliaria: string | null
          nombre: string
          status: boolean
          telefono: string
          uidr: string | null
        }
        Insert: {
          a: string
          correo?: string | null
          fc?: string
          id?: string
          idInmobiliaria?: string | null
          nombre: string
          status?: boolean
          telefono: string
          uidr?: string | null
        }
        Update: {
          a?: string
          correo?: string | null
          fc?: string
          id?: string
          idInmobiliaria?: string | null
          nombre?: string
          status?: boolean
          telefono?: string
          uidr?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "catAsesoresInm_idInmobiliaria_fkey"
            columns: ["idInmobiliaria"]
            isOneToOne: false
            referencedRelation: "catInmobiliarias"
            referencedColumns: ["idInmobiliaria"]
          },
          {
            foreignKeyName: "catAsesoresInm_uidr_fkey"
            columns: ["uidr"]
            isOneToOne: false
            referencedRelation: "catUsers"
            referencedColumns: ["uid"]
          },
        ]
      }
      catBancos: {
        Row: {
          codigo: string
          created_at: string | null
          id: number
          nombre: string
          tipo: string | null
        }
        Insert: {
          codigo: string
          created_at?: string | null
          id?: number
          nombre: string
          tipo?: string | null
        }
        Update: {
          codigo?: string
          created_at?: string | null
          id?: number
          nombre?: string
          tipo?: string | null
        }
        Relationships: []
      }
      catCategorias_duplicate: {
        Row: {
          clasificacion: string | null
          fc: string
          idCategoria: number
          nombre: string
          status: boolean
        }
        Insert: {
          clasificacion?: string | null
          fc?: string
          idCategoria?: number
          nombre: string
          status?: boolean
        }
        Update: {
          clasificacion?: string | null
          fc?: string
          idCategoria?: number
          nombre?: string
          status?: boolean
        }
        Relationships: []
      }
      catClavesProdServ: {
        Row: {
          claveProdServ: string
          descripcion: string | null
          fc: string
          idClave: string
          retieneISR: boolean
          retieneIVA: boolean
          status: boolean
          uidr: string | null
        }
        Insert: {
          claveProdServ: string
          descripcion?: string | null
          fc?: string
          idClave?: string
          retieneISR?: boolean
          retieneIVA?: boolean
          status?: boolean
          uidr?: string | null
        }
        Update: {
          claveProdServ?: string
          descripcion?: string | null
          fc?: string
          idClave?: string
          retieneISR?: boolean
          retieneIVA?: boolean
          status?: boolean
          uidr?: string | null
        }
        Relationships: []
      }
      catEmpresas: {
        Row: {
          correo: string | null
          fc: string
          giro: string | null
          idEmpresa: string
          idInversionista: string | null
          personalidad: number
          razonSocial: string
          regimen: number
          rfc: string
          status: boolean
          uidc: string | null
          usoCFDI: string
          web: string | null
        }
        Insert: {
          correo?: string | null
          fc?: string
          giro?: string | null
          idEmpresa: string
          idInversionista?: string | null
          personalidad?: number
          razonSocial: string
          regimen: number
          rfc: string
          status?: boolean
          uidc?: string | null
          usoCFDI: string
          web?: string | null
        }
        Update: {
          correo?: string | null
          fc?: string
          giro?: string | null
          idEmpresa?: string
          idInversionista?: string | null
          personalidad?: number
          razonSocial?: string
          regimen?: number
          rfc?: string
          status?: boolean
          uidc?: string | null
          usoCFDI?: string
          web?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "catEmpresas_regimen_fkey"
            columns: ["regimen"]
            isOneToOne: false
            referencedRelation: "catRegimenFiscal"
            referencedColumns: ["clave"]
          },
          {
            foreignKeyName: "catEmpresas_usoCFDI_fkey"
            columns: ["usoCFDI"]
            isOneToOne: false
            referencedRelation: "catUsoCFDI"
            referencedColumns: ["clave"]
          },
        ]
      }
      catEstadosRG: {
        Row: {
          descripcion: string
          id: number
        }
        Insert: {
          descripcion: string
          id?: number
        }
        Update: {
          descripcion?: string
          id?: number
        }
        Relationships: []
      }
      catFacturas: {
        Row: {
          anio: number | null
          anioCFDI: number
          aplicada: boolean
          concepto: string
          descripcion: string | null
          fc: string
          fecCFDI: string | null
          folioCFDI: string | null
          fum: string | null
          idFactura: string
          idInversionista: string | null
          idRAdet: string | null
          idRGdet: string | null
          manual: boolean
          mesFactura: number
          moneda: string | null
          noCertificadoSAT: string | null
          nombreEmisor: string | null
          nomDescriptivo: string | null
          regimenFiscal: number | null
          rfcEmisor: string | null
          selloSAT: string | null
          status: boolean
          subtotalCFDI: number | null
          totalCFDI: number | null
          uidr: string | null
          uuidCFDI: string
        }
        Insert: {
          anio?: number | null
          anioCFDI: number
          aplicada?: boolean
          concepto?: string
          descripcion?: string | null
          fc?: string
          fecCFDI?: string | null
          folioCFDI?: string | null
          fum?: string | null
          idFactura: string
          idInversionista?: string | null
          idRAdet?: string | null
          idRGdet?: string | null
          manual?: boolean
          mesFactura: number
          moneda?: string | null
          noCertificadoSAT?: string | null
          nombreEmisor?: string | null
          nomDescriptivo?: string | null
          regimenFiscal?: number | null
          rfcEmisor?: string | null
          selloSAT?: string | null
          status?: boolean
          subtotalCFDI?: number | null
          totalCFDI?: number | null
          uidr?: string | null
          uuidCFDI?: string
        }
        Update: {
          anio?: number | null
          anioCFDI?: number
          aplicada?: boolean
          concepto?: string
          descripcion?: string | null
          fc?: string
          fecCFDI?: string | null
          folioCFDI?: string | null
          fum?: string | null
          idFactura?: string
          idInversionista?: string | null
          idRAdet?: string | null
          idRGdet?: string | null
          manual?: boolean
          mesFactura?: number
          moneda?: string | null
          noCertificadoSAT?: string | null
          nombreEmisor?: string | null
          nomDescriptivo?: string | null
          regimenFiscal?: number | null
          rfcEmisor?: string | null
          selloSAT?: string | null
          status?: boolean
          subtotalCFDI?: number | null
          totalCFDI?: number | null
          uidr?: string | null
          uuidCFDI?: string
        }
        Relationships: []
      }
      catFacturas_05112025: {
        Row: {
          anio: number | null
          anioCFDI: number
          aplicada: boolean
          concepto: string
          descripcion: string | null
          fc: string
          fecCFDI: string | null
          folioCFDI: string | null
          fum: string | null
          idFactura: string
          idInversionista: string | null
          idRAdet: string | null
          idRGdet: string | null
          manual: boolean
          mesFactura: number
          moneda: string | null
          noCertificadoSAT: string | null
          nombreEmisor: string | null
          nomDescriptivo: string | null
          regimenFiscal: number | null
          rfcEmisor: string | null
          selloSAT: string | null
          status: boolean
          subtotalCFDI: number | null
          totalCFDI: number | null
          uidr: string | null
          uuidCFDI: string
        }
        Insert: {
          anio?: number | null
          anioCFDI: number
          aplicada?: boolean
          concepto?: string
          descripcion?: string | null
          fc?: string
          fecCFDI?: string | null
          folioCFDI?: string | null
          fum?: string | null
          idFactura: string
          idInversionista?: string | null
          idRAdet?: string | null
          idRGdet?: string | null
          manual?: boolean
          mesFactura: number
          moneda?: string | null
          noCertificadoSAT?: string | null
          nombreEmisor?: string | null
          nomDescriptivo?: string | null
          regimenFiscal?: number | null
          rfcEmisor?: string | null
          selloSAT?: string | null
          status?: boolean
          subtotalCFDI?: number | null
          totalCFDI?: number | null
          uidr?: string | null
          uuidCFDI?: string
        }
        Update: {
          anio?: number | null
          anioCFDI?: number
          aplicada?: boolean
          concepto?: string
          descripcion?: string | null
          fc?: string
          fecCFDI?: string | null
          folioCFDI?: string | null
          fum?: string | null
          idFactura?: string
          idInversionista?: string | null
          idRAdet?: string | null
          idRGdet?: string | null
          manual?: boolean
          mesFactura?: number
          moneda?: string | null
          noCertificadoSAT?: string | null
          nombreEmisor?: string | null
          nomDescriptivo?: string | null
          regimenFiscal?: number | null
          rfcEmisor?: string | null
          selloSAT?: string | null
          status?: boolean
          subtotalCFDI?: number | null
          totalCFDI?: number | null
          uidr?: string | null
          uuidCFDI?: string
        }
        Relationships: []
      }
      catFacturas_NoCargadas: {
        Row: {
          anio: number | null
          anioCFDI: number
          aplicada: boolean
          descripcion: string | null
          error: string | null
          fc: string
          fecCFDI: string | null
          folioCFDI: string | null
          fum: string | null
          idFactura: number
          idInversionista: string | null
          idRAdet: string | null
          idRGdet: string | null
          mesFactura: number
          moneda: string | null
          noCertificadoSAT: string | null
          nombreEmisor: string | null
          nomDescriptivo: string | null
          regimenFiscal: number | null
          rfcEmisor: string | null
          selloSAT: string | null
          status: boolean
          subtotalCFDI: number | null
          totalCFDI: number | null
          uidr: string | null
          uuidCFDI: string
        }
        Insert: {
          anio?: number | null
          anioCFDI: number
          aplicada?: boolean
          descripcion?: string | null
          error?: string | null
          fc?: string
          fecCFDI?: string | null
          folioCFDI?: string | null
          fum?: string | null
          idFactura?: number
          idInversionista?: string | null
          idRAdet?: string | null
          idRGdet?: string | null
          mesFactura: number
          moneda?: string | null
          noCertificadoSAT?: string | null
          nombreEmisor?: string | null
          nomDescriptivo?: string | null
          regimenFiscal?: number | null
          rfcEmisor?: string | null
          selloSAT?: string | null
          status?: boolean
          subtotalCFDI?: number | null
          totalCFDI?: number | null
          uidr?: string | null
          uuidCFDI?: string
        }
        Update: {
          anio?: number | null
          anioCFDI?: number
          aplicada?: boolean
          descripcion?: string | null
          error?: string | null
          fc?: string
          fecCFDI?: string | null
          folioCFDI?: string | null
          fum?: string | null
          idFactura?: number
          idInversionista?: string | null
          idRAdet?: string | null
          idRGdet?: string | null
          mesFactura?: number
          moneda?: string | null
          noCertificadoSAT?: string | null
          nombreEmisor?: string | null
          nomDescriptivo?: string | null
          regimenFiscal?: number | null
          rfcEmisor?: string | null
          selloSAT?: string | null
          status?: boolean
          subtotalCFDI?: number | null
          totalCFDI?: number | null
          uidr?: string | null
          uuidCFDI?: string
        }
        Relationships: []
      }
      catFacturasDocs: {
        Row: {
          aplicado: boolean
          fc: string
          idFacturasDocs: string
          status: boolean
          urlPDF: string | null
          urlXML: string | null
        }
        Insert: {
          aplicado?: boolean
          fc?: string
          idFacturasDocs: string
          status?: boolean
          urlPDF?: string | null
          urlXML?: string | null
        }
        Update: {
          aplicado?: boolean
          fc?: string
          idFacturasDocs?: string
          status?: boolean
          urlPDF?: string | null
          urlXML?: string | null
        }
        Relationships: []
      }
      catGirosComerciales: {
        Row: {
          descripcion: string | null
          id: number
        }
        Insert: {
          descripcion?: string | null
          id?: number
        }
        Update: {
          descripcion?: string | null
          id?: number
        }
        Relationships: []
      }
      catInmobiliarias: {
        Row: {
          correo: string | null
          correoRepresentante: string | null
          descripcion: string | null
          fc: string
          idInmobiliaria: string
          nombre: string | null
          nombreRepresentante: string | null
          paginaWeb: string | null
          puestoRepresentante: string | null
          status: boolean
          telefono: string | null
          telRepresentante: string | null
          uidr: string | null
          uidRC: string | null
        }
        Insert: {
          correo?: string | null
          correoRepresentante?: string | null
          descripcion?: string | null
          fc?: string
          idInmobiliaria?: string
          nombre?: string | null
          nombreRepresentante?: string | null
          paginaWeb?: string | null
          puestoRepresentante?: string | null
          status?: boolean
          telefono?: string | null
          telRepresentante?: string | null
          uidr?: string | null
          uidRC?: string | null
        }
        Update: {
          correo?: string | null
          correoRepresentante?: string | null
          descripcion?: string | null
          fc?: string
          idInmobiliaria?: string
          nombre?: string | null
          nombreRepresentante?: string | null
          paginaWeb?: string | null
          puestoRepresentante?: string | null
          status?: boolean
          telefono?: string | null
          telRepresentante?: string | null
          uidr?: string | null
          uidRC?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "catInmobiliarias_uidr_fkey"
            columns: ["uidr"]
            isOneToOne: false
            referencedRelation: "catUsers"
            referencedColumns: ["uid"]
          },
          {
            foreignKeyName: "catInmobiliarias_uidRC_fkey"
            columns: ["uidRC"]
            isOneToOne: false
            referencedRelation: "catUsers"
            referencedColumns: ["uid"]
          },
        ]
      }
      catParametros: {
        Row: {
          concepto: string | null
          fc: string
          fechaFin: string | null
          fechaIni: string
          id: number
          idCorto: string
          status: boolean
          uidr: string | null
          valor: number | null
        }
        Insert: {
          concepto?: string | null
          fc?: string
          fechaFin?: string | null
          fechaIni: string
          id?: number
          idCorto: string
          status?: boolean
          uidr?: string | null
          valor?: number | null
        }
        Update: {
          concepto?: string | null
          fc?: string
          fechaFin?: string | null
          fechaIni?: string
          id?: number
          idCorto?: string
          status?: boolean
          uidr?: string | null
          valor?: number | null
        }
        Relationships: []
      }
      catProveedores: {
        Row: {
          apellidos: string | null
          claveRegimen: number | null
          email: string | null
          fc: string
          idProveedor: string
          noCuenta: string | null
          nombre: string | null
          nombreBanco: string
          numIdentificacion: string | null
          personalidad: string | null
          razonSocial: string
          rfc: string
          status: boolean
          telefono: string | null
          tipoCuenta: string
          tipoIdentificacion: number | null
        }
        Insert: {
          apellidos?: string | null
          claveRegimen?: number | null
          email?: string | null
          fc?: string
          idProveedor: string
          noCuenta?: string | null
          nombre?: string | null
          nombreBanco: string
          numIdentificacion?: string | null
          personalidad?: string | null
          razonSocial: string
          rfc: string
          status?: boolean
          telefono?: string | null
          tipoCuenta: string
          tipoIdentificacion?: number | null
        }
        Update: {
          apellidos?: string | null
          claveRegimen?: number | null
          email?: string | null
          fc?: string
          idProveedor?: string
          noCuenta?: string | null
          nombre?: string | null
          nombreBanco?: string
          numIdentificacion?: string | null
          personalidad?: string | null
          razonSocial?: string
          rfc?: string
          status?: boolean
          telefono?: string | null
          tipoCuenta?: string
          tipoIdentificacion?: number | null
        }
        Relationships: [
          {
            foreignKeyName: "catproveedores_claveregimen_fkey"
            columns: ["claveRegimen"]
            isOneToOne: false
            referencedRelation: "catRegimenFiscal"
            referencedColumns: ["clave"]
          },
          {
            foreignKeyName: "catProveedores_claveRegimen_fkey"
            columns: ["claveRegimen"]
            isOneToOne: false
            referencedRelation: "catRegimenFiscal"
            referencedColumns: ["clave"]
          },
        ]
      }
      catProveedores_docs: {
        Row: {
          descripcion: string | null
          fc: string | null
          idDocumento: string
          idProveedor: string | null
          idUser: string | null
          status: boolean | null
          titulo: string | null
          urldoc: string | null
        }
        Insert: {
          descripcion?: string | null
          fc?: string | null
          idDocumento: string
          idProveedor?: string | null
          idUser?: string | null
          status?: boolean | null
          titulo?: string | null
          urldoc?: string | null
        }
        Update: {
          descripcion?: string | null
          fc?: string | null
          idDocumento?: string
          idProveedor?: string | null
          idUser?: string | null
          status?: boolean | null
          titulo?: string | null
          urldoc?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "catproveedores_docs_idproveedor_fkey"
            columns: ["idProveedor"]
            isOneToOne: false
            referencedRelation: "catProveedores"
            referencedColumns: ["idProveedor"]
          },
        ]
      }
      catRegimenFiscal: {
        Row: {
          clave: number
          descripcion: string | null
          personalidad: string | null
        }
        Insert: {
          clave?: number
          descripcion?: string | null
          personalidad?: string | null
        }
        Update: {
          clave?: number
          descripcion?: string | null
          personalidad?: string | null
        }
        Relationships: []
      }
      catReportes: {
        Row: {
          fc: string
          id: number
          parametros: Json
          status: boolean | null
          titulo: string
        }
        Insert: {
          fc?: string
          id?: number
          parametros: Json
          status?: boolean | null
          titulo: string
        }
        Update: {
          fc?: string
          id?: number
          parametros?: Json
          status?: boolean | null
          titulo?: string
        }
        Relationships: []
      }
      catTipoMovimientos: {
        Row: {
          descripcion: string | null
          id: number
        }
        Insert: {
          descripcion?: string | null
          id?: number
        }
        Update: {
          descripcion?: string | null
          id?: number
        }
        Relationships: []
      }
      catTipoOperacion: {
        Row: {
          concepto: string | null
          id: number
        }
        Insert: {
          concepto?: string | null
          id?: number
        }
        Update: {
          concepto?: string | null
          id?: number
        }
        Relationships: []
      }
      catUsers: {
        Row: {
          apellidos: string | null
          email: string | null
          fc: string
          fechaBanneo: string | null
          idPerfil: number
          img: string | null
          infoBanneo: Json | null
          isSupport: boolean
          nombre: string | null
          nomCompleto: string | null
          prueba: string | null
          rol: string | null
          status: boolean
          telefono: string | null
          uid: string
          uidSupervisor: string | null
        }
        Insert: {
          apellidos?: string | null
          email?: string | null
          fc?: string
          fechaBanneo?: string | null
          idPerfil: number
          img?: string | null
          infoBanneo?: Json | null
          isSupport?: boolean
          nombre?: string | null
          nomCompleto?: string | null
          prueba?: string | null
          rol?: string | null
          status?: boolean
          telefono?: string | null
          uid?: string
          uidSupervisor?: string | null
        }
        Update: {
          apellidos?: string | null
          email?: string | null
          fc?: string
          fechaBanneo?: string | null
          idPerfil?: number
          img?: string | null
          infoBanneo?: Json | null
          isSupport?: boolean
          nombre?: string | null
          nomCompleto?: string | null
          prueba?: string | null
          rol?: string | null
          status?: boolean
          telefono?: string | null
          uid?: string
          uidSupervisor?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "users_idPerfil_fkey"
            columns: ["idPerfil"]
            isOneToOne: false
            referencedRelation: "perfil"
            referencedColumns: ["nivel"]
          },
        ]
      }
      catUsoCFDI: {
        Row: {
          clave: string
          descripcion: string | null
          fisica: boolean | null
          moral: boolean | null
        }
        Insert: {
          clave: string
          descripcion?: string | null
          fisica?: boolean | null
          moral?: boolean | null
        }
        Update: {
          clave?: string
          descripcion?: string | null
          fisica?: boolean | null
          moral?: boolean | null
        }
        Relationships: []
      }
      clasificaciones: {
        Row: {
          descripcion: string | null
          fc: string
          idClasificacion: number
          nombre: string
          status: boolean
        }
        Insert: {
          descripcion?: string | null
          fc?: string
          idClasificacion?: number
          nombre: string
          status?: boolean
        }
        Update: {
          descripcion?: string | null
          fc?: string
          idClasificacion?: number
          nombre?: string
          status?: boolean
        }
        Relationships: []
      }
      comentarios: {
        Row: {
          comentario: string | null
          fc: string
          idComents: number
          idPago: string | null
          idPdpDet: string | null
          origen: string
          status: boolean | null
          uid: string | null
        }
        Insert: {
          comentario?: string | null
          fc?: string
          idComents?: number
          idPago?: string | null
          idPdpDet?: string | null
          origen?: string
          status?: boolean | null
          uid?: string | null
        }
        Update: {
          comentario?: string | null
          fc?: string
          idComents?: number
          idPago?: string | null
          idPdpDet?: string | null
          origen?: string
          status?: boolean | null
          uid?: string | null
        }
        Relationships: []
      }
      comprobantesPago: {
        Row: {
          descripcion: string | null
          fecha_subida: string
          idComprobante: string
          idCxp: string
          nombredoc: string | null
          tipo: number | null
          urldoc: string
        }
        Insert: {
          descripcion?: string | null
          fecha_subida?: string
          idComprobante: string
          idCxp: string
          nombredoc?: string | null
          tipo?: number | null
          urldoc: string
        }
        Update: {
          descripcion?: string | null
          fecha_subida?: string
          idComprobante?: string
          idCxp?: string
          nombredoc?: string | null
          tipo?: number | null
          urldoc?: string
        }
        Relationships: [
          {
            foreignKeyName: "comprobantesPago_idCxp_fkey"
            columns: ["idCxp"]
            isOneToOne: false
            referencedRelation: "cxp"
            referencedColumns: ["idCxp"]
          },
        ]
      }
      conciliacion: {
        Row: {
          balance: number | null
          cantpagos: number | null
          idpropiedad: string | null
          monto: number | null
          montoobra: number | null
          montopagos: number | null
          montoterreno: number | null
          nomdecriptivo: string | null
          pdpactivo: boolean | null
          razonsocial: string | null
        }
        Insert: {
          balance?: number | null
          cantpagos?: number | null
          idpropiedad?: string | null
          monto?: number | null
          montoobra?: number | null
          montopagos?: number | null
          montoterreno?: number | null
          nomdecriptivo?: string | null
          pdpactivo?: boolean | null
          razonsocial?: string | null
        }
        Update: {
          balance?: number | null
          cantpagos?: number | null
          idpropiedad?: string | null
          monto?: number | null
          montoobra?: number | null
          montopagos?: number | null
          montoterreno?: number | null
          nomdecriptivo?: string | null
          pdpactivo?: boolean | null
          razonsocial?: string | null
        }
        Relationships: []
      }
      correo_adjuntos: {
        Row: {
          contentType: string | null
          fc: string
          filename: string | null
          id: string
          idMensaje: string
          tamano: number | null
          url: string | null
        }
        Insert: {
          contentType?: string | null
          fc?: string
          filename?: string | null
          id?: string
          idMensaje: string
          tamano?: number | null
          url?: string | null
        }
        Update: {
          contentType?: string | null
          fc?: string
          filename?: string | null
          id?: string
          idMensaje?: string
          tamano?: number | null
          url?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "correo_adjuntos_idMensaje_fkey"
            columns: ["idMensaje"]
            isOneToOne: false
            referencedRelation: "correo_mensajes"
            referencedColumns: ["id"]
          },
        ]
      }
      correo_cuentas: {
        Row: {
          activo: boolean
          email: string
          fc: string
          id: string
          imapHost: string
          imapPort: number
          nombre: string | null
          passwordCifrada: string
          smtpHost: string
          smtpPort: number
          uidr: string | null
          ultimoUidSync: Json
          usuario: string
        }
        Insert: {
          activo?: boolean
          email: string
          fc?: string
          id?: string
          imapHost: string
          imapPort?: number
          nombre?: string | null
          passwordCifrada: string
          smtpHost: string
          smtpPort?: number
          uidr?: string | null
          ultimoUidSync?: Json
          usuario: string
        }
        Update: {
          activo?: boolean
          email?: string
          fc?: string
          id?: string
          imapHost?: string
          imapPort?: number
          nombre?: string | null
          passwordCifrada?: string
          smtpHost?: string
          smtpPort?: number
          uidr?: string | null
          ultimoUidSync?: Json
          usuario?: string
        }
        Relationships: []
      }
      correo_mensajes: {
        Row: {
          bodyHtml: string | null
          bodyText: string | null
          cc: string | null
          conversationId: string | null
          fc: string
          fecha: string | null
          folder: string | null
          fromEmail: string | null
          id: string
          idCuenta: string
          leido: boolean
          messageId: string | null
          subject: string | null
          tieneAdjuntos: boolean
          tipo: string
          toEmail: string | null
        }
        Insert: {
          bodyHtml?: string | null
          bodyText?: string | null
          cc?: string | null
          conversationId?: string | null
          fc?: string
          fecha?: string | null
          folder?: string | null
          fromEmail?: string | null
          id?: string
          idCuenta: string
          leido?: boolean
          messageId?: string | null
          subject?: string | null
          tieneAdjuntos?: boolean
          tipo?: string
          toEmail?: string | null
        }
        Update: {
          bodyHtml?: string | null
          bodyText?: string | null
          cc?: string | null
          conversationId?: string | null
          fc?: string
          fecha?: string | null
          folder?: string | null
          fromEmail?: string | null
          id?: string
          idCuenta?: string
          leido?: boolean
          messageId?: string | null
          subject?: string | null
          tieneAdjuntos?: boolean
          tipo?: string
          toEmail?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "correo_mensajes_idCuenta_fkey"
            columns: ["idCuenta"]
            isOneToOne: false
            referencedRelation: "correo_cuentas"
            referencedColumns: ["id"]
          },
        ]
      }
      crm_campania: {
        Row: {
          bkColor: string
          fc: string
          id: number
          status: boolean
          titulo: string
          txtColor: string
          uidc: string
        }
        Insert: {
          bkColor?: string
          fc?: string
          id?: number
          status?: boolean
          titulo: string
          txtColor?: string
          uidc: string
        }
        Update: {
          bkColor?: string
          fc?: string
          id?: number
          status?: boolean
          titulo?: string
          txtColor?: string
          uidc?: string
        }
        Relationships: [
          {
            foreignKeyName: "crm_campania_uidc_fkey"
            columns: ["uidc"]
            isOneToOne: false
            referencedRelation: "catUsers"
            referencedColumns: ["uid"]
          },
        ]
      }
      crm_config: {
        Row: {
          fc: string
          fum: string | null
          id: string
          valor: string | null
        }
        Insert: {
          fc?: string
          fum?: string | null
          id: string
          valor?: string | null
        }
        Update: {
          fc?: string
          fum?: string | null
          id?: string
          valor?: string | null
        }
        Relationships: []
      }
      crm_Encuestas: {
        Row: {
          bkColor: string
          fc: string
          id: number
          status: boolean
          titulo: string | null
          txtColor: string
          uidc: string | null
        }
        Insert: {
          bkColor?: string
          fc?: string
          id?: number
          status?: boolean
          titulo?: string | null
          txtColor?: string
          uidc?: string | null
        }
        Update: {
          bkColor?: string
          fc?: string
          id?: number
          status?: boolean
          titulo?: string | null
          txtColor?: string
          uidc?: string | null
        }
        Relationships: []
      }
      crm_Etapas: {
        Row: {
          bkColor: string
          fc: string
          id: number
          orden: number
          Posicion: string
          status: boolean
          titulo: string
          txtColor: string
          uidr: string
        }
        Insert: {
          bkColor?: string
          fc?: string
          id?: number
          orden: number
          Posicion?: string
          status?: boolean
          titulo: string
          txtColor?: string
          uidr: string
        }
        Update: {
          bkColor?: string
          fc?: string
          id?: number
          orden?: number
          Posicion?: string
          status?: boolean
          titulo?: string
          txtColor?: string
          uidr?: string
        }
        Relationships: [
          {
            foreignKeyName: "crm_Etapas_uidr_fkey"
            columns: ["uidr"]
            isOneToOne: false
            referencedRelation: "catUsers"
            referencedColumns: ["uid"]
          },
        ]
      }
      crm_historial_etapas: {
        Row: {
          fc: string
          id: number
          idEtapaAnt: number | null
          idEtapaNva: number
          idLead: string
          motivo: string | null
          uidr: string
        }
        Insert: {
          fc?: string
          id?: number
          idEtapaAnt?: number | null
          idEtapaNva: number
          idLead: string
          motivo?: string | null
          uidr: string
        }
        Update: {
          fc?: string
          id?: number
          idEtapaAnt?: number | null
          idEtapaNva?: number
          idLead?: string
          motivo?: string | null
          uidr?: string
        }
        Relationships: [
          {
            foreignKeyName: "crm_historial_etapas_idEtapaAnt_fkey"
            columns: ["idEtapaAnt"]
            isOneToOne: false
            referencedRelation: "crm_Etapas"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "crm_historial_etapas_idEtapaNva_fkey"
            columns: ["idEtapaNva"]
            isOneToOne: false
            referencedRelation: "crm_Etapas"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "crm_historial_etapas_idLead_fkey"
            columns: ["idLead"]
            isOneToOne: false
            referencedRelation: "crm_Agenda"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "crm_historial_etapas_idLead_fkey"
            columns: ["idLead"]
            isOneToOne: false
            referencedRelation: "leads"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "crm_historial_etapas_idLead_fkey"
            columns: ["idLead"]
            isOneToOne: false
            referencedRelation: "v_leads_completo"
            referencedColumns: ["lead_id"]
          },
          {
            foreignKeyName: "crm_historial_etapas_uidr_fkey"
            columns: ["uidr"]
            isOneToOne: false
            referencedRelation: "catUsers"
            referencedColumns: ["uid"]
          },
        ]
      }
      crm_incidencias: {
        Row: {
          cadena: boolean | null
          cuerpoPlano: string | null
          date: string | null
          fc: string
          fecha: string | null
          from: string | null
          fum: string | null
          id: number
          idMensaje: string | null
          messageid: string | null
          reference: string | null
          status: boolean | null
          subject: string | null
          textasHtml: string | null
          to: string | null
        }
        Insert: {
          cadena?: boolean | null
          cuerpoPlano?: string | null
          date?: string | null
          fc?: string
          fecha?: string | null
          from?: string | null
          fum?: string | null
          id?: number
          idMensaje?: string | null
          messageid?: string | null
          reference?: string | null
          status?: boolean | null
          subject?: string | null
          textasHtml?: string | null
          to?: string | null
        }
        Update: {
          cadena?: boolean | null
          cuerpoPlano?: string | null
          date?: string | null
          fc?: string
          fecha?: string | null
          from?: string | null
          fum?: string | null
          id?: number
          idMensaje?: string | null
          messageid?: string | null
          reference?: string | null
          status?: boolean | null
          subject?: string | null
          textasHtml?: string | null
          to?: string | null
        }
        Relationships: []
      }
      crm_lead_naves: {
        Row: {
          condiciones: string | null
          fc: string
          fum: string | null
          id: string
          idLead: string
          idNave: string
          precio: number
          resultado: string
          status: boolean
          uidr: string | null
        }
        Insert: {
          condiciones?: string | null
          fc?: string
          fum?: string | null
          id?: string
          idLead: string
          idNave: string
          precio?: number
          resultado?: string
          status?: boolean
          uidr?: string | null
        }
        Update: {
          condiciones?: string | null
          fc?: string
          fum?: string | null
          id?: string
          idLead?: string
          idNave?: string
          precio?: number
          resultado?: string
          status?: boolean
          uidr?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "crm_lead_naves_idLead_fkey"
            columns: ["idLead"]
            isOneToOne: false
            referencedRelation: "crm_Agenda"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "crm_lead_naves_idLead_fkey"
            columns: ["idLead"]
            isOneToOne: false
            referencedRelation: "leads"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "crm_lead_naves_idLead_fkey"
            columns: ["idLead"]
            isOneToOne: false
            referencedRelation: "v_leads_completo"
            referencedColumns: ["lead_id"]
          },
          {
            foreignKeyName: "crm_lead_naves_uidr_fkey"
            columns: ["uidr"]
            isOneToOne: false
            referencedRelation: "catUsers"
            referencedColumns: ["uid"]
          },
        ]
      }
      crm_Origen: {
        Row: {
          bkColor: string
          fc: string
          id: number
          status: boolean
          titulo: string | null
          txtColor: string
          uidc: string | null
        }
        Insert: {
          bkColor?: string
          fc?: string
          id?: number
          status?: boolean
          titulo?: string | null
          txtColor?: string
          uidc?: string | null
        }
        Update: {
          bkColor?: string
          fc?: string
          id?: number
          status?: boolean
          titulo?: string | null
          txtColor?: string
          uidc?: string | null
        }
        Relationships: []
      }
      crm_Recepcion: {
        Row: {
          bkColor: string
          fc: string
          id: number
          status: boolean
          titulo: string | null
          txtColor: string
          uidc: string | null
        }
        Insert: {
          bkColor?: string
          fc?: string
          id?: number
          status?: boolean
          titulo?: string | null
          txtColor?: string
          uidc?: string | null
        }
        Update: {
          bkColor?: string
          fc?: string
          id?: number
          status?: boolean
          titulo?: string | null
          txtColor?: string
          uidc?: string | null
        }
        Relationships: []
      }
      crm_reporte_permisos: {
        Row: {
          id: string
          reporte_id: string
          rol: string | null
          usuario_id: string
        }
        Insert: {
          id?: string
          reporte_id: string
          rol?: string | null
          usuario_id: string
        }
        Update: {
          id?: string
          reporte_id?: string
          rol?: string | null
          usuario_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "crm_reporte_permisos_reporte_id_fkey"
            columns: ["reporte_id"]
            isOneToOne: false
            referencedRelation: "crm_reports"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "crm_reporte_permisos_usuario_id_fkey"
            columns: ["usuario_id"]
            isOneToOne: false
            referencedRelation: "catUsers"
            referencedColumns: ["uid"]
          },
        ]
      }
      crm_reports: {
        Row: {
          creado_por: string | null
          descripcion: string | null
          fecha_actualizacion: string | null
          fecha_creacion: string | null
          filtros_activos: Json | null
          id: string
          nombre: string
          page_height: number | null
          page_width: number | null
          visibilidad: string | null
          zoom_mode: string | null
          zoom_value: number | null
        }
        Insert: {
          creado_por?: string | null
          descripcion?: string | null
          fecha_actualizacion?: string | null
          fecha_creacion?: string | null
          filtros_activos?: Json | null
          id?: string
          nombre: string
          page_height?: number | null
          page_width?: number | null
          visibilidad?: string | null
          zoom_mode?: string | null
          zoom_value?: number | null
        }
        Update: {
          creado_por?: string | null
          descripcion?: string | null
          fecha_actualizacion?: string | null
          fecha_creacion?: string | null
          filtros_activos?: Json | null
          id?: string
          nombre?: string
          page_height?: number | null
          page_width?: number | null
          visibilidad?: string | null
          zoom_mode?: string | null
          zoom_value?: number | null
        }
        Relationships: [
          {
            foreignKeyName: "crm_reports_creado_por_fkey"
            columns: ["creado_por"]
            isOneToOne: false
            referencedRelation: "catUsers"
            referencedColumns: ["uid"]
          },
        ]
      }
      crm_responsableComercial: {
        Row: {
          id: number
          uid: string
        }
        Insert: {
          id: number
          uid: string
        }
        Update: {
          id?: number
          uid?: string
        }
        Relationships: [
          {
            foreignKeyName: "crm_responsableComercial_uid_fkey"
            columns: ["uid"]
            isOneToOne: true
            referencedRelation: "catUsers"
            referencedColumns: ["uid"]
          },
        ]
      }
      crm_tipoActividad: {
        Row: {
          fc: string
          icono: string | null
          id: number
          status: boolean
          titulo: string
        }
        Insert: {
          fc?: string
          icono?: string | null
          id: number
          status?: boolean
          titulo: string
        }
        Update: {
          fc?: string
          icono?: string | null
          id?: number
          status?: boolean
          titulo?: string
        }
        Relationships: []
      }
      crm_tipoCliente: {
        Row: {
          bkColor: string
          fc: string
          id: number
          status: boolean
          titulo: string | null
          txtColor: string
          uidc: string | null
        }
        Insert: {
          bkColor?: string
          fc?: string
          id?: number
          status?: boolean
          titulo?: string | null
          txtColor?: string
          uidc?: string | null
        }
        Update: {
          bkColor?: string
          fc?: string
          id?: number
          status?: boolean
          titulo?: string | null
          txtColor?: string
          uidc?: string | null
        }
        Relationships: []
      }
      crm_tipoOperaciones: {
        Row: {
          fc: string
          id: number
          status: boolean
          titulo: string | null
          uidc: string | null
        }
        Insert: {
          fc?: string
          id?: number
          status?: boolean
          titulo?: string | null
          uidc?: string | null
        }
        Update: {
          fc?: string
          id?: number
          status?: boolean
          titulo?: string | null
          uidc?: string | null
        }
        Relationships: []
      }
      crm_tipoVenta: {
        Row: {
          fc: string
          id: number
          idTipoOperacion: number
          status: boolean
          titulo: string | null
          uidc: string | null
        }
        Insert: {
          fc?: string
          id?: number
          idTipoOperacion: number
          status?: boolean
          titulo?: string | null
          uidc?: string | null
        }
        Update: {
          fc?: string
          id?: number
          idTipoOperacion?: number
          status?: boolean
          titulo?: string | null
          uidc?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "crm_tipoVenta_idTipoOperacion_fkey"
            columns: ["idTipoOperacion"]
            isOneToOne: false
            referencedRelation: "crm_tipoOperaciones"
            referencedColumns: ["id"]
          },
        ]
      }
      crm_widgets: {
        Row: {
          config: Json | null
          fecha_creacion: string | null
          filter_config: Json | null
          height: number | null
          id: string
          mostrar_titulo: boolean | null
          pos_x: number | null
          pos_y: number | null
          reporte_id: string | null
          tipo: string
          titulo: string
          widget_category: string | null
          width: number | null
          z_index: number | null
        }
        Insert: {
          config?: Json | null
          fecha_creacion?: string | null
          filter_config?: Json | null
          height?: number | null
          id?: string
          mostrar_titulo?: boolean | null
          pos_x?: number | null
          pos_y?: number | null
          reporte_id?: string | null
          tipo: string
          titulo: string
          widget_category?: string | null
          width?: number | null
          z_index?: number | null
        }
        Update: {
          config?: Json | null
          fecha_creacion?: string | null
          filter_config?: Json | null
          height?: number | null
          id?: string
          mostrar_titulo?: boolean | null
          pos_x?: number | null
          pos_y?: number | null
          reporte_id?: string | null
          tipo?: string
          titulo?: string
          widget_category?: string | null
          width?: number | null
          z_index?: number | null
        }
        Relationships: [
          {
            foreignKeyName: "crm_widgets_reporte_id_fkey"
            columns: ["reporte_id"]
            isOneToOne: false
            referencedRelation: "crm_reports"
            referencedColumns: ["id"]
          },
        ]
      }
      cxp: {
        Row: {
          autorizadoFP: boolean
          autorizo: string | null
          complementoExento: boolean
          complementoExentoMotivo: string | null
          complementoExentoPor: string | null
          completada: boolean
          concepto: string | null
          diferido: boolean
          estado: string | null
          esUrgente: boolean
          fc: string
          fecAutorizacion: string | null
          fecCFDI: string | null
          fecComplemento: string | null
          fecComplementoExento: string | null
          fechaLimite: string | null
          fecPago: string | null
          fecSolicitud: string | null
          folio: string | null
          idCategoria: string
          idCxp: string
          idCxpPPD: string | null
          idEstado: number | null
          idFolioDif: string | null
          idMovBancarios: string | null
          idProveedor: string
          lineaCaptura: string | null
          moneda: string
          montoAplicado: number
          nave: string | null
          nombreProveedor: string | null
          nomCFDI: string
          nomGerente: string | null
          numAnio: number | null
          numMes: number | null
          numSem: number | null
          pagador: string | null
          pagoInmediato: boolean | null
          parque: string | null
          rangoSemana: string | null
          referencia: string | null
          status: boolean
          subtotal: number | null
          tdc: boolean
          tipoOperacion: number
          tipoProveedor: number
          total: number
          uidGerente: string | null
          uidr: string
          ultimoComentario: string
          urlCFDI: string | null
          urlComplementoPdf: string | null
          urlComplementoXml: string | null
          urlXLM: string | null
          uuidComplemento: string | null
        }
        Insert: {
          autorizadoFP?: boolean
          autorizo?: string | null
          complementoExento?: boolean
          complementoExentoMotivo?: string | null
          complementoExentoPor?: string | null
          completada?: boolean
          concepto?: string | null
          diferido?: boolean
          estado?: string | null
          esUrgente?: boolean
          fc?: string
          fecAutorizacion?: string | null
          fecCFDI?: string | null
          fecComplemento?: string | null
          fecComplementoExento?: string | null
          fechaLimite?: string | null
          fecPago?: string | null
          fecSolicitud?: string | null
          folio?: string | null
          idCategoria: string
          idCxp: string
          idCxpPPD?: string | null
          idEstado?: number | null
          idFolioDif?: string | null
          idMovBancarios?: string | null
          idProveedor: string
          lineaCaptura?: string | null
          moneda?: string
          montoAplicado?: number
          nave?: string | null
          nombreProveedor?: string | null
          nomCFDI?: string
          nomGerente?: string | null
          numAnio?: number | null
          numMes?: number | null
          numSem?: number | null
          pagador?: string | null
          pagoInmediato?: boolean | null
          parque?: string | null
          rangoSemana?: string | null
          referencia?: string | null
          status?: boolean
          subtotal?: number | null
          tdc?: boolean
          tipoOperacion?: number
          tipoProveedor: number
          total: number
          uidGerente?: string | null
          uidr: string
          ultimoComentario?: string
          urlCFDI?: string | null
          urlComplementoPdf?: string | null
          urlComplementoXml?: string | null
          urlXLM?: string | null
          uuidComplemento?: string | null
        }
        Update: {
          autorizadoFP?: boolean
          autorizo?: string | null
          complementoExento?: boolean
          complementoExentoMotivo?: string | null
          complementoExentoPor?: string | null
          completada?: boolean
          concepto?: string | null
          diferido?: boolean
          estado?: string | null
          esUrgente?: boolean
          fc?: string
          fecAutorizacion?: string | null
          fecCFDI?: string | null
          fecComplemento?: string | null
          fecComplementoExento?: string | null
          fechaLimite?: string | null
          fecPago?: string | null
          fecSolicitud?: string | null
          folio?: string | null
          idCategoria?: string
          idCxp?: string
          idCxpPPD?: string | null
          idEstado?: number | null
          idFolioDif?: string | null
          idMovBancarios?: string | null
          idProveedor?: string
          lineaCaptura?: string | null
          moneda?: string
          montoAplicado?: number
          nave?: string | null
          nombreProveedor?: string | null
          nomCFDI?: string
          nomGerente?: string | null
          numAnio?: number | null
          numMes?: number | null
          numSem?: number | null
          pagador?: string | null
          pagoInmediato?: boolean | null
          parque?: string | null
          rangoSemana?: string | null
          referencia?: string | null
          status?: boolean
          subtotal?: number | null
          tdc?: boolean
          tipoOperacion?: number
          tipoProveedor?: number
          total?: number
          uidGerente?: string | null
          uidr?: string
          ultimoComentario?: string
          urlCFDI?: string | null
          urlComplementoPdf?: string | null
          urlComplementoXml?: string | null
          urlXLM?: string | null
          uuidComplemento?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "cxp_autorizo_fkey"
            columns: ["autorizo"]
            isOneToOne: false
            referencedRelation: "catUsers"
            referencedColumns: ["uid"]
          },
          {
            foreignKeyName: "cxp_idCxpPPD_fkey"
            columns: ["idCxpPPD"]
            isOneToOne: false
            referencedRelation: "cxp_ppd"
            referencedColumns: ["idCxpPPD"]
          },
          {
            foreignKeyName: "cxp_uidr_fkey"
            columns: ["uidr"]
            isOneToOne: false
            referencedRelation: "catUsers"
            referencedColumns: ["uid"]
          },
        ]
      }
      cxp_fechas_habilitadas: {
        Row: {
          autorizar: boolean
          cfdi: boolean
          created_at: string
          created_by: string
          dia_semana: string | null
          fecha: string
          mes_anio: string | null
        }
        Insert: {
          autorizar?: boolean
          cfdi?: boolean
          created_at?: string
          created_by?: string
          dia_semana?: string | null
          fecha: string
          mes_anio?: string | null
        }
        Update: {
          autorizar?: boolean
          cfdi?: boolean
          created_at?: string
          created_by?: string
          dia_semana?: string | null
          fecha?: string
          mes_anio?: string | null
        }
        Relationships: []
      }
      cxp_ppd: {
        Row: {
          autorizo: string | null
          concepto: string | null
          fc: string
          fecAutorizacion: string | null
          fecCFDI: string | null
          fecInicio: string
          fecSolicitud: string | null
          folio: string
          idCategoria: string
          idCxpPPD: string
          idProveedor: string | null
          montoAplicado: number
          nombreProveedor: string | null
          nomCFDI: string
          numPagos: number
          status: boolean
          subtotal: number | null
          tipoProveedor: number | null
          total: number | null
          uidr: string
          urlCFDI: string
          urlXLM: string
        }
        Insert: {
          autorizo?: string | null
          concepto?: string | null
          fc?: string
          fecAutorizacion?: string | null
          fecCFDI?: string | null
          fecInicio: string
          fecSolicitud?: string | null
          folio: string
          idCategoria: string
          idCxpPPD: string
          idProveedor?: string | null
          montoAplicado?: number
          nombreProveedor?: string | null
          nomCFDI?: string
          numPagos?: number
          status?: boolean
          subtotal?: number | null
          tipoProveedor?: number | null
          total?: number | null
          uidr: string
          urlCFDI: string
          urlXLM: string
        }
        Update: {
          autorizo?: string | null
          concepto?: string | null
          fc?: string
          fecAutorizacion?: string | null
          fecCFDI?: string | null
          fecInicio?: string
          fecSolicitud?: string | null
          folio?: string
          idCategoria?: string
          idCxpPPD?: string
          idProveedor?: string | null
          montoAplicado?: number
          nombreProveedor?: string | null
          nomCFDI?: string
          numPagos?: number
          status?: boolean
          subtotal?: number | null
          tipoProveedor?: number | null
          total?: number | null
          uidr?: string
          urlCFDI?: string
          urlXLM?: string
        }
        Relationships: [
          {
            foreignKeyName: "cxp_ppd_idProveedor_fkey"
            columns: ["idProveedor"]
            isOneToOne: false
            referencedRelation: "catProveedores"
            referencedColumns: ["idProveedor"]
          },
          {
            foreignKeyName: "cxp_ppd_uidr_fkey"
            columns: ["uidr"]
            isOneToOne: false
            referencedRelation: "catUsers"
            referencedColumns: ["uid"]
          },
        ]
      }
      cxpComentarios: {
        Row: {
          comentario: string | null
          fc: string
          idCxP: string
          idCxpComentarios: string
          status: boolean
          tipo: number | null
          uidr: string | null
        }
        Insert: {
          comentario?: string | null
          fc?: string
          idCxP: string
          idCxpComentarios: string
          status?: boolean
          tipo?: number | null
          uidr?: string | null
        }
        Update: {
          comentario?: string | null
          fc?: string
          idCxP?: string
          idCxpComentarios?: string
          status?: boolean
          tipo?: number | null
          uidr?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "cxpComentarios_idCxP_fkey"
            columns: ["idCxP"]
            isOneToOne: false
            referencedRelation: "cxp"
            referencedColumns: ["idCxp"]
          },
        ]
      }
      email_attachments: {
        Row: {
          content_type: string | null
          created_at: string | null
          email_id: number | null
          filename: string | null
          id: number
          url: string | null
        }
        Insert: {
          content_type?: string | null
          created_at?: string | null
          email_id?: number | null
          filename?: string | null
          id?: number
          url?: string | null
        }
        Update: {
          content_type?: string | null
          created_at?: string | null
          email_id?: number | null
          filename?: string | null
          id?: number
          url?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "email_attachments_email_id_fkey"
            columns: ["email_id"]
            isOneToOne: false
            referencedRelation: "emails"
            referencedColumns: ["id"]
          },
        ]
      }
      emails: {
        Row: {
          agrupar: string | null
          body: string | null
          conversation_id: string | null
          created_at: string | null
          date: string | null
          email_type: string | null
          folder: string | null
          from_email: string | null
          id: number
          noReporte: string | null
          statusTicket: Database["public"]["Enums"]["statusTicket"]
          subject: string | null
          to_email: string | null
          uid: string | null
        }
        Insert: {
          agrupar?: string | null
          body?: string | null
          conversation_id?: string | null
          created_at?: string | null
          date?: string | null
          email_type?: string | null
          folder?: string | null
          from_email?: string | null
          id?: number
          noReporte?: string | null
          statusTicket?: Database["public"]["Enums"]["statusTicket"]
          subject?: string | null
          to_email?: string | null
          uid?: string | null
        }
        Update: {
          agrupar?: string | null
          body?: string | null
          conversation_id?: string | null
          created_at?: string | null
          date?: string | null
          email_type?: string | null
          folder?: string | null
          from_email?: string | null
          id?: number
          noReporte?: string | null
          statusTicket?: Database["public"]["Enums"]["statusTicket"]
          subject?: string | null
          to_email?: string | null
          uid?: string | null
        }
        Relationships: []
      }
      facturasProveedor: {
        Row: {
          concepto: string | null
          estado: string | null
          fc: string
          fecCFDI: string | null
          folio: string | null
          idCategoria: number | null
          idClasificacion: number | null
          idFacturaProveedor: string
          idProveedor: string | null
          justiificacion: string | null
          status: boolean
          uidr: string | null
        }
        Insert: {
          concepto?: string | null
          estado?: string | null
          fc?: string
          fecCFDI?: string | null
          folio?: string | null
          idCategoria?: number | null
          idClasificacion?: number | null
          idFacturaProveedor: string
          idProveedor?: string | null
          justiificacion?: string | null
          status?: boolean
          uidr?: string | null
        }
        Update: {
          concepto?: string | null
          estado?: string | null
          fc?: string
          fecCFDI?: string | null
          folio?: string | null
          idCategoria?: number | null
          idClasificacion?: number | null
          idFacturaProveedor?: string
          idProveedor?: string | null
          justiificacion?: string | null
          status?: boolean
          uidr?: string | null
        }
        Relationships: []
      }
      fide_periodos_dispersion: {
        Row: {
          fec_fin: string
          fec_inicio: string
          id: number
          no_dispersion: string
        }
        Insert: {
          fec_fin: string
          fec_inicio: string
          id?: number
          no_dispersion: string
        }
        Update: {
          fec_fin?: string
          fec_inicio?: string
          id?: number
          no_dispersion?: string
        }
        Relationships: []
      }
      fideCondiciones: {
        Row: {
          Apartado: number | null
          comentarios: string
          fc: string
          idFide: string
          idfideCond: string
          idPropiedad: string
          Medio: string | null
          noAdhesion: string
          PM: string | null
          "Prom9%": boolean
          rendimiento: number | null
          uid: string | null
        }
        Insert: {
          Apartado?: number | null
          comentarios?: string
          fc?: string
          idFide: string
          idfideCond: string
          idPropiedad: string
          Medio?: string | null
          noAdhesion: string
          PM?: string | null
          "Prom9%"?: boolean
          rendimiento?: number | null
          uid?: string | null
        }
        Update: {
          Apartado?: number | null
          comentarios?: string
          fc?: string
          idFide?: string
          idfideCond?: string
          idPropiedad?: string
          Medio?: string | null
          noAdhesion?: string
          PM?: string | null
          "Prom9%"?: boolean
          rendimiento?: number | null
          uid?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "fideCondiciones_idFide_fkey"
            columns: ["idFide"]
            isOneToOne: false
            referencedRelation: "fideicomiso"
            referencedColumns: ["idFide"]
          },
          {
            foreignKeyName: "fideCondiciones_idPropiedad_fkey"
            columns: ["idPropiedad"]
            isOneToOne: true
            referencedRelation: "propiedades"
            referencedColumns: ["idPropiedad"]
          },
          {
            foreignKeyName: "fideCondiciones_idPropiedad_fkey"
            columns: ["idPropiedad"]
            isOneToOne: true
            referencedRelation: "v_disponibilidad"
            referencedColumns: ["idPropiedad"]
          },
          {
            foreignKeyName: "fideCondiciones_idPropiedad_fkey"
            columns: ["idPropiedad"]
            isOneToOne: true
            referencedRelation: "v_propiedades"
            referencedColumns: ["idPropiedad"]
          },
          {
            foreignKeyName: "fideCondiciones_idPropiedad_fkey"
            columns: ["idPropiedad"]
            isOneToOne: true
            referencedRelation: "v_propiedadesfide"
            referencedColumns: ["idPropiedad"]
          },
          {
            foreignKeyName: "fideCondiciones_uid_fkey"
            columns: ["uid"]
            isOneToOne: false
            referencedRelation: "catUsers"
            referencedColumns: ["uid"]
          },
        ]
      }
      fideContabilidad: {
        Row: {
          anio: number
          aplicaIVA: boolean
          concepto: string | null
          descripcion: string | null
          fc: string
          id: number
          mes: number
          monto: number
          notas: string | null
          status: boolean | null
          subconcepto: string | null
          tipo: string | null
          uid: string | null
        }
        Insert: {
          anio: number
          aplicaIVA?: boolean
          concepto?: string | null
          descripcion?: string | null
          fc?: string
          id?: number
          mes: number
          monto?: number
          notas?: string | null
          status?: boolean | null
          subconcepto?: string | null
          tipo?: string | null
          uid?: string | null
        }
        Update: {
          anio?: number
          aplicaIVA?: boolean
          concepto?: string | null
          descripcion?: string | null
          fc?: string
          id?: number
          mes?: number
          monto?: number
          notas?: string | null
          status?: boolean | null
          subconcepto?: string | null
          tipo?: string | null
          uid?: string | null
        }
        Relationships: []
      }
      fideContaConceptos: {
        Row: {
          aplicaIVA: boolean
          concepto: string | null
          descripcion: string | null
          fc: string
          id: number
          orden: number | null
          orden_concepto: number | null
          orden_tipo: number | null
          subconcepto: string | null
          tipo: string | null
        }
        Insert: {
          aplicaIVA?: boolean
          concepto?: string | null
          descripcion?: string | null
          fc?: string
          id?: number
          orden?: number | null
          orden_concepto?: number | null
          orden_tipo?: number | null
          subconcepto?: string | null
          tipo?: string | null
        }
        Update: {
          aplicaIVA?: boolean
          concepto?: string | null
          descripcion?: string | null
          fc?: string
          id?: number
          orden?: number | null
          orden_concepto?: number | null
          orden_tipo?: number | null
          subconcepto?: string | null
          tipo?: string | null
        }
        Relationships: []
      }
      fideContaHistorial: {
        Row: {
          accion: string
          fc: string
          id: number
          monto_antes: number | null
          monto_nuevo: number | null
          notas_antes: string | null
          notas_nuevo: string | null
          registro_id: number
          snapshot: Json | null
          uid: string | null
        }
        Insert: {
          accion: string
          fc?: string
          id?: number
          monto_antes?: number | null
          monto_nuevo?: number | null
          notas_antes?: string | null
          notas_nuevo?: string | null
          registro_id: number
          snapshot?: Json | null
          uid?: string | null
        }
        Update: {
          accion?: string
          fc?: string
          id?: number
          monto_antes?: number | null
          monto_nuevo?: number | null
          notas_antes?: string | null
          notas_nuevo?: string | null
          registro_id?: number
          snapshot?: Json | null
          uid?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "fideContaHistorial_registro_id_fkey"
            columns: ["registro_id"]
            isOneToOne: false
            referencedRelation: "fideContabilidad"
            referencedColumns: ["id"]
          },
        ]
      }
      fideDispersiones: {
        Row: {
          dias_periodo: number
          dispersion_neta: number
          fecha_calculo: string
          fecha_fin: string
          fecha_inicio: string
          fecha_pago: string
          id: number
          id_fideicomiso: string
          id_pago: string
          monto_pago: number
          no_adhesion: string
          noDispersion: string
          nombre_inversionista: string
          periodo_anio: number
          periodo_dia_fin: number
          periodo_dia_inicio: number
          periodo_mes: number
          rendimiento_bruto: number
          rendimiento_neto: number
          rendimiento_sph: number
          retencion_isr: number
          rfc_inversionista: string | null
          sub_periodo: string | null
          tasa_rendimiento: number
          tipo_periodo: string
          tipo_persona: string
        }
        Insert: {
          dias_periodo: number
          dispersion_neta: number
          fecha_calculo?: string
          fecha_fin: string
          fecha_inicio: string
          fecha_pago: string
          id?: number
          id_fideicomiso: string
          id_pago: string
          monto_pago: number
          no_adhesion: string
          noDispersion: string
          nombre_inversionista: string
          periodo_anio: number
          periodo_dia_fin: number
          periodo_dia_inicio: number
          periodo_mes: number
          rendimiento_bruto: number
          rendimiento_neto: number
          rendimiento_sph: number
          retencion_isr: number
          rfc_inversionista?: string | null
          sub_periodo?: string | null
          tasa_rendimiento: number
          tipo_periodo: string
          tipo_persona: string
        }
        Update: {
          dias_periodo?: number
          dispersion_neta?: number
          fecha_calculo?: string
          fecha_fin?: string
          fecha_inicio?: string
          fecha_pago?: string
          id?: number
          id_fideicomiso?: string
          id_pago?: string
          monto_pago?: number
          no_adhesion?: string
          noDispersion?: string
          nombre_inversionista?: string
          periodo_anio?: number
          periodo_dia_fin?: number
          periodo_dia_inicio?: number
          periodo_mes?: number
          rendimiento_bruto?: number
          rendimiento_neto?: number
          rendimiento_sph?: number
          retencion_isr?: number
          rfc_inversionista?: string | null
          sub_periodo?: string | null
          tasa_rendimiento?: number
          tipo_periodo?: string
          tipo_persona?: string
        }
        Relationships: []
      }
      fideicomiso: {
        Row: {
          cantdispersiones: number
          DxA: number
          fecfin: string | null
          fecinicio: string | null
          idFide: string
          rendimiento: number
          status: boolean
          Status: boolean
          titulo: string | null
          uidr: string
        }
        Insert: {
          cantdispersiones?: number
          DxA?: number
          fecfin?: string | null
          fecinicio?: string | null
          idFide: string
          rendimiento?: number
          status?: boolean
          Status: boolean
          titulo?: string | null
          uidr: string
        }
        Update: {
          cantdispersiones?: number
          DxA?: number
          fecfin?: string | null
          fecinicio?: string | null
          idFide?: string
          rendimiento?: number
          status?: boolean
          Status?: boolean
          titulo?: string | null
          uidr?: string
        }
        Relationships: [
          {
            foreignKeyName: "fideicomiso_uidr_fkey"
            columns: ["uidr"]
            isOneToOne: false
            referencedRelation: "catUsers"
            referencedColumns: ["uid"]
          },
        ]
      }
      fideMesDispersion: {
        Row: {
          dia: number
          idFide: string
          idfideMesDisp: string
          mes: number
          status: boolean
          uidr: string
        }
        Insert: {
          dia: number
          idFide: string
          idfideMesDisp: string
          mes: number
          status?: boolean
          uidr: string
        }
        Update: {
          dia?: number
          idFide?: string
          idfideMesDisp?: string
          mes?: number
          status?: boolean
          uidr?: string
        }
        Relationships: [
          {
            foreignKeyName: "fideMesDispersion_idFide_fkey"
            columns: ["idFide"]
            isOneToOne: false
            referencedRelation: "fideicomiso"
            referencedColumns: ["idFide"]
          },
          {
            foreignKeyName: "fideMesDispersion_uidr_fkey"
            columns: ["uidr"]
            isOneToOne: false
            referencedRelation: "catUsers"
            referencedColumns: ["uid"]
          },
        ]
      }
      fidePdpDispersion: {
        Row: {
          calculo: number | null
          calculo_comsph: number | null
          comsph: number | null
          dias: number | null
          dispersion: number | null
          fc: string
          fecfin: string
          fecini: string | null
          idFideCond: string
          idFidePdpD: string
          idPdp: string | null
          idPropiedad: string | null
          monto: number | null
          nombreInversionista: string | null
          numMov: number | null
          personalidad: string | null
          rend: number | null
          retencion_isr: number | null
          status: boolean | null
        }
        Insert: {
          calculo?: number | null
          calculo_comsph?: number | null
          comsph?: number | null
          dias?: number | null
          dispersion?: number | null
          fc?: string
          fecfin: string
          fecini?: string | null
          idFideCond: string
          idFidePdpD: string
          idPdp?: string | null
          idPropiedad?: string | null
          monto?: number | null
          nombreInversionista?: string | null
          numMov?: number | null
          personalidad?: string | null
          rend?: number | null
          retencion_isr?: number | null
          status?: boolean | null
        }
        Update: {
          calculo?: number | null
          calculo_comsph?: number | null
          comsph?: number | null
          dias?: number | null
          dispersion?: number | null
          fc?: string
          fecfin?: string
          fecini?: string | null
          idFideCond?: string
          idFidePdpD?: string
          idPdp?: string | null
          idPropiedad?: string | null
          monto?: number | null
          nombreInversionista?: string | null
          numMov?: number | null
          personalidad?: string | null
          rend?: number | null
          retencion_isr?: number | null
          status?: boolean | null
        }
        Relationships: [
          {
            foreignKeyName: "fidePdpDispersion_idFideCond_fkey"
            columns: ["idFideCond"]
            isOneToOne: false
            referencedRelation: "fideCondiciones"
            referencedColumns: ["idfideCond"]
          },
          {
            foreignKeyName: "fidePdpDispersion_idFideCond_fkey"
            columns: ["idFideCond"]
            isOneToOne: false
            referencedRelation: "v_fideicomiso"
            referencedColumns: ["idfide"]
          },
        ]
      }
      fideSaldosBanco: {
        Row: {
          anio: number
          fc: string
          id: number
          mes: number
          saldo: number
          uidr: string | null
        }
        Insert: {
          anio: number
          fc?: string
          id?: number
          mes: number
          saldo: number
          uidr?: string | null
        }
        Update: {
          anio?: number
          fc?: string
          id?: number
          mes?: number
          saldo?: number
          uidr?: string | null
        }
        Relationships: []
      }
      iaConversaciones: {
        Row: {
          bloqueado: boolean
          calificacion: number | null
          comentario: string | null
          fc: string
          grafico_json: Json | null
          pregunta: string
          razonamiento: string | null
          respuesta: string
          session_id: string | null
          sql_generado: string | null
          tokens_entrada: number | null
          tokens_salida: number | null
          uid_usuario: string
          uuid: string
        }
        Insert: {
          bloqueado?: boolean
          calificacion?: number | null
          comentario?: string | null
          fc?: string
          grafico_json?: Json | null
          pregunta: string
          razonamiento?: string | null
          respuesta: string
          session_id?: string | null
          sql_generado?: string | null
          tokens_entrada?: number | null
          tokens_salida?: number | null
          uid_usuario: string
          uuid?: string
        }
        Update: {
          bloqueado?: boolean
          calificacion?: number | null
          comentario?: string | null
          fc?: string
          grafico_json?: Json | null
          pregunta?: string
          razonamiento?: string | null
          respuesta?: string
          session_id?: string | null
          sql_generado?: string | null
          tokens_entrada?: number | null
          tokens_salida?: number | null
          uid_usuario?: string
          uuid?: string
        }
        Relationships: [
          {
            foreignKeyName: "iaConversaciones_session_id_fkey"
            columns: ["session_id"]
            isOneToOne: false
            referencedRelation: "iaSesiones"
            referencedColumns: ["uuid"]
          },
        ]
      }
      iaSesiones: {
        Row: {
          fc: string
          status: boolean
          titulo: string | null
          uid_usuario: string
          uuid: string
        }
        Insert: {
          fc?: string
          status?: boolean
          titulo?: string | null
          uid_usuario: string
          uuid?: string
        }
        Update: {
          fc?: string
          status?: boolean
          titulo?: string | null
          uid_usuario?: string
          uuid?: string
        }
        Relationships: []
      }
      incidentes: {
        Row: {
          asignadoA: string | null
          asunto: string | null
          categoria: string | null
          conversationId: string
          creadoEn: string
          detenidoOrigen: string | null
          estado: string
          fc: string
          folio: string
          fum: string | null
          fumUser: string | null
          id: string
          idArrendador: string | null
          idCuenta: string
          idNavArrend: string | null
          idNave: string | null
          idParque: string | null
          prioridad: string | null
          status: boolean
          ultimaActividad: string
        }
        Insert: {
          asignadoA?: string | null
          asunto?: string | null
          categoria?: string | null
          conversationId: string
          creadoEn?: string
          detenidoOrigen?: string | null
          estado?: string
          fc?: string
          folio?: string
          fum?: string | null
          fumUser?: string | null
          id?: string
          idArrendador?: string | null
          idCuenta: string
          idNavArrend?: string | null
          idNave?: string | null
          idParque?: string | null
          prioridad?: string | null
          status?: boolean
          ultimaActividad?: string
        }
        Update: {
          asignadoA?: string | null
          asunto?: string | null
          categoria?: string | null
          conversationId?: string
          creadoEn?: string
          detenidoOrigen?: string | null
          estado?: string
          fc?: string
          folio?: string
          fum?: string | null
          fumUser?: string | null
          id?: string
          idArrendador?: string | null
          idCuenta?: string
          idNavArrend?: string | null
          idNave?: string | null
          idParque?: string | null
          prioridad?: string | null
          status?: boolean
          ultimaActividad?: string
        }
        Relationships: [
          {
            foreignKeyName: "incidentes_idCuenta_fkey"
            columns: ["idCuenta"]
            isOneToOne: false
            referencedRelation: "correo_cuentas"
            referencedColumns: ["id"]
          },
        ]
      }
      incidentes_remitentes: {
        Row: {
          email: string
          id: string
          idArrendador: string | null
          idNavArrend: string | null
          idNave: string | null
          idParque: string | null
          primeraVez: string
          ultimaVez: string
          veces: number
        }
        Insert: {
          email: string
          id?: string
          idArrendador?: string | null
          idNavArrend?: string | null
          idNave?: string | null
          idParque?: string | null
          primeraVez?: string
          ultimaVez?: string
          veces?: number
        }
        Update: {
          email?: string
          id?: string
          idArrendador?: string | null
          idNavArrend?: string | null
          idNave?: string | null
          idParque?: string | null
          primeraVez?: string
          ultimaVez?: string
          veces?: number
        }
        Relationships: []
      }
      incidentes_seguimientos: {
        Row: {
          detalle: Json | null
          fc: string
          id: string
          idIncidente: string
          texto: string
          tipo: string
          uid: string | null
        }
        Insert: {
          detalle?: Json | null
          fc?: string
          id?: string
          idIncidente: string
          texto: string
          tipo?: string
          uid?: string | null
        }
        Update: {
          detalle?: Json | null
          fc?: string
          id?: string
          idIncidente?: string
          texto?: string
          tipo?: string
          uid?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "incidentes_seguimientos_idIncidente_fkey"
            columns: ["idIncidente"]
            isOneToOne: false
            referencedRelation: "incidentes"
            referencedColumns: ["id"]
          },
        ]
      }
      inpc: {
        Row: {
          anio: number
          consecutivo: number
          fc: string
          fum: string | null
          id: string
          inpc: number
          mes: number
          nota: string | null
          uidr: string | null
          uidUM: string | null
        }
        Insert: {
          anio: number
          consecutivo?: number
          fc?: string
          fum?: string | null
          id: string
          inpc: number
          mes: number
          nota?: string | null
          uidr?: string | null
          uidUM?: string | null
        }
        Update: {
          anio?: number
          consecutivo?: number
          fc?: string
          fum?: string | null
          id?: string
          inpc?: number
          mes?: number
          nota?: string | null
          uidr?: string | null
          uidUM?: string | null
        }
        Relationships: []
      }
      inversionista: {
        Row: {
          apellido1: string
          apellido2: string
          arrendatario: boolean
          correo: string | null
          CURP: string
          fc: string
          fecNacimiento: string | null
          idContpac: string
          idEmpresa: string
          idInversionista: string
          idRegFiscal: number
          idUser: string
          idusoCFDI: string
          inversionista: boolean
          nombre: string
          NomComercial: string
          personalidad: string | null
          pruebas: boolean
          razonsocial: string | null
          RFC: string
          status: boolean | null
          telefono: string
          ticket: boolean
          tipoCliente: string
          usuarioFinal: boolean
        }
        Insert: {
          apellido1?: string
          apellido2?: string
          arrendatario?: boolean
          correo?: string | null
          CURP?: string
          fc?: string
          fecNacimiento?: string | null
          idContpac?: string
          idEmpresa?: string
          idInversionista: string
          idRegFiscal?: number
          idUser: string
          idusoCFDI?: string
          inversionista?: boolean
          nombre?: string
          NomComercial?: string
          personalidad?: string | null
          pruebas?: boolean
          razonsocial?: string | null
          RFC?: string
          status?: boolean | null
          telefono?: string
          ticket?: boolean
          tipoCliente?: string
          usuarioFinal?: boolean
        }
        Update: {
          apellido1?: string
          apellido2?: string
          arrendatario?: boolean
          correo?: string | null
          CURP?: string
          fc?: string
          fecNacimiento?: string | null
          idContpac?: string
          idEmpresa?: string
          idInversionista?: string
          idRegFiscal?: number
          idUser?: string
          idusoCFDI?: string
          inversionista?: boolean
          nombre?: string
          NomComercial?: string
          personalidad?: string | null
          pruebas?: boolean
          razonsocial?: string | null
          RFC?: string
          status?: boolean | null
          telefono?: string
          ticket?: boolean
          tipoCliente?: string
          usuarioFinal?: boolean
        }
        Relationships: [
          {
            foreignKeyName: "inversionista_idUser_fkey"
            columns: ["idUser"]
            isOneToOne: false
            referencedRelation: "catUsers"
            referencedColumns: ["uid"]
          },
        ]
      }
      inversionista_docs: {
        Row: {
          descripcion: string | null
          fc: string | null
          idDocumento: string
          idInversionista: string | null
          idUser: string | null
          status: boolean | null
          titulo: string | null
          urldoc: string | null
        }
        Insert: {
          descripcion?: string | null
          fc?: string | null
          idDocumento: string
          idInversionista?: string | null
          idUser?: string | null
          status?: boolean | null
          titulo?: string | null
          urldoc?: string | null
        }
        Update: {
          descripcion?: string | null
          fc?: string | null
          idDocumento?: string
          idInversionista?: string | null
          idUser?: string | null
          status?: boolean | null
          titulo?: string | null
          urldoc?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "inversionista_docs_idInversionista_fkey"
            columns: ["idInversionista"]
            isOneToOne: false
            referencedRelation: "inversionista"
            referencedColumns: ["idInversionista"]
          },
          {
            foreignKeyName: "inversionista_docs_idInversionista_fkey"
            columns: ["idInversionista"]
            isOneToOne: false
            referencedRelation: "v_detClientes"
            referencedColumns: ["idInversionista"]
          },
          {
            foreignKeyName: "inversionista_docs_idInversionista_fkey"
            columns: ["idInversionista"]
            isOneToOne: false
            referencedRelation: "v_pagos"
            referencedColumns: ["idInversionista"]
          },
        ]
      }
      kvasAsignados: {
        Row: {
          cantKvas: number
          fc: string
          idKvas: string
          idNave: string
          idParque: string
          status: boolean
          tipoContrato: number
          tipoTension: number
          uidr: string
        }
        Insert: {
          cantKvas?: number
          fc?: string
          idKvas?: string
          idNave: string
          idParque: string
          status?: boolean
          tipoContrato: number
          tipoTension: number
          uidr: string
        }
        Update: {
          cantKvas?: number
          fc?: string
          idKvas?: string
          idNave?: string
          idParque?: string
          status?: boolean
          tipoContrato?: number
          tipoTension?: number
          uidr?: string
        }
        Relationships: [
          {
            foreignKeyName: "kvasAsignados_idNave_fkey"
            columns: ["idNave"]
            isOneToOne: false
            referencedRelation: "naves"
            referencedColumns: ["idNave"]
          },
          {
            foreignKeyName: "kvasAsignados_idNave_fkey"
            columns: ["idNave"]
            isOneToOne: false
            referencedRelation: "v_disponibilidad"
            referencedColumns: ["idNave"]
          },
          {
            foreignKeyName: "kvasAsignados_idNave_fkey"
            columns: ["idNave"]
            isOneToOne: false
            referencedRelation: "v_naves"
            referencedColumns: ["idNave"]
          },
          {
            foreignKeyName: "kvasAsignados_idParque_fkey"
            columns: ["idParque"]
            isOneToOne: false
            referencedRelation: "parques"
            referencedColumns: ["idParque"]
          },
          {
            foreignKeyName: "kvasAsignados_idParque_fkey"
            columns: ["idParque"]
            isOneToOne: false
            referencedRelation: "v_pdpdetalle"
            referencedColumns: ["idParque"]
          },
          {
            foreignKeyName: "kvasAsignados_idParque_fkey"
            columns: ["idParque"]
            isOneToOne: false
            referencedRelation: "v_pdpdetalle2"
            referencedColumns: ["idParque"]
          },
          {
            foreignKeyName: "kvasAsignados_uidr_fkey"
            columns: ["uidr"]
            isOneToOne: false
            referencedRelation: "catUsers"
            referencedColumns: ["uid"]
          },
        ]
      }
      leads: {
        Row: {
          Aprobado: boolean | null
          correo: string | null
          Etapa: string | null
          fc: string
          fechaContacto: string | null
          fechaRegistro: string | null
          id: string
          idAsesorInm: string | null
          idCampania: number | null
          idEtapa: number | null
          idInmobiliaria: string | null
          idOrigen: number
          idTipoCliente: number
          idTipoOperacion: number | null
          idTipoVenta: number | null
          mensaje: string | null
          nombreLead: string | null
          nomRC: string | null
          Origen: string | null
          status: boolean
          telefono: string | null
          tipoCliente: string | null
          tipoOperacion: string | null
          tipoVenta: string | null
          uidr: string
          uidRC: string | null
          valor: number | null
        }
        Insert: {
          Aprobado?: boolean | null
          correo?: string | null
          Etapa?: string | null
          fc?: string
          fechaContacto?: string | null
          fechaRegistro?: string | null
          id?: string
          idAsesorInm?: string | null
          idCampania?: number | null
          idEtapa?: number | null
          idInmobiliaria?: string | null
          idOrigen?: number
          idTipoCliente?: number
          idTipoOperacion?: number | null
          idTipoVenta?: number | null
          mensaje?: string | null
          nombreLead?: string | null
          nomRC?: string | null
          Origen?: string | null
          status?: boolean
          telefono?: string | null
          tipoCliente?: string | null
          tipoOperacion?: string | null
          tipoVenta?: string | null
          uidr?: string
          uidRC?: string | null
          valor?: number | null
        }
        Update: {
          Aprobado?: boolean | null
          correo?: string | null
          Etapa?: string | null
          fc?: string
          fechaContacto?: string | null
          fechaRegistro?: string | null
          id?: string
          idAsesorInm?: string | null
          idCampania?: number | null
          idEtapa?: number | null
          idInmobiliaria?: string | null
          idOrigen?: number
          idTipoCliente?: number
          idTipoOperacion?: number | null
          idTipoVenta?: number | null
          mensaje?: string | null
          nombreLead?: string | null
          nomRC?: string | null
          Origen?: string | null
          status?: boolean
          telefono?: string | null
          tipoCliente?: string | null
          tipoOperacion?: string | null
          tipoVenta?: string | null
          uidr?: string
          uidRC?: string | null
          valor?: number | null
        }
        Relationships: [
          {
            foreignKeyName: "crm_leads_idOrigen_fkey"
            columns: ["idOrigen"]
            isOneToOne: false
            referencedRelation: "crm_Origen"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "crm_leads_idTipoCliente_fkey"
            columns: ["idTipoCliente"]
            isOneToOne: false
            referencedRelation: "crm_tipoCliente"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "crm_leads_idTipoOperacion_fkey"
            columns: ["idTipoOperacion"]
            isOneToOne: false
            referencedRelation: "crm_tipoOperaciones"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "crm_leads_idTipoVenta_fkey"
            columns: ["idTipoVenta"]
            isOneToOne: false
            referencedRelation: "crm_tipoVenta"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "crm_leads_uidr_fkey"
            columns: ["uidr"]
            isOneToOne: false
            referencedRelation: "catUsers"
            referencedColumns: ["uid"]
          },
          {
            foreignKeyName: "crm_leads_uidRC_fkey"
            columns: ["uidRC"]
            isOneToOne: false
            referencedRelation: "catUsers"
            referencedColumns: ["uid"]
          },
          {
            foreignKeyName: "leads_idAsesorInm_fkey"
            columns: ["idAsesorInm"]
            isOneToOne: false
            referencedRelation: "catAsesoresInm"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "leads_idCampania_fkey"
            columns: ["idCampania"]
            isOneToOne: false
            referencedRelation: "crm_campania"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "leads_idEtapa_fkey"
            columns: ["idEtapa"]
            isOneToOne: false
            referencedRelation: "crm_Etapas"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "leads_idInmobiliaria_fkey"
            columns: ["idInmobiliaria"]
            isOneToOne: false
            referencedRelation: "catInmobiliarias"
            referencedColumns: ["idInmobiliaria"]
          },
        ]
      }
      leads_duplicate: {
        Row: {
          Aprobado: boolean | null
          correo: string | null
          Etapa: string | null
          fc: string
          fechaContacto: string | null
          fechaRegistro: string | null
          id: string
          idAsesorInm: string | null
          idEtapa: number | null
          idInmobiliaria: string | null
          idOrigen: number
          idTipoCliente: number
          idTipoOperacion: number | null
          idTipoVenta: number | null
          mensaje: string | null
          nombreLead: string | null
          nomRC: string | null
          Origen: string | null
          status: boolean
          telefono: string | null
          tipoCliente: string | null
          tipoOperacion: string | null
          tipoVenta: string | null
          uidr: string
          uidRC: string | null
          valor: number | null
        }
        Insert: {
          Aprobado?: boolean | null
          correo?: string | null
          Etapa?: string | null
          fc?: string
          fechaContacto?: string | null
          fechaRegistro?: string | null
          id?: string
          idAsesorInm?: string | null
          idEtapa?: number | null
          idInmobiliaria?: string | null
          idOrigen?: number
          idTipoCliente?: number
          idTipoOperacion?: number | null
          idTipoVenta?: number | null
          mensaje?: string | null
          nombreLead?: string | null
          nomRC?: string | null
          Origen?: string | null
          status?: boolean
          telefono?: string | null
          tipoCliente?: string | null
          tipoOperacion?: string | null
          tipoVenta?: string | null
          uidr?: string
          uidRC?: string | null
          valor?: number | null
        }
        Update: {
          Aprobado?: boolean | null
          correo?: string | null
          Etapa?: string | null
          fc?: string
          fechaContacto?: string | null
          fechaRegistro?: string | null
          id?: string
          idAsesorInm?: string | null
          idEtapa?: number | null
          idInmobiliaria?: string | null
          idOrigen?: number
          idTipoCliente?: number
          idTipoOperacion?: number | null
          idTipoVenta?: number | null
          mensaje?: string | null
          nombreLead?: string | null
          nomRC?: string | null
          Origen?: string | null
          status?: boolean
          telefono?: string | null
          tipoCliente?: string | null
          tipoOperacion?: string | null
          tipoVenta?: string | null
          uidr?: string
          uidRC?: string | null
          valor?: number | null
        }
        Relationships: [
          {
            foreignKeyName: "leads_duplicate_idAsesorInm_fkey"
            columns: ["idAsesorInm"]
            isOneToOne: false
            referencedRelation: "catAsesoresInm"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "leads_duplicate_idEtapa_fkey"
            columns: ["idEtapa"]
            isOneToOne: false
            referencedRelation: "crm_Etapas"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "leads_duplicate_idInmobiliaria_fkey"
            columns: ["idInmobiliaria"]
            isOneToOne: false
            referencedRelation: "catInmobiliarias"
            referencedColumns: ["idInmobiliaria"]
          },
          {
            foreignKeyName: "leads_duplicate_idOrigen_fkey"
            columns: ["idOrigen"]
            isOneToOne: false
            referencedRelation: "crm_Origen"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "leads_duplicate_idTipoCliente_fkey"
            columns: ["idTipoCliente"]
            isOneToOne: false
            referencedRelation: "crm_tipoCliente"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "leads_duplicate_idTipoOperacion_fkey"
            columns: ["idTipoOperacion"]
            isOneToOne: false
            referencedRelation: "crm_tipoOperaciones"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "leads_duplicate_idTipoVenta_fkey"
            columns: ["idTipoVenta"]
            isOneToOne: false
            referencedRelation: "crm_tipoVenta"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "leads_duplicate_uidr_fkey"
            columns: ["uidr"]
            isOneToOne: false
            referencedRelation: "catUsers"
            referencedColumns: ["uid"]
          },
          {
            foreignKeyName: "leads_duplicate_uidRC_fkey"
            columns: ["uidRC"]
            isOneToOne: false
            referencedRelation: "catUsers"
            referencedColumns: ["uid"]
          },
        ]
      }
      leads_porAprobar: {
        Row: {
          aprobado: boolean | null
          correo: string | null
          Etapa: string | null
          fc: string
          fecha_autorizacion: string | null
          fechaContacto: string | null
          fechaRegistro: string
          id: string
          idAsesorInm: string | null
          idEtapa: number | null
          idInmobiliaria: string | null
          idOrigen: number | null
          idTipoCliente: number | null
          idTipoOperacion: number | null
          idTipoVenta: number | null
          KVAs: string
          mensaje: string | null
          motivo_rechazo: string | null
          nombreLead: string | null
          nomRC: string
          Origen: string | null
          personaFisica: boolean
          status: boolean
          superficie: string
          telefono: string | null
          tipoCliente: string | null
          tipoOperacion: string | null
          tipoVenta: string | null
          ubicacion: string
          uid_autorizador: string | null
          uidr: string | null
          uidRC: string | null
          valor: number | null
        }
        Insert: {
          aprobado?: boolean | null
          correo?: string | null
          Etapa?: string | null
          fc?: string
          fecha_autorizacion?: string | null
          fechaContacto?: string | null
          fechaRegistro: string
          id?: string
          idAsesorInm?: string | null
          idEtapa?: number | null
          idInmobiliaria?: string | null
          idOrigen?: number | null
          idTipoCliente?: number | null
          idTipoOperacion?: number | null
          idTipoVenta?: number | null
          KVAs: string
          mensaje?: string | null
          motivo_rechazo?: string | null
          nombreLead?: string | null
          nomRC?: string
          Origen?: string | null
          personaFisica: boolean
          status?: boolean
          superficie: string
          telefono?: string | null
          tipoCliente?: string | null
          tipoOperacion?: string | null
          tipoVenta?: string | null
          ubicacion?: string
          uid_autorizador?: string | null
          uidr?: string | null
          uidRC?: string | null
          valor?: number | null
        }
        Update: {
          aprobado?: boolean | null
          correo?: string | null
          Etapa?: string | null
          fc?: string
          fecha_autorizacion?: string | null
          fechaContacto?: string | null
          fechaRegistro?: string
          id?: string
          idAsesorInm?: string | null
          idEtapa?: number | null
          idInmobiliaria?: string | null
          idOrigen?: number | null
          idTipoCliente?: number | null
          idTipoOperacion?: number | null
          idTipoVenta?: number | null
          KVAs?: string
          mensaje?: string | null
          motivo_rechazo?: string | null
          nombreLead?: string | null
          nomRC?: string
          Origen?: string | null
          personaFisica?: boolean
          status?: boolean
          superficie?: string
          telefono?: string | null
          tipoCliente?: string | null
          tipoOperacion?: string | null
          tipoVenta?: string | null
          ubicacion?: string
          uid_autorizador?: string | null
          uidr?: string | null
          uidRC?: string | null
          valor?: number | null
        }
        Relationships: [
          {
            foreignKeyName: "leads_porAprobar_idAsesorInm_fkey"
            columns: ["idAsesorInm"]
            isOneToOne: false
            referencedRelation: "catAsesoresInm"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "leads_porAprobar_idEtapa_fkey"
            columns: ["idEtapa"]
            isOneToOne: false
            referencedRelation: "crm_Etapas"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "leads_porAprobar_idInmobiliaria_fkey"
            columns: ["idInmobiliaria"]
            isOneToOne: false
            referencedRelation: "catInmobiliarias"
            referencedColumns: ["idInmobiliaria"]
          },
          {
            foreignKeyName: "leads_porAprobar_idOrigen_fkey"
            columns: ["idOrigen"]
            isOneToOne: false
            referencedRelation: "crm_Origen"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "leads_porAprobar_idTipoCliente_fkey"
            columns: ["idTipoCliente"]
            isOneToOne: false
            referencedRelation: "crm_tipoCliente"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "leads_porAprobar_idTipoOperacion_fkey"
            columns: ["idTipoOperacion"]
            isOneToOne: false
            referencedRelation: "crm_tipoOperaciones"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "leads_porAprobar_idTipoVenta_fkey"
            columns: ["idTipoVenta"]
            isOneToOne: false
            referencedRelation: "crm_tipoVenta"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "leads_porAprobar_uid_autorizador_fkey"
            columns: ["uid_autorizador"]
            isOneToOne: false
            referencedRelation: "catUsers"
            referencedColumns: ["uid"]
          },
          {
            foreignKeyName: "leads_porAprobar_uidr_fkey"
            columns: ["uidr"]
            isOneToOne: false
            referencedRelation: "catUsers"
            referencedColumns: ["uid"]
          },
        ]
      }
      manuales: {
        Row: {
          descripcion: string | null
          fc: string
          idManual: string
          status: boolean
          titulo: string
          urlManual: string
        }
        Insert: {
          descripcion?: string | null
          fc?: string
          idManual: string
          status?: boolean
          titulo: string
          urlManual: string
        }
        Update: {
          descripcion?: string | null
          fc?: string
          idManual?: string
          status?: boolean
          titulo?: string
          urlManual?: string
        }
        Relationships: []
      }
      messages: {
        Row: {
          assistant_message: string
          id: string
          timestamp: string
          user_message: string
        }
        Insert: {
          assistant_message: string
          id?: string
          timestamp?: string
          user_message: string
        }
        Update: {
          assistant_message?: string
          id?: string
          timestamp?: string
          user_message?: string
        }
        Relationships: []
      }
      movbancarios: {
        Row: {
          aplicado: boolean
          aplicar: string | null
          asunto: string | null
          autorizacion: string | null
          bancoEmisor: string | null
          bcoDestino: string | null
          beneficiario: string | null
          cancepto: string | null
          ctaDestino: string | null
          fc: string
          fecOperacion: string | null
          folioCFDI: string | null
          genero: string | null
          horaOperacion: string | null
          idArrePdp: string | null
          idmov: string
          idtipo: number | null
          idUnico: string | null
          imgComp: string | null
          importe: number | null
          manual: boolean
          moneda: string | null
          numAnio: number | null
          numMes: number | null
          Operacion: string
          ordenante: string | null
          rastreo: string
          referencia: string | null
          tipo: string
          uidAsignado: string | null
        }
        Insert: {
          aplicado?: boolean
          aplicar?: string | null
          asunto?: string | null
          autorizacion?: string | null
          bancoEmisor?: string | null
          bcoDestino?: string | null
          beneficiario?: string | null
          cancepto?: string | null
          ctaDestino?: string | null
          fc?: string
          fecOperacion?: string | null
          folioCFDI?: string | null
          genero?: string | null
          horaOperacion?: string | null
          idArrePdp?: string | null
          idmov: string
          idtipo?: number | null
          idUnico?: string | null
          imgComp?: string | null
          importe?: number | null
          manual?: boolean
          moneda?: string | null
          numAnio?: number | null
          numMes?: number | null
          Operacion?: string
          ordenante?: string | null
          rastreo: string
          referencia?: string | null
          tipo?: string
          uidAsignado?: string | null
        }
        Update: {
          aplicado?: boolean
          aplicar?: string | null
          asunto?: string | null
          autorizacion?: string | null
          bancoEmisor?: string | null
          bcoDestino?: string | null
          beneficiario?: string | null
          cancepto?: string | null
          ctaDestino?: string | null
          fc?: string
          fecOperacion?: string | null
          folioCFDI?: string | null
          genero?: string | null
          horaOperacion?: string | null
          idArrePdp?: string | null
          idmov?: string
          idtipo?: number | null
          idUnico?: string | null
          imgComp?: string | null
          importe?: number | null
          manual?: boolean
          moneda?: string | null
          numAnio?: number | null
          numMes?: number | null
          Operacion?: string
          ordenante?: string | null
          rastreo?: string
          referencia?: string | null
          tipo?: string
          uidAsignado?: string | null
        }
        Relationships: []
      }
      naves: {
        Row: {
          Arrendada: boolean
          construccion: number
          esTicket: boolean
          fc: string | null
          fecEntrega: string | null
          fum: string | null
          fumUser: string | null
          idNave: string
          idParque: string | null
          idUser: string | null
          lote: number
          mza: number
          numNave: number | null
          numNaveNAME: string | null
          precio: number
          situacion: string | null
          status: boolean | null
          terreno: number
        }
        Insert: {
          Arrendada?: boolean
          construccion?: number
          esTicket?: boolean
          fc?: string | null
          fecEntrega?: string | null
          fum?: string | null
          fumUser?: string | null
          idNave: string
          idParque?: string | null
          idUser?: string | null
          lote?: number
          mza?: number
          numNave?: number | null
          numNaveNAME?: string | null
          precio?: number
          situacion?: string | null
          status?: boolean | null
          terreno?: number
        }
        Update: {
          Arrendada?: boolean
          construccion?: number
          esTicket?: boolean
          fc?: string | null
          fecEntrega?: string | null
          fum?: string | null
          fumUser?: string | null
          idNave?: string
          idParque?: string | null
          idUser?: string | null
          lote?: number
          mza?: number
          numNave?: number | null
          numNaveNAME?: string | null
          precio?: number
          situacion?: string | null
          status?: boolean | null
          terreno?: number
        }
        Relationships: [
          {
            foreignKeyName: "public_naves_idParque_fkey"
            columns: ["idParque"]
            isOneToOne: false
            referencedRelation: "parques"
            referencedColumns: ["idParque"]
          },
          {
            foreignKeyName: "public_naves_idParque_fkey"
            columns: ["idParque"]
            isOneToOne: false
            referencedRelation: "v_pdpdetalle"
            referencedColumns: ["idParque"]
          },
          {
            foreignKeyName: "public_naves_idParque_fkey"
            columns: ["idParque"]
            isOneToOne: false
            referencedRelation: "v_pdpdetalle2"
            referencedColumns: ["idParque"]
          },
        ]
      }
      pagos: {
        Row: {
          comprobante: string | null
          fc: string
          fecha: string | null
          idPago: string
          idPdp: string | null
          idPdpDet: string | null
          idPropiedad: string | null
          idTicket: number | null
          iva: number | null
          monto: number | null
          montosiniva: number | null
          numPago: number | null
          status: boolean | null
          tipomovimiento: number | null
          tipoOperacion: number | null
          uid: string | null
        }
        Insert: {
          comprobante?: string | null
          fc?: string
          fecha?: string | null
          idPago: string
          idPdp?: string | null
          idPdpDet?: string | null
          idPropiedad?: string | null
          idTicket?: number | null
          iva?: number | null
          monto?: number | null
          montosiniva?: number | null
          numPago?: number | null
          status?: boolean | null
          tipomovimiento?: number | null
          tipoOperacion?: number | null
          uid?: string | null
        }
        Update: {
          comprobante?: string | null
          fc?: string
          fecha?: string | null
          idPago?: string
          idPdp?: string | null
          idPdpDet?: string | null
          idPropiedad?: string | null
          idTicket?: number | null
          iva?: number | null
          monto?: number | null
          montosiniva?: number | null
          numPago?: number | null
          status?: boolean | null
          tipomovimiento?: number | null
          tipoOperacion?: number | null
          uid?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "pagos_idPropiedad_fkey"
            columns: ["idPropiedad"]
            isOneToOne: false
            referencedRelation: "propiedades"
            referencedColumns: ["idPropiedad"]
          },
          {
            foreignKeyName: "pagos_idPropiedad_fkey"
            columns: ["idPropiedad"]
            isOneToOne: false
            referencedRelation: "v_disponibilidad"
            referencedColumns: ["idPropiedad"]
          },
          {
            foreignKeyName: "pagos_idPropiedad_fkey"
            columns: ["idPropiedad"]
            isOneToOne: false
            referencedRelation: "v_propiedades"
            referencedColumns: ["idPropiedad"]
          },
          {
            foreignKeyName: "pagos_idPropiedad_fkey"
            columns: ["idPropiedad"]
            isOneToOne: false
            referencedRelation: "v_propiedadesfide"
            referencedColumns: ["idPropiedad"]
          },
          {
            foreignKeyName: "public_pagos_idPdp_fkey"
            columns: ["idPdp"]
            isOneToOne: false
            referencedRelation: "pdp"
            referencedColumns: ["idPdp"]
          },
          {
            foreignKeyName: "public_pagos_idPdpDet_fkey"
            columns: ["idPdpDet"]
            isOneToOne: false
            referencedRelation: "pdpDetalle"
            referencedColumns: ["idPdpDet"]
          },
          {
            foreignKeyName: "public_pagos_idPdpDet_fkey"
            columns: ["idPdpDet"]
            isOneToOne: false
            referencedRelation: "v_configPdpDet"
            referencedColumns: ["idPdpDet"]
          },
          {
            foreignKeyName: "public_pagos_idPdpDet_fkey"
            columns: ["idPdpDet"]
            isOneToOne: false
            referencedRelation: "v_pagos"
            referencedColumns: ["idPdpDet"]
          },
          {
            foreignKeyName: "public_pagos_idPdpDet_fkey"
            columns: ["idPdpDet"]
            isOneToOne: false
            referencedRelation: "v_pdpdetalle"
            referencedColumns: ["idPdpDet"]
          },
          {
            foreignKeyName: "public_pagos_idPdpDet_fkey"
            columns: ["idPdpDet"]
            isOneToOne: false
            referencedRelation: "v_pdpdetalle2"
            referencedColumns: ["idPdpDet"]
          },
          {
            foreignKeyName: "public_pagos_idPdpDet_fkey"
            columns: ["idPdpDet"]
            isOneToOne: false
            referencedRelation: "zv_pdpDetalleSumAñoMesMonto_Diario"
            referencedColumns: ["idPdpDet"]
          },
        ]
      }
      parametros: {
        Row: {
          fc: string
          id: string
          idShort: string | null
          nombre: string | null
          status: boolean
        }
        Insert: {
          fc?: string
          id: string
          idShort?: string | null
          nombre?: string | null
          status?: boolean
        }
        Update: {
          fc?: string
          id?: string
          idShort?: string | null
          nombre?: string | null
          status?: boolean
        }
        Relationships: []
      }
      parque_responsables: {
        Row: {
          fc: string
          id: string
          idParque: string
          uid: string
          uidr: string | null
        }
        Insert: {
          fc?: string
          id?: string
          idParque: string
          uid: string
          uidr?: string | null
        }
        Update: {
          fc?: string
          id?: string
          idParque?: string
          uid?: string
          uidr?: string | null
        }
        Relationships: []
      }
      parques: {
        Row: {
          direccion: string | null
          esTicket: boolean
          fc: string | null
          idParque: string
          idUser: string | null
          kvasAlta: number
          kvasAltaDisponibles: number
          kvasAltaUtilizados: number | null
          kvasMedia: number
          kvasMediaDisponibles: number
          kvasMediaUtilizados: number | null
          naves: number | null
          nomParque: string | null
          status: boolean | null
        }
        Insert: {
          direccion?: string | null
          esTicket?: boolean
          fc?: string | null
          idParque: string
          idUser?: string | null
          kvasAlta?: number
          kvasAltaDisponibles?: number
          kvasAltaUtilizados?: number | null
          kvasMedia?: number
          kvasMediaDisponibles?: number
          kvasMediaUtilizados?: number | null
          naves?: number | null
          nomParque?: string | null
          status?: boolean | null
        }
        Update: {
          direccion?: string | null
          esTicket?: boolean
          fc?: string | null
          idParque?: string
          idUser?: string | null
          kvasAlta?: number
          kvasAltaDisponibles?: number
          kvasAltaUtilizados?: number | null
          kvasMedia?: number
          kvasMediaDisponibles?: number
          kvasMediaUtilizados?: number | null
          naves?: number | null
          nomParque?: string | null
          status?: boolean | null
        }
        Relationships: []
      }
      pdp: {
        Row: {
          cantpagos: number | null
          Editable: boolean | null
          esTicket: boolean
          fc: string
          frecuencia: string | null
          idPdp: string
          idPropiedad: string | null
          idvendedor: string | null
          monto: number | null
          MontoCompleto: boolean | null
          montoobra: number | null
          montoPagado: number | null
          montoterreno: number | null
          pdpactivo: boolean | null
          status: boolean | null
          uid: string | null
        }
        Insert: {
          cantpagos?: number | null
          Editable?: boolean | null
          esTicket?: boolean
          fc?: string
          frecuencia?: string | null
          idPdp: string
          idPropiedad?: string | null
          idvendedor?: string | null
          monto?: number | null
          MontoCompleto?: boolean | null
          montoobra?: number | null
          montoPagado?: number | null
          montoterreno?: number | null
          pdpactivo?: boolean | null
          status?: boolean | null
          uid?: string | null
        }
        Update: {
          cantpagos?: number | null
          Editable?: boolean | null
          esTicket?: boolean
          fc?: string
          frecuencia?: string | null
          idPdp?: string
          idPropiedad?: string | null
          idvendedor?: string | null
          monto?: number | null
          MontoCompleto?: boolean | null
          montoobra?: number | null
          montoPagado?: number | null
          montoterreno?: number | null
          pdpactivo?: boolean | null
          status?: boolean | null
          uid?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "pdp_idPropiedad_fkey"
            columns: ["idPropiedad"]
            isOneToOne: false
            referencedRelation: "propiedades"
            referencedColumns: ["idPropiedad"]
          },
          {
            foreignKeyName: "pdp_idPropiedad_fkey"
            columns: ["idPropiedad"]
            isOneToOne: false
            referencedRelation: "v_disponibilidad"
            referencedColumns: ["idPropiedad"]
          },
          {
            foreignKeyName: "pdp_idPropiedad_fkey"
            columns: ["idPropiedad"]
            isOneToOne: false
            referencedRelation: "v_propiedades"
            referencedColumns: ["idPropiedad"]
          },
          {
            foreignKeyName: "pdp_idPropiedad_fkey"
            columns: ["idPropiedad"]
            isOneToOne: false
            referencedRelation: "v_propiedadesfide"
            referencedColumns: ["idPropiedad"]
          },
        ]
      }
      pdpDetalle: {
        Row: {
          escriturada: boolean
          fc: string
          fecha: string | null
          fechaEscrituracion: string | null
          idInversionista: string | null
          idNave: string | null
          idPdp: string
          idPdpDet: string
          idPropiedad: string | null
          idVendedor: string | null
          monto: number | null
          numPago: number | null
          pago_fecha: string | null
          pago_monto: number | null
          status: boolean
          tipoPago: string | null
          uid: string
          ultimoPago: boolean | null
          validado_fecha: string | null
          validado_monto: number | null
        }
        Insert: {
          escriturada?: boolean
          fc?: string
          fecha?: string | null
          fechaEscrituracion?: string | null
          idInversionista?: string | null
          idNave?: string | null
          idPdp: string
          idPdpDet: string
          idPropiedad?: string | null
          idVendedor?: string | null
          monto?: number | null
          numPago?: number | null
          pago_fecha?: string | null
          pago_monto?: number | null
          status?: boolean
          tipoPago?: string | null
          uid: string
          ultimoPago?: boolean | null
          validado_fecha?: string | null
          validado_monto?: number | null
        }
        Update: {
          escriturada?: boolean
          fc?: string
          fecha?: string | null
          fechaEscrituracion?: string | null
          idInversionista?: string | null
          idNave?: string | null
          idPdp?: string
          idPdpDet?: string
          idPropiedad?: string | null
          idVendedor?: string | null
          monto?: number | null
          numPago?: number | null
          pago_fecha?: string | null
          pago_monto?: number | null
          status?: boolean
          tipoPago?: string | null
          uid?: string
          ultimoPago?: boolean | null
          validado_fecha?: string | null
          validado_monto?: number | null
        }
        Relationships: [
          {
            foreignKeyName: "pdpDetalle_idPropiedad_fkey"
            columns: ["idPropiedad"]
            isOneToOne: false
            referencedRelation: "propiedades"
            referencedColumns: ["idPropiedad"]
          },
          {
            foreignKeyName: "pdpDetalle_idPropiedad_fkey"
            columns: ["idPropiedad"]
            isOneToOne: false
            referencedRelation: "v_disponibilidad"
            referencedColumns: ["idPropiedad"]
          },
          {
            foreignKeyName: "pdpDetalle_idPropiedad_fkey"
            columns: ["idPropiedad"]
            isOneToOne: false
            referencedRelation: "v_propiedades"
            referencedColumns: ["idPropiedad"]
          },
          {
            foreignKeyName: "pdpDetalle_idPropiedad_fkey"
            columns: ["idPropiedad"]
            isOneToOne: false
            referencedRelation: "v_propiedadesfide"
            referencedColumns: ["idPropiedad"]
          },
          {
            foreignKeyName: "public_pdpDetalle_idPdp_fkey"
            columns: ["idPdp"]
            isOneToOne: false
            referencedRelation: "pdp"
            referencedColumns: ["idPdp"]
          },
        ]
      }
      perfil: {
        Row: {
          fc: string | null
          idUser: string | null
          nivel: number
          nomPerfil: string | null
          status: boolean | null
        }
        Insert: {
          fc?: string | null
          idUser?: string | null
          nivel: number
          nomPerfil?: string | null
          status?: boolean | null
        }
        Update: {
          fc?: string | null
          idUser?: string | null
          nivel?: number
          nomPerfil?: string | null
          status?: boolean | null
        }
        Relationships: []
      }
      PresCategorias: {
        Row: {
          cuenta: string | null
          descripcion: string | null
          FAP: string | null
          fc: string
          idCategoria: string
          presupuestable: boolean
          Presupuesto: number
          seccion: string | null
          status: boolean | null
          UAP: string | null
          uidr: string | null
          uidResponsable: string
        }
        Insert: {
          cuenta?: string | null
          descripcion?: string | null
          FAP?: string | null
          fc?: string
          idCategoria: string
          presupuestable?: boolean
          Presupuesto?: number
          seccion?: string | null
          status?: boolean | null
          UAP?: string | null
          uidr?: string | null
          uidResponsable: string
        }
        Update: {
          cuenta?: string | null
          descripcion?: string | null
          FAP?: string | null
          fc?: string
          idCategoria?: string
          presupuestable?: boolean
          Presupuesto?: number
          seccion?: string | null
          status?: boolean | null
          UAP?: string | null
          uidr?: string | null
          uidResponsable?: string
        }
        Relationships: [
          {
            foreignKeyName: "catCategorias_UAP_fkey"
            columns: ["UAP"]
            isOneToOne: false
            referencedRelation: "catUsers"
            referencedColumns: ["uid"]
          },
          {
            foreignKeyName: "catCategorias_uidResponsable_fkey"
            columns: ["uidResponsable"]
            isOneToOne: false
            referencedRelation: "catUsers"
            referencedColumns: ["uid"]
          },
        ]
      }
      PresDetalle: {
        Row: {
          anio: number
          claveUnica: string
          fc: string
          fua: string | null
          id: number
          idCategoria: string
          idPresupuesto: string
          mes: number
          monto: number
          uidc: string
          uidm: string
        }
        Insert: {
          anio: number
          claveUnica?: string
          fc?: string
          fua?: string | null
          id?: number
          idCategoria: string
          idPresupuesto: string
          mes: number
          monto?: number
          uidc: string
          uidm: string
        }
        Update: {
          anio?: number
          claveUnica?: string
          fc?: string
          fua?: string | null
          id?: number
          idCategoria?: string
          idPresupuesto?: string
          mes?: number
          monto?: number
          uidc?: string
          uidm?: string
        }
        Relationships: [
          {
            foreignKeyName: "PresDetalle_idPresupuesto_fkey"
            columns: ["idPresupuesto"]
            isOneToOne: false
            referencedRelation: "Presupuestos"
            referencedColumns: ["idPresupuesto"]
          },
          {
            foreignKeyName: "Presupuestos_idCategoria_fkey"
            columns: ["idCategoria"]
            isOneToOne: false
            referencedRelation: "PresCategorias"
            referencedColumns: ["idCategoria"]
          },
          {
            foreignKeyName: "Presupuestos_uidc_fkey"
            columns: ["uidc"]
            isOneToOne: false
            referencedRelation: "catUsers"
            referencedColumns: ["uid"]
          },
          {
            foreignKeyName: "Presupuestos_uidm_fkey"
            columns: ["uidm"]
            isOneToOne: false
            referencedRelation: "catUsers"
            referencedColumns: ["uid"]
          },
        ]
      }
      Presupuestos: {
        Row: {
          anio: number
          fc: string
          idPresupuesto: string
          status: boolean
          titulo: string
          uidr: string
        }
        Insert: {
          anio: number
          fc?: string
          idPresupuesto?: string
          status?: boolean
          titulo: string
          uidr?: string
        }
        Update: {
          anio?: number
          fc?: string
          idPresupuesto?: string
          status?: boolean
          titulo?: string
          uidr?: string
        }
        Relationships: [
          {
            foreignKeyName: "Presupuestos_uidr_fkey"
            columns: ["uidr"]
            isOneToOne: false
            referencedRelation: "catUsers"
            referencedColumns: ["uid"]
          },
        ]
      }
      propiedades: {
        Row: {
          esTicket: boolean | null
          fc: string | null
          idInversionista: string
          idNave: string | null
          idParque: string | null
          idPdp: string | null
          idPropiedad: string
          idUser: string | null
          motivoBaja: string | null
          nomDescriptivo: string | null
          PActual: boolean | null
          pdpActivo: boolean
          raPdpActivo: boolean
          rgPdpActivo: boolean
          status: boolean | null
          tienenPdp: boolean
          tieneRaPdp: boolean
          tieneRgPdp: boolean
        }
        Insert: {
          esTicket?: boolean | null
          fc?: string | null
          idInversionista?: string
          idNave?: string | null
          idParque?: string | null
          idPdp?: string | null
          idPropiedad: string
          idUser?: string | null
          motivoBaja?: string | null
          nomDescriptivo?: string | null
          PActual?: boolean | null
          pdpActivo: boolean
          raPdpActivo?: boolean
          rgPdpActivo?: boolean
          status?: boolean | null
          tienenPdp: boolean
          tieneRaPdp?: boolean
          tieneRgPdp?: boolean
        }
        Update: {
          esTicket?: boolean | null
          fc?: string | null
          idInversionista?: string
          idNave?: string | null
          idParque?: string | null
          idPdp?: string | null
          idPropiedad?: string
          idUser?: string | null
          motivoBaja?: string | null
          nomDescriptivo?: string | null
          PActual?: boolean | null
          pdpActivo?: boolean
          raPdpActivo?: boolean
          rgPdpActivo?: boolean
          status?: boolean | null
          tienenPdp?: boolean
          tieneRaPdp?: boolean
          tieneRgPdp?: boolean
        }
        Relationships: [
          {
            foreignKeyName: "propiedades_idInversionista_fkey"
            columns: ["idInversionista"]
            isOneToOne: false
            referencedRelation: "inversionista"
            referencedColumns: ["idInversionista"]
          },
          {
            foreignKeyName: "propiedades_idInversionista_fkey"
            columns: ["idInversionista"]
            isOneToOne: false
            referencedRelation: "v_detClientes"
            referencedColumns: ["idInversionista"]
          },
          {
            foreignKeyName: "propiedades_idInversionista_fkey"
            columns: ["idInversionista"]
            isOneToOne: false
            referencedRelation: "v_pagos"
            referencedColumns: ["idInversionista"]
          },
        ]
      }
      proveedoresDocsCFDI: {
        Row: {
          descripcion: string | null
          fc: string
          idArchivo: string
          idCxp: string | null
          status: boolean
          tipo: number | null
          titulo: string | null
          urldoc: string | null
        }
        Insert: {
          descripcion?: string | null
          fc?: string
          idArchivo: string
          idCxp?: string | null
          status?: boolean
          tipo?: number | null
          titulo?: string | null
          urldoc?: string | null
        }
        Update: {
          descripcion?: string | null
          fc?: string
          idArchivo?: string
          idCxp?: string | null
          status?: boolean
          tipo?: number | null
          titulo?: string | null
          urldoc?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "proveedoresDocsCFDI_idCxp_fkey"
            columns: ["idCxp"]
            isOneToOne: false
            referencedRelation: "cxp"
            referencedColumns: ["idCxp"]
          },
        ]
      }
      raConceptos: {
        Row: {
          concepto: string | null
          fc: string
          idRaConceptos: string
          idRtaA: string | null
          IVA: number | null
          meses: number | null
          mesInicio: number | null
          monto: number | null
          status: boolean | null
          total: number | null
          uid: string | null
        }
        Insert: {
          concepto?: string | null
          fc?: string
          idRaConceptos: string
          idRtaA?: string | null
          IVA?: number | null
          meses?: number | null
          mesInicio?: number | null
          monto?: number | null
          status?: boolean | null
          total?: number | null
          uid?: string | null
        }
        Update: {
          concepto?: string | null
          fc?: string
          idRaConceptos?: string
          idRtaA?: string | null
          IVA?: number | null
          meses?: number | null
          mesInicio?: number | null
          monto?: number | null
          status?: boolean | null
          total?: number | null
          uid?: string | null
        }
        Relationships: []
      }
      raPdp: {
        Row: {
          comSPH: number | null
          duracionRenta: number | null
          fc: string
          fecFin: string | null
          fecInicio: string | null
          idPropiedad: string | null
          idRtaA: string
          m2Construccion: number | null
          precioM2: number | null
          rentaActiva: boolean | null
          rtaAdministrada: number | null
          status: boolean | null
          uid: string | null
        }
        Insert: {
          comSPH?: number | null
          duracionRenta?: number | null
          fc?: string
          fecFin?: string | null
          fecInicio?: string | null
          idPropiedad?: string | null
          idRtaA: string
          m2Construccion?: number | null
          precioM2?: number | null
          rentaActiva?: boolean | null
          rtaAdministrada?: number | null
          status?: boolean | null
          uid?: string | null
        }
        Update: {
          comSPH?: number | null
          duracionRenta?: number | null
          fc?: string
          fecFin?: string | null
          fecInicio?: string | null
          idPropiedad?: string | null
          idRtaA?: string
          m2Construccion?: number | null
          precioM2?: number | null
          rentaActiva?: boolean | null
          rtaAdministrada?: number | null
          status?: boolean | null
          uid?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "raPdp_idPropiedad_fkey"
            columns: ["idPropiedad"]
            isOneToOne: false
            referencedRelation: "propiedades"
            referencedColumns: ["idPropiedad"]
          },
          {
            foreignKeyName: "raPdp_idPropiedad_fkey"
            columns: ["idPropiedad"]
            isOneToOne: false
            referencedRelation: "v_disponibilidad"
            referencedColumns: ["idPropiedad"]
          },
          {
            foreignKeyName: "raPdp_idPropiedad_fkey"
            columns: ["idPropiedad"]
            isOneToOne: false
            referencedRelation: "v_propiedades"
            referencedColumns: ["idPropiedad"]
          },
          {
            foreignKeyName: "raPdp_idPropiedad_fkey"
            columns: ["idPropiedad"]
            isOneToOne: false
            referencedRelation: "v_propiedadesfide"
            referencedColumns: ["idPropiedad"]
          },
        ]
      }
      raPdpDetalle: {
        Row: {
          comentarioPago: string | null
          comentarios: string | null
          comentariosFactura: string | null
          compCFDI: string | null
          concepto: string | null
          fc: string | null
          fecha: string | null
          fechaFactura: string | null
          fechaPago: string | null
          fum: string | null
          idMovBancario: string | null
          idRAdet: string
          idRtaA: string | null
          IVA: number | null
          monto: number | null
          numPago: number | null
          razonRetencion: string | null
          status: boolean | null
          statusPago: boolean | null
          subtotal: number | null
          subtotalComprobante: number | null
          subtotalFactura: number
          total: number | null
          uid: string | null
          uidum: string | null
          uuidCFDI: string | null
        }
        Insert: {
          comentarioPago?: string | null
          comentarios?: string | null
          comentariosFactura?: string | null
          compCFDI?: string | null
          concepto?: string | null
          fc?: string | null
          fecha?: string | null
          fechaFactura?: string | null
          fechaPago?: string | null
          fum?: string | null
          idMovBancario?: string | null
          idRAdet: string
          idRtaA?: string | null
          IVA?: number | null
          monto?: number | null
          numPago?: number | null
          razonRetencion?: string | null
          status?: boolean | null
          statusPago?: boolean | null
          subtotal?: number | null
          subtotalComprobante?: number | null
          subtotalFactura?: number
          total?: number | null
          uid?: string | null
          uidum?: string | null
          uuidCFDI?: string | null
        }
        Update: {
          comentarioPago?: string | null
          comentarios?: string | null
          comentariosFactura?: string | null
          compCFDI?: string | null
          concepto?: string | null
          fc?: string | null
          fecha?: string | null
          fechaFactura?: string | null
          fechaPago?: string | null
          fum?: string | null
          idMovBancario?: string | null
          idRAdet?: string
          idRtaA?: string | null
          IVA?: number | null
          monto?: number | null
          numPago?: number | null
          razonRetencion?: string | null
          status?: boolean | null
          statusPago?: boolean | null
          subtotal?: number | null
          subtotalComprobante?: number | null
          subtotalFactura?: number
          total?: number | null
          uid?: string | null
          uidum?: string | null
          uuidCFDI?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "rgdetalle_idrtag_fkey"
            columns: ["idRtaA"]
            isOneToOne: false
            referencedRelation: "raPdp"
            referencedColumns: ["idRtaA"]
          },
        ]
      }
      reporte_html_parts: {
        Row: {
          contenido: string
          fc: string | null
          id: number
          nombre: string
        }
        Insert: {
          contenido: string
          fc?: string | null
          id?: number
          nombre: string
        }
        Update: {
          contenido?: string
          fc?: string | null
          id?: number
          nombre?: string
        }
        Relationships: []
      }
      rgConceptos: {
        Row: {
          concepto: string | null
          fc: string
          idRgConceptos: string
          idRtaG: string | null
          IVA: number | null
          meses: number | null
          mesInicio: number | null
          monto: number | null
          status: boolean | null
          total: number | null
          uid: string | null
        }
        Insert: {
          concepto?: string | null
          fc?: string
          idRgConceptos: string
          idRtaG?: string | null
          IVA?: number | null
          meses?: number | null
          mesInicio?: number | null
          monto?: number | null
          status?: boolean | null
          total?: number | null
          uid?: string | null
        }
        Update: {
          concepto?: string | null
          fc?: string
          idRgConceptos?: string
          idRtaG?: string | null
          IVA?: number | null
          meses?: number | null
          mesInicio?: number | null
          monto?: number | null
          status?: boolean | null
          total?: number | null
          uid?: string | null
        }
        Relationships: []
      }
      rgPdp: {
        Row: {
          cumpMin: number | null
          duracionRenta: number | null
          estadoRenta: number
          fc: string
          fechaFin: string | null
          fechaInicio: string | null
          idPropiedad: string | null
          idRtaG: string
          incrementoAnual: number | null
          iva: number | null
          m2Construccion: number
          observaciones: string | null
          precioM2: number | null
          proporcional: boolean
          rentaActiva: boolean | null
          status: boolean
          subtotal: number | null
          tasaIVA: number | null
          tieneRg: boolean
          total: number | null
          uid: string
        }
        Insert: {
          cumpMin?: number | null
          duracionRenta?: number | null
          estadoRenta: number
          fc?: string
          fechaFin?: string | null
          fechaInicio?: string | null
          idPropiedad?: string | null
          idRtaG: string
          incrementoAnual?: number | null
          iva?: number | null
          m2Construccion?: number
          observaciones?: string | null
          precioM2?: number | null
          proporcional?: boolean
          rentaActiva?: boolean | null
          status?: boolean
          subtotal?: number | null
          tasaIVA?: number | null
          tieneRg?: boolean
          total?: number | null
          uid: string
        }
        Update: {
          cumpMin?: number | null
          duracionRenta?: number | null
          estadoRenta?: number
          fc?: string
          fechaFin?: string | null
          fechaInicio?: string | null
          idPropiedad?: string | null
          idRtaG?: string
          incrementoAnual?: number | null
          iva?: number | null
          m2Construccion?: number
          observaciones?: string | null
          precioM2?: number | null
          proporcional?: boolean
          rentaActiva?: boolean | null
          status?: boolean
          subtotal?: number | null
          tasaIVA?: number | null
          tieneRg?: boolean
          total?: number | null
          uid?: string
        }
        Relationships: [
          {
            foreignKeyName: "rentaGarantizada_estadoRenta_fkey"
            columns: ["estadoRenta"]
            isOneToOne: false
            referencedRelation: "catEstadosRG"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "rentaGarantizada_idPropiedad_fkey"
            columns: ["idPropiedad"]
            isOneToOne: false
            referencedRelation: "propiedades"
            referencedColumns: ["idPropiedad"]
          },
          {
            foreignKeyName: "rentaGarantizada_idPropiedad_fkey"
            columns: ["idPropiedad"]
            isOneToOne: false
            referencedRelation: "v_disponibilidad"
            referencedColumns: ["idPropiedad"]
          },
          {
            foreignKeyName: "rentaGarantizada_idPropiedad_fkey"
            columns: ["idPropiedad"]
            isOneToOne: false
            referencedRelation: "v_propiedades"
            referencedColumns: ["idPropiedad"]
          },
          {
            foreignKeyName: "rentaGarantizada_idPropiedad_fkey"
            columns: ["idPropiedad"]
            isOneToOne: false
            referencedRelation: "v_propiedadesfide"
            referencedColumns: ["idPropiedad"]
          },
        ]
      }
      rgPdpDetalle: {
        Row: {
          comentarios: string | null
          comentariosFactura: string | null
          comentariosPago: string | null
          compCFDI: string | null
          concepto: string | null
          fc: string | null
          fecha: string | null
          fechaFactura: string | null
          fechaPago: string | null
          fum: string | null
          idMovBancario: string | null
          idRGdet: string
          idRtaG: string | null
          numPago: number | null
          razonRetencion: string | null
          status: boolean | null
          statusPago: boolean | null
          subtotal: number | null
          subtotalComprobante: number | null
          subtotalFactura: number
          uid: string | null
          uidum: string | null
          uuidCFDI: string | null
        }
        Insert: {
          comentarios?: string | null
          comentariosFactura?: string | null
          comentariosPago?: string | null
          compCFDI?: string | null
          concepto?: string | null
          fc?: string | null
          fecha?: string | null
          fechaFactura?: string | null
          fechaPago?: string | null
          fum?: string | null
          idMovBancario?: string | null
          idRGdet: string
          idRtaG?: string | null
          numPago?: number | null
          razonRetencion?: string | null
          status?: boolean | null
          statusPago?: boolean | null
          subtotal?: number | null
          subtotalComprobante?: number | null
          subtotalFactura?: number
          uid?: string | null
          uidum?: string | null
          uuidCFDI?: string | null
        }
        Update: {
          comentarios?: string | null
          comentariosFactura?: string | null
          comentariosPago?: string | null
          compCFDI?: string | null
          concepto?: string | null
          fc?: string | null
          fecha?: string | null
          fechaFactura?: string | null
          fechaPago?: string | null
          fum?: string | null
          idMovBancario?: string | null
          idRGdet?: string
          idRtaG?: string | null
          numPago?: number | null
          razonRetencion?: string | null
          status?: boolean | null
          statusPago?: boolean | null
          subtotal?: number | null
          subtotalComprobante?: number | null
          subtotalFactura?: number
          uid?: string | null
          uidum?: string | null
          uuidCFDI?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "rgdetalle_idrtag_fkey"
            columns: ["idRtaG"]
            isOneToOne: false
            referencedRelation: "rgPdp"
            referencedColumns: ["idRtaG"]
          },
        ]
      }
      segDetallesPlantilla: {
        Row: {
          acceso: boolean
          area: string | null
          clave: number | null
          fc: string | null
          idDetalle: string
          idPlantilla: string
          modulo: string
          seccion: string
          status: boolean
        }
        Insert: {
          acceso?: boolean
          area?: string | null
          clave?: number | null
          fc?: string | null
          idDetalle?: string
          idPlantilla: string
          modulo: string
          seccion: string
          status?: boolean
        }
        Update: {
          acceso?: boolean
          area?: string | null
          clave?: number | null
          fc?: string | null
          idDetalle?: string
          idPlantilla?: string
          modulo?: string
          seccion?: string
          status?: boolean
        }
        Relationships: [
          {
            foreignKeyName: "segDetallesPlantilla_idPlantilla_fkey"
            columns: ["idPlantilla"]
            isOneToOne: false
            referencedRelation: "segPlantillasPermisos"
            referencedColumns: ["idPlantilla"]
          },
        ]
      }
      segModulos: {
        Row: {
          area: string | null
          clave: number
          fc: string
          idsegModulos: string
          modulo: Database["public"]["Enums"]["Modulos"]
          seccion: string
        }
        Insert: {
          area?: string | null
          clave?: number
          fc?: string
          idsegModulos?: string
          modulo: Database["public"]["Enums"]["Modulos"]
          seccion: string
        }
        Update: {
          area?: string | null
          clave?: number
          fc?: string
          idsegModulos?: string
          modulo?: Database["public"]["Enums"]["Modulos"]
          seccion?: string
        }
        Relationships: []
      }
      segModulosUsuarios: {
        Row: {
          acceso: boolean
          area: string | null
          clave: number | null
          fc: string
          idsegModulos: string
          modulo: string
          seccion: string
          uid: string
        }
        Insert: {
          acceso?: boolean
          area?: string | null
          clave?: number | null
          fc?: string
          idsegModulos?: string
          modulo: string
          seccion: string
          uid: string
        }
        Update: {
          acceso?: boolean
          area?: string | null
          clave?: number | null
          fc?: string
          idsegModulos?: string
          modulo?: string
          seccion?: string
          uid?: string
        }
        Relationships: [
          {
            foreignKeyName: "segModulosUsuarios_uid_fkey"
            columns: ["uid"]
            isOneToOne: false
            referencedRelation: "catUsers"
            referencedColumns: ["uid"]
          },
        ]
      }
      segPlantillasPermisos: {
        Row: {
          categoria: string
          descripcion: string | null
          esPublica: boolean
          fc: string | null
          fechaCreacion: string | null
          fechaUltimaModificacion: string | null
          idPlantilla: string
          nombrePlantilla: string
          status: boolean
          uidCreador: string
          uidModificador: string | null
        }
        Insert: {
          categoria?: string
          descripcion?: string | null
          esPublica?: boolean
          fc?: string | null
          fechaCreacion?: string | null
          fechaUltimaModificacion?: string | null
          idPlantilla?: string
          nombrePlantilla: string
          status?: boolean
          uidCreador: string
          uidModificador?: string | null
        }
        Update: {
          categoria?: string
          descripcion?: string | null
          esPublica?: boolean
          fc?: string | null
          fechaCreacion?: string | null
          fechaUltimaModificacion?: string | null
          idPlantilla?: string
          nombrePlantilla?: string
          status?: boolean
          uidCreador?: string
          uidModificador?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "segPlantillasPermisos_uidCreador_fkey"
            columns: ["uidCreador"]
            isOneToOne: false
            referencedRelation: "catUsers"
            referencedColumns: ["uid"]
          },
          {
            foreignKeyName: "segPlantillasPermisos_uidModificador_fkey"
            columns: ["uidModificador"]
            isOneToOne: false
            referencedRelation: "catUsers"
            referencedColumns: ["uid"]
          },
        ]
      }
      seguimientoComentarios: {
        Row: {
          comentario: string | null
          fc: string
          fechaComentario: string | null
          idCliente: string | null
          idComentario: string
          idLead: string | null
          status: boolean | null
          uidr: string | null
        }
        Insert: {
          comentario?: string | null
          fc?: string
          fechaComentario?: string | null
          idCliente?: string | null
          idComentario: string
          idLead?: string | null
          status?: boolean | null
          uidr?: string | null
        }
        Update: {
          comentario?: string | null
          fc?: string
          fechaComentario?: string | null
          idCliente?: string | null
          idComentario?: string
          idLead?: string | null
          status?: boolean | null
          uidr?: string | null
        }
        Relationships: []
      }
      soporte_imagenes: {
        Row: {
          ext: string | null
          fc: string
          id: number
          incidencia: string
          nomArchivo: string | null
          url: string
        }
        Insert: {
          ext?: string | null
          fc?: string
          id?: number
          incidencia: string
          nomArchivo?: string | null
          url: string
        }
        Update: {
          ext?: string | null
          fc?: string
          id?: number
          incidencia?: string
          nomArchivo?: string | null
          url?: string
        }
        Relationships: []
      }
      soporte_seguimiento: {
        Row: {
          comentario: string | null
          fc: string
          id: number
          incidencia: string
          uidc: string
        }
        Insert: {
          comentario?: string | null
          fc?: string
          id?: number
          incidencia: string
          uidc: string
        }
        Update: {
          comentario?: string | null
          fc?: string
          id?: number
          incidencia?: string
          uidc?: string
        }
        Relationships: [
          {
            foreignKeyName: "soporte_seguimiento_incidencia_fkey"
            columns: ["incidencia"]
            isOneToOne: false
            referencedRelation: "soportes"
            referencedColumns: ["insidencia"]
          },
          {
            foreignKeyName: "soporte_seguimiento_uidc_fkey"
            columns: ["uidc"]
            isOneToOne: false
            referencedRelation: "catUsers"
            referencedColumns: ["uid"]
          },
        ]
      }
      soportes: {
        Row: {
          asunto: string | null
          correo: string | null
          descripcion: string | null
          fc: string
          fechaRecepcion: string | null
          finalizado: boolean | null
          id: string
          insidencia: string
          mensaje: string
          nave: string | null
          parque: string | null
          propietario: boolean | null
          reporto: string | null
          status: string
          telefono: string | null
          uid: string | null
        }
        Insert: {
          asunto?: string | null
          correo?: string | null
          descripcion?: string | null
          fc?: string
          fechaRecepcion?: string | null
          finalizado?: boolean | null
          id?: string
          insidencia: string
          mensaje: string
          nave?: string | null
          parque?: string | null
          propietario?: boolean | null
          reporto?: string | null
          status?: string
          telefono?: string | null
          uid?: string | null
        }
        Update: {
          asunto?: string | null
          correo?: string | null
          descripcion?: string | null
          fc?: string
          fechaRecepcion?: string | null
          finalizado?: boolean | null
          id?: string
          insidencia?: string
          mensaje?: string
          nave?: string | null
          parque?: string | null
          propietario?: boolean | null
          reporto?: string | null
          status?: string
          telefono?: string | null
          uid?: string | null
        }
        Relationships: []
      }
      SPHConfiguraciones: {
        Row: {
          created_at: string
          detalle: string | null
          idConfig: string
          parametro: string | null
          status: boolean
          tipo: number
          valor: string | null
        }
        Insert: {
          created_at?: string
          detalle?: string | null
          idConfig?: string
          parametro?: string | null
          status?: boolean
          tipo?: number
          valor?: string | null
        }
        Update: {
          created_at?: string
          detalle?: string | null
          idConfig?: string
          parametro?: string | null
          status?: boolean
          tipo?: number
          valor?: string | null
        }
        Relationships: []
      }
      tareas: {
        Row: {
          Descripcion: string | null
          fc: string
          fechaEntrega: string | null
          id: number
          prioridad: number | null
          publica: boolean | null
          status: boolean | null
          statusTarea: number | null
          titulo: string | null
          uid: string | null
          uidAsignado: string | null
          uidSolicito: string | null
        }
        Insert: {
          Descripcion?: string | null
          fc?: string
          fechaEntrega?: string | null
          id?: number
          prioridad?: number | null
          publica?: boolean | null
          status?: boolean | null
          statusTarea?: number | null
          titulo?: string | null
          uid?: string | null
          uidAsignado?: string | null
          uidSolicito?: string | null
        }
        Update: {
          Descripcion?: string | null
          fc?: string
          fechaEntrega?: string | null
          id?: number
          prioridad?: number | null
          publica?: boolean | null
          status?: boolean | null
          statusTarea?: number | null
          titulo?: string | null
          uid?: string | null
          uidAsignado?: string | null
          uidSolicito?: string | null
        }
        Relationships: []
      }
      tareas_Notas: {
        Row: {
          comentarios: string | null
          fc: string
          id: number
          idTarea: number | null
          uid: string | null
        }
        Insert: {
          comentarios?: string | null
          fc?: string
          id?: number
          idTarea?: number | null
          uid?: string | null
        }
        Update: {
          comentarios?: string | null
          fc?: string
          id?: number
          idTarea?: number | null
          uid?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "public_subTareas_idTarea_fkey"
            columns: ["idTarea"]
            isOneToOne: false
            referencedRelation: "tareas"
            referencedColumns: ["id"]
          },
        ]
      }
      tickets: {
        Row: {
          fc: string
          fecha: string | null
          id: number
          idPropietario: string | null
          monto: number | null
          nave: string | null
          parque: string | null
          status: boolean | null
          uid: string | null
        }
        Insert: {
          fc?: string
          fecha?: string | null
          id?: number
          idPropietario?: string | null
          monto?: number | null
          nave?: string | null
          parque?: string | null
          status?: boolean | null
          uid?: string | null
        }
        Update: {
          fc?: string
          fecha?: string | null
          id?: number
          idPropietario?: string | null
          monto?: number | null
          nave?: string | null
          parque?: string | null
          status?: boolean | null
          uid?: string | null
        }
        Relationships: []
      }
      v2_changelog: {
        Row: {
          cambios: Json
          creadoEn: string
          creadoPor: string | null
          fecha: string
          fum: string | null
          fumUser: string | null
          id: number
          publicada: boolean
          titulo: string | null
          version: string
        }
        Insert: {
          cambios?: Json
          creadoEn?: string
          creadoPor?: string | null
          fecha: string
          fum?: string | null
          fumUser?: string | null
          id?: never
          publicada?: boolean
          titulo?: string | null
          version: string
        }
        Update: {
          cambios?: Json
          creadoEn?: string
          creadoPor?: string | null
          fecha?: string
          fum?: string | null
          fumUser?: string | null
          id?: never
          publicada?: boolean
          titulo?: string | null
          version?: string
        }
        Relationships: []
      }
      v2_invitaciones: {
        Row: {
          agregadoACorreos: boolean
          apellidos: string | null
          creadoEn: string
          email: string
          estado: string
          fecAcepta: string | null
          fecExpira: string
          fum: string | null
          fumUser: string | null
          id: string
          idPerfil: number
          invitadoPor: string | null
          nombre: string | null
          tokenHash: string
          uidCreado: string | null
        }
        Insert: {
          agregadoACorreos?: boolean
          apellidos?: string | null
          creadoEn?: string
          email: string
          estado?: string
          fecAcepta?: string | null
          fecExpira: string
          fum?: string | null
          fumUser?: string | null
          id?: string
          idPerfil?: number
          invitadoPor?: string | null
          nombre?: string | null
          tokenHash: string
          uidCreado?: string | null
        }
        Update: {
          agregadoACorreos?: boolean
          apellidos?: string | null
          creadoEn?: string
          email?: string
          estado?: string
          fecAcepta?: string | null
          fecExpira?: string
          fum?: string | null
          fumUser?: string | null
          id?: string
          idPerfil?: number
          invitadoPor?: string | null
          nombre?: string | null
          tokenHash?: string
          uidCreado?: string | null
        }
        Relationships: []
      }
      v2_cron_ejecuciones: {
        Row: {
          creado_en: string
          detalle: Json | null
          duracion_ms: number | null
          ejecutado_por: string | null
          estado: string
          fin: string | null
          id: number
          inicio: string
          mensaje: string | null
          origen: string
          tarea: string
        }
        Insert: {
          creado_en?: string
          detalle?: Json | null
          duracion_ms?: number | null
          ejecutado_por?: string | null
          estado: string
          fin?: string | null
          id?: never
          inicio?: string
          mensaje?: string | null
          origen?: string
          tarea: string
        }
        Update: {
          creado_en?: string
          detalle?: Json | null
          duracion_ms?: number | null
          ejecutado_por?: string | null
          estado?: string
          fin?: string | null
          id?: never
          inicio?: string
          mensaje?: string | null
          origen?: string
          tarea?: string
        }
        Relationships: []
      }
      v2_soporte_mensajes: {
        Row: {
          escalable: boolean
          fc: string
          modulos_detectados: string[]
          pregunta: string
          respuesta: string
          ruta_origen: string | null
          session_id: string
          tokens_entrada: number | null
          tokens_salida: number | null
          uid_usuario: string
          uuid: string
        }
        Insert: {
          escalable?: boolean
          fc?: string
          modulos_detectados?: string[]
          pregunta: string
          respuesta?: string
          ruta_origen?: string | null
          session_id: string
          tokens_entrada?: number | null
          tokens_salida?: number | null
          uid_usuario: string
          uuid?: string
        }
        Update: {
          escalable?: boolean
          fc?: string
          modulos_detectados?: string[]
          pregunta?: string
          respuesta?: string
          ruta_origen?: string | null
          session_id?: string
          tokens_entrada?: number | null
          tokens_salida?: number | null
          uid_usuario?: string
          uuid?: string
        }
        Relationships: [
          {
            foreignKeyName: "v2_soporte_mensajes_session_id_fkey"
            columns: ["session_id"]
            isOneToOne: false
            referencedRelation: "v2_soporte_sesiones"
            referencedColumns: ["uuid"]
          },
        ]
      }
      v2_soporte_sesiones: {
        Row: {
          fc: string
          fum: string | null
          fumUser: string | null
          status: boolean
          titulo: string | null
          uid_usuario: string
          uuid: string
        }
        Insert: {
          fc?: string
          fum?: string | null
          fumUser?: string | null
          status?: boolean
          titulo?: string | null
          uid_usuario: string
          uuid?: string
        }
        Update: {
          fc?: string
          fum?: string | null
          fumUser?: string | null
          status?: boolean
          titulo?: string | null
          uid_usuario?: string
          uuid?: string
        }
        Relationships: []
      }
      v2_soporte_tickets: {
        Row: {
          asunto: string
          estado: string
          fc: string
          fum: string | null
          fumUser: string | null
          modulo: string | null
          resumen: string
          ruta: string | null
          session_id: string | null
          uid_usuario: string
          uuid: string
        }
        Insert: {
          asunto: string
          estado?: string
          fc?: string
          fum?: string | null
          fumUser?: string | null
          modulo?: string | null
          resumen: string
          ruta?: string | null
          session_id?: string | null
          uid_usuario: string
          uuid?: string
        }
        Update: {
          asunto?: string
          estado?: string
          fc?: string
          fum?: string | null
          fumUser?: string | null
          modulo?: string | null
          resumen?: string
          ruta?: string | null
          session_id?: string | null
          uid_usuario?: string
          uuid?: string
        }
        Relationships: [
          {
            foreignKeyName: "v2_soporte_tickets_session_id_fkey"
            columns: ["session_id"]
            isOneToOne: false
            referencedRelation: "v2_soporte_sesiones"
            referencedColumns: ["uuid"]
          },
        ]
      }
      versiones: {
        Row: {
          actualizaciones: string | null
          fc: string
          id: number
          status: boolean | null
          version: string | null
        }
        Insert: {
          actualizaciones?: string | null
          fc?: string
          id?: number
          status?: boolean | null
          version?: string | null
        }
        Update: {
          actualizaciones?: string | null
          fc?: string
          id?: number
          status?: boolean | null
          version?: string | null
        }
        Relationships: []
      }
    }
    Views: {
      arre_ContratosDosMeses: {
        Row: {
          concepto: string | null
          fecha: string | null
          fecInicio: string | null
          idArrePdp: string | null
          nomDescriptivo: string | null
          numPartida: number | null
          plazo: number | null
        }
        Relationships: []
      }
      crm_Agenda: {
        Row: {
          Aprobado: boolean | null
          correo: string | null
          Etapa: string | null
          fc: string | null
          fechaAgenda: string | null
          fechaContacto: string | null
          fechaRegistro: string | null
          id: string | null
          idAsesorInm: string | null
          idEtapa: number | null
          idInmobiliaria: string | null
          idOrigen: number | null
          idTipoCliente: number | null
          idTipoOperacion: number | null
          idTipoVenta: number | null
          mensaje: string | null
          nombreLead: string | null
          nomRC: string | null
          Origen: string | null
          status: boolean | null
          telefono: string | null
          tipoCliente: string | null
          tipoOperacion: string | null
          tipoVenta: string | null
          uidr: string | null
          uidRC: string | null
          valor: number | null
        }
        Relationships: [
          {
            foreignKeyName: "crm_leads_idOrigen_fkey"
            columns: ["idOrigen"]
            isOneToOne: false
            referencedRelation: "crm_Origen"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "crm_leads_idTipoCliente_fkey"
            columns: ["idTipoCliente"]
            isOneToOne: false
            referencedRelation: "crm_tipoCliente"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "crm_leads_idTipoOperacion_fkey"
            columns: ["idTipoOperacion"]
            isOneToOne: false
            referencedRelation: "crm_tipoOperaciones"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "crm_leads_idTipoVenta_fkey"
            columns: ["idTipoVenta"]
            isOneToOne: false
            referencedRelation: "crm_tipoVenta"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "crm_leads_uidr_fkey"
            columns: ["uidr"]
            isOneToOne: false
            referencedRelation: "catUsers"
            referencedColumns: ["uid"]
          },
          {
            foreignKeyName: "crm_leads_uidRC_fkey"
            columns: ["uidRC"]
            isOneToOne: false
            referencedRelation: "catUsers"
            referencedColumns: ["uid"]
          },
          {
            foreignKeyName: "leads_idAsesorInm_fkey"
            columns: ["idAsesorInm"]
            isOneToOne: false
            referencedRelation: "catAsesoresInm"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "leads_idEtapa_fkey"
            columns: ["idEtapa"]
            isOneToOne: false
            referencedRelation: "crm_Etapas"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "leads_idInmobiliaria_fkey"
            columns: ["idInmobiliaria"]
            isOneToOne: false
            referencedRelation: "catInmobiliarias"
            referencedColumns: ["idInmobiliaria"]
          },
        ]
      }
      lkr_cxp: {
        Row: {
          autorizadoFP: boolean | null
          completada: boolean | null
          concepto: string | null
          cuenta: string | null
          diferido: boolean | null
          estado: string | null
          esUrgente: boolean | null
          fecAutorizacion: string | null
          fecCFDI: string | null
          fechaLimite: string | null
          fecPago: string | null
          fecSolicitud: string | null
          folio: string | null
          lineaCaptura: string | null
          moneda: string | null
          montoAplicado: number | null
          nave: string | null
          nombreProveedor: string | null
          nomCFDI: string | null
          nomGerente: string | null
          numAnio: number | null
          numMes: number | null
          numSem: number | null
          pagoInmediato: boolean | null
          parque: string | null
          rangoSemana: string | null
          referencia: string | null
          seccion: string | null
          subtotal: number | null
          tdc: boolean | null
          tipoOperacion: number | null
          tipoProveedor: number | null
          total: number | null
          ultimoComentario: string | null
        }
        Relationships: []
      }
      n8n_cxp_resumen: {
        Row: {
          apellidos: string | null
          count: number | null
          email: string | null
          estado: string | null
          idEstado: number | null
          nombre: string | null
          uidr: string | null
        }
        Relationships: [
          {
            foreignKeyName: "cxp_uidr_fkey"
            columns: ["uidr"]
            isOneToOne: false
            referencedRelation: "catUsers"
            referencedColumns: ["uid"]
          },
        ]
      }
      n8n_cxp_x_autorizar: {
        Row: {
          apellidos: string | null
          count: number | null
          email: string | null
          estado: string | null
          idEstado: number | null
          nombre: string | null
          uidGerente: string | null
        }
        Relationships: []
      }
      v_actividades_completo: {
        Row: {
          etapa: string | null
          fecha: string | null
          id: string | null
          mensaje: string | null
          nivel_calor: number | null
          nombre: string | null
          nombreLead: string | null
          responsable_comercial: string | null
          tipo_actividad: string | null
        }
        Relationships: []
      }
      v_arrecontratosproximos: {
        Row: {
          concepto: string | null
          fecha: string | null
          fecInicio: string | null
          idArrePdp: string | null
          nomDescriptivo: string | null
          numPartida: number | null
          plazo: number | null
        }
        Relationships: []
      }
      v_arreContratosUnMes: {
        Row: {
          concepto: string | null
          fecha: string | null
          fecInicio: string | null
          idArrePdp: string | null
          nomDescriptivo: string | null
          numPartida: number | null
          plazo: number | null
        }
        Relationships: []
      }
      v_arreNavConPdp: {
        Row: {
          construccionM2: number | null
          deposito: number | null
          fecInicio: string | null
          idArrendador: string | null
          idArrePdp: string | null
          idNavArrend: string | null
          INPC: number | null
          INPCPlus: number | null
          pdpActivo: boolean | null
          plazo: number | null
          pm2Admin: number | null
          pm2Mtto: number | null
          pm2Vig: number | null
          precioM2: number | null
          rtaBase: number | null
          tienePdp: boolean | null
        }
        Relationships: [
          {
            foreignKeyName: "arrendadasNaves_idArrendatario_fkey"
            columns: ["idArrendador"]
            isOneToOne: false
            referencedRelation: "inversionista"
            referencedColumns: ["idInversionista"]
          },
          {
            foreignKeyName: "arrendadasNaves_idArrendatario_fkey"
            columns: ["idArrendador"]
            isOneToOne: false
            referencedRelation: "v_detClientes"
            referencedColumns: ["idInversionista"]
          },
          {
            foreignKeyName: "arrendadasNaves_idArrendatario_fkey"
            columns: ["idArrendador"]
            isOneToOne: false
            referencedRelation: "v_pagos"
            referencedColumns: ["idInversionista"]
          },
        ]
      }
      v_arrendadasNaves: {
        Row: {
          Arrendada: boolean | null
          construccion: number | null
          esTicket: boolean | null
          FecUP: string | null
          idArrendadoPdp: string | null
          idArrendatario: string | null
          idNavArrend: string | null
          idNave: string | null
          idParque: string | null
          lote: number | null
          mza: number | null
          nomDescriptivo: string | null
          nomParque: string | null
          numNave: number | null
          numNaveNAME: string | null
          pdpActivo: boolean | null
          precio: number | null
          situacion: string | null
          terreno: number | null
          tienePdp: boolean | null
        }
        Relationships: [
          {
            foreignKeyName: "arrendadasNaves_idArrendatario_fkey"
            columns: ["idArrendatario"]
            isOneToOne: false
            referencedRelation: "inversionista"
            referencedColumns: ["idInversionista"]
          },
          {
            foreignKeyName: "arrendadasNaves_idArrendatario_fkey"
            columns: ["idArrendatario"]
            isOneToOne: false
            referencedRelation: "v_detClientes"
            referencedColumns: ["idInversionista"]
          },
          {
            foreignKeyName: "arrendadasNaves_idArrendatario_fkey"
            columns: ["idArrendatario"]
            isOneToOne: false
            referencedRelation: "v_pagos"
            referencedColumns: ["idInversionista"]
          },
          {
            foreignKeyName: "arrendadasNaves_idNave_fkey"
            columns: ["idNave"]
            isOneToOne: false
            referencedRelation: "naves"
            referencedColumns: ["idNave"]
          },
          {
            foreignKeyName: "arrendadasNaves_idNave_fkey"
            columns: ["idNave"]
            isOneToOne: false
            referencedRelation: "v_disponibilidad"
            referencedColumns: ["idNave"]
          },
          {
            foreignKeyName: "arrendadasNaves_idNave_fkey"
            columns: ["idNave"]
            isOneToOne: false
            referencedRelation: "v_naves"
            referencedColumns: ["idNave"]
          },
          {
            foreignKeyName: "arrendadasNaves_idParque_fkey"
            columns: ["idParque"]
            isOneToOne: false
            referencedRelation: "parques"
            referencedColumns: ["idParque"]
          },
          {
            foreignKeyName: "arrendadasNaves_idParque_fkey"
            columns: ["idParque"]
            isOneToOne: false
            referencedRelation: "v_pdpdetalle"
            referencedColumns: ["idParque"]
          },
          {
            foreignKeyName: "arrendadasNaves_idParque_fkey"
            columns: ["idParque"]
            isOneToOne: false
            referencedRelation: "v_pdpdetalle2"
            referencedColumns: ["idParque"]
          },
        ]
      }
      v_arrenPdpMes: {
        Row: {
          anio: number | null
          balance: number | null
          cantidad: number | null
          concepto: string | null
          fecha: string | null
          idArrePdp: string | null
          idArrePdpDet: string | null
          mes: number | null
          nomDescriptivo: string | null
          razonsocial: string | null
        }
        Relationships: [
          {
            foreignKeyName: "arrepdpdetalle_idarrepdp_fkey"
            columns: ["idArrePdp"]
            isOneToOne: false
            referencedRelation: "arre_ContratosDosMeses"
            referencedColumns: ["idArrePdp"]
          },
          {
            foreignKeyName: "arrepdpdetalle_idarrepdp_fkey"
            columns: ["idArrePdp"]
            isOneToOne: false
            referencedRelation: "arrePdp"
            referencedColumns: ["idArrePdp"]
          },
          {
            foreignKeyName: "arrepdpdetalle_idarrepdp_fkey"
            columns: ["idArrePdp"]
            isOneToOne: false
            referencedRelation: "v_arrecontratosproximos"
            referencedColumns: ["idArrePdp"]
          },
          {
            foreignKeyName: "arrepdpdetalle_idarrepdp_fkey"
            columns: ["idArrePdp"]
            isOneToOne: false
            referencedRelation: "v_arreContratosUnMes"
            referencedColumns: ["idArrePdp"]
          },
          {
            foreignKeyName: "arrepdpdetalle_idarrepdp_fkey"
            columns: ["idArrePdp"]
            isOneToOne: false
            referencedRelation: "v_ContratosTresMeses"
            referencedColumns: ["idArrePdp"]
          },
        ]
      }
      v_arrenPdpMesTotales: {
        Row: {
          anio: number | null
          balance: number | null
          cantidad: number | null
          concepto: string | null
          fecha: string | null
          idArrePdp: string | null
          idArrePdpDet: string | null
          mes: number | null
          nomDescriptivo: string | null
          numPartida: number | null
          razonsocial: string | null
        }
        Relationships: []
      }
      v_arrepdpdet_totales: {
        Row: {
          anio: number | null
          ciclo: number | null
          constM2: number | null
          fecha: string | null
          idArrePdp: string | null
          INPC: number | null
          numPartida: number | null
          pm2: number | null
          ptsINPC: number | null
          total_cantidad: number | null
          totalINPC: number | null
        }
        Relationships: [
          {
            foreignKeyName: "arrepdpdetalle_idarrepdp_fkey"
            columns: ["idArrePdp"]
            isOneToOne: false
            referencedRelation: "arre_ContratosDosMeses"
            referencedColumns: ["idArrePdp"]
          },
          {
            foreignKeyName: "arrepdpdetalle_idarrepdp_fkey"
            columns: ["idArrePdp"]
            isOneToOne: false
            referencedRelation: "arrePdp"
            referencedColumns: ["idArrePdp"]
          },
          {
            foreignKeyName: "arrepdpdetalle_idarrepdp_fkey"
            columns: ["idArrePdp"]
            isOneToOne: false
            referencedRelation: "v_arrecontratosproximos"
            referencedColumns: ["idArrePdp"]
          },
          {
            foreignKeyName: "arrepdpdetalle_idarrepdp_fkey"
            columns: ["idArrePdp"]
            isOneToOne: false
            referencedRelation: "v_arreContratosUnMes"
            referencedColumns: ["idArrePdp"]
          },
          {
            foreignKeyName: "arrepdpdetalle_idarrepdp_fkey"
            columns: ["idArrePdp"]
            isOneToOne: false
            referencedRelation: "v_ContratosTresMeses"
            referencedColumns: ["idArrePdp"]
          },
        ]
      }
      v_autorizaciones: {
        Row: {
          autorizacion: string | null
          fAutorizacion: string | null
          fc: string | null
          idAutorizaciones: number | null
          idReferencia: string | null
          justificacion: string | null
          nivelAutorizacion: number | null
          nombre_autorizador: string | null
          nombre_solicitante: string | null
          pantalla: string | null
          status: boolean | null
          statusAutorizacion: number | null
          uidAutorizo: string | null
          uidSolicito: string | null
        }
        Relationships: []
      }
      v_box_cumpl_pdp: {
        Row: {
          anio: number | null
          cantidad_pagos: number | null
          estado_pago: string | null
          mes: number | null
          monto_pagado: number | null
          monto_programado: number | null
          pdpActivo: boolean | null
        }
        Relationships: []
      }
      v_comentarios: {
        Row: {
          comentario: string | null
          fc: string | null
          idPago: string | null
          idPdpDet: string | null
          status: boolean | null
          uid: string | null
          usuario: string | null
        }
        Relationships: []
      }
      v_configPdpDet: {
        Row: {
          cantpagos: number | null
          fecha: string | null
          idNave: string | null
          idPdp: string | null
          idPdpDet: string | null
          idPropiedad: string | null
          monto: number | null
          numPago: number | null
          pagos: number | null
          tienePagos: boolean | null
          tipoPago: string | null
        }
        Relationships: [
          {
            foreignKeyName: "pdpDetalle_idPropiedad_fkey"
            columns: ["idPropiedad"]
            isOneToOne: false
            referencedRelation: "propiedades"
            referencedColumns: ["idPropiedad"]
          },
          {
            foreignKeyName: "pdpDetalle_idPropiedad_fkey"
            columns: ["idPropiedad"]
            isOneToOne: false
            referencedRelation: "v_disponibilidad"
            referencedColumns: ["idPropiedad"]
          },
          {
            foreignKeyName: "pdpDetalle_idPropiedad_fkey"
            columns: ["idPropiedad"]
            isOneToOne: false
            referencedRelation: "v_propiedades"
            referencedColumns: ["idPropiedad"]
          },
          {
            foreignKeyName: "pdpDetalle_idPropiedad_fkey"
            columns: ["idPropiedad"]
            isOneToOne: false
            referencedRelation: "v_propiedadesfide"
            referencedColumns: ["idPropiedad"]
          },
          {
            foreignKeyName: "public_pdpDetalle_idPdp_fkey"
            columns: ["idPdp"]
            isOneToOne: false
            referencedRelation: "pdp"
            referencedColumns: ["idPdp"]
          },
        ]
      }
      v_ContratosTresMeses: {
        Row: {
          concepto: string | null
          fecha: string | null
          fecInicio: string | null
          idArrePdp: string | null
          nomDescriptivo: string | null
          numPartida: number | null
          plazo: number | null
        }
        Relationships: []
      }
      v_detClientes: {
        Row: {
          apellido1: string | null
          apellido2: string | null
          arrendatario: boolean | null
          correo: string | null
          correo_empresa: string | null
          CURP: string | null
          fecNacimiento: string | null
          giro: string | null
          idContpac: string | null
          idEmpresa: string | null
          idInversionista: string | null
          inversionista: boolean | null
          nombre: string | null
          NomComercial: string | null
          personalidad_empresa: number | null
          personalidad_inversionista: string | null
          pruebas: boolean | null
          razonsocial_empresa: string | null
          razonsocial_inversionista: string | null
          regimen: number | null
          rfc_empresa: string | null
          rfc_inversionista: string | null
          telefono: string | null
          ticket: boolean | null
          tipoCliente: string | null
          usoCFDI: string | null
          web: string | null
        }
        Relationships: [
          {
            foreignKeyName: "catEmpresas_regimen_fkey"
            columns: ["regimen"]
            isOneToOne: false
            referencedRelation: "catRegimenFiscal"
            referencedColumns: ["clave"]
          },
          {
            foreignKeyName: "catEmpresas_usoCFDI_fkey"
            columns: ["usoCFDI"]
            isOneToOne: false
            referencedRelation: "catUsoCFDI"
            referencedColumns: ["clave"]
          },
        ]
      }
      v_disponibilidad: {
        Row: {
          construccion: number | null
          idInversionista: string | null
          idNave: string | null
          idParque: string | null
          idPropiedad: string | null
          lote: number | null
          mza: number | null
          nombre: string | null
          nomParque: string | null
          numNave: number | null
          numNaveNAME: string | null
          situacion: string | null
          terreno: number | null
        }
        Relationships: [
          {
            foreignKeyName: "propiedades_idInversionista_fkey"
            columns: ["idInversionista"]
            isOneToOne: false
            referencedRelation: "inversionista"
            referencedColumns: ["idInversionista"]
          },
          {
            foreignKeyName: "propiedades_idInversionista_fkey"
            columns: ["idInversionista"]
            isOneToOne: false
            referencedRelation: "v_detClientes"
            referencedColumns: ["idInversionista"]
          },
          {
            foreignKeyName: "propiedades_idInversionista_fkey"
            columns: ["idInversionista"]
            isOneToOne: false
            referencedRelation: "v_pagos"
            referencedColumns: ["idInversionista"]
          },
          {
            foreignKeyName: "public_naves_idParque_fkey"
            columns: ["idParque"]
            isOneToOne: false
            referencedRelation: "parques"
            referencedColumns: ["idParque"]
          },
          {
            foreignKeyName: "public_naves_idParque_fkey"
            columns: ["idParque"]
            isOneToOne: false
            referencedRelation: "v_pdpdetalle"
            referencedColumns: ["idParque"]
          },
          {
            foreignKeyName: "public_naves_idParque_fkey"
            columns: ["idParque"]
            isOneToOne: false
            referencedRelation: "v_pdpdetalle2"
            referencedColumns: ["idParque"]
          },
        ]
      }
      v_fideicomiso: {
        Row: {
          Apartado: number | null
          bloque: string | null
          cantpagos: number | null
          comentarios: string | null
          fecha: string | null
          idfide: string | null
          idInversionista: string | null
          idPropiedad: string | null
          Medio: string | null
          monto: number | null
          noAdhesion: string | null
          nomDescriptivo: string | null
          PM: string | null
          razonsocial: string | null
          rendimiento: number | null
          uid: string | null
        }
        Relationships: [
          {
            foreignKeyName: "fideCondiciones_idPropiedad_fkey"
            columns: ["idPropiedad"]
            isOneToOne: true
            referencedRelation: "propiedades"
            referencedColumns: ["idPropiedad"]
          },
          {
            foreignKeyName: "fideCondiciones_idPropiedad_fkey"
            columns: ["idPropiedad"]
            isOneToOne: true
            referencedRelation: "v_disponibilidad"
            referencedColumns: ["idPropiedad"]
          },
          {
            foreignKeyName: "fideCondiciones_idPropiedad_fkey"
            columns: ["idPropiedad"]
            isOneToOne: true
            referencedRelation: "v_propiedades"
            referencedColumns: ["idPropiedad"]
          },
          {
            foreignKeyName: "fideCondiciones_idPropiedad_fkey"
            columns: ["idPropiedad"]
            isOneToOne: true
            referencedRelation: "v_propiedadesfide"
            referencedColumns: ["idPropiedad"]
          },
          {
            foreignKeyName: "fideCondiciones_uid_fkey"
            columns: ["uid"]
            isOneToOne: false
            referencedRelation: "catUsers"
            referencedColumns: ["uid"]
          },
          {
            foreignKeyName: "propiedades_idInversionista_fkey"
            columns: ["idInversionista"]
            isOneToOne: false
            referencedRelation: "inversionista"
            referencedColumns: ["idInversionista"]
          },
          {
            foreignKeyName: "propiedades_idInversionista_fkey"
            columns: ["idInversionista"]
            isOneToOne: false
            referencedRelation: "v_detClientes"
            referencedColumns: ["idInversionista"]
          },
          {
            foreignKeyName: "propiedades_idInversionista_fkey"
            columns: ["idInversionista"]
            isOneToOne: false
            referencedRelation: "v_pagos"
            referencedColumns: ["idInversionista"]
          },
        ]
      }
      v_leads_completo: {
        Row: {
          correo: string | null
          etapa: string | null
          fecha_creacion: string | null
          lead_id: string | null
          lead_status: boolean | null
          nombreLead: string | null
          origen: string | null
          responsable_comercial: string | null
          telefono: string | null
          tipo_cliente: string | null
          tipo_operacion: string | null
          tipo_venta: string | null
          valor: number | null
        }
        Relationships: []
      }
      v_montoTotalAnual: {
        Row: {
          monto: number | null
          pdpActivo: boolean | null
          year: number | null
        }
        Relationships: []
      }
      v_naves: {
        Row: {
          construccion: number | null
          fc: string | null
          fecEntrega: string | null
          fum: string | null
          fumUser: string | null
          idArrendador: string | null
          idInversionista: string | null
          idNave: string | null
          idParque: string | null
          idUser: string | null
          lote: number | null
          mza: number | null
          nomDescriptivo: string | null
          nomParque: string | null
          numNave: number | null
          numNaveNAME: string | null
          pdpActivo: boolean | null
          precio: number | null
          razonsocial: string | null
          situacion: string | null
          status: boolean | null
          terreno: number | null
          tienePdp: boolean | null
        }
        Relationships: [
          {
            foreignKeyName: "public_naves_idParque_fkey"
            columns: ["idParque"]
            isOneToOne: false
            referencedRelation: "parques"
            referencedColumns: ["idParque"]
          },
          {
            foreignKeyName: "public_naves_idParque_fkey"
            columns: ["idParque"]
            isOneToOne: false
            referencedRelation: "v_pdpdetalle"
            referencedColumns: ["idParque"]
          },
          {
            foreignKeyName: "public_naves_idParque_fkey"
            columns: ["idParque"]
            isOneToOne: false
            referencedRelation: "v_pdpdetalle2"
            referencedColumns: ["idParque"]
          },
        ]
      }
      v_pagos: {
        Row: {
          anio: number | null
          balance: number | null
          descuentos: number | null
          fecha: string | null
          fecha_pagos: string | null
          idInversionista: string | null
          idNave: string | null
          idPdp: string | null
          idPdpDet: string | null
          idPropiedad: string | null
          mes: number | null
          monto: number | null
          montototal: number | null
          nomDescriptivo: string | null
          nomParque: string | null
          numPago: number | null
          pagos: number | null
          pagos_acumulados: number | null
          pagos_construccion: number | null
          pagos_terreno: number | null
          pagos_ticket: number | null
          pdpActivo: boolean | null
          porcentaje_avance: number | null
          razonsocial: string | null
          tipoPago: string | null
          ultimoPago: boolean | null
        }
        Relationships: [
          {
            foreignKeyName: "pdpDetalle_idPropiedad_fkey"
            columns: ["idPropiedad"]
            isOneToOne: false
            referencedRelation: "propiedades"
            referencedColumns: ["idPropiedad"]
          },
          {
            foreignKeyName: "pdpDetalle_idPropiedad_fkey"
            columns: ["idPropiedad"]
            isOneToOne: false
            referencedRelation: "v_disponibilidad"
            referencedColumns: ["idPropiedad"]
          },
          {
            foreignKeyName: "pdpDetalle_idPropiedad_fkey"
            columns: ["idPropiedad"]
            isOneToOne: false
            referencedRelation: "v_propiedades"
            referencedColumns: ["idPropiedad"]
          },
          {
            foreignKeyName: "pdpDetalle_idPropiedad_fkey"
            columns: ["idPropiedad"]
            isOneToOne: false
            referencedRelation: "v_propiedadesfide"
            referencedColumns: ["idPropiedad"]
          },
          {
            foreignKeyName: "public_pdpDetalle_idPdp_fkey"
            columns: ["idPdp"]
            isOneToOne: false
            referencedRelation: "pdp"
            referencedColumns: ["idPdp"]
          },
        ]
      }
      v_pagostotalanual: {
        Row: {
          pagos: number | null
          year: number | null
        }
        Relationships: []
      }
      v_pagosTotalAnual: {
        Row: {
          pagos: number | null
          year: number | null
        }
        Relationships: []
      }
      v_pdpdetalle: {
        Row: {
          anio: number | null
          avance: number | null
          balance: number | null
          construccion: number | null
          dias_vencimiento: number | null
          esTicket: boolean | null
          fecha: string | null
          idInversionista: string | null
          idNave: string | null
          idParque: string | null
          idPdp: string | null
          idPdpDet: string | null
          idPropiedad: string | null
          mes: number | null
          montoTotal: number | null
          nomParque: string | null
          nompropiedad: string | null
          numPago: number | null
          pago_fecha: string | null
          pago_vencido: boolean | null
          pdpactivo: boolean | null
          pdpActivo: boolean | null
          razonsocial: string | null
          suma_monto: number | null
          suma_pago_monto: number | null
          terreno: number | null
          ticket: number | null
          tipoPago: string | null
        }
        Relationships: [
          {
            foreignKeyName: "pdpDetalle_idPropiedad_fkey"
            columns: ["idPropiedad"]
            isOneToOne: false
            referencedRelation: "propiedades"
            referencedColumns: ["idPropiedad"]
          },
          {
            foreignKeyName: "pdpDetalle_idPropiedad_fkey"
            columns: ["idPropiedad"]
            isOneToOne: false
            referencedRelation: "v_disponibilidad"
            referencedColumns: ["idPropiedad"]
          },
          {
            foreignKeyName: "pdpDetalle_idPropiedad_fkey"
            columns: ["idPropiedad"]
            isOneToOne: false
            referencedRelation: "v_propiedades"
            referencedColumns: ["idPropiedad"]
          },
          {
            foreignKeyName: "pdpDetalle_idPropiedad_fkey"
            columns: ["idPropiedad"]
            isOneToOne: false
            referencedRelation: "v_propiedadesfide"
            referencedColumns: ["idPropiedad"]
          },
          {
            foreignKeyName: "public_pdpDetalle_idPdp_fkey"
            columns: ["idPdp"]
            isOneToOne: false
            referencedRelation: "pdp"
            referencedColumns: ["idPdp"]
          },
        ]
      }
      v_pdpdetalle_old: {
        Row: {
          anio: number | null
          balance: number | null
          construccion: number | null
          dias_vencimiento: number | null
          fecha: string | null
          idInversionista: string | null
          idNave: string | null
          idPdp: string | null
          idPropiedad: string | null
          mes: number | null
          nompropiedad: string | null
          numPago: number | null
          pago_fecha: string | null
          pago_vencido: boolean | null
          pdpactivo: boolean | null
          razonsocial: string | null
          suma_monto: number | null
          suma_pago_monto: number | null
          terreno: number | null
          ticket: number | null
          tipoPago: string | null
        }
        Relationships: [
          {
            foreignKeyName: "pdpDetalle_idPropiedad_fkey"
            columns: ["idPropiedad"]
            isOneToOne: false
            referencedRelation: "propiedades"
            referencedColumns: ["idPropiedad"]
          },
          {
            foreignKeyName: "pdpDetalle_idPropiedad_fkey"
            columns: ["idPropiedad"]
            isOneToOne: false
            referencedRelation: "v_disponibilidad"
            referencedColumns: ["idPropiedad"]
          },
          {
            foreignKeyName: "pdpDetalle_idPropiedad_fkey"
            columns: ["idPropiedad"]
            isOneToOne: false
            referencedRelation: "v_propiedades"
            referencedColumns: ["idPropiedad"]
          },
          {
            foreignKeyName: "pdpDetalle_idPropiedad_fkey"
            columns: ["idPropiedad"]
            isOneToOne: false
            referencedRelation: "v_propiedadesfide"
            referencedColumns: ["idPropiedad"]
          },
          {
            foreignKeyName: "public_pdpDetalle_idPdp_fkey"
            columns: ["idPdp"]
            isOneToOne: false
            referencedRelation: "pdp"
            referencedColumns: ["idPdp"]
          },
        ]
      }
      v_pdpdetalle2: {
        Row: {
          anio: number | null
          avance: number | null
          balance: number | null
          construccion: number | null
          dias_vencimiento: number | null
          esTicket: boolean | null
          fecha: string | null
          idInversionista: string | null
          idNave: string | null
          idParque: string | null
          idPdp: string | null
          idPdpDet: string | null
          idPropiedad: string | null
          mes: number | null
          montoTotal: number | null
          nomParque: string | null
          nompropiedad: string | null
          numPago: number | null
          pago_fecha: string | null
          pago_vencido: boolean | null
          pdpactivo: boolean | null
          razonsocial: string | null
          suma_monto: number | null
          suma_pago_monto: number | null
          terreno: number | null
          ticket: number | null
          tipoPago: string | null
        }
        Relationships: [
          {
            foreignKeyName: "pdpDetalle_idPropiedad_fkey"
            columns: ["idPropiedad"]
            isOneToOne: false
            referencedRelation: "propiedades"
            referencedColumns: ["idPropiedad"]
          },
          {
            foreignKeyName: "pdpDetalle_idPropiedad_fkey"
            columns: ["idPropiedad"]
            isOneToOne: false
            referencedRelation: "v_disponibilidad"
            referencedColumns: ["idPropiedad"]
          },
          {
            foreignKeyName: "pdpDetalle_idPropiedad_fkey"
            columns: ["idPropiedad"]
            isOneToOne: false
            referencedRelation: "v_propiedades"
            referencedColumns: ["idPropiedad"]
          },
          {
            foreignKeyName: "pdpDetalle_idPropiedad_fkey"
            columns: ["idPropiedad"]
            isOneToOne: false
            referencedRelation: "v_propiedadesfide"
            referencedColumns: ["idPropiedad"]
          },
          {
            foreignKeyName: "public_pdpDetalle_idPdp_fkey"
            columns: ["idPdp"]
            isOneToOne: false
            referencedRelation: "pdp"
            referencedColumns: ["idPdp"]
          },
        ]
      }
      v_pdpdetalletotales_2: {
        Row: {
          anio: number | null
          construccion: number | null
          mes: number | null
          suma_monto: number | null
          tereno: number | null
        }
        Relationships: []
      }
      v_propiedades: {
        Row: {
          arreConstruccionM2: number | null
          arreFecFin: string | null
          arreFecIni: string | null
          arrendador: string | null
          arrePlazo: number | null
          arreTienePdp: boolean | null
          arreVigente: boolean | null
          avance_porcentaje: number | null
          construccion: number | null
          esTicket: boolean | null
          idInversionista: string | null
          idNave: string | null
          idParque: string | null
          idPdp: string | null
          idPropiedad: string | null
          lote: number | null
          mza: number | null
          nomDescriptivo: string | null
          nominversionista: string | null
          nomparque: string | null
          numnave: number | null
          pdpActivo: boolean | null
          raPdpActivo: boolean | null
          rgPdpActivo: boolean | null
          situacion: string | null
          terreno: number | null
          tienenPdp: boolean | null
          tieneRaPdp: boolean | null
          tieneRgPdp: boolean | null
          totalpagos: number | null
          totalpdp: number | null
        }
        Relationships: [
          {
            foreignKeyName: "propiedades_idInversionista_fkey"
            columns: ["idInversionista"]
            isOneToOne: false
            referencedRelation: "inversionista"
            referencedColumns: ["idInversionista"]
          },
          {
            foreignKeyName: "propiedades_idInversionista_fkey"
            columns: ["idInversionista"]
            isOneToOne: false
            referencedRelation: "v_detClientes"
            referencedColumns: ["idInversionista"]
          },
          {
            foreignKeyName: "propiedades_idInversionista_fkey"
            columns: ["idInversionista"]
            isOneToOne: false
            referencedRelation: "v_pagos"
            referencedColumns: ["idInversionista"]
          },
        ]
      }
      v_propiedadesfide: {
        Row: {
          avance_porcentaje: number | null
          construccion: number | null
          esTicket: boolean | null
          fc: string | null
          idInversionista: string | null
          idNave: string | null
          idParque: string | null
          idPdp: string | null
          idPropiedad: string | null
          idUser: string | null
          lote: number | null
          mza: number | null
          nomDescriptivo: string | null
          nominversionista: string | null
          nomparque: string | null
          numnave: number | null
          pdpActivo: boolean | null
          raPdpActivo: boolean | null
          rgPdpActivo: boolean | null
          situacion: string | null
          terreno: number | null
          tienenPdp: boolean | null
          tieneRaPdp: boolean | null
          tieneRgPdp: boolean | null
          totalpagos: number | null
          totalpdp: number | null
        }
        Relationships: [
          {
            foreignKeyName: "propiedades_idInversionista_fkey"
            columns: ["idInversionista"]
            isOneToOne: false
            referencedRelation: "inversionista"
            referencedColumns: ["idInversionista"]
          },
          {
            foreignKeyName: "propiedades_idInversionista_fkey"
            columns: ["idInversionista"]
            isOneToOne: false
            referencedRelation: "v_detClientes"
            referencedColumns: ["idInversionista"]
          },
          {
            foreignKeyName: "propiedades_idInversionista_fkey"
            columns: ["idInversionista"]
            isOneToOne: false
            referencedRelation: "v_pagos"
            referencedColumns: ["idInversionista"]
          },
        ]
      }
      v_rentasAdministradas: {
        Row: {
          balance: number | null
          balanceFiltrado: number | null
          balanceMes: number | null
          balancePropiedad: number | null
          comentarios: string | null
          comentariosFactura: string | null
          comentariosPago: string | null
          comision: number | null
          compCFDI: string | null
          compTransf: string | null
          concepto: string | null
          construccion: number | null
          duracionRenta: number | null
          fc: string | null
          fecha: string | null
          fechaFactura: string | null
          fechaFin: string | null
          fechaInicio: string | null
          fechaPago: string | null
          idInversionista: string | null
          idPropiedad: string | null
          idRAdet: string | null
          idRtaA: string | null
          mes: number | null
          monto: number | null
          nombreCompleto: string | null
          nomDescriptivo: string | null
          numPago: number | null
          precioM2: number | null
          razonRetencion: string | null
          razonsocial: string | null
          rentaActiva: boolean | null
          status: boolean | null
          statusPago: boolean | null
          subtotal: number | null
          subtotalComprobante: number | null
          subtotalFactura: number | null
          sumatoriaMeses: number | null
          sumatoriaPagos: number | null
          sumaTotalSubtotal: number | null
          totalMontoFiltrado: number | null
          totalMontoPropiedad: number | null
          totalPagoFiltrado: number | null
          totalPagoPropiedad: number | null
          uid: string | null
          uidr: string | null
          yearExtraido: number | null
        }
        Relationships: [
          {
            foreignKeyName: "propiedades_idInversionista_fkey"
            columns: ["idInversionista"]
            isOneToOne: false
            referencedRelation: "inversionista"
            referencedColumns: ["idInversionista"]
          },
          {
            foreignKeyName: "propiedades_idInversionista_fkey"
            columns: ["idInversionista"]
            isOneToOne: false
            referencedRelation: "v_detClientes"
            referencedColumns: ["idInversionista"]
          },
          {
            foreignKeyName: "propiedades_idInversionista_fkey"
            columns: ["idInversionista"]
            isOneToOne: false
            referencedRelation: "v_pagos"
            referencedColumns: ["idInversionista"]
          },
          {
            foreignKeyName: "raPdp_idPropiedad_fkey"
            columns: ["idPropiedad"]
            isOneToOne: false
            referencedRelation: "propiedades"
            referencedColumns: ["idPropiedad"]
          },
          {
            foreignKeyName: "raPdp_idPropiedad_fkey"
            columns: ["idPropiedad"]
            isOneToOne: false
            referencedRelation: "v_disponibilidad"
            referencedColumns: ["idPropiedad"]
          },
          {
            foreignKeyName: "raPdp_idPropiedad_fkey"
            columns: ["idPropiedad"]
            isOneToOne: false
            referencedRelation: "v_propiedades"
            referencedColumns: ["idPropiedad"]
          },
          {
            foreignKeyName: "raPdp_idPropiedad_fkey"
            columns: ["idPropiedad"]
            isOneToOne: false
            referencedRelation: "v_propiedadesfide"
            referencedColumns: ["idPropiedad"]
          },
          {
            foreignKeyName: "rgdetalle_idrtag_fkey"
            columns: ["idRtaA"]
            isOneToOne: false
            referencedRelation: "raPdp"
            referencedColumns: ["idRtaA"]
          },
        ]
      }
      v_rentascombinadas: {
        Row: {
          balance: number | null
          balanceFiltrado: number | null
          balanceMes: number | null
          balancePropiedad: number | null
          comentarios: string | null
          comentariosFactura: string | null
          comentariosPago: string | null
          comision: number | null
          compCFDI: string | null
          compTransf: string | null
          concepto: string | null
          construccion: number | null
          duracionRenta: number | null
          estadoRenta: number | null
          fc: string | null
          fecha: string | null
          fechaFactura: string | null
          fechaFin: string | null
          fechaInicio: string | null
          fechaPago: string | null
          idInversionista: string | null
          idPropiedad: string | null
          idRAdet: string | null
          idRGdet: string | null
          idRtaA: string | null
          idRtaG: string | null
          mes: number | null
          monto: number | null
          nombreCompleto: string | null
          nomDescriptivo: string | null
          numPago: number | null
          precioM2: number | null
          razonRetencion: string | null
          razonsocial: string | null
          rentaActiva: boolean | null
          status: boolean | null
          statusPago: boolean | null
          subtotalComprobante: number | null
          subtotalFactura: number | null
          sumatoriaMeses: number | null
          sumatoriaPagos: number | null
          sumaTotalSubtotal: number | null
          tasaIVA: number | null
          tipo_renta: string | null
          totalMontoFiltrado: number | null
          totalMontoPropiedad: number | null
          totalPagoFiltrado: number | null
          totalPagoPropiedad: number | null
          uid: string | null
          uidr: string | null
          uuidCFDI: string | null
          yearExtraido: number | null
        }
        Relationships: [
          {
            foreignKeyName: "propiedades_idInversionista_fkey"
            columns: ["idInversionista"]
            isOneToOne: false
            referencedRelation: "inversionista"
            referencedColumns: ["idInversionista"]
          },
          {
            foreignKeyName: "propiedades_idInversionista_fkey"
            columns: ["idInversionista"]
            isOneToOne: false
            referencedRelation: "v_detClientes"
            referencedColumns: ["idInversionista"]
          },
          {
            foreignKeyName: "propiedades_idInversionista_fkey"
            columns: ["idInversionista"]
            isOneToOne: false
            referencedRelation: "v_pagos"
            referencedColumns: ["idInversionista"]
          },
          {
            foreignKeyName: "rentaGarantizada_estadoRenta_fkey"
            columns: ["estadoRenta"]
            isOneToOne: false
            referencedRelation: "catEstadosRG"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "rentaGarantizada_idPropiedad_fkey"
            columns: ["idPropiedad"]
            isOneToOne: false
            referencedRelation: "propiedades"
            referencedColumns: ["idPropiedad"]
          },
          {
            foreignKeyName: "rentaGarantizada_idPropiedad_fkey"
            columns: ["idPropiedad"]
            isOneToOne: false
            referencedRelation: "v_disponibilidad"
            referencedColumns: ["idPropiedad"]
          },
          {
            foreignKeyName: "rentaGarantizada_idPropiedad_fkey"
            columns: ["idPropiedad"]
            isOneToOne: false
            referencedRelation: "v_propiedades"
            referencedColumns: ["idPropiedad"]
          },
          {
            foreignKeyName: "rentaGarantizada_idPropiedad_fkey"
            columns: ["idPropiedad"]
            isOneToOne: false
            referencedRelation: "v_propiedadesfide"
            referencedColumns: ["idPropiedad"]
          },
          {
            foreignKeyName: "rgdetalle_idrtag_fkey"
            columns: ["idRtaG"]
            isOneToOne: false
            referencedRelation: "rgPdp"
            referencedColumns: ["idRtaG"]
          },
        ]
      }
      v_rentasCombinadas: {
        Row: {
          balance: number | null
          balanceFiltrado: number | null
          balanceMes: number | null
          balancePropiedad: number | null
          comentarios: string | null
          comentariosFactura: string | null
          comentariosPago: string | null
          comision: number | null
          compCFDI: string | null
          compTransf: string | null
          concepto: string | null
          construccion: number | null
          duracionRenta: number | null
          estadoRenta: number | null
          fc: string | null
          fecha: string | null
          fechaFactura: string | null
          fechaFin: string | null
          fechaInicio: string | null
          fechaPago: string | null
          idInversionista: string | null
          idPropiedad: string | null
          idRAdet: string | null
          idRGdet: string | null
          idRtaA: string | null
          idRtaG: string | null
          mes: number | null
          monto: number | null
          nombreCompleto: string | null
          nomDescriptivo: string | null
          numPago: number | null
          precioM2: number | null
          razonRetencion: string | null
          razonsocial: string | null
          rentaActiva: boolean | null
          status: boolean | null
          statusPago: boolean | null
          subtotalComprobante: number | null
          subtotalFactura: number | null
          sumatoriaMeses: number | null
          sumatoriaPagos: number | null
          sumaTotalSubtotal: number | null
          tasaIVA: number | null
          tipo_renta: string | null
          totalMontoFiltrado: number | null
          totalMontoPropiedad: number | null
          totalPagoFiltrado: number | null
          totalPagoPropiedad: number | null
          uid: string | null
          uidr: string | null
          uuidCFDI: string | null
          yearExtraido: number | null
        }
        Relationships: []
      }
      v_rentascombinadas_respaldo: {
        Row: {
          balance: number | null
          balanceFiltrado: number | null
          balanceMes: number | null
          balancePropiedad: number | null
          comentarios: string | null
          comentariosFactura: string | null
          comentariosPago: string | null
          comision: number | null
          compCFDI: string | null
          compTransf: string | null
          concepto: string | null
          construccion: number | null
          duracionRenta: number | null
          estadoRenta: number | null
          fc: string | null
          fecha: string | null
          fechaFactura: string | null
          fechaFin: string | null
          fechaInicio: string | null
          fechaPago: string | null
          idInversionista: string | null
          idPropiedad: string | null
          idRAdet: string | null
          idRGdet: string | null
          idRtaA: string | null
          idRtaG: string | null
          mes: number | null
          monto: number | null
          nombreCompleto: string | null
          nomDescriptivo: string | null
          numPago: number | null
          precioM2: number | null
          razonRetencion: string | null
          razonsocial: string | null
          rentaActiva: boolean | null
          status: boolean | null
          statusPago: boolean | null
          subtotalComprobante: number | null
          subtotalFactura: number | null
          sumatoriaMeses: number | null
          sumatoriaPagos: number | null
          sumaTotalSubtotal: number | null
          tasaIVA: number | null
          tipo_renta: string | null
          totalMontoFiltrado: number | null
          totalMontoPropiedad: number | null
          totalPagoFiltrado: number | null
          totalPagoPropiedad: number | null
          uid: string | null
          uidr: string | null
          yearExtraido: number | null
        }
        Relationships: []
      }
      v_rentasGarantizadas: {
        Row: {
          balance: number | null
          balanceFiltrado: number | null
          balanceMes: number | null
          balancePropiedad: number | null
          comentarios: string | null
          comentariosFactura: string | null
          comentariosPago: string | null
          compCFDI: string | null
          compTransf: string | null
          concepto: string | null
          construccion: number | null
          duracionRenta: number | null
          estadoRenta: number | null
          fc: string | null
          fecha: string | null
          fechaFactura: string | null
          fechaFin: string | null
          fechaInicio: string | null
          fechaPago: string | null
          idInversionista: string | null
          idPropiedad: string | null
          idRGdet: string | null
          idRtaG: string | null
          mes: number | null
          monto: number | null
          nombreCompleto: string | null
          nomDescriptivo: string | null
          numPago: number | null
          observaciones: string | null
          precioM2: number | null
          razonRetencion: string | null
          razonsocial: string | null
          rentaActiva: boolean | null
          status: boolean | null
          statusPago: boolean | null
          subtotal: number | null
          subtotalComprobante: number | null
          subtotalFactura: number | null
          sumatoriaMeses: number | null
          sumatoriaPagos: number | null
          sumaTotalSubtotal: number | null
          tasaIVA: number | null
          totalMontoFiltrado: number | null
          totalMontoPropiedad: number | null
          totalPagoFiltrado: number | null
          totalPagoPropiedad: number | null
          uid: string | null
          uidr: string | null
          yearExtraido: number | null
        }
        Relationships: [
          {
            foreignKeyName: "propiedades_idInversionista_fkey"
            columns: ["idInversionista"]
            isOneToOne: false
            referencedRelation: "inversionista"
            referencedColumns: ["idInversionista"]
          },
          {
            foreignKeyName: "propiedades_idInversionista_fkey"
            columns: ["idInversionista"]
            isOneToOne: false
            referencedRelation: "v_detClientes"
            referencedColumns: ["idInversionista"]
          },
          {
            foreignKeyName: "propiedades_idInversionista_fkey"
            columns: ["idInversionista"]
            isOneToOne: false
            referencedRelation: "v_pagos"
            referencedColumns: ["idInversionista"]
          },
          {
            foreignKeyName: "rentaGarantizada_estadoRenta_fkey"
            columns: ["estadoRenta"]
            isOneToOne: false
            referencedRelation: "catEstadosRG"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "rentaGarantizada_idPropiedad_fkey"
            columns: ["idPropiedad"]
            isOneToOne: false
            referencedRelation: "propiedades"
            referencedColumns: ["idPropiedad"]
          },
          {
            foreignKeyName: "rentaGarantizada_idPropiedad_fkey"
            columns: ["idPropiedad"]
            isOneToOne: false
            referencedRelation: "v_disponibilidad"
            referencedColumns: ["idPropiedad"]
          },
          {
            foreignKeyName: "rentaGarantizada_idPropiedad_fkey"
            columns: ["idPropiedad"]
            isOneToOne: false
            referencedRelation: "v_propiedades"
            referencedColumns: ["idPropiedad"]
          },
          {
            foreignKeyName: "rentaGarantizada_idPropiedad_fkey"
            columns: ["idPropiedad"]
            isOneToOne: false
            referencedRelation: "v_propiedadesfide"
            referencedColumns: ["idPropiedad"]
          },
          {
            foreignKeyName: "rgdetalle_idrtag_fkey"
            columns: ["idRtaG"]
            isOneToOne: false
            referencedRelation: "rgPdp"
            referencedColumns: ["idRtaG"]
          },
        ]
      }
      v_ResumenPagos: {
        Row: {
          anio: number | null
          cantidad_pagos: number | null
          diferencia: number | null
          estado_pago: string | null
          mes: number | null
          porcentaje_cumplimiento: number | null
          total_monto_programado: number | null
          total_pagos_realizados: number | null
        }
        Relationships: []
      }
      v_resumenpresupuesto: {
        Row: {
          avance_acumulado: number | null
          avance_comprometido: number | null
          avance_total: number | null
          avance_vs_anual: number | null
          dentro_presupuesto: boolean | null
          disponible_acumulado: number | null
          disponible_anual: number | null
          disponible_real: number | null
          estado_acumulado: string | null
          estado_comprometido: string | null
          estado_vs_anual: string | null
          idCategoria: string | null
          meses_restantes: number | null
          presupuestable: boolean | null
          presupuesto_acumulado: number | null
          presupuesto_mensual_restante: number | null
          presupuesto_total_anual: number | null
          promedio_mensual_gastado: number | null
          proyeccion_gasto_anual: number | null
          status: boolean | null
          subtotal_comprometido: number | null
          subtotal_gastado: number | null
          tipo_categoria: string | null
          total_gastado_comprometido: number | null
          transacciones_autorizadas: number | null
          transacciones_comprometidas: number | null
        }
        Relationships: []
      }
      v_resumenPresupuesto: {
        Row: {
          avance_acumulado: number | null
          avance_comprometido: number | null
          avance_total: number | null
          avance_vs_anual: number | null
          dentro_presupuesto: boolean | null
          disponible_acumulado: number | null
          disponible_anual: number | null
          disponible_real: number | null
          estado_acumulado: string | null
          estado_comprometido: string | null
          estado_vs_anual: string | null
          idCategoria: string | null
          meses_restantes: number | null
          presupuestable: boolean | null
          presupuesto_acumulado: number | null
          presupuesto_mensual_restante: number | null
          presupuesto_total_anual: number | null
          promedio_mensual_gastado: number | null
          proyeccion_gasto_anual: number | null
          status: boolean | null
          subtotal_comprometido: number | null
          subtotal_gastado: number | null
          tipo_categoria: string | null
          total_gastado_comprometido: number | null
          transacciones_autorizadas: number | null
          transacciones_comprometidas: number | null
        }
        Relationships: []
      }
      v_resumenPresupuesto_backup_20250820: {
        Row: {
          avance: number | null
          idCategoria: string | null
          presupuesto: number | null
          subtotal: number | null
        }
        Relationships: [
          {
            foreignKeyName: "Presupuestos_idCategoria_fkey"
            columns: ["idCategoria"]
            isOneToOne: false
            referencedRelation: "PresCategorias"
            referencedColumns: ["idCategoria"]
          },
        ]
      }
      v_sumMontosTotalesPagos: {
        Row: {
          construccion: number | null
          idPropiedad: string | null
          pagos: number | null
          pagos_terreno: number | null
          ticket: number | null
        }
        Relationships: [
          {
            foreignKeyName: "pagos_idPropiedad_fkey"
            columns: ["idPropiedad"]
            isOneToOne: false
            referencedRelation: "propiedades"
            referencedColumns: ["idPropiedad"]
          },
          {
            foreignKeyName: "pagos_idPropiedad_fkey"
            columns: ["idPropiedad"]
            isOneToOne: false
            referencedRelation: "v_disponibilidad"
            referencedColumns: ["idPropiedad"]
          },
          {
            foreignKeyName: "pagos_idPropiedad_fkey"
            columns: ["idPropiedad"]
            isOneToOne: false
            referencedRelation: "v_propiedades"
            referencedColumns: ["idPropiedad"]
          },
          {
            foreignKeyName: "pagos_idPropiedad_fkey"
            columns: ["idPropiedad"]
            isOneToOne: false
            referencedRelation: "v_propiedadesfide"
            referencedColumns: ["idPropiedad"]
          },
        ]
      }
      v_sumMontosTotalesPdpDet: {
        Row: {
          cantpagos: number | null
          diferencia_monto: number | null
          idInversionista: string | null
          idNave: string | null
          idPdp: string | null
          idPropiedad: string | null
          idVendedor: string | null
          monto: number | null
          monto_completo: number | null
          montos_son_iguales: boolean | null
          nomDescriptivo: string | null
          pdpActivo: boolean | null
          razonsocial: string | null
        }
        Relationships: [
          {
            foreignKeyName: "pdpDetalle_idPropiedad_fkey"
            columns: ["idPropiedad"]
            isOneToOne: false
            referencedRelation: "propiedades"
            referencedColumns: ["idPropiedad"]
          },
          {
            foreignKeyName: "pdpDetalle_idPropiedad_fkey"
            columns: ["idPropiedad"]
            isOneToOne: false
            referencedRelation: "v_disponibilidad"
            referencedColumns: ["idPropiedad"]
          },
          {
            foreignKeyName: "pdpDetalle_idPropiedad_fkey"
            columns: ["idPropiedad"]
            isOneToOne: false
            referencedRelation: "v_propiedades"
            referencedColumns: ["idPropiedad"]
          },
          {
            foreignKeyName: "pdpDetalle_idPropiedad_fkey"
            columns: ["idPropiedad"]
            isOneToOne: false
            referencedRelation: "v_propiedadesfide"
            referencedColumns: ["idPropiedad"]
          },
          {
            foreignKeyName: "public_pdpDetalle_idPdp_fkey"
            columns: ["idPdp"]
            isOneToOne: false
            referencedRelation: "pdp"
            referencedColumns: ["idPdp"]
          },
        ]
      }
      v_totalanual: {
        Row: {
          pagos: number | null
          year: number | null
        }
        Relationships: []
      }
      v_totales: {
        Row: {
          balance: number | null
          construccion: number | null
          diferencia_monto: number | null
          idInversionista: string | null
          idNave: string | null
          idPdp: string | null
          idPropiedad: string | null
          idVendedor: string | null
          monto: number | null
          monto_completo: number | null
          montos_son_iguales: boolean | null
          nomDescriptivo: string | null
          pagos: number | null
          pagos_terreno: number | null
          pdpActivo: boolean | null
          razonsocial: string | null
          ticket: number | null
        }
        Relationships: [
          {
            foreignKeyName: "pdpDetalle_idPropiedad_fkey"
            columns: ["idPropiedad"]
            isOneToOne: false
            referencedRelation: "propiedades"
            referencedColumns: ["idPropiedad"]
          },
          {
            foreignKeyName: "pdpDetalle_idPropiedad_fkey"
            columns: ["idPropiedad"]
            isOneToOne: false
            referencedRelation: "v_disponibilidad"
            referencedColumns: ["idPropiedad"]
          },
          {
            foreignKeyName: "pdpDetalle_idPropiedad_fkey"
            columns: ["idPropiedad"]
            isOneToOne: false
            referencedRelation: "v_propiedades"
            referencedColumns: ["idPropiedad"]
          },
          {
            foreignKeyName: "pdpDetalle_idPropiedad_fkey"
            columns: ["idPropiedad"]
            isOneToOne: false
            referencedRelation: "v_propiedadesfide"
            referencedColumns: ["idPropiedad"]
          },
          {
            foreignKeyName: "public_pdpDetalle_idPdp_fkey"
            columns: ["idPdp"]
            isOneToOne: false
            referencedRelation: "pdp"
            referencedColumns: ["idPdp"]
          },
        ]
      }
      v_Totales_Anual_Mes: {
        Row: {
          anio: number | null
          balance: number | null
          construccion: number | null
          descuentos: number | null
          mes: number | null
          pdpActivo: boolean | null
          suma_monto: number | null
          terreno: number | null
          ticket: number | null
          TotalPagos: number | null
        }
        Relationships: []
      }
      vista_pdpdetalle: {
        Row: {
          anio: number | null
          balance: number | null
          fecha: string | null
          idInversionista: string | null
          idNave: string | null
          idPdp: string | null
          idPropiedad: string | null
          mes: number | null
          nompropiedad: string | null
          numPago: number | null
          pago_fecha: string | null
          pdpactivo: boolean | null
          razonsocial: string | null
          suma_monto: number | null
          suma_pago_monto: number | null
          suma_validado_monto: number | null
          validado_fecha: string | null
        }
        Relationships: [
          {
            foreignKeyName: "pdpDetalle_idPropiedad_fkey"
            columns: ["idPropiedad"]
            isOneToOne: false
            referencedRelation: "propiedades"
            referencedColumns: ["idPropiedad"]
          },
          {
            foreignKeyName: "pdpDetalle_idPropiedad_fkey"
            columns: ["idPropiedad"]
            isOneToOne: false
            referencedRelation: "v_disponibilidad"
            referencedColumns: ["idPropiedad"]
          },
          {
            foreignKeyName: "pdpDetalle_idPropiedad_fkey"
            columns: ["idPropiedad"]
            isOneToOne: false
            referencedRelation: "v_propiedades"
            referencedColumns: ["idPropiedad"]
          },
          {
            foreignKeyName: "pdpDetalle_idPropiedad_fkey"
            columns: ["idPropiedad"]
            isOneToOne: false
            referencedRelation: "v_propiedadesfide"
            referencedColumns: ["idPropiedad"]
          },
          {
            foreignKeyName: "public_pdpDetalle_idPdp_fkey"
            columns: ["idPdp"]
            isOneToOne: false
            referencedRelation: "pdp"
            referencedColumns: ["idPdp"]
          },
        ]
      }
      zv_pagosSumAñoMesMonto: {
        Row: {
          anio: number | null
          construccion: number | null
          id: string | null
          mes: number | null
          pdpActivo: boolean | null
          terreno: number | null
          ticket: number | null
          TotalPagos: number | null
        }
        Relationships: []
      }
      zv_pagosSumAñoMesMonto_Diario: {
        Row: {
          anio: number | null
          construccion: number | null
          id: string | null
          idPdpDet: string | null
          mes: number | null
          pago_fecha: string | null
          pdpActivo: boolean | null
          suma_pago_monto: number | null
          terreno: number | null
          ticket: number | null
        }
        Relationships: [
          {
            foreignKeyName: "public_pagos_idPdpDet_fkey"
            columns: ["idPdpDet"]
            isOneToOne: false
            referencedRelation: "pdpDetalle"
            referencedColumns: ["idPdpDet"]
          },
          {
            foreignKeyName: "public_pagos_idPdpDet_fkey"
            columns: ["idPdpDet"]
            isOneToOne: false
            referencedRelation: "v_configPdpDet"
            referencedColumns: ["idPdpDet"]
          },
          {
            foreignKeyName: "public_pagos_idPdpDet_fkey"
            columns: ["idPdpDet"]
            isOneToOne: false
            referencedRelation: "v_pagos"
            referencedColumns: ["idPdpDet"]
          },
          {
            foreignKeyName: "public_pagos_idPdpDet_fkey"
            columns: ["idPdpDet"]
            isOneToOne: false
            referencedRelation: "v_pdpdetalle"
            referencedColumns: ["idPdpDet"]
          },
          {
            foreignKeyName: "public_pagos_idPdpDet_fkey"
            columns: ["idPdpDet"]
            isOneToOne: false
            referencedRelation: "v_pdpdetalle2"
            referencedColumns: ["idPdpDet"]
          },
          {
            foreignKeyName: "public_pagos_idPdpDet_fkey"
            columns: ["idPdpDet"]
            isOneToOne: false
            referencedRelation: "zv_pdpDetalleSumAñoMesMonto_Diario"
            referencedColumns: ["idPdpDet"]
          },
        ]
      }
      zv_pdpDetalleSumAñoMesMonto: {
        Row: {
          anio: number | null
          id: string | null
          mes: number | null
          pdpActivo: boolean | null
          suma_monto: number | null
        }
        Relationships: []
      }
      zv_pdpDetalleSumAñoMesMonto_Diario: {
        Row: {
          anio: number | null
          fecha: string | null
          id: string | null
          idInversionista: string | null
          idNave: string | null
          idPdp: string | null
          idPdpDet: string | null
          idPropiedad: string | null
          mes: number | null
          nompropiedad: string | null
          numPago: number | null
          pdpActivo: boolean | null
          razonsocial: string | null
          suma_monto: number | null
          tipoPago: string | null
        }
        Relationships: [
          {
            foreignKeyName: "pdpDetalle_idPropiedad_fkey"
            columns: ["idPropiedad"]
            isOneToOne: false
            referencedRelation: "propiedades"
            referencedColumns: ["idPropiedad"]
          },
          {
            foreignKeyName: "pdpDetalle_idPropiedad_fkey"
            columns: ["idPropiedad"]
            isOneToOne: false
            referencedRelation: "v_disponibilidad"
            referencedColumns: ["idPropiedad"]
          },
          {
            foreignKeyName: "pdpDetalle_idPropiedad_fkey"
            columns: ["idPropiedad"]
            isOneToOne: false
            referencedRelation: "v_propiedades"
            referencedColumns: ["idPropiedad"]
          },
          {
            foreignKeyName: "pdpDetalle_idPropiedad_fkey"
            columns: ["idPropiedad"]
            isOneToOne: false
            referencedRelation: "v_propiedadesfide"
            referencedColumns: ["idPropiedad"]
          },
          {
            foreignKeyName: "public_pdpDetalle_idPdp_fkey"
            columns: ["idPdp"]
            isOneToOne: false
            referencedRelation: "pdp"
            referencedColumns: ["idPdp"]
          },
        ]
      }
    }
    Functions: {
      trasladar_saldo_pdp: {
        Args: { p_origen: string; p_destino: string; p_monto: number }
        Returns: { nuevo_origen: number; nuevo_destino: number }[]
      }
      actualizar_anios_planes_nuevos: { Args: never; Returns: undefined }
      actualizar_ciclo_plan_pago: { Args: never; Returns: undefined }
      actualizar_inpc_por_ciclo: {
        Args: { ciclo_inicio: number; nuevo_inpc: number }
        Returns: {
          planes_afectados: number
          registros_actualizados: number
        }[]
      }
      actualizar_inpc_todos_los_planes: { Args: never; Returns: undefined }
      aplicar_pago_arrendatario: {
        Args: { p_fec_pago: string; p_idmov: string; p_ids_detalle: string[] }
        Returns: undefined
      }
      desaplicar_pago_arrendatario: {
        Args: { p_idmov: string; p_ids_detalle: string[] }
        Returns: undefined
      }
      arrepdp_actualizar_vigencia: { Args: never; Returns: Json }
      arrepdp_agregar_concepto_financiado: {
        Args: {
          p_concepto: string
          p_dividir?: boolean
          p_id_arre_pdp: string
          p_mes_inicio: number
          p_monto_financiar: number
          p_periodo: number
        }
        Returns: Json
      }
      arrepdp_aplicar_incremento_inpc: {
        Args: {
          p_anio: number
          p_id_arre_pdp: string
          p_id_inpc: string
          p_inpc: number
        }
        Returns: Json
      }
      arrepdp_crear_plan_completo_rpc: {
        Args: {
          p_construccion_m2: number
          p_cortesia_admin?: number
          p_cortesia_mtto?: number
          p_cortesia_renta?: number
          p_cortesia_vig?: number
          p_deposito: number
          p_fec_inicio: string
          p_id_arrendador: string
          p_id_nav_arrend: string
          p_inpc?: number
          p_inpc_plus?: number
          p_plazo: number
          p_pm2_admin?: number
          p_pm2_mtto?: number
          p_pm2_vig?: number
          p_precio_m2: number
          p_uid: string
        }
        Returns: Json
      }
      arrepdp_crear_plan_simple_rpc: {
        Args: {
          p_construccion_m2: number
          p_deposito: number
          p_fec_inicio: string
          p_id_arrendador: string
          p_id_nav_arrend: string
          p_inpc_plus?: number
          p_mes_gracia_administracion?: number
          p_mes_gracia_mantenimiento?: number
          p_mes_gracia_renta?: number
          p_mes_gracia_vigilancia?: number
          p_moneda?: string
          p_plazo: number
          p_pm2_admin?: number
          p_pm2_mtto?: number
          p_pm2_vig?: number
          p_precio_m2: number
          p_uid: string
        }
        Returns: Json
      }
      arrepdp_desvincular_propiedades: { Args: never; Returns: undefined }
      arrepdp_eliminar_plan_con_restricciones: {
        Args: { p_id_arre_pdp: string }
        Returns: Json
      }
      arrepdp_generar_corrida_desde_plan_simple: {
        Args: {
          p_id_arre_pdp: string
          p_inpc_adicional?: number
          p_pts_inpc_adicional?: number
        }
        Returns: Json
      }
      arrepdp_generar_detalle_desde_plan: {
        Args: { p_id_arre_pdp: string }
        Returns: Json
      }
      arrepdp_listar_contratos_ciclo_inpc: {
        Args: { p_anio: number; p_mes: number }
        Returns: {
          arrendatario: string
          ciclo: number
          fecFin: string
          fecInicio: string
          idArrePdp: string
          idNavArrend: string
          Moneda: string
          plazo: number
          rtaBase: number
          vigente: boolean
        }[]
      }
      arrepdp_revertir_incremento_inpc: {
        Args: {
          p_anio: number
          p_id_arre_pdp: string
          p_previo: Json
        }
        Returns: Json
      }
      arrepdpdetalle_actualizar_campo_manual: {
        Args: {
          p_anio_desde: number
          p_concepto: string
          p_id_arre_pdp: string
          p_nombre_campo: string
          p_valor: number
        }
        Returns: Json
      }
      arrepdpdetalle_actualizar_inpc: {
        Args: { id_arrepdp: string }
        Returns: {
          anio_aplicado: number
          error: string
          id_inpc_usado: string
          inpc_aplicado: number
          registros_actualizados: number
        }[]
      }
      arrepdpdetalle_actualizar_inpc_desde_anio: {
        Args: { anio_inicio: number; id_arrepdp: string }
        Returns: {
          anio_aplicado: number
          error: string
          id_inpc_usado: string
          inpc_aplicado: number
          registros_actualizados: number
        }[]
      }
      arrepdpdetalle_actualizar_pm2_con_inpc_acumulado: {
        Args: { id_arrepdp: string }
        Returns: {
          anio_procesado: number
          error: string
          inpc_aplicado: number
          pm2_anterior: number
          pm2_nuevo: number
          registros_actualizados: number
        }[]
      }
      arrepdpdetalle_aplicar_meses_gracia: {
        Args: { p_idarrepdp: string }
        Returns: undefined
      }
      arrepdpdetalle_calcular_anio_por_plan: {
        Args: { id_arrepdp: string }
        Returns: undefined
      }
      arrepdpdetalle_generar_plan_completo: {
        Args: {
          p_construccion_m2: number
          p_cortesia_admin?: number
          p_cortesia_mtto?: number
          p_cortesia_renta?: number
          p_cortesia_vig?: number
          p_deposito: number
          p_fec_inicio: string
          p_id_arre_pdp: string
          p_id_arrendador: string
          p_inpc: number
          p_inpc_plus: number
          p_plazo: number
          p_pm2_admin: number
          p_pm2_mtto: number
          p_pm2_vig: number
          p_precio_m2: number
          p_uid: string
        }
        Returns: Json
      }
      arrepdpdetalle_obtener_resumen_por_plan: {
        Args: { p_idarrepdp: string; p_validar?: boolean }
        Returns: {
          anio: number
          ciclo: number
          constM2: number
          fecha: string
          idArrePdp: string
          INPC: number
          numPartida: number
          pdpactivo: boolean
          pm2: number
          ptsINPC: number
          total_cantidad: number
          totalINPC: number
        }[]
      }
      arrepdpdetalle_recalcular_anos_contrato: {
        Args: { id_contrato: string }
        Returns: Json
      }
      arrepdpdetalle_recalcular_todas_cantidades: { Args: never; Returns: Json }
      catasesoresinm_obtener_por_codigo: {
        Args: { p_codigo: string }
        Returns: {
          idInmobiliaria: string
          nombre: string
          status: boolean
          uidr: string
          uuid: string
        }[]
      }
      catasoresinm_validar_telefono: {
        Args: { p_telefono: string }
        Returns: string
      }
      catcategorias_insert_presdetalle_por_mes: {
        Args: { id_categoria: string; id_presupuesto: string }
        Returns: undefined
      }
      catusers_aplicar_banneo: {
        Args: {
          aplicar_banneo: boolean
          motivo?: string
          uid_admin: string
          uid_usuario: string
        }
        Returns: Json
      }
      catusers_gestionar_permisos_usuario: {
        Args: {
          area_permiso: string
          otorgar_acceso: boolean
          uid_admin: string
          uid_usuario: string
        }
        Returns: Json
      }
      catusers_insertar_modulos_usuario: {
        Args: { usuario_uid: string }
        Returns: Json
      }
      catusers_insertar_usuario: {
        Args: {
          p_apellidos: string
          p_email: string
          p_id_perfil?: number
          p_nombre: string
          p_telefono: string
          p_uid: string
        }
        Returns: Json
      }
      catusers_obtener_estado_banneo: {
        Args: { uid_usuario: string }
        Returns: {
          esta_baneado: boolean
          estado_actual: string
          total_movimientos: number
          ultima_accion: string
          ultima_fecha: string
          ultimo_admin: string
          ultimo_motivo: string
          ultimo_movimiento_id: number
        }[]
      }
      catusers_obtener_historial_banneo: {
        Args: { uid_usuario: string }
        Returns: {
          accion: string
          admin: string
          fecha: string
          id: number
          motivo: string
        }[]
      }
      catusers_validar_permiso:
        | {
            Args: { area_permiso: string; uid_usuario: string }
            Returns: boolean
          }
        | {
            Args: { clave_permiso: number; uid_usuario: string }
            Returns: boolean
          }
      cdg: {
        Args: { p_encrypted_query: string; p_partial_key: string }
        Returns: Json
      }
      cfdi_insertar_comprobante_completo: {
        Args: {
          p_certificado: string
          p_conceptos: Json
          p_domicilio_fiscal_receptor: string
          p_exportacion: string
          p_fecha: string
          p_fecha_timbrado: string
          p_forma_pago: string
          p_lugar_expedicion: string
          p_metodo_pago: string
          p_moneda: string
          p_no_certificado: string
          p_no_certificado_sat: string
          p_nombre_emisor: string
          p_nombre_receptor: string
          p_regimen_fiscal_emisor: string
          p_regimen_fiscal_receptor: string
          p_rfc_emisor: string
          p_rfc_prov_certif: string
          p_rfc_receptor: string
          p_sello: string
          p_sello_cfd: string
          p_sello_sat: string
          p_sub_total: number
          p_tipo_comprobante: string
          p_total: number
          p_total_impuestos_trasladados: number
          p_uso_cfdi: string
          p_uuid: string
          p_version: string
        }
        Returns: string
      }
      check_arrendamiento_vigencia: { Args: never; Returns: undefined }
      consulta_dinamica: {
        Args: {
          p_columnas: string
          p_filtros?: string
          p_limite?: number
          p_ordenar?: string
          p_tabla: string
        }
        Returns: Json
      }
      consulta_segura_parametrizada: {
        Args: {
          agrupamiento_group?: string
          columnas_select: string
          condiciones_where?: string
          limite_registro?: string
          ordenamiento_order?: string
          tablas_from: string
        }
        Returns: Json
      }
      contratos_por_vencer: {
        Args: { p_fecha_desde?: string; p_fecha_hasta?: string }
        Returns: {
          fec_fin: string
          moneda: string
          nave: string
          parque: string
          razon_social: string
        }[]
      }
      contratos_vencidos_sin_renovacion: {
        Args: never
        Returns: {
          dias_vencido: number
          fec_fin: string
          moneda: string
          nave: string
          parque: string
          razon_social: string
        }[]
      }
      crear_presupuestos_anuales: {
        Args: { p_anio: number; p_uidr: string }
        Returns: undefined
      }
      crm_buscar_similares_lead: {
        Args: { p_correo?: string; p_nombre: string; p_telefono?: string }
        Returns: {
          correo: string
          dup_correo: boolean
          dup_telefono: boolean
          Etapa: string
          fc: string
          id: string
          nombreLead: string
          nomRC: string
          pct_similitud: number
          sim_nombre: number
          telefono: string
          valor: number
        }[]
      }
      crm_leads_cambiar_etapa: {
        Args: { p_id_etapa_nueva: number; p_idlead: string; p_uidr: string }
        Returns: Json
      }
      crm_tipooperaciones_obtener_activos: {
        Args: never
        Returns: {
          id: number
          titulo: string
        }[]
      }
      crm_tipoventa_obtener_activos: {
        Args: never
        Returns: {
          id: number
          titulo: string
        }[]
      }
      cxp_actualizar_estatus_mes_anio: {
        Args: { p_num_anio: number; p_num_mes: number }
        Returns: number
      }
      cxp_agregar_fecha_manual: {
        Args: { p_fecha: string; p_uid_usuario: string }
        Returns: Json
      }
      cxp_aprobados_sin_pago_aplicado: {
        Args: { p_num_anio: number; p_num_mes: number }
        Returns: Database["public"]["CompositeTypes"]["resultado_funcion"]
        SetofOptions: {
          from: "*"
          to: "resultado_funcion"
          isOneToOne: true
          isSetofReturn: false
        }
      }
      cxp_autorizar_solicitud_pago: {
        Args: {
          p_autorizo?: string
          p_idcxp: string
          p_uidsolicita?: string
          p_ultimocomentario?: string
        }
        Returns: {
          autorizado: boolean
          mensaje: string
        }[]
      }
      cxp_fechas_habilitadas_anual: { Args: { p_anio: number }; Returns: Json }
      cxp_get_estado_cuenta_detalle_v2: {
        Args: {
          p_anio?: number
          p_categoria?: string
          p_estado?: string
          p_mes?: number
          p_proveedor?: string
          p_quien_autorizo?: string
          p_quien_pago?: string
          p_quien_solicito?: string
          p_seccion?: string
          p_tipo_proveedor?: number
          p_urgente?: boolean
        }
        Returns: {
          anio: number
          balance: number
          categoria: string
          concepto: string
          estado: string
          esUrgente: boolean
          fecCFDI: string
          fecPago: string
          fecSolicitud: string
          folio: string
          idCxp: string
          idEstado: number
          mes: number
          montoAplicado: number
          proveedor: string
          quienAutorizo: string
          quienPago: string
          quienSolicito: string
          seccion: string
          subtotal: number
          tipoProveedor: number
          total: number
        }[]
      }
      cxp_get_filtros_dependientes_v2: {
        Args: { p_categoria?: string; p_proveedor?: string; p_seccion?: string }
        Returns: {
          anio: number
          categoria: string
          proveedor: string
          seccion: string
        }[]
      }
      cxp_get_unique_values_v2: {
        Args: { tipo_dato: number }
        Returns: {
          valor: string
        }[]
      }
      cxp_probar_validacion_proveedor: {
        Args: { p_id_proveedor: string; p_tipo_proveedor: number }
        Returns: Json
      }
      cxp_puede_autorizar: { Args: never; Returns: boolean }
      cxp_puede_insertar: { Args: never; Returns: boolean }
      cxp_validar_fecha_habilitada: { Args: never; Returns: Json }
      debug_saldos_vencidos: {
        Args: never
        Returns: {
          balance: number
          cantidad_total: number
          parque: string
          razonsocial: string
          saldo_vencido: number
        }[]
      }
      dev_pdpdetalle: {
        Args: never
        Returns: {
          anio: number
          avance: number
          balance: number
          construccion: number
          dias_vencimiento: number
          esTicket: boolean
          fecha: string
          idInversionista: string
          idNave: string
          idParque: string
          idPdp: string
          idPdpDet: string
          idPropiedad: string
          mes: number
          montoTotal: number
          nomParque: string
          nompropiedad: string
          numPago: number
          pago_fecha: string
          pago_vencido: boolean
          pdpactivo: boolean
          pdpActivo: boolean
          razonsocial: string
          suma_monto: number
          suma_pago_monto: number
          terreno: number
          ticket: number
          tipoPago: string
        }[]
      }
      dmetaphone: { Args: { "": string }; Returns: string }
      dmetaphone_alt: { Args: { "": string }; Returns: string }
      email_obtener_no_reporte: { Args: { p_agrupar: string }; Returns: string }
      fideicomiso_rendimientos_promocion: {
        Args: {
          anio_anterior: number
          anio_periodo: number
          id_propiedad_filtro?: string
          mes_anterior: number
          mes_periodo: number
        }
        Returns: {
          Dias: number
          diasEnPromocion: number
          Dispersion: number
          esTicket: boolean
          fecDispersion: string
          fecini: string
          fecLabel: string
          fecPago: string
          fin_promocion_fecha: string
          idFide: string
          idInversionista: string
          idPdp: string
          idPropiedad: string
          noAdhesion: string
          Pago: number
          personalidad: string
          primer_pago_fecha: string
          razonsocial: string
          rendAnual: number
          rendContratado: number
          rendFideicomiso: number
          RendInv: number
          rendSPH: number
          RendSPH: number
          retencionISR: number
          tieneProm: boolean
          tipoPeriodo: string
        }[]
      }
      fideicomiso_rendimientos_resumen_consulta: {
        Args: {
          anio_anterior: number
          anio_periodo: number
          id_propiedad_filtro?: string
          mes_anterior: number
          mes_periodo: number
        }
        Returns: {
          cantidadPagos: number
          Dias: number
          esTicket: boolean
          fecDispersion: string
          fecini: string
          fecLabel: string
          fin_promocion_fecha: string
          idFide: string
          idInversionista: string
          idPdp: string
          idPropiedad: string
          noAdhesion: string
          pagosConPromocion: number
          pagosMixtos: number
          personalidad: string
          primer_pago_fecha: string
          primerFecPago: string
          razonsocial: string
          rendContratado: number
          rendFideicomiso: number
          rendSPH: number
          tieneProm: boolean
          tipoPeriodo: string
          totalDiasEnPromocion: number
          totalPagos: number
          totalRendInv: number
          totalRendSPH: number
          totalRetencionISR: number
          ultimaFecPago: string
        }[]
      }
      fidepdpdispersion_recalcular_por_condicion: {
        Args: { p_idfide_cond: string }
        Returns: Json
      }
      get_distinct_values: {
        Args: { p_campo: string; p_fuente: string; p_limit?: number }
        Returns: {
          valor: string
        }[]
      }
      get_fields_by_source: {
        Args: { p_nombre_vista: string }
        Returns: {
          column_name: string
          data_type: string
          is_nullable: string
        }[]
      }
      get_ia_prompts: { Args: never; Returns: Json }
      get_widget_grouped: {
        Args: {
          p_agregacion?: string
          p_dimension: string
          p_fecha_desde?: string
          p_fecha_hasta?: string
          p_filtros?: Json
          p_fuente: string
          p_limit?: number
          p_metrica: string
        }
        Returns: {
          label: string
          value: number
        }[]
      }
      guardar_dispersiones_fideicomiso: {
        Args: { p_id_fideicomiso: string; p_no_adhesion?: string }
        Returns: Json
      }
      ia_calificar_conversacion: {
        Args: { p_calificacion: number; p_comentario?: string; p_uuid: string }
        Returns: boolean
      }
      ia_consulta_sql: { Args: { query: string }; Returns: Json }
      ia_log_conversacion: {
        Args: {
          p_bloqueado?: boolean
          p_grafico_json?: Json
          p_pregunta: string
          p_razonamiento?: string
          p_respuesta: string
          p_session_id?: string
          p_sql_generado?: string
          p_tokens_entrada?: number
          p_tokens_salida?: number
          p_uid_usuario: string
        }
        Returns: string
      }
      ia_nueva_sesion: { Args: { p_uid_usuario: string }; Returns: Json }
      ia_tokens_disponibles: { Args: { p_limite?: number }; Returns: boolean }
      ia_update_prompt: {
        Args: { p_parametro: string; p_valor: string }
        Returns: boolean
      }
      inpc_verificar_vigencia_ultimo_registro: { Args: never; Returns: boolean }
      insertar_dispersiones_adherente: {
        Args: { p_id_fideicomiso: string; p_no_adhesion: string }
        Returns: number
      }
      leads_eliminar_lead: { Args: { p_id_lead: string }; Returns: Json }
      leads_generar_email_html: { Args: never; Returns: string }
      leads_mas_7_dias_sin_interaccion: {
        Args: never
        Returns: {
          correo: string
          dias_sin_interaccion: number
          etapa_actual: string
          id_lead: string
          id_responsable_comercial: string
          nombre_lead: string
          responsable_comercial: string
          telefono: string
          ultima_interaccion: string
        }[]
      }
      leads_obtener_destinatarios_reporte: { Args: never; Returns: string[] }
      leads_poraprobar_insertar_registro: {
        Args: {
          p_correo?: string
          p_id_asesor_inm?: string
          p_id_inmobiliaria?: string
          p_id_origen?: number
          p_id_tipo_cliente?: number
          p_id_tipo_operacion: number
          p_id_tipo_venta: number
          p_kvas?: string
          p_mensaje?: string
          p_nombre_lead: string
          p_persona_fisica?: boolean
          p_superficie?: string
          p_telefono?: string
          p_ubicacion?: string
          p_uid_rc?: string
          p_valor?: number
        }
        Returns: Json
      }
      leads_poraprobar_obtener_detalle: {
        Args: never
        Returns: {
          aprobado: boolean
          correo: string
          Etapa: string
          fc: string
          fechaContacto: string
          fechaRegistro: string
          id: string
          idEtapa: number
          idInmobiliaria: string
          idOrigen: number
          idTipoCliente: number
          idTipoOperacion: number
          idTipoVenta: number
          KVAs: string
          mensaje: string
          nombreAsesorInm: string
          nombreInmobiliaria: string
          nombreLead: string
          nombreRegistro: string
          nomRC: string
          Origen: string
          status: boolean
          superficie: string
          telefono: string
          tipoCliente: string
          tipoOperacion: string
          tipoVenta: string
          tituloEtapa: string
          tituloOrigen: string
          tituloTipoCliente: string
          tituloTipoOperacion: string
          tituloTipoVenta: string
          ubicacion: string
          uidr: string
          uidRC: string
          valor: number
        }[]
      }
      leads_poraprobar_validar_y_migrar_similitud: {
        Args: { p_id_lead_poraprobar: string }
        Returns: Json
      }
      leads_sin_interaccion_reciente: {
        Args: { dias_sin_interaccion?: number }
        Returns: {
          "Días sin Interacción": number
          idLead: string
          "Nombre del Lead": string
          "Nombre RC": string
          "UID Responsable Comercial": string
          "Última Interacción": string
        }[]
      }
      leads_ultima_interaccion: {
        Args: never
        Returns: {
          correo: string
          dias_sin_interaccion: number
          etapa_actual: string
          id_lead: string
          id_responsable_comercial: string
          mas_de_7_dias_sin_interaccion: string
          nombre_lead: string
          responsable_comercial: string
          telefono: string
          ultima_interaccion: string
        }[]
      }
      movbancarios_sin_aplicar:
        | {
            Args: { p_busqueda?: string }
            Returns: {
              fec_operacion: string
              idmov: string
              importe: number
              moneda: string
              ordenante: string
              rastreo: string
            }[]
          }
        | {
            Args: { p_anio?: number; p_busqueda?: string; p_mes?: number }
            Returns: {
              fec_operacion: string
              idmov: string
              importe: number
              moneda: string
              ordenante: string
              rastreo: string
            }[]
          }
      numero_ordinal_espanol: { Args: { p_numero: number }; Returns: string }
      pagos_arrendatarios:
        | {
            Args: {
              p_anio?: number
              p_arrendatario?: string
              p_fecha_desde?: string
              p_fecha_hasta?: string
              p_mes?: number
              p_parque?: string
              p_solo_pendientes?: boolean
            }
            Returns: {
              concepto: string
              divisa: string
              fec_pago: string
              fecha: string
              id_arrepdp: string
              id_detalle: string
              monto: number
              nave: string
              num_partida: number
              parque: string
              razon_social: string
            }[]
          }
        | {
            Args: {
              p_anio?: number
              p_arrendatario?: string
              p_parque?: string
              p_solo_pendientes?: boolean
            }
            Returns: {
              concepto: string
              divisa: string
              fec_pago: string
              fecha: string
              id_arrepdp: string
              id_detalle: string
              monto: number
              nave: string
              num_partida: number
              parque: string
              razon_social: string
            }[]
          }
        | {
            Args: {
              p_anio?: number
              p_arrendatario?: string
              p_fecha_desde?: string
              p_fecha_hasta?: string
              p_parque?: string
              p_solo_pendientes?: boolean
            }
            Returns: {
              concepto: string
              divisa: string
              fec_pago: string
              fecha: string
              id_arrepdp: string
              id_detalle: string
              monto: number
              nave: string
              num_partida: number
              parque: string
              razon_social: string
            }[]
          }
      pdpdetalle_reevaluar_monto_por_enganche: {
        Args: { id_pdpp: string }
        Returns: string
      }
      pivot_contabilidad: {
        Args: { p_anio: number }
        Returns: {
          Abr: number
          Ago: number
          aplicaIVA: boolean
          concepto: string
          descripcion: string
          Dic: number
          Ene: number
          Feb: number
          Jul: number
          Jun: number
          Mar: number
          May: number
          notas: Json
          Nov: number
          Oct: number
          Sep: number
          subconcepto: string
          tipo: string
          Total: number
        }[]
      }
      pivot_contabilidad_totales: {
        Args: { p_anio: number }
        Returns: {
          Abr: number
          Ago: number
          concepto: string
          descripcion: string
          Dic: number
          Ene: number
          Feb: number
          Jul: number
          Jun: number
          Mar: number
          May: number
          Nov: number
          Oct: number
          Sep: number
          subconcepto: string
          tipo: string
          Total: number
        }[]
      }
      plan_dispersiones_dinamico: {
        Args: {
          p_id_fideicomiso: string
          p_no_adhesion: string
          p_no_dispersion?: string
        }
        Returns: {
          dias_periodo: number
          dispersion_neta: number
          fecha_calculo: string
          fecha_fin: string
          fecha_inicio: string
          fecha_pago: string
          id_fideicomiso: string
          id_pago: string
          monto_pago: number
          no_adhesion: string
          nodispersion: string
          nombre_inversionista: string
          periodo_anio: number
          periodo_dia_fin: number
          periodo_dia_inicio: number
          periodo_mes: number
          razon_social: string
          rendimiento_bruto: number
          rendimiento_neto: number
          rendimiento_sph: number
          retencion_isr: number
          rfc_inversionista: string
          sub_periodo: string
          tasa_rendimiento: number
          tipo_periodo: string
          tipo_persona: string
        }[]
      }
      plan_dispersiones_dinamico_corregido: {
        Args: {
          p_id_fideicomiso: string
          p_no_adhesion: string
          p_no_dispersion?: string
        }
        Returns: {
          dias_periodo: number
          dispersion_neta: number
          fecha_calculo: string
          fecha_fin: string
          fecha_inicio: string
          fecha_pago: string
          id_fideicomiso: string
          id_pago: string
          monto_pago: number
          no_adhesion: string
          nodispersion: string
          nombre_inversionista: string
          periodo_anio: number
          periodo_dia_fin: number
          periodo_dia_inicio: number
          periodo_mes: number
          razon_social: string
          rendimiento_bruto: number
          rendimiento_neto: number
          rendimiento_sph: number
          retencion_isr: number
          rfc_inversionista: string
          sub_periodo: string
          tasa_rendimiento: number
          tipo_periodo: string
          tipo_persona: string
        }[]
      }
      prescategorias_obtener_con_presupuesto: {
        Args: { p_cuenta?: string; p_id_categoria?: string; p_seccion?: string }
        Returns: {
          cuenta: string
          descripcion: string
          idCategoria: string
          idPresupuesto: string
          nomCompleto: string
          presupuestable: boolean
          presupuesto_anual: number
          seccion: string
          status: boolean
          statusPres: boolean
          uidResponsable: string
        }[]
      }
      presdetalle_crear_registros_completos: {
        Args: { p_id_categoria: string }
        Returns: {
          anio_presupuesto: number
          id_categoria: string
          mensaje: string
          registros_creados: number
        }[]
      }
      presdetalle_obtener_o_crear_registros_mensual: {
        Args: { p_id_categoria: string; p_id_presupuesto: string }
        Returns: {
          id: number
          idPresupuesto: string
          mes: number
          monto: number
        }[]
      }
      propiedades_eliminar_propiedad: {
        Args: { p_id_propiedad: string }
        Returns: string
      }
      rapdp_actualizar: {
        Args: { p_actualizar_valores?: boolean; p_idpropiedad: string }
        Returns: Json
      }
      rau: {
        Args: {
          p_comentario?: string
          p_nomwidget?: string
          p_pantalla?: string
          p_widget?: string
        }
        Returns: undefined
      }
      refresh_leads_completo: { Args: never; Returns: undefined }
      resumen_dispersion_dinamico: {
        Args: {
          p_id_fideicomiso: string
          p_no_adhesion: string
          p_no_dispersion: string
        }
        Returns: {
          dias_normal: number
          dias_promocion: number
          dispersion_neta_total: number
          fecha_calculo: string
          fecha_fin_periodo: string
          fecha_inicio_periodo: string
          id_fideicomiso: string
          monto_total_pagos: number
          no_adhesion: string
          no_dispersion: string
          nombre_inversionista: string
          rendimiento_bruto_total: number
          rendimiento_neto_total: number
          rendimiento_normal: number
          rendimiento_promocion: number
          rendimiento_sph_total: number
          retencion_isr_total: number
          rfc_inversionista: string
          tasa_promedio_rendimiento: number
          tipo_persona: string
          total_dias_periodo: number
          total_pagos_distintos: number
        }[]
      }
      resumen_dispersion_dinamico_corregido: {
        Args: {
          p_id_fideicomiso: string
          p_no_adhesion: string
          p_no_dispersion: string
        }
        Returns: {
          dias_normal: number
          dias_promocion: number
          dispersion_neta_total: number
          fecha_calculo: string
          fecha_fin_periodo: string
          fecha_inicio_periodo: string
          id_fideicomiso: string
          monto_total_pagos: number
          no_adhesion: string
          no_dispersion: string
          nombre_inversionista: string
          rendimiento_bruto_total: number
          rendimiento_neto_total: number
          rendimiento_normal: number
          rendimiento_promocion: number
          rendimiento_sph_total: number
          retencion_isr_total: number
          rfc_inversionista: string
          tasa_promedio_rendimiento: number
          tipo_persona: string
          total_dias_periodo: number
          total_pagos_distintos: number
        }[]
      }
      resumen_fideicomiso_completo: {
        Args: { p_id_fideicomiso: string; p_no_dispersion: string }
        Returns: {
          dias_normal: number
          dias_promocion: number
          dispersion_neta_total: number
          fecha_calculo: string
          fecha_fin_periodo: string
          fecha_inicio_periodo: string
          id_fideicomiso: string
          monto_total_pagos: number
          no_adhesion: string
          no_dispersion: string
          nombre_inversionista: string
          rendimiento_bruto_total: number
          rendimiento_neto_total: number
          rendimiento_normal: number
          rendimiento_promocion: number
          rendimiento_sph_total: number
          retencion_isr_total: number
          rfc_inversionista: string
          tasa_promedio_rendimiento: number
          tipo_persona: string
          total_dias_periodo: number
          total_pagos_distintos: number
        }[]
      }
      resumen_fideicomiso_completo_corregido: {
        Args: { p_id_fideicomiso: string; p_no_dispersion: string }
        Returns: {
          dias_normal: number
          dias_promocion: number
          dispersion_neta_total: number
          fecha_calculo: string
          fecha_fin_periodo: string
          fecha_inicio_periodo: string
          id_fideicomiso: string
          monto_total_pagos: number
          no_adhesion: string
          no_dispersion: string
          nombre_inversionista: string
          rendimiento_bruto_total: number
          rendimiento_neto_total: number
          rendimiento_normal: number
          rendimiento_promocion: number
          rendimiento_sph_total: number
          retencion_isr_total: number
          rfc_inversionista: string
          tasa_promedio_rendimiento: number
          tipo_persona: string
          total_dias_periodo: number
          total_pagos_distintos: number
        }[]
      }
      rgpdp_generar_plan_pagos: { Args: { p_idrtag: string }; Returns: Json }
      rgpdp_insertar_registro: {
        Args: {
          p_cumpmin: number
          p_estadorenta: number
          p_fechafin: string
          p_fecinicio: string
          p_idpropiedad: string
          p_incrementoanual: number
          p_m2construccion: number
          p_preciom2: number
          p_proporcional: boolean
          p_rentaactiva: boolean
          p_tasaiva: number
          p_tienerg: boolean
          p_uid: string
        }
        Returns: Json
      }
      seg_aplicar_plantilla_a_usuario: {
        Args: {
          p_id_plantilla: string
          p_reemplazar_todos?: boolean
          p_uid_usuario_destino: string
        }
        Returns: Json
      }
      seg_crear_plantilla_desde_usuario: {
        Args: {
          p_categoria: string
          p_descripcion: string
          p_es_publica: string
          p_nombre_plantilla: string
          p_uid_creador: string
          p_uid_usuario_origen: string
        }
        Returns: Json
      }
      segmodulos_corregir_todos_los_campos: { Args: never; Returns: number }
      segmodulosusuarios_smu: {
        Args: { p_ro?: boolean; p_uid: string }
        Returns: {
          acceso: boolean
          area: string
          clave: number
          fc: string
          idsegModulos: string
          modulo: string
          seccion: string
          uid: string
        }[]
      }
      segmodulosusuarios_verificar_acceso: {
        Args: { clave_modulo: number; uid_usuario: string }
        Returns: boolean
      }
      show_limit: { Args: never; Returns: number }
      show_trgm: { Args: { "": string }; Returns: string[] }
      sopj: { Args: { p_uid: string }; Returns: Json }
      soundex: { Args: { "": string }; Returns: string }
      sum_column: {
        Args: { columna: string; condicion: string; tabla: string }
        Returns: number
      }
      temp_validar_telefono: { Args: { p_telefono: string }; Returns: string }
      text_soundex: { Args: { "": string }; Returns: string }
      trigger_arrepdp_actualizar_vigencia_diaria: {
        Args: never
        Returns: undefined
      }
      trigger_arrepdp_desvincular_propiedades_diaria: {
        Args: never
        Returns: undefined
      }
      usuario_tiene_permiso_reporte: {
        Args: { p_reporte_id: string; p_usuario_id: string }
        Returns: boolean
      }
      v_pdpdetalle_get_estado_cuenta_detalle: {
        Args: {
          p_anio?: number
          p_mes?: number
          p_parque?: string
          p_propiedad?: string
          p_razonsocial?: string
        }
        Returns: {
          anio: number
          avance: number
          balance: number
          construccion: number
          dias_vencimiento: number
          esTicket: boolean
          fecha: string
          idInversionista: string
          idNave: string
          idParque: string
          idPdp: string
          idPdpDet: string
          idPropiedad: string
          mes: number
          montoTotal: number
          nomParque: string
          nompropiedad: string
          numPago: number
          pago_fecha: string
          pago_vencido: boolean
          pdpActivo: boolean
          razonsocial: string
          suma_monto: number
          suma_pago_monto: number
          terreno: number
          ticket: number
          tipoPago: string
        }[]
      }
      v_pdpdetalle_get_evolucion_saldos_vencidos: {
        Args: { p_parque?: string; p_razonsocial?: string }
        Returns: {
          anio: number
          cantidad_registros: number
          parque: string
          total_saldo_vencido: number
        }[]
      }
      v_pdpdetalle_get_filtros_dependientes: {
        Args: { p_parque?: string; p_razonsocial?: string }
        Returns: {
          anio: number
          nomParque: string
          nompropiedad: string
          tipoPago: string
        }[]
      }
      v_pdpdetalle_get_resumen_saldos_vencidos_parque: {
        Args: { p_anio?: number; p_mes?: number; p_razonsocial?: string }
        Returns: {
          cantidad_registros: number
          parque: string
          porcentaje_del_total: number
          total_saldo_vencido: number
        }[]
      }
      v_pdpdetalle_get_saldos_vencidos_por_parque: {
        Args: {
          p_anio?: number
          p_mes?: number
          p_parque?: string
          p_propiedad?: string
          p_razonsocial?: string
        }
        Returns: {
          anio: number
          balance: number
          dias_vencimiento: number
          fecha: string
          mes: number
          nomParque: string
          nompropiedad: string
          numPago: number
          pago_fecha: string
          pago_vencido: boolean
          razonsocial: string
          saldo_vencido: number
          tipoPago: string
        }[]
      }
      v_pdpdetalle_get_unique_values: {
        Args: { tipo_dato: number }
        Returns: {
          valor: string
        }[]
      }
      v_pdpdetalle_get_unique_values_sin_a3: {
        Args: { tipo_dato: number }
        Returns: {
          valor: string
        }[]
      }
      v2_arrepdp_activar_renovaciones: { Args: never; Returns: Json }
      v2_arrepdp_cancelar_anticipado: {
        Args: {
          p_id_arre_pdp: string
          p_motivo: string
          p_num_partida_corte: number
          p_uid: string
        }
        Returns: Json
      }
      v2_arrepdp_renovar: {
        Args: {
          p_construccion_m2: number
          p_deposito?: number
          p_id_arre_pdp_actual: string
          p_inpc_plus?: number
          p_mes_gracia_administracion?: number
          p_mes_gracia_mantenimiento?: number
          p_mes_gracia_renta?: number
          p_mes_gracia_vigilancia?: number
          p_moneda?: string
          p_plazo: number
          p_pm2_admin?: number
          p_pm2_mtto?: number
          p_pm2_vig?: number
          p_precio_m2: number
          p_uid: string
        }
        Returns: Json
      }
      v2_changelog_registrar: {
        Args: {
          p_cambios: Json
          p_publicada?: boolean
          p_salto: string
          p_titulo: string
        }
        Returns: string
      }
      v2_cron_jobs: {
        Args: never
        Returns: {
          active: boolean
          command: string
          jobid: number
          jobname: string
          schedule: string
          total_ejecuciones: number
          ultima_ejecucion: string
          ultimo_estado: string
          ultimo_mensaje: string
        }[]
      }
      v2_cron_run_details: {
        Args: { p_jobid?: number; p_limit?: number }
        Returns: {
          duracion_ms: number
          end_time: string
          jobid: number
          jobname: string
          return_message: string
          runid: number
          start_time: string
          status: string
        }[]
      }
      v2_obtener_logo_url: { Args: never; Returns: string }
    }
    Enums: {
      Area: "Modulo" | "Opcion"
      arrePdpVigente: "Si" | "3 Meses" | "2 Meses" | "1 Mes" | "No"
      mesGratis: "No" | "Si" | "Medio"
      Modulos:
        | "Arrendatarios"
        | "Comisiones"
        | "Configuraciones"
        | "CRM"
        | "Cuentas por Pagar"
        | "Fideicomiso"
        | "Inversionistas"
        | "Parques"
        | "Correo"
      statusTicket: "Abierto" | "En Proceso" | "Cerrado"
      tipoConceptos: "Tipo" | "Concepto" | "subConcepto"
    }
    CompositeTypes: {
      resultado_funcion: {
        estatus: boolean | null
        mensaje: string | null
        registros_afectados: number | null
      }
    }
  }
}

type DatabaseWithoutInternals = Omit<Database, "__InternalSupabase">

type DefaultSchema = DatabaseWithoutInternals[Extract<keyof Database, "public">]

export type Tables<
  DefaultSchemaTableNameOrOptions extends
    | keyof (DefaultSchema["Tables"] & DefaultSchema["Views"])
    | { schema: keyof DatabaseWithoutInternals },
  TableName extends DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof (DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"] &
        DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Views"])
    : never = never,
> = DefaultSchemaTableNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? (DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"] &
      DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Views"])[TableName] extends {
      Row: infer R
    }
    ? R
    : never
  : DefaultSchemaTableNameOrOptions extends keyof (DefaultSchema["Tables"] &
        DefaultSchema["Views"])
    ? (DefaultSchema["Tables"] &
        DefaultSchema["Views"])[DefaultSchemaTableNameOrOptions] extends {
        Row: infer R
      }
      ? R
      : never
    : never

export type TablesInsert<
  DefaultSchemaTableNameOrOptions extends
    | keyof DefaultSchema["Tables"]
    | { schema: keyof DatabaseWithoutInternals },
  TableName extends DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"]
    : never = never,
> = DefaultSchemaTableNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"][TableName] extends {
      Insert: infer I
    }
    ? I
    : never
  : DefaultSchemaTableNameOrOptions extends keyof DefaultSchema["Tables"]
    ? DefaultSchema["Tables"][DefaultSchemaTableNameOrOptions] extends {
        Insert: infer I
      }
      ? I
      : never
    : never

export type TablesUpdate<
  DefaultSchemaTableNameOrOptions extends
    | keyof DefaultSchema["Tables"]
    | { schema: keyof DatabaseWithoutInternals },
  TableName extends DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"]
    : never = never,
> = DefaultSchemaTableNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"][TableName] extends {
      Update: infer U
    }
    ? U
    : never
  : DefaultSchemaTableNameOrOptions extends keyof DefaultSchema["Tables"]
    ? DefaultSchema["Tables"][DefaultSchemaTableNameOrOptions] extends {
        Update: infer U
      }
      ? U
      : never
    : never

export type Enums<
  DefaultSchemaEnumNameOrOptions extends
    | keyof DefaultSchema["Enums"]
    | { schema: keyof DatabaseWithoutInternals },
  EnumName extends DefaultSchemaEnumNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaEnumNameOrOptions["schema"]]["Enums"]
    : never = never,
> = DefaultSchemaEnumNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[DefaultSchemaEnumNameOrOptions["schema"]]["Enums"][EnumName]
  : DefaultSchemaEnumNameOrOptions extends keyof DefaultSchema["Enums"]
    ? DefaultSchema["Enums"][DefaultSchemaEnumNameOrOptions]
    : never

export type CompositeTypes<
  PublicCompositeTypeNameOrOptions extends
    | keyof DefaultSchema["CompositeTypes"]
    | { schema: keyof DatabaseWithoutInternals },
  CompositeTypeName extends PublicCompositeTypeNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[PublicCompositeTypeNameOrOptions["schema"]]["CompositeTypes"]
    : never = never,
> = PublicCompositeTypeNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[PublicCompositeTypeNameOrOptions["schema"]]["CompositeTypes"][CompositeTypeName]
  : PublicCompositeTypeNameOrOptions extends keyof DefaultSchema["CompositeTypes"]
    ? DefaultSchema["CompositeTypes"][PublicCompositeTypeNameOrOptions]
    : never

export const Constants = {
  public: {
    Enums: {
      Area: ["Modulo", "Opcion"],
      arrePdpVigente: ["Si", "3 Meses", "2 Meses", "1 Mes", "No"],
      mesGratis: ["No", "Si", "Medio"],
      Modulos: [
        "Arrendatarios",
        "Comisiones",
        "Configuraciones",
        "CRM",
        "Cuentas por Pagar",
        "Fideicomiso",
        "Inversionistas",
        "Parques",
        "Correo",
      ],
      statusTicket: ["Abierto", "En Proceso", "Cerrado"],
      tipoConceptos: ["Tipo", "Concepto", "subConcepto"],
    },
  },
} as const
