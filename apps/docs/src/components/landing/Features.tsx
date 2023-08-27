import { faArrowRight } from '@fortawesome/free-solid-svg-icons'
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome'
import { Button, H3 } from '@uzh-bf/design-system'

function Features() {
  // TODO: fill content and fix links to something that makes sense where not yet done
  const features = [
    {
      title: 'Live Quiz',
      text: 'blablabla live sessions are cool',
      href: '/tutorials/live_quiz',
    },
    {
      title: 'Question and Session Management',
      text: 'PLACEHOLDER',
      href: '/tutorials/question_management',
    },
    {
      title: 'Courses',
      text: 'PLACEHOLDER',
      href: '/tutorials/course_management',
    },
    {
      title: 'PowerPoint Integration',
      text: 'PLACEHOLDER',
      href: '',
    },
    {
      title: 'Dedicated Presentation Modes',
      text: 'PLACEHOLDER',
      href: '',
    },
    {
      title: 'Gamified Elements',
      text: 'PLACEHOLDER - including leaderboard, awards, etc.',
      href: '',
    },
    {
      title: 'Student Profiles',
      text: 'PLACEHOLDER',
      href: '',
    },
    {
      title: 'Practice Quizzes',
      text: 'PLACEHOLDER',
      href: '',
    },
    {
      title: 'Learning Elements',
      text: 'PLACEHOLDER',
      href: '',
    },
  ]

  return (
    <div className="grid grid-cols-1 md:grid-cols-2 w-full gap-2">
      {features.map((feature) => (
        <Feature feature={feature} />
      ))}
    </div>
  )
}

function Feature({
  feature,
}: {
  feature: { title: string; text: string; href: string }
}) {
  return (
    <div className="border border-solid rounded p-3">
      <H3>{feature.title}</H3>
      <div>{feature.text}</div>
      <Button onClick={() => window.location.replace(feature.href)}>
        <FontAwesomeIcon icon={faArrowRight} />
        <div>Read more</div>
      </Button>
    </div>
  )
}

export default Features
