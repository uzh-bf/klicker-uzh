import React from 'react'
import { Container, Icon, Image, Segment } from 'semantic-ui-react'

function Section({ title, children }: { title?: string; children: any }) {
  return (
    <div className="py-8 border-t border-gray-200">
      <Container>
        {title && <h2>{title}</h2>}
        {children}
      </Container>
    </div>
  )
}

Section.Part = function SectionPart({
  iconName,
  imageSrc,
  title,
  description,
}) {
  return (
    <div className="flex flex-col">
      <Segment>
        <div className="text-center ">
          {iconName && <Icon name={iconName} size="huge" />}
          {imageSrc && <Image src={imageSrc} />}
        </div>

        <h3 className="text-center">{title}</h3>
        <p className="text-center">{description}</p>
      </Segment>
    </div>
  )
}

export default Section
