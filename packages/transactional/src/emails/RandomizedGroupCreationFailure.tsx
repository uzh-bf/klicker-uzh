import { Button, Heading, Link, Section, Text } from '@react-email/components'
import Layout from '../components/Layout.js'

export function RandomizedGroupCreationFailure({
  courseName = '[COURSE_NAME]',
  linkCourseOverview = '[LINK]',
}: {
  courseName: string
  linkCourseOverview: string
}) {
  return (
    <Layout
      title="KlickerUZH - Participant Account Activation"
      preview="KlickerUZH - Your Account Activation Link"
    >
      <Section className="p-8 pt-0">
        <Heading className="pb-4 text-2xl font-semibold">
          Failure of Randomized Group Creation
        </Heading>
        <Text className="text-base">
          In your KlickerUZH course {courseName}, the randomized group creation
          has failed. At the specified group deadline, the system tried to
          automatically assign groups to all participants that chose this
          option. However, since only a single student is left in the random
          assignment pool or in a group by themselves, the system cannot create
          a group for them.
        </Text>
        <Text className="text-base">
          To resolve this issue, please extend the group creation deadline in
          the course settings on the overview page and ask the remaining
          participant to join a group manually.
        </Text>
        <Button
          className="bg-uzh-blue-100 rounded px-4 py-3 text-white"
          href={linkCourseOverview}
        >
          Course Overview
        </Button>
        <Text className="text-base">
          If the button does not work, please paste the following direct link
          into your browser:{' '}
          <Link href={linkCourseOverview} className="break-all">
            {linkCourseOverview}
          </Link>
          .
        </Text>
      </Section>
    </Layout>
  )
}

export default RandomizedGroupCreationFailure
