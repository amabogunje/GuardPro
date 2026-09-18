import test from 'node:test';
import assert from 'node:assert/strict';
import { healthCards } from '../public/owner-health-view.js';

const emptyHealth={
  from:'11 Sep 2026',to:'17 Sep 2026',
  guard:{expected:0,score:null,missed:0,late:0,onTime:0,missedPct:0,latePct:0},
  patrol:{expected:0,score:null,completed:0,late:0,incomplete:0,completionUnknown:0},
  risk:{total:0,security:0,unclassified:0,p1:0,label:'No data yet',outstanding:0,securityPct:0,p1Pct:0}
};

test('fully configured owner keeps the three KPI cards before activity begins',()=>{
  const html=healthCards(emptyHealth,{esc:value=>String(value),icon:name=>`<svg data-icon="${name}"></svg>`});
  assert.match(html,/No activity has been recorded yet\. These measures will update after guards begin patrolling\./);
  assert.equal((html.match(/class="owner-kpi"/g)||[]).length,3);
  assert.equal((html.match(/No data yet/g)||[]).length,3);
  assert.doesNotMatch(html,/Activity will appear here/);
});
