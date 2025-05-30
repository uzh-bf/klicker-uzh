import { TabContent, UserNotification } from '@uzh-bf/design-system'
import { useTranslations } from 'next-intl'

function GroupsLeaderboard() {
  const t = useTranslations()

  return (
    <TabContent value="group-leaderboard" className={{ root: 'p-2' }}>
      <UserNotification type="info" message={t('shared.generic.comingSoon')} />
    </TabContent>
  )
}

export default GroupsLeaderboard
