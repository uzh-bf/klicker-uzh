import { useFormatter, useTranslations } from 'next-intl'

function ItemParameters({
  elementId,
  difficulty,
  levelLabel,
  guessing,
}: {
  elementId: number
  difficulty?: number
  levelLabel?: string
  guessing: number
}) {
  const t = useTranslations('manage.competenceTree.itemParameters')
  const format = useFormatter()
  return (
    <details className="mt-2 text-xs text-slate-600">
      <summary
        className="cursor-pointer rounded focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2"
        data-cy={`competence-tree-item-parameters-${elementId}`}
      >
        {t('title')}
      </summary>
      <dl className="mt-2 space-y-2 rounded bg-slate-50 p-2">
        <div>
          <dt>{t('difficulty')}</dt>
          <dd className="font-semibold tabular-nums">
            {difficulty === undefined
              ? '—'
              : format.number(difficulty, { maximumFractionDigits: 2 })}
          </dd>
          <dd>
            {levelLabel
              ? t('difficultySource', { level: levelLabel })
              : t('missingLevel')}
          </dd>
        </div>
        <div>
          <dt>{t('guessing')}</dt>
          <dd className="font-semibold tabular-nums">
            {format.number(guessing, {
              style: 'percent',
              maximumFractionDigits: 2,
            })}
          </dd>
          <dd>{t('guessingSource')}</dd>
        </div>
      </dl>
      <p className="mt-2">{t('note')}</p>
    </details>
  )
}

export default ItemParameters
