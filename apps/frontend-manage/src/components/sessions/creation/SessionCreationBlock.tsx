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
import {
  Button,
  FormikNumberField,
  Modal,
  ThemeContext,
} from '@uzh-bf/design-system'
import { move as RamdaMove } from 'ramda'
import { useContext, useState } from 'react'
import { useDrop } from 'react-dnd'
import { twMerge } from 'tailwind-merge'
import Ellipsis from '../../common/Ellipsis'

interface SessionCreationBlockProps {
  index: number
  block: { questionIds: number[]; titles: string[]; timeLimit: string }
  numOfBlocks: number
  remove: (index: number) => void
  move: (from: number, to: number) => void
  replace: (index: number, value: any) => void
}

function SessionCreationBlock({
  index,
  block,
  numOfBlocks,
  remove,
  move,
  replace,
}: SessionCreationBlockProps): React.ReactElement {
  const theme = useContext(ThemeContext)
  const [openSettings, setOpenSettings] = useState(false)
  console.log('SessionCreationBlock - block: ', block)

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
        console.log('useDrop item: ', item)
        console.log('block - questionIds: ', block.questionIds)
        console.log('block - titles: ', block.titles)

        replace(index, {
          ...block,
          questionIds: [...block.questionIds, item.id],
          titles: [...block.titles, item.title],
        })

        console.log('updated block - questionIds: ', block.questionIds)
        console.log('updated block - titles: ', block.titles)
      },
      collect: (monitor) => ({
        isOver: !!monitor.isOver(),
      }),
    }),
    []
  )
  console.log('block - questionIds: ', block.questionIds)

  return (
    <div
      key={index}
      className="flex flex-col p-2 border border-solid rounded w-52"
    >
      <div className="flex flex-row items-center justify-between">
        <div className="font-bold" data-cy="block-container-header">
          Block {index + 1}
        </div>
        <div className="flex flex-row gap-1 ml-2">
          <Button
            basic
            className={{ root: 'mx-1 disabled:hidden' }}
            disabled={numOfBlocks === 1}
            onClick={() => move(index, index !== 0 ? index - 1 : index)}
          >
            <Button.Icon>
              <FontAwesomeIcon icon={faArrowLeft} />
            </Button.Icon>
          </Button>
          <Button
            basic
            className={{ root: 'ml-1 mr-2 disabled:hidden' }}
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
            onClick={() => remove(index)}
            className={{
              root: 'w-6 flex justify-center text-white bg-red-500 rounded hover:bg-red-600',
            }}
            data={{ cy: 'delete-block' }}
          >
            <FontAwesomeIcon icon={faTrash} />
          </Button>
          <Button
            onClick={() => setOpenSettings(true)}
            className={{
              root: 'rounded w-6 flex justify-center',
            }}
          >
            <FontAwesomeIcon icon={faGears} />
          </Button>
        </div>
      </div>
      <div className="flex flex-col flex-1 gap-1 my-2">
        {block.titles.map((title, questionIdx) => (
          <div
            key={title}
            className="flex flex-row text-xs border border-solid rounded bg-uzh-grey-20 border-uzh-grey-100"
          >
            <div className="p-0.5 flex-1">
              <Ellipsis maxLines={2} className={{ content: 'prose-sm' }}>
                {title}
              </Ellipsis>
            </div>
            <div className="h-full">
              <Button
                basic
                className={{
                  root: twMerge(
                    'flex flex-col justify-center h-1/2 px-2 disabled:hidden',
                    theme.primaryBgHover
                  ),
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
                  root: twMerge(
                    'flex flex-col justify-center h-1/2 px-2 disabled:hidden',
                    theme.primaryBgHover
                  ),
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
            <div
              className={`flex items-center px-2 text-white ${theme.primaryTextHover} bg-red-500 hover:bg-red-600 rounded-r`}
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
              <FontAwesomeIcon icon={faTrash} />
            </div>
          </div>
        ))}
      </div>
      <div
        ref={drop}
        className={twMerge(
          'w-full text-center p-0.5 border border-solid rounded',
          isOver && theme.primaryBg
        )}
        data-cy="drop-questions-here"
      >
        <FontAwesomeIcon icon={faPlus} size="lg" />
      </div>
      <Modal open={openSettings} onClose={() => setOpenSettings(false)}>
        <FormikNumberField
          label="Zeit-Limit"
          tooltip={`Zeit-Limit für Block ${index + 1} in Sekunden`}
          id={`timeLimits.${index}`}
          value={block.timeLimit || ''}
          onChange={(newValue: string) => {
            replace(index, {
              ...block,
              timeLimit: newValue === '' ? undefined : parseInt(newValue),
            })
          }}
          placeholder={`optionales Zeit-Limit`}
        />
      </Modal>
    </div>
  )
}

export default SessionCreationBlock
