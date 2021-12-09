import React from 'react'
import Layout from '@theme/Layout'

import ImageTile from '../components/landing/ImageTile'

function Index() {
  return (
    <Layout title="KlickerUZH">
      <div className="mb-10 text-center">
        <div className="pt-4 text-center bg-gradient-to-b from-gray-400 via-gray-200 to-transparent">
          <img width="600px" src="/img/question_pool_mac.png" />
        </div>

        <div className="flex flex-row items-center justify-center">
          <div className="mr-1 text-4xl font-bold">Welcome to</div>
          <img
            className="w-40"
            src="/img/KlickerUZH_Gray_Transparent_borderless.png"
          />
        </div>

        <div className="flex flex-row justify-center mt-2">BUTTONBAR</div>
      </div>
      <div className="max-w-6xl p-8 m-auto">
        <div className="flex flex-row justify-between gap-4 mb-8">
          <ImageTile
            content={'Easy to Use'}
            imgSrc={'/img/iphone_question.png'}
          />
          <ImageTile
            content={'Optimized for mobile devices'}
            imgSrc={'/img/iphone_question.png'}
          />
          <ImageTile
            content={'100% Open Source'}
            imgSrc={'/img/development_mac.png'}
          />
        </div>
        <div>CONTENT</div>
      </div>
    </Layout>
  )
}

export default Index
