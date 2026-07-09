import { useQuery } from '@apollo/client'
import {
  Course,
  LocaleType,
  UserProfileDocument,
} from '@klicker-uzh/graphql/dist/ops'
import {
  FormikNumberField,
  FormikTextField,
  FormLabel,
  H3,
  Modal,
  toast,
  UserNotification,
} from '@uzh-bf/design-system'
import dayjs from 'dayjs'
import { Form, Formik, FormikProps, useField } from 'formik'
import { useTranslations } from 'next-intl'
import { useId, useRef } from 'react'
import * as yup from 'yup'
import EditorField from '../../activities/creation/EditorField'

interface CourseDuplicationModalProps {
  initialValues?: Course
  onModalClose: () => void
  onSubmit: (
    values: CourseDuplicationFormData,
    setSubmitting: (isSubmitting: boolean) => void,
    onError: (errorType?: CourseDuplicationErrorType) => void
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

export type CourseDuplicationErrorType = 'access' | 'partial' | 'generic'

type CourseDuplicationTranslationKey =
  | 'manage.courseList.changeAvailabilityDateGroupActivities'
  | 'manage.courseList.changeAvailabilityDateMicrolearnings'
  | 'manage.courseList.courseColorReq'
  | 'manage.courseList.courseCopySuffix'
  | 'manage.courseList.courseDisplayNameReq'
  | 'manage.courseList.courseDuplicationEndDateInPast'
  | 'manage.courseList.courseDuplicationFailed'
  | 'manage.courseList.courseDuplicationNoAccess'
  | 'manage.courseList.courseDuplicationPartialFailure'
  | 'manage.courseList.courseEndReq'
  | 'manage.courseList.courseNameReq'
  | 'manage.courseList.courseStartReq'
  | 'manage.courseList.endAfterStart'
  | 'manage.courseList.endDateFuture'
  | 'manage.courseList.gamificationFixed'
  | 'manage.courseList.gamificationGroupsFixed'
  | 'manage.courseList.groupDeadlineAfterStart'
  | 'manage.courseList.groupDeadlineBeforeEnd'
  | 'manage.courseList.groupDeadlineChangedToPast'
  | 'manage.courseList.groupDeadlineFuture'
  | 'manage.courseList.groupDeadlineReq'
  | 'manage.courseList.maxGroupSizeLargerThanPreferred'
  | 'manage.courseList.maxGroupSizeMin'
  | 'manage.courseList.maxGroupSizeReq'
  | 'manage.courseList.notificationEmailInvalid'
  | 'manage.courseList.notificationEmailReq'
  | 'manage.courseList.preferredGroupSizeMin'
  | 'manage.courseList.preferredGroupSizeReq'

type TranslationFn = (key: CourseDuplicationTranslationKey) => string
type FormikNativeInputData = {
  cy?: string
  test?: string
}

function getCourseDuplicationDateDefaults(initialValues?: Course) {
  const today = new Date()
  const defaultStartDate = new Date(
    new Date(today.getFullYear(), today.getMonth(), 1).setMonth(
      today.getMonth() + 1
    )
  )
  const defaultEndDate = new Date(
    new Date(today.getFullYear(), today.getMonth(), 1).setMonth(
      today.getMonth() + 7
    )
  )
  const startDate = initialValues?.startDate
    ? dayjs(initialValues.startDate).local().toDate()
    : defaultStartDate
  const endDate = initialValues?.endDate
    ? dayjs(initialValues.endDate).local().toDate()
    : defaultEndDate
  const groupDeadlineDate = initialValues?.groupDeadlineDate
    ? dayjs(initialValues.groupDeadlineDate).local().toDate()
    : endDate

  return { startDate, endDate, groupDeadlineDate }
}

function getCourseDuplicationDurationParts(startDate: Date, endDate: Date) {
  const years = dayjs(endDate).diff(dayjs(startDate), 'year')
  const months = dayjs(endDate).diff(
    dayjs(startDate).add(years, 'year'),
    'month'
  )
  const days = dayjs(endDate).diff(
    dayjs(startDate).add(years, 'year').add(months, 'month'),
    'day'
  )

  return { years, months, days }
}

function getCourseDuplicationCopyName(t: TranslationFn, value?: string | null) {
  const suffix = t('manage.courseList.courseCopySuffix')

  return value ? `${value} ${suffix}` : suffix
}

function getNativeDateInputValue(value?: Date | string | null) {
  if (!value) return ''

  return dayjs(value).format('YYYY-MM-DD')
}

function getNativeDateInputDate(value: string) {
  const parsedDate = dayjs(value, 'YYYY-MM-DD')

  return parsedDate.isValid() ? parsedDate.toDate() : undefined
}

function isValidHexColor(value?: string) {
  return Boolean(value?.match(/^#[\da-f]{6}$/i))
}

function getCourseDuplicationEndDateSchema(
  t: TranslationFn,
  endDatePast: boolean
) {
  if (endDatePast) return yup.date()

  return yup
    .date()
    .test('checkDateInPast', t('manage.courseList.endDateFuture'), (d) => {
      return !!(d && d > new Date())
    })
    .when('startDate', (startDate, schema) =>
      schema.min(startDate, t('manage.courseList.endAfterStart'))
    )
    .required(t('manage.courseList.courseEndReq'))
}

function getCourseDuplicationGroupDeadlineSchema({
  t,
  hasSourceGroupDeadline,
}: {
  t: TranslationFn
  hasSourceGroupDeadline: boolean
}) {
  const addEndDateLimit = (schema: yup.DateSchema) =>
    schema.when('isGroupCreationEnabled', (isGroupCreationEnabled, base) => {
      const isEnabled = Array.isArray(isGroupCreationEnabled)
        ? isGroupCreationEnabled[0]
        : isGroupCreationEnabled

      return isEnabled
        ? base.max(
            yup.ref('endDate'),
            t('manage.courseList.groupDeadlineBeforeEnd')
          )
        : base
    })

  if (hasSourceGroupDeadline) {
    return addEndDateLimit(
      yup
        .date()
        .required(t('manage.courseList.groupDeadlineReq'))
        .min(
          yup.ref('startDate'),
          t('manage.courseList.groupDeadlineAfterStart')
        )
    )
  }

  return addEndDateLimit(
    yup
      .date()
      .min(new Date(), t('manage.courseList.groupDeadlineFuture'))
      .required(t('manage.courseList.groupDeadlineReq'))
  )
}

function getCourseDuplicationSchema({
  t,
  initialValues,
  endDatePast,
}: {
  t: TranslationFn
  initialValues?: Course
  endDatePast: boolean
}) {
  return yup.object().shape({
    name: yup.string().required(t('manage.courseList.courseNameReq')),
    displayName: yup
      .string()
      .required(t('manage.courseList.courseDisplayNameReq')),
    description: yup.string(),
    language: yup.string().required(),
    color: yup.string().required(t('manage.courseList.courseColorReq')),
    startDate: yup.date().required(t('manage.courseList.courseStartReq')),
    endDate: getCourseDuplicationEndDateSchema(t, endDatePast),
    notificationEmail: yup
      .string()
      .email(t('manage.courseList.notificationEmailInvalid'))
      .required(t('manage.courseList.notificationEmailReq')),
    isGamificationEnabled: yup.boolean(),
    isGroupCreationEnabled: yup.boolean(),
    groupCreationDeadline: getCourseDuplicationGroupDeadlineSchema({
      t,
      hasSourceGroupDeadline: Boolean(initialValues?.groupDeadlineDate),
    }),
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
}

function getCourseDuplicationErrorMessage(
  t: TranslationFn,
  errorType: CourseDuplicationErrorType = 'generic'
) {
  if (errorType === 'access') {
    return t('manage.courseList.courseDuplicationNoAccess')
  }

  if (errorType === 'partial') {
    return t('manage.courseList.courseDuplicationPartialFailure')
  }

  return t('manage.courseList.courseDuplicationFailed')
}

function getCourseDuplicationInfoNotifications({
  values,
  t,
}: {
  values: CourseDuplicationFormData
  t: TranslationFn
}) {
  const notifications: string[] = []

  if (values.isGamificationEnabled) {
    notifications.push(
      values.isGroupCreationEnabled
        ? t('manage.courseList.gamificationGroupsFixed')
        : t('manage.courseList.gamificationFixed')
    )
  }

  if (values.copyMicroLearnings) {
    notifications.push(
      t('manage.courseList.changeAvailabilityDateMicrolearnings')
    )
  }

  if (values.copyGroupActivities) {
    notifications.push(
      t('manage.courseList.changeAvailabilityDateGroupActivities')
    )
  }

  return notifications
}

function getCourseDuplicationWarningNotifications({
  initialValues,
  values,
  groupDeadlineDateInit,
  t,
}: {
  initialValues?: Course
  values: CourseDuplicationFormData
  groupDeadlineDateInit: Date
  t: TranslationFn
}) {
  const warnings: string[] = []

  if (
    initialValues?.groupDeadlineDate &&
    !dayjs(values.groupCreationDeadline).isSame(dayjs(groupDeadlineDateInit)) &&
    dayjs(values.groupCreationDeadline).isBefore(dayjs())
  ) {
    warnings.push(t('manage.courseList.groupDeadlineChangedToPast'))
  }

  if (dayjs(values.endDate).isBefore(dayjs())) {
    warnings.push(t('manage.courseList.courseDuplicationEndDateInPast'))
  }

  return warnings
}

function FormikNativeDateInput({
  name,
  label,
  tooltip,
  required = false,
  data,
  onDateChange,
}: {
  name: keyof Pick<
    CourseDuplicationFormData,
    'startDate' | 'endDate' | 'groupCreationDeadline'
  >
  label: string
  tooltip?: string
  required?: boolean
  data?: FormikNativeInputData
  onDateChange?: (date?: Date) => Promise<void> | void
}) {
  const [field, meta, helpers] = useField<Date | undefined>(name)
  const inputId = useId()
  const showError = Boolean(meta.error && meta.touched)

  return (
    <div className="flex w-[280px] flex-col">
      <FormLabel
        id={inputId}
        required={required}
        label={label}
        labelType="small"
        tooltip={tooltip}
      />
      <input
        id={inputId}
        className="border-input focus:border-primary-80 w-36 rounded-md border px-3 py-2 text-base"
        data-cy={data?.cy}
        data-test={data?.test}
        name={field.name}
        onBlur={() => helpers.setTouched(true)}
        onChange={async (e) => {
          const date = getNativeDateInputDate(e.target.value)
          await helpers.setValue(date)
          await helpers.setTouched(true)
          await onDateChange?.(date)
        }}
        type="date"
        value={getNativeDateInputValue(field.value)}
      />
      {showError && (
        <div className="mt-1 text-sm text-red-700">{meta.error}</div>
      )}
    </div>
  )
}

function FormikNativeColorInput({
  name,
  label,
  required = false,
  dataColor,
  dataHex,
}: {
  name: keyof Pick<CourseDuplicationFormData, 'color'>
  label: string
  required?: boolean
  dataColor?: FormikNativeInputData
  dataHex?: FormikNativeInputData
}) {
  const [field, meta, helpers] = useField<string>(name)
  const inputId = useId()
  const hexInputId = useId()
  const showError = Boolean(meta.error && meta.touched)
  const colorValue = isValidHexColor(field.value) ? field.value : '#000000'

  return (
    <div className="flex w-[280px] flex-col">
      <FormLabel
        id={inputId}
        required={required}
        label={label}
        labelType="small"
      />
      <div className="flex items-center gap-2">
        <input
          id={inputId}
          aria-label={label}
          className="border-input h-10 w-12 cursor-pointer rounded-md border bg-white p-1 disabled:cursor-not-allowed disabled:bg-gray-100"
          data-cy={dataColor?.cy}
          data-test={dataColor?.test}
          name={field.name}
          onBlur={() => helpers.setTouched(true)}
          onChange={async (e) => {
            await helpers.setValue(e.target.value)
            await helpers.setTouched(true)
          }}
          type="color"
          value={colorValue}
        />
        <input
          id={hexInputId}
          aria-label={`${label} hex`}
          className="border-input focus:border-primary-80 w-28 rounded-md border px-3 py-2 text-base"
          data-cy={dataHex?.cy}
          data-test={dataHex?.test}
          name={field.name}
          onBlur={() => helpers.setTouched(true)}
          onChange={async (e) => {
            await helpers.setValue(e.target.value)
            await helpers.setTouched(true)
          }}
          value={field.value ?? ''}
        />
      </div>
      {showError && (
        <div className="mt-1 text-sm text-red-700">{meta.error}</div>
      )}
    </div>
  )
}

function FormikNativeSelect({
  name,
  label,
  tooltip,
  items,
  required = false,
  data,
}: {
  name: keyof Pick<CourseDuplicationFormData, 'language'>
  label: string
  tooltip?: string
  items: { value: LocaleType; label: string }[]
  required?: boolean
  data?: FormikNativeInputData
}) {
  const [field, meta, helpers] = useField<LocaleType>(name)
  const inputId = useId()
  const showError = Boolean(meta.error && meta.touched)

  return (
    <div className="flex w-full flex-col">
      <FormLabel
        id={inputId}
        required={required}
        label={label}
        labelType="small"
        tooltip={tooltip}
      />
      <select
        id={inputId}
        className="border-input focus:border-primary-80 rounded-md border bg-white px-3 py-2 text-base"
        data-cy={data?.cy}
        data-test={data?.test}
        name={field.name}
        onBlur={() => helpers.setTouched(true)}
        onChange={async (e) => {
          await helpers.setValue(e.target.value as LocaleType)
          await helpers.setTouched(true)
        }}
        value={field.value}
      >
        {items.map((item) => (
          <option key={item.value} value={item.value}>
            {item.label}
          </option>
        ))}
      </select>
      {showError && (
        <div className="mt-1 text-sm text-red-700">{meta.error}</div>
      )}
    </div>
  )
}

function FormikNativeSwitch({
  name,
  label,
  tooltip,
  required = false,
  disabled = false,
  data,
  onCheckedChange,
}: {
  name: keyof Pick<
    CourseDuplicationFormData,
    | 'isGroupCreationEnabled'
    | 'copyLiveQuizzes'
    | 'copyPracticeQuizzes'
    | 'copyMicroLearnings'
    | 'copyGroupActivities'
  >
  label: string
  tooltip?: string
  required?: boolean
  disabled?: boolean
  data?: FormikNativeInputData
  onCheckedChange?: (checked: boolean) => Promise<void> | void
}) {
  const [field, meta, helpers] = useField<boolean>(name)
  const inputId = useId()
  const showError = Boolean(meta.error && meta.touched)
  const checked = Boolean(field.value)

  return (
    <div className="flex min-h-16 flex-col">
      <FormLabel
        id={inputId}
        required={required}
        label={label}
        labelType="small"
        tooltip={tooltip}
      />
      <input
        id={inputId}
        aria-label={label}
        checked={checked}
        className="border-input text-primary-80 mt-1 h-5 w-5 rounded border disabled:cursor-not-allowed disabled:bg-gray-100"
        data-cy={data?.cy}
        data-state={checked ? 'checked' : 'unchecked'}
        data-test={data?.test}
        disabled={disabled}
        name={field.name}
        onBlur={() => helpers.setTouched(true)}
        onChange={async (e) => {
          const checked = e.target.checked
          await helpers.setValue(checked)
          await helpers.setTouched(true)
          await onCheckedChange?.(checked)
        }}
        type="checkbox"
      />
      {showError && (
        <div className="mt-1 text-sm text-red-700">{meta.error}</div>
      )}
    </div>
  )
}

function CourseDuplicationModal({
  initialValues,
  onModalClose,
  onSubmit,
}: Readonly<CourseDuplicationModalProps>) {
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

  const schema = getCourseDuplicationSchema({
    t,
    initialValues,
    endDatePast: Boolean(endDatePast),
  })

  const {
    startDate: startDateInit,
    endDate: endDateInit,
    groupDeadlineDate: groupDeadlineDateDefault,
  } = getCourseDuplicationDateDefaults(initialValues)

  const groupDeadlineDateInit = useRef(groupDeadlineDateDefault).current

  const deltaCourseDates = dayjs(endDateInit).diff(dayjs(startDateInit), 'day')
  const courseDuration = getCourseDuplicationDurationParts(
    startDateInit,
    endDateInit
  )

  const deltaGroupCreationDeadline = dayjs(groupDeadlineDateInit).diff(
    dayjs(startDateInit),
    'day'
  )

  const nameCopy = getCourseDuplicationCopyName(t, initialValues?.name)
  const displayNameCopy = getCourseDuplicationCopyName(
    t,
    initialValues?.displayName
  )

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
          maxGroupSize: initialValues?.maxGroupSize ?? 5,
          preferredGroupSize: initialValues?.preferredGroupSize ?? 3,
          copyLiveQuizzes: true,
          copyPracticeQuizzes: true,
          copyMicroLearnings: true,
          copyGroupActivities: initialValues?.isGroupCreationEnabled ?? true,
        }}
        onSubmit={async (values, { setSubmitting }) =>
          onSubmit(values, setSubmitting, (errorType) =>
            toast({
              type: 'error',
              message: getCourseDuplicationErrorMessage(t, errorType),
              options: { duration: 6000 },
            })
          )
        }
        validationSchema={schema}
      >
        {({ values, isValid, isSubmitting, setFieldValue }) => {
          const infoNotifications = getCourseDuplicationInfoNotifications({
            values,
            t,
          })
          const warningNotifications = getCourseDuplicationWarningNotifications(
            {
              initialValues,
              values,
              groupDeadlineDateInit,
              t,
            }
          )
          const getGroupCreationDeadline = (startDate: Date) =>
            dayjs(startDate).add(deltaGroupCreationDeadline, 'day').toDate()

          const updateDatesFromStartDate = async (startDate?: Date) => {
            if (!startDate) return

            await setFieldValue(
              'endDate',
              dayjs(startDate).add(deltaCourseDates, 'day').toDate()
            )

            if (values.isGroupCreationEnabled) {
              await setFieldValue(
                'groupCreationDeadline',
                getGroupCreationDeadline(startDate)
              )
            }
          }

          const updateDatesFromEndDate = async (endDate?: Date) => {
            if (!endDate) return

            const startDate = dayjs(endDate)
              .subtract(deltaCourseDates, 'day')
              .toDate()

            await setFieldValue('startDate', startDate)
            await setFieldValue(
              'groupCreationDeadline',
              values.isGroupCreationEnabled
                ? getGroupCreationDeadline(startDate)
                : endDate
            )
          }

          const updateGroupCreation = async (isEnabled: boolean) => {
            if (isEnabled) {
              await setFieldValue(
                'groupCreationDeadline',
                getGroupCreationDeadline(values.startDate)
              )
            } else {
              await setFieldValue('copyGroupActivities', false)
              await setFieldValue('groupCreationDeadline', values.endDate)
            }

            await setFieldValue('maxGroupSize', values.maxGroupSize ?? 5)
            await setFieldValue(
              'preferredGroupSize',
              values.preferredGroupSize ?? 3
            )
          }

          return (
            <Form>
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
                    <FormikNativeDateInput
                      required
                      name="startDate"
                      label={t('manage.courseList.startDate')}
                      tooltip={t('manage.courseList.startDateTooltip')}
                      data={{ cy: 'course-start-date' }}
                      onDateChange={updateDatesFromStartDate}
                    />
                    <div className="flex flex-col">
                      <FormikNativeDateInput
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
                        data={{ cy: 'course-end-date' }}
                        onDateChange={updateDatesFromEndDate}
                      />
                      <span className="text-uzh-darkgreen-100 mt-1 w-full">
                        {t('manage.courseList.fixedDateInterval', {
                          years: courseDuration.years,
                          months: courseDuration.months,
                          days: courseDuration.days,
                        })}
                      </span>
                    </div>

                    <FormikNativeColorInput
                      required
                      name="color"
                      label={t('manage.courseList.courseColor')}
                      dataColor={{ cy: 'course-color-trigger' }}
                      dataHex={{ cy: 'course-color-hex-input' }}
                    />
                    <FormikNativeSelect
                      required
                      name="language"
                      label={t('shared.generic.language')}
                      tooltip={t('manage.courseList.languageTooltip')}
                      items={Object.values(LocaleType).map((locale) => ({
                        value: locale,
                        label: t(`shared.generic.${locale}`),
                      }))}
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
                      <FormikNativeSwitch
                        required
                        disabled={!values.isGamificationEnabled}
                        name="isGroupCreationEnabled"
                        label={t('manage.courseList.groupCreationEnabled')}
                        tooltip={
                          values.isGamificationEnabled
                            ? t('manage.courseList.groupCreationEnabledTooltip')
                            : t(
                                'manage.courseList.groupCreationDisabledTooltip'
                              )
                        }
                        data={{ cy: 'course-group-creation' }}
                        onCheckedChange={updateGroupCreation}
                      />
                    </div>
                    {values.isGamificationEnabled &&
                      values.isGroupCreationEnabled && (
                        <div className="flex flex-col gap-2 md:mt-3 md:grid md:grid-cols-3">
                          <div className="flex w-[280px] flex-col">
                            <FormLabel
                              id="course-duplication-group-deadline"
                              required
                              label={t(
                                'manage.courseList.groupCreationDeadline'
                              )}
                              labelType="small"
                              tooltip={
                                t(
                                  'manage.courseList.groupCreationDeadlineTooltip'
                                ) +
                                ' ' +
                                t(
                                  'manage.courseList.groupCreationDeadlineForCourseDuplicationTooltip'
                                )
                              }
                            />
                            <output
                              id="course-duplication-group-deadline"
                              aria-readonly="true"
                              className="border-input bg-uzh-grey-20 w-36 rounded-md border px-3 py-2 text-base text-gray-600"
                              data-cy="group-creation-deadline"
                            >
                              {dayjs(values.groupCreationDeadline).format(
                                'DD.MM.YYYY'
                              )}
                            </output>
                          </div>
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
                  <FormikNativeSwitch
                    required
                    name="copyLiveQuizzes"
                    label={t('shared.generic.liveQuizzes')}
                    tooltip={t('manage.courseList.copyLiveQuizzesTooltip')}
                    data={{ cy: 'course-live-quizzes' }}
                  />
                  <div className="md:col-span-2">
                    <FormikNativeSwitch
                      required
                      name="copyPracticeQuizzes"
                      label={t('shared.generic.practiceQuizzes')}
                      tooltip={t(
                        'manage.courseList.copyPracticeQuizzesTooltip'
                      )}
                      data={{ cy: 'course-practice-quizzes' }}
                    />
                  </div>
                  <FormikNativeSwitch
                    required
                    name="copyMicroLearnings"
                    label={t('shared.generic.microlearnings')}
                    tooltip={t('manage.courseList.copyMicroLearningsTooltip')}
                    data={{ cy: 'course-microlearnings' }}
                  />
                  <div className="md:col-span-2">
                    <FormikNativeSwitch
                      required
                      disabled={!values.isGroupCreationEnabled}
                      name="copyGroupActivities"
                      label={t('shared.generic.groupActivities')}
                      tooltip={t(
                        'manage.courseList.copyGroupActivitiesTooltip'
                      )}
                      data={{ cy: 'course-group-activities' }}
                    />
                  </div>
                </div>
              </div>
              {infoNotifications.length > 0 && (
                <UserNotification type="info" className={{ root: 'mt-2' }}>
                  <ul className="pl-3">
                    {infoNotifications.map((message) => (
                      <li className="list-disc" key={message}>
                        {message}
                      </li>
                    ))}
                  </ul>
                </UserNotification>
              )}

              {warningNotifications.length > 0 && (
                <UserNotification type="warning" className={{ root: 'mt-2' }}>
                  <ul className="pl-3">
                    {warningNotifications.map((message) => (
                      <li className="list-disc" key={message}>
                        {message}
                      </li>
                    ))}
                  </ul>
                </UserNotification>
              )}

              {isSubmitting && (
                <div className="mt-3 text-sm text-gray-600">
                  {t('manage.courseList.courseDuplicationInProgress')}
                </div>
              )}
              <button
                className="bg-primary-80 hover:bg-primary-100 float-right mt-3 rounded-md px-4 py-2 font-bold text-white disabled:cursor-not-allowed disabled:bg-gray-300 disabled:text-gray-600"
                data-cy="manipulate-course-submit"
                disabled={!isValid || isSubmitting}
                type="submit"
              >
                {isSubmitting
                  ? t('manage.courseList.courseDuplicationInProgress')
                  : t('shared.generic.duplicate')}
              </button>
            </Form>
          )
        }}
      </Formik>
    </Modal>
  )
}

export default CourseDuplicationModal
