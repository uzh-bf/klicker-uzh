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
    <div>
      <div className="border border-solid bg-primary-10% border-primary rounded shadow">
        <div className="flex items-start">
          <div className="flex-1 p-2 pl-4">
            <p className="mb-0 prose-sm prose">{content}</p>
            <div className="flex flex-row items-end mt-1 text-gray-500">
              <div className="text-sm text-gray-500">{dayjs(createdAt).format('DD.MM.YYYY HH:mm')}</div>
              <div className="ml-4">
                {resolved ? <Icon name="check" size="small" /> : <Icon name="discussions" size="small" />}
              </div>
              <div className="ml-4">{pinned && <Icon name="pin" size="small" />}</div>
            </div>
          </div>
          <div className="flex-initial mt-1 mr-1">
            <Button
              basic
              compact
              className="text-xl text-gray-500 !mr-0"
              content={votes}
              disabled={true || resolved}
              icon="thumbs up outline"
            />
          </div>
        </div>
      </div>
      {responses?.length > 0 && (
        <div>
          {responses.map((response) => (
            <div
              className="ml-4 flex flex-row pl-4 mt-2 border border-solid border-l-[5px] items-start bg-gray-50 py-1 rounded shadow-sm"
              key={response.id}
            >
              <div className="flex-1">
                <p className="mb-0 prose-sm prose">{response.content}</p>
                <div className="mt-1 text-sm text-gray-500">{dayjs(response.createdAt).format('DD.MM.YYYY HH:mm')}</div>
              </div>
              <div className="flex-initial">
                <Button basic compact icon="smile outline" size="small" />
                <Button basic compact icon="frown outline" size="small" />
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  )
}

export default PublicFeedback
