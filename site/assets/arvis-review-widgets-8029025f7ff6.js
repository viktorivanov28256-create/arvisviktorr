/* Scale only our fixed-size NaPop review frames; no provider data or storage access. */
(()=>{'use strict';
  const holders=Array.from(document.querySelectorAll('.arvis-review-widgets [data-arvis-review-scale]'));
  const update=holder=>{
    const frame=holder.querySelector('iframe[data-arvis-review-scale-frame]');
    const available=holder.clientWidth;
    if(!frame||available<=0)return;
    const ratio=Math.min(1,available/316);
    frame.style.transformOrigin='0 0';
    frame.style.transform='scale('+ratio+')';
    holder.style.height=(111*ratio)+'px';
    holder.setAttribute('data-arvis-review-scaled','');
  };
  if(!holders.length)return;
  holders.forEach(update);
  if(typeof ResizeObserver==='function'){
    const observer=new ResizeObserver(entries=>entries.forEach(entry=>update(entry.target)));
    holders.forEach(holder=>observer.observe(holder));
  }else{
    window.addEventListener('resize',()=>holders.forEach(update),{passive:true});
  }
  window.addEventListener('pageshow',()=>holders.forEach(update),{passive:true});
})();
