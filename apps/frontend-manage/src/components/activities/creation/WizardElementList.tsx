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
import { twMerge } from 'tailwind-merge'
import {
  ElementBlockErrorValues,
  ElementBlockFormValues,
  ElementStackErrorValues,
  ElementStackFormValues,
} from './WizardLayout'

interface BaseProps {
  stackIx: number
  selectionActive: boolean
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
}: StackWizardElementListProps | BlockWizardElementListProps) {
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

        return (
          <div
            key={`${elementIdx}-${element.title}`}
            className="flex flex-row items-center border-b border-solid border-slate-200 pl-1 text-xs last:border-b-0"
            data-cy={`element-${elementIdx}-${type}-${stackIx}`}
          >
            <div className="flex-1">
              <Ellipsis
                maxLines={1}
                className={{ content: 'text-xs' }}
                withMarkdown={false}
                withMarkdownTooltip={false}
              >
                {element.title}
              </Ellipsis>
            </div>
            <div className="flex flex-row items-center">
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
                  root: 'px-1 disabled:hidden',
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
                  root: 'px-1 disabled:hidden',
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
              <Button.Icon
                withoutLabel
                icon={faTrash}
                className={{ root: 'h-3 w-3' }}
              />
            </Button>
          </div>
        )
      })}
    </div>
  )
}

export default WizardElementList
