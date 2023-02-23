import React, { useEffect } from 'react'
import { twMerge } from 'tailwind-merge'

import { useColorMode } from '@docusaurus/theme-common'
import { faArrowRight, faMessage } from '@fortawesome/free-solid-svg-icons'
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome'
import Image from '@theme/IdealImage'
import Layout from '@theme/Layout'
import { Button } from '@uzh-bf/design-system'
import ImageTextBlock from '../components/common/ImageTextBlock'
import TitleTextBlock from '../components/common/TitleTextBlock'
import ImageTile from '../components/landing/ImageTile'

const features = [
  {
    title: 'Easy to Get Started & 100% Free',
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
    title: 'Live Question & Answer (Q&A)',
    content:
      'As a very helpful tool during large lectures, KlickerUZH also provides you with a live Q&A and feedback channel to interact with your audience. In this way, teaching assistants might e.g. already answer some questions in written form.',
    link: 'basics/audience_interaction',
    linkText: 'Audience Interaction',
  },
  {
    title: 'Real-Time Feedback',
    content:
      'Did you ever wonder, if your audience was understanding your talk or if your teaching speed was too fast? The real-time feedback collects this information from students and provides it to the lecturer in an aggregated manner.',
    link: 'basics/audience_interaction',
    linkText: 'Audience Interaction',
  },
  {
    title: 'Various Question Types',
    content:
      'KlickerUZH supports multiple different question types including free text answers, numerical answers and multiple choice as well as single choice questions. As an additional feature, solutions can be defined and displayed for SC and MC questions. Further question types are still on the roadmap.',
    link: 'basics/question_create',
    linkText: 'Question Creation',
  },
  {
    title: 'Evaluation Possiblities',
    content:
      'Even after a session has finished you might want to access the questions asked through the Q&A channel or have a look at the confusion feedbacks over the duration of the lecture. The evaluation page provides this possiblity alongside the responses to all posed questions.',
    link: 'basics/evaluation',
    linkText: 'Evaluation',
  },
  {
    title: 'Multi-Language Support',
    content:
      'KlickerUZH already supports German and English out of the box. Additionally, it was made to be easily extendable to further languages for your own deployment.',
    link: 'basics/navigation',
    linkText: 'Language Settings',
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
    link: 'development',
    linkText: 'Roadmap',
  },
]

const useCases = [
  {
    title: 'Instant Classroom Response',
    content:
      'Poll your students to instantly check their learning progress and comprehension. Choose from one of several question types to optimally support your lecture contents. Evaluate incoming responses in real-time and export them after the conclusion of a session.',
    imgSrc: require('../../static/img/iphone_question.png'),
    imgClassName: 'max-w-[100px] md:max-w-[150px]',
  },
  {
    title: 'Live Q&A in Large Classrooms',
    content:
      'The Feedback-Channel extends KlickerUZHs functionalities far beyond a simple audience response system. Students are now able to ask questions and provide feedback directly and anonymously during the lecture. If available, a teaching assistant can directly answer questions or pin them to the separate lecturer view. After a KlickerUZH session, all feedbacks and responses will still be available through the evaluation view.',
    link: '/use_cases/live_qa',
    linkText: 'Use Cases of the Q&A Channel',
    imgSrc: require('../../static/img/implementation_qa_audience.png'),
    imgClassName: 'max-w-[400px]',
  },
  {
    title: 'Real-time Feedback',
    content:
      'Beside the possibility to submit comments in written form, students can also give feedback on the lecture speed and difficulty through a dedicated visual interface in the feedback section. The so-called confusion barometer on the other side then aggregates the data into an easily readable format and allows the lecturer to adapt the lecture pace in real-time.',
    link: '/use_cases/real_time_feedback',
    linkText: 'Use Cases of Real-time Feedback',
    imgSrc: require('../../static/img/confusion_gauge_single.png'),
  },
]

function Home() {
  const navbarComponent = <div className="navbar"></div>

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

  return (
    <Layout title="Welcome">
      <div className="flex flex-row items-center gap-6 p-4 text-black bg-uzh-red-20">
        <div>
          <FontAwesomeIcon icon={faMessage} />
        </div>
        <div>
          <div className="font-bold">
            KlickerUZH v3.0 - Concept and Request for Feedback
          </div>
          <div className="font-sans">
            We have just published our{' '}
            <a
              href="https://community.klicker.uzh.ch/t/klickeruzh-v3-0-concept-and-request-for-feedback/79"
              target="_blank"
            >
              new concept and ideas
            </a>{' '}
            for the upcoming KlickerUZH v3.0, which has been made available for
            beta testing at UZH. Please have a look and let us know what you
            think!
          </div>
        </div>
      </div>
      <TitleImage imgSrc={require('../../static/img/timeline_mac.png')} />
      <div className="flex flex-col gap-8 p-4 m-auto max-w-7xl md:gap-16 md:p-8">
        <div className="flex flex-col justify-between gap-12 md:flex-row md:gap-4">
          <ImageTile
            content="Feature Complete and Easy to Use"
            imgSrc={require('../../static/img/question_pool_demo.png')}
            imgClassName="max-w-[300px]"
          />

          <ImageTile
            content="Optimized for Mobile Devices"
            imgSrc={require('../../static/img/iphone_question.png')}
            imgClassName="max-w-[100px] md:max-w-[150px]"
          />

          <ImageTile
            content="Open Source and Free to Use"
            imgSrc={require('../../static/img/development_mac.png')}
            imgClassName="max-w-[300px]"
          />
        </div>

        <Divider />

        <div>
          <h2 className="flex flex-row items-center mb-4 text-2xl font-bold sm:text-4xl">
            Use Cases
          </h2>
          <div className="flex flex-col w-full gap-4">
            {useCases.map((block: any) => (
              <ImageTextBlock
                title={block.title}
                text={block.content}
                link={block.link}
                linkText={block.linkText}
                imgSrc={block.imgSrc}
                imgClassName={block.imgClassName}
              />
            ))}
          </div>
        </div>

        <Divider />

        <div>
          <h2 className="flex flex-row items-center mb-4 text-2xl font-bold sm:text-4xl">
            Why choose
            <KlickerLogo className="ml-1 w-28 sm:w-32" />?
          </h2>
          <div className="grid w-full grid-cols-1 gap-4 md:grid-cols-2">
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

        <Divider />

        <div className="grid grid-cols-1 gap-8 md:gap-16 lg:grid-cols-2">
          <div>
            <h2 className="text-2xl font-bold sm:text-3xl">Get Involved</h2>{' '}
            <div className="flex flex-col gap-4">
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
          <div className="">
            <h2 className="text-2xl font-bold sm:text-3xl">Community</h2>
            <p className="mb-4">
              We strive to develop our roadmap and goals based on the needs of
              our users. The goal of our project on "Digital Skills" is to
              improve your capabilities in the area of digital interactions. If
              you are interested in classroom interaction and would like to be
              involved in future developments, we welcome you to join our
              KlickerUZH user community through the following link. To log in,
              simply use your KlickerUZH credentials.
            </p>
            <Button
              onClick={() =>
                window.open('https://www.klicker.uzh.ch/community', '_blank')
              }
              className={{
                root: 'flex h-12 flex-row justify-center gap-4 px-4 text-base border-none shadow cursor-pointer items-center',
              }}
            >
              <Button.Icon>
                <FontAwesomeIcon icon={faArrowRight} />
              </Button.Icon>
              <Button.Label>User Community</Button.Label>
            </Button>
          </div>
        </div>
      </div>
    </Layout>
  )
}

function Divider() {
  return (
    <div className="w-full h-1 mt-4 bg-gradient-to-r from-gray-100 via-gray-300 to-gray-100" />
  )
}

const TitleImage = ({ imgSrc }) => {
  const { isDarkTheme } = useColorMode()

  return (
    <>
      <div className="sticky z-10 top-[3.75rem]">
        <div className="flex flex-row-reverse justify-center w-full gap-2 p-2 bg-gradient-to-b from-gray-400 to-transparent sm:justify-start sm:bg-transparent-400">
          {[
            { text: 'Login', url: 'https://app.klicker.uzh.ch/user/login' },
            {
              text: 'Register',
              url: 'https://app.klicker.uzh.ch/user/registration',
            },
          ].map((entry) => (
            <Button
              onClick={() => window.open(entry.url, '_blank')}
              className={{
                root: 'flex h-12 w-36 bg-white text-black flex-row justify-center gap-4 px-4 text-base border-none shadow cursor-pointer items-center',
              }}
            >
              <Button.Icon>
                <FontAwesomeIcon icon={faArrowRight} />
              </Button.Icon>
              <Button.Label>{entry.text}</Button.Label>
            </Button>
          ))}
        </div>
      </div>
      <div className="mb-10 text-center ">
        <div className="m-auto max-w-[80%] pt-20 text-center md:max-w-[1000px] lg:pt-0">
          <Image
            alt="KlickerUZH Running Session with Audience Interaction"
            img={imgSrc}
          />
        </div>

        <h1 className="items-center justify-center mt-4 mb-4">
          <KlickerLogo className="w-44 sm:w-48 md:w-64 lg:w-80" />
          <div className="mt-2 mr-1 text-xl font-bold sm:text-2xl md:mt-4 md:text-3xl">
            Open Source Audience Interaction
          </div>
        </h1>

        <div className="flex flex-col items-center justify-center gap-2 mt-8 sm:flex-row md:gap-4">
          {[
            {
              text: 'Sign Up',
              url: 'https://app.klicker.uzh.ch/user/registration',
              local: false,
            },
            {
              text: 'Getting Started',
              url: '/introduction/getting_started',
              local: true,
            },
            { text: 'Get Involved', url: '/development', local: true },
          ].map((entry) => (
            <Button
              onClick={() =>
                entry.local === false
                  ? window.open(entry.url, '_blank')
                  : (window.location.href = entry.url)
              }
              className={{
                root: twMerge(
                  'flex h-12 w-64 md:w-52 md:text-lg bg-white text-black flex-row justify-center gap-4 px-4 text-base border-none shadow cursor-pointer items-center',
                  !isDarkTheme && 'bg-gray-50'
                ),
              }}
            >
              <Button.Icon>
                <FontAwesomeIcon icon={faArrowRight} />
              </Button.Icon>
              <Button.Label>{entry.text}</Button.Label>
            </Button>
          ))}
        </div>
      </div>
    </>
  )
}

const KlickerLogo = ({ className }) => {
  const { isDarkTheme } = useColorMode()

  return <img className={twMerge(className)} src={'/img/KlickerLogo.png'} />
}

export default Home
