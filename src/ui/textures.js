import { TEXT_BOX_ART } from '../data/text-box-art.js';
import {localImageURL} from './local-image-url.js';
const textBoxURLs={...TEXT_BOX_ART};let textBoxPatterns=null,textBoxInstalled=false;
export function installTextBoxTextures(){
 if(textBoxInstalled)return;textBoxInstalled=true;
 for(const [key,data] of Object.entries(TEXT_BOX_ART)){
  // Six shared local URLs, instead of copying long data strings into every
  // SVG definition and reparsing them during inherited CSS variable updates.
  textBoxURLs[key]=localImageURL(data);
  document.documentElement.style.setProperty('--texture-'+key,`url("${textBoxURLs[key]}")`);
 }
 textBoxPatterns=null;
}
export function textBoxPatternDefs(){return textBoxPatterns??=Object.entries(textBoxURLs).map(([key,url])=>`<pattern id="text-box-${key}" patternUnits="userSpaceOnUse" width="96" height="96"><image href="${url}" width="96" height="96" preserveAspectRatio="xMidYMid slice"/></pattern>`).join('');}
