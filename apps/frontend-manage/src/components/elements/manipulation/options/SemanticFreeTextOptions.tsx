import { useQuery } from '@apollo/client'
import {
  createSemanticFreeTextConfig,
  getSemanticFreeTextAdvancedMetadata,
} from '@klicker-uzh/grading'
import {
  SemanticFreeTextCapabilityAvailability,
  SemanticFreeTextCapabilityDocument,
} from '@klicker-uzh/graphql/dist/ops'
import {
  Accordion,
  AccordionContent,
  AccordionItem,
  AccordionTrigger,
  Button,
  FormikNumberField,
  FormikSelectField,
  FormikSwitchField,
  FormikTextareaField,
  FormikTextField,
  Switch,
  UserNotification,
} from '@uzh-bf/design-system'
import {
  FieldArray,
  type FieldArrayRenderProps,
  type FormikProps,
} from 'formik'
import { nanoid } from 'nanoid'
import { useRouter } from 'next/router'
import { useTranslations } from 'next-intl'
import { useState } from 'react'
import type { ElementFormTypesFreeText } from '../types'
import FreeTextOutcomeBandEditor from './FreeTextOutcomeBandEditor'
import FreeTextRubricEditor from './FreeTextRubricEditor'

function SemanticFreeTextOptions({
  values,
  inputsDisabled,
  setFieldValue,
}: {
  values: ElementFormTypesFreeText
  inputsDisabled?: boolean
  setFieldValue: FormikProps<ElementFormTypesFreeText>['setFieldValue']
}) {
  const t = useTranslations()
  const router = useRouter()
  const { data, loading, error } = useQuery(
    SemanticFreeTextCapabilityDocument,
    { fetchPolicy: 'cache-and-network' }
  )
  const capability = data?.semanticFreeTextCapability
  const config = values.options.semanticEvaluation
  const invalidStoredConfig =
    values.options.semanticEvaluationLoadError === true
  const entitled = capability?.entitled ?? false
  const capabilityUnknown = error != null
  const canEdit =
    !inputsDisabled &&
    !loading &&
    !capabilityUnknown &&
    entitled &&
    !invalidStoredConfig
  const canRemoveInvalidConfig =
    !inputsDisabled && !loading && !capabilityUnknown && entitled
  const advancedMetadata = config
    ? getSemanticFreeTextAdvancedMetadata(config.rubric_schema)
    : null
  const [exactAnswerKeys, setExactAnswerKeys] = useState(
    () => config?.accepted_exact_answers.map(() => nanoid()) ?? []
  )

  const setEnabled = (enabled: boolean) => {
    if (!canEdit) return

    if (enabled) {
      const language = router.locale === 'de' ? 'de' : 'en'
      const newConfig = createSemanticFreeTextConfig({
        language,
        legacySolutions: values.options.solutions ?? [],
      })
      setExactAnswerKeys(newConfig.accepted_exact_answers.map(() => nanoid()))
      setFieldValue('options.hasSampleSolution', true)
      setFieldValue('options.semanticEvaluation', newConfig)
      setFieldValue('options.semanticEvaluationLoadError', false)
      setFieldValue('options.preservedSemanticEvaluation', undefined)
    } else {
      setExactAnswerKeys([])
      setFieldValue(
        'options.hasSampleSolution',
        values.options.solutions?.some(
          (solution) => solution.trim().length > 0
        ) ?? false
      )
      setFieldValue('options.semanticEvaluation', undefined)
      setFieldValue('options.semanticEvaluationLoadError', false)
      setFieldValue('options.preservedSemanticEvaluation', undefined)
    }
  }

  const removeInvalidStoredConfig = () => {
    if (!canRemoveInvalidConfig) return

    setFieldValue(
      'options.hasSampleSolution',
      values.options.solutions?.some(
        (solution) => solution.trim().length > 0
      ) ?? false
    )
    setFieldValue('options.semanticEvaluation', undefined)
    setFieldValue('options.semanticEvaluationLoadError', false)
    setFieldValue('options.preservedSemanticEvaluation', undefined)
  }

  const availability = capability?.availability
  let availabilityMessage = t('manage.elements.semanticEvaluatorUnavailable')
  if (availability === SemanticFreeTextCapabilityAvailability.Available) {
    availabilityMessage = t('manage.elements.semanticEvaluatorAvailable')
  } else if (availability === SemanticFreeTextCapabilityAvailability.Degraded) {
    availabilityMessage = t('manage.elements.semanticEvaluatorDegraded')
  }

  let entitlementMessage = t('manage.elements.semanticNotEntitled')
  if (loading) {
    entitlementMessage = t('shared.generic.loading')
  } else if (capabilityUnknown) {
    entitlementMessage = t('shared.generic.systemError')
  } else if (entitled) {
    entitlementMessage = t('manage.elements.semanticEntitled')
  }

  return (
    <section
      className="mt-4 rounded-md border border-gray-300 bg-gray-50 p-3"
      data-cy="semantic-free-text-options"
    >
      <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
        <div>
          <h3 className="font-semibold">
            {t('manage.elements.semanticEvaluation')}
          </h3>
          <p className="max-w-3xl text-sm text-gray-600">
            {t('manage.elements.semanticEvaluationDescription')}
          </p>
        </div>
        <Switch
          checked={config != null}
          disabled={!canEdit}
          onCheckedChange={setEnabled}
          aria-label={t('manage.elements.semanticEvaluation')}
          data={{ cy: 'configure-semantic-free-text' }}
        />
      </div>

      <div className="mt-3 grid gap-2 sm:grid-cols-2">
        <div
          className="rounded border border-gray-200 bg-white p-2 text-sm"
          data-cy="semantic-entitlement-status"
        >
          <span className="font-semibold">
            {t('manage.elements.semanticEntitlement')}:{' '}
          </span>
          {entitlementMessage}
        </div>
        <div
          className="rounded border border-gray-200 bg-white p-2 text-sm"
          data-cy="semantic-availability-status"
        >
          <span className="font-semibold">
            {t('manage.elements.semanticEvaluator')}:{' '}
          </span>
          {error ? t('shared.generic.systemError') : availabilityMessage}
        </div>
      </div>

      {invalidStoredConfig && (
        <UserNotification type="error" className={{ root: 'mt-3' }}>
          <div className="flex flex-col items-start gap-2 sm:flex-row sm:items-center sm:justify-between">
            <span>{t('manage.elements.semanticStoredConfigInvalid')}</span>
            <Button
              destructive
              disabled={!canRemoveInvalidConfig}
              onClick={removeInvalidStoredConfig}
              data={{ cy: 'remove-invalid-semantic-config' }}
            >
              {t('shared.generic.delete')}
            </Button>
          </div>
        </UserNotification>
      )}

      {!loading && !capabilityUnknown && !entitled && (
        <UserNotification
          type="info"
          className={{ root: 'mt-3' }}
          message={
            config || invalidStoredConfig
              ? t('manage.elements.semanticReadOnlyWithoutEntitlement')
              : t('manage.elements.semanticCatalystRequired')
          }
        />
      )}
      {!capabilityUnknown &&
        entitled &&
        availability !== SemanticFreeTextCapabilityAvailability.Available && (
          <UserNotification
            type="warning"
            className={{ root: 'mt-3' }}
            message={t('manage.elements.semanticAvailabilityWarning')}
          />
        )}

      {config && (
        <div className="mt-4 flex flex-col gap-5" data-cy="semantic-editor">
          <div className="grid gap-3 md:grid-cols-3">
            <FormikSelectField
              required
              disabled={!canEdit}
              name="options.semanticEvaluation.question_language"
              label={t('manage.elements.semanticQuestionLanguage')}
              items={[
                { value: 'en', label: t('shared.generic.en') },
                { value: 'de', label: t('shared.generic.de') },
              ]}
              data={{ cy: 'semantic-question-language' }}
            />
            <FormikNumberField
              required
              disabled={!canEdit}
              name="options.semanticEvaluation.attempt_limit"
              label={t('manage.elements.semanticAttemptLimit')}
              min={1}
              max={10}
              precision={0}
              data={{ cy: 'semantic-attempt-limit' }}
            />
            <FormikSwitchField
              disabled={!canEdit}
              name="options.semanticEvaluation.solution_reveal_enabled"
              label={t('manage.elements.semanticSolutionReveal')}
              className={{
                root: 'items-start',
                element: 'mt-0.5 shrink-0',
                label: 'min-w-0 whitespace-normal',
              }}
              data={{ cy: 'semantic-solution-reveal' }}
            />
          </div>

          <section className="flex flex-col gap-2">
            <div>
              <h4 className="font-semibold">
                {t('manage.elements.semanticAcceptedExactAnswers')}
              </h4>
              <p className="text-sm text-gray-600">
                {t('manage.elements.semanticAcceptedExactAnswersDescription')}
              </p>
            </div>
            <FieldArray name="options.semanticEvaluation.accepted_exact_answers">
              {({ push, remove }: FieldArrayRenderProps) => (
                <div className="flex flex-col gap-2">
                  {config.accepted_exact_answers.map((_answer, index) => (
                    <div
                      key={exactAnswerKeys[index]!}
                      className="flex flex-col gap-2 sm:flex-row sm:items-end"
                    >
                      <FormikTextField
                        disabled={!canEdit}
                        name={`options.semanticEvaluation.accepted_exact_answers.${index}`}
                        label={t('manage.elements.semanticExactAnswerN', {
                          number: index + 1,
                        })}
                        data={{ cy: `semantic-exact-answer-${index}` }}
                      />
                      {canEdit && (
                        <Button
                          destructive
                          onClick={() => {
                            setExactAnswerKeys((keys) =>
                              keys.filter(
                                (_key, keyIndex) => keyIndex !== index
                              )
                            )
                            remove(index)
                          }}
                          data={{ cy: `semantic-delete-exact-answer-${index}` }}
                        >
                          {t('shared.generic.delete')}
                        </Button>
                      )}
                    </div>
                  ))}
                  {canEdit && (
                    <Button
                      onClick={() => {
                        setExactAnswerKeys((keys) => [...keys, nanoid()])
                        push('')
                      }}
                      data={{ cy: 'semantic-add-exact-answer' }}
                    >
                      {t('manage.elements.semanticAddExactAnswer')}
                    </Button>
                  )}
                </div>
              )}
            </FieldArray>
          </section>

          <FormikTextareaField
            required={config.solution_reveal_enabled}
            disabled={!canEdit}
            name="options.semanticEvaluation.reference_solution"
            label={t('manage.elements.semanticReferenceSolution')}
            rows="5"
            data={{ cy: 'semantic-reference-solution' }}
          />

          <section className="grid gap-3 md:grid-cols-3">
            <FormikTextField
              required
              disabled={!canEdit}
              name="options.semanticEvaluation.rubric_schema.schema_version"
              label={t('manage.elements.semanticSchemaVersion')}
              data={{ cy: 'semantic-schema-version' }}
            />
            <FormikTextField
              required
              disabled={!canEdit}
              name="options.semanticEvaluation.rubric_schema.name"
              label={t('manage.elements.semanticSchemaName')}
              data={{ cy: 'semantic-schema-name' }}
            />
            <div className="md:col-span-3">
              <FormikTextField
                required
                disabled={!canEdit}
                name="options.semanticEvaluation.rubric_schema.description"
                label={t('manage.elements.semanticSchemaDescription')}
                data={{ cy: 'semantic-schema-description' }}
              />
            </div>
          </section>

          <FreeTextRubricEditor values={values} disabled={!canEdit} />
          <FreeTextOutcomeBandEditor values={values} disabled={!canEdit} />

          <Accordion collapsible type="single" className="w-full">
            <AccordionItem value="advanced">
              <AccordionTrigger
                className="py-2 font-semibold"
                data-cy="semantic-open-advanced-metadata"
              >
                {t('manage.elements.semanticAdvancedMetadata')}
              </AccordionTrigger>
              <AccordionContent>
                <p className="mb-2 text-sm text-gray-600">
                  {t('manage.elements.semanticAdvancedMetadataDescription')}
                </p>
                <pre
                  className="max-h-64 overflow-auto rounded bg-gray-900 p-3 text-xs text-white"
                  data-cy="semantic-advanced-metadata"
                >
                  {JSON.stringify(advancedMetadata, null, 2)}
                </pre>
              </AccordionContent>
            </AccordionItem>
          </Accordion>
        </div>
      )}
    </section>
  )
}

export default SemanticFreeTextOptions
