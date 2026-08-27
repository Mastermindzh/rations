import type { ValidationIssue } from "../config/types.js";
import { CsrfField } from "./shared.js";

type ValidationIssueListProps = {
  issues: ValidationIssue[];
};

type ConfigEditorFormProps = {
  rawYaml: string;
  version: string;
  csrfToken: string;
  saveLabel: string;
};

export const ValidationIssueList = ({ issues }: ValidationIssueListProps) => (
  <ul class="validation-list">
    {issues.map((error) => (
      <li>
        <code>{error.path}</code>: {error.message}
      </li>
    ))}
  </ul>
);

export const ConfigEditorForm = ({
  rawYaml,
  version,
  csrfToken,
  saveLabel,
}: ConfigEditorFormProps) => (
  <form
    method="post"
    action="/admin/config/save"
    class="editor-form"
    data-editor-form
  >
    <CsrfField token={csrfToken} />
    <input type="hidden" name="expectedVersion" value={version} />
    <label class="sr-only" for="rawYaml">
      Complete YAML configuration
    </label>
    <textarea
      id="rawYaml"
      name="rawYaml"
      spellcheck={false}
      data-yaml-editor
    >
      {rawYaml}
    </textarea>
    <div class="editor-actions">
      <button class="button button-accent" type="submit">
        {saveLabel}
      </button>
      <button class="button" type="submit" formaction="/admin/config/validate">
        Validate
      </button>
      <a class="button button-quiet" href="/admin#editor" data-reload>
        Reload
      </a>
    </div>
  </form>
);
