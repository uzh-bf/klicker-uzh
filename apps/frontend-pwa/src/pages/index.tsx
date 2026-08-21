import { useMutation, useQuery } from '@apollo/client'
import { faBookmark } from '@fortawesome/free-regular-svg-icons'
import {
  faBookOpenReader,
  faChalkboard,
  faChartLine,
  faCheck,
  faCirclePlus,
  faGraduationCap,
  faRepeat,
} from '@fortawesome/free-solid-svg-icons'
import {
  ParticipationsDocument,
  SelfDocument,
  SubscribeToPushDocument,
  UnsubscribeFromPushDocument,
} from '@klicker-uzh/graphql/dist/ops'
import Loader from '@klicker-uzh/shared-components/src/Loader'
import usePushNotifications from '@klicker-uzh/shared-components/src/hooks/usePushNotifications'
import useStickyState from '@klicker-uzh/shared-components/src/hooks/useStickyState'
import { H1, toast, UserNotification } from '@uzh-bf/design-system'
import dayjs from 'dayjs'
import { GetStaticPropsContext } from 'next'
import { useTranslations } from 'next-intl'
import { useRouter } from 'next/router'
import { useEffect } from 'react'
import CourseElement from '../components/CourseElement'
import Layout from '../components/Layout'
import LinkButton from '../components/common/LinkButton'
import MicroLearningListSubscriber from '../components/microLearning/MicroLearningListSubscriber'
import useStudentOverviewSplit from '../lib/hooks/useStudentOverviewSplit'

function Index() {
  const router = useRouter()
  const t = useTranslations()

  const { value: showAssessmentHint, setValue: setShowAssessmentHint } =
    useStickyState('showAssessmentHint', 'true')

  // fetch user info for locale
  const { data: selfData } = useQuery(SelfDocument, {
    fetchPolicy: 'cache-and-network',
  })

  // if the user is not part of the required assessment course, show an error toast
  useEffect(() => {
    if (router.query.error === 'missing_assessment_course_participation') {
      toast({
        type: 'error',
        message: t('pwa.assessment.missingAssessmentCourseParticipation'),
        options: { duration: 7000 },
      })

      // remove the error query param from the URL after showing the toast
      const { error, ...rest } = router.query
      router.replace(
        {
          pathname: router.pathname,
          query: { ...rest },
        },
        undefined,
        { shallow: true }
      )
    }
  }, [router.query.error])

  // redirect to stored locale if different
  useEffect(() => {
    if (
      selfData?.self?.locale &&
      router.locale &&
      selfData.self.locale !== router.locale
    ) {
      // only redirect if not already at correct locale
      router.push(
        { pathname: router.pathname, query: router.query },
        undefined,
        { locale: selfData.self.locale }
      )
    }
  }, [selfData?.self?.locale, router.locale])

  // const { stickyValue: hasSeenSurvey, setValue: setHasSeenSurvey } =
  //   useStickyState('hasSeenSurvey', 'false')

  const [subscribeToPush] = useMutation(SubscribeToPushDocument)
  const [unsubscribeFromPush] = useMutation(UnsubscribeFromPushDocument)

  async function subscribeUser(
    subscriptionObject: PushSubscription,
    courseId: string
  ) {
    await subscribeToPush({
      variables: {
        subscriptionObject: {
          endpoint: subscriptionObject.endpoint,
          expirationTime: subscriptionObject.expirationTime,
          keys: {
            auth: subscriptionObject.toJSON().keys!.auth,
            p256dh: subscriptionObject.toJSON().keys!.p256dh,
          },
        },
        courseId,
      },
      refetchQueries: [
        {
          query: ParticipationsDocument,
          variables: {
            endpoint: subscriptionObject.endpoint,
            assessmentOnly: process.env.NEXT_PUBLIC_IS_ASSESSMENT === 'true',
          },
        },
      ],
    })
  }

  async function unsubscribeUser(
    subscriptionObject: PushSubscription,
    courseId: string
  ) {
    await unsubscribeFromPush({
      variables: {
        courseId,
        endpoint: subscriptionObject.endpoint,
      },
      refetchQueries: [
        {
          query: ParticipationsDocument,
          variables: {
            endpoint: subscriptionObject.endpoint,
            assessmentOnly: process.env.NEXT_PUBLIC_IS_ASSESSMENT === 'true',
          },
        },
      ],
    })
  }

  const {
    userInfo,
    setUserInfo,
    subscription,
    subscribeUserToPush,
    unsubscribeUserFromPush,
  } = usePushNotifications({
    subscribeToPush: subscribeUser,
    unsubscribeFromPush: unsubscribeUser,
  })

  const { data, loading, subscribeToMore } = useQuery(ParticipationsDocument, {
    variables: {
      endpoint: subscription?.endpoint,
      assessmentOnly: process.env.NEXT_PUBLIC_IS_ASSESSMENT === 'true',
    },
    fetchPolicy: 'network-only',
  })

  const { courses, oldCourses, activeLiveQuizzes, activeMicrolearning } =
    useStudentOverviewSplit({ participations: data?.participations ?? [] })

  if (loading || !data) {
    return (
      <Layout key="loading-layout" displayName={t('shared.generic.title')}>
        <Loader />
      </Layout>
    )
  }

  async function onSubscribeClick(
    isSubscribedToPush: boolean,
    courseId: string
  ) {
    setUserInfo('')
    console.log('onSubscribeClick')
    try {
      if (isSubscribedToPush) {
        await unsubscribeUserFromPush(courseId)
      } else {
        await subscribeUserToPush(courseId)
      }
    } catch (error) {
      console.error('An error occurred while un/subscribing a user: ', error)
    }
  }

  return (
    <Layout
      key="pwa-home-layout"
      displayName={
        process.env.NEXT_PUBLIC_IS_ASSESSMENT === 'true'
          ? `${t('shared.generic.title')} (${t('shared.generic.assessment')})`
          : t('shared.generic.title')
      }
    >
      {process.env.NEXT_PUBLIC_IS_ASSESSMENT === 'true' && (
        <UserNotification
          dismissible
          type="info"
          hidden={showAssessmentHint !== 'true'}
          onDismiss={() => setShowAssessmentHint('false')}
          className={{
            root: 'mb-4 md:mx-auto md:w-full md:max-w-xl',
            closeIcon: 'h-6 w-6 text-lg',
          }}
        >
          {t.rich('pwa.assessment.homepageHint', {
            pwa_url: process.env.NEXT_PUBLIC_PWA_URL!,
            link: (children) => (
              <a
                href={process.env.NEXT_PUBLIC_PWA_URL!}
                target="_blank"
                rel="noreferrer"
                className="font-bold"
              >
                {children}
              </a>
            ),
          })}
        </UserNotification>
      )}

      <div
        className="flex flex-col gap-4 md:mx-auto md:w-full md:max-w-xl md:rounded md:border md:p-8"
        data-cy="homepage"
      >
        {/* {hasSeenSurvey === 'false' && (
          <Link
            href="https://qualtricsxm2zqlm4s5q.qualtrics.com/jfe/form/SV_0qyOBbtR0TXnpe6"
            target="_blank"
          >
            <Button
              className={{
                root: 'text-sm flex flex-row gap-4 items-center bg-orange-100 border border-orange-200 rounded-lg p-2 text-left',
              }}
              onClick={() => {
                setHasSeenSurvey(true)
              }}
            >
              <div>
                <FontAwesomeIcon icon={faBullhorn} />
              </div>
              <div>{t('pwa.general.surveyInvitation')}</div>
            </Button>
          </Link>
        )} */}

        {activeLiveQuizzes.length !== 0 && (
          <div>
            <H1 className={{ root: 'mb-2 text-xl' }}>
              {process.env.NEXT_PUBLIC_IS_ASSESSMENT === 'true'
                ? t('shared.generic.assessmentLiveQuizzes')
                : t('shared.generic.activeLiveQuizzes')}
            </H1>
            <div className="flex flex-col gap-2">
              {activeLiveQuizzes.map((quiz) => (
                <LinkButton
                  href={`/session/${quiz.id}`}
                  key={quiz.id}
                  icon={faChalkboard}
                  data={{ cy: `live-quiz-${quiz.displayName}` }}
                >
                  <div className="flex flex-row items-end justify-between md:flex-row">
                    <div>{quiz.displayName}</div>
                    <div className="text-sm">{quiz.courseName}</div>
                  </div>
                </LinkButton>
              ))}
            </div>
          </div>
        )}

        {process.env.NEXT_PUBLIC_IS_ASSESSMENT !== 'true' && (
          <div>
            <H1 className={{ root: 'mb-2 text-xl' }}>
              {t('shared.generic.practice')}
            </H1>
            <div className="flex flex-col gap-2">
              <LinkButton
                data={{ cy: 'practice-pool' }}
                href="/practice"
                icon={faRepeat}
              >
                {t('shared.generic.practicePool')}
              </LinkButton>
              <LinkButton
                data={{ cy: 'quizzes' }}
                href="/repetition"
                icon={faGraduationCap}
              >
                {t('shared.generic.practiceQuizzes')}
              </LinkButton>
              <LinkButton
                data={{ cy: 'personal-elements' }}
                href="/repetition"
                icon={faRepeat}
              >
                {t('pwa.personalElements.homeLink')}
              </LinkButton>
              <LinkButton
                data={{ cy: 'bookmarks' }}
                href="/bookmarks"
                icon={faBookmark}
              >
                {t('pwa.general.myBookmarks')}
              </LinkButton>
            </div>
          </div>
        )}

        {process.env.NEXT_PUBLIC_IS_ASSESSMENT !== 'true' &&
        activeMicrolearning.length > 0 ? (
          <div data-cy="microlearnings">
            <H1 className={{ root: 'mb-2 text-xl' }}>
              {t('shared.generic.microlearning')}
            </H1>
            <div className="flex flex-col gap-2">
              {activeMicrolearning.map((micro) => (
                <LinkButton
                  icon={micro.isCompleted ? faCheck : faBookOpenReader}
                  href={
                    micro.isCompleted
                      ? ''
                      : `/course/${micro.courseId}/microLearnings/${micro.id}/`
                  }
                  key={micro.id}
                  disabled={micro.isCompleted}
                  className={{
                    root: micro.isCompleted
                      ? 'hover:bg-unset cursor-not-allowed'
                      : '',
                  }}
                  data={{ cy: `microlearning-${micro.displayName}` }}
                >
                  <MicroLearningListSubscriber
                    activityId={micro.id}
                    subscribeToMore={subscribeToMore}
                  />
                  <div>{micro.displayName}</div>
                  <div className="flex flex-row items-end justify-between text-xs">
                    <div>
                      {dayjs(micro.scheduledStartAt).format('DD.MM.YYYY HH:mm')}{' '}
                      - {dayjs(micro.scheduledEndAt).format('DD.MM.YYYY HH:mm')}
                    </div>
                    <div>{micro.courseName}</div>
                  </div>
                </LinkButton>
              ))}
            </div>
          </div>
        ) : null}

        <div>
          <H1 className={{ root: 'mb-2 text-xl' }}>
            {process.env.NEXT_PUBLIC_IS_ASSESSMENT === 'true'
              ? t('pwa.general.myAssessmentCourses')
              : t('pwa.general.myCourses')}
          </H1>
          <div className="flex flex-col gap-2">
            {process.env.NEXT_PUBLIC_IS_ASSESSMENT && courses.length === 0 ? (
              <UserNotification type="warning">
                {t('pwa.general.noAssessmentCourseAssignments')}
              </UserNotification>
            ) : null}
            {courses.map((course) => (
              <CourseElement
                key={course.id}
                course={course}
                onSubscribeClick={onSubscribeClick}
              />
            ))}
            {oldCourses.map((course) => (
              <CourseElement key={course.id} course={course} />
            ))}
            {process.env.NEXT_PUBLIC_IS_ASSESSMENT !== 'true' && (
              <LinkButton
                icon={faCirclePlus}
                href="/join"
                data={{ cy: 'join-new-course' }}
              >
                {t('pwa.general.joinCourse')}
              </LinkButton>
            )}
          </div>
        </div>

        {process.env.NEXT_PUBLIC_IS_ASSESSMENT !== 'true' && (
          <div>
            <H1 className={{ root: 'mb-2 text-xl' }}>
              {t('pwa.general.insights')}
            </H1>
            <div className="flex flex-col gap-2">
              <LinkButton
                icon={faChartLine}
                href="/insights/timeline"
                data={{ cy: 'insights-student-timeline' }}
              >
                {t('pwa.general.timeline')}
              </LinkButton>
            </div>
          </div>
        )}

        {userInfo && <UserNotification type="info" message={userInfo} />}
        {/* <SurveyPromotion courseId={courses?.[0]?.id} /> */}
      </div>
    </Layout>
  )
}

export async function getStaticProps({ locale }: GetStaticPropsContext) {
  return {
    props: {
      messages: (await import(`@klicker-uzh/i18n/messages/${locale}`)).default,
    },
  }
}

export default Index
