import { Dispatch, SetStateAction, useCallback, useEffect, useRef } from 'react'
import { ElementFormTypes } from './types'

function useAutoSave({
  values,
  setAutoSavedElement,
}: {
  values: ElementFormTypes
  setAutoSavedElement: Dispatch<SetStateAction<ElementFormTypes>>
}) {
  // create a call-back function that will save the editor's content every 5 seconds
  const savingTimeout = useRef<NodeJS.Timeout | null>(null)
  const autoSaveContent = useCallback(
    ({ values }: { values: ElementFormTypes }) => {
      if (savingTimeout.current) {
        clearTimeout(savingTimeout.current as NodeJS.Timeout)
      }

      savingTimeout.current = setTimeout(async () => {
        setAutoSavedElement(values)
      }, 3000)
    },
    [setAutoSavedElement]
  )

  useEffect(() => {
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
