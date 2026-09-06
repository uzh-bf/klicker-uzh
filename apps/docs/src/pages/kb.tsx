import Layout from '@theme/Layout'

function KnowledgeBase() {
  return (
    <Layout
      title="Knowledge Base"
      description="Browse the KlickerUZH knowledge base."
    >
      <div className="m-auto flex min-h-screen w-full max-w-[1300px] flex-col p-8">
        <h1 className="mb-4 text-3xl font-bold">Knowledge Base</h1>
        <iframe
          src="https://www.gbl.uzh.ch/quartz/index"
          title="Knowledge Base"
          className="min-h-[32rem] min-w-0 flex-1"
        />
      </div>
    </Layout>
  )
}

export default KnowledgeBase
