console.log('=== PWA 版本檢查 ===');
console.log('Firebase API 已設定');

// ===== 頁面定義 =====
const pages = {
  app: document.getElementById('app'),
  rebalance: document.getElementById('rebalance'),
  history: document.getElementById('history'),
  export: document.getElementById('export'),
  settings: document.getElementById('settings'),
  version: document.getElementById('version-detail'),
  about: document.getElementById('about-page'),
  contact: document.getElementById('contact-page'),
  devmode: null,
  addproduct: document.getElementById('add-product-page'),
  deleteproduct: document.getElementById('delete-product-page'),
  tradedetail: document.getElementById('trade-detail-page'),
  gsheet: document.getElementById('gsheet-page')
};

const pageStack = [];
const backButton = document.getElementById('back-button');
const navItems = document.querySelectorAll('.bottom-nav .nav-item');

// ===== 顯示頁面 =====
function showPage(pageId, title, isBack) {
  Object.values(pages).forEach(p => { if (p) p.style.display = 'none'; });
  if (!pages[pageId]) return;
  pages[pageId].style.display = 'flex';

  if (!isBack && pageStack[pageStack.length - 1] !== pageId) {
    pageStack.push(pageId);
  }

  const topLevel = ['app','rebalance','history','export','settings'];
  const hasTopbar = ['addproduct','tradedetail','deleteproduct','gsheet','about','contact','version'];
  backButton.style.display = (topLevel.includes(pageId) || hasTopbar.includes(pageId)) ? 'none' : 'flex';
}

// ===== 導覽列點擊 =====
navItems.forEach(item => {
  item.addEventListener('click', () => {
    navItems.forEach(i => i.classList.remove('active'));
    item.classList.add('active');
    const target = item.getAttribute('data-target');
    const label = item.querySelector('span').textContent;
    if (target && pages[target]) showPage(target, label);
    if (target === 'rebalance') { updateOverview(); renderRebalance(); }
    if (target === 'history') loadHistory();

// 重新整理按鈕
document.getElementById('history-refresh-btn').addEventListener('click', () => loadHistory());
  });
});

// ===== 歷史紀錄篩選 =====
document.querySelectorAll('.hist-filter-btn').forEach(btn => {
  btn.addEventListener('click', () => {
    document.querySelectorAll('.hist-filter-btn').forEach(b => b.classList.remove('active'));
    btn.classList.add('active');
    const days = btn.dataset.days;
    const customRange = document.getElementById('hist-custom-range');
    if (days === 'custom') {
      customRange.style.display = 'flex';
      _histFilterDays = 'custom';
    } else {
      customRange.style.display = 'none';
      _histFilterDays = parseInt(days);
    }
    applyHistoryFilter();
  });
});

document.getElementById('hist-date-from') && document.getElementById('hist-date-from').addEventListener('change', e => {
  _histDateFrom = e.target.value; applyHistoryFilter();
});
document.getElementById('hist-date-to') && document.getElementById('hist-date-to').addEventListener('change', e => {
  _histDateTo = e.target.value; applyHistoryFilter();
});

// ===== 自訂月曆 =====
let _calTarget = null; // 'from' | 'to'
let _calYear = new Date().getFullYear();
let _calMonth = new Date().getMonth();

function openDatePicker(target) {
  _calTarget = target;
  const now = new Date();
  _calYear  = now.getFullYear();
  _calMonth = now.getMonth();
  renderCal();
  document.getElementById('hist-cal-modal').style.display = 'block';
}
function closeDatePicker() {
  document.getElementById('hist-cal-modal').style.display = 'none';
}
function calNav(dir) {
  _calMonth += dir;
  if (_calMonth > 11) { _calMonth = 0; _calYear++; }
  if (_calMonth < 0)  { _calMonth = 11; _calYear--; }
  renderCal();
}
function toggleMonthPicker() {
  const mp = document.getElementById('hist-month-picker');
  const days = document.getElementById('hist-cal-days');
  const weekRow = days.previousElementSibling;
  const isOpen = mp.style.display !== 'none';
  if (isOpen) {
    mp.style.display = 'none';
    days.style.display = 'grid';
    if (weekRow) weekRow.style.display = 'grid';
  } else {
    renderMonthPicker();
    mp.style.display = 'block';
    days.style.display = 'none';
    if (weekRow) weekRow.style.display = 'none';
  }
}

function renderMonthPicker() {
  const grid = document.getElementById('hist-month-grid');
  grid.innerHTML = '';
  const months = ['1月','2月','3月','4月','5月','6月','7月','8月','9月','10月','11月','12月'];
  months.forEach((m, i) => {
    const btn = document.createElement('button');
    btn.textContent = m;
    const isActive = i === _calMonth;
    const isDark = document.body.classList.contains('dark');
    btn.style.cssText = `
      padding: 12px 4px; border-radius: 12px; border: none; cursor: pointer;
      font-size: 14px; font-weight: 600;
      background: ${isActive ? '#e8706f' : isDark ? 'rgba(255,255,255,0.08)' : '#f0f0f0'};
      color: ${isActive ? '#fff' : isDark ? 'rgba(255,255,255,0.75)' : '#1E2A38'};
      transition: all 0.15s;
    `;
    btn.onclick = () => {
      _calMonth = i;
      document.getElementById('hist-month-picker').style.display = 'none';
      const days = document.getElementById('hist-cal-days');
      const weekRow = days.previousElementSibling;
      days.style.display = 'grid';
      if (weekRow) weekRow.style.display = 'grid';
      renderCal();
    };
    grid.appendChild(btn);
  });

  // 年份切換
  const yearRow = document.createElement('div');
  yearRow.style.cssText = 'grid-column:1/-1;display:flex;align-items:center;justify-content:center;gap:16px;margin-top:8px;';
  yearRow.innerHTML = `
    <button onclick="_calYear--;renderMonthPicker()" style="background:rgba(255,255,255,0.1);border:none;width:36px;height:36px;border-radius:50%;font-size:18px;cursor:pointer;color:#fff;display:flex;align-items:center;justify-content:center;">‹</button>
    <span style="font-size:15px;font-weight:800;color:#fff;">${_calYear}年</span>
    <button onclick="_calYear++;renderMonthPicker()" style="background:rgba(255,255,255,0.1);border:none;width:36px;height:36px;border-radius:50%;font-size:18px;cursor:pointer;color:#fff;display:flex;align-items:center;justify-content:center;">›</button>
  `;
  grid.appendChild(yearRow);
}

function renderCal() {
  document.getElementById('hist-cal-title').innerHTML = `${_calYear}年${_calMonth+1}月 <span style="font-size:11px;opacity:0.5;">▾</span>`;
  const container = document.getElementById('hist-cal-days');
  container.innerHTML = '';
  const first = new Date(_calYear, _calMonth, 1).getDay();
  const days  = new Date(_calYear, _calMonth + 1, 0).getDate();
  const today = new Date();
  const selFrom = _histDateFrom ? new Date(_histDateFrom + 'T00:00:00') : null;
  const selTo   = _histDateTo   ? new Date(_histDateTo   + 'T00:00:00') : null;

  for (let i = 0; i < first; i++) {
    container.appendChild(Object.assign(document.createElement('span'), {}));
  }
  for (let d = 1; d <= days; d++) {
    const btn = document.createElement('button');
    const thisDate = new Date(_calYear, _calMonth, d);
    const isToday = thisDate.toDateString() === today.toDateString();
    const isSelected = (selFrom && thisDate.toDateString() === selFrom.toDateString()) ||
                       (selTo   && thisDate.toDateString() === selTo.toDateString());
    btn.textContent = d;
    const isDark = document.body.classList.contains('dark');
    btn.style.cssText = `
      border:none; border-radius:50%; width:38px; height:38px;
      font-size:14px; font-weight:${isToday ? '700' : '500'};
      cursor:pointer; transition:all 0.15s; margin:0 auto; display:block;
      background:${isSelected ? '#e8706f' : 'transparent'};
      color:${isSelected ? '#fff' : isToday ? '#e8706f' : isDark ? 'rgba(255,255,255,0.85)' : '#1E2A38'};
      outline:${isToday && !isSelected ? '1.5px solid #e8706f' : 'none'};
    `;
    btn.onclick = () => {
      const val = `${_calYear}-${String(_calMonth+1).padStart(2,'0')}-${String(d).padStart(2,'0')}`;
      if (_calTarget === 'from') {
        _histDateFrom = val;
        const el = document.getElementById('hist-from-display');
        el.textContent = `${_calYear}/${_calMonth+1}/${d}`;
        el.classList.remove('placeholder');
      } else {
        _histDateTo = val;
        const el = document.getElementById('hist-to-display');
        el.textContent = `${_calYear}/${_calMonth+1}/${d}`;
        el.classList.remove('placeholder');
      }
      closeDatePicker();
      applyHistoryFilter();
    };
    container.appendChild(btn);
  }
}

// ===== 返回按鈕 =====
backButton.addEventListener('click', () => {
  if (pageStack.length > 1) {
    pageStack.pop();
    const prev = pageStack[pageStack.length - 1];
    showPage(prev, '', true);
    // 同步導覽列 active 狀態
    navItems.forEach(i => {
      i.classList.toggle('active', i.getAttribute('data-target') === prev);
    });
  }
});

// ===== 交易頁面搜尋 =====
let _tradeCatFilter = 'ALL';

function filterTradeCards() {
  const q = document.getElementById('trade-search').value.trim().toLowerCase();
  document.querySelectorAll('#trade-list .trade-card').forEach(card => {
    const name = card.getAttribute('data-name').toLowerCase();
    const tag  = card.querySelector('.trade-tag')?.textContent.trim() || '';
    const matchSearch = !q || name.includes(q);
    const matchCat    = _tradeCatFilter === 'ALL' || tag === _tradeCatFilter;
    card.style.display = (matchSearch && matchCat) ? '' : 'none';
  });
}

document.getElementById('trade-search').addEventListener('input', filterTradeCards);

document.querySelectorAll('.trade-cat-btn').forEach(btn => {
  btn.addEventListener('click', () => {
    document.querySelectorAll('.trade-cat-btn').forEach(b => b.classList.remove('active'));
    btn.classList.add('active');
    _tradeCatFilter = btn.dataset.cat;
    filterTradeCards();
  });
});

// 加號按鈕 → 新增商品頁
document.getElementById('trade-add-btn').addEventListener('click', () => {
  showPage('addproduct', '新增商品');
});

// 刪除商品按鈕 → 刪除商品頁
document.getElementById('ap-delete-btn').addEventListener('click', () => {
  const deleteList = document.getElementById('delete-list');
  deleteList.innerHTML = '';
  document.querySelectorAll('#trade-list .trade-card').forEach(card => {
    const clone = card.cloneNode(true);
    // 加上刪除按鈕
    const delBtn = document.createElement('button');
    delBtn.className = 'trade-del-btn';
    delBtn.innerHTML = `<svg width="16" height="16" viewBox="0 0 24 24" fill="none">
      <path d="M3 6h18M8 6V4h8v2M19 6l-1 14H6L5 6" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/>
    </svg>`;
    delBtn.addEventListener('click', () => {
      const name = card.getAttribute('data-name');
      // 顯示確認浮窗
      const modal = document.getElementById('delete-confirm-modal');
      const modalBox = modal.querySelector('div');
      const isDark = document.body.classList.contains('dark');
      modalBox.style.background = isDark ? '#1e1e1e' : '#fff';
      modalBox.querySelector('div').style.color = isDark ? '#eee' : '#1E2A38';
      document.getElementById('delete-confirm-cancel').style.background = isDark ? '#2a2a2a' : '#f0f0f0';
      document.getElementById('delete-confirm-cancel').style.color = isDark ? '#eee' : '#555';
      document.getElementById('delete-confirm-name').textContent = name;
      modal.style.display = 'flex';

      // 確認刪除
      document.getElementById('delete-confirm-ok').onclick = () => {
        modal.style.display = 'none';
        document.querySelectorAll('#trade-list .trade-card').forEach(c => {
          if (c.getAttribute('data-name') === name) c.remove();
        });
        clone.remove();
        gsWrite('deleteProduct', { name });
        try {
          const cached = localStorage.getItem('acs_products_cache');
          if (cached) {
            const rows = JSON.parse(cached).filter(r => r[0] !== name);
            localStorage.setItem('acs_products_cache', JSON.stringify(rows));
          }
        } catch(e) {}
        updateOverview();
      };

      // 取消
      document.getElementById('delete-confirm-cancel').onclick = () => {
        modal.style.display = 'none';
      };
    });
    clone.appendChild(delBtn);
    deleteList.appendChild(clone);
  });
  showPage('deleteproduct', '刪除商品');
});
// ===== 新增商品頁：依種類動態商品名稱 =====
// 格式：{ v: 存入的代號, l: 顯示的名稱 }
const CATEGORY_PRODUCTS = {
  '加密貨幣': [
    {v:'BTC',l:'BTC - Bitcoin'},
    {v:'ETH',l:'ETH - Ethereum'},
    {v:'BNB',l:'BNB - BNB Chain'},
    {v:'SOL',l:'SOL - Solana'},
    {v:'XRP',l:'XRP - Ripple'},
    {v:'ADA',l:'ADA - Cardano'},
    {v:'DOGE',l:'DOGE - Dogecoin'},
    {v:'AVAX',l:'AVAX - Avalanche'},
    {v:'DOT',l:'DOT - Polkadot'},
    {v:'MATIC',l:'MATIC - Polygon'},
    {v:'LTC',l:'LTC - Litecoin'},
    {v:'LINK',l:'LINK - Chainlink'},
    {v:'UNI',l:'UNI - Uniswap'},
    {v:'ATOM',l:'ATOM - Cosmos'},
    {v:'ETC',l:'ETC - Ethereum Classic'},
    {v:'XLM',l:'XLM - Stellar'},
    {v:'NEAR',l:'NEAR - NEAR Protocol'},
    {v:'APT',l:'APT - Aptos'},
    {v:'OP',l:'OP - Optimism'},
    {v:'ARB',l:'ARB - Arbitrum'},
    {v:'FTM',l:'FTM - Fantom'},
    {v:'SAND',l:'SAND - The Sandbox'},
    {v:'MANA',l:'MANA - Decentraland'},
    {v:'AXS',l:'AXS - Axie Infinity'},
    {v:'THETA',l:'THETA - Theta Network'},
    {v:'FIL',l:'FIL - Filecoin'},
    {v:'HBAR',l:'HBAR - Hedera'},
    {v:'VET',l:'VET - VeChain'},
    {v:'ALGO',l:'ALGO - Algorand'},
    {v:'ICP',l:'ICP - Internet Computer'},
    {v:'USDT',l:'USDT - Tether'},
    {v:'USDC',l:'USDC - USD Coin'},
    {v:'DAI',l:'DAI - Dai'},
  ],
  'ETF/股票': [
    // 台灣熱門 ETF
    {v:'0050',l:'0050 - 元大台灣50'},
    {v:'0056',l:'0056 - 元大高股息'},
    {v:'00878',l:'00878 - 國泰永續高股息'},
    {v:'00940',l:'00940 - 元大台灣價值高息'},
    {v:'00919',l:'00919 - 群益台灣精選高息'},
    {v:'006208',l:'006208 - 富邦台50'},
    {v:'00713',l:'00713 - 元大台灣高息低波'},
    {v:'00720B',l:'00720B - 元大投資級公司債'},
    {v:'00679B',l:'00679B - 元大美債20年'},
    {v:'0052',l:'0052 - 富邦科技'},
    // 台灣大型股
    {v:'2330',l:'2330 - 台積電'},
    {v:'2317',l:'2317 - 鴻海'},
    {v:'2454',l:'2454 - 聯發科'},
    {v:'2382',l:'2382 - 廣達'},
    {v:'2412',l:'2412 - 中華電'},
    {v:'3008',l:'3008 - 大立光'},
    {v:'2308',l:'2308 - 台達電'},
    {v:'2303',l:'2303 - 聯電'},
    {v:'2881',l:'2881 - 富邦金'},
    {v:'2882',l:'2882 - 國泰金'},
    {v:'2886',l:'2886 - 兆豐金'},
    {v:'2891',l:'2891 - 中信金'},
    {v:'2884',l:'2884 - 玉山金'},
    {v:'2885',l:'2885 - 元大金'},
    {v:'2892',l:'2892 - 第一金'},
    {v:'2883',l:'2883 - 開發金'},
    {v:'1301',l:'1301 - 台塑'},
    {v:'1303',l:'1303 - 南亞'},
    {v:'1326',l:'1326 - 台化'},
    {v:'2002',l:'2002 - 中鋼'},
    {v:'2207',l:'2207 - 和泰車'},
    {v:'2301',l:'2301 - 光寶科'},
    {v:'2357',l:'2357 - 華碩'},
    {v:'2379',l:'2379 - 瑞昱'},
    {v:'2395',l:'2395 - 研華'},
    {v:'2408',l:'2408 - 南亞科'},
    {v:'2474',l:'2474 - 可成'},
    {v:'2475',l:'2475 - 華映'},
    {v:'3034',l:'3034 - 聯詠'},
    {v:'3037',l:'3037 - 欣興'},
    {v:'3045',l:'3045 - 台灣大'},
    {v:'3711',l:'3711 - 日月光投控'},
    {v:'4904',l:'4904 - 遠傳'},
    {v:'4938',l:'4938 - 和碩'},
    {v:'5854',l:'5854 - 合庫金'},
    {v:'6415',l:'6415 - 矽力-KY'},
    {v:'6505',l:'6505 - 台塑化'},
    {v:'8046',l:'8046 - 南電'},
    {v:'5314',l:'5314 - 世紀*'},
    {v:'__custom__',l:'✏️ 輸入其他代號'},
  ],
  '貴金屬': [
    {v:'GOLD_TW', l:'黃金存摺 - 台銀牌價(NT$/克)'},
    {v:'AU9901',  l:'AU9901 - 台銀金'},
    {v:'AU9902',  l:'AU9902 - 一銀金'},
    {v:'00738U',  l:'00738U - 元大銀期貨'},
  ],
  '現金': [
    {v:'TWD',l:'TWD - 新台幣'},
    {v:'USDT',l:'USDT - Tether'},
  ],
};

// ===== 新增商品頁：依種類動態商品名稱（搜尋式）=====
let apCurrentProducts = [];

function renderDropdown(filter = '') {
  const dropdown = document.getElementById('ap-dropdown');
  const keyword  = filter.trim().toUpperCase();
  const filtered = keyword
    ? apCurrentProducts.filter(p => {
        const label = typeof p === 'object' ? p.l : p;
        return label.toUpperCase().includes(keyword);
      })
    : apCurrentProducts;

  dropdown.innerHTML = '';
  if (filtered.length === 0) {
    dropdown.innerHTML = '<div class="ap-dropdown-empty">找不到符合的商品</div>';
  } else {
    filtered.forEach(p => {
      const value = typeof p === 'object' ? p.v : p;
      const label = typeof p === 'object' ? p.l : p;
      const item = document.createElement('div');
      item.className = 'ap-dropdown-item';
      item.textContent = label;
      item.addEventListener('mousedown', () => selectProduct(value, label));
      dropdown.appendChild(item);
    });
  }
}

function selectProduct(value, label) {
  const searchInput  = document.getElementById('ap-name-search');
  const hiddenSelect = document.getElementById('ap-name-select');
  const nameCustom   = document.getElementById('ap-name-custom');
  const dropdown     = document.getElementById('ap-dropdown');

  dropdown.style.display = 'none';

  if (value === '__custom__') {
    searchInput.value  = '';
    hiddenSelect.value = '__custom__';
    nameCustom.style.display = 'block';
    nameCustom.placeholder = '輸入股票/ETF 代號，例：00631L';
    nameCustom.value = '';
    nameCustom.focus();
  } else {
    searchInput.value  = label || value;
    hiddenSelect.value = value;
    nameCustom.style.display = 'none';
    nameCustom.value = '';
  }
}

document.getElementById('ap-type').addEventListener('change', function() {
  const type        = this.value;
  const searchInput = document.getElementById('ap-name-search');
  const hiddenSelect= document.getElementById('ap-name-select');
  const nameCustom  = document.getElementById('ap-name-custom');
  const dropdown    = document.getElementById('ap-dropdown');

  hiddenSelect.value = '';
  nameCustom.style.display = 'none';
  nameCustom.value = '';
  dropdown.style.display = 'none';

  if (!type) {
    searchInput.value = '';
    searchInput.disabled = true;
    searchInput.placeholder = '請先選擇商品種類';
    apCurrentProducts = [];
    return;
  }

  apCurrentProducts = CATEGORY_PRODUCTS[type] || ['其他'];
  searchInput.disabled = false;
  searchInput.placeholder = '搜尋或選擇商品...';
  searchInput.value = '';
  searchInput.focus();
});

document.getElementById('ap-name-search').addEventListener('focus', function() {
  if (apCurrentProducts.length === 0) return;
  renderDropdown(this.value);
  document.getElementById('ap-dropdown').style.display = 'block';
});

document.getElementById('ap-name-search').addEventListener('input', function() {
  const dropdown = document.getElementById('ap-dropdown');
  if (apCurrentProducts.length === 0) return;
  renderDropdown(this.value);
  dropdown.style.display = 'block';
  // 清除已選的值（等使用者重新選）
  document.getElementById('ap-name-select').value = '';
});

document.getElementById('ap-name-search').addEventListener('blur', function() {
  // 延遲關閉讓 mousedown 先觸發
  setTimeout(() => {
    document.getElementById('ap-dropdown').style.display = 'none';
  }, 150);
});

document.getElementById('ap-submit-btn').addEventListener('click', () => {
  const type       = document.getElementById('ap-type').value;
  const nameSelect = document.getElementById('ap-name-select').value;
  const nameCustom = document.getElementById('ap-name-custom').value.trim().toUpperCase();
  const name       = (nameSelect === '__custom__') ? nameCustom : nameSelect;
  const qty        = document.getElementById('ap-qty').value.trim();
  const value      = document.getElementById('ap-value').value.trim();

  if (!type || !name || !qty || !value) {
    alert('請填寫所有欄位');
    return;
  }

  // 檢查同名稱同種類是否已存在
  const duplicate = Array.from(document.querySelectorAll('#trade-list .trade-card')).some(card => {
    const cardName = card.querySelector('.trade-name')?.childNodes[0]?.textContent.trim();
    const cardTag  = card.querySelector('.trade-tag')?.textContent.trim();
    return cardName === name && cardTag === type;
  });
  if (duplicate) {
    alert(`「${name}」已存在於 ${type} 類別中，無法重複新增`);
    return;
  }

  const colors   = { '加密貨幣': '#f5a623', 'ETF/股票': '#7396c6', '貴金屬': '#dfb199', '現金': '#9eb995' };
  const color    = colors[type] || '#aaa';
  const icon     = type === '貴金屬' ? 'Au' : type === '現金' ? '$' : name.substring(0,2).toUpperCase();
  const costNum  = parseInt(value) || 0;

  const card = document.createElement('div');
  card.className = 'trade-card';
  card.setAttribute('data-name', name);
  card.setAttribute('data-qty', qty);
  card.setAttribute('data-cost', costNum);
  card.innerHTML = `
    <div class="trade-card-left">
      <div class="trade-icon" style="background:${color};">${icon}</div>
      <div class="trade-info">
        <div class="trade-name">${name} <span class="trade-tag">${type}</span></div>
        <div class="trade-vol">持有數量：${qty}</div>
      </div>
    </div>
    <div class="trade-card-right">
      <div class="trade-col"><div class="trade-avg">--</div></div>
      <div class="trade-col"><div class="trade-total">--</div></div>
    </div>`;
  document.getElementById('trade-list').appendChild(card);
  recalcAllAvg();
  updateOverview();
  scheduleFetchPrices(500);

  // 寫入 Google Sheet 商品工作表
  gsWrite('addProduct', { name, type, qty: parseFloat(qty), value: costNum });
  // 更新本地快取
  try {
    const cached = localStorage.getItem('acs_products_cache');
    const rows = cached ? JSON.parse(cached) : [];
    rows.push([name, type, qty, costNum, '']);
    localStorage.setItem('acs_products_cache', JSON.stringify(rows));
  } catch(e) {}

  // 清空表單
  document.getElementById('ap-type').value = '';
  document.getElementById('ap-name-search').value = '';
  document.getElementById('ap-name-search').disabled = true;
  document.getElementById('ap-name-search').placeholder = '請先選擇商品種類';
  document.getElementById('ap-name-select').value = '';
  document.getElementById('ap-name-custom').style.display = 'none';
  document.getElementById('ap-name-custom').value = '';
  document.getElementById('ap-qty').value   = '';
  document.getElementById('ap-value').value = '';
  apCurrentProducts = [];

  // 返回交易頁
  showPage('export', '交易');
  navItems.forEach(i => i.classList.toggle('active', i.getAttribute('data-target') === 'export'));
});

// ===== 交易詳情頁面 =====
let tdCurrentType = 'buy';

// 點擊交易頁卡片 → 展開/折疊
document.getElementById('trade-list').addEventListener('click', e => {
  const adjustBtn = e.target.closest('.trade-adjust-btn');
  const card = e.target.closest('.trade-card');
  if (!card) return;

  // 點擊「調整資產」→ 進入交易詳情
  if (adjustBtn) {
    const nameEl  = card.querySelector('.trade-name');
    const iconEl  = card.querySelector('.trade-icon');
    const tagEl   = card.querySelector('.trade-tag');
    const avgEl   = card.querySelector('.trade-avg');

    const name    = nameEl ? nameEl.childNodes[0].textContent.trim() : '';
    const icon    = iconEl ? iconEl.textContent.trim() : '';
    const iconBg  = iconEl ? iconEl.style.background : '#aaa';
    const tag     = tagEl  ? tagEl.textContent.trim() : '';
    const qty     = card.dataset.qty || '--';
    const cost    = parseFloat(card.getAttribute('data-cost')) || 0;
    const qtyNum  = parseFloat(card.dataset.qty) || 0;
    const avgPrice = (qtyNum > 0 && cost > 0) ? smartNum(cost / qtyNum) : '--';

    document.getElementById('td-icon').textContent      = icon;
    document.getElementById('td-icon').style.background = iconBg;
    document.getElementById('td-name').textContent      = name;
    document.getElementById('td-tag').textContent       = tag;
    document.getElementById('td-avg').textContent       = avgPrice !== '--' ? 'NT$ ' + avgPrice : '--';
    document.getElementById('td-qty').textContent       = qty;

    const totalEl    = card.querySelector('.trade-total');
    const currentVal = totalEl ? totalEl.textContent.trim() : '--';
    document.getElementById('td-current-value').textContent = currentVal !== '--' ? 'NT$ ' + currentVal : '--';
    document.getElementById('td-price').value        = '';
    document.getElementById('td-qty-input').value    = '';
    document.getElementById('td-result-value').textContent = 'NT$ 0';
    const avgResEl = document.getElementById('td-result-avg');
    if (avgResEl) avgResEl.textContent = '--';

    // TWD: hide total price field, show only qty
    const isTWD = tag === '現金';
    const priceField = document.getElementById('td-price-field');
    const avgResultRow = document.getElementById('td-avg-result');
    if (priceField) priceField.style.display = isTWD ? 'none' : '';
    if (avgResultRow) avgResultRow.style.display = isTWD ? 'none' : '';

    tdCurrentType = 'buy';
    document.getElementById('td-tab-buy').classList.add('active');
    document.getElementById('td-tab-sell').classList.remove('active');
    document.getElementById('td-confirm-btn').textContent = '確認買入';
    document.getElementById('td-confirm-btn').style.background = '#e8706f';
    document.getElementById('td-topbar-title').textContent = '買入';

    showPage('tradedetail', name);
    return;
  }

  // 點擊卡片本體 → 展開/折疊
  const isExpanded = card.classList.contains('expanded');
  // 先折疊所有已展開的卡片
  document.querySelectorAll('#trade-list .trade-card.expanded').forEach(c => c.classList.remove('expanded'));
  if (!isExpanded) card.classList.add('expanded');
});

// 買入/賣出切換
document.querySelectorAll('.td-tab').forEach(btn => {
  btn.addEventListener('click', () => {
    document.querySelectorAll('.td-tab').forEach(b => b.classList.remove('active'));
    btn.classList.add('active');
    tdCurrentType = btn.dataset.type;
    const isBuy = tdCurrentType === 'buy';
    document.getElementById('td-confirm-btn').textContent = isBuy ? '確認買入' : '確認賣出';
    document.getElementById('td-confirm-btn').style.background = isBuy ? '#e8706f' : 'rgba(119,164,120,0.85)';
    document.getElementById('td-topbar-title').textContent = isBuy ? '買入' : '賣出';
  });
});

// 確認交易按鈕
document.getElementById('td-confirm-btn').addEventListener('click', () => {
  const tag   = document.getElementById('td-tag') ? document.getElementById('td-tag').textContent.trim() : '';
  const isTWD = tag === '現金';
  const qty   = parseFloat(document.getElementById('td-qty-input').value) || 0;
  let total, unitPrice;
  if (isTWD) {
    total     = qty;
    unitPrice = 1;
  } else {
    total     = parseFloat(document.getElementById('td-price').value) || 0;
    unitPrice = qty > 0 ? total / qty : 0;
  }

  if (!qty) { alert('請輸入數量'); return; }
  if (!isTWD && !total) { alert('請輸入總價'); return; }

  if (tdCurrentType === 'buy' && qty <= 0) {
    alert('買入數量必須大於 0');
    return;
  }

  if (tdCurrentType === 'sell') {
    const holdingQty = parseFloat(document.getElementById('td-qty').textContent) || 0;
    if (qty <= 0) { alert('賣出數量必須大於 0'); return; }
    if (qty > holdingQty) {
      alert(`賣出數量（${qty}）不能大於持有數量（${holdingQty}）`);
      return;
    }
  }

  const name      = document.getElementById('td-name').textContent;
  const tradeType = tdCurrentType === 'buy' ? '買入' : '賣出';

  // 顯示確認浮窗
  const modal = document.getElementById('trade-confirm-modal');
  const isBuyAction = tradeType === '買入';
  document.getElementById('trade-confirm-title').textContent = `確認${tradeType}`;
  document.getElementById('trade-confirm-title').style.color = isBuyAction ? '#e8706f' : '#77a478';
  document.getElementById('trade-confirm-subtitle').textContent = isBuyAction ? '請確認以下買入資訊' : '請確認以下賣出資訊';
  document.getElementById('trade-confirm-body').innerHTML =
    `商品：${name}<br>數量：${qty}<br>均價：NT$ ${smartNum(unitPrice)}<br>總價：NT$ ${Math.round(total).toLocaleString()}`;
  document.getElementById('trade-confirm-ok').style.background = isBuyAction ? '#e8706f' : '#77a478';
  modal.style.display = 'flex';
});

function executeTrade() {
  const tag   = document.getElementById('td-tag') ? document.getElementById('td-tag').textContent.trim() : '';
  const isTWD = tag === '現金';
  const qty   = parseFloat(document.getElementById('td-qty-input').value) || 0;
  let total, price;
  if (isTWD) {
    total = qty;
    price = 1;
  } else {
    total = parseFloat(document.getElementById('td-price').value) || 0;
    price = qty > 0 ? total / qty : 0;
  }
  total = Math.round(total);
  const name      = document.getElementById('td-name').textContent;
  const tradeType = tdCurrentType === 'buy' ? '買入' : '賣出';
  const datetime  = getTWDatetime();

  // 更新交易頁卡片的持有數量＋成本＋均價＋現有價值
  const holdingQty = parseFloat(document.getElementById('td-qty').textContent) || 0;
  const newQty     = tdCurrentType === 'buy' ? holdingQty + qty : holdingQty - qty;
  const newQtyRounded = Math.round(newQty * 10000) / 10000;

  document.querySelectorAll('#trade-list .trade-card').forEach(card => {
    const cardName = card.querySelector('.trade-name')?.childNodes[0]?.textContent.trim();
    if (cardName !== name) return;

    const oldCost = parseFloat(card.getAttribute('data-cost')) || 0;
    const oldAvg  = holdingQty > 0 ? oldCost / holdingQty : 0;
    let newCost;
    if (tdCurrentType === 'buy') {
      newCost = oldCost + total;
    } else {
      newCost = Math.round(oldAvg * newQtyRounded);
    }

    card.setAttribute('data-qty',  newQtyRounded);
    card.setAttribute('data-cost', newCost);

    const volEl    = card.querySelector('.trade-vol');
    const avgEl    = card.querySelector('.trade-avg');
    const totalEl  = card.querySelector('.trade-total');
    if (volEl) volEl.textContent = '持有數量：' + newQtyRounded;

    if (avgEl) {
      if (newQtyRounded <= 0) {
        avgEl.textContent = '--'; avgEl.className = 'trade-avg';
      } else {
        const tag = card.querySelector('.trade-tag')?.textContent.trim();
        const mp  = parseFloat(card.getAttribute('data-market-price')) || price;
        updateAvgEl(avgEl, newCost, newQtyRounded, mp, tag);
      }
    }

    const marketPrice = parseFloat(card.getAttribute('data-market-price')) || price;
    if (totalEl) totalEl.textContent = newQtyRounded <= 0 ? '--' : smartNum(newQtyRounded * marketPrice);

    // 更新展開區
    const costEl   = card.querySelector('.trade-expand-cost');
    const expAvgEl = card.querySelector('.trade-expand-avg');
    const pnlEl    = card.querySelector('.trade-expand-pnl');
    if (costEl) costEl.textContent = newCost.toLocaleString();
    if (expAvgEl) expAvgEl.textContent = (newQtyRounded > 0 && newCost > 0) ? smartNum(newCost / newQtyRounded) : '--';
    if (pnlEl && newCost > 0 && newQtyRounded > 0) {
      const mp2 = parseFloat(card.getAttribute('data-market-price')) || price;
      const pnl = Math.round(newQtyRounded * mp2) - newCost;
      const sign = pnl >= 0 ? '+' : '';
      const cls  = pnl >= 0 ? 'up' : 'down';
      pnlEl.textContent = sign + pnl.toLocaleString();
      pnlEl.className   = 'trade-expand-value trade-expand-pnl ' + cls;
    }

    gsWrite('updateProduct', { name, qty: newQtyRounded, value: newCost });
  });

  document.getElementById('td-qty').textContent = newQtyRounded;

  // 更新詳情頁現有價值
  const updatedCard = document.querySelector(`#trade-list .trade-card[data-name="${document.getElementById('td-name').textContent}"]`);
  if (updatedCard) {
    const updatedTotal = updatedCard.querySelector('.trade-total')?.textContent.trim();
    document.getElementById('td-current-value').textContent = (updatedTotal && updatedTotal !== '--') ? 'NT$ ' + updatedTotal : '--';
  }

  updateOverview();
  scheduleFetchPrices(300);

  // 同步更新 localStorage 快取
  try {
    const rows = [];
    document.querySelectorAll('#trade-list .trade-card').forEach(card => {
      const n   = card.querySelector('.trade-name')?.childNodes[0]?.textContent.trim();
      const t   = card.querySelector('.trade-tag')?.textContent.trim();
      const q   = card.getAttribute('data-qty');
      const c   = card.getAttribute('data-cost');
      if (n && t) rows.push([n, t, q, c, '']);
    });
    localStorage.setItem('acs_products_cache', JSON.stringify(rows));
  } catch(e) {}

  gsWrite('addHistory', { datetime, name, tradeType, qty, price, total });
  setTimeout(() => loadHistory(false), 3000);

  // 清空欄位
  document.getElementById('td-price').value     = '';
  document.getElementById('td-qty-input').value = '';
  document.getElementById('td-result-value').textContent = 'NT$ 0';
  const avgResEl2 = document.getElementById('td-result-avg');
  if (avgResEl2) avgResEl2.textContent = '--';
}

document.getElementById('trade-confirm-cancel').addEventListener('click', () => {
  document.getElementById('trade-confirm-modal').style.display = 'none';
});
document.getElementById('trade-confirm-ok').addEventListener('click', () => {
  document.getElementById('trade-confirm-modal').style.display = 'none';
  const name      = document.getElementById('td-name').textContent;
  const qty       = parseFloat(document.getElementById('td-qty-input').value) || 0;
  const tagConfirm = document.getElementById('td-tag') ? document.getElementById('td-tag').textContent.trim() : '';
  const isTWDConfirm = tagConfirm === '現金';
  const price = isTWDConfirm ? 1 : (qty > 0 ? (parseFloat(document.getElementById('td-price').value) || 0) / qty : 0);
  const total = isTWDConfirm ? Math.round(qty) : Math.round(parseFloat(document.getElementById('td-price').value) || 0);
  const tradeType = tdCurrentType === 'buy' ? '買入' : '賣出';
  executeTrade();
  showPage('export', '交易');
  navItems.forEach(i => i.classList.toggle('active', i.getAttribute('data-target') === 'export'));
  showTradeToast(tradeType, name, qty, total);
});

function showTradeToast(tradeType, name, qty, total) {
  const isBuy = tradeType === '買入';
  const toast = document.getElementById('trade-toast');
  toast.style.background = 'rgba(30,42,56,0.88)';
  document.getElementById('trade-toast-title').textContent = tradeType + '成功';
  document.getElementById('trade-toast-body').innerHTML =
    `${name} × ${qty} &nbsp;·&nbsp; NT$ ${total.toLocaleString()}`;

  const topbarH = 'calc(max(env(safe-area-inset-top), 16px) + 52px)';
  toast.style.top = '0px';
  clearTimeout(toast._timer);
  toast._timer = setTimeout(() => { toast.style.top = '-160px'; }, 3000);
}
function calcTdResult() {
  const tag   = document.getElementById('td-tag') ? document.getElementById('td-tag').textContent.trim() : '';
  const isTWD = tag === '現金';
  const qty   = parseFloat(document.getElementById('td-qty-input').value) || 0;
  let total, avgPrice;
  if (isTWD) {
    total    = qty;
    avgPrice = qty > 0 ? 1 : 0;
  } else {
    total    = parseFloat(document.getElementById('td-price').value) || 0;
    avgPrice = (total > 0 && qty > 0) ? total / qty : 0;
  }
  document.getElementById('td-result-value').textContent = 'NT$ ' + Math.round(total).toLocaleString();
  const avgEl = document.getElementById('td-result-avg');
  if (avgEl) avgEl.textContent = avgPrice > 0 ? 'NT$ ' + smartNum(avgPrice) : '--';
}
document.getElementById('td-price').addEventListener('input', calcTdResult);
document.getElementById('td-qty-input').addEventListener('input', calcTdResult);

// ===== 再平衡頁面渲染 =====
window.rbAssets = [];

function drawRbRing(canvasId, pct, color, isSafe) {
  const canvas = document.getElementById(canvasId);
  if (!canvas) return;
  const ctx = canvas.getContext('2d');
  const cx = 32, cy = 32, r = 26, lw = 6;
  ctx.clearRect(0, 0, 64, 64);
  // 背景軌道
  ctx.beginPath(); ctx.arc(cx, cy, r, 0, Math.PI * 2);
  ctx.strokeStyle = document.body.classList.contains('dark') ? '#2a2a2a' : '#f0f0f0';
  ctx.lineWidth = lw; ctx.stroke();
  // 進度弧
  const start = -Math.PI / 2;
  const end   = start + (Math.PI * 2 * Math.min(pct, 100) / 100);
  ctx.beginPath(); ctx.arc(cx, cy, r, start, end);
  ctx.strokeStyle = color;
  ctx.lineWidth = lw; ctx.lineCap = 'round'; ctx.stroke();
}

function renderRebalance() {
  const assets = window.rbAssets;
  if (!assets || assets.length === 0) return;
  const total  = assets.reduce((s, a) => s + a.current, 0) || 1;
  const SAFE_MIN = 15, SAFE_MAX = 35;

  // 找最偏離的資產用來顯示在頂部
  let worstAsset = assets[0], worstDiff = 0;
  const pcts = assets.map(a => {
    const p = Math.round(a.current / total * 1000) / 10;
    const diff = p > SAFE_MAX ? p - SAFE_MAX : p < SAFE_MIN ? SAFE_MIN - p : 0;
    if (diff > worstDiff) { worstDiff = diff; worstAsset = a; }
    return { ...a, pct: p, diff };
  });

  const allSafe = pcts.every(a => a.pct >= SAFE_MIN && a.pct <= SAFE_MAX);
  const worst   = pcts.find(a => a.key === worstAsset.key);

  // 更新標頭
  const shield = document.getElementById('rb-shield');
  const title  = document.getElementById('rb-title');
  const sub    = document.getElementById('rb-subtitle');
  if (allSafe) {
    shield.className = 'rb-shield safe';
    shield.innerHTML = `<svg width="44" height="44" viewBox="0 0 24 24" fill="none">
      <path d="M12 2L4 6v6c0 5.1 3.4 9.9 8 11 4.6-1.1 8-5.9 8-11V6l-8-4z" fill="#77a478" opacity="0.3"/>
      <path d="M12 2L4 6v6c0 5.1 3.4 9.9 8 11 4.6-1.1 8-5.9 8-11V6l-8-4z" stroke="#77a478" stroke-width="1.5" fill="none"/>
      <path d="M9 12l2 2 4-4" stroke="#77a478" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/></svg>`;
    title.textContent = '目前資產配置安全平衡';
    sub.textContent   = '所有資產占比均在 15 – 35% 的目標範圍內，暫無需要調整。';
  } else {
    shield.className = 'rb-shield danger';
    shield.innerHTML = `<svg width="44" height="44" viewBox="0 0 24 24" fill="none">
      <path d="M12 2L4 6v6c0 5.1 3.4 9.9 8 11 4.6-1.1 8-5.9 8-11V6l-8-4z" fill="#e8706f" opacity="0.3"/>
      <path d="M12 2L4 6v6c0 5.1 3.4 9.9 8 11 4.6-1.1 8-5.9 8-11V6l-8-4z" stroke="#e8706f" stroke-width="1.5" fill="none"/>
      <path d="M12 8v4M12 16h.01" stroke="#e8706f" stroke-width="2" stroke-linecap="round"/></svg>`;
    title.textContent = '資產配置需要調整';
    sub.textContent   = '部分資產占比已超出 15 – 35% 的目標範圍，建議進行再平衡。';
  }

  // 更新主資訊列（顯示資產總值）
  document.getElementById('rb-alert-name').textContent =
    `資產總值 NT$ ${total.toLocaleString()}`;
  const badge = document.getElementById('rb-alert-badge');
  if (worst.pct > SAFE_MAX) {
    badge.textContent = '> 35%'; badge.className = 'rb-alert-badge over';
  } else if (worst.pct < SAFE_MIN) {
    badge.textContent = '< 15%'; badge.className = 'rb-alert-badge under';
  } else {
    badge.textContent = '安全範圍'; badge.className = 'rb-alert-badge safe';
  }

  // 畫四個小圓圈
  pcts.forEach(a => {
    const isSafe = a.pct >= SAFE_MIN && a.pct <= SAFE_MAX;
    const ringColor = a.pct > SAFE_MAX ? '#e8706f' : a.pct < SAFE_MIN ? '#77a478' : a.color;
    drawRbRing('rb-ring-' + a.key, a.pct, ringColor, isSafe);
    const lbl = document.getElementById('rb-rlabel-' + a.key);
    if (lbl) lbl.textContent = a.pct.toFixed(1) + '%';
  });

  // 更新時間
  const tsEl = document.getElementById('rb-timestamp');
  if (tsEl) tsEl.textContent = '最後更新時間・' + formatNow();

  // ===== 建議動作試算 =====
  const suggestBox = document.getElementById('rb-suggestions');

  if (allSafe) {
    suggestBox.style.display = 'none';
    suggestBox.innerHTML = '';
  } else {
    const SELL_PRIORITY = ['BTC', '0050', 'GOLD']; // 賣出優先順序

    const targetVal = total * 0.25;
    const cash      = pcts.find(a => a.key === 'CASH');
    const underList = pcts.filter(a => a.key !== 'CASH' && a.pct < SAFE_MIN)
                         .sort((a, b) => a.pct - b.pct);
    const overList  = pcts.filter(a => a.key !== 'CASH' && a.pct > SAFE_MAX)
                         .sort((a, b) => b.pct - a.pct);

    // 賣出候選排序：先按佔比高低，同佔比則按優先順序
    const sortedForSell = pcts.filter(a => a.key !== 'CASH')
      .sort((a, b) => {
        if (Math.abs(b.pct - a.pct) < 0.1) {
          return SELL_PRIORITY.indexOf(a.key) - SELL_PRIORITY.indexOf(b.key);
        }
        return b.pct - a.pct;
      });

    let html = `<div class="rb-suggest-header">建議動作</div>`;

    if (cash && cash.pct > SAFE_MAX) {
      // 現金過多 → 分配給各不足資產
      let remainingCash = cash.current;
      const needBuy = pcts.filter(a => a.key !== 'CASH' && a.current < targetVal).sort((a,b) => a.pct - b.pct);
      needBuy.forEach(a => {
        const needed  = Math.round(targetVal - a.current);
        const useAmt  = Math.min(needed, remainingCash);
        if (useAmt <= 0) return;
        remainingCash -= useAmt;
        html += `
          <div class="rb-suggest-card buy">
            <div class="rb-suggest-icon">⚠</div>
            <div class="rb-suggest-body">
              <div class="rb-suggest-title">建議將現金換置成 ${a.displayName}</div>
              <div class="rb-suggest-desc">建議將現金的 NT$ ${useAmt.toLocaleString()} 換置成 ${a.displayName}</div>
            </div>
            <div class="rb-suggest-arrow">›</div>
          </div>`;
      });

    } else if (cash && cash.pct < SAFE_MIN) {
      // 現金過少 → 賣資產換現金
      const needed   = Math.round(targetVal - cash.current);
      const sellFrom = sortedForSell[0];
      if (sellFrom) {
        html += `
          <div class="rb-suggest-card sell">
            <div class="rb-suggest-icon">⚠</div>
            <div class="rb-suggest-body">
              <div class="rb-suggest-title">建議將 ${sellFrom.displayName} 換置成現金</div>
              <div class="rb-suggest-desc">建議將 ${sellFrom.displayName} 的 NT$ ${needed.toLocaleString()} 換置成現金</div>
            </div>
            <div class="rb-suggest-arrow">›</div>
          </div>`;
      }

    } else if (underList.length > 0) {
      // 有資產不足 → 優先用現金，不夠再賣其他
      underList.forEach(under => {
        const needed  = Math.round(targetVal - under.current);
        const cashAmt = cash ? cash.current : 0;

        if (cashAmt >= needed) {
          html += `
            <div class="rb-suggest-card buy">
              <div class="rb-suggest-icon">⚠</div>
              <div class="rb-suggest-body">
                <div class="rb-suggest-title">建議將現金換置成 ${under.displayName}</div>
                <div class="rb-suggest-desc">建議將現金的 NT$ ${needed.toLocaleString()} 換置成 ${under.displayName}</div>
              </div>
              <div class="rb-suggest-arrow">›</div>
            </div>`;
        } else {
          const topOver = pcts.filter(a => a.key !== 'CASH' && a.key !== under.key).sort((a,b) => b.current - a.current)[0];
          const sellAmt = topOver ? Math.round(needed - cashAmt) : 0;

          if (cashAmt > 0) {
            html += `
              <div class="rb-suggest-card buy">
                <div class="rb-suggest-icon">⚠</div>
                <div class="rb-suggest-body">
                  <div class="rb-suggest-title">建議將現金換置成 ${under.displayName}</div>
                  <div class="rb-suggest-desc">建議將現金的 NT$ ${cashAmt.toLocaleString()} 換置成 ${under.displayName}</div>
                </div>
                <div class="rb-suggest-arrow">›</div>
              </div>`;
          }
          if (topOver && sellAmt > 0) {
            html += `
              <div class="rb-suggest-card sell">
                <div class="rb-suggest-icon">⚠</div>
                <div class="rb-suggest-body">
                  <div class="rb-suggest-title">建議將 ${topOver.displayName} 換置成 ${under.displayName}</div>
                  <div class="rb-suggest-desc">建議將 ${topOver.displayName} 的 NT$ ${sellAmt.toLocaleString()} 換置成 ${under.displayName}</div>
                </div>
                <div class="rb-suggest-arrow">›</div>
              </div>`;
          }
        }
      });

    } else if (overList.length > 0) {
      // 有資產過多 → 換回現金
      overList.forEach(over => {
        const sellAmt = Math.round(over.current - targetVal);
        html += `
          <div class="rb-suggest-card sell">
            <div class="rb-suggest-icon">⚠</div>
            <div class="rb-suggest-body">
              <div class="rb-suggest-title">建議將 ${over.displayName} 換置成現金</div>
              <div class="rb-suggest-desc">建議將 ${over.displayName} 的 NT$ ${sellAmt.toLocaleString()} 換置成現金</div>
            </div>
            <div class="rb-suggest-arrow">›</div>
          </div>`;
      });
    }

    suggestBox.style.display = 'flex';
    suggestBox.innerHTML = html;

    // 點擊建議卡片 → 跳到交易頁
    suggestBox.querySelectorAll('.rb-suggest-card').forEach(card => {
      card.style.cursor = 'pointer';
      card.addEventListener('click', () => {
        showPage('export', '交易');
        navItems.forEach(i => i.classList.toggle('active', i.getAttribute('data-target') === 'export'));
      });
    });
  }
}

document.getElementById('gs-copy-btn').addEventListener('click', () => {
  const code = document.getElementById('gs-code-block').textContent;

  function showCopied() {
    const btn = document.getElementById('gs-copy-btn');
    btn.innerHTML = '✓ 已複製';
    btn.classList.add('copied');
    setTimeout(() => {
      btn.innerHTML = `<svg width="14" height="14" viewBox="0 0 24 24" fill="none">
        <rect x="9" y="9" width="13" height="13" rx="2" stroke="currentColor" stroke-width="2"/>
        <path d="M5 15H4a2 2 0 01-2-2V4a2 2 0 012-2h9a2 2 0 012 2v1" stroke="currentColor" stroke-width="2"/>
      </svg> 複製程式碼`;
      btn.classList.remove('copied');
    }, 2000);
  }

  function fallback() {
    const ta = document.createElement('textarea');
    ta.value = code;
    ta.style.cssText = 'position:fixed;top:0;left:0;width:1px;height:1px;opacity:0;';
    document.body.appendChild(ta);
    ta.focus();
    ta.select();
    ta.setSelectionRange(0, 99999);
    try {
      const ok = document.execCommand('copy');
      if (ok) showCopied();
      else alert('請長按程式碼區塊手動複製');
    } catch(e) {
      alert('請長按程式碼區塊手動複製');
    }
    document.body.removeChild(ta);
  }

  if (navigator.clipboard && window.isSecureContext) {
    navigator.clipboard.writeText(code).then(showCopied).catch(fallback);
  } else {
    fallback();
  }
});

// ===== Google Sheet 綁定 =====
let gsScriptUrl = 'https://us-central1-acs-database-5fb57.cloudfunctions.net/api';

function loadGsUrl() {
  // Firebase Functions API - 直接使用固定網址
  gsScriptUrl = 'https://us-central1-acs-database-5fb57.cloudfunctions.net/api';
  updateGsUI();
}

function updateGsUI() {
  const bound = !!gsScriptUrl;
  // 設定頁 badge
  const badge = document.getElementById('gsheet-status-badge');
  if (badge) { badge.textContent = bound ? '已綁定' : '未綁定'; badge.className = 'gs-badge ' + (bound ? 'bound' : 'unbind'); }
  // 綁定頁
  const title  = document.getElementById('gs-status-title');
  const sub    = document.getElementById('gs-status-sub');
  const input  = document.getElementById('gs-url-input');
  const bindBtn   = document.getElementById('gs-bind-btn');
  const unbindBtn = document.getElementById('gs-unbind-btn');
  const steps  = document.getElementById('gs-steps');
  if (bound) {
    if (title) title.textContent = '已成功綁定';
    if (sub)   sub.textContent   = gsScriptUrl.substring(0, 48) + '...';
    if (input) input.value = gsScriptUrl;
    if (bindBtn)   bindBtn.style.display   = 'none';
    if (unbindBtn) unbindBtn.style.display = '';
    if (steps) steps.style.display = 'none';
  } else {
    if (title) title.textContent = '尚未綁定';
    if (sub)   sub.textContent   = '請貼上 Apps Script 網址以開始同步';
    if (input) input.value = '';
    if (bindBtn)   bindBtn.style.display   = '';
    if (unbindBtn) unbindBtn.style.display = 'none';
    if (steps) steps.style.display = '';
  }
}

document.getElementById('gsheet-setting').addEventListener('click', () => {
  updateGsUI();
  showPage('gsheet', 'Google Sheet 綁定');
});

document.getElementById('gs-bind-btn').addEventListener('click', () => {
  const url = document.getElementById('gs-url-input').value.trim();
  if (!url.startsWith('https://script.google.com')) {
    alert('請輸入正確的 Apps Script 網址\n（開頭應為 https://script.google.com）');
    return;
  }
  const modal = document.getElementById('bind-confirm-modal');
  const isDark = document.body.classList.contains('dark');
  const box = modal.querySelector('div');
  box.style.background = isDark ? '#1e1e1e' : '#fff';
  document.getElementById('bind-confirm-title').style.color = isDark ? '#eee' : '#1E2A38';
  document.getElementById('bind-confirm-cancel').style.background = isDark ? '#2a2a2a' : '#f0f0f0';
  document.getElementById('bind-confirm-cancel').style.color = isDark ? '#eee' : '#555';
  modal.style.display = 'flex';
  document.getElementById('bind-confirm-ok').onclick = () => {
    modal.style.display = 'none';
    gsScriptUrl = url;
    try { localStorage.setItem('acs_gs_url', url); } catch(e) {}
    updateGsUI();
  };
  document.getElementById('bind-confirm-cancel').onclick = () => {
    modal.style.display = 'none';
  };
});

document.getElementById('gs-unbind-btn').addEventListener('click', () => {
  const modal = document.getElementById('unbind-confirm-modal');
  const isDark = document.body.classList.contains('dark');
  const box = modal.querySelector('div');
  box.style.background = isDark ? '#1e1e1e' : '#fff';
  document.getElementById('unbind-confirm-title').style.color = isDark ? '#eee' : '#1E2A38';
  document.getElementById('unbind-confirm-cancel').style.background = isDark ? '#2a2a2a' : '#f0f0f0';
  document.getElementById('unbind-confirm-cancel').style.color = isDark ? '#eee' : '#555';
  modal.style.display = 'flex';
  document.getElementById('unbind-confirm-ok').onclick = () => {
    modal.style.display = 'none';
    gsScriptUrl = '';
    try { localStorage.removeItem('acs_gs_url'); } catch(e) {}
    updateGsUI();
  };
  document.getElementById('unbind-confirm-cancel').onclick = () => {
    modal.style.display = 'none';
  };
});

// 寫入 Google Sheet
function gsWrite(action, data) {
  if (!gsScriptUrl) return;
  const params = new URLSearchParams({ action, ...data });
  const url = gsScriptUrl + '?' + params.toString();
  console.log('[gsWrite]', action, data, url);
  // JSONP script tag（最可靠，不受 CORS 限制）
  const script = document.createElement('script');
  script.src = url;
  document.head.appendChild(script);
  setTimeout(() => { try { document.head.removeChild(script); } catch(e){} }, 6000);
}

// ===== 商品從 Sheet 讀取還原 =====
const CAT_COLORS   = { '加密貨幣':'#f5a623','ETF/股票':'#7396c6','貴金屬':'#dfb199','現金':'#9eb995' };
const CAT_INITIALS = { '加密貨幣': n => n.substring(0,2).toUpperCase(), 'ETF/股票': n => n.substring(0,2).toUpperCase(), '貴金屬': () => 'Au', '現金': () => '$' };

// 智慧數字格式化：有小數就顯示一位，沒有就整數
// 計算並顯示 P/L% 到 trade-avg 元素
function updateAvgEl(avgEl, cost, qty, marketPrice, tag) {
  if (!avgEl) return;
  if (qty <= 0 || cost <= 0 || tag === '現金') { avgEl.textContent = '--'; avgEl.className = 'trade-avg'; return; }
  const market = (!isNaN(marketPrice) && marketPrice > 0) ? marketPrice * qty : null;
  if (!market) { avgEl.textContent = '--'; avgEl.className = 'trade-avg'; return; }
  const pnl    = market - cost;
  const plPct  = (pnl / cost * 100).toFixed(1);
  const sign   = pnl >= 0 ? '+' : '';
  const cls    = pnl >= 0 ? 'up' : 'down';
  avgEl.textContent = sign + plPct + '%';
  avgEl.className   = 'trade-avg ' + cls;
}

function smartNum(val) {
  if (isNaN(val) || val === null) return '--';
  const num = parseFloat(val);
  const hasDecimal = num % 1 !== 0;
  return num.toLocaleString('zh-TW', {
    minimumFractionDigits: 0,
    maximumFractionDigits: hasDecimal ? 1 : 0
  });
}

function buildTradeCard(name, type, qty, value) {
  const color   = CAT_COLORS[type] || '#aaa';
  const icon    = (CAT_INITIALS[type] ? CAT_INITIALS[type](name) : name.substring(0,2).toUpperCase());
  const costNum = parseInt(String(value).replace(/,/g,'')) || 0;
  const card = document.createElement('div');
  card.className = 'trade-card';
  card.setAttribute('data-name', name);
  card.setAttribute('data-qty', qty);
  card.setAttribute('data-cost', costNum);
  card.innerHTML = `
    <div class="trade-card-left">
      <div class="trade-icon" style="background:${color};">${icon}</div>
      <div class="trade-info">
        <div class="trade-name">${name} <span class="trade-tag">${type}</span></div>
        <div class="trade-vol">持有數量：${qty}</div>
      </div>
    </div>
    <div class="trade-card-right">
      <div class="trade-col"><div class="trade-avg">--</div></div>
      <div class="trade-col"><div class="trade-total">--</div></div>
    </div>
    <div class="trade-card-expand">
      <div class="trade-expand-rows">
        <div class="trade-expand-item">
          <div class="trade-expand-label">資產總成本</div>
          <div class="trade-expand-value trade-expand-cost">${costNum.toLocaleString()}</div>
        </div>
        <div class="trade-expand-item">
          <div class="trade-expand-label">持有均價</div>
          <div class="trade-expand-value trade-expand-avg">${qty > 0 && costNum > 0 ? smartNum(costNum / qty) : '--'}</div>
        </div>
        <div class="trade-expand-item">
          <div class="trade-expand-label">未實現損益</div>
          <div class="trade-expand-value trade-expand-pnl">--</div>
        </div>
      </div>
      <button class="trade-adjust-btn">調整資產</button>
    </div>`;
  return card;
}

async function loadProducts() {
  if (!gsScriptUrl) {
    // 無綁定時嘗試從 localStorage 快取還原
    try {
      const cached = localStorage.getItem('acs_products_cache');
      if (cached) restoreProductsFromRows(JSON.parse(cached));
    } catch(e) {}
    return;
  }
  // 先用快取立即顯示
  try {
    const cached = localStorage.getItem('acs_products_cache');
    if (cached) restoreProductsFromRows(JSON.parse(cached));
  } catch(e) {}
  // 再從 Sheet 拉最新
  try {
    const res  = await fetch(gsScriptUrl + '?action=getProducts', { mode: 'cors', cache: 'no-store' });
    const data = await res.json();
    if (data.rows) {
      try { localStorage.setItem('acs_products_cache', JSON.stringify(data.rows)); } catch(e) {}
      restoreProductsFromRows(data.rows);
    }
  } catch(e) {
    // CORS 失敗時用 JSONP
    gsJsonp('getProducts', 'handleProductsJsonp');
  }
}

function restoreProductsFromRows(rows) {
  // rows: [商品名稱, 種類, 持有數量, 現有價值, 新增時間]
  const list = document.getElementById('trade-list');
  list.innerHTML = '';
  rows.forEach(row => {
    const [name, type, qty, value] = row;
    if (!name || !type) return;
    list.appendChild(buildTradeCard(name, type, qty, value));
  });
  recalcAllAvg();
  updateOverview();
  scheduleFetchPrices(1000);
}

// ===== 歷史紀錄頁面 =====
function getTWDatetime() {
  const now = new Date();
  const pad = n => String(n).padStart(2, '0');
  const d = new Date(now.toLocaleString('en-US', { timeZone: 'Asia/Taipei' }));
  return `${d.getFullYear()}/${pad(d.getMonth()+1)}/${pad(d.getDate())} ${pad(d.getHours())}:${pad(d.getMinutes())}:${pad(d.getSeconds())}`;
}

function formatTWTime(raw) {
  if (!raw) return '--';
  const str = String(raw);
  // 已經是格式化字串（含 / 或 下午）直接顯示
  if (str.includes('/') || str.includes('上午') || str.includes('下午')) return str;
  // ISO 格式轉台灣時間
  try {
    const d = new Date(str);
    if (isNaN(d)) return str;
    const tw = new Date(d.getTime() + 8 * 3600000);
    const pad = n => String(n).padStart(2, '0');
    return `${tw.getUTCFullYear()}/${pad(tw.getUTCMonth()+1)}/${pad(tw.getUTCDate())} ${pad(tw.getUTCHours())}:${pad(tw.getUTCMinutes())}:${pad(tw.getUTCSeconds())}`;
  } catch(e) { return str; }
}

let _historyAllRows = [];
let _histFilterDays = 7;
let _histDateFrom = null;
let _histDateTo = null;

function renderHistoryRows(rows) {
  _historyAllRows = rows || [];
  applyHistoryFilter();
}

function applyHistoryFilter() {
  const list  = document.getElementById('history-list');
  const empty = document.getElementById('history-empty');
  list.innerHTML = '';

  const now = new Date();
  let filtered = [..._historyAllRows];

  if (_histFilterDays === 'custom' && _histDateFrom && _histDateTo) {
    const from = new Date(_histDateFrom + 'T00:00:00');
    const to   = new Date(_histDateTo   + 'T23:59:59');
    filtered = filtered.filter(row => {
      const d = parseHistDate(row[0]);
      return d && d >= from && d <= to;
    });
  } else if (_histFilterDays > 0) {
    const cutoff = new Date(now - _histFilterDays * 86400000);
    filtered = filtered.filter(row => {
      const d = parseHistDate(row[0]);
      return d && d >= cutoff;
    });
  }

  if (filtered.length === 0) { empty.style.display = 'block'; return; }
  empty.style.display = 'none';

  [...filtered].reverse().forEach(row => {
    const [datetime, name, tradeType, qty, price, total] = row;
    const isBuy = tradeType === '買入';
    const card = document.createElement('div');
    card.className = 'hist-card';
    card.innerHTML = `
      <div class="hist-top">
        <span class="hist-name">${name}</span>
        <span class="hist-type ${isBuy ? 'buy' : 'sell'}">${tradeType}</span>
      </div>
      <div class="hist-grid">
        <div class="hist-cell">
          <span class="hist-cell-label">數量</span>
          <span class="hist-cell-value">${qty}</span>
        </div>
        <div class="hist-cell">
          <span class="hist-cell-label">價格</span>
          <span class="hist-cell-value">NT$ ${Number(price).toLocaleString()}</span>
        </div>
        <div class="hist-cell">
          <span class="hist-cell-label">換算價值</span>
          <span class="hist-cell-value" style="color:${isBuy ? '#e8706f' : '#77a478'}">NT$ ${Number(total).toLocaleString()}</span>
        </div>
      </div>
      <div class="hist-date">${formatTWTime(datetime)}</div>`;
    list.appendChild(card);
  });
}

function parseHistDate(str) {
  if (!str) return null;
  // 支援 "2026/3/5 上午2:46:47" 和 ISO 格式
  const s = String(str)
    .replace('上午', 'AM ').replace('下午', 'PM ')
    .replace(/(\d+)\/(\d+)\/(\d+)/, '$1-$2-$3');
  const d = new Date(s);
  return isNaN(d) ? null : d;
}

async function loadHistory(showLoading = true) {
  const loading = document.getElementById('history-loading');
  const noBind  = document.getElementById('history-no-bind');
  const empty   = document.getElementById('history-empty');
  const icon    = document.getElementById('history-refresh-icon');

  noBind.style.display = 'none';
  empty.style.display  = 'none';

  if (!gsScriptUrl) {
    loading.style.display = 'none';
    noBind.style.display  = 'block';
    return;
  }

  // 先顯示快取
  try {
    const cached = localStorage.getItem('acs_history_cache');
    if (cached) {
      renderHistoryRows(JSON.parse(cached));
      if (showLoading) loading.style.display = 'none';
    } else if (showLoading) {
      loading.style.display = 'block';
    }
  } catch(e) {}

  // 旋轉 icon
  if (icon) icon.style.animation = 'spin 0.8s linear infinite';

  try {
    const url = gsScriptUrl + '?action=getHistory';
    const res = await fetch(url, { mode: 'cors', cache: 'no-store' });
    const data = await res.json();
    loading.style.display = 'none';
    if (data.rows) {
      try { localStorage.setItem('acs_history_cache', JSON.stringify(data.rows)); } catch(e) {}
      renderHistoryRows(data.rows);
    } else {
      empty.style.display = 'block';
    }
  } catch(e) {
    loading.style.display = 'none';
    gsJsonp('getHistory', 'handleHistoryJsonp');
  } finally {
    if (icon) icon.style.animation = '';
  }
}

// ===== 設定頁跳轉 =====
document.getElementById('version-setting').addEventListener('click', () => showPage('version', '版本更新'));
document.getElementById('about-setting').addEventListener('click', () => showPage('about', '關於'));
document.getElementById('contact-setting').addEventListener('click', () => showPage('contact', '聯絡我們'));

// ===== 主題 Popup =====
document.getElementById('theme-setting').addEventListener('click', () => {
  document.getElementById('theme-popup').style.display = 'flex';
});
document.querySelectorAll('#theme-popup .popup-item').forEach(item => {
  item.addEventListener('click', () => {
    const labels = { system: '系統&自動', light: '淺色模式', dark: '深色模式' };
    document.getElementById('theme-current').textContent = labels[item.dataset.value];
    setTheme(item.dataset.value);
    document.getElementById('theme-popup').style.display = 'none';
  });
});
document.querySelector('#theme-popup .popup-cancel').addEventListener('click', () => {
  document.getElementById('theme-popup').style.display = 'none';
});

function setTheme(mode) {
  document.body.classList.remove('light', 'dark');
  const prefersDark = window.matchMedia('(prefers-color-scheme: dark)').matches;
  const isDark = mode === 'dark' || (mode === 'system' && prefersDark);
  document.body.classList.add(isDark ? 'dark' : 'light');
  if (window.assetDonutChart) window.assetDonutChart.update();
  try { localStorage.setItem('acs_theme', mode); } catch(e) {}
}
// 讀取上次主題
const savedTheme = (() => { try { return localStorage.getItem('acs_theme'); } catch(e) { return null; } })();
window.matchMedia('(prefers-color-scheme: dark)').addEventListener('change', () => {
  const current = (() => { try { return localStorage.getItem('acs_theme'); } catch(e) { return null; } })();
  if (!current || current === 'system') setTheme('system');
});
setTheme(savedTheme || 'system');
// 同步主題選單顯示
if (savedTheme) {
  const labels = { system: '系統&自動', light: '淺色模式', dark: '深色模式' };
  const el = document.getElementById('theme-current');
  if (el && labels[savedTheme]) el.textContent = labels[savedTheme];
}

// ===== 網路狀態 =====
function showOffline() {
  const splash = document.getElementById('splash');
  splash.style.cssText = 'display:flex;opacity:1;animation:none;';
  splash.querySelector('img').style.animation = 'zoomLoop 2s ease-in-out infinite';
  document.getElementById('offline-hint').style.display = 'block';
}
window.addEventListener('offline', showOffline);
window.addEventListener('online', () => window.location.reload());

// ===== 時間更新 =====
function pad2(n) { return String(n).padStart(2, '0'); }
function formatNow() {
  const d = new Date();
  let hh = d.getHours(); const ap = hh >= 12 ? 'PM' : 'AM';
  hh = hh % 12 || 12;
  return `${d.getFullYear()}/${pad2(d.getMonth()+1)}/${pad2(d.getDate())} ${pad2(hh)}:${pad2(d.getMinutes())} ${ap}`;
}
function updateTime() {
  const el = document.getElementById('overview-updated');
  if (el) el.textContent = '動態更新：' + formatNow();
}
updateTime();
setInterval(updateTime, 60000);

// 重新計算所有卡片的持有均價（現有價值 ÷ 持有數量）
function recalcAllAvg() {
  document.querySelectorAll('#trade-list .trade-card').forEach(card => {
    const qty     = parseFloat(card.dataset.qty) || 0;
    const cost    = parseFloat(card.dataset.cost) || 0;
    const avgEl   = card.querySelector('.trade-avg');
    const tag     = card.querySelector('.trade-tag')?.textContent.trim();
    const mp      = parseFloat(card.getAttribute('data-market-price'));
    updateAvgEl(avgEl, cost, qty, mp, tag);
  });
}

// ===== 商品分類對應 =====
const CAT_MAP = {
  '加密貨幣': 'CRYPTO',
  'ETF/股票': 'ETF',
  '貴金屬':   'METAL',
  '現金':     'FIAT',
};
const CAT_INFO = {
  CRYPTO: { label: '加密貨幣', color: '#f5a623' },
  ETF:    { label: 'ETF/股票', color: '#7396c6' },
  METAL:  { label: '貴金屬',   color: '#dfb199' },
  FIAT:   { label: '現金',     color: '#9eb995' },
};

// ===== 總覽分類卡片點擊 → 跳轉交易頁對應分類 =====
document.querySelectorAll('.overview-grid .mini-card').forEach(card => {
  card.style.cursor = 'pointer';
  card.addEventListener('click', () => {
    const catKey   = card.dataset.cat;
    const catLabel = CAT_INFO[catKey]?.label || 'ALL';
    showPage('export', '交易');
    navItems.forEach(i => i.classList.toggle('active', i.getAttribute('data-target') === 'export'));
    _tradeCatFilter = catLabel;
    document.querySelectorAll('.trade-cat-btn').forEach(btn => {
      btn.classList.toggle('active', btn.dataset.cat === catLabel);
    });
    filterTradeCards();
  });
});

// 從交易頁卡片讀取各分類總值
function getTradeCategories() {
  const cats = { CRYPTO: 0, ETF: 0, METAL: 0, FIAT: 0 };
  document.querySelectorAll('#trade-list .trade-card').forEach(card => {
    const tagEl = card.querySelector('.trade-tag');
    if (!tagEl) return;
    const tag    = tagEl.textContent.trim();
    const catKey = CAT_MAP[tag];
    if (!catKey) return;

    const marketPrice = parseFloat(card.getAttribute('data-market-price'));
    const qty         = parseFloat(card.getAttribute('data-qty')) || 0;
    const cost        = parseFloat(card.getAttribute('data-cost')) || 0;

    let val = 0;
    if (!isNaN(marketPrice) && marketPrice > 0 && qty > 0) {
      val = Math.round(marketPrice * qty);
    } else if (qty > 0 && cost > 0) {
      val = cost; // 沒有市場價格時用成本估算
    } else {
      const totalEl = card.querySelector('.trade-total');
      val = totalEl ? (parseInt(totalEl.textContent.replace(/[^0-9]/g, '')) || 0) : 0;
    }

    cats[catKey] += val;
  });
  return cats;
}

// 只更新金額（報價更新後呼叫，不重建 DOM）
function updateOverviewAmounts() {
  const cats  = getTradeCategories();
  const total = Object.values(cats).reduce((s, v) => s + v, 0) || 1;

  // 計算各分類成本與市值
  const catCost   = { CRYPTO: 0, ETF: 0, METAL: 0, FIAT: 0 };
  const catMarket = { CRYPTO: 0, ETF: 0, METAL: 0, FIAT: 0 };
  document.querySelectorAll('#trade-list .trade-card').forEach(card => {
    const tag  = card.querySelector('.trade-tag')?.textContent.trim();
    const key  = CAT_MAP[tag];
    if (!key) return;
    const qty         = parseFloat(card.getAttribute('data-qty')) || 0;
    const cost        = parseFloat(card.getAttribute('data-cost')) || 0;
    const marketPrice = parseFloat(card.getAttribute('data-market-price'));
    catCost[key] += cost;
    if (!isNaN(marketPrice) && marketPrice > 0 && qty > 0) {
      catMarket[key] += Math.round(marketPrice * qty);
    } else {
      catMarket[key] += cost;
    }
  });

  Object.entries(cats).forEach(([key, val]) => {
    const pctVal  = Math.round(val / total * 1000) / 10;
    const amtEl   = document.getElementById('cat-amt-' + key);
    const pctEl   = document.getElementById('cat-pct-' + key);
    const chgEl   = document.getElementById('cat-chg-' + key);

    if (amtEl) amtEl.textContent = 'NT$ ' + val.toLocaleString();

    // 左下角：未實現損益（現金不顯示）
    const pnl  = catMarket[key] - catCost[key];
    const sign = pnl >= 0 ? '+' : '';
    const cls  = pnl >= 0 ? 'up' : 'down';
    if (pctEl) {
      if (catCost[key] === 0 || key === 'FIAT') {
        pctEl.textContent = '--';
        pctEl.className = '';
      } else {
        pctEl.textContent = sign + pnl.toLocaleString();
        pctEl.className = cls;
      }
    }

    // 右下角：P/L%（現金不顯示）
    if (chgEl) {
      if (catCost[key] === 0 || key === 'FIAT') {
        chgEl.textContent = '--';
        chgEl.className = 'mini-change';
      } else {
        const plPct = (pnl / catCost[key] * 100).toFixed(1);
        chgEl.textContent = (pnl >= 0 ? '+' : '') + plPct + '%';
        chgEl.className = 'mini-change ' + cls;
      }
    }

    const legEl = document.querySelector(`#assetLegend .legend-row[data-key="${key}"] .pct`);
    if (legEl) {
      legEl.textContent = pctVal.toFixed(1) + '%';
      legEl.style.color = pctVal > 35 ? '#e8706f' : pctVal < 15 ? '#77a478' : '';
    }
  });

  document.getElementById('total-nt').textContent = total.toLocaleString();

  // 更新圓餅圖
  const catArr = Object.keys(CAT_INFO);
  if (window.assetDonutChart) {
    window.assetDonutChart.data.datasets[0].data = catArr.map(k => cats[k]);
    window.assetDonutChart._totalCurrent = total;
    window.assetDonutChart.update();
  }

  // 同步再平衡頁
  window.rbAssets = Object.entries(cats).map(([key, val]) => ({
    key, displayName: CAT_INFO[key].label, color: CAT_INFO[key].color,
    current: val, start: val
  }));
  const rbPage = document.getElementById('rebalance');
  if (rbPage && rbPage.style.display !== 'none') renderRebalance();
  calcUnrealizedPnl();
}

// 更新總覽頁所有分類數據（mini-card、legend、donut、市場行情）
function updateOverview() {
  const cats = getTradeCategories();
  const total = Object.values(cats).reduce((s, v) => s + v, 0) || 1;

  // 總額
  document.getElementById('total-nt').textContent = total.toLocaleString();

  // 圓餅圖
  const catArr = Object.keys(CAT_INFO);
  if (window.assetDonutChart) {
    window.assetDonutChart.data.datasets[0].data = catArr.map(k => cats[k]);
    window.assetDonutChart._totalCurrent = total;
    window.assetDonutChart.update();
  }

  // 市場行情：從交易頁卡片動態產生
  const marketBody = document.getElementById('market-card-body');
  if (marketBody) {
    marketBody.querySelectorAll('.market-row').forEach(r => r.remove());
    document.querySelectorAll('#trade-list .trade-card').forEach(card => {
      const nameEl  = card.querySelector('.trade-name');
      const tagEl   = card.querySelector('.trade-tag');
      const iconEl  = card.querySelector('.trade-icon');
      if (!nameEl) return;
      const name    = nameEl.childNodes[0].textContent.trim();
      const tag     = tagEl ? tagEl.textContent.trim() : '';
      const bg      = iconEl ? iconEl.style.background : '#aaa';
      const iconTxt = iconEl ? iconEl.textContent.trim() : name.substring(0,2);
      const cost    = parseFloat(card.getAttribute('data-cost')) || 0;
      const qty     = parseFloat(card.getAttribute('data-qty')) || 0;
      const avgNum  = qty > 0 ? cost / qty : 0;

      const row = document.createElement('div');
      row.className = 'market-row';
      const isCrypto = tag === '加密貨幣';
      row.dataset.symbol  = name;
      row.dataset.isCrypto = isCrypto ? '1' : '0';
      row.dataset.showUsdt = '0';
      row.innerHTML = `
        <div class="market-icon" style="background:${bg};">${iconTxt}</div>
        <div class="market-name">${name}</div>
        <div class="market-price" data-avg="${avgNum}">--</div>
        <div class="market-change">--</div>
        <div class="market-avg">${avgNum > 0 ? smartNum(avgNum) : '--'}</div>`;

      if (isCrypto) {
        row.style.cursor = 'pointer';
        row.addEventListener('click', () => {
          const isUsdt = row.dataset.showUsdt === '1';
          row.dataset.showUsdt = isUsdt ? '0' : '1';
          const priceEl = row.querySelector('.market-price');
          const twdPrice = parseFloat(priceEl?.dataset.twd);
          const usdtPrice = parseFloat(priceEl?.dataset.usdt);
          if (!twdPrice) return;
          if (!isUsdt && usdtPrice) {
            priceEl.textContent = smartNum(usdtPrice) + ' USDT';
          } else {
            priceEl.textContent = smartNum(twdPrice);
          }
        });
      }

      marketBody.appendChild(row);
    });
  }

  // rbAssets 同步給再平衡頁（以分類為單位）
  window.rbAssets = Object.entries(cats).map(([key, val]) => ({
    key, displayName: CAT_INFO[key].label, color: CAT_INFO[key].color,
    current: val, start: val
  }));

  // 若再平衡頁正在顯示，即時刷新
  const rbPage = document.getElementById('rebalance');
  if (rbPage && rbPage.style.display !== 'none') renderRebalance();

  // 更新分類損益（mini-card 左下角未實現損益、右下角P/L%）
  updateOverviewAmounts();
}

// ===== 未實現損益計算 =====
function calcUnrealizedPnl() {
  let totalCost   = 0;
  let totalMarket = 0;
  let hasPrice    = false;

  document.querySelectorAll('#trade-list .trade-card').forEach(card => {
    const qty         = parseFloat(card.getAttribute('data-qty'))          || 0;
    const cost        = parseFloat(card.getAttribute('data-cost'))         || 0;
    const marketPrice = parseFloat(card.getAttribute('data-market-price'));
    const tag         = card.querySelector('.trade-tag')?.textContent.trim();
    const name        = card.getAttribute('data-name');

    if (tag === '現金') {
      totalCost   += cost;
      totalMarket += cost;
      console.log(`[PnL] ${name} 現金 cost=${cost}`);
      return;
    }

    totalCost += cost;
    const marketVal = (!isNaN(marketPrice) && marketPrice > 0 && qty > 0) ? Math.round(marketPrice * qty) : cost;
    if (!isNaN(marketPrice) && marketPrice > 0 && qty > 0) hasPrice = true;
    totalMarket += marketVal;
    console.log(`[PnL] ${name} qty=${qty} cost=${cost} marketPrice=${marketPrice} marketVal=${marketVal}`);
  });

  console.log(`[PnL] totalCost=${totalCost} totalMarket=${totalMarket} pnl=${totalMarket - totalCost}`);

  const deltaEl = document.querySelector('.overview-balance .delta');
  if (!deltaEl) return;

  if (!hasPrice || totalCost === 0) {
    deltaEl.innerHTML = `未實現損益 <span>--</span>`;
    return;
  }

  const pnl  = totalMarket - totalCost;
  const sign = pnl >= 0 ? '+' : '';
  const cls  = pnl >= 0 ? 'up' : 'down';
  deltaEl.innerHTML = `未實現損益 <span class="${cls}">${sign}${pnl.toLocaleString()}</span>`;

  // 同步更新圓餅圖中間投報率
  if (window.assetDonutChart) window.assetDonutChart.update();
}
let _priceDebounceTimer = null;
function scheduleFetchPrices(delay = 800) {
  clearTimeout(_priceDebounceTimer);
  _priceDebounceTimer = setTimeout(fetchMarketPrices, delay);
}
// 商品名稱 → API 種類對應（使用者可在 settings 擴充）
const SYMBOL_TYPE_MAP = {
  // 加密貨幣
  'BTC':'crypto','ETH':'crypto','BNB':'crypto','SOL':'crypto','XRP':'crypto','ADA':'crypto',
  'DOGE':'crypto','AVAX':'crypto','DOT':'crypto','MATIC':'crypto','LTC':'crypto','LINK':'crypto',
  'UNI':'crypto','ATOM':'crypto','ETC':'crypto','XLM':'crypto','NEAR':'crypto','APT':'crypto',
  'OP':'crypto','ARB':'crypto','FTM':'crypto','SAND':'crypto','MANA':'crypto','AXS':'crypto',
  'THETA':'crypto','FIL':'crypto','HBAR':'crypto','VET':'crypto','ALGO':'crypto','ICP':'crypto',
  'USDT':'crypto','USDC':'crypto','DAI':'crypto',
  // 台股/ETF
  '0050':'stock','0056':'stock','00878':'stock','00940':'stock','00919':'stock','006208':'stock',
  '00713':'stock','0052':'stock','2330':'stock','2317':'stock','2454':'stock','2382':'stock',
  '2412':'stock','3008':'stock','2308':'stock','2303':'stock','2881':'stock','2882':'stock',
  '2886':'stock','2891':'stock','2884':'stock','2885':'stock','2892':'stock','2883':'stock',
  '1301':'stock','1303':'stock','1326':'stock','2002':'stock','2207':'stock','2301':'stock',
  '2357':'stock','2379':'stock','2395':'stock','2408':'stock','2474':'stock','2475':'stock',
  '3034':'stock','3037':'stock','3045':'stock','3711':'stock','4904':'stock','4938':'stock',
  '5314':'stock_otc','5854':'stock','6415':'stock','6505':'stock','8046':'stock',
  // 貴金屬（TWO 交易所）
  'AU9901':'metal_two','AU9902':'metal_two',
  // 黃金存摺（台銀牌價 NT$/克）
  'GOLD_TW':'gold_tw',
  // 國際黃金（USD 計價，轉台幣）
  'GOLD':'metal_usd','XAU':'metal_usd',
  // 白銀期貨 ETF（台股）
  '00738U':'stock',
  // 現金
  'TWD':'fx',
  'USDT':'crypto'
};

function getSymbolType(name, tag) {
  const upper = name.toUpperCase();
  if (SYMBOL_TYPE_MAP[upper]) return SYMBOL_TYPE_MAP[upper];
  if (SYMBOL_TYPE_MAP[name])  return SYMBOL_TYPE_MAP[name];
  // 依種類標籤推測
  if (tag === '加密貨幣') return 'crypto';
  if (tag === 'ETF/股票')  return 'stock';
  if (tag === '貴金屬')    return 'metal_two';
  if (tag === '現金')      return 'fx';
  return 'stock';
}

let marketPriceCache = {};
let marketAutoTimer  = null;
const MARKET_INTERVAL_MS = 15 * 1000; // 15 秒

async function fetchMarketPrices() {
  if (!gsScriptUrl) return;

  const symbols = [];
  document.querySelectorAll('#trade-list .trade-card').forEach(card => {
    const nameEl = card.querySelector('.trade-name');
    const tagEl  = card.querySelector('.trade-tag');
    if (!nameEl) return;
    const name = nameEl.childNodes[0].textContent.trim();
    const tag  = tagEl ? tagEl.textContent.trim() : '';
    symbols.push({ symbol: name, type: getSymbolType(name, tag) });
  });
  if (symbols.length === 0) return;

  try {
    const encoded  = encodeURIComponent(JSON.stringify(symbols));
    const url = gsScriptUrl + '?action=getPrices&symbols=' + encoded;
    const res  = await fetch(url, { mode: 'cors', cache: 'no-store' });
    const data = await res.json();
    if (!data.prices) return;
    marketPriceCache = data.prices;
    if (!document.querySelector('#market-card-body .market-row')) updateOverview();
    applyMarketPrices(data.prices);
  } catch(e) {
    // fetch 失敗時改用 JSONP
    gsJsonp('getPrices&symbols=' + encodeURIComponent(JSON.stringify(symbols)), 'handleMarketPrices');
  }
}

function handleProductsJsonp(data) {
  if (!data || !data.rows) return;
  try { localStorage.setItem('acs_products_cache', JSON.stringify(data.rows)); } catch(e) {}
  restoreProductsFromRows(data.rows);
  scheduleFetchPrices(500);
}

function handleHistoryJsonp(data) {
  if (!data || !data.rows) return;
  try { localStorage.setItem('acs_history_cache', JSON.stringify(data.rows)); } catch(e) {}
  renderHistoryRows(data.rows);
  document.getElementById('history-loading').style.display = 'none';
}

function handleMarketPrices(data) {
  if (!data || !data.prices) return;
  marketPriceCache = data.prices;
  if (!document.querySelector('#market-card-body .market-row')) updateOverview();
  applyMarketPrices(data.prices);
}

function gsJsonp(params, callbackName) {
  if (!gsScriptUrl) return;
  const old = document.getElementById('_jsonp_' + callbackName);
  if (old) old.remove();
  window[callbackName] = function(data) {
    window[callbackName] = null;
    const el = document.getElementById('_jsonp_' + callbackName);
    if (el) el.remove();
    // 直接呼叫對應 handler
    if (callbackName === 'handleMarketPrices') handleMarketPrices(data);
    else if (callbackName === 'handleProducts')  handleProductsJsonp(data);
    else if (callbackName === 'handleHistory')   handleHistoryJsonp(data);
  };
  const s = document.createElement('script');
  s.id  = '_jsonp_' + callbackName;
  s.src = gsScriptUrl + '?action=' + params + '&callback=' + callbackName;
  document.head.appendChild(s);
  setTimeout(() => { try { s.remove(); } catch(e){} }, 8000);
}

function applyMarketPrices(prices) {
  // 取得 USDT/TWD 匯率（用 USDT 報價反推）
  const usdtTwd = prices['USDT']?.price || 32;

  document.querySelectorAll('#market-card-body .market-row').forEach(row => {
    const symbol   = row.dataset.symbol;
    const info     = prices[symbol];
    if (!info || info.price == null) return;

    const priceEl  = row.querySelector('.market-price');
    const changeEl = row.querySelector('.market-change');
    const avgNum   = parseFloat(priceEl?.dataset.avg) || 0;
    const priceTwd = Math.round(info.price * 100) / 100;
    const priceUsdt = usdtTwd > 0 ? Math.round(priceTwd / usdtTwd * 100) / 100 : null;

    // 存兩種價格
    if (priceEl) {
      priceEl.dataset.twd  = priceTwd;
      priceEl.dataset.usdt = priceUsdt || '';
    }

    const changePct = avgNum > 0 ? ((priceTwd - avgNum) / avgNum * 100) : 0;
    const changeStr = (changePct >= 0 ? '+' : '') + changePct.toFixed(2) + '%';

    // 顯示：依目前切換狀態決定
    const showUsdt = row.dataset.showUsdt === '1' && row.dataset.isCrypto === '1';
    if (priceEl) priceEl.textContent = showUsdt && priceUsdt
      ? smartNum(priceUsdt) + ' USDT'
      : smartNum(priceTwd);

    if (changeEl) {
      changeEl.textContent = changeStr;
      changeEl.className   = 'market-change ' + (changePct >= 0 ? 'up' : 'down');
    }

    const tradeCard = document.querySelector(`#trade-list .trade-card[data-name="${symbol}"]`);
    if (tradeCard) {
      tradeCard.setAttribute('data-market-price', priceTwd);
      const qty     = parseFloat(tradeCard.getAttribute('data-qty')) || 0;
      const cost    = parseFloat(tradeCard.getAttribute('data-cost')) || 0;
      const tag     = tradeCard.querySelector('.trade-tag')?.textContent.trim();
      const totalEl = tradeCard.querySelector('.trade-total');
      const avgEl   = tradeCard.querySelector('.trade-avg');
      if (totalEl && qty > 0) totalEl.textContent = smartNum(qty * priceTwd);
      updateAvgEl(avgEl, cost, qty, priceTwd, tag);

      // 更新展開區未實現損益
      const pnlEl = tradeCard.querySelector('.trade-expand-pnl');
      if (pnlEl && cost > 0 && qty > 0 && tag !== '現金') {
        const pnl  = Math.round(qty * priceTwd) - cost;
        const sign = pnl >= 0 ? '+' : '';
        const cls  = pnl >= 0 ? 'up' : 'down';
        pnlEl.textContent = sign + pnl.toLocaleString();
        pnlEl.className   = 'trade-expand-value trade-expand-pnl ' + cls;
      }
    }
  });

  // 報價更新後重新計算分類金額
  updateOverviewAmounts();
}

function startMarketAutoRefresh() {
  if (marketAutoTimer) clearInterval(marketAutoTimer);
  marketAutoTimer = setInterval(fetchMarketPrices, MARKET_INTERVAL_MS);
}

// ===== 圓餅圖 =====
(function initDonut() {
  const el = document.getElementById('assetDonut');
  if (!el) return;
  const catArr  = Object.keys(CAT_INFO);
  const colors  = catArr.map(k => CAT_INFO[k].color);
  const initVal = [125000, 125000, 125000, 125000];
  const total   = initVal.reduce((s, v) => s + v, 0);
  const pct     = v => (Math.round(v / total * 1000) / 10).toFixed(1) + '%';

  if (window.assetDonutChart) window.assetDonutChart.destroy();
  const initTotalStart   = 500000;
  const initTotalCurrent = 500000;

  window.assetDonutChart = new Chart(el.getContext('2d'), {
    type: 'doughnut',
    data: {
      labels: catArr.map(k => CAT_INFO[k].label),
      datasets: [{ borderRadius: 999, spacing: 4, data: initVal, backgroundColor: colors, borderWidth: 0 }]
    },
    options: {
      responsive: true, maintainAspectRatio: false, cutout: '84%',
      plugins: {
        legend: { display: false },
        tooltip: { callbacks: { label: ctx => ` ${ctx.label}: NT$ ${(ctx.parsed||0).toLocaleString()} (${pct(ctx.parsed||0)})` } }
      }
    },
    plugins: [{
      id: 'centerText',
      afterDraw(chart) {
        const { ctx } = chart;
        const meta = chart.getDatasetMeta(0);
        if (!meta?.data?.[0]) return;
        const { x, y } = meta.data[0];

        // 用跟 calcUnrealizedPnl 一樣的邏輯計算投報率
        let totalCost = 0, totalMarket = 0, hasPrice = false;
        document.querySelectorAll('#trade-list .trade-card').forEach(card => {
          const qty         = parseFloat(card.getAttribute('data-qty')) || 0;
          const cost        = parseFloat(card.getAttribute('data-cost')) || 0;
          const marketPrice = parseFloat(card.getAttribute('data-market-price'));
          const tag         = card.querySelector('.trade-tag')?.textContent.trim();
          totalCost += cost;
          if (tag === '現金' || isNaN(marketPrice) || marketPrice <= 0 || qty <= 0) {
            totalMarket += cost;
          } else {
            totalMarket += Math.round(marketPrice * qty);
            hasPrice = true;
          }
        });

        const roi = (hasPrice && totalCost > 0) ? ((totalMarket - totalCost) / totalCost * 100) : 0;
        const roiText = (roi >= 0 ? '+' : '') + roi.toFixed(1) + '%';
        const isDark = document.body.classList.contains('dark');
        ctx.save();
        ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
        ctx.fillStyle = roi >= 0 ? '#e8706f' : '#77a478';
        ctx.font = '700 38px Arial';
        ctx.fillText(roiText, x, y - 8);
        ctx.fillStyle = isDark ? 'rgba(255,255,255,0.6)' : 'rgba(0,0,0,0.4)';
        ctx.font = '500 16px Arial';
        ctx.fillText('投報率', x, y + 22);
        ctx.restore();
      }
    }]
  });
})();

// ===== 啟動：延遲後顯示主畫面 =====
setTimeout(() => {
  if (!navigator.onLine) { showOffline(); return; }
  loadGsUrl();
  document.getElementById('splash').style.display = 'none';
  document.querySelector('.bottom-nav').style.display = 'flex';
  showPage('app', '總覽');
  loadProducts().then(() => {
    scheduleFetchPrices(800);
  });
  setTimeout(() => loadHistory(false), 1500);
  startMarketAutoRefresh();
}, 2000);

// ===== iOS PWA 回到前景時重新抓取資料 =====
let _lastActiveTime = Date.now();

document.addEventListener('visibilitychange', () => {
  if (document.visibilityState === 'visible') {
    const elapsed = Date.now() - _lastActiveTime;
    // 超過 30 秒沒動就重新抓
    if (elapsed > 30000) {
      loadProducts().then(() => scheduleFetchPrices(300));
      loadHistory(false);
    }
  } else {
    _lastActiveTime = Date.now();
  }
});

// iOS PWA 從快取恢復時觸發
window.addEventListener('pageshow', e => {
  if (e.persisted) {
    loadProducts().then(() => scheduleFetchPrices(300));
    loadHistory(false);
  }
});


if ('serviceWorker' in navigator) {
  navigator.serviceWorker.register('./sw.js').then(reg => {
    // 每次開啟都檢查有沒有新版
    reg.update();
    reg.addEventListener('updatefound', () => {
      const newSW = reg.installing;
      newSW.addEventListener('statechange', () => {
        if (newSW.state === 'installed' && navigator.serviceWorker.controller) {
          // 有新版本，靜默重載
          window.location.reload();
        }
      });
    });
  }).catch(() => {});
}

// ══════════════════════════════════════════════
//  ACS 行事曆模組
// ══════════════════════════════════════════════
(function() {
  let calData   = {};   // { 'YYYY-MM-DD': '行程內容' }
  let calYear   = new Date().getFullYear();
  let calMonth  = new Date().getMonth();  // 0-based
  const CAL_KEY = 'acs_calendar_data';

  // ── 工具 ──────────────────────────────────────
  function todayStr() {
    const n = new Date(), p = x => String(x).padStart(2,'0');
    return `${n.getFullYear()}-${p(n.getMonth()+1)}-${p(n.getDate())}`;
  }
  function getGasUrl() {
    // Firebase Functions API
    return 'https://us-central1-acs-database-5fb57.cloudfunctions.net/api';
  }
  async function gasCall(params) {
    const url = getGasUrl(); if (!url) return null;
    try {
      const qs = Object.entries(params)
        .map(([k,v]) => `${encodeURIComponent(k)}=${encodeURIComponent(String(v))}`).join('&');
      const res = await fetch(`${url}?${qs}`, { mode:'cors', cache:'no-store' });
      return await res.json();
    } catch { return null; }
  }

  // ── 從 Sheet 同步 ─────────────────────────────
  async function syncFromSheet() {
    const status = document.getElementById('calSyncStatus');
    if (status) status.textContent = '同步中...';
    const res = await gasCall({ action: 'getCalendar' });
    if (res?.success) {
      // 雲端完全覆蓋本機
      calData = res.data || {};
      try { localStorage.setItem(CAL_KEY, JSON.stringify(calData)); } catch {}
      if (status) status.textContent = '✓ 已同步';
      setTimeout(() => { if (status) status.textContent = ''; }, 2000);
      renderCalGrid();
    } else {
      if (status) status.textContent = getGasUrl() ? '⚠ 同步失敗' : '';
    }
  }

  // ── 推送到 Sheet ──────────────────────────────
  async function pushToSheet(dateKey, content) {
    const safeContent = content === '' ? '__EMPTY__' : content;
    await gasCall({ action: 'setCalendar', dateKey, content: safeContent });
  }

  // ── 渲染日期格子 ──────────────────────────────
  function renderCalGrid() {
    const grid = document.getElementById('calGrid');
    const label = document.getElementById('calMonthLabel');
    if (!grid) return;
    const names = ['1月','2月','3月','4月','5月','6月','7月','8月','9月','10月','11月','12月'];
    if (label) label.textContent = `${calYear} / ${names[calMonth]}`;
    grid.innerHTML = '';
    const today     = todayStr();
    const firstDay  = new Date(calYear, calMonth, 1).getDay();
    const lastDate  = new Date(calYear, calMonth+1, 0).getDate();
    const prevLast  = new Date(calYear, calMonth, 0).getDate();

    // 上月尾
    for (let i = 0; i < firstDay; i++) {
      const day    = prevLast - firstDay + 1 + i;
      const pMonth = calMonth === 0 ? 12 : calMonth;
      const pYear  = calMonth === 0 ? calYear - 1 : calYear;
      const key    = `${pYear}-${String(pMonth).padStart(2,'0')}-${String(day).padStart(2,'0')}`;
      grid.appendChild(makeCell(day, key, true));
    }
    // 本月
    for (let day = 1; day <= lastDate; day++) {
      const key = `${calYear}-${String(calMonth+1).padStart(2,'0')}-${String(day).padStart(2,'0')}`;
      grid.appendChild(makeCell(day, key, false));
    }
    // 下月頭
    const total = firstDay + lastDate;
    const rem   = total % 7 === 0 ? 0 : 7 - (total % 7);
    for (let i = 1; i <= rem; i++) {
      const nMonth = calMonth === 11 ? 1 : calMonth + 2;
      const nYear  = calMonth === 11 ? calYear + 1 : calYear;
      const key    = `${nYear}-${String(nMonth).padStart(2,'0')}-${String(i).padStart(2,'0')}`;
      grid.appendChild(makeCell(i, key, true));
    }
  }

  function makeCell(day, key, otherMonth) {
    const tasks   = (calData[key]||'').split('\n').map(s=>s.trim()).filter(Boolean);
    const today   = todayStr();
    const cell    = document.createElement('div');
    let cls = 'cal-cell';
    if (otherMonth) cls += ' other-month';
    if (key === today) cls += ' today';
    if (tasks.length) cls += ' has-note';
    cell.className = cls;

    const num = document.createElement('div');
    num.className = 'cal-cell-num'; num.textContent = day;
    cell.appendChild(num);

    if (tasks.length) {
      const preview = document.createElement('div'); preview.className = 'cal-cell-preview';
      tasks.slice(0,3).forEach(t => {
        const l = document.createElement('div'); l.className = 'cal-cell-line'; l.textContent = t;
        preview.appendChild(l);
      });
      cell.appendChild(preview);
    }
    cell.addEventListener('click', () => openDayView(key));
    return cell;
  }

  // ── 查看日期 ─────────────────────────────────
  function openDayView(key) {
    const modal = document.getElementById('cal-day-modal');
    const tasks = (calData[key]||'').split('\n').map(s=>s.trim()).filter(Boolean);
    document.getElementById('calDayDate').textContent = key;
    const ct = document.getElementById('calDayTasks');
    ct.innerHTML = tasks.length
      ? tasks.map(t=>`<div class="cal-day-task">${t}</div>`).join('')
      : `<div class="cal-day-empty">這天沒有行程</div>`;
    modal.style.display = 'flex';
    document.getElementById('calDayEditBtn').onclick = () => { modal.style.display='none'; openEdit(key); };
    document.getElementById('calDayClose').onclick   = () => modal.style.display='none';
  }

  // ── 編輯日期 ─────────────────────────────────
  function openEdit(key) {
    const modal = document.getElementById('cal-edit-modal');
    document.getElementById('calEditDate').textContent = key;
    document.getElementById('calEditInput').value = calData[key] || '';
    modal.style.display = 'flex';
    document.getElementById('calEditCancel').onclick = () => modal.style.display='none';
    document.getElementById('calEditSave').onclick   = async () => {
      const content = document.getElementById('calEditInput').value.trim();
      calData[key] = content;
      try { localStorage.setItem(CAL_KEY, JSON.stringify(calData)); } catch {}
      pushToSheet(key, content);
      modal.style.display = 'none';
      renderCalGrid();
    };
  }

  // ── 初始化 ────────────────────────────────────
  function init() {
    try { calData = JSON.parse(localStorage.getItem(CAL_KEY) || '{}'); } catch { calData = {}; }

    // 行事曆 modal 現在從工作台開啟
    const calModal = document.getElementById('calendar-modal');
    document.getElementById('calModalClose')?.addEventListener('click', () => {
      if (calModal) calModal.style.display = 'none';
    });
    if (calModal) calModal.addEventListener('click', e => { if (e.target === calModal) calModal.style.display='none'; });

    document.getElementById('calPrevBtn')?.addEventListener('click', () => {
      calMonth--; if (calMonth < 0) { calMonth = 11; calYear--; } renderCalGrid();
    });
    document.getElementById('calNextBtn')?.addEventListener('click', () => {
      calMonth++; if (calMonth > 11) { calMonth = 0; calYear++; } renderCalGrid();
    });
    document.getElementById('calTodayBtn')?.addEventListener('click', () => {
      calYear = new Date().getFullYear(); calMonth = new Date().getMonth(); renderCalGrid();
    });

    // 從工作台開行事曆
    document.getElementById('wsOpenCalBtn')?.addEventListener('click', () => {
      document.getElementById('workspace-modal').style.display = 'none';
      calModal.style.display = 'flex';
      renderCalGrid();
      syncFromSheet();
    });
  }

  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', init);
  else init();
})();

// ══════════════════════════════════════════════
//  工作台入口模組
// ══════════════════════════════════════════════
(function() {
  const wsModal = document.getElementById('workspace-modal');

  document.getElementById('openWorkspaceBtn')?.addEventListener('click', () => {
    wsModal.style.display = 'flex';
  });
  document.getElementById('wsModalClose')?.addEventListener('click', () => {
    wsModal.style.display = 'none';
  });
  wsModal?.addEventListener('click', e => { if (e.target === wsModal) wsModal.style.display = 'none'; });
})();

// ══════════════════════════════════════════════
//  ACS 記事本模組
// ══════════════════════════════════════════════
(function() {
  let acsNotes   = [];
  let editingId  = null;
  const NOTES_KEY = 'acs_notes_data';

  function noteId() {
    return Date.now().toString(36) + Math.random().toString(36).slice(2, 6);
  }
  function getGasUrl() {
    // Firebase Functions API
    return 'https://us-central1-acs-database-5fb57.cloudfunctions.net/api';
  }
  async function gasCall(params) {
    const url = getGasUrl(); if (!url) return null;
    try {
      const qs = Object.entries(params).map(([k,v]) => `${encodeURIComponent(k)}=${encodeURIComponent(String(v))}`).join('&');
      const res = await fetch(`${url}?${qs}`, { mode: 'cors', cache: 'no-store' });
      return await res.json();
    } catch { return null; }
  }

  // ── 同步 ──────────────────────────────────────
  async function syncNotesFromSheet() {
    const status = document.getElementById('notesSyncStatus');
    if (status) status.textContent = '同步中...';
    const res = await gasCall({ action: 'getNotes' });
    if (res?.success) {
      // 雲端完全覆蓋本機
      acsNotes = Array.isArray(res.notes) ? res.notes.filter(n => n?.id) : [];
      acsNotes.sort((a,b) => (b.updatedAt||0) - (a.updatedAt||0));
      try { localStorage.setItem(NOTES_KEY, JSON.stringify(acsNotes)); } catch {}
      if (status) status.textContent = '✓ 已同步';
      setTimeout(() => { if (status) status.textContent = ''; }, 2000);
      renderNotesList();
    } else {
      if (status) status.textContent = getGasUrl() ? '⚠ 同步失敗' : '';
    }
  }

  async function pushNoteToSheet(note, deleted = false) {
    // gasCall 內部會 encodeURIComponent，直接傳原始值
    const noteJson = deleted ? '__EMPTY__' : JSON.stringify(note);
    await gasCall({ action: 'setNote', noteId: note.id, noteJson });
  }

  // ── 渲染清單 ──────────────────────────────────
  function renderNotesList() {
    const list = document.getElementById('acsNotesList');
    if (!list) return;
    list.innerHTML = '';
    if (!acsNotes.length) {
      list.innerHTML = '<div class="acs-notes-empty">還沒有筆記，點 ＋ 新增</div>';
      return;
    }
    acsNotes.forEach(note => {
      const el = document.createElement('div'); el.className = 'acs-note-item';
      const tagsHtml = (note.tags||[]).map(t => `<span class="acs-note-tag">${t}</span>`).join('');
      const d = new Date(note.updatedAt||Date.now());
      const time = `${d.getMonth()+1}/${d.getDate()} ${String(d.getHours()).padStart(2,'0')}:${String(d.getMinutes()).padStart(2,'0')}`;
      el.innerHTML = `
        <div class="acs-note-title">${note.title || '（無標題）'}</div>
        <div class="acs-note-preview">${note.content || '（空白）'}</div>
        <div class="acs-note-footer">${tagsHtml}<span class="acs-note-time">${time}</span></div>
      `;
      el.addEventListener('click', () => openNoteView(note.id));
      list.appendChild(el);
    });
  }

  // ── 查看 ──────────────────────────────────────
  function openNoteView(id) {
    const note = acsNotes.find(n => n.id === id);
    if (!note) return;
    const modal = document.getElementById('note-view-modal');
    document.getElementById('noteViewTitle').textContent   = note.title || '（無標題）';
    document.getElementById('noteViewContent').textContent = note.content || '';
    document.getElementById('noteViewTags').innerHTML = (note.tags||[]).map(t=>`<span class="acs-note-tag">${t}</span>`).join('');
    modal.style.display = 'flex';
    document.getElementById('noteViewEditBtn').onclick = () => { modal.style.display='none'; openNoteEdit(id); };
    document.getElementById('noteViewClose').onclick   = () => modal.style.display='none';
  }

  // ── 編輯 ──────────────────────────────────────
  function openNoteEdit(id) {
    const isNew = !id;
    const note  = isNew ? null : acsNotes.find(n => n.id === id);
    editingId   = id || null;
    const modal = document.getElementById('note-edit-modal');
    document.getElementById('noteEditTitle').textContent   = isNew ? '新增筆記' : '編輯筆記';
    document.getElementById('noteEditTitleInput').value    = note?.title   || '';
    document.getElementById('noteEditTagsInput').value     = (note?.tags||[]).join(', ');
    document.getElementById('noteEditContent').value       = note?.content || '';
    document.getElementById('noteEditDeleteBtn').style.display = isNew ? 'none' : '';
    modal.style.display = 'flex';
  }

  // ── 初始化 ────────────────────────────────────
  function init() {
    try { acsNotes = JSON.parse(localStorage.getItem(NOTES_KEY) || '[]'); } catch { acsNotes = []; }

    // 開啟記事本（從工作台）
    document.getElementById('wsOpenNotesBtn')?.addEventListener('click', () => {
      document.getElementById('workspace-modal').style.display = 'none';
      document.getElementById('notes-modal').style.display = 'flex';
      renderNotesList();
      syncNotesFromSheet();
    });

    // 關閉記事本
    document.getElementById('notesModalClose')?.addEventListener('click', () => {
      document.getElementById('notes-modal').style.display = 'none';
    });
    document.getElementById('notes-modal')?.addEventListener('click', e => {
      if (e.target === document.getElementById('notes-modal'))
        document.getElementById('notes-modal').style.display = 'none';
    });

    // 新增按鈕
    document.getElementById('notesAddBtn')?.addEventListener('click', () => openNoteEdit(null));

    // 取消編輯
    document.getElementById('noteEditCancel')?.addEventListener('click', () => {
      document.getElementById('note-edit-modal').style.display = 'none';
    });

    // 儲存
    document.getElementById('noteEditSave')?.addEventListener('click', async () => {
      const title   = document.getElementById('noteEditTitleInput').value.trim();
      const content = document.getElementById('noteEditContent').value.trim();
      const tags    = document.getElementById('noteEditTagsInput').value.split(',').map(s=>s.trim()).filter(Boolean);
      const now     = Date.now();
      let savedNote;
      if (editingId) {
        const note = acsNotes.find(n => n.id === editingId);
        if (note) { Object.assign(note, { title, content, tags, updatedAt: now }); savedNote = note; }
      } else {
        savedNote = { id: noteId(), title, content, tags, createdAt: now, updatedAt: now };
        acsNotes.unshift(savedNote);
      }
      try { localStorage.setItem(NOTES_KEY, JSON.stringify(acsNotes)); } catch {}
      if (savedNote) pushNoteToSheet(savedNote);
      document.getElementById('note-edit-modal').style.display = 'none';
      renderNotesList();
    });

    // 刪除
    document.getElementById('noteEditDeleteBtn')?.addEventListener('click', async () => {
      if (!editingId) return;
      const note = acsNotes.find(n => n.id === editingId);
      acsNotes = acsNotes.filter(n => n.id !== editingId);
      try { localStorage.setItem(NOTES_KEY, JSON.stringify(acsNotes)); } catch {}
      if (note) pushNoteToSheet(note, true);
      document.getElementById('note-edit-modal').style.display = 'none';
      renderNotesList();
    });
  }

  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', init);
  else init();
})();
