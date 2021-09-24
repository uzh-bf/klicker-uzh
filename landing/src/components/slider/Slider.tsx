import React from 'react'
import SlickSlider from 'react-slick'
import { Container, Grid, Image } from 'semantic-ui-react'

import 'slick-carousel/slick/slick.css'
import 'slick-carousel/slick/slick-theme.css'

function Slider({ children }) {
  return (
    <div className="bg-[#b2defc] mb-4">
      <Container>
        <SlickSlider
          dots
          infinite
          className="p-4"
          speed={500}
          slidesToShow={1}
          slidesToScroll={1}
        >
          {children}
        </SlickSlider>
      </Container>
    </div>
  )
}

Slider.Item = function SliderItem({ title, description, imageSrc, children }) {
  return (
    <div>
      <Grid stackable reversed="mobile">
        <Grid.Column width={1} />
        <Grid.Column verticalAlign="middle" width={5}>
          <h2 className="mb-4">{title}</h2>
          <p className="text-[#375164]">{description}</p>
          <div className="mt-4">{children}</div>
        </Grid.Column>
        <Grid.Column width={1} />
        <Grid.Column verticalAlign="middle" width={9}>
          <div>
            <Image fluid src={imageSrc} />
          </div>
        </Grid.Column>
      </Grid>
    </div>
  )
}

Slider.Embed = function SliderEmbed({ children }) {
  return (
    <div className="p-4">
      <Grid>
        <Grid.Column width={3} />
        <Grid.Column verticalAlign="middle" width={10}>
          {children}
        </Grid.Column>
        <Grid.Column width={3} />
      </Grid>
    </div>
  )
}

export default Slider
