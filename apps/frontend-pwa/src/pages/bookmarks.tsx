import { useQuery } from '@apollo/client'
import { faRepeat } from '@fortawesome/free-solid-svg-icons'
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome'
import { GetBookmarkedQuestionsDocument } from '@klicker-uzh/graphql/dist/ops'
import { Button, H1 } from '@uzh-bf/design-system'
import Link from 'next/link'
import { twMerge } from 'tailwind-merge'
import Layout from '../components/Layout'

function Bookmarks() {
  const { data } = useQuery(GetBookmarkedQuestionsDocument)

  return (
    <Layout courseName="KlickerUZH" displayName="Kursübersicht">
      <div className="flex flex-col gap-2 md:w-full md:max-w-xl md:p-8 md:mx-auto md:border md:rounded">
        <H1 className={{ root: 'text-xl' }}>Kurse</H1>
        {data?.bookmarkedQuestions.map((question) => (
          <Link
            key={question.id}
            href={`/course/${question.courseId}/question/${question.id}`}
            legacyBehavior
          >
            <Button
              className={{
                root: twMerge(
                  'gap-6 px-4 py-2 text-lg shadow bg-uzh-grey-20 hover:bg-uzh-grey-40'
                ),
              }}
            >
              <Button.Icon>
                <FontAwesomeIcon icon={faRepeat} />
              </Button.Icon>
              <Button.Label className={{ root: 'flex-1 text-left' }}>
                <div>{question.displayName}</div>
              </Button.Label>
            </Button>
          </Link>
        ))}
      </div>
    </Layout>
  )
}

export default Bookmarks
