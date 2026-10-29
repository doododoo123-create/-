// Built-in image bytes remain untouched. One local URL per asset keeps large
// base64 strings out of repeatedly parsed map/card markup. No network is used.
const localImageURLs=new Map();
export function localImageURL(source){
 if(!source?.startsWith('data:image/')||!globalThis.document?.createElement||typeof URL.createObjectURL!=='function')return source;
 if(localImageURLs.has(source))return localImageURLs.get(source);
 const match=/^data:(image\/[a-z0-9.+-]+);base64,([\s\S]+)$/i.exec(source);if(!match)return source;
 const bytes=atob(match[2]),buffer=new Uint8Array(bytes.length);for(let i=0;i<bytes.length;i++)buffer[i]=bytes.charCodeAt(i);
 const url=URL.createObjectURL(new Blob([buffer],{type:match[1]}));localImageURLs.set(source,url);return url;
}
