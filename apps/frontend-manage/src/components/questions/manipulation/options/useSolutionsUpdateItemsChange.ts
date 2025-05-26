import { FieldHelperProps } from 'formik'
import { useEffect } from 'react'
import { ElementFormTypesCaseStudy } from '../types'

function useSolutionsUpdateItemsChange({
  itemIds,
  cases,
  casesHelpers,
}: {
  itemIds: number[]
  cases: ElementFormTypesCaseStudy['options']['cases']
  casesHelpers: FieldHelperProps<ElementFormTypesCaseStudy['options']['cases']>
}) {
  useEffect(() => {
    // map over the cases and remove any solutions that do not belong to one of the selected items
    const newCases = cases?.map((caseItem) => {
      // if no solutions are set, skip this case
      if (!('solutions' in caseItem) || !caseItem.solutions) {
        return caseItem
      }

      // filter out all solution entries that do not belong to one of the selected items
      const newSolutions = Object.fromEntries(
        Object.entries(caseItem.solutions).filter(([itemIdString]) =>
          itemIds.includes(parseInt(itemIdString.split('-')[1]))
        )
      )

      return {
        ...caseItem,
        solutions: newSolutions,
      }
    })

    // update the cases field with the new cases
    casesHelpers.setValue(newCases)

    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [itemIds, casesHelpers])

  return null
}

export default useSolutionsUpdateItemsChange
