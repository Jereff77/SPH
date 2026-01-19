import { useState, useEffect } from 'react'

export function useDetectKeyboard() {
  const [isKeyboardOpen, setIsKeyboardOpen] = useState(false)

  useEffect(() => {
    // We use visualViewport if available as it's more reliable on modern mobile browsers
    // especially iOS Safari where innerHeight doesn't always reflect keyboard
    const visualViewport = window.visualViewport

    if (!visualViewport) {
      // Fallback for older browsers (simplified)
      return
    }

    // Capture the initial height to compare against
    // We update this on orientation change (width change)
    let initialHeight = visualViewport.height

    const handleResize = () => {
      const currentHeight = visualViewport.height
      
      // If height shrinks by more than 20%, we assume keyboard is open
      // This threshold helps avoid false positives from browser bars hiding/showing
      if (currentHeight < initialHeight * 0.80) {
        setIsKeyboardOpen(true)
      } else {
        setIsKeyboardOpen(false)
        // Update initial height when keyboard closes to account for browser UI changes
        if (currentHeight > initialHeight) {
            initialHeight = currentHeight
        }
      }
    }

    // Reset baseline on orientation change (width change)
    const handleReset = () => {
        initialHeight = visualViewport.height
        setIsKeyboardOpen(false)
    }

    visualViewport.addEventListener('resize', handleResize)
    // Also listen to window resize to detect orientation changes more reliably
    window.addEventListener('resize', handleReset)

    return () => {
      visualViewport.removeEventListener('resize', handleResize)
      window.removeEventListener('resize', handleReset)
    }
  }, [])

  return isKeyboardOpen
}
