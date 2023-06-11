import { useQuery } from '@apollo/client'
import FlashcardStack from '@components/flashcards/FlashcardStack'
import { faPlus } from '@fortawesome/free-solid-svg-icons'
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome'
import {
  Course,
  FlashcardSet,
  GetUserFlashcardSetsDocument,
} from '@klicker-uzh/graphql/dist/ops'
import { Button, H2 } from '@uzh-bf/design-system'
import Layout from '../../components/Layout'

function Flashcards() {
  const { data, loading, error } = useQuery(GetUserFlashcardSetsDocument)

  if (loading) return <div>Loading...</div>
  if (error) return <div>Error! {error.message}</div>

  // group flashcards by course
  const courseSets: { course: Partial<Course>; sets: FlashcardSet[] }[] =
    data?.userFlashcardSets?.reduce((acc, set) => {
      const course = set.course
      const courseIndex = acc.findIndex((c) => c.course.id === course?.id)

      if (courseIndex === -1) {
        acc.push({ course: course, sets: [set] })
      } else {
        acc[courseIndex].sets.push(set)
      }
      return acc
    }, []) || []

  console.log(courseSets)

  return (
    <Layout displayName="Flashcards">
      {courseSets.map((courseSet) => (
        <div key={courseSet.course.id} className="w-full">
          <div className="flex flex-row items-center justify-between gap-2 mb-1">
            <H2 className={{ root: 'mb-0' }}>
              {`Flashcards ${courseSet.course.name}`}
            </H2>
            <Button
              className={{ root: 'h-8' }}
              onClick={() => {
                // TODO
                return null
              }}
            >
              <FontAwesomeIcon icon={faPlus} />
              <div>Create new flashcard set</div>
            </Button>
          </div>
          <div className="flex flex-row gap-6 py-4 overflow-x-scroll">
            {courseSet.sets.map((set) => (
              <FlashcardStack flashcardSet={set} key={set.id} />
            ))}
          </div>
        </div>
      ))}
    </Layout>
  )
}

export default Flashcards
