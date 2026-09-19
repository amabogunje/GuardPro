import test from 'node:test';
import assert from 'node:assert/strict';
import { healthCards } from '../public/owner-health-view.js';

const emptyHealth={
  from:'11 Sep 2026',to:'17 Sep 2026',
  guard:{expected:0,score:null,missed:0,late:0,onTime:0,missedPct:0,latePct:0},
  patrol:{expected:0,score:null,completed:0,late:0,incomplete:0,completionUnknown:0},
  risk:{total:0,security:0,unclassified:0,p1:0,label:'No data yet',outstanding:0,securityPct:0,p1Pct:0},
  dashboard:{urgent:{reportedP1:0,tone:'good'},monitoring:{active:0,scheduled:false,tone:'neutral'},patrols:{expected:0,completed:0,unknown:0,percentage:null,tone:'neutral',days:3}}
};

test('owner dashboard gives three direct, display-only monitoring answers',()=>{
  const html=healthCards(emptyHealth,{esc:value=>String(value),icon:name=>`<svg data-icon="${name}"></svg>`});
  assert.equal((html.match(/owner-kpi owner-kpi-/g)||[]).length,3);
  assert.equal((html.match(/class="health-info-trigger"/g)||[]).length,3);
  assert.equal((html.match(/data-icon="help"/g)||[]).length,3);
  assert.match(html,/Major security issues/);
  assert.match(html,/No issues reported/);
  assert.match(html,/Monitoring now/);
  assert.match(html,/No shift scheduled/);
  assert.match(html,/Patrols completed/);
  assert.match(html,/No patrols due/);
  assert.doesNotMatch(html,/class="health-description"/);
  assert.doesNotMatch(html,/Your property|At a glance/);
  assert.doesNotMatch(html,/Report risk signal|Guard coverage health|Patrol coverage health/);
});
