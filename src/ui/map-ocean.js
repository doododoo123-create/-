import { OCEAN_ART } from '../data/ocean-art.js';
import {localImageURL} from './local-image-url.js';
export const oceanSource=()=>localImageURL(OCEAN_ART);
export function renderOcean(coast){return `<g class="ocean-scenery" pointer-events="none"><path class="coastal-depth" d="${coast}" fill="none" stroke="#3baba9" stroke-opacity=".23" stroke-width="36"/><path d="${coast}" fill="none" stroke="#7bc3bd" stroke-opacity=".32" stroke-width="16"/><path d="${coast}" fill="none" stroke="#c1d7c0" stroke-opacity=".55" stroke-width="4"/></g>`;}
