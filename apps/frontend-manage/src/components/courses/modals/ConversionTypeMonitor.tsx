import { useEffect } from 'react'

function ConversionTypeMonitor({
  conversionType,
  setConversionConfirmation,
}: {
  conversionType: 'copy' | 'convert' | null
  setConversionConfirmation: (newValue: boolean) => void
}) {
  useEffect(() => {
    if (conversionType === 'copy') {
      setConversionConfirmation(true)
    } else if (conversionType === 'convert') {
      setConversionConfirmation(false)
    }
  }, [conversionType, setConversionConfirmation])

  return null
}

export default ConversionTypeMonitor
