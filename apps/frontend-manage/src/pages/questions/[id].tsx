import { useQuery } from '@apollo/client'
import { GetSingleQuestionDocument } from '@klicker-uzh/graphql/dist/ops'
import StudentQuestion from '@klicker-uzh/shared-components/src/StudentQuestion'
import { GetStaticPropsContext } from 'next'
import { useRouter } from 'next/router'

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

export async function getStaticProps({ locale }: GetStaticPropsContext) {
  return {
    props: {
      messages: (
        await import(
          `@klicker-uzh/shared-components/src/intl-messages/${locale}.json`
        )
      ).default,
    },
  }
}

export function getStaticPaths() {
  return {
    paths: [],
    fallback: 'blocking',
  }
}

export default QuestionDetails
