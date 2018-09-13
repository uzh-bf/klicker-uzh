/**
 * Copyright (c) 2017-present, Facebook, Inc.
 *
 * This source code is licensed under the MIT license found in the
 * LICENSE file in the root directory of this source tree.
 */

const React = require('react');

const CompLibrary = require('../../core/CompLibrary.js');
const MarkdownBlock = CompLibrary.MarkdownBlock; /* Used to read markdown */
const Container = CompLibrary.Container;
const GridBlock = CompLibrary.GridBlock;

const siteConfig = require(process.cwd() + '/siteConfig.js');

function imgUrl(img) {
  return siteConfig.baseUrl + 'img/' + img;
}

function docUrl(doc, language) {
  return siteConfig.baseUrl + 'docs/' + (language ? language + '/' : '') + doc;
}

function pageUrl(page, language) {
  return siteConfig.baseUrl + (language ? language + '/' : '') + page;
}

class Button extends React.Component {
  render() {
    return (
      <div className="pluginWrapper buttonWrapper">
        <a className="button" href={this.props.href} target={this.props.target}>
          {this.props.children}
        </a>
      </div>
    );
  }
}

Button.defaultProps = {
  target: '_self',
};

const SplashContainer = props => (
  <div className="homeContainer">
    <div className="homeSplashFade">
      <div className="wrapper homeWrapper">{props.children}</div>
    </div>
  </div>
);

const ProjectTitle = props => (
  <h2 className="projectTitle">
    {siteConfig.title_index}
    <span>{siteConfig.subtitle_index}</span>
    <small>{siteConfig.tagline}</small>
  </h2>
);

const PromoSection = props => (
  <div className="section promoSection">
    <div className="promoRow">
      <div className="pluginRowBlock">{props.children}</div>
    </div>
  </div>
);

class HomeSplash extends React.Component {
  render() {
    let language = this.props.language || '';
    return (
      <SplashContainer>
        <div className="inner">
          <ProjectTitle />
          <PromoSection>
            <Button href={'https://beta.klicker.uzh.ch'} target={'blank'}>Klicker Application</Button>
            <Button href={docUrl('introduction.html', language)}>How to use Klicker</Button>
            <Button href={docUrl('faq.html', language)}>FAQ</Button>
          </PromoSection>
        </div>
      </SplashContainer>
    );
  }
}

const Block = props => (
  <Container
    padding={['bottom']}
    id={props.id}
    background={props.background}>
    <GridBlock align="center" contents={props.children} layout={props.layout} />
  </Container>
);

const NewFeatures = props => (
  <div
    className="productShowcaseSection"
    style={{textAlign: 'center', marginBottom: '20px'}}>
    <h2>New Features</h2>
    <MarkdownBlock>The new Klicker provides a lot of new features!</MarkdownBlock>
  </div>
);

const Features1 = props => (
  <div>
    <Container padding={["bottom", "top"]} background="light">
      <GridBlock
        contents={[
          {
            content: 'Preparing sessions for speeches or lectures in advance and grouping questions make the application of Klicker simpler and more structured.',
            image: imgUrl('question_pool.png'),
            imageAlign: 'right',
            title: 'Revised Question Management',
          }
        ]}
        layout="twoColumn"
      />
  </Container>
  <Container padding={["bottom", "top"]}>
      <GridBlock
        contents={[
          {
            content: 'New question types allow more accurate and versatile responses and enable additional evaluation techniques.',
            image: imgUrl('question_types.png'),
            imageAlign: 'left',
            title: 'Additional Question Types',
          }
        ]}
        layout="twoColumn"
      />
    </Container>
  </div>
);

const ImprovedCharts = props => (
  <div
    className="productShowcaseSection lightBackground"
    style={{textAlign: 'center', marginBottom: '10px', paddingTop: '10px'}}>
    <h2>Improved and Additional Charts</h2>
  </div>
);

const Charts = props => (
  <Container padding={["bottom"]} background="light">
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
          title: 'Stacked Chart (Multiple Choice)',
        }
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
        }
      ]}
      layout="twoColumn"
    />
  </Container>
);

const Features2 = props => (
  <div>
    <Container padding={["bottom", "top"]}>
      <GridBlock
        contents={[
          {
            content: 'With feedback about speed and difficulty speakers get the chance to respond to their audience. ',
            image: imgUrl('feedback.png'),
            imageAlign: 'right',
            title: 'Instant Audience Feedback',
          }
        ]}
        layout="twoColumn"
      />
    </Container>
    <Container padding={["bottom", "top"]} background="light">
      <GridBlock
        contents={[
          {
            content: 'The question blocks containing all the questions for the audience are placed on a timeline that leads through the speech.',
            image: imgUrl('running_session.gif'),
            imageAlign: 'left',
            title: 'Advanced Presentation Mode',
          }
        ]}
        layout="twoColumn"
      />
    </Container>
  </div>
);

class Index extends React.Component {
  render() {
    let language = this.props.language || '';

    return (
      <div>
        <HomeSplash language={language} />
        
        <div className="mainContainer">
          <NewFeatures />
          <Features1 />
          <ImprovedCharts />
          <Charts />
          <Features2 />
        </div>
        
      </div>
    );
  }
}

module.exports = Index;
