import { faArrowRight } from '@fortawesome/free-solid-svg-icons'
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome'
import { Button } from '@uzh-bf/design-system'

function TitleImage() {
  return (
    <>
      <div className="mt-10 md:mt-20">
        <div className="font-bold text-2xl md:text-4xl">
          Enhance your classroom experience.
        </div>
        <div className="text-lg md:text-2xl w-2/3">
          Take your classroom interaction now to the next level and increase
          your student's engagement.
        </div>
        <div className="mt-4 flex flex-row gap-2">
          <Button className={{ root: 'bg-primary-80 text-white font-bold' }}>
            <Button.Icon>
              <FontAwesomeIcon icon={faArrowRight} />
            </Button.Icon>
            <Button.Label>Sign Up</Button.Label>
          </Button>
          <Button>
            <Button.Icon>
              <FontAwesomeIcon icon={faArrowRight} />
            </Button.Icon>
            <Button.Label>Get Started</Button.Label>
          </Button>
        </div>
      </div>
      <div className="w-full h-80 bg-uzh-grey-20 my-10">
        PLACEHOLDER PHONE IMAGE LEFT OVERLAPPING ON LAPTOP RIGHT
      </div>
    </>
  )
}

export default TitleImage
