import { UserNotification } from '@uzh-bf/design-system'
import { useTranslations } from 'next-intl'

function CatalystNotification() {
  const t = useTranslations()

  return (
    <UserNotification className={{ root: 'mr-3' }}>
      {t.rich('manage.general.catalystRequired', {
        link: () => (
          <a
            target="_blank"
            href="https://www.klicker.uzh.ch/catalyst"
            className="underline"
          >
            www.klicker.uzh.ch/catalyst
          </a>
        ),
      })}
    </UserNotification>
  )
}

export default CatalystNotification
