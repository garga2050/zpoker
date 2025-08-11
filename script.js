// Z Poker 2.2 — progressão 25/50, upload de áudios (início e subida), bip 1 min
(function(){
  const STORAGE = 'zpoker_22_state';
  const AUDIO_STORE = 'zpoker_22_audio'; // stores data URLs

  // DOM refs
  const totalMinutesEl = document.getElementById('totalMinutes');
  const numPlayersEl = document.getElementById('numPlayers');
  const startingChipsEl = document.getElementById('startingChips');
  const generateBtn = document.getElementById('generateBtn');
  const applyBtn = document.getElementById('applyBtn');

  const levelIndexEl = document.getElementById('levelIndex');
  const levelCountEl = document.getElementById('levelCount');
  const smallBlindEl = document.getElementById('smallBlind');
  const bigBlindEl = document.getElementById('bigBlind');
  const clockEl = document.getElementById('clock');
  const noticeEl = document.getElementById('notice');

  const prevBtn = document.getElementById('prevBtn');
  const startPauseBtn = document.getElementById('startPauseBtn');
  const nextBtn = document.getElementById('nextBtn');
  const resetBtn = document.getElementById('resetBtn');

  const levelsList = document.getElementById('levelsList');
  const addFinalBtn = document.getElementById('addFinalBtn');

  // upload elements
  const welcomeFile = document.getElementById('welcomeFile');
  const levelUpFile = document.getElementById('levelUpFile');
  const testWelcome = document.getElementById('testWelcome');
  const testLevelUp = document.getElementById('testLevelUp');
  const clearWelcome = document.getElementById('clearWelcome');
  const clearLevelUp = document.getElementById('clearLevelUp');
  const welcomeStatus = document.getElementById('welcomeStatus');
  const levelUpStatus = document.getElementById('levelUpStatus');

  // audio elements
  const welcomeAudio = document.getElementById('welcomeAudio');
  const levelUpAudio = document.getElementById('levelUpAudio');
  const beepShort = document.getElementById('beepShort');
  const beepLong = document.getElementById('beepLong');

  // state
  let levels = [];
  let currentLevel = 0;
  let secondsLeft = 0;
  let running = false;
  let timer = null;

  const SMALL_SEQUENCE = [25,50,100,200,400,500,1000,2000,4000,5000,10000,20000,40000,50000,100000];

  function uid(){ return Math.random().toString(36).slice(2,9); }

  function buildLevels(minutes, players, chips){
    const m = Math.max(10, Number(minutes)||240);
    const nPref = Math.round(m/15);
    const n = Math.max(6, Math.min(SMALL_SEQUENCE.length, Math.round(nPref*Math.sqrt((Number(players)||10)/10))));
    const per = Math.max(5, Math.floor(m/n));
    const lvls=[];
    for(let i=0;i<n;i++){
      const sb = SMALL_SEQUENCE[i];
      lvls.push({ id: uid(), small: sb, big: sb*2, duration: per });
    }
    return lvls;
  }

  function saveState(){
    localStorage.setItem(STORAGE, JSON.stringify({levels,currentLevel,secondsLeft,running}));
  }
  function loadState(){
    const raw = localStorage.getItem(STORAGE);
    if(raw){
      try{ const p = JSON.parse(raw);
        levels = p.levels||[]; currentLevel=p.currentLevel||0; secondsLeft=p.secondsLeft||0; running=p.running||false;
      }catch{}
    }
    if(!levels.length){ levels = buildLevels(240,10,5000); currentLevel=0; secondsLeft=levels[0].duration*60; }
  }

  function saveAudio(key, dataURL){
    const bag = JSON.parse(localStorage.getItem(AUDIO_STORE)||'{}');
    bag[key]=dataURL; localStorage.setItem(AUDIO_STORE, JSON.stringify(bag));
  }
  function loadAudio(){
    const bag = JSON.parse(localStorage.getItem(AUDIO_STORE)||'{}');
    if(bag.welcome){ welcomeAudio.src = bag.welcome; welcomeStatus.textContent = 'Carregado'; }
    if(bag.levelUp){ levelUpAudio.src = bag.levelUp; levelUpStatus.textContent = 'Carregado'; }
  }
  function clearAudio(key){
    const bag = JSON.parse(localStorage.getItem(AUDIO_STORE)||'{}');
    delete bag[key]; localStorage.setItem(AUDIO_STORE, JSON.stringify(bag));
    if(key==='welcome'){ welcomeAudio.removeAttribute('src'); welcomeStatus.textContent='Nenhum arquivo'; }
    if(key==='levelUp'){ levelUpAudio.removeAttribute('src'); levelUpStatus.textContent='Nenhum arquivo'; }
  }

  function handleFileInput(inputEl, key, statusEl, audioEl){
    const file = inputEl.files && inputEl.files[0];
    if(!file) return;
    const reader = new FileReader();
    reader.onload = () => {
      const dataURL = reader.result;
      audioEl.src = dataURL;
      statusEl.textContent = 'Carregado';
      saveAudio(key, dataURL);
    };
    reader.readAsDataURL(file);
  }

  function renderLevels(){
    levelsList.innerHTML='';
    levels.forEach((lvl, idx)=>{
      const row = document.createElement('div');
      row.className = 'level-row' + (idx===currentLevel?' current':'');
      row.innerHTML = `
        <div class="idx">${idx+1}</div>
        <input data-idx="${idx}" data-field="small" value="${lvl.small}">
        <input data-idx="${idx}" data-field="big" value="${lvl.big}">
        <input data-idx="${idx}" data-field="duration" value="${lvl.duration}">
        <div class="actions">
          <button class="btn small add" data-idx="${idx}">+ após</button>
          <button class="btn small danger remove" data-idx="${idx}">rem</button>
        </div>
      `;
      levelsList.appendChild(row);
    });
    levelsList.querySelectorAll('input').forEach(inp=>{
      inp.addEventListener('change', e=>{
        const idx = Number(inp.getAttribute('data-idx'));
        const field = inp.getAttribute('data-field');
        const val = Math.max(1, Number(inp.value)||1);
        levels[idx][field] = val;
        if(field==='small'){ levels[idx].big = val*2; }
        saveState(); render();
      });
    });
    levelsList.querySelectorAll('.add').forEach(btn=>{
      btn.addEventListener('click', e=>{
        const idx = Number(btn.getAttribute('data-idx'));
        const lastSB = levels[levels.length-1].small;
        const pos = Math.max(0, SMALL_SEQUENCE.indexOf(lastSB));
        const next = SMALL_SEQUENCE[Math.min(SMALL_SEQUENCE.length-1, pos+1)];
        levels.splice(idx+1,0,{ id: uid(), small: next, big: next*2, duration: levels[idx].duration });
        saveState(); render();
      });
    });
    levelsList.querySelectorAll('.remove').forEach(btn=>{
      btn.addEventListener('click', e=>{
        const idx = Number(btn.getAttribute('data-idx'));
        if(levels.length<=1) return alert('Precisa ter ao menos 1 nível');
        levels.splice(idx,1);
        if(currentLevel>=levels.length) currentLevel=levels.length-1;
        saveState(); render();
      });
    });
  }

  function formatTime(secs){
    if(secs<0) secs=0;
    const h = Math.floor(secs/3600);
    const m = Math.floor((secs%3600)/60);
    const s = secs%60;
    return `${h}:${String(m).padStart(2,'0')}:${String(s).padStart(2,'0')}`;
  }

  function render(){
    levelIndexEl.textContent = String(currentLevel+1);
    levelCountEl.textContent = String(levels.length);
    smallBlindEl.textContent = levels[currentLevel]?.small ?? '-';
    bigBlindEl.textContent = levels[currentLevel]?.big ?? '-';
    clockEl.textContent = formatTime(secondsLeft);
    renderLevels();
  }

  function show(msg, ms=3500){
    noticeEl.textContent = msg;
    noticeEl.classList.remove('hidden');
    setTimeout(()=>noticeEl.classList.add('hidden'), ms);
  }
  function play(el){ try{ el.currentTime=0; el.play().catch(()=>{}); }catch{} }

  function startTimer(){
    if(running) return;
    running = true;
    startPauseBtn.textContent='Pausar';
    // welcome audio plays on start if available
    if(welcomeAudio && welcomeAudio.src) play(welcomeAudio);

    timer = setInterval(()=>{
      secondsLeft--;
      if(secondsLeft === 60){
        // 1-minute short beep (fallback if no custom audio for this)
        play(beepShort);
        show('Falta 1 minuto para o próximo blind');
      }
      if(secondsLeft <= 0){
        // Level up
        if(levelUpAudio && levelUpAudio.src) play(levelUpAudio); else play(beepLong);
        show('Blinds subiram');
        if(currentLevel+1 < levels.length){
          currentLevel++;
          secondsLeft = levels[currentLevel].duration*60;
        } else {
          clearInterval(timer);
          running=false;
          startPauseBtn.textContent='Iniciar';
          show('Torneio finalizado');
        }
      }
      render();
    }, 1000);
  }
  function pauseTimer(){ running=false; startPauseBtn.textContent='Iniciar'; clearInterval(timer); }
  function resetTimer(){ pauseTimer(); currentLevel=0; secondsLeft=levels[0].duration*60; render(); }
  function nextLevel(){ if(levelUpAudio && levelUpAudio.src) play(levelUpAudio); else play(beepLong); if(currentLevel+1<levels.length){ currentLevel++; secondsLeft=levels[currentLevel].duration*60; } render(); }
  function prevLevel(){ if(currentLevel>0){ currentLevel--; secondsLeft=levels[currentLevel].duration*60; } render(); }

  // Event wiring
  startPauseBtn.addEventListener('click', ()=> running ? pauseTimer() : startTimer());
  resetBtn.addEventListener('click', resetTimer);
  nextBtn.addEventListener('click', nextLevel);
  prevBtn.addEventListener('click', prevLevel);

  generateBtn.addEventListener('click', ()=>{
    const minutes = Number(totalMinutesEl.value)||240;
    const players = Number(numPlayersEl.value)||10;
    const chips = Number(startingChipsEl.value)||5000;
    levels = buildLevels(minutes, players, chips);
    currentLevel=0; secondsLeft=levels[0].duration*60; saveState(); render();
  });
  applyBtn.addEventListener('click', ()=>{ currentLevel=0; secondsLeft=levels[0].duration*60; saveState(); render(); });

  addFinalBtn.addEventListener('click', ()=>{
    const lastSB = levels[levels.length-1].small;
    const idx = Math.max(0, SMALL_SEQUENCE.indexOf(lastSB));
    const nextSB = SMALL_SEQUENCE[Math.min(SMALL_SEQUENCE.length-1, idx+1)];
    levels.push({ id: uid(), small: nextSB, big: nextSB*2, duration: levels[levels.length-1].duration });
    saveState(); render();
  });

  // Upload handlers
  welcomeFile.addEventListener('change', ()=> handleFileInput(welcomeFile, 'welcome', welcomeStatus, welcomeAudio));
  levelUpFile.addEventListener('change', ()=> handleFileInput(levelUpFile, 'levelUp', levelUpStatus, levelUpAudio));
  testWelcome.addEventListener('click', ()=> { if(welcomeAudio.src) welcomeAudio.play(); });
  testLevelUp.addEventListener('click', ()=> { if(levelUpAudio.src) levelUpAudio.play(); });
  clearWelcome.addEventListener('click', ()=> clearAudio('welcome'));
  clearLevelUp.addEventListener('click', ()=> clearAudio('levelUp'));

  document.addEventListener('keydown', (e)=>{
    if(e.key===' '){ e.preventDefault(); running ? pauseTimer() : startTimer(); }
    if(e.key==='ArrowRight') nextLevel();
    if(e.key==='ArrowLeft') prevLevel();
  });

  // Init
  loadState(); loadAudio();
  if(!secondsLeft) secondsLeft = levels[0].duration*60;
  render();
})();
