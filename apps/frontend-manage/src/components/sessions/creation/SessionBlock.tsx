import { faGears, faPlus, faTrash } from '@fortawesome/free-solid-svg-icons'
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome'
import {
  Button,
  FormikTextField,
  Modal,
  ThemeContext,
} from '@uzh-bf/design-system'
import { useContext, useState } from 'react'
import { useDrop } from 'react-dnd'
import { twMerge } from 'tailwind-merge'

interface SessionBlockProps {
  index: number
  block: { questionIds: number[]; titles: string[]; timeLimit: string }
  setFieldValue: (field: string, value: any, shouldValidate?: boolean) => void
  remove: (index: number) => void
}

function SessionBlock({
  index,
  block,
  setFieldValue,
  remove,
}: SessionBlockProps): React.ReactElement {
  const theme = useContext(ThemeContext)
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
        setFieldValue(`blocks[${index}][questionIds]`, [
          ...block.questionIds,
          item.id,
        ])
        setFieldValue(`blocks[${index}][titles]`, [...block.titles, item.title])
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
      className="flex flex-col p-2 border border-solid rounded-md w-52"
    >
      <div className="flex flex-row items-center justify-between">
        <div className="font-bold" data-cy="block-container-header">Block {index + 1}</div>
        <div className="flex flex-row gap-1 ml-2">
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
            className="flex flex-row border border-solid rounded bg-uzh-grey-20 border-uzh-grey-100"
          >
            <div className="p-0.5 flex-1">{title}</div>
            <div
              className={`flex items-center px-2 text-white ${theme.primaryTextHover} bg-red-500 hover:bg-red-600 rounded-r`}
              onClick={() => {
                setFieldValue(`blocks[${index}][questionIds]`, [
                  block.questionIds
                    .slice(0, questionIdx)
                    .concat(block.questionIds.slice(questionIdx + 1)),
                ])
                setFieldValue(
                  `blocks[${index}][titles]`,
                  block.titles
                    .slice(0, questionIdx)
                    .concat(block.titles.slice(questionIdx + 1))
                )
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
        <FormikTextField
          label="Zeit-Limit"
          tooltip={`Zeit-Limit für Block ${index + 1} in Sekunden`}
          id={`timeLimits.${index}`}
          value={block.timeLimit || ''}
          onChange={(newValue: string) => {
            setFieldValue(
              `blocks[${index}][timeLimit]`,
              parseInt(newValue.replace(/[^0-9]/g, ''))
            )
          }}
          placeholder={`optionales Zeit-Limit`}
        />
      </Modal>
    </div>
  )
}

export default SessionBlock
