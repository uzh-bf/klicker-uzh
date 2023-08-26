import {
  faArrowRight,
  faChevronDown,
  faChevronRight,
} from '@fortawesome/free-solid-svg-icons'
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome'
import Layout from '@theme/Layout'
import { Button, H1, H2, H3 } from '@uzh-bf/design-system'
import { useState } from 'react'
import { useCollapse } from 'react-collapsed'
import { useCases } from './constants'

export default function index() {
  const [filteredUseCases, setFilteredUseCases] = useState(useCases)

  const filteredByTitle = (title) => {
    setFilteredUseCases(useCases.filter((useCase) => useCase.title === title))
  }

  return (
    <Layout>
      <div className="m-auto grid max-w-7xl grid-cols-5 items-start gap-4 p-4 pt-8">
        <div className="col-span-1 hidden rounded-xl border shadow md:grid">
          SIDEBAR
        </div>
        <div className="col-span-5 md:col-span-4">
          <div onClick={() => setFilteredUseCases(useCases)}>
            <H1>Use Cases</H1>
          </div>
          {filteredUseCases.map((useCase) => (
            <Card
              title={useCase.title}
              image={useCase.imageSrc}
              detailsRef={useCase.detailsRef}
            >
              {useCase.description}
            </Card>
          ))}
        </div>
      </div>
    </Layout>
  )
}

function Collapsible({ title, emoji, children }) {
  const { getCollapseProps, getToggleProps, isExpanded } = useCollapse()
  return (
    <div className="m-auto w-full max-w-6xl p-4 ">
      <div {...getToggleProps()} className="flex flex-row items-center gap-2 ">
        {isExpanded ? (
          <FontAwesomeIcon icon={faChevronDown} />
        ) : (
          <FontAwesomeIcon icon={faChevronRight} />
        )}
        <H2>{title}</H2>
        {emoji}
      </div>
      <hr className="m-0 h-1 rounded bg-black" />
      <section {...getCollapseProps()}>{children}</section>
    </div>
  )
}

function Card({ title, image, children, detailsRef }) {
  return (
    <div className="mt-4 flex max-h-80 flex-row rounded-xl bg-slate-100">
      <div className="flex flex-1 flex-col justify-center p-8 md:p-16">
        <H3 className={{ root: 'text-xl' }}>{title}</H3>
        <p className="font-sans text-lg">{children}</p>
        <div>
          <Button
            onClick={() => window.open(`/use_cases/${detailsRef}`, '_self')}
          >
            <>
              <FontAwesomeIcon icon={faArrowRight} />
              Read More
            </>
          </Button>
        </div>
      </div>
      <div className="relative hidden flex-1 items-center justify-items-center md:flex">
        <img className="h-full w-full rounded-r-xl object-cover" src={image} />
      </div>
    </div>
  )
}
