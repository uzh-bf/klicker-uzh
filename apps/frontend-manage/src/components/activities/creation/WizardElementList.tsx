import {
  faArrowDown,
  faArrowUp,
  faCircleExclamation,
  faTrash,
  faWarning,
} from '@fortawesome/free-solid-svg-icons'
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome'
import { ElementType } from '@klicker-uzh/graphql/dist/ops'
import { Ellipsis } from '@klicker-uzh/markdown'
import { Button } from '@uzh-bf/design-system'
import { swapIndices } from 'remeda'
import {
  ElementBlockErrorValues,
  ElementBlockFormValues,
  ElementStackErrorValues,
  ElementStackFormValues,
} from './WizardLayout'

interface BaseProps {
  stackIx: number
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
}: StackWizardElementListProps | BlockWizardElementListProps) {
  return (
    <div className="my-2 flex max-h-[7.5rem] flex-1 flex-col overflow-y-auto">
      {stack.elements.map((element, elementIdx) => {
        const errors =
          error && Array.isArray(error)
            ? error.length > stackIx
              ? error[stackIx]?.elements
              : undefined
            : error?.elements

        return (
          <div
            key={`${elementIdx}-${element.title}`}
            className="flex flex-row items-center border-b border-solid border-slate-200 py-0.5 text-xs last:border-b-0"
            data-cy={`element-${elementIdx}-${type}-${stackIx}`}
          >
            <div className="flex-1">
              <Ellipsis
                // maxLines={1}
                maxLength={40}
                className={{ content: 'text-xs' }}
              >
                {element.title}
              </Ellipsis>
            </div>
            <div className="flex flex-row">
              {errors?.[elementIdx] && (
                <FontAwesomeIcon
                  icon={faCircleExclamation}
                  className="mr-1 text-red-600"
                />
              )}
              {highlightFTNoSL &&
                element.type === ElementType.FreeText &&
                !element.hasSampleSolution && (
                  <FontAwesomeIcon
                    icon={faWarning}
                    className="mr-1 text-orange-500"
                  />
                )}
              <Button
                basic
                className={{
                  root: 'hover:bg-primary-20 flex flex-col justify-center px-1 disabled:hidden',
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
                <FontAwesomeIcon icon={faArrowUp} />
              </Button>
              <Button
                basic
                className={{
                  root: 'hover:bg-primary-20 flex flex-col justify-center px-1 disabled:hidden',
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
                <FontAwesomeIcon icon={faArrowDown} />
              </Button>
            </div>
            <Button
              basic
              className={{
                root: `px-1 hover:text-red-600`,
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
              <Button.Icon>
                <FontAwesomeIcon icon={faTrash} />
              </Button.Icon>
            </Button>
          </div>
        )
      })}
    </div>
  )
}

export default WizardElementList
