import React, { useState } from 'react'
import { useRouter } from 'next/router'
import { Button, List, Input, Message } from 'semantic-ui-react'
import { push } from '@socialgouv/matomo-next'
import Image from 'next/image'
import KlickerLogoSrc from '../../../public/KlickerUZH_Gray_Transparent.png'
import { defineMessages, useIntl, FormattedMessage } from 'react-intl'
import Link from 'next/link'

import StaticLayout from '../../components/layouts/StaticLayout'

function Login(): React.ReactElement {
  const router = useRouter()

  return (
    // TODO: internationalization
    <StaticLayout pageTitle="Klicker">
      <div className="p-2">
        <div className="text-center">
          <Image alt="KlickerUZH Logo" src={KlickerLogoSrc} />
        </div>

        <p className="italic text-center">Welcome to the open source instant audience response system.</p>

        <Message info>
          <p>
            A new version of KlickerUZH (v3) has been released and is accessible through{' '}
            <a href="www.klicker.uzh.ch">www.klicker.uzh.ch</a>. This version (v2) of KlickerUZH has been discontinued.
            A data migration allows you to transfer all of your content from v2 to v3. More information on KlickerUZH v3
            can be found in our{' '}
            <a href="https://community.klicker.uzh.ch/t/klickeruzh-v3-0-release-information/79">community post</a>.
          </p>
        </Message>
      </div>
    </StaticLayout>
  )
}

export async function getStaticProps() {
  return {
    props: {},
  }
}

export default Login
