import { H2 } from '@uzh-bf/design-system'
import { useTranslations } from 'next-intl'
import CreateAddCollection from './answerCollections/CreateAddCollection'

function AnswerCollections() {
  const t = useTranslations()

  return (
    <div className="h-full w-full">
      <H2>{t('manage.resources.answerCollections')}</H2>
      <div className="mb-2">
        {t('manage.resources.answerCollectionsDescription')}
      </div>
      <CreateAddCollection />

      <div>LIST OF CREATED ANSWER COLLECTIONS</div>
      <div>LIST OF SHARED ANSWER COLLECTIONS</div>
    </div>
  )
}

export default AnswerCollections
