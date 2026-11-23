import { Heading, Section, Text } from 'react-email'
import Layout from '../components/Layout.js'

// Placeholders in [BRACKETS] are filled (HTML-escaped) by
// packages/graphql/src/services/videoSourceApproval.ts.
export function VideoSourceApprovalGranted({
  recipientName = '[RECIPIENT_NAME]',
  approverName = '[APPROVER_NAME]',
  course = '[COURSE]',
  semester = '[SEMESTER]',
  source = '[SOURCE]',
}: {
  recipientName?: string
  approverName?: string
  course?: string
  semester?: string
  source?: string
}) {
  return (
    <Layout
      title="KlickerUZH - Lecture recordings approved"
      preview={`${approverName} approved the use of lecture recordings of ${course}`}
    >
      <Section className="p-8 pt-0">
        <Heading className="pb-4 text-2xl font-semibold">
          Lecture recordings approved
        </Heading>
        <Text className="text-base">Dear {recipientName}</Text>
        <Text className="text-base">
          <strong>{approverName}</strong> approved that KlickerUZH processes the
          edited lecture recordings of <strong>{course}</strong> in {semester} (
          {source}) for the course chatbot.
        </Text>
        <Text className="text-base">
          You do not need to do anything. If you disagree, the link in the
          original request email lets you revoke the approval at any time;
          KlickerUZH then stops processing and removes everything it created
          from these recordings.
        </Text>
      </Section>
    </Layout>
  )
}

export default VideoSourceApprovalGranted
