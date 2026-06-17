/** SVG puntero azul (estilo Google Stitch). */
export const STITCH_CURSOR_SVG =
  '<svg class="rl42-stitch-cursor__icon" width="24" height="24" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg" aria-hidden="true"><path d="M5.5 3.5L18 11.2L11.8 12.4L9.6 19.8L5.5 3.5Z" fill="#2563EB" stroke="#fff" stroke-width="1.4" stroke-linejoin="round"/><circle cx="5.5" cy="3.5" r="2.2" fill="#60A5FA" opacity="0.9"/></svg>'

const STITCH_CURSOR_MARKUP_JSON = JSON.stringify(
  `<div class="rl42-stitch-cursor" aria-hidden="true">${STITCH_CURSOR_SVG}<span class="rl42-stitch-cursor__pulse"></span></div>`,
)

/**
 * Cursor animado que visita bloques nuevos del DOM durante la generación (preview diseño).
 * Requiere CSS en designLoadingGradient.css (.rl42-stitch-cursor*).
 */
export const DESIGN_PREVIEW_STITCH_CURSOR_SCRIPT = `
(function(){
  try{
    if(window.matchMedia('(prefers-reduced-motion: reduce)').matches)return;
    var q=new URLSearchParams(location.search);
    if(q.get('reveal')==='0'||q.get('cursor')==='0')return;
    if(window.__RL42_STITCH_CURSOR__)return;
    window.__RL42_STITCH_CURSOR__=true;

    var CURSOR_HTML=${STITCH_CURSOR_MARKUP_JSON};
    var SCAN_TAGS=['SECTION','HEADER','FOOTER','MAIN','ARTICLE','NAV','H1','H2','H3','FORM','UL','OL','LI','BUTTON','A','IMG','P','DIV'];

    var cursorEl=null;
    var queue=[];
    var busy=false;
    var seen=new WeakSet();
    var lastTarget=null;
    var scanTimer=null;
    var idleTimer=null;

    function sleep(ms){return new Promise(function(r){setTimeout(r,ms);});}

    function visible(el){
      if(!el||el.nodeType!==1)return false;
      var r=el.getBoundingClientRect();
      return r.width>20&&r.height>12&&r.bottom>4&&r.right>4&&r.top<innerHeight+40&&r.left<innerWidth+40;
    }

    function divScore(el){
      var cn=(el.className&&typeof el.className==='string')?el.className:'';
      if(/hero|section|card|grid|container|banner|footer|header|nav|main|feature|product|catalog|cta|pricing|testimonial/i.test(cn))return 2;
      var ch=el.children?el.children.length:0;
      if(ch>=2&&el.getBoundingClientRect().height>72)return 1;
      return 0;
    }

    function score(el){
      var t=el.tagName;
      if(t==='SECTION'||t==='HEADER'||t==='FOOTER'||t==='MAIN'||t==='ARTICLE'||t==='NAV')return 4;
      if(t==='H1'||t==='H2'||t==='H3')return 3;
      if(t==='FORM'||t==='UL'||t==='OL'||t==='IMG'||t==='BUTTON')return 2;
      if(t==='LI'||t==='P'||t==='A')return 1;
      if(t==='DIV')return divScore(el);
      if(el.parentElement===document.body)return 2;
      return 0;
    }

    function accept(el){
      if(!el||el.nodeType!==1||seen.has(el))return false;
      if(el.closest&&el.closest('.rl42-stitch-cursor'))return false;
      if(el.id==='runlabs42-design-loading-css')return false;
      if(el.tagName==='SCRIPT'||el.tagName==='STYLE'||el.tagName==='LINK')return false;
      return score(el)>0&&visible(el);
    }

    function mark(el){
      seen.add(el);
      queue.push(el);
      if(!busy)void drain();
    }

    function scanRoot(root){
      if(!root||root.nodeType!==1)return;
      if(accept(root)) mark(root);
      for(var i=0;i<SCAN_TAGS.length;i++){
        var list=root.querySelectorAll?root.querySelectorAll(SCAN_TAGS[i]):[];
        for(var j=0;j<list.length;j++) if(accept(list[j])) mark(list[j]);
      }
    }

    function ensureCursor(){
      if(cursorEl&&cursorEl.isConnected)return cursorEl;
      var wrap=document.createElement('div');
      wrap.innerHTML=CURSOR_HTML;
      cursorEl=wrap.firstElementChild;
      document.body.appendChild(cursorEl);
      return cursorEl;
    }

    function moveTo(el, done){
      var c=ensureCursor();
      var r=el.getBoundingClientRect();
      var viewport={w:innerWidth,h:innerHeight};
      var anchors=[[0.22,0.28],[0.52,0.38],[0.78,0.55],[0.4,0.72]];
      var idx=0;
      function stepTo(){
        if(idx>=anchors.length){ if(done) done(); return; }
        var a=anchors[idx++];
        var tipX=5.5, tipY=3.5;
        var tx=Math.max(8, Math.min(viewport.w-28, r.left+r.width*a[0]-tipX));
        var ty=Math.max(8, Math.min(viewport.h-28, r.top+r.height*a[1]-tipY));
        var sx=parseFloat((c.style.transform.match(/translate\\(([-\\d.]+)px,\\s*([-\\d.]+)px\\)/)||[0,12,12])[1])||12;
        var sy=parseFloat((c.style.transform.match(/translate\\(([-\\d.]+)px,\\s*([-\\d.]+)px\\)/)||[0,0,12])[2])||12;
        var t0=performance.now(), dur=460;
        function frame(now){
          var t=Math.min(1,(now-t0)/dur);
          var e=t<0.5?2*t*t:1-Math.pow(-2*t+2,2)/2;
          var x=sx+(tx-sx)*e;
          var y=sy+(ty-sy)*e;
          c.style.transform='translate('+x+'px,'+y+'px)';
          if(t<1) requestAnimationFrame(frame);
          else stepTo();
        }
        requestAnimationFrame(frame);
      }
      stepTo();
    }

    function moveToPoint(x,y){
      var c=ensureCursor();
      c.style.transform='translate('+x+'px,'+y+'px)';
    }

    function highlight(el,on){
      if(lastTarget&&lastTarget!==el) lastTarget.classList.remove('rl42-stitch-cursor-target');
      lastTarget=on?el:null;
      if(on) el.classList.add('rl42-stitch-cursor-target');
    }

    async function drain(){
      busy=true;
      while(queue.length){
        var el=queue.shift();
        if(!el||!visible(el)) continue;
        highlight(el,true);
        await new Promise(function(resolve){
          moveTo(el, resolve);
        });
        await sleep(220);
        highlight(el,false);
        await sleep(120);
      }
      busy=false;
      scheduleIdle();
    }

    async function idlePulse(){
      if(busy||queue.length)return;
      var targets=document.querySelectorAll('section,header,main,article,nav,h1,h2,.hero,[class*="card"],[class*="grid"]');
      var pick=null;
      for(var i=0;i<targets.length;i++){
        var el=targets[i];
        if(visible(el)){ pick=el; break; }
      }
      if(pick){
        highlight(pick,true);
        await new Promise(function(resolve){ moveTo(pick, resolve); });
        await sleep(200);
        highlight(pick,false);
        return;
      }
      var cx=Math.round(innerWidth*0.42);
      var cy=Math.round(innerHeight*0.28);
      moveToPoint(cx,cy);
      await sleep(280);
      moveToPoint(cx+48,cy+32);
    }

    function scheduleIdle(){
      if(idleTimer) clearTimeout(idleTimer);
      idleTimer=setTimeout(function(){ void idlePulse(); }, 400);
    }

    function onAdded(node){
      if(node.nodeType!==1)return;
      if(accept(node)) mark(node);
      scanRoot(node);
    }

    var mo=new MutationObserver(function(muts){
      var touched=false;
      for(var i=0;i<muts.length;i++){
        var m=muts[i];
        for(var j=0;j<m.addedNodes.length;j++){
          onAdded(m.addedNodes[j]);
          touched=true;
        }
      }
      if(touched) scheduleIdle();
    });

    function boot(){
      ensureCursor();
      moveToPoint(Math.round(innerWidth*0.2),Math.round(innerHeight*0.18));
      scanRoot(document.body);
      mo.observe(document.documentElement,{childList:true,subtree:true});
      scanTimer=setInterval(function(){ scanRoot(document.body); }, 380);
      setTimeout(function(){ scanRoot(document.body); }, 80);
      setTimeout(function(){ scanRoot(document.body); }, 420);
      scheduleIdle();
    }

    if(document.readyState==='loading') document.addEventListener('DOMContentLoaded',boot);
    else boot();

    window.addEventListener('beforeunload',function(){
      if(scanTimer) clearInterval(scanTimer);
      if(idleTimer) clearTimeout(idleTimer);
      mo.disconnect();
    });
  }catch(_){}
})();
`
