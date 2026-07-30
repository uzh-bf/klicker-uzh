import { ApolloError, useMutation, useQuery } from '@apollo/client'
import { faClock } from '@fortawesome/free-regular-svg-icons'
import { faRotate, faUserGroup } from '@fortawesome/free-solid-svg-icons'
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome'
import {
  GetSingleCourseDocument,
  PracticeQuizMode,
  PracticeQuizPublicationPreviewDocument,
  PublishPracticeQuizDocument,
} from '@klicker-uzh/graphql/dist/ops'
import {
  Button,
  FormikDatetimePicker,
  H3,
  Modal,
  UserNotification,
  toast,
} from '@uzh-bf/design-system'
import dayjs from 'dayjs'
import { Form, Formik } from 'formik'
import { useTranslations } from 'next-intl'
import * as yup from 'yup'
import AdaptiveReadinessPanel from '../../activities/creation/practiceQuiz/AdaptiveReadinessPanel'

interface PracticeQuizPublishingModalProps {
  activityId: string
  title: string
  courseId: string
  courseStartDate: string
  mode: PracticeQuizMode
  onClose: () => void
  refetchActivities?: () => Promise<void>
}

function PracticeQuizPublishingModal({
  activityId,
  title,
  courseId,
  courseStartDate,
  mode,
  onClose,
  refetchActivities,
}: PracticeQuizPublishingModalProps) {
  const t = useTranslations()
  const adaptive = mode === PracticeQuizMode.Adaptive
  const {
    data: publicationPreviewData,
    loading: publicationPreviewLoading,
    error: publicationPreviewError,
    refetch: refetchPublicationPreview,
  } = useQuery(PracticeQuizPublicationPreviewDocument, {
    variables: { id: activityId },
    skip: !adaptive,
    fetchPolicy: 'network-only',
    notifyOnNetworkStatusChange: true,
  })
  const publicationPreview =
    publicationPreviewData?.practiceQuizPublicationPreview
  const [publishPracticeQuiz, { loading: practiceQuizPublishing }] =
    useMutation(PublishPracticeQuizDocument, {
      update(cache, { data }) {
        cache.updateQuery(
          { query: GetSingleCourseDocument, variables: { courseId } },
          (qData) => {
            const publishedPq = data?.publishPracticeQuiz
            if (!qData?.course?.practiceQuizzesInfo || !publishedPq)
              return qData

            return {
              course: {
                ...qData.course,
                practiceQuizzesInfo: qData.course.practiceQuizzesInfo.map(
                  (practiceQuiz) =>
                    practiceQuiz.id === publishedPq.id
                      ? {
                          ...practiceQuiz,
                          automaticPublicationAt: publishedPq.availableFrom,
                          status: publishedPq.status,
                        }
                      : practiceQuiz
                ),
              },
            }
          }
        )
      },
    })

  const publishAdaptivePracticeQuiz = async () => {
    try {
      const result = await publishPracticeQuiz({
        variables: { id: activityId },
      })
      if (!result.data?.publishPracticeQuiz) {
        throw new Error(t('manage.adaptivePublication.emptyResponse'))
      }
      await refetchActivities?.()
      onClose()
    } catch (error) {
      try {
        await refetchPublicationPreview()
      } catch {}
      toast({
        type: 'error',
        message: (
          <div>
            <div>{t('manage.adaptivePublication.publishFailed')}</div>
            <div className="mt-1 text-sm">{getServerErrorDetails(error)}</div>
          </div>
        ),
        options: { duration: 6000 },
      })
    }
  }

  return (
    <Modal
      open
      title={`${t('shared.generic.practiceQuiz')}: ${title}`}
      onClose={onClose}
      className={{ content: 'pb-2 text-base' }}
      dataCloseButton={{ cy: 'cancel-practice-quiz-publication' }}
    >
      {adaptive ? (
        <div
          className="flex w-full flex-col gap-4"
          data-cy="adaptive-publication"
        >
          <div className="flex flex-row items-center gap-2">
            <FontAwesomeIcon icon={faUserGroup} />
            <H3
              className={{ root: 'mb-0' }}
              data={{ cy: 'publish-immediately-header' }}
            >
              {t('manage.course.practiceQuizPublishImmediately')}
            </H3>
          </div>
          <div>{t('manage.adaptivePublication.immediateOnly', { title })}</div>
          {publicationPreviewLoading ? (
            <UserNotification
              type="info"
              message={t('manage.adaptivePublication.checkingReadiness')}
              data={{ cy: 'adaptive-publication-loading' }}
            />
          ) : null}
          {publicationPreviewError ? (
            <div className="flex flex-col items-start gap-2">
              <UserNotification
                type="error"
                message={publicationPreviewError.message}
                data={{ cy: 'adaptive-publication-preview-error' }}
              />
              <Button
                type="button"
                onClick={() => void refetchPublicationPreview()}
                disabled={publicationPreviewLoading}
                loading={publicationPreviewLoading}
                data={{ cy: 'retry-adaptive-publication-preview' }}
              >
                <Button.Icon
                  icon={faRotate}
                  loading={publicationPreviewLoading}
                />
                <Button.Label>{t('shared.generic.tryAgain')}</Button.Label>
              </Button>
            </div>
          ) : null}
          <AdaptiveReadinessPanel
            readiness={publicationPreview?.readiness}
            rootNames={
              new Map(
                publicationPreview?.rootNodes.map((node) => [
                  node.id,
                  node.name,
                ])
              )
            }
          />
          <div className="flex justify-end">
            <Button
              primary
              onClick={() => void publishAdaptivePracticeQuiz()}
              loading={practiceQuizPublishing}
              disabled={
                publicationPreviewLoading ||
                !publicationPreview?.readiness?.ready
              }
              data={{ cy: 'publish-practice-quiz-immediately' }}
            >
              <Button.Label>
                {t('manage.course.confirmPublication')}
              </Button.Label>
            </Button>
          </div>
        </div>
      ) : (
        <div className="flex w-full flex-col gap-4 md:flex-row">
          <div className="border-uzh-grey-80 w-full border-b border-solid pb-3 md:w-1/2 md:border-b-0 md:border-r md:pr-5">
            <div className="mb-2 flex flex-row items-center gap-2">
              <FontAwesomeIcon icon={faUserGroup} />
              <H3
                className={{ root: 'mb-0' }}
                data={{ cy: 'publish-immediately-header' }}
              >
                {t('manage.course.practiceQuizPublishImmediately')}
              </H3>
            </div>
            <div>
              {t('manage.course.practiceQuizPublishingHint', { title })}
            </div>
            <Button
              primary
              onClick={async () => {
                await publishPracticeQuiz({ variables: { id: activityId } })
                await refetchActivities?.()
                onClose()
              }}
              loading={practiceQuizPublishing}
              data={{ cy: 'publish-practice-quiz-immediately' }}
              className={{ root: 'float-right mt-3' }}
            >
              <Button.Label>
                {t('manage.course.confirmPublication')}
              </Button.Label>
            </Button>
          </div>

          <div className="w-full md:w-1/2 md:pl-3">
            <div className="mb-2 flex flex-row items-center gap-2">
              <FontAwesomeIcon icon={faClock} />
              <H3 className={{ root: 'mb-0' }}>
                {t('manage.course.schedulePublication')}
              </H3>
            </div>
            <div className="mb-2">
              {t('manage.course.practiceQuizSchedulingHint', { title })}
            </div>
            <Formik
              validateOnMount
              initialValues={{ availableFrom: undefined }}
              onSubmit={async (values, { setSubmitting }) => {
                setSubmitting(true)
                await publishPracticeQuiz({
                  variables: {
                    id: activityId,
                    availableFrom: dayjs(values.availableFrom).utc().format(),
                  },
                })
                await refetchActivities?.()
                onClose()
              }}
              validationSchema={yup.object().shape({
                availableFrom: yup
                  .date()
                  .required(
                    t('manage.activityWizard.practiceQuizStartRequired')
                  )
                  .test(
                    'afterCourseStart',
                    t(
                      'manage.activityWizard.practiceQuizStartAfterCourseStart'
                    ),
                    (value) => dayjs(value) > dayjs(courseStartDate)
                  ),
              })}
            >
              {({ isValid }) => {
                return (
                  <Form>
                    <FormikDatetimePicker
                      required
                      name="availableFrom"
                      label={t('shared.generic.availableFrom')}
                      placeholder={t('shared.generic.startDate')}
                      granularity="minute"
                      className={{ tooltip: 'z-20' }}
                      dataTrigger={{ cy: 'practice-quiz-available-from' }}
                      dataCalendar={{
                        cy: 'practice-quiz-available-from-calendar',
                      }}
                      dataPreviousMonth={{
                        cy: 'practice-quiz-available-from-previous-month',
                      }}
                      dataNextMonth={{
                        cy: 'practice-quiz-available-from-next-month',
                      }}
                      dataHours={{ cy: 'practice-quiz-available-from-hours' }}
                      dataMinutes={{
                        cy: 'practice-quiz-available-from-minutes',
                      }}
                    />
                    <Button
                      primary
                      type="submit"
                      loading={practiceQuizPublishing}
                      disabled={!isValid}
                      data={{ cy: 'schedule-practice-quiz-publication' }}
                      className={{ root: 'float-right mt-3' }}
                    >
                      <Button.Label>
                        {t('manage.course.confirmScheduling')}
                      </Button.Label>
                    </Button>
                  </Form>
                )
              }}
            </Formik>
          </div>
        </div>
      )}
    </Modal>
  )
}

function getServerErrorDetails(error: unknown): string {
  if (error instanceof ApolloError) {
    const details = error.graphQLErrors.map(
      (graphQLError) => graphQLError.message
    )
    return details.length > 0 ? details.join('; ') : error.message
  }

  return error instanceof Error ? error.message : String(error)
}

export default PracticeQuizPublishingModal
