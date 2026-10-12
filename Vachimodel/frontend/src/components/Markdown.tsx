import { memo, useRef, useState, type ComponentPropsWithoutRef } from 'react'
import ReactMarkdown from 'react-markdown'
import rehypeHighlight from 'rehype-highlight'
import remarkGfm from 'remark-gfm'

function CodeBlock(props: ComponentPropsWithoutRef<'pre'>) {
  const ref = useRef<HTMLPreElement>(null)
  const [copied, setCopied] = useState(false)
  const language = /language-([\w-]+)/.exec(
    (props.children as { props?: { className?: string } })?.props?.className ?? '',
  )?.[1]

  const copy = async () => {
    try {
      await navigator.clipboard.writeText(ref.current?.textContent ?? '')
      setCopied(true)
      setTimeout(() => setCopied(false), 1500)
    } catch {
      // clipboard blocked (e.g. plain http on another device); the text can still be selected
    }
  }

  return (
    <div className="code-block">
      <div className="code-block-bar">
        <span>{language ?? 'code'}</span>
        <button type="button" className="link-button" onClick={copy}>
          {copied ? 'Copied' : 'Copy'}
        </button>
      </div>
      <pre ref={ref} {...props} />
    </div>
  )
}

function Link(props: ComponentPropsWithoutRef<'a'>) {
  return <a {...props} target="_blank" rel="noopener noreferrer" />
}

/** Renders model output as Markdown. Raw HTML in the text is not rendered (safe by default). */
export const Markdown = memo(function Markdown({ text }: { text: string }) {
  return (
    <div className="markdown">
      <ReactMarkdown
        remarkPlugins={[remarkGfm]}
        rehypePlugins={[[rehypeHighlight, { detect: true, ignoreMissing: true }]]}
        components={{ pre: CodeBlock, a: Link }}
      >
        {text}
      </ReactMarkdown>
    </div>
  )
})
