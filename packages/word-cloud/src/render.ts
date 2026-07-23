import { select } from 'd3-selection'
import 'd3-transition'
import type {
  LayoutResult,
  LayoutWord,
  RendererHandle,
  RenderWordCloudOptions,
} from './types'

const DEFAULT_COLORS = [
  'rgb(19, 149, 186)',
  'rgb(241, 108, 32)',
  'rgb(13, 60, 85)',
  'rgb(235, 200, 68)',
  'rgb(192, 46, 29)',
  'rgb(162, 184, 108)',
  'rgb(239, 139, 44)',
  'rgb(17, 120, 153)',
  'rgb(217, 78, 31)',
  'rgb(92, 167, 147)',
  'rgb(15, 91, 120)',
  'rgb(236, 170, 56)',
]

const DEFAULT_TRANSITION_DURATION = 350
const DEFAULT_TOOLTIP_OFFSET = 12

function getWordTransform(word: LayoutWord, scale = 1) {
  return `translate(${word.x},${word.y}) rotate(${word.rotate}) scale(${scale})`
}

function getDefaultTooltip(word: LayoutWord) {
  const wrapper = document.createElement('div')
  const label = document.createElement('strong')
  label.textContent = word.text
  const lineBreak = document.createElement('br')
  const value = document.createTextNode(String(word.value))

  wrapper.append(label, lineBreak, value)
  return wrapper
}

function replaceTooltipContent(tooltipElement: HTMLDivElement, content: Node) {
  tooltipElement.replaceChildren(content)
}

function ensurePositionedContainer(container: HTMLElement) {
  const computedStyle = window.getComputedStyle(container)
  if (computedStyle.position !== 'static') {
    return () => {}
  }

  const previousPosition = container.style.position
  container.style.position = 'relative'

  return () => {
    container.style.position = previousPosition
  }
}

export function renderWordCloud(
  container: HTMLElement,
  initialLayoutResult: LayoutResult,
  initialRenderOptions: RenderWordCloudOptions = {}
): RendererHandle {
  let renderOptions = initialRenderOptions
  let layoutResult = initialLayoutResult
  const teardownPositioning = ensurePositionedContainer(container)
  const hostSelection = select(container)
  const svgSelection = hostSelection
    .append('svg')
    .attr('data-word-cloud-native', 'true')
    .attr('width', layoutResult.width)
    .attr('height', layoutResult.height)
    .attr('viewBox', `0 0 ${layoutResult.width} ${layoutResult.height}`)
    .attr('preserveAspectRatio', 'xMidYMid meet')
  const rootGroup = svgSelection
    .append('g')
    .attr('data-word-cloud-root', 'true')
  const tooltipElement = document.createElement('div')
  tooltipElement.style.position = 'absolute'
  tooltipElement.style.pointerEvents = 'none'
  tooltipElement.style.display = 'none'
  tooltipElement.style.zIndex = '40'
  container.appendChild(tooltipElement)

  const draw = () => {
    const colors = renderOptions.colors ?? DEFAULT_COLORS
    const transitionDuration =
      renderOptions.transitionDuration ?? DEFAULT_TRANSITION_DURATION
    const tooltipOffset = renderOptions.tooltipOffset ?? DEFAULT_TOOLTIP_OFFSET

    svgSelection
      .attr('width', layoutResult.width)
      .attr('height', layoutResult.height)
      .attr('viewBox', `0 0 ${layoutResult.width} ${layoutResult.height}`)
    rootGroup.attr(
      'transform',
      `translate(${layoutResult.width / 2},${layoutResult.height / 2})`
    )

    const textSelection = rootGroup
      .selectAll('text')
      .data(layoutResult.placed, (word: LayoutWord) => word.text)
      .join(
        (enter: any) =>
          enter
            .append('text')
            .attr('font-size', 0)
            .style('opacity', 0)
            .attr('text-anchor', 'middle'),
        (update: any) => update,
        (exit: any) =>
          exit
            .interrupt()
            .transition()
            .duration(transitionDuration)
            .style('opacity', 0)
            .remove()
      )

    textSelection
      .interrupt()
      .attr('cursor', renderOptions.onWordClick ? 'pointer' : 'default')
      .attr(
        'fill',
        (word: LayoutWord) => colors[word.index % colors.length] ?? colors[0]
      )
      .attr(
        'font-family',
        renderOptions.fontFamily ?? layoutResult.settings.fontFamily
      )
      .attr(
        'font-style',
        renderOptions.fontStyle ?? layoutResult.settings.fontStyle
      )
      .attr(
        'font-weight',
        String(renderOptions.fontWeight ?? layoutResult.settings.fontWeight)
      )
      .text((word: LayoutWord) => word.text)
      .on('mousemove', (event: MouseEvent) => {
        const bounds = container.getBoundingClientRect()
        tooltipElement.style.left = `${event.clientX - bounds.left + tooltipOffset}px`
        tooltipElement.style.top = `${event.clientY - bounds.top + tooltipOffset}px`
      })
      .on(
        'mouseover',
        function (this: SVGTextElement, event: MouseEvent, word: LayoutWord) {
          const tooltipContent =
            renderOptions.getWordTooltip?.(word) ?? getDefaultTooltip(word)
          replaceTooltipContent(tooltipElement, tooltipContent)
          tooltipElement.style.display = 'block'
          select(this).attr('transform', getWordTransform(word, 1.1))
          renderOptions.onWordMouseOver?.(word, event)
        }
      )
      .on(
        'mouseout',
        function (this: SVGTextElement, event: MouseEvent, word: LayoutWord) {
          tooltipElement.style.display = 'none'
          select(this).attr('transform', getWordTransform(word, 1))
          renderOptions.onWordMouseOut?.(word, event)
        }
      )
      .on('click', (event: MouseEvent, word: LayoutWord) => {
        renderOptions.onWordClick?.(word, event)
      })
      .transition()
      .duration(transitionDuration)
      .attr('font-size', (word: LayoutWord) => word.fontSize)
      .attr('transform', (word: LayoutWord) => getWordTransform(word))
      .style('opacity', 1)
  }

  draw()

  return {
    update: (
      nextLayoutResult: LayoutResult,
      nextRenderOptions?: RenderWordCloudOptions
    ) => {
      layoutResult = nextLayoutResult
      renderOptions = nextRenderOptions
        ? { ...renderOptions, ...nextRenderOptions }
        : renderOptions
      draw()
    },
    destroy: () => {
      tooltipElement.remove()
      svgSelection.remove()
      teardownPositioning()
    },
    getLayout: () => layoutResult,
  }
}
