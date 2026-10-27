"use client";

import { Placeholder } from "@tiptap/extensions";
import { EditorContent, useEditor, type JSONContent } from "@tiptap/react";
import StarterKit from "@tiptap/starter-kit";

/**
 * Notion-like writing surface. Markdown shortcuts come with StarterKit:
 * "# " heading, "- " list, "1. " numbered list, "> " quote, ``` code, --- divider.
 */
export function RichEditor({
  content,
  placeholder,
  onChange,
}: {
  content: JSONContent | null;
  placeholder: string;
  onChange: (doc: JSONContent, text: string) => void;
}) {
  const editor = useEditor({
    extensions: [
      StarterKit.configure({
        heading: { levels: [1, 2, 3] },
        link: { openOnClick: false, autolink: true, defaultProtocol: "https" },
      }),
      Placeholder.configure({ placeholder }),
    ],
    content: content ?? "",
    immediatelyRender: false,
    editorProps: { attributes: { class: "cockpit-editor", "aria-label": "Contenu" } },
    onUpdate: ({ editor: instance }) => onChange(instance.getJSON(), instance.getText({ blockSeparator: "\n" })),
  });

  return <EditorContent editor={editor} />;
}
