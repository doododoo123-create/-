import { CONTINENT160_ART } from '../data/continent160-art.js';
// Recognition uses the actual map viewport, excluding the extra ocean used for panning.
export function continent160MapImage(){
 const bytes=atob(CONTINENT160_ART.split(',')[1]);
 return 'data:image/svg+xml;base64,'+btoa(bytes.replace('viewBox="-1800 -1270 5400 3600"','viewBox="0 -70 1800 1200"').replace('width="5400"','width="1800"').replace('height="3600"','height="1200"'));
}
