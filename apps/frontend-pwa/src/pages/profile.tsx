import { useMutation, useQuery } from '@apollo/client'
import Layout from '@components/Layout'
import {
  LogoutParticipantDocument,
  SelfDocument,
} from '@klicker-uzh/graphql/dist/ops'
import { Button } from '@uzh-bf/design-system'
import { useRouter } from 'next/router'
import { useEffect, useState } from 'react'
import { ThreeDots } from 'react-loader-spinner'

const Profile = () => {
  const [pageInIframe, setPageInIframe] = useState(false)
  const { data, error, loading } = useQuery(SelfDocument)
  const router = useRouter()
  const [logoutParticipant] = useMutation(LogoutParticipantDocument)

  // detect if the page is currently shown as an iframe (i.e. in OLAT) -> hide the logout button in this case
  useEffect(() => {
    if (window.location !== window.parent.location) {
      setPageInIframe(true)
    } else {
      setPageInIframe(false)
    }
  }, [])

  return (
    <Layout>
      {loading && (
        <ThreeDots
          height="80"
          width="80"
          radius="9"
          color="#4fa94d"
          ariaLabel="three-dots-loading"
          visible={true}
        />
      )}
      {!pageInIframe && data && data?.self && data.self.id && (
        <div className="p-4">
          <div>{data.self.id}</div>
          <Button
            onClick={async () => {
              const logoutResponse = await logoutParticipant({
                variables: { id: data?.self?.id || '' },
              })
              logoutResponse.data?.logoutParticipant &&
                router.push('https://www.klicker.uzh.ch')
            }}
          >
            Logout
          </Button>
        </div>
      )}
    </Layout>
  )
}

export default Profile
