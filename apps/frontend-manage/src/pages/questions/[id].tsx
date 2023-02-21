import { useQuery } from '@apollo/client'
import { GetSingleQuestionDocument } from '@klicker-uzh/graphql/dist/ops'
import { useRouter } from 'next/router'
import StudentQuestion from 'shared-components/src/StudentQuestion'

function QuestionDetails() {
  const router = useRouter()

  const { data } = useQuery(GetSingleQuestionDocument, {
    variables: {
      id: Number(router.query.id),
    },
    skip: !router.query.id,
  })

  return (
    <div className="max-w-5xl p-8 m-auto">
      <StudentQuestion
        activeIndex={0}
        numItems={1}
        isSubmitDisabled
        onSubmit={() => null}
        onExpire={() => null}
        currentQuestion={{
          instanceId: 0,
          ...data?.question,
          options: data?.question?.questionData.options,
        }}
        // inputValue={inputValue}
        // inputValid={inputValid}
        // inputEmpty={inputEmpty}
        setInputState={() => null}
      />
    </div>
  )
}

export function getServerSideProps({ locale }: any) {
  return {
    props: {
      messages: {
        ...require(`shared-components/src/intl-messages/${locale}.json`),
      },
    },
  }
}

export default QuestionDetails
