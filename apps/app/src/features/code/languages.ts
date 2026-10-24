import type { LanguageSupport } from "@codemirror/language";

// The languages a code page can be written in. Each loads its highlighting
// only when a page in it opens. How each runs is in run.ts.

export type Language = "python" | "javascript" | "typescript" | "sql" | "cpp" | "java";

export interface LanguageInfo {
  value: Language;
  label: string;
  /** The file a download of the page gets. */
  extension: string;
  /** What a new page in this language shows before anything is typed. */
  placeholder: string;
  load(): Promise<LanguageSupport>;
}

export const LANGUAGES: LanguageInfo[] = [
  { value: "python", label: "Python", extension: "py", placeholder: 'print("Hello")', load: async () => (await import("@codemirror/lang-python")).python() },
  { value: "javascript", label: "JavaScript", extension: "js", placeholder: 'console.log("Hello")', load: async () => (await import("@codemirror/lang-javascript")).javascript() },
  {
    value: "typescript",
    label: "TypeScript",
    extension: "ts",
    placeholder: 'const name: string = "Hello";\nconsole.log(name);',
    load: async () => (await import("@codemirror/lang-javascript")).javascript({ typescript: true }),
  },
  {
    value: "sql",
    label: "SQL",
    extension: "sql",
    placeholder: "create table books (title text, year int);\ninsert into books values ('Dune', 1965);\nselect * from books;",
    load: async () => (await import("@codemirror/lang-sql")).sql(),
  },
  { value: "cpp", label: "C++", extension: "cpp", placeholder: '#include <iostream>\n\nint main() {\n    std::cout << "Hello" << std::endl;\n}', load: async () => (await import("@codemirror/lang-cpp")).cpp() },
  {
    value: "java",
    label: "Java",
    extension: "java",
    placeholder: 'public class Main {\n    public static void main(String[] args) {\n        System.out.println("Hello");\n    }\n}',
    load: async () => (await import("@codemirror/lang-java")).java(),
  },
];

export const languageOf = (value: unknown): Language => (LANGUAGES.some((l) => l.value === value) ? (value as Language) : "python");
export const infoOf = (value: Language) => LANGUAGES.find((l) => l.value === value)!;
