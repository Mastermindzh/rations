# Changelog

All notable changes to Rations are documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.1.0/),
and this project follows [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

## [1.2.0] - 2026-09-02

### Added

- Proposals
  - Date proposals for moving an existing game night or planning one or more additional dates.
  - Per-person voting with automatic hiding of candidates that exceed the down-vote threshold.
  - Admin controls for reviewing, approving, denying, and deleting proposals.
    - Atomic `proposals.yml` storage, validation, partial-failure handling, and an admin repair notice for invalid proposal data.

- Configurable human-readable date formatting (e.g. Wednesday August 6th, not 2026-08-06) through the `LOCALE` environment variable.
- Request throttling for public proposal mutations.

### Changed

- Snack duty is now assigned after recurring, moved, and extra nights are placed in chronological order. Moving a date no longer carries its old assignment or shuffles the people queue.
- “Delay once” swaps the next two actual recurring nights, including when date moves have changed their order.
- Long and eliminated proposal candidate lists can be collapsed or scrolled to keep proposal cards compact.
- Shared view, form, storage, date, authentication, and image-format behavior has been consolidated into reusable modules.
- Runtime and development dependencies have been updated, including Hono 4.13, TypeScript 7, and Node.js 26 type definitions.

## [1.1.0] - 2026-08-06

### Added

- One-off extra game nights that consume the next snack-duty turn and advance the later rotation.

## [1.0.0] - 2026-08-05

### Added

- Initial release with recurring game-night schedules, snack-duty rotation, date and assignment overrides, password-protected shared pages, and YAML-backed administration.
