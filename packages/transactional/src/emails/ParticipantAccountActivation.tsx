import { Button, Heading, Link, Section, Text } from '@react-email/components'
import Layout from '../components/Layout.js'

export function ParticipantAccountActivation({
  link = '[LINK]',
}: {
  link: string
}) {
  return (
    <Layout
      title="KlickerUZH - Participant Account Activation"
      preview="KlickerUZH - Your Account Activation Link"
    >
      <Section className="p-8 pt-0">
        <Heading className="pb-4 text-2xl font-semibold">
          Activate Your Participant Account
        </Heading>
        <Text className="text-base">
          You have created a KlickerUZH participant account. Please click on the
          following button to activate your account:
        </Text>
        <Button
          className="bg-uzh-blue-100 rounded px-4 py-3 text-white"
          href={link}
        >
          Activate my account
        </Button>
        <Text className="text-base">
          If the button does not work, please paste the following direct link
          into your browser: <Link href={link}>{link}</Link>.
        </Text>
        <Text className="text-base">
          The link will be valid for the next 60 minutes. If you have not
          created a participant account on KlickerUZH, please ignore this email.
        </Text>
      </Section>
    </Layout>
  )
}

export default ParticipantAccountActivation
