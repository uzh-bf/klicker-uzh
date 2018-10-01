import React from 'react'
import { Button, Grid, Image, List, Embed } from 'semantic-ui-react'

import KlickerUZH from '../components/common/KlickerUZH'
import Layout from '../components/layouts/Layout'
import Slider from '../components/slider/Slider'
import Section from '../components/section/Section'
import FeatureOverview from '../components/section/FeatureOverview'

import questionPoolMacPNG from '../img/question_pool_mac.png'
import evaluationMacPNG from '../img/evaluation_mac.png'
import iphonePNG from '../img/iphone.png'
import codePNG from '../img/code.png'

export default () => (
  <Layout>
    <Slider>
      <Slider.Item
        title={<KlickerUZH />}
        description="Now released in version 2.0"
        imageSrc={questionPoolMacPNG}
      >
        <a
          href="https://app.klicker.uzh.ch/user/registration"
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
      </Slider.Item>
      <Slider.Item
        title={<KlickerUZH />}
        description="Now released in version 2.0"
        imageSrc={evaluationMacPNG}
      >
        <a
          href="https://app.klicker.uzh.ch/user/registration"
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
      </Slider.Item>
      <Slider.Embed>
        <Embed
          id="Dpx7BWKeqlo"
          placeholder="/images/image-16by9.png"
          source="youtube"
        />
      </Slider.Embed>
    </Slider>

    <div className="sections">
      <Section>
        <Grid stackable>
          <Grid.Row>
            <Grid.Column verticalAlign="middle" width={5}>
              <Image src={iphonePNG} />
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
                  Based on the newly introduced question pool, lecturers can
                  manage all their past as well as future questions in one
                  place. The advanced question management allows lecturers to
                  create and arrange questions into sessions prior to their
                  lectures, allowing them to plan their lectures in advance.
                </FeatureOverview.Item>
                <FeatureOverview.Item title="Dedicated Presentation Mode">
                  With the dedicated presentation mode, lecturers always have
                  the most important information available at a glance. The
                  session evaluation screen can be displayed independently from
                  the remainder of the application and is purely focused on
                  presenting the results of an evaluation as cleanly as
                  possible.
                </FeatureOverview.Item>
                <FeatureOverview.Item title="Advanced Question Types">
                  <KlickerUZH fontSize={1} /> offers a range of different
                  question types such as single choice (SC), multiple choice
                  (MC), free text (FT), and number ranges (NR). As an additional
                  feature, solutions can be defined and displayed for SC and MC
                  questions. Further question types are still on the roadmap.
                </FeatureOverview.Item>
                <FeatureOverview.Item title="Integrated Feedback-Channel">
                  The integrated feedback channel and confusion barometer allow
                  lecturers to receive instant feedback on the difficulty and
                  speed of their lecture and enable them to react to any
                  occurring questions and problems on the fly.
                </FeatureOverview.Item>
                <FeatureOverview.Item title="Multi-Language Support">
                  <KlickerUZH fontSize={1} /> is already available in German and
                  English. It was made to be easily extendable to further
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
                <FeatureOverview.Item>
                  The development and sources of <KlickerUZH fontSize={1} /> are
                  completely open source. This gives lecturers the potential to
                  implement their own visualizations, languages, or even
                  question types. Contributions and feedbacks are always
                  welcome!
                </FeatureOverview.Item>
                <FeatureOverview.Item title="Project Documentation">
                  The project documentation is available on{' '}
                  <a href="https://uzh-bf.github.io/klicker-uzh/">
                    klicker-uzh
                  </a>{' '}
                  and is being updated regularly. A major upcoming addition
                  includes contents on the architecture of the application as
                  well as possible ways of collaborating with the project.
                </FeatureOverview.Item>
                <FeatureOverview.Item title="Project Sources">
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
                </FeatureOverview.Item>
              </FeatureOverview>
            </Grid.Column>
            <Grid.Column verticalAlign="middle" width={9}>
              <Image src={codePNG} />
            </Grid.Column>
          </Grid.Row>
        </Grid>
      </Section>
    </div>

    <style jsx>{`
      .sections {
        padding: 1rem 10%;
      }
    `}</style>
  </Layout>
)
