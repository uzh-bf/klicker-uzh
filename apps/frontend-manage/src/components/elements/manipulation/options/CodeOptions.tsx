import { CodeTestVisibility } from '@klicker-uzh/graphql/dist/ops'
import CodeEditor from '@klicker-uzh/shared-components/src/CodeEditor'
import {
  Button,
  FormLabel,
  FormikNumberField,
  FormikSelectField,
  FormikTextField,
} from '@uzh-bf/design-system'
import { FieldArray, useField, useFormikContext } from 'formik'
import { nanoid } from 'nanoid'
import { useTranslations } from 'next-intl'
import { useEffect } from 'react'
import { ElementFormTypes, ElementFormTypesCode } from '../types'

interface FormikCodeEditorProps {
  name: string
  label: string
  ariaLabel: string
  disabled?: boolean
  required?: boolean
  language?: 'plain' | 'python'
  placeholder?: string
  minHeight?: string
  maxHeight?: string
  dataCy?: string
}

function FormikCodeEditor({
  name,
  label,
  ariaLabel,
  disabled,
  required = false,
  language = 'python',
  placeholder,
  minHeight,
  maxHeight,
  dataCy,
}: FormikCodeEditorProps) {
  const [field, meta, helpers] = useField<string>(name)

  return (
    <div className="w-full">
      <FormLabel label={label} labelType="small" required={required} />
      <CodeEditor
        value={field.value ?? ''}
        onChange={(value) => helpers.setValue(value)}
        onBlur={() => helpers.setTouched(true)}
        disabled={disabled}
        language={language}
        ariaLabel={ariaLabel}
        placeholder={placeholder}
        minHeight={minHeight}
        maxHeight={maxHeight}
        dataCy={dataCy}
      />
      {meta.touched && meta.error ? (
        <div className="mt-1 text-sm text-red-600">{meta.error}</div>
      ) : null}
    </div>
  )
}

function createCodeTest(name = '') {
  return {
    id: nanoid(),
    name,
    args: '[]',
    expectedOutput: 'null',
    visibility: CodeTestVisibility.Public,
    weight: '1',
  }
}

function createDefaultCodeOptions(
  hasSampleSolution: boolean,
  defaultTestName: string
): ElementFormTypesCode['options'] {
  return {
    starterCode: 'def solve():\n    pass',
    sampleSolution: '',
    entrypoint: 'solve',
    hasSampleSolution,
    testCases: [createCodeTest(defaultTestName)],
  }
}

function CodeOptions({
  inputsDisabled = false,
  values,
}: {
  inputsDisabled?: boolean
  values: ElementFormTypesCode
}) {
  const t = useTranslations()
  const { setFieldValue } = useFormikContext<ElementFormTypes>()
  const initialized = Array.isArray(values.options.testCases)

  useEffect(() => {
    if (initialized) return

    void setFieldValue(
      'options',
      {
        ...values.options,
        ...createDefaultCodeOptions(
          typeof values.options.hasSampleSolution === 'boolean'
            ? values.options.hasSampleSolution
            : false,
          t('manage.elements.codeDefaultTestName', { number: 1 })
        ),
      },
      true
    )
  }, [initialized, setFieldValue, t, values.options])

  if (!initialized) {
    return null
  }

  const visibilityOptions = [
    {
      value: CodeTestVisibility.Public,
      label: t('manage.elements.codeVisibilityPublic'),
    },
    {
      value: CodeTestVisibility.Hidden,
      label: t('manage.elements.codeVisibilityHidden'),
    },
  ]

  return (
    <div className="mt-3 flex flex-col gap-4" data-cy="code-options">
      <div>
        <FormLabel
          label={t('manage.elements.codeConfiguration')}
          labelType="large"
          required={false}
        />
        <div className="mt-2 max-w-sm">
          <FormikTextField
            required
            disabled={inputsDisabled}
            name="options.entrypoint"
            label={t('manage.elements.codeEntrypoint')}
            tooltip={t('manage.elements.codeEntrypointTooltip')}
            data={{ cy: 'code-entrypoint' }}
          />
        </div>
      </div>

      <FormikCodeEditor
        name="options.starterCode"
        label={t('manage.elements.codeStarterCode')}
        ariaLabel={t('manage.elements.codeStarterCode')}
        disabled={inputsDisabled}
        placeholder="def solve():"
        dataCy="code-starter-code"
      />

      {values.options.hasSampleSolution ? (
        <FormikCodeEditor
          name="options.sampleSolution"
          label={t('manage.elements.codeSampleSolution')}
          ariaLabel={t('manage.elements.codeSampleSolution')}
          disabled={inputsDisabled}
          required
          placeholder="def solve():"
          dataCy="code-sample-solution"
        />
      ) : null}

      <FieldArray name="options.testCases">
        {({ push, remove }) => (
          <div>
            <FormLabel
              label={t('manage.elements.codeTests')}
              labelType="large"
              required
            />
            <div className="mt-2 flex flex-col gap-3">
              {values.options.testCases.map((testCase, index) => (
                <div
                  key={testCase.id}
                  className="rounded border border-gray-300 bg-gray-50 p-3"
                  data-cy={`code-test-${index}`}
                >
                  <div className="grid grid-cols-1 gap-3 lg:grid-cols-[1fr_11rem_7rem]">
                    <FormikTextField
                      required
                      disabled={inputsDisabled}
                      name={`options.testCases.${index}.name`}
                      label={t('manage.elements.codeTestName')}
                      data={{ cy: `code-test-name-${index}` }}
                    />
                    <FormikSelectField
                      required
                      disabled={inputsDisabled}
                      name={`options.testCases.${index}.visibility`}
                      label={t('manage.elements.codeVisibility')}
                      items={visibilityOptions}
                      data={{ cy: `code-test-visibility-${index}` }}
                    />
                    <FormikNumberField
                      required
                      disabled={inputsDisabled}
                      min={0.01}
                      name={`options.testCases.${index}.weight`}
                      label={t('manage.elements.codeWeight')}
                      data={{ cy: `code-test-weight-${index}` }}
                    />
                  </div>

                  <div className="mt-3 grid grid-cols-1 gap-3 lg:grid-cols-2">
                    <FormikCodeEditor
                      name={`options.testCases.${index}.args`}
                      label={t('manage.elements.codeArguments')}
                      ariaLabel={`${t('manage.elements.codeArguments')} ${index + 1}`}
                      disabled={inputsDisabled}
                      required
                      language="plain"
                      placeholder="[]"
                      minHeight="72px"
                      maxHeight="160px"
                      dataCy={`code-test-args-${index}`}
                    />
                    <FormikCodeEditor
                      name={`options.testCases.${index}.expectedOutput`}
                      label={t('manage.elements.codeExpectedOutput')}
                      ariaLabel={`${t('manage.elements.codeExpectedOutput')} ${index + 1}`}
                      disabled={inputsDisabled}
                      required
                      language="plain"
                      placeholder="null"
                      minHeight="72px"
                      maxHeight="160px"
                      dataCy={`code-test-expected-output-${index}`}
                    />
                  </div>

                  {!inputsDisabled && values.options.testCases.length > 1 ? (
                    <Button
                      destructive
                      onClick={() => remove(index)}
                      className={{ root: 'mt-3' }}
                      data={{ cy: `remove-code-test-${index}` }}
                    >
                      {t('manage.elements.removeCodeTest')}
                    </Button>
                  ) : null}
                </div>
              ))}
            </div>

            {!inputsDisabled && values.options.testCases.length < 20 ? (
              <Button
                fluid
                onClick={() => push(createCodeTest())}
                className={{ root: 'mt-3 border-gray-300 font-bold' }}
                data={{ cy: 'add-code-test' }}
              >
                {t('manage.elements.addCodeTest')}
              </Button>
            ) : null}
          </div>
        )}
      </FieldArray>
    </div>
  )
}

export default CodeOptions
