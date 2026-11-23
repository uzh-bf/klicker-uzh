import { ActivityType, Element } from '@klicker-uzh/graphql/dist/ops'
import { Checkbox } from '@uzh-bf/design-system'
import { useTranslations } from 'next-intl'
import { Dispatch, SetStateAction } from 'react'
import { isEmpty } from 'remeda'

function ElementListSelectAllCheckbox({
  elements,
  selectedElements,
  setSelectedElements,
  creationMode,
}: {
  elements: Element[]
  selectedElements: Record<number, Element>
  setSelectedElements: Dispatch<SetStateAction<Record<number, Element>>>
  creationMode?: ActivityType
}) {
  const t = useTranslations()
  const allSelected =
    elements.length !== 0 &&
    elements.every((element) => Boolean(selectedElements[element.id]))

  return (
    <>
      <label className="sr-only" htmlFor="select-all-elements">
        {t(
          allSelected
            ? 'manage.general.deselectAllElements'
            : 'manage.general.selectAllElements'
        )}
      </label>
      <Checkbox
        id="select-all-elements"
        checked={allSelected}
        partial={
          Object.values(selectedElements).filter((value) => value).length > 0
        }
        onCheck={() => {
          setSelectedElements((prev) => {
            if (elements) {
              if (!isEmpty(selectedElements)) {
                // if the selection is non-empty, reset it
                return {}
              }

              // add all elements to the selection
              const allElements = elements.reduce<Record<number, Element>>(
                (acc, element) => {
                  // if activity creation is open, only select elements with manager access
                  if (creationMode && !element.isManager) return acc
                  acc[element.id] = element
                  return acc
                },
                {}
              )
              return allElements
            }

            return prev
          })
        }}
        className={{ root: 'border-unset' }}
        data={{ cy: 'select-all-elements' }}
      />
    </>
  )
}

export default ElementListSelectAllCheckbox
