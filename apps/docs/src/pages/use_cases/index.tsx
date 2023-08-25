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
import { useState } from 'react'
import { useCollapse } from 'react-collapsed'
import { useCases } from './constants'

export default function index() {
  const [filteredUseCases, setFilteredUseCases] = useState(useCases)

  const filteredByTitle = (title) => {
    setFilteredUseCases(useCases.filter((useCase) => useCase.title === title))
  }

  return (
    <Layout>
      <div className="grid items-start grid-cols-5 gap-4 p-4 pt-8 m-auto max-w-7xl">
        <div className="hidden col-span-1 border shadow rounded-xl md:grid">
          <TreeView
            aria-label="file system navigator"
            defaultCollapseIcon={<ExpandMoreIcon />}
            defaultExpandIcon={<ChevronRightIcon />}
            multiSelect
          >
            <TreeItem
              nodeId="1"
              label="📚 Use Cases"
              onClick={() => setFilteredUseCases(useCases)}
            >
              <TreeItem nodeId="2" label="📣 Strengthen Interaction">
                <TreeItem
                  nodeId="3"
                  label="(Gamified) Live Quizzes"
                  onClick={() => filteredByTitle('(Gamified) Live Quizzes')}
                />
                <TreeItem
                  nodeId="4"
                  label="Live Q&A and Real-Time Feedback"
                  onClick={() =>
                    filteredByTitle('Live Q&A and Real-Time Feedback')
                  }
                />
                <TreeItem
                  nodeId="5"
                  label="Group Activities"
                  onClick={() => filteredByTitle('Group Activities')}
                />
                <TreeItem
                  nodeId="6"
                  label="Flipped Classroom"
                  onClick={() => filteredByTitle('Flipped Classroom')}
                />
              </TreeItem>
              <TreeItem nodeId="7" label="🕹️ Implement Gamification Elements">
                <TreeItem
                  nodeId="8"
                  label="Gamification"
                  onClick={() => filteredByTitle('Gamification')}
                />
                <TreeItem
                  nodeId="9"
                  label="(Gamified) Live Quizzes"
                  onClick={() => filteredByTitle('(Gamified) Live Quizzes')}
                />
                <TreeItem
                  nodeId="10"
                  label="Practice Quizzes and Flashcards"
                  onClick={() =>
                    filteredByTitle('Practice Quizzes and Flashcards')
                  }
                />
                <TreeItem
                  nodeId="11"
                  label="Microlearning"
                  onClick={() => filteredByTitle('Microlearning')}
                />
                <TreeItem
                  nodeId="12"
                  label="Group Activities"
                  onClick={() => filteredByTitle('Group Activities')}
                />
              </TreeItem>
              <TreeItem nodeId="13" label="📝 Receive Knowledge Feedback">
                <TreeItem
                  nodeId="14"
                  label="(Gamified) Live Quizzes"
                  onClick={() => filteredByTitle('(Gamified) Live Quizzes')}
                />
                <TreeItem
                  nodeId="15"
                  label="Practice Quizzes and Flashcards"
                  onClick={() =>
                    filteredByTitle('Practice Quizzes and Flashcards')
                  }
                />
                <TreeItem
                  nodeId="16"
                  label="Microlearning"
                  onClick={() => filteredByTitle('Microlearning')}
                />
                <TreeItem
                  nodeId="17"
                  label="Flipped Classroom"
                  onClick={() => filteredByTitle('Flipped Classroom')}
                />
              </TreeItem>
              <TreeItem nodeId="18" label="🌍 Learning Beyond Classroom">
                <TreeItem
                  nodeId="19"
                  label="Practice Quizzes and Flashcards"
                  onClick={() =>
                    filteredByTitle('Practice Quizzes and Flashcards')
                  }
                />
                <TreeItem
                  nodeId="20"
                  label="Microlearning"
                  onClick={() => filteredByTitle('Microlearning')}
                />
                <TreeItem
                  nodeId="21"
                  label="Group Activities"
                  onClick={() => filteredByTitle('Group Activities')}
                />
              </TreeItem>
            </TreeItem>
          </TreeView>
        </div>
        <div className="col-span-5 md:col-span-4">
          <div onClick={() => setFilteredUseCases(useCases)}>
            <H1>Use Cases</H1>
          </div>
          {filteredUseCases.map((useCase) => (
            <Card
              title={useCase.title}
              image={useCase.imageSrc}
              detailsRef={useCase.detailsRef}
            >
              {useCase.description}
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
