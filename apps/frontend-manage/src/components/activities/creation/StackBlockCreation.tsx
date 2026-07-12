import { faCommentDots } from '@fortawesome/free-regular-svg-icons'
import {
  faArrowLeft,
  faArrowRight,
  faCircleExclamation,
  faTrash,
  faWarning,
} from '@fortawesome/free-solid-svg-icons'
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome'
import {
  Element,
  ElementInstanceVersionInfo,
  ElementType,
} from '@klicker-uzh/graphql/dist/ops'
import { Button, Tooltip } from '@uzh-bf/design-system'
import { useTranslations } from 'next-intl'
import { useState } from 'react'
import { useDrop } from 'react-dnd'
import { isEmpty } from 'remeda'
import { twMerge } from 'tailwind-merge'
import { ElementDragDropTypes } from '../../elements/Element'
import DropElementsStack from './DropElementsStack'
import { OutdatedInstancesRefetchFunction } from './InstanceUpdateOption'
import PasteSelectionButton from './PasteSelectionButton'
import StackCreationErrors from './StackCreationErrors'
import StackDescriptionModal from './StackDescriptionModal'
import WizardElementList from './WizardElementList'
import { ElementStackErrorValues, ElementStackFormValues } from './WizardLayout'

interface StackBlockCreationProps {
  stackIx: number
  stack: ElementStackFormValues
  acceptedTypes: ElementType[]
  replace: (stackIx: number, value: ElementStackFormValues) => void
  selection?: Record<number, Element>
  resetSelection?: () => void
  outdatedInstances: ElementInstanceVersionInfo[]
  refetchOutdatedInstances: OutdatedInstancesRefetchFunction
  singleStackMode?: boolean
  className?: string
  isEscapeRoom?: boolean
}

interface StackBlockCreationMultipleProps extends StackBlockCreationProps {
  numOfStacks: number
  remove: (stackIx: number) => void
  move: (from: number, to: number) => void
  highlightFTNoSL?: boolean
  error?: ElementStackErrorValues[]
}

interface StackBlockCreationSingleProps extends StackBlockCreationProps {
  numOfStacks?: never
  remove?: never
  move?: never
  highlightFTNoSL?: never
  error?: ElementStackErrorValues
}

function StackBlockCreation({
  stackIx,
  stack,
  numOfStacks = 1,
  acceptedTypes,
  remove,
  move,
  replace,
  selection,
  resetSelection,
  error,
  highlightFTNoSL = false,
  singleStackMode = false,
  outdatedInstances,
  refetchOutdatedInstances,
  className,
  isEscapeRoom,
}:
  | StackBlockCreationMultipleProps
  | StackBlockCreationSingleProps): React.ReactElement {
  const t = useTranslations()
  const [stackDescriptionModal, setStackDescriptionModal] = useState(false)

  const [{ isOver }, drop] = useDrop(
    () => ({
      accept: acceptedTypes,
      drop: (item: ElementDragDropTypes) => {
        replace(stackIx, {
          ...stack,
          elements: [
            ...stack.elements,
            {
              id: item.id,
              title: item.title,
              type: item.questionType,
              hasSampleSolution: item.hasSampleSolution,
              existingInstanceId: null,
              duplicateInstance: false,
            },
          ],
        })
      },
      collect: (monitor) => ({
        isOver: !!monitor.isOver(),
      }),
    }),
    [stack, acceptedTypes]
  )

  const FTQuestionNoSLCount = highlightFTNoSL
    ? stack.elements.filter(
        (element) =>
          element.type === ElementType.FreeText &&
          !element.hasSampleSolution &&
          typeof element.hasSampleSolution !== 'undefined'
      ).length
    : 0

  return (
    <div
      key={stackIx}
      className={twMerge('flex w-56 flex-col', className)}
      data-cy={`stack-${stackIx}`}
    >
      <div className="flex flex-row items-center justify-between rounded bg-slate-200 px-2 py-1 text-slate-700">
        <div className="flex flex-row items-center gap-2">
          <div data-cy="stack-container-header">
            {singleStackMode
              ? t('shared.generic.questions')
              : t('shared.generic.stackN', { number: stackIx + 1 })}
          </div>
          {highlightFTNoSL && FTQuestionNoSLCount > 0 && (
            <Tooltip
              tooltip={t('manage.activityWizard.stackFTQuestionsNoSL')}
              delay={0}
              className={{ tooltip: 'max-w-120 z-20 text-sm' }}
            >
              <FontAwesomeIcon
                icon={faWarning}
                className="mr-1 text-orange-500"
              />
            </Tooltip>
          )}
          {error &&
            !singleStackMode &&
            Array.isArray(error) &&
            error.length > stackIx &&
            typeof error[stackIx] !== 'undefined' && (
              <Tooltip
                tooltip={<StackCreationErrors errors={error[stackIx]} />}
                delay={0}
                className={{ tooltip: 'max-w-120 z-20 text-sm' }}
              >
                <FontAwesomeIcon
                  icon={faCircleExclamation}
                  className="mr-1 text-red-600"
                />
              </Tooltip>
            )}
          {error && !Array.isArray(error) && singleStackMode && (
            <Tooltip
              tooltip={<StackCreationErrors errors={error} />}
              delay={0}
              className={{ tooltip: 'max-w-120 z-20 text-sm' }}
            >
              <FontAwesomeIcon
                icon={faCircleExclamation}
                className="mr-1 text-red-600"
              />
            </Tooltip>
          )}
        </div>
        <div className="flex flex-row text-xs">
          {!singleStackMode && typeof move !== 'undefined' && (
            <Button
              basic
              className={{
                root: 'hover:text-primary-100 px-1 hover:bg-transparent',
              }}
              disabled={numOfStacks === 1 || stackIx === 0}
              onClick={() =>
                move(stackIx, stackIx !== 0 ? stackIx - 1 : stackIx)
              }
              data={{ cy: `move-stack-${stackIx}-left` }}
            >
              <Button.Icon
                withoutLabel
                icon={faArrowLeft}
                className={{ root: 'h-3.5 w-3.5' }}
              />
            </Button>
          )}
          {!singleStackMode && typeof move !== 'undefined' && (
            <Button
              basic
              className={{
                root: 'hover:text-primary-100 px-1 hover:bg-transparent',
              }}
              disabled={numOfStacks === 1 || stackIx === numOfStacks - 1}
              onClick={() =>
                move(stackIx, stackIx !== numOfStacks ? stackIx + 1 : stackIx)
              }
              data={{ cy: `move-stack-${stackIx}-right` }}
            >
              <Button.Icon
                withoutLabel
                icon={faArrowRight}
                className={{ root: 'h-3.5 w-3.5' }}
              />
            </Button>
          )}
          {!singleStackMode && (
            <Button
              basic
              onClick={() => setStackDescriptionModal(true)}
              className={{
                root: 'hover:text-primary-100 px-1 hover:bg-transparent',
              }}
              data={{ cy: `open-stack-${stackIx}-description` }}
            >
              <Button.Icon
                withoutLabel
                icon={faCommentDots}
                className={{ root: 'h-3.5 w-3.5' }}
              />
            </Button>
          )}
          {!singleStackMode && typeof remove !== 'undefined' && (
            <Button
              basic
              onClick={() => remove(stackIx)}
              className={{
                root: 'px-1 hover:bg-transparent hover:text-red-600',
              }}
              data={{ cy: 'delete-stack' }}
            >
              <Button.Icon
                withoutLabel
                icon={faTrash}
                className={{ root: 'h-3.5 w-3.5' }}
              />
            </Button>
          )}
        </div>
      </div>

      <WizardElementList
        type="stack"
        stack={stack}
        stackIx={stackIx}
        replace={replace}
        error={error}
        highlightFTNoSL={highlightFTNoSL}
        selectionActive={
          (selection && Object.keys(selection).length > 0) ?? false
        }
        outdatedInstances={outdatedInstances}
        refetchOutdatedInstances={refetchOutdatedInstances}
        isEscapeRoom={isEscapeRoom}
        singleStackMode={singleStackMode}
      />

      {selection && !isEmpty(selection) && (
        <PasteSelectionButton
          index={stackIx}
          selection={selection}
          resetSelection={resetSelection}
          stack={stack}
          replace={replace}
        />
      )}

      <DropElementsStack
        type="stack"
        drop={drop}
        isOver={isOver}
        index={stackIx}
      />
      {stackDescriptionModal && (
        <StackDescriptionModal
          stackIx={stackIx}
          setModalOpen={setStackDescriptionModal}
        />
      )}
    </div>
  )
}

export default StackBlockCreation
