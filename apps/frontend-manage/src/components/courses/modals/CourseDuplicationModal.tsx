import { useQuery } from '@apollo/client'
import {
  Course,
  LocaleType,
  UserProfileDocument,
} from '@klicker-uzh/graphql/dist/ops'
import {
  Button,
  FormikColorPicker,
  FormikDatePicker,
  FormikNumberField,
  FormikSelectField,
  FormikSwitchField,
  FormikTextField,
  H3,
  Modal,
  toast,
  UserNotification,
} from '@uzh-bf/design-system'
import dayjs from 'dayjs'
import { Form, Formik, FormikProps } from 'formik'
import { useTranslations } from 'next-intl'
import { useEffect, useRef } from 'react'
import * as yup from 'yup'
import EditorField from '../../activities/creation/EditorField'
import CourseDateChangeMonitor from './CourseDateChangeMonitor'
import GamificationSettingMonitor from './GamificationSettingMonitor'

interface CourseDuplicationModalProps {
  initialValues?: Course
  earliestGroupDeadline?: string
  earliestStartDate?: string
  latestEndDate?: string
  containsActivities?: boolean
  containsGroups?: boolean
  onModalClose: () => void
  onSubmit: (
    values: CourseDuplicationFormData,
    setSubmitting: (isSubmitting: boolean) => void,
    onError: () => void
  ) => Promise<void>
}

export interface CourseDuplicationFormData {
  name: string
  displayName: string
  description: string
  color: string
  startDate: Date
  endDate: Date
  language: LocaleType
  notificationEmail: string
  isGamificationEnabled: boolean
  isGroupCreationEnabled: boolean
  groupCreationDeadline: Date
  maxGroupSize?: number
  preferredGroupSize?: number
  copyLiveQuizzes: boolean
  copyPracticeQuizzes: boolean
  copyMicroLearnings: boolean
  copyGroupActivities: boolean
}

function ApplyCourseDateDelta({
  values,
  setFieldValue,
  deltaCourse,
}: {
  values: { startDate: Date; endDate: Date; groupCreationDeadline: Date }
  setFieldValue: (field: string, value: any) => void
  deltaCourse: number
}) {
  useEffect(() => {
    if (values.startDate) {
      const newEnd = dayjs(values.startDate).add(deltaCourse, 'day').toDate()
      if (!values.endDate || !dayjs(values.endDate).isSame(newEnd, 'day')) {
        setFieldValue('endDate', newEnd)
      }
    }
  }, [values.startDate, setFieldValue])

  useEffect(() => {
    if (values.endDate) {
      const newStart = dayjs(values.endDate)
        .subtract(deltaCourse, 'day')
        .toDate()
      if (
        !values.startDate ||
        !dayjs(values.startDate).isSame(newStart, 'day')
      ) {
        setFieldValue('startDate', newStart)
      }
    }
  }, [values.endDate, setFieldValue])

  return null
}

function ApplyGroupDeadlineDelta({
  values,
  setFieldValue,
  deltaGroupActivity,
}: {
  values: {
    isGroupCreationEnabled: boolean
    startDate: Date
    endDate: Date
    groupCreationDeadline: Date
  }
  setFieldValue: (field: string, value: any) => void
  deltaGroupActivity: number
}) {
  useEffect(() => {
    if (values.startDate && values.isGroupCreationEnabled) {
      const newDeadline = dayjs(values.startDate)
        .add(deltaGroupActivity, 'day')
        .toDate()
      if (
        !values.groupCreationDeadline ||
        !dayjs(values.groupCreationDeadline).isSame(newDeadline, 'day')
      ) {
        setFieldValue('groupCreationDeadline', newDeadline)
      }
    }
  }, [values.startDate, values.isGroupCreationEnabled, setFieldValue])
  return null
}

function ApplyGroupActivityCopyGuard({
  values,
  setFieldValue,
}: {
  values: { isGroupCreationEnabled: boolean; copyGroupActivities: boolean }
  setFieldValue: (field: string, value: any) => void
}) {
  useEffect(() => {
    if (!values.isGroupCreationEnabled && values.copyGroupActivities) {
      setFieldValue('copyGroupActivities', false)
    }
  }, [values.isGroupCreationEnabled, values.copyGroupActivities, setFieldValue])

  return null
}

function CourseDuplicationModal({
  initialValues,
  earliestGroupDeadline,
  earliestStartDate,
  latestEndDate,
  containsActivities = false,
  containsGroups = false,
  onModalClose,
  onSubmit,
}: CourseDuplicationModalProps) {
  const t = useTranslations()
  const formRef = useRef<FormikProps<CourseDuplicationFormData>>(null)

  // fetch user (from cache) to get email for notification field initialization
  const { data: dataUser, loading: loadingUser } = useQuery(
    UserProfileDocument,
    {
      fetchPolicy: 'cache-only',
    }
  )

  // keep past source courses duplicatable without forcing the old end date forward
  const endDatePast =
    initialValues?.endDate && new Date(initialValues.endDate) < new Date()

  const schema = yup.object().shape({
    name: yup.string().required(t('manage.courseList.courseNameReq')),
    displayName: yup
      .string()
      .required(t('manage.courseList.courseDisplayNameReq')),
    description: yup.string(),
    language: yup.string().required(),
    color: yup.string().required(t('manage.courseList.courseColorReq')),
    startDate: yup
      .date()
      .required(t('manage.courseList.courseStartReq'))
      .test(
        'afterEarliestActivityStart',
        t('manage.courseList.courseStartBeforeEarliestActivityStart', {
          date: dayjs(earliestStartDate).format('DD.MM.YYYY'),
        }),
        (date) => {
          return earliestStartDate
            ? dayjs(date).isBefore(dayjs(earliestStartDate))
            : true
        }
      ),
    endDate: endDatePast
      ? yup.date()
      : yup
          .date()
          .test(
            'checkDateInPast',
            t('manage.courseList.endDateFuture'),
            (d) => {
              return !!(d && d > new Date())
            }
          )
          .test(
            'beforeEarliestActivityEnd',
            t('manage.courseList.endBeforeEarliestActivityEnd', {
              date: dayjs(latestEndDate).format('DD.MM.YYYY'),
            }),
            (date) => {
              return latestEndDate
                ? dayjs(date).isAfter(dayjs(latestEndDate))
                : true
            }
          )
          .when('startDate', (startDate, schema) =>
            schema.min(startDate, t('manage.courseList.endAfterStart'))
          )
          .required(t('manage.courseList.courseEndReq')),
    notificationEmail: yup
      .string()
      .email(t('manage.courseList.notificationEmailInvalid'))
      .required(t('manage.courseList.notificationEmailReq')),
    // gamification is copied from the source course and not exposed as a duplication option
    isGamificationEnabled: yup.boolean(),
    isGroupCreationEnabled: yup.boolean(),
    groupCreationDeadline: initialValues?.groupDeadlineDate
      ? yup
          .date()
          .required(t('manage.courseList.groupDeadlineReq'))
          .min(
            yup.ref('startDate'),
            t('manage.courseList.groupDeadlineAfterStart')
          )
          .when('isGroupCreationEnabled', (isGroupCreationEnabled, schema) => {
            const isEnabled = Array.isArray(isGroupCreationEnabled)
              ? isGroupCreationEnabled[0]
              : isGroupCreationEnabled

            return isEnabled
              ? schema.max(
                  yup.ref('endDate'),
                  t('manage.courseList.groupDeadlineBeforeEnd')
                )
              : schema
          })
          .test(
            'isBeforeFirstGroupActivity',
            t('manage.courseList.groupDeadlineBeforeFirstGroupActivity', {
              date: dayjs(earliestGroupDeadline).format('DD.MM.YYYY, HH:mm'),
            }),
            (date) => {
              return earliestGroupDeadline
                ? dayjs(date).isBefore(dayjs(earliestGroupDeadline))
                : true
            }
          )
      : yup
          .date()
          .min(new Date(), t('manage.courseList.groupDeadlineFuture'))
          .when('isGroupCreationEnabled', (isGroupCreationEnabled, schema) => {
            const isEnabled = Array.isArray(isGroupCreationEnabled)
              ? isGroupCreationEnabled[0]
              : isGroupCreationEnabled

            return isEnabled
              ? schema.max(
                  yup.ref('endDate'),
                  t('manage.courseList.groupDeadlineBeforeEnd')
                )
              : schema
          })
          .required(t('manage.courseList.groupDeadlineReq')),
    maxGroupSize: yup
      .number()
      .min(2, t('manage.courseList.maxGroupSizeMin'))
      .moreThan(
        yup.ref('preferredGroupSize'),
        t('manage.courseList.maxGroupSizeLargerThanPreferred')
      )
      .required(t('manage.courseList.maxGroupSizeReq')),
    preferredGroupSize: yup
      .number()
      .min(2, t('manage.courseList.preferredGroupSizeMin'))
      .required(t('manage.courseList.preferredGroupSizeReq')),
    copyLiveQuizzes: yup.boolean().required(),
    copyPracticeQuizzes: yup.boolean().required(),
    copyMicroLearnings: yup.boolean().required(),
    copyGroupActivities: yup.boolean().required(),
  })

  // convert all dates back to local time
  // default start date is the first day of the next month (end date + 6 months)
  const today = new Date()
  const startDateInit = initialValues?.startDate
    ? dayjs(initialValues?.startDate).local().toDate()
    : new Date(
        new Date(today.getFullYear(), today.getMonth(), 1).setMonth(
          today.getMonth() + 1
        )
      )
  const endDateInit = initialValues?.endDate
    ? dayjs(initialValues?.endDate).local().toDate()
    : new Date(
        new Date(today.getFullYear(), today.getMonth(), 1).setMonth(
          today.getMonth() + 7
        )
      )

  const groupDeadlineDateInit = useRef(
    initialValues?.groupDeadlineDate
      ? dayjs(initialValues.groupDeadlineDate).local().toDate()
      : endDateInit
  ).current

  const deltaCourseDates = dayjs(endDateInit).diff(dayjs(startDateInit), 'day')

  const deltaCourseYears = dayjs(endDateInit).diff(dayjs(startDateInit), 'year')
  const deltaCourseMonths = dayjs(endDateInit).diff(
    dayjs(startDateInit).add(deltaCourseYears, 'year'),
    'month'
  )
  const deltaCourseDays = dayjs(endDateInit).diff(
    dayjs(startDateInit)
      .add(deltaCourseYears, 'year')
      .add(deltaCourseMonths, 'month'),
    'day'
  )
  const descriptionCourseDuration =
    deltaCourseYears || deltaCourseMonths || deltaCourseDays
      ? `${deltaCourseYears ? `${deltaCourseYears} year${deltaCourseYears > 1 ? 's' : ''}` : ''}${deltaCourseMonths ? `${deltaCourseMonths} month${deltaCourseMonths > 1 ? 's' : ''} ` : ''}${deltaCourseDays ? `${deltaCourseDays} day${deltaCourseDays > 1 ? 's' : ''}` : ''}`
      : ''

  const deltaGroupCreationDeadline = dayjs(groupDeadlineDateInit).diff(
    dayjs(startDateInit),
    'day'
  )

  const nameCopy = initialValues?.name
    ? `${initialValues.name} Copy`
    : 'Course Copy'
  const displayNameCopy = initialValues?.displayName
    ? `${initialValues.displayName} Copy`
    : 'Course Copy'

  return (
    <Modal
      open
      escapeDisabled
      loading={!initialValues && loadingUser}
      title={t('manage.course.duplicateCourse')}
      onClose={onModalClose}
      className={{ content: 'w-full!' }}
    >
      <Formik
        validateOnMount
        innerRef={formRef}
        initialValues={{
          name: nameCopy,
          displayName: displayNameCopy,
          description: initialValues?.description ?? '',
          notificationEmail:
            initialValues?.notificationEmail ??
            dataUser?.userProfile?.email ??
            '',
          language:
            initialValues?.language ??
            dataUser?.userProfile?.locale ??
            LocaleType.En,
          color: initialValues?.color ?? '#0028A5',
          startDate: startDateInit,
          endDate: endDateInit,
          isGamificationEnabled: initialValues?.isGamificationEnabled ?? true,
          isGroupCreationEnabled: initialValues?.isGroupCreationEnabled ?? true,
          groupCreationDeadline: groupDeadlineDateInit,
          maxGroupSize: initialValues?.maxGroupSize ?? undefined,
          preferredGroupSize: initialValues?.preferredGroupSize ?? undefined,
          copyLiveQuizzes: true,
          copyPracticeQuizzes: true,
          copyMicroLearnings: true,
          copyGroupActivities: initialValues?.isGroupCreationEnabled ?? true,
        }}
        onSubmit={async (values, { setSubmitting }) =>
          onSubmit(values, setSubmitting, () =>
            toast({
              type: 'error',
              message: (
                <div>
                  <div>{t('manage.courseList.courseCreationFailed')}</div>
                  <div>{t('manage.activityWizard.considerFormErrors')}</div>
                </div>
              ),
              options: { duration: 6000 },
            })
          )
        }
        validationSchema={schema}
      >
        {({
          values,
          touched,
          errors,
          isValid,
          isSubmitting,
          setTouched,
          setFieldValue,
          validateField,
        }) => (
          <Form>
            <CourseDateChangeMonitor
              values={values}
              setTouched={setTouched}
              validateField={validateField}
            />
            <GamificationSettingMonitor
              values={values}
              setFieldValue={setFieldValue}
            />
            <ApplyGroupActivityCopyGuard
              values={values}
              setFieldValue={setFieldValue}
            />
            <div className="flex flex-col gap-2">
              <div className="flex w-full flex-col gap-3 md:flex-row">
                <FormikTextField
                  name="name"
                  label={t('manage.courseList.courseName')}
                  placeholder={t('manage.courseList.courseName')}
                  tooltip={t('manage.courseList.courseNameTooltip')}
                  className={{ root: 'w-full md:w-1/2' }}
                  data={{ cy: 'course-name' }}
                  required
                />
                <FormikTextField
                  name="displayName"
                  label={t('manage.activityWizard.displayName')}
                  placeholder={t('manage.courseList.courseDisplayName')}
                  tooltip={t('manage.courseList.courseDisplayNameTooltip')}
                  className={{ root: 'w-full md:w-1/2' }}
                  data={{ cy: 'course-display-name' }}
                  required
                />
              </div>
              <EditorField
                fieldName="description"
                label={t('shared.generic.description')}
                placeholder={t('manage.courseList.addDescription')}
                tooltip={t('manage.courseList.courseDescriptionTooltip')}
                data={{ cy: 'course-description' }}
                className={{ input: { editor: 'h-20' } }}
                showToolbarOnFocus={false}
              />
              <div className="mt-2 flex flex-col gap-6">
                <div className="flex flex-col gap-2 md:grid md:grid-cols-3">
                  <FormikDatePicker
                    required
                    name="startDate"
                    label={t('manage.courseList.startDate')}
                    tooltip={t('manage.courseList.startDateTooltip')}
                    dataTrigger={{ cy: 'course-start-date' }}
                    dataCalendar={{ cy: 'course-start-date-calendar' }}
                    dataPreviousMonth={{
                      cy: 'course-start-date-previous-month',
                    }}
                    dataNextMonth={{ cy: 'course-start-date-next-month' }}
                  />
                  <div className="flex flex-col">
                    <FormikDatePicker
                      required
                      name="endDate"
                      label={t('manage.courseList.endDate')}
                      tooltip={
                        t('manage.courseList.endDateTooltip') +
                        ' ' +
                        t(
                          'manage.courseList.courseDatesForCourseDuplicationTooltip'
                        )
                      }
                      dataTrigger={{ cy: 'course-end-date' }}
                      dataCalendar={{ cy: 'course-end-date-calendar' }}
                      dataPreviousMonth={{
                        cy: 'course-end-date-previous-month',
                      }}
                      dataNextMonth={{ cy: 'course-end-date-next-month' }}
                    />
                    <span className="text-uzh-darkgreen-100 mt-1 w-full">
                      {t('manage.courseList.fixedDateInterval', {
                        duration: descriptionCourseDuration,
                      })}
                    </span>
                  </div>

                  <ApplyCourseDateDelta
                    values={values}
                    setFieldValue={setFieldValue}
                    deltaCourse={deltaCourseDates}
                  />
                  <ApplyGroupDeadlineDelta
                    values={values}
                    setFieldValue={setFieldValue}
                    deltaGroupActivity={deltaGroupCreationDeadline}
                  />
                  <FormikColorPicker
                    required
                    name="color"
                    label={t('manage.courseList.courseColor')}
                    colorLabel={t('shared.generic.color')}
                    position="top-left"
                    submitText={t('shared.generic.confirm')}
                    dataTrigger={{ cy: 'course-color-trigger' }}
                    dataHexInput={{ cy: 'course-color-hex-input' }}
                    dataSubmit={{ cy: 'course-color-submit' }}
                    className={{
                      root: 'w-max',
                    }}
                  />
                  <FormikSelectField
                    required
                    name="language"
                    label={t('shared.generic.language')}
                    tooltip={t('manage.courseList.languageTooltip')}
                    items={Object.values(LocaleType).map((locale) => ({
                      value: locale,
                      label: t(`shared.generic.${locale}`),
                    }))}
                    className={{ root: 'w-full' }}
                    data={{ cy: 'course-language' }}
                  />
                  <FormikTextField
                    required
                    name="notificationEmail"
                    label={t('manage.courseList.notificationEmail')}
                    placeholder={t(
                      'manage.courseList.notificationEmailPlaceholder'
                    )}
                    tooltip={t('manage.courseList.notificationEmailTooltip')}
                    className={{
                      field: 'w-96',
                    }}
                    data={{ cy: 'course-notification-email' }}
                  />
                </div>

                <div>
                  <H3>{t('shared.generic.groups')}</H3>
                  <div className="flex flex-col gap-2 md:grid md:grid-cols-3">
                    <FormikSwitchField
                      required
                      labelLeft
                      disabled={!values.isGamificationEnabled}
                      name="isGroupCreationEnabled"
                      label={t('manage.courseList.groupCreationEnabled')}
                      tooltip={
                        values.isGamificationEnabled
                          ? t('manage.courseList.groupCreationEnabledTooltip')
                          : t('manage.courseList.groupCreationDisabledTooltip')
                      }
                      className={{
                        label: 'font-bold text-gray-600',
                      }}
                      data={{ cy: 'course-group-creation' }}
                    />
                  </div>
                  {values.isGamificationEnabled &&
                    values.isGroupCreationEnabled && (
                      <div className="flex flex-col gap-2 md:mt-3 md:grid md:grid-cols-3">
                        <FormikDatePicker
                          required
                          name="groupCreationDeadline"
                          disabled={true}
                          label={t('manage.courseList.groupCreationDeadline')}
                          tooltip={
                            t(
                              'manage.courseList.groupCreationDeadlineTooltip'
                            ) +
                            ' ' +
                            t(
                              'manage.courseList.groupCreationDeadlineForCourseDuplicationTooltip'
                            )
                          }
                          dataTrigger={{ cy: 'group-creation-deadline' }}
                          dataCalendar={{
                            cy: 'group-creation-deadline-calendar',
                          }}
                          dataPreviousMonth={{
                            cy: 'group-creation-deadline-previous-month',
                          }}
                          dataNextMonth={{
                            cy: 'group-creation-deadline-next-month',
                          }}
                        />
                        <FormikNumberField
                          name="maxGroupSize"
                          label={t('manage.courseList.maxGroupSize')}
                          tooltip={t('manage.courseList.maxGroupSizeTooltip')}
                          data={{ cy: 'max-group-size' }}
                          className={{ root: 'max-w-52' }}
                          required
                        />
                        <FormikNumberField
                          name="preferredGroupSize"
                          label={t('manage.courseList.preferredGroupSize')}
                          tooltip={t(
                            'manage.courseList.preferredGroupSizeTooltip'
                          )}
                          data={{ cy: 'preferred-group-size' }}
                          className={{ root: 'max-w-52' }}
                          required
                        />
                      </div>
                    )}
                </div>
              </div>
            </div>
            <div className="mt-6 flex flex-col">
              <H3>{`${t('shared.generic.activities')}`}</H3>
              <div data-cy="course-duplication-copy-info">
                <UserNotification type="info" className={{ root: 'mb-3' }}>
                  {t('manage.courseList.courseDuplicationCopyInfo')}
                </UserNotification>
              </div>
              <div className="flex flex-col md:grid md:grid-cols-3">
                <FormikSwitchField
                  required
                  labelLeft
                  name="copyLiveQuizzes"
                  label={t('shared.generic.liveQuizzes')}
                  tooltip={t('manage.courseList.copyLiveQuizzesTooltip')}
                  className={{
                    label: 'font-bold text-gray-600',
                  }}
                  data={{ cy: 'course-live-quizzes' }}
                />
                <div className="md:col-span-2">
                  <FormikSwitchField
                    required
                    labelLeft
                    name="copyPracticeQuizzes"
                    label={t('shared.generic.practiceQuizzes')}
                    tooltip={t('manage.courseList.copyPracticeQuizzesTooltip')}
                    className={{
                      label: 'font-bold text-gray-600',
                    }}
                    data={{ cy: 'course-practice-quizzes' }}
                  />
                </div>
                <FormikSwitchField
                  required
                  labelLeft
                  name="copyMicroLearnings"
                  label={t('shared.generic.microlearnings')}
                  tooltip={t('manage.courseList.copyMicroLearningsTooltip')}
                  className={{
                    label: 'font-bold text-gray-600',
                  }}
                  data={{ cy: 'course-microlearnings' }}
                />
                <div className="md:col-span-2">
                  <FormikSwitchField
                    required
                    disabled={!values.isGroupCreationEnabled}
                    labelLeft
                    name="copyGroupActivities"
                    label={t('shared.generic.groupActivities')}
                    tooltip={t('manage.courseList.copyGroupActivitiesTooltip')}
                    className={{
                      label: 'font-bold text-gray-600',
                    }}
                    data={{ cy: 'course-group-activities' }}
                  />
                </div>
              </div>
            </div>
            <div className="mt-1 flex flex-row justify-between">
              {errors && (
                <div className="text-sm text-red-700">{errors.description}</div>
              )}
            </div>

            <div>
              {(() => {
                const infoNotification = []
                if (values.isGamificationEnabled) {
                  infoNotification.push(
                    values.isGroupCreationEnabled
                      ? t('manage.courseList.gamificationGroupsFixed')
                      : t('manage.courseList.gamificationFixed')
                  )
                }
                if (values.copyMicroLearnings) {
                  infoNotification.push(
                    t('manage.courseList.changeAvailabilityDateMicrolearnings')
                  )
                }
                if (values.copyGroupActivities) {
                  infoNotification.push(
                    t('manage.courseList.changeAvailabilityDateGroupActivities')
                  )
                }

                return infoNotification.length > 0 ? (
                  <UserNotification type="info" className={{ root: 'mt-2' }}>
                    <ul className="pl-3">
                      {infoNotification.map((message, i) => (
                        <li className="list-disc" key={i}>
                          {message}
                        </li>
                      ))}
                    </ul>
                  </UserNotification>
                ) : null
              })()}
            </div>

            <div>
              {(() => {
                const warningNotification = []
                if (
                  initialValues?.groupDeadlineDate &&
                  touched.groupCreationDeadline &&
                  values.groupCreationDeadline !== groupDeadlineDateInit &&
                  dayjs(values.groupCreationDeadline) < dayjs()
                ) {
                  warningNotification.push(
                    t('manage.courseList.groupDeadlineChangedToPast')
                  )
                }

                return warningNotification.length > 0 ? (
                  <UserNotification type="warning" className={{ root: 'mt-2' }}>
                    <ul className="pl-3">
                      {warningNotification.map((message, i) => (
                        <li className="list-disc" key={i}>
                          {message}
                        </li>
                      ))}
                    </ul>
                  </UserNotification>
                ) : null
              })()}
            </div>
            <Button
              primary
              disabled={!isValid || isSubmitting}
              type="submit"
              className={{ root: 'float-right mt-3' }}
              data={{ cy: 'manipulate-course-submit' }}
            >
              <Button.Label>{t('shared.generic.create')}</Button.Label>
            </Button>
          </Form>
        )}
      </Formik>
    </Modal>
  )
}

export default CourseDuplicationModal
