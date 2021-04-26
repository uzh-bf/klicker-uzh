import React, { useState, useEffect } from 'react'
import { Button, Grid, Image, List, Message } from 'semantic-ui-react'
import axios from 'axios'

import KlickerUZH from '../components/common/KlickerUZH'
import Slider from '../components/slider/Slider'
import Section from '../components/section/Section'
import FeatureOverview from '../components/section/FeatureOverview'

async function pingKlickerEndpoint({
  serviceName,
  callback,
  path = '',
  method = 'get',
}) {
  try {
    await axios({
      method,
      url: `https://${serviceName}.klicker.uzh.ch${path}`,
      timeout: 1500,
    } as any)
    callback(true)
  } catch (error) {
    console.log(error)
    callback(false)
  }
}

function Buttons() {
  return (
    <>
      <a
        href="https://uzh-bf.github.io/klicker-uzh/docs/introduction/getting_started"
        target="_blank"
        rel="noopener noreferrer"
      >
        <Button primary>Get Started</Button>
      </a>
      <a
        href="https://app.klicker.uzh.ch/user/login"
        target="_blank"
        rel="noopener noreferrer"
      >
        <Button primary>Login</Button>
      </a>
    </>
  )
}

export default function Index() {
  const [isAppAvailable, setIsAppAvailable] = useState(null)
  // const [isApiAvailable, setIsApiAvailable] = useState(null)
  // const [isAaiAvailable, setIsAaiAvailable] = useState(null)

  useEffect(() => {
    async function pingKlickerEndpoints() {
      pingKlickerEndpoint({
        serviceName: 'app',
        callback: setIsAppAvailable,
      })
      // pingKlickerEndpoint({
      //   serviceName: 'api',
      //   callback: setIsApiAvailable,
      //   path: '/graphql',
      //   method: 'post',
      // })
      // pingKlickerEndpoint({
      //   serviceName: 'aai',
      //   callback: setIsAaiAvailable,
      // })
    }

    pingKlickerEndpoints()
  }, [])

  return (
    <div>
      {isAppAvailable === false && (
        <div className="max-w-3xl m-auto mb-4">
          <Message error>
            The Klicker is unavailable at the moment. We are trying to fix the
            problem as quickly as possible. <br />
            You can get updates on our{' '}
            <a
              target="_blank"
              rel="noopener noreferrer"
              href="https://uptime.statuscake.com/?TestID=AEHThYQ2ig"
            >
              status page
            </a>
            . Please excuse the inconvenience and try again later.
            <Message.List>
              <Message.Item>
                Frontend - {isAppAvailable ? 'UP' : 'DOWN'}
              </Message.Item>
              {/* <Message.Item>
              Backend - {isApiAvailable ? 'UP' : 'DOWN'}
            </Message.Item> */}
              {/* <Message.Item>
                AAI - {isAaiAvailable ? 'UP' : 'DOWN'}
              </Message.Item> */}
            </Message.List>
          </Message>
        </div>
      )}

      <Slider>
        <Slider.Item
          title={<KlickerUZH />}
          description="The question pool enables lecturers to manage all of their past and future questions in one place."
          imageSrc="/img/question_pool_mac_small.png"
        >
          <Buttons />
        </Slider.Item>
        <Slider.Item
          title={<KlickerUZH />}
          description="The dedicated evaluation screen offers a clean presentation of the results."
          imageSrc="/img/evaluation_mac_small.png"
        >
          <Buttons />
        </Slider.Item>
        <Slider.Item
          title={<KlickerUZH />}
          description="The running session cockpit guides through the previously created sessions."
          imageSrc="/img/running_session_mac_small.png"
        >
          <Buttons />
        </Slider.Item>
        {/* <Slider.Embed>
        <Embed
          id="Dpx7BWKeqlo"
          placeholder="/images/image-16by9.png"
          source="youtube"
        />
      </Slider.Embed> */}
      </Slider>

      <div className="py-4 px-[10%]">
        <Section>
          <Grid stackable>
            <Grid.Row>
              <Grid.Column verticalAlign="middle" width={5}>
                <Image src="/img/iphone.png" />
              </Grid.Column>
              <Grid.Column verticalAlign="middle" width={10}>
                <FeatureOverview
                  icon="chart line"
                  title={
                    <div>
                      Features of <KlickerUZH />
                    </div>
                  }
                >
                  <FeatureOverview.Item title="Question &amp; Session Management">
                    Based on the question pool, lecturers can manage all their
                    past as well as future questions in one place. The advanced
                    question management enables lecturers to create and arrange
                    questions into sessions prior to their lectures, allowing
                    them to plan their lectures in advance.
                  </FeatureOverview.Item>
                  <FeatureOverview.Item title="Dedicated Presentation Mode">
                    With the dedicated presentation mode, lecturers always have
                    the most important information available at a glance. The
                    session evaluation screen can be displayed independent of
                    the remainder of the application and is purely dedicated to
                    a clean presentation of the results.
                  </FeatureOverview.Item>
                  <FeatureOverview.Item title="Advanced Question Types">
                    <KlickerUZH fontSize={1} /> offers a range of different
                    question types such as single choice (SC), multiple choice
                    (MC), free text (FT), and numerical (NR). As an additional
                    feature, solutions can be defined and displayed for SC and
                    MC questions. Further question types are still on the
                    roadmap.
                  </FeatureOverview.Item>
                  <FeatureOverview.Item title="Integrated Feedback-Channel">
                    The integrated feedback channel and confusion barometer
                    allow lecturers to receive instant feedback on the
                    difficulty and speed of their lecture and enable them to
                    react to any occurring questions and problems on the fly.
                  </FeatureOverview.Item>
                  <FeatureOverview.Item title="Multi-Language Support">
                    <KlickerUZH fontSize={1} /> is already available in German
                    and English. It was made to be easily extendable to further
                    languages.
                  </FeatureOverview.Item>
                </FeatureOverview>
              </Grid.Column>
            </Grid.Row>
          </Grid>
        </Section>

        <Section>
          <Grid stackable>
            <Grid.Row>
              <Grid.Column verticalAlign="middle" width={7}>
                <FeatureOverview icon="github" title="Open Source">
                  The development and sources of <KlickerUZH fontSize={1} /> are
                  completely open source. This gives users the potential to
                  implement their own visualizations, languages, or even
                  question types. Contributions and feedbacks are always
                  welcome!
                  <List>
                    <List.Item>
                      <List.Icon name="github" />
                      <List.Content>
                        <a href="https://github.com/uzh-bf/klicker-react">
                          klicker-react - React/NextJS Frontend
                        </a>
                      </List.Content>
                    </List.Item>
                    <List.Item>
                      <List.Icon name="github" />
                      <List.Content>
                        <a href="https://github.com/uzh-bf/klicker-api">
                          klicker-api - GraphQL/NodeJS API
                        </a>
                      </List.Content>
                    </List.Item>
                    <List.Item>
                      <List.Icon name="github" />
                      <List.Content>
                        <a href="https://github.com/uzh-bf/klicker-uzh">
                          klicker-uzh - Documentation and Roadmap
                        </a>
                      </List.Content>
                    </List.Item>
                  </List>
                  The project documentation is available{' '}
                  <a href="https://uzh-bf.github.io/klicker-uzh/">online</a> and
                  is being updated for every release.
                </FeatureOverview>
              </Grid.Column>
              <Grid.Column verticalAlign="middle" width={9}>
                <Image src="/img/code.png" />
              </Grid.Column>
            </Grid.Row>
          </Grid>
        </Section>
      </div>
    </div>
  )
}
