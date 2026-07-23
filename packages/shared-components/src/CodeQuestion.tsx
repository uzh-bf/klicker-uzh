import type { PublicCodeElementOptions } from '@klicker-uzh/graphql/dist/ops'
import { useTranslations } from 'next-intl'
import CodeEditor from './CodeEditor'
import QuestionContent from './QuestionContent'

interface CodeQuestionProps {
  content: string
  options: PublicCodeElementOptions
  response: string
  setResponse: (value: string) => void
  disabled?: boolean
  noPoints: boolean
}

function CodeQuestion({
  content,
  options,
  response,
  setResponse,
  disabled = false,
  noPoints,
}: CodeQuestionProps) {
  const t = useTranslations()

  return (
    <div>
      <QuestionContent content={content} noPoints={noPoints} />
      <div className="mb-3 text-sm">
        <span className="font-semibold">{t('shared.CODE.entrypoint')}:</span>{' '}
        <code>{options.entrypoint}</code>
      </div>
      <CodeEditor
        value={response}
        onChange={setResponse}
        disabled={disabled}
        ariaLabel={t('shared.CODE.responseEditor')}
        placeholder={t('shared.CODE.responsePlaceholder')}
        dataCy="code-response-editor"
      />
      {options.testCases.length > 0 && (
        <div className="mt-4">
          <div className="mb-2 font-semibold">
            {t('shared.CODE.publicTests')}
          </div>
          <div className="flex flex-col gap-2">
            {options.testCases.map((testCase) => (
              <div
                key={testCase.id}
                className="rounded border border-gray-200 bg-slate-50 p-2 text-sm"
              >
                <div className="font-medium">{testCase.name}</div>
                <div>
                  {t('shared.CODE.arguments')}:{' '}
                  <code>{JSON.stringify(testCase.args)}</code>
                </div>
                <div>
                  {t('shared.CODE.expectedOutput')}:{' '}
                  <code>{JSON.stringify(testCase.expectedOutput)}</code>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  )
}

export default CodeQuestion
