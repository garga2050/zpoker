// Z Poker 2.1 — chip-aware progression (25/50 start), auto duration per level, beeps + notices
(function(){
  const STORAGE_KEY = 'zpoker_21_state';

  // DOM
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

  const beepShort = document.getElementById('beepShort');
  const beepLong = document.getElementById('beepLong');

  // state
  let levels = []; // {small,big,duration}
  let currentLevel = 0;
  let secondsLeft = 0;
  let running = false;
  let timerInterval = null;

  function uid(){ return Math.random().toString(36).slice(2,9); }

  // Fixed progression based on chip set, starting at 25/50
  // Uses realistic steps avoiding odd values like 75/150 by default.
  const SMALL_SEQUENCE = [25,50,100,200,400,500,1000,2000,4000,5000,10000,20000,40000,50000,100000];

  function buildLevelsFromTotal(totalMinutes, players, startingChips){
    const minutes = Math.max(10, Number(totalMinutes)||240);
    const nPref = Math.round(minutes / 15); // preferred count of levels (~15min per level)
    const n = Math.max(6, Math.min(SMALL_SEQUENCE.length, Math.round(nPref * Math.sqrt((Number(players)||10)/10))));
    const perLevel = Math.max(5, Math.floor(minutes / n)); // min 5 min por nível

    const lvls = [];
    for(let i=0;i<n;i++){
      const sb = SMALL_SEQUENCE[i];
      const bb = sb*2;
      lvls.push({ id: uid(), small: sb, big: bb, duration: perLevel });
    }
    return lvls;
  }

  function save(){
    localStorage.setItem(STORAGE_KEY, JSON.stringify({levels,currentLevel,secondsLeft,running}));
  }
  function load(){
    const raw = localStorage.getItem(STORAGE_KEY);
    if(raw){
      try{
        const p = JSON.parse(raw);
        levels = p.levels ?? [];
        currentLevel = p.currentLevel ?? 0;
        secondsLeft = p.secondsLeft ?? 0;
        running = p.running ?? false;
      }catch{}
    }
    if(!levels || levels.length===0){
      levels = buildLevelsFromTotal(240,10,5000);
      currentLevel = 0;
      secondsLeft = levels[0].duration*60;
    }
  }

  function formatTime(secs){
    if(secs<0) secs=0;
    const h = Math.floor(secs/3600);
    const m = Math.floor((secs%3600)/60);
    const s = secs%60;
    return `${h}:${String(m).padStart(2,'0')}:${String(s).padStart(2,'0')}`;
  }

  function renderLevels(){
    levelsList.innerHTML = '';
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
        const el = e.target;
        const idx = Number(el.getAttribute('data-idx'));
        const field = el.getAttribute('data-field');
        const val = Math.max(1, Number(el.value)||1);
        levels[idx][field] = val;
        if(field==='small'){ levels[idx].big = val*2; } // keep BB=2xSB
        save(); render();
      });
    });
    levelsList.querySelectorAll('.add').forEach(btn=>{
      btn.addEventListener('click', e=>{
        const idx = Number(btn.getAttribute('data-idx'));
        const last = levels[levels.length-1];
        const nextIndex = Math.min(SMALL_SEQUENCE.length-1, SMALL_SEQUENCE.indexOf(last.small)+1);
        const sb = SMALL_SEQUENCE[nextIndex];
        const newLvl = { id: uid(), small: sb, big: sb*2, duration: last.duration };
        levels.splice(idx+1,0,newLvl);
        save(); render();
      });
    });
    levelsList.querySelectorAll('.remove').forEach(btn=>{
      btn.addEventListener('click', e=>{
        const idx = Number(btn.getAttribute('data-idx'));
        if(levels.length<=1) return alert('Precisa ter ao menos 1 nível');
        levels.splice(idx,1);
        if(currentLevel>=levels.length) currentLevel = levels.length-1;
        save(); render();
      });
    });
  }

  function render(){
    levelIndexEl.textContent = String(currentLevel+1);
    levelCountEl.textContent = String(levels.length);
    smallBlindEl.textContent = levels[currentLevel]?.small ?? '-';
    bigBlindEl.textContent = levels[currentLevel]?.big ?? '-';
    clockEl.textContent = formatTime(secondsLeft);
    renderLevels();
  }

  function beep(type){
    try{
      if(type==='short'){ beepShort.currentTime=0; beepShort.play().catch(()=>{}); }
      else { beepLong.currentTime=0; beepLong.play().catch(()=>{}); }
    }catch{}
  }

  function show(msg, ms=4000){
    noticeEl.textContent = msg;
    noticeEl.classList.remove('hidden');
    setTimeout(()=>noticeEl.classList.add('hidden'), ms);
  }

  function startTimer(){
    if(running) return;
    running = true;
    startPauseBtn.textContent = 'Pausar';
    timerInterval = setInterval(()=>{
      secondsLeft--;
      if(secondsLeft === 60){
        beep('short');
        show('Falta 1 minuto para o próximo blind');
      }
      if(secondsLeft <= 0){
        beep('long');
        show('Blinds subiram');
        if(currentLevel+1 < levels.length){
          currentLevel++;
          secondsLeft = levels[currentLevel].duration*60;
        } else {
          clearInterval(timerInterval);
          running = false;
          startPauseBtn.textContent = 'Iniciar';
          show('Torneio finalizado');
        }
      }
      render();
    },1000);
  }
  function pauseTimer(){
    running=false;
    startPauseBtn.textContent = 'Iniciar';
    clearInterval(timerInterval);
  }
  function resetTimer(){
    pauseTimer();
    currentLevel=0;
    secondsLeft=levels[0].duration*60;
    render();
  }
  function nextLevel(){
    beep('long');
    if(currentLevel+1 < levels.length){
      currentLevel++;
      secondsLeft=levels[currentLevel].duration*60;
    }
    render();
  }
  function prevLevel(){
    if(currentLevel>0){
      currentLevel--;
      secondsLeft=levels[currentLevel].duration*60;
    }
    render();
  }

  // Handlers
  startPauseBtn.addEventListener('click', ()=> running ? pauseTimer() : startTimer());
  resetBtn.addEventListener('click', resetTimer);
  nextBtn.addEventListener('click', nextLevel);
  prevBtn.addEventListener('click', prevLevel);

  generateBtn.addEventListener('click', ()=>{
    const minutes = Number(totalMinutesEl.value)||240;
    const players = Number(numPlayersEl.value)||10;
    const chips = Number(startingChipsEl.value)||5000;
    levels = buildLevelsFromTotal(minutes, players, chips);
    currentLevel=0;
    secondsLeft=levels[0].duration*60;
    save(); render();
  });

  applyBtn.addEventListener('click', ()=>{
    currentLevel=0;
    secondsLeft=levels[0].duration*60;
    render();
  });

  addFinalBtn.addEventListener('click', ()=>{
    const lastSB = levels[levels.length-1].small;
    const idx = SMALL_SEQUENCE.indexOf(lastSB);
    const nextIdx = Math.min(SMALL_SEQUENCE.length-1, idx+1);
    const sb = SMALL_SEQUENCE[nextIdx];
    levels.push({ id: uid(), small: sb, big: sb*2, duration: levels[levels.length-1].duration });
    save(); render();
  });

  document.addEventListener('keydown', (e)=>{
    if(e.key===' '){ e.preventDefault(); running ? pauseTimer() : startTimer(); }
    if(e.key==='ArrowRight'){ nextLevel(); }
    if(e.key==='ArrowLeft'){ prevLevel(); }
  });

  // init
  load();
  if(!levels || levels.length===0){
    levels = buildLevelsFromTotal(240,10,5000);
    currentLevel=0;
    secondsLeft=levels[0].duration*60;
  } else if(!secondsLeft){
    secondsLeft=levels[0].duration*60;
  }
  render();
})();
