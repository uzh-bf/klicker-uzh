import { useMutation, useQuery } from '@apollo/client'
import Layout from '@components/Layout'
import { SelfDocument } from '@klicker-uzh/graphql/dist/ops'
import { NextPageWithLayout } from '@pages/_app'
import { H1, Button } from '@uzh-bf/design-system'
import { ThreeDots } from 'react-loader-spinner'
import { BigHead } from '@bigheads/core'
import Router from 'next/router'

const Profile = () => {
  const [pageInIframe, setPageInIframe] = useState(false)
  const { data, error, loading } = useQuery(SelfDocument)

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
      </div>
    )
  }

  return (
    <div>
      <H1>Profil</H1>
      <BigHead
        style={{ width: '400px', height: '400px'}}
        accessory="roundGlasses"
        body="breasts"
        circleColor="blue"
        clothing="vneck"
        clothingColor="blue"
        eyebrows="serious"
        eyes="leftTwitch"
        faceMask={false}
        faceMaskColor="green"
        facialHair="stubble"
        graphic="none"
        hair="balding"
        hairColor="blonde"
        hat="none"
        hatColor="white"
        lashes={false}
        lipColor="red"
        mask
        mouth="lips"
        skinTone="yellow"
      />
      <p className=''>{data?.self?.username}</p>
      <Button onClick={() => Router.push('/edit_profile')}>Bearbeiten</Button>
    </div>
  )
}

Profile.getLayout = function getLayout(page) {
  return <Layout>{page}</Layout>
}

export default Profile
