import { faGithub } from '@fortawesome/free-brands-svg-icons'
import {
  faChalkboardUser,
  faGamepad,
  faLock,
  faUser,
} from '@fortawesome/free-solid-svg-icons'
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome'
import { Button } from '@uzh-bf/design-system'

function SellingPoints() {
  const data = [
    {
      title: 'Easy to Use',
      icon: faChalkboardUser,
      href: '/getting_started/welcome',
    },
    {
      title: 'Gamification',
      icon: faGamepad,
      href: '/use_cases/gamification',
    },
    // TODO: maybe we should also create a nice page, illustrating how we cover privacy - beyond the privacy notice
    { title: 'Privacy by Design', icon: faLock },
    // TODO: maybe we should create a page that explains the different permission levels / similar to the community
    { title: 'Free for Personal Use', icon: faUser },
    {
      title: 'Open Source',
      icon: faGithub,
      href: 'https://github.com/uzh-bf/klicker-uzh',
    },
  ]
  return (
    <div className="grid grid-cols-3 gap-2 md:grid-cols-5">
      {data.map((entry) => (
        <Button
          className={{
            root: 'hover:text-primary-80 bg-uzh-grey-20 flex cursor-pointer flex-col items-center justify-center rounded p-2 pt-4 hover:scale-[103%]',
          }}
          onClick={() => window.location.replace(entry.href)}
        >
          <FontAwesomeIcon icon={entry.icon} className="h-14 w-14" />
          <div className="text-lg font-bold">{entry.title}</div>
        </Button>
      ))}
    </div>
  )
}

export default SellingPoints
