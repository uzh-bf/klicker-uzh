import {
  faArrowRight,
  faChevronDown,
  faChevronRight,
} from '@fortawesome/free-solid-svg-icons'
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome'
import Layout from '@theme/Layout'
import { Button, H1, H2, H3 } from '@uzh-bf/design-system'
import { useCollapse } from 'react-collapsed'

export default function index() {
  const { getCollapseProps, getToggleProps, isExpanded } = useCollapse()

  return (
    <Layout>
      <div className="w-full p-4 shadow bg-slate-100">
        <H1 className={{ root: 'mx-auto max-w-6xl lg:pl-4' }}>Use Cases</H1>
      </div>

      <div className="w-full max-w-6xl p-4 m-auto ">
        <div
          {...getToggleProps()}
          className="flex flex-row items-center gap-2 "
        >
          {isExpanded ? (
            <FontAwesomeIcon icon={faChevronDown} />
          ) : (
            <FontAwesomeIcon icon={faChevronRight} />
          )}
          <H2>Strenghten Interaction</H2>
          {/* <FontAwesomeIcon icon={faPeopleGroup} /> */}
          🧠
        </div>
        <hr className="h-1 m-0 bg-black rounded" />
        <section {...getCollapseProps()}>
          <div className="flex flex-row mt-4 max-h-80 bg-slate-100">
            <div className="flex flex-col justify-center flex-1 p-8 md:p-16">
              <H3 className={{ root: 'text-xl' }}>(Gamified) Live Quizzes</H3>
              <p className="font-sans text-lg">
                Lorem ipsum dolor sit amet consectetur adipisicing elit.
                Mollitia expedita, corrupti odit animi ratione placeat est
                numquam distinctio cum illo! Qui animi possimus vitae architecto
                consequuntur sit neque. Qui, ipsa!
              </p>
              <div>
                <Button>
                  <>
                    <FontAwesomeIcon icon={faArrowRight} />
                    Read More
                  </>
                </Button>
              </div>
            </div>
            <div className="relative items-center flex-1 hidden justify-items-center md:flex">
              <img
                className="object-cover w-full h-full"
                src="https://img.freepik.com/free-vector/web-help-support-page-template-design_1017-26772.jpg?w=996&t=st=1692859143~exp=1692859743~hmac=7f1540098197c20df60c26ceb08933f99857304b4aa230c0a795cd77d910323c"
              />
            </div>
          </div>
        </section>

        <H2 className={{ root: 'mt-6' }}>Implement Gamification Elements</H2>
        <div className="">Test</div>

        <H2 className={{ root: 'mt-6' }}>Knowledge Feedback</H2>
        <div className="">Test</div>

        <H2 className={{ root: 'mt-6' }}>Learning Beyond Classroom</H2>
        <div className="">Test</div>
      </div>
    </Layout>
  )
}
