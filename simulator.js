let races = [];

const monthSelect = document.getElementById('birth-month');
const daySelect = document.getElementById('birth-day');
const patternBox = document.getElementById('pattern-box');
const betTypeInputs = document.querySelectorAll('input[name="bet-type"]');
const raceCountSelect = document.getElementById('race-count');
const selectModeInputs = document.querySelectorAll('input[name="select-mode"]');
const venueField = document.getElementById('venue-field');
const venueSelect = document.getElementById('venue-select');
const betAmountInput = document.getElementById('bet-amount');
const calcButton = document.getElementById('calc-button');
const errorBox = document.getElementById('error-box');
const resultBox = document.getElementById('result-box');

const BET_MIN = 100;
const BET_MAX = 10000000;

const ARIMA_NAME = '有馬記念';
const CLASSIC_NAMES = ['桜花賞', '皐月賞', '優駿牝馬', '東京優駿', '秋華賞', '菊花賞'];

init();

async function init() {
  populateMonthDay();
  const res = await fetch('data/races.json');
  races = await res.json();
  populateVenueOptions();
  bindEvents();
  updatePatterns();
  validate();
}

function populateMonthDay() {
  for (let m = 1; m <= 12; m++) {
    const opt = document.createElement('option');
    opt.value = m;
    opt.textContent = `${m}月`;
    monthSelect.appendChild(opt);
  }
  for (let d = 1; d <= 31; d++) {
    const opt = document.createElement('option');
    opt.value = d;
    opt.textContent = `${d}日`;
    daySelect.appendChild(opt);
  }
}

function populateVenueOptions() {
  const venues = Array.from(new Set(races.map((r) => r.venue))).sort();
  venueSelect.innerHTML = '<option value="">選択してください</option>';
  for (const venue of venues) {
    const opt = document.createElement('option');
    opt.value = venue;
    opt.textContent = venue;
    venueSelect.appendChild(opt);
  }
}

function dayToPatternA(day) {
  return day > 18 ? day - 18 : day;
}

function dayToPatternB(day) {
  return String(day).split('').reduce((sum, ch) => sum + Number(ch), 0);
}

function updatePatterns() {
  const month = Number(monthSelect.value);
  const day = Number(daySelect.value);

  if (!month || !day) {
    patternBox.innerHTML = '';
    return;
  }

  const a = dayToPatternA(day);
  const b = dayToPatternB(day);
  const sameValue = a === b;

  patternBox.innerHTML = `
    <div class="pattern-option">
      <label>
        <input type="radio" name="number-pattern" value="a" checked>
        パターンA（18を超えたら18を引く）: <strong>${month}番 × ${a}番</strong>
      </label>
    </div>
    <div class="pattern-option">
      <label>
        <input type="radio" name="number-pattern" value="b">
        パターンB（日の各桁を合計）: <strong>${month}番 × ${b}番</strong>${sameValue ? '（パターンAと同じ）' : ''}
      </label>
    </div>
  `;
}

function getBuyNumbers() {
  const month = Number(monthSelect.value);
  const day = Number(daySelect.value);
  const patternInput = document.querySelector('input[name="number-pattern"]:checked');
  const pattern = patternInput ? patternInput.value : 'a';
  const numB = pattern === 'a' ? dayToPatternA(day) : dayToPatternB(day);
  return [month, numB];
}

function bindEvents() {
  monthSelect.addEventListener('change', () => { updatePatterns(); validate(); });
  daySelect.addEventListener('change', () => { updatePatterns(); validate(); });
  patternBox.addEventListener('change', validate);
  betAmountInput.addEventListener('input', validate);
  venueSelect.addEventListener('change', validate);
  betTypeInputs.forEach((el) => el.addEventListener('change', validate));
  raceCountSelect.addEventListener('change', validate);
  selectModeInputs.forEach((el) => el.addEventListener('change', () => {
    const mode = document.querySelector('input[name="select-mode"]:checked').value;
    venueField.hidden = mode !== 'venue';
    validate();
  }));
  calcButton.addEventListener('click', runSimulation);
}

function getSelectMode() {
  return document.querySelector('input[name="select-mode"]:checked').value;
}

function validate() {
  const betAmount = Number(betAmountInput.value);
  const month = Number(monthSelect.value);
  const day = Number(daySelect.value);
  const selectMode = getSelectMode();

  let message = '';
  if (!month || !day) {
    message = '誕生日を選択してください';
  } else if (!betAmount || betAmount < BET_MIN || betAmount > BET_MAX) {
    message = `賭け金は${BET_MIN.toLocaleString()}円〜${BET_MAX.toLocaleString()}円の範囲で入力してください`;
  } else if (selectMode === 'venue' && !venueSelect.value) {
    message = '開催場を選択してください';
  }

  errorBox.textContent = message;
  calcButton.disabled = Boolean(message);
  return !message;
}

function shuffle(arr) {
  for (let i = arr.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [arr[i], arr[j]] = [arr[j], arr[i]];
  }
  return arr;
}

function buildPool(selectMode, venue) {
  if (selectMode === 'arima') {
    return races.filter((r) => r.race_name.includes(ARIMA_NAME));
  }
  if (selectMode === 'classic') {
    return races.filter((r) => CLASSIC_NAMES.some((name) => r.race_name.includes(name)));
  }
  if (selectMode === 'venue') {
    return venue ? races.filter((r) => r.venue === venue) : races.slice();
  }
  return races.slice();
}

function selectTargetRaces(selectMode, venue, count) {
  const pool = buildPool(selectMode, venue);
  if (selectMode === 'random') {
    return shuffle(pool.slice()).slice(0, count);
  }
  return pool.slice(0, count);
}

function setsEqual(a, b) {
  if (a.size !== b.size) return false;
  for (const v of a) {
    if (!b.has(v)) return false;
  }
  return true;
}

function runSimulation() {
  if (!validate()) return;

  const [numA, numB] = getBuyNumbers();
  const betType = document.querySelector('input[name="bet-type"]:checked').value;
  const selectMode = getSelectMode();
  const venue = venueSelect.value;
  const count = Number(raceCountSelect.value);
  const betAmount = Number(betAmountInput.value);
  const target = new Set([numA, numB]);

  const targetRaces = selectTargetRaces(selectMode, venue, count);

  let bets = 0;
  let investment = 0;
  let payout = 0;
  let wins = 0;
  let losses = 0;
  const winningRaces = [];

  for (const race of targetRaces) {
    const pos1 = race.horses.find((h) => h.position === 1);
    const pos2 = race.horses.find((h) => h.position === 2);
    const pos3 = race.horses.find((h) => h.position === 3);
    if (!pos1 || !pos2 || (betType === 'wide' && !pos3)) continue;

    bets += 1;
    investment += betAmount;

    let rawPayout = 0;
    if (betType === 'quinella') {
      if (setsEqual(target, new Set([pos1.number, pos2.number]))) {
        rawPayout = race.quinella_payout;
      }
    } else {
      if (setsEqual(target, new Set([pos1.number, pos2.number]))) {
        rawPayout = race.wide_payout_1_2;
      } else if (setsEqual(target, new Set([pos1.number, pos3.number]))) {
        rawPayout = race.wide_payout_1_3;
      } else if (setsEqual(target, new Set([pos2.number, pos3.number]))) {
        rawPayout = race.wide_payout_2_3;
      }
    }

    if (rawPayout) {
      const amount = (rawPayout / 100) * betAmount;
      payout += amount;
      wins += 1;
      winningRaces.push({ race_name: race.race_name, year: race.year, amount });
    } else {
      losses += 1;
    }
  }

  renderResult({ bets, investment, payout, wins, losses, winningRaces, numA, numB, betType });
}

function renderResult({ bets, investment, payout, wins, losses, winningRaces, numA, numB, betType }) {
  const betLabel = betType === 'quinella' ? '馬連' : 'ワイド';

  if (bets === 0) {
    resultBox.innerHTML = '<p class="no-data">対象レースがありませんでした</p>';
    return;
  }

  const returnRate = (payout / investment) * 100;
  const winRate = (wins / bets) * 100;

  const winRows = winningRaces
    .map((r) => `<tr><td>${r.race_name}</td><td>${r.year}</td><td>${Math.round(r.amount).toLocaleString()}円</td></tr>`)
    .join('');

  resultBox.innerHTML = `
    <p class="buy-summary">買い目：${numA}番 × ${numB}番（${betLabel}）</p>
    <dl>
      <dt>対象レース数</dt><dd>${bets}件</dd>
      <dt>投資額</dt><dd>${Math.round(investment).toLocaleString()}円</dd>
      <dt>払戻金</dt><dd>${Math.round(payout).toLocaleString()}円</dd>
      <dt>還元率</dt><dd>${returnRate.toFixed(1)}%</dd>
      <dt>成績</dt><dd>${wins}的中${losses}外れ</dd>
      <dt>的中率</dt><dd>${winRate.toFixed(1)}%</dd>
    </dl>
    <details class="win-list">
      <summary>的中レース一覧を見る（${wins}件）</summary>
      <table>
        <thead><tr><th>レース名</th><th>年</th><th>払戻額</th></tr></thead>
        <tbody>${winRows}</tbody>
      </table>
    </details>
  `;
}
