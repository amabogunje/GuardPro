let overviewDate = null;
import { ownerPage } from './owner.js';
const ownerSupervisionEnabled = () => user?.role === 'owner' && Boolean(state?.ownerSupervision?.some(entry=>entry.site_id===siteId));
const ownerSupervisorView = () => ownerSupervisionEnabled() && Boolean(vault?.ownerSupervisorView);
const supervisorView = () => user?.role === 'supervisor' || ownerSupervisorView();
async function setOwnerMode(supervisor) {
  if(user?.role!=='owner')return;
  if(supervisor&&!site()){page='property';render();return;}
  if(supervisor&&!ownerSupervisionEnabled()){page='supervisors';render();return;}
  vault.ownerSupervisorView=supervisor;page='home';selectedProblemId=null;selectedLocationShift=null;
  resetSettings();await persist();render();
}
function renderOwnerPage() {
  ownerPage(root,{page,site:site(),user,state,api,esc,icon,brand,siteSelect,selectedProblemId:ownerEvidenceProblemId,done:async()=>{await refresh();render();toast('Saved.');},supervise:()=>setOwnerMode(true)});
}
import { locationGroups, gpsReview } from './gps-review.js';
import { propertyEditor } from './property-location.js';
let selectedLocationShift=null;
import { renderSettings, resetSettings, selectSettings } from "./settings.js";
import { closeCheckpoints } from "./checkpoints.js";
import { currentPlan } from "./shift-plans.js";
import { supervisorSetupTasks } from "./supervisor-setup.js";
let attentionPage = 0, attentionOrder = "newest", attentionScope = "";
let selectedOverviewShift = null;
import {
  overviewDetails,
  overviewShifts,
  supervisorStatus,
} from "./supervisor-status.js";
import {
  closeInstructions,
  instructionEditor,
  instructionPlayer,
  cacheInstruction,
} from "./instructions.js";
let selectedReportId = null,
  reportMediaUrls = [];
let selectedProblemId = null;
let ownerEvidenceProblemId = null;
let problemQuery = "", problemPage = 0;
let activityPeriod = "daily";
function renderActivityReports(target) {
  const today = new Date(Date.now()+3600000).toISOString().slice(0,10);
  target.innerHTML = `<section class="card activity-report-controls"><div class="report-period"><span>Report period</span>${messagePicker("Choose report period","activityPeriod",[{value:"daily",label:"Daily"},{value:"monthly",label:"Monthly"},{value:"custom",label:"Custom dates"}],activityPeriod,"Daily")}</div><form id="activityReportForm">${activityPeriod === "daily" ? `<label class="label" for="activityDay">Date</label><input id="activityDay" name="date" type="date" required max="${today}" value="${today}">` : activityPeriod === "monthly" ? `<label class="label" for="activityMonth">Month</label><input id="activityMonth" name="month" type="month" required max="${today.slice(0,7)}" value="${today.slice(0,7)}">` : `<div class="report-range"><label>From<input name="from" type="date" required max="${today}" value="${today}"></label><label>To<input name="to" type="date" required max="${today}" value="${today}"></label></div>`}<div class="report-view-actions"><button class="primary" name="intent" value="view">View report</button><button name="intent" value="download">Download CSV</button></div></form><p class="report-period-note">Dates use Nigerian time. Today and the current month show activity so far.</p></section><div id="activityReportResult" aria-live="polite"></div>`;
}
async function viewActivityReport(form, download) {
  const values = Object.fromEntries(new FormData(form));
  let from = values.from, to = values.to;
  if (activityPeriod === "daily") from = to = values.date;
  if (activityPeriod === "monthly") {
    from = values.month+"-01";
    const start = new Date(from+"T12:00:00Z");
    to = new Date(Date.UTC(start.getUTCFullYear(),start.getUTCMonth()+1,0)).toISOString().slice(0,10);
    const today = new Date(Date.now()+3600000).toISOString().slice(0,10);
    if (to > today) to = today;
  }
  const report = await api("/api/activity-reports/"+encodeURIComponent(siteId)+"?"+new URLSearchParams({from,to}));
  const labels = {shiftStarts:"Shift starts",shiftEnds:"Shift ends",patrolStarts:"Patrols started",checkpointScans:"Checkpoint scans",problemsResolved:"Problems resolved"};
  const denominator = key => key === "problemsResolved" ? report.counts.problemsReported : report.expected?.[key];
  const metric = key => {
    const expected = denominator(key), actual = report.counts[key];
    const concern = expected == null || (key === "problemsResolved" ? actual < expected : actual !== expected);
    return `<dd>${concern ? '<span class="activity-caution" aria-label="Needs checking">' + icon("incidents") + '</span>' : ''}${actual} of ${expected == null ? '<span title="No historical schedule snapshot available">—</span>' : expected}</dd>`;
  };
  const localTime = at => new Date(at).toLocaleString("en-GB",{timeZone:"Africa/Lagos",dateStyle:"medium",timeStyle:"short"});
  $("#activityReportResult").innerHTML = `<section class="card activity-report"><h2>Activity report</h2><p>${esc(report.from)} to ${esc(report.to)}</p><dl class="activity-counts">${Object.entries(labels).map(([key,label])=>`<div><dt>${label}</dt>${metric(key)}</div>`).join("")}</dl><p class="muted">Actual of expected, for activity due by now. Problems resolved shows the current resolution status of problems reported in this period. New records may still be waiting to upload.${Object.values(report.expected || {}).some(v=>v==null) ? ' — means the historical schedule was not saved, so the expectation cannot be confirmed.' : ''}</p><details><summary>Activity records (${report.rows.length})</summary>${report.rows.map(r=>`<article class="activity-record"><strong>${esc(r.type)}</strong><small>${esc(r.person)} · ${esc(localTime(r.at))}</small>${r.details?'<p>'+esc(r.details)+'</p>':''}</article>`).join("") || '<p>No activity recorded in this period.</p>'}</details><small>Prepared ${esc(localTime(report.generatedAt))}</small></section>`;
  if (download) {
    const cell = value => '"' + String(value ?? "").replace(/^[=+@-]/,"'$&").replace(/"/g,'""') + '"';
    const rows = [["Activity report",report.site.name],["From",report.from],["To",report.to],["Timezone",report.timeZone],["Prepared",localTime(report.generatedAt)],["Expected activity due by now; uploads may be pending. Problems resolved uses current status of reports filed in the period."],[],["Metric","Actual","Expected / reported"],...Object.entries(labels).map(([key,label])=>[label,report.counts[key],denominator(key)??"Unknown — historical schedule unavailable"]),[],["Time (Nigeria)","Person","Activity","Details","Record ID","Server received"]];
    rows.push(...report.rows.map(r=>[localTime(r.at),r.person,r.type,r.details,r.id,r.received_at?localTime(r.received_at):""]));
    const url = URL.createObjectURL(new Blob(["\uFEFF"+rows.map(row=>row.map(cell).join(",")).join("\r\n")],{type:"text/csv;charset=utf-8"}));
    const link=document.createElement("a"); link.href=url; link.download="GuardPro-"+from+"-to-"+to+".csv"; link.click(); setTimeout(()=>URL.revokeObjectURL(url),1000);
  }
}
function renderSupervisorProblems(target, reports) {
  target.closest("main").classList.add("supervisor-problems");
  document.querySelector('.supervisor-heading [data-action="refresh"]')?.remove();
  document.querySelector(".supervisor-filters")?.remove();
  document.querySelector(".supervisor-mobile > .notice")?.remove();
  const selected = reports.find(i => i.id === selectedProblemId);
  target.classList.toggle("problem-index", !selected);
  if (selected) {
    document.querySelector(".supervisor-heading h2").textContent = "Problem Details";
    const back = document.querySelector(".greeting-row .back");
    back.removeAttribute("data-page");
    back.dataset.action = "problemList";
    back.textContent = "Problems";
    const event = eventList().find(e => e.id === selected.id);
    const audioOnly = event?.payload.report_format === "audio" || selected.report === "Voice report — listen to the attached recording.";
    const written = event?.payload.typed_report ?? (audioOnly ? "" : selected.report || "");
    const evidenceNotice = selected.evidence?.status === "incomplete" ? `<p class="notice pending">Supporting media incomplete (${selected.evidence.received} of ${selected.evidence.expected}). The guard must retry the upload before this problem can be resolved.</p>` : "";
    target.innerHTML = `<section class="card problem-detail" id="incident-${esc(selected.id)}"><p class="muted">Received on ${esc(date(selected.received_at))}<br>Reported by ${esc(guardName(selected.user_id))}</p>${evidenceNotice}<div id="problemAudio"></div>${written.trim() ? '<p class="problem-written">' + esc(written) + '</p>' : ''}<div id="problemPhotos"></div>${selected.status !== "Resolved" ? `<form class="problemResolve" data-id="${esc(selected.id)}"><p class="muted">Classify after you have addressed the problem: Security affects protection of people or property; Maintenance is a facility issue; Other does not fit either. Security priorities: P1 immediate danger, P2 urgent security concern, P3 routine security concern.</p><label class="label" for="problemCategory">Category</label><select id="problemCategory" name="category" required><option value="">Choose category</option><option value="security">Security</option><option value="maintenance">Maintenance</option><option value="other">Other</option></select><div id="problemPriorityField" hidden><label class="label" for="problemPriority">Security priority</label><select id="problemPriority" name="priority" disabled><option value="">Choose priority</option><option value="P1">P1 — Immediate danger</option><option value="P2">P2 — Urgent concern</option><option value="P3">P3 — Routine concern</option></select></div><label class="label" for="problemComments">Supervisor comments</label><textarea id="problemComments" name="note" maxlength="5000"></textarea><button class="primary wide" ${selected.evidence?.status === "incomplete" ? "disabled" : ""}>Resolve Problem</button></form>` : ""}</section>`;
    const category=target.querySelector('#problemCategory');
    if(category)category.onchange=()=>{
      const security=category.value==='security',priority=target.querySelector('#problemPriority');
      target.querySelector('#problemPriorityField').hidden=!security;
      priority.disabled=!security;priority.required=security;if(!security)priority.value='';
    };
    if (selected.status === "Resolved") {
      target.insertAdjacentHTML("beforeend", '<div class="supervisor-heading"><h2 id="resolutionHeading">Resolution Details</h2></div><section class="card resolution-detail" aria-labelledby="resolutionHeading">' +
        selected.history.filter(h => h.status === "Resolved").map(h => `<p class="muted">Resolved on ${esc(date(h.at))}<br>Resolved by ${esc(h.name)}</p><p class="resolution-comments"><strong>Supervisor comments:</strong><br>${esc(h.note || "")}</p>`).join("") + '</section>');
    }
    if(selected.status==='Resolved') {
      const classification=selected.classification;
      target.querySelector('.resolution-detail')?.insertAdjacentHTML('beforeend',`<p class="resolution-classification"><strong>Category:</strong> ${classification?esc(classification.category[0].toUpperCase()+classification.category.slice(1)):'Not classified'}${classification?.priority?` · <strong>Priority:</strong> ${esc(classification.priority)}`:''}</p>`);
    }
    for (const media of selected.media) renderProblemAttachment(target, media);
  } else {
    selectedProblemId = null;
    document.querySelector(".supervisor-heading")?.remove();
    const sorted = [...reports].filter(i => (i.report || "").toLocaleLowerCase().includes(problemQuery.toLocaleLowerCase())).sort((a,b) => b.captured_at.localeCompare(a.captured_at));
    const pageSize = 5, offset = Math.min(problemPage, Math.max(0, Math.ceil(sorted.length / pageSize) - 1)) * pageSize;
    const visible = sorted.slice(offset, offset + pageSize);
    const section = (title, items, empty) => `<section class="card problem-list"><h2>${title} <span class="problem-count">(${items.length})</span></h2><div>${items.map(i => `<button type="button" data-md="true" class="problem-row" data-action="viewProblem" data-id="${esc(i.id)}" title="${esc(i.report || "Voice report")}"><span class="problem-file" aria-hidden="true">${icon("incidents")}</span><span class="problem-overview"><strong>${esc(i.report || "Voice report")}</strong><small>Reported by ${esc(guardName(i.user_id))} · ${esc(reportDateTime(i.captured_at))}</small></span><svg class="problem-chevron" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" aria-hidden="true"><path d="m9 6 6 6-6 6"/></svg></button>`).join("") || '<p class="empty">' + empty + '</p>'}</div></section>`;
    target.innerHTML = `<label class="checkpoint-search">Find a problem<input type="search" id="problem-search" value="${esc(problemQuery)}" placeholder="Search reported text"></label>` + section("Outstanding Problems", visible.filter(i => i.status !== "Resolved"), "No outstanding problems.") +
      section("Resolved Problems", visible.filter(i => i.status === "Resolved"), "No resolved problems.") + (sorted.length > pageSize ? `<nav class="inbox-pagination"><button id="problem-prev" ${offset === 0 ? "disabled" : ""}>Previous</button><span>${offset + 1}–${Math.min(offset + pageSize, sorted.length)} of ${sorted.length}</span><button id="problem-next" ${offset + pageSize >= sorted.length ? "disabled" : ""}>Next</button></nav>` : "");
    target.querySelector('#problem-search').oninput = event => { problemQuery = event.target.value; problemPage = 0; renderSupervisorProblems(target, reports); };
    target.querySelector('#problem-prev')?.addEventListener('click', () => { problemPage--; renderSupervisorProblems(target, reports); });
    target.querySelector('#problem-next')?.addEventListener('click', () => { problemPage++; renderSupervisorProblems(target, reports); });
  }
  const footer = document.createElement("p");
  footer.className = "last-record-received";
  footer.textContent = "Last record received: " + date(site().last_sync);
  target.append(footer);
}
function renderProblemAttachment(target, media) {
  const audio = media.mime.startsWith("audio/");
  if (!audio && !media.mime.startsWith("image/")) return;
  const frame = document.createElement("div");
  frame.className = "saved-attachment";
  const element = document.createElement(audio ? "audio" : "img");
  if (audio) { element.controls = true; element.preload = "metadata"; element.setAttribute("aria-label", "Problem recording"); }
  else { element.className = "photo"; element.alt = "Attached problem photo"; }
  const status = document.createElement("p");
  status.className = "muted";
  frame.append(element, status);
  target.querySelector(audio ? "#problemAudio" : "#problemPhotos").append(frame);
  const retry = document.createElement("button");
  retry.type = "button"; retry.textContent = "Retry attachment";
  async function load() {
    retry.remove(); status.textContent = audio ? "Loading recording…" : "Loading photo…";
    try {
      const {url} = await api("/api/media/" + media.id + "/link");
      if (frame.isConnected) element.src = url;
    } catch { failed(); }
  }
  function failed() { status.textContent = "Attachment unavailable. Connect and try again."; frame.append(retry); }
  retry.onclick = load;
  element.addEventListener("error", failed);
  element.addEventListener(audio ? "loadedmetadata" : "load", () => { status.textContent = ""; retry.remove(); });
  load();
}
let reportSubmitting = false;
let signingOut = false;
let recordingPlaybackUrl = null;
let photoStream = null;
import { nextPatrol, shiftPatrols } from "./patrol-time.js";
import { scheduledEnd, elapsedShift } from "./shift-time.js";
import { watchMaterial, icon } from "./material.js";
import {
  unlock,
  save,
  lock,
  fileData,
  blobFrom,
  remember,
  restore,
  rememberView,
  EPOCH,
} from "./vault.js";
let selectedCheckpoint = null,
  scanBusy = false,
  nfcController = null;
let vault = { state: null, queue: [], draft: null },
  state,
  user,
  siteId,
  page = "home",
  busy = false,
  recorder,
  stream,
  scanStream,
  recordStart,
  day = new Date().toISOString().slice(0, 10),
  timer,
  roundId = null,
  slot = null;
let signupStep = 0,
  signupDraft = {},
  customerNoticeVersion = "2026-09-17",
  signupMessage = "";
const signupDraftKey = "guard-patrol.signup-draft.v1";
const root = document.querySelector("#app"),
  $ = (s) => document.querySelector(s),
  uuid = () => crypto.randomUUID(),
  esc = (s) =>
    String(s ?? "").replace(
      /[&<>"']/g,
      (c) =>
        ({
          "&": "&amp;",
          "<": "&lt;",
          ">": "&gt;",
          '"': "&quot;",
          "'": "&#39;",
        })[c],
    ),
  date = (s) =>
    s
      ? new Date(s).toLocaleString("en-NG", {
          dateStyle: "medium",
          timeStyle: "short",
        })
      : "Not yet received";
function saveSignupDraft() {
  // A shared device must never retain a password. Keep only non-sensitive setup fields.
  const { password, password_confirm, ...safeDraft } = signupDraft;
  sessionStorage.setItem(signupDraftKey, JSON.stringify({ step: signupStep, draft: safeDraft }));
}
function clearSignupDraft() {
  sessionStorage.removeItem(signupDraftKey);
}
function restoreSignupDraft() {
  try {
    const saved = JSON.parse(sessionStorage.getItem(signupDraftKey) || "null");
    if (!saved || ![1, 2].includes(saved.step) || !saved.draft) return false;
    signupDraft = saved.draft;
    // Passwords are intentionally not restored, so return to the account step after a reload.
    signupStep = saved.step === 2 ? 1 : saved.step;
    return true;
  } catch {
    clearSignupDraft();
    return false;
  }
}
function captureSignupDraft(form) {
  if (!form || !["signupAccount", "signupProperty"].includes(form.id)) return;
  const values = Object.fromEntries(new FormData(form));
  delete values.password;
  delete values.password_confirm;
  signupDraft = { ...signupDraft, ...values };
  if (form.id === "signupAccount") signupDraft.notice_accepted = values.notice_accepted === "on";
  if (form.id === "signupProperty") signupDraft.confirmed = values.confirmed === "on";
  saveSignupDraft();
}
function overviewCalendar(month, selectedDay) {
  const first = new Date(month + "-01T12:00:00Z");
  const count = new Date(Date.UTC(first.getUTCFullYear(), first.getUTCMonth() + 1, 0)).getUTCDate();
  const today = new Date(Date.now() + 3600000).toISOString().slice(0, 10);
  const label = first.toLocaleDateString("en-GB", { month: "long", year: "numeric", timeZone: "UTC" });
  return `<div class="calendar-month"><button data-md="true" data-action="calendarMonth" data-month="${month}" data-step="-1" aria-label="Previous month">‹</button><strong aria-live="polite">${label}</strong><button data-md="true" data-action="calendarMonth" data-month="${month}" data-step="1" aria-label="Next month">›</button></div><div class="calendar-days">${["M", "T", "W", "T", "F", "S", "S"].map(d => '<span class="calendar-weekday" aria-hidden="true">' + d + '</span>').join("")}${'<span aria-hidden="true"></span>'.repeat((first.getUTCDay() + 6) % 7)}${Array.from({length: count}, (_, i) => {
    const value = month + "-" + String(i + 1).padStart(2, "0");
    return `<button data-md="true" data-action="calendarDate" data-date="${value}" aria-label="${new Date(value + "T12:00:00Z").toLocaleDateString("en-GB", {day:"numeric",month:"long",year:"numeric",timeZone:"UTC"})}" aria-pressed="${value === selectedDay}" ${value > today ? "disabled" : ""} ${value === today ? 'aria-current="date"' : ''}>${i + 1}</button>`;
  }).join("")}</div><div class="calendar-footer"><label for="overviewDate">Jump to date<input id="overviewDate" type="date" max="${today}" value="${selectedDay}"></label><button data-md="true" data-action="overviewToday">Today</button></div>`;
}
function toast(t) {
  $("#toast").textContent = t;
  $("#toast").style.display = "block";
  clearTimeout(timer);
  timer = setTimeout(() => ($("#toast").style.display = "none"), 7000);
}
async function api(url, body, method) {
  if (body instanceof FormData) {
    for (const item of body.values())
      if (item instanceof Blob && item.size > 4 * 1024 * 1024)
        throw new Error(
          "This file is too large (4 MB maximum). Choose a smaller photo or record a shorter message.",
        );
  }
  let r = await fetch(url, {
    signal: AbortSignal.timeout(20000),
    method: method || (body ? "POST" : "GET"),
    headers: {
      ...(vault.auth ? { "X-Session-Proof": vault.auth } : {}),
      ...(body && !(body instanceof FormData)
        ? { "Content-Type": "application/json" }
        : {}),
    },
    body:
      body instanceof FormData ? body : body ? JSON.stringify(body) : undefined,
  });
  let j = await r.json();
  if (!r.ok) {
    const error = new Error(j.error || "Request failed");
    error.status = r.status;
    throw error;
  }
  return j;
}
const persist = () => save(vault),
  site = () => state.sites.find((s) => s.id === siteId) || state.sites[0],
  pending = () => vault.queue.filter((q) => q.status !== "synchronized"),
  pill = (s, cl = "") => `<span class="pill ${cl}">${esc(s)}</span>`,
  brand = () =>
    `<div class="brand"><img src="/icon.svg" alt=""><div><strong>Guard Patrol</strong></div></div>`;
watchMaterial(root);
function login() {
  const signup = signupStep === 1
    ? `<div class="card signup-card"><span class="eyebrow">Set up Guard Patrol</span><p class="signup-step">Step 1 of 2</p><h1>Create your account</h1><p class="muted">Create the owner account for your property. You can add a supervisor after setup.</p><form id="signupAccount"><label class="label" for="signupFirstName">First name</label><input id="signupFirstName" name="first_name" autocomplete="given-name" maxlength="60" required value="${esc(signupDraft.first_name || "")}"><label class="label" for="signupLastName">Last name</label><input id="signupLastName" name="last_name" autocomplete="family-name" maxlength="60" required value="${esc(signupDraft.last_name || "")}"><label class="label" for="signupEmail">Email address</label><input id="signupEmail" name="email" type="email" autocomplete="email" required value="${esc(signupDraft.email || "")}"><p class="field-help">Owner accounts use an email address to sign in. Guards and supervisors may use email or a WhatsApp number.</p><label class="label" for="signupPassword">Password</label><input id="signupPassword" name="password" type="password" autocomplete="new-password" minlength="12" required><p class="field-help">Use at least 12 characters.</p><label class="label" for="signupPasswordConfirm">Confirm password</label><input id="signupPasswordConfirm" name="password_confirm" type="password" autocomplete="new-password" minlength="12" required><input type="hidden" name="notice_version" value="${esc(signupDraft.notice_version || customerNoticeVersion)}"><p class="field-help">Read the <a href="/customer-notice.html" target="_blank" rel="noopener">customer notice</a> before continuing.</p><label class="signup-confirm"><input type="checkbox" name="notice_accepted" required ${signupDraft.notice_accepted ? "checked" : ""}><span>I have read and accept the customer notice.</span></label><button class="primary wide">Continue</button><button type="button" class="text-action wide" data-action="cancelSignup">Back to sign in</button></form></div>`
    : signupStep === 2
      ? `<div class="card signup-card"><span class="eyebrow">Set up Guard Patrol</span><p class="signup-step">Step 2 of 2</p><h1>Add your first property</h1><p class="muted">This is where your guards will check in and record patrols.</p><form id="signupProperty"><label class="label" for="signupPropertyName">Property name</label><input id="signupPropertyName" name="property_name" maxlength="120" required value="${esc(signupDraft.property_name || "")}" placeholder="For example, Oak House"><label class="label" for="signupAddress">Full property address</label><textarea id="signupAddress" name="address" maxlength="500" required placeholder="Street, area, city and state">${esc(signupDraft.address || "")}</textarea><div class="location-row"><label class="label" for="signupLatitude">Latitude<input id="signupLatitude" name="latitude" type="number" step="any" required value="${esc(signupDraft.latitude || "")}"></label><label class="label" for="signupLongitude">Longitude<input id="signupLongitude" name="longitude" type="number" step="any" required value="${esc(signupDraft.longitude || "")}"></label></div><button type="button" class="location-action wide" data-action="signupLocation">Use my current position</button><p id="signupLocationStatus" class="field-help">Use this while you are at the property, or enter its coordinates manually.</p><label class="label" for="signupRadius">Allowed check-in area (metres)</label><input id="signupRadius" name="radius_m" type="number" min="20" max="5000" required value="${esc(signupDraft.radius_m || "100")}"><label class="signup-confirm"><input type="checkbox" name="confirmed" required ${signupDraft.confirmed ? "checked" : ""}><span>I confirm this is the correct property location.</span></label><p class="field-help">Location is collected only when guards check in or scan checkpoints on duty. Guard Patrol does not continuously track guards.</p><button class="primary wide">Create account</button><button type="button" class="text-action wide" data-action="signupBack">Back</button></form></div>`
      : `<div class="card"><span class="eyebrow">Professional guard supervision</span><h1>Welcome back</h1><p class="muted">Sign in to access your security workspace.</p>${signupMessage ? `<p class="notice pending" role="status">${esc(signupMessage)}</p>` : ""}<form id="login"><label class="label" for="email">Email or WhatsApp number</label><input id="email" name="email" type="text" autocomplete="username" required><label class="label" for="password">Password</label><input id="password" name="password" type="password" autocomplete="current-password" required><button class="primary wide">Sign in</button></form><div class="signup-entry"><p class="muted">New to Guard Patrol?</p><button class="wide" type="button" data-action="startSignup">Create an account</button></div></div>`;
  root.innerHTML = `<main class="login">${brand()}${signup}<footer>Provided by Integrated Systems and Devices Limited<br>Guard Patrol does not provide emergency response.</footer></main>`;
}

async function beginSignup() {
  try {
    const onboarding = await api("/api/public/onboarding");
    if (!onboarding.signupAvailable)
      throw new Error("Account creation is temporarily unavailable until ISDL configures its support contact.");
    customerNoticeVersion = onboarding.noticeVersion;
    signupMessage = "";
    if (!restoreSignupDraft()) signupDraft = { notice_version: customerNoticeVersion };
    signupStep = 1;
    signupDraft.notice_version = customerNoticeVersion;
    saveSignupDraft();
    login();
    $("#signupFirstName")?.focus();
  } catch (error) {
    signupStep = 0;
    signupDraft = {};
    clearSignupDraft();
    signupMessage = error.message || "Account creation is temporarily unavailable.";
    login();
  }
}

async function completeSignIn(credentials, online) {
  vault = await unlock(credentials.email, credentials.password, online?.vaultAccount);
  roundId = vault.roundId || null;
  slot = vault.slot || null;
  if (online) {
    vault.auth = online.proof;
    await refresh();
  } else {
    if (!vault.state) throw new Error("First sign-in needs connectivity");
    state = vault.state;
    user = state.user;
    siteId = state.sites[0]?.id;
  }
  $("#toast").style.display = "none";
  try {
    await remember(online?.expiresAt);
  } catch {
    toast("This browser could not keep your sign-in for refresh.");
  }
  page = "home";
  render();
  navigator.storage?.persist?.();
  if (user.role === "guard" && siteId) {
    const signedUser = user.id,
      signedSite = siteId,
      signedAt = new Date().toISOString();
    locate()
      .then(async (location) => {
        if (user?.id !== signedUser || siteId !== signedSite) return;
        await enqueue("sign_in_location", { location, sign_in_at: signedAt });
        await sync();
      })
      .catch(() => {});
  }
  await sync();
}
async function refresh() {
  state = await api("/api/state");
  user = state.user;
  await flushReadReceipts();
  if (user.role === "guard") {
    const ids = new Set(
      [
        ...state.sites.map((s) => s.instruction_audio),
        ...state.events
          .filter(
            (e) =>
              e.kind === "start" &&
              state.shifts.some((s) => s.id === e.id && !s.ended_at),
          )
          .map((e) => e.payload.instruction_audio),
      ].filter(Boolean),
    );
    vault.instructionAudio = Object.fromEntries(
      Object.entries(vault.instructionAudio || {}).filter(([id]) =>
        ids.has(id),
      ),
    );
    for (const id of ids) {
      try {
        await cacheInstruction(id, vault, api);
      } catch {}
    }
  }
  vault.state = state;
  siteId = state.sites.some((s) => s.id === siteId)
    ? siteId
    : state.sites[0]?.id;
  await persist();
}
function shift() {
  let s = state.shifts.find((s) => s.user_id === user.id && !s.ended_at);
  for (let q of vault.queue) {
    if (
      q.kind === "start" &&
      (q.status !== "synchronized" ||
        !state.shifts.some((record) => record.id === q.id))
    )
      s = {
        id: q.id,
        site_id: q.site_id,
        user_id: user.id,
        started_at: q.captured_at,
      };
    if (q.kind === "end" && s?.id === q.payload.shift_id) s = null;
  }
  return s;
}
const scopedIncidents = () =>
    state.incidents.filter((i) => i.site_id === siteId),
  cps = () => {
    const shift=state.shifts.find(s=>s.site_id===siteId && s.user_id===user.id && !s.ended_at);
    const ids=shift && eventList().find(e=>e.id===shift.id)?.payload.checkpoint_ids;
    return state.checkpoints.filter(c=>c.site_id===siteId && (user.role==='guard' && ids ? ids.includes(c.id) : !c.retired_at));
  };
function eventList() {
  let e = state.events.filter((e) => e.site_id === siteId);
  return [
    ...e,
    ...vault.queue.filter(
      (q) => q.site_id === siteId && !e.some((e) => e.id === q.id),
    ),
  ].filter(
    (e) =>
      e.kind !== "message" ||
      (state.features?.messaging && e.payload.shift_id &&
        (user.role !== "guard" || e.payload.shift_id === shift()?.id)),
  );
}
function render() {
  closeCheckpoints();
  if (!state?.features?.messaging && page === "message") page = "home";
  if (user) {
    try {
      rememberView({ page, siteId, selectedChat, selectedReportId });
    } catch {}
  }
  closeInstructions();
  reportMediaUrls.forEach((url) => URL.revokeObjectURL(url));
  reportMediaUrls = [];
  if (document.querySelector("#confirmationDialog[open]")) return;
  if (!["report", "message"].includes(page) && recordingPlaybackUrl) {
    URL.revokeObjectURL(recordingPlaybackUrl);
    recordingPlaybackUrl = null;
  }
  if (!user) return login();
  if (!site() && user.role !== 'owner') {
    root.innerHTML = `<main class="login">${brand()}<p>No assigned properties. Ask your supervisor to assign a site.</p><button data-action="logout">Sign out</button></main>`;
    return;
  }
  if (user.role === "guard") renderGuard();
  else renderDashboard();
  if(supervisorView() && page==='home' && locationGroups(eventList(),state.locationReviews||[],siteId).length) {
    const link=document.createElement('button');link.className='checkpoint-text-action';link.dataset.action='locationHistory';link.textContent='Location review history';root.querySelector('.attention-footer')?.append(link);
  }
  if (user.role !== "guard" && page !== "home" && root.querySelector('.supervisor-heading')) {
    const titles = {gps:"Location review",summaries:"Reports",incidents:selectedProblemId ? "Problem Details" : "Problems",setup:"Settings",instructionSetup:"Shift instructions",patrols:"Patrol schedule",admin:"Manage team",message:"Messages"};
    root.querySelector(".greeting-row h1").textContent = titles[page] || "Your team";
    root.querySelector(".supervisor-mobile > .supervisor-heading")?.remove();
  }
  if(user.role==='owner'&&ownerSupervisionEnabled()) {
    const mode=document.createElement('div');mode.className='owner-mode';
    mode.innerHTML=`<span>${ownerSupervisorView()?'Supervisor view':'Owner view'}</span><button type="button" class="owner-mode-switch" data-action="ownerMode">${ownerSupervisorView()?'Return to owner view':'Act as supervisor'}</button>`;
    root.querySelector('.duty-identity')?.after(mode);
    root.querySelector('main')?.classList.add('owner-account');
    const identity=root.querySelector('.duty-identity > .eyebrow');
    if(identity) {
      if(ownerSupervisorView())identity.textContent=site()?.name||'Your property';
      else identity.remove();
    }
    if(!ownerSupervisorView()) {
      const form=root.querySelector('.problemResolve');
      if(form)form.outerHTML='<p class="owner-resolution-hint">Use the supervisor view if you need to address this problem yourself.</p>';
    }
  }
  // Reserve the same greeting row even when Home has no back control.
  const offDutyIdentity = root.querySelector(".off-duty-identity");
  if (offDutyIdentity && !offDutyIdentity.querySelector(".greeting-row")) {
    const row = document.createElement("div");
    row.className = "greeting-row";
    row.append(offDutyIdentity.querySelector("h1"));
    offDutyIdentity.append(row);
  }
  const ownerIdentity = root.querySelector(".workspace .content > .row:first-child");
  if (ownerIdentity) {
    ownerIdentity.classList.add("owner-page-identity");
    const title = ownerIdentity.querySelector("h1");
    const pageTitle = document.createElement("h2");
    pageTitle.className = "owner-page-title";
    pageTitle.textContent = title.textContent;
    title.textContent = "Hello, " + user.name + ".";
    ownerIdentity.querySelector(".eyebrow").textContent = site().name;
    ownerIdentity.querySelector(".muted")?.remove();
    ownerIdentity.after(pageTitle);
  }
  root.classList.toggle("messaging-disabled", !state.features?.messaging);
  if (!state.features?.messaging) {
    root.querySelectorAll('[data-page="message"],[data-action="openChat"],.message-unread').forEach(el => el.remove());
    root.querySelectorAll("section").forEach(el => {
      if (el.querySelector("h2")?.textContent === "Supervisor inbox") el.remove();
    });
  }
  loadMessageMedia();
  updatePatrolReminder();
}
function syncBar() {
  return `<div class="row"><small>${navigator.onLine ? "● Connection available" : "● Offline · saved on this phone"}</small><button data-action="sync">↻ ${pending().length} waiting to upload</button></div>`;
}
function shiftInstructions() {
  const current = shift();
  return (
    eventList().find((e) => e.kind === "start" && e.id === current?.id)?.payload
      .instructions ?? site().instructions
  );
}
let selectedChat = null;
let supervisorMessageId = null, inboxPage = 0, inboxOrder = "newest", inboxSite = null;
function messagePicker(label, action, options, selected, placeholder) {
  const current = options.find(o => o.value === selected);
  return `<details class="overview-shift-picker message-picker"><summary aria-label="${esc(label)}"><span>${esc(current?.label || placeholder)}</span><svg class="shift-picker-arrow" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="m6 9 6 6 6-6"/></svg></summary><div class="shift-picker-options">${options.map(o => `<button type="button" data-md="true" data-action="${action}" data-value="${esc(o.value)}" aria-pressed="${o.value === selected}">${esc(o.label)}</button>`).join("")}</div></details>`;
}
function messageRecipients() {
  return chatThreads().filter(t => !t.ended);
}
function supervisorInbox() {
  return eventList().filter(e => e.kind === "message" && e.site_id === siteId &&
    state.users.some(u => u.id === e.user_id && u.role === "guard"))
    .sort((a,b) => (inboxOrder === "newest" ? -1 : 1) * (a.captured_at.localeCompare(b.captured_at) || a.id.localeCompare(b.id)));
}
function updateSupervisorInbox() {
  const host = $("#receivedMessages");
  if (!host) return;
  if (inboxSite !== siteId) { inboxPage = 0; inboxSite = siteId; }
  const messages = supervisorInbox();
  inboxPage = Math.min(inboxPage, Math.max(0, Math.ceil(messages.length / 5) - 1));
  const offset = inboxPage * 5;
  host.innerHTML = messages.slice(offset, offset + 5).map(e => {
    const unread = state.notifications.some(n => n.event_id === e.id && n.status === "submitted" && !vault.readMessages?.[n.id]);
    return `<button type="button" class="inbox-row" data-action="readSupervisorMessage" data-id="${esc(e.id)}"><span class="inbox-copy"><strong>${esc(e.sender_name || guardName(e.user_id))}${unread ? ' · New' : ''}</strong><span>${esc(e.payload.text || (e.payload.has_audio ? "Voice message" : "Photo message"))}</span><small>${esc(reportDateTime(e.captured_at))}</small></span><span aria-hidden="true">›</span></button>`;
  }).join("") || '<p class="empty">No received messages.</p>';
  $("#inboxPagination").innerHTML = messages.length > 5 ? `<button data-md="true" data-action="inboxPrevious" ${inboxPage === 0 ? "disabled" : ""}>Previous</button><span>${offset + 1}–${Math.min(offset + 5, messages.length)} of ${messages.length}</span><button data-md="true" data-action="inboxNext" ${offset + 5 >= messages.length ? "disabled" : ""}>Next</button>` : "";
}
function renderSupervisorMessages(target) {
  document.querySelector(".supervisor-heading")?.remove();
  document.querySelector(".supervisor-filters")?.remove();
  document.querySelector(".supervisor-mobile > .notice")?.remove();
  if (supervisorMessageId) {
    const e = eventList().find(e => e.id === supervisorMessageId && e.site_id === siteId && e.kind === "message");
    if (e) {
      target.innerHTML = `<section class="card received-detail"><h2>From ${esc(e.sender_name || guardName(e.user_id))}</h2><p class="muted">${esc(reportDateTime(e.captured_at))}</p>${e.payload.text ? '<p class="chat-text">' + esc(e.payload.text) + '</p>' : ''}<div data-message-media="${esc(e.id)}"></div></section>`;
      const back = document.querySelector(".greeting-row .back");
      if (back) { back.removeAttribute("data-page"); back.dataset.action = "supervisorInbox"; back.textContent = "Messages"; }
      loadMessageMedia();
      markConversationRead([e]);
      return;
    }
    supervisorMessageId = null;
  }
  target.innerHTML = '<div id="chatComposer"></div><section class="card received-inbox"><div class="inbox-heading"><h2>Received Messages</h2>' +
    messagePicker("Sort received messages", "inboxSort", [{value:"newest",label:"Newest first"},{value:"oldest",label:"Oldest first"}], inboxOrder, "Newest first") +
    '</div><div id="receivedMessages"></div><nav id="inboxPagination" class="inbox-pagination" aria-label="Received message pages"></nav></section>';
  renderReport($("#chatComposer"), true);
  $("#chatComposer h2").textContent = "Send Message";
  const recipients = messageRecipients(), chosen = vault[draftKey()]?.recipient || "";
  $("#chatComposer h2").insertAdjacentHTML("afterend", '<div class="message-recipient"><span>Recipient</span>' + (recipients.length ? messagePicker("Select recipient", "messageRecipient", recipients.map(t => ({value:t.key,label:guardName(t.guard_id)})), chosen, "Select guard") : '<small>No guards are on duty.</small>') + '</div>');
  updateReportSubmit();
  updateSupervisorInbox();
}
function chatThreads() {
  const shifts = state.shifts.filter(
    (s) =>
      s.site_id === siteId && (user.role !== "guard" || s.id === shift()?.id),
  );
  const current = user.role === "guard" ? shift() : null;
  if (
    current &&
    current.site_id === siteId &&
    !shifts.some((s) => s.id === current.id)
  )
    shifts.push(current);
  return [
    ...shifts
      .sort((a, b) => b.started_at.localeCompare(a.started_at))
      .map((s) => ({
        key: s.id,
        shift_id: s.id,
        guard_id: s.user_id,
        started: s.started_at,
        ended: s.ended_at,
        label: guardName(s.user_id) + " · " + reportDateTime(s.started_at),
      })),
  ];
}
function chatContext() {
  const threads = chatThreads();
  if (selectedChat && threads.some((t) => t.key === selectedChat))
    return threads.find((t) => t.key === selectedChat);
  return user.role === "guard"
    ? threads.find((t) => t.key === shift()?.id)
    : threads[0];
}
const draftKey = () =>
  page === "message"
    ? user.role === "supervisor" ? "supervisorDraft:" + siteId : "chatDraft:" + siteId + ":" + (chatContext()?.key || "none")
    : "draft";
function renderMessage() {
  root.innerHTML = `<main class="guard message-page"><header class="topbar">${brand()}<button data-action="logout">Sign out</button></header><div class="duty-identity"><p class="eyebrow">${esc(site().name)}</p><div class="greeting-row"><h1>Hello, ${esc(user.name)}.</h1><button class="back" data-page="home">Home</button></div></div><div id="chatPage"></div></main>`;
  renderChat($("#chatPage"));
}
function renderChat(target) {
  if (user.role === "supervisor") return renderSupervisorMessages(target);
  const context = chatContext();
  if (!context) {
    target.innerHTML =
      '<section class="card"><h2>Messages</h2><p>No shift conversations yet.</p></section>';
    return;
  }
  target.innerHTML = `${
    user.role === "supervisor"
      ? '<section class="card"><label class="label" for="chatSelect">Guard and shift</label><select id="chatSelect">' +
        chatThreads()
          .map(
            (t) =>
              '<option value="' +
              esc(t.key) +
              '" ' +
              (t.key === context.key ? "selected" : "") +
              ">" +
              esc(t.label) +
              "</option>",
          )
          .join("") +
        "</select></section>"
      : ""
  }<div id="chatComposer"></div><section class="conversation" hidden><h2>Previous messages</h2><div id="chatMessages"></div></section>`;
  renderReport($("#chatComposer"), true);
  updateChatMessages();
}
function conversationMessages() {
  const context = chatContext();
  return eventList()
    .filter(
      (e) =>
        e.kind === "message" &&
        (e.payload.guard_id || e.user_id) === context?.guard_id &&
        (e.payload.shift_id || null) === context?.shift_id,
    )
    .sort(
      (a, b) =>
        b.captured_at.localeCompare(a.captured_at) || b.id.localeCompare(a.id),
    );
}
function updateChatMessages() {
  if (user.role === "supervisor") { updateSupervisorInbox(); return; }
  const host = $("#chatMessages");
  if (!host) return;
  const messages = conversationMessages();
  host.closest(".conversation").hidden = messages.length === 0;
  if (
    [...host.querySelectorAll("audio")].some((a) => !a.paused) &&
    messages.length
  )
    return;
  const fingerprint = JSON.stringify(
    messages.map((e) => [
      e.id,
      e.sender_name,
      e.media,
      vault.queue.find((q) => q.id === e.id)?.status,
      state.sentNotifications?.filter((n) => n.event_id === e.id),
    ]),
  );
  if (host.dataset.version === fingerprint) {
    markConversationRead(messages);
    return;
  }
  host.dataset.version = fingerprint;
  host.innerHTML = messages
    .map((e) => {
      const mine = e.user_id === user.id || !e.user_id;
      const receipts = (state.sentNotifications || []).filter(
          (n) => n.event_id === e.id,
        ),
        queued = vault.queue.find((q) => q.id === e.id);
      const status = !mine
        ? "Received"
        : receipts.some((n) => n.status === "acknowledged")
          ? user.role === "guard"
            ? "Acknowledged by supervisor"
            : "Acknowledged by guard"
          : receipts.some((n) => n.status === "delivered")
            ? "Seen in recipient app"
            : receipts.length
              ? user.role === "guard"
                ? "Sent to supervisor inbox"
                : "Sent to guard inbox"
              : queued?.submitted
                ? "Saved on server"
                : "Saved on this phone — not sent yet";
      return `<article class="chat-bubble ${mine ? "outgoing" : "incoming"}"><strong>${mine ? "You" : esc(e.sender_name || (user.role === "guard" ? "Supervisor" : guardName(e.user_id)))}</strong>${e.payload.text ? '<p class="chat-text">' + esc(e.payload.text) + "</p>" : ""}<div data-message-media="${e.id}"></div><small>${esc(reportDateTime(e.captured_at))} · <span>${status}</span></small></article>`;
    })
    .join("");
  loadMessageMedia();
  markConversationRead(messages);
}
function renderGuard() {
  let s = shift();
  if (page === "message" && s) return renderMessage();
  if (!s && page !== "shift") {
    page = "home";
    root.innerHTML = `<main class="guard off-duty"><header class="topbar">${brand()}<button data-action="logout" aria-label="Sign out">Sign out</button></header><div class="off-duty-identity"><p class="eyebrow">${esc(site().name)}</p><h1>Hello, ${esc(user.name)}.</h1></div>${state.sites.length > 1 ? siteSelect() : ""}<section class="card shift"><div class="row"><h2>Start your shift</h2>${pill("Off duty")}</div><button class="primary" data-action="shift">Click here</button></section></main>`;
    return;
  }
  root.innerHTML = `<main class="guard on-duty"><header class="topbar">${brand()}<button data-action="logout" aria-label="Sign out">Sign out</button></header><div class="duty-identity"><p class="eyebrow">${esc(site().name)}</p><div class="greeting-row"><h1>Hello, ${esc(user.name)}.</h1>${page === "savedReport" ? '<button class="back" data-page="report">Reports</button>' : page !== "home" ? '<button class="back" data-page="home">Home</button>' : ""}</div></div>${state.sites.length > 1 ? siteSelect() : ""}<div id="guardPage"></div></main>`;
  let target = $("#guardPage");
  if (page === "home") {
    const entry = eventList().find((e) => e.id === s.id && e.kind === "start");
    const end =
      entry?.payload?.scheduled_end_at ??
      scheduledEnd(s.started_at, state.shiftPlans || [], user.id, siteId);
    const unread = unreadMessageCount();
    const localDate = (value) =>
      new Date(value).toLocaleString("en-NG", {
        timeZone: "Africa/Lagos",
        dateStyle: "medium",
        timeStyle: "short",
      });
    const queued = pending();
    const failed = queued.filter(q => q.status === "failed").length;
    const conflicts = queued.filter(q => q.status === "conflict").length;
    const syncState = !queued.length ? "All saved records synchronized." : conflicts ? `${conflicts} saved record${conflicts === 1 ? "" : "s"} need supervisor review.` : failed ? `${failed} saved record${failed === 1 ? "" : "s"} need${failed === 1 ? "s" : ""} retry.` : `${queued.length} saved record${queued.length === 1 ? "" : "s"} waiting to upload.`;
    target.innerHTML = `<section class="card shift duty-card"><div class="row"><h2>You are on duty</h2>${pill("On duty")}</div><div class="shift-facts"><div><span>Shift started</span><strong>${esc(localDate(s.started_at))}</strong></div><div class="elapsed"><span>Time on duty</span><strong id="shiftTimer" role="timer" aria-label="Time on duty" data-started="${s.started_at}">${elapsedShift(s.started_at)}</strong></div><div><span>Shift ends</span><strong>${end ? esc(localDate(end)) : "Not scheduled — ask your supervisor"}</strong></div></div><button class="primary" data-action="shift">End shift</button></section><div class="actions"><button data-page="round" data-md="true" id="patrolButton" aria-label="Start patrol">${icon("round")}<span class="button-label">Start patrol</span><small id="patrolCountdown"></small></button><button data-page="report">Report a problem</button><button data-page="instructions">Hear instructions</button><button id="messageSupervisorButton" data-page="message" data-md="true" aria-label="Message supervisor" ${unread ? 'aria-describedby="unreadMessages"' : ""}>${icon("message")}<span class="button-label">Message supervisor</span>${unread ? `<span class="message-unread" id="unreadMessages" role="status" aria-label="${unread} unread messages">${unread} new</span>` : ""}</button></div><p class="muted" role="status">${syncState}</p>${queued.length ? '<button data-action="retryPending" class="checkpoint-text-action">Retry saved records</button>' : ""}`;
  } else if (page === "shift")
    target.innerHTML = `<section class="card"><h2>End your shift</h2><form id="shiftForm"><p>Ready to finish your shift?</p><label class="label">Handover notes (optional)</label><textarea name="note" placeholder="Anything the next guard should know?"></textarea><button class="primary wide">Confirm end shift</button></form></section>`;
  else if (page === "round") {
    const entry = eventList().find((e) => e.id === s.id && e.kind === "start");
    const scheduled = shiftPatrols(
      entry?.payload.patrol_schedule ?? site().schedule,
      s,
      entry?.payload.scheduled_end_at,
    );
    const patrol = eventList().find(
      (e) =>
        e.kind === "patrol_start" &&
        e.payload.round_id === roundId &&
        e.payload.shift_id === s.id,
    );
    const active = eventList().filter(
      (e) =>
        e.kind === "scan" &&
        e.payload.round_id === roundId &&
        e.payload.shift_id === s.id,
    );
    const checked = new Set(active.map((e) => e.payload.code));
    const number =
      scheduled.findIndex((x) => x.iso === patrol?.payload.scheduled_for) + 1;
    target.innerHTML = `<section class="card patrol-card"><h2>${patrol ? "Patrol number " + (number || "?") + " of " + scheduled.length : "Patrols complete"}</h2>${
      patrol
        ? `<p class="muted">Scheduled patrol · ${esc(patrol.payload.slot)} · Nigerian time</p><p><strong>${checked.size} of ${cps().length} stops checked</strong></p><progress max="${cps().length || 1}" value="${checked.size}"></progress><div class="checkpoint-list">${cps()
            .map(
              (c) =>
                `<button class="checkpoint-choice" data-md="true" data-action="selectCheckpoint" data-id="${c.id}" aria-pressed="${selectedCheckpoint === c.id}" ${checked.has(c.code) ? "disabled" : ""}><span>${esc(c.name)}</span>${pill(checked.has(c.code) ? "Checked" : "Unchecked", checked.has(c.code) ? "" : "gray")}</button>`,
            )
            .join(
              "",
            )}</div>${checked.size < cps().length ? `<p id="scanStatus" role="status">${selectedCheckpoint ? esc(cps().find((c) => c.id === selectedCheckpoint)?.name || "") + " selected" : "Select a checkpoint"}</p><div class="scan-actions"><button data-action="camera" ${!selectedCheckpoint ? "disabled" : ""}>Scan QR code</button><button data-action="nfc" ${!selectedCheckpoint ? "disabled" : ""}>Scan NFC tag</button></div><video id="camera" hidden autoplay playsinline></video><a href="#manual-code" class="manual-code-link" data-action="manualCode" aria-disabled="${!selectedCheckpoint}" ${!selectedCheckpoint ? 'tabindex="-1"' : ""}>Unable to scan?</a>` : '<p class="patrol-complete">All checkpoints checked.</p>'}`
        : "<p>All scheduled patrols for this shift have been started. Return Home to continue.</p>"
    }</section>`;
  } else if (page === "savedReport") renderSavedReport(target);
  else if (page === "report") renderReport(target);
  else if (page === "instructions") {
    const current = eventList().find(
      (e) => e.kind === "start" && e.id === shift()?.id,
    );
    const recording =
      current && Object.hasOwn(current.payload, "instruction_audio")
        ? current.payload.instruction_audio
        : site().instruction_audio;
    target.innerHTML = `<section class="card"><h2>Shift instructions</h2><div id="instructionPlayback"></div><p class="instruction-copy">${esc(shiftInstructions())}</p><button class="wide" data-page="message">Message supervisor</button></section>`;
    if (recording)
      instructionPlayer(
        $("#instructionPlayback"),
        recording,
        vault,
        api,
        persist,
      );
  }
}
function renderReport(t, isMessage = false) {
  let d = vault[draftKey()] || {};
  if (recordingPlaybackUrl) URL.revokeObjectURL(recordingPlaybackUrl);
  recordingPlaybackUrl = d.audio
    ? URL.createObjectURL(
        new Blob(
          [
            Uint8Array.from(atob(d.audio.data.split(",")[1]), (c) =>
              c.charCodeAt(0),
            ),
          ],
          { type: d.audio.mime },
        ),
      )
    : null;
  t.innerHTML = `<section class="card report-card"><h2>${isMessage ? (user.role === "supervisor" ? "Reply to " + esc(guardName(chatContext()?.guard_id)) : "Message supervisor") : "Report a problem"}</h2><p>${isMessage ? "Your message" : "Tell us what happened and what you did."}</p><button type="button" class="primary wide" id="record">Press to start</button><small id="recordStatus" role="status">${d.audio ? "Recording saved · " + recordingTime(d.audio.durationSeconds || 0) : "Tap once to start recording."}</small>${d.audio ? `<audio controls aria-label="Your recording" src="${recordingPlaybackUrl}"></audio>${!isMessage && state.ai !== "unavailable" ? '<button data-action="transcribe" class="wide">Create written draft</button>' : ""}` : ""}<form id="reportForm"><details id="typedReport" ${d.report ? "open" : ""}><summary>${isMessage ? "Type a message (optional)" : "Type what happened (optional)"}</summary><label class="label" for="report">${isMessage ? "Your message" : "What happened?"}</label><textarea id="report" name="report" maxlength="5000" placeholder="${isMessage ? "Type your message" : "What did you see and do?"}">${esc(d.report || "")}</textarea></details><div class="report-photo-actions"><button type="button" data-action="takePhoto" aria-label="Take a photo"><span>Take a photo<small>(optional)</small></span></button><button type="button" data-action="choosePhoto" aria-label="Choose a photo"><span>Choose a photo<small>(optional)</small></span></button></div><input id="libraryPhoto" type="file" accept="image/jpeg,image/png" data-source="photo library" aria-label="Choose a photo" hidden>${(d.photos || []).map((f) => `<img class="photo" src="${f.data}" alt="Report attachment">`).join("")}<button id="submitReport" class="primary wide" ${!d.report?.trim() && !d.audio ? "disabled" : ""}>${isMessage ? "Send message" : "Submit"}</button></form>${d.transcript ? `<details><summary>Original transcript</summary><p>${esc(d.transcript)}</p></details>` : ""}</section>`;
  if (!isMessage) {
    t.insertAdjacentHTML(
      "beforeend",
      `<details class="card shift-report-history" id="shiftReportHistory"><summary>Previous Reports (${shiftReports().length})</summary><div id="shiftReportList">${shiftReportList()}</div></details>`,
    );
    $("#shiftReportHistory").addEventListener("toggle", () => {
      if ($("#shiftReportHistory")?.open)
        $("#shiftReportList").innerHTML = shiftReportList();
    });
  }
  updateReportSubmit();
  $("#record").onclick = () => {
    if (recorder?.state === "recording") stopRecording();
    else startRecording();
  };
}
function siteSelect() {
  return `<select id="siteSelect" aria-label="Property">${state.sites.map((s) => `<option value="${s.id}" ${s.id === siteId ? "selected" : ""}>${esc(s.name)}</option>`).join("")}</select>`;
}
function renderDashboard() {
  if(user.role==='owner'&&!ownerSupervisorView()) {
    if(page==='admin')page='property';
    if(['home','property','supervisors','subscription','ownerActivity','ownerProblems'].includes(page)||!site()){if(!site()&&!['home','property','subscription'].includes(page))page='home';renderOwnerPage();return;}
  }
  if (supervisorView() && page === "home")
    day =
      overviewDate || new Date(Date.now() + 3600000).toISOString().slice(0, 10);
  let inc = scopedIncidents(),
    ev = eventList().filter((e) => e.captured_at.slice(0, 10) === day),
    active = state.shifts.filter((s) => s.site_id === siteId && !s.ended_at),
    rounds = new Map();
  for (let e of ev.filter((e) => e.kind === "scan")) {
    let p = e.payload;
    if (!rounds.has(p.round_id)) rounds.set(p.round_id, new Set());
    rounds.get(p.round_id).add(p.checkpoint_id);
  }
  let complete = [...rounds.values()].filter(
    (r) => cps().length && cps().every((c) => r.has(c.id)),
  ).length;
  const mobileSupervisor = user.role === "supervisor" || user.role === 'owner';
  if (mobileSupervisor) {
    root.innerHTML = `<main class="guard supervisor-mobile ${page === "home" ? "supervisor-home" : ""}"><header class="topbar">${brand()}<button data-action="logout">Sign out</button></header><div class="duty-identity"><p class="eyebrow">${esc(site().name)} · Supervisor</p><div class="greeting-row"><h1>Hello, ${esc(user.name)}.</h1>${page !== "home" ? '<button class="back" data-page="home">Home</button>' : ""}</div></div>${state.sites.length > 1 ? siteSelect() : ""}${page === "home" ? `<nav class="actions supervisor-actions" aria-label="Supervisor pages"><button data-page="message" data-md="true" aria-label="Messages"><span class="action-icon">${icon("message")}</span><span class="button-label">Messages</span>${unreadMessageCount() ? `<span class="message-unread" role="status" aria-label="${unreadMessageCount()} unread messages">${unreadMessageCount()} new</span>` : ""}</button><button data-page="incidents" data-md="true" aria-label="Problems"><span class="action-icon">${icon("incidents")}</span><span class="button-label">Problems</span></button><button data-page="summaries" data-md="true" aria-label="Reports"><span class="action-icon">${icon("summaries")}</span><span class="button-label">Reports</span></button><button data-page="setup" data-md="true" aria-label="Settings"><span class="action-icon">${icon("admin")}</span><span class="button-label">Settings</span></button></nav>` : ""}<div class="supervisor-heading"><h2>${{ home: "Today’s overview", setup: "Settings", incidents: "Reported problems", summaries: "Daily reports", admin: "Manage your team", instructionSetup: "Shift instructions", message: "Messages", patrols: "Patrol schedule" }[page] || "Your team"}</h2>${page === "home" ? "" : '<button data-action="refresh">Refresh</button>'}</div><details class="supervisor-filters"><summary>Date & synchronization</summary><label class="label" for="day">Reporting date · UTC</label><input id="day" type="date" value="${day}"><p>Last record received: ${date(site().last_sync)}</p></details><p class="notice">New records may be pending. Current activity is unconfirmed between uploads.</p><div id="dashboardPage"></div></main>`;
  } else {
    root.innerHTML = `<aside class="sidebar">${brand()}<nav>${user.role === "supervisor" ? '<button data-page="message">Messages</button>' : ""}<button data-page="instructionSetup">Shift instructions</button><button data-page="home" class="${page === "home" ? "active" : ""}">▦ Overview</button><button data-page="incidents" class="${page === "incidents" ? "active" : ""}">◉ Incidents</button><button data-page="summaries" class="${page === "summaries" ? "active" : ""}">▤ Daily reports</button>${user.role !== "guard" ? `<button data-page="admin" class="${page === "admin" ? "active" : ""}">⚙ Site management</button>` : ""}</nav><footer><strong>Care in every round.</strong><p>Provided by Integrated Systems and Devices Limited — ISDL</p>Fictional pilot workspace</footer></aside><div class="workspace"><header class="topbar"><div style="max-width:300px">${siteSelect()}</div><div class="identity"><span class="avatar">${esc(user.name[0])}</span><div><strong>${esc(user.name)}</strong><br><small>${user.role === "owner" ? "Property owner" : "Customer supervisor"}</small></div><button data-action="logout">Sign out</button></div></header><main class="content"><div class="row"><div><p class="eyebrow">Your property, in view</p><h1>${page === "home" ? "A clearer picture of every shift." : page === "incidents" ? "Issues & follow-up" : page === "admin" ? "Site management" : page === "instructionSetup" ? "Shift instructions" : page === "message" ? "Messages" : "Daily reports"}</h1><p class="muted">${esc(site().name)} · Fictional pilot data</p></div><div><input id="day" aria-label="Report date (UTC)" type="date" value="${day}"><small>Reporting date · UTC</small></div></div><div class="row" style="margin:18px 0"><small>Last record received: ${date(site().last_sync)}</small><button data-action="refresh">↻ Refresh</button></div><div class="notice">Current activity unconfirmed between uploads. New records may be pending on the guard’s phone.</div><div id="dashboardPage"></div></main></div>`;
  }
  let t = $("#dashboardPage");
  if (page === "home" || page === "patrols")
    t.innerHTML = `<div class="stats"><section class="card stat"><span>WHO CHECKED IN</span><strong>${active.length}</strong><span>Active shifts recorded</span></section><section class="card stat"><span>PATROLS RECORDED</span><strong>${complete} <small>/ ${site().schedule.split(",").filter(Boolean).length}</small></strong><span>Complete / scheduled today</span></section><section class="card stat"><span>NEEDS ATTENTION</span><strong>${inc.filter((i) => i.status !== "Resolved").length}</strong><span>Open issues</span></section><section class="card stat"><span>FOLLOWING UP</span><strong>${inc.filter((i) => i.status === "Assigned").length}</strong><span>Issues with assigned action</span></section></div><div class="grid"><section class="card"><div class="row"><h2>Who is on duty?</h2>${pill("Attendance")}</div>${active.map((s) => `<div class="item identity"><span class="avatar">${esc(guardName(s.user_id)[0])}</span><div><strong>${esc(guardName(s.user_id))}</strong><p class="muted">Checked in ${date(s.started_at)}</p></div></div>`).join("") || '<p class="empty">No active shifts recorded.</p>'}<h3 style="margin-top:20px">Recent attendance</h3>${
      ev
        .filter((e) => ["start", "end"].includes(e.kind))
        .slice(-6)
        .reverse()
        .map(
          (e) =>
            `<div class="item">${esc(guardName(e.user_id))} · ${e.kind === "start" ? "Started" : "Ended"}<br><small>${date(e.captured_at)}</small></div>`,
        )
        .join("") || '<p class="muted">No attendance records for this date.</p>'
    }</section><section class="card"><div class="row"><h2>What needs attention?</h2><button data-page="incidents">View all →</button></div>${
      inc
        .filter((i) => i.status !== "Resolved")
        .slice(0, 3)
        .map((i) => incidentCard(i))
        .join("") || '<p class="empty">No open issues recorded.</p>'
    }</section><section class="card"><h2>Scheduled patrols</h2>${patrolScheduleForm()}${locationReview()}${ev
      .filter((e) => e.kind === "end" && e.payload.patrol_exceptions?.length)
      .map(
        (e) =>
          `<p class="notice">${esc(guardName(e.user_id))} · ${esc(e.payload.patrol_exceptions.join("; "))}. New records may still be pending.</p>`,
      )
      .join("")}${ev
      .filter((e) => e.kind === "patrol_start" && e.payload.timing_exception)
      .map(
        (e) =>
          `<p class="notice">Patrol ${esc(e.payload.slot)} · ${esc(guardName(e.user_id))}: ${esc(e.payload.timing_exception)}</p>`,
      )
      .join("")}${site()
      .schedule.split(",")
      .filter(Boolean)
      .map((s) => {
        let scan = ev.filter((e) => e.kind === "scan" && e.payload.slot === s);
        return `<div class="item row"><div><strong>${esc(s)}</strong><p class="muted">${scan.length} checkpoint records</p></div>${pill(scan.length ? "Records available" : "Unconfirmed", scan.length ? "" : "pending")}</div>`;
      })
      .join(
        "",
      )}<small>A started round is complete only when every checkpoint is recorded. Upload delays can affect this view.</small></section><section class="card"><h2>Supervisor inbox</h2>${
      state.notifications
        .filter((n) => n.site_id === siteId)
        .map(
          (n) =>
            `<div class="item">${state.events.find((e) => e.id === n.event_id && e.kind === "message") ? `<p class="muted">Message from ${esc(guardName(state.events.find((e) => e.id === n.event_id).user_id))}</p>` : ""}<strong>${esc(state.events.find((e) => e.id === n.event_id && e.kind === "message")?.payload.text || (state.events.find((e) => e.id === n.event_id && e.kind === "message") ? "Voice message" : "") || state.incidents.find((i) => i.id === n.event_id)?.report || "Guard requests urgent supervisor attention")}</strong><div data-message-media="${n.event_id}"></div>${state.events.some((e) => e.id === n.event_id && e.kind === "message") ? `<button data-action="openChat" data-message-id="${n.event_id}">Open conversation</button>` : ""}<p>${pill(n.status, "pending")}</p>${n.status !== "acknowledged" ? `<button data-action="ackNotification" data-id="${n.id}">${state.events.find((e) => e.id === n.event_id && e.kind === "message") ? "Acknowledge message" : "Acknowledge alert"}</button>` : ""}</div>`,
        )
        .join("") || '<p class="muted">No notifications in your inbox.</p>'
    }<p class="source">In-app delivery only. No SMS or police dispatch. Delivery means a supervisor’s app displayed the notification.</p></section></div>`;
  else if (page === "incidents" && mobileSupervisor)
    renderSupervisorProblems(t, inc);
  else if (page === "incidents")
    t.innerHTML = `<div class="stack" style="margin-top:20px">${
      inc
        .filter(
          (i) => i.captured_at.slice(0, 10) === day || i.status !== "Resolved",
        )
        .map(
          (i) =>
            `<section class="card" id="incident-${i.id}">${incidentCard(i, true)}</section>`,
        )
        .join("") || '<p class="empty">No incidents for this date.</p>'
    }</div>`;
  else if (page === "summaries")
    t.innerHTML = `<section class="card" style="margin-top:20px"><div class="row"><h2>Daily summaries</h2>${user.role === "supervisor" ? '<button class="primary" data-action="summary">Generate draft from records</button>' : ""}<button data-action="download">Download records (JSON)</button></div><p class="muted">Counts come from the database. Drafts require supervisor approval before owners can see them.</p>${
      state.summaries
        .filter((s) => s.site_id === siteId && s.day === day)
        .map(
          (s) =>
            `<article class="item"><p>${pill(s.status, s.status === "Draft" ? "pending" : "")} ${esc(s.day)}</p><p>${esc(s.narrative)}</p><details><summary>Counts and source records</summary><pre style="white-space:pre-wrap;overflow-wrap:anywhere">${esc(JSON.stringify(JSON.parse(s.counts), null, 2))}</pre>${JSON.parse(
              s.counts,
            )
              .sourceIds.map(
                (id) =>
                  `<button data-action="source" data-id="${id}">View ${esc(id.slice(0, 12))}</button>`,
              )
              .join(
                "",
              )}</details>${s.status === "Draft" ? `<form class="approveSummary" data-id="${s.id}"><label class="label">Review narrative</label><textarea name="narrative">${esc(s.narrative)}</textarea><button class="primary">Approve for customer</button></form>` : ""}</article>`,
        )
        .join("") || '<p class="empty">No approved summaries yet.</p>'
    }</section>`;
  else if (page === "message") renderChat(t);
  else if (page === "instructionSetup")
    instructionEditor(
      t,
      site(),
      api,
      async () => {
        await refresh();
        render();
        toast("Instructions published for future shifts.");
      },
      esc,
    );
  else if (page === "setup" && mobileSupervisor) {
    renderSettings(t,{site:site(),state,api,esc,icon,done:async()=>{await refresh();render();toast("Settings saved.");}});
    document.querySelector(".supervisor-filters")?.remove();
    document.querySelector(".supervisor-mobile > .notice")?.remove();
  } else if (page === "admin") {
    renderAdmin(t);
    if(user.role==='owner') {
      t.querySelector('input[value="additional_site"]')?.closest('section')?.remove();
      const existing=document.createElement('div'),create=document.createElement('div');t.prepend(existing);t.append(create);
      const options={site:site(),state,api,esc,done:async()=>{await refresh();render();toast('Property saved.');}};
      propertyEditor(existing,options);propertyEditor(create,{...options,create:true});
    }
  }
  if(page==='gps') {
    root.querySelector('.supervisor-filters')?.remove();root.querySelector('.supervisor-mobile > .notice')?.remove();
    const groups=locationGroups(eventList(),state.locationReviews||[],siteId);
    if(selectedLocationShift)gpsReview(t,{group:groups.find(g=>g.shiftId===selectedLocationShift),reviews:state.locationReviews||[],guardName,esc,api,done:async()=>{await refresh();render();toast('Location records marked reviewed.');}});
    else t.innerHTML=`<section class="card"><h2>Location review history</h2>${groups.map(g=>`<button class="checkpoint-list-row" data-action="reviewLocation" data-shift="${esc(g.shiftId)}"><span>${esc(guardName(g.guardId))} · ${date(g.events[0].captured_at)}<small>${g.pending.length} records need review</small></span></button>`).join('')||'<p>No location exceptions have been recorded.</p>'}</section>`;
  }
  if (page === "summaries") renderActivityReports(t);
  if (mobileSupervisor && page === "home") {
    const windows = overviewShifts({
      day,
      site: site(),
      plans: state.shiftPlans || [],
    });
    const setupTasks = supervisorSetupTasks({
      windows,
      users: state.users,
      checkpoints: cps(),
    });
    if (setupTasks.length) {
      t.querySelector(".stats").innerHTML = `<section class="card stat supervisor-setup-status"><div class="kpi-label">${icon("admin")}<span>Finish setting up</span></div><p>Complete these steps before Guard Patrol starts measuring this property.</p><div class="supervisor-setup-actions">${setupTasks.map(task => `<button type="button" data-page="setup" data-settings-tab="${task.tab}"><span>${icon(task.icon)}</span><span><strong>${task.title}</strong><small>${task.text}</small></span></button>`).join("")}</div></section>`;
      t.querySelector(":scope > .grid").innerHTML = `<section class="card attention-card"><div class="attention-section"><div class="attention-heading"><h2>Needs your attention</h2></div><div class="attention-list"><p class="empty">Complete the setup steps above to begin tracking this property.</p></div></div></section><section class="card guards-this-shift"><h2>Guards this shift</h2><p class="empty">Guard activity will appear after setup is complete.</p></section>`;
    } else {
    const selected =
      windows.find((w) => w.key === selectedOverviewShift) ||
      windows.find((w) => w.current) ||
      windows.find((w) => w.start > Date.now()) ||
      windows.at(-1);
    let overviewSite = site();
    if (day < new Date(Date.now() + 3600000).toISOString().slice(0, 10)) {
      const snapshots = eventList().filter(
        (e) =>
          e.kind === "start" &&
          Date.parse(e.captured_at) < selected.end &&
          Date.parse(e.payload.scheduled_end_at || e.captured_at) >=
            selected.start &&
          typeof e.payload.patrol_schedule === "string",
      );
      selected.patrolUnknown = snapshots.length === 0;
      overviewSite = {
        ...site(),
        schedule: [
          ...new Set(
            snapshots.flatMap((e) =>
              e.payload.patrol_schedule.split(",").filter(Boolean),
            ),
          ),
        ].join(","),
      };
    }
    const picker = document.createElement("details");
    picker.className = "overview-shift-picker";
    picker.innerHTML = `<summary aria-label="Choose overview shift"><span class="shift-picker-label"><strong>Shift ${windows.indexOf(selected) + 1}</strong><span>${selected.start_time}–${selected.end_time}</span>${selected.end_time <= selected.start_time ? '<small title="Ends next day" aria-label="Ends next day">+1</small>' : ""}</span><svg class="shift-picker-arrow" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="m6 9 6 6 6-6"/></svg></summary><div class="shift-picker-options">${windows.map((w, i) => `<button type="button" data-md="true" data-action="overviewShift" data-shift="${esc(w.key)}" aria-pressed="${w.key === selected.key}">Shift ${i + 1} · ${w.start_time}–${w.end_time}${w.end_time <= w.start_time ? " next day" : ""}${w.current ? " · Current" : ""}</button>`).join("")}</div>`;
    document.querySelector(".supervisor-heading").append(picker);
    const datePicker = document.createElement("details");
    datePicker.className = "overview-date-picker";
    const isToday =
      day === new Date(Date.now() + 3600000).toISOString().slice(0, 10);
    datePicker.innerHTML = `<summary aria-label="Choose overview date"><span class="overview-date-title">${isToday ? "Today’s overview" : esc(new Date(day + "T12:00:00Z").toLocaleDateString("en-NG", { day: "numeric", month: "short", year: "numeric" }))}</span><svg class="overview-calendar-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" aria-hidden="true"><rect x="3" y="5" width="18" height="16" rx="2"/><path d="M7 3v4m10-4v4M3 11h18M7 15h2m4 0h2m-8 3h2"/></svg></summary><div class="overview-calendar">${overviewCalendar(day.slice(0, 7), day)}</div>`;
    document.querySelector(".supervisor-heading h2").replaceWith(datePicker);

    const cards = supervisorStatus({
      selectedShift: selected,
      site: overviewSite,
      plans: state.shiftPlans || [],
      shifts: state.shifts,
      events: eventList(),
      incidents: inc,
      checkpoints: cps(),
      day,
    });
    t.querySelector(".stats").innerHTML = [cards[2], cards[0], cards[1]]
      .map(
        (c) =>
          `<section class="card stat" data-md="true" data-tone="${c.tone}"><div class="kpi-label">${c.tone === "attention" ? `<span class="kpi-caution" role="img" aria-label="Needs checking" title="Needs checking">${icon("incidents")}</span>` : icon(["person", "round", "check"][cards.indexOf(c)])}<span>${esc(c.label)}</span></div><div class="kpi-value"><strong>${esc(c.value)}</strong><span class="kpi-qualifier">${esc(c.qualifier)}</span></div></section>`,
      )
      .join("");
    const details = overviewDetails({
      site: overviewSite,
      selectedShift: selected,
      shifts: state.shifts,
      events: eventList(),
      incidents: inc,
      checkpoints: cps(),
    });
    const incoming = new Set(
      (state.notifications || [])
        .filter(
          (n) =>
            n.site_id === siteId &&
            n.status === "submitted" &&
            !vault.readMessages?.[n.id],
        )
        .map((n) => n.event_id),
    );
    const messages = eventList().filter(
      (e) =>
        e.kind === "message" &&
        e.user_id !== user.id &&
        incoming.has(e.id) &&
        Date.parse(e.captured_at) < selected.end,
    );
    const attention = [
      ...locationGroups(eventList(),state.locationReviews||[],siteId,selected.end).filter(g=>g.pending.length).map(g=>({at:Math.max(...g.pending.map(e=>Date.parse(e.captured_at))),html:`<div class="overview-row attention-report-row"><span class="attention-report-icon" aria-hidden="true">${icon('location')}</span><div><strong>${esc(guardName(g.guardId))} · ${g.pending.some(e=>e.payload.location_assessment.status==='outside')?'Location outside property area':'Location could not be confirmed'}</strong><small>${g.pending.length} record${g.pending.length===1?'':'s'} · ${date(g.pending.at(-1).captured_at)}</small></div><button data-action="reviewLocation" data-shift="${esc(g.shiftId)}" data-md="true" class="overview-row-action">Review →</button></div>`})),
      ...details.problems.map(
        (i) =>
          ({ at: Date.parse(i.captured_at), html: `<div class="overview-row attention-report-row"><span class="attention-report-icon" aria-hidden="true">${icon("summaries")}</span><div><strong>${esc(i.report || "Voice report")}</strong><small>Reported by ${esc(guardName(i.user_id))} on ${esc(new Date(i.captured_at).toLocaleString("en-GB", { day: "numeric", month: "long", year: "numeric", hour: "2-digit", minute: "2-digit", hour12: false, timeZone: "Africa/Lagos" }))}</small></div><button data-page="incidents" data-md="true" class="overview-row-action">Review <span aria-hidden="true">→</span></button></div>` }),
      ),
      ...(selected.current ? messages : []).map(
        (e) =>
          ({ at: Date.parse(e.captured_at), html: `<div class="overview-row"><div><strong>${esc(guardName(e.user_id))} · Unread ${e.payload.has_audio ? "voice message" : "message"}</strong><small>${date(e.captured_at)}</small></div><button data-action="openChat" data-message-id="${e.id}" data-md="true" class="overview-row-action">Open <span aria-hidden="true">→</span></button></div>` }),
      ),
      ...details.guards
        .filter((g) => selected.current && g.expected && g.due && !g.session)
        .map(
          (g) =>
            ({ at: selected.start, html: `<div class="overview-row"><strong>${esc(guardName(g.id))} · Check-in not recorded</strong></div>` }),
        ),
      ...(selected.current ? details.patrols : []).map(
        (p) =>
          ({ at: p.due, html: `<div class="overview-row"><strong>${p.slot} patrol · Completion not recorded</strong></div>` }),
      ),
    ];
    const scope = [siteId, day, selected.key].join(":");
    if (attentionScope !== scope) { attentionPage = 0; attentionScope = scope; }
    attention.sort((a, b) => attentionOrder === "newest" ? b.at - a.at : a.at - b.at);
    attentionPage = Math.min(attentionPage, Math.max(0, Math.ceil(attention.length / 3) - 1));
    const offset = attentionPage * 3;
    const attentionRows = attention.slice(offset, offset + 3).map(item => item.html).join("");
    const attentionControls = attention.length > 1 ? `<details class="overview-shift-picker attention-sort-picker"><summary aria-label="Sort attention by date"><span>${attentionOrder === "newest" ? "Newest first" : "Oldest first"}</span><svg class="shift-picker-arrow" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="m6 9 6 6 6-6"/></svg></summary><div class="shift-picker-options">${["newest", "oldest"].map(order => `<button data-md="true" data-action="attentionSort" data-order="${order}" aria-pressed="${attentionOrder === order}">${order === "newest" ? "Newest first" : "Oldest first"}</button>`).join("")}</div></details>` : "";
    const attentionPager = attention.length > 3 ? '<nav class="attention-pagination" aria-label="Attention pages"><button data-md="true" data-action="attentionPrevious" ' + (attentionPage === 0 ? "disabled" : "") + '>Previous</button><span>' + (offset + 1) + '–' + Math.min(offset + 3, attention.length) + ' of ' + attention.length + '</span><button data-md="true" data-action="attentionNext" ' + (offset + 3 >= attention.length ? "disabled" : "") + '>Next</button></nav>' : "";
    t.querySelector(":scope > .grid").innerHTML =
      `<section class="card attention-card"><div class="attention-section"><div class="attention-heading"><h2>Needs your attention (${attention.length})</h2>${attentionControls}</div><div class="attention-list">${attentionRows || '<p class="empty">Nothing needs your attention.</p>'}</div><div class="attention-footer">${attentionPager}</div></div></section><section class="card guards-this-shift"><h2>Guards this shift</h2>${selected.rosterUnknown ? '<p class="muted">No roster was saved for this date. Showing recorded attendance.</p>' : ""}${details.guards.map((g) => `<div class="overview-row"><div><span class="guard-thumbnail" aria-hidden="true">${icon("person")}${state.users.find(u => u.id === g.id)?.photo_id ? `<img src="/media/profile/${encodeURIComponent(g.id)}" alt="">` : ""}</span><strong>${esc(guardName(g.id))}</strong><small>${g.session ? "Checked in " + date(g.session.started_at) + (g.session.ended_at ? " · Ended " + date(g.session.ended_at) : "") : g.due ? "Check-in not recorded" : "Check-in not due yet"}</small></div></div>`).join("") || '<p class="empty">No guards assigned to this shift.</p>'}</section>`;
    }
  }
  if (mobileSupervisor && ["home", "patrols"].includes(page)) {
    const sections = t.querySelectorAll(":scope > .grid > section");
    if (page === "patrols") t.replaceChildren(sections[2]);
    else {
      sections[2]?.remove();
      sections[3]?.remove();
      const stats = t.querySelector(".stats");
      const actions = document.querySelector(".supervisor-actions");
      const quickStart = document.createElement("section");
      quickStart.className = "supervisor-quick-start";

      quickStart.append(actions);
      document.querySelector(".supervisor-heading").before(quickStart);
      document.querySelector(".supervisor-filters")?.remove();
      document.querySelector(".supervisor-mobile > .notice")?.remove();
      const lastReceived = document.createElement("p");
      lastReceived.className = "last-record-received";
      lastReceived.textContent = "Last record received: " + date(site().last_sync);
      if (!site().last_sync || Date.now() - Date.parse(site().last_sync) > 30 * 60000) {
        const uncertainty = document.createElement("p");
        uncertainty.className = "notice pending";
        uncertainty.textContent = "Current activity unconfirmed. New guard records may still be pending upload.";
        t.prepend(uncertainty);
      }
      t.append(lastReceived);
    }
  }
  if (mobileSupervisor && ["summaries", "setup", "instructionSetup", "patrols", "admin"].includes(page)) {
    const main = t.closest("main");
    main.classList.add("supervisor-standard");
    const heading = main.querySelector(".supervisor-heading");
    heading.querySelector('[data-action="refresh"]')?.remove();
    main.querySelector(".supervisor-filters")?.remove();
    main.querySelector(":scope > .notice")?.remove();
    if (page === "summaries") {
      heading.querySelector("h2").textContent = "Reports";
    }
    if (page === "setup") t.classList.add("settings-index");
    const footer = document.createElement("p");
    footer.className = "last-record-received";
    footer.textContent = "Last record received: " + date(site().last_sync);
    t.append(footer);
  }
  if (page === "home" && navigator.onLine)
    for (let n of state.notifications.filter(
      (n) =>
        n.site_id === siteId &&
        n.status === "submitted" &&
        !eventList().some((e) => e.id === n.event_id && e.kind === "message"),
    ))
      api(`/api/notifications/${n.id}/delivered`, {})
        .then(() => {
          n.status = "delivered";
        })
        .catch(() => {});
}
function guardName(id) {
  return (
    state.users.find((u) => u.id === id)?.name || (id === "bala" ? "Bala" : id)
  );
}
function incidentCard(i, full = false) {
  return `<article class="item"><div class="row"><strong>${esc(i.report)}</strong>${pill(i.status, i.status === "Resolved" ? "" : "pending")}</div><p class="muted">Event: ${esc(i.event_time || "Not stated")} · Received ${date(i.received_at)}</p><p>${esc(i.responsible || "Supervisor follow-up")} ${i.next_action ? "· " + esc(i.next_action) : ""}</p>${full ? `<p class="source">Captured: ${date(i.captured_at)} · Record ${i.id}</p><div class="media">${i.media.map((m) => `<button data-action="media" data-id="${m.id}" data-mime="${m.mime}">${m.mime.startsWith("audio") ? "▶ Listen to original" : "▧ View photo"} · ${esc(m.source)}</button>`).join("")}</div><div class="timeline">${i.history.map((h) => `<p><strong>${esc(h.status)}</strong> · ${esc(h.name)}<br><small>${date(h.at)}</small><br>${esc(h.note)}</p>`).join("")}</div><details><summary>Original transcript and approved revisions</summary><p>${esc(i.transcript || "No AI transcript; guard supplied text.")}</p>${i.revisions.map((r) => `<p>${date(r.at)} · ${esc(r.content)}</p>`).join("")}</details>${user.role === "supervisor" && i.status !== "Resolved" ? `<form class="transition" data-id="${i.id}"><input type="hidden" name="status" value="${{ Reported: "Acknowledged", Acknowledged: "Assigned", Assigned: "Resolved" }[i.status]}">${i.status === "Acknowledged" ? '<label class="label">Responsible person</label><input name="responsible" required placeholder="e.g. Site supervisor / repair contractor"><label class="label">Next action</label><input name="next_action" required placeholder="Arrange replacement lock">' : ""}<label class="label">${i.status === "Assigned" ? "Resolution note" : "Follow-up note"}</label><textarea name="note" ${i.status === "Assigned" ? "required" : ""}></textarea>${i.status === "Assigned" ? '<label class="label">Optional resolution photo</label><input type="file" name="resolution" accept="image/jpeg,image/png">' : ""}<button class="primary">${{ Reported: "Acknowledge issue", Acknowledged: "Assign follow-up", Assigned: "Resolve with note" }[i.status]}</button></form>` : ""}` : `<button data-page="incidents">Review issue →</button>`}</article>`;
}
function renderAdmin(t) {
  t.innerHTML = `<div class="grid" style="margin-top:20px"><section class="card"><h2>Instructions & schedule</h2><form class="adminForm"><input type="hidden" name="kind" value="site"><input type="hidden" name="instructions" value="${esc(site().instructions)}"><button type="button" data-page="instructionSetup">Edit shift instructions</button><label class="label">Daily scheduled rounds (24-hour, comma separated)</label><input name="schedule" pattern="([01][0-9]|2[0-3]):[0-5][0-9](,([01][0-9]|2[0-3]):[0-5][0-9])*" value="${esc(site().schedule)}" required><button class="primary">Save site settings</button></form></section><section class="card"><h2>Patrol checkpoints</h2>${cps()
    .map((c) => `<p>${esc(c.name)} · <code>${esc(c.code)}</code></p>`)
    .join(
      "",
    )}<form class="adminForm"><input type="hidden" name="kind" value="checkpoint"><label class="label">New checkpoint</label><input name="name" required><button>Add checkpoint</button></form><button data-action="qr">Print QR checkpoint sheet</button></section><section class="card"><h2>Create ${user.role === "owner" ? "supervisor" : "guard"} account</h2><form class="adminForm"><input type="hidden" name="kind" value="user"><label class="label">Name</label><input name="name" required><label class="label">Email</label><input name="email" type="email" required><label class="label">Initial password (12+ characters)</label><input name="password" type="password" minlength="12" required autocomplete="new-password"><label class="label">Role</label><select name="role">${user.role === "owner" ? '<option value="supervisor">Supervisor</option>' : '<option value="guard">Guard</option>'}</select><label class="label" for="profilePhoto">Profile photo (optional)</label><input id="profilePhoto" name="profile_photo" type="file" accept="image/jpeg,image/png"><small>JPEG or PNG, up to 2 MB. Used to identify this team member.</small><button class="primary">Create & assign to this site</button></form></section><section class="card"><h2>Assign existing team member</h2><form class="adminForm"><input type="hidden" name="kind" value="assign"><label class="label">Team member in your scope</label><select name="user_id">${state.users
    .filter((u) => u.role === (user.role === "owner" ? "supervisor" : "guard"))
    .map((u) => `<option value="${u.id}">${esc(u.name)} · ${u.role}</option>`)
    .join(
      "",
    )}</select><button class="primary">Assign to selected site</button></form></section><section class="card"><h2>Shift schedule</h2><p class="muted">Daily local site times. Overnight shifts may end the next day.</p>${(
    state.shiftPlans || []
  )
    .filter((p) => p.site_id === siteId)
    .map(
      (p) =>
        `<p>${esc(guardName(p.guard_id))}: ${esc(p.start_time)}–${esc(p.end_time)}</p>`,
    )
    .join(
      "",
    )}<form class="adminForm"><input type="hidden" name="kind" value="shift_plan"><label class="label">Assigned guard</label><select name="guard_id">${state.users
    .filter((u) => u.role === "guard")
    .map((u) => `<option value="${u.id}">${esc(u.name)}</option>`)
    .join(
      "",
    )}</select><label class="label">Starts</label><input name="start_time" type="time" required><label class="label">Ends</label><input name="end_time" type="time" required><button class="primary">Add shift plan</button></form></section>${user.role === "owner" ? `<section class="card"><h2>Another property for this customer</h2><form class="adminForm"><input type="hidden" name="kind" value="additional_site"><label class="label">Property name</label><input name="name" required><button class="primary">Create site</button></form></section>` : ""}</div>`;
}
async function locate() {
  return new Promise((resolve) => {
    if (!navigator.geolocation) return resolve(null);
    navigator.geolocation.getCurrentPosition(
      (p) =>
        resolve({
          latitude: p.coords.latitude,
          longitude: p.coords.longitude,
          accuracy: p.coords.accuracy,
        }),
      () => resolve(null),
      { timeout: 4500, maximumAge: 0, enableHighAccuracy: true },
    );
  });
}
async function enqueue(kind, payload, media = []) {
  if (kind === "message" && !state.features?.messaging)
    throw new Error("In-app messaging is not available in this MVP.");
  if (kind === "start" && shift())
    throw new Error("You already have an active or pending shift.");
  if (["incident", "alert", "scan", "note", "patrol_start"].includes(kind)) {
    const current = shift();
    if (!current || current.site_id !== siteId)
      throw new Error("Start your shift first.");
    payload.shift_id = current.id;
  }
  let q = {
    id: uuid(),
    kind,
    site_id: siteId,
    captured_at: new Date().toISOString(),
    payload,
    media,
    status: "pending",
  };
  if (kind === "start") {
    const plan=currentPlan(state.shiftPlans||[],user.id,siteId,q.captured_at);
    q.payload.patrol_schedule=plan?.schedule ?? site().schedule;
    q.payload.instructions=[site().instructions,plan?.instructions].filter(Boolean).join("\n\n");
    if(plan?.template_id) {q.payload.shift_template_id=plan.template_id;q.payload.shift_plan_version_id=plan.id;}
  }
  if (kind === "start")
    q.payload.scheduled_end_at = scheduledEnd(
      q.captured_at,
      state.shiftPlans || [],
      user.id,
      siteId,
    );
  vault.queue.push(q);
  try {
    await persist();
  } catch (e) {
    vault.queue.pop();
    throw new Error(
      "Device storage could not save this record. Keep this screen open and free storage; nothing was submitted.",
    );
  }
  if (kind !== "sign_in_location")
    toast("Saved on this phone. Waiting to upload.");
  return q;
}
async function sync() {
  if (busy || signingOut || !user || !navigator.onLine) return;
  busy = true;
  try {
    for (let q of pending().filter((q) => q.status !== "conflict")) {
      if (q.kind === "message" && !state.features?.messaging) continue;
      q.status = "uploading";
      q.error = "";
      await persist();
      try {
        if (!q.submitted) {
          await api("/api/events", {
            id: q.id,
            site_id: q.site_id,
            kind: q.kind,
            captured_at: q.captured_at,
            payload: q.payload,
          });
          q.submitted = true;
          await persist();
        }
        for (let m of q.media || []) {
          if (m.uploaded) continue;
          let f = new FormData();
          f.append("file", await blobFrom(m), m.name);
          f.append("source", m.source || "microphone");
          await api(`/api/media/${q.id}/${m.id}`, f);
          m.uploaded = true;
          await persist();
        }
        q.status = "synchronized";
        q.media = [];
        await persist();
      } catch (e) {
        q.status = "failed";
        q.error = e.message;
        await persist();
        if (!q.submitted && e.status === 409) {
          q.status = "conflict";
          q.error = "This saved record conflicts with the server. Ask your supervisor to review it.";
          await persist();
          continue;
        }
        // A failed attachment must not hold subsequent urgent records hostage.
        if (!q.submitted && e.status !== 403) break;
      }
    }
    await refresh();
    if (page === "message") updateChatMessages();
  } catch (e) {
    toast(e.message);
  } finally {
    busy = false;
    if (
      !signingOut &&
      ["home", "incidents", "summaries"].includes(page) &&
      !holding &&
      !recordingSaving &&
      !openingMicrophone &&
      !photoStream &&
      ![...document.querySelectorAll("audio")].some((audio) => !audio.paused) &&
      !document.querySelector(
        ".overview-date-picker[open],.overview-shift-picker[open]",
      ) &&
      !document.activeElement?.matches("input,textarea")
    )
      render();
  }
}
async function saveDraftFromForm() {
  if (!$("#report")) return;
  vault[draftKey()] = {
    ...(vault[draftKey()] || {}),
    site_id: vault[draftKey()]?.site_id || siteId,
    report: $("#report").value,
  };
  await persist();
}
let holding = false,
  recordingSaving = false;
let openingMicrophone = false,
  recordingTick = null,
  recordingBegan = 0;
function recordingTime(seconds) {
  return (
    String(Math.floor(seconds / 60)).padStart(2, "0") +
    ":" +
    String(Math.floor(seconds % 60)).padStart(2, "0")
  );
}
async function startRecording() {
  if (recorder?.state === "recording" || openingMicrophone || recordingSaving)
    return;
  openingMicrophone = true;
  updateReportSubmit();
  $("#record").disabled = true;
  $("#recordStatus").textContent =
    "Opening microphone… allow microphone access if asked.";
  holding = true;
  try {
    if (!navigator.mediaDevices?.getUserMedia || !window.MediaRecorder)
      throw new Error("Recording is unavailable. Please type your report.");
    stream = await navigator.mediaDevices.getUserMedia({ audio: true });
    if (!holding) {
      stream.getTracks().forEach((t) => t.stop());
      $("#recordStatus").textContent =
        "Microphone ready. Tap to start recording.";
      return;
    }
    let chunks = [];
    const mime = ["audio/webm;codecs=opus", "audio/mp4"].find((type) =>
      MediaRecorder.isTypeSupported(type),
    );
    recorder = new MediaRecorder(stream, mime ? { mimeType: mime } : undefined);
    recorder.ondataavailable = (e) => chunks.push(e.data);
    recorder.onstop = async () => {
      stream.getTracks().forEach((t) => t.stop());
      try {
        let blob = new Blob(chunks, { type: recorder.mimeType }),
          f = await fileData(blob);
        f.name = "recording." + (blob.type.includes("mp4") ? "mp4" : "webm");
        if (!blob.size)
          throw new Error("No audio captured. Please record again.");
        f.source = "microphone";
        f.durationSeconds = Math.max(0.1, (Date.now() - recordingBegan) / 1000);
        await saveDraftFromForm();
        vault[draftKey()] = { ...vault[draftKey()], audio: f };
        await persist();
        render();
        toast("Recording saved. Play it back or submit when ready.");
      } catch (e) {
        toast(e.message);
      } finally {
        recordingSaving = false;
        updateReportSubmit();
        if ($("#record")) {
          $("#record").disabled = false;
          $("#record").classList.remove("is-recording");
          $("#record").setAttribute("aria-label", "Press to start");
          $("#record").innerHTML = "Press to start";
        }
      }
    };
    recorder.start(250);
    recordingBegan = Date.now();
    $("#record").classList.add("is-recording");
    $("#record").setAttribute("aria-label", "Tap to stop");
    $("#record").innerHTML = "Stop recording";
    const tick = () => {
      if ($("#recordStatus"))
        $("#recordStatus").textContent =
          "Recording · " + recordingTime((Date.now() - recordingBegan) / 1000);
    };
    tick();
    recordingTick = setInterval(tick, 200);
    recordStart = setTimeout(stopRecording, 90000);
  } catch (e) {
    holding = false;
    $("#typedReport")?.setAttribute("open", "");
    $("#recordStatus").textContent =
      "Microphone unavailable. Allow microphone access or type below.";
    toast("Microphone unavailable. You can type your report instead.");
  } finally {
    openingMicrophone = false;
    updateReportSubmit();
    if ($("#record") && !recordingSaving) $("#record").disabled = false;
  }
}
function stopRecording() {
  holding = false;
  clearTimeout(recordStart);
  clearInterval(recordingTick);
  if (recorder?.state === "recording") {
    if (recordingSaving) return;
    recordingSaving = true;
    updateReportSubmit();
    $("#record").disabled = true;
    $("#recordStatus").textContent = "Saving recording…";
    const activeRecorder = recorder;
    setTimeout(
      () => {
        if (activeRecorder.state === "recording") activeRecorder.stop();
      },
      Math.max(0, 1200 - (Date.now() - recordingBegan)),
    );
  }
}
function speak(t) {
  if (!("speechSynthesis" in window))
    return toast(
      "Read-aloud is unavailable on this browser. Please read the text.",
    );
  speechSynthesis.cancel();
  let u = new SpeechSynthesisUtterance(t);
  u.lang = "en-NG";
  speechSynthesis.speak(u);
}
async function scan(code, method = "qr") {
  if (scanBusy) return;
  let s = shift();
  if (!s) throw new Error("Start a shift first");
  if (s.site_id !== siteId)
    throw new Error("Select the property for your active shift.");
  if (!roundId) throw new Error("Start your patrol from Home.");
  const cp = cps().find((c) => c.code === code);
  if (!cp || cp.id !== selectedCheckpoint)
    throw new Error("This label does not match the selected checkpoint.");
  vault.roundId = roundId;
  vault.slot = slot;
  if (
    eventList().some(
      (e) =>
        e.kind === "scan" &&
        e.payload.round_id === roundId &&
        e.payload.code === code,
    )
  )
    throw new Error("This stop is already checked in this round");
  scanBusy = true;
  try {
    await enqueue("scan", {
      shift_id: s.id,
      round_id: roundId,
      slot,
      code,
      selected_checkpoint_id: selectedCheckpoint,
      method,
      location: await locate(),
    });
    selectedCheckpoint = null;
    $("#manualDialog")?.close();
    // The scan is safely stored locally. Network upload must not block Home.
    scanBusy = false;
    render();
    sync();
  } finally {
    scanBusy = false;
  }
}
async function startCamera() {
  if (!selectedCheckpoint) return toast("Select a checkpoint first.");
  if (!("BarcodeDetector" in window))
    return toast(
      "QR scanning is unavailable on this browser. Enter the printed label code.",
    );
  try {
    scanStream = await navigator.mediaDevices.getUserMedia({
      video: { facingMode: "environment" },
    });
    let v = $("#camera");
    v.hidden = false;
    v.srcObject = scanStream;
    let detector = new BarcodeDetector({ formats: ["qr_code"] });
    let tick = async () => {
      if (!scanStream || page !== "round") return;
      try {
        let codes = await detector.detect(v);
        if (codes.length) {
          scanStream.getTracks().forEach((t) => t.stop());
          scanStream = null;
          await scan(codes[0].rawValue);
          return;
        }
      } catch (e) {
        toast(e.message);
      }
      setTimeout(tick, 500);
    };
    v.onloadeddata = tick;
  } catch {
    toast("Camera permission unavailable. Enter the printed checkpoint code.");
  }
}
document.addEventListener("submit", async (e) => {
  e.preventDefault();
  let f = e.target,
    b = Object.fromEntries(new FormData(f)),
    btn = e.submitter || f.querySelector("button");
  if (btn) btn.disabled = true;
  try {
    if (f.id === "activityReportForm") {
      await viewActivityReport(f, e.submitter?.value === "download");
    } else if (f.id === "login") {
      let online;
      try {
        online = await api("/api/login", b);
      } catch (err) {
        if (navigator.onLine) throw err;
      }
      await completeSignIn(b, online);
    } else if (f.id === "signupAccount") {
      if (b.password !== b.password_confirm) throw new Error("Passwords do not match");
      const ownerName = [b.first_name, b.last_name].map((name) => String(name || "").trim()).filter(Boolean).join(" ");
      signupDraft = {
        ...signupDraft,
        ...b,
        owner_name: ownerName,
        customer_name: ownerName,
        notice_accepted: b.notice_accepted === "on",
      };
      signupStep = 2;
      saveSignupDraft();
      login();
      $("#signupPropertyName")?.focus();
    } else if (f.id === "signupProperty") {
      signupDraft = { ...signupDraft, ...b, confirmed: b.confirmed === "on" };
      const online = await api("/api/signup", signupDraft);
      const credentials = { email: signupDraft.email, password: signupDraft.password };
      signupStep = 0;
      signupDraft = {};
      clearSignupDraft();
      await completeSignIn(credentials, online);
      toast("Your account and first property are ready. Add a supervisor when you are ready.");
    } else if (f.id === "shiftForm") {
      let s = shift();
      if (
        !(await confirmAction(
          s
            ? "Are you sure you are ready to end your shift?"
            : "Are you sure you are ready to start your shift?",
          s ? "End shift" : "Start shift",
          !!s,
        ))
      )
        return;
      await enqueue(
        s ? "end" : "start",
        s
          ? { shift_id: s.id, note: b.note, location: await locate() }
          : {
              instructions: site().instructions,
              instruction_audio: site().instruction_audio,
              acknowledged: new FormData(f).getAll("ack"),
              location: await locate(),
            },
      );
      page = "home";
      toast(s ? "Shift ended." : "Your shift has started.");
      render();
      await sync();
    } else if (f.id === "scanForm") {
      await scan(b.code.trim(), "manual");
    } else if (f.id === "reportForm") {
      reportSubmitting = true;
      updateReportSubmit();
      await saveDraftFromForm();
      let d = vault[draftKey()];
      if (holding || recordingSaving || recorder?.state === "recording")
        throw new Error("Finish recording before submitting.");
      if (!d.report?.trim() && !d.audio) {
        $("#typedReport").open = true;
        throw new Error("Record or type what happened.");
      }
      if (page === "message") {
        if (user.role === "supervisor") {
          const recipient = messageRecipients().find(t => t.key === d.recipient);
          if (!recipient)
            throw new Error("Select an on-duty guard before sending. The selected shift may have ended.");
          const previousQueue = vault.queue.slice();
          const media = [...(d.audio ? [d.audio] : []), ...(d.photos || [])];
          vault.queue.push({
            id: uuid(), kind: "message", site_id: siteId, captured_at: new Date().toISOString(),
            payload: { guard_id: recipient.guard_id, shift_id: recipient.shift_id, text: d.report?.trim() || "", has_audio: !!d.audio, attachment_count: media.length },
            media, status: "pending",
          });
          vault[draftKey()] = null;
          try { await persist(); } catch (error) { vault.queue = previousQueue; vault[draftKey()] = d; throw error; }
          render();
          toast("Saved for " + guardName(recipient.guard_id) + ". Waiting to upload.");
          await sync();
          return;
        }
        if (
          !chatContext()?.shift_id ||
          (user.role === "guard" && chatContext().shift_id !== shift()?.id)
        )
          throw new Error("Start a shift before messaging.");
        await enqueue(
          "message",
          {
            guard_id: chatContext().guard_id,
            shift_id: chatContext().shift_id,
            text: d.report?.trim() || "",
            has_audio: !!d.audio,
            attachment_count: (d.audio ? 1 : 0) + (d.photos || []).length,
          },
          [...(d.audio ? [d.audio] : []), ...(d.photos || [])],
        );
        vault[draftKey()] = null;
        await persist();
        render();
        await sync();
        return;
      }
      if (
        !(await confirmAction(
          "Have you added all the necessary information needed for this report?",
          "Submit",
        ))
      )
        return;
      await enqueue(
        "incident",
        {
          report:
            d.report?.trim() ||
            "Voice report — listen to the attached recording.",
          event_time: d.event_time?.trim() || "Event time not stated",
          report_format: d.report?.trim() ? "text" : "audio",
          typed_report: d.report?.trim() || "",
          transcript: d.transcript || "",
          evidence: { audio: d.audio ? 1 : 0, photos: (d.photos || []).length },
          approved: true,
          draft_history: d.history || [],
        },
        [...(d.audio ? [d.audio] : []), ...(d.photos || [])],
      );
      vault[draftKey()] = null;
      await persist();
      page = "home";
      render();
      await sync();
    } else if (f.classList.contains("problemResolve")) {
      await api(`/api/incidents/${f.dataset.id}/resolve`, {note:b.note || "",category:b.category,priority:b.priority || null});
      selectedProblemId = null;
      await refresh();
      render();
      toast("Problem resolved.");
    } else if (f.classList.contains("transition")) {
      let file = new FormData(f).get("resolution");
      if (file?.size) {
        let m = await fileData(file),
          fd = new FormData();
        fd.append("file", file);
        fd.append("source", "resolution photo");
        await api(`/api/media/${f.dataset.id}/${m.id}`, fd);
      }
      await api(`/api/incidents/${f.dataset.id}/transition`, b);
      await refresh();
      render();
      toast("Follow-up recorded.");
    } else if (f.id === "siteLocationForm") {
      await api("/api/site-location", { ...b, site_id: siteId });
      await refresh();
      render();
      toast("Site reference saved.");
    } else if (f.id === "patrolScheduleForm") {
      await api("/api/patrol-schedule", { ...b, site_id: siteId });
      await refresh();
      render();
      toast("Patrol schedule saved.");
    } else if (f.classList.contains("adminForm")) {
      const photo = f.querySelector("[name=profile_photo]")?.files[0];
      if (photo) {
        if (photo.size > 2 * 1024 * 1024) throw new Error("Profile photo must be no larger than 2 MB.");
        const form = new FormData(f); form.set("site_id", siteId);
        await api("/api/admin", form);
      } else {
        delete b.profile_photo;
        await api("/api/admin", { ...b, site_id: siteId });
      }
      await refresh();
      render();
      toast("Saved. Change recorded in audit history.");
    } else if (f.classList.contains("approveSummary")) {
      await api(`/api/summaries/${f.dataset.id}/approve`, b);
      await refresh();
      render();
      toast("Approved summary is now available to the owner.");
    }
  } catch (err) {
    toast(err.message);
  } finally {
    if (btn) btn.disabled = false;
    if (f.id === "reportForm") {
      reportSubmitting = false;
      updateReportSubmit();
    }
  }
});
document.addEventListener("input", async (e) => {
  captureSignupDraft(e.target.form);
  if (e.target.id === "report") updateReportSubmit();
  if (["report", "event_time"].includes(e.target.id))
    try {
      await saveDraftFromForm();
    } catch {
      toast("Storage unavailable. Keep this screen open.");
    }
});
document.addEventListener("change", async (e) => {
  try {
    captureSignupDraft(e.target.form);
    if (e.target.id === "overviewDate") {
      if (!/^\d{4}-\d{2}-\d{2}$/.test(e.target.value)) return;
      if (e.target.value > new Date(Date.now() + 3600000).toISOString().slice(0, 10)) {
        e.target.value = day;
        return;
      }
      overviewDate = e.target.value;
      selectedOverviewShift = null;
      render();
      return;
    }
    if (e.target.id === "chatSelect") {
      if (holding || recordingSaving || openingMicrophone) {
        e.target.value = chatContext().key;
        throw new Error("Finish recording first.");
      }
      await saveDraftFromForm();
      selectedChat = e.target.value;
      render();
    }
    if (e.target.id === "siteSelect") {
      selectedChat = null;
      siteId = e.target.value;
      roundId = null;
      render();
    }
    if (e.target.id === "day") {
      day = e.target.value;
      render();
    }
    if (e.target.id === "slot") {
      slot = e.target.value;
      roundId = null;
      render();
    }
    if (e.target.dataset.source && e.target.files[0]) {
      await saveDraftFromForm();
      let m = await fileData(e.target.files[0]);
      m.source = e.target.dataset.source;
      vault[draftKey()].photos ||= [];
      if (vault[draftKey()].photos.length >= 4)
        throw new Error("Up to four photos per report");
      vault[draftKey()].photos.push(m);
      await persist();
      render();
    }
  } catch (err) {
    toast(err.message);
  }
});
document.addEventListener("click", async (e) => {
  let b = e.target.closest("[data-action],[data-page]");
  if (!b) return;
  if (b.tagName === "A") e.preventDefault();
  if (b.disabled || b.getAttribute("aria-disabled") === "true") return;
  try {
    if (scanBusy) throw new Error("Please wait for the checkpoint to save.");
    if (b.dataset.page === "round" && page === "home" && shift()) {
      b.disabled = true;
      const events = eventList(),
        starts = events.filter(
          (e) => e.kind === "patrol_start" && e.payload.shift_id === shift().id,
        );
      const unfinished = starts.find(
        (p) =>
          new Set(
            events
              .filter(
                (e) =>
                  e.kind === "scan" &&
                  e.payload.round_id === p.payload.round_id,
              )
              .map((e) => e.payload.code),
          ).size < cps().length,
      );
      if (unfinished) {
        roundId = unfinished.payload.round_id;
        slot = unfinished.payload.slot;
      } else {
        const next = nextPatrol(site().schedule, shift(), events);
        if (next) {
          roundId = uuid();
          slot = next.slot;
          await enqueue("patrol_start", {
            round_id: roundId,
            slot,
            scheduled_for: next.iso,
          });
          vault.roundId = roundId;
          vault.slot = slot;
          await persist();
          sync();
        } else roundId = null;
      }
      selectedCheckpoint = null;
    }
    if (b.dataset.page) {
      if (b.dataset.page === "message" && user.role === "guard" && !shift())
        throw new Error("Start a shift before messaging.");
      if (holding || recordingSaving || recorder?.state === "recording")
        throw new Error("Finish recording before leaving this page.");
      await saveDraftFromForm();
      scanStream?.getTracks().forEach((t) => t.stop());
      scanStream = null;
      nfcController?.abort();
      if (b.dataset.page === "message") { selectedChat = null; supervisorMessageId = null; }
      if (b.dataset.page === "incidents") selectedProblemId = null;
      if (b.dataset.page === "ownerProblems") ownerEvidenceProblemId = b.dataset.ownerProblemId || null;
      if(b.dataset.page === "setup" && page !== "setup") {
        resetSettings();
        selectSettings(b.dataset.settingsTab);
      }
      page = b.dataset.page;
      if (["report", "message"].includes(page) && vault[draftKey()]?.site_id)
        siteId = vault[draftKey()].site_id;
      render();
      return;
    }
    let a = b.dataset.action;
    if (a === "startSignup") {
      await beginSignup();
      return;
    }
    if (a === "cancelSignup") {
      signupStep = 0;
      signupDraft = {};
      clearSignupDraft();
      login();
      return;
    }
    if (a === "signupBack") {
      const propertyForm = $("#signupProperty");
      captureSignupDraft(propertyForm);
      signupStep = 1;
      saveSignupDraft();
      login();
      $("#signupPassword")?.focus();
      return;
    }
    if (a === "signupLocation") {
      const status = $("#signupLocationStatus");
      if (!navigator.geolocation) throw new Error("Location is unavailable on this browser. Enter the coordinates manually.");
      status.textContent = "Finding your position…";
      const position = await new Promise((resolve, reject) =>
        navigator.geolocation.getCurrentPosition(resolve, reject, {
          timeout: 12000,
          maximumAge: 0,
          enableHighAccuracy: true,
        }),
      );
      $("#signupLatitude").value = String(position.coords.latitude);
      $("#signupLongitude").value = String(position.coords.longitude);
      captureSignupDraft($("#signupProperty"));
      status.textContent = "Current position added. Confirm the address and location before continuing.";
      return;
    }
    if(a==='ownerMode'){await setOwnerMode(!ownerSupervisorView());return;}
    if (a === "activityPeriod") {
      activityPeriod = ["daily","monthly","custom"].includes(b.dataset.value) ? b.dataset.value : "daily";
      render(); return;
    }
    if(a==='reviewLocation'||a==='locationHistory') {selectedLocationShift=a==='reviewLocation'?b.dataset.shift:null;page='gps';render();return;}
    if (a === "viewProblem" || a === "problemList") {
      selectedProblemId = a === "viewProblem" ? b.dataset.id : null;
      page = "incidents";
      render(); return;
    }
    if (a === "messageRecipient") {
      vault[draftKey()] ||= {};
      vault[draftKey()].recipient = b.dataset.value;
      delete vault[draftKey()].recipients;
      await persist();
      const picker = b.closest("details");
      picker.querySelector("summary span").textContent = b.textContent;
      picker.querySelectorAll("button").forEach(o => o.setAttribute("aria-pressed", String(o === b)));
      picker.open = false;
      updateReportSubmit(); return;
    }
    if (a === "inboxSort" || a === "inboxPrevious" || a === "inboxNext") {
      if (a === "inboxSort") {
        inboxOrder = b.dataset.value === "oldest" ? "oldest" : "newest"; inboxPage = 0;
        const picker = b.closest("details");
        picker.querySelector("summary span").textContent = b.textContent;
        picker.querySelectorAll("button").forEach(o => o.setAttribute("aria-pressed", String(o === b)));
        picker.open = false;
      } else inboxPage = Math.max(0, inboxPage + (a === "inboxNext" ? 1 : -1));
      updateSupervisorInbox(); return;
    }
    if (a === "readSupervisorMessage" || a === "supervisorInbox") {
      if (holding || recordingSaving || openingMicrophone) throw new Error("Finish recording first.");
      await saveDraftFromForm();
      supervisorMessageId = a === "readSupervisorMessage" ? b.dataset.id : null;
      render(); return;
    }
    if (a === "calendarMonth") {
      const month = new Date(b.dataset.month + "-01T12:00:00Z");
      month.setUTCMonth(month.getUTCMonth() + Number(b.dataset.step));
      if (month.toISOString().slice(0, 7) > new Date(Date.now() + 3600000).toISOString().slice(0, 7)) return;
      document.querySelector(".overview-calendar").innerHTML = overviewCalendar(month.toISOString().slice(0, 7), day);
      document.querySelector(`[data-action="calendarMonth"][data-step="${b.dataset.step}"]`).focus();
    } else if (a === "calendarDate") {
      if (b.dataset.date > new Date(Date.now() + 3600000).toISOString().slice(0, 10)) return;
      overviewDate = b.dataset.date; selectedOverviewShift = null; render();
    } else if (a === "attentionSort") {
      attentionOrder = b.dataset.order === "oldest" ? "oldest" : "newest"; attentionPage = 0; render();
    } else if (a === "attentionPrevious" || a === "attentionNext") {
      attentionPage = Math.max(0, attentionPage + (a === "attentionNext" ? 1 : -1)); render();
    } else if (a === "overviewToday") {
      overviewDate = null;
      selectedOverviewShift = null;
      render();
    } else if (a === "overviewShift") {
      if (b.getAttribute("aria-selected") === "true") return;
      selectedOverviewShift = b.dataset.shift;
      render();
    } else if (a === "openChat") {
      if (holding || recordingSaving || openingMicrophone)
        throw new Error("Finish recording first.");
      await saveDraftFromForm();
      const message = eventList().find((e) => e.id === b.dataset.messageId);
      if (user.role === "supervisor") supervisorMessageId = message?.id || null;
      selectedChat = b.dataset.chat || message?.payload.shift_id;
      page = "message";
      render();
    } else if (a === "viewShiftReport") {
      if (holding || recordingSaving || recorder?.state === "recording")
        throw new Error("Finish recording before opening a previous report.");
      await saveDraftFromForm();
      selectedReportId = b.dataset.id;
      page = "savedReport";
      render();
    } else if (a === "retryMessageMedia") {
      await sync();
      render();
    } else if (a === "retryReportMedia") {
      render();
    } else if (a === "choosePhoto") {
      $("#libraryPhoto").click();
    } else if (a === "takePhoto") {
      await openPhotoCamera();
    } else if (a === "capturePhoto") {
      await capturePhoto();
    } else if (a === "closePhoto") {
      closePhotoCamera();
    } else if (a === "selectCheckpoint") {
      scanStream?.getTracks().forEach((t) => t.stop());
      scanStream = null;
      nfcController?.abort();
      selectedCheckpoint =
        selectedCheckpoint === b.dataset.id ? null : b.dataset.id;
      render();
    } else if (a === "manualCode") {
      showManualCode();
    } else if (a === "cancelManual") {
      $("#manualDialog").close();
    } else if (a === "nfc") {
      await startNfc();
    } else if (a === "logout") {
      nfcController?.abort();
      scanStream?.getTracks().forEach((t) => t.stop());
      scanStream = null;
      if (holding || recordingSaving || recorder?.state === "recording")
        throw new Error(
          "Finish the recording and wait for playback before signing out.",
        );
      if (pending().length && !(await confirmAction("You have saved records waiting to upload. Signing out keeps them encrypted on this phone for your account. Are you sure you want to sign out?", "Sign out"))) return;
      signingOut = true;
      b.disabled = true;
      b.textContent = "Signing out…";
      while (busy) await new Promise((resolve) => setTimeout(resolve, 50));
      await saveDraftFromForm();
      await persist();
      try {
        await api("/api/logout", {});
      } catch {}
      stopRecording();
      window.speechSynthesis?.cancel();
      scanStream?.getTracks().forEach((t) => t.stop());
      scanStream = null;
      await lock();
      selectedChat = null;
      user = null;
      state = null;
      vault = { state: null, queue: [], draft: null };
      roundId = null;
      signingOut = false;
      login();
      toast(
        "Device locked. Unsynchronized work remains encrypted for your sign-in.",
      );
    } else if (a === "shift") {
      if (shift()) {
        page = "shift";
        render();
      } else {
        if (
          !(await confirmAction(
            "Are you sure you are ready to start your shift?",
            "Start shift",
          ))
        )
          return;
        b.disabled = true;
        await enqueue("start", {
          instructions: site().instructions,
          instruction_audio: site().instruction_audio,
        });
        page = "home";
        $("#toast").style.display = "none";
        $("#toast").textContent = "";
        render();
        await sync();
      }
    } else if (a === "sync") {
      await sync();
    } else if (a === "retryPending") {
      for (const q of pending()) if (["failed", "conflict"].includes(q.status)) q.status = "pending";
      await persist();
      await sync();
      render();
    } else if (a === "refresh") {
      await refresh();
      render();
    } else if (a === "listenReport") speak($("#report").value);
    else if (a === "transcribe") {
      await saveDraftFromForm();
      let fd = new FormData();
      fd.append(
        "file",
        await blobFrom(vault[draftKey()].audio),
        vault[draftKey()].audio.name,
      );
      b.disabled = true;
      let result = await api("/api/ai", fd);
      vault[draftKey()] = {
        ...vault[draftKey()],
        ...result,
        history: [
          ...(vault[draftKey()].history || []),
          {
            at: new Date().toISOString(),
            report: result.report,
            transcript: result.transcript,
          },
        ],
      };
      await persist();
      render();
    } else if (a === "camera") await startCamera();
    else if (a === "media") {
      let { url } = await api(`/api/media/${b.dataset.id}/link`);
      let el = document.createElement(
        b.dataset.mime.startsWith("audio") ? "audio" : "img",
      );
      el.src = url;
      if (el.tagName === "AUDIO") el.controls = true;
      else {
        el.className = "photo";
        el.alt = "Supporting incident photo";
      }
      b.after(el);
      b.remove();
    } else if (a === "ackNotification") {
      await api(`/api/notifications/${b.dataset.id}/acknowledge`, {});
      await refresh();
      render();
    } else if (a === "summary") {
      await api(`/api/summary/${siteId}/${day}`, {});
      await refresh();
      render();
    } else if (a === "source") {
      let record =
        state.events.find((e) => e.id === b.dataset.id) ||
        state.incidents.find((i) => i.id === b.dataset.id);
      let pre = document.createElement("pre");
      pre.style.whiteSpace = "pre-wrap";
      pre.style.overflowWrap = "anywhere";
      pre.textContent = JSON.stringify(record, null, 2);
      b.after(pre);
    } else if (a === "download") {
      let counts = await api(`/api/summary/${siteId}/${day}`),
        data = {
          site: site().name,
          dateUTC: day,
          counts,
          events: eventList().filter((e) => e.captured_at.slice(0, 10) === day),
          incidents: scopedIncidents().filter(
            (i) => i.captured_at.slice(0, 10) === day,
          ),
        },
        url = URL.createObjectURL(
          new Blob([JSON.stringify(data, null, 2)], {
            type: "application/json",
          }),
        ),
        link = document.createElement("a");
      link.href = url;
      link.download = `guard-patrol-${day}.json`;
      link.click();
      setTimeout(() => URL.revokeObjectURL(url), 1000);
    } else if (a === "qr") {
      let labels = await api("/api/qr/" + siteId);
      $("#dashboardPage").innerHTML =
        `<button data-page="admin" class="back">← Site management</button><button data-action="print">Print labels</button><div class="sheet">${labels.map((c) => `<article><h2>${esc(site().name)}</h2><h3>${esc(c.name)}</h3><img src="${c.image}" alt="Checkpoint QR"><p><code>${esc(c.code)}</code></p><small>Guard Patrol · ISDL</small></article>`).join("")}</div>`;
    } else if (a === "print") window.print();
  } catch (err) {
    signingOut = false;
    toast(err.message);
    b.disabled = false;
  }
});
window.addEventListener("online", () => {
  if (user) sync();
});
window.addEventListener("offline", () => {
  if (user && page === "home") render();
});
document.addEventListener("visibilitychange", () => {
  if (document.visibilityState === "visible" && user) sync();
});
if ("serviceWorker" in navigator)
  navigator.serviceWorker
    .register("/sw.js")
    .catch(() => toast("Offline app caching is unavailable in this browser."));

setInterval(() => {
  if (
    !user ||
    document.visibilityState !== "visible" ||
    !navigator.onLine ||
    [...document.querySelectorAll("audio")].some((a) => !a.paused)
  )
    return;
  if (
    user.role === "guard" &&
    ["home", "message"].includes(page) &&
    !document.activeElement?.matches("input,textarea,select")
  )
    sync();
  else if (
    user.role !== "guard" &&
    page === "home" &&
    !document.activeElement?.matches("input,textarea,select")
  )
    refresh()
      .then(() => {
        if (![...document.querySelectorAll("audio")].some((a) => !a.paused))
          render();
      })
      .catch(() => {});
}, 30000);

setInterval(() => {
  const timer = document.querySelector("#shiftTimer");
  if (timer) timer.textContent = elapsedShift(timer.dataset.started);
  updatePatrolReminder();
}, 1000);

function patrolScheduleForm() {
  return `<details><summary>Edit patrol schedule</summary><form id="patrolScheduleForm"><p>Daily Nigerian time. Repeating windows include the start and exclude the end; an end before the start continues overnight.</p><label class="label">Schedule type</label><select name="mode"><option value="times">Specific times</option><option value="interval">Repeat within a time window</option></select><label class="label">Specific times (comma separated)</label><input name="times" value="${esc(site().schedule)}" placeholder="06:00,12:00,18:00"><label class="label">Window starts</label><input name="start" type="time" value="06:00"><label class="label">Window ends</label><input name="end" type="time" value="18:00"><label class="label">Repeat every (minutes)</label><input name="interval" type="number" min="5" max="720" value="15"><p class="muted">Guards receive updates when connected. Reminder: five minutes before each patrol.</p><button class="primary">Save patrol schedule</button></form></details>`;
}
const remindedPatrols = new Set();
function updatePatrolReminder() {
  if (!user || user.role !== "guard" || !shift()) return;
  const next = nextPatrol(site().schedule, shift(), eventList());
  const label = document.querySelector("#patrolCountdown");
  const button = document.querySelector("#patrolButton");
  if (!next) {
    if (label) label.textContent = "No patrol scheduled";
    return;
  }
  const delta = next.remaining,
    due = delta <= 0;
  const seconds = Math.floor(Math.abs(delta) / 1000);
  const clock = [
    Math.floor(seconds / 3600),
    Math.floor(seconds / 60) % 60,
    seconds % 60,
  ]
    .map((v) => String(v).padStart(2, "0"))
    .join(":");
  if (label)
    label.textContent = due
      ? "Due now · " + clock + " overdue"
      : "Next patrol in " + clock;
  button?.classList.toggle("patrol-due", due);
  button?.classList.toggle("patrol-soon", !due && delta <= 300000);
  if (document.visibilityState !== "visible" || delta > 300000) return;
  const key = user.id + shift().id + next.iso + (due ? "due" : "soon");
  if (remindedPatrols.has(key)) return;
  remindedPatrols.add(key);
  const message = due
    ? "Your patrol is due. Tap Start patrol."
    : "Patrol in " + Math.ceil(delta / 60000) + " minutes.";
  toast(message);
  navigator.vibrate?.([250, 100, 250]);
  if ("Notification" in window && Notification.permission === "granted") {
    navigator.serviceWorker?.ready
      .then((reg) =>
        reg.showNotification("Guard Patrol", {
          body: message,
          tag: key,
          icon: "/icon-192.png",
        }),
      )
      .catch(() => {});
  }
}

function showManualCode() {
  if (!selectedCheckpoint) return toast("Select a checkpoint first.");
  document.querySelector("#manualDialog")?.remove();
  const dialog = document.createElement("dialog");
  dialog.id = "manualDialog";
  dialog.innerHTML =
    '<form id="scanForm"><h2>Enter label code</h2><label class="label" for="code">Checkpoint label code</label><input id="code" name="code" required autocomplete="off" placeholder="e.g. OAK-1"><button class="primary wide">Save code</button><button type="button" data-action="cancelManual" class="wide">Cancel</button></form>';
  root.append(dialog);
  dialog.showModal();
}
async function startNfc() {
  if (!selectedCheckpoint) return toast("Select a checkpoint first.");
  if (!("NDEFReader" in window))
    return toast(
      "NFC is unavailable on this phone or browser. Use QR or Unable to scan.",
    );
  nfcController?.abort();
  nfcController = new AbortController();
  try {
    const reader = new NDEFReader();
    await reader.scan({ signal: nfcController.signal });
    $("#scanStatus").textContent = "Hold your phone against the NFC tag";
    reader.onreadingerror = () =>
      toast("Could not read the tag. Try again or use QR.");
    reader.onreading = async ({ message }) => {
      const record = message.records.find((r) => r.recordType === "text");
      if (!record)
        return toast(
          "This tag has no checkpoint code. Use QR or contact your supervisor.",
        );
      try {
        await scan(
          new TextDecoder(record.encoding || "utf-8")
            .decode(record.data)
            .trim(),
          "nfc",
        );
        nfcController?.abort();
      } catch (e) {
        toast(e.message);
      }
    };
  } catch {
    toast("NFC permission or hardware unavailable. Use QR or Unable to scan.");
  }
}

function locationReview() {
  return user.role==='owner'?'<p>Property address and map position are managed in Site management.</p>':'';
}

function closePhotoCamera() {
  photoStream?.getTracks().forEach((t) => t.stop());
  photoStream = null;
  document.querySelector("#photoDialog")?.close();
  document.querySelector("#photoDialog")?.remove();
}
async function openPhotoCamera() {
  await saveDraftFromForm();
  if ((vault[draftKey()]?.photos || []).length >= 4)
    return toast("Up to four photos per report.");
  closePhotoCamera();
  const dialog = document.createElement("dialog");
  dialog.id = "photoDialog";
  dialog.innerHTML =
    '<h2>Take a photo</h2><p id="photoStatus" role="status">Opening camera…</p><video id="photoPreview" autoplay muted playsinline></video><div class="photo-dialog-actions"><button class="primary" data-action="capturePhoto" disabled>Capture photo</button><button data-action="closePhoto">Cancel</button></div>';
  root.append(dialog);
  dialog.addEventListener("cancel", (e) => {
    e.preventDefault();
    closePhotoCamera();
  });
  dialog.showModal();
  try {
    const stream = await navigator.mediaDevices.getUserMedia({
      video: { facingMode: { ideal: "environment" } },
      audio: false,
    });
    if (!dialog.isConnected) {
      stream.getTracks().forEach((t) => t.stop());
      return;
    }
    photoStream = stream;
    const video = dialog.querySelector("video");
    video.srcObject = stream;
    await video.play();
    dialog.querySelector("[data-action=capturePhoto]").disabled = false;
    dialog.querySelector("#photoStatus").textContent =
      "Frame the photo, then tap Capture photo.";
  } catch {
    if (dialog.isConnected) {
      dialog.querySelector("#photoStatus").textContent =
        "Camera unavailable. Close this window and use Choose a photo.";
      photoStream?.getTracks().forEach((t) => t.stop());
      photoStream = null;
    }
  }
}
async function capturePhoto() {
  const video = document.querySelector("#photoPreview");
  if (!video?.videoWidth)
    return toast("Camera is not ready. Please try again.");
  const canvas = document.createElement("canvas"),
    scale = Math.min(1, 1600 / video.videoWidth);
  canvas.width = Math.round(video.videoWidth * scale);
  canvas.height = Math.round(video.videoHeight * scale);
  canvas.getContext("2d").drawImage(video, 0, 0, canvas.width, canvas.height);
  const blob = await new Promise((resolve) =>
    canvas.toBlob(resolve, "image/jpeg", 0.85),
  );
  if (!blob) throw new Error("Could not capture the photo. Try again.");
  const media = await fileData(blob);
  media.name = "checkpoint-photo.jpg";
  media.source = "camera capture";
  vault[draftKey()].photos ||= [];
  if (vault[draftKey()].photos.length >= 4)
    throw new Error("Up to four photos per report.");
  vault[draftKey()].photos.push(media);
  await persist();
  closePhotoCamera();
  render();
}

function confirmAction(question, action, ending = false) {
  return new Promise((resolve) => {
    const dialog = document.createElement("dialog");
    dialog.id = "confirmationDialog";
    dialog.className = "confirmation-dialog";
    dialog.setAttribute("role", "alertdialog");
    dialog.setAttribute("aria-labelledby", "confirmationTitle");
    dialog.innerHTML = `<h2 id="confirmationTitle">${esc(question)}</h2><div class="confirmation-actions"><button type="button" data-confirm="cancel" autofocus>Cancel</button><button type="button" data-confirm="accept" class="primary ${ending ? "end-confirm" : ""}">${esc(action)}</button></div>`;
    document.body.append(dialog);
    let accepted = false;
    dialog.querySelector("[data-confirm=cancel]").onclick = () =>
      dialog.close();
    dialog.querySelector("[data-confirm=accept]").onclick = () => {
      accepted = true;
      dialog.close();
    };
    dialog.addEventListener(
      "close",
      () => {
        dialog.remove();
        resolve(accepted);
      },
      { once: true },
    );
    dialog.showModal();
  });
}

function updateReportSubmit() {
  const button = document.querySelector("#submitReport");
  if (!button) return;
  const text = document.querySelector("#report")?.value || "";
  button.disabled =
    reportSubmitting ||
    openingMicrophone ||
    holding ||
    recordingSaving ||
    recorder?.state === "recording" ||
    (page === "message" && user.role === "supervisor" && !messageRecipients().some(t => t.key === vault[draftKey()]?.recipient)) ||
    (!text.trim() && !vault[draftKey()]?.audio);
}

function shiftReports() {
  const current = shift();
  if (!current) return [];
  return eventList()
    .filter(
      (e) =>
        e.kind === "incident" &&
        e.payload.shift_id === current.id &&
        (!e.user_id || e.user_id === user.id),
    )
    .sort((a, b) => b.captured_at.localeCompare(a.captured_at));
}
function reportDateTime(value) {
  return new Date(value).toLocaleString("en-GB", {
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });
}
function shiftReportList() {
  const records = shiftReports();
  if (!records.length) return '<p class="muted">No reports this shift yet.</p>';
  return records
    .map(
      (e) =>
        `<button type="button" class="shift-report-entry" data-action="viewShiftReport" data-id="${e.id}">Reported On ${esc(reportDateTime(e.captured_at))}</button>`,
    )
    .join("");
}
function renderSavedReport(target) {
  const event = shiftReports().find((e) => e.id === selectedReportId);
  if (!event) {
    target.innerHTML =
      '<section class="card"><h2>Report unavailable</h2></section>';
    return;
  }
  const queued = vault.queue.find((q) => q.id === event.id),
    incident = state.incidents.find((i) => i.id === event.id);
  const media = new Map((incident?.media || []).map((m) => [m.id, m]));
  for (const m of queued?.media || []) media.set(m.id, m);
  const audioOnly =
    event.payload.report_format === "audio" ||
    event.payload.report === "Voice report — listen to the attached recording.";
  const written =
    event.payload.typed_report ?? (audioOnly ? "" : event.payload.report || "");
  const author =
    state.users.find((u) => u.id === event.user_id)?.name || user.name;
  const reportedOn = reportDateTime(event.captured_at);
  const hasPhotos = [...media.values()].some((m) => m.mime.startsWith("image"));
  target.innerHTML = `<section class="card saved-report"><h2 class="report-datetime">Reported On ${esc(reportedOn)}</h2><p>Reported by ${esc(author)}</p><div id="savedReportAudio"></div><textarea id="savedReportText" aria-label="Report text" readonly>${esc(written)}</textarea><div id="savedReportPhotos">${hasPhotos ? "" : '<p class="muted">No Images Attached</p>'}</div></section>`;
  const host = target.querySelector(".saved-report");
  for (const m of media.values()) {
    const isAudio = m.mime.startsWith("audio"),
      group = host.querySelector(
        isAudio ? "#savedReportAudio" : "#savedReportPhotos",
      );
    const frame = document.createElement("div");
    frame.className = "saved-attachment";
    group.append(frame);
    const el = document.createElement(isAudio ? "audio" : "img");
    if (isAudio) {
      el.controls = true;
      el.preload = "metadata";
      el.setAttribute("aria-label", "Report recording");
    } else {
      el.className = "photo";
      el.alt = "Uploaded report photo";
    }
    const status = document.createElement("p");
    status.className = "muted";
    status.textContent = isAudio ? "Loading recording…" : "Loading photo…";
    frame.append(el, status);
    const fail = () => {
      if (!frame.isConnected) return;
      status.textContent =
        "This attachment is unavailable. Connect to the internet and try again.";
      if (!frame.querySelector("button")) {
        const retry = document.createElement("button");
        retry.textContent = "Retry attachment";
        retry.dataset.action = "retryReportMedia";
        frame.append(retry);
      }
    };
    el.addEventListener(
      isAudio ? "loadedmetadata" : "load",
      () => status.remove(),
      { once: true },
    );
    el.addEventListener("error", fail, { once: true });
    (async () => {
      let url;
      if (m.data) {
        url = URL.createObjectURL(await blobFrom(m));
        if (!host.isConnected) {
          URL.revokeObjectURL(url);
          return;
        }
        reportMediaUrls.push(url);
      } else {
        ({ url } = await api("/api/media/" + m.id + "/link"));
      }
      if (host.isConnected) el.src = url;
    })().catch(fail);
  }
}

function loadMessageMedia() {
  for (const host of document.querySelectorAll("[data-message-media]")) {
    if (host.dataset.loaded) return;
    host.dataset.loaded = "true";
    const event = eventList().find((e) => e.id === host.dataset.messageMedia);
    if (!event || event.kind !== "message") continue;
    const queued = vault.queue.find((q) => q.id === event.id);
    const media = new Map((event.media || []).map((m) => [m.id, m]));
    for (const m of queued?.media || []) media.set(m.id, m);
    if ((event.payload.attachment_count || 0) > (event.media || []).length) {
      const status = document.createElement("p");
      status.className = "muted";
      status.textContent =
        queued?.status === "failed"
          ? "Attachments waiting to upload. Retry when connected."
          : "Attachments may still be uploading.";
      host.append(status);
      if (queued?.status === "failed") {
        const retry = document.createElement("button");
        retry.dataset.action = "retryMessageMedia";
        retry.textContent = "Retry upload";
        host.append(retry);
      }
    }
    for (const m of media.values()) {
      const el = document.createElement(
        m.mime.startsWith("audio/") ? "audio" : "img",
      );
      if (el.tagName === "AUDIO") {
        el.controls = true;
        el.preload = "metadata";
        el.setAttribute("aria-label", "Message recording");
      } else {
        el.className = "photo";
        el.alt = "Message attachment";
      }
      host.append(el);
      const fail = () => {
        if (!host.isConnected || el.dataset.failed) return;
        el.dataset.failed = "true";
        const retry = document.createElement("button");
        retry.dataset.action = "retryMessageMedia";
        retry.textContent = "Attachment unavailable · retry";
        host.append(retry);
      };
      el.onerror = fail;
      (async () => {
        let url;
        if (m.data) {
          url = URL.createObjectURL(await blobFrom(m));
          if (!host.isConnected) {
            URL.revokeObjectURL(url);
            return;
          }
          reportMediaUrls.push(url);
        } else ({ url } = await api("/api/media/" + m.id + "/link"));
        if (host.isConnected) el.src = url;
      })().catch(fail);
    }
  }
}

setInterval(() => {
  if (
    user &&
    (page === "message" ||
      (["guard", "supervisor"].includes(user.role) && page === "home")) &&
    navigator.onLine &&
    document.visibilityState === "visible" &&
    !holding &&
    !recordingSaving &&
    !openingMicrophone
  )
    sync();
}, 5000);

function unreadMessageCount() {
  if (!state.features?.messaging) return 0;
  const current = shift();
  if (user.role === "supervisor") {
    const incoming = new Set(
      eventList()
        .filter((e) => e.kind === "message" && e.user_id !== user.id)
        .map((e) => e.id),
    );
    return (state.notifications || []).filter(
      (n) =>
        n.site_id === siteId &&
        incoming.has(n.event_id) &&
        n.status === "submitted" &&
        !vault.readMessages?.[n.id],
    ).length;
  }
  if (!current || user.role !== "guard") return 0;
  const incoming = new Set(
    eventList()
      .filter(
        (e) =>
          e.kind === "message" &&
          e.payload.shift_id === current.id &&
          e.user_id &&
          e.user_id !== user.id,
      )
      .map((e) => e.id),
  );
  return (state.notifications || []).filter(
    (n) =>
      incoming.has(n.event_id) &&
      n.status === "submitted" &&
      !vault.readMessages?.[n.id],
  ).length;
}
let sendingReadReceipts = false;
async function flushReadReceipts() {
  if (!navigator.onLine || sendingReadReceipts || !state) return;
  sendingReadReceipts = true;
  try {
    for (const n of state.notifications || [])
      if (vault.readMessages?.[n.id] && n.status === "submitted") {
        try {
          await api("/api/notifications/" + n.id + "/delivered", {});
          n.status = "delivered";
        } catch {}
      }
  } finally {
    sendingReadReceipts = false;
  }
}
function markConversationRead(messages) {
  if (document.visibilityState !== "visible") return;
  vault.readMessages ||= {};
  let changed = false;
  for (const n of state.notifications || [])
    if (
      messages.some((e) => e.id === n.event_id) &&
      n.status === "submitted" &&
      !vault.readMessages[n.id]
    ) {
      vault.readMessages[n.id] = true;
      changed = true;
    }
  if (changed)
    persist().catch(() => toast("Unable to save read status on this phone."));
  flushReadReceipts()
    .then(() => persist())
    .catch(() => {});
}

async function initialize() {
  root.innerHTML =
    '<main class="login"><p role="status">Restoring your session…</p></main>';
  try {
    const restored = await restore();
    if (!restored) {
      // The marketing page can open signup without changing installed-app startup.
      if (new URLSearchParams(location.search).get("signup") === "1") {
        const entryUrl = new URL(location.href);
        entryUrl.searchParams.delete("signup");
        history.replaceState(null, "", entryUrl.pathname + entryUrl.search + entryUrl.hash);
        await beginSignup();
        return;
      }
      if (restoreSignupDraft()) {
        login();
        return;
      }
      login();
      return;
    }
    vault = restored.value;
    state = vault.state;
    user = state.user;
    roundId = vault.roundId || null;
    slot = vault.slot || null;
    siteId = restored.view.siteId;
    selectedChat = restored.view.selectedChat || null;
    selectedReportId = restored.view.selectedReportId || null;
    const allowed =
      user.role === "guard"
        ? [
            "home",
            "report",
            "message",
            "round",
            "instructions",
            "shift",
            "savedReport",
          ]
        : [
            "home",
            "incidents",
            "summaries",
            "message",
            "instructionSetup",
            "admin",
            "patrols",
            "setup",
            "property",
            "supervisors",
            "subscription",
            "gps",
            "ownerActivity",
            "ownerProblems",
          ];
    page = allowed.includes(restored.view.page) ? restored.view.page : "home";
    if (navigator.onLine) {
      try {
        await refresh();
      } catch (e) {
        if (e.status === 401 || e.status === 403) throw e;
        toast("Connection unavailable. Showing saved information.");
      }
    }
    siteId = state.sites.some((s) => s.id === siteId)
      ? siteId
      : state.sites[0]?.id;
    render();
    await sync();
  } catch {
    await lock(false);
    user = null;
    state = null;
    vault = { state: null, queue: [], draft: null };
    login();
    toast("Please sign in again. Saved work is still on this phone.");
  }
}
window.addEventListener("storage", async (e) => {
  if (e.key !== EPOCH || !user) return;
  // A sign-out or another account sign-in also invalidates restored tabs.
  try {
    if (recorder?.state === "recording") stopRecording();
    for (let n = 0; n < 80 && recordingSaving; n++)
      await new Promise((r) => setTimeout(r, 50));
    await saveDraftFromForm();
    await persist();
  } catch {}
  stream?.getTracks().forEach((t) => t.stop());
  closePhotoCamera();
  await lock(false);
  user = null;
  state = null;
  vault = { state: null, queue: [], draft: null };
  login();
});
initialize();

// Keep the default icon visible when a private profile photo cannot load.
document.addEventListener("error", e => { if (e.target.matches?.(".guard-thumbnail img")) e.target.remove(); }, true);
