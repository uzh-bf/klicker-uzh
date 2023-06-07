import {
  faArrowLeftLong,
  faHouse,
  faPersonChalkboard,
} from '@fortawesome/free-solid-svg-icons'
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome'
import { useTranslations } from 'next-intl'
import { useRouter } from 'next/router'
import { useState } from 'react'
import EmbeddingModal from '../../components/sessions/EmbeddingModal'
import MenuButton from './MenuButton'

interface MobileMenuBarProps {
  sessionId?: string
}

function MobileMenuBar({ sessionId }: MobileMenuBarProps) {
  const t = useTranslations()
  const router = useRouter()
  const [embedModalOpen, setEmbedModalOpen] = useState<boolean>(false)

  return (
    <div className="fixed bottom-0 w-full h-12 bg-slate-800">
      <div className="flex flex-row justify-between h-full">
        <MenuButton
          icon={<FontAwesomeIcon icon={faArrowLeftLong} />}
          onClick={() => router.back()}
          data={{ cy: 'back-button' }}
        >
          {t('shared.generic.back')}
        </MenuButton>
        <MenuButton
          icon={<FontAwesomeIcon icon={faHouse} />}
          onClick={() => router.push('/')}
          data={{ cy: 'home-button' }}
        >
          {t('shared.generic.home')}
        </MenuButton>
        <MenuButton
          icon={<FontAwesomeIcon icon={faPersonChalkboard} />}
          onClick={() => setEmbedModalOpen(true)}
          disabled={!sessionId}
          data={{ cy: 'ppt-button' }}
        >
          PPT
        </MenuButton>
      </div>

      {sessionId && (
        <EmbeddingModal
          open={embedModalOpen}
          setOpen={setEmbedModalOpen}
          sessionId={sessionId}
        />
      )}
    </div>
  )
}

export default MobileMenuBar
