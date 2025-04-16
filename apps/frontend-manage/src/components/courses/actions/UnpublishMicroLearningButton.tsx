import { useMutation } from '@apollo/client'
import { faLock } from '@fortawesome/free-solid-svg-icons'
import {
  MicroLearning,
  UnpublishMicroLearningDocument,
} from '@klicker-uzh/graphql/dist/ops'
import { Button } from '@uzh-bf/design-system'
import { useTranslations } from 'next-intl'

interface UnpublishMicroLearningButtonProps {
  microLearning: Partial<MicroLearning> & Pick<MicroLearning, 'id' | 'name'>
}

function UnpublishMicroLearningButton({
  microLearning,
}: UnpublishMicroLearningButtonProps) {
  const t = useTranslations()
  const [unpublishMicrolearning, { loading: unpublishing }] = useMutation(
    UnpublishMicroLearningDocument,
    {
      variables: { id: microLearning.id, deleteResponses: false },
    }
  )

  return (
    <Button
      basic
      loading={unpublishing}
      className={{ root: 'text-primary-100' }}
      onClick={async () => await unpublishMicrolearning()}
      data={{ cy: `unpublish-microlearning-${microLearning.name}` }}
    >
      <Button.Icon icon={faLock} loading={unpublishing} />
      <Button.Label>{t('manage.course.unpublishMicroLearning')}</Button.Label>
    </Button>
  )
}

export default UnpublishMicroLearningButton
