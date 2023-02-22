import { H3 } from '@uzh-bf/design-system'
import Image from 'next/image'
import DocsLayout from '../../../../components/docs/DocsLayout'

function Login() {
  return (
    <DocsLayout>
      <H3>Erstmaliges Login</H3>
      Damit du an der BF-Champions Challenge teilnehmen kannst, musst du dich
      einmalig registrieren. Dabei kannst du wie folgt vorgehen:
      <br />
      <br />
      <ol style={{ listStyleType: 'decimal' }} className="pl-5">
        <li>
          Gehe in OLAT auf den Baustein KlickerUZH {'> '}
          <a
            className="font-bold text-uzh-turqoise-100"
            href="https://lms.uzh.ch/auth/RepositoryEntry/17250386251/CourseNode/106282733824664"
            target="_blank"
            rel="noreferrer"
          >
            «Leaderbord»
          </a>
        </li>
        <li>
          Setze einen (anonymen) Usernamen und ein Passwort. Falls du die
          Challenge inkognito bestreiten möchtest, verwende keine
          identifizierbaren Elemente im Username.
        </li>
        <li>
          Kreiere einen Avatar, der dich während deiner Nutzung des KlickerUZH
          begleitet.
        </li>
        <li>
          Du wirst zum Leaderboard weitergeleitet. Möchtest du dich mit den
          anderen BFI-Studierenden messen und im Leaderboard angezeigt werden,
          so klicke nun im Leaderboard auf “Beitreten”.
        </li>
        <li>
          In der KlickerUZH App und bei den Live Sessions kannst du dich
          einloggen (Klick auf den Avatar), bei Aktivitäten mitmachen, und
          Punkte sammeln.
        </li>
      </ol>
      <br />
      <div className="mx-5 md:w-full md:max-w-xl md:p-8 md:mx-auto md:rounded">
        <Image
          src="https://course-cms.sos-ch-dk-2.exo.io/Klicker2_b08e10a9e4.PNG"
          alt="Installation guide for the KlickerApp"
          width={721}
          height={627}
        />
      </div>
    </DocsLayout>
  )
}

export function getServerSideProps({ locale }: any) {
  return {
    props: {
      messages: {
        ...require(`shared-components/src/intl-messages/${locale}.json`),
      },
    },
  }
}

export default Login
