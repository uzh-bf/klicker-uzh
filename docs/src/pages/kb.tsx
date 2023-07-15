import Layout from '@theme/Layout'

function KnowledgeBase() {
  return (
    <Layout title="Welcome">
      <div className="h-screen border-2 border-red-500">
        <iframe
          src="https://www.gbl.uzh.ch/md/"
          title="Knowledge Base"
          height="100%"
          width="100%"
          className="border-2 border-red-500"
        />
      </div>
    </Layout>
  )
}

export default KnowledgeBase
