import { useMutation, useQuery } from '@apollo/client'
import Layout from '@components/Layout'
import {
  GenerateLoginTokenDocument,
  GetLoginTokenDocument,
} from '@klicker-uzh/graphql/dist/ops'
import {
  Button,
  H2,
  ThemeContext,
  UserNotification,
} from '@uzh-bf/design-system'
import dayjs, { Dayjs } from 'dayjs'
import Link from 'next/link'
import { useContext, useEffect, useState } from 'react'
import { twMerge } from 'tailwind-merge'
import Countdown from '../components/common/Countdown'

function TokenGeneration() {
  const theme = useContext(ThemeContext)

  const [tokenValid, setTokenValid] = useState(false)
  const [hadToken, setHadToken] = useState(false)
  const [token, setToken] = useState<string>('')
  const [endTime, setEndTime] = useState<Dayjs>(dayjs())

  const [generateLoginToken] = useMutation(GenerateLoginTokenDocument)
  const { data: tokenData } = useQuery(GetLoginTokenDocument)

  useEffect(() => {
    if (
      tokenData?.getLoginToken &&
      dayjs(tokenData?.getLoginToken.loginTokenExpiresAt).isAfter(dayjs())
    ) {
      setToken(tokenData.getLoginToken?.loginToken)
      setEndTime(dayjs(tokenData.getLoginToken?.loginTokenExpiresAt))
      setTokenValid(true)
      setHadToken(true)
    }
  }, [tokenData])

  return (
    <Layout displayName="Token Generation">
      <div className="max-w-2xl mx-auto">
        <H2>Generation eines Login-Token</H2>
        <div className="mb-2">
          Auf dieser Seite können Sie einen Token zum Login bei der
          Controller-App{' '}
          <Link
            href={process.env.NEXT_PUBLIC_CONTROL_URL || ''}
            className={theme.primaryText}
          >
            {process.env.NEXT_PUBLIC_CONTROL_URL}
          </Link>{' '}
          generieren. Dieser Token hat eine Gültigkeit von 10 Minuten, kann
          allerdings jederzeit wieder neu generiert werden.
        </div>
        <Button
          onClick={async () => {
            const result = await generateLoginToken()
            if (result) {
              setToken(result.data?.generateLoginToken?.loginToken || '')
              setEndTime(
                dayjs(result.data?.generateLoginToken?.loginTokenExpiresAt)
              )
              setTokenValid(true)
              setHadToken(true)
            }
          }}
          className={{ root: twMerge(theme.primaryBgDark, 'text-white mb-3') }}
        >
          Token generieren!
        </Button>

        {tokenValid && (
          <UserNotification
            message={`Ihr Token lautet:`}
            className={{ root: 'text-base', content: 'mt-0' }}
            notificationType="success"
          >
            <div className="text-lg font-bold">
              {String(token)
                .match(/.{1,3}/g)
                ?.join(' ')}
            </div>
            <div className="mt-2">
              Verbleibende Gültigkeit:{' '}
              <Countdown
                endTime={endTime}
                onExpire={() => {
                  setTokenValid(false)
                }}
              />
            </div>
          </UserNotification>
        )}
        {hadToken && !tokenValid && (
          <UserNotification
            className={{ root: 'text-base' }}
            message="Ihr Token ist leider abgelaufen, bitte generieren Sie einen neuen."
            notificationType="error"
          />
        )}
      </div>
    </Layout>
  )
}

export default TokenGeneration
