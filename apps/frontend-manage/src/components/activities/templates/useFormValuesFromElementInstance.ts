import { ElementInstance } from '@klicker-uzh/graphql/dist/ops'
import { useMemo } from 'react'
import { ElementFormTypes } from '../../questions/manipulation/types'
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
