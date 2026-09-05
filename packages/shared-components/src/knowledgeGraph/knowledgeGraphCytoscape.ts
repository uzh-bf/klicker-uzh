import type { KnowledgeGraphEdge, KnowledgeGraphNode } from '@klicker-uzh/types'
import type cytoscape from 'cytoscape'

const UZH_KIND_STYLES = [
  {
    color: '#BDC9E8',
    borderColor: '#001E7C',
    shape: 'ellipse',
    legendClassName: 'rounded-full bg-[#BDC9E8] border-[#001E7C]',
    shapeLabelKey: 'shapeCircle',
  },
  {
    color: '#F78CAA',
    borderColor: '#8F0A2E',
    shape: 'diamond',
    legendClassName: 'rotate-45 bg-[#F78CAA] border-[#8F0A2E]',
    shapeLabelKey: 'shapeDiamond',
  },
  {
    color: '#FFE9B5',
    borderColor: '#A27200',
    shape: 'round-rectangle',
    legendClassName: 'rounded bg-[#FFE9B5] border-[#A27200]',
    shapeLabelKey: 'shapeRoundedSquare',
  },
  {
    color: '#E7E7E7',
    borderColor: '#4D4D4D',
    shape: 'hexagon',
    legendClassName: 'rounded-sm bg-[#E7E7E7] border-[#4D4D4D]',
    shapeLabelKey: 'shapeHexagon',
  },
] as const

export const CYTOSCAPE_STYLE: cytoscape.StylesheetJson = [
  {
    selector: 'node',
    style: {
      width: 48,
      height: 48,
      shape:
        'data(shape)' as cytoscape.Css.PropertyValueNode<cytoscape.Css.NodeShape>,
      'background-color': 'data(color)',
      'border-color': 'data(borderColor)',
      'border-width': 2,
      label: 'data(displayLabel)',
      color: '#121212',
      'font-family': 'Source Sans 3, Source Sans Pro, sans-serif',
      'font-size': 12,
      'font-weight': 600,
      'text-wrap': 'wrap',
      'text-max-width': '120px',
      'text-valign': 'bottom',
      'text-margin-y': 8,
      'overlay-opacity': 0,
    },
  },
  {
    selector: 'node:selected',
    style: {
      'background-color': '#0028A5',
      'border-color': '#001452',
      'border-width': 4,
      'underlay-color': '#BDC9E8',
      'underlay-opacity': 0.45,
      'underlay-padding': 8,
    },
  },
  {
    selector: 'edge',
    style: {
      width: 1.5,
      'line-color': '#A3A3A3',
      'target-arrow-color': '#A3A3A3',
      'target-arrow-shape': 'triangle',
      'curve-style': 'bezier',
      'overlay-opacity': 0,
    },
  },
  {
    selector: 'edge:selected',
    style: {
      width: 3,
      'line-color': '#0028A5',
      'target-arrow-color': '#0028A5',
    },
  },
]

export function kindStyle(kind: string) {
  let hash = 0
  for (const character of kind) {
    hash = (hash * 31 + character.charCodeAt(0)) >>> 0
  }
  return UZH_KIND_STYLES[hash % UZH_KIND_STYLES.length]!
}

export function cytoscapeNodeId(nodeId: string) {
  return `node:${nodeId}`
}

export function cytoscapeEdgeId(edgeId: string) {
  return `edge:${edgeId}`
}

export function nodeDefinition(
  node: KnowledgeGraphNode
): cytoscape.NodeDefinition {
  const style = kindStyle(node.kind)
  return {
    group: 'nodes',
    data: {
      id: cytoscapeNodeId(node.id),
      graphId: node.id,
      displayLabel: node.displayLabel,
      kind: node.kind,
      color: style.color,
      borderColor: style.borderColor,
      shape: style.shape,
    },
  }
}

export function edgeDefinition(
  edge: KnowledgeGraphEdge
): cytoscape.EdgeDefinition {
  return {
    group: 'edges',
    data: {
      id: cytoscapeEdgeId(edge.id),
      graphId: edge.id,
      source: cytoscapeNodeId(edge.source),
      target: cytoscapeNodeId(edge.target),
      label: edge.label,
      type: edge.type,
    },
  }
}
