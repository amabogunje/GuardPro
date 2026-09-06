// Framework-independent Material presentation. Icons work offline.
const paths = {
  payment: "M3 5h18v14H3zM3 9h18M6 15h4",
  location: "M12 22s8-8 8-14a8 8 0 0 0-16 0c0 6 8 14 8 14ZM12 5a3 3 0 1 0 0 6 3 3 0 0 0 0-6Z",
  shifts: "M12 3a9 9 0 1 0 0 18 9 9 0 0 0 0-18Zm0 4v5l3 2",
  nfc: "M5 9a5 5 0 0 1 0 6M9 6a10 10 0 0 1 0 12M13 3a15 15 0 0 1 0 18M2 12h.01",
  message: "M3 4h18v13H8l-5 4V4Zm4 4h10M7 12h7",
  home: "M3 3h7v7H3zM14 3h7v7h-7zM3 14h7v7H3zM14 14h7v7h-7z",
  incidents: "M12 3 2 21h20L12 3Zm0 6v5m0 3h.01",
  summaries: "M6 3h9l4 4v14H6zM14 3v5h5M9 12h7m-7 4h7",
  admin:
    "M7.50 2.70L8.71 1.42L9.87 1.77L10.17 3.51L10.89 4.11L12.66 4.06L13.23 5.13L12.21 6.56L12.30 7.50L13.58 8.71L13.23 9.87L11.49 10.17L10.89 10.89L10.94 12.66L9.87 13.23L8.44 12.21L7.50 12.30L6.29 13.58L5.13 13.23L4.83 11.49L4.11 10.89L2.34 10.94L1.77 9.87L2.79 8.44L2.70 7.50L1.42 6.29L1.77 5.13L3.51 4.83L4.11 4.11L4.06 2.34L5.13 1.77L6.56 2.79Z M5.5 7.5a2 2 0 1 0 4 0a2 2 0 1 0 -4 0 M17.00 12.90L18.03 11.80L19.03 12.10L19.28 13.59L19.90 14.10L21.41 14.06L21.90 14.97L21.02 16.20L21.10 17.00L22.20 18.03L21.90 19.03L20.41 19.28L19.90 19.90L19.94 21.41L19.03 21.90L17.80 21.02L17.00 21.10L15.97 22.20L14.97 21.90L14.72 20.41L14.10 19.90L12.59 19.94L12.10 19.03L12.98 17.80L12.90 17.00L11.80 15.97L12.10 14.97L13.59 14.72L14.10 14.10L14.06 12.59L14.97 12.10L16.20 12.98Z M15.3 17a1.7 1.7 0 1 0 3.4 0a1.7 1.7 0 1 0 -3.4 0",
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
