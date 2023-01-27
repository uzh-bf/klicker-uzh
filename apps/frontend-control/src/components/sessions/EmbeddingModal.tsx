import { useQuery } from '@apollo/client'
import { faClipboard } from '@fortawesome/free-solid-svg-icons'
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome'
import { GetSingleLiveSessionDocument } from '@klicker-uzh/graphql/dist/ops'
import { Button, H2, Modal, ThemeContext } from '@uzh-bf/design-system'
import { useContext, useMemo } from 'react'

interface EmbeddingModalProps {
  open: boolean
  setOpen: (newValue: boolean) => void
  sessionId: string
}

function EmbeddingModal({ open, setOpen, sessionId }: EmbeddingModalProps) {
  const theme = useContext(ThemeContext)
  const { data: dataLiveSession } = useQuery(GetSingleLiveSessionDocument, {
    variables: { sessionId: sessionId || '' },
    skip: !sessionId,
  })

  const questions = useMemo(
    () =>
      dataLiveSession?.liveSession?.blocks?.flatMap(
        (block) => block.instances
      ) || [],
    [dataLiveSession?.liveSession?.blocks]
  )

  return (
    <Modal
      open={open}
      onOpenChange={() => setOpen(!open)}
      onClose={() => setOpen(false)}
      onPrimaryAction={
        <Button onClick={() => setOpen(false)}>Schliessen</Button>
      }
      className={{
        content:
          'h-max max-h-[calc(100%-5rem)] overflow-y-scroll w-full md:w-max md:min-w-[30rem] my-auto mx-auto',
      }}
      hideCloseButton
    >
      <H2>PPT-Einbettung Evaluation</H2>
      <div className="flex flex-col gap-3">
        {questions?.map((question: any, ix: number) => {
          return (
            <div key={question.id}>
              <div className="w-full font-bold line-clamp-1">{`${ix + 1}. ${
                question.questionData.name
              }`}</div>
              <div className="flex flex-row items-center gap-3 px-1.5 py-0.5 mr-2 border border-solid rounded bg-uzh-grey-40">
                <FontAwesomeIcon
                  icon={faClipboard}
                  className="hover:cursor-pointer"
                  onClick={() =>
                    navigator.clipboard.writeText(
                      `${process.env.NEXT_PUBLIC_MANAGE_URL}/sessions/${sessionId}/evaluation?questionIx=${ix}`
                    )
                  }
                />
                <div className="text-sm">{`${process.env.NEXT_PUBLIC_MANAGE_URL}/sessions/${sessionId}/evaluation?questionIx=${ix}`}</div>
              </div>
            </div>
          )
        })}
      </div>
    </Modal>
  )
}

export default EmbeddingModal
