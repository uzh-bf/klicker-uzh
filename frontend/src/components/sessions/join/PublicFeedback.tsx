import dayjs from 'dayjs'
import { Icon, Button } from 'semantic-ui-react'

interface IFeedbackResponse {
  id: string
  content: string
  createdAt: string
}

interface Props {
  createdAt: string
  content: string
  votes: number
  pinned: boolean
  responses: IFeedbackResponse[]
}

function PublicFeedback({ content, createdAt, votes, pinned, responses }: Props) {
  return (
    <div className="border border-solid bg-primary-10% border-primary">
      <div className="flex items-center ">
        <div className="flex-1 p-2">
          <p className="mb-0">{content}</p>
          <div className="flex flex-row items-center mt-2 text-gray-500">
            <div className="text-sm text-gray-500">{dayjs(createdAt).format('DD.MM.YYYY HH:mm')}</div>
            <div className="ml-4">{pinned && <Icon name="pin" size="small" />}</div>
          </div>
        </div>
        <div className="flex flex-col items-end justify-between flex-initial p-2">
          <Button basic className="text-xl text-gray-500 !p-4 !mr-0">
            {votes}
            <span className="ml-2">
              <Icon name="thumbs up outline" />
            </span>
          </Button>
        </div>
      </div>
      {responses?.length > 0 && (
        <div>
          {responses.map((response) => (
            <div className="p-2 bg-white" key={response.id}>
              <div>{response.content}</div>
              <div className="mt-2 text-sm text-gray-500">{dayjs(response.createdAt).format('DD.MM.YYYY HH:mm')}</div>
            </div>
          ))}
        </div>
      )}
    </div>
  )
}

export default PublicFeedback
