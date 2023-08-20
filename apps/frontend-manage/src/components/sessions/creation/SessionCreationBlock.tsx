import { faPaste } from '@fortawesome/free-regular-svg-icons'
import {
  faArrowDown,
  faArrowLeft,
  faArrowRight,
  faArrowUp,
  faGears,
  faPlus,
  faTrash,
} from '@fortawesome/free-solid-svg-icons'
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome'
import { Ellipsis } from '@klicker-uzh/markdown'
import { Button, Modal, NumberField } from '@uzh-bf/design-system'
import { useTranslations } from 'next-intl'
import { move as RamdaMove } from 'ramda'
import { useState } from 'react'
import { useDrop } from 'react-dnd'
import { twMerge } from 'tailwind-merge'

interface SessionCreationBlockProps {
  index: number
  block: { questionIds: number[]; titles: string[]; timeLimit: string }
  numOfBlocks: number
  remove: (index: number) => void
  move: (from: number, to: number) => void
  replace: (index: number, value: any) => void
  selectionAvailable: boolean
  addSelected: () => void
}

function SessionCreationBlock({
  index,
  block,
  numOfBlocks,
  remove,
  move,
  replace,
  selectionAvailable,
  addSelected,
}: SessionCreationBlockProps): React.ReactElement {
  const t = useTranslations()
  const [openSettings, setOpenSettings] = useState(false)

  const [{ isOver }, drop] = useDrop(
    () => ({
      accept: 'question',
      drop: (item: {
        id: number
        type: string
        questionType: string
        title: string
        content: string
      }) => {
        replace(index, {
          ...block,
          questionIds: [...block.questionIds, item.id],
          titles: [...block.titles, item.title],
        })
      },
      collect: (monitor) => ({
        isOver: !!monitor.isOver(),
      }),
    }),
    []
  )

  return (
    <div key={index} className="flex flex-col md:w-56">
      <div className="flex flex-row items-center justify-between bg-slate-200 rounded py-1 px-2 text-slate-700">
        <div data-cy="block-container-header">
          {t('control.session.blockN', { number: index + 1 })}
        </div>
        <div className="flex flex-row gap-1 text-xs">
          <Button
            basic
            className={{
              root: 'disabled:hidden hover:bg-primary-20 px-1',
            }}
            disabled={numOfBlocks === 1}
            onClick={() => move(index, index !== 0 ? index - 1 : index)}
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
            disabled={numOfBlocks === 1}
            onClick={() =>
              move(index, index !== numOfBlocks ? index + 1 : index)
            }
          >
            <Button.Icon>
              <FontAwesomeIcon icon={faArrowRight} />
            </Button.Icon>
          </Button>

          <Button
            basic
            onClick={() => setOpenSettings(true)}
            className={{
              root: 'px-1 sm:hover:text-primary hover:bg-primary-20',
            }}
          >
            <Button.Icon>
              <FontAwesomeIcon icon={faGears} />
            </Button.Icon>
          </Button>
          <Button
            basic
            onClick={() => remove(index)}
            className={{
              root: 'px-1  sm:hover:text-red-600',
            }}
            data={{ cy: 'delete-block' }}
          >
            <Button.Icon>
              <FontAwesomeIcon icon={faTrash} />
            </Button.Icon>
          </Button>
        </div>
      </div>
      <div className="flex flex-col flex-1 my-2 md:overflow-y-auto">
        {block.titles.map((title, questionIdx) => (
          <div
            key={title}
            className="flex flex-row items-center text-xs border-b border-solid border-slate-200 last:border-b-0 py-0.5"
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
                disabled={block.questionIds.length === 1}
                onClick={() => {
                  if (!(questionIdx === 0 || block.questionIds.length === 1)) {
                    replace(index, {
                      ...block,
                      questionIds: RamdaMove(
                        questionIdx,
                        questionIdx - 1,
                        block.questionIds
                      ),
                      titles: RamdaMove(
                        questionIdx,
                        questionIdx - 1,
                        block.titles
                      ),
                    })
                  }
                }}
              >
                <FontAwesomeIcon icon={faArrowUp} />
              </Button>
              <Button
                basic
                className={{
                  root: 'flex flex-col justify-center disabled:hidden hover:bg-primary-20 px-1',
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
                      questionIds: RamdaMove(
                        questionIdx,
                        questionIdx + 1,
                        block.questionIds
                      ),
                      titles: RamdaMove(
                        questionIdx,
                        questionIdx + 1,
                        block.titles
                      ),
                    })
                  }
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
                })
              }}
            >
              <Button.Icon>
                <FontAwesomeIcon icon={faTrash} />
              </Button.Icon>
            </Button>
          </div>
        ))}
      </div>
      {selectionAvailable && (
        <Button
          className={{
            root: 'w-full flex flex-row justify-center gap-2 mb-1 p-0.5 border border-solid rounded bg-uzh-red-20 hover:bg-uzh-red-40',
          }}
          onClick={addSelected}
          data={{ cy: 'paste-selected-questions' }}
        >
          <FontAwesomeIcon icon={faPaste} />
          <div>{t('manage.sessionForms.pasteSelection')}</div>
        </Button>
      )}
      <div
        ref={drop}
        className={twMerge(
          'w-full text-center p-0.5 border border-solid rounded',
          isOver && 'bg-primary-20'
        )}
        data-cy="drop-questions-here"
      >
        <FontAwesomeIcon icon={faPlus} size="lg" />
      </div>
      <Modal open={openSettings} onClose={() => setOpenSettings(false)}>
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
        />
      </Modal>
    </div>
  )
}

export default SessionCreationBlock
