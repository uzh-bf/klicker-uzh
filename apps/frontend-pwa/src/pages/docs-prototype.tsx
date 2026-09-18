import { useQuery } from '@apollo/client'
import {
  GetCourseChatbotsDocument,
  GetCourseOverviewDataDocument,
} from '@klicker-uzh/graphql/dist/ops'
import { UserNotification } from '@uzh-bf/design-system'
import type { GetStaticPropsContext } from 'next'
import { useRouter } from 'next/router'
import { useTranslations } from 'next-intl'
import { useEffect, useState } from 'react'
import StudentDocsPrototype from '../components/docs/StudentDocsPrototype'
import Layout from '../components/Layout'

function StudentDocsPrototypePage() {
  const t = useTranslations()
  const router = useRouter()
  const [isHydrated, setIsHydrated] = useState(false)

  useEffect(() => {
    setIsHydrated(true)
  }, [])
  const courseId =
    typeof router.query.courseId === 'string'
      ? router.query.courseId
      : undefined
  const assessment = process.env.NEXT_PUBLIC_IS_ASSESSMENT === 'true'
  const [previewGamification, setPreviewGamification] = useState(true)
  const [previewAnalytics, setPreviewAnalytics] = useState(true)
  const [previewChatbot, setPreviewChatbot] = useState(true)
  const { data, loading, error } = useQuery(GetCourseOverviewDataDocument, {
    variables: { courseId: courseId ?? '' },
    skip: !courseId,
  })
  const { data: chatbotData } = useQuery(GetCourseChatbotsDocument, {
    variables: { courseId: courseId ?? '' },
    skip: !courseId || assessment,
  })
  const course = data?.getCourseOverviewData?.course
  const chatbot = chatbotData?.courseChatbots?.[0]
  const preview =
    isHydrated &&
    router.isReady &&
    router.query.courseId === undefined &&
    !assessment

  return (
    <Layout
      displayName={t('shared.generic.documentation')}
      course={course ?? undefined}
    >
      {assessment && (
        <UserNotification
          type="warning"
          className={{ root: 'mx-auto mb-3 w-full max-w-5xl text-base' }}
        >
          {t.rich('pwa.studentDocs.assessmentInstanceWarning', {
            b: (text) => <b>{text}</b>,
          })}
        </UserNotification>
      )}
      <StudentDocsPrototype
        key={courseId ?? 'design-preview'}
        gamificationEnabled={
          !assessment &&
          (preview
            ? previewGamification
            : course?.isGamificationEnabled === true)
        }
        learningAnalyticsEnabled={preview && previewAnalytics}
        previewChatbot={preview && previewChatbot}
        chatbot={
          course && chatbot && !assessment
            ? {
                name: chatbot.name,
                href: `/${router.locale ?? 'en'}/course/${encodeURIComponent(course.id)}/chatbot/${encodeURIComponent(chatbot.id)}?embed=true`,
              }
            : undefined
        }
      />
      <aside className="mx-auto mt-8 w-full max-w-5xl border-t border-dashed border-slate-300 py-4 text-sm text-slate-600">
        <details>
          <summary className="cursor-pointer font-semibold">
            Prototype controls{course ? ` · ${course.displayName}` : ''}
          </summary>
          {preview ? (
            <>
              <p className="font-semibold text-slate-800">
                Design preview · example course settings
              </p>
              <p className="mt-1">
                These switches change this preview only. No course setting or
                consent choice is saved.
              </p>
              <fieldset className="mt-3 flex flex-wrap gap-x-6 gap-y-3">
                <legend className="sr-only">Preview available features</legend>
                <label className="flex items-center gap-2">
                  <input
                    type="checkbox"
                    checked={previewGamification}
                    onChange={(event) =>
                      setPreviewGamification(event.target.checked)
                    }
                  />
                  Gamification
                </label>
                <label className="flex items-center gap-2">
                  <input
                    type="checkbox"
                    checked={previewAnalytics}
                    onChange={(event) =>
                      setPreviewAnalytics(event.target.checked)
                    }
                  />
                  Learning analytics
                </label>
                <label className="flex items-center gap-2">
                  <input
                    type="checkbox"
                    checked={previewChatbot}
                    onChange={(event) =>
                      setPreviewChatbot(event.target.checked)
                    }
                  />
                  Chatbot
                </label>
              </fieldset>
              <p className="mt-3">
                For an actual course, open this page with{' '}
                <code>?courseId=…</code>. Its available chatbot and gamification
                setting determine what appears.
              </p>
            </>
          ) : (
            <>
              <p className="font-semibold text-slate-800">
                {loading
                  ? 'Loading course settings…'
                  : course
                    ? `Course preview · ${course.displayName}`
                    : 'Course settings unavailable'}
              </p>
              <p className="mt-1">
                Learning analytics is hidden here until the course setting and
                account choice are available in the app.
              </p>
              {(error || (!loading && !course)) && (
                <p className="mt-1">
                  Check the course link and sign in to view the features
                  available to you.
                </p>
              )}
            </>
          )}
        </details>
      </aside>
    </Layout>
  )
}

export async function getStaticProps({ locale }: GetStaticPropsContext) {
  if (process.env.NODE_ENV === 'production') return { notFound: true }
  return {
    props: {
      messages: (await import(`@klicker-uzh/i18n/messages/${locale}`)).default,
    },
  }
}

export default StudentDocsPrototypePage
