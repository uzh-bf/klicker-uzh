import { useMutation } from '@apollo/client'
import {
  ChatbotStatus,
  CreditResetPeriod,
  MUpdateChatbotRevisionCreditPolicyDocument,
  QGetChatbotsInfoWithAuthoringRevisionsDocument,
} from '@klicker-uzh/graphql/dist/ops'
import {
  Button,
  FormikNumberField,
  FormikSelectField,
  UserNotification,
} from '@uzh-bf/design-system'
import { Form, Formik, useFormikContext } from 'formik'
import { useFormatter, useTranslations } from 'next-intl'
import { useCallback, useEffect, useState } from 'react'
import * as Yup from 'yup'
import {
  getChatbotMutationErrorKey,
  isChatbotRevisionConflict,
} from './chatbotErrorMessages'
import {
  FormikInitialValuesSynchronizer,
  getChatbotRevisionValues,
  getChatbotRevisionVersion,
  isChatbotRevisionEditable,
  isChatbotRevisionPending,
  type RevisionChatbot,
} from './chatbotRevision'
import type { ChatbotNavigationState } from './chatbotWorkspace'

const MAX_SIGNED_INT32 = 2_147_483_647
const creditPolicyEditableStatuses = [
  ChatbotStatus.Draft,
  ChatbotStatus.Rejected,
  ChatbotStatus.Published,
]

type CreditPolicyFormValues = {
  creditInitialCredits: string
  creditResetPeriod: CreditResetPeriod
  creditResetAmount: string
  creditMaxCredits: string
}

function nonNegativeInteger(value: string | number | null | undefined) {
  const normalizedValue = value?.toString().trim()
  if (!normalizedValue || !/^\d+$/.test(normalizedValue)) return false

  const parsedValue = Number(normalizedValue)
  return parsedValue >= 0 && parsedValue <= MAX_SIGNED_INT32
}

function positiveInteger(value: string | number | null | undefined) {
  return nonNegativeInteger(value) && Number(value) >= 1
}

function resetPeriodMessageKey(period: CreditResetPeriod) {
  switch (period) {
    case CreditResetPeriod.Daily:
      return 'manage.resources.creditResetPeriodDaily' as const
    case CreditResetPeriod.Weekly:
      return 'manage.resources.creditResetPeriodWeekly' as const
    case CreditResetPeriod.Biweekly:
      return 'manage.resources.creditResetPeriodBiweekly' as const
    case CreditResetPeriod.Monthly:
      return 'manage.resources.creditResetPeriodMonthly' as const
    case CreditResetPeriod.None:
      return 'manage.resources.creditResetPeriodNone' as const
  }
}

function ChatbotCreditPolicySummary({ chatbot }: { chatbot: RevisionChatbot }) {
  const t = useTranslations()
  const format = useFormatter()
  const revisionValues = getChatbotRevisionValues(chatbot)
  const formatCredits = (value: number) =>
    format.number(value, { maximumFractionDigits: 0 })

  return (
    <dl
      className="grid gap-3 text-sm sm:grid-cols-2"
      data-cy="chatbot-credit-policy-summary"
    >
      <div>
        <dt className="font-medium text-gray-600">
          {t('manage.resources.creditInitialCredits')}
        </dt>
        <dd className="mt-1 text-gray-900">
          {formatCredits(revisionValues.creditInitialCredits)}
        </dd>
      </div>
      <div>
        <dt className="font-medium text-gray-600">
          {t('manage.resources.creditResetPeriod')}
        </dt>
        <dd className="mt-1 text-gray-900">
          {t(resetPeriodMessageKey(revisionValues.creditResetPeriod))}
        </dd>
      </div>
      <div>
        <dt className="font-medium text-gray-600">
          {t('manage.resources.creditResetAmount')}
        </dt>
        <dd className="mt-1 text-gray-900">
          {formatCredits(revisionValues.creditResetAmount)}
        </dd>
      </div>
      <div>
        <dt className="font-medium text-gray-600">
          {t('manage.resources.creditMaxCredits')}
        </dt>
        <dd className="mt-1 text-gray-900">
          {formatCredits(revisionValues.creditMaxCredits)}
        </dd>
      </div>
    </dl>
  )
}

function CreditPolicyFormEffects({
  onChange,
  onDirty,
}: {
  onChange: (state: ChatbotNavigationState) => void
  onDirty: () => void
}) {
  const { dirty, isSubmitting, setFieldValue, values } =
    useFormikContext<CreditPolicyFormValues>()

  useEffect(() => {
    onChange({ dirty, pending: isSubmitting })
    if (dirty) onDirty()
  }, [dirty, isSubmitting, onChange, onDirty])

  useEffect(() => {
    if (
      values.creditResetPeriod === CreditResetPeriod.None &&
      values.creditResetAmount !== '0'
    ) {
      void setFieldValue('creditResetAmount', '0')
    }
  }, [setFieldValue, values.creditResetAmount, values.creditResetPeriod])

  useEffect(() => {
    return () => onChange({ dirty: false, pending: false })
  }, [onChange])

  return null
}

function ChatbotCreditPolicy({
  chatbot,
  publicationPending,
  onNavigationStateChange,
  onRevisionConflict,
  onSaved,
}: {
  chatbot: RevisionChatbot
  publicationPending: boolean
  onNavigationStateChange: (state: ChatbotNavigationState) => void
  onRevisionConflict?: () => void
  onSaved?: () => void
}) {
  const t = useTranslations()
  const [updateCreditPolicy] = useMutation(
    MUpdateChatbotRevisionCreditPolicyDocument
  )
  const [saveError, setSaveError] = useState<string | null>(null)
  const [saveSuccess, setSaveSuccess] = useState(false)
  const clearSaveSuccess = useCallback(() => setSaveSuccess(false), [])
  const editable = isChatbotRevisionEditable(chatbot)
  const revisionPending = isChatbotRevisionPending(chatbot)
  const formDisabled =
    !editable ||
    publicationPending ||
    revisionPending ||
    chatbot.status === ChatbotStatus.Paused

  useEffect(() => {
    if (!editable) {
      onNavigationStateChange({ dirty: false, pending: false })
    }
  }, [editable, onNavigationStateChange])

  const revisionValues = getChatbotRevisionValues(chatbot)
  const initialValues: CreditPolicyFormValues = {
    creditInitialCredits: revisionValues.creditInitialCredits.toString(),
    creditResetPeriod: revisionValues.creditResetPeriod,
    creditResetAmount: revisionValues.creditResetAmount.toString(),
    creditMaxCredits: revisionValues.creditMaxCredits.toString(),
  }

  return (
    <Formik
      validateOnMount
      initialValues={initialValues}
      validationSchema={Yup.object({
        creditInitialCredits: Yup.string()
          .required(t('manage.resources.chatbotCreditAmountRequired'))
          .test(
            'non-negative-integer',
            t('manage.resources.chatbotCreditAmountInvalid'),
            nonNegativeInteger
          ),
        creditResetPeriod: Yup.mixed<CreditResetPeriod>()
          .oneOf(Object.values(CreditResetPeriod))
          .required(t('manage.resources.chatbotCreditResetPeriodRequired')),
        creditResetAmount: Yup.string()
          .required(t('manage.resources.chatbotCreditAmountRequired'))
          .test(
            'valid-reset-amount',
            t('manage.resources.chatbotCreditResetAmountInvalid'),
            (value, context) =>
              context.parent.creditResetPeriod === CreditResetPeriod.None
                ? nonNegativeInteger(value)
                : positiveInteger(value)
          ),
        creditMaxCredits: Yup.string()
          .required(t('manage.resources.chatbotCreditAmountRequired'))
          .test(
            'non-negative-integer',
            t('manage.resources.chatbotCreditAmountInvalid'),
            nonNegativeInteger
          ),
      })
        .test('credit-policy-relations', (values, context) => {
          if (!values) return true

          const initial = Number(values.creditInitialCredits)
          const reset = Number(values.creditResetAmount)
          const maximum = Number(values.creditMaxCredits)
          if (initial > maximum) {
            return context.createError({
              path: 'creditInitialCredits',
              message: t('manage.resources.chatbotCreditInitialAboveMaximum'),
            })
          }
          if (reset > maximum) {
            return context.createError({
              path: 'creditResetAmount',
              message: t('manage.resources.chatbotCreditResetAboveMaximum'),
            })
          }
          return true
        })}
      onSubmit={async (values, { resetForm }) => {
        if (formDisabled) return

        setSaveError(null)
        setSaveSuccess(false)
        try {
          const result = await updateCreditPolicy({
            variables: {
              chatbotId: chatbot.id,
              expectedRevisionVersion: getChatbotRevisionVersion(chatbot),
              creditInitialCredits: Number(values.creditInitialCredits),
              creditResetPeriod: values.creditResetPeriod,
              creditResetAmount: Number(values.creditResetAmount),
              creditMaxCredits: Number(values.creditMaxCredits),
            },
            refetchQueries: [
              { query: QGetChatbotsInfoWithAuthoringRevisionsDocument },
            ],
            awaitRefetchQueries: true,
          })
          const saved = result.data?.updateChatbotRevisionCreditPolicy
          if (!saved) {
            throw new Error('Credit policy update returned no chatbot')
          }

          resetForm({
            values: {
              creditInitialCredits: values.creditInitialCredits,
              creditResetPeriod: values.creditResetPeriod,
              creditResetAmount: values.creditResetAmount,
              creditMaxCredits: values.creditMaxCredits,
            },
          })
          setSaveSuccess(true)
          onSaved?.()
        } catch (error) {
          if (isChatbotRevisionConflict(error)) onRevisionConflict?.()
          setSaveError(t(getChatbotMutationErrorKey(error, 'credits')))
        }
      }}
    >
      {({ isSubmitting, isValid, values }) => (
        <Form className="space-y-4" data-cy="chatbot-credit-policy-form">
          <FormikInitialValuesSynchronizer initialValues={initialValues} />
          <CreditPolicyFormEffects
            onChange={onNavigationStateChange}
            onDirty={clearSaveSuccess}
          />
          <p className="text-sm text-gray-600">
            {t('manage.resources.chatbotCreditPolicyDescription')}
          </p>
          <div className="grid gap-4 md:grid-cols-2">
            <FormikNumberField
              required
              min={0}
              max={MAX_SIGNED_INT32}
              precision={0}
              disabled={isSubmitting || formDisabled}
              name="creditInitialCredits"
              label={t('manage.resources.creditInitialCredits')}
              data={{ cy: 'chatbot-credit-initial' }}
            />
            <FormikSelectField
              required
              disabled={isSubmitting || formDisabled}
              name="creditResetPeriod"
              label={t('manage.resources.creditResetPeriod')}
              items={Object.values(CreditResetPeriod).map((period) => ({
                value: period,
                label: t(resetPeriodMessageKey(period)),
                data: { cy: `chatbot-credit-reset-period-${period}` },
              }))}
              data={{ cy: 'chatbot-credit-reset-period' }}
            />
            <FormikNumberField
              required
              min={values.creditResetPeriod === CreditResetPeriod.None ? 0 : 1}
              max={MAX_SIGNED_INT32}
              precision={0}
              disabled={
                isSubmitting ||
                formDisabled ||
                values.creditResetPeriod === CreditResetPeriod.None
              }
              name="creditResetAmount"
              label={t('manage.resources.creditResetAmount')}
              data={{ cy: 'chatbot-credit-reset-amount' }}
            />
            <FormikNumberField
              required
              min={0}
              max={MAX_SIGNED_INT32}
              precision={0}
              disabled={isSubmitting || formDisabled}
              name="creditMaxCredits"
              label={t('manage.resources.creditMaxCredits')}
              data={{ cy: 'chatbot-credit-maximum' }}
            />
          </div>
          {saveError ? (
            <div role="alert">
              <UserNotification type="error">{saveError}</UserNotification>
            </div>
          ) : null}
          <div className="flex flex-wrap items-center justify-end gap-3 border-t border-gray-200 pt-4">
            <Button
              primary
              type="submit"
              loading={isSubmitting}
              disabled={!isValid || isSubmitting || formDisabled}
              data={{ cy: 'save-chatbot-credit-policy' }}
            >
              <Button.Label>
                {t('manage.resources.chatbotSetupSave')}
              </Button.Label>
            </Button>
            {saveSuccess ? (
              <span
                className="text-sm text-green-700"
                role="status"
                aria-live="polite"
              >
                {t('manage.resources.chatbotCreditPolicySaveSuccess')}
              </span>
            ) : null}
          </div>
        </Form>
      )}
    </Formik>
  )
}

export { ChatbotCreditPolicySummary, creditPolicyEditableStatuses }
export default ChatbotCreditPolicy
