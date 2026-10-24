import { TEXT_BOX_ART } from '../data/text-box-art.js';
export function installTextBoxTextures(){for(const [key,url] of Object.entries(TEXT_BOX_ART))document.documentElement.style.setProperty('--texture-'+key,`url("${url}")`);}
export function textBoxPatternDefs(){return Object.entries(TEXT_BOX_ART).map(([key,url])=>`<pattern id="text-box-${key}" patternUnits="userSpaceOnUse" width="96" height="96"><image href="${url}" width="96" height="96" preserveAspectRatio="xMidYMid slice"/></pattern>`).join('');}
