import { useMutation, useQuery } from '@apollo/client'
import {
  GenerateLoginTokenDocument,
  GetLoginTokenDocument,
} from '@klicker-uzh/graphql/dist/ops'
import { Button, H2, UserNotification } from '@uzh-bf/design-system'
import dayjs, { Dayjs } from 'dayjs'
import { useTranslations } from 'next-intl'
import Link from 'next/link'
import { useEffect, useState } from 'react'
import Layout from '../components/Layout'
import Countdown from '../components/common/Countdown'

function TokenGeneration() {
  const t = useTranslations()
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
      setToken(tokenData.getLoginToken?.loginToken || '')
      setEndTime(dayjs(tokenData.getLoginToken?.loginTokenExpiresAt))
      setTokenValid(true)
      setHadToken(true)
    }
  }, [tokenData])

  return (
    <Layout displayName={t('manage.token.pageName')}>
      <div className="max-w-2xl mx-auto">
        <H2>{t('manage.token.tokenGenerationTitle')}</H2>
        <div className="mb-2">
          {t.rich('manage.token.tokenGenerationExplanation', {
            link: (displayLink) => (
              <Link
                href={process.env.NEXT_PUBLIC_CONTROL_URL || ''}
                className="text-primary"
              >
                {displayLink}
              </Link>
            ),
            displayLink: process.env.NEXT_PUBLIC_CONTROL_URL,
          })}
        </div>
        <Button
          data={{ cy: 'generate-token' }}
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
          className={{ root: 'text-white mb-3 bg-primary-80' }}
        >
          {t('manage.token.generateToken')}
        </Button>

        {tokenValid && (
          <UserNotification
            message={t('manage.token.tokenTitle')}
            className={{ root: 'text-base', content: 'mt-0' }}
            type="success"
          >
            <div className="text-lg font-bold" data-cy="control-login-token">
              {String(token)
                .match(/.{1,3}/g)
                ?.join(' ')}
            </div>
            <div className="mt-2">
              {t('manage.token.remainingValidity')}{' '}
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
            message={t('manage.token.tokenExpired')}
            type="error"
          />
        )}
      </div>
    </Layout>
  )
}

export function getStaticProps({ locale }: any) {
  return {
    props: {
      messages: {
        ...require(`shared-components/src/intl-messages/${locale}.json`),
      },
    },
    revalidate: 600,
  }
}

export default TokenGeneration
