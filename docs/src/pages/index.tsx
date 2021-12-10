import React, { useEffect } from 'react'
import Layout from '@theme/Layout'

import ImageTile from '../components/landing/ImageTile'
import CustomButton from '../components/common/CustomButton'
import TitleTextBlock from '../components/common/TitleTextBlock'

function Index() {
  useEffect(() => {
    var s: any = document.createElement('script'),
      options = {
        id: 7,
        theme: 0,
        container: 'c7',
        height: '479px',
        form: '//www.bf-tools.uzh.ch/applications/easyforms/index.php?r=app%2Fembed',
      }
    s.type = 'text/javascript'
    s.src =
      'https://www.bf-tools.uzh.ch/applications/easyforms/static_files/js/form.widget.js'
    s.onload = s.onreadystatechange = function () {
      var rs = this.readyState
      if (rs) if (rs != 'complete') if (rs != 'loaded') return
      try {
        //@ts-ignore
        new window.EasyForms().initialize(options).display()
      } catch (e) {}
    }
    var scr = document.getElementsByTagName('script')[0],
      par = scr.parentNode
    par.insertBefore(s, scr)
  })

  const features = [
    {
      title: 'Easy to get started - 100% free to use',
      content: 'TODO',
      link: 'TODO',
      linkText: 'TODO',
    },
    {
      title: 'Simple Question & Session Management',
      content: 'TODO',
      link: 'TODO',
      linkText: 'TODO',
    },
    {
      title: 'Dedicated Presentation Mode',
      content: 'TODO',
      link: 'TODO',
      linkText: 'TODO',
    },
    {
      title: 'Live Q&A- and Feedback-Channel',
      content: 'TODO',
      link: 'TODO',
      linkText: 'TODO',
    },
    {
      title: 'Confusion Feedback',
      content: 'TODO',
      link: 'TODO',
      linkText: 'TODO',
    },
    {
      title: 'Multiple Question Types',
      content: 'TODO',
      link: 'TODO',
      linkText: 'TODO',
    },
    {
      title: 'Evaluation Possiblities',
      content: 'TODO',
      link: 'TODO',
      linkText: 'TODO',
    },
    {
      title: 'Multi-Language Support',
      content: 'TODO',
      link: 'TODO',
      linkText: 'TODO',
    },
  ]

  const openSourceText = [
    {
      title: 'Development and Self-Hosting',
      content: 'TODO',
      link: 'TODO',
      linkText: 'TODO',
    },
    {
      title: 'Roadmap',
      content: 'TODO',
      link: 'TODO',
      linkText: 'TODO',
    },
  ]

  return (
    <Layout title="KlickerUZH">
      <div className="mb-10 text-center bg-gradient-to-b from-gray-400 via-gray-200 to-transparent">
        <div className="flex flex-row-reverse">
          <CustomButton
            text="Login"
            className="bg-white w-36"
            link="https://app.klicker.uzh.ch/user/login"
          />
          <CustomButton
            text="Sign Up"
            className="bg-white w-36"
            link="https://app.klicker.uzh.ch/user/registration"
          />
        </div>
        <div className="text-center">
          <img width="600px" src="/img/question_pool_mac.png" />
        </div>

        <div className="flex flex-row items-center justify-center">
          <div className="mr-1 text-4xl font-bold">Welcome to</div>
          <img
            className="w-40"
            src="/img/KlickerUZH_Gray_Transparent_borderless.png"
          />
        </div>

        <div className="flex flex-row justify-center mt-3">
          <CustomButton
            text="Getting Started"
            className="w-44 bg-gray-50"
            link="introduction/getting_started"
          />
          <CustomButton
            text="Sign Up"
            className="w-44 bg-gray-50"
            link="https://app.klicker.uzh.ch/user/registration"
          />
          <CustomButton
            text="Get Involved"
            className="w-44 bg-gray-50"
            link="contributing/contributing_guidelines"
          />
        </div>
      </div>
      <div className="max-w-6xl p-8 m-auto">
        <div className="flex flex-row justify-between gap-4 mb-20">
          <ImageTile content={'Easy to Use'} imgSrc={'/img/placeholder.jpg'} />
          <ImageTile
            content={'Optimized for mobile devices'}
            imgSrc={'/img/iphone_question.png'}
          />
          <ImageTile
            content={'100% Open Source'}
            imgSrc={'/img/development_mac.png'}
          />
        </div>

        <div className="w-full h-1 bg-gradient-to-r from-gray-100 via-gray-300 to-gray-100" />

        <div className="mt-20 mb-20">
          <div className="flex flex-row items-center mb-4 text-3xl font-bold">
            Why choose
            <img
              className="w-32 ml-1"
              src="/img/KlickerUZH_Gray_Transparent_borderless.png"
            />
            ?
          </div>
          <div className="grid w-full grid-cols-2 gap-6">
            {features.map((feature: any) => (
              <TitleTextBlock
                title={feature.title}
                text={feature.content}
                link={feature.link}
                linkText={feature.linkText}
              />
            ))}
          </div>
        </div>

        <div className="w-full h-1 bg-gradient-to-r from-gray-100 via-gray-300 to-gray-100" />

        <div className="grid grid-cols-2 mt-20 mb-8">
          <div>
            <div className="mb-4 text-3xl font-bold">User Group</div>
            <div>TODO TEXT REGARDING USER GROUP</div>
            <div className="max-w-lg mt-8 border border-solid rounded-md">
              <div id="c7">
                Ausfüllen{' '}
                <a href="https://www.bf-tools.uzh.ch/applications/easyforms/index.php?r=app%2Fform&id=7">
                  Online Formular
                </a>
                .
              </div>
            </div>
          </div>
          <div className="flex flex-col gap-4">
            <div className="mb-4 text-3xl font-bold">Open Source</div>
            {openSourceText.map((snippet: any) => (
              <TitleTextBlock
                title={snippet.title}
                text={snippet.content}
                link={snippet.link}
                linkText={snippet.linkText}
              />
            ))}
          </div>
        </div>
      </div>
    </Layout>
  )
}

export default Index

/*  <ImageContentBlock
            content={
              <TitleTextBlock
                title="Easy to get started - 100% free to use"
                text={<div>TODO</div>}
                link={'introduction/getting_started'}
                linkText={'Getting Started'}
              />
            }
            imgSrc={'/img/placeholder.jpg'}
            className="mb-4"
          />
          <ImageContentBlock
            content={
              <TitleTextBlock
                title="Simple Question & Session Management"
                text={<div>TODO</div>}
                link={'introduction/getting_started'}
                linkText={'TODO'}
              />
            }
            imgSrc={'/img/placeholder.jpg'}
            className="mb-4"
          />
          <ImageContentBlock
            content={
              <TitleTextBlock
                title="Dedicated Presentation Mode, Live Q&A"
                text={<div>TODO</div>}
                link={'introduction/getting_started'}
                linkText={'TODO'}
              />
            }
            imgSrc={'/img/placeholder.jpg'}
            className="mb-4"
          />
          <ImageContentBlock
            content={
              <TitleTextBlock
                title="Evaluation Possiblities"
                text={<div>TODO</div>}
                link={'introduction/getting_started'}
                linkText={'TODO'}
              />
            }
            imgSrc={'/img/placeholder.jpg'}
            className="mb-4"
          />
          <ImageContentBlock
            content={
              <TitleTextBlock
                title="Many more Features"
                text={<div>TODO</div>}
                link={'introduction/getting_started'}
                linkText={'TODO'}
              />
            }
            imgSrc={'/img/placeholder.jpg'}
            className="mb-4"
          /> */

/* <ImageContentBlock
            content={
              <TitleTextBlock
                title="Development and Self-Hosting"
                text={<div>TODO</div>}
                link={'introduction/getting_started'}
                linkText={'TODO'}
              />
            }
            imgSrc={'/img/placeholder.jpg'}
            className="mb-4"
          />
          <ImageContentBlock
            content={
              <TitleTextBlock
                title="Roadmap"
                text={<div>TODO</div>}
                link={'introduction/getting_started'}
                linkText={'TODO'}
              />
            }
            imgSrc={'/img/placeholder.jpg'}
            className="mb-4"
          /> */
