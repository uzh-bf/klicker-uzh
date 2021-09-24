import Link from 'next/link'
import React, { useState, useEffect } from 'react'
import { useRouter } from 'next/router'
import {
  Card,
  Container,
  Input,
  Label,
  Image,
  Icon,
  Button,
  Form,
} from 'semantic-ui-react'

enum Status {
  RELEASED,
  WORKING_ON,
  PLANNED,
}

const StatusColor = {
  [Status.RELEASED]: 'green',
  [Status.WORKING_ON]: 'olive',
  [Status.PLANNED]: 'grey',
}

const StatusText = {
  [Status.RELEASED]: 'Released',
  [Status.WORKING_ON]: 'Working On',
  [Status.PLANNED]: 'Planned',
}

interface RoadmapItemProps {
  fluid?: boolean
  title: string
  description: string
  status: Status
  children: any
}

function RoadmapItem({
  fluid,
  title,
  description,
  status,
  children,
}: RoadmapItemProps) {
  return (
    <Card
      fluid={fluid}
      className="md:!max-w-sm"
      color={StatusColor[status] as any}
    >
      <Card.Content header={title} />
      {/* <Image src="https://place-hold.it/300x100" /> */}
      <Card.Content>{description}</Card.Content>
      <Card.Content extra className="flex items-center">
        <Label color={StatusColor[status] as any}>{StatusText[status]}</Label>
        {children}
      </Card.Content>
    </Card>
  )
}

export default function Roadmap() {
  const { query } = useRouter()
  console.log(query)

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
        new window.EasyForms().initialize(options).display()
      } catch (e) {}
    }
    var scr = document.getElementsByTagName('script')[0],
      par = scr.parentNode
    par.insertBefore(s, scr)
  })

  return (
    <div className="p-4 pt-4 md:p-16 md:pt-8">
      {query?.thanks && (
        <div className="p-4 mb-16 ml-4 mr-4 bg-blue-100 border border-blue-400">
          <div className="mb-2 text-2xl font-bold">
            Thank you for your participation!
          </div>
          <p className="max-w-5xl mb-0 prose prose-xl">
            Your feedback will allow us support teachers with improved digital
            tooling, know-how, and resources. <br />
            We will curate and continuously update this page with the most
            important information regarding our project, in case you would like
            to stay informed about our progress and updates that might be
            interesting to you.
          </p>
        </div>
      )}

      <h1 className="ml-4">Get Involved</h1>

      <div className="flex flex-col flex-wrap md:flex-row">
        <div className="flex-1 p-4 md:pr-8">
          <h2 className="mt-16">P-8 &quot;Digital Skills&quot;</h2>
          <p className="mb-4 prose prose-lg md:mb-8 max-w-none">
            As part of a project backed by swissuniversities and the Teaching
            Center at the Dept. of Banking and Finance (UZH), the KlickerUZH
            team will be working on several interesting focus areas over the
            coming years. We will be developing best practices and materials, as
            well as extending the KlickerUZH with capabilities that support each
            of these areas. This page and our official documentation will be
            continuously extended with helpful resources.
          </p>

          <div className="flex flex-row">
            <Image
              className="w-auto h-10 mr-8"
              src="/img/logo_swissuniversities.png"
            />
            <Image className="w-auto h-10" src="/img/logo_uzh.jpeg" />
          </div>

          <div className="mt-8">
            <Card.Group fluid className="flex justify-center md:justify-start">
              <RoadmapItem
                fluid
                title="Interaction"
                description={`
                  New interaction modalities for virtual and physical classrooms
                  improve interaction between lecturers and participants.
                `}
                status={Status.WORKING_ON}
              >
                <Label>Fall 21 - Spring 22</Label>
              </RoadmapItem>
              <RoadmapItem
                fluid
                title="Gamification and Engagement"
                description={`
                The incorporation of gamified interactions allows lecturers to increase engagement
                in their (virtual) classrooms.
                `}
                status={Status.PLANNED}
              >
                <Label>Spring 22 - Fall 22</Label>
              </RoadmapItem>

              <RoadmapItem
                fluid
                title="In-Depth Analysis"
                description={`
                Analysis functionalities allow lecturers to evaluate their
                sessions and questions in terms of different quality dimensions.
                `}
                status={Status.PLANNED}
              >
                <Label>Fall 22 - Spring 23</Label>
              </RoadmapItem>
            </Card.Group>
          </div>
        </div>

        <div className="flex-1 max-w-2xl p-4 mt-8 md:pl-8 md:mt-0">
          <h2 className="mt-16">User Group</h2>
          <p className="mb-4 prose prose-lg max-w-none">
            We strive to develop our roadmap and goals based on the needs of our
            users. The goal of our project on &quot;Digital Skills&quot; is to
            improve your capabilities in the area of digital interactions. If
            you are interested in classroom interaction and would like to be
            involved in future developments, we welcome you to join our new
            KlickerUZH user group with the following form.
          </p>
          <div className="max-w-lg mt-8 border min-h-[370px]">
            <div id="c7">
              Ausfüllen{' '}
              <a href="https://www.bf-tools.uzh.ch/applications/easyforms/index.php?r=app%2Fform&id=7">
                Online Formular
              </a>
              .
            </div>
          </div>
        </div>
      </div>

      <div className="p-4 mt-8 md:mt-16">
        <h1>Public Roadmap</h1>
        <p className="prose prose-lg max-w-none">
          Our public roadmap is directly integrated with our project management
          software, allowing you to see what milestones we are currently working
          on.
        </p>

        <iframe
          className="clickup-embed"
          src="https://sharing.clickup.com/b/h/5-74501758-2/8696b18d0f64dc6"
          onWheel={() => null}
          width="100%"
          height="700px"
          style={{ background: 'transparent', border: '1px solid #ccc' }}
        ></iframe>
      </div>
    </div>
  )
}
