import { test, before, after } from "node:test";
import assert from "node:assert/strict";
import { spawn } from "node:child_process";
import { randomUUID } from "node:crypto";
import { chromium } from "@playwright/test";
import path from "node:path";
const base = "http://127.0.0.1:3109",
  data = path.resolve("data/settings-test-" + Date.now());
let server, supervisor, guard, other;
async function request(route, cookie, body, status = 200) {
  const r = await fetch(base + route, {
    method: body ? "POST" : "GET",
    headers: {
      ...(cookie ? { cookie, "X-Session-Proof": cookie.split("=")[1] } : {}),
      ...(body ? { "Content-Type": "application/json" } : {}),
    },
    body: body ? JSON.stringify(body) : undefined,
  });
  const result = await r.json();
  assert.equal(r.status, status, JSON.stringify(result));
  return result;
}
async function formRequest(route, cookie, form, status = 200) {
  const r = await fetch(base + route, {
    method: "POST",
    headers: cookie
      ? { cookie, "X-Session-Proof": cookie.split("=")[1] }
      : {},
    body: form,
  });
  const result = await r.json();
  assert.equal(r.status, status, JSON.stringify(result));
  return result;
}
async function login(email) {
  const r = await fetch(base + "/api/login", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ email, password: "Pilot-only-2026!" }),
  });
  assert.equal(r.status, 200);
  return r.headers.get("set-cookie").split(";")[0];
}
before(async () => {
  server = spawn(process.execPath, ["server.js"], {
    env: {
      ...process.env,
      PORT: "3109",
      DATA_DIR: data,
      DATABASE_URL: "",
      VERCEL: "",
      BLOB_READ_WRITE_TOKEN: "",
      ENABLE_MESSAGING: "false",
    },
    stdio: "pipe",
  });
  await new Promise((resolve, reject) => {
    server.stdout.on("data", (d) => {
      if (String(d).includes("running")) resolve();
    });
    server.stderr.on("data", (d) => {
      if (String(d).includes("Error")) reject(Error(String(d)));
    });
    server.on("exit", (c) => reject(Error("Server exit " + c)));
  });
  [supervisor, guard, other] = await Promise.all(
    ["supervisor", "bala", "other"].map((n) => login(n + "@demo.isdl")),
  );
});
after(() => server?.kill());
test("settings protect scope and preserve shift versions used by guard starts", async () => {
  const initial = await request("/api/settings/oak", supervisor);
  assert.ok(initial.shifts.length);
  await request("/api/settings/oak", guard, null, 403);
  await request("/api/settings/oak", other, null, 403);
  const time = new Date(Date.now() + 3600000).toISOString().slice(11, 16);
  const shift = {
    template_id: "daily",
    name: "Daily shift",
    start_time: "00:00",
    end_time: "00:00",
    schedule: time,
    instructions: "Check the back gate before patrol.",
    guard_ids: ["bala"],
  };
  await request("/api/settings/oak/shifts", supervisor, { shifts: [] }, 400);
  await request(
    "/api/settings/oak/shifts",
    supervisor,
    { shifts: [{ ...shift, guard_ids: ["other"] }] },
    400,
  );
  await request(
    "/api/settings/oak/shifts",
    supervisor,
    { shifts: [shift, { ...shift, template_id: "overlap" }] },
    400,
  );
  await request("/api/settings/oak/shifts", supervisor, { shifts: [shift] });
  const id = randomUUID();
  await request("/api/events", guard, {
    id,
    site_id: "oak",
    kind: "start",
    captured_at: new Date().toISOString(),
    payload: {},
  });
  let state = await request("/api/state", guard);
  assert.equal(
    state.events.find((e) => e.id === id).payload.patrol_schedule,
    time,
  );
  assert.match(
    state.events.find((e) => e.id === id).payload.instructions,
    /back gate before patrol/,
  );
  const version = state.events.find((e) => e.id === id).payload.instructions;
  const versionId = state.events.find((e) => e.id === id).payload.shift_plan_version_id;
  await request("/api/settings/oak/shifts", supervisor, {
    shifts: [{ ...shift, instructions: "New instructions" }],
  });
  state = await request("/api/state", guard);
  assert.equal(
    state.events.find((e) => e.id === id).payload.instructions,
    version,
  );
  assert.equal(
    state.shiftPlans.find((p) => p.template_id).instructions,
    "New instructions",
  );
  await request("/api/events", guard, {
    id: randomUUID(),
    site_id: "oak",
    kind: "end",
    captured_at: new Date().toISOString(),
    payload: { shift_id: id, note: "Complete" },
  });
  await request("/api/events",guard,{id:randomUUID(),site_id:"oak",kind:"start",captured_at:new Date().toISOString(),payload:{shift_plan_version_id:"not-authorized"}},403);
  const offlineId=randomUUID();
  await request("/api/events",guard,{id:offlineId,site_id:"oak",kind:"start",captured_at:new Date().toISOString(),payload:{shift_plan_version_id:versionId}});
  const restored=(await request("/api/state",guard)).events.find(e=>e.id===offlineId);
  assert.equal(restored.payload.instructions,version,"Queued starts retain the referenced instructions after settings change");
  await request("/api/events",guard,{id:randomUUID(),site_id:"oak",kind:"end",captured_at:new Date().toISOString(),payload:{shift_id:offlineId,note:"Complete"}});
});
test("supervisor voice instructions publish privately and guards retain shift audio versions", async () => {
  await request("/api/instructions/oak", guard, { instructions: "no" }, 403);
  await request("/api/instructions/oak", other, { instructions: "no" }, 403);
  const form = new FormData();
  form.set("instructions", "Listen to the recorded gate instructions.");
  form.set(
    "file",
    new Blob([Buffer.from([0x1a, 0x45, 0xdf, 0xa3, 0x00])], {
      type: "audio/webm",
    }),
    "instructions.webm",
  );
  const published = await formRequest("/api/instructions/oak", supervisor, form);
  assert.ok(published.id);
  let state = await request("/api/state", guard);
  assert.equal(state.sites.find((s) => s.id === "oak").instruction_audio, published.id);
  assert.equal(
    state.sites.find((s) => s.id === "oak").instructions,
    "Listen to the recorded gate instructions.",
  );
  const { url } = await request(
    "/api/instructions/" + published.id + "/link",
    guard,
  );
  assert.match(url, /^\/media\/instructions\//);
  await request("/api/instructions/" + published.id + "/link", other, null, 403);
  assert.equal(
    (await fetch(base + url, { headers: { cookie: other } })).status,
    403,
  );
  assert.equal(
    (
      await fetch(base + url.replace(/expires=\d+/, "expires=0"), {
        headers: { cookie: guard },
      })
    ).status,
    403,
  );
  const startId = randomUUID();
  await request("/api/events", guard, {
    id: startId,
    site_id: "oak",
    kind: "start",
    captured_at: new Date().toISOString(),
    payload: {},
  });
  await request("/api/instructions/oak", supervisor, {
    instructions: "Future shifts use text only.",
  });
  state = await request("/api/state", guard);
  assert.equal(
    state.events.find((e) => e.id === startId).payload.instruction_audio,
    published.id,
  );
  assert.equal(
    state.sites.find((s) => s.id === "oak").instruction_audio,
    null,
  );
  assert.equal(
    state.sites.find((s) => s.id === "oak").instructions,
    "Future shifts use text only.",
  );
  await request("/api/events", guard, {
    id: randomUUID(),
    site_id: "oak",
    kind: "end",
    captured_at: new Date().toISOString(),
    payload: { shift_id: startId, note: "Complete" },
  });
});
test("shift-level voice instructions are saved with the selected shift", async () => {
  const form = new FormData();
  form.set(
    "file",
    new Blob([Buffer.from([0x1a, 0x45, 0xdf, 0xa3, 0x00])], {
      type: "audio/webm",
    }),
    "shift-instructions.webm",
  );
  const uploaded = await formRequest(
    "/api/settings/oak/shift-audio",
    supervisor,
    form,
  );
  assert.ok(uploaded.id);
  let settings = await request("/api/settings/oak", supervisor);
  const shift = {
    ...settings.shifts[0],
    instructions: "Use the recorded instructions for this shift.",
    instruction_audio: uploaded.id,
    guard_ids: ["bala"],
  };
  await request("/api/settings/oak/shifts", supervisor, {
    shifts: [
      shift,
      ...settings.shifts
        .slice(1)
        .map((s) => ({ ...s, guard_ids: s.guard_ids.filter((g) => g !== "bala") })),
    ],
  });
  let guardState = await request("/api/state", guard);
  for (const s of guardState.shifts.filter((s) => !s.ended_at))
    await request("/api/events", guard, {
      id: randomUUID(),
      site_id: "oak",
      kind: "end",
      captured_at: new Date().toISOString(),
      payload: { shift_id: s.id, note: "Complete" },
    });
  const startId = randomUUID();
  await request("/api/events", guard, {
    id: startId,
    site_id: "oak",
    kind: "start",
    captured_at: new Date().toISOString(),
    payload: {},
  });
  guardState = await request("/api/state", guard);
  assert.equal(
    guardState.events.find((e) => e.id === startId).payload.instruction_audio,
    uploaded.id,
  );
  settings = await request("/api/settings/oak", supervisor);
  await request("/api/settings/oak/shifts", supervisor, {
    shifts: settings.shifts.map((s) =>
      s.template_id === shift.template_id
        ? { ...s, instructions: "Typed instructions only.", instruction_audio: "" }
        : s,
    ),
  });
  guardState = await request("/api/state", guard);
  assert.equal(
    guardState.events.find((e) => e.id === startId).payload.instruction_audio,
    uploaded.id,
  );
  await request("/api/events", guard, {
    id: randomUUID(),
    site_id: "oak",
    kind: "end",
    captured_at: new Date().toISOString(),
    payload: { shift_id: startId, note: "Complete" },
  });
});
test("supervisors edit and deactivate peers, while owners and other customers stay protected", async () => {
  const email = "settings-peer@demo.isdl";
  await request("/api/admin", supervisor, {
    kind: "user",
    site_id: "oak",
    role: "supervisor",
    name: "Peer",
    email,
    password: "Pilot-only-2026!",
  });
  const peer = (await request("/api/settings/oak", supervisor)).users.find(
    (u) => u.email === email,
  );
  const cookie = await login(email);
  const edit = {
    kind: "update_user",
    site_id: "oak",
    user_id: peer.id,
    name: "Updated peer",
    email,
    role: "supervisor",
    disabled: "false",
  };
  await request("/api/admin", other, edit, 403);
  await request("/api/admin", supervisor, { ...edit, user_id: "owner" }, 403);
  await request("/api/admin", supervisor, { ...edit, role: "owner" }, 403);
  await request("/api/admin", supervisor, edit);
  assert.equal((await request("/api/state", cookie)).user.name, "Updated peer");
  await request("/api/admin", supervisor, { ...edit, disabled: "true" });
  await request("/api/state", cookie, null, 401);
  await request(
    "/api/login",
    null,
    { email, password: "Pilot-only-2026!" },
    401,
  );
  assert.ok(
    (await request("/api/settings/oak", supervisor)).users.find(
      (u) => u.id === peer.id,
    ).disabled,
  );
});
test("settings tabs fit phone and desktop; checkpoint editing and QR labels work", async () => {
  for(let i=0;i<4;i++) await request('/api/admin',supervisor,{kind:'user',site_id:'oak',name:'Team test '+i,role:'guard',email:`team-list-${i}@demo.isdl`,password:'Pilot-only-2026!'});
  const browser = await chromium.launch({
    executablePath: "C:/Program Files/Google/Chrome/Application/chrome.exe",
    headless: true,
  });
  try {
    for (const width of [360, 1440]) {
      const context = await browser.newContext({
          viewport: { width, height: 900 },
        }),
        p = await context.newPage(),
        errors = [];
      p.on("pageerror", (e) => errors.push(e.message));
      await p.goto(base);
      await p.locator("#email").fill("supervisor@demo.isdl");
      await p.locator("#password").fill("Pilot-only-2026!");
      await p.getByRole("button", { name: "Sign in", exact: true }).click();
      await p.locator('[data-page="setup"]').click();
      await p.locator('.shifts-panel').waitFor();
      assert.equal(await p.locator('#settings-shifts').count(),0);
      await p.locator('[data-edit-shift]').first().click();
      const save=p.getByRole("button",{name:"Save changes",exact:true});
      assert.equal(await save.isDisabled(),true);
      const nameField=p.locator('[data-shift="0"] input[name="name"]');
      const originalName=await nameField.inputValue();
      await nameField.fill(originalName+" edited");
      assert.equal(await save.isEnabled(),true);
      await nameField.fill(originalName);
      assert.equal(await save.isDisabled(),true);
      const assigned=p.locator('[data-shift="0"] input[name="guard"]:not([value="*"])').first();
      const wasChecked=await assigned.isChecked();
      await assigned.setChecked(!wasChecked);
      assert.equal(await save.isEnabled(),true);
      await assigned.setChecked(wasChecked);
      assert.equal(await save.isDisabled(),true);
      const any=p.locator('[data-shift="0"] input[value="*"]');
      await any.check();
      assert.equal(await assigned.isChecked(),false);
      await assigned.check();
      assert.equal(await any.isChecked(),false);
      await assigned.setChecked(wasChecked);
      await p.locator('#shift-cancel').click();
      const shiftCount=await p.locator('[data-edit-shift]').count();
      await p.locator('#add-shift').click();
      assert.equal(await p.locator('#save-shifts').isDisabled(),true);
      await nameField.fill('New shift draft');
      assert.equal(await p.locator('#save-shifts').isEnabled(),true);
      await p.locator('#shift-cancel').click();
      assert.equal(await p.locator('[data-edit-shift]').count(),shiftCount);
      await p.locator('[data-edit-shift]').first().click();
      assert.equal(await save.isDisabled(),true);
      await nameField.fill(originalName+" updated");
      await save.click();
      await p.locator('[data-edit-shift]').first().waitFor();
      await p.locator('[data-edit-shift]').first().click();
      assert.equal(await nameField.inputValue(),originalName+" updated");
      assert.equal(
        await p.locator('[data-tab="shifts"]').getAttribute("aria-selected"),
        "true",
      );
      for (const tab of ["checkpoints", "team", "shifts"]) {
        await p.locator(`[data-tab="${tab}"]`).click();
        assert.equal(
          await p.locator(`[data-tab="${tab}"]`).getAttribute("aria-selected"),
          "true",
        );
        assert.ok(
          await p.evaluate(
            () => document.documentElement.scrollWidth <= innerWidth,
          ),
        );
        if(tab==='team') {
          assert.equal(await p.locator('[data-member]').count(),5);
          await p.locator('#team-next').click();
          assert.ok(await p.locator('[data-member]').count()>0);
          await p.locator('#team-search').fill('Team test 0');
          assert.equal(await p.locator('[data-member]').count(),1);
          await p.locator('[data-member]').click();
          assert.equal(await p.locator('#team-save').isDisabled(),true);
          await p.locator('#team-editor input[name="whatsapp"]').fill('08022345678');
          assert.equal(await p.locator('#team-save').isEnabled(),true);
          await p.locator('#team-cancel').click();
          if(width===360) {
            await p.locator('#add-member').click();
            await p.locator('#team-editor input[name="name"]').fill('Mobile phone guard');
            await p.locator('#team-editor input[name="whatsapp"]').fill('08032345678');
            await p.locator('#team-editor input[name="password"]').fill('Pilot-only-2026!');
            await p.locator('#team-save').click();await p.locator('#team-search').waitFor();
            await p.locator('#team-search').fill('+2348032345678');
            await p.getByRole('button',{name:'Edit Mobile phone guard',exact:true}).waitFor();
            await p.locator('#team-search').fill('');
          }
        }
        if (tab === "checkpoints") {
          assert.equal(await p.locator('#checkpoint-editor').count(),0);
          await p.evaluate(()=>{window.print=()=>{window.testPrintCalls=(window.testPrintCalls||0)+1;};});
          const expectedLabels=await request('/api/qr/oak',supervisor);
          await p.locator('#print-checkpoints').click();
          await p.waitForFunction(()=>document.querySelector('#qr-print-now')?.disabled===false);
          assert.equal(await p.locator('#qr-print-preview article').count(),expectedLabels.length);
          assert.deepEqual(await p.locator('#qr-print-preview code').allTextContents(),expectedLabels.map(c=>c.code));
          await p.emulateMedia({media:'print'});
          assert.equal(await p.locator('#qr-print-preview article').first().isVisible(),true);
          assert.equal(await p.locator('.qr-preview-toolbar').isVisible(),false);
          if(width===360) {
            const pdf=await p.pdf({path:path.join(data,'checkpoint-labels.pdf'),format:'A4'});
            assert.ok(pdf.length>1000);
          }
          await p.emulateMedia({media:'screen'});
          await p.locator('#qr-print-now').click();
          assert.equal(await p.evaluate(()=>window.testPrintCalls),1);
          await p.locator('#qr-print-close').click();
          await p.locator('[data-checkpoint]').first().click();
          await p.locator('#print-one').click();
          await p.waitForFunction(()=>document.querySelector('#qr-print-now')?.disabled===false);
          assert.equal(await p.locator('#qr-print-preview article').count(),1);
          await p.locator('#qr-print-now').click();
          assert.equal(await p.evaluate(()=>window.testPrintCalls),2);
          await p.locator('#qr-print-close').click();
          assert.equal(await p.locator('#checkpoint-save').isDisabled(),true);
          await p.locator("[data-nfc]").first().click();
          await p.getByText(/NFC writing is unavailable/).waitFor();
          const form = p.locator("#checkpoint-editor");
          await form.locator("input").fill("Main entrance "+width);
          await form.getByRole("button", { name: "Save changes" }).click();
          await p.getByRole('button',{name:'Edit Main entrance '+width,exact:true}).waitFor();
          if(width===360) {
            for(const name of ['Side gate','Service entrance']) {
              await p.locator('#new-checkpoint').click();
              assert.equal(await p.locator('#checkpoint-save').isDisabled(),true);
              await p.locator('#checkpoint-editor input').fill(name);
              await p.locator('#checkpoint-save').click();
              await p.locator('#new-checkpoint').waitFor();
            }
            assert.equal(await p.locator('[data-checkpoint]').count(),5);
            await p.locator('#checkpoint-next').click();
            assert.equal(await p.locator('[data-checkpoint]').count(),1);
            await p.locator('#checkpoint-search').fill('Service');
            assert.equal(await p.locator('[data-checkpoint]').count(),1);
            await p.locator('[data-checkpoint]').click();
            await p.locator('#checkpoint-back').click();
            assert.equal(await p.locator('#checkpoint-search').inputValue(),'Service');
            await p.locator('#checkpoint-search').fill('no matching checkpoint');
            await p.getByText('No checkpoints match your search.',{exact:true}).waitFor();
            await p.locator('#checkpoint-search').fill('');
            await p.getByRole('button',{name:'Edit Side gate',exact:true}).click();
            await p.getByRole('button',{name:'Delete checkpoint',exact:true}).click();
            await p.locator('#keep-checkpoint').click();
            await p.getByRole('button',{name:'Delete checkpoint',exact:true}).click();
            await p.locator('#confirm-delete-checkpoint').click();
            await p.locator('#new-checkpoint').waitFor();
            assert.equal(await p.getByRole('button',{name:'Edit Side gate',exact:true}).count(),0);
          }
          const labels = await request("/api/qr/oak", supervisor);
          assert.ok(labels.every((c) => c.image.startsWith("data:image/png")));
        }
      }
      await p.screenshot({
        path: path.join(data, `settings-${width}.png`),
        fullPage: true,
      });
      await p.locator('[data-tab="team"]').click();
      await p.locator('.greeting-row [data-page="home"]').click();
      await p.locator('[data-page="setup"]').click();
      await p.locator(".shifts-panel").waitFor();
      assert.equal(
        await p.locator('[data-tab="shifts"]').getAttribute("aria-selected"),
        "true",
      );
      assert.deepEqual(errors, []);
      await context.close();
    }
  } finally {
    await browser.close();
  }
});
test("Any guard is exclusive, property-scoped, and does not invent attendance expectations",async()=>{
  const data=await request("/api/settings/oak",supervisor);
  const shifts=data.shifts.map(s=>({...s,guard_ids:["*"],schedule:"0900, 1500, 1800"}));
  await request("/api/settings/oak/shifts",supervisor,{shifts:[{...shifts[0],guard_ids:["*","bala"]}]},400);
  await request("/api/settings/oak/shifts",supervisor,{shifts});
  const state=await request("/api/state",guard);
  const plan=state.shiftPlans.find(p=>p.template_id);
  assert.deepEqual(JSON.parse(plan.guard_ids),["*"]);
  assert.equal(plan.schedule,"09:00,15:00,18:00");
  const {overviewShifts,supervisorStatus}=await import("../public/supervisor-status.js");
  const window=overviewShifts({site:state.sites[0],plans:state.shiftPlans})[0];
  assert.equal(window.anyGuard,true);
  assert.deepEqual(window.guardIds,[]);
  const kpi=supervisorStatus({site:state.sites[0],selectedShift:window,plans:state.shiftPlans});
  assert.equal(kpi[0].tone,"good");
  assert.equal(kpi[0].qualifier,"expected");
  assert.equal(kpi[0].value,"0 of 0");
  const email="any-guard@demo.isdl";
  await request("/api/admin",supervisor,{kind:"user",site_id:"oak",name:"Any guard test",email,password:"Pilot-only-2026!",role:"guard"});
  const newGuard=await login(email);
  const ownState=await request("/api/state",newGuard);
  assert.ok(ownState.shiftPlans.some(p=>p.id===plan.id));
  const id=crypto.randomUUID();
  const event={id,kind:"start",site_id:"oak",captured_at:new Date().toISOString(),payload:{shift_plan_version_id:plan.id}};
  await request("/api/events",newGuard,event);
  assert.equal((await request("/api/state",newGuard)).events.find(e=>e.id===id).payload.patrol_schedule,"09:00,15:00,18:00");
  const cp=ownState.checkpoints.find(c=>!c.retired_at);
  await request('/api/settings/oak/checkpoint/delete',other,{id:cp.id},403);
  await request('/api/settings/oak/checkpoint/delete',guard,{id:cp.id},403);
  await request('/api/settings/oak/checkpoint/delete',supervisor,{id:cp.id});
  await request('/api/settings/oak/checkpoint/delete',supervisor,{id:cp.id});
  const after=await request('/api/state',newGuard);
  assert.ok(after.checkpoints.find(c=>c.id===cp.id).retired_at);
  assert.ok(after.events.find(e=>e.id===id).payload.checkpoint_ids.includes(cp.id));
  const nextId=randomUUID();
  await request('/api/events',guard,{id:nextId,kind:'start',site_id:'oak',captured_at:new Date().toISOString(),payload:{}});
  assert.ok(!(await request('/api/state',guard)).events.find(e=>e.id===nextId).payload.checkpoint_ids.includes(cp.id));
  assert.ok(!(await request('/api/qr/oak',supervisor)).some(c=>c.id===cp.id));
  await request("/api/settings/oak",other,null,403);
});
test('phone-only team accounts can sign in; aliases preserve the same encrypted pending work',async()=>{
  const phone='08012345678',email='phone-alias@demo.isdl',password='Pilot-only-2026!';
  await request('/api/admin',supervisor,{kind:'user',site_id:'oak',name:'Phone guard',role:'guard',whatsapp:phone,email:'',password});
  let member=(await request('/api/settings/oak',supervisor)).users.find(u=>u.name==='Phone guard');
  assert.equal(member.email,'');assert.equal(member.whatsapp,'+2348012345678');
  const auth=await request('/api/login',null,{email:phone,password});
  await request('/api/admin',supervisor,{kind:'user',site_id:'oak',name:'Duplicate',role:'guard',whatsapp:'+234 801 234 5678',email:'',password},409);
  await request('/api/admin',supervisor,{kind:'user',site_id:'oak',name:'Invalid',role:'guard',whatsapp:'123',email:'',password},400);
  await request('/api/admin',supervisor,{kind:'update_user',site_id:'oak',user_id:member.id,name:member.name,role:'guard',whatsapp:phone,email,disabled:'false'});
  const emailAuth=await request('/api/login',null,{email,password});
  assert.equal(auth.vaultAccount,emailAuth.vaultAccount);
  const browser=await chromium.launch({executablePath:'C:/Program Files/Google/Chrome/Application/chrome.exe',headless:true});
  try {
    const context=await browser.newContext(),page=await context.newPage();await page.goto(base+'/icon.svg');
    await page.evaluate(async ({phone,email,key})=>{
      const vault=await import('/vault.js');window.testVault=vault;
      await vault.unlock(phone,'Pilot-only-2026!',key);
      await vault.save({queue:[{id:'pending-record'}]});
      const same=await vault.unlock(email,'Pilot-only-2026!',key);
      if(same.queue[0].id!=='pending-record')throw Error('Pending work lost');
    },{phone,email,key:auth.vaultAccount});
    await context.setOffline(true);
    assert.equal(await page.evaluate(async()=> (await window.testVault.unlock('+234 801 234 5678','Pilot-only-2026!')).queue[0].id),'pending-record');
    await context.setOffline(false);
    await page.goto(base);await page.locator('#email').fill(phone);await page.locator('#password').fill(password);await page.getByRole('button',{name:'Sign in',exact:true}).click();
    await page.getByRole('button',{name:'Sign out',exact:true}).waitFor();
    await context.close();
  } finally {await browser.close();}
});
