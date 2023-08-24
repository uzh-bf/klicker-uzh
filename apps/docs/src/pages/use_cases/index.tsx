import {
  faArrowRight,
  faChevronDown,
  faChevronRight,
} from '@fortawesome/free-solid-svg-icons'
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome'
import Layout from '@theme/Layout'
import { Button, H1, H2, H3 } from '@uzh-bf/design-system'
import { useCollapse } from 'react-collapsed'

export default function index() {
  return (
    <Layout>
      <div className="w-full p-4 shadow bg-slate-100">
        <H1 className={{ root: 'mx-auto max-w-6xl lg:pl-4' }}>Use Cases</H1>
      </div>

      <Collapsible title={'Strenghten Interaction'} emoji={'📣'}>
        <Card
          title={'(Gamified) Live Quizzes'}
          image={
            'https://img.freepik.com/free-vector/web-help-support-page-template-design_1017-26772.jpg?w=996&t=st=1692859143~exp=1692859743~hmac=7f1540098197c20df60c26ceb08933f99857304b4aa230c0a795cd77d910323c'
          }
        >
          Lorem ipsum dolor sit amet consectetur adipisicing elit. Mollitia
          expedita, corrupti odit animi ratione placeat est numquam distinctio
          cum illo! Qui animi possimus vitae architecto consequuntur sit neque.
          Qui, ipsa!
        </Card>
        <Card
          title={'Live Q&A and Real-Time Feedback'}
          image={
            'https://images.unsplash.com/photo-1657987974860-a2b837df5fc0?ixlib=rb-4.0.3&ixid=M3wxMjA3fDB8MHxzZWFyY2h8MTJ8fFElMjZBfGVufDB8fDB8fHww&auto=format&fit=crop&w=800&q=60'
          }
        >
          Lorem ipsum dolor sit amet consectetur adipisicing elit. Mollitia
          expedita, corrupti odit animi ratione placeat est numquam distinctio
          cum illo! Qui animi possimus vitae architecto consequuntur sit neque.
          Qui, ipsa!
        </Card>
        <Card
          title={'Group Activities'}
          image={
            'https://images.unsplash.com/photo-1582213782179-e0d53f98f2ca?ixlib=rb-4.0.3&ixid=M3wxMjA3fDB8MHxzZWFyY2h8M3x8Z3JvdXB8ZW58MHx8MHx8fDA%3D&auto=format&fit=crop&w=800&q=60'
          }
        >
          Lorem ipsum dolor sit amet consectetur adipisicing elit. Mollitia
          expedita, corrupti odit animi ratione placeat est numquam distinctio
          cum illo! Qui animi possimus vitae architecto consequuntur sit neque.
          Qui, ipsa!
        </Card>
        <Card
          title={'Flipped Classroom'}
          image={
            'https://images.unsplash.com/photo-1516321318423-f06f85e504b3?ixlib=rb-4.0.3&ixid=M3wxMjA3fDB8MHxzZWFyY2h8Nnx8ZmxpcHBlZCUyMGNsYXNzcm9vbXxlbnwwfHwwfHx8MA%3D%3D&auto=format&fit=crop&w=800&q=60'
          }
        >
          Lorem ipsum dolor sit amet consectetur adipisicing elit. Mollitia
          expedita, corrupti odit animi ratione placeat est numquam distinctio
          cum illo! Qui animi possimus vitae architecto consequuntur sit neque.
          Qui, ipsa!
        </Card>
      </Collapsible>

      <Collapsible title={'Implement Gamification Elements'} emoji={'🕹️'}>
        <Card
          title={'Gamification'}
          image={
            'https://images.unsplash.com/photo-1553481187-be93c21490a9?ixlib=rb-4.0.3&ixid=M3wxMjA3fDB8MHxzZWFyY2h8Mnx8Z2FtZXxlbnwwfHwwfHx8MA%3D%3D&auto=format&fit=crop&w=800&q=60'
          }
        >
          Lorem ipsum dolor sit amet consectetur adipisicing elit. Mollitia
          expedita, corrupti odit animi ratione placeat est numquam distinctio
          cum illo! Qui animi possimus vitae architecto consequuntur sit neque.
          Qui, ipsa!
        </Card>
        <Card
          title={'(Gamified) Live Quizzes'}
          image={
            'https://img.freepik.com/free-vector/web-help-support-page-template-design_1017-26772.jpg?w=996&t=st=1692859143~exp=1692859743~hmac=7f1540098197c20df60c26ceb08933f99857304b4aa230c0a795cd77d910323c'
          }
        >
          Lorem ipsum dolor sit amet consectetur adipisicing elit. Mollitia
          expedita, corrupti odit animi ratione placeat est numquam distinctio
          cum illo! Qui animi possimus vitae architecto consequuntur sit neque.
          Qui, ipsa!
        </Card>
        <Card
          title={'Practice Quizzes And Flashcards'}
          image={
            'https://images.unsplash.com/photo-1517429481096-5bc77134f77c?ixlib=rb-4.0.3&ixid=M3wxMjA3fDB8MHxzZWFyY2h8MTF8fHF1aXp6fGVufDB8fDB8fHww&auto=format&fit=crop&w=800&q=60'
          }
        >
          Lorem ipsum dolor sit amet consectetur adipisicing elit. Mollitia
          expedita, corrupti odit animi ratione placeat est numquam distinctio
          cum illo! Qui animi possimus vitae architecto consequuntur sit neque.
          Qui, ipsa!
        </Card>
        <Card
          title={'Microlearning'}
          image={
            'https://images.unsplash.com/photo-1494059980473-813e73ee784b?ixlib=rb-4.0.3&ixid=M3wxMjA3fDB8MHxzZWFyY2h8MTV8fGxlYXJuaW5nfGVufDB8fDB8fHww&auto=format&fit=crop&w=800&q=60'
          }
        >
          Lorem ipsum dolor sit amet consectetur adipisicing elit. Mollitia
          expedita, corrupti odit animi ratione placeat est numquam distinctio
          cum illo! Qui animi possimus vitae architecto consequuntur sit neque.
          Qui, ipsa!
        </Card>
        <Card
          title={'Group Activities'}
          image={
            'https://images.unsplash.com/photo-1582213782179-e0d53f98f2ca?ixlib=rb-4.0.3&ixid=M3wxMjA3fDB8MHxzZWFyY2h8M3x8Z3JvdXB8ZW58MHx8MHx8fDA%3D&auto=format&fit=crop&w=800&q=60'
          }
        >
          Lorem ipsum dolor sit amet consectetur adipisicing elit. Mollitia
          expedita, corrupti odit animi ratione placeat est numquam distinctio
          cum illo! Qui animi possimus vitae architecto consequuntur sit neque.
          Qui, ipsa!
        </Card>
      </Collapsible>

      <Collapsible title={'Receive Knowledge Feedback'} emoji={'📝'}>
        <Card
          title={'(Gamified) Live Quizzes'}
          image={
            'https://img.freepik.com/free-vector/web-help-support-page-template-design_1017-26772.jpg?w=996&t=st=1692859143~exp=1692859743~hmac=7f1540098197c20df60c26ceb08933f99857304b4aa230c0a795cd77d910323c'
          }
        >
          Lorem ipsum dolor sit amet consectetur adipisicing elit. Mollitia
          expedita, corrupti odit animi ratione placeat est numquam distinctio
          cum illo! Qui animi possimus vitae architecto consequuntur sit neque.
          Qui, ipsa!
        </Card>
        <Card
          title={'Practice Quizzes And Flashcards'}
          image={
            'https://images.unsplash.com/photo-1517429481096-5bc77134f77c?ixlib=rb-4.0.3&ixid=M3wxMjA3fDB8MHxzZWFyY2h8MTF8fHF1aXp6fGVufDB8fDB8fHww&auto=format&fit=crop&w=800&q=60'
          }
        >
          Lorem ipsum dolor sit amet consectetur adipisicing elit. Mollitia
          expedita, corrupti odit animi ratione placeat est numquam distinctio
          cum illo! Qui animi possimus vitae architecto consequuntur sit neque.
          Qui, ipsa!
        </Card>
        <Card
          title={'Microlearning'}
          image={
            'https://images.unsplash.com/photo-1494059980473-813e73ee784b?ixlib=rb-4.0.3&ixid=M3wxMjA3fDB8MHxzZWFyY2h8MTV8fGxlYXJuaW5nfGVufDB8fDB8fHww&auto=format&fit=crop&w=800&q=60'
          }
        >
          Lorem ipsum dolor sit amet consectetur adipisicing elit. Mollitia
          expedita, corrupti odit animi ratione placeat est numquam distinctio
          cum illo! Qui animi possimus vitae architecto consequuntur sit neque.
          Qui, ipsa!
        </Card>
        <Card
          title={'Flipped Classroom'}
          image={
            'https://images.unsplash.com/photo-1516321318423-f06f85e504b3?ixlib=rb-4.0.3&ixid=M3wxMjA3fDB8MHxzZWFyY2h8Nnx8ZmxpcHBlZCUyMGNsYXNzcm9vbXxlbnwwfHwwfHx8MA%3D%3D&auto=format&fit=crop&w=800&q=60'
          }
        >
          Lorem ipsum dolor sit amet consectetur adipisicing elit. Mollitia
          expedita, corrupti odit animi ratione placeat est numquam distinctio
          cum illo! Qui animi possimus vitae architecto consequuntur sit neque.
          Qui, ipsa!
        </Card>
      </Collapsible>

      <Collapsible title={'Learning Beyond Classroom'} emoji={'🌍'}>
        <Card
          title={'Practice Quizzes And Flashcards'}
          image={
            'https://images.unsplash.com/photo-1517429481096-5bc77134f77c?ixlib=rb-4.0.3&ixid=M3wxMjA3fDB8MHxzZWFyY2h8MTF8fHF1aXp6fGVufDB8fDB8fHww&auto=format&fit=crop&w=800&q=60'
          }
        >
          Lorem ipsum dolor sit amet consectetur adipisicing elit. Mollitia
          expedita, corrupti odit animi ratione placeat est numquam distinctio
          cum illo! Qui animi possimus vitae architecto consequuntur sit neque.
          Qui, ipsa!
        </Card>
        <Card
          title={'Microlearning'}
          image={
            'https://images.unsplash.com/photo-1494059980473-813e73ee784b?ixlib=rb-4.0.3&ixid=M3wxMjA3fDB8MHxzZWFyY2h8MTV8fGxlYXJuaW5nfGVufDB8fDB8fHww&auto=format&fit=crop&w=800&q=60'
          }
        >
          Lorem ipsum dolor sit amet consectetur adipisicing elit. Mollitia
          expedita, corrupti odit animi ratione placeat est numquam distinctio
          cum illo! Qui animi possimus vitae architecto consequuntur sit neque.
          Qui, ipsa!
        </Card>
        <Card
          title={'Group Activities'}
          image={
            'https://images.unsplash.com/photo-1582213782179-e0d53f98f2ca?ixlib=rb-4.0.3&ixid=M3wxMjA3fDB8MHxzZWFyY2h8M3x8Z3JvdXB8ZW58MHx8MHx8fDA%3D&auto=format&fit=crop&w=800&q=60'
          }
        >
          Lorem ipsum dolor sit amet consectetur adipisicing elit. Mollitia
          expedita, corrupti odit animi ratione placeat est numquam distinctio
          cum illo! Qui animi possimus vitae architecto consequuntur sit neque.
          Qui, ipsa!
        </Card>
      </Collapsible>
    </Layout>
  )
}

function Collapsible({ title, emoji, children }) {
  const { getCollapseProps, getToggleProps, isExpanded } = useCollapse()
  return (
    <div className="w-full max-w-6xl p-4 m-auto ">
      <div {...getToggleProps()} className="flex flex-row items-center gap-2 ">
        {isExpanded ? (
          <FontAwesomeIcon icon={faChevronDown} />
        ) : (
          <FontAwesomeIcon icon={faChevronRight} />
        )}
        <H2>{title}</H2>
        {emoji}
      </div>
      <hr className="h-1 m-0 bg-black rounded" />
      <section {...getCollapseProps()}>{children}</section>
    </div>
  )
}

function Card({ title, image, children }) {
  return (
    <div className="flex flex-row mt-4 max-h-80 bg-slate-100">
      <div className="flex flex-col justify-center flex-1 p-8 md:p-16">
        <H3 className={{ root: 'text-xl' }}>{title}</H3>
        <p className="font-sans text-lg">{children}</p>
        <div>
          <Button>
            <>
              <FontAwesomeIcon icon={faArrowRight} />
              Read More
            </>
          </Button>
        </div>
      </div>
      <div className="relative items-center flex-1 hidden justify-items-center md:flex">
        <img className="object-cover w-full h-full" src={image} />
      </div>
    </div>
  )
}
