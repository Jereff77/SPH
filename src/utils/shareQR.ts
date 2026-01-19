import html2canvas from 'html2canvas'

export const generateQRBlob = async (element: HTMLElement): Promise<Blob | null> => {
  try {
    const canvas = await html2canvas(element, {
      backgroundColor: '#ffffff',
      scale: 2
    })
    
    return new Promise((resolve) => {
      canvas.toBlob((blob) => {
        resolve(blob)
      }, 'image/png')
    })
  } catch (error) {
    console.error('Error generating QR blob:', error)
    return null
  }
}

export const shareNative = async (file: File, title?: string, text?: string): Promise<boolean> => {
  const shareData: ShareData = {
    files: [file]
  }
  if (title) shareData.title = title
  if (text) shareData.text = text

  if (navigator.share && navigator.canShare && navigator.canShare(shareData)) {
    try {
      await navigator.share(shareData)
      return true
    } catch (error) {
      if (error instanceof Error && error.name !== 'AbortError') {
        console.error('Error sharing:', error)
      }
      return false
    }
  }
  return false
}

export const shareWhatsApp = (text: string) => {
  window.open(`https://wa.me/?text=${encodeURIComponent(text)}`, '_blank')
}

export const shareEmail = (title: string, body: string) => {
  window.open(`mailto:?subject=${encodeURIComponent(title)}&body=${encodeURIComponent(body)}`)
}

export const downloadQR = (blob: Blob, filename: string) => {
  const url = URL.createObjectURL(blob)
  const a = document.createElement('a')
  a.href = url
  a.download = filename
  document.body.appendChild(a)
  a.click()
  document.body.removeChild(a)
  URL.revokeObjectURL(url)
}
