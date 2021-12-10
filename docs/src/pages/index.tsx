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
      content:
        'KlickerUZH is an open-source project and completely free to use. Just follow the instructions given on the site linked below, fill in your questions and get started in a matter of minutes.',
      link: 'introduction/getting_started',
      linkText: 'Getting Started',
    },
    {
      title: 'Simple Question & Session Management',
      content:
        'KlickerUZH enables you to easily manage your questions and combine them to sessions. Read all about the process in our documentation or just try it yourself.',
      link: 'basics/question_pool',
      linkText: 'Question Pool and Sessions',
    },
    {
      title: 'Dedicated Presentation Mode',
      content:
        'With the dedicated presentation mode, lecturers always have the most important information available at a glance. Just start one of your newly created session to check out the audience view.',
      link: 'basics/session_running',
      linkText: 'Running Session',
    },
    {
      title: 'Live Q&A- and Feedback-Channel',
      content:
        'As a very helpful tool during large lectures, KlickerUZH also provides you with a real-time Q&A and feedback channel to interact with your audience. In this way, teaching assistants might e.g. already answer some questions in written form.',
      link: 'basics/audience_interaction',
      linkText: 'Audience Interaction',
    },
    {
      title: 'Confusion Feedback',
      content:
        'Did you ever wonder, if your audience was understanding your talk or if your teaching speed was too fast? The confusion feedback collects this information from students and provides it to the lecturer in an aggregated manner.',
      link: 'basics/audience_interaction',
      linkText: 'Audience Interaction',
    },
    {
      title: 'Multiple Question Types',
      content:
        'KlickerUZH supports multiple different question types including free text answers, numerical answers and multiple choice as well as single choice questions. As an additional feature, solutions can be defined and displayed for SC and MC questions. Further question types are still on the roadmap.',
      link: 'basics/question_create',
      linkText: 'Quetsion Creation',
    },
    {
      title: 'Evaluation Possiblities',
      content:
        'Even after a session has finished you might want to access the questions asked through the Q&A channel or have a look at the confusion feedbacks over the duration of the lecture. The evaluation page provides this possiblity alongside the responses to all posed questions.',
      link: 'Evaluation',
      linkText: 'basics/evaluation',
    },
    {
      title: 'Multi-Language Support',
      content:
        'KlickerUZH alreay supports German and English out of the box. Additionally, it was made to be easily extendable to further languages for your own deployment.',
      link: 'deployment/deployment_architecture',
      linkText: 'Deployment',
    },
  ]

  const openSourceText = [
    {
      title: 'Features and Bug Reports',
      content:
        'In order to further improve KlickerUZH, we are very happy about any feedbacks or bug reports. In urgent cases, you may also want contact us directly through our support channels.',
      link: 'https://klicker-uzh.feedbear.com/boards/feature-requests',
      linkText: 'Feature Requests',
    },
    {
      title: 'Development and Self-Hosting',
      content:
        'Similar to many other open-source tools, KlickerUZH is available for self-hosting and contributions of any kind are very welcome. Have a look at our contributing guidlines, check out our GitHub repository linked below or contact us directly.',
      link: 'https://github.com/uzh-bf/klicker-uzh',
      linkText: 'KlickerUZH on GitHub',
    },
    {
      title: 'Roadmap',
      content:
        "Are you interested in what's next? Check out our current Roadmap!",
      link: 'roadmap',
      linkText: 'Roadmap',
    },
  ]

  return (
    <Layout title="KlickerUZH">
      <div className="mb-10 text-center sm:bg-gradient-to-b sm:from-gray-400 sm:to-transparent">
        <div className="fixed flex flex-row-reverse justify-center w-full sm:justify-start">
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

        <div className="pt-20 text-center">
          <img width="60%" src="/img/question_pool_mac.png" />
        </div>

        <div className="flex flex-row items-center justify-center mt-4 mb-4">
          <div className="mr-1 text-3xl font-bold sm:text-4xl md:text-6xl">
            Welcome to
          </div>
          <img
            className="w-36 sm:w-40 md:w-64"
            src="/img/KlickerUZH_Gray_Transparent_borderless.png"
          />
        </div>

        <div className="flex flex-col items-center justify-center mt-3 sm:flex-row">
          <CustomButton
            text="Getting Started"
            className="w-44 bg-gray-50 md:text-lg md:w-52"
            link="introduction/getting_started"
          />
          <CustomButton
            text="Sign Up"
            className="w-44 bg-gray-50 md:text-lg md:w-52"
            link="https://app.klicker.uzh.ch/user/registration"
          />
          <CustomButton
            text="Get Involved"
            className="w-44 bg-gray-50 md:text-lg md:w-52"
            link="contributing/contributing_guidelines"
          />
        </div>
      </div>
      <div className="max-w-6xl p-8 m-auto">
        <div className="flex flex-col justify-between gap-4 mb-20 md:flex-row">
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
          <div className="flex flex-row items-center mb-4 text-2xl font-bold sm:text-3xl">
            Why choose
            <img
              className="ml-1 w-28 sm:w-32"
              src="/img/KlickerUZH_Gray_Transparent_borderless.png"
            />
            ?
          </div>
          <div className="grid w-full grid-cols-1 gap-6 md:grid-cols-2">
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

        <div className="grid grid-cols-1 mt-20 mb-8 lg:grid-cols-2">
          <div className="mb-20 lg:mb-0">
            <div className="mb-2 text-2xl font-bold sm:text-3xl">
              User Group
            </div>
            <div className="pr-8">
              We strive to develop our roadmap and goals based on the needs of
              our users. The goal of our project on "Digital Skills" is to
              improve your capabilities in the area of digital interactions. If
              you are interested in classroom interaction and would like to be
              involved in future developments, we welcome you to join our
              KlickerUZH user group with the following form.
            </div>
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
            <div className="mb-2 text-2xl font-bold sm:text-3xl">
              Open Source
            </div>
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
