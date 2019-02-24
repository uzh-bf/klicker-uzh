/**
 * Copyright (c) 2017-present, Facebook, Inc.
 *
 * This source code is licensed under the MIT license found in the
 * LICENSE file in the root directory of this source tree.
 */

const React = require('react')

const CompLibrary = require('../../core/CompLibrary.js')
const MarkdownBlock = CompLibrary.MarkdownBlock /* Used to read markdown */
const Container = CompLibrary.Container
const GridBlock = CompLibrary.GridBlock

const siteConfig = require(process.cwd() + '/siteConfig.js')

function imgUrl(img) {
  return siteConfig.baseUrl + 'img/' + img
}

function docUrl(doc, language) {
  return siteConfig.baseUrl + 'docs/' + (language ? language + '/' : '') + doc
}

function pageUrl(page, language) {
  return siteConfig.baseUrl + (language ? language + '/' : '') + page
}

class Button extends React.Component {
  render() {
    return (
      <div className="pluginWrapper buttonWrapper">
        <a className="button" href={this.props.href} target={this.props.target}>
          {this.props.children}
        </a>
      </div>
    )
  }
}

Button.defaultProps = {
  target: '_self',
}

const SplashContainer = props => (
  <div className="homeContainer">
    <div className="homeSplashFade">
      <div className="wrapper homeWrapper">{props.children}</div>
    </div>
  </div>
)

const ProjectTitle = props => (
  <h2 className="projectTitle">
    {siteConfig.title_index}
    <span>{siteConfig.subtitle_index}</span>
    <small>{siteConfig.tagline}</small>
  </h2>
)

const PromoSection = props => (
  <div className="section promoSection">
    <div className="promoRow">
      <div className="pluginRowBlock">{props.children}</div>
    </div>
  </div>
)

class HomeSplash extends React.Component {
  render() {
    let language = this.props.language || ''
    return (
      <SplashContainer>
        <div className="inner">
          <ProjectTitle />
          <PromoSection>
            <Button href={docUrl('introduction/getting_started', language)}>
              Getting started
            </Button>
            <Button href={docUrl('faq/faq', language)}>FAQ</Button>
            <Button href={'https://app.klicker.uzh.ch'} target={'blank'}>
              Open Application
            </Button>
          </PromoSection>
        </div>
      </SplashContainer>
    )
  }
}

const Block = props => (
  <Container padding={['bottom']} id={props.id} background={props.background}>
    <GridBlock align="center" contents={props.children} layout={props.layout} />
  </Container>
)

const FeaturesHeader = props => (
  <div
    className="productShowcaseSection"
    style={{ textAlign: 'center', marginBottom: '20px' }}
  >
    <h2>New Features</h2>
  </div>
)

const Features = props => (
  <div>
    <Container padding={['bottom', 'top']} background="light">
      <GridBlock
        contents={[
          {
            content:
              'A global question pool simplifies question management and enables modularity and reusability.',
            image: imgUrl('question_pool.png'),
            imageAlign: 'right',
            title: 'Question Management',
          },
        ]}
        layout="twoColumn"
      />
    </Container>
    <Container padding={['bottom', 'top']}>
      <GridBlock
        contents={[
          {
            content:
              'Preparing sessions for lectures in advance and grouping questions into blocks make polling simple and well-structured.',
            image: imgUrl('question_pool.png'),
            imageAlign: 'left',
            title: 'Session Management',
          },
        ]}
        layout="twoColumn"
      />
    </Container>

    <Container padding={['bottom', 'top']} background="light">
      <GridBlock
        contents={[
          {
            content:
              'Questions are placed on a timeline that leads through an entire session in a predictable way.',
            image: imgUrl('running_session.gif'),
            imageAlign: 'left',
            title: 'Presentation Mode',
          },
        ]}
        layout="twoColumn"
      />
    </Container>
    <Container padding={['bottom', 'top']}>
      <GridBlock
        contents={[
          {
            content:
              'With feedback about speed and difficulty speakers get the chance to respond to their audience. ',
            image: imgUrl('feedback.png'),
            imageAlign: 'right',
            title: 'Instant Audience Feedback',
          },
        ]}
        layout="twoColumn"
      />
    </Container>
    <Container padding={['bottom', 'top']} background="light">
      <GridBlock
        contents={[
          {
            content:
              'Different question types allow for accurate and versatile responses and enable additional evaluation techniques.',
            image: imgUrl('question_types.png'),
            imageAlign: 'right',
            title: 'Question Types',
          },
        ]}
        layout="twoColumn"
      />
    </Container>
  </div>
)

const ChartsHeader = props => (
  <div
    className="productShowcaseSection"
    style={{ textAlign: 'center', marginBottom: '10px', paddingTop: '10px' }}
  >
    <h2>Evaluation and Charts</h2>
  </div>
)

const Charts = props => (
  <Container padding={['bottom']} background="light">
    <GridBlock
      align="center"
      contents={[
        {
          content: '',
          image: imgUrl('pie_chart.png'),
          imageAlign: 'bottom',
          title: 'Pie Chart (Single Choice)',
        },
        {
          content: '',
          image: imgUrl('bar_chart.png'),
          imageAlign: 'bottom',
          title: 'Bar Chart (Single Choice)',
        },
        {
          content: '',
          image: imgUrl('stacked_chart.png'),
          imageAlign: 'bottom',
          title: 'Stacked Chart (MC)',
        },
      ]}
      layout="threeColumn"
    />
    <br />
    <br />
    <GridBlock
      align="center"
      contents={[
        {
          content: '',
          image: imgUrl('word_cloud.png'),
          imageAlign: 'bottom',
          title: 'Word Cloud (Free Text)',
        },
        {
          content: '',
          image: imgUrl('histogram.png'),
          imageAlign: 'bottom',
          title: 'Histogram (Number Range)',
        },
      ]}
      layout="twoColumn"
    />
  </Container>
)

class Index extends React.Component {
  render() {
    let language = this.props.language || ''

    return (
      <div>
        <HomeSplash language={language} />

        <div className="mainContainer">
          <FeaturesHeader />
          <Features />
          <ChartsHeader />
          <Charts />
        </div>
      </div>
    )
  }
}

module.exports = Index
