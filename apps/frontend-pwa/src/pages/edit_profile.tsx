import { useQuery } from '@apollo/client'
import Layout from '@components/Layout'
import { SelfDocument } from '@klicker-uzh/graphql/dist/ops'
import { NextPageWithLayout } from '@pages/_app'
import { H1, Button } from '@uzh-bf/design-system'
import { ThreeDots } from 'react-loader-spinner'
import { BigHead } from '@bigheads/core'
import Router from 'next/router'

const Edit_profile: NextPageWithLayout = () => {
  const { data, error, loading } = useQuery(SelfDocument)

  if (loading) {
    return (
      <div className="grid items-center justify-center">
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
      <H1>Profil Bearbeiten</H1>
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
    </div>
  )
}

Edit_profile.getLayout = function getLayout(page) {
  return <Layout>{page}</Layout>
}

export default Edit_profile