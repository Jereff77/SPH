import { useState, useEffect, useRef, useCallback } from 'react'
import { supabase } from '../lib/supabaseClient'
import type { CatUser, QrEmpresa, DatosVisitante } from '../types/db'
import QRCode from 'react-qr-code'
import html2canvas from 'html2canvas'
import { QrCode, Calendar, Plus, Save, Search, Share2 } from 'lucide-react'
import { SearchableSelect } from '../components/SearchableSelect'

interface GenerateQRProps {
  currentUser: CatUser | null
}

export function GenerateQR({ currentUser }: GenerateQRProps) {
  const [qrTypes, setQrTypes] = useState<QrEmpresa[]>([])
  const [uniqueQrTypes, setUniqueQrTypes] = useState<string[]>([])
  const [visitors, setVisitors] = useState<DatosVisitante[]>([])
  const [loading, setLoading] = useState(false)
  const qrRef = useRef<HTMLDivElement>(null)
  const [generatedQR, setGeneratedQR] = useState<{ code: string, type: string, visitor: string, date: string } | null>(null)
  
  // Limits State
  const [companyDailyLimit, setCompanyDailyLimit] = useState(0)
  const [companyDailyUsage, setCompanyDailyUsage] = useState(0)

  // Form State
  const [selectedQrType, setSelectedQrType] = useState<string>('')
  const [selectedVisitorId, setSelectedVisitorId] = useState<string>('')
  const [visitDate, setVisitDate] = useState<string>(new Date().toISOString().split('T')[0])
  const [isNewVisitor, setIsNewVisitor] = useState(false)
  
  // New Visitor Form
  const [newVisitorName, setNewVisitorName] = useState('')
  const [newVisitorPhone, setNewVisitorPhone] = useState('')
  const [newVisitorVehicleType, setNewVisitorVehicleType] = useState('')
  const [newVisitorPlate, setNewVisitorPlate] = useState('')
  const [newVisitorIdImage, setNewVisitorIdImage] = useState<File | null>(null)

  const formatPhoneNumber = (value: string) => {
    const numbers = value.replace(/\D/g, '')
    if (numbers.length === 0) return ''
    if (numbers.length <= 3) return `(${numbers}`
    if (numbers.length <= 6) return `(${numbers.slice(0, 3)}) ${numbers.slice(3)}`
    return `(${numbers.slice(0, 3)}) ${numbers.slice(3, 6)}-${numbers.slice(6, 10)}`
  }

  const handlePhoneChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const raw = e.target.value.replace(/\D/g, '')
    if (raw.length <= 10) {
      setNewVisitorPhone(formatPhoneNumber(raw))
    }
  }

  const fetchCompanyUsage = useCallback(async () => {
    if (!currentUser?.idEmpresa) return
    
    // 1. Get all pack IDs for this company to filter qrGenerados
    const { data: packs } = await supabase
      .from('qrEmpresas')
      .select('idQrEmpresas')
      .eq('idEmpresa', currentUser.idEmpresa)
    
    if (!packs || packs.length === 0) {
        setCompanyDailyUsage(0)
        return
    }

    const packIds = packs.map(p => p.idQrEmpresas)
     const today = new Date().toISOString().split('T')[0]
 
     // 2. Count usage for these packs today using 'fc' (creation date)
     const chunkSize = 10
     const chunks = []
     for (let i = 0; i < packIds.length; i += chunkSize) {
         chunks.push(packIds.slice(i, i + chunkSize))
     }

     let totalCount = 0

     for (const chunk of chunks) {
         const { count, error } = await supabase
           .from('qrGenerados')
           .select('*', { count: 'exact', head: true })
           .in('idQrEmpresas', chunk)
           .eq('tipoQR', 'Uso General')
           .gte('fc', `${today}T00:00:00`)
           .lte('fc', `${today}T23:59:59`)

         if (!error) {
             totalCount += count || 0
         }
     }
     
     setCompanyDailyUsage(totalCount)
   }, [currentUser])

  const fetchQrTypes = useCallback(async () => {
    if (!currentUser?.idEmpresa) {
      setQrTypes([])
      return
    }
    
    // 1. Fetch available packs (Inventory) to check balances
    const { data: packs, error: packError } = await supabase
      .from('qrEmpresas')
      .select('*')
      .eq('idEmpresa', currentUser.idEmpresa)
    
    if (packError) console.error('Error fetching QR packs:', packError)

    const availablePacks = packs || []
    setQrTypes(availablePacks)
  }, [currentUser])

  const fetchVisitors = useCallback(async () => {
    if (!currentUser?.idEmpresa) {
      setVisitors([])
      return
    }

    const { data, error } = await supabase
      .from('datosVisitantes')
      .select('*')
      .eq('idEmpresa', currentUser.idEmpresa)
      .order('nomVisitante', { ascending: true })
    
    if (data) {
      setVisitors(data)
    }
    if (error) console.error('Error fetching visitors:', error)
  }, [currentUser])

  // Fetch company limits (Need to refetch here or pass from App? App fetches it for header name, but limits are specific)
  // App fetches 'qrDiarios'. We can reuse logic or just fetch again. 
  // For simplicity, let's fetch again or assume passed? 
  // App passes 'companyName'. Let's fetch limit here to be self-contained or pass it.
  // The original App.tsx fetched it in fetchCurrentUser.
  
  useEffect(() => {
    if (currentUser?.idEmpresa) {
        supabase
          .from('empresas')
          .select('qrDiarios')
          .eq('idEmpresa', currentUser.idEmpresa)
          .maybeSingle()
          .then(({ data }) => {
             if (data) setCompanyDailyLimit(data.qrDiarios || 0)
          })
    }
  }, [currentUser])


  useEffect(() => {
    if (currentUser) {
      fetchQrTypes()
      fetchVisitors()
      fetchCompanyUsage()
    }
  }, [currentUser, fetchQrTypes, fetchVisitors, fetchCompanyUsage])

  useEffect(() => {
    const types = new Set<string>()
    
    // Check if there are any valid packs
    const hasValidPacks = qrTypes.some(q => q.vigente)
    
    if (hasValidPacks) {
        // 'Uso General' is available if there is at least one valid pack (used as fallback)
        types.add('Uso General')
        
        // Add other specific types if needed, e.g. 'Administrativo'
        qrTypes.forEach(q => {
            if (q.vigente && q.tipoQR === 'Administrativo') {
                types.add('Administrativo')
            }
        })
    }
    
    setUniqueQrTypes(Array.from(types))
  }, [qrTypes])

  const handleCreateVisitor = async () => {
    if (!currentUser?.idEmpresa || !currentUser.uid) return null
    
    let idImageUrl = null

    if (newVisitorIdImage) {
       const fileExt = newVisitorIdImage.name.split('.').pop()
       const fileName = `${Math.random()}.${fileExt}`
       const filePath = `${currentUser.idEmpresa}/${fileName}`

       const { error: uploadError } = await supabase.storage
         .from('identificaciones')
         .upload(filePath, newVisitorIdImage)

       if (uploadError) {
         alert('Error subiendo identificación: ' + uploadError.message)
         return null
       }
       
       const { data } = supabase.storage.from('identificaciones').getPublicUrl(filePath)
       idImageUrl = data.publicUrl
    }

    const newVisitor = {
      nomVisitante: newVisitorName,
      telefonoVisitante: newVisitorPhone,
      tipoVehiculo: newVisitorVehicleType,
      placasVehiculo: newVisitorPlate,
      urlIdentificacion: idImageUrl,
      idEmpresa: currentUser.idEmpresa,
      uidr: currentUser.uid,
      status: true
    }

    const { data, error } = await supabase
      .from('datosVisitantes')
      .insert([newVisitor])
      .select()

    if (error) {
      alert('Error creando visitante: ' + error.message)
      return null
    }
    
    if (data && data.length > 0) {
      setVisitors([...visitors, data[0]])
      setIsNewVisitor(false)
      setSelectedVisitorId(data[0].idVisitante)
      setNewVisitorName('')
      setNewVisitorPhone('')
      setNewVisitorVehicleType('')
      setNewVisitorPlate('')
      return data[0].idVisitante
    }
    return null
  }

  const generateAccessKey = () => {
    const chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789';
    let result = '';
    for (let i = 0; i < 15; i++) {
      result += chars.charAt(Math.floor(Math.random() * chars.length));
    }
    return result;
  }

  const handleGenerateQR = async () => {
    if (!selectedQrType || !visitDate) {
      alert('Por favor selecciona tipo de QR y fecha')
      return
    }

    let visitorId = selectedVisitorId
    if (isNewVisitor) {
      if (!newVisitorName) {
        alert('Nombre del visitante es requerido')
        return
      }
      if (!newVisitorIdImage) {
        alert('La identificación del visitante es obligatoria')
        return
      }
      const newId = await handleCreateVisitor()
      if (!newId) return
      visitorId = newId
    } else if (!visitorId) {
       alert('Por favor selecciona un visitante')
       return
    }

    setLoading(true)
    const accessKey = generateAccessKey()
    
    let validPack: QrEmpresa | undefined;
    
    if (selectedQrType === 'Administrativo') {
      validPack = qrTypes.find(q => q.tipoQR === 'Administrativo')
      if (!validPack) {
         validPack = qrTypes.find(q => q.tipoQR === 'Administrativo')
      }
      if (!validPack) {
         validPack = qrTypes[0]
      }
      if (!validPack) {
          alert('No se encontró configuración de QR para su empresa.')
          setLoading(false)
          return
      }

    } else {
      const remaining = companyDailyLimit - companyDailyUsage
      if (remaining <= 0) {
          alert(`Has alcanzado el límite diario de QRs (${companyDailyLimit}). Intenta mañana.`)
          setLoading(false)
          return
      }

      validPack = qrTypes.find(q => 
        q.tipoQR === selectedQrType && 
        q.vigente === true
      )

      if (!validPack) {
        validPack = qrTypes.find(q => q.vigente === true)
      }
    
      if (!validPack) {
        alert(`No hay configuración vigente para generar QRs.`)
        setLoading(false)
        return
      }
    }

    const visitorObj = visitors.find(v => v.idVisitante === visitorId)
    
    if (!visitorObj) {
        alert('Error: No se encontraron datos del visitante.')
        setLoading(false)
        return
    }

    const newQR = {
      claveAcceso: accessKey,
      idVisitante: visitorId,
      idQrEmpresas: validPack?.idQrEmpresas || null,
      fechaValidez: visitDate,
      tipoQR: selectedQrType,
      status: true,
      vigencia: true,
      uidr: currentUser?.uid,
      tipoVehiculo: visitorObj.tipoVehiculo,
      placasVehiculo: visitorObj.placasVehiculo,
      estado: 1,
      limiteUsos: 3,
      usos: 0,
      fc: new Date().toISOString()
    }

    const { error } = await supabase
      .from('qrGenerados')
      .insert([newQR])

    if (error) {
      alert('Error generando QR: ' + error.message)
    } else {
      fetchQrTypes()
      fetchCompanyUsage()
      setGeneratedQR({
        code: accessKey,
        type: selectedQrType,
        visitor: visitorObj.nomVisitante || '',
        date: visitDate
      })
    }
    setLoading(false)
  }

  const handleShareWhatsApp = async () => {
    if (!qrRef.current || !generatedQR) return
    
    try {
        const canvas = await html2canvas(qrRef.current, {
            backgroundColor: '#ffffff',
            scale: 2
        })
        
        canvas.toBlob(async (blob) => {
            if (!blob) return

            const file = new File([blob], `access-${generatedQR.code}.png`, { type: 'image/png' })
            const text = `Hola ${generatedQR.visitor}, aquí tienes tu código de acceso QR para el día ${generatedQR.date}.`

            if (navigator.share && navigator.canShare && navigator.canShare({ files: [file] })) {
                try {
                    await navigator.share({
                        files: [file],
                        title: 'Código de Acceso',
                        text: text
                    })
                } catch (error) {
                    if (error instanceof Error && error.name !== 'AbortError') {
                         console.error('Error sharing:', error)
                         alert('No se pudo compartir la imagen directamente.')
                    }
                }
            } else {
                try {
                    await navigator.clipboard.write([
                        new ClipboardItem({
                            [blob.type]: blob
                        })
                    ])
                    alert('Imagen copiada al portapapeles. Por favor presiona Ctrl+V para pegarla en WhatsApp.')
                    window.open(`https://wa.me/?text=${encodeURIComponent(text)}`, '_blank')
                } catch (clipboardError) {
                    console.warn('Clipboard write failed, falling back to download', clipboardError)
                    const url = URL.createObjectURL(blob)
                    const a = document.createElement('a')
                    a.href = url
                    a.download = `access-${generatedQR.code}.png`
                    document.body.appendChild(a)
                    a.click()
                    document.body.removeChild(a)
                    URL.revokeObjectURL(url)
                    
                    alert('La imagen se ha descargado. Por favor envíala por WhatsApp.')
                    window.open(`https://wa.me/?text=${encodeURIComponent(text + " (Te envío la imagen del QR adjunta)")}`, '_blank')
                }
            }
        })
    } catch (error) {
        console.error('Error generating image:', error)
        alert('Error al generar la imagen del QR.')
    }
  }

  if (generatedQR) {
     return (
       <div className="flex items-center justify-center p-4">
          <div className="bg-white p-6 rounded-lg shadow-md w-full max-w-md text-center">
             <div ref={qrRef} className="bg-white p-4 rounded-xl" style={{ backgroundColor: '#ffffff' }}>
                 <div className="flex items-center justify-center gap-2 mb-4" style={{ marginBottom: '16px' }}>
                    <QrCode style={{ color: '#1F2D4A', width: '32px', height: '32px' }} />
                    <h2 style={{ fontSize: '18px', fontWeight: 'bold', color: '#1F2D4A', margin: 0 }}>
                      Acceso SPH
                    </h2>
                 </div>
                 <div style={{ display: 'flex', justifyContent: 'center', marginBottom: '16px' }}>
                   <QRCode value={generatedQR.code} size={200} />
                 </div>
                 <div className="text-left space-y-2" style={{ textAlign: 'left', marginTop: '16px' }}>
                    <p style={{ fontSize: '14px', color: '#666' }}>Visitante: <strong style={{ color: '#000' }}>{generatedQR.visitor}</strong></p>
                    <p style={{ fontSize: '14px', color: '#666' }}>Tipo: <strong style={{ color: '#000' }}>{generatedQR.type}</strong></p>
                    <p style={{ fontSize: '14px', color: '#666' }}>Fecha: <strong style={{ color: '#000' }}>{generatedQR.date}</strong></p>
                    <p style={{ fontSize: '12px', color: '#999', marginTop: '8px' }}>Clave: {generatedQR.code}</p>
                 </div>
             </div>

             <div className="mt-6 space-y-3">
               <button
                 onClick={handleShareWhatsApp}
                 className="w-full flex items-center justify-center gap-2 bg-[#25D366] text-white py-3 rounded-lg font-bold hover:opacity-90 transition"
               >
                 <Share2 className="w-5 h-5" />
                 Compartir por WhatsApp
               </button>
               
               <button
                 onClick={() => setGeneratedQR(null)}
                 className="w-full py-3 text-gray-500 font-medium hover:text-gray-700"
               >
                 Generar Nuevo
               </button>
             </div>
          </div>
       </div>
     )
  }

  return (
      <div className="space-y-5">
        {/* 1. Tipo de QR */}
        <section className="bg-white p-4 rounded-xl shadow-sm border border-gray-100">
          <label className="block text-sm font-medium text-sph-text mb-2 flex items-center gap-2">
            <QrCode className="w-4 h-4 text-sph-primary" /> Tipo de QR
          </label>
          <SearchableSelect
            options={uniqueQrTypes.map(type => {
              let availabilityText = '';
              if (type === 'Administrativo') {
                 availabilityText = '(Ilimitado)';
              } else if (type === 'Uso General') {
                 const remaining = Math.max(0, companyDailyLimit - companyDailyUsage);
                 availabilityText = `(${remaining} disp. hoy)`;
              } else {
                 const available = qrTypes
                  .filter(q => q.tipoQR === type && q.vigente === true)
                  .reduce((acc, curr) => acc + (curr.disponibles || 0), 0)
                 availabilityText = available > 0 ? `(${available} en inventario)` : '(Sin saldo)';
              }
              return { value: type, label: `${type} ${availabilityText}` }
            })}
            value={selectedQrType}
            onChange={setSelectedQrType}
            disabled={uniqueQrTypes.length === 0}
            placeholder={
                uniqueQrTypes.length === 0 
                ? (currentUser?.idEmpresa ? 'Sin tipos de QR disponibles' : 'Usuario sin empresa asignada') 
                : 'Selecciona un tipo...'
            }
          />
        </section>

        {/* 2. Visitante */}
        <section className="bg-white p-4 rounded-xl shadow-sm border border-gray-100">
          <div className="flex justify-between items-center mb-2">
            <label className="text-sm font-medium text-sph-text flex items-center gap-2">
              <Search className="w-4 h-4 text-sph-primary" /> Visitante
            </label>
            <button
              onClick={() => setIsNewVisitor(!isNewVisitor)}
              className="text-xs text-sph-primary font-medium flex items-center gap-1 hover:underline"
            >
              <Plus className="w-3 h-3" />
              {isNewVisitor ? 'Seleccionar Existente' : 'Nuevo Visitante'}
            </button>
          </div>

          {isNewVisitor ? (
            <div className="space-y-3 animate-in fade-in slide-in-from-top-2">
              <input
                type="text"
                placeholder="Nombre Completo"
                value={newVisitorName}
                onChange={(e) => setNewVisitorName(e.target.value)}
                className="w-full p-3 bg-sph-light border border-gray-200 rounded-lg outline-none focus:border-sph-primary text-sph-text"
              />
              <input
                type="tel"
                placeholder="Teléfono (10 dígitos)"
                value={newVisitorPhone}
                onChange={handlePhoneChange}
                className="w-full p-3 bg-sph-light border border-gray-200 rounded-lg outline-none focus:border-sph-primary text-sph-text"
              />
              <div className="grid grid-cols-2 gap-3">
                <select
                  value={newVisitorVehicleType}
                  onChange={(e) => setNewVisitorVehicleType(e.target.value)}
                  className="w-full p-3 bg-sph-light border border-gray-200 rounded-lg outline-none focus:border-sph-primary text-sph-text"
                >
                  <option value="">Tipo Vehículo...</option>
                  <option value="Ligero">Ligero</option>
                  <option value="Carga">Carga</option>
                </select>
                 <input
                  type="text"
                  placeholder="Placas"
                  value={newVisitorPlate}
                  onChange={(e) => setNewVisitorPlate(e.target.value)}
                  className="w-full p-3 bg-sph-light border border-gray-200 rounded-lg outline-none focus:border-sph-primary text-sph-text"
                />
              </div>
              <div className="w-full">
                <label className="block text-sm text-sph-text mb-1 font-medium">Identificación (Requerida)</label>
                <input
                  type="file"
                  accept="image/*"
                  onChange={(e) => setNewVisitorIdImage(e.target.files ? e.target.files[0] : null)}
                  className="w-full p-2 bg-sph-light border border-gray-200 rounded-lg text-sm text-sph-text file:mr-4 file:py-2 file:px-4 file:rounded-full file:border-0 file:text-sm file:font-semibold file:bg-sph-primary file:text-white hover:file:opacity-90"
                />
              </div>
            </div>
          ) : (
            <SearchableSelect
              options={visitors.map(v => ({
                value: v.idVisitante,
                label: `${v.nomVisitante} ${v.placasVehiculo ? `(${v.placasVehiculo})` : ''}`
              }))}
              value={selectedVisitorId}
              onChange={setSelectedVisitorId}
              placeholder="Selecciona un visitante..."
            />
          )}
        </section>

        {/* 3. Fecha */}
        <section className="bg-white p-4 rounded-xl shadow-sm border border-gray-100">
           <label className="block text-sm font-medium text-sph-text mb-2 flex items-center gap-2">
            <Calendar className="w-4 h-4 text-sph-primary" /> Fecha de Visita
          </label>
          <input 
            type="date"
            value={visitDate}
            min={new Date().toISOString().split('T')[0]}
            onChange={(e) => setVisitDate(e.target.value)}
            className="w-full p-3 bg-sph-light border border-gray-200 rounded-lg outline-none focus:border-sph-primary text-sph-text"
          />
        </section>

        <button
          onClick={handleGenerateQR}
          disabled={loading}
          className="w-full bg-sph-primary text-white py-4 rounded-xl font-bold text-lg shadow-lg hover:opacity-90 transition disabled:opacity-50 flex items-center justify-center gap-2"
        >
          {loading ? (
            'Generando...'
          ) : (
            <>
              <Save className="w-5 h-5" /> Generar Código QR
            </>
          )}
        </button>
      </div>
  )
}
