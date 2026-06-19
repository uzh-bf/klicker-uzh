import { useMemo } from 'react'
import type { ElementInstance } from '../../../lib/constants/elementTypes'
import { ElementFormTypes } from '../../elements/manipulation/types'
import extractFormValuesFromElementInstance from './extractFormValuesFromElementInstance'

// memoized version of the form value from instance extraction function
function useFormValuesFromElementInstance({
  instance,
}: {
  instance: ElementInstance
}) {
  return useMemo(
    (): ElementFormTypes => extractFormValuesFromElementInstance({ instance }),
    [instance]
  )
}

export default useFormValuesFromElementInstance
