import { faMessage } from '@fortawesome/free-solid-svg-icons'
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome'
import Layout from '@theme/Layout'
import React from 'react'
import RoadmapTile from '../components/development/RoadmapTile'

const Development = () => {
  const tileContent = [
    {
      title: 'Interaction',
      content:
        'New interaction modalities for virtual and physical classrooms improve interaction between lecturers and participants.',
      useCases: [
        {
          content: 'Live Q&A',
          href: '/use_cases/live_qa',
          status: 'Released in v2.0 (HS21)',
        },
        {
          content: 'Real-Time Feedback',
          href: '/use_cases/real_time_feedback',
          status: 'Released in v2.0 (HS21)',
        },
        {
          content: 'Learning Elements & Microlearning',
          href: 'https://community.klicker.uzh.ch/t/klickeruzh-v3-0-concept-and-request-for-feedback/79',
          status: 'Release in v3.0 Beta (FS23)',
        },
        // { content: 'Poll-Based Experiments', status: 'Under Consideration' },
      ],
      tags: [
        { text: 'Working On', color: 'orange' },
        { text: 'Fall 21 - Spring 23', color: 'lightgray' },
      ],
    },
    {
      title: 'Gamification and Engagement',
      content:
        'The incorporation of gamified interactions allows lecturers to increase engagement in their (virtual) classrooms.',
      useCases: [
        {
          content: 'Gamified Live Quizzes',
          href: 'https://community.klicker.uzh.ch/t/klickeruzh-v3-0-concept-and-request-for-feedback/79',
          status: 'Release in v3.0 Beta (FS23)',
        },
        {
          content: 'Challenges and Awards',
          href: 'https://community.klicker.uzh.ch/t/klickeruzh-v3-0-concept-and-request-for-feedback/79',
          status: 'Release in v3.0 Beta (FS23)',
        },
        {
          content: 'Group Activities',
          href: 'https://community.klicker.uzh.ch/t/klickeruzh-v3-0-concept-and-request-for-feedback/79',
          status: 'Work In Progress',
        },
      ],
      tags: [
        { text: 'Working On', color: 'orange' },
        { text: 'Fall 22 - Spring 23', color: 'lightgray' },
      ],
    },
    {
      title: 'In-Depth Analysis',
      content:
        'Analysis functionalities allow lecturers to evaluate their sessions and questions in terms of different quality dimensions.',
      tags: [
        { text: 'Planned', color: 'gray' },
        { text: 'Spring 23 - Fall 23', color: 'lightgray' },
      ],
    },
  ]

  return (
    <Layout title="Development">
      <div className="flex flex-row items-center gap-6 p-4 bg-uzh-red-20">
        <div>
          <FontAwesomeIcon icon={faMessage} />
        </div>
        <div>
          <div className="font-bold">
            KlickerUZH v3.0 - Concept and Request for Feedback
          </div>
          <div>
            We have published our{' '}
            <a
              href="https://community.klicker.uzh.ch/t/klickeruzh-v3-0-concept-and-request-for-feedback/79"
              target="_blank"
            >
              new concept and ideas
            </a>{' '}
            for the upcoming KlickerUZH v3.0. Please have a look and let us know
            what you think!
          </div>
        </div>
      </div>

      <div className="max-w-6xl p-8 m-auto">
        <div className="flex flex-row items-start justify-between h-12 mb-4">
          <div className="mb-8 text-3xl font-bold md:mb-0">
            Get Involved - P-8 "Digital Skills"
          </div>
          <div className="hidden h-full md:block">
            <img
              src="/img/logo_swissuniversities.png"
              className="h-full mr-8"
            />
            <img src="/img/logo_uzh.jpeg" className="h-full" />
          </div>
        </div>

        <div className="mb-8">
          As part of a project backed by swissuniversities and the Teaching
          Center at the Dept. of Banking and Finance (UZH), the KlickerUZH team
          will be working on several interesting focus areas over the coming
          years. We will be developing best practices and materials, as well as
          extending the KlickerUZH with capabilities that support each of these
          areas. This page and our official documentation will be continuously
          extended with helpful resources.
          <div className="block mt-4 md:hidden">
            <img src="/img/logo_swissuniversities.png" className="h-12 mr-2" />
            <img src="/img/logo_uzh.jpeg" className="h-12" />
          </div>
        </div>
        <div className="grid justify-between w-full grid-cols-1 gap-4 mb-16 md:grid-cols-3 lg:gap-4">
          {tileContent.map((tile: any) => (
            <RoadmapTile
              title={tile.title}
              content={tile.content}
              useCases={tile.useCases}
              tags={tile.tags}
            />
          ))}
        </div>

        <div>
          <div className="mb-4 text-3xl font-bold">Public Roadmap</div>
          <iframe
            className="overflow-hidden border border-gray-300 border-solid rounded"
            src="https://klicker-uzh.feedbear.com/roadmap?embed=true"
            width="100%"
            height="900px"
          ></iframe>
        </div>
      </div>
    </Layout>
  )
}

export default Development
