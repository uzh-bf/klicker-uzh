import type { KnowledgeGraphEdge, KnowledgeGraphNode } from '@klicker-uzh/types'
import type cytoscape from 'cytoscape'
import {
  isTentativeRelation,
  SYMMETRIC_RELATION_TYPES,
} from './knowledgeGraphView'

// One style per concept type, each with its own shape and colour so types
// stay apart without relying on colour alone. `legendPoints` draws the same
// shape as an SVG polygon in a 16x16 box; circle and rounded square are drawn
// as their own SVG elements.
const UZH_KIND_STYLES = [
  {
    color: '#BDC9E8',
    borderColor: '#001E7C',
    shape: 'ellipse',
    shapeLabelKey: 'shapeCircle',
  },
  {
    color: '#F78CAA',
    borderColor: '#8F0A2E',
    shape: 'diamond',
    shapeLabelKey: 'shapeDiamond',
    legendPoints: '8,1 15,8 8,15 1,8',
  },
  {
    color: '#FFE9B5',
    borderColor: '#A27200',
    shape: 'round-rectangle',
    shapeLabelKey: 'shapeRoundedSquare',
  },
  {
    color: '#E7E7E7',
    borderColor: '#4D4D4D',
    shape: 'hexagon',
    shapeLabelKey: 'shapeHexagon',
    legendPoints: '4.5,2 11.5,2 15,8 11.5,14 4.5,14 1,8',
  },
  {
    color: '#CFE8C0',
    borderColor: '#3B6E22',
    shape: 'triangle',
    shapeLabelKey: 'shapeTriangle',
    legendPoints: '8,1.5 15,14.5 1,14.5',
  },
  {
    color: '#BFE6EB',
    borderColor: '#0B6E78',
    shape: 'pentagon',
    shapeLabelKey: 'shapePentagon',
    legendPoints: '8,1 15,6.2 12.3,14.5 3.7,14.5 1,6.2',
  },
  {
    color: '#FFD2B0',
    borderColor: '#A84A00',
    shape: 'star',
    shapeLabelKey: 'shapeStar',
    legendPoints:
      '8,0.8 10.1,5.6 15.2,6 11.3,9.4 12.5,14.5 8,11.8 3.5,14.5 4.7,9.4 0.8,6 5.9,5.6',
  },
  {
    color: '#DCD0EE',
    borderColor: '#4F2D85',
    shape: 'octagon',
    shapeLabelKey: 'shapeOctagon',
    legendPoints: '5,1 11,1 15,5 15,11 11,15 5,15 1,11 1,5',
  },
] as const satisfies readonly {
  color: string
  borderColor: string
  shape: string
  shapeLabelKey: string
  legendPoints?: string
}[]

export type KnowledgeGraphKindStyle = (typeof UZH_KIND_STYLES)[number]

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
      'font-size': 13,
      'font-weight': 600,
      'text-wrap': 'wrap',
      'text-max-width': '120px',
      'text-valign': 'bottom',
      'text-margin-y': 6,
      // A light plate keeps labels legible where edges cross them.
      'text-background-color': '#FFFFFF',
      'text-background-opacity': 0.85,
      'text-background-padding': '2px',
      'text-background-shape': 'roundrectangle',
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
      label: 'data(displayLabel)',
      'font-family': 'Source Sans 3, Source Sans Pro, sans-serif',
      'font-size': 10,
      color: '#4C4C4C',
      'text-rotation': 'autorotate',
      'text-wrap': 'ellipsis',
      'text-max-width': '110px',
      'text-background-color': '#FFFFFF',
      'text-background-opacity': 0.85,
      'text-background-padding': '1px',
      'text-background-shape': 'roundrectangle',
      // Relation labels drop out when zoomed far out, where they would only
      // add clutter at an unreadable size.
      'min-zoomed-font-size': 8,
    },
  },
  {
    // Symmetric relations have no direction to show.
    selector: SYMMETRIC_RELATION_TYPES.map(
      (relationType) => `edge[relationType = "${relationType}"]`
    ).join(', '),
    style: {
      'target-arrow-shape': 'none',
    },
  },
  {
    // Inferred or unsourced relations are dashed, so the map does not look
    // more certain than its sources are.
    selector: 'edge[?tentative]',
    style: {
      'line-style': 'dashed',
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

// Types get styles in the order they first appear, so the first eight types
// of a graph never share a style. Hashing the type name let different types
// collide on one shape even in graphs with only a few types.
const assignedKindStyles = new Map<string, KnowledgeGraphKindStyle>()

export function kindStyle(kind: string): KnowledgeGraphKindStyle {
  let style = assignedKindStyles.get(kind)
  if (style === undefined) {
    style = UZH_KIND_STYLES[assignedKindStyles.size % UZH_KIND_STYLES.length]!
    assignedKindStyles.set(kind, style)
  }
  return style
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
  edge: KnowledgeGraphEdge,
  displayLabel: string
): cytoscape.EdgeDefinition {
  return {
    group: 'edges',
    data: {
      id: cytoscapeEdgeId(edge.id),
      graphId: edge.id,
      source: cytoscapeNodeId(edge.source),
      target: cytoscapeNodeId(edge.target),
      label: edge.label,
      displayLabel,
      tentative: isTentativeRelation(edge),
      type: edge.type,
      relationType: edge.relationType,
    },
  }
}
