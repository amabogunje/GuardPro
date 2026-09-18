export function phoneNumber(value) {
  let number=String(value||'').trim().replace(/[\s().-]/g,'');
  // Accept international E.164 WhatsApp numbers. Nigerian users commonly
  // omit the domestic zero, so normalize those local forms as a convenience.
  if(/^0[789]\d{9}$/.test(number)) number='+234'+number.slice(1);
  else if(/^[789]\d{9}$/.test(number)) number='+234'+number;
  else if(/^234[789]\d{9}$/.test(number)) number='+'+number;
  return /^\+[1-9]\d{7,14}$/.test(number)?number:null;
}
export function loginId(value) {
  return phoneNumber(value) || String(value||'').trim().toLowerCase();
}
