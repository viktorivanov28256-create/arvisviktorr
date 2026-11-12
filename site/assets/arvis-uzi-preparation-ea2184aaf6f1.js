/* Progressive enhancement: native study disclosures and all directions work first. */
(() => {
  'use strict';
  const one=(s,r=document)=>r.querySelector(s);
  const all=(s,r=document)=>[...r.querySelectorAll(s)];
  const norm=s=>String(s||'').toLocaleLowerCase('ru').replaceAll('ё','е').replace(/\s+/g,' ').trim();
  const stem=word=>word.length>5?word.replace(/(?:иями|ями|ами|ого|ему|ыми|ий|ый|ой|ая|ое|ые|ую|ом|ах|ях|а|я|у|ю|ы|и|е|о|ь)$/u,''):word;
  const writeState=values=>{
    const url=new URL(location.href);
    for(const [key,value] of Object.entries(values))value?url.searchParams.set(key,value):url.searchParams.delete(key);
    history.replaceState(null,'',url.pathname+url.search+url.hash);
  };
  /* Muted autoplay for the clinic's own MP4 device demonstrations (cosmetology only).
     Native controls remain. A manual pause or a sound change keeps that video stopped until it is played again. */
  const media=(()=>{
    const states=new WeakMap(),managed=new Set();
    const reduceMotion=typeof matchMedia==='function'?matchMedia('(prefers-reduced-motion: reduce)'):null;
    const connection=()=>navigator.connection||navigator.mozConnection||navigator.webkitConnection||null;
    const allowed=()=>!(reduceMotion&&reduceMotion.matches)&&!(connection()&&connection().saveData);
    const state=video=>{
      let value=states.get(video);
      if(!value){value={onscreen:false,visible:false,held:false,done:false,blocked:false,auto:false,ourPause:false,epoch:0};states.set(video,value);}
      return value;
    };
    const inScope=video=>Boolean(video.closest('.xp-cosmetology'))||location.pathname.startsWith('/kosmetologiya/');
    const ownMp4=video=>{
      const sources=[video.getAttribute('src'),...all('source',video).map(source=>source.getAttribute('src'))].filter(Boolean);
      return sources.length>0&&sources.every(source=>{
        try{const url=new URL(source,location.href);return url.origin===location.origin&&/\.mp4$/i.test(url.pathname);}catch{return false;}
      });
    };
    const mustStop=video=>document.hidden||!video.isConnected||Boolean(video.closest('[hidden]'))||!state(video).onscreen;
    const canStart=video=>{const s=state(video);return allowed()&&!mustStop(video)&&s.visible&&!s.held&&!s.done&&!s.blocked;};
    const stop=video=>{
      const s=state(video);
      s.epoch+=1;s.auto=false;
      if(!video.paused){s.ourPause=true;video.pause();}
    };
    const start=video=>{
      const s=state(video);
      s.epoch+=1;s.auto=true;
      const epoch=s.epoch;
      video.muted=true;
      let result;
      try{result=video.play();}catch{s.blocked=true;s.auto=false;return;}
      if(result&&typeof result.then==='function')result.then(
        ()=>{if(mustStop(video)||(s.auto&&!allowed()))stop(video);},
        ()=>{if(s.epoch===epoch){s.blocked=true;s.auto=false;}}
      );
    };
    const evaluate=video=>{
      const s=state(video);
      if(mustStop(video)||(s.auto&&!allowed()))stop(video);
      else if(video.paused&&canStart(video))start(video);
    };
    const sync=()=>managed.forEach(video=>evaluate(video));
    const init=()=>{
      if(typeof IntersectionObserver!=='function')return;
      const videos=all('video[playsinline]').filter(video=>inScope(video)&&ownMp4(video));
      if(!videos.length)return;
      const intro=one('#apparaty-v-detalyah .cm-new-content__intro');
      if(intro){
        // Preserve links and other markup inside the equipment introduction.
        const textNodes=document.createTreeWalker(intro,NodeFilter.SHOW_TEXT);
        for(let node=textNodes.nextNode();node;node=textNodes.nextNode()){
          const copy=node.nodeValue.replace('Видео запускается по нажатию;','Анимации аппаратов — без звука;').replace('Видео — без звука, с управлением в плеере;','Анимации аппаратов — без звука;');
          if(copy!==node.nodeValue)node.nodeValue=copy;
        }
      }
      const observer=new IntersectionObserver(entries=>entries.forEach(entry=>{
        const video=entry.target,s=state(video);
        const viewport=entry.rootBounds?entry.rootBounds.height:innerHeight,shown=entry.intersectionRect.height;
        s.onscreen=entry.isIntersecting&&(entry.intersectionRatio>=.1||shown>=viewport*.1);
        s.visible=s.onscreen&&(entry.intersectionRatio>=.25||shown>=viewport*.25);
        evaluate(video);
      }),{threshold:Array.from({length:21},(_,index)=>index/20)});
      videos.forEach(video=>{
        const s=state(video);
        video.muted=true;video.defaultMuted=true;video.loop=true;
        managed.add(video);
        video.addEventListener('play',()=>{if(video.paused)return;s.held=false;s.done=false;s.blocked=false;});
        video.addEventListener('pause',()=>{
          if(s.ourPause){s.ourPause=false;return;}
          s.auto=false;
          if(video.paused&&!video.ended)s.held=true;
        });
        video.addEventListener('ended',()=>{s.done=true;s.auto=false;});
        video.addEventListener('volumechange',()=>{if(!video.muted)s.held=true;});
        observer.observe(video);
      });
      if(reduceMotion){reduceMotion.addEventListener?reduceMotion.addEventListener('change',sync):reduceMotion.addListener?.(sync);}
      connection()?.addEventListener?.('change',sync);
    };
    return {
      init,sync,
      manages:video=>managed.has(video),
      pauseAll:()=>managed.forEach(video=>stop(video)),
      pauseWithin:container=>all('video',container).forEach(video=>managed.has(video)?stop(video):video.pause())
    };
  })();
  function capabilityHome(root){
    const tabs=all('[data-xp-focus]',root),panels=all('[data-xp-panel]',root);
    if(!tabs.length||!panels.length)return;
    const valid=key=>tabs.some(t=>t.dataset.xpFocus===key);
    const initial=valid(root.dataset.xpInitialFocus)?root.dataset.xpInitialFocus:'diagnostics';
    const activate=(key,write=false)=>{
      key=valid(key)?key:initial;
      tabs.forEach(tab=>{const active=tab.dataset.xpFocus===key;tab.setAttribute('aria-selected',String(active));tab.tabIndex=active?0:-1;});
      panels.forEach(panel=>{
        const active=panel.dataset.xpPanel===key;
        panel.setAttribute('role','tabpanel');panel.setAttribute('aria-labelledby','xp-focus-'+panel.dataset.xpPanel);
        panel.hidden=!active;
        if(!active)media.pauseWithin(panel);
      });
      root.dataset.xpActiveFocus=key;
      if(write)writeState({focus:key});
      media.sync();
    };
    tabs.forEach((tab,index)=>{
      tab.addEventListener('click',()=>activate(tab.dataset.xpFocus,true));
      tab.addEventListener('keydown',event=>{
        if(!['ArrowLeft','ArrowRight','Home','End'].includes(event.key))return;
        event.preventDefault();
        const next=event.key==='Home'?0:event.key==='End'?tabs.length-1:(index+(event.key==='ArrowRight'?1:-1)+tabs.length)%tabs.length;
        activate(tabs[next].dataset.xpFocus,true);tabs[next].focus();
      });
    });
    const deviceButtons=all('[data-xp-device]',root),deviceScenes=all('[data-xp-device-scene]',root);
    const chooseDevice=(key,write=false)=>{
      key=['ultraformer','volnewmer'].includes(key)?key:'ultraformer';
      deviceButtons.forEach(button=>button.setAttribute('aria-pressed',String(button.dataset.xpDevice===key)));
      deviceScenes.forEach(scene=>{const active=scene.dataset.xpDeviceScene===key;scene.hidden=!active;if(!active)media.pauseWithin(scene);});
      if(write)writeState({focus:'cosmetology',device:key});
      media.sync();
    };
    deviceButtons.forEach(button=>button.addEventListener('click',()=>chooseDevice(button.dataset.xpDevice,true)));
    const restore=()=>{
      const params=new URLSearchParams(location.search);
      activate(params.get('focus')||initial);chooseDevice(params.get('device')||'ultraformer');
    };
    restore();
    one('[data-xp-home-enhance]',root).hidden=false;
    one('[data-xp-focus-fallback]',root).hidden=true;
    const deviceSwitch=one('[data-xp-device-switch]',root);if(deviceSwitch)deviceSwitch.hidden=false;
    window.addEventListener('popstate',restore);
  }
  function ultrasound(root){
    let studies;
    try{studies=JSON.parse(one('[data-xp-us-data]',root)?.textContent||'null');}catch{return;}
    if(!Array.isArray(studies)||!studies.length)return;
    const query=one('[data-xp-us-query]',root),provider=one('[data-xp-us-provider]',root),select=one('[data-xp-us-select]',root);
    const buttons=all('[data-xp-study]',root),empty=one('[data-xp-us-empty]',root),count=one('[data-xp-us-count]',root),detail=one('[data-xp-us-detail]',root),fallback=one('[data-xp-us-fallback]',root);
    if(!query||!provider||!select||!detail||!fallback||!empty||!count)return;
    const defaultId=root.dataset.xpDefaultStudy||studies[0].id;
    let currentId=defaultId,filtered=studies;
    const byId=new Map(studies.map(s=>[s.id,s]));
    const setText=(selector,text)=>{const element=one(selector,detail);if(element)element.textContent=text||'';};
    // Exact existing editorial notes only; no HTML strings or clinical inference.
    const noteGroups = [{"ids":["popov-u-shch-1","popov-u-shch-2"],"group":"u-shch","note":"Что значит TI-RADS в заключении — в статье «УЗИ щитовидной железы» .","title":"«УЗИ щитовидной железы»","href":"/articles/uzi-shchitovidnoy-zhelezy/"},{"ids":["popov-u-mol-1"],"group":"u-mol","note":"Чем УЗИ отличается от маммографии — в статье «УЗИ молочных желёз» .","title":"«УЗИ молочных желёз»","href":"/articles/uzi-molochnyh-zhelez/"},{"ids":["popov-u-bryush-1","popov-u-bryush-2","popov-u-bryush-3","popov-u-bryush-4","popov-u-bryush-5"],"group":"u-bryush","note":"Перед исследованием печени, желчного пузыря, поджелудочной железы и селезёнки за 2–3 дня уберите продукты, от которых пучит: капусту, бобовые, газированные напитки, чёрный хлеб. Что покажет исследование — в статье «УЗИ брюшной полости и почек» .","title":"«УЗИ брюшной полости и почек»","href":"/articles/uzi-bryushnoy-polosti/"}];
    const noteById = new Map(noteGroups.flatMap(group=>group.ids.map(id=>[id,group])));
    const informationLabels = new Map([["popov-u-bryush-1",{"href":"/articles/uzi-bryushnoy-polosti/","label":"Статья об исследовании"}],["alieva-alieva-1",{"href":"/ginekologiya/alieva-elona-gavkaz-kyzy/#ceny","label":"Цены в профиле врача"}],["alieva-alieva-2",{"href":"/ginekologiya/alieva-elona-gavkaz-kyzy/#ceny","label":"Цены в профиле врача"}],["alieva-alieva-3",{"href":"/ginekologiya/alieva-elona-gavkaz-kyzy/#ceny","label":"Цены в профиле врача"}],["alieva-alieva-4",{"href":"/ginekologiya/alieva-elona-gavkaz-kyzy/#ceny","label":"Цены в профиле врача"}],["alieva-alieva-5",{"href":"/ginekologiya/alieva-elona-gavkaz-kyzy/#ceny","label":"Цены в профиле врача"}],["popov-u-drugoe-1",{"href":"/uzi/popov-sergey-viktorovich/","label":"О враче"}],["popov-u-drugoe-2",{"href":"/uzi/popov-sergey-viktorovich/","label":"О враче"}]]);
    const noteDiagnostics = new Set();
    const noteDiagnostic=(id,reason)=>{
      const key=id+':'+reason;if(noteDiagnostics.has(key))return;noteDiagnostics.add(key);
      console.warn('ARVIS_UZI_EDITORIAL_LINK_UNAVAILABLE',id,reason);
    };
    const sourceText=node=>{
      if(node.nodeType===3)return node.nodeValue||'';
      if(node.nodeType!==1||['SCRIPT','STYLE','SVG'].includes(node.tagName))return '';
      return Array.from(node.childNodes,sourceText).join(' ').replace(/\s+/gu,' ').trim();
    };
    const legacyNoteMatches=spec=>{
      const main=root.closest('main.xp-ultrasound');if(!main||location.pathname!=='/uzi/')return false;
      const headings=main.querySelectorAll('#'+spec.group);if(headings.length!==1)return false;
      const group=headings[0].closest('.apv-km-ptab');if(!group)return false;
      const notes=group.querySelectorAll('.apv-km-ptab__note');if(notes.length!==1)return false;
      const anchors=notes[0].querySelectorAll('a');
      return anchors.length===1&&anchors[0].getAttribute('href')===spec.href&&anchors[0].textContent===spec.title&&sourceText(notes[0])===spec.note;
    };
    const setStudyNote=s=>{
      const element=one('[data-xp-study-note]',detail);if(!element)return;
      const text=typeof s.section_note==='string'?s.section_note:'';element.textContent=text;
      const spec=noteById.get(s.id);if(!spec)return;
      const ordinal=spec.ids.indexOf(s.id)+1;
      if(s.provider_id!=='popov'||s.section_note!==spec.note||s.source_selector!=='#'+spec.group+' / .apv-km-row:nth-of-type('+ordinal+')'||!legacyNoteMatches(spec)){
        noteDiagnostic(s.id,'EXACT_NOTE_AND_LEGACY_ANCHOR_REQUIRED');return;
      }
      const at=text.indexOf(spec.title);
      if(at<0||text.indexOf(spec.title,at+spec.title.length)!==-1){noteDiagnostic(s.id,'ONE_EXISTING_TITLE_REQUIRED');return;}
      const anchor=document.createElement('a');anchor.setAttribute('href',spec.href);anchor.textContent=spec.title;
      element.replaceChildren(document.createTextNode(text.slice(0,at)),anchor,document.createTextNode(text.slice(at+spec.title.length)));
    };
    const setStudyInformation=s=>{
      const info=one('[data-xp-study-information]',detail);if(!info)return;
      info.href=s.information_href;
      const spec=informationLabels.get(s.id);let label="Подробнее об исследовании";
      if(spec){if(s.information_href===spec.href)label=spec.label;else noteDiagnostic(s.id,'EXACT_INFORMATION_DESTINATION_REQUIRED');}
      const text=info.firstChild;
      if(text&&text.nodeType===3)text.nodeValue=label;else noteDiagnostic(s.id,'EXISTING_INFORMATION_TEXT_NODE_REQUIRED');
    };
    const persist=()=>writeState({study:currentId,usq:query.value,doctor:provider.value});
    const choose=(id,write=true)=>{
      const s=byId.get(id);if(!s)return;
      currentId=s.id;detail.hidden=false;
      buttons.forEach(button=>{const selected=button.dataset.xpStudy===id;button.setAttribute('aria-selected',String(selected));button.tabIndex=selected?0:-1;});
      select.value=id;
      setText('[data-xp-study-section]',s.section);setText('[data-xp-study-name]',s.name);setText('[data-xp-study-price]',s.price);
      setText('[data-xp-study-detail]',s.detail);setStudyNote(s);
      setText('[data-xp-study-detail-heading]',s.detail_heading);
      setText('[data-xp-study-note-heading]',s.note_heading);
      one('.xp-study-preparation',detail).hidden=!s.detail;
      one('.xp-study-source-note',detail).hidden=!s.section_note;
      setStudyInformation(s);
      const booking=one('[data-xp-study-booking]',detail);if(booking)booking.href=s.booking_href;
      const person=one('[data-xp-study-provider]',detail);if(person)person.href=s.provider_route;
      const portrait=one('[data-xp-study-portrait]',detail);if(portrait){portrait.src=s.provider_portrait;portrait.hidden=!s.provider_portrait;}
      setText('[data-xp-study-provider-name]',s.provider_name);setText('[data-xp-study-provider-role]',s.provider_role);
      if(write)persist();
    };
    const haystack=s=>norm(['узи',s.name,s.section,s.provider_name,s.provider_role,
      s.region==='abdomen'?'живот брюшная полость':'',
      s.region==='urinary'?'почки мочевой пузырь':'',
      s.region==='thyroid'?'щитовидка':''].join(' '));
    const fillSelect=rows=>{
      select.replaceChildren();
      const groups=new Map();
      for(const study of rows){
        if(!groups.has(study.provider_name)){
          const group=document.createElement('optgroup');group.label=study.provider_name;
          groups.set(study.provider_name,group);select.append(group);
        }
        const option=document.createElement('option');option.value=study.id;option.textContent=study.name+' — '+study.price;
        groups.get(study.provider_name).append(option);
      }
    };
    const filter=(preferred=currentId,write=true)=>{
      const words=norm(query.value).split(' ').filter(Boolean).map(stem);
      filtered=studies.filter(s=>(!provider.value||s.provider_id===provider.value)&&words.every(word=>haystack(s).includes(word)));
      const ids=new Set(filtered.map(s=>s.id));
      buttons.forEach(button=>{button.hidden=!ids.has(button.dataset.xpStudy);});
      count.textContent='Исследований: '+filtered.length;empty.hidden=Boolean(filtered.length);
      fillSelect(filtered);
      if(!filtered.length){
        currentId='';detail.hidden=true;
        const option=document.createElement('option');option.textContent='Исследование не найдено';option.value='';select.append(option);
      }else choose(ids.has(preferred)?preferred:filtered[0].id,false);
      if(write)persist();
    };
    buttons.forEach(button=>{
      button.id=root.dataset.xpPrefix+'-option-'+button.dataset.xpStudy;
      button.addEventListener('click',()=>choose(button.dataset.xpStudy));
      button.addEventListener('keydown',event=>{
        if(!['ArrowUp','ArrowDown','Home','End'].includes(event.key)||!filtered.length)return;
        event.preventDefault();
        const current=filtered.findIndex(s=>s.id===button.dataset.xpStudy);
        const index=event.key==='Home'?0:event.key==='End'?filtered.length-1:(current+(event.key==='ArrowDown'?1:-1)+filtered.length)%filtered.length;
        const id=filtered[index].id;choose(id);
        const next=buttons.find(b=>b.dataset.xpStudy===id);next?.focus({preventScroll:true});next?.scrollIntoView({block:'nearest'});
      });
    });
    query.addEventListener('input',()=>filter());provider.addEventListener('change',()=>filter());select.addEventListener('change',()=>choose(select.value));
    one('[data-xp-us-reset]',root)?.addEventListener('click',()=>{query.value='';provider.value='';filter(defaultId);query.focus();});
    const restore=()=>{
      const params=new URLSearchParams(location.search);
      query.value=params.get('usq')||'';provider.value=['popov','alieva'].includes(params.get('doctor'))?params.get('doctor'):'';
      filter(params.get('study')||defaultId,false);
    };
    restore();
    root.classList.add('is-enhanced');
    all('[data-xp-enhance]',root).forEach(element=>element.hidden=false);
    if(!filtered.length)detail.hidden=true;
    fallback.hidden=true;
    window.addEventListener('popstate',restore);
  }
  const init=()=>{
    media.init();
    all('[data-xp-home]').forEach(capabilityHome);
    all('[data-xp-us]').forEach(ultrasound);
    document.addEventListener('visibilitychange',()=>{
      if(document.hidden){media.pauseAll();all('.xp video').forEach(video=>{if(!media.manages(video))video.pause();});}
      else media.sync();
    });
  };
  document.readyState==='loading'?document.addEventListener('DOMContentLoaded',init,{once:true}):init();
})();
