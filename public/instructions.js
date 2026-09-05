import { fileData, blobFrom } from "./vault.js";
let cleanup = () => {};
export function closeInstructions() {
  cleanup();
  cleanup = () => {};
}
export function instructionEditor(host, site, api, done, esc) {
  let recorder,
    stream,
    blob,
    url,
    stopped = false,
    timer;
  let keep = site.instruction_audio || "";
  host.innerHTML = `<section class="card"><h2>Shift instructions</h2><p>Use these instructions for future shifts until you publish an update. Active shifts keep their starting version.</p><button id="recordInstructions" class="primary wide" type="button">Record voice instructions</button><p id="instructionStatus" role="status"></p><audio id="instructionPreview" controls hidden aria-label="Instruction recording"></audio><button id="removeInstructionAudio" type="button">Use typed instructions only</button><form id="instructionEditor"><label class="label" for="instructionText">Typed instructions (optional)</label><textarea id="instructionText" maxlength="5000">${esc(site.instructions)}</textarea><button id="publishInstructions" class="primary wide">Publish instructions</button></form></section>`;
  const q = (s) => host.querySelector(s),
    status = q("#instructionStatus"),
    record = q("#recordInstructions"),
    publish = q("#publishInstructions"),
    player = q("audio");
  const preview = (b) => {
    if (url) URL.revokeObjectURL(url);
    url = URL.createObjectURL(b);
    player.src = url;
    player.hidden = false;
  };
  if (keep)
    api("/api/instructions/" + keep + "/link")
      .then(async ({ url }) => {
        if (url && !stopped) {
          const r = await fetch(url);
          if (!r.ok) throw Error("Recording unavailable");
          const b = await r.blob();
          if (!stopped) preview(b);
        }
      })
      .catch(() => {
        status.textContent =
          "Saved recording unavailable. Try again when connected.";
      });
  record.onclick = async () => {
    if (recorder?.state === "recording") {
      record.disabled = true;
      recorder.stop();
      return;
    }
    record.disabled = true;
    publish.disabled = true;
    try {
      if (!navigator.mediaDevices?.getUserMedia || !window.MediaRecorder)
        throw Error(
          "Microphone recording is unavailable. Type instructions instead.",
        );
      stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      if (stopped) {
        stream.getTracks().forEach((t) => t.stop());
        return;
      }
      const mime = ["audio/webm;codecs=opus", "audio/mp4", "audio/webm"].find(
        (m) => MediaRecorder.isTypeSupported(m),
      );
      recorder = new MediaRecorder(stream, mime ? { mimeType: mime } : {});
      const chunks = [];
      recorder.ondataavailable = (e) => {
        if (e.data.size) chunks.push(e.data);
      };
      recorder.onstop = () => {
        clearTimeout(timer);
        stream.getTracks().forEach((t) => t.stop());
        if (stopped) return;
        blob = new Blob(chunks, { type: recorder.mimeType });
        keep = "";
        preview(blob);
        record.disabled = false;
        publish.disabled = false;
        record.textContent = "Record again";
        record.classList.remove("recording");
        status.textContent = "Listen before publishing.";
      };
      recorder.start(250);
      record.textContent = "Tap to stop";
      record.classList.add("recording");
      status.textContent = "Recording… (up to 3 minutes)";
      setTimeout(() => {
        if (!stopped) record.disabled = false;
      }, 1200);
      timer = setTimeout(() => {
        if (recorder.state === "recording") recorder.stop();
      }, 180000);
    } catch (e) {
      stream?.getTracks().forEach((t) => t.stop());
      record.disabled = false;
      publish.disabled = false;
      status.textContent = e.message;
    }
  };
  q("#removeInstructionAudio").onclick = () => {
    if (recorder?.state === "recording") return;
    keep = "";
    blob = null;
    player.pause();
    player.removeAttribute("src");
    player.hidden = true;
    status.textContent = "Publish to use typed instructions only.";
  };
  q("form").onsubmit = async (e) => {
    e.preventDefault();
    e.stopPropagation();
    publish.disabled = true;
    try {
      const form = new FormData();
      form.set("instructions", q("textarea").value);
      if (blob) form.set("file", blob, "instructions");
      else if (keep) form.set("keep_audio", keep);
      await api("/api/instructions/" + site.id, form);
      await done();
    } catch (e) {
      status.textContent = e.message;
      publish.disabled = false;
    }
  };
  cleanup = () => {
    stopped = true;
    clearTimeout(timer);
    if (recorder?.state === "recording") recorder.stop();
    stream?.getTracks().forEach((t) => t.stop());
    player.pause();
    if (url) URL.revokeObjectURL(url);
  };
}
export async function cacheInstruction(id, vault, api) {
  if (!id) return null;
  vault.instructionAudio ||= {};
  if (Object.hasOwn(vault.instructionAudio, id))
    return vault.instructionAudio[id];
  const { url } = await api("/api/instructions/" + id + "/link");
  if (!url) {
    vault.instructionAudio[id] = null;
    return null;
  }
  const r = await fetch(url);
  if (!r.ok) throw Error("Recording unavailable");
  return (vault.instructionAudio[id] = await fileData(await r.blob()));
}
export async function instructionPlayer(host, id, vault, api, persist) {
  let url,
    closed = false;
  cleanup = () => {
    closed = true;
    host.querySelector("audio")?.pause();
    if (url) URL.revokeObjectURL(url);
  };
  try {
    const media = await cacheInstruction(id, vault, api);
    if (closed) return;
    if (!media) {
      host.remove();
      return;
    }
    url = URL.createObjectURL(await blobFrom(media));
    if (closed) {
      URL.revokeObjectURL(url);
      return;
    }
    host.innerHTML =
      '<audio controls aria-label="Play shift instructions"></audio>';
    host.querySelector("audio").src = url;
    await persist();
  } catch {
    if (!closed)
      host.innerHTML =
        "<p>Recording unavailable offline. Connect and reopen instructions to download it.</p>";
  }
}
