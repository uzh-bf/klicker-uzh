import { useQuery } from '@apollo/client'
import { faCopy } from '@fortawesome/free-regular-svg-icons'
import {
  type Course,
  LocaleType,
  UserProfileDocument,
} from '@klicker-uzh/graphql/dist/ops'
import Loader from '@klicker-uzh/shared-components/src/Loader'
import {
  Button,
  FormikNumberField,
  FormikTextField,
  FormLabel,
  H3,
  Modal,
  toast,
  UserNotification,
} from '@uzh-bf/design-system'
import dayjs from 'dayjs'
import { Form, Formik, type FormikProps, useField } from 'formik'
import { useTranslations } from 'next-intl'
import { useId, useRef, useState } from 'react'
import { twMerge } from 'tailwind-merge'
import * as yup from 'yup'
import CourseInformationFields from './CourseInformationFields'

interface CourseDuplicationModalProps {
  initialValues?: Course
  isDuplicating: boolean
  onModalClose: () => void
  onSubmit: (
    values: CourseDuplicationFormData,
    onError: (errorType?: CourseDuplicationErrorType) => void
  ) => Promise<boolean>
}

export interface CourseDuplicationFormData {
  name: string
  displayName: string
  description: string
  color: string
  startDate?: Date
  endDate?: Date
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

interface CourseDuplicationProgressProps {
  className?: string
  surface?: boolean
}

export function CourseDuplicationProgress({
  className = '',
  surface = true,
}: Readonly<CourseDuplicationProgressProps>) {
  const t = useTranslations()

  return (
    <div
      className={twMerge(
        'flex max-w-md flex-col items-center gap-3 text-center',
        surface && 'rounded-md border border-gray-200 bg-white p-6 shadow-sm',
        className
      )}
    >
      <Loader basic data={{ cy: 'course-duplication-spinner' }} />
      <div className="font-bold text-gray-900">
        {t('manage.courseList.courseDuplicationInProgress')}
      </div>
      <p className="text-sm text-gray-600">
        {t('manage.courseList.courseDuplicationBackgroundInfo')}
      </p>
    </div>
  )
}

export type CourseDuplicationErrorType =
  | 'access'
  | 'generic'
  | 'invalidDates'
  | 'inProgress'
  | 'partial'

type CourseDuplicationTranslationKey =
  | 'manage.courseList.changeAvailabilityDateGroupActivities'
  | 'manage.courseList.changeAvailabilityDateMicrolearnings'
  | 'manage.courseList.courseColorReq'
  | 'manage.courseList.courseCopySuffix'
  | 'manage.courseList.courseDisplayNameReq'
  | 'manage.courseList.courseDuplicationAlreadyInProgress'
  | 'manage.courseList.courseDuplicationEndDateInPast'
  | 'manage.courseList.courseDuplicationDatesRequired'
  | 'manage.courseList.courseDuplicationFailed'
  | 'manage.courseList.courseDuplicationBackgroundInfo'
  | 'manage.courseList.courseDuplicationNoAccess'
  | 'manage.courseList.courseDuplicationInProgress'
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
  const sourceStartDate = initialValues?.startDate
    ? dayjs(initialValues.startDate).local().toDate()
    : defaultStartDate
  const sourceEndDate = initialValues?.endDate
    ? dayjs(initialValues.endDate).local().toDate()
    : defaultEndDate
  const groupDeadlineDate = initialValues?.groupDeadlineDate
    ? dayjs(initialValues.groupDeadlineDate).local().toDate()
    : sourceEndDate

  return {
    startDate: initialValues ? undefined : sourceStartDate,
    endDate: initialValues ? undefined : sourceEndDate,
    sourceStartDate,
    sourceEndDate,
    groupDeadlineDate,
  }
}

function getCourseDuplicationDurationParts(startDate: Date, endDate: Date) {
  const start = dayjs(startDate).startOf('day')
  const end = dayjs(endDate).startOf('day')
  const years = end.diff(start, 'year')
  const afterYears = start.add(years, 'year')
  const months = end.diff(afterYears, 'month')
  const afterMonths = afterYears.add(months, 'month')
  const days = getCalendarDayDelta(end.toDate(), afterMonths.toDate())

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

function getCalendarDayDelta(laterDate: Date, earlierDate: Date) {
  const laterDateUTC = Date.UTC(
    laterDate.getFullYear(),
    laterDate.getMonth(),
    laterDate.getDate()
  )
  const earlierDateUTC = Date.UTC(
    earlierDate.getFullYear(),
    earlierDate.getMonth(),
    earlierDate.getDate()
  )

  return Math.round((laterDateUTC - earlierDateUTC) / (24 * 60 * 60 * 1000))
}

function isValidHexColor(value?: string) {
  return Boolean(value?.match(/^#[\da-f]{6}$/i))
}

function getCourseDuplicationEndDateSchema(t: TranslationFn) {
  return yup
    .date()
    .test('checkDateInPast', t('manage.courseList.endDateFuture'), (d) => {
      return !!(d && d > new Date())
    })
    .when('startDate', ([startDate], schema) =>
      startDate
        ? schema.min(startDate, t('manage.courseList.endAfterStart'))
        : schema
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
}: {
  t: TranslationFn
  initialValues?: Course
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
    endDate: getCourseDuplicationEndDateSchema(t),
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

export function getCourseDuplicationErrorMessage(
  t: TranslationFn,
  errorType: CourseDuplicationErrorType = 'generic'
) {
  if (errorType === 'access') {
    return t('manage.courseList.courseDuplicationNoAccess')
  }

  if (errorType === 'partial') {
    return t('manage.courseList.courseDuplicationPartialFailure')
  }

  if (errorType === 'inProgress') {
    return t('manage.courseList.courseDuplicationAlreadyInProgress')
  }

  if (errorType === 'invalidDates') {
    return t('manage.courseList.courseDuplicationDatesRequired')
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

  if (values.endDate && dayjs(values.endDate).isBefore(dayjs())) {
    warnings.push(t('manage.courseList.courseDuplicationEndDateInPast'))
  }

  return warnings
}

function FormikNativeDateInput({
  name,
  label,
  tooltip,
  required = false,
  disabled = false,
  data,
  onDateChange,
}: Readonly<{
  name: keyof Pick<
    CourseDuplicationFormData,
    'startDate' | 'endDate' | 'groupCreationDeadline'
  >
  label: string
  tooltip?: string
  required?: boolean
  disabled?: boolean
  data?: FormikNativeInputData
  onDateChange?: (date?: Date) => Promise<void> | void
}>) {
  const [field, meta, helpers] = useField<Date | undefined>(name)
  const inputId = useId()
  const errorId = `${inputId}-error`
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
        aria-describedby={showError ? errorId : undefined}
        aria-invalid={showError}
        className="border-input focus:border-primary-80 w-36 rounded-md border px-3 py-2 text-base disabled:cursor-not-allowed disabled:bg-gray-100"
        data-cy={data?.cy}
        data-test={data?.test}
        disabled={disabled}
        name={field.name}
        onBlur={() => helpers.setTouched(true)}
        onChange={async (e) => {
          const date = getNativeDateInputDate(e.target.value)
          await helpers.setValue(date, !onDateChange)
          await helpers.setTouched(true, false)
          await onDateChange?.(date)
        }}
        required={required}
        type="date"
        value={getNativeDateInputValue(field.value)}
      />
      {showError && (
        <div id={errorId} className="mt-1 text-sm text-red-700">
          {meta.error}
        </div>
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
}: Readonly<{
  name: keyof Pick<CourseDuplicationFormData, 'color'>
  label: string
  required?: boolean
  dataColor?: FormikNativeInputData
  dataHex?: FormikNativeInputData
}>) {
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
}: Readonly<{
  name: keyof Pick<CourseDuplicationFormData, 'language'>
  label: string
  tooltip?: string
  items: { value: LocaleType; label: string }[]
  required?: boolean
  data?: FormikNativeInputData
}>) {
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
}: Readonly<{
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
}>) {
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
          await helpers.setValue(checked, !onCheckedChange)
          await helpers.setTouched(true, false)
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
  isDuplicating,
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

  const schema = getCourseDuplicationSchema({
    t,
    initialValues,
  })

  const {
    startDate: startDateInit,
    endDate: endDateInit,
    sourceStartDate,
    sourceEndDate,
    groupDeadlineDate: groupDeadlineDateDefault,
  } = getCourseDuplicationDateDefaults(initialValues)

  const [groupDeadlineDateInit] = useState(groupDeadlineDateDefault)

  const deltaCourseDates = getCalendarDayDelta(sourceEndDate, sourceStartDate)
  const courseDuration = getCourseDuplicationDurationParts(
    sourceStartDate,
    sourceEndDate
  )

  const deltaGroupCreationDeadline = getCalendarDayDelta(
    groupDeadlineDateInit,
    sourceStartDate
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
        onSubmit={async (values) => {
          let errorReported = false
          try {
            await onSubmit(values, (errorType) => {
              errorReported = true
              toast({
                type: 'error',
                message: getCourseDuplicationErrorMessage(t, errorType),
                options: { duration: 6000 },
              })
            })
          } catch (error) {
            if (!errorReported) {
              console.error(error)
              toast({
                type: 'error',
                message: getCourseDuplicationErrorMessage(t, 'generic'),
                options: { duration: 6000 },
              })
            }
          }
        }}
        validationSchema={schema}
      >
        {({ values, isValid, isSubmitting, setValues }) => {
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
            await setValues((currentValues) => {
              if (!startDate) {
                return {
                  ...currentValues,
                  startDate: undefined,
                  endDate: undefined,
                  groupCreationDeadline: groupDeadlineDateInit,
                }
              }

              const endDate = dayjs(startDate)
                .add(deltaCourseDates, 'day')
                .toDate()

              return {
                ...currentValues,
                startDate,
                endDate,
                groupCreationDeadline: currentValues.isGroupCreationEnabled
                  ? getGroupCreationDeadline(startDate)
                  : endDate,
              }
            })
          }

          const updateGroupCreation = async (isEnabled: boolean) => {
            await setValues((currentValues) => ({
              ...currentValues,
              isGroupCreationEnabled: isEnabled,
              copyGroupActivities: isEnabled
                ? currentValues.copyGroupActivities
                : false,
              groupCreationDeadline: isEnabled
                ? currentValues.startDate
                  ? getGroupCreationDeadline(currentValues.startDate)
                  : currentValues.groupCreationDeadline
                : (currentValues.endDate ?? groupDeadlineDateInit),
              maxGroupSize: currentValues.maxGroupSize ?? 5,
              preferredGroupSize: currentValues.preferredGroupSize ?? 3,
            }))
          }

          const formDisabled = isSubmitting || isDuplicating
          const submitDisabled =
            formDisabled || !values.startDate || !values.endDate

          return (
            <Form className="relative">
              {formDisabled && (
                <div
                  aria-live="polite"
                  className="absolute inset-0 z-10 flex items-center justify-center bg-white/90 px-4 text-center"
                  data-cy="course-duplication-modal-loading"
                  role="status"
                >
                  <CourseDuplicationProgress />
                </div>
              )}
              <fieldset disabled={formDisabled}>
                <div className="flex flex-col gap-2">
                  <CourseInformationFields />
                  <div className="mt-2 flex flex-col gap-6">
                    <div className="flex flex-col gap-2 md:grid md:grid-cols-3">
                      <FormikNativeDateInput
                        required
                        name="startDate"
                        label={t('manage.courseList.startDate')}
                        tooltip={t(
                          'manage.courseList.courseDuplicationStartDateTooltip'
                        )}
                        data={{ cy: 'course-start-date' }}
                        onDateChange={updateDatesFromStartDate}
                      />
                      <div className="flex flex-col">
                        <FormikNativeDateInput
                          required
                          name="endDate"
                          label={t('manage.courseList.endDate')}
                          tooltip={t(
                            'manage.courseList.courseDuplicationEndDateTooltip'
                          )}
                          disabled
                          data={{ cy: 'course-end-date' }}
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
                        tooltip={t(
                          'manage.courseList.notificationEmailTooltip'
                        )}
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
                              ? t(
                                  'manage.courseList.groupCreationEnabledTooltip'
                                )
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
                            <FormikNativeDateInput
                              required
                              name="groupCreationDeadline"
                              label={t(
                                'manage.courseList.groupCreationDeadline'
                              )}
                              tooltip={
                                t(
                                  'manage.courseList.groupCreationDeadlineTooltip'
                                ) +
                                ' ' +
                                t(
                                  'manage.courseList.groupCreationDeadlineForCourseDuplicationTooltip'
                                )
                              }
                              data={{ cy: 'group-creation-deadline' }}
                            />
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

                <Button
                  primary
                  className={{ root: 'float-right mt-3' }}
                  data={{ cy: 'manipulate-course-submit' }}
                  disabled={!isValid || submitDisabled}
                  loading={formDisabled}
                  type="submit"
                >
                  <Button.Icon icon={faCopy} loading={formDisabled} />
                  <Button.Label>{t('shared.generic.duplicate')}</Button.Label>
                </Button>
              </fieldset>
            </Form>
          )
        }}
      </Formik>
    </Modal>
  )
}

export default CourseDuplicationModal
