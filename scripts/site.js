// Interactivity: expandable project cards, active nav highlight, subtle fade-ins on scroll
(function(){
  const cards = document.querySelectorAll('.project-card.expandable');
  cards.forEach(card=>{
    const btn = card.querySelector('.toggle-more-btn');
    const extra = card.querySelector('.project-extra');
    if(!btn || !extra) return;
    btn.addEventListener('click', ()=>{
      const collapsed = card.getAttribute('data-collapsed') !== 'false';
      card.setAttribute('data-collapsed', collapsed ? 'false':'true');
      btn.setAttribute('aria-expanded', collapsed ? 'true':'false');
      btn.textContent = collapsed ? 'Show Less' : 'More Details';
    });
  });

  // Intersection observer for fade-in elements
  const io = ('IntersectionObserver' in window) ? new IntersectionObserver((entries)=>{
    entries.forEach(e=>{
      if(e.isIntersecting){
        e.target.classList.add('in-view');
        io.unobserve(e.target);
      }
    });
  },{threshold:0.12}) : null;

  document.querySelectorAll('.project-card, .about-block, .contact-item').forEach(el=>{
    el.classList.add('pre-fade');
    if(io) io.observe(el);
  });

  // Active nav highlight on scroll
  const sections = Array.from(document.querySelectorAll('section[id]'));
  const navLinks = Array.from(document.querySelectorAll('.nav-links a'));
  function setActive(id){
    navLinks.forEach(a=>{ a.classList.toggle('active', a.getAttribute('href') === '#' + id); });
  }
  let ticking=false;
  window.addEventListener('scroll', ()=>{
    if(ticking) return; ticking=true; requestAnimationFrame(()=>{
      const navH = document.querySelector('.navbar')?.offsetHeight || 64;
      const viewportMid = window.scrollY + navH + (window.innerHeight - navH)/2; // center sampling
      let current = sections[0].id;
      for(const sec of sections){
        const top = sec.offsetTop;
        const bottom = top + sec.offsetHeight;
        if(viewportMid >= top && viewportMid < bottom){ current = sec.id; break; }
        if(viewportMid >= top) current = sec.id; else break;
      }
      setActive(current); ticking=false; });
  });

  // Copy functionality for phone and email
  function showToast(message){
    const root = document.getElementById('toast-root');
    if(!root) return; const el = document.createElement('div');
    el.className = 'toast';
    el.innerHTML = '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M20 6L9 17l-5-5"/></svg><span>'+ message +'</span>';
    root.appendChild(el);
    setTimeout(()=>{ el.remove(); }, 3600);
  }
  // Generic copy buttons (email & phone icon buttons)
  document.querySelectorAll('.copy-btn').forEach(btn=>{
    btn.addEventListener('click', (e)=>{
      e.preventDefault();
      const text = btn.getAttribute('data-copy') || btn.textContent.trim();
      if(!text) return;
      const type = btn.getAttribute('data-type') || 'generic';
      let message;
      if(type==='phone') message='Phone number copied';
      else if(type==='email') message='Email copied';
      else if(type==='linkedin') message='LinkedIn URL copied';
      else message='Copied';
      navigator.clipboard?.writeText(text).then(()=>{
        showToast(message);
        btn.classList.add('copied');
        setTimeout(()=> btn.classList.remove('copied'), 1000);
      }).catch(()=> showToast('Copy failed'));
    });
  });

  // Phone anchor: desktop = copy, mobile = open dialer
  const isMobile = (()=>{
    const ua = navigator.userAgent || navigator.vendor || '';
    return /Mobi|Android|iPhone|iPad|iPod/i.test(ua) || window.matchMedia('(pointer:coarse)').matches;
  })();
  document.querySelectorAll('.copy-phone').forEach(anchor=>{
    const raw = anchor.getAttribute('data-phone') || anchor.textContent.trim();
    if(isMobile){
      // Prepare tel: link (strip spaces & non digit except +)
      const telNum = raw.replace(/[^+\d]/g,'');
      anchor.setAttribute('href', 'tel:'+telNum);
      // Remove any previous listener logic (in case of hot reload) by cloning
      const clone = anchor.cloneNode(true);
      anchor.parentNode.replaceChild(clone, anchor);
    } else {
      // Desktop: act as copy (no tel navigation)
      anchor.addEventListener('click', (e)=>{
        e.preventDefault();
        const text = raw;
        if(!text) return;
        navigator.clipboard?.writeText(text).then(()=> showToast('Phone number copied'))
          .catch(()=> showToast('Copy failed'));
      });
    }
  });
  // Mobile navigation toggle
  const navToggle = document.querySelector('.nav-toggle');
  const navLinksEl = document.getElementById('primary-navigation');
  function closeNav(){ if(!navToggle) return; navToggle.setAttribute('aria-expanded','false'); navLinksEl?.classList.remove('open'); document.body.classList.remove('nav-open'); }
  function openNav(){ if(!navToggle) return; navToggle.setAttribute('aria-expanded','true'); navLinksEl?.classList.add('open'); document.body.classList.add('nav-open'); }
  navToggle?.addEventListener('click', ()=>{ const expanded = navToggle.getAttribute('aria-expanded')==='true'; expanded? closeNav(): openNav(); });
  navLinksEl?.querySelectorAll('a').forEach(a=> a.addEventListener('click', closeNav));
  window.addEventListener('click', e=>{ if(navLinksEl && navToggle && !navLinksEl.contains(e.target) && !navToggle.contains(e.target)) closeNav(); });
  window.addEventListener('keydown', e=>{ if(e.key==='Escape') closeNav(); });

  // Stable mobile viewport height: set --vh to window.innerHeight * 1% and update on changes
  function setVH(){
    // Use innerHeight which excludes URL bar when visible
    const vh = window.innerHeight * 0.01;
    document.documentElement.style.setProperty('--vh', `${vh}px`);
  }
  setVH();
  // Update on resize and orientation changes; debounce via rAF
  let vhTick = false;
  const onResize = () => {
    if(vhTick) return; vhTick = true;
    requestAnimationFrame(()=>{ setVH(); vhTick = false; });
  };
  window.addEventListener('resize', onResize, { passive: true });
  window.addEventListener('orientationchange', ()=>{ setTimeout(setVH, 200); }, { passive: true });
})();
