import {
  faArrowDown,
  faArrowLeft,
  faArrowRight,
  faArrowUp,
  faBars,
  faCircleExclamation,
  faGears,
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
import {
  ElementStackErrorValues,
  ElementStackFormValues,
} from './MultistepWizard'
import StackCreationErrors from './StackCreationErrors'

interface StackBlockCreationProps {
  index: number
  stack: ElementStackFormValues
  numOfStacks: number
  acceptedTypes: ElementType[]
  remove: (index: number) => void
  move: (from: number, to: number) => void
  replace: (index: number, value: ElementStackFormValues) => void
  selection?: Record<number, Element>
  resetSelection?: () => void
  error?: ElementStackErrorValues[]
}

function StackBlockCreation({
  index,
  stack,
  numOfStacks,
  acceptedTypes,
  remove,
  move,
  replace,
  selection,
  resetSelection,
  error,
}: StackBlockCreationProps): React.ReactElement {
  const t = useTranslations()
  const [openSettings, setOpenSettings] = useState(false)

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
    <div key={index} className="flex flex-col w-56" data-cy={`stack-${index}`}>
      <div className="flex flex-row items-center justify-between px-2 py-1 rounded bg-slate-200 text-slate-700">
        <div className="flex flex-row items-center gap-2">
          <div data-cy="stack-container-header">
            {t('shared.generic.stackN', { number: index + 1 })}
          </div>
          {error &&
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
        </div>
        <div className="flex flex-row gap-1 text-xs">
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

          <Button
            basic
            onClick={() => setOpenSettings(true)}
            className={{
              root: 'px-1 hover:text-primary ',
            }}
            data={{ cy: `open-stack-${index}-settings` }}
          >
            <Button.Icon>
              <FontAwesomeIcon icon={faGears} />
            </Button.Icon>
          </Button>
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
        </div>
      </div>
      <div className="flex flex-col flex-1 my-2 overflow-y-auto max-h-[7.5rem]">
        {stack.titles.map((title, questionIdx) => (
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
                      types: R.move(questionIdx, questionIdx - 1, stack.types),
                      hasSampleSolutions: R.move(
                        questionIdx,
                        questionIdx - 1,
                        stack.hasSampleSolutions
                      ),
                    })
                  }
                }}
                data={{ cy: `move-question-${questionIdx}-stack-${index}-up` }}
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
                      types: R.move(questionIdx, questionIdx + 1, stack.types),
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
        ))}
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
        data-cy={`drop-elements-block-${index}`}
      >
        <FontAwesomeIcon icon={faPlus} size="lg" />
      </div>
      {/* 
      // TODO: introduce modal to define displayname and description of stacks
      <Modal
        open={openSettings}
        onClose={() => setOpenSettings(false)}
        title={t('manage.sessionForms.blockSettingsTitle', {
          blockIx: index + 1,
        })}
        className={{
          content: 'w-full sm:w-3/4 md:w-1/2 !min-h-max !h-max !pb-0',
        }}
      >
        <NumberField
          label={t('manage.sessionForms.timeLimit')}
          tooltip={t('manage.sessionForms.timeLimitTooltip', {
            blockIx: index + 1,
          })}
          id={`timeLimits.${index}`}
          value={stack.timeLimit || ''}
          onChange={(newValue: string) => {
            replace(index, {
              ...stack,
              timeLimit: newValue === '' ? undefined : parseInt(newValue),
            })
          }}
          placeholder={t('manage.sessionForms.optionalTimeLimit')}
          data={{ cy: 'block-time-limit' }}
        />
        <Button
          className={{ root: 'float-right mt-3 bg-uzh-blue-100 text-white' }}
          onClick={() => setOpenSettings(false)}
          data={{ cy: 'close-stack-settings' }}
        >
          {t('shared.generic.ok')}
        </Button>
      </Modal> */}
    </div>
  )
}

export default StackBlockCreation
