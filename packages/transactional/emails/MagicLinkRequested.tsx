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
import tailwindConfig from './tailwind.config.js'

export function MagicLinkRequested({
  magicLink = '[MAGICLINK]',
}: {
  magicLink: string
}) {
  return (
    <Tailwind config={tailwindConfig}>
      <Html lang="en" className="bg-white">
        <Head>
          <title>KlickerUZH - One-Time Login Requested</title>
          <Font fontFamily="Source Sans 3" fallbackFontFamily="Verdana" />
        </Head>
        <Preview>KlickerUZH - Your One-Time Login Link</Preview>
        <Container>
          {/* <Section className="bg-gray-50 px-4 py-1 text-center text-sm text-slate-500"></Section> */}
          <Section className="p-8">
            <Row>
              <Column className="pr-4">
                <Img
                  src="https://www.klicker.uzh.ch/img_v3/uzhlogo_email.png"
                  className="w-40"
                />
              </Column>
              <Column className="pl-6 w-full border-gray-200 border-solid border-0 border-l-[1px]">
                <Text className="text-lg font-semibold">KlickerUZH</Text>
              </Column>
            </Row>
          </Section>
          <Section className="p-8 pt-0">
            <Heading className="font-semibold text-2xl pb-4">
              Your One-Time Login Link
            </Heading>
            <Text className="text-base">
              You have requested to log in to KlickerUZH PWA (Student
              Application). Please click on the following button to proceed:
            </Text>
            <Button
              className="bg-uzh-blue-100 rounded px-4 py-3 text-white"
              href={`https://pwa.klicker.uzh.ch/magicLogin?token=${magicLink}`}
            >
              Sign in to KlickerUZH
            </Button>
            <Text className="text-base">
              If the button does not work, please paste the following direct
              link into your browser:{' '}
              <Link
                href={`https://pwa.klicker.uzh.ch/magicLogin?token=${magicLink}`}
              >
                {`https://pwa.klicker.uzh.ch/magicLogin?token=${magicLink}`}
              </Link>
              .
            </Text>
            <Text className="text-base">
              To change your password after logging in with the login link,
              visit{' '}
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
          <Section className="px-8 py-2 bg-uzh-grey-20">
            <Row>
              <Column className="w-full">
                <Markdown markdownCustomStyles={{}}>
                  {`
**KlickerUZH**<br/>
Teaching Center<br/>
Deartment of Finance<br/>
Plattenstrasse 14<br/>
8032 Zürich

[www.klicker.uzh.ch](https://www.klicker.uzh.ch) - [community.klicker.uzh.ch](https://community.klicker.uzh.ch)

[Impressum](https://www.df.uzh.ch/de/impressum.html) - [Privacy Policy](https://www.klicker.uzh.ch/privacy_policy/)
            `}
                </Markdown>
              </Column>
              <Column className="w-42">
                <Img
                  className="h-12"
                  src="https://www.klicker.uzh.ch/img/KlickerLogo.png"
                />
              </Column>
            </Row>
          </Section>
        </Container>
      </Html>
    </Tailwind>
  )
}

export default MagicLinkRequested
