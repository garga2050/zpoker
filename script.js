// Z Poker 2.0 - automatic blind progression with bip sounds and visual notices
(function(){
  const STORAGE_KEY = 'zpoker_v2_state';
  // DOM
  const totalMinutesEl = document.getElementById('totalMinutes');
  const numPlayersEl = document.getElementById('numPlayers');
  const startingChipsEl = document.getElementById('startingChips');
  const generateBtn = document.getElementById('generateBtn');
  const applyBtn = document.getElementById('applyBtn');

  const levelIndexEl = document.getElementById('levelIndex');
  const levelCountEl = document.getElementById('levelCount');
  const blindsTextEl = document.getElementById('blindsText');
  const clockEl = document.getElementById('clock');
  const prevBtn = document.getElementById('prevBtn');
  const startPauseBtn = document.getElementById('startPauseBtn');
  const nextBtn = document.getElementById('nextBtn');
  const resetBtn = document.getElementById('resetBtn');

  const levelsListEl = document.getElementById('levelsList');
  const addFinalBtn = document.getElementById('addFinalBtn');
  const visualNoticeEl = document.getElementById('visualNotice');

  const beepShort = document.getElementById('beepShort');
  const beepLong = document.getElementById('beepLong');

  // state
  let levels = [];
  let currentLevel = 0;
  let secondsLeft = 0;
  let running = false;
  let timerInterval = null;

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
    const payload = { levels, currentLevel, secondsLeft, running };
    localStorage.setItem(STORAGE_KEY, JSON.stringify(payload));
  }

  function load(){
    const raw = localStorage.getItem(STORAGE_KEY);
    if(raw){
      try{
        const p = JSON.parse(raw);
        levels = p.levels || defaultStructure();
        currentLevel = p.currentLevel || 0;
        secondsLeft = (p.secondsLeft !== undefined) ? p.secondsLeft : (levels[0].duration*60);
        running = p.running || false;
        return;
      }catch(e){
        console.warn('load error', e);
      }
    }
    levels = defaultStructure();
    currentLevel = 0;
    secondsLeft = levels[0].duration*60;
  }

  // calculate automatic progression based on total time, players, starting chips
  // approach:
  // - estimate how many levels needed: simulate elimination until avg stack < 10 * big blind
  // - choose number of levels so that sum(duration_i) ~= totalMinutes
  // - set duration per level = totalMinutes / nLevels
  // - set blinds progression geometric: base * growth^i where growth chosen to reach reasonable final blind
  function generateStructure(totalMinutes, numPlayers, startingChips){
    // choose target number of levels: heuristic between 8 and 24 based on players and time
    const minutes = Math.max(1, Math.floor(totalMinutes));
    // initial guess: one level per 15 minutes
    let nLevels = Math.max(6, Math.min(24, Math.round(minutes / 15)));
    // adjust nLevels proportionally to players
    nLevels = Math.max(6, Math.min(40, Math.round(nLevels * Math.sqrt(numPlayers/10))));
    // duration per level
    const duration = Math.max(1, Math.floor(minutes / nLevels));
    // choose base blind: small blind initial
    const totalChips = numPlayers * startingChips;
    const avg = totalChips / numPlayers;
    // set starting small blind so that initial big blind ~ 1% of avg
    let big0 = Math.max(10, Math.pow(2, Math.round(Math.log2(Math.max(1, Math.floor(avg * 0.01) || 10)))));
    let small0 = Math.max(5, Math.floor(big0/2));
    // growth factor to end roughly at big such that avg < 10 * big at final
    // target final big = avg / 10
    const targetFinalBig = Math.max(1, Math.floor(avg / 10));
    // compute growth factor
    const growth = Math.pow(Math.max(1.15, targetFinalBig / big0), 1 / Math.max(1, nLevels-1));
    // build levels
    const lvls = [];
    for(let i=0;i<nLevels;i++){
      const big = Math.round(big0 * Math.pow(growth, i));
      const small = Math.round(big/2);
      lvls.push({ id: uid(), small: Math.max(1, small), big: Math.max(2, big), duration: duration });
    }
    return lvls;
  }

  // UI render
  function renderLevels(){
    levelsListEl.innerHTML = '';
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
      levelsListEl.appendChild(div);
    });

    // attach listeners
    levelsListEl.querySelectorAll('input').forEach(inp=>{
      inp.addEventListener('change', (e)=>{
        const el = e.target;
        const idx = Number(el.getAttribute('data-idx'));
        const field = el.getAttribute('data-field');
        const val = Math.max(1, Number(el.value) || 1);
        levels[idx][field] = val;
        if(field === 'small') levels[idx].big = Math.max(2, Math.floor(levels[idx].small*2));
        save(); render();
      });
    });
    levelsListEl.querySelectorAll('.add-btn').forEach(btn=>{
      btn.addEventListener('click', (e)=>{
        const idx = Number(btn.getAttribute('data-idx'));
        const last = levels[levels.length-1];
        const newL = { id: uid(), small: Math.max(5, Math.floor(last.small*2)), big: Math.max(10, Math.floor(last.big*2)), duration: 15 };
        levels.splice(idx+1,0,newL);
        save(); render();
      });
    });
    levelsListEl.querySelectorAll('.remove-btn').forEach(btn=>{
      btn.addEventListener('click', (e)=>{
        const idx = Number(btn.getAttribute('data-idx'));
        if(levels.length <= 1) return alert('Precisa ter ao menos 1 nível');
        levels.splice(idx,1);
        if(currentLevel >= levels.length) currentLevel = levels.length-1;
        save(); render();
      });
    });
  }

  function render(){
    levelIndexEl.textContent = String(currentLevel+1);
    levelCountEl.textContent = String(levels.length);
    blindsTextEl.textContent = levels[currentLevel] ? `${levels[currentLevel].small} / ${levels[currentLevel].big}` : '-';
    clockEl.textContent = formatTime(secondsLeft);
    renderLevels();
  }

  function formatTime(secs){
    if(secs < 0) secs = 0;
    const h = Math.floor(secs / 3600);
    const m = Math.floor((secs % 3600) / 60);
    const s = secs % 60;
    return `${h}:${String(m).padStart(2,'0')}:${String(s).padStart(2,'0')}`;
  }

  function playShort(){
    try{ beepShort.currentTime = 0; beepShort.play().catch(()=>{}); }catch(e){}
  }
  function playLong(){
    try{ beepLong.currentTime = 0; beepLong.play().catch(()=>{}); }catch(e){}
  }

  function showNotice(text, timeout=5000){
    visualNoticeEl.textContent = text;
    visualNoticeEl.classList.remove('hidden');
    setTimeout(()=> visualNoticeEl.classList.add('hidden'), timeout);
  }

  // timer logic
  function startTimer(){
    if(running) return;
    running = true;
    startPauseBtn.textContent = 'Pausar';
    timerInterval = setInterval(()=>{
      secondsLeft--;
      // 1-minute warning
      if(secondsLeft === 60){
        playShort();
        showNotice('Falta 1 minuto para o próximo blind');
      }
      if(secondsLeft <= 0){
        // change level
        playLong();
        showNotice('Blinds subiram');
        if(currentLevel + 1 < levels.length){
          currentLevel++;
          secondsLeft = levels[currentLevel].duration * 60;
        } else {
          // end
          running = false;
          clearInterval(timerInterval);
          showNotice('Torneio finalizado');
          startPauseBtn.textContent = 'Iniciar';
        }
      }
      render();
    }, 1000);
  }

  function pauseTimer(){
    running = false;
    startPauseBtn.textContent = 'Iniciar';
    clearInterval(timerInterval);
  }

  function resetTimer(){
    pauseTimer();
    currentLevel = 0;
    secondsLeft = levels[0].duration * 60;
    render();
  }

  function advanceLevel(){
    playLong();
    if(currentLevel + 1 < levels.length){
      currentLevel++;
      secondsLeft = levels[currentLevel].duration * 60;
      render();
    } else {
      showNotice('Já último nível');
    }
  }
  function prevLevel(){
    if(currentLevel > 0){
      currentLevel--;
      secondsLeft = levels[currentLevel].duration * 60;
      render();
    }
  }

  // events
  startPauseBtn.addEventListener('click', ()=>{
    if(running) pauseTimer(); else startTimer();
  });
  nextBtn.addEventListener('click', advanceLevel);
  prevBtn.addEventListener('click', prevLevel);
  resetBtn.addEventListener('click', resetTimer);

  addFinalBtn.addEventListener('click', ()=>{
    const last = levels[levels.length-1];
    levels.push({ id: uid(), small: Math.max(5, Math.floor(last.small*2)), big: Math.max(10, Math.floor(last.big*2)), duration: 15 });
    save(); render();
  });

  generateBtn.addEventListener('click', ()=>{
    const minutes = Number(totalMinutesEl.value) || 240;
    const players = Number(numPlayersEl.value) || 10;
    const chips = Number(startingChipsEl.value) || 5000;
    levels = generateStructure(minutes, players, chips);
    currentLevel = 0;
    secondsLeft = levels[0].duration * 60;
    save(); render();
  });

  applyBtn.addEventListener('click', ()=>{
    // just start with current structure
    currentLevel = 0;
    secondsLeft = levels[0].duration * 60;
    save(); render();
  });

  // keyboard shortcuts
  document.addEventListener('keydown', (e)=>{
    if(e.key === ' ') { e.preventDefault(); if(running) pauseTimer(); else startTimer(); }
    if(e.key === 'ArrowRight') advanceLevel();
    if(e.key === 'ArrowLeft') prevLevel();
  });

  // init
  load();
  // ensure secondsLeft set
  if(!levels || levels.length === 0) levels = defaultStructure();
  if(typeof secondsLeft !== 'number' || isNaN(secondsLeft)) secondsLeft = levels[0].duration * 60;
  render();

})();
