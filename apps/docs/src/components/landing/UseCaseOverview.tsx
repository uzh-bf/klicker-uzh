import { faArrowRight } from '@fortawesome/free-solid-svg-icons'
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome'
import { H2, H3, Prose } from '@uzh-bf/design-system'
import { USE_CASES } from '../../constants'

export function UseCaseOverview() {
  return (
    <div className="space-y-4">
      <H2 className={{ root: 'text-2xl' }}>Use Cases</H2>
      <div className="grid grid-cols-1 gap-4 rounded md:grid-cols-3">
        {Object.entries(USE_CASES).map(([href, item]) => (
          <div
            key={item.title}
            className="flex flex-col justify-between gap-4 p-4 shadow"
          >
            <div className="flex-1">
              <H3>{item.title}</H3>
              <Prose className={{ root: 'prose-sm' }}>{item.abstract}</Prose>
            </div>
            <div className="flex-none">
              <a
                className="inline-flex items-center gap-2"
                href={`/use_cases/${href}`}
              >
                <FontAwesomeIcon icon={faArrowRight} />
                <div>More Details</div>
              </a>
            </div>
          </div>
        ))}
      </div>
    </div>
  )
}

export default UseCaseOverview
