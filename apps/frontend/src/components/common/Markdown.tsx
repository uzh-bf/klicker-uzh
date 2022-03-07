import useMarkdown from '../../lib/hooks/useMarkdown'

function Markdown({ children }) {
  const parsedContent = useMarkdown({ content: children })

  return parsedContent
}

export default Markdown
