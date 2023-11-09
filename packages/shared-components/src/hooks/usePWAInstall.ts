import { useEffect } from 'react'

export interface BeforeInstallPromptEventReturn {
  userChoice: string
  platform: string
}

export interface BeforeInstallPromptEvent extends Event {
  prompt(): Promise<BeforeInstallPromptEventReturn>
}

export interface usePWAInstallProps {
  deferredPrompt: React.MutableRefObject<BeforeInstallPromptEvent | undefined>
  setOnChrome: (value: boolean) => void
  setOniOS: (value: boolean) => void
}

const usePWAInstall = ({
  deferredPrompt,
  setOnChrome,
  setOniOS,
}: usePWAInstallProps) => {
  useEffect(() => {
    // Check if event is supported
    if ('onbeforeinstallprompt' in window) {
      window.addEventListener('beforeinstallprompt', (e) => {
        e.preventDefault()
        deferredPrompt.current = e as BeforeInstallPromptEvent
        setOnChrome(true)
      })
    } else {
      // TODO: resolve this fallback - currently shows install symbol on all mac browsers (also PCs)
      // We assume users are on iOS (for now)
      setOniOS(true)
    }
  }, [])
}

export default usePWAInstall
