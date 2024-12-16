import Layout from '@theme/Layout'
import { H1, H2 } from '@uzh-bf/design-system'

const PEOPLE = [
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
    imageUrl: '',
  },
  {
    name: 'Benjamin Wilding',
    role: 'Managing Director Teaching DF',
    imageUrl: '',
  },
  {
    name: 'Walter Farkas',
    role: 'Director Teaching Center',
    imageUrl: '',
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
    name: 'Jannis Alsbach',
    role: 'Contributor',
  },
  {
    name: 'Valentin Meyer',
    role: 'Contributor (Alumnus)',
  },
  {
    name: 'Christopher Narayanan',
    role: 'Contributor',
  },
  {
    name: 'Jonas Gebel',
    role: 'Contributor (Alumnus)',
  },
  {
    name: 'Julia Gut',
    role: 'Contributor (Content)',
  },
  {
    name: 'Selina De Pizzol',
    role: 'Contributor (Content)',
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
            Finance at the University of Zurich, Switzerland. The development is
            entirely open-source, allowing for further extensibility and
            collaboration.
          </p>
        </div>

        <iframe
          src="https://api.cast.switch.ch/p/106/embedPlaykitJs/uiconf_id/23449004/partner_id/106?iframeembed=true&playerId=kaltura_player&entry_id=0_ol91rao1"
          width="100%"
          height="360"
          allowFullScreen
          allow="fullscreen"
          title="Video Player"
        />

        <H2>Our Team</H2>
        <ul
          role="list"
          className="grid list-none gap-x-8 gap-y-12 sm:grid-cols-4 sm:gap-y-16 xl:col-span-2"
        >
          {PEOPLE.sort((a, b) => a.name.localeCompare(b.name)).map((person) => (
            <li key={person.name}>
              <div className="flex items-center gap-x-6">
                <img
                  alt=""
                  src={person.imageUrl}
                  className="size-16 rounded-full"
                />
                <div>
                  <h3 className="text-base/7 font-semibold tracking-tight text-gray-900">
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
