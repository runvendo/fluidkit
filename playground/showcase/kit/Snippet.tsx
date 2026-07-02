import { useState } from "react";

export function Snippet({ code }: { code: string }) {
  const [copied, setCopied] = useState(false);
  return (
    <div className="snippet">
      <pre><code>{code}</code></pre>
      <button
        className="copy"
        onClick={() => {
          navigator.clipboard?.writeText(code);
          setCopied(true);
          setTimeout(() => setCopied(false), 1400);
        }}
      >
        {copied ? "copied" : "copy"}
      </button>
    </div>
  );
}
