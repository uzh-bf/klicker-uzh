import {
  Text,
  Container,
  Font,
  Head,
  Html,
  Img,
  Preview,
  Section,
  Tailwind,
  Column,
  Row,
  Markdown,
  Heading,
  Button,
  Link,
} from '@react-email/components'
import * as React from 'react'
import Layout from '../components/Layout.js'

export function MagicLinkRequested({ link = '[LINK]' }: { link: string }) {
  return (
    <Layout
      title="KlickerUZH - One-Time Login Requested"
      preview="KlickerUZH - Your One-Time Login Link"
    >
      <Section className="p-8 pt-0">
        <Heading className="font-semibold text-2xl pb-4">
          Your One-Time Login Link
        </Heading>
        <Text className="text-base">
          You have requested to log in to KlickerUZH PWA (Student Application).
          Please click on the following button to proceed:
        </Text>
        <Button
          className="bg-uzh-blue-100 rounded px-4 py-3 text-white"
          href={link}
        >
          Sign in to KlickerUZH
        </Button>
        <Text className="text-base">
          If the button does not work, please paste the following direct link
          into your browser: <Link href={link}>{link}</Link>.
        </Text>
        <Text className="text-base">
          To change your password after logging in with the login link, visit{' '}
          <Link href="https://pwa.klicker.uzh.ch/editProfile">
            https://pwa.klicker.uzh.ch/editProfile
          </Link>
          .
        </Text>
        <Text className="text-base">
          The link will be valid for the next 15 minutes. If you have not
          requested a login link, please ignore this email.
        </Text>
      </Section>
    </Layout>
  )
}

export default MagicLinkRequested
