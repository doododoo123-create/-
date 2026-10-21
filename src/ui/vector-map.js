import { CONTINENT160_ART } from '../data/continent160-art.js';
// Recognition uses the actual map viewport, excluding the extra ocean used for panning.
export function continent160MapImage(){
 if(!CONTINENT160_ART.startsWith('data:image/svg+xml;'))return 'data:image/svg+xml;base64,'+btoa(`<svg xmlns="http://www.w3.org/2000/svg" width="1800" height="1200" viewBox="0 -70 1800 1200"><image href="${CONTINENT160_ART}" x="-1800" y="-1270" width="5400" height="3600"/></svg>`);
 const bytes=atob(CONTINENT160_ART.split(',')[1]);
 return 'data:image/svg+xml;base64,'+btoa(bytes.replace('viewBox="-1800 -1270 5400 3600"','viewBox="0 -70 1800 1200"').replace('width="5400"','width="1800"').replace('height="3600"','height="1200"'));
}
