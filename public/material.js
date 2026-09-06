// Framework-independent Material presentation. Icons work offline.
const paths = {
  nfc: "M5 9a5 5 0 0 1 0 6M9 6a10 10 0 0 1 0 12M13 3a15 15 0 0 1 0 18M2 12h.01",
  message: "M3 4h18v13H8l-5 4V4Zm4 4h10M7 12h7",
  home: "M3 3h7v7H3zM14 3h7v7h-7zM3 14h7v7H3zM14 14h7v7h-7z",
  incidents: "M12 3 2 21h20L12 3Zm0 6v5m0 3h.01",
  summaries: "M6 3h9l4 4v14H6zM14 3v5h5M9 12h7m-7 4h7",
  admin:
    "M12 8a4 4 0 1 0 0 8 4 4 0 0 0 0-8Zm0-6v3m0 14v3M2 12h3m14 0h3M5 5l2 2m10 10 2 2M5 19l2-2M17 7l2-2",
  round:
    "M4 3h5v5H4zM15 3h5v5h-5zM4 15h5v5H4zM15 15h2v2h3v3h-5zM4 11h4m4-8v9h8m-8 4v5",
  report:
    "M12 3a3 3 0 0 0-3 3v6a3 3 0 0 0 6 0V6a3 3 0 0 0-3-3ZM5 11v1a7 7 0 0 0 14 0v-1M12 19v3m-4 0h8",
  instructions: "M4 9v6h4l5 4V5L8 9H4Zm13-2a8 8 0 0 1 0 10m-1-7a4 4 0 0 1 0 4",
  call: "m6 3 4 5-3 3a16 16 0 0 0 6 6l3-3 5 4-2 3C10 23 1 14 3 5l3-2Z",
  refresh:
    "M20 7v5h-5M4 17v-5h5M5 8a8 8 0 0 1 13-3l2 3M4 16l2 3a8 8 0 0 0 13-3",
  logout: "M10 4H4v16h6m5-12 4 4-4 4m-7-4h11",
  back: "m12 5-7 7 7 7M5 12h15",
  play: "m8 4 12 8-12 8V4Z",
  stop: "M5 5h14v14H5z",
  check: "m5 12 4 4L19 6",
  download: "M12 3v12m-5-5 5 5 5-5M4 16v5h16v-5",
  photo: "M3 5h18v15H3zM3 16l6-6 5 5 3-3 4 4M16 8h.01",
  print: "M6 8V3h12v5M6 17H3V9h18v8h-3M6 14h12v7H6zM17 11h.01",
  person: "M12 3a4 4 0 1 0 0 8 4 4 0 0 0 0-8ZM4 21v-3c0-6 16-6 16 0v3",
  shield: "m12 2 8 3v6c0 5-4 8-8 11-4-3-8-6-8-11V5l8-3Zm-4 9 3 3 5-6",
};
export const icon = (name) =>
  `<svg class="md-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="${paths[name] || paths.check}"/></svg>`;
const actionIcons = {
  logout: "logout",
  sync: "refresh",
  refresh: "refresh",
  alert: "incidents",
  camera: "round",
  nfc: "nfc",
  newRound: "round",
  speakInstructions: "instructions",
  listenReport: "instructions",
  transcribe: "report",
  summary: "summaries",
  download: "download",
  qr: "print",
  print: "print",
  ackNotification: "check",
  source: "summaries",
};
let fieldId = 0;
function decorate(root) {
  root
    .querySelectorAll("button:not([data-md]),a.button:not([data-md])")
    .forEach((button) => {
      button.dataset.md = "true";
      const raw = button.textContent.trim();
      let name =
        actionIcons[button.dataset.action] ||
        { instructionSetup: "instructions", patrols: "round", setup: "admin" }[
          button.dataset.page
        ] ||
        button.dataset.page;
      if (button.classList.contains("back")) name = "back";
      if (button.dataset.action === "shift")
        name = raw.includes("End") ? "stop" : "play";
      if (button.dataset.action === "media")
        name = button.dataset.mime?.startsWith("audio") ? "play" : "photo";
      if (button.id === "record") name = "report";
      if (
        button.classList.contains("call") &&
        button.dataset.page !== "message"
      )
        name = "call";
      if (!name) return;
      let text = raw
        .replace(/^(?:◖\)\)|[▦♩!◉▤⚙↻☎▶□←●▧])\s*/, "")
        .replace(/\s*→$/, "");
      button.setAttribute("aria-label", text);
      button.innerHTML = icon(name) + '<span class="button-label"></span>';
      button.querySelector(".button-label").textContent = text;
      if (button.closest("nav")) {
        button.setAttribute(
          "aria-current",
          button.classList.contains("active") ? "page" : "false",
        );
        button.title = text;
      }
    });
  root.querySelectorAll(".stat:not([data-md])").forEach((card, i) => {
    card.dataset.md = "true";
    card.insertAdjacentHTML(
      "afterbegin",
      `<div class="stat-symbol">${icon(["person", "round", "incidents", "check"][i])}</div>`,
    );
  });
  root.querySelectorAll(".label:not([for])").forEach((label) => {
    let input = label.nextElementSibling;
    if (input?.matches("input,textarea,select")) {
      input.id ||= `md-field-${++fieldId}`;
      label.htmlFor = input.id;
    }
  });
  root
    .querySelectorAll("progress")
    .forEach((p) => p.setAttribute("aria-label", "Checkpoint progress"));
  root
    .querySelectorAll("nav")
    .forEach((n) => n.setAttribute("aria-label", "Main navigation"));
}
export function watchMaterial(root) {
  const observer = new MutationObserver(() => decorate(root));
  observer.observe(root, { childList: true, subtree: true });
  decorate(root);
}
