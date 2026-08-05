import type { ValidationIssue } from "../config/types.js";
import { Layout } from "./layout.js";
import { CsrfField } from "./shared.js";

export const AdminRepairPage = ({
  rawYaml,
  version,
  modifiedAt,
  csrfToken,
  validationErrors,
  notice,
}: {
  rawYaml: string;
  version: string;
  modifiedAt: Date;
  csrfToken: string;
  validationErrors: ValidationIssue[];
  notice?: { kind: "success" | "error" | "info"; message: string };
}) => (
  <Layout title="Repair configuration" admin csrfToken={csrfToken} scripts>
    <div class="admin-heading">
      <div>
        <span class="eyebrow">Configuration unavailable</span>
        <h1>Repair Rations</h1>
      </div>
    </div>
    {notice ? (
      <div class={`notice notice-${notice.kind}`} role="status">
        {notice.message}
      </div>
    ) : null}
    <div class="notice notice-error" role="alert">
      <strong>The active YAML is invalid.</strong> Public schedules remain
      unavailable until a valid version is saved or restored.
      {validationErrors.length ? (
        <ul class="validation-list">
          {validationErrors.map((error) => (
            <li>
              <code>{error.path}</code>: {error.message}
            </li>
          ))}
        </ul>
      ) : null}
    </div>
    <section class="admin-section editor-section" id="editor">
      <div class="section-heading">
        <div>
          <span class="eyebrow">Recovery editor</span>
          <h2>Complete YAML</h2>
        </div>
        <span class="modified">
          Last modified {modifiedAt.toLocaleString("en-GB")}
        </span>
      </div>
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
            Save valid configuration
          </button>
          <button
            class="button"
            type="submit"
            formaction="/admin/config/validate"
          >
            Validate
          </button>
          <a class="button button-quiet" href="/admin#editor" data-reload>
            Reload
          </a>
        </div>
      </form>
    </section>
  </Layout>
);
