import { useRouter } from 'next/router'

function QuizAnalytics() {
  const router = useRouter()
  const activityId = router.query.id as string

  return null
}

export default QuizAnalytics
