import Layout from '@theme/Layout'
import React from 'react'

function KnowledgeBase() {
  return (
    <Layout title="Welcome">
      <div className="h-screen border-2 border-red-500">
        <iframe
          src="https://www.gbl.uzh.ch/md/"
          title="Game-Based Learning"
          height="100%"
          width="100%"
          className="border-2 border-red-500"
        />
      </div>
    </Layout>
  )
}

export default KnowledgeBase
