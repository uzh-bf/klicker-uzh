import Link from 'next/link'
import React, { useState, useEffect } from 'react'
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
    <Card fluid={fluid} color={StatusColor[status] as any}>
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
  useEffect(() => {
    var s: any = document.createElement('script'),
      options = {
        id: 7,
        theme: 0,
        container: 'c7',
        height: '479px',
        form:
          '//www.bf-tools.uzh.ch/applications/easyforms/index.php?r=app%2Fembed',
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
    <Container className="pt-4 pb-16">
      <h1>Roadmap</h1>
      <div className="mb-8">
        <Image bordered fluid src="/img/whiteboard.png" />
      </div>

      <h2 className="pt-4">Current Focus Areas</h2>
      <p className="mb-8 prose prose-lg max-w-none">
        The current development focus of the KlickerUZH is centered around
        stability and integrity of the voting performed on the platform. As part
        of a project sponsored by the Faculty of Business, Economics and
        Informatics, we have released authentication capabilities for KlickerUZH
        sessions. Furthermore, we are cooperating with the UZH Central IT to get
        the KlickerUZH running on Microsoft Azure, allowing for significant
        performance and stability improvements.
      </p>

      <div className="max-w-3xl">
        <div className="mb-6">
          <Card fluid color="green">
            <Card.Content header="Participant Authentication" />
            {/* <Image src="https://place-hold.it/300x100" /> */}
            <Card.Content>
              <p>
                Restrict access to your KlickerUZH sessions by defining a list
                of authorized participants. After logging in using AAI or a
                username and password, authorized participants can vote on
                active polls exactly once.
              </p>
              <p>
                <span className="font-bold">Access Control</span>: restrict the
                vote to participants of a seminar or lecture by uploading your
                participant list. This ensures that no one else can cast a vote
                or influence the voting with malicious intent
              </p>
              <p>
                <span className="font-bold">Secret Voting</span>: besides
                restricting access, authenticated sessions also ensure that each
                participant can vote exactly once, as well as that nobody can
                view the specific vote of a participant. This makes the
                functionalitiy suitable for secret votes in committees or
                assemblies.
              </p>
            </Card.Content>

            <Card.Content extra className="flex items-center">
              <Label color="green">Released</Label>
              <Link href="https://uzh-bf.github.io/klicker-uzh/docs/advanced/participant_authentication">
                <a className="ml-4" target="_blank">
                  <Icon name="info circle" /> Usage Instructions
                </a>
              </Link>
            </Card.Content>
          </Card>
        </div>

        <div>
          <RoadmapItem
            fluid
            title="Scalability and Performance"
            description="Deployment to the Microsoft Azure cloud allows us to optimize the KlickerUZH for scalability and performance. Technical resources for automated deployment to the Azure platform will be provided as part of the open-source release."
            status={Status.WORKING_ON}
          >
            <Label>Fall 21</Label>
          </RoadmapItem>
        </div>
      </div>

      <h2 className="mt-16">Future Focus Areas</h2>

      <h3>2021-2023</h3>
      <p className="mb-4 prose prose-lg md:mb-8 max-w-none">
        As part of a project backed by the University of Zurich and
        swissuniversities, the KlickerUZH team will be working on several
        interesting focus areas over the coming years. We will be developing
        best practices and materials, as well as extending the KlickerUZH with
        capabilities that support each of these areas.
      </p>
      <div className="flex flex-col mb-8 md:flex-row">
        <Image
          className="w-56 mb-4 md:mb-0 md:mr-16 md:w-auto md:h-16"
          src="/img/logo_swissuniversities.png"
        />
        <Image
          className="w-56 mb-4 md:mb-0 md:w-auto md:h-16"
          src="/img/logo_uzh.jpeg"
        />
      </div>

      <Card.Group>
        <RoadmapItem
          title="Gamification and Engagement"
          description="The incorporation of gamified interactions allows lecturers to increase engagement in their (virtual) classrooms."
          status={Status.PLANNED}
        >
          <Label>Spring 22</Label>
        </RoadmapItem>

        <RoadmapItem
          title="Interaction"
          description="New interaction modalities for virtual and physical classrooms improve interaction between lecturers and participants."
          status={Status.PLANNED}
        >
          <Label>Spring 22</Label>
        </RoadmapItem>

        <RoadmapItem
          title="In-Depth Analysis"
          description="Analysis functionalities allow lecturers to evaluate their sessions and questions in terms of different quality dimensions."
          status={Status.PLANNED}
        >
          <Label>Fall 22</Label>
        </RoadmapItem>
      </Card.Group>

      <h2 className="mt-16">Get Involved</h2>
      <p className="mb-4 prose prose-lg max-w-none">
        We strive to develop our roadmap and goals based on the needs of our
        users. If you are interested in classroom interaction and would like to
        be involved in future developments, we welcome you to join our new
        KlickerUZH user group with the following form.
      </p>
      <div className="max-w-lg border">
        <div id="c7">
          Ausfüllen{' '}
          <a href="https://www.bf-tools.uzh.ch/applications/easyforms/index.php?r=app%2Fform&id=7">
            Online Formular
          </a>
          .
        </div>
      </div>
    </Container>
  )
}
