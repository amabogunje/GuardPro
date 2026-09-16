import { shiftSettings } from "./shifts.js";
import { teamSettings } from "./team.js";
import { checkpointSettings, closeCheckpoints } from "./checkpoints.js";
let selected = "shifts";
export function resetSettings() {
  selected = "shifts";
}
export async function renderSettings(
  host,
  { site, state, api, esc, icon, done },
) {
  host.innerHTML = `<nav class="actions supervisor-actions settings-tabs" role="tablist" aria-label="Settings">${[
    ["shifts", "shifts", "Shifts"],
    ["checkpoints", "round", "Checkpoints"],
    ["team", "person", "Users"],
  ]
    .map(
      ([id, glyph, label]) =>
        `<button type="button" role="tab" id="settings-tab-${id}" aria-controls="settings-panel" aria-selected="${selected === id}" data-tab="${id}" data-md="true"><span class="action-icon">${icon(glyph)}</span><span class="button-label">${label}</span></button>`,
    )
    .join(
      "",
    )}</nav><div id="settings-panel" role="tabpanel" aria-labelledby="settings-tab-${selected}"><p role="status">Loading settings…</p></div>`;
  const panel = host.querySelector("#settings-panel");
  let data;
  try {
    data = await api("/api/settings/" + site.id);
  } catch (e) {
    panel.textContent = e.message;
    return;
  }
  if (!host.isConnected) return;
  function draw() {
    closeCheckpoints();

    host
      .querySelectorAll("[data-tab]")
      .forEach((b) =>
        b.setAttribute("aria-selected", String(b.dataset.tab === selected)),
      );
    panel.setAttribute("aria-labelledby", "settings-tab-" + selected);
    if (selected === "shifts") {
      shiftSettings(panel,{site,shifts:data.shifts,users:data.users,api,esc,icon,done});
    } else if (selected === "checkpoints") {
      checkpointSettings(panel,{site,state,api,esc,icon,done});
    } else {
      teamSettings(panel,{site,users:data.users,reusableUsers:data.reusableUsers,api,esc,icon,done,allowReuse:state.user?.role==='owner'});
    }
  }
  host.querySelectorAll("[data-tab]").forEach(
    (b) =>
      (b.onclick = (e) => {
        e.stopPropagation();
        selected = b.dataset.tab;
        draw();
      }),
  );
  draw();
}
