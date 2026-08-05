import type {
  AppConfig,
  GameNightConfig,
  ValidationIssue,
} from "../config/types.js";
import type { GameNightOccurrence } from "../schedule/types.js";
import { Layout } from "./layout.js";
import {
  CsrfField,
  formatTurnDate,
  OriginalTurnDate,
  Portrait,
} from "./shared.js";

type QuickNight = {
  night: GameNightConfig;
  current: GameNightOccurrence;
  next: GameNightOccurrence;
};

export const AdminDashboardPage = ({
  config,
  rawYaml,
  version,
  modifiedAt,
  csrfToken,
  quickNights,
  validationErrors = [],
  notice,
}: {
  config: AppConfig;
  rawYaml: string;
  version: string;
  modifiedAt: Date;
  csrfToken: string;
  quickNights: QuickNight[];
  validationErrors?: ValidationIssue[];
  notice?: { kind: "success" | "error" | "info"; message: string };
}) => (
  <Layout
    title="Admin"
    siteTitle={config.site.title}
    admin
    csrfToken={csrfToken}
    scripts
  >
    <div class="admin-heading">
      <div>
        <h1>Control room</h1>
      </div>
    </div>
    {notice ? (
      <div class={`notice notice-${notice.kind}`} role="status">
        {notice.message}
      </div>
    ) : null}

    <section class="admin-section">
      <div class="section-heading">
        <div>
          <span class="eyebrow">At a glance</span>
          <h2>Quick actions</h2>
        </div>
      </div>
      <div class="quick-grid">
        {quickNights.map(({ night, current, next }) => {
          const person = config.people[current.personId]!;
          const nextPerson = config.people[next.personId]!;
          const confirmation = `Delay ${person.name} once?\n\n${formatTurnDate(current.date, config.site.timezone, false)}: ${nextPerson.name} instead of ${person.name}\n${formatTurnDate(next.date, config.site.timezone, false)}: ${person.name} instead of ${nextPerson.name}`;
          return (
            <article class="quick-card">
              <div class="quick-title">
                <h3>{night.name}</h3>
                <a href={`/night/${night.id}`}>View ↗</a>
              </div>
              <div class="quick-people">
                <div class="quick-person">
                  <Portrait person={person} />
                  <div>
                    <span>
                      Current ·{" "}
                      {formatTurnDate(
                        current.date,
                        config.site.timezone,
                        false,
                      )}
                      <OriginalTurnDate
                        turn={current}
                        timezone={config.site.timezone}
                        includeWeekday={false}
                        reserveSpace
                      />
                    </span>
                    <strong>{person.name}</strong>
                  </div>
                </div>
                <span class="swap-arrow" aria-hidden="true">
                  →
                </span>
                <div class="quick-person">
                  <Portrait person={nextPerson} />
                  <div>
                    <span>
                      Next ·{" "}
                      {formatTurnDate(next.date, config.site.timezone, false)}
                      <OriginalTurnDate
                        turn={next}
                        timezone={config.site.timezone}
                        includeWeekday={false}
                        reserveSpace
                      />
                    </span>
                    <strong>{nextPerson.name}</strong>
                  </div>
                </div>
              </div>
              {current.personId !== next.personId ? (
                <form
                  method="post"
                  action={`/admin/night/${night.id}/delay-once`}
                  data-confirm={confirmation}
                >
                  <CsrfField token={csrfToken} />
                  <input type="hidden" name="expectedVersion" value={version} />
                  <input
                    type="hidden"
                    name="currentDate"
                    value={current.originalDate ?? current.date}
                  />
                  <input type="hidden" name="returnTo" value="/admin" />
                  <button
                    class="button button-accent button-full"
                    type="submit"
                  >
                    Delay {person.name} once
                  </button>
                </form>
              ) : (
                <p class="muted small">
                  A one-person rotation cannot be delayed.
                </p>
              )}
              <form
                class="reschedule-form"
                method="post"
                action={`/admin/night/${night.id}/reschedule`}
              >
                <CsrfField token={csrfToken} />
                <input type="hidden" name="expectedVersion" value={version} />
                <input
                  type="hidden"
                  name="oldDate"
                  value={current.originalDate ?? current.date}
                />
                <label for={`next-date-${night.id}`}>Next game date</label>
                <div class="reschedule-controls">
                  <input
                    id={`next-date-${night.id}`}
                    name="newDate"
                    type="date"
                    value={current.date}
                    required
                  />
                  <button class="button" type="submit">
                    Save date
                  </button>
                  {current.originalDate ? (
                    <button
                      class="button button-quiet"
                      type="submit"
                      name="reset"
                      value="true"
                    >
                      Reset
                    </button>
                  ) : null}
                </div>
              </form>
            </article>
          );
        })}
      </div>
    </section>

    <details
      class="admin-section editor-section"
      id="editor"
      open={validationErrors.length > 0}
    >
      <summary class="editor-summary">
        <span>YAML configuration</span>
      </summary>
      <span class="modified">
        Last modified{" "}
        {modifiedAt.toLocaleString("en-GB", {
          dateStyle: "medium",
          timeStyle: "short",
        })}
      </span>
      {validationErrors.length ? (
        <div class="notice notice-error" role="alert">
          <strong>Configuration needs attention</strong>
          <ul class="validation-list">
            {validationErrors.map((error) => (
              <li>
                <code>{error.path}</code>: {error.message}
              </li>
            ))}
          </ul>
        </div>
      ) : null}
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
            Save configuration
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
    </details>
  </Layout>
);
