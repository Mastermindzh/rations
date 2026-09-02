(() => {
  async function copyText(value) {
    if (navigator.clipboard?.writeText) {
      try {
        await navigator.clipboard.writeText(value);
        return;
      } catch {
        // Fall back for browsers or contexts that deny Clipboard API access.
      }
    }
    const input = document.createElement("textarea");
    input.value = value;
    input.style.position = "fixed";
    input.style.opacity = "0";
    document.body.append(input);
    input.select();
    const copied = document.execCommand("copy");
    input.remove();
    if (!copied) {
      throw new Error("Clipboard copy failed");
    }
  }

  document.querySelectorAll("[data-share-url]").forEach((button) => {
    button.addEventListener("click", async () => {
      const relativeUrl = button.dataset.shareUrl;
      if (!relativeUrl) {
        return;
      }
      const url = new URL(relativeUrl, window.location.origin).toString();
      try {
        await copyText(url);
        button.textContent = "Copied!";
        button.classList.add("is-copied");
        window.setTimeout(() => {
          button.textContent = "Share";
          button.classList.remove("is-copied");
        }, 1800);
      } catch {
        button.textContent = "Copy failed";
        window.setTimeout(() => {
          button.textContent = "Share";
        }, 1800);
      }
    });
  });

  document.querySelectorAll("form[data-confirm]").forEach((candidate) => {
    candidate.addEventListener("submit", (event) => {
      if (!window.confirm(candidate.dataset.confirm || "Continue?")) {
        event.preventDefault();
      }
    });
  });

  function initEditor() {
    const editor = document.querySelector("[data-yaml-editor]");
    const form = document.querySelector("[data-editor-form]");
    if (!editor || !form) {
      return;
    }

    let dirty = false;
    const initial = editor.value;
    editor.addEventListener("input", () => {
      dirty = editor.value !== initial;
    });
    editor.addEventListener("keydown", (event) => {
      if (event.key === "Tab") {
        event.preventDefault();
        const start = editor.selectionStart;
        editor.setRangeText("  ", start, editor.selectionEnd, "end");
        dirty = true;
      }
      if ((event.ctrlKey || event.metaKey) && event.key.toLowerCase() === "s") {
        event.preventDefault();
        form.requestSubmit(form.querySelector('button[type="submit"]'));
      }
    });
    form.addEventListener("submit", () => {
      dirty = false;
    });
    document
      .querySelector("[data-reload]")
      ?.addEventListener("click", (event) => {
        if (
          dirty &&
          !window.confirm("Discard your unsaved changes and reload?")
        ) {
          event.preventDefault();
        }
      });
    window.addEventListener("beforeunload", (event) => {
      if (!dirty) {
        return;
      }
      event.preventDefault();
      event.returnValue = "";
    });
  }

  const VOTER_COOKIE = "rations_voter";
  function readCookie(name) {
    const hit = document.cookie
      .split("; ")
      .find((entry) => entry.startsWith(name + "="));
    return hit ? decodeURIComponent(hit.slice(name.length + 1)) : "";
  }
  function writeCookie(name, value, path) {
    document.cookie =
      name +
      "=" +
      encodeURIComponent(value) +
      "; path=" +
      path +
      "; max-age=" +
      60 * 60 * 24 * 365 +
      "; samesite=lax";
  }

  // Wires every vote group, remembering the chosen name across groups and visits.
  function initVoting() {
    const groups = [...document.querySelectorAll("[data-vote-group]")]
      .map(setupVoteGroup)
      .filter(Boolean);
    if (groups.length === 0) {
      return;
    }

    function applyPerson(person) {
      for (const group of groups) {
        if ([...group.voter.options].some((o) => o.value === person)) {
          group.voter.value = person;
        }
        group.highlight();
      }
    }

    const saved = readCookie(VOTER_COOKIE);
    if (saved) {
      applyPerson(saved);
    }

    for (const group of groups) {
      group.voter.addEventListener("change", () => {
        if (group.voter.value) {
          writeCookie(VOTER_COOKIE, group.voter.value, group.cookiePath);
        }
        applyPerson(group.voter.value);
      });
    }
  }

  // Highlights the selected person's current vote per date; clicking a thumb
  // selects or switches the vote.
  function setupVoteGroup(group) {
    const voter = group.querySelector("[data-voter]");
    if (!voter) {
      return null;
    }
    let votes = {};
    let people = {};
    try {
      votes = JSON.parse(group.dataset.votes || "{}");
    } catch {
      votes = {};
    }
    try {
      people = JSON.parse(group.dataset.people || "{}");
    } catch {
      people = {};
    }
    const rows = [...group.querySelectorAll("[data-date-row]")];

    function tallyFor(date) {
      const entries = Object.entries(votes[date] || {});
      return {
        up: entries.filter(([, v]) => v === "up").map(([p]) => p),
        down: entries.filter(([, v]) => v === "down").map(([p]) => p),
      };
    }

    // Redraws one row's counts, hover titles, and active highlight from state.
    function renderRow(row) {
      const date = row.dataset.date;
      const { up, down } = tallyFor(date);
      const person = voter.value;
      const current = person ? (votes[date] || {})[person] : "";
      row.querySelectorAll("[data-vote-button]").forEach((button) => {
        const dir = button.dataset.vote;
        const list = dir === "up" ? up : down;
        button.textContent = (dir === "up" ? "👍 " : "👎 ") + list.length;
        button.title = list.length
          ? list.map((id) => people[id] || id).join(", ")
          : "No votes yet";
        button.classList.toggle("is-active", current === dir);
      });
    }

    function highlight() {
      rows.forEach(renderRow);
    }

    for (const row of rows) {
      const form = row.querySelector("[data-vote-form]");
      const date = row.dataset.date;
      row.querySelectorAll("[data-vote-button]").forEach((button) => {
        button.addEventListener("click", async () => {
          const person = voter.value;
          if (!person) {
            window.alert("Pick your name first.");
            return;
          }
          const before = (votes[date] || {})[person];
          const target = button.dataset.vote;
          const value = target;

          // Optimistic update, then persist without leaving the page.
          (votes[date] = votes[date] || {})[person] = value;
          renderRow(row);

          form.querySelector("[data-person]").value = person;
          form.querySelector("[data-vote-value]").value = value;
          try {
            const res = await fetch(form.getAttribute("action"), {
              method: "POST",
              headers: { "X-Requested-With": "fetch" },
              body: new FormData(form),
            });
            if (!res.ok) {
              throw new Error("vote failed");
            }
          } catch {
            if (before) {
              (votes[date] = votes[date] || {})[person] = before;
            } else {
              delete (votes[date] || {})[person];
            }
            renderRow(row);
            window.alert("Could not save your vote. Try again.");
          }
        });
      });
    }

    return {
      voter,
      highlight,
      cookiePath: group.dataset.voterCookiePath || "/",
    };
  }

  function initProposalIdentity() {
    const saved = readCookie(VOTER_COOKIE);
    document
      .querySelectorAll("[data-voter-cookie-path]")
      .forEach((container) => {
        const select = container.querySelector("[data-person-select]");
        if (!select) {
          return;
        }
        if (
          saved &&
          [...select.options].some((option) => option.value === saved)
        ) {
          select.value = saved;
        }
        select.addEventListener("change", () => {
          if (select.value) {
            writeCookie(
              VOTER_COOKIE,
              select.value,
              container.dataset.voterCookiePath || "/",
            );
          }
        });
      });
  }

  function initPlannerForm(form) {
    const chips = form.querySelector("[data-chips]");
    const addInput = form.querySelector("[data-add-date]");
    const selected = new Set();

    function render() {
      chips.textContent = "";
      for (const date of [...selected].sort()) {
        const chip = document.createElement("span");
        chip.className = "date-chip";
        const label = document.createElement("span");
        label.textContent = date;
        const hidden = document.createElement("input");
        hidden.type = "hidden";
        hidden.name = "dates";
        hidden.value = date;
        const remove = document.createElement("button");
        remove.type = "button";
        remove.setAttribute("aria-label", "Remove " + date);
        remove.textContent = "×";
        remove.addEventListener("click", () => {
          selected.delete(date);
          render();
        });
        chip.append(label, hidden, remove);
        chips.append(chip);
      }
    }

    const today = form.dataset.today;
    function addDate(value) {
      if (value && value >= today) {
        selected.add(value);
      }
    }

    form.querySelectorAll("[data-shortcut]").forEach((button) => {
      button.addEventListener("click", () => {
        (button.dataset.dates || "")
          .split(",")
          .filter(Boolean)
          .forEach(addDate);
        render();
      });
    });

    form
      .querySelector("[data-add-date-button]")
      ?.addEventListener("click", () => {
        addDate(addInput.value);
        addInput.value = "";
        render();
      });

    const rangeStart = form.querySelector("[data-range-start]");
    const rangeEnd = form.querySelector("[data-range-end]");
    form
      .querySelector("[data-add-range-button]")
      ?.addEventListener("click", () => {
        const start = rangeStart.value;
        const end = rangeEnd.value;
        if (!start || !end || end < start) {
          window.alert("Pick a valid start and end date.");
          return;
        }
        let cursor = start;
        for (let guard = 0; cursor <= end && guard < 366; guard += 1) {
          addDate(cursor);
          const next = new Date(cursor + "T00:00:00Z");
          next.setUTCDate(next.getUTCDate() + 1);
          cursor = next.toISOString().slice(0, 10);
        }
        render();
      });

    const toggle = form.querySelector("[data-threshold-toggle]");
    const number = form.querySelector("[data-threshold-input]");
    toggle?.addEventListener("change", () => {
      number.disabled = !toggle.checked;
    });

    form.addEventListener("submit", (event) => {
      if (selected.size === 0) {
        event.preventDefault();
        window.alert("Add at least one date first.");
      }
    });
  }

  // Run after all declarations so const helpers are initialized.
  initEditor();
  const plannerForm = document.querySelector("[data-planner-form]");
  if (plannerForm) {
    initPlannerForm(plannerForm);
  }
  initProposalIdentity();
  initVoting();
})();
