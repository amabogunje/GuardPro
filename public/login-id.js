export function phoneNumber(value) {
  let number=String(value||'').trim().replace(/[\s().-]/g,'');
  // The pilot accepts Nigerian mobile numbers. People commonly omit the
  // domestic zero, so accept that ten-digit form and store one E.164 value.
  if(/^0[789]\d{9}$/.test(number)) number='+234'+number.slice(1);
  else if(/^[789]\d{9}$/.test(number)) number='+234'+number;
  else if(/^234[789]\d{9}$/.test(number)) number='+'+number;
  return /^\+234[789]\d{9}$/.test(number)?number:null;
}
export function loginId(value) {
  return phoneNumber(value) || String(value||'').trim().toLowerCase();
}
