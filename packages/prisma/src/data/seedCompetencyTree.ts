import Prisma from '../../dist/index.js'
import { USER_ID_TEST } from './constants.js'

type CompetencyType = {
  name: string
  description?: string
  nodes: CompetencyType[]
}

async function createNode({
  prisma,
  counter,
  treeId,
  name,
  description,
  children,
}: {
  prisma: any
  counter: number
  treeId: number
  name: string
  description?: string
  children: CompetencyType[]
}) {
  let newCounter = counter
  if (children.length > 0) {
    for (const child of children) {
      newCounter = await createNode({
        prisma,
        counter: newCounter + 1,
        treeId,
        name: child.name,
        description: child.description,
        children: child.nodes,
      })
    }
  }
  newCounter += 1

  // create competency node
  await prisma.competency.upsert({
    where: {
      treeId_name: {
        treeId,
        name,
      },
    },
    create: {
      name,
      description,
      lft: counter,
      rgt: newCounter,
      tree: {
        connect: {
          id: treeId,
        },
      },
    },
    update: {},
  })

  return newCounter
}

export async function seedCompetencyTree(prisma: Prisma.PrismaClient) {
  // ! Define the tree in a nested JSON structure for good readability
  // https://blog.uniauth.com/nested-set-model
  const tree: { name: string; description?: string; nodes: CompetencyType[] } =
    {
      name: 'Root',
      description: 'Root of the competency tree',
      nodes: [
        {
          name: '1',
          description: 'Node 1',
          nodes: [
            {
              name: '2',
              description: 'Node 2',
              nodes: [
                { name: '5', description: 'Node 5', nodes: [] },
                {
                  name: '6',
                  description: 'Node 6',
                  nodes: [
                    {
                      name: '10',
                      description: 'Node 10',
                      nodes: [],
                    },
                  ],
                },
              ],
            },
            {
              name: '3',
              description: 'Node 3',
              nodes: [
                {
                  name: '7',
                  nodes: [{ name: '11', description: 'Node 11', nodes: [] }],
                },
              ],
            },
            {
              name: '4',
              nodes: [
                { name: '8', description: 'Node 8', nodes: [] },
                { name: '9', description: 'Node 9', nodes: [] },
              ],
            },
          ],
        },
      ],
    }

  // ! Parse the tree into the structure used in the database through an intermediary JSON format
  // set up tree
  const competencyTree = await prisma.competencyTree.upsert({
    where: {
      id: 1,
    },
    create: {
      name: tree.name,
      description: tree.description,
      owner: {
        connect: {
          id: USER_ID_TEST,
        },
      },
    },
    update: {
      name: tree.name,
      description: tree.description,
    },
  })

  // traverse the tree and create the competencies according to the nested set model
  await createNode({
    prisma,
    counter: 1,
    treeId: competencyTree.id,
    name: tree.nodes[0]!.name,
    description: tree.nodes[0]!.description,
    children: tree.nodes[0]!.nodes,
  })
}

// const prismaClient = new Prisma.PrismaClient()
// seedCompetencyTree(prismaClient)
//   .catch((e) => {
//     console.error(e)
//     process.exit(1)
//   })
//   .finally(async () => {
//     await prismaClient.$disconnect()
//   })
