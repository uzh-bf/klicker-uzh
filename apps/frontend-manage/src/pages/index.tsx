import Layout from '../components/Layout'

function Index() {
  return (
    <Layout displayName="Fragepool">
      <div>Welcome to the management frontend.</div>
      <div>Go to <a href="/sessions" className='text-uzh-blue-80'>Session List</a></div>
    </Layout>
  )
}

export default Index
