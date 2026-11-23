import { Button, Heading, Link, Section, Text } from 'react-email'
import Layout from '../components/Layout.js'

// Placeholders in [BRACKETS] are filled (HTML-escaped) by
// packages/graphql/src/services/videoSourceApproval.ts.
export function VideoSourceApprovalRequested({
  recipientName = '[RECIPIENT_NAME]',
  requesterName = '[REQUESTER_NAME]',
  requesterEmail = '[REQUESTER_EMAIL]',
  course = '[COURSE]',
  semester = '[SEMESTER]',
  source = '[SOURCE]',
  chatbots = '[CHATBOTS]',
  grantExpires = '[GRANT_EXPIRES]',
  link = '[LINK]',
}: {
  recipientName?: string
  requesterName?: string
  requesterEmail?: string
  course?: string
  semester?: string
  source?: string
  chatbots?: string
  grantExpires?: string
  link?: string
}) {
  return (
    <Layout
      title="KlickerUZH - Approval for lecture recordings requested"
      preview={`${requesterName} asks you to approve the use of lecture recordings in KlickerUZH`}
    >
      <Section className="p-8 pt-0">
        <Heading className="pb-4 text-2xl font-semibold">
          Approval requested: lecture recordings for the course chatbot
        </Heading>
        <Text className="text-base">Dear {recipientName}</Text>
        <Text className="text-base">
          <strong>{requesterName}</strong> (
          <Link href={`mailto:${requesterEmail}`}>{requesterEmail}</Link>) asks
          you, as a lecturer of <strong>{course}</strong> in {semester}, to
          approve that KlickerUZH processes the edited lecture recordings of
          this course ({source}) for {chatbots}.
        </Text>
        <Text className="text-base">
          The page behind the link shows which recordings are concerned, what is
          processed and by whom, and lets you approve or decline. Please sign in
          with your edu-ID there. One approval from a listed lecturer is enough;
          the others are informed.
        </Text>
        <Button
          className="bg-uzh-blue-100 rounded px-4 py-3 text-white"
          href={link}
        >
          Review and decide
        </Button>
        <Text className="text-base">
          If the button does not work, paste this link into your browser:{' '}
          <Link href={link} className="break-all">
            {link}
          </Link>
        </Text>
        <Text className="text-base">
          The link can approve until {grantExpires}. Keep this email: the same
          link lets you revoke the approval at any time, also after that date.
          KlickerUZH then stops processing and removes everything it created
          from these recordings.
        </Text>
        <Text className="text-base">
          Questions? Reply to this email to reach {requesterName}.
        </Text>
      </Section>
    </Layout>
  )
}

export default VideoSourceApprovalRequested
