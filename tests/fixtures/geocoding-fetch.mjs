// Loaded only by the isolated geocoding test server, never by the application.
const nativeFetch=globalThis.fetch;
globalThis.fetch=async(input,options)=>{
  const url=new URL(input);
  if(url.hostname!=='api.geoapify.com')return nativeFetch(input,options);
  const query=url.searchParams.get('text');
  if(query.includes('Unavailable'))return new Response('{}',{status:503});
  if(query.includes('Slow'))await new Promise(resolve=>setTimeout(resolve,500));
  return Response.json({results:query.includes('Missing')?[]:[{
    formatted:'12 Example Road, Ikeja, Lagos, Nigeria',lat:6.601,lon:3.351,
    result_type:'building',rank:{confidence:1}
  },...(query.includes('Multiple')?[{formatted:'Example Road, Abuja, Nigeria',lat:9.06,lon:7.49,result_type:'street',rank:{confidence:.7}}]:[])]});
};
