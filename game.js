/**
 * 다이스 & 스파이어 (Dice & Spire)
 * 5개의 주사위가 각각 독립적인 6면 각인 시스템을 갖춘 완전 독립 주사위 엔진
 */

// ==========================================
// 1. 원소 각인(Enchantment) 정의
// ==========================================
const ENCHANT_TYPES = {
  flame: {
    type: 'flame',
    name: '불꽃',
    icon: '🔥',
    colorClass: 'enchant-flame',
    slotClass: 'slot-flame',
    attackText: '화염 피해 +4 & 화상 2 부여',
    defenseText: '방어도 +3 & 화염 반격(화상 1)',
    procAttack: (game, die) => {
      game.dealDamageToEnemy(4, '화염 폭발');
      game.applyEnemyStatus('burn', 2);
      if (typeof particleEngine !== 'undefined' && particleEngine) {
        const r = game.enemyAreaEl.getBoundingClientRect();
        particleEngine.spawnMagicBurst(r.left + r.width / 2, r.top + r.height / 2);
      }
    },
    procDefense: (game, die) => {
      game.addPlayerShield(3);
      game.applyEnemyStatus('burn', 1);
    }
  },
  dark: {
    type: 'dark',
    name: '암흑',
    icon: '🔮',
    colorClass: 'enchant-dark',
    slotClass: 'slot-dark',
    attackText: '암흑 피해 +3 & 체력 4 흡혈, 적 약화 1',
    defenseText: '적 방패 6 파괴 & 방어도 +4',
    procAttack: (game, die) => {
      game.dealDamageToEnemy(3, '암흑 부식');
      game.healPlayer(4);
      game.applyEnemyStatus('weak', 1);
    },
    procDefense: (game, die) => {
      if (game.enemyShield > 0) {
        const broken = Math.min(game.enemyShield, 6);
        game.enemyShield -= broken;
        game.showFloatingText(`방패 -${broken}`, 'shield-number', game.enemyAreaEl);
      }
      game.addPlayerShield(4);
    }
  },
  holy: {
    type: 'holy',
    name: '신성',
    icon: '✨',
    colorClass: 'enchant-holy',
    slotClass: 'slot-holy',
    attackText: '적 방패를 완전 무시하는 신성 관통 피해 5',
    defenseText: '방어도 1.5배 증폭 및 체력 4 즉시 회복',
    procAttack: (game, die) => {
      game.enemyHp = Math.max(0, game.enemyHp - 5);
      game.showFloatingText('-5 관통', 'crit-number', game.enemyAreaEl);
      soundEngine.playMagicFire();
      game.updateStatsUI();
    },
    procDefense: (game, die) => {
      game.healPlayer(4);
    }
  },
  lightning: {
    type: 'lightning',
    name: '번개',
    icon: '⚡',
    colorClass: 'enchant-lightning',
    slotClass: 'slot-lightning',
    attackText: '벼락 치명타 (주사위 눈 × 2 추가 피해)',
    defenseText: '방어도 +3 및 적에게 5 감전 반격 피해',
    procAttack: (game, die) => {
      const shockDmg = die.value * 2;
      game.dealDamageToEnemy(shockDmg, '치명타 벼락', true);
    },
    procDefense: (game, die) => {
      game.addPlayerShield(3);
      game.dealDamageToEnemy(5, '감전 반격');
    }
  },
  frost: {
    type: 'frost',
    name: '빙결',
    icon: '❄️',
    colorClass: 'enchant-frost',
    slotClass: 'slot-frost',
    attackText: '동상 피해 +3 및 적 다음 턴 공격력 4 감소',
    defenseText: '단단한 빙벽 전개 (방어도 +7 획득)',
    procAttack: (game, die) => {
      game.dealDamageToEnemy(3, '동상');
      if (game.currentIntent && game.currentIntent.type === 'attack') {
        game.currentIntent.val = Math.max(1, game.currentIntent.val - 4);
        game.enemyIntentText.textContent = `${game.currentIntent.text.split(' ')[0]} ${game.currentIntent.val} (빙결 -4)`;
        game.showFloatingText('적 공격력 -4', 'shield-number', game.enemyAreaEl);
      }
    },
    procDefense: (game, die) => {
      game.addPlayerShield(7);
    }
  }
};

// ==========================================
// 2. 몬스터 풀 (층별 난이도)
// ==========================================
const MONSTERS = [
  {
    floor: 1,
    name: '고블린 정찰병',
    tier: '일반',
    sprite: '👺',
    maxHp: 38,
    intents: [
      { type: 'attack', text: '기습 8', val: 8, icon: '⚔️' },
      { type: 'defend', text: '나무 방패 7', val: 7, icon: '🛡️' },
      { type: 'attack', text: '단검 연타 12', val: 12, icon: '💥' }
    ]
  },
  {
    floor: 2,
    name: '포자 슬라임',
    tier: '일반',
    sprite: '🦠',
    maxHp: 52,
    intents: [
      { type: 'attack', text: '산성 침 10', val: 10, icon: '🧪' },
      { type: 'defend', text: '점액 경화 11', val: 11, icon: '🛡️' },
      { type: 'debuff', text: '부식 포자 (약화 6)', val: 6, icon: '💨' }
    ]
  },
  {
    floor: 3,
    name: '해골 근위병',
    tier: '강적',
    sprite: '💀',
    maxHp: 68,
    intents: [
      { type: 'defend', text: '철벽 방진 14', val: 14, icon: '🛡️' },
      { type: 'attack', text: '녹슨 검격 13', val: 13, icon: '⚔️' },
      { type: 'attack', text: '해골 참수타 18', val: 18, icon: '💥' }
    ]
  },
  {
    floor: 4,
    name: '공허의 암살자',
    tier: '엘리트',
    sprite: '🥷',
    maxHp: 86,
    intents: [
      { type: 'attack', text: '그림자 3연격 18', val: 18, icon: '🗡️' },
      { type: 'debuff', text: '신경독 투척 9 + 독', val: 9, icon: '☠️' },
      { type: 'defend', text: '연막 분신술 16', val: 16, icon: '💨' }
    ]
  },
  {
    floor: 5,
    name: '고대 룬 골렘',
    tier: '보스',
    sprite: '🗿',
    maxHp: 135,
    intents: [
      { type: 'attack', text: '지진 분쇄 16', val: 16, icon: '💥' },
      { type: 'defend', text: '고대 마법장막 20', val: 20, icon: '🛡️' },
      { type: 'special', text: '멸망의 파괴광선 28', val: 28, icon: '⚡' }
    ]
  }
];

// ==========================================
// 3. 메인 게임 클래스
// ==========================================
class DiceSpireGame {
  constructor() {
    this.floor = 1;
    this.gold = 50;

    // 플레이어 기본 스탯
    this.playerMaxHp = 65;
    this.playerHp = 65;
    this.playerShield = 0;
    this.playerStatuses = { weak: 0 };

    // 5개의 주사위가 각각 독립적인 6면(1~6)을 보유!
    this.DICE_COUNT = 5;
    this.diceCollection = this.createInitialDiceCollection();

    // 상단 인스펙터에서 현재 보고 있는 주사위 (0 = D1, 1 = D2 ...)
    this.inspectedDieIndex = 0;

    // 전투 중 굴려진 주사위들 (D1~D5)
    this.diceList = [];
    this.selectedDieIndex = null;
    this.baseRerolls = 1;
    this.rerollsLeft = 1;

    // 몬스터 상태
    this.currentEnemy = null;
    this.enemyHp = 0;
    this.enemyShield = 0;
    this.enemyStatuses = { burn: 0, poison: 0, weak: 0 };
    this.currentIntentIndex = 0;

    // 턴 제어
    this.isPlayerTurn = true;
    this.isActionLocked = false;

    this.initElements();
    this.bindEvents();
    this.startBattle();
  }

  // 5개의 완전히 독립된 주사위 초기화
  createInitialDiceCollection() {
    const collection = [];
    for (let i = 0; i < 5; i++) {
      const dieData = {
        index: i,
        name: `D${i + 1}`,
        fullName: `${i + 1}번 주사위`,
        faces: { 1: null, 2: null, 3: null, 4: null, 5: null, 6: null }
      };

      // 초기 시작 선물: 1번 주사위의 1번 면에 불꽃 1 지급
      if (i === 0) {
        dieData.faces[1] = { ...ENCHANT_TYPES.flame, face: 1 };
      }

      collection.push(dieData);
    }
    return collection;
  }

  initElements() {
    this.floorBadge = document.getElementById('floorBadge');
    this.goldCount = document.getElementById('goldCount');
    this.diceTabsEl = document.getElementById('diceTabs');
    this.diceFacesStrip = document.getElementById('diceFacesStrip');

    this.playerAreaEl = document.getElementById('playerArea');
    this.enemyAreaEl = document.getElementById('enemyArea');
    this.playerHpBar = document.getElementById('playerHpBar');
    this.playerHpText = document.getElementById('playerHpText');
    this.playerShieldBadge = document.getElementById('playerShieldBadge');
    this.playerShieldEl = document.getElementById('playerShield');
    this.playerStatusRow = document.getElementById('playerStatusRow');

    this.enemyNameEl = document.getElementById('enemyName');
    this.enemyTierEl = document.getElementById('enemyTier');
    this.enemySpriteEl = document.getElementById('enemySprite');
    this.enemyHpBar = document.getElementById('enemyHpBar');
    this.enemyHpText = document.getElementById('enemyHpText');
    this.enemyShieldBadge = document.getElementById('enemyShieldBadge');
    this.enemyShieldEl = document.getElementById('enemyShield');
    this.enemyStatusRow = document.getElementById('enemyStatusRow');
    this.enemyIntentBubble = document.getElementById('enemyIntentBubble');
    this.enemyIntentIcon = document.getElementById('enemyIntentIcon');
    this.enemyIntentText = document.getElementById('enemyIntentText');

    this.turnIndicator = document.getElementById('turnIndicator');
    this.battleMessage = document.getElementById('battleMessage');

    // 공격 & 방어 존
    this.attackZone = document.getElementById('attackZone');
    this.defenseZone = document.getElementById('defenseZone');
    this.attackDropArea = document.getElementById('attackDropArea');
    this.defenseDropArea = document.getElementById('defenseDropArea');
    this.attackPlaceholder = document.getElementById('attackPlaceholder');
    this.defensePlaceholder = document.getElementById('defensePlaceholder');
    this.attackDiceList = document.getElementById('attackDiceList');
    this.defenseDiceList = document.getElementById('defenseDiceList');
    this.projectedAttackDmg = document.getElementById('projectedAttackDmg');
    this.projectedDefenseShield = document.getElementById('projectedDefenseShield');
    this.attackComboBonus = document.getElementById('attackComboBonus');
    this.defenseComboBonus = document.getElementById('defenseComboBonus');

    // 주사위 풀 및 컨트롤
    this.dicePool = document.getElementById('dicePool');
    this.diceAvailableCount = document.getElementById('diceAvailableCount');
    this.resetDiceBtn = document.getElementById('resetDiceBtn');
    this.rerollAbilityBtn = document.getElementById('rerollAbilityBtn');
    this.quickAttackBtn = document.getElementById('quickAttackBtn');
    this.quickDefenseBtn = document.getElementById('quickDefenseBtn');
    this.endTurnBtn = document.getElementById('endTurnBtn');

    // 보상 모달 2단계 엘리먼트
    this.rewardModal = document.getElementById('rewardModal');
    this.rewardOptionsEl = document.getElementById('rewardOptions');
    this.targetDieSection = document.getElementById('targetDieSection');
    this.targetDiceSelector = document.getElementById('targetDiceSelector');
    this.skipRewardBtn = document.getElementById('skipRewardBtn');
    this.nextFloorBtn = document.getElementById('nextFloorBtn');

    this.gameOverModal = document.getElementById('gameOverModal');
    this.gameOverStats = document.getElementById('gameOverStats');
    this.restartGameBtn = document.getElementById('restartGameBtn');
    this.helpModal = document.getElementById('helpModal');
    this.helpBtn = document.getElementById('helpBtn');
    this.closeHelpBtn = document.getElementById('closeHelpBtn');
    this.audioToggleBtn = document.getElementById('audioToggleBtn');
  }

  bindEvents() {
    this.endTurnBtn.addEventListener('click', () => {
      if (this.isPlayerTurn && !this.isActionLocked) {
        this.executePlayerActionAndEndTurn();
      }
    });

    this.resetDiceBtn.addEventListener('click', () => {
      if (!this.isPlayerTurn || this.isActionLocked) return;
      this.resetAllDiceToPool();
    });

    this.rerollAbilityBtn.addEventListener('click', () => {
      if (!this.isPlayerTurn || this.isActionLocked || this.rerollsLeft <= 0) return;
      this.rerollPoolDice();
    });

    this.quickAttackBtn.addEventListener('click', () => {
      if (!this.isPlayerTurn || this.isActionLocked) return;
      this.allocateAllAvailableTo('attack');
    });

    this.quickDefenseBtn.addEventListener('click', () => {
      if (!this.isPlayerTurn || this.isActionLocked) return;
      this.allocateAllAvailableTo('defense');
    });

    this.attackZone.addEventListener('click', (e) => {
      if (e.target.closest('.quick-allocate-btn') || e.target.closest('.die')) return;
      if (this.selectedDieIndex !== null && this.isPlayerTurn && !this.isActionLocked) {
        this.moveDieToZone(this.selectedDieIndex, 'attack');
      }
    });

    this.defenseZone.addEventListener('click', (e) => {
      if (e.target.closest('.quick-allocate-btn') || e.target.closest('.die')) return;
      if (this.selectedDieIndex !== null && this.isPlayerTurn && !this.isActionLocked) {
        this.moveDieToZone(this.selectedDieIndex, 'defense');
      }
    });

    // 상단 D1~D5 인스펙터 탭 클릭
    this.diceTabsEl.querySelectorAll('.dice-tab').forEach(tab => {
      tab.addEventListener('click', () => {
        const idx = parseInt(tab.dataset.dieIdx, 10);
        this.setInspectedDie(idx);
      });
    });

    this.setupDropZone(this.attackZone, 'attack');
    this.setupDropZone(this.defenseZone, 'defense');
    this.setupDropZone(this.dicePool, 'pool');

    this.skipRewardBtn.addEventListener('click', () => {
      this.gold += 30;
      this.updateGoldDisplay();
      this.rewardModal.style.display = 'none';
      this.nextFloor();
    });

    this.restartGameBtn.addEventListener('click', () => {
      this.restartGame();
    });

    this.helpBtn.addEventListener('click', () => {
      this.helpModal.style.display = 'flex';
    });

    this.closeHelpBtn.addEventListener('click', () => {
      this.helpModal.style.display = 'none';
    });

    this.audioToggleBtn.addEventListener('click', () => {
      const isMuted = soundEngine.toggleMute();
      this.audioToggleBtn.textContent = isMuted ? '🔇' : '🔊';
    });

    window.addEventListener('keydown', (e) => {
      if (e.code === 'Space') {
        e.preventDefault();
        if (this.isPlayerTurn && !this.isActionLocked) {
          this.executePlayerActionAndEndTurn();
        }
      } else if (e.code === 'KeyR') {
        if (this.isPlayerTurn && !this.isActionLocked && this.rerollsLeft > 0) {
          this.rerollPoolDice();
        }
      } else if (e.code === 'KeyA') {
        if (this.isPlayerTurn && !this.isActionLocked) {
          this.allocateAllAvailableTo('attack');
        }
      } else if (e.code === 'KeyD') {
        if (this.isPlayerTurn && !this.isActionLocked) {
          this.allocateAllAvailableTo('defense');
        }
      }
    });
  }

  setInspectedDie(dieIndex) {
    this.inspectedDieIndex = dieIndex;
    this.diceTabsEl.querySelectorAll('.dice-tab').forEach((tab, i) => {
      tab.classList.toggle('active', i === dieIndex);
    });
    this.renderDiceFacesStrip();
  }

  setupDropZone(zoneElement, targetZoneName) {
    zoneElement.addEventListener('dragover', (e) => {
      e.preventDefault();
      if (this.isPlayerTurn && !this.isActionLocked) {
        zoneElement.classList.add('drag-over');
      }
    });

    zoneElement.addEventListener('dragleave', () => {
      zoneElement.classList.remove('drag-over');
    });

    zoneElement.addEventListener('drop', (e) => {
      e.preventDefault();
      zoneElement.classList.remove('drag-over');
      const dieIdxStr = e.dataTransfer.getData('text/plain');
      const dieIdx = parseInt(dieIdxStr, 10);
      if (!isNaN(dieIdx) && this.isPlayerTurn && !this.isActionLocked) {
        this.moveDieToZone(dieIdx, targetZoneName);
      }
    });
  }

  // ==========================================
  // 전투 시작 및 층 진입
  // ==========================================
  startBattle() {
    const enemyData = MONSTERS.find(m => m.floor === this.floor) || MONSTERS[MONSTERS.length - 1];
    this.currentEnemy = { ...enemyData };
    this.enemyHp = this.currentEnemy.maxHp;
    this.enemyShield = 0;
    this.playerShield = 0;
    this.enemyStatuses = { burn: 0, poison: 0, weak: 0 };
    this.playerStatuses = { weak: 0 };
    this.currentIntentIndex = 0;

    this.floorBadge.textContent = `층: ${this.floor}F (${this.currentEnemy.tier})`;
    this.enemyNameEl.textContent = this.currentEnemy.name;
    this.enemyTierEl.textContent = this.currentEnemy.tier;
    this.enemySpriteEl.textContent = this.currentEnemy.sprite;

    this.renderDiceFacesStrip();
    this.updateStatsUI();
    this.startPlayerTurn();
  }

  // ==========================================
  // 플레이어 턴 시작
  // ==========================================
  startPlayerTurn() {
    this.isPlayerTurn = true;
    this.isActionLocked = false;
    this.turnIndicator.textContent = '당신의 턴';
    this.turnIndicator.style.color = 'var(--accent-cyan)';
    this.endTurnBtn.disabled = false;
    this.battleMessage.textContent = '독립된 5개의 주사위를 굴렸습니다. 공격 존과 방어 존에 배분하세요!';

    this.playerShield = 0;
    this.rerollsLeft = this.baseRerolls;
    this.rerollAbilityBtn.disabled = false;
    this.rerollAbilityBtn.textContent = `🎲 재굴림 (${this.rerollsLeft})`;

    this.pickEnemyIntent();

    // 5개의 독립된 주사위 각각 굴리기!
    this.rollIndependentDice();
    this.updateStatsUI();
  }

  // 5개의 주사위가 각각 자신의 6개 면을 참조하여 굴려짐
  rollIndependentDice() {
    soundEngine.playDiceRoll();
    this.diceList = [];
    this.selectedDieIndex = null;

    for (let i = 0; i < this.DICE_COUNT; i++) {
      const dieSystem = this.diceCollection[i];
      const val = Math.floor(Math.random() * 6) + 1;
      const enchant = dieSystem.faces[val] || null;

      this.diceList.push({
        id: `die_${Date.now()}_${i}`,
        dieIndex: i, // 0 to 4 (D1 ~ D5)
        dieName: dieSystem.name,
        value: val,
        enchant: enchant,
        zone: 'pool',
        selected: false
      });
    }

    this.renderAllDice();
    this.calculateProjections();
  }

  rerollPoolDice() {
    const poolDice = this.diceList.filter(d => d.zone === 'pool');
    if (poolDice.length === 0) {
      this.battleMessage.textContent = '재굴림할 미할당 주사위가 없습니다!';
      return;
    }

    this.rerollsLeft--;
    this.rerollAbilityBtn.textContent = `🎲 재굴림 (${this.rerollsLeft})`;
    if (this.rerollsLeft <= 0) {
      this.rerollAbilityBtn.disabled = true;
    }

    soundEngine.playDiceRoll();
    poolDice.forEach(d => {
      const dieSystem = this.diceCollection[d.dieIndex];
      const val = Math.floor(Math.random() * 6) + 1;
      d.value = val;
      d.enchant = dieSystem.faces[val] || null;
    });

    this.selectedDieIndex = null;
    this.renderAllDice();
    this.calculateProjections();
    this.battleMessage.textContent = '남은 주사위를 다시 굴렸습니다!';
  }

  resetAllDiceToPool() {
    soundEngine.playDiceSlot();
    this.diceList.forEach(d => {
      d.zone = 'pool';
      d.selected = false;
    });
    this.selectedDieIndex = null;
    this.renderAllDice();
    this.calculateProjections();
    this.battleMessage.textContent = '모든 주사위를 풀로 회수했습니다.';
  }

  allocateAllAvailableTo(targetZone) {
    soundEngine.playDiceSlot();
    let moved = 0;
    this.diceList.forEach(d => {
      if (d.zone === 'pool') {
        d.zone = targetZone;
        d.selected = false;
        moved++;
      }
    });

    this.selectedDieIndex = null;
    this.renderAllDice();
    this.calculateProjections();
    const zoneName = targetZone === 'attack' ? '공격 존' : '방어 존';
    this.battleMessage.textContent = `미할당 주사위 ${moved}개를 ${zoneName}에 일괄 배치했습니다.`;
  }

  moveDieToZone(dieIndex, targetZone) {
    const die = this.diceList[dieIndex];
    if (!die) return;

    soundEngine.playDiceSlot();
    die.zone = targetZone;
    die.selected = false;
    this.selectedDieIndex = null;

    this.renderAllDice();
    this.calculateProjections();
  }

  // ==========================================
  // 주사위 렌더링 (D1~D5 배지 및 원소 각인 반영)
  // ==========================================
  renderAllDice() {
    this.dicePool.innerHTML = '';
    this.attackDiceList.innerHTML = '';
    this.defenseDiceList.innerHTML = '';

    const poolDice = this.diceList.filter(d => d.zone === 'pool');
    const attackDice = this.diceList.filter(d => d.zone === 'attack');
    const defenseDice = this.diceList.filter(d => d.zone === 'defense');

    this.diceAvailableCount.textContent = poolDice.length;

    this.attackPlaceholder.style.display = attackDice.length === 0 ? 'flex' : 'none';
    this.defensePlaceholder.style.display = defenseDice.length === 0 ? 'flex' : 'none';

    if (this.selectedDieIndex !== null) {
      this.attackZone.classList.add('active-target');
      this.defenseZone.classList.add('active-target');
    } else {
      this.attackZone.classList.remove('active-target');
      this.defenseZone.classList.remove('active-target');
    }

    this.diceList.forEach((die, index) => {
      const dieEl = this.createDieElement(die, index);

      if (die.zone === 'pool') {
        this.dicePool.appendChild(dieEl);
      } else if (die.zone === 'attack') {
        this.attackDiceList.appendChild(dieEl);
      } else if (die.zone === 'defense') {
        this.defenseDiceList.appendChild(dieEl);
      }
    });
  }

  createDieElement(die, index) {
    const dieEl = document.createElement('div');
    const enchantClass = die.enchant ? die.enchant.colorClass : '';
    dieEl.className = `die ${enchantClass} ${die.selected ? 'selected' : ''}`;
    dieEl.draggable = this.isPlayerTurn && !this.isActionLocked;

    // 1. D1~D5 주사위 고유 식별 배지
    const idBadge = document.createElement('div');
    idBadge.className = 'die-id-badge';
    idBadge.textContent = die.dieName;
    dieEl.appendChild(idBadge);

    // 2. 각인 아이콘 태그 (불꽃, 암흑 등)
    if (die.enchant) {
      const tag = document.createElement('div');
      tag.className = 'die-enchant-tag';
      tag.textContent = die.enchant.icon;
      tag.title = `[${die.dieName}] ${die.enchant.name} ${die.value}: ${die.enchant.attackText}`;
      dieEl.appendChild(tag);
    } else {
      dieEl.title = `[${die.dieName}] 일반 주사위 (눈금: ${die.value})`;
    }

    this.createPips(dieEl, die.value);

    dieEl.addEventListener('click', (e) => {
      e.stopPropagation();
      if (!this.isPlayerTurn || this.isActionLocked) return;

      if (die.zone !== 'pool') {
        this.moveDieToZone(index, 'pool');
      } else {
        if (this.selectedDieIndex === index) {
          die.selected = false;
          this.selectedDieIndex = null;
        } else {
          this.diceList.forEach((d, i) => d.selected = (i === index));
          this.selectedDieIndex = index;
        }
        this.renderAllDice();
      }
    });

    dieEl.addEventListener('dragstart', (e) => {
      if (!this.isPlayerTurn || this.isActionLocked) {
        e.preventDefault();
        return;
      }
      e.dataTransfer.setData('text/plain', index.toString());
    });

    return dieEl;
  }

  createPips(dieEl, value) {
    const pipPositions = {
      1: [[2, 2]],
      2: [[1, 1], [3, 3]],
      3: [[1, 1], [2, 2], [3, 3]],
      4: [[1, 1], [1, 3], [3, 1], [3, 3]],
      5: [[1, 1], [1, 3], [2, 2], [3, 1], [3, 3]],
      6: [[1, 1], [1, 3], [2, 1], [2, 3], [3, 1], [3, 3]]
    };

    const positions = pipPositions[value] || [];
    positions.forEach(([row, col]) => {
      const pip = document.createElement('div');
      pip.className = 'pip';
      pip.style.gridRow = row;
      pip.style.gridColumn = col;
      dieEl.appendChild(pip);
    });
  }

  // ==========================================
  // 상단 인스펙터: 선택된 주사위의 6면 렌더링
  // ==========================================
  renderDiceFacesStrip() {
    this.diceFacesStrip.innerHTML = '';
    const currentDie = this.diceCollection[this.inspectedDieIndex];

    for (let faceNum = 1; faceNum <= 6; faceNum++) {
      const enchant = currentDie.faces[faceNum];
      const slotEl = document.createElement('div');
      const slotClass = enchant ? enchant.slotClass : '';
      slotEl.className = `face-preview-slot ${slotClass}`;

      if (enchant) {
        slotEl.innerHTML = `
          <span class="face-icon">${enchant.icon}</span>
          <span>${faceNum}</span>
        `;
        slotEl.title = `[${currentDie.fullName}] ${faceNum}번 면: [${enchant.name} ${faceNum}]\n공격: ${enchant.attackText}\n방어: ${enchant.defenseText}`;
      } else {
        slotEl.innerHTML = `<span>${faceNum}</span>`;
        slotEl.title = `[${currentDie.fullName}] ${faceNum}번 면: 일반`;
      }

      this.diceFacesStrip.appendChild(slotEl);
    }
  }

  // ==========================================
  // 실시간 예상 공격/방어력 연산
  // ==========================================
  calculateProjections() {
    const attackDice = this.diceList.filter(d => d.zone === 'attack');
    const defenseDice = this.diceList.filter(d => d.zone === 'defense');

    const attackCalc = this.evaluateZoneDice(attackDice, 'attack');
    const defenseCalc = this.evaluateZoneDice(defenseDice, 'defense');

    this.projectedAttackDmg.textContent = attackCalc.total;
    this.projectedDefenseShield.textContent = defenseCalc.total;

    this.attackComboBonus.textContent = attackCalc.description;
    this.defenseComboBonus.textContent = defenseCalc.description;

    this.currentAttackCalculation = attackCalc;
    this.currentDefenseCalculation = defenseCalc;
  }

  evaluateZoneDice(dice, zoneType) {
    if (dice.length === 0) {
      return {
        baseSum: 0,
        comboBonus: 0,
        enchantBonus: 0,
        total: 0,
        description: '할당된 주사위가 없습니다.'
      };
    }

    const values = dice.map(d => d.value).sort((a, b) => a - b);
    const baseSum = values.reduce((acc, v) => acc + v, 0);

    // 1. 콤보 계산
    const counts = {};
    values.forEach(v => counts[v] = (counts[v] || 0) + 1);
    const countVals = Object.values(counts);

    let comboBonus = 0;
    let comboNames = [];

    if (countVals.includes(5)) {
      comboBonus += 15;
      comboNames.push('오복(5-of-a-kind): +15');
    } else if (countVals.includes(4)) {
      comboBonus += 10;
      comboNames.push('포카드: +10');
    } else if (countVals.includes(3)) {
      comboBonus += 6;
      comboNames.push('트리플: +6');
      if (countVals.includes(2)) {
        comboBonus += 4;
        comboNames.push('풀하우스: +4');
      }
    } else if (countVals.filter(c => c === 2).length >= 2) {
      comboBonus += 6;
      comboNames.push('더블 페어: +6');
    } else if (countVals.includes(2)) {
      comboBonus += 3;
      comboNames.push('페어: +3');
    }

    const uniqueVals = [...new Set(values)];
    if (uniqueVals.length >= 3) {
      let maxConsecutive = 1;
      let curConsecutive = 1;
      for (let i = 0; i < uniqueVals.length - 1; i++) {
        if (uniqueVals[i + 1] === uniqueVals[i] + 1) {
          curConsecutive++;
          if (curConsecutive > maxConsecutive) maxConsecutive = curConsecutive;
        } else {
          curConsecutive = 1;
        }
      }
      if (maxConsecutive >= 4) {
        comboBonus += 8;
        comboNames.push('빅 스트레이트: +8');
      } else if (maxConsecutive === 3) {
        comboBonus += 5;
        comboNames.push('스트레이트: +5');
      }
    }

    // 2. 각 주사위 고유 원소 각인 보너스
    let enchantBonus = 0;
    let enchantDescriptions = [];
    let hasHolyDefense = false;

    dice.forEach(d => {
      if (!d.enchant) return;
      if (zoneType === 'attack') {
        if (d.enchant.type === 'flame') {
          enchantBonus += 4;
          enchantDescriptions.push(`${d.dieName}:🔥화염 +4`);
        } else if (d.enchant.type === 'dark') {
          enchantBonus += 3;
          enchantDescriptions.push(`${d.dieName}:🔮암흑 +3`);
        } else if (d.enchant.type === 'holy') {
          enchantDescriptions.push(`${d.dieName}:✨신성관통 5`);
        } else if (d.enchant.type === 'lightning') {
          const lDmg = d.value * 2;
          enchantBonus += lDmg;
          enchantDescriptions.push(`${d.dieName}:⚡벼락 +${lDmg}`);
        } else if (d.enchant.type === 'frost') {
          enchantBonus += 3;
          enchantDescriptions.push(`${d.dieName}:❄️동상 +3`);
        }
      } else {
        if (d.enchant.type === 'flame') {
          enchantBonus += 3;
          enchantDescriptions.push(`${d.dieName}:🔥반격화염 +3`);
        } else if (d.enchant.type === 'dark') {
          enchantBonus += 4;
          enchantDescriptions.push(`${d.dieName}:🔮암흑방패 +4`);
        } else if (d.enchant.type === 'holy') {
          hasHolyDefense = true;
          enchantDescriptions.push(`${d.dieName}:✨신성 1.5배`);
        } else if (d.enchant.type === 'lightning') {
          enchantBonus += 3;
          enchantDescriptions.push(`${d.dieName}:⚡감전방패 +3`);
        } else if (d.enchant.type === 'frost') {
          enchantBonus += 7;
          enchantDescriptions.push(`${d.dieName}:❄️빙벽 +7`);
        }
      }
    });

    let total = baseSum + comboBonus + enchantBonus;
    if (zoneType === 'defense' && hasHolyDefense) {
      total = Math.floor(total * 1.5);
    }

    let desc = `기본 ${baseSum}`;
    if (comboNames.length > 0) desc += ` + [${comboNames.join(', ')}]`;
    if (enchantDescriptions.length > 0) desc += ` + [${enchantDescriptions.join(', ')}]`;
    desc += ` = 총 ${total}`;

    return {
      baseSum,
      comboBonus,
      enchantBonus,
      total,
      description: desc,
      dice
    };
  }

  // ==========================================
  // 행동 실행 (공격 -> 원소 효과 -> 방어 -> 적 턴)
  // ==========================================
  executePlayerActionAndEndTurn() {
    this.isPlayerTurn = false;
    this.isActionLocked = true;
    this.endTurnBtn.disabled = true;
    this.turnIndicator.textContent = '행동 실행 중...';

    const attackCalc = this.currentAttackCalculation || { total: 0, dice: [] };
    const defenseCalc = this.currentDefenseCalculation || { total: 0, dice: [] };

    // 1. 공격 발동
    if (attackCalc.total > 0) {
      soundEngine.playSlash();
      this.dealDamageToEnemy(attackCalc.total, '전술 공격', attackCalc.comboBonus > 0);

      attackCalc.dice.forEach(d => {
        if (d.enchant && d.enchant.procAttack) {
          d.enchant.procAttack(this, d);
        }
      });
    }

    // 2. 방어도 획득
    if (defenseCalc.total > 0) {
      setTimeout(() => {
        soundEngine.playShieldBlock();
        this.addPlayerShield(defenseCalc.total);

        defenseCalc.dice.forEach(d => {
          if (d.enchant && d.enchant.procDefense) {
            d.enchant.procDefense(this, d);
          }
        });
      }, 300);
    }

    if (this.enemyHp <= 0) {
      setTimeout(() => this.handleVictory(), 600);
      return;
    }

    setTimeout(() => {
      this.turnIndicator.textContent = '몬스터 턴...';
      this.turnIndicator.style.color = 'var(--accent-red)';
      this.battleMessage.textContent = '적의 공격을 대비하세요!';
      this.executeEnemyTurn();
    }, 1000);
  }

  executeEnemyTurn() {
    if (this.enemyStatuses.burn > 0) {
      const burnDmg = this.enemyStatuses.burn;
      this.enemyHp = Math.max(0, this.enemyHp - burnDmg);
      this.showFloatingText(`화상 -${burnDmg}`, 'dmg-number', this.enemyAreaEl);
      this.enemyStatuses.burn = Math.max(0, this.enemyStatuses.burn - 1);
    }
    if (this.enemyStatuses.poison > 0) {
      const poisonDmg = this.enemyStatuses.poison;
      this.enemyHp = Math.max(0, this.enemyHp - poisonDmg);
      this.showFloatingText(`독 -${poisonDmg}`, 'dmg-number', this.enemyAreaEl);
      this.enemyStatuses.poison = Math.max(0, this.enemyStatuses.poison - 1);
    }

    this.updateStatsUI();

    if (this.enemyHp <= 0) {
      this.handleVictory();
      return;
    }

    const intent = this.currentIntent;
    setTimeout(() => {
      if (intent.type === 'attack') {
        soundEngine.playSlash();
        this.dealDamageToPlayer(intent.val);
      } else if (intent.type === 'defend') {
        soundEngine.playShieldBlock();
        this.enemyShield += intent.val;
        this.showFloatingText(`+${intent.val} 방어`, 'shield-number', this.enemyAreaEl);
      } else if (intent.type === 'debuff') {
        this.playerStatuses.weak = 2;
        this.dealDamageToPlayer(intent.val);
        this.battleMessage.textContent = '적의 디버프로 플레이어가 약화되었습니다!';
      } else if (intent.type === 'special') {
        soundEngine.playMagicFire();
        this.dealDamageToPlayer(intent.val);
      }

      this.currentIntentIndex++;
      this.updateStatsUI();

      if (this.playerHp <= 0) {
        setTimeout(() => this.handleDefeat(), 600);
        return;
      }

      setTimeout(() => {
        this.startPlayerTurn();
      }, 1000);
    }, 600);
  }

  // ==========================================
  // 데미지 / 쉴드 헬퍼
  // ==========================================
  dealDamageToEnemy(dmg, skillName, isCrit = false) {
    let finalDmg = dmg;
    if (this.playerStatuses.weak > 0) {
      finalDmg = Math.max(1, Math.floor(finalDmg * 0.75));
    }

    let effectiveDmg = finalDmg;
    if (this.enemyShield > 0) {
      if (this.enemyShield >= effectiveDmg) {
        this.enemyShield -= effectiveDmg;
        this.showFloatingText(`-${effectiveDmg} 방어`, 'shield-number', this.enemyAreaEl);
        effectiveDmg = 0;
      } else {
        effectiveDmg -= this.enemyShield;
        this.showFloatingText('방패 파괴!', 'shield-number', this.enemyAreaEl);
        this.enemyShield = 0;
      }
    }

    if (effectiveDmg > 0) {
      this.enemyHp = Math.max(0, this.enemyHp - effectiveDmg);
      const styleClass = isCrit ? 'crit-number' : 'dmg-number';
      this.showFloatingText(`-${effectiveDmg}`, styleClass, this.enemyAreaEl);

      this.triggerHitFeedback(this.enemyAreaEl);
      if (typeof particleEngine !== 'undefined' && particleEngine) {
        const rect = this.enemyAreaEl.getBoundingClientRect();
        particleEngine.spawnHitSparks(rect.left + rect.width / 2, rect.top + rect.height / 3);
      }
    }

    this.battleMessage.textContent = `⚔️ [${skillName}] 발동! 적에게 ${finalDmg} 피해를 입혔습니다!`;
    this.updateStatsUI();
  }

  dealDamageToPlayer(dmg) {
    let effectiveDmg = dmg;
    if (this.playerShield > 0) {
      if (this.playerShield >= effectiveDmg) {
        this.playerShield -= effectiveDmg;
        this.showFloatingText(`-${effectiveDmg} 흡수!`, 'shield-number', this.playerAreaEl);
        effectiveDmg = 0;
      } else {
        effectiveDmg -= this.playerShield;
        this.showFloatingText('방패 파괴!', 'shield-number', this.playerAreaEl);
        this.playerShield = 0;
      }
    }

    if (effectiveDmg > 0) {
      this.playerHp = Math.max(0, this.playerHp - effectiveDmg);
      this.showFloatingText(`-${effectiveDmg}`, 'dmg-number', this.playerAreaEl);
      this.triggerHitFeedback(this.playerAreaEl);
    }
  }

  addPlayerShield(amount) {
    this.playerShield += amount;
    this.showFloatingText(`+${amount} 방어`, 'shield-number', this.playerAreaEl);
    if (typeof particleEngine !== 'undefined' && particleEngine) {
      const rect = this.playerAreaEl.getBoundingClientRect();
      particleEngine.spawnShieldBurst(rect.left + rect.width / 2, rect.top + rect.height / 2);
    }
    this.updateStatsUI();
  }

  healPlayer(amount) {
    const prev = this.playerHp;
    this.playerHp = Math.min(this.playerMaxHp, this.playerHp + amount);
    const healed = this.playerHp - prev;
    if (healed > 0) {
      this.showFloatingText(`+${healed} 회복`, 'heal-number', this.playerAreaEl);
      this.updateStatsUI();
    }
  }

  applyEnemyStatus(type, stacks) {
    this.enemyStatuses[type] = (this.enemyStatuses[type] || 0) + stacks;
    this.updateStatsUI();
  }

  pickEnemyIntent() {
    const intents = this.currentEnemy.intents;
    this.currentIntent = intents[this.currentIntentIndex % intents.length];
    this.enemyIntentIcon.textContent = this.currentIntent.icon;
    this.enemyIntentText.textContent = this.currentIntent.text;
  }

  triggerHitFeedback(element) {
    element.classList.remove('shake', 'hit-flash');
    void element.offsetWidth;
    element.classList.add('shake', 'hit-flash');
    setTimeout(() => {
      element.classList.remove('shake', 'hit-flash');
    }, 350);
  }

  showFloatingText(text, className, targetEl) {
    const floatEl = document.createElement('div');
    floatEl.className = `floating-number ${className}`;
    floatEl.textContent = text;

    const rect = targetEl.getBoundingClientRect();
    floatEl.style.left = `${rect.left + rect.width / 2 - 40}px`;
    floatEl.style.top = `${rect.top + 20}px`;

    document.body.appendChild(floatEl);
    setTimeout(() => floatEl.remove(), 1000);
  }

  // ==========================================
  // 승리 및 2단계 각인 보상 선택 (원소 면 선택 -> 대상 주사위 D1~D5 선택)
  // ==========================================
  handleVictory() {
    soundEngine.playVictory();
    this.isActionLocked = true;
    this.gold += 30;
    this.updateGoldDisplay();

    setTimeout(() => {
      this.openRewardModal();
    }, 800);
  }

  openRewardModal() {
    this.rewardModal.style.display = 'flex';
    this.rewardOptionsEl.innerHTML = '';
    this.targetDieSection.style.display = 'none';
    this.targetDiceSelector.innerHTML = '';
    this.nextFloorBtn.disabled = true;

    // 1단계: 3개의 무작위 원소 면(Face + Element) 선택지 생성
    // 예: [불꽃 1], [암흑 5], [신성 3]
    const faces = [1, 2, 3, 4, 5, 6].sort(() => 0.5 - Math.random()).slice(0, 3);
    const elementKeys = Object.keys(ENCHANT_TYPES).sort(() => 0.5 - Math.random());

    const options = faces.map((faceNum, idx) => {
      const elemKey = elementKeys[idx % elementKeys.length];
      const enchantDef = ENCHANT_TYPES[elemKey];
      return {
        face: faceNum,
        enchant: { ...enchantDef, face: faceNum }
      };
    });

    let selectedEssence = null;
    let selectedTargetDieIdx = null;

    options.forEach(opt => {
      const cardEl = document.createElement('div');
      cardEl.className = `reward-card enchant-card ${opt.enchant.colorClass}`;
      cardEl.innerHTML = `
        <div class="card-header">
          <span class="card-title">${opt.enchant.icon} ${opt.enchant.name} ${opt.face}</span>
          <span class="enchant-face-badge">[ ${opt.face}번 면 각인 ]</span>
        </div>
        <div style="font-size: 0.8rem; margin: 8px 0; line-height: 1.4;">
          <p style="color: #fca5a5;">⚔️ <strong>공격:</strong> ${opt.enchant.attackText}</p>
          <p style="color: #bae6fd; margin-top: 4px;">🛡️ <strong>방어:</strong> ${opt.enchant.defenseText}</p>
        </div>
      `;

      cardEl.addEventListener('click', () => {
        this.rewardOptionsEl.querySelectorAll('.reward-card').forEach(c => c.classList.remove('selected-reward'));
        cardEl.classList.add('selected-reward');
        selectedEssence = opt;
        soundEngine.playDiceSlot();

        // 2단계: 대상 주사위 (D1 ~ D5) 선택기 활성화
        this.renderTargetDiceSelector(selectedEssence, (targetDieIdx) => {
          selectedTargetDieIdx = targetDieIdx;
          this.nextFloorBtn.disabled = false;
        });
      });

      this.rewardOptionsEl.appendChild(cardEl);
    });

    this.nextFloorBtn.onclick = () => {
      if (selectedEssence && selectedTargetDieIdx !== null) {
        soundEngine.playEnchant();

        // 선택한 주사위 1개의 해당 면만 독립적으로 각인!
        this.diceCollection[selectedTargetDieIdx].faces[selectedEssence.face] = selectedEssence.enchant;

        // 인스펙터를 방금 강화한 주사위로 전환하여 즉시 눈으로 확인 가능
        this.setInspectedDie(selectedTargetDieIdx);
      }
      this.rewardModal.style.display = 'none';
      this.nextFloor();
    };
  }

  // 2단계: 각인할 주사위(D1~D5) 선택 버튼 렌더링
  renderTargetDiceSelector(essence, onSelect) {
    this.targetDieSection.style.display = 'flex';
    this.targetDiceSelector.innerHTML = '';
    this.nextFloorBtn.disabled = true;

    this.diceCollection.forEach((die, idx) => {
      const currentFace = die.faces[essence.face];
      const curDesc = currentFace ? `${currentFace.icon}${currentFace.name}` : '일반';

      const btn = document.createElement('div');
      btn.className = 'target-die-btn';
      btn.innerHTML = `
        <span class="die-name">🎲 ${die.name}</span>
        <span class="current-face-status">${essence.face}번면: ${curDesc}</span>
      `;

      btn.addEventListener('click', () => {
        this.targetDiceSelector.querySelectorAll('.target-die-btn').forEach(b => b.classList.remove('selected'));
        btn.classList.add('selected');
        soundEngine.playDiceSlot();
        onSelect(idx);
      });

      this.targetDiceSelector.appendChild(btn);
    });
  }

  nextFloor() {
    this.floor++;
    if (this.floor > MONSTERS.length) {
      alert('🏆 경축! 5층의 모든 몬스터와 고대 룬 골렘을 정복하셨습니다!');
      this.floor = 1;
      this.playerHp = this.playerMaxHp;
      this.diceCollection = this.createInitialDiceCollection();
    } else {
      this.healPlayer(15);
    }
    this.startBattle();
  }

  // ==========================================
  // 패배 및 재시작
  // ==========================================
  handleDefeat() {
    soundEngine.playDefeat();
    this.gameOverStats.textContent = `도달한 층: ${this.floor}F | 최종 획득 골드: ${this.gold} G`;
    this.gameOverModal.style.display = 'flex';
  }

  restartGame() {
    this.floor = 1;
    this.gold = 50;
    this.playerHp = this.playerMaxHp;
    this.diceCollection = this.createInitialDiceCollection();
    this.gameOverModal.style.display = 'none';
    this.startBattle();
  }

  // ==========================================
  // UI 갱신
  // ==========================================
  updateStatsUI() {
    const pPct = Math.max(0, (this.playerHp / this.playerMaxHp) * 100);
    this.playerHpBar.style.width = `${pPct}%`;
    this.playerHpText.textContent = `${this.playerHp} / ${this.playerMaxHp}`;

    if (this.playerShield > 0) {
      this.playerShieldBadge.style.display = 'flex';
      this.playerShieldEl.textContent = this.playerShield;
    } else {
      this.playerShieldBadge.style.display = 'none';
    }

    if (this.currentEnemy) {
      const ePct = Math.max(0, (this.enemyHp / this.currentEnemy.maxHp) * 100);
      this.enemyHpBar.style.width = `${ePct}%`;
      this.enemyHpText.textContent = `${this.enemyHp} / ${this.currentEnemy.maxHp}`;
    }

    if (this.enemyShield > 0) {
      this.enemyShieldBadge.style.display = 'flex';
      this.enemyShieldEl.textContent = this.enemyShield;
    } else {
      this.enemyShieldBadge.style.display = 'none';
    }

    this.renderStatuses();
  }

  renderStatuses() {
    this.playerStatusRow.innerHTML = '';
    if (this.playerStatuses.weak > 0) {
      this.playerStatusRow.innerHTML += `<span class="status-tag status-weak">약화 ${this.playerStatuses.weak}</span>`;
    }

    this.enemyStatusRow.innerHTML = '';
    if (this.enemyStatuses.burn > 0) {
      this.enemyStatusRow.innerHTML += `<span class="status-tag status-burn">🔥 화상 ${this.enemyStatuses.burn}</span>`;
    }
    if (this.enemyStatuses.poison > 0) {
      this.enemyStatusRow.innerHTML += `<span class="status-tag status-burn" style="border-color:#10b981; color:#6ee7b7;">☠️ 독 ${this.enemyStatuses.poison}</span>`;
    }
    if (this.enemyStatuses.weak > 0) {
      this.enemyStatusRow.innerHTML += `<span class="status-tag status-weak">약화 ${this.enemyStatuses.weak}</span>`;
    }
  }

  updateGoldDisplay() {
    this.goldCount.textContent = this.gold;
  }
}

// 브라우저 로드 시 게임 시작
window.addEventListener('DOMContentLoaded', () => {
  window.game = new DiceSpireGame();
});
