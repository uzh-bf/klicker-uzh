import { Dispatch, SetStateAction, useCallback, useEffect, useRef } from 'react'
import { ElementFormTypes } from './types'

function useAutoSave({
  values,
  setAutoSavedElement,
  setSaving,
}: {
  values: ElementFormTypes
  setAutoSavedElement: Dispatch<SetStateAction<ElementFormTypes>>
  setSaving: Dispatch<SetStateAction<boolean>>
}) {
  // create a call-back function that will save the editor's content every 2 seconds
  // (if not actively typing -> do not disturb other state updates)
  const savingTimeout = useRef<NodeJS.Timeout | null>(null)
  const autoSaveContent = useCallback(
    ({ values }: { values: ElementFormTypes }) => {
      if (savingTimeout.current) {
        clearTimeout(savingTimeout.current as NodeJS.Timeout)
      }

      savingTimeout.current = setTimeout(async () => {
        setSaving(false)
        setAutoSavedElement(values)
      }, 2000)
    },
    [setAutoSavedElement, setSaving]
  )

  useEffect(() => {
    setSaving(true)
    autoSaveContent({ values })

    return () => {
      if (savingTimeout.current) {
        clearTimeout(savingTimeout.current as NodeJS.Timeout)
      }
    }
  }, [values])

  return null
}

export default useAutoSave
