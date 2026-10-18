import { readdir,readFile,writeFile } from 'node:fs/promises';
import { resolve } from 'node:path';
// The SVG files remain the editable source. Bundle static paths without external requests.
export async function syncKitIcons(root){
  const directory=resolve(root,'assets/ui-kit/03-icons'),icons={};
  for(const name of (await readdir(directory)).filter(name=>/^icon_[a-z]+\.svg$/.test(name)).sort()){
    const svg=await readFile(resolve(directory,name),'utf8');
    if(/<(?:script|foreignObject|image|use|style|iframe)\b|\son\w+\s*=|href\s*=|url\(/i.test(svg))throw new Error(`UI icon must contain static paths only: ${name}`);
    if(!/^<svg\b[^>]*>.*<\/svg>\s*$/s.test(svg))throw new Error(`Invalid UI icon: ${name}`);
    icons[name.slice(5,-4)]=svg.replace(/^<svg[^>]*>|<\/svg>\s*$/g,'').replace(/ color="#[0-9a-f]+"/gi,'');
  }
  if(!Object.keys(icons).length)throw new Error('The UI kit icon folder is empty.');
  const output='// Static, inspected SVG paths from the user-provided UI kit. Colors inherit from the interface.\nexport const KIT_ICONS = '+JSON.stringify(icons,null,2)+';\n';
  await writeFile(resolve(root,'src/ui/kit-icons.js'),output);
}
