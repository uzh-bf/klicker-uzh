import { useQuery } from '@apollo/client'
import { GetSingleQuestionDocument } from '@klicker-uzh/graphql/dist/ops'
import StudentQuestion from '@klicker-uzh/shared-components/src/StudentQuestion'
import { UserNotification } from '@uzh-bf/design-system'
import { GetStaticPropsContext } from 'next'
import { useTranslations } from 'next-intl'
import { useRouter } from 'next/router'
import useFakedInstance from '../../lib/hooks/useFakedInstance'

function QuestionDetails() {
  const t = useTranslations()
  const router = useRouter()

  const { data } = useQuery(GetSingleQuestionDocument, {
    variables: {
      id: Number(router.query.id),
    },
    skip: !router.query.id,
  })

  const fakedInstance = useFakedInstance({
    element: data?.question,
    questionData: data?.question?.questionData,
  })

  if (!fakedInstance) {
    return (
      <UserNotification className={{ root: 'm-auto w-max' }} type="error">
        {t('shared.generic.systemError')}
      </UserNotification>
    )
  }

  return (
    <div className="flex h-full w-full items-center justify-center p-8">
      <div className="w-[64rem] max-w-full">
        <StudentQuestion
          isSubmitHidden
          activeIndex={0}
          numItems={1}
          isSubmitDisabled
          onSubmit={() => null}
          onExpire={() => null}
          currentQuestion={fakedInstance}
          setInputState={() => null}
          inputValue={''}
          inputValid={false}
          inputEmpty={false}
        />
      </div>
    </div>
  )
}

export async function getStaticProps({ locale }: GetStaticPropsContext) {
  return {
    props: {
      messages: (await import(`@klicker-uzh/i18n/messages/${locale}`)).default,
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
