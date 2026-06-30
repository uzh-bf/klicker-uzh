import { useTranslations } from 'next-intl'
import type { ActivityTemplate } from '../../../lib/constants/elementTypes'

function PracticeQuizTemplate({ template }: { template: ActivityTemplate }) {
  const t = useTranslations()

  return t('shared.generic.comingSoon')
}

export default PracticeQuizTemplate
