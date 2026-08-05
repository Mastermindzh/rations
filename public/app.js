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
    if (!copied) throw new Error("Clipboard copy failed");
  }

  document.querySelectorAll("[data-share-url]").forEach((button) => {
    button.addEventListener("click", async () => {
      const relativeUrl = button.dataset.shareUrl;
      if (!relativeUrl) return;
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
      if (!window.confirm(candidate.dataset.confirm || "Continue?"))
        event.preventDefault();
    });
  });

  const editor = document.querySelector("[data-yaml-editor]");
  const form = document.querySelector("[data-editor-form]");
  if (!editor || !form) return;

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
      if (dirty && !window.confirm("Discard your unsaved changes and reload?"))
        event.preventDefault();
    });
  window.addEventListener("beforeunload", (event) => {
    if (!dirty) return;
    event.preventDefault();
    event.returnValue = "";
  });
})();
