import {
  faArrowRight,
  faChevronDown,
  faChevronRight,
} from '@fortawesome/free-solid-svg-icons'
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome'
import ChevronRightIcon from '@mui/icons-material/ChevronRight'
import ExpandMoreIcon from '@mui/icons-material/ExpandMore'
import TreeItem from '@mui/lab/TreeItem'
import TreeView from '@mui/lab/TreeView'
import Layout from '@theme/Layout'
import { Button, H1, H2, H3 } from '@uzh-bf/design-system'
import { useCollapse } from 'react-collapsed'

export default function index() {
  const useCases = {
    live_quiz: {
      title: '(Gamified) Live Quizzes',
      imageSrc:
        'https://img.freepik.com/free-vector/web-help-support-page-template-design_1017-26772.jpg?w=996&t=st=1692859143~exp=1692859743~hmac=7f1540098197c20df60c26ceb08933f99857304b4aa230c0a795cd77d910323c',
      description:
        'Lorem ipsum dolor sit amet consectetur adipisicing elit. Mollitia expedita, corrupti odit animi ratione placeat est numquam distinctio cum illo! Qui animi possimus vitae architecto consequuntur sit neque. Qui, ipsa!',
      detailsRef: 'live_quiz',
    },
    flipped_classroom: {
      title: 'Flipped Classroom',
      imageSrc:
        'https://images.unsplash.com/photo-1516321318423-f06f85e504b3?ixlib=rb-4.0.3&ixid=M3wxMjA3fDB8MHxzZWFyY2h8Nnx8ZmxpcHBlZCUyMGNsYXNzcm9vbXxlbnwwfHwwfHx8MA%3D%3D&auto=format&fit=crop&w=800&q=60',
      description:
        'Lorem ipsum dolor sit amet consectetur adipisicing elit. Mollitia expedita, corrupti odit animi ratione placeat est numquam distinctio cum illo! Qui animi possimus vitae architecto consequuntur sit neque. Qui, ipsa!',
      detailsRef: 'flipped_classroom',
    },
    microlearning: {
      title: 'Microlearning',
      imageSrc:
        'https://images.unsplash.com/photo-1494059980473-813e73ee784b?ixlib=rb-4.0.3&ixid=M3wxMjA3fDB8MHxzZWFyY2h8MTV8fGxlYXJuaW5nfGVufDB8fDB8fHww&auto=format&fit=crop&w=800&q=60',
      description:
        'Lorem ipsum dolor sit amet consectetur adipisicing elit. Mollitia expedita, corrupti odit animi ratione placeat est numquam distinctio cum illo! Qui animi possimus vitae architecto consequuntur sit neque. Qui, ipsa!',
      detailsRef: 'microlearning',
    },
    flashcards: {
      title: 'Practice Quizzes and Flashcards',
      imageSrc:
        'https://images.unsplash.com/photo-1517429481096-5bc77134f77c?ixlib=rb-4.0.3&ixid=M3wxMjA3fDB8MHxzZWFyY2h8MTF8fHF1aXp6fGVufDB8fDB8fHww&auto=format&fit=crop&w=800&q=60',
      description:
        'Lorem ipsum dolor sit amet consectetur adipisicing elit. Mollitia expedita, corrupti odit animi ratione placeat est numquam distinctio cum illo! Qui animi possimus vitae architecto consequuntur sit neque. Qui, ipsa!',
      detailsRef: 'flashcards',
    },
    group_activities: {
      title: 'Group Activities',
      imageSrc:
        'https://images.unsplash.com/photo-1582213782179-e0d53f98f2ca?ixlib=rb-4.0.3&ixid=M3wxMjA3fDB8MHxzZWFyY2h8M3x8Z3JvdXB8ZW58MHx8MHx8fDA%3D&auto=format&fit=crop&w=800&q=60',
      description:
        'Lorem ipsum dolor sit amet consectetur adipisicing elit. Mollitia expedita, corrupti odit animi ratione placeat est numquam distinctio cum illo! Qui animi possimus vitae architecto consequuntur sit neque. Qui, ipsa!',
      detailsRef: 'group_activities',
    },
    live_qa: {
      title: 'Live Q&A and Real-Time Feedback',
      imageSrc:
        'https://images.unsplash.com/photo-1657987974860-a2b837df5fc0?ixlib=rb-4.0.3&ixid=M3wxMjA3fDB8MHxzZWFyY2h8MTJ8fFElMjZBfGVufDB8fDB8fHww&auto=format&fit=crop&w=800&q=60',
      description:
        'Lorem ipsum dolor sit amet consectetur adipisicing elit. Mollitia expedita, corrupti odit animi ratione placeat est numquam distinctio cum illo! Qui animi possimus vitae architecto consequuntur sit neque. Qui, ipsa!',
      detailsRef: 'live_qa',
    },
    gamification: {
      title: 'Gamification',
      imageSrc:
        'https://images.unsplash.com/photo-1553481187-be93c21490a9?ixlib=rb-4.0.3&ixid=M3wxMjA3fDB8MHxzZWFyY2h8Mnx8Z2FtZXxlbnwwfHwwfHx8MA%3D%3D&auto=format&fit=crop&w=800&q=60',
      description:
        'Lorem ipsum dolor sit amet consectetur adipisicing elit. Mollitia expedita, corrupti odit animi ratione placeat est numquam distinctio cum illo! Qui animi possimus vitae architecto consequuntur sit neque. Qui, ipsa!',
      detailsRef: 'gamification',
    },
  }

  return (
    <Layout>
      <div className="grid items-start grid-cols-5 gap-4 p-4 pt-8">
        <div className="hidden col-span-1 border shadow rounded-xl md:grid">
          <TreeView
            aria-label="file system navigator"
            defaultCollapseIcon={<ExpandMoreIcon />}
            defaultExpandIcon={<ChevronRightIcon />}
            multiSelect
          >
            <TreeItem nodeId="1" label="📚 Use Cases">
              <TreeItem nodeId="2" label="📣 Strengthen Interaction">
                <TreeItem nodeId="3" label="(Gamified) Live Quizzes" />
                <TreeItem nodeId="4" label="Live Q&A and Real-Time Feedback" />
                <TreeItem nodeId="5" label="Group Activities" />
                <TreeItem nodeId="6" label="Flipped Classroom" />
              </TreeItem>
              <TreeItem nodeId="7" label="🕹️ Implement Gamification Elements">
                <TreeItem nodeId="8" label="Gamification" />
                <TreeItem nodeId="9" label="(Gamified) Live Quizzes" />
                <TreeItem nodeId="10" label="Practice Quizzes and Flashcards" />
                <TreeItem nodeId="11" label="Microlearning" />
                <TreeItem nodeId="12" label="Group Activities" />
              </TreeItem>
              <TreeItem nodeId="13" label="📝 Receive Knowledge Feedback">
                <TreeItem nodeId="14" label="(Gamified) Live Quizzes" />
                <TreeItem nodeId="15" label="Practice Quizzes and Flashcards" />
                <TreeItem nodeId="16" label="Microlearning" />
                <TreeItem nodeId="17" label="Flipped Classroom" />
              </TreeItem>
              <TreeItem nodeId="18" label="🌍 Learning Beyond Classroom">
                <TreeItem nodeId="19" label="Practice Quizzes and Flashcards" />
                <TreeItem nodeId="20" label="Microlearning" />
                <TreeItem nodeId="21" label="Group Activities" />
              </TreeItem>
            </TreeItem>
          </TreeView>
        </div>
        <div className="col-span-5 md:col-span-4">
          <H1 className={{ root: 'max-w-6xl ' }}>Use Cases</H1>
          {Object.keys(useCases).map((keyName, i) => (
            <Card
              title={useCases[keyName].title}
              image={useCases[keyName].imageSrc}
              detailsRef={useCases[keyName].detailsRef}
            >
              {useCases[keyName].description}
            </Card>
          ))}
        </div>
      </div>
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

function Card({ title, image, children, detailsRef }) {
  return (
    <div className="flex flex-row mt-4 max-h-80 rounded-xl bg-slate-100">
      <div className="flex flex-col justify-center flex-1 p-8 md:p-16">
        <H3 className={{ root: 'text-xl' }}>{title}</H3>
        <p className="font-sans text-lg">{children}</p>
        <div>
          <Button
            onClick={() => window.open(`/use_cases/${detailsRef}`, '_self')}
          >
            <>
              <FontAwesomeIcon icon={faArrowRight} />
              Read More
            </>
          </Button>
        </div>
      </div>
      <div className="relative items-center flex-1 hidden justify-items-center md:flex">
        <img className="object-cover w-full h-full rounded-r-xl" src={image} />
      </div>
    </div>
  )
}
