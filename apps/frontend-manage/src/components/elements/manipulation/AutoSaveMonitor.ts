import { Dispatch, SetStateAction, useCallback, useEffect, useRef } from 'react'
import { ElementFormTypes } from './types'

function AutoSaveMonitor({
  values,
  initialValuesString,
  setAutoSavedElement,
}: {
  values: ElementFormTypes
  initialValuesString: string
  setAutoSavedElement: Dispatch<SetStateAction<ElementFormTypes>>
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
        // only update the stored content if it has changed
        if (JSON.stringify(values) !== initialValuesString) {
          setAutoSavedElement(values)
        }
      }, 2000)
    },
    [setAutoSavedElement, initialValuesString]
  )

  useEffect(() => {
    autoSaveContent({ values })

    return () => {
      if (savingTimeout.current) {
        clearTimeout(savingTimeout.current as NodeJS.Timeout)
      }
    }
  }, [autoSaveContent, values])

  return null
}

export default AutoSaveMonitor
