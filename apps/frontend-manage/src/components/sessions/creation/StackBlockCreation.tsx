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
  error?: ElementStackErrorValues[]
}

interface StackBlockCreationSingleProps extends StackBlockCreationProps {
  numOfStacks?: never
  remove?: never
  move?: never
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
          elementIds: [...stack.elementIds, item.id],
          titles: [...stack.titles, item.title],
          types: [...stack.types, item.questionType],
          hasSampleSolutions: [
            ...stack.hasSampleSolutions,
            item.hasSampleSolution,
          ],
        })
      },
      collect: (monitor) => ({
        isOver: !!monitor.isOver(),
      }),
    }),
    []
  )

  return (
    <div
      key={index}
      className={twMerge('flex flex-col w-56', className)}
      data-cy={`stack-${index}`}
    >
      <div className="flex flex-row items-center justify-between px-2 py-1 rounded bg-slate-200 text-slate-700">
        <div className="flex flex-row items-center gap-2">
          <div data-cy="stack-container-header">
            {singleStackMode
              ? t('shared.generic.questions')
              : t('shared.generic.stackN', { number: index + 1 })}
          </div>
          {error &&
            !singleStackMode &&
            Array.isArray(error) &&
            error.length > index &&
            typeof error[index] !== 'undefined' && (
              <Tooltip
                tooltip={<StackCreationErrors errors={error[index]} />}
                delay={0}
                className={{ tooltip: 'text-sm z-20' }}
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
              className={{ tooltip: 'text-sm z-20' }}
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
                root: 'disabled:hidden hover:bg-primary-20 px-1',
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
                root: 'disabled:hidden hover:bg-primary-20 px-1',
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
                root: 'px-1 hover:text-primary-100',
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
                root: 'px-1  hover:text-red-600',
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
      <div className="flex flex-col flex-1 my-2 overflow-y-auto max-h-[7.5rem]">
        {stack.titles.map((title, questionIdx) => {
          const errors =
            error && Array.isArray(error)
              ? error.length > index && error[index]
              : error

          const isInvalid =
            errors &&
            (
              ['elementIds', 'titles', 'types', 'hasSampleSolutions'] as (
                | 'elementIds'
                | 'titles'
                | 'types'
                | 'hasSampleSolutions'
              )[]
            ).some((key) => errors[key] && errors[key][questionIdx])

          return (
            <div
              key={`${questionIdx}-${title}`}
              className="flex flex-row items-center text-xs border-b border-solid border-slate-200 last:border-b-0 py-0.5"
              data-cy={`question-${questionIdx}-stack-${index}`}
            >
              <div className="flex-1">
                <Ellipsis
                  // maxLines={2}
                  maxLength={40}
                  className={{ content: 'prose-sm' }}
                >
                  {title}
                </Ellipsis>
              </div>
              <div className="flex flex-row">
                {isInvalid && (
                  <FontAwesomeIcon
                    icon={faCircleExclamation}
                    className="mr-1 text-red-600"
                  />
                )}
                <Button
                  basic
                  className={{
                    root: 'flex flex-col justify-center disabled:hidden hover:bg-primary-20 px-1',
                  }}
                  disabled={stack.elementIds.length === 1}
                  onClick={() => {
                    if (!(questionIdx === 0 || stack.elementIds.length === 1)) {
                      replace(index, {
                        ...stack,
                        elementIds: R.move(
                          questionIdx,
                          questionIdx - 1,
                          stack.elementIds
                        ),
                        titles: R.move(
                          questionIdx,
                          questionIdx - 1,
                          stack.titles
                        ),
                        types: R.move(
                          questionIdx,
                          questionIdx - 1,
                          stack.types
                        ),
                        hasSampleSolutions: R.move(
                          questionIdx,
                          questionIdx - 1,
                          stack.hasSampleSolutions
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
                    root: 'flex flex-col justify-center disabled:hidden hover:bg-primary-20 px-1',
                  }}
                  disabled={stack.elementIds.length === 1}
                  onClick={() => {
                    if (
                      !(
                        stack.elementIds.length === questionIdx - 1 ||
                        stack.elementIds.length === 1
                      )
                    ) {
                      replace(index, {
                        ...stack,
                        elementIds: R.move(
                          questionIdx,
                          questionIdx + 1,
                          stack.elementIds
                        ),
                        titles: R.move(
                          questionIdx,
                          questionIdx + 1,
                          stack.titles
                        ),
                        types: R.move(
                          questionIdx,
                          questionIdx + 1,
                          stack.types
                        ),
                        hasSampleSolutions: R.move(
                          questionIdx,
                          questionIdx + 1,
                          stack.hasSampleSolutions
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
                    elementIds: stack.elementIds
                      .slice(0, questionIdx)
                      .concat(stack.elementIds.slice(questionIdx + 1)),
                    titles: stack.titles
                      .slice(0, questionIdx)
                      .concat(stack.titles.slice(questionIdx + 1)),
                    types: stack.types
                      .slice(0, questionIdx)
                      .concat(stack.types.slice(questionIdx + 1)),
                    hasSampleSolutions: stack.hasSampleSolutions
                      .slice(0, questionIdx)
                      .concat(stack.hasSampleSolutions.slice(questionIdx + 1)),
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
            root: 'mb-2 text-sm gap-3 justify-center hover:bg-orange-200 hover:border-orange-400 hover:text-orange-900 bg-orange-100 border-orange-300',
          }}
          onClick={() => {
            const { elementIds, titles, types, hasSampleSolutions } =
              Object.values(selection).reduce<ElementStackFormValues>(
                (acc, question) => {
                  acc.elementIds.push(question.id)
                  acc.titles.push(question.name)
                  acc.types.push(question.type)
                  acc.hasSampleSolutions.push(
                    question.options.hasSampleSolution
                  )
                  return acc
                },
                {
                  elementIds: [],
                  titles: [],
                  types: [],
                  hasSampleSolutions: [],
                }
              )

            replace(index, {
              ...stack,
              elementIds: [...stack.elementIds, ...elementIds],
              titles: [...stack.titles, ...titles],
              types: [...stack.types, ...types],
              hasSampleSolutions: [
                ...stack.hasSampleSolutions,
                ...hasSampleSolutions,
              ],
            })
            resetSelection?.()
          }}
          data={{ cy: 'paste-selected-questions' }}
        >
          <Button.Icon>
            <FontAwesomeIcon icon={faBars} />
          </Button.Icon>
          <Button.Label>
            {t('manage.sessionForms.pasteSelection', {
              count: Object.keys(selection).length,
            })}
          </Button.Label>
        </Button>
      )}
      <div
        ref={drop}
        className={twMerge(
          'w-full text-center p-0.5 border border-solid rounded',
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
