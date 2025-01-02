import Layout from '@theme/Layout'
import { H1, H2 } from '@uzh-bf/design-system'

const PEOPLE: { name: string; role: string; imageUrl?: string }[] = [
  {
    name: 'Roland Schläfli',
    role: 'Project Manager',
    imageUrl:
      'https://www.df.uzh.ch/contacts/df/admin/teaching-center/rschl%C3%A4fli/photo/Schl%C3%A4fli-Roland.jpg.jpg',
  },
  {
    name: 'Julius Schlapbach',
    role: 'Project Maintainer',
    imageUrl:
      'https://www.df.uzh.ch/contacts/df/student-assistants/jschlapbach/photo/20220504_Schlapbach-Julius-019.jpg.jpg',
  },
  {
    name: 'Johanna Braun',
    role: 'Head Teaching Center',
    imageUrl:
      'https://www.df.uzh.ch/contacts/df/admin/teaching-center/jbraun/photo/Braun%20Johanna.jpg.jpg',
  },
  {
    name: 'Benjamin Wilding',
    role: 'Managing Director Teaching DF',
    imageUrl:
      'https://www.df.uzh.ch/contacts/df/admin/management/bwilding/photo/Benjamin%20Wilding.jpg.jpg',
  },
  {
    name: 'Walter Farkas',
    role: 'Director Teaching Center',
    imageUrl:
      'https://www.df.uzh.ch/contacts/df/professors/efarkas/photo/farkas-erich_walter.jpg.jpg',
  },
  {
    name: 'Jannis Alsbach',
    role: 'Contributor',
    imageUrl:
      'https://www.df.uzh.ch/contacts/df/student-assistants/jalsbach/photo/20220504_Alsbach-Jannis-006.jpg.jpg',
  },
  {
    name: 'Julia Gut',
    role: 'Contributor (Content)',
    imageUrl:
      'https://www.df.uzh.ch/contacts/df/student-assistants/jgut/photo/Julia%20Gut.jpg.jpg',
  },
  {
    name: 'Selina De Pizzol',
    role: 'Contributor (Content)',
  },
  {
    name: 'Bulin Shaqiri',
    role: 'Contributor (Alumnus)',
  },
  {
    name: 'Alex Scheitlin',
    role: 'Contributor (Alumnus)',
  },
  {
    name: 'Lisa Liechti',
    role: 'Project Manager (Alumnus)',
  },
  {
    name: 'Felix Schelbert',
    role: 'Contributor (Alumnus)',
  },
  {
    name: 'Luca Locher',
    role: 'Contributor (Alumnus)',
  },
  {
    name: 'Florina Vogel',
    role: 'Contributor (Alumnus)',
  },
  {
    name: 'Maximilian Weber',
    role: 'Contributor (Alumnus)',
  },
  {
    name: 'Valentin Meyer',
    role: 'Contributor (Alumnus)',
  },
  {
    name: 'Christopher Narayanan',
    role: 'Contributor (Alumnus)',
  },
  {
    name: 'Jonas Gebel',
    role: 'Contributor (Alumnus)',
  },
]

const About = () => {
  return (
    <Layout>
      <div className="m-auto max-w-[1300px] p-8">
        <H1>About KlickerUZH</H1>

        <div className="mb-8">
          <p>
            KlickerUZH is a web application that supports the interaction
            between lecturers and their audience in various ways. The platform
            is being developed by the Teaching Center of the Department of
            Finance at the University of Zurich, Switzerland. The development is{' '}
            <span
              onClick={() =>
                window.open('https://github.com/uzh-bf/klicker-uzh', '_blank')
              }
              className="cursor-pointer text-blue-800 hover:underline"
            >
              entirely open-source
            </span>
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

        <H2 className={{ root: 'mb-4' }}>Our Team</H2>
        <ul
          role="list"
          className="mb-14 grid list-none gap-x-8 gap-y-10 sm:grid-cols-2 sm:gap-y-12 md:grid-cols-3 lg:grid-cols-4 xl:col-span-2"
        >
          {PEOPLE.map((person) => (
            <li key={person.name}>
              <div className="flex items-center gap-x-6">
                <img
                  alt={`Profile photo of ${person.name}`}
                  src={person.imageUrl ?? '/img_v3/anonymousUser.svg'}
                  className="aspect-ratio w-14 rounded-full"
                />
                <div className="h-max">
                  <h3 className="mb-0 text-base/7 font-semibold tracking-tight text-gray-900">
                    {person.name}
                  </h3>
                  <p className="text-sm/6 font-semibold text-indigo-600">
                    {person.role}
                  </p>
                </div>
              </div>
            </li>
          ))}
        </ul>

        <H2>Project Sponsors</H2>
        <div className="mb-4 flex h-12 flex-row items-start">
          <img src="/img/logo_swissuniversities.png" className="mr-8 h-full" />
          <img src="/img/logo_uzh.jpeg" className="h-full" />
        </div>
      </div>
    </Layout>
  )
}

export default About
