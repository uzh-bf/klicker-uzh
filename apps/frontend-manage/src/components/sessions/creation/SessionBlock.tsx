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
  blockQuestions: number[]
  timeLimit: string
  setFieldValue: (field: string, value: any, shouldValidate?: boolean) => void
  remove: (index: number) => void
}

function SessionBlock({
  index,
  blockQuestions,
  timeLimit,
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
        console.log('block questions before update', blockQuestions)
        console.log('drop on test field registered', item)
        setFieldValue(`blocks[${index}]`, [...blockQuestions, item.id])
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
        <div className="font-bold">Block {index + 1}</div>
        <div>
          <Button
            onClick={() => remove(index)}
            className={{
              root: 'ml-2 text-white bg-red-500 rounded hover:bg-red-600',
            }}
          >
            <FontAwesomeIcon icon={faTrash} />
          </Button>
          <Button
            onClick={() => setOpenSettings(true)}
            className={{
              root: 'ml-2 rounded',
            }}
          >
            <FontAwesomeIcon icon={faGears} />
          </Button>
        </div>
      </div>
      {blockQuestions.map((questionId) => (
        <div key={questionId}>{questionId}</div>
      ))}
      <div
        ref={drop}
        className={twMerge(
          'w-full text-center p-0.5 border border-solid rounded',
          isOver && theme.primaryBg
        )}
      >
        <FontAwesomeIcon icon={faPlus} size="lg" />
      </div>
      <Modal open={openSettings} onClose={() => setOpenSettings(false)}>
        <FormikTextField
          label="Zeit-Limit"
          tooltip={`Zeit-Limit für Block ${index + 1} in Sekunden`}
          id={`timeLimits.${index}`}
          value={timeLimit || ''}
          onChange={(newValue: string) => {
            setFieldValue(
              `timeLimits[${index}]`,
              newValue.replace(/[^0-9]/g, '')
            )
          }}
          placeholder={`optionales Zeit-Limit`}
        />
      </Modal>
    </div>
  )
}

export default SessionBlock
