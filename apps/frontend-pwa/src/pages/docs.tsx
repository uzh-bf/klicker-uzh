import { useQuery } from '@apollo/client'
import {
  GetCourseChatbotsDocument,
  GetStudentDocsCourseDocument,
} from '@klicker-uzh/graphql/dist/ops'
import { initializeApollo } from '@lib/apollo'
import getParticipantToken from '@lib/getParticipantToken'
import useParticipantToken from '@lib/useParticipantToken'
import { UserNotification } from '@uzh-bf/design-system'
import type { GetServerSidePropsContext } from 'next'
import { useRouter } from 'next/router'
import { useTranslations } from 'next-intl'
import StudentDocsPrototype from '../components/docs/StudentDocsPrototype'
import Layout from '../components/Layout'

function StudentDocs({
  participantToken,
  cookiesAvailable,
}: {
  participantToken?: string
  cookiesAvailable?: boolean
}) {
  const t = useTranslations()
  const router = useRouter()
  useParticipantToken({ participantToken, cookiesAvailable })
  const courseId =
    router.isReady &&
    typeof router.query.courseId === 'string' &&
    router.query.courseId.trim() !== ''
      ? router.query.courseId
      : undefined
  const assessment = process.env.NEXT_PUBLIC_IS_ASSESSMENT === 'true'
  const courseResult = useQuery(GetStudentDocsCourseDocument, {
    variables: { courseId: courseId ?? '' },
    skip: !courseId || assessment,
    fetchPolicy: 'network-only',
  })
  const loadedCourse = courseResult.data?.getCourseOverviewData?.course
  const course =
    !courseResult.loading &&
    !courseResult.error &&
    loadedCourse?.id === courseId
      ? (loadedCourse ?? undefined)
      : undefined
  const restricted = assessment || course?.isAssessmentEnabled === true
  const chatbotResult = useQuery(GetCourseChatbotsDocument, {
    variables: { courseId: courseId ?? '' },
    skip: !course || restricted,
    fetchPolicy: 'network-only',
  })
  const chatbots =
    course &&
    !restricted &&
    !chatbotResult.loading &&
    !chatbotResult.error &&
    chatbotResult.variables?.courseId === courseId
      ? (chatbotResult.data?.courseChatbots ?? []).map((bot) => {
          const href = `/${router.locale ?? 'en'}/course/${encodeURIComponent(course.id)}/chatbot/${encodeURIComponent(bot.id)}`
          return {
            id: bot.id,
            name: bot.name,
            href,
            embeddedHref: `${href}?embed=true`,
          }
        })
      : []

  return (
    <Layout displayName={t('shared.generic.documentation')} course={course}>
      {restricted && (
        <UserNotification
          type="warning"
          data={{ cy: 'student-docs-assessment-warning' }}
          className={{ root: 'mx-auto mb-3 w-full max-w-5xl text-base' }}
        >
          {t.rich('pwa.studentDocs.assessmentInstanceWarning', {
            b: (text) => <b>{text}</b>,
          })}
        </UserNotification>
      )}
      <StudentDocsPrototype
        key={courseId ?? 'student-guide'}
        gamificationEnabled={
          !restricted && course?.isGamificationEnabled === true
        }
        learningAnalyticsEnabled={false}
        chatbots={chatbots}
      />
    </Layout>
  )
}

export async function getServerSideProps(ctx: GetServerSidePropsContext) {
  const courseId =
    typeof ctx.query.courseId === 'string' && ctx.query.courseId.trim() !== ''
      ? ctx.query.courseId
      : undefined
  const { participantToken, cookiesAvailable } = await getParticipantToken({
    apolloClient: initializeApollo(undefined, ctx),
    courseId,
    ctx,
  })
  return {
    props: {
      ...(typeof participantToken === 'string' && !cookiesAvailable
        ? { participantToken, cookiesAvailable }
        : {}),
      messages: (
        await import(`@klicker-uzh/i18n/messages/${ctx.locale ?? 'en'}`)
      ).default,
    },
  }
}

export default StudentDocs
