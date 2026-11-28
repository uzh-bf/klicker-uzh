import { useTranslations } from 'next-intl'

// Mastery indication of a reported level: mastered from the quiz's mastery
// mark of the level on, otherwise still being acquired. Only annotates the
// level; it never changes it.
function AdaptiveMasteryNote({
  mastered,
  levelLabel,
  nextLevelLabel,
  className,
}: {
  mastered: boolean
  levelLabel: string
  nextLevelLabel?: string | null
  className?: string
}) {
  const t = useTranslations('pwa.practiceQuiz.adaptive.mastery')
  return (
    <span
      className={`inline-block rounded px-2 py-0.5 text-xs font-medium ${
        mastered ? 'bg-green-100 text-green-900' : 'bg-amber-100 text-amber-900'
      } ${className ?? ''}`}
      data-cy={
        mastered ? 'adaptive-level-mastered' : 'adaptive-level-not-mastered'
      }
    >
      {mastered
        ? nextLevelLabel
          ? t('masteredNext', { level: levelLabel, next: nextLevelLabel })
          : t('mastered', { level: levelLabel })
        : t('notYetMastered', { level: levelLabel })}
    </span>
  )
}

export default AdaptiveMasteryNote
