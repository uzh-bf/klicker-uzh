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
import { useRef } from 'react'
import * as yup from 'yup'
import { learningAnalyticsRolloutEnabled } from '../../../lib/learningAnalytics'
import EditorField from '../../activities/creation/EditorField'
import CourseDateChangeMonitor from './CourseDateChangeMonitor'
import GamificationSettingMonitor from './GamificationSettingMonitor'

interface CourseManipulationModalProps {
  initialValues?: Course
  earliestGroupDeadline?: string
  earliestStartDate?: string
  latestEndDate?: string
  containsActivities?: boolean
  containsGroups?: boolean
  onModalClose: () => void
  onSubmit: (
    values: CourseManipulationFormData,
    setSubmitting: (isSubmitting: boolean) => void,
    onError: () => void
  ) => Promise<void>
}

export interface CourseManipulationFormData {
  name: string
  displayName: string
  description: string
  color: string
  startDate: Date
  endDate: Date
  language: LocaleType
  notificationEmail: string
  isGamificationEnabled: boolean
  isLearningAnalyticsEnabled: boolean
  isGroupCreationEnabled: boolean
  groupCreationDeadline: Date
  maxGroupSize?: number
  preferredGroupSize?: number
}

function CourseManipulationModal({
  initialValues,
  earliestGroupDeadline,
  earliestStartDate,
  latestEndDate,
  containsActivities = false,
  containsGroups = false,
  onModalClose,
  onSubmit,
}: CourseManipulationModalProps) {
  const t = useTranslations()
  const formRef = useRef<FormikProps<CourseManipulationFormData>>(null)

  // fetch user (from cache) to get email for notification field initialization
  const { data: dataUser, loading: loadingUser } = useQuery(
    UserProfileDocument,
    {
      fetchPolicy: 'cache-only',
    }
  )

  // check if initialValues.startDate is in the past
  const startDatePast =
    initialValues?.startDate && new Date(initialValues.startDate) < new Date()
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
    // gamification settings
    isGamificationEnabled: yup.boolean(),
    isLearningAnalyticsEnabled: yup.boolean(),
    isGroupCreationEnabled: yup.boolean(),
    groupCreationDeadline: initialValues?.groupDeadlineDate
      ? yup
          .date()
          .required(t('manage.courseList.groupDeadlineReq'))
          .min(
            yup.ref('startDate'),
            t('manage.courseList.groupDeadlineAfterStart')
          )
          .when('isGroupCreationEnabled', {
            is: true,
            then: (schema) =>
              schema.max(
                yup.ref('endDate'),
                t('manage.courseList.groupDeadlineBeforeEnd')
              ),
            otherwise: (schema) => schema,
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
          .when('isGroupCreationEnabled', {
            is: true,
            then: (schema) =>
              schema.max(
                yup.ref('endDate'),
                t('manage.courseList.groupDeadlineBeforeEnd')
              ),
            otherwise: (schema) => schema,
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
  const groupDeadlineDateInit = initialValues?.groupDeadlineDate
    ? dayjs(initialValues?.groupDeadlineDate).local().toDate()
    : endDateInit

  return (
    <Modal
      open
      escapeDisabled
      loading={!initialValues && loadingUser}
      title={
        initialValues
          ? t('manage.course.modifyCourse')
          : t('manage.courseList.createNewCourse')
      }
      onClose={onModalClose}
      className={{ content: 'w-full!' }}
    >
      <Formik
        validateOnMount
        innerRef={formRef}
        initialValues={{
          name: initialValues?.name ?? '',
          displayName: initialValues?.displayName ?? '',
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
          isLearningAnalyticsEnabled:
            initialValues?.isLearningAnalyticsEnabled ?? false,
          isGroupCreationEnabled: initialValues?.isGroupCreationEnabled ?? true,
          groupCreationDeadline: groupDeadlineDateInit,
          maxGroupSize: initialValues?.maxGroupSize ?? undefined,
          preferredGroupSize: initialValues?.preferredGroupSize ?? undefined,
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
                    disabled={startDatePast}
                    label={t('manage.courseList.startDate')}
                    tooltip={t('manage.courseList.startDateTooltip')}
                    dataTrigger={{ cy: 'course-start-date' }}
                    dataCalendar={{ cy: 'course-start-date-calendar' }}
                    dataPreviousMonth={{
                      cy: 'course-start-date-previous-month',
                    }}
                    dataNextMonth={{ cy: 'course-start-date-next-month' }}
                  />
                  <FormikDatePicker
                    required
                    name="endDate"
                    label={t('manage.courseList.endDate')}
                    tooltip={t('manage.courseList.endDateTooltip')}
                    dataTrigger={{ cy: 'course-end-date' }}
                    dataCalendar={{ cy: 'course-end-date-calendar' }}
                    dataPreviousMonth={{ cy: 'course-end-date-previous-month' }}
                    dataNextMonth={{ cy: 'course-end-date-next-month' }}
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

                {learningAnalyticsRolloutEnabled &&
                  (!initialValues || initialValues.isManager) && (
                    <div>
                      <H3>{t('manage.courseList.learningAnalytics')}</H3>
                      <UserNotification
                        type="info"
                        message={t(
                          'manage.courseList.learningAnalyticsExplanation'
                        )}
                        className={{ root: 'mb-3' }}
                      />
                      <FormikSwitchField
                        required
                        labelLeft
                        name="isLearningAnalyticsEnabled"
                        label={t('manage.courseList.learningAnalyticsEnabled')}
                        tooltip={t(
                          'manage.courseList.learningAnalyticsTooltip'
                        )}
                        className={{
                          label: 'font-bold text-gray-600',
                        }}
                        data={{ cy: 'course-learning-analytics' }}
                      />
                    </div>
                  )}

                <div>
                  <H3>{`${t('shared.generic.gamification')} & ${t('shared.generic.groups')}`}</H3>
                  <div className="flex flex-col gap-2 md:grid md:grid-cols-3">
                    <FormikSwitchField
                      required
                      labelLeft
                      disabled={
                        initialValues?.isGamificationEnabled &&
                        (containsActivities || containsGroups)
                      }
                      name="isGamificationEnabled"
                      label={t('shared.generic.gamification')}
                      tooltip={t('manage.courseList.gamificationTooltip')}
                      className={{
                        label: 'font-bold text-gray-600',
                      }}
                      data={{ cy: 'course-gamification' }}
                    />
                    <FormikSwitchField
                      required
                      labelLeft
                      disabled={
                        !values.isGamificationEnabled ||
                        (initialValues?.isGroupCreationEnabled &&
                          containsGroups)
                      }
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
                          label={t('manage.courseList.groupCreationDeadline')}
                          tooltip={t(
                            'manage.courseList.groupCreationDeadlineTooltip'
                          )}
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
                        {initialValues &&
                        initialValues.isGroupCreationEnabled ? (
                          <div className="mt-2 font-bold text-gray-600">
                            <div>{`${t('manage.courseList.maxGroupSize')}: ${initialValues.maxGroupSize}`}</div>{' '}
                            <div>{`${t('manage.courseList.preferredGroupSize')}: ${initialValues.preferredGroupSize}`}</div>
                          </div>
                        ) : (
                          <>
                            <FormikNumberField
                              name="maxGroupSize"
                              label={t('manage.courseList.maxGroupSize')}
                              tooltip={t(
                                'manage.courseList.maxGroupSizeTooltip'
                              )}
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
                          </>
                        )}
                      </div>
                    )}
                </div>
              </div>
              {initialValues?.groupDeadlineDate &&
                touched.groupCreationDeadline &&
                values.groupCreationDeadline !== groupDeadlineDateInit &&
                dayjs(values.groupCreationDeadline) < dayjs() && (
                  <UserNotification
                    type="warning"
                    message={t('manage.courseList.groupDeadlineChangedToPast')}
                  />
                )}
            </div>
            <div className="mt-1 flex flex-row justify-between">
              {errors && (
                <div className="text-sm text-red-700">{errors.description}</div>
              )}
            </div>
            {values.isGamificationEnabled && (
              <UserNotification
                type="info"
                message={
                  values.isGroupCreationEnabled
                    ? t('manage.courseList.gamificationGroupsFixed')
                    : t('manage.courseList.gamificationFixed')
                }
                className={{ root: 'mt-2' }}
              />
            )}
            <Button
              primary
              disabled={!isValid || isSubmitting}
              type="submit"
              className={{ root: 'float-right mt-3' }}
              data={{ cy: 'manipulate-course-submit' }}
            >
              <Button.Label>
                {initialValues
                  ? t('shared.generic.save')
                  : t('shared.generic.create')}
              </Button.Label>
            </Button>
          </Form>
        )}
      </Formik>
    </Modal>
  )
}

export default CourseManipulationModal
