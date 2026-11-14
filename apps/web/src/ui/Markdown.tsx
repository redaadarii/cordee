import ReactMarkdown from 'react-markdown';
import remarkGfm from 'remark-gfm';

// react-markdown n'interprète pas le HTML brut : le contenu saisi par un membre reste du texte.
export default function Markdown({ children }: { children: string }) {
  return (
    <div className="markdown">
      <ReactMarkdown
        remarkPlugins={[remarkGfm]}
        components={{
          a: ({ node: _node, ...props }) => <a {...props} target="_blank" rel="noreferrer noopener" />,
        }}
      >
        {children}
      </ReactMarkdown>
    </div>
  );
}
