import { useMutation } from '@apollo/client'
import { faRightFromBracket } from '@fortawesome/free-solid-svg-icons'
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome'
import { LogoutUserDocument } from '@klicker-uzh/graphql/dist/ops'
import { Button } from '@uzh-bf/design-system'
import { useRouter } from 'next/router'

interface HeaderProps {
  title: string
}

function Header({ title }: HeaderProps) {
  const router = useRouter()
  const [logoutUser] = useMutation(LogoutUserDocument)

  return (
    <div className="flex flex-row items-center justify-between px-2 text-white h-11 md:px-4 bg-slate-800">
      <div className="text-lg font-bold">{title}</div>
      <Button
        basic
        onClick={async () => {
          const userIdLogout = await logoutUser()
          // TODO: proper error handling
          userIdLogout.data?.logoutUser
            ? router.push('https://www.klicker.uzh.ch')
            : console.log('Logout failed')
        }}
      >
        <FontAwesomeIcon icon={faRightFromBracket} />
      </Button>
    </div>
  )
}

export default Header
