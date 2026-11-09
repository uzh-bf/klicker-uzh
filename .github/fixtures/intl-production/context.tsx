import FontSizeButtons from '@klicker-uzh/shared-components/src/FontSizeButtons'
import { useState } from 'react'

export default function TranslationContextProbe() {
  const [textSize, setTextSize] = useState(16)
  return (
    <FontSizeButtons
      textSize={textSize}
      minTextSize={12}
      maxTextSize={24}
      setTextSize={setTextSize}
    />
  )
}

export function getServerSideProps({ locale }: { locale: string }) {
  return {
    props: {
      messages: {
        manage: { evaluation: { fontSize: `INTL_CONTEXT_PROBE_${locale}` } },
      },
    },
  }
}
