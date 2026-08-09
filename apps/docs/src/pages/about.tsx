import { faGithub } from '@fortawesome/free-brands-svg-icons'
import { faInfoCircle } from '@fortawesome/free-solid-svg-icons'
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome'
import Layout from '@theme/Layout'
import { H1, H2 } from '@uzh-bf/design-system'

const PEOPLE: {
  name: string
  role: string
  imageUrl?: string
  info?: string
  github?: string
}[] = [
  {
    name: 'Roland Schläfli',
    role: 'Project Manager',
    imageUrl:
      'https://www.df.uzh.ch/contacts/df/admin/teaching-center/rschl%C3%A4fli/photo/Schl%C3%A4fli-Roland.jpg.jpg',
    info: 'https://www.df.uzh.ch/en/people/staff/teaching-center/roland-schlaefli.html',
    github: 'https://github.com/rschlaefli',
  },
  {
    name: 'Julius Schlapbach',
    role: 'Project Maintainer',
    imageUrl:
      'https://www.df.uzh.ch/contacts/df/admin/teaching-center/jschlapbach/photo/20220504_Schlapbach-Julius-019.jpg.jpg',
    info: 'https://www.df.uzh.ch/en/people/staff/teaching-center/julius-schlapbach.html',
    github: 'https://github.com/sjschlapbach',
  },
  {
    name: 'Patrick Aldover',
    role: 'Project Maintainer',
    info: 'https://www.df.uzh.ch/en/people/staff/teaching-center/patrick-aldover.html',
    github: 'https://github.com/jabbadizzleCode',
  },
  {
    name: 'Johanna Braun',
    role: 'Head Teaching Center',
    imageUrl:
      'https://www.df.uzh.ch/contacts/df/admin/teaching-center/jbraun/photo/Braun%20Johanna.jpg.jpg',
    info: 'https://www.df.uzh.ch/en/people/staff/teaching-center/Johanna-Braun.html',
  },
  {
    name: 'Benjamin Wilding',
    role: 'Managing Director Teaching DF',
    imageUrl:
      'https://www.df.uzh.ch/contacts/df/admin/management/bwilding/photo/Benjamin%20Wilding.jpg.jpg',
    info: 'https://www.df.uzh.ch/en/people/staff/management/benjamin-wilding.html',
  },
  {
    name: 'Walter Farkas',
    role: 'Director Teaching Center',
    imageUrl:
      'https://www.df.uzh.ch/contacts/df/professors/efarkas/photo/farkas-erich_walter.jpg.jpg',
    info: 'https://www.df.uzh.ch/en/people/professors/erich-walter-farkas.html',
  },
  {
    name: 'Jannis Alsbach',
    role: 'Contributor',
    imageUrl:
      'https://www.df.uzh.ch/contacts/df/student-assistants/jalsbach/photo/20220504_Alsbach-Jannis-006.jpg.jpg',
    info: 'https://www.df.uzh.ch/en/people/student-assistants/jannis-alsbach.html',
    github: 'https://github.com/TheHummel',
  },
  {
    name: 'Ioannis Dougas',
    role: 'Contributor (Content)',
    imageUrl:
      'https://www.df.uzh.ch/contacts/df/student-assistants/idougas/photo/20221012_Dougas_Ioannis.jpg.jpg',
    info: 'https://www.df.uzh.ch/en/people/student-assistants/ioannis-dougas.html',
  },
  {
    name: 'Selina De Pizzol',
    role: 'Contributor (Content)',
    info: 'https://www.df.uzh.ch/en/people/student-assistants/selina-de-pizzol.html',
  },
  {
    name: 'Julia Gut',
    role: 'Contributor (Content)',
  },
  {
    name: "Alessio D'Andrea",
    role: 'Contributor (Content)',
  },
]

const About = () => {
  return (
    <Layout>
      <div className="m-auto max-w-[1300px] p-8">
        <H1 className={{ root: 'mb-2' }}>About KlickerUZH</H1>

        <div className="mb-8">
          <p>
            KlickerUZH is a web application that supports the interaction
            between lecturers and their audience in various ways. The platform
            is being developed by the Teaching Center of the Department of
            Finance at the University of Zurich, Switzerland. The development is{' '}
            <a
              href="https://github.com/uzh-bf/klicker-uzh"
              target="_blank"
              rel="noopener noreferrer"
              className="text-blue-800 hover:underline"
            >
              entirely open-source
            </a>
            , allowing for further extensibility and collaboration.
          </p>
        </div>

        <div className="mb-10 flex w-full flex-col items-center">
          <iframe
            src="https://api.cast.switch.ch/p/106/embedPlaykitJs/uiconf_id/23449004/partner_id/106?iframeembed=true&playerId=kaltura_player&entry_id=0_ol91rao1"
            className="aspect-video w-full max-w-3xl border-2 border-solid border-black"
            allowFullScreen
            allow="fullscreen"
            title="Video Player"
          />
        </div>

        <H2 className={{ root: 'mb-2' }}>Our Team</H2>
        <p>
          The following people are actively involved in the KlickerUZH project
          and its continued development. If you have any questions or feedback,
          feel free to reach out to us via e-mail at{' '}
          <a
            href="mailto:klicker@df.uzh.ch?subject=[KlickerUZH]: Website Request"
            className="text-blue-800 hover:underline"
          >
            klicker@df.uzh.ch
          </a>
          . Former contributors can be found in our{' '}
          <a
            href="https://github.com/uzh-bf/klicker-uzh/graphs/contributors"
            target="_blank"
            rel="noopener noreferrer"
            className="text-blue-800 hover:underline"
          >
            <FontAwesomeIcon icon={faGithub} className="mx-1" />
            open-source GitHub repository
          </a>
          .
        </p>
        <ul className="mb-14 grid list-none grid-cols-1 gap-x-8 gap-y-10 pl-0 sm:grid-cols-2 sm:gap-y-12 md:grid-cols-3 lg:grid-cols-4 xl:col-span-2">
          {PEOPLE.map((person) => (
            <li key={person.name}>
              <div className="flex items-start gap-x-6">
                <img
                  alt={`Profile of ${person.name}`}
                  src={person.imageUrl ?? '/img/app/anonymous-user.svg'}
                  className="aspect-ratio w-14 rounded-full"
                />
                <div className="flex h-max flex-col">
                  <h3 className="mb-0 text-base/7 font-semibold tracking-tight text-gray-900">
                    {person.name}
                  </h3>
                  <p className="mb-1 text-sm/6 font-semibold text-indigo-600">
                    {person.role}
                  </p>
                  <div className="mt-0 flex flex-row items-center gap-3">
                    {person.info ? (
                      <FontAwesomeIcon
                        icon={faInfoCircle}
                        onClick={() => {
                          window.open(person.info, '_blank')
                        }}
                        className="w-max hover:cursor-pointer"
                      />
                    ) : null}
                    {person.github ? (
                      <FontAwesomeIcon
                        icon={faGithub}
                        onClick={() => {
                          window.open(person.github, '_blank')
                        }}
                        className="w-max hover:cursor-pointer"
                      />
                    ) : null}
                  </div>
                </div>
              </div>
            </li>
          ))}
        </ul>

        <H2>Project Sponsors</H2>
        <div className="mb-4 flex h-24 flex-col items-start md:h-12 md:flex-row">
          <img
            src="/img/logos/logo_swissuniversities.png"
            className="mr-8 h-full"
            alt="swissuniversities logo"
          />
          <img
            src="/img/logos/logo_uzh.jpeg"
            className="h-full"
            alt="University of Zurich logo"
          />
        </div>
      </div>
    </Layout>
  )
}

export default About
