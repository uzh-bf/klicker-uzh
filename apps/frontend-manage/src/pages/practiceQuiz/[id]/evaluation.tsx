import { useQuery } from '@apollo/client'
import {
  GetPracticeQuizEvaluationDocument,
  GetSinglePracticeQuizDocument,
  PracticeQuizMode,
} from '@klicker-uzh/graphql/dist/ops'
import Loader from '@klicker-uzh/shared-components/src/Loader'
import { GetStaticPropsContext } from 'next'
import { useTranslations } from 'next-intl'
import { useRouter } from 'next/router'
import ActivityEvaluation from '../../../components/evaluation/ActivityEvaluation'
import AdaptivePracticeQuizEvaluation from '../../../components/evaluation/adaptive/AdaptivePracticeQuizEvaluation'
import Layout from '../../../components/Layout'

function StandardPracticeQuizEvaluation({
  practiceQuizId,
  displayName,
  courseId,
}: {
  practiceQuizId: string
  displayName: string
  courseId?: string | null
}) {
  const t = useTranslations()
  const { data, loading, error } = useQuery(GetPracticeQuizEvaluationDocument, {
    variables: { id: practiceQuizId },
  })

  if (loading) {
    return (
      <Layout displayName={t('manage.evaluation.practiceQuizEvaluation')}>
        <Loader />
      </Layout>
    )
  }

  // TODO: potentially display message here that practice quiz might not be published yet?
  if (error || !data) {
    return <Layout>{t('shared.generic.systemError')}</Layout>
  }

  const evaluation = data?.getPracticeQuizEvaluation

  return (
    <ActivityEvaluation
      courseId={courseId ?? evaluation?.courseId}
      activityId={practiceQuizId}
      activityName={displayName || evaluation?.displayName || ''}
      stacks={evaluation?.results ?? []}
    />
  )
}

function PracticeQuizEvaluation() {
  const t = useTranslations()
  const router = useRouter()
  const practiceQuizId =
    typeof router.query.id === 'string' ? router.query.id : undefined
  const { data, loading, error } = useQuery(GetSinglePracticeQuizDocument, {
    variables: { id: practiceQuizId! },
    skip: typeof practiceQuizId === 'undefined',
  })

  if (loading || typeof practiceQuizId === 'undefined') {
    return (
      <Layout displayName={t('manage.evaluation.practiceQuizEvaluation')}>
        <Loader />
      </Layout>
    )
  }

  const practiceQuiz = data?.getSinglePracticeQuiz
  if (error || !practiceQuiz) {
    return <Layout>{t('shared.generic.systemError')}</Layout>
  }

  if (practiceQuiz.mode === PracticeQuizMode.Adaptive) {
    return (
      <AdaptivePracticeQuizEvaluation
        practiceQuizId={practiceQuiz.id}
        displayName={practiceQuiz.displayName}
      />
    )
  }

  return (
    <StandardPracticeQuizEvaluation
      practiceQuizId={practiceQuiz.id}
      displayName={practiceQuiz.displayName}
      courseId={practiceQuiz.course?.id}
    />
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

export default PracticeQuizEvaluation
