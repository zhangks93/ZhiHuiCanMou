import { useState } from 'react'
import ReactMarkdown from 'react-markdown'
import remarkGfm from 'remark-gfm'
import { Check, Copy } from 'lucide-react'
import { Prism as SyntaxHighlighter } from 'react-syntax-highlighter'
import { oneDark } from 'react-syntax-highlighter/dist/esm/styles/prism'

function CopyButton({ value }: { value: string }) {
  const [copied, setCopied] = useState(false)

  const handleCopy = async () => {
    try {
      await navigator.clipboard.writeText(value)
      setCopied(true)
      window.setTimeout(() => setCopied(false), 1500)
    } catch {
      setCopied(false)
    }
  }

  return (
    <button
      type="button"
      className="chat-code-copy"
      onClick={handleCopy}
      title={copied ? '已复制' : '复制代码'}
    >
      {copied ? <Check size={14} /> : <Copy size={14} />}
      <span>{copied ? '已复制' : '复制'}</span>
    </button>
  )
}

export function ChatMarkdown({ content }: { content: string }) {
  return (
    <div className="chat-markdown">
      <ReactMarkdown
        remarkPlugins={[remarkGfm]}
        components={{
          code({ className, children, ...props }) {
            const match = /language-(\w+)/.exec(className || '')
            const code = String(children).replace(/\n$/, '')

            if (match) {
              return (
                <div className="chat-code-block not-prose">
                  <div className="chat-code-header">
                    <span>{match[1]}</span>
                    <CopyButton value={code} />
                  </div>
                  <SyntaxHighlighter
                    style={oneDark}
                    language={match[1]}
                    PreTag="div"
                    customStyle={{
                      margin: 0,
                      padding: '1rem',
                      borderRadius: 0,
                      background: 'transparent',
                      fontSize: '0.8125rem',
                      lineHeight: 1.7,
                    }}
                  >
                    {code}
                  </SyntaxHighlighter>
                </div>
              )
            }

            return (
              <code className="chat-inline-code" {...props}>
                {children}
              </code>
            )
          },
          table({ children }) {
            return (
              <div className="chat-table-wrap not-prose">
                <table className="chat-table">{children}</table>
              </div>
            )
          },
          thead({ children }) {
            return <thead>{children}</thead>
          },
          tbody({ children }) {
            return <tbody>{children}</tbody>
          },
          tr({ children }) {
            return <tr>{children}</tr>
          },
          hr() {
            return <hr />
          },
          a({ children, href }) {
            return (
              <a href={href} target="_blank" rel="noreferrer">
                {children}
              </a>
            )
          },
        }}
      >
        {content}
      </ReactMarkdown>
    </div>
  )
}
