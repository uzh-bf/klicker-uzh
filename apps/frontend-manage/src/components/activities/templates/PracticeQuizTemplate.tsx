import { ActivityTemplate } from '@klicker-uzh/graphql/dist/ops'
import { useTranslations } from 'next-intl'

function PracticeQuizTemplate({ template }: { template: ActivityTemplate }) {
  const t = useTranslations()

  return t('shared.generic.comingSoon')
}

export default PracticeQuizTemplate
