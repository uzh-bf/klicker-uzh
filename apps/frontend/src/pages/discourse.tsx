import React, { useEffect } from 'react'
import { useRouter } from 'next/router'
import { useLazyQuery } from '@apollo/client'
import { Message } from 'semantic-ui-react'
import { push } from '@socialgouv/matomo-next'

import ValidateDiscourseLoginQuery from '../graphql/queries/ValidateDiscourseLoginQuery.graphql'

function Discourse(): React.ReactElement {
  const router = useRouter()

  const [validateDiscourseLogin, { data, error }] = useLazyQuery(ValidateDiscourseLoginQuery)

  useEffect(() => {
    if (!error && typeof data?.validateDiscourseLogin === 'string') {
      location.replace(data.validateDiscourseLogin)
    }
  }, [data, error])

  useEffect((): void => {
    console.log(router.query)
    validateDiscourseLogin({
      variables: {
        sso: router.query.sso,
        sig: router.query.sig,
      },
    })
  }, [router.query])

  if (error) {
    return <Message error>{error.message}</Message>
  }

  return null
}

export default Discourse
