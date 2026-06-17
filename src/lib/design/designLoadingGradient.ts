import 'server-only'

import { readFileSync } from 'node:fs'
import { join } from 'node:path'

let cachedCss: string | null = null

export function getDesignLoadingGradientCss(): string {
  if (cachedCss) return cachedCss
  cachedCss = readFileSync(
    join(process.cwd(), 'src/lib/design/designLoadingGradient.css'),
    'utf8',
  )
  return cachedCss
}

export const DESIGN_PREVIEW_IMAGE_LOADING_SCRIPT = `
(function(){
  var sel='img[src*="/design/preview/file/"]';
  function mark(img){
    if(!img||!img.getAttribute)return;
    if(img.complete&&img.naturalWidth>0){img.classList.remove('rl42-img-loading');img.classList.add('rl42-img-loaded');return;}
    img.classList.add('rl42-img-loading');
    img.classList.remove('rl42-img-loaded');
    function done(){img.classList.remove('rl42-img-loading');img.classList.add('rl42-img-loaded');}
    img.addEventListener('load',done,{once:true});
    img.addEventListener('error',done,{once:true});
  }
  function scan(){document.querySelectorAll(sel).forEach(mark);}
  scan();
  new MutationObserver(scan).observe(document.documentElement,{childList:true,subtree:true,attributes:true,attributeFilter:['src']});
  window.addEventListener('message',function(e){
    if(!e.data||e.data.type!=='runlabs42-reload-design-assets')return;
    document.querySelectorAll(sel).forEach(function(img){
      try{
        var u=new URL(img.src,location.href);
        if(u.pathname.indexOf('/design/preview/file/')===-1)return;
        u.searchParams.set('k',String(e.data.k!=null?e.data.k:Date.now()));
        img.classList.remove('rl42-img-loaded');
        img.src=u.toString();
        mark(img);
      }catch(_){}
    });
  });
})();
`

/** Revelado progresivo de secciones (estilo Stitch) al cargar el preview. */
export { DESIGN_PREVIEW_STITCH_CURSOR_SCRIPT } from '@/lib/design/designStitchCursor'

export const DESIGN_PREVIEW_STITCH_REVEAL_SCRIPT = `
(function(){
  try{
    var p=new URLSearchParams(location.search);
    if(p.get('reveal')==='0')return;
    document.addEventListener('DOMContentLoaded',function(){
      document.body.classList.add('rl42-stitch-reveal');
    });
  }catch(_){}
})();
`

export function designLoadingGradientMarkup(): string {
  return `<div class="rl42-blue-aurora" aria-hidden="true">
  <div class="rl42-blue-aurora__blob rl42-blue-aurora__blob--1"></div>
  <div class="rl42-blue-aurora__blob rl42-blue-aurora__blob--2"></div>
  <div class="rl42-blue-aurora__blob rl42-blue-aurora__blob--3"></div>
  <div class="rl42-blue-aurora__shine"></div>
</div>`
}
