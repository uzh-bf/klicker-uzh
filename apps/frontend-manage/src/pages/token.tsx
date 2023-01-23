import { useMutation } from '@apollo/client'
import Layout from '@components/Layout'
import { GenerateLoginTokenDocument } from '@klicker-uzh/graphql/dist/ops'
import { Button, H2, ThemeContext } from '@uzh-bf/design-system'
import dayjs, { Dayjs } from 'dayjs'
import Link from 'next/link'
import { useContext, useState } from 'react'
import { twMerge } from 'tailwind-merge'
import Countdown from '../components/common/Countdown'

function TokenGeneration() {
  const theme = useContext(ThemeContext)

  const [tokenValid, setTokenValid] = useState(false)
  const [hadToken, setHadToken] = useState(false)
  const [token, setToken] = useState<string>('')
  const [endTime, setEndTime] = useState<Dayjs>(dayjs())

  const [generateLoginToken] = useMutation(GenerateLoginTokenDocument)

  // TODO: check if user has already a token and display it (useEffect hook)

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
              setToken(result.data?.generateLoginToken.loginToken)
              setEndTime(
                dayjs(result.data?.generateLoginToken.loginTokenExpiresAt)
              )
              setTokenValid(true)
              setHadToken(true)
            }
          }}
          className={{ root: twMerge(theme.primaryBgDark, 'text-white') }}
        >
          Token generieren!
        </Button>

        {/* // TODO: styling of token as notification */}
        {tokenValid && (
          <div>
            <div>
              Ihr Token lautet: <span className="font-bold">{token}</span>
            </div>
            Gültigkeit:{' '}
            <Countdown
              endTime={endTime}
              onExpire={() => {
                setTokenValid(false)
                alert('countdown expired')
              }}
            />
          </div>
        )}
        {hadToken && !tokenValid && (
          <div>Token abgelaufen! Neu generieren bitte!</div>
        )}
      </div>
    </Layout>
  )
}

export default TokenGeneration
