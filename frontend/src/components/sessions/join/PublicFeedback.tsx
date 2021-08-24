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
  resolved: boolean
  pinned: boolean
  responses: IFeedbackResponse[]
}

function PublicFeedback({ content, createdAt, votes, pinned, resolved, responses }: Props) {
  return (
    <div className="border border-solid  border-primary bg-primary-10%">
      <div className="flex items-center ">
        <div className="flex-1 p-2">
          <p className="mb-0 prose">{content}</p>
          <div className="flex flex-row items-center mt-2 text-gray-500">
            <div className="text-sm text-gray-500">{dayjs(createdAt).format('DD.MM.YYYY HH:mm')}</div>
            <div className="ml-4">{pinned && <Icon name="pin" size="small" />}</div>
          </div>
        </div>
        <div className="flex flex-col items-end justify-between flex-initial p-2">
          <Button basic className="text-xl text-gray-500 !p-4 !mr-0" disabled={true || resolved}>
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
              <div className="prose">{response.content}</div>
              <div className="mt-2 text-sm text-gray-500">{dayjs(response.createdAt).format('DD.MM.YYYY HH:mm')}</div>
            </div>
          ))}
        </div>
      )}
    </div>
  )
}

export default PublicFeedback
