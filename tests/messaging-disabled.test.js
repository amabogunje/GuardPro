import { test } from "node:test";
import assert from "node:assert/strict";
import { spawn } from "node:child_process";
import fs from "node:fs";
import path from "node:path";
import { randomUUID } from "node:crypto";
import { chromium } from "@playwright/test";

test("MVP hides messaging for every role and rejects new messages", async () => {
  const data = path.resolve("data", "messaging-disabled-" + Date.now());
  fs.mkdirSync(data, { recursive: true });
  const server = spawn(process.execPath, ["server.js"], {
    env: {...process.env, PORT:"3106", DATA_DIR:data, DATABASE_URL:"", VERCEL:"", ENABLE_MESSAGING:"false", OPENAI_API_KEY:"", BLOB_READ_WRITE_TOKEN:""},
    stdio:"pipe",
  });
  let browser;
  try {
    await new Promise((resolve,reject) => {
      server.stdout.on("data",d=>{if(String(d).includes("running")) resolve();});
      server.once("exit",c=>reject(Error("Test server exited "+c)));
    });
    const base = "http://127.0.0.1:3106";
    browser = await chromium.launch({executablePath:process.env.CHROME_PATH || "C:/Program Files/Google/Chrome/Application/chrome.exe",headless:true});
    for (const role of ["bala","supervisor","owner"]) {
      const login = await fetch(base+"/api/login", {method:"POST",headers:{"Content-Type":"application/json"},body:JSON.stringify({email:role+"@demo.isdl",password:"Pilot-only-2026!"})});
      assert.equal(login.status,200);
      const auth = await login.json();
      const headers = {cookie:login.headers.get("set-cookie").split(";")[0],"X-Session-Proof":auth.proof,"Content-Type":"application/json"};
      const state = await (await fetch(base+"/api/state",{headers})).json();
      assert.equal(state.features.messaging,false);
      assert.equal("phone" in state.sites[0], false);
      const send = await fetch(base+"/api/events",{method:"POST",headers,body:JSON.stringify({id:randomUUID(),site_id:"oak",kind:"message",captured_at:new Date().toISOString(),payload:{text:"Disabled message"}})});
      assert.equal(send.status,403);
      if(role==="bala") {
        const start=await fetch(base+"/api/events",{method:"POST",headers,body:JSON.stringify({id:randomUUID(),site_id:"oak",kind:"start",captured_at:new Date().toISOString(),payload:{}})});
        assert.equal(start.status,200);
      }
      const ctx = await browser.newContext({viewport:{width:360,height:800}});
      const p = await ctx.newPage();
      await p.goto(base+"/app");
      await p.locator("#email").fill(role+"@demo.isdl");
      await p.locator("#password").fill("Pilot-only-2026!");
      await p.getByRole("button",{name:"Sign in",exact:true}).click();
      await p.locator(".guard").waitFor();
      assert.equal(await p.locator('[data-page="message"],[data-action="openChat"],.message-unread').count(),0);
      if(role==="supervisor") assert.equal(await p.locator(".supervisor-quick-start button").count(),3);
      if(role==="bala") {
        assert.equal(await p.locator(".actions > button").count(),3);
        assert.equal(await p.getByRole("button",{name:"Emergency",exact:true}).count(),0);
        assert.equal(await p.getByRole("link",{name:"Call supervisor",exact:true}).count(),0);
        await p.getByRole("button",{name:"Hear instructions",exact:true}).click();
        assert.equal(await p.locator('[data-page="message"]').count(),0);
      }
      assert.ok(await p.evaluate(()=>document.documentElement.scrollWidth<=innerWidth));
      for (const width of [360, 900, 1440]) {
        await p.setViewportSize({width,height:900});
        if (role === "bala") await p.locator('.greeting-row [data-page="home"]').click();
        const positions = async () => {
          // Wait for Material's first-frame decoration before measuring.
          await p.evaluate(() => new Promise(r => requestAnimationFrame(() => requestAnimationFrame(r))));
          return p.evaluate((owner) => {
            const selectors = owner
              ? [".guard .brand", ".guard .topbar [data-action=logout]", ".greeting-row h1"]
              : [".guard .brand", ".guard .topbar [data-action=logout]", ".duty-identity .eyebrow", ".greeting-row h1"];
            return selectors.map(selector => {
              const box = document.querySelector(selector).getBoundingClientRect();
              return {x:box.x,y:box.y+scrollY,height:box.height};
            });
          },role==="owner");
        };
        const baseline = await positions();
        const routes = role === "bala" ? ["round","report","instructions"] : role === "supervisor" ? ["incidents","summaries","setup","instructionSetup","patrols","admin"] : ["property","supervisors","subscription"];
        for (const route of routes) {
          if(role==="supervisor" && ["instructionSetup","patrols","admin"].includes(route)) {
            await p.locator('[data-page="setup"]').click();
            await p.locator(`[data-tab="${{instructionSetup:"shifts",patrols:"checkpoints",admin:"team"}[route]}"]`).click();
          } else await p.locator('[data-page="'+route+'"]').first().click();
          const current = await positions();
          current.forEach((box,i) => {
            for(const key of ["x","y","height"])
              assert.ok(Math.abs(box[key]-baseline[i][key])<1,role+" "+route+" "+width+" header "+i+" "+key+" changed: "+baseline[i][key]+" to "+box[key]);
          });
          await p.locator('.greeting-row [data-page="home"]').click();
        }
        if(role==="bala") await p.getByRole("button",{name:"Hear instructions",exact:true}).click();
      }
      await ctx.close();
    }
  } finally { await browser?.close(); server.kill(); }
});
