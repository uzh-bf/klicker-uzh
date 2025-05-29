import { TabsLegacy, UserNotification } from '@uzh-bf/design-system'
import { useTranslations } from 'next-intl'

function GroupsLeaderboard() {
  const t = useTranslations()

  return (
    <TabsLegacy.TabContent
      value="group-leaderboard"
      className={{ root: 'p-2' }}
    >
      <UserNotification type="info" message={t('shared.generic.comingSoon')} />
    </TabsLegacy.TabContent>
  )
}

export default GroupsLeaderboard
