import CommonDocs from '@components/CommonDocs'
import Layout from '@components/Layout'

function Microlearning() {
  return (
    <Layout courseName="KlickerUZH" displayName="Mein Profil">
      <CommonDocs />
      <div className="m-5 md:m-0 md:w-full md:max-w-xl md:p-8 md:mx-auto md:border md:rounded">
        some text for Microlearning
      </div>
    </Layout>
  )
}

export default Microlearning
