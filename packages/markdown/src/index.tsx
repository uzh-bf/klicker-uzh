import React, { useMemo } from "react";
import katex from "rehype-katex";
import rehype2react from "rehype-react";
import rehypeSanitize, { defaultSchema } from "rehype-sanitize";
import math from "remark-math";
import markdown from "remark-parse";
import remark2rehype from "remark-rehype";
import { unified } from "unified";

interface MarkdownProps {
  className?: string;
  content: any;
  description?: string;
  components?: {
    img: any;
  };
}

const defaultProps = {
  className: undefined,
  description: "Description missing",
  components: undefined,
};

function Markdown({
  className,
  content,
  description,
  components,
}: MarkdownProps): React.ReactElement {
  const parsedContent = useMemo(() => {
    if (content?.length <= 2) {
      return content;
    }
    try {
      return content
        ? unified()
            .use(markdown)
            .use(math, { singleDollarTextMath: false })
            .use(remark2rehype, { allowDangerousHtml: false })
            .use(rehypeSanitize, {
              ...defaultSchema,
              attributes: {
                ...defaultSchema.attributes,
                div: [
                  ...(defaultSchema?.attributes?.div || []),
                  ["className", "math", "math-display"],
                ],
                span: [
                  ...(defaultSchema?.attributes?.span || []),
                  ["className", "math", "math-inline"],
                ],
                img: [
                  ...(defaultSchema?.attributes?.img || []),
                  ["className", "src", "alt"],
                ],
              },
            })
            .use(katex)
            .use(rehype2react, {
              createElement: React.createElement,
              components,
            })
            .processSync(content).result
        : description;
    } catch (e) {
      console.error(e);
      return content;
    }
  }, [content, description]);

  return <div className={className}>{parsedContent}</div>;
}

Markdown.defaultProps = defaultProps;
export default Markdown;
