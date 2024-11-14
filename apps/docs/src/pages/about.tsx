import {
  faArrowLeft,
  faCheck,
  faCrown,
  faPlus,
} from '@fortawesome/free-solid-svg-icons'
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome'
import Layout from '@theme/Layout'
import { Prose } from '@uzh-bf/design-system'
import TextTransition, { presets } from 'react-text-transition'

const KPIs = () => {
    const metrics = [
        {
            value: "1894",
            label: "Lecturers",
            description: "use KlickerUZH"
        },
        {
            value: "26134",
            label: "Elements",
            description: "have been created"
        },
        {
            value: "7203",
            label: "Live Quizzes",
            description: "were conducted"
        }
    ];

    return (
        <>
        <h1 className="mt-2 flex w-max flex-row gap-4 text-xl md:text-3xl" >
            KlickerUZH in numbers
        </h1>

        <div className="mx-auto mt-12 grid max-w-[45rem] grid-cols-3 gap-8">
            {metrics.map((metric, index) => (
                <div key={index} className="flex flex-col items-center justify-center rounded-lg bg-uzh-blue-80 p-6 text-center text-white">
                    <div className="text-3xl font-bold">{metric.value}</div>
                    <div className="mt-2 text-xl font-semibold">{metric.label}</div>
                    <div className="mt-1 text-sm">{metric.description}</div>
                </div>
            ))}
        </div>
        </>
    );
};

function Models() {
  return (
    <div className="mx-auto mt-12 flow-root max-w-[45rem]">
      <div className="cards isolate -mt-8 grid grid-cols-1 gap-6 sm:mx-auto sm:max-w-sm md:max-w-none md:grid-cols-2 lg:-mx-8 lg:mt-0 xl:-mx-4">
        <div className="space-y-4 rounded-lg bg-slate-100 p-6 sm:rounded-xl sm:p-8">
          <div className="text-4xl font-semibold tracking-tight md:text-5xl">
            Standard
          </div>
          <ul className="mb-2 mt-8 space-y-2 pl-0">
            <li className="flex gap-x-3">
              <div>
                <FontAwesomeIcon icon={faCheck} />
              </div>
              <div>Gamified Live Quizzes</div>
            </li>
            <li className="flex gap-x-3">
              <div>
                <FontAwesomeIcon icon={faCheck} />
              </div>
              <div>Live Q&A and Real-Time Feedback</div>
            </li>
            <li className="flex gap-x-3">
              <div>
                <FontAwesomeIcon icon={faCheck} />
              </div>
              <div>Courses and Leaderboards</div>
            </li>
            <li className="flex gap-x-3">
              <div>
                <FontAwesomeIcon icon={faCheck} />
              </div>
              <div>Participant Accounts and Groups</div>
            </li>
            <li className="flex gap-x-3">
              <div>
                <FontAwesomeIcon icon={faCheck} />
              </div>
              <div>Community Support (best-effort)</div>
            </li>
          </ul>
        </div>

        <div className="space-y-4 rounded-lg bg-slate-100 p-6 sm:rounded-xl sm:p-8">
          <div className="text-4xl font-semibold tracking-tight md:text-5xl">
            <FontAwesomeIcon icon={faCrown} /> Catalyst
          </div>
          <ul className="mb-2 mt-8 space-y-2 pl-0">
            <li className="flex gap-x-3">
              <div>
                <FontAwesomeIcon icon={faArrowLeft} />
              </div>
              <div>Standard Functionalities</div>
              <div>
                <FontAwesomeIcon icon={faPlus} />
              </div>
            </li>

            <li className="flex gap-x-3">
              <div>
                <FontAwesomeIcon icon={faCheck} />
              </div>
              <div>Microlearning</div>
            </li>
            <li className="flex gap-x-3">
              <div>
                <FontAwesomeIcon icon={faCheck} />
              </div>
              <div>Practice Quizzes</div>
            </li>
            <li className="flex gap-x-3">
              <div>
                <FontAwesomeIcon icon={faCheck} />
              </div>
              <div>Group Activities</div>
            </li>
            <li className="flex gap-x-3">
              <div>
                <FontAwesomeIcon icon={faCheck} />
              </div>
              <div>Future Developments like AI/Analytics</div>
            </li>
            <li className="flex gap-x-3">
              <div>
                <FontAwesomeIcon icon={faCheck} />
              </div>
              <div>Direct Support Channels (best-effort)</div>
            </li>
          </ul>

          <div>
            To get access and for other inquiries please fill out the following{' '}
            <a href="https://forms.office.com/e/4AsWW1uck2" target="_blank">
              form
            </a>
            .
          </div>
        </div>
      </div>
    </div>
  )
}

function Catalyst() {
  return (
    <Layout>


          <div className="flex max-w-7xl flex-col items-center text-center md:mx-auto lg:px-8">
              <div className="px-8 py-24">
                  <h1 className="mt-2 flex w-max flex-row gap-4 md:text-5xl">
                      <div> Purpose of KlickerUZH</div>
                      <div className="flex justify-center">
                      </div>
                  </h1>
                  <p className="text-center">
                      Lorem ipsum dolor sit amet, consectetur adipiscing elit. Sed do
                  </p>
                  <h1 className="mt-2 flex w-max flex-row gap-4 md:text-5xl">
                      <div>KlickerUZH</div>
                      <div className="flex justify-center">
                          <TextTransition springConfig={presets.wobbly}>
                              <u className="decoration-[#3353b7]">Models</u>
                          </TextTransition>
                      </div>
                  </h1>
                  {Models()}
                  <Prose className={{root: 'prose-xl w-full max-w-3xl'}}>
                      <p>
                          The core components of our KlickerUZH instance are free to use for
                          everyone. Advanced functionalities are restricted to users at UZH
                          or sponsors ("catalysts") of the KlickerUZH open-source project.
                      </p>
                      <p>
                          We offer the advanced functionalities for free to individual
                          lecturers in small educational use cases or for piloting
                          KlickerUZH in an external organization. For broad use across a
                          larger organization, a sponsorship agreement is required.
                      </p>
                      <p>
                          You can contribute to the project in various ways, e.g., by
                          self-hosting and collaborating on the code base, or by sponsoring
                          the project financially.
                      </p>
                      <p>
                          To get access and for other inquiries please fill out the
                          following{' '}
                          <a href="https://forms.office.com/e/4AsWW1uck2" target="_blank">
                              form
                          </a>
                          .
                      </p>
                  </Prose>
                  {KPIs()}

              </div>
          </div>
    </Layout>
  )
}

export default Catalyst
