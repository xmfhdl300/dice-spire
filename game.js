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
// 2. 소비 아이템: 타로 카드 (Tarot Cards) 정의 (2칸 슬롯 전용)
// ==========================================
const TAROT_CARDS = {
  fool: {
    id: 'fool',
    num: '0',
    name: '광대',
    subName: 'The Fool',
    icon: '🃏',
    desc: '모든 미할당 주사위의 눈금을 즉시 +1 증가시키고 재굴림 횟수 +1 충전',
    use: (game) => {
      let boosted = 0;
      game.diceList.filter(d => d.zone === 'pool').forEach(d => {
        if (d.value < 6) {
          d.value++;
          boosted++;
        }
      });
      game.rerollsLeft++;
      game.rerollAbilityBtn.textContent = `🎲 재굴림 (${game.rerollsLeft})`;
      game.rerollAbilityBtn.disabled = false;
      game.renderAllDice();
      game.calculateProjections();
      game.showFloatingText('+1 눈금 & 재굴림!', 'heal-number', game.playerAreaEl);
      game.battleMessage.textContent = '🃏 [광대] 발동! 주사위 눈금이 +1 상승하고 재굴림 기회를 1회 얻었습니다!';
    }
  },
  magician: {
    id: 'magician',
    num: 'I',
    name: '마법사',
    subName: 'The Magician',
    icon: '🪄',
    desc: '이번 턴 미할당 주사위 2개에 🔥 불꽃 각인(화염+4)을 즉시 부여',
    use: (game) => {
      const poolDice = game.diceList.filter(d => d.zone === 'pool');
      const targets = poolDice.slice(0, 2);
      targets.forEach(d => {
        d.enchant = { ...ENCHANT_TYPES.flame, face: d.value };
      });
      game.renderAllDice();
      game.calculateProjections();
      soundEngine.playMagicFire();
      game.showFloatingText('🔥 불꽃 부여!', 'crit-number', game.playerAreaEl);
      game.battleMessage.textContent = '🪄 [마법사] 발동! 주사위에 불꽃 원소 마법이 깃들었습니다!';
    }
  },
  priestess: {
    id: 'priestess',
    num: 'II',
    name: '여사제',
    subName: 'High Priestess',
    icon: '🌙',
    desc: '체력을 14 즉시 치유하고 방어도 +8 획득',
    use: (game) => {
      game.healPlayer(14);
      game.addPlayerShield(8);
      soundEngine.playMagicFire();
      game.battleMessage.textContent = '🌙 [여사제] 발동! 체력 14 회복 및 방어도 +8을 얻었습니다!';
    }
  },
  empress: {
    id: 'empress',
    num: 'III',
    name: '여황제',
    subName: 'The Empress',
    icon: '👑',
    desc: '이번 턴 공격 존의 최종 피해량을 1.5배로 폭발 증폭',
    use: (game) => {
      game.tarotBuffs.attackMultiplier = (game.tarotBuffs.attackMultiplier || 1) * 1.5;
      game.calculateProjections();
      soundEngine.playEnchant();
      game.showFloatingText('⚔️ 공격 1.5배!', 'crit-number', game.playerAreaEl);
      game.battleMessage.textContent = '👑 [여황제] 발동! 이번 턴 총 공격력이 1.5배로 강력해집니다!';
    }
  },
  emperor: {
    id: 'emperor',
    num: 'IV',
    name: '황제',
    subName: 'The Emperor',
    icon: '🏛️',
    desc: '적의 모든 방패를 일격에 파괴하고 체력에 관통 8 피해',
    use: (game) => {
      const shieldBroke = game.enemyShield;
      game.enemyShield = 0;
      game.enemyHp = Math.max(0, game.enemyHp - 8);
      soundEngine.playCrit();
      if (shieldBroke > 0) {
        game.showFloatingText(`방패파괴 (-${shieldBroke})`, 'shield-number', game.enemyAreaEl);
      }
      game.showFloatingText('-8 관통!', 'crit-number', game.enemyAreaEl);
      game.updateStatsUI();
      game.battleMessage.textContent = '🏛️ [황제] 발동! 적의 방패를 분쇄하고 8의 관통 피해를 입혔습니다!';
    }
  },
  chariot: {
    id: 'chariot',
    num: 'VII',
    name: '전차',
    subName: 'The Chariot',
    icon: '🛡️',
    desc: '철벽의 성채를 세워 방어도 +18 획득',
    use: (game) => {
      game.addPlayerShield(18);
      soundEngine.playEnchant();
      game.battleMessage.textContent = '🛡️ [전차] 발동! 강력한 철벽 방어도 +18을 둘렀습니다!';
    }
  },
  death: {
    id: 'death',
    num: 'XIII',
    name: '사신',
    subName: 'Death',
    icon: '☠️',
    desc: '적에게 14의 암흑 피해를 입히고 체력 6 흡혈',
    use: (game) => {
      game.dealDamageToEnemy(14, '사신의 수확');
      game.healPlayer(6);
      soundEngine.playCrit();
      game.battleMessage.textContent = '☠️ [사신] 발동! 적의 생명력을 14 수확하고 6 회복했습니다!';
    }
  },
  sun: {
    id: 'sun',
    num: 'XIX',
    name: '태양',
    subName: 'The Sun',
    icon: '☀️',
    desc: '이번 턴 모든 미할당 주사위의 눈금을 최고 눈금인 [6]으로 변환!',
    use: (game) => {
      const poolDice = game.diceList.filter(d => d.zone === 'pool');
      poolDice.forEach(d => {
        d.value = 6;
      });
      game.renderAllDice();
      game.calculateProjections();
      soundEngine.playVictory();
      game.showFloatingText('☀️ 전체 6으로 변환!', 'crit-number', game.playerAreaEl);
      game.battleMessage.textContent = '☀️ [태양] 발동! 모든 미할당 주사위가 눈금 6으로 빛납니다!';
    }
  },
  world: {
    id: 'world',
    num: 'XXI',
    name: '세계',
    subName: 'The World',
    icon: '🪐',
    desc: '적을 1턴간 완전히 기절(스턴)시켜 다음 적의 행동을 무효화',
    use: (game) => {
      game.enemyStunned = true;
      if (game.enemyIntentText) {
        game.enemyIntentText.textContent = '기절 상태 (행동 불가)';
      }
      if (game.enemyIntentIcon) {
        game.enemyIntentIcon.textContent = '💫';
      }
      soundEngine.playEnchant();
      game.showFloatingText('💫 적 기절!', 'crit-number', game.enemyAreaEl);
      game.battleMessage.textContent = '🪐 [세계] 발동! 적이 기절하여 이번 턴에 행동하지 못합니다!';
    }
  }
};

// ==========================================
// 3. 장비(조커 시스템) 정의: 투구 / 무기(2칸) / 갑옷 / 하체
// ==========================================
const EQUIPMENT_SLOT_DEFS = [
  { key: 'helmet', name: '투구', icon: '🪖' },
  { key: 'weapon1', name: '무기 1', icon: '⚔️' },
  { key: 'weapon2', name: '무기 2', icon: '🗡️' },
  { key: 'armor', name: '갑옷', icon: '🛡️' },
  { key: 'legs', name: '하체', icon: '👢' }
];

const EQUIPMENT_DATA = {
  // --- 투구 (Helmet) ---
  crown: {
    id: 'crown',
    slotType: 'helmet',
    slotName: '투구',
    name: '군주의 황금관',
    icon: '👑',
    rarity: 'rare',
    desc: '페어 이상의 모든 콤보 완성 시 공격력 +8 & 방어도 +6 추가',
    procText: '👑황금관'
  },
  oracle: {
    id: 'oracle',
    slotType: 'helmet',
    slotName: '투구',
    name: '예지자의 서클릿',
    icon: '🔮',
    rarity: 'uncommon',
    desc: '매 턴 시작 시 주사위 재굴림 횟수 +1 추가 충전',
    procText: '🔮예지자'
  },
  berserker_helm: {
    id: 'berserker_helm',
    slotType: 'helmet',
    slotName: '투구',
    name: '광전사의 뿔투구',
    icon: '🪖',
    rarity: 'rare',
    desc: '체력이 50% 이하일 때 공격 존 총 피해량 1.5배 폭발 증폭',
    procText: '🪖광전사'
  },
  sage_hood: {
    id: 'sage_hood',
    slotType: 'helmet',
    slotName: '투구',
    name: '현자의 룬 후드',
    icon: '🧙',
    rarity: 'uncommon',
    desc: '배치된 모든 홀수(1, 3, 5) 주사위마다 방어도 +2 & 적 화상 1 부여',
    procText: '🧙현자'
  },

  // --- 무기 (Weapon - 2칸 장착 가능) ---
  dagger: {
    id: 'dagger',
    slotType: 'weapon',
    slotName: '무기',
    name: '암살자의 비수',
    icon: '🗡️',
    rarity: 'common',
    desc: '공격 존의 [6] 눈금 주사위 1개당 치명타 보너스 +6 피해',
    procText: '🗡️치명타'
  },
  twin_rapiers: {
    id: 'twin_rapiers',
    slotType: 'weapon',
    slotName: '무기',
    name: '쌍둥이 결투검',
    icon: '⚔️',
    rarity: 'uncommon',
    desc: '공격 존에 주사위 3개 이상 배치 시 적의 방패 12를 즉시 관통 분쇄',
    procText: '⚔️방패관통'
  },
  staff: {
    id: 'staff',
    slotType: 'weapon',
    slotName: '무기',
    name: '원소 폭풍 지팡이',
    icon: '🪄',
    rarity: 'rare',
    desc: '모든 원소 각인(화염/암흑/신성/번개/빙결)의 효과를 2배로 폭발 증폭',
    procText: '🪄원소폭풍'
  },
  vampire_blade: {
    id: 'vampire_blade',
    slotType: 'weapon',
    slotName: '무기',
    name: '흡혈귀의 세이버',
    icon: '🩸',
    rarity: 'rare',
    desc: '공격으로 적 체력에 입힌 순수 피해의 25%를 플레이어 체력으로 흡혈',
    procText: '🩸흡혈'
  },
  repeater_crossbow: {
    id: 'repeater_crossbow',
    slotType: 'weapon',
    slotName: '무기',
    name: '연발 기계 석궁',
    icon: '🏹',
    rarity: 'uncommon',
    desc: '공격 존의 모든 짝수(2, 4, 6) 주사위 1개당 공격력 +4 추가 보너스',
    procText: '🏹연발사격'
  },
  meteor_mace: {
    id: 'meteor_mace',
    slotType: 'weapon',
    slotName: '무기',
    name: '유성 파쇄 메이스',
    icon: '☄️',
    rarity: 'legendary',
    desc: '턴 종료 시 유성이 낙하하여 적에게 10 폭발 피해 및 화상 3 부여',
    procText: '☄️유성낙하'
  },

  // --- 갑옷 (Armor) ---
  paladin_plate: {
    id: 'paladin_plate',
    slotType: 'armor',
    slotName: '갑옷',
    name: '성기사의 수호 판금',
    icon: '🛡️',
    rarity: 'rare',
    desc: '매 턴 시작 시 방어도 +8 기본 획득 및 방어 존 총 방어도 1.25배 증폭',
    procText: '🛡️성기사'
  },
  spiked_carapace: {
    id: 'spiked_carapace',
    slotType: 'armor',
    slotName: '갑옷',
    name: '가시 돋친 흑요석 갑주',
    icon: '🥋',
    rarity: 'uncommon',
    desc: '적에게 공격받을 때, 보유한 방어도만큼 적에게 즉시 가시 반격 피해',
    procText: '🥋가시반격'
  },
  dragon_cuirass: {
    id: 'dragon_cuirass',
    slotType: 'armor',
    slotName: '갑옷',
    name: '용비늘 붉은 흉갑',
    icon: '🐉',
    rarity: 'legendary',
    desc: '받는 모든 피해 5 절대 감소 & 피격 시 공격한 적에게 화상 2 부여',
    procText: '🐉용비늘'
  },
  nebula_robes: {
    id: 'nebula_robes',
    slotType: 'armor',
    slotName: '갑옷',
    name: '마도사의 성운 로브',
    icon: '✨',
    rarity: 'rare',
    desc: '매 턴 시작 시 주사위 풀의 무작위 주사위 1개에 이번 턴 원소 각인 부여',
    procText: '✨성운각인'
  },

  // --- 하체 (Legs) ---
  gale_boots: {
    id: 'gale_boots',
    slotType: 'legs',
    slotName: '하체',
    name: '질풍의 도약 장화',
    icon: '👢',
    rarity: 'common',
    desc: '각 전투의 첫 번째 턴에 공격력 +12 폭발적 추가',
    procText: '👢질풍도약'
  },
  iron_sabatons: {
    id: 'iron_sabatons',
    slotType: 'legs',
    slotName: '하체',
    name: '불굴의 강철 경갑',
    icon: '🦿',
    rarity: 'uncommon',
    desc: '턴이 끝나도 남아있던 방어도의 50%가 다음 턴으로 소멸되지 않고 이월',
    procText: '🦿방패이월'
  },
  titan_greaves: {
    id: 'titan_greaves',
    slotType: 'legs',
    slotName: '하체',
    name: '거인의 대지 각반',
    icon: '🪨',
    rarity: 'rare',
    desc: '방어 존에 눈금 [5] 이상의 주사위가 있으면 적의 이번 턴 공격력 5 감소',
    procText: '🪨거인의위압'
  },
  shadow_tabi: {
    id: 'shadow_tabi',
    slotType: 'legs',
    slotName: '하체',
    name: '그림자 잠행 버선',
    icon: '🥷',
    rarity: 'legendary',
    desc: '스트레이트 콤보(3연속 이상) 달성 시 적을 1턴간 기절(스턴)시킴',
    procText: '🥷그림자기절'
  }
};

// ==========================================
// 4. 몬스터 풀 (층별 난이도)
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

    // 소비 아이템: 타로 카드 2칸 인벤토리 (시작 시 1장 지급)
    this.tarotInventory = [ { ...TAROT_CARDS.fool }, null ];
    this.tarotBuffs = { attackMultiplier: 1 };
    this.enemyStunned = false;

    // 장비(조커 시스템) 5칸: 투구, 무기 1, 무기 2, 갑옷, 하체
    this.equipment = {
      helmet: { ...EQUIPMENT_DATA.crown },
      weapon1: { ...EQUIPMENT_DATA.dagger },
      weapon2: null,
      armor: null,
      legs: { ...EQUIPMENT_DATA.gale_boots }
    };
    this.turnInBattle = 0;
    this.lastEffectiveEnemyDamage = 0;

    this.initElements();
    this.bindEvents();
    this.startBattle();
  }

  // 5개의 완전히 독립된 주사위 초기화 (각 주사위는 6개의 개별 슬롯을 가짐)
  createInitialDiceCollection() {
    const collection = [];
    for (let i = 0; i < 5; i++) {
      const dieData = {
        index: i,
        name: `D${i + 1}`,
        fullName: `${i + 1}번 주사위`,
        slots: [
          { slot: 1, value: 1, enchant: null },
          { slot: 2, value: 2, enchant: null },
          { slot: 3, value: 3, enchant: null },
          { slot: 4, value: 4, enchant: null },
          { slot: 5, value: 5, enchant: null },
          { slot: 6, value: 6, enchant: null }
        ]
      };

      // 초기 시작 선물: 1번 주사위의 1번 면에 불꽃 1 지급
      if (i === 0) {
        dieData.slots[0].enchant = { ...ENCHANT_TYPES.flame, face: 1 };
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

    // 소비 아이템: 타로 카드 2칸 슬롯 엘리먼트
    this.tarotSlotsEl = document.getElementById('tarotSlots');
    this.tarotCountEl = document.getElementById('tarotCount');

    // 장비(조커 시스템) 5칸 및 보상 엘리먼트
    this.equipmentSlotsEl = document.getElementById('equipmentSlots');
    this.equipmentRewardSection = document.getElementById('equipmentRewardSection');
    this.equipmentRewardOptions = document.getElementById('equipmentRewardOptions');
    this.equipmentRewardFeedback = document.getElementById('equipmentRewardFeedback');

    // 보상 모달 3단계 엘리먼트 (중복 숫자 배치 지원)
    this.rewardModal = document.getElementById('rewardModal');
    this.rewardOptionsEl = document.getElementById('rewardOptions');
    this.targetDieSection = document.getElementById('targetDieSection');
    this.targetDiceSelector = document.getElementById('targetDiceSelector');
    this.targetSlotSection = document.getElementById('targetSlotSection');
    this.targetSlotSelector = document.getElementById('targetSlotSelector');
    this.slotPreviewDesc = document.getElementById('slotPreviewDesc');
    this.tarotRewardSection = document.getElementById('tarotRewardSection');
    this.tarotRewardOptions = document.getElementById('tarotRewardOptions');
    this.tarotRewardFeedback = document.getElementById('tarotRewardFeedback');
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
    this.turnInBattle = 0;
    const enemyData = MONSTERS.find(m => m.floor === this.floor) || MONSTERS[MONSTERS.length - 1];
    this.currentEnemy = { ...enemyData };
    this.enemyHp = this.currentEnemy.maxHp;
    this.enemyShield = 0;
    this.playerShield = 0;
    this.enemyStatuses = { burn: 0, poison: 0, weak: 0 };
    this.playerStatuses = { weak: 0 };
    this.currentIntentIndex = 0;
    this.enemyStunned = false;

    this.floorBadge.textContent = `층: ${this.floor}F (${this.currentEnemy.tier})`;
    this.enemyNameEl.textContent = this.currentEnemy.name;
    this.enemyTierEl.textContent = this.currentEnemy.tier;
    this.enemySpriteEl.textContent = this.currentEnemy.sprite;

    this.renderDiceFacesStrip();
    this.renderTarotSlots();
    this.renderEquipmentSlots();
    this.updateStatsUI();
    this.startPlayerTurn();
  }

  // ==========================================
  // 플레이어 턴 시작
  // ==========================================
  startPlayerTurn() {
    this.isPlayerTurn = true;
    this.isActionLocked = false;
    this.tarotBuffs = { attackMultiplier: 1 };
    this.turnInBattle++;
    this.turnIndicator.textContent = '당신의 턴';
    this.turnIndicator.style.color = 'var(--accent-cyan)';
    this.endTurnBtn.disabled = false;
    this.battleMessage.textContent = '주사위를 공격/방어 존에 분배하거나 타로 카드를 사용하세요!';

    // 하체 장비: 불굴의 강철 경갑 (방어도 50% 이월)
    let carryShield = 0;
    if (this.hasEquip('iron_sabatons') && this.playerShield > 0) {
      carryShield = Math.floor(this.playerShield * 0.5);
      if (carryShield > 0) {
        this.triggerEquipProc('legs', `🛡️ 이월 방어 +${carryShield}`);
      }
    }
    this.playerShield = carryShield;

    // 갑옷 장비: 성기사의 수호 판금 (매 턴 시작 시 방어도 +8)
    if (this.hasEquip('paladin_plate')) {
      this.playerShield += 8;
      this.triggerEquipProc('armor', '🛡️ 판금 방어 +8');
    }

    // 투구 장비: 예지자의 서클릿 (재굴림 +1)
    let extraRerolls = 0;
    if (this.hasEquip('oracle')) {
      extraRerolls = 1;
      this.triggerEquipProc('helmet', '🔮 재굴림 +1');
    }

    this.rerollsLeft = this.baseRerolls + extraRerolls;
    this.rerollAbilityBtn.disabled = false;
    this.rerollAbilityBtn.textContent = `🎲 재굴림 (${this.rerollsLeft})`;

    this.renderTarotSlots();
    this.renderEquipmentSlots();
    this.pickEnemyIntent();

    // 5개의 독립된 주사위 각각 굴리기!
    this.rollIndependentDice();

    // 갑옷 장비: 마도사의 성운 로브 (풀의 무작위 주사위에 임시 원소 각인 부여)
    if (this.hasEquip('nebula_robes')) {
      const pool = this.diceList.filter(d => d.zone === 'pool');
      if (pool.length > 0) {
        const targetDie = pool[Math.floor(Math.random() * pool.length)];
        const elemKeys = Object.keys(ENCHANT_TYPES);
        const randomElem = ENCHANT_TYPES[elemKeys[Math.floor(Math.random() * elemKeys.length)]];
        targetDie.enchant = { ...randomElem, face: targetDie.value };
        this.triggerEquipProc('armor', `✨ ${randomElem.name} 부여!`);
        this.renderAllDice();
        this.calculateProjections();
      }
    }

    this.updateStatsUI();
  }

  // 5개의 주사위가 각각 자신의 6개 슬롯 중 하나를 무작위로 뽑음 (중복 숫자 완벽 반영)
  rollIndependentDice() {
    soundEngine.playDiceRoll();
    this.diceList = [];
    this.selectedDieIndex = null;

    for (let i = 0; i < this.DICE_COUNT; i++) {
      const dieSystem = this.diceCollection[i];
      const slotIndex = Math.floor(Math.random() * 6);
      const rolledSlot = dieSystem.slots[slotIndex];
      const val = rolledSlot.value;
      const enchant = rolledSlot.enchant;

      this.diceList.push({
        id: `die_${Date.now()}_${i}`,
        dieIndex: i, // 0 to 4 (D1 ~ D5)
        dieName: dieSystem.name,
        slotIndex: slotIndex,
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
      const slotIndex = Math.floor(Math.random() * 6);
      const rolledSlot = dieSystem.slots[slotIndex];
      d.slotIndex = slotIndex;
      d.value = rolledSlot.value;
      d.enchant = rolledSlot.enchant;
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

    const positions = pipPositions[value];
    if (positions) {
      positions.forEach(([row, col]) => {
        const pip = document.createElement('div');
        pip.className = 'pip';
        pip.style.gridRow = row;
        pip.style.gridColumn = col;
        dieEl.appendChild(pip);
      });
    } else {
      const numSpan = document.createElement('span');
      numSpan.className = 'die-number-fallback';
      numSpan.textContent = value;
      dieEl.appendChild(numSpan);
    }
  }

  // ==========================================
  // 상단 인스펙터: 선택된 주사위의 6면(슬롯) 렌더링
  // ==========================================
  renderDiceFacesStrip() {
    this.diceFacesStrip.innerHTML = '';
    const currentDie = this.diceCollection[this.inspectedDieIndex];

    currentDie.slots.forEach((slotData, sIdx) => {
      const enchant = slotData.enchant;
      const slotEl = document.createElement('div');
      const slotClass = enchant ? enchant.slotClass : '';
      slotEl.className = `face-preview-slot ${slotClass}`;

      if (enchant) {
        slotEl.innerHTML = `
          <span class="face-icon">${enchant.icon}</span>
          <span>${slotData.value}</span>
        `;
        slotEl.title = `[${currentDie.fullName}] ${sIdx + 1}번 면: [${enchant.name} ${slotData.value}]\n공격: ${enchant.attackText}\n방어: ${enchant.defenseText}`;
      } else {
        slotEl.innerHTML = `<span>${slotData.value}</span>`;
        slotEl.title = `[${currentDie.fullName}] ${sIdx + 1}번 면: 일반 (${slotData.value})`;
      }

      this.diceFacesStrip.appendChild(slotEl);
    });
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

    // 무기 장비: 원소 폭풍 지팡이 (모든 원소 각인 효과 2배)
    if (this.hasEquip('staff') && enchantBonus > 0) {
      enchantBonus *= 2;
      enchantDescriptions.push('🪄폭풍지팡이 2배');
    }

    // 투구 장비: 군주의 황금관 (콤보 완성 시 공격 +8 / 방어 +6)
    if (this.hasEquip('crown') && comboBonus > 0) {
      if (zoneType === 'attack') {
        comboBonus += 8;
        comboNames.push('👑황금관 +8');
      } else {
        comboBonus += 6;
        comboNames.push('👑황금관 +6');
      }
    }

    let total = baseSum + comboBonus + enchantBonus;

    // 투구 장비: 광전사의 뿔투구 (체력 50% 이하 시 공격 1.5배)
    if (this.hasEquip('berserker_helm') && zoneType === 'attack' && this.playerHp <= this.playerMaxHp * 0.5) {
      total = Math.floor(total * 1.5);
      comboNames.push('🪖광전사 ×1.5');
    }

    // 투구 장비: 현자의 룬 후드 (홀수 주사위당 방어 +2)
    if (this.hasEquip('sage_hood')) {
      const oddCount = dice.filter(d => d.value % 2 === 1).length;
      if (oddCount > 0) {
        if (zoneType === 'defense') {
          total += oddCount * 2;
          comboNames.push(`🧙현자방어 +${oddCount * 2}`);
        } else {
          comboNames.push(`🧙현자화상 +${oddCount}`);
        }
      }
    }

    // 무기 장비: 암살자의 비수 (6 눈금 주사위당 치명타 +6)
    if (this.hasEquip('dagger') && zoneType === 'attack') {
      const sixCount = dice.filter(d => d.value === 6).length;
      if (sixCount > 0) {
        total += sixCount * 6;
        comboNames.push(`🗡️비수치명 +${sixCount * 6}`);
      }
    }

    // 무기 장비: 연발 기계 석궁 (짝수 주사위당 공격 +4)
    if (this.hasEquip('repeater_crossbow') && zoneType === 'attack') {
      const evenCount = dice.filter(d => d.value % 2 === 0).length;
      if (evenCount > 0) {
        total += evenCount * 4;
        comboNames.push(`🏹연발석궁 +${evenCount * 4}`);
      }
    }

    // 갑옷 장비: 성기사의 수호 판금 (방어 존 총 방어도 1.25배)
    if (this.hasEquip('paladin_plate') && zoneType === 'defense') {
      total = Math.floor(total * 1.25);
      comboNames.push('🛡️판금 ×1.25');
    }

    // 하체 장비: 질풍의 도약 장화 (전투 1턴째 공격 +12)
    if (this.hasEquip('gale_boots') && zoneType === 'attack' && this.turnInBattle === 1) {
      total += 12;
      comboNames.push('👢질풍도약 +12');
    }

    // 하체 장비: 거인의 대지 각반 (방어 존 5 이상 눈금 존재 시)
    if (this.hasEquip('titan_greaves') && zoneType === 'defense' && dice.some(d => d.value >= 5)) {
      comboNames.push('🪨거인의위압(적-5)');
    }

    if (zoneType === 'defense' && hasHolyDefense) {
      total = Math.floor(total * 1.5);
    }
    if (zoneType === 'attack' && this.tarotBuffs && this.tarotBuffs.attackMultiplier > 1) {
      const mult = this.tarotBuffs.attackMultiplier;
      total = Math.floor(total * mult);
      comboNames.push(`👑여황제 ×${mult}`);
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

    // 무기 장비: 쌍둥이 결투검 (공격 존 3개 이상 주사위 배치 시 적 방패 12 즉시 관통)
    if (this.hasEquip('twin_rapiers') && attackCalc.dice.length >= 3 && this.enemyShield > 0) {
      const pierce = Math.min(this.enemyShield, 12);
      this.enemyShield -= pierce;
      this.triggerEquipProc(this.getEquipSlotKey('twin_rapiers'), `⚔️ 방패 -${pierce} 관통!`);
      this.showFloatingText(`방패 관통 -${pierce}`, 'shield-number', this.enemyAreaEl);
    }

    // 1. 공격 발동
    if (attackCalc.total > 0) {
      soundEngine.playSlash();
      this.dealDamageToEnemy(attackCalc.total, '전술 공격', attackCalc.comboBonus > 0);

      attackCalc.dice.forEach(d => {
        if (d.enchant && d.enchant.procAttack) {
          d.enchant.procAttack(this, d);
        }
      });

      // 발라트로 조커 발동 시각 피드백
      if (this.hasEquip('crown') && attackCalc.comboBonus > 0) {
        this.triggerEquipProc(this.getEquipSlotKey('crown'), '👑 황금관 보너스!');
      }
      if (this.hasEquip('dagger') && attackCalc.dice.some(d => d.value === 6)) {
        this.triggerEquipProc(this.getEquipSlotKey('dagger'), '🗡️ 치명타 발동!');
      }
      if (this.hasEquip('repeater_crossbow') && attackCalc.dice.some(d => d.value % 2 === 0)) {
        this.triggerEquipProc(this.getEquipSlotKey('repeater_crossbow'), '🏹 연발사격!');
      }
      if (this.hasEquip('gale_boots') && this.turnInBattle === 1) {
        this.triggerEquipProc(this.getEquipSlotKey('gale_boots'), '👢 질풍도약 +12!');
      }
      if (this.hasEquip('berserker_helm') && this.playerHp <= this.playerMaxHp * 0.5) {
        this.triggerEquipProc(this.getEquipSlotKey('berserker_helm'), '🪖 광전사 폭발!');
      }
      if (this.hasEquip('staff') && attackCalc.enchantBonus > 0) {
        this.triggerEquipProc(this.getEquipSlotKey('staff'), '🪄 원소 2배 증폭!');
      }

      // 무기 장비: 흡혈귀의 세이버 (적 체력에 입힌 순수 피해 25% 흡혈)
      if (this.hasEquip('vampire_blade') && this.lastEffectiveEnemyDamage > 0) {
        const healAmt = Math.max(1, Math.floor(this.lastEffectiveEnemyDamage * 0.25));
        this.healPlayer(healAmt);
        this.triggerEquipProc(this.getEquipSlotKey('vampire_blade'), `🩸 +${healAmt} 흡혈!`);
      }
    }

    // 투구 장비: 현자의 룬 후드 (배치된 홀수 주사위당 적 화상 1)
    if (this.hasEquip('sage_hood')) {
      const allActiveDice = (attackCalc.dice || []).concat(defenseCalc.dice || []);
      const oddCount = allActiveDice.filter(d => d.value % 2 === 1).length;
      if (oddCount > 0) {
        this.applyEnemyStatus('burn', oddCount);
        this.triggerEquipProc(this.getEquipSlotKey('sage_hood'), `🧙 화상 +${oddCount}`);
      }
    }

    // 하체 장비: 그림자 잠행 버선 (스트레이트 콤보 달성 시 적 1턴 스턴)
    if (this.hasEquip('shadow_tabi') && (attackCalc.description.includes('스트레이트') || defenseCalc.description.includes('스트레이트'))) {
      this.enemyStunned = true;
      if (this.enemyIntentText) this.enemyIntentText.textContent = '기절 상태 (잠행 스턴)';
      this.triggerEquipProc(this.getEquipSlotKey('shadow_tabi'), '🥷 그림자 기절!');
      this.showFloatingText('💫 기절!', 'crit-number', this.enemyAreaEl);
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

        if (this.hasEquip('paladin_plate')) {
          this.triggerEquipProc(this.getEquipSlotKey('paladin_plate'), '🛡️ 판금 증폭!');
        }

        // 하체 장비: 거인의 대지 각반 (방어 존 5 이상 눈금 시 적 공격력 5 감소)
        if (this.hasEquip('titan_greaves') && defenseCalc.dice.some(d => d.value >= 5) && this.currentIntent && this.currentIntent.type === 'attack') {
          this.currentIntent.val = Math.max(0, this.currentIntent.val - 5);
          this.enemyIntentText.textContent = `${this.currentIntent.text.split(' ')[0]} ${this.currentIntent.val} (위압 -5)`;
          this.triggerEquipProc(this.getEquipSlotKey('titan_greaves'), '🪨 적 공격 -5');
        }
      }, 300);
    }

    // 무기 장비: 유성 파쇄 메이스 (턴 종료 시 유성 폭발 10 피해 및 화상 3)
    if (this.hasEquip('meteor_mace') && this.enemyHp > 0) {
      setTimeout(() => {
        soundEngine.playMagicFire();
        this.dealDamageToEnemy(10, '유성 낙하 폭발', true);
        this.applyEnemyStatus('burn', 3);
        this.triggerEquipProc(this.getEquipSlotKey('meteor_mace'), '☄️ 유성 낙하 10 피해!');
      }, 500);
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

    // 적 기절(스턴) 확인 (타로 '세계' 발동 시)
    if (this.enemyStunned) {
      this.enemyStunned = false;
      this.battleMessage.textContent = '💫 적이 기절(스턴) 상태여서 이번 턴 행동하지 못했습니다!';
      this.showFloatingText('행동 불가!', 'heal-number', this.enemyAreaEl);
      setTimeout(() => {
        this.startPlayerTurn();
      }, 1000);
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

    this.lastEffectiveEnemyDamage = effectiveDmg;

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
    let incomingDmg = dmg;

    // 갑옷 장비: 용비늘 붉은 흉갑 (받는 피해 5 절대 감소 & 공격한 적에게 화상 2)
    if (this.hasEquip('dragon_cuirass')) {
      incomingDmg = Math.max(1, incomingDmg - 5);
      this.applyEnemyStatus('burn', 2);
      this.triggerEquipProc(this.getEquipSlotKey('dragon_cuirass'), '🐉 피해 -5 & 화상 2');
    }

    // 갑옷 장비: 가시 돋친 흑요석 갑주 (피격 시 현재 방어도만큼 적에게 가시 반격 피해)
    if (this.hasEquip('spiked_carapace') && this.playerShield > 0) {
      const reflectDmg = Math.min(this.playerShield, incomingDmg);
      if (reflectDmg > 0) {
        this.dealDamageToEnemy(reflectDmg, '가시 반격');
        this.triggerEquipProc(this.getEquipSlotKey('spiked_carapace'), `🥋 반격 ${reflectDmg}`);
      }
    }

    let effectiveDmg = incomingDmg;
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
    this.targetSlotSection.style.display = 'none';
    this.targetSlotSelector.innerHTML = '';
    if (this.slotPreviewDesc) this.slotPreviewDesc.textContent = '';
    this.nextFloorBtn.disabled = true;

    // 1단계: 3개의 무작위 원소 면(Face + Element) 선택지 생성
    // 1~6 무작위 숫자 (중복 숫자도 자연스럽게 등장 가능!)
    const randomFaceNumbers = [
      Math.floor(Math.random() * 6) + 1,
      Math.floor(Math.random() * 6) + 1,
      Math.floor(Math.random() * 6) + 1
    ];
    const elementKeys = Object.keys(ENCHANT_TYPES);

    const options = randomFaceNumbers.map((faceNum) => {
      const elemKey = elementKeys[Math.floor(Math.random() * elementKeys.length)];
      const enchantDef = ENCHANT_TYPES[elemKey];
      return {
        face: faceNum,
        enchant: { ...enchantDef, face: faceNum }
      };
    });

    let selectedEssence = null;
    let selectedTargetDieIdx = null;
    let selectedSlotIdx = null;

    options.forEach(opt => {
      const cardEl = document.createElement('div');
      cardEl.className = `reward-card enchant-card ${opt.enchant.colorClass}`;
      cardEl.innerHTML = `
        <div class="card-header">
          <span class="card-title">${opt.enchant.icon} ${opt.enchant.name} ${opt.face}</span>
          <span class="enchant-face-badge">[ 숫자 ${opt.face} 각인 ]</span>
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
        selectedTargetDieIdx = null;
        selectedSlotIdx = null;
        this.targetSlotSection.style.display = 'none';
        if (this.slotPreviewDesc) this.slotPreviewDesc.textContent = '';
        this.nextFloorBtn.disabled = true;
        soundEngine.playDiceSlot();

        // 2단계: 대상 주사위 (D1 ~ D5) 선택기 활성화
        this.renderTargetDiceSelector(selectedEssence, (targetDieIdx) => {
          selectedTargetDieIdx = targetDieIdx;
          selectedSlotIdx = null;
          this.nextFloorBtn.disabled = true;

          // 3단계: 선택된 주사위의 6개 면 중 교체할 면(슬롯) 선택 활성화 (중복 숫자 배치 가능)
          this.renderTargetSlotSelector(selectedTargetDieIdx, selectedEssence, (slotIdx) => {
            selectedSlotIdx = slotIdx;
            this.nextFloorBtn.disabled = false;
          });
        });
      });

      this.rewardOptionsEl.appendChild(cardEl);
    });

    // 보너스 타로 카드 보충 렌더링
    this.renderTarotRewardSection();

    // 장비 (조커 시스템) 보상 렌더링
    this.renderEquipmentRewardSection();

    this.nextFloorBtn.onclick = () => {
      if (selectedEssence && selectedTargetDieIdx !== null && selectedSlotIdx !== null) {
        soundEngine.playEnchant();

        // 선택한 주사위의 해당 슬롯을 새 숫자와 원소 각인으로 덮어쓰기 (중복 숫자 허용!)
        const targetDie = this.diceCollection[selectedTargetDieIdx];
        targetDie.slots[selectedSlotIdx] = {
          slot: selectedSlotIdx + 1,
          value: selectedEssence.face,
          enchant: selectedEssence.enchant
        };

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
    this.targetSlotSection.style.display = 'none';
    this.nextFloorBtn.disabled = true;

    this.diceCollection.forEach((die, idx) => {
      const valuesList = die.slots.map(s => s.value).join(', ');

      const btn = document.createElement('div');
      btn.className = 'target-die-btn';
      btn.innerHTML = `
        <span class="die-name">🎲 ${die.name}</span>
        <span class="current-face-status">[${valuesList}]</span>
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

  // 3단계: 교체할 슬롯(1~6번 면) 선택 (중복 숫자 자유 배치)
  renderTargetSlotSelector(dieIndex, essence, onSelect) {
    this.targetSlotSection.style.display = 'flex';
    this.targetSlotSelector.innerHTML = '';
    if (this.slotPreviewDesc) {
      this.slotPreviewDesc.textContent = '교체할 주사위 면을 선택하세요. 어떤 숫자든 자유롭게 중복 배치할 수 있습니다!';
    }

    const die = this.diceCollection[dieIndex];

    die.slots.forEach((slot, sIdx) => {
      const curIcon = slot.enchant ? slot.enchant.icon : '';
      const slotClass = slot.enchant ? slot.enchant.slotClass : '';

      const btn = document.createElement('div');
      btn.className = `target-slot-btn ${slotClass}`;
      btn.innerHTML = `
        <span class="slot-idx-tag">${sIdx + 1}번면</span>
        <span class="slot-val-display">${curIcon} ${slot.value}</span>
      `;

      btn.addEventListener('click', () => {
        this.targetSlotSelector.querySelectorAll('.target-slot-btn').forEach(b => b.classList.remove('selected'));
        btn.classList.add('selected');
        soundEngine.playDiceSlot();

        // 중복 계산 안내 메시지
        const targetNumber = essence.face;
        const currentCount = die.slots.filter((s, i) => i !== sIdx && s.value === targetNumber).length;
        const newTotalCount = currentCount + 1;

        let duplicateMsg = '';
        if (newTotalCount > 1) {
          duplicateMsg = ` 🔥 중복 완성! 이제 [${die.name}]에 숫자 ${targetNumber}이(가) 총 ${newTotalCount}개가 됩니다!`;
        } else {
          duplicateMsg = ` (${die.name}의 ${sIdx + 1}번 면이 숫자 ${targetNumber}으로 교체됩니다)`;
        }

        if (this.slotPreviewDesc) {
          this.slotPreviewDesc.textContent = `[${sIdx + 1}번면: ${curIcon}${slot.value}] ➡️ [${essence.enchant.icon}${essence.enchant.name} ${targetNumber}] 교체!${duplicateMsg}`;
        }

        onSelect(sIdx);
      });

      this.targetSlotSelector.appendChild(btn);
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

  // ==========================================
  // 소비 아이템: 타로 카드 2칸 렌더링 및 사용
  // ==========================================
  renderTarotSlots() {
    if (!this.tarotSlotsEl) return;
    this.tarotSlotsEl.innerHTML = '';

    const count = this.tarotInventory.filter(Boolean).length;
    if (this.tarotCountEl) {
      this.tarotCountEl.textContent = count;
    }

    this.tarotInventory.forEach((card, idx) => {
      const slotEl = document.createElement('div');
      if (!card) {
        slotEl.className = 'tarot-slot empty';
        slotEl.innerHTML = `
          <span>🎴</span>
          <span>빈 슬롯</span>
        `;
        slotEl.title = `${idx + 1}번 타로 카드 슬롯 (비어있음 - 승리 보상에서 획득 가능)`;
      } else {
        slotEl.className = 'tarot-slot occupied';
        slotEl.innerHTML = `
          <div class="tarot-slot-num">${card.num}</div>
          <div class="tarot-slot-body">
            <span class="tarot-slot-icon">${card.icon}</span>
            <span class="tarot-slot-name">${card.name}</span>
          </div>
          <div class="tarot-slot-use-tag">사용하기</div>
        `;
        slotEl.title = `[${card.num}. ${card.name} - ${card.subName}]\n${card.desc}\n(클릭 시 즉시 발동)`;

        slotEl.addEventListener('click', (e) => {
          e.stopPropagation();
          this.useTarotCard(idx);
        });
      }
      this.tarotSlotsEl.appendChild(slotEl);
    });
  }

  useTarotCard(slotIndex) {
    if (!this.isPlayerTurn || this.isActionLocked) {
      this.battleMessage.textContent = '지금은 타로 카드를 사용할 수 없습니다!';
      return;
    }

    const card = this.tarotInventory[slotIndex];
    if (!card) return;

    soundEngine.playEnchant();
    if (typeof particleEngine !== 'undefined' && particleEngine) {
      const rect = this.tarotSlotsEl.children[slotIndex]?.getBoundingClientRect();
      if (rect) {
        particleEngine.spawnMagicBurst(rect.left + rect.width / 2, rect.top + rect.height / 2);
      }
    }

    // 카드 효과 실행
    card.use(this);

    // 1회용 소비 아이템이므로 사용 후 슬롯 비우기
    this.tarotInventory[slotIndex] = null;
    this.renderTarotSlots();
    this.updateStatsUI();
  }

  // 보상 모달 내 타로 카드 보충 섹션
  renderTarotRewardSection() {
    if (!this.tarotRewardSection || !this.tarotRewardOptions) return;
    this.tarotRewardOptions.innerHTML = '';
    if (this.tarotRewardFeedback) {
      const freeSlots = this.tarotInventory.filter(c => !c).length;
      this.tarotRewardFeedback.textContent = freeSlots > 0
        ? `남은 타로 슬롯: ${freeSlots}개 (원하는 카드를 클릭하여 획득하세요)`
        : '타로 슬롯 2개가 모두 차 있습니다 (선택 시 1번 슬롯 카드와 교체됩니다)';
    }

    // 무작위 타로 카드 2장 제시
    const allKeys = Object.keys(TAROT_CARDS).sort(() => 0.5 - Math.random()).slice(0, 2);
    let cardChosen = false;

    allKeys.forEach(k => {
      const card = TAROT_CARDS[k];
      const cardEl = document.createElement('div');
      cardEl.className = 'tarot-reward-card';
      cardEl.innerHTML = `
        <div class="card-header">
          <span class="tarot-card-name">${card.icon} ${card.num}. ${card.name}</span>
          <span style="font-size: 0.65rem; color: #fbbf24; font-weight:700;">소비 아이템</span>
        </div>
        <div class="tarot-card-desc">${card.desc}</div>
      `;

      cardEl.addEventListener('click', () => {
        if (cardChosen) return;
        soundEngine.playEnchant();

        // 빈 슬롯 찾기
        let targetSlot = this.tarotInventory.findIndex(c => !c);
        if (targetSlot === -1) {
          targetSlot = 0;
        }

        this.tarotInventory[targetSlot] = { ...card };
        this.renderTarotSlots();

        this.tarotRewardOptions.querySelectorAll('.tarot-reward-card').forEach(c => c.classList.remove('selected'));
        cardEl.classList.add('selected');
        cardChosen = true;

        if (this.tarotRewardFeedback) {
          this.tarotRewardFeedback.textContent = `✨ [${card.name}] 타로 카드를 슬롯에 보관했습니다!`;
        }
      });

      this.tarotRewardOptions.appendChild(cardEl);
    });
  }

  // ==========================================
  // 장비 (조커 시스템) 헬퍼 및 렌더링
  // ==========================================
  hasEquip(id) {
    if (!this.equipment) return false;
    return Object.values(this.equipment).some(item => item && item.id === id);
  }

  getEquipSlotKey(id) {
    if (!this.equipment) return null;
    for (const [key, item] of Object.entries(this.equipment)) {
      if (item && item.id === id) return key;
    }
    return null;
  }

  triggerEquipProc(slotKey, msg) {
    if (!this.equipmentSlotsEl || !slotKey) return;
    const cardEl = this.equipmentSlotsEl.querySelector(`[data-slot-key="${slotKey}"]`);
    if (cardEl) {
      cardEl.classList.remove('proc-flash');
      void cardEl.offsetWidth;
      cardEl.classList.add('proc-flash');
      setTimeout(() => cardEl.classList.remove('proc-flash'), 700);

      if (msg) {
        this.showFloatingText(msg, 'crit-number', cardEl);
      }
    }
  }

  renderEquipmentSlots() {
    if (!this.equipmentSlotsEl) return;
    this.equipmentSlotsEl.innerHTML = '';

    EQUIPMENT_SLOT_DEFS.forEach(def => {
      const item = this.equipment[def.key];
      const slotEl = document.createElement('div');

      if (!item) {
        slotEl.className = 'equip-card empty';
        slotEl.dataset.slotKey = def.key;
        slotEl.title = `${def.name} 슬롯 (비어있음 - 보상에서 장비 획득 가능)`;
        slotEl.innerHTML = `
          <div class="equip-slot-badge">${def.name}</div>
          <div class="equip-body">
            <div class="equip-icon">${def.icon}</div>
            <div class="equip-empty-text">비어있음</div>
          </div>
        `;
      } else {
        slotEl.className = `equip-card occupied rarity-${item.rarity}`;
        slotEl.dataset.slotKey = def.key;
        slotEl.title = `[${def.name}] ${item.name} (${item.rarity.toUpperCase()})\n${item.desc}`;
        slotEl.innerHTML = `
          <div class="equip-slot-badge">${def.name}</div>
          <div class="equip-body">
            <div class="equip-icon">${item.icon}</div>
            <div class="equip-name">${item.name}</div>
            <div class="equip-desc">${item.desc}</div>
          </div>
        `;
      }

      this.equipmentSlotsEl.appendChild(slotEl);
    });
  }

  equipItem(item) {
    let targetSlot = null;
    if (item.slotType === 'helmet') {
      targetSlot = 'helmet';
    } else if (item.slotType === 'armor') {
      targetSlot = 'armor';
    } else if (item.slotType === 'legs') {
      targetSlot = 'legs';
    } else if (item.slotType === 'weapon') {
      if (!this.equipment.weapon1) {
        targetSlot = 'weapon1';
      } else if (!this.equipment.weapon2) {
        targetSlot = 'weapon2';
      } else {
        // 둘 다 차있으면 weapon1과 교체
        targetSlot = 'weapon1';
      }
    }

    if (targetSlot) {
      this.equipment[targetSlot] = { ...item };
      soundEngine.playEnchant();
      this.renderEquipmentSlots();
      this.calculateProjections();
      this.triggerEquipProc(targetSlot, `장착: ${item.name}`);
      return targetSlot;
    }
    return null;
  }

  renderEquipmentRewardSection() {
    if (!this.equipmentRewardSection || !this.equipmentRewardOptions) return;
    this.equipmentRewardOptions.innerHTML = '';
    if (this.equipmentRewardFeedback) {
      this.equipmentRewardFeedback.textContent = '새로운 장비(조커)를 선택하여 슬롯에 장착하거나 교체하세요 (선택적)';
    }

    // 현재 장착되지 않은 장비 중에서 무작위 3개 추천
    const allEquipKeys = Object.keys(EQUIPMENT_DATA);
    const availableKeys = allEquipKeys.filter(k => !this.hasEquip(k));
    const pool = availableKeys.length >= 3 ? availableKeys : allEquipKeys;
    const shuffled = pool.sort(() => 0.5 - Math.random()).slice(0, 3);
    let equipChosen = false;

    shuffled.forEach(key => {
      const item = EQUIPMENT_DATA[key];
      const cardEl = document.createElement('div');
      cardEl.className = `equipment-reward-card rarity-${item.rarity}`;

      let slotLabel = item.slotName;
      if (item.slotType === 'weapon') {
        const freeW = !this.equipment.weapon1 ? '무기 1' : (!this.equipment.weapon2 ? '무기 2' : '무기 1 교체');
        slotLabel = `무기 (${freeW})`;
      } else {
        const cur = this.equipment[item.slotType];
        if (cur) {
          slotLabel = `${item.slotName} (교체: ${cur.name})`;
        } else {
          slotLabel = `${item.slotName} (신규 장착)`;
        }
      }

      cardEl.innerHTML = `
        <div class="card-header">
          <span class="equip-card-name">${item.icon} ${item.name}</span>
          <span class="equip-rarity-tag">${slotLabel} · ${item.rarity.toUpperCase()}</span>
        </div>
        <div class="equip-card-desc">${item.desc}</div>
      `;

      cardEl.addEventListener('click', () => {
        if (equipChosen) return;
        equipChosen = true;
        const assignedSlot = this.equipItem(item);
        const slotDef = EQUIPMENT_SLOT_DEFS.find(d => d.key === assignedSlot);
        const slotDisplayName = slotDef ? slotDef.name : assignedSlot;

        this.equipmentRewardOptions.querySelectorAll('.equipment-reward-card').forEach(c => c.classList.remove('selected'));
        cardEl.classList.add('selected');

        if (this.equipmentRewardFeedback) {
          this.equipmentRewardFeedback.textContent = `✨ [${item.name}]을(를) [${slotDisplayName}] 슬롯에 성공적으로 장착했습니다!`;
        }
      });

      this.equipmentRewardOptions.appendChild(cardEl);
    });
  }

  restartGame() {
    this.floor = 1;
    this.gold = 50;
    this.playerHp = this.playerMaxHp;
    this.diceCollection = this.createInitialDiceCollection();
    this.tarotInventory = [ { ...TAROT_CARDS.fool }, null ];
    this.tarotBuffs = { attackMultiplier: 1 };
    this.enemyStunned = false;

    // 장비(조커 시스템) 초기화
    this.equipment = {
      helmet: { ...EQUIPMENT_DATA.crown },
      weapon1: { ...EQUIPMENT_DATA.dagger },
      weapon2: null,
      armor: null,
      legs: { ...EQUIPMENT_DATA.gale_boots }
    };
    this.turnInBattle = 0;
    this.lastEffectiveEnemyDamage = 0;

    this.renderEquipmentSlots();
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
