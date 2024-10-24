import { Tabs, UserNotification } from '@uzh-bf/design-system'
import { useTranslations } from 'next-intl'

function GroupsLeaderboard() {
  const t = useTranslations()

  return (
    <Tabs.TabContent value="group-leaderboard" className={{ root: 'p-2' }}>
      <UserNotification type="info" message={t('shared.generic.comingSoon')} />
    </Tabs.TabContent>
  )
}

export default GroupsLeaderboard
