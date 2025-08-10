(function(){
  'use strict';
  const STORAGE_KEY = 'zpoker_pwa_v1';
  const numPlayersEl = document.getElementById('numPlayers');
  const startingChipsEl = document.getElementById('startingChips');
  const elimRateEl = document.getElementById('elimRate');
  const estimateText = document.getElementById('estimateText');
  const levelIndexEl = document.getElementById('levelIndex');
  const levelCountEl = document.getElementById('levelCount');
  const smallBlindEl = document.getElementById('smallBlind');
  const bigBlindEl = document.getElementById('bigBlind');
  const clockEl = document.getElementById('clock');
  const prevBtn = document.getElementById('prevBtn');
  const startPauseBtn = document.getElementById('startPauseBtn');
  const nextBtn = document.getElementById('nextBtn');
  const resetBtn = document.getElementById('resetBtn');
  const addFinalBtn = document.getElementById('addFinalBtn');
  const levelsList = document.getElementById('levelsList');
  const exportBtn = document.getElementById('exportBtn');
  const importFile = document.getElementById('importFile');
  const fullscreenBtn = document.getElementById('fullscreenBtn');
  const installBtn = document.getElementById('installBtn');
  const alertSound = document.getElementById('alertSound');
  let levels = [];
  let numPlayers = 10;
  let startingChips = 5000;
  let elimRate = 3.5;
  let currentLevel = 0;
  let secondsLeft = 0;
  let running = false;
  let timerInterval = null;
  let deferredPrompt = null;
  function uid(){ return Math.random().toString(36).slice(2,9); }
  function defaultStructure(){
    return [
      { id: uid(), small:25, big:50, duration:15 },
      { id: uid(), small:50, big:100, duration:15 },
      { id: uid(), small:100, big:200, duration:15 },
      { id: uid(), small:200, big:400, duration:15 },
      { id: uid(), small:400, big:800, duration:15 },
      { id: uid(), small:800, big:1600, duration:15 },
    ];
  }
  function save(){
    const payload = { levels, numPlayers, startingChips, elimRate, currentLevel, secondsLeft, running };
    localStorage.setItem(STORAGE_KEY, JSON.stringify(payload));
  }
  function load(){
    const raw = localStorage.getItem(STORAGE_KEY);
    if (raw){
      try{
        const p = JSON.parse(raw);
        levels = p.levels || defaultStructure();
        numPlayers = p.numPlayers || 10;
        startingChips = p.startingChips || 5000;
        elimRate = (p.elimRate !== undefined) ? p.elimRate : 3.5;
        currentLevel = p.currentLevel || 0;
        secondsLeft = (p.secondsLeft !== undefined) ? p.secondsLeft : (levels[0].duration*60);
        running = p.running || false;
        return;
      }catch(e){
        console.warn('load error',e);
      }
    }
    levels = defaultStructure();
    currentLevel = 0;
    secondsLeft = levels[0].duration*60;
  }
  function estimateTotalMinutes(){
    if (numPlayers <= 1) return 0;
    let players = numPlayers;
    const totalChips = numPlayers * startingChips;
    let minutes = 0;
    for (let i=0;i<levels.length;i++){
      const lvl = levels[i];
      const avgStack = totalChips / Math.max(1, players);
      minutes += lvl.duration;
      if (avgStack < lvl.big * 10) break;
      const eliminated = Math.max(0, Math.floor(players * (elimRate/100)));
      players = Math.max(1, players - eliminated);
      if (players <= 1) break;
    }
    return minutes;
  }
  function formatTime(secs){
    if (secs < 0) secs = 0;
    const h = Math.floor(secs/3600);
    const m = Math.floor((secs%3600)/60);
    const s = secs%60;
    return `${h}:${String(m).padStart(2,'0')}:${String(s).padStart(2,'0')}`;
  }
  function renderLevels(){
    levelsList.innerHTML = '';
    levels.forEach((lvl, idx)=>{
      const div = document.createElement('div');
      div.className = 'level-row' + (idx===currentLevel ? ' current' : '');
      div.innerHTML = `
        <div class="index">${idx+1}</div>
        <input class="small" data-idx="${idx}" data-field="small" value="${lvl.small}">
        <input class="big" data-idx="${idx}" data-field="big" value="${lvl.big}">
        <input class="dur" data-idx="${idx}" data-field="duration" value="${lvl.duration}">
        <div class="actions">
          <button class="add-btn" data-idx="${idx}">+ após</button>
          <button class="remove-btn" data-idx="${idx}">Rem</button>
        </div>
      `;
      levelsList.appendChild(div);
    });
    levelsList.querySelectorAll('input').forEach(inp=>{
      inp.addEventListener('change', (e)=>{
        const el = e.target;
        const idx = Number(el.getAttribute('data-idx'));
        const field = el.getAttribute('data-field');
        const val = Math.max(1, Number(el.value) || 1);
        levels[idx][field] = val;
        if (field === 'small') levels[idx].big = Math.max(1, levels[idx].small*2);
        save(); render();
      });
    });
    levelsList.querySelectorAll('.add-btn').forEach(btn=>{
      btn.addEventListener('click', (e)=>{
        const idx = Number(btn.getAttribute('data-idx'));
        const last = levels[levels.length-1];
        const newL = { id:uid(), small: Math.max(25, Math.floor(last.small*2)), big: Math.max(50, Math.floor(last.big*2)), duration:15 };
        levels.splice(idx+1,0,newL);
        save(); render(); 
      });
    });
    levelsList.querySelectorAll('.remove-btn').forEach(btn=>{
      btn.addEventListener('click', (e)=>{
        const idx = Number(btn.getAttribute('data-idx'));
        if (levels.length <= 1) return alert('Precisa ter ao menos 1 nível');
        levels.splice(idx,1);
        if (currentLevel >= levels.length) currentLevel = levels.length-1;
        save(); render();
      });
    });
  }
  function render(){
    numPlayersEl.value = numPlayers;
    startingChipsEl.value = startingChips;
    elimRateEl.value = elimRate;
    levelIndexEl.textContent = String(currentLevel+1);
    levelCountEl.textContent = String(levels.length);
    smallBlindEl.textContent = String(levels[currentLevel].small);
    bigBlindEl.textContent = String(levels[currentLevel].big);
    clockEl.textContent = formatTime(secondsLeft);
    estimateText.textContent = `${Math.floor(estimateTotalMinutes()/60)}h ${estimateTotalMinutes()%60}m`;
    renderLevels();
    save();
    startPauseBtn.textContent = running ? 'Pausar' : 'Iniciar';
  }
  function playAlert(){
    try{ alertSound.currentTime = 0; alertSound.play().catch(()=>{}); }catch(e){}
    if (navigator.vibrate) navigator.vibrate([200,100,200]);
  }
  function advanceLevel(){
    if (currentLevel+1 < levels.length){
      currentLevel++;
      secondsLeft = levels[currentLevel].duration*60;
      playAlert();
      render();
    } else {
      running = false;
      playAlert();
      alert('Fim da estrutura');
      render();
    }
  }
  function prevLevel(){
    currentLevel = Math.max(0, currentLevel-1);
    secondsLeft = levels[currentLevel].duration*60;
    render();
  }
  function startPause(){
    if (!running && secondsLeft <= 0) secondsLeft = levels[currentLevel].duration*60;
    running = !running;
    if (running){
      timerInterval = setInterval(()=>{
        secondsLeft--;
        if (secondsLeft <= 0){
          clearInterval(timerInterval);
          running = false;
          advanceLevel();
        }
        render();
      },1000);
    } else {
      clearInterval(timerInterval);
    }
    render();
  }
  function reset(){
    running = false;
    currentLevel = 0;
    secondsLeft = levels[0].duration*60;
    clearInterval(timerInterval);
    render();
  }
  function exportStructure(){
    const payload = { levels, numPlayers, startingChips, elimRate };
    const blob = new Blob([JSON.stringify(payload, null, 2)], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url; a.download = 'zpoker_structure.json'; a.click();
    URL.revokeObjectURL(url);
  }
  function importStructure(file){
    const reader = new FileReader();
    reader.onload = e=>{
      try{
        const p = JSON.parse(e.target.result);
        if (p.levels && Array.isArray(p.levels)){
          levels = p.levels.map(l=>({ id:uid(), small:Number(l.small), big:Number(l.big), duration:Number(l.duration) }));
        }
        if (p.numPlayers) numPlayers = Number(p.numPlayers);
        if (p.startingChips) startingChips = Number(p.startingChips);
        if (p.elimRate) elimRate = Number(p.elimRate);
        currentLevel = 0;
        secondsLeft = levels[0].duration*60;
        save(); render();
      }catch(err){ alert('Arquivo inválido'); }
    };
    reader.readAsText(file);
  }
  function toggleFullscreen(){
    if (!document.fullscreenElement){
      document.documentElement.requestFullscreen().catch(()=>{});
    } else {
      document.exitFullscreen().catch(()=>{});
    }
  }
  window.addEventListener('beforeinstallprompt', (e) => {
    e.preventDefault();
    deferredPrompt = e;
    installBtn.style.display = 'inline-block';
  });
  installBtn.addEventListener('click', async ()=>{
    if (!deferredPrompt) return alert('Instalação não disponível');
    deferredPrompt.prompt();
    const choiceResult = await deferredPrompt.userChoice;
    if (choiceResult.outcome === 'accepted') {
      console.log('User accepted install');
    }
    deferredPrompt = null;
    installBtn.style.display = 'none';
  });
  document.addEventListener('keydown', (e)=>{
    if (e.key === ' '){ e.preventDefault(); startPause(); }
    if (e.key === 'ArrowRight') advanceLevel();
    if (e.key === 'ArrowLeft') prevLevel();
  });
  load();
  if (typeof secondsLeft !== 'number' || isNaN(secondsLeft)) secondsLeft = levels[0].duration*60;
  render();
  numPlayersEl.addEventListener('change', e=>{ numPlayers = Math.max(1, Number(e.target.value)||1); save(); render(); });
  startingChipsEl.addEventListener('change', e=>{ startingChips = Math.max(1, Number(e.target.value)||1); save(); render(); });
  elimRateEl.addEventListener('change', e=>{ elimRate = Math.max(0.1, Number(e.target.value)||0.1); save(); render(); });
  prevBtn.addEventListener('click', prevLevel);
  nextBtn.addEventListener('click', ()=>{ advanceLevel(); });
  startPauseBtn.addEventListener('click', startPause);
  resetBtn.addEventListener('click', reset);
  addFinalBtn.addEventListener('click', ()=>{ const last = levels[levels.length-1]; levels.push({id:uid(), small:Math.max(25, Math.floor(last.small*2)), big:Math.max(50, Math.floor(last.big*2)), duration:15}); save(); render(); });
  exportBtn.addEventListener('click', exportStructure);
  importFile.addEventListener('change', e=>{ if (e.target.files && e.target.files[0]) importStructure(e.target.files[0]); });
  fullscreenBtn.addEventListener('click', toggleFullscreen);
  setInterval(()=> {
    const el = document.querySelector('.level-row.current');
    if (el) el.animate([{ transform: 'scale(1.01)' }, { transform: 'scale(1)' }], { duration: 900, easing: 'ease-in-out' });
  }, 2000);
})();