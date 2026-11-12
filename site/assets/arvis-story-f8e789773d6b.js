(() => {
  'use strict';
  const reduced = matchMedia('(prefers-reduced-motion: reduce)');
  // Keep narrow and coarse-pointer pages still; media playback and controls retain their existing owners.
  const stableMobile = matchMedia('(max-width:900px), (pointer:coarse)').matches;
  const constrained = (navigator.connection && navigator.connection.saveData) || stableMobile;
  const scenes = [...document.querySelectorAll('.sv-motion,[data-story-reveal],.page-hero,.profile-hero,.profile-story>section,.doctor-grid,.price-group')];
  let active = new Set(), ticking = false;
  const finalState = () => {
    active.clear();
    document.querySelectorAll('[data-story-layer]').forEach(el => el.style.removeProperty('transform'));
    document.getAnimations().filter(a => a.effect && a.effect.target.closest('.sv-home,.sv-page')).forEach(a => a.finish());
  };
  if (!reduced.matches && !constrained && 'IntersectionObserver' in window) {
    const entrance = new IntersectionObserver(entries => {
      entries.forEach(entry => {
        if (!entry.isIntersecting || reduced.matches || constrained) return;
        const el = entry.target;
        if (el.animate) el.animate([{ transform:'translateY(24px)' },{ transform:'translateY(0)' }],{ duration:760,easing:'cubic-bezier(.16,1,.3,1)' });
        const heading = el.querySelector('h2');
        if (heading && heading.animate) heading.animate([{ transform:'translateY(10px)' },{ transform:'translateY(0)' }],{duration:600,easing:'cubic-bezier(.16,1,.3,1)'});
        el.querySelectorAll('.draw-path').forEach((path,i) => {
          if (!path.getTotalLength || !path.animate) return;
          try { const length=path.getTotalLength(); path.animate([{strokeDasharray:`${length} ${length}`,strokeDashoffset:length},{strokeDasharray:`${length} ${length}`,strokeDashoffset:0}],{duration:950,delay:Math.min(i*14,220),easing:'cubic-bezier(.16,1,.3,1)'}); } catch (_) {}
        });
        entrance.unobserve(el);
      });
    },{threshold:.12});
    scenes.forEach(el => entrance.observe(el));
    const layerObserver = new IntersectionObserver(entries => {
      entries.forEach(e => e.isIntersecting ? active.add(e.target) : active.delete(e.target));
      schedule();
    },{rootMargin:'50px'});
    document.querySelectorAll('.sv-scene-art,.sv-topic-art,.sv-editorial-art,.sv-device-stage,.sv-figure').forEach(el => layerObserver.observe(el));
  }
  function paint() {
    ticking=false;
    updateProgress();
    if (reduced.matches || constrained || document.hidden) return;
    active.forEach(scene => {
      const r=scene.getBoundingClientRect();
      const t=Math.max(-1,Math.min(1,(innerHeight/2-r.top-r.height/2)/(innerHeight/2+r.height/2)));
      scene.querySelectorAll('[data-story-layer]').forEach(layer => {
        const weight=Math.max(0,Math.min(1,Number(layer.dataset.storyLayer)||0));
        layer.style.transform=`translate3d(0,${(t*36*weight).toFixed(1)}px,0)`;
      });
    });
  }
  function schedule() { if(!ticking){ticking=true;requestAnimationFrame(paint);} }
  const reader=document.querySelector('.reader-body,main.reader--article .reader-content');
  let progress;
  if(reader){ progress=document.createElement('div');progress.className='sv-progress';progress.setAttribute('aria-hidden','true');document.body.append(progress); }
  function updateProgress(){
    if(!progress) return;
    const rect=reader.getBoundingClientRect();
    progress.style.transform=`scaleX(${Math.max(0,Math.min(1,(innerHeight*.3-rect.top)/Math.max(1,rect.height-innerHeight*.5)))})`;
  }
  const chapters=[...document.querySelectorAll('.reader-body h2[id],main.reader--article .reader-content h2[id]')];
  const outline=[...document.querySelectorAll('.reader-outline a[href^="#"]')];
  if(chapters.length && outline.length && 'IntersectionObserver' in window){
    const sections=new IntersectionObserver(entries=>entries.forEach(e=>{if(!e.isIntersecting)return;outline.forEach(a=>{if(a.hash==='#'+e.target.id)a.setAttribute('aria-current','location');else a.removeAttribute('aria-current');});}),{rootMargin:'-15% 0px -65% 0px'});
    chapters.forEach(el=>sections.observe(el));
  }
  addEventListener('scroll',schedule,{passive:true});
  addEventListener('resize',schedule,{passive:true});
  reduced.addEventListener('change',()=>{if(reduced.matches)finalState();else schedule();});
  updateProgress();
})();
