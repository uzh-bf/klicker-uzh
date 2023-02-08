import CommonDocs from '@components/CommonDocs'
import Layout from '@components/Layout'

function KlickerApp() {
  return (
    <Layout courseName="KlickerUZH" displayName="Mein Profil">
      <CommonDocs />
      <div className="m-5 md:m-0 md:w-full md:max-w-xl md:p-8 md:mx-auto md:border md:rounded">
        some text for the klicker app
      </div>
    </Layout>
  )
}

export default KlickerApp
