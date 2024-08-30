import { faShuffle } from '@fortawesome/free-solid-svg-icons'
import { useTranslations } from 'next-intl'
import GroupAction from './GroupAction'

function RandomGroupBlock() {
  const t = useTranslations()

  return (
    <GroupAction
      buttonMode
      title={t('pwa.courses.randomGroup')}
      icon={faShuffle}
      // TODO: replace this through mutation, adding the participant to the pool
      onClick={() => alert('Submitted')}
      explanation={t('pwa.courses.createJoinRandomGroup')}
      data={{ cy: 'enter-random-group-pool' }}
    />
  )
}

export default RandomGroupBlock
