import { faArrowLeftLong, faHouse } from '@fortawesome/free-solid-svg-icons'
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome'
import { useRouter } from 'next/router'
import MenuButton from './MenuButton'

function MobileMenuBar() {
  const router = useRouter()

  return (
    <div className="fixed bottom-0 w-full h-12 bg-slate-800">
      <div className="flex flex-row justify-between h-full">
        <MenuButton
          icon={<FontAwesomeIcon icon={faArrowLeftLong} />}
          onClick={() => router.back()}
        >
          Zurück
        </MenuButton>
        <MenuButton
          icon={<FontAwesomeIcon icon={faHouse} />}
          onClick={() => router.push('/')}
        >
          Home
        </MenuButton>
      </div>
    </div>
  )
}

export default MobileMenuBar
