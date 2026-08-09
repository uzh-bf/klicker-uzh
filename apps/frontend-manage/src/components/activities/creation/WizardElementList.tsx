import {
  faArrowDown,
  faArrowsRotate,
  faArrowUp,
  faCircleExclamation,
  faTrash,
  faWarning,
} from '@fortawesome/free-solid-svg-icons'
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome'
import {
  ElementInstanceVersionInfo,
  ElementType,
} from '@klicker-uzh/graphql/dist/ops'
import { Ellipsis } from '@klicker-uzh/markdown'
import { Button } from '@uzh-bf/design-system'
import { useMemo } from 'react'
import { swapIndices } from 'remeda'
import { twMerge } from 'tailwind-merge'
import { OutdatedInstancesRefetchFunction } from './InstanceUpdateOption'
import {
  ElementBlockErrorValues,
  ElementBlockFormValues,
  ElementStackErrorValues,
  ElementStackFormValues,
} from './WizardLayout'

interface BaseProps {
  stackIx: number
  selectionActive: boolean
  outdatedInstances: ElementInstanceVersionInfo[]
  refetchOutdatedInstances: OutdatedInstancesRefetchFunction
}

interface StackWizardElementListProps extends BaseProps {
  type: 'stack'
  stack: ElementStackFormValues
  error: ElementStackErrorValues | ElementStackErrorValues[] | undefined
  replace: (index: number, value: ElementStackFormValues) => void
  highlightFTNoSL?: boolean
}

interface BlockWizardElementListProps extends BaseProps {
  type: 'block'
  stack: ElementBlockFormValues
  error: ElementBlockErrorValues | ElementBlockErrorValues[] | undefined
  replace: (index: number, value: ElementBlockFormValues) => void
  highlightFTNoSL?: never
}

function WizardElementList({
  type,
  stackIx,
  stack,
  error,
  replace,
  highlightFTNoSL,
  selectionActive,
  outdatedInstances,
  refetchOutdatedInstances,
}: StackWizardElementListProps | BlockWizardElementListProps) {
  const outdatedInstanceMap = useMemo(() => {
    return outdatedInstances.reduce<{
      [instanceId: number]: ElementInstanceVersionInfo
    }>((acc, instance) => {
      acc[instance.id] = instance
      return acc
    }, {})
  }, [outdatedInstances])

  return (
    <div
      className={twMerge(
        'max-h-30 my-2 flex flex-1 flex-col overflow-y-auto',
        selectionActive ? 'max-h-22' : ''
      )}
    >
      {stack.elements.map((element, elementIdx) => {
        const errors =
          error && Array.isArray(error)
            ? error.length > stackIx
              ? error[stackIx]?.elements
              : undefined
            : error?.elements

        const instanceOutdated =
          !!outdatedInstanceMap[element.existingInstanceId ?? -1]

        return (
          <div
            key={`${type}-${element.id}-${element.existingInstanceId ?? 'new'}-${element.title}`}
            className={twMerge(
              'flex flex-row items-center justify-between border-b border-solid border-slate-200 pl-1 text-xs last:border-b-0',
              instanceOutdated && 'bg-uzh-red-20'
            )}
            data-cy={`element-${elementIdx}-${type}-${stackIx}`}
          >
            <Ellipsis
              maxLines={1}
              className={{ content: 'mr-auto text-xs' }}
              withMarkdown={false}
              withMarkdownTooltip={false}
            >
              {element.title}
            </Ellipsis>

            <div className="flex flex-row items-center">
              {errors?.[elementIdx] && (
                <FontAwesomeIcon
                  icon={faCircleExclamation}
                  className="mr-1 text-red-600"
                />
              )}
              {highlightFTNoSL &&
              element.type === ElementType.FreeText &&
              !element.hasSampleSolution ? (
                <FontAwesomeIcon
                  icon={faWarning}
                  className="mr-1 text-orange-500"
                />
              ) : null}
              {!!outdatedInstanceMap[element.existingInstanceId ?? -1] && (
                <Button
                  basic
                  onClick={async () => {
                    const outdatedInstance =
                      outdatedInstanceMap[element.existingInstanceId ?? -1]!

                    replace(stackIx, {
                      ...stack,
                      elements: stack.elements.map((el, idx) =>
                        idx === elementIdx
                          ? {
                              ...el,
                              existingInstanceId: null, // unset the existing instance ID to use the latest version of the element
                              duplicateInstance: false,
                              title: outdatedInstance.newTitle, // update the title to the new one
                              hasSampleSolution:
                                outdatedInstance.newSampleSolution, // update the sample solution to the new one
                            }
                          : el
                      ),
                    })

                    await refetchOutdatedInstances({
                      instanceIds: outdatedInstances
                        .filter((el) => el.id !== element.existingInstanceId)
                        .map((el) => el.id),
                    })
                  }}
                  className={{
                    root: 'px-1 text-orange-500 hover:bg-transparent hover:text-orange-500',
                  }}
                  data={{
                    cy: `update-element-${elementIdx}-${type}-${stackIx}`,
                  }}
                >
                  <Button.Icon withoutLabel icon={faArrowsRotate} />
                </Button>
              )}
              <Button
                basic
                className={{
                  root: twMerge(
                    'px-1 disabled:hidden',
                    !!outdatedInstanceMap[element.existingInstanceId ?? -1] &&
                      'hover:bg-transparent'
                  ),
                }}
                disabled={stack.elements.length === 1}
                onClick={() => {
                  if (!(elementIdx === 0 || stack.elements.length === 1)) {
                    replace(stackIx, {
                      ...stack,
                      elements: swapIndices(
                        stack.elements,
                        elementIdx,
                        elementIdx - 1
                      ),
                    })
                  }
                }}
                data={{
                  cy: `move-element-${elementIdx}-${type}-${stackIx}-up`,
                }}
              >
                <Button.Icon
                  withoutLabel
                  icon={faArrowUp}
                  className={{ root: 'h-3 w-3' }}
                />
              </Button>
              <Button
                basic
                className={{
                  root: twMerge(
                    'px-1 disabled:hidden',
                    !!outdatedInstanceMap[element.existingInstanceId ?? -1] &&
                      'hover:bg-transparent'
                  ),
                }}
                disabled={stack.elements.length === 1}
                onClick={() => {
                  if (
                    !(
                      stack.elements.length === elementIdx - 1 ||
                      stack.elements.length === 1
                    )
                  ) {
                    replace(stackIx, {
                      ...stack,
                      elements: swapIndices(
                        stack.elements,
                        elementIdx,
                        elementIdx + 1
                      ),
                    })
                  }
                }}
                data={{
                  cy: `move-element-${elementIdx}-${type}-${stackIx}-down`,
                }}
              >
                <Button.Icon
                  withoutLabel
                  icon={faArrowDown}
                  className={{ root: 'h-3 w-3' }}
                />
              </Button>
              <Button
                basic
                className={{
                  root: twMerge(
                    `px-1 hover:text-red-600`,
                    !!outdatedInstanceMap[element.existingInstanceId ?? -1] &&
                      'hover:bg-transparent'
                  ),
                }}
                onClick={() => {
                  replace(stackIx, {
                    ...stack,
                    elements: stack.elements
                      .slice(0, elementIdx)
                      .concat(stack.elements.slice(elementIdx + 1)),
                  })
                }}
                data={{ cy: `remove-element-${elementIdx}-${type}-${stackIx}` }}
              >
                <Button.Icon
                  withoutLabel
                  icon={faTrash}
                  className={{ root: 'h-3 w-3' }}
                />
              </Button>
            </div>
          </div>
        )
      })}
    </div>
  )
}

export default WizardElementList
