import { createClient } from '@/lib/supabase/server'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { CatalogoEtapas } from '@/components/catalogos/catalogo-etapas'
import { CatalogoSimple } from '@/components/catalogos/catalogo-simple'
import Link from 'next/link'
import { Settings } from 'lucide-react'
import { Button } from '@/components/ui/button'

async function getCatalogos() {
  const supabase = await createClient()

  const [etapas, origenes, tipoOps, tipoVentas, tipoClientes, campanias, recepciones, tipoActividades] =
    await Promise.all([
      supabase.from('crm_Etapas').select('id, titulo, bkColor, txtColor, orden, status').order('orden'),
      supabase.from('crm_Origen').select('id, titulo, status').order('titulo'),
      supabase.from('crm_tipoOperaciones').select('id, titulo, status').order('titulo'),
      supabase.from('crm_tipoVenta').select('id, titulo, status').order('titulo'),
      supabase.from('crm_tipoCliente').select('id, titulo, status').order('titulo'),
      supabase.from('crm_campania').select('id, titulo, status, bkColor, txtColor').order('titulo'),
      supabase.from('crm_Recepcion').select('id, titulo, status').order('titulo'),
      supabase.from('crm_tipoActividad').select('id, titulo, icono, status').order('id'),
    ])

  return {
    etapas: etapas.data ?? [],
    origenes: origenes.data ?? [],
    tipoOps: tipoOps.data ?? [],
    tipoVentas: tipoVentas.data ?? [],
    tipoClientes: tipoClientes.data ?? [],
    campanias: campanias.data ?? [],
    recepciones: recepciones.data ?? [],
    tipoActividades: tipoActividades.data ?? [],
  }
}

export default async function CatalogosPage() {
  const cat = await getCatalogos()

  return (
    <div className="space-y-5">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-xl font-semibold text-foreground">Catálogos</h2>
          <p className="text-sm text-muted-foreground">Gestión de valores del sistema — solo administrador</p>
        </div>
        <Link href="/catalogos/configuracion">
          <Button variant="outline" size="sm">
            <Settings className="w-3.5 h-3.5 mr-1.5" />
            Configuración
          </Button>
        </Link>
      </div>

      <Tabs defaultValue="etapas">
        <TabsList className="flex-wrap h-auto gap-1 bg-muted/50">
          <TabsTrigger value="etapas">Etapas del pipeline</TabsTrigger>
          <TabsTrigger value="origenes">Origen</TabsTrigger>
          <TabsTrigger value="tipoOps">Tipo de operación</TabsTrigger>
          <TabsTrigger value="tipoVentas">Tipo de venta</TabsTrigger>
          <TabsTrigger value="tipoClientes">Tipo de cliente</TabsTrigger>
          <TabsTrigger value="campanias">Campañas</TabsTrigger>
          <TabsTrigger value="recepciones">Recepción</TabsTrigger>
          <TabsTrigger value="tipoActividades">Tipos de actividad</TabsTrigger>
        </TabsList>

        <TabsContent value="etapas" className="mt-4">
          <CatalogoEtapas items={cat.etapas as Parameters<typeof CatalogoEtapas>[0]['items']} />
        </TabsContent>

        <TabsContent value="origenes" className="mt-4">
          <CatalogoSimple tabla="crm_Origen" items={cat.origenes} titulo="origen" />
        </TabsContent>

        <TabsContent value="tipoOps" className="mt-4">
          <CatalogoSimple tabla="crm_tipoOperaciones" items={cat.tipoOps} titulo="tipo de operación" />
        </TabsContent>

        <TabsContent value="tipoVentas" className="mt-4">
          <CatalogoSimple tabla="crm_tipoVenta" items={cat.tipoVentas} titulo="tipo de venta" />
        </TabsContent>

        <TabsContent value="tipoClientes" className="mt-4">
          <CatalogoSimple tabla="crm_tipoCliente" items={cat.tipoClientes} titulo="tipo de cliente" />
        </TabsContent>

        <TabsContent value="campanias" className="mt-4">
          <CatalogoSimple tabla="crm_campania" items={cat.campanias} titulo="campaña" conColores />
        </TabsContent>

        <TabsContent value="recepciones" className="mt-4">
          <CatalogoSimple tabla="crm_Recepcion" items={cat.recepciones} titulo="recepción" />
        </TabsContent>

        <TabsContent value="tipoActividades" className="mt-4">
          <CatalogoSimple tabla="crm_tipoActividad" items={cat.tipoActividades} titulo="tipo de actividad" conIcono />
        </TabsContent>
      </Tabs>
    </div>
  )
}
