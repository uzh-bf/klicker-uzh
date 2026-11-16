import { faArrowLeftLong, faHouse } from '@fortawesome/free-solid-svg-icons'
import { useTranslations } from 'next-intl'
import { useRouter } from 'next/router'
import MenuButton from './MenuButton'

function MobileMenuBar() {
  const t = useTranslations()
  const router = useRouter()

  return (
    <div className="fixed bottom-0 h-12 w-full bg-slate-800">
      <div className="flex h-full flex-row justify-between">
        <MenuButton
          icon={faArrowLeftLong}
          onClick={() => router.back()}
          data={{ cy: 'back-button' }}
        >
          {t('shared.generic.back')}
        </MenuButton>
        <MenuButton
          icon={faHouse}
          onClick={() => router.push('/')}
          data={{ cy: 'home-button' }}
        >
          {t('shared.generic.home')}
        </MenuButton>
      </div>
    </div>
  )
}

export default MobileMenuBar
