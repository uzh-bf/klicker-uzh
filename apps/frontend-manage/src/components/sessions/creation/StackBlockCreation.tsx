import { faCommentDots } from '@fortawesome/free-regular-svg-icons'
import {
  faArrowDown,
  faArrowLeft,
  faArrowRight,
  faArrowUp,
  faBars,
  faCircleExclamation,
  faPlus,
  faTrash,
  faWarning,
} from '@fortawesome/free-solid-svg-icons'
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome'
import { Element, ElementType } from '@klicker-uzh/graphql/dist/ops'
import { Ellipsis } from '@klicker-uzh/markdown'
import { Button, Tooltip } from '@uzh-bf/design-system'
import { useTranslations } from 'next-intl'
import * as R from 'ramda'
import { useState } from 'react'
import { useDrop } from 'react-dnd'
import { twMerge } from 'tailwind-merge'
import { QuestionDragDropTypes } from '../../questions/Question'
import StackCreationErrors from './StackCreationErrors'
import StackDescriptionModal from './StackDescriptionModal'
import { ElementStackErrorValues, ElementStackFormValues } from './WizardLayout'

interface StackBlockCreationProps {
  index: number
  stack: ElementStackFormValues
  acceptedTypes: ElementType[]
  replace: (index: number, value: ElementStackFormValues) => void
  selection?: Record<number, Element>
  resetSelection?: () => void
  singleStackMode?: boolean
  className?: string
}

interface StackBlockCreationMultipleProps extends StackBlockCreationProps {
  numOfStacks: number
  remove: (index: number) => void
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
  index,
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
  className,
}:
  | StackBlockCreationMultipleProps
  | StackBlockCreationSingleProps): React.ReactElement {
  const t = useTranslations()
  const [stackDescriptionModal, setStackDescriptionModal] = useState(false)

  const [{ isOver }, drop] = useDrop(
    () => ({
      accept: acceptedTypes,
      drop: (item: QuestionDragDropTypes) => {
        replace(index, {
          ...stack,
          elements: [
            ...stack.elements,
            {
              id: item.id,
              title: item.title,
              type: item.questionType,
              hasSampleSolution: item.hasSampleSolution,
            },
          ],
        })
      },
      collect: (monitor) => ({
        isOver: !!monitor.isOver(),
      }),
    }),
    []
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
      key={index}
      className={twMerge('flex w-56 flex-col', className)}
      data-cy={`stack-${index}`}
    >
      <div className="flex flex-row items-center justify-between rounded bg-slate-200 px-2 py-1 text-slate-700">
        <div className="flex flex-row items-center gap-2">
          <div data-cy="stack-container-header">
            {singleStackMode
              ? t('shared.generic.questions')
              : t('shared.generic.stackN', { number: index + 1 })}
          </div>
          {highlightFTNoSL && FTQuestionNoSLCount > 0 && (
            <Tooltip
              tooltip={t('manage.sessionForms.stackFTQuestionsNoSL')}
              delay={0}
              className={{ tooltip: 'z-20 max-w-[30rem] text-sm' }}
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
            error.length > index &&
            typeof error[index] !== 'undefined' && (
              <Tooltip
                tooltip={<StackCreationErrors errors={error[index]} />}
                delay={0}
                className={{ tooltip: 'z-20 max-w-[30rem] text-sm' }}
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
              className={{ tooltip: 'z-20 max-w-[30rem] text-sm' }}
            >
              <FontAwesomeIcon
                icon={faCircleExclamation}
                className="mr-1 text-red-600"
              />
            </Tooltip>
          )}
        </div>
        <div className="flex flex-row gap-1 text-xs">
          {!singleStackMode && typeof move !== 'undefined' && (
            <Button
              basic
              className={{
                root: 'hover:bg-primary-20 px-1 disabled:hidden',
              }}
              disabled={numOfStacks === 1}
              onClick={() => move(index, index !== 0 ? index - 1 : index)}
              data={{ cy: `move-stack-${index}-left` }}
            >
              <Button.Icon>
                <FontAwesomeIcon icon={faArrowLeft} />
              </Button.Icon>
            </Button>
          )}
          {!singleStackMode && typeof move !== 'undefined' && (
            <Button
              basic
              className={{
                root: 'hover:bg-primary-20 px-1 disabled:hidden',
              }}
              disabled={numOfStacks === 1}
              onClick={() =>
                move(index, index !== numOfStacks ? index + 1 : index)
              }
              data={{ cy: `move-stack-${index}-right` }}
            >
              <Button.Icon>
                <FontAwesomeIcon icon={faArrowRight} />
              </Button.Icon>
            </Button>
          )}
          {!singleStackMode && (
            <Button
              basic
              onClick={() => setStackDescriptionModal(true)}
              className={{
                root: 'hover:text-primary-100 px-1',
              }}
              data={{ cy: `open-stack-${index}-description` }}
            >
              <Button.Icon>
                <FontAwesomeIcon icon={faCommentDots} size="lg" />
              </Button.Icon>
            </Button>
          )}
          {!singleStackMode && typeof remove !== 'undefined' && (
            <Button
              basic
              onClick={() => remove(index)}
              className={{
                root: 'px-1 hover:text-red-600',
              }}
              data={{ cy: 'delete-stack' }}
            >
              <Button.Icon>
                <FontAwesomeIcon icon={faTrash} />
              </Button.Icon>
            </Button>
          )}
        </div>
      </div>
      <div className="my-2 flex max-h-[7.5rem] flex-1 flex-col overflow-y-auto">
        {stack.elements.map((element, questionIdx) => {
          const errors =
            error && Array.isArray(error)
              ? error.length > index
                ? error[index]?.elements
                : undefined
              : error?.elements

          return (
            <div
              key={`${questionIdx}-${element.title}`}
              className="flex flex-row items-center border-b border-solid border-slate-200 py-0.5 text-xs last:border-b-0"
              data-cy={`question-${questionIdx}-stack-${index}`}
            >
              <div className="flex-1">
                <Ellipsis
                  // maxLines={2}
                  maxLength={40}
                  className={{ content: 'text-xs' }}
                >
                  {element.title}
                </Ellipsis>
              </div>
              <div className="flex flex-row">
                {errors?.[questionIdx] && (
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
                    if (!(questionIdx === 0 || stack.elements.length === 1)) {
                      replace(index, {
                        ...stack,
                        elements: R.move(
                          questionIdx,
                          questionIdx - 1,
                          stack.elements
                        ),
                      })
                    }
                  }}
                  data={{
                    cy: `move-question-${questionIdx}-stack-${index}-up`,
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
                        stack.elements.length === questionIdx - 1 ||
                        stack.elements.length === 1
                      )
                    ) {
                      replace(index, {
                        ...stack,
                        elements: R.move(
                          questionIdx,
                          questionIdx + 1,
                          stack.elements
                        ),
                      })
                    }
                  }}
                  data={{
                    cy: `move-question-${questionIdx}-stack-${index}-down`,
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
                  replace(index, {
                    ...stack,
                    elements: stack.elements
                      .slice(0, questionIdx)
                      .concat(stack.elements.slice(questionIdx + 1)),
                  })
                }}
                data={{ cy: `delete-question-${questionIdx}-stack-${index}` }}
              >
                <Button.Icon>
                  <FontAwesomeIcon icon={faTrash} />
                </Button.Icon>
              </Button>
            </div>
          )
        })}
      </div>
      {selection && !R.isEmpty(selection) && (
        <Button
          fluid
          className={{
            root: 'mb-2 justify-center gap-3 border-orange-300 bg-orange-100 text-sm hover:border-orange-400 hover:bg-orange-200 hover:text-orange-900',
          }}
          onClick={() => {
            const newElements = Object.values(selection).map((question) => ({
              id: question.id,
              title: question.name,
              type: question.type,
              hasSampleSolution: question.options.hasSampleSolution,
            }))
            const stackElements = stack.elements.concat(newElements)

            replace(index, {
              ...stack,
              elements: stackElements,
            })
            resetSelection?.()
          }}
          data={{ cy: 'paste-selected-questions' }}
        >
          <Button.Icon>
            <FontAwesomeIcon icon={faBars} />
          </Button.Icon>
          <Button.Label>
            {t('manage.sessionForms.pasteSelectionElements', {
              count: Object.keys(selection).length,
            })}
          </Button.Label>
        </Button>
      )}
      <div
        ref={drop}
        className={twMerge(
          'w-full rounded border border-solid p-0.5 text-center',
          isOver && 'bg-primary-20'
        )}
        data-cy={`drop-elements-stack-${index}`}
      >
        <FontAwesomeIcon icon={faPlus} size="lg" />
      </div>

      <StackDescriptionModal
        stackIx={index}
        modalOpen={stackDescriptionModal}
        setModalOpen={setStackDescriptionModal}
      />
    </div>
  )
}

export default StackBlockCreation
