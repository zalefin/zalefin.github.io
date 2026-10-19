// CodeMirror for the DAG editor. Loaded with a dynamic import, so the editor
// isn't in the page's initial bundle.

import {
  defaultKeymap,
  history,
  historyKeymap,
  indentWithTab,
} from "@codemirror/commands";
import { python } from "@codemirror/lang-python";
import {
  bracketMatching,
  HighlightStyle,
  indentOnInput,
  syntaxHighlighting,
} from "@codemirror/language";
import { setDiagnostics } from "@codemirror/lint";
import { EditorState } from "@codemirror/state";
import {
  drawSelection,
  EditorView,
  highlightActiveLine,
  highlightActiveLineGutter,
  keymap,
  lineNumbers,
} from "@codemirror/view";
import { tags as t } from "@lezer/highlight";

// Colors come from the page's gruvbox CSS variables, so the editor follows
// the theme toggle without being reconfigured.
const theme = EditorView.theme({
  "&": {
    height: "100%",
    color: "var(--fg)",
    backgroundColor: "transparent",
    fontSize: "12.5px",
  },
  "&.cm-focused": { outline: "none" },
  ".cm-scroller": {
    fontFamily: "inherit",
    lineHeight: "1.6",
  },
  ".cm-content": { caretColor: "var(--orange-bright)", padding: "10px 0" },
  ".cm-cursor, .cm-dropCursor": { borderLeftColor: "var(--orange-bright)" },
  ".cm-gutters": {
    backgroundColor: "transparent",
    color: "var(--fg-faint)",
    border: "none",
  },
  ".cm-lineNumbers .cm-gutterElement": { padding: "0 10px 0 14px" },
  ".cm-activeLine": {
    backgroundColor: "color-mix(in srgb, var(--bg2) 30%, transparent)",
  },
  ".cm-activeLineGutter": {
    backgroundColor: "transparent",
    color: "var(--fg-muted)",
  },
  "&.cm-focused > .cm-scroller > .cm-selectionLayer .cm-selectionBackground, .cm-selectionBackground, .cm-content ::selection":
    { backgroundColor: "color-mix(in srgb, var(--yellow) 28%, transparent)" },
  ".cm-matchingBracket": {
    backgroundColor: "color-mix(in srgb, var(--aqua) 22%, transparent)",
    outline: "none",
  },
  ".cm-lintRange-error": {
    backgroundImage: "none",
    textDecoration: "underline wavy var(--red)",
    textUnderlineOffset: "3px",
  },
  ".cm-tooltip": {
    backgroundColor: "var(--bg1)",
    color: "var(--fg)",
    border: "1px solid var(--panel-border)",
  },
});

const highlight = HighlightStyle.define([
  { tag: [t.keyword, t.controlKeyword, t.moduleKeyword], color: "var(--red)" },
  { tag: [t.definitionKeyword, t.operatorKeyword], color: "var(--red)" },
  { tag: [t.string, t.special(t.string)], color: "var(--green)" },
  { tag: t.docString, color: "var(--green)", fontStyle: "italic" },
  { tag: t.comment, color: "var(--fg-faint)", fontStyle: "italic" },
  { tag: [t.number, t.bool, t.null], color: "var(--purple)" },
  {
    tag: [t.function(t.variableName), t.function(t.definition(t.variableName))],
    color: "var(--green)",
    fontWeight: "600",
  },
  { tag: [t.className, t.definition(t.className)], color: "var(--yellow)" },
  { tag: t.propertyName, color: "var(--blue)" },
  { tag: t.attributeName, color: "var(--aqua)" },
  { tag: [t.operator, t.derefOperator], color: "var(--orange)" },
  { tag: t.meta, color: "var(--aqua)" },
  { tag: [t.self, t.special(t.variableName)], color: "var(--orange)" },
  { tag: t.variableName, color: "var(--fg)" },
  { tag: [t.punctuation, t.bracket], color: "var(--fg-muted)" },
]);

export function createEditor(
  parent: HTMLElement,
  doc: string,
  onCompile: () => void,
): EditorView {
  return new EditorView({
    parent,
    state: EditorState.create({
      doc,
      extensions: [
        lineNumbers(),
        highlightActiveLineGutter(),
        highlightActiveLine(),
        history(),
        drawSelection(),
        indentOnInput(),
        bracketMatching(),
        python(),
        syntaxHighlighting(highlight),
        theme,
        EditorView.contentAttributes.of({ "aria-label": "Airflow DAG source" }),
        keymap.of([
          {
            key: "Mod-Enter",
            preventDefault: true,
            run: () => {
              onCompile();
              return true;
            },
          },
          ...defaultKeymap,
          ...historyKeymap,
          indentWithTab,
        ]),
      ],
    }),
  });
}

export function setDocument(view: EditorView, doc: string) {
  view.dispatch({
    changes: { from: 0, to: view.state.doc.length, insert: doc },
  });
}

/** Underline the line a compile error points at, or clear it. */
export function showError(
  view: EditorView,
  error: { message: string; line: number | null } | null,
) {
  const diagnostics = [];
  if (error?.line && error.line <= view.state.doc.lines) {
    const line = view.state.doc.line(error.line);
    diagnostics.push({
      from: line.from + (line.text.length - line.text.trimStart().length),
      to: line.to,
      severity: "error" as const,
      message: error.message,
    });
  }
  view.dispatch(setDiagnostics(view.state, diagnostics));
}
