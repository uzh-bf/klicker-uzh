import { useQuery } from '@apollo/client'
import { GetLearningElementDocument } from '@klicker-uzh/graphql/dist/ops'
import { Button } from '@uzh-bf/design-system'
import { useRouter } from 'next/router'
import { useState } from 'react'

function LearningElement() {
  const [currentIx, setCurrentIx] = useState(0)

  const router = useRouter()

  const { loading, error, data } = useQuery(GetLearningElementDocument, {
    variables: {
      id: router.query.id as string,
    },
  })

  if (loading || !data) return <p>Loading...</p>
  if (error) return <p>Oh no... {error.message}</p>

  const questionData =
    data.learningElement?.instances?.[currentIx]?.questionData

  return (
    <div className="flex flex-row p-4">
      <div className="flex-1">
        <div>{questionData.content}</div>
        <div className="space-y-1">
          {questionData.options.choices.map((choice: any) => (
            <div key={choice.value} className="w-full">
              <Button fluid>{choice.value}</Button>
            </div>
          ))}
        </div>
      </div>
      <div className="flex-1">more</div>
    </div>
  )
}

export default LearningElement
