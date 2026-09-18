import test from 'node:test';
import assert from 'node:assert/strict';
import {phoneNumber} from '../public/login-id.js';

test('normalizes the common Nigerian mobile number formats',()=>{
  for(const value of ['0818 335 4052','8183354052','2348183354052','+234 818 335 4052'])
    assert.equal(phoneNumber(value),'+2348183354052');
  assert.equal(phoneNumber('123'),null);
  assert.equal(phoneNumber('06183354052'),null);
});
