const publicError=Symbol('publicGeocodingError');
const error=(message,status)=>Object.assign(new Error(message),{status,[publicError]:true});

export function addressQuery(value) {
  if(typeof value!=='string')throw error('Enter a full street address, city and country.',400);
  const address=value.trim();
  if(address.length<8 || address.length>500)throw error('Enter a full address between 8 and 500 characters.',400);
  return address;
}

export async function geocodeAddress(address,{apiKey=process.env.GEOAPIFY_API_KEY,fetchImpl=fetch,timeoutMs=8000}={}) {
  address=addressQuery(address);
  if(!apiKey?.trim())throw error('Address search is not available yet. Use your current position or enter coordinates.',503);
  const url=new URL('https://api.geoapify.com/v1/geocode/search');
  url.search=new URLSearchParams({text:address,format:'json',limit:'5',lang:'en',apiKey:apiKey.trim()});
  try {
    const response=await fetchImpl(url,{signal:AbortSignal.timeout(timeoutMs),redirect:'error',headers:{Accept:'application/json'}});
    if(!response.ok)throw error('Address search is temporarily unavailable. Try again shortly or use your current position.',503);
    const body=await response.json();
    if(!Array.isArray(body.results))throw error('Address search returned an invalid response. Please try again.',502);
    const seen=new Set();
    return body.results.slice(0,5).flatMap(item=>{
      if(typeof item.lat!=='number'||typeof item.lon!=='number'||!Number.isFinite(item.lat)||!Number.isFinite(item.lon)||Math.abs(item.lat)>90||Math.abs(item.lon)>180||typeof item.formatted!=='string'||!item.formatted.trim())return [];
      const key=`${item.lat},${item.lon}:${item.formatted}`;
      if(seen.has(key))return [];seen.add(key);
      const confidence=item.rank?.confidence;
      const precise=['building','amenity'].includes(item.result_type)&&typeof confidence==='number'&&confidence>=0.95;
      return [{address:item.formatted.slice(0,500),latitude:item.lat,longitude:item.lon,approximate:!precise}];
    });
  }catch(cause) {
    // Provider errors can include the full request URL (and API key/address).
    // Never return or log them; only our bounded, public messages escape.
    if(cause?.[publicError])throw cause;
    throw error('Address search could not be reached. Try again or use your current position.',503);
  }
}
