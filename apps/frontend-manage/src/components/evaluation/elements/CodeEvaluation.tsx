import type { CodeActivityEvaluationData } from '@klicker-uzh/graphql/dist/ops'
import { useTranslations } from 'next-intl'

interface CodeEvaluationProps {
  evaluation: CodeActivityEvaluationData
}

function CodeEvaluation({ evaluation }: CodeEvaluationProps) {
  const t = useTranslations()

  return (
    <div className="w-full overflow-auto p-4" data-cy="code-evaluation">
      <p className="mb-4 font-semibold">
        {t('manage.evaluation.codeTotalSubmissions', {
          number: evaluation.results.totalAnswers,
        })}
      </p>
      <table className="w-full border-collapse text-left">
        <thead>
          <tr className="border-b">
            <th className="px-3 py-2" scope="col">
              {t('manage.evaluation.codeTest')}
            </th>
            <th className="px-3 py-2 text-right" scope="col">
              {t('manage.evaluation.codePassedSubmissions')}
            </th>
            <th className="px-3 py-2 text-right" scope="col">
              {t('manage.evaluation.codeSubmissions')}
            </th>
          </tr>
        </thead>
        <tbody>
          {evaluation.results.testResults.map((testResult) => (
            <tr
              className="border-b last:border-b-0"
              key={testResult.id}
              data-cy={`code-evaluation-test-${testResult.id}`}
            >
              <td className="px-3 py-2">{testResult.name}</td>
              <td className="px-3 py-2 text-right">{testResult.passedCount}</td>
              <td className="px-3 py-2 text-right">{testResult.totalCount}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  )
}

export default CodeEvaluation
