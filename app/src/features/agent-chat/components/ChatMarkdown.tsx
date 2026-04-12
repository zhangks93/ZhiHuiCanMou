import { useState } from 'react'
import ReactMarkdown from 'react-markdown'
import remarkGfm from 'remark-gfm'
import { Check, Copy, ExternalLink } from 'lucide-react'

const ECHARTS_CDN_URL = 'https://cdn.jsdelivr.net/npm/echarts@5.4.3/dist/echarts.min.js'
const EXTERNAL_SCRIPT_TAG_PATTERN = /<script\b[^>]*\bsrc\s*=\s*(?:"[^"]*"|'[^']*'|[^\s>]+)[^>]*>[\s\S]*?<\/script>/gi

function clamp(value: number, min: number, max: number) {
  return Math.min(Math.max(value, min), max)
}

function getHtmlPreviewHeight(code: string) {
  const heightMatches = [...code.matchAll(/height\s*:\s*(\d{2,4})px/gi)]
  if (!heightMatches.length) return 480

  const maxHeight = Math.max(...heightMatches.map(match => Number(match[1])))
  return clamp(maxHeight + 24, 320, 720)
}

function injectPreviewHead(code: string, previewHead: string) {
  if (/<head[\s>]/i.test(code)) {
    return code.replace(/<head(\s[^>]*)?>/i, match => `${match}\n${previewHead}`)
  }

  if (/<html[\s>]/i.test(code)) {
    return code.replace(/<html(\s[^>]*)?>/i, match => `${match}\n<head>\n${previewHead}\n</head>`)
  }

  return code
}

function buildHtmlPreviewDocument(code: string) {
  const normalizedCode = code.replace(EXTERNAL_SCRIPT_TAG_PATTERN, '')
  const previewHead = [
    '<meta charset="UTF-8" />',
    '<meta name="viewport" content="width=device-width, initial-scale=1.0" />',
    '<meta http-equiv="Content-Security-Policy" content="default-src \'none\'; script-src \'unsafe-inline\' https://cdn.jsdelivr.net; style-src \'unsafe-inline\'; img-src data:; font-src data:; connect-src \'none\'; frame-src \'none\'; object-src \'none\'; base-uri \'none\'; form-action \'none\';" />',
    '<style>html, body { margin: 0; padding: 0; background: #ffffff; }</style>',
    '<script>(function () { const blockedKeys = [\'__TAURI__\', \'__TAURI_INTERNALS__\']; for (const key of blockedKeys) { try { delete window[key]; } catch {} try { Object.defineProperty(window, key, { value: undefined, configurable: false, writable: false }); } catch {} } })()</script>',
    `<script src="${ECHARTS_CDN_URL}"></script>`,
  ].join('\n')

  if (/<html[\s>]/i.test(normalizedCode)) {
    return injectPreviewHead(normalizedCode, previewHead)
  }

  return [
    '<!doctype html>',
    '<html lang="zh-CN">',
    '<head>',
    previewHead,
    '</head>',
    '<body>',
    normalizedCode,
    '</body>',
    '</html>',
  ].join('\n')
}

function serializePreviewPayload(previewDocument: string) {
  return JSON.stringify(previewDocument)
    .replace(/</g, '\\u003c')
    .replace(/>/g, '\\u003e')
    .replace(/&/g, '\\u0026')
    .replace(/\u2028/g, '\\u2028')
    .replace(/\u2029/g, '\\u2029')
}

function buildHtmlPreviewWindowDocument(previewDocument: string) {
  const serializedPreviewDocument = serializePreviewPayload(previewDocument)

  return [
    '<!doctype html>',
    '<html lang="zh-CN">',
    '<head>',
    '<meta charset="UTF-8" />',
    '<meta name="viewport" content="width=device-width, initial-scale=1.0" />',
    '<meta name="referrer" content="no-referrer" />',
    '<meta http-equiv="Content-Security-Policy" content="default-src \'none\'; script-src \'unsafe-inline\'; style-src \'unsafe-inline\'; img-src data:; font-src data:; connect-src \'none\'; frame-src blob:; object-src \'none\'; base-uri \'none\'; form-action \'none\';" />',
    '<title>图表预览</title>',
    '<style>html, body { margin: 0; min-height: 100%; background: #f8fafc; font-family: "Source Han Sans SC", "Noto Sans SC", "PingFang SC", "Microsoft YaHei", sans-serif; color: #0f172a; } body { min-height: 100vh; } .preview-shell { display: flex; min-height: 100vh; flex-direction: column; } .preview-header { display: flex; align-items: center; justify-content: space-between; gap: 1rem; padding: 1rem 1.25rem; border-bottom: 1px solid rgba(15, 23, 42, 0.08); background: rgba(255, 255, 255, 0.92); } .preview-title { font-size: 0.875rem; font-weight: 500; } .preview-meta { color: #64748b; font-size: 0.75rem; } .preview-frame { flex: 1; width: 100%; min-height: calc(100vh - 65px); border: 0; background: #ffffff; }</style>',
    '</head>',
    '<body>',
    '<div class="preview-shell">',
    '<div class="preview-header"><div class="preview-title">图表预览</div><div class="preview-meta">隔离运行</div></div>',
    '<iframe id="preview-frame" class="preview-frame" title="图表预览" sandbox="allow-scripts" referrerpolicy="no-referrer"></iframe>',
    '</div>',
    `<script id="preview-payload" type="application/json">${serializedPreviewDocument}</script>`,
    "<script>(function () { const frame = document.getElementById('preview-frame'); const payload = document.getElementById('preview-payload'); if (!(frame instanceof HTMLIFrameElement) || !payload) return; const previewDocumentText = JSON.parse(payload.textContent || '\"\"'); const previewBlob = new Blob([previewDocumentText], { type: 'text/html;charset=utf-8' }); const previewUrl = URL.createObjectURL(previewBlob); frame.addEventListener('load', function handleLoad() { window.setTimeout(function revokePreviewUrl() { URL.revokeObjectURL(previewUrl); }, 60000); }, { once: true }); frame.src = previewUrl; })()</script>",
    '</body>',
    '</html>',
  ].join('\n')
}

function openHtmlPreviewWindow(previewDocument: string) {
  const previewWindowDocument = buildHtmlPreviewWindowDocument(previewDocument)
  const previewBlob = new Blob([previewWindowDocument], { type: 'text/html;charset=utf-8' })
  const previewUrl = URL.createObjectURL(previewBlob)
  const openedWindow = window.open(previewUrl, '_blank', 'noopener,noreferrer')

  window.setTimeout(() => URL.revokeObjectURL(previewUrl), 60_000)
  return Boolean(openedWindow)
}

function HtmlPreviewBlock({ code }: { code: string }) {
  const previewDocument = buildHtmlPreviewDocument(code)

  return (
    <div className="chat-html-preview not-prose">
      <div className="chat-html-preview-header">
        <span>图表预览</span>
        <div className="chat-html-preview-actions">
          <span className="chat-html-preview-meta">隔离运行</span>
          <button
            type="button"
            className="chat-html-preview-open"
            onClick={() => openHtmlPreviewWindow(previewDocument)}
            title="在新窗口打开"
          >
            <ExternalLink size={14} />
            <span>在新窗口打开</span>
          </button>
        </div>
      </div>
      <iframe
        className="chat-html-preview-frame"
        title="AI 图表预览"
        sandbox="allow-scripts"
        loading="lazy"
        referrerPolicy="no-referrer"
        srcDoc={previewDocument}
        style={{ height: `${getHtmlPreviewHeight(code)}px` }}
      />
    </div>
  )
}

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

export function ChatMarkdown({
  content,
  enableHtmlPreview = false,
}: {
  content: string
  enableHtmlPreview?: boolean
}) {
  return (
    <div className="chat-markdown">
      <ReactMarkdown
        remarkPlugins={[remarkGfm]}
        components={{
          code({ className, children, ...props }) {
            const language = /language-(\w+)/.exec(className || '')?.[1]?.toLowerCase()
            const code = String(children).replace(/\n$/, '')
            const shouldRenderHtmlPreview = enableHtmlPreview && (language === 'html' || language === 'htm')

            if (shouldRenderHtmlPreview) {
              return <HtmlPreviewBlock code={code} />
            }

            if (language) {
              return (
                <div className="chat-code-block not-prose">
                  <div className="chat-code-header">
                    <span>{language}</span>
                    <CopyButton value={code} />
                  </div>
                  <pre className="m-0 overflow-x-auto bg-slate-950/92 p-4 text-[var(--color-text-on-dark)]">
                    <code className={`language-${language}`}>{code}</code>
                  </pre>
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
