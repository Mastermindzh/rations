import type {
  AppConfig,
  GameNightConfig,
  ValidationIssue,
} from "../config/types.js";
import type { GameNightOccurrence } from "../schedule/types.js";
import type { Proposal } from "../proposals/types.js";
import type { Notice } from "./notice.js";
import { configuredLocale } from "../config/locale.js";
import { Layout } from "./layout.js";
import {
  CsrfField,
  ExtraBadge,
  formatTurnDate,
  OriginalTurnDate,
  Portrait,
} from "./shared.js";
import { AdminProposalsSection } from "./admin-proposals.js";
import { ConfigEditorForm, ValidationIssueList } from "./admin-editor.js";
import { NoticeBanner } from "./notice-banner.js";
import { todayInTimezone } from "../schedule/calendar-date.js";
import { SkipPreview } from "./skip-preview.js";

type QuickNight = {
  night: GameNightConfig;
  current: GameNightOccurrence;
  next: GameNightOccurrence;
  reschedule: GameNightOccurrence;
};

type AdminDashboardPageProps = {
  config: AppConfig;
  rawYaml: string;
  version: string;
  modifiedAt: Date;
  csrfToken: string;
  quickNights: QuickNight[];
  proposals?: Proposal[];
  validationErrors?: ValidationIssue[];
  notice?: Notice;
};

export const AdminDashboardPage = ({
  config,
  rawYaml,
  version,
  modifiedAt,
  csrfToken,
  quickNights,
  proposals = [],
  validationErrors = [],
  notice,
}: AdminDashboardPageProps) => (
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
    {notice ? <NoticeBanner notice={notice} /> : null}

    <section class="admin-section">
      <div class="section-heading">
        <div>
          <span class="eyebrow">At a glance</span>
          <h2>Quick actions</h2>
        </div>
      </div>
      <div class="quick-grid">
        {quickNights.map(({ night, current, next, reschedule }) => {
          const person = config.people[current.personId]!;
          const nextPerson = config.people[next.personId]!;
          const confirmation = `Delay ${person.name} once?\n\n${formatTurnDate(current.date, config.site.timezone)}: ${nextPerson.name} instead of ${person.name}\n${formatTurnDate(next.date, config.site.timezone)}: ${person.name} instead of ${nextPerson.name}`;
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
                      {formatTurnDate(current.date, config.site.timezone)}
                      <ExtraBadge turn={current} />
                      <OriginalTurnDate
                        turn={current}
                        timezone={config.site.timezone}
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
                      Next · {formatTurnDate(next.date, config.site.timezone)}
                      <ExtraBadge turn={next} />
                      <OriginalTurnDate
                        turn={next}
                        timezone={config.site.timezone}
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
                    value={current.date}
                  />
                  <input type="hidden" name="returnTo" value="/admin" />
                  <button
                    class="button button-accent button-full"
                    type="submit"
                  >
                    Delay {person.name} once
                  </button>
                </form>
              ) : night.people.length < 2 ? (
                <p class="muted small">
                  A one-person rotation cannot be delayed.
                </p>
              ) : (
                <p class="muted small">
                  {person.name} is already up next, so there is nothing to swap.
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
                  value={reschedule.originalDate ?? reschedule.date}
                />
                <label for={`next-date-${night.id}`}>Next game date</label>
                <div class="reschedule-controls">
                  <input
                    id={`next-date-${night.id}`}
                    name="newDate"
                    type="date"
                    value={reschedule.date}
                    required
                  />
                  <button class="button" type="submit">
                    Save date
                  </button>
                  {reschedule.originalDate ? (
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
              <form
                class="reschedule-form extra-day-form"
                method="post"
                action={`/admin/night/${night.id}/extra-day`}
              >
                <CsrfField token={csrfToken} />
                <input type="hidden" name="expectedVersion" value={version} />
                <label for={`extra-date-${night.id}`}>Add an extra day</label>
                <div class="reschedule-controls">
                  <input
                    id={`extra-date-${night.id}`}
                    name="date"
                    type="date"
                    required
                  />
                  <input
                    name="reason"
                    type="text"
                    placeholder="Reason (optional)"
                    maxlength={80}
                  />
                  <button class="button" type="submit">
                    Add extra day
                  </button>
                </div>
                <small class="muted small">
                  Takes the next person in the rotation and shifts the rest.
                </small>
              </form>
              <form
                class="reschedule-form"
                method="post"
                action={`/admin/night/${night.id}/${current.isExtra ? "remove-extra" : "skip"}`}
                data-confirm={
                  current.isExtra
                    ? "Remove this extra day and its rotation turn?"
                    : "Skip this night and shift later assignments?"
                }
              >
                <CsrfField token={csrfToken} />
                <input type="hidden" name="expectedVersion" value={version} />
                <input type="hidden" name="date" value={current.date} />
                {!current.isExtra ? (
                  <SkipPreview
                    config={config}
                    gameNightId={night.id}
                    date={current.date}
                  />
                ) : null}
                <button class="button" type="submit">
                  {current.isExtra ? "Remove extra day" : "Skip this night"}
                </button>
              </form>
              {config.skippedDays
                .filter((item) => item.gameNight === night.id)
                .slice()
                .sort((a, b) => b.date.localeCompare(a.date))
                .map((item) => (
                  <form
                    class="reschedule-form"
                    method="post"
                    action={`/admin/night/${night.id}/restore`}
                    data-confirm="Restore this night and its rotation turn?"
                  >
                    <CsrfField token={csrfToken} />
                    <input
                      type="hidden"
                      name="expectedVersion"
                      value={version}
                    />
                    <input type="hidden" name="date" value={item.date} />
                    <p class="muted small">
                      Skipped {formatTurnDate(item.date, config.site.timezone)}
                      {item.reason ? ` · ${item.reason}` : ""}
                    </p>
                    {item.date >= todayInTimezone(config.site.timezone) ? (
                      <button class="button" type="submit">
                        Restore night
                      </button>
                    ) : null}
                  </form>
                ))}
            </article>
          );
        })}
      </div>
    </section>
    <AdminProposalsSection
      config={config}
      proposals={proposals}
      csrfToken={csrfToken}
    />
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
        {modifiedAt.toLocaleString(configuredLocale(), {
          dateStyle: "medium",
          timeStyle: "short",
          timeZone: config.site.timezone,
        })}
      </span>
      {validationErrors.length ? (
        <div class="notice notice-error" role="alert">
          <strong>Configuration needs attention</strong>
          <ValidationIssueList issues={validationErrors} />
        </div>
      ) : null}
      <ConfigEditorForm
        rawYaml={rawYaml}
        version={version}
        csrfToken={csrfToken}
        saveLabel="Save configuration"
      />
    </details>
  </Layout>
);
