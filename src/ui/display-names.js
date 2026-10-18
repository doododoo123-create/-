// Preserve original engine identifiers and replay data; hide generated succession suffixes.
export function displayName(person,fallback=''){
  const name=person?.name||fallback;
  return person?.generation>0?name.replace(/·\d+대\d+$/u,''):name;
}
export const displayEventText=text=>String(text??'').replace(/·\d+대\d+/gu,'');
