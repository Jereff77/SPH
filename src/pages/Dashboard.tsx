import { useState, useEffect, useRef, useCallback } from 'react'
import { supabase } from '../lib/supabaseClient'
import type { CatUser } from '../types/db'
import QRCode from 'react-qr-code'
import { generateQRBlob, shareNative, downloadQR } from '../utils/shareQR'
import { QrCode, Share2, ArrowUpRight, ArrowDownLeft, X, CheckCircle, AlertCircle, Calendar, Download } from 'lucide-react'

interface DashboardProps {
  currentUser: CatUser | null
}

interface LogItem {
  idQR: string
  claveAcceso: string
  visitorName: string
  fechaValidez: string
  tipoQR: string
  entryTime?: string
  exitTime?: string
  fc: string
}

interface QrWithVisitor {
  idQR: string
  claveAcceso: string
  fechaValidez: string
  tipoQR: string
  fc: string
  datosVisitantes?:
    | { nomVisitante: string | null }[]
    | { nomVisitante: string | null }
    | null
}

export function Dashboard({ currentUser }: DashboardProps) {
  const [stats, setStats] = useState({ limit: 0, usage: 0 })
  const [logs, setLogs] = useState<LogItem[]>([])
  const [loading, setLoading] = useState(false)
  
  // Resend Modal State
  const [selectedLog, setSelectedLog] = useState<LogItem | null>(null)
  const qrRef = useRef<HTMLDivElement>(null)
  
  // Share State
  const [isSharing, setIsSharing] = useState(false)
  const [showShareOptions, setShowShareOptions] = useState(false)
  const [shareBlob, setShareBlob] = useState<Blob | null>(null)

  const fetchStats = useCallback(async () => {
    if (!currentUser?.idEmpresa) return

    // 1. Limit
    const { data: empresa } = await supabase
      .from('empresas')
      .select('qrDiarios')
      .eq('idEmpresa', currentUser.idEmpresa)
      .maybeSingle()
    
    const limit = empresa?.qrDiarios || 0

    // 2. Usage
    const { data: packs } = await supabase
      .from('qrEmpresas')
      .select('idQrEmpresas')
      .eq('idEmpresa', currentUser.idEmpresa)
    
    let usage = 0
    if (packs && packs.length > 0) {
        const packIds = packs.map(p => p.idQrEmpresas)
        const today = new Date().toISOString().split('T')[0]
        
        // Chunking if needed, but for dashboard maybe just simple count if not too many
        // Reuse chunking logic for safety
        const chunkSize = 10
        for (let i = 0; i < packIds.length; i += chunkSize) {
            const chunk = packIds.slice(i, i + chunkSize)
            const { count } = await supabase
            .from('qrGenerados')
            .select('idQR', { count: 'exact', head: true })
            .in('idQrEmpresas', chunk)
            .eq('tipoQR', 'Uso General')
            .gte('fc', `${today}T00:00:00`)
            .lte('fc', `${today}T23:59:59`)
            
            usage += count || 0
        }
    }
    
    setStats({ limit, usage })
  }, [currentUser])

  const fetchLogs = useCallback(async () => {
    if (!currentUser?.idEmpresa) return
    setLoading(true)

    // We need to join qrGenerados with datosVisitantes.
    // Supabase join syntax: select(*, datosVisitantes(*))
    // We need to filter by company via qrEmpresas? Or via visitor?
    // qrGenerados has idVisitante. datosVisitantes has idEmpresa.
    // So we can select qrGenerados where idVisitante is in (select idVisitante from datosVisitantes where idEmpresa = ...)
    // Or simpler: qrGenerados has idQrEmpresas. idQrEmpresas belongs to company.
    
    // 1. Get valid pack IDs
    const { data: packs } = await supabase
      .from('qrEmpresas')
      .select('idQrEmpresas')
      .eq('idEmpresa', currentUser.idEmpresa)
    
    if (!packs || packs.length === 0) {
        setLogs([])
        setLoading(false)
        return
    }
    const packIds = packs.map(p => p.idQrEmpresas)

    // 2. Fetch QRs
    const { data: qrs, error } = await supabase
      .from('qrGenerados')
      .select(`
        idQR,
        claveAcceso,
        fechaValidez,
        tipoQR,
        fc,
        datosVisitantes (
            nomVisitante
        )
      `)
      .in('idQrEmpresas', packIds)
      .order('fc', { ascending: false })
      .limit(20) // Limit to recent 20 for now

    if (error) {
        console.error('Error fetching logs:', error)
    } else if (qrs) {
        const mappedLogs: LogItem[] = (qrs as QrWithVisitor[]).map((item) => {
            let visitorName = 'Desconocido'
            if (Array.isArray(item.datosVisitantes)) {
                visitorName = item.datosVisitantes[0]?.nomVisitante || 'Desconocido'
            } else if (item.datosVisitantes) {
                visitorName = item.datosVisitantes.nomVisitante || 'Desconocido'
            }

            return {
                idQR: item.idQR,
                claveAcceso: item.claveAcceso,
                visitorName,
                fechaValidez: item.fechaValidez,
                tipoQR: item.tipoQR,
                entryTime: undefined,
                exitTime: undefined,
                fc: item.fc,
            }
        })
        setLogs(mappedLogs)
    }
    setLoading(false)
  }, [currentUser])

  useEffect(() => {
    if (currentUser) {
        fetchStats()
        fetchLogs()
    }
  }, [currentUser, fetchStats, fetchLogs])

  const handleShareClick = async () => {
    if (!qrRef.current || !selectedLog) return
    
    setIsSharing(true)
    setShowShareOptions(false)
    setShareBlob(null)

    const blob = await generateQRBlob(qrRef.current)
    if (!blob) {
        alert('Error al generar la imagen del QR.')
        setIsSharing(false)
        return
    }

    const file = new File([blob], `access-${selectedLog.claveAcceso}.png`, { type: 'image/png' })
    // Only share file to ensure image visibility on WhatsApp/Mobile
    const shared = await shareNative(file)
    
    if (!shared) {
        // If native share fails, we show fallback to download
        setShareBlob(blob)
        setShowShareOptions(true)
    }
    setIsSharing(false)
  }

  const handleOptionDownload = () => {
    if (!shareBlob || !selectedLog) return
    downloadQR(shareBlob, `access-${selectedLog.claveAcceso}.png`)
  }

  return (
    <div className="space-y-6">
      {/* Stats Cards */}
      <div className="grid grid-cols-3 gap-3">
        <div className="bg-white p-3 rounded-xl shadow-sm border border-gray-100 flex flex-col items-center justify-center text-center">
            <span className="text-2xl font-bold text-sph-primary">{stats.limit}</span>
            <span className="text-[10px] text-gray-500 uppercase font-bold tracking-wider">Límite</span>
        </div>
        <div className="bg-white p-3 rounded-xl shadow-sm border border-gray-100 flex flex-col items-center justify-center text-center">
            <span className="text-2xl font-bold text-blue-600">{stats.usage}</span>
            <span className="text-[10px] text-gray-500 uppercase font-bold tracking-wider">Generados</span>
        </div>
        <div className="bg-white p-3 rounded-xl shadow-sm border border-gray-100 flex flex-col items-center justify-center text-center">
            <span className="text-2xl font-bold text-green-600">{Math.max(0, stats.limit - stats.usage)}</span>
            <span className="text-[10px] text-gray-500 uppercase font-bold tracking-wider">Disponibles</span>
        </div>
      </div>

      {/* Logs List */}
      <div className="bg-white rounded-xl shadow-sm border border-gray-100 overflow-hidden">
         <div className="p-4 border-b border-gray-100 bg-gray-50">
             <h2 className="font-bold text-sph-text text-sm uppercase tracking-wider">Últimos QRs Generados</h2>
         </div>
         <div className="divide-y divide-gray-100">
             {loading ? (
                 <div className="p-8 text-center text-gray-400">Cargando...</div>
             ) : logs.length === 0 ? (
                 <div className="p-8 text-center text-gray-400">No hay registros recientes</div>
             ) : (
                 logs.map(log => {
                    const todayStr = new Date().toISOString().split('T')[0]
                    const isValid = log.fechaValidez >= todayStr
                    
                    return (
                    <div key={log.idQR} className="p-4 flex items-center justify-between hover:bg-gray-50 transition">
                        <div className="flex-1">
                            <div className="flex items-center gap-2">
                                <div className="font-semibold text-sph-text text-sm">{log.visitorName}</div>
                                {isValid ? (
                                    <div title="Vigente">
                                        <CheckCircle className="w-4 h-4 text-green-500" />
                                    </div>
                                ) : (
                                    <div title="Expirado">
                                        <AlertCircle className="w-4 h-4 text-red-300" />
                                    </div>
                                )}
                            </div>
                            
                            <div className="flex items-center gap-1 text-xs text-gray-500 mt-1">
                                <Calendar className="w-3 h-3" />
                                <span>{new Date(log.fc).toLocaleDateString()}</span>
                            </div>

                            <div className="flex items-center gap-3 mt-1 text-xs text-gray-400">
                                <span className="flex items-center gap-1">
                                    <ArrowDownLeft className="w-3 h-3 text-green-500" /> 
                                    {log.entryTime || '--:--'}
                                </span>
                                <span className="flex items-center gap-1">
                                    <ArrowUpRight className="w-3 h-3 text-red-500" /> 
                                    {log.exitTime || '--:--'}
                                </span>
                            </div>
                        </div>
                        {isValid && (
                            <button 
                                onClick={() => setSelectedLog(log)}
                                className="p-2 text-sph-primary hover:bg-blue-50 rounded-full transition"
                                title="Reenviar QR"
                            >
                                <Share2 className="w-5 h-5" />
                            </button>
                        )}
                    </div>
                )})
            )}
         </div>
      </div>

      {/* Modal for QR */}
      {selectedLog && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50 backdrop-blur-sm animate-in fade-in">
           <div className="bg-white rounded-2xl shadow-xl w-full max-w-sm overflow-hidden">
               <div className="p-4 border-b border-gray-100 flex justify-between items-center">
                   <h3 className="font-bold text-lg">Compartir Acceso</h3>
                   <button onClick={() => setSelectedLog(null)} className="text-gray-400 hover:text-gray-600">
                       <X className="w-6 h-6" />
                   </button>
               </div>
               
               <div className="p-6 flex flex-col items-center">
                   {/* Capture Area */}
                   <div ref={qrRef} className="bg-white p-4 rounded-xl mb-6" style={{ backgroundColor: '#ffffff' }}>
                        <div className="flex items-center justify-center gap-2 mb-4">
                            <QrCode style={{ color: '#1F2D4A', width: '24px', height: '24px' }} />
                            <h2 style={{ fontSize: '16px', fontWeight: 'bold', color: '#1F2D4A', margin: 0 }}>
                            Acceso SPH
                            </h2>
                        </div>
                        <div style={{ display: 'flex', justifyContent: 'center', marginBottom: '16px' }}>
                            <QRCode value={selectedLog.claveAcceso} size={180} />
                        </div>
                        <div className="text-left space-y-1">
                            <p style={{ fontSize: '12px', color: '#666' }}>Visitante: <strong style={{ color: '#000' }}>{selectedLog.visitorName}</strong></p>
                            <p style={{ fontSize: '12px', color: '#666' }}>Fecha: <strong style={{ color: '#000' }}>{selectedLog.fechaValidez}</strong></p>
                        </div>
                   </div>

                   {!showShareOptions ? (
                        <button
                            onClick={handleShareClick}
                            disabled={isSharing}
                            className="w-full flex items-center justify-center gap-2 bg-sph-primary text-white py-3 rounded-lg font-bold hover:opacity-90 transition disabled:opacity-50"
                        >
                            {isSharing ? (
                                <span className="flex items-center gap-2">Generando...</span>
                            ) : (
                                <>
                                    <Share2 className="w-5 h-5" />
                                    Compartir
                                </>
                            )}
                        </button>
                   ) : (
                       <div className="w-full animate-in fade-in slide-in-from-bottom-2">
                            <div className="bg-yellow-50 p-3 rounded-lg mb-3 text-xs text-yellow-800 border border-yellow-200 text-center">
                                Tu dispositivo no soporta compartir imagen directo. <br/> Descárgala y envíala manualmente.
                            </div>
                            <button onClick={handleOptionDownload} className="w-full flex items-center justify-center gap-2 bg-sph-primary text-white py-3 rounded-lg font-bold hover:opacity-90 transition">
                                <Download className="w-5 h-5" />
                                Descargar Imagen
                            </button>
                       </div>
                   )}
               </div>
           </div>
        </div>
      )}
    </div>
  )
}
