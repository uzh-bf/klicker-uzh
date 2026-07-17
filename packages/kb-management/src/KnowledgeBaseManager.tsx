import { useQuery } from '@apollo/client'
import { UserProfileDocument } from '@klicker-uzh/graphql/dist/ops'
import { H2 } from '@uzh-bf/design-system'
import { useTranslations } from 'next-intl'
import React from 'react'

function KnowledgeBaseManager() {
  const t = useTranslations()
  const { data } = useQuery(UserProfileDocument)

  return (
    <div className="mx-auto w-full max-w-5xl">
      <H2>{t('kb.title')}</H2>
      {data?.userProfile?.email ? (
        <p className="mt-2 text-slate-600">
          {t('kb.signedInAs', {
            email: data.userProfile.email,
          })}
        </p>
      ) : null}
    </div>
  )
}

export default KnowledgeBaseManager
