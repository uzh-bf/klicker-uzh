import React from 'react'
import { Container, Icon, Image, Segment } from 'semantic-ui-react'

const Section = ({ title, children }) => (
  <div className="section">
    <Container>
      {title && <h2>{title}</h2>}
      {children}
    </Container>

    <style jsx>{`
      .section {
        padding: 1.5rem 0;
        border-top: 1px solid lightgrey;
      }
    `}</style>
  </div>
)

Section.Part = ({ iconName, imageSrc, title, description }) => (
  <div className="sectionPart">
    <Segment>
      <div className="icon">
        {iconName && <Icon name={iconName} size="huge" />}
        {imageSrc && <Image src={imageSrc} />}
      </div>

      <h3>{title}</h3>
      <p>{description}</p>
    </Segment>

    <style jsx>{`
      .sectionPart {
        display: flex;
        flex-direction: column;
      }

      .sectionPart > .icon,
      .sectionPart > h3,
      .sectionPart > p {
        text-align: center;
      }
    `}</style>
  </div>
)

export default Section
