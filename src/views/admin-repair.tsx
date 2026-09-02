import type { ValidationIssue } from "../config/types.js";
import type { Notice } from "./notice.js";
import { configuredLocale } from "../config/locale.js";
import { Layout } from "./layout.js";
import { ConfigEditorForm, ValidationIssueList } from "./admin-editor.js";
import { NoticeBanner } from "./notice-banner.js";

type AdminRepairPageProps = {
  rawYaml: string;
  version: string;
  modifiedAt: Date;
  csrfToken: string;
  validationErrors: ValidationIssue[];
  notice?: Notice;
};

export const AdminRepairPage = ({
  rawYaml,
  version,
  modifiedAt,
  csrfToken,
  validationErrors,
  notice,
}: AdminRepairPageProps) => (
  <Layout title="Repair configuration" admin csrfToken={csrfToken} scripts>
    <div class="admin-heading">
      <div>
        <span class="eyebrow">Configuration unavailable</span>
        <h1>Repair Rations</h1>
      </div>
    </div>
    {notice ? <NoticeBanner notice={notice} /> : null}
    <div class="notice notice-error" role="alert">
      <strong>The active YAML is invalid.</strong> Public schedules remain
      unavailable until a valid version is saved or restored.
      {validationErrors.length ? (
        <ValidationIssueList issues={validationErrors} />
      ) : null}
    </div>
    <section class="admin-section editor-section" id="editor">
      <div class="section-heading">
        <div>
          <span class="eyebrow">Recovery editor</span>
          <h2>Complete YAML</h2>
        </div>
        <span class="modified">
          Last modified {modifiedAt.toLocaleString(configuredLocale())}
        </span>
      </div>
      <ConfigEditorForm
        rawYaml={rawYaml}
        version={version}
        csrfToken={csrfToken}
        saveLabel="Save valid configuration"
      />
    </section>
  </Layout>
);
