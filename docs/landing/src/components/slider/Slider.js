import React from 'react'
import SlickSlider from 'react-slick'
import { Container, Grid, Image } from 'semantic-ui-react'
import 'slick-carousel/slick/slick.css'
import 'slick-carousel/slick/slick-theme.css'

const Slider = ({ children }) => (
  <div className="klicker-slider">
    <Container>
      <SlickSlider
        dots
        infinite
        speed={500}
        slidesToShow={1}
        slidesToScroll={1}
      >
        {children}
      </SlickSlider>
    </Container>

    <style jsx global>{`
      .slick-slider {
        padding: 1rem;
      }
    `}</style>

    <style jsx>{`
      .klicker-slider {
        background-color: #b2defc;
        margin-bottom: 1rem;
      }
    `}</style>
  </div>
)

Slider.Item = ({ title, description, imageSrc, children }) => (
  <div className="sliderItem">
    <Grid stackable reversed="mobile">
      <Grid.Column width={1} />
      <Grid.Column verticalAlign="middle" width={5}>
        <h2>{title}</h2>
        <p>{description}</p>
        <div className="actions">{children}</div>
      </Grid.Column>
      <Grid.Column width={1} />
      <Grid.Column verticalAlign="middle" width={9}>
        <div className="image">
          <Image fluid src={imageSrc} />
        </div>
      </Grid.Column>
    </Grid>

    <style jsx>{`
      .sliderItem > p {
        color: #375164;
      }

      .sliderItem > .image {
        border: 1px solid lightgrey;
      }

      .sliderItem > .actions {
        margin-top: 1rem;
      }
    `}</style>
  </div>
)

Slider.Embed = ({ children }) => (
  <div className="sliderItem">
    <Grid>
      <Grid.Column width={3} />
      <Grid.Column verticalAlign="middle" width={10}>
        {children}
      </Grid.Column>
      <Grid.Column width={3} />
    </Grid>

    <style jsx>{`
      .sliderItem {
        padding: 1ren;
      }

      .sliderItem > p {
        color: #375164;
      }

      .sliderItem > .actions {
        margin-top: 1rem;
      }
    `}</style>
  </div>
)

export default Slider
