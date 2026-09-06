export function phoneNumber(value) {
  let number=String(value||'').trim().replace(/[\s().-]/g,'');
  if(/^0\d{10}$/.test(number)) number='+234'+number.slice(1);
  else if(/^234\d{10}$/.test(number)) number='+'+number;
  return /^\+[1-9]\d{7,14}$/.test(number)?number:null;
}
export function loginId(value) {
  return phoneNumber(value) || String(value||'').trim().toLowerCase();
}
