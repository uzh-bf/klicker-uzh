import { faRightFromBracket } from '@fortawesome/free-solid-svg-icons'
import { trpc } from '@lib/trpc'
import { Button, Select, toast } from '@uzh-bf/design-system'
import { useTranslations } from 'next-intl'
import { useRouter } from 'next/router'

interface HeaderProps {
  title: string
}

function Header({ title }: HeaderProps) {
  const t = useTranslations()
  const router = useRouter()
  const { pathname, asPath, query } = router
  const logoutUser = trpc.user.logout.useMutation()

  return (
    <div className="fixed top-0 flex h-11 w-full flex-row items-center justify-between bg-slate-800 px-2 text-white md:px-4">
      <div className="line-clamp-1 text-lg font-bold">{title}</div>
      <div className="flex flex-row">
        <Select
          basic
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
            trigger: 'h-max w-max text-white',
          }}
          data={{ cy: 'language-select' }}
        />
        <Button
          basic
          disabled={logoutUser.isLoading}
          loading={logoutUser.isLoading}
          onClick={async () => {
            try {
              const userIdLogout = await logoutUser.mutateAsync()
              if (userIdLogout) {
                await router.push('https://www.klicker.uzh.ch')
                return
              }
            } catch {
              // Toast below covers failed logout requests and false responses.
            }

            toast({
              type: 'error',
              message: t('shared.generic.systemError'),
              options: { duration: 5000 },
            })
          }}
          className={{
            root: 'px-auto my-auto text-white hover:bg-transparent hover:text-white',
          }}
          data={{ cy: 'logout-control-button' }}
        >
          <Button.Icon
            icon={faRightFromBracket}
            loading={logoutUser.isLoading}
          />
        </Button>
      </div>
    </div>
  )
}

export default Header
