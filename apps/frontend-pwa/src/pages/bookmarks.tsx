import { useQuery } from '@apollo/client'
import { faBookmark } from '@fortawesome/free-regular-svg-icons'
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome'
import { GetParticipantCoursesDocument } from '@klicker-uzh/graphql/dist/ops'
import { Button, H1 } from '@uzh-bf/design-system'
import Link from 'next/link'
import { twMerge } from 'tailwind-merge'
import Layout from '../components/Layout'

function Bookmarks() {
  const { data } = useQuery(GetParticipantCoursesDocument)

  return (
    <Layout courseName="KlickerUZH" displayName="Meine Bookmarks">
      <div className="flex flex-col gap-2 md:w-full md:max-w-xl md:p-8 md:mx-auto md:border md:rounded">
        <H1 className={{ root: 'text-xl' }}>Kurs auswählen</H1>
        {data?.participantCourses?.map((course) => (
          <Link
            key={course.id}
            href={`/course/${course.id}/bookmarks`}
            legacyBehavior
          >
            <Button
              className={{
                root: twMerge(
                  'gap-5 px-4 py-2 text-lg shadow bg-uzh-grey-20 hover:bg-uzh-grey-40'
                ),
              }}
            >
              <Button.Icon>
                <FontAwesomeIcon icon={faBookmark} />
              </Button.Icon>
              <Button.Label className={{ root: 'flex-1 text-left' }}>
                <div>{course.displayName}</div>
              </Button.Label>
            </Button>
          </Link>
        ))}
      </div>
    </Layout>
  )
}

export default Bookmarks
