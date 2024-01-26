import { faBookOpen } from '@fortawesome/free-solid-svg-icons'
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome'
import { ElementInstance } from '@klicker-uzh/graphql/dist/ops'
import DynamicMarkdown from 'src/components/learningElements/DynamicMarkdown'

interface ContentelementProps {
  element: ElementInstance
}

function ContentElement({ element }: ContentelementProps) {
  return (
    <div className="flex flex-row gap-3 px-3 py-2 border border-solid rounded-lg md:mx-5 bg-slate-100">
      <FontAwesomeIcon icon={faBookOpen} className="mt-1.5" />
      <DynamicMarkdown content={element.elementData.content} withProse />
    </div>
  )
}

export default ContentElement
