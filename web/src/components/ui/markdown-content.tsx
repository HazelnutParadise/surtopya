import ReactMarkdown from "react-markdown"
import remarkGfm from "remark-gfm"
import { cn } from "@/lib/utils"

interface MarkdownContentProps {
  content?: string | null
  className?: string
  inline?: boolean
}

export function MarkdownContent({ content, className, inline = false }: MarkdownContentProps) {
  if (!content) return null

  const markdown = (
    <ReactMarkdown
      remarkPlugins={[remarkGfm]}
      components={{
        p: ({ children }) =>
          inline ? <span>{children}</span> : <p className="leading-relaxed">{children}</p>,
        ul: ({ children }) => <ul className={cn("list-disc pl-5 space-y-1", inline && "inline-block")}>{children}</ul>,
        ol: ({ children }) => <ol className={cn("list-decimal pl-5 space-y-1", inline && "inline-block")}>{children}</ol>,
        a: ({ children, href }) => (
          <a
            href={href}
            target="_blank"
            rel="noreferrer noopener"
            className="text-inherit underline underline-offset-2"
          >
            {children}
          </a>
        ),
        strong: ({ children }) => <strong className="font-semibold">{children}</strong>,
        em: ({ children }) => <em className="italic">{children}</em>,
      }}
    >
      {content}
    </ReactMarkdown>
  )

  if (inline) {
    return <span className={cn("inline", className)}>{markdown}</span>
  }

  return (
    <div className={cn("space-y-3", className)}>
      {markdown}
    </div>
  )
}
