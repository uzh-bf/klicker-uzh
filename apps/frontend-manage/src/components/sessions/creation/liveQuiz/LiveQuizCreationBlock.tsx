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
import { Button, Modal, NumberField, Tooltip } from '@uzh-bf/design-system'
import { useTranslations } from 'next-intl'
import * as R from 'ramda'
import { useState } from 'react'
import { useDrop } from 'react-dnd'
import { twMerge } from 'tailwind-merge'
import { QuestionDragDropTypes } from '../../../questions/Question'
import {
  LiveQuizBlockErrorValues,
  LiveQuizBlockFormValues,
} from '../WizardLayout'
import LiveQuizBlocksError from './LiveQuizBlocksError'

interface LiveQuizCreationBlockProps {
  index: number
  block: LiveQuizBlockFormValues
  numOfBlocks: number
  remove: (index: number) => void
  move: (from: number, to: number) => void
  replace: (index: number, value: LiveQuizBlockFormValues) => void
  selection?: Record<number, Element>
  resetSelection?: () => void
  error?: LiveQuizBlockErrorValues[]
}

function LiveQuizCreationBlock({
  index,
  block,
  numOfBlocks,
  remove,
  move,
  replace,
  selection,
  resetSelection,
  error,
}: LiveQuizCreationBlockProps): React.ReactElement {
  const t = useTranslations()
  const [openSettings, setOpenSettings] = useState(false)

  const [{ isOver }, drop] = useDrop(
    () => ({
      accept: [
        ElementType.Sc,
        ElementType.Mc,
        ElementType.Kprim,
        ElementType.FreeText,
        ElementType.Numerical,
      ],
      drop: (item: QuestionDragDropTypes) => {
        replace(index, {
          ...block,
          questionIds: [...block.questionIds, item.id],
          titles: [...block.titles, item.title],
          types: [...block.types, item.questionType],
        })
      },
      collect: (monitor) => ({
        isOver: !!monitor.isOver(),
      }),
    }),
    []
  )

  return (
    <div key={index} className="flex w-56 flex-col" data-cy={`block-${index}`}>
      <div className="flex flex-row items-center justify-between rounded bg-slate-200 px-2 py-1 text-slate-700">
        <div className="flex flex-row items-center gap-2">
          <div data-cy="block-container-header">
            {t('shared.generic.blockN', { number: index + 1 })}
          </div>
          {error &&
            error.length > index &&
            typeof error[index] !== 'undefined' && (
              <Tooltip
                tooltip={<LiveQuizBlocksError errors={error[index]} />}
                delay={0}
                className={{ tooltip: 'z-20 text-sm' }}
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
              root: 'hover:bg-primary-20 px-1 disabled:hidden',
            }}
            disabled={numOfBlocks === 1}
            onClick={() => move(index, index !== 0 ? index - 1 : index)}
            data={{ cy: `move-block-${index}-left` }}
          >
            <Button.Icon>
              <FontAwesomeIcon icon={faArrowLeft} />
            </Button.Icon>
          </Button>
          <Button
            basic
            className={{
              root: 'hover:bg-primary-20 px-1 disabled:hidden',
            }}
            disabled={numOfBlocks === 1}
            onClick={() =>
              move(index, index !== numOfBlocks ? index + 1 : index)
            }
            data={{ cy: `move-block-${index}-right` }}
          >
            <Button.Icon>
              <FontAwesomeIcon icon={faArrowRight} />
            </Button.Icon>
          </Button>

          <Button
            basic
            onClick={() => setOpenSettings(true)}
            className={{
              root: 'hover:text-primary-100 px-1',
            }}
            data={{ cy: `open-block-${index}-settings` }}
          >
            <Button.Icon>
              <FontAwesomeIcon icon={faGears} />
            </Button.Icon>
          </Button>
          <Button
            basic
            onClick={() => remove(index)}
            className={{
              root: 'px-1 hover:text-red-600',
            }}
            data={{ cy: 'delete-block' }}
          >
            <Button.Icon>
              <FontAwesomeIcon icon={faTrash} />
            </Button.Icon>
          </Button>
        </div>
      </div>
      <div className="my-2 flex max-h-[7.5rem] flex-1 flex-col overflow-y-auto">
        {block.titles.map((title, questionIdx) => {
          const errors =
            error && Array.isArray(error)
              ? error.length > index && error[index]
              : error

          const isInvalid =
            errors &&
            (
              ['questionIds', 'titles', 'types'] as (
                | 'questionIds'
                | 'titles'
                | 'types'
              )[]
            ).some((key) => errors[key] && errors[key][questionIdx])

          return (
            <div
              key={`${questionIdx}-${title}`}
              className="flex flex-row items-center border-b border-solid border-slate-200 py-0.5 text-xs last:border-b-0"
              data-cy={`question-${questionIdx}-block-${index}`}
            >
              <div className="flex-1">
                <Ellipsis
                  // maxLines={2}
                  maxLength={40}
                  className={{ content: 'text-xs' }}
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
                    root: 'hover:bg-primary-20 flex flex-col justify-center px-1 disabled:hidden',
                  }}
                  disabled={block.questionIds.length === 1}
                  onClick={() => {
                    if (
                      !(questionIdx === 0 || block.questionIds.length === 1)
                    ) {
                      replace(index, {
                        ...block,
                        questionIds: R.move(
                          questionIdx,
                          questionIdx - 1,
                          block.questionIds
                        ),
                        titles: R.move(
                          questionIdx,
                          questionIdx - 1,
                          block.titles
                        ),
                        types: R.move(
                          questionIdx,
                          questionIdx - 1,
                          block.types
                        ),
                      })
                    }
                  }}
                  data={{
                    cy: `move-question-${questionIdx}-block-${index}-up`,
                  }}
                >
                  <FontAwesomeIcon icon={faArrowUp} />
                </Button>
                <Button
                  basic
                  className={{
                    root: 'hover:bg-primary-20 flex flex-col justify-center px-1 disabled:hidden',
                  }}
                  disabled={block.questionIds.length === 1}
                  onClick={() => {
                    if (
                      !(
                        block.questionIds.length === questionIdx - 1 ||
                        block.questionIds.length === 1
                      )
                    ) {
                      replace(index, {
                        ...block,
                        questionIds: R.move(
                          questionIdx,
                          questionIdx + 1,
                          block.questionIds
                        ),
                        titles: R.move(
                          questionIdx,
                          questionIdx + 1,
                          block.titles
                        ),
                        types: R.move(
                          questionIdx,
                          questionIdx + 1,
                          block.types
                        ),
                      })
                    }
                  }}
                  data={{
                    cy: `move-question-${questionIdx}-block-${index}-down`,
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
                    ...block,
                    questionIds: block.questionIds
                      .slice(0, questionIdx)
                      .concat(block.questionIds.slice(questionIdx + 1)),
                    titles: block.titles
                      .slice(0, questionIdx)
                      .concat(block.titles.slice(questionIdx + 1)),
                    types: block.types
                      .slice(0, questionIdx)
                      .concat(block.types.slice(questionIdx + 1)),
                  })
                }}
                data={{ cy: `delete-question-${questionIdx}-block-${index}` }}
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
            const { questionIds, titles, types } = Object.values(
              selection
            ).reduce<{
              questionIds: number[]
              titles: string[]
              types: ElementType[]
            }>(
              (acc, question) => {
                acc.questionIds.push(question.id)
                acc.titles.push(question.name)
                acc.types.push(question.type)
                return acc
              },
              { questionIds: [], titles: [], types: [] }
            )

            replace(index, {
              ...block,
              questionIds: [...block.questionIds, ...questionIds],
              titles: [...block.titles, ...titles],
              types: [...block.types, ...types],
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
          'w-full rounded border border-solid p-0.5 text-center',
          isOver && 'bg-primary-20'
        )}
        data-cy="drop-questions-here"
      >
        <FontAwesomeIcon icon={faPlus} size="lg" />
      </div>
      <Modal
        open={openSettings}
        onClose={() => setOpenSettings(false)}
        title={t('manage.sessionForms.blockSettingsTitle', {
          blockIx: index + 1,
        })}
        className={{
          content: '!h-max !min-h-max w-full !pb-0 sm:w-3/4 md:w-1/2',
        }}
      >
        <NumberField
          label={t('manage.sessionForms.timeLimit')}
          tooltip={t('manage.sessionForms.timeLimitTooltip', {
            blockIx: index + 1,
          })}
          id={`timeLimits.${index}`}
          value={block.timeLimit || ''}
          onChange={(newValue: string) => {
            replace(index, {
              ...block,
              timeLimit: newValue === '' ? undefined : parseInt(newValue),
            })
          }}
          placeholder={t('manage.sessionForms.optionalTimeLimit')}
          data={{ cy: 'block-time-limit' }}
        />
        <Button
          className={{ root: 'bg-uzh-blue-100 float-right mt-3 text-white' }}
          onClick={() => setOpenSettings(false)}
          data={{ cy: 'close-block-settings' }}
        >
          {t('shared.generic.ok')}
        </Button>
      </Modal>
    </div>
  )
}

export default LiveQuizCreationBlock
