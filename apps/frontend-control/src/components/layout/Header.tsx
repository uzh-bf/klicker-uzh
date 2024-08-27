import { useMutation } from '@apollo/client'
import { faRightFromBracket } from '@fortawesome/free-solid-svg-icons'
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome'
import { LogoutUserDocument } from '@klicker-uzh/graphql/dist/ops'
import { Button, Select } from '@uzh-bf/design-system'
import { useRouter } from 'next/router'

interface HeaderProps {
  title: string
}

function Header({ title }: HeaderProps) {
  const router = useRouter()
  const { pathname, asPath, query } = router
  const [logoutUser] = useMutation(LogoutUserDocument)

  return (
    <div className="fixed top-0 flex h-11 w-full flex-row items-center justify-between bg-slate-800 px-2 text-white md:px-4">
      <div className="line-clamp-1 text-lg font-bold">{title}</div>
      <div className="flex flex-row gap-4">
        <Select
          value={router.locale}
          items={[
            { value: 'de', label: 'DE', data: { cy: 'language-de' } },
            { value: 'en', label: 'EN', data: { cy: 'language-en' } },
          ]}
          onChange={(newValue: string) =>
            router.push({ pathname, query }, asPath, {
              locale: newValue,
            })
          }
          className={{
            trigger:
              'rounded-none border-b border-solid p-0.5 pb-0 text-white hover:bg-transparent hover:text-white',
          }}
          data={{ cy: 'language-select' }}
          basic
        />
        <Button
          basic
          onClick={async () => {
            const userIdLogout = await logoutUser()
            // TODO: proper error handling
            userIdLogout.data?.logoutUser
              ? router.push('https://www.klicker.uzh.ch')
              : console.log('Logout failed')
          }}
          data={{ cy: 'logout-control-button' }}
        >
          <FontAwesomeIcon icon={faRightFromBracket} />
        </Button>
      </div>
    </div>
  )
}

export default Header
