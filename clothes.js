// ══════════════════════════════════════════════
//  服飾管理系統 clothes.js
// ══════════════════════════════════════════════

(function () {

  // ── 狀態 ────────────────────────────────────
  let clothesGasUrl = '';
  let stagingList   = [];   // 貨運核對單
  let inboundList   = [];   // 進貨明細
  let stockList     = [];   // 庫存
  let outboundList  = [];   // 出貨明細
  let surplusData   = { deposits: [], expenses: [] }; // 預存盈餘

  let currentTab    = 'staging'; // staging | inbound | stock | outbound | surplus
  let outboundCart  = [];        // 新增出貨時的購物車
  let isSubmitting   = false;     // 防重複提交
  let editingStaging = null;     // 編輯中的核對單
  let stagingFilter   = 'all';   // 核對單篩選
  let inboundDays     = 0;       // 進貨時間篩選（0=全部）
  let inboundFrom     = '';
  let inboundTo       = '';
  let outboundDays    = 0;       // 出貨時間篩選
  let outboundFrom    = '';
  let outboundTo      = '';
  let surplusDays     = 0;       // 盈餘時間篩選
  let surplusFrom     = '';
  let surplusTo       = '';
  let stockFilter     = 'all';   // 庫存篩選
  let isClothesOpen = false;

  // ── GAS 通訊 ─────────────────────────────────
  function getGasUrl() {
    try { return localStorage.getItem('acs_gs_url') || ''; } catch { return ''; }
  }

  async function gasCallWithStatus(params) { return gasCall(params); } // alias，向後相容
  async function gasCall(params) {
    const url = getGasUrl();
    if (!url) return null;
    setSyncStatus('syncing', '同步中…');
    try {
      const qs = Object.entries(params)
        .map(([k, v]) => `${encodeURIComponent(k)}=${encodeURIComponent(String(v))}`)
        .join('&');
      const res  = await fetch(`${url}?${qs}`);
      const data = await res.json();
      if (data?.success !== false) setSyncStatus('done', '✓ 已同步');
      else setSyncStatus('error', '⚠ 同步失敗');
      return data;
    } catch {
      setSyncStatus('error', '⚠ 同步失敗');
      return null;
    }
  }

  // ── 資料載入 ──────────────────────────────────
  async function loadStaging() {
    const res = await gasCallWithStatus({ action: 'clothes_getStagingList' });
    if (res?.success) stagingList = res.data || [];
    else stagingList = JSON.parse(localStorage.getItem('clothes_staging') || '[]');
    stagingList.sort((a, b) => {
      const dateDiff = new Date(b.date) - new Date(a.date);
      if (dateDiff !== 0) return dateDiff;
      // 同日期時用 ID（時間戳）決定順序，新增的 ID 較大
      return String(b.id) > String(a.id) ? 1 : -1;
    });
    renderStaging();
  }

  async function loadInbound() {
    const res = await gasCallWithStatus({ action: 'clothes_getInbound' });
    if (res?.success) inboundList = res.data || [];
    else inboundList = JSON.parse(localStorage.getItem('clothes_inbound') || '[]');
    inboundList.sort((a, b) => {
      const dateDiff = new Date(b.orderDate) - new Date(a.orderDate);
      if (dateDiff !== 0) return dateDiff;
      // 同日期時用入庫時間決定順序
      const parseTs = str => {
        if (!str) return 0;
        const d = new Date(str.replace(' ', 'T'));
        return isNaN(d.getTime()) ? 0 : d.getTime();
      };
      return parseTs(b.inboundAt) - parseTs(a.inboundAt);
    });
    renderInbound();
  }

  async function loadStock() {
    const res = await gasCallWithStatus({ action: 'clothes_getStock' });
    if (res?.success) stockList = res.data || [];
    else stockList = JSON.parse(localStorage.getItem('clothes_stock') || '[]');
    dropdownStockList = stockList;
    renderStock();
  }

  async function loadOutbound() {
    const res = await gasCallWithStatus({ action: 'clothes_getOutbound' });
    if (res?.success) outboundList = res.data || [];
    else outboundList = JSON.parse(localStorage.getItem('clothes_outbound') || '[]');
    outboundList.sort((a, b) => new Date(b.date) - new Date(a.date));
    renderOutbound();
  }

  async function loadSurplus() {
    const res = await gasCallWithStatus({ action: 'clothes_getSurplus' });
    if (res?.success) surplusData = res.data || { deposits: [], expenses: [] };
    else surplusData = JSON.parse(localStorage.getItem('clothes_surplus') || '{"deposits":[],"expenses":[]}');
    renderSurplus();
  }

  // ── 計算工具 ──────────────────────────────────
  function calcStaging(row) {
    const krw    = parseFloat(row.krwCost) || 0;
    const qty    = parseFloat(row.qty) || 0;
    const rate   = parseFloat(row.rate) || 1;
    const source = row.source || '振興'; // 振興=3%, 網站=4%
    const feeRate = source === '振興' ? 0.03 : 0.04;

    const totalKrw   = krw * qty;
    const totalNtd   = totalKrw / rate;
    const fee        = totalNtd * feeRate;
    const unitCost   = totalKrw > 0 ? (totalKrw / rate) / qty : 0;
    const unitNtPrice = unitCost * (1 + feeRate);
    const subtotal   = unitNtPrice * qty;

    return {
      totalKrw: Math.round(totalKrw),
      totalNtd: +totalNtd.toFixed(2),
      fee: +fee.toFixed(2),
      unitCost: +unitCost.toFixed(4),
      unitNtPrice: +unitNtPrice.toFixed(4),
      subtotal: +subtotal.toFixed(2)
    };
  }

  // ── Tab 切換 ──────────────────────────────────
  function switchTab(tab) {
    currentTab = tab;
    document.querySelectorAll('.cl-nav-item').forEach(el => {
      el.classList.toggle('active', el.dataset.tab === tab);
    });
    document.querySelectorAll('.cl-page').forEach(el => {
      if (el.dataset.page === tab) {
        el.style.display = 'flex';
        el.scrollTop = 0;
      } else {
        el.style.display = 'none';
      }
    });

    // 右上角按鈕控制
    const stagingBtn  = document.getElementById('cl-staging-add-btn');
    const outboundBtn = document.getElementById('cl-outbound-add-btn');
    const depositBtn  = document.getElementById('cl-deposit-btn');
    const expenseBtn  = document.getElementById('cl-expense-btn');
    if (stagingBtn)  stagingBtn.style.display  = tab === 'staging'  ? '' : 'none';
    if (outboundBtn) outboundBtn.style.display = tab === 'outbound' ? '' : 'none';
    if (depositBtn)  depositBtn.style.display  = tab === 'surplus'  ? '' : 'none';
    if (expenseBtn)  expenseBtn.style.display  = tab === 'surplus'  ? '' : 'none';

    // 載入資料
    if (tab === 'staging')  loadStaging();
    if (tab === 'inbound')  loadInbound();
    if (tab === 'stock')    loadStock();
    if (tab === 'outbound') loadOutbound();
    if (tab === 'surplus')  loadSurplus();
  }

  // ══════════════════════════════════════════════
  //  一、貨運核對單
  // ══════════════════════════════════════════════
  function renderStaging() {
    const container = document.getElementById('cl-staging-list');
    if (!container) return;

    if (!stagingList.length) {
      container.innerHTML = `<div class="cl-empty">尚無核對單<br><span>點右上角 ＋ 新增一批進貨</span></div>`;
      return;
    }

    // 依篩選+狀態分組顯示
    const filtered = stagingFilter === 'all' ? stagingList : stagingList.filter(r => r.status === stagingFilter);
    const groups = { '待入庫': [], '已入庫': [], '廠商退款': [] };
    filtered.forEach(row => { (groups[row.status] || groups['待入庫']).push(row); });

    let html = '';
    ['待入庫', '已入庫', '廠商退款'].forEach(status => {
      const items = groups[status];
      if (!items.length) return;
      html += `<div class="cl-section-label">${status}（${items.length}）</div>`;
      items.forEach(row => {
        const calc = calcStaging(row);
        const statusClass = status === '待入庫' ? 'cl-badge-pending' : status === '已入庫' ? 'cl-badge-done' : 'cl-badge-refund';
        html += `
        <div class="cl-card cl-card-collapse" data-id="${row.id}">
          <div class="cl-card-header cl-card-toggle" onclick="clToggleCard(this)">
            <div class="cl-card-toggle-left">
              <div class="cl-card-title">${row.style || '—'}</div>
              <div class="cl-card-sub">${row.stall || '—'} ・ ${row.size || '—'} ・ ${row.source || '—'}</div>
            </div>
            <div class="cl-card-toggle-right">
              <span class="cl-card-summary">NT$ ${calc.subtotal.toFixed(0)}</span>
              <span class="cl-badge ${statusClass}">${status}</span>
              <span class="cl-chevron">›</span>
            </div>
          </div>
          <div class="cl-card-body">
            <div class="cl-card-row">
              <span>韓幣成本</span><span>₩${(row.krwCost||0).toLocaleString()} × ${row.qty||0}件</span>
            </div>
            <div class="cl-card-row">
              <span>進貨匯率</span><span>${row.rate || '—'}</span>
            </div>
            <div class="cl-card-row">
              <span>代購方式</span><span>${row.source || '—'}（${row.source === '振興' ? '3%' : '4%'}）</span>
            </div>
            <div class="cl-card-row cl-card-row-highlight">
              <span>單件成本（NT）</span><span>NT$ ${calc.unitNtPrice.toFixed(0)}</span>
            </div>
            <div class="cl-card-row cl-card-row-highlight">
              <span>合計</span><span>NT$ ${calc.subtotal.toFixed(0)}</span>
            </div>
            ${row.status === '待入庫' ? `
            <div class="cl-card-actions">
              <button class="cl-btn cl-btn-ghost" onclick="clEditStaging('${row.id}')">編輯</button>
              <button class="cl-btn cl-btn-danger" onclick="clRefundStaging('${row.id}')">廠商退款</button>
              <button class="cl-btn cl-btn-primary" onclick="clCommitStaging('${row.id}')">入庫</button>
            </div>` : ''}
          </div>
        </div>`;
      });
    });
    container.innerHTML = html;
  }

  window.clEditStaging = function(id) {
    const row = stagingList.find(r => r.id === id);
    if (!row) return;
    editingStaging = row;
    openStagingForm(row);
  };

  window.clRefundStaging = function(id) {
    showClConfirm('確定標記為廠商退款？', async () => {
      const res = await gasCallWithStatus({ action: 'clothes_voidStaging', id });
      const local = stagingList.find(r => r.id === id);
      if (local) local.status = '廠商退款';
      saveLocal('clothes_staging', stagingList);
      renderStaging();
    });
  };

  window.clCommitStaging = function(id) {
    if (isSubmitting) return;
    const row = stagingList.find(r => r.id === id);
    if (!row) return;
    showClConfirm(`確定將「${row.style}」入庫？`, async () => {
      isSubmitting = true;
      const calc = calcStaging(row);
      const inboundRow = {
        id: row.id,
        orderDate: row.date,
        productCode: row.productCode || '',
        stall: row.stall,
        style: row.style,
        size: row.size,
        source: row.source,
        krwCost: row.krwCost,
        totalKrw: calc.totalKrw,
        totalNtd: calc.totalNtd,
        fee: calc.fee,
        rate: row.rate,
        unitCost: calc.unitCost,
        unitNtPrice: calc.unitNtPrice,
        qty: row.qty,
        subtotal: calc.subtotal,
        inboundAt: new Date().toISOString()
      };

      const res = await gasCallWithStatus({
        action: 'clothes_commitInbound',
        data: JSON.stringify(inboundRow)
      });

      // 本機更新
      const local = stagingList.find(r => r.id === id);
      if (local) local.status = '已入庫';
      inboundList.unshift(inboundRow);

      // 更新庫存
      const existing = stockList.find(s => s.productCode === row.productCode);
      if (existing) {
        existing.stock = (parseInt(existing.stock) || 0) + parseInt(row.qty);
        existing.status = existing.stock > 0 ? '可售' : '售完';
      } else if (row.productCode) {
        stockList.unshift({
          productCode: row.productCode,
          style: row.style,
          size: row.size,
          cost: calc.unitNtPrice,
          price: '',
          stock: parseInt(row.qty),
          status: '可售',
          isSample: false
        });
      }

      saveLocal('clothes_staging', stagingList);
      saveLocal('clothes_inbound', inboundList);
      saveLocal('clothes_stock', stockList);
      isSubmitting = false;
      showClToast('✅ 已入庫');
      renderStaging();
    });
  };

  function openStagingForm(prefill) {
    const modal = document.getElementById('cl-staging-modal');
    if (!modal) return;
    const f = prefill || {};
    modal.querySelector('#cl-s-date').value   = f.date || today();
    modal.querySelector('#cl-s-code').value   = f.productCode || '';
    modal.querySelector('#cl-s-stall').value  = f.stall || '';
    modal.querySelector('#cl-s-style').value  = f.style || '';
    const sizeVal = f.size || '';
    const sizeSelectEl = modal.querySelector('#cl-s-size-select');
    const sizeInputEl  = modal.querySelector('#cl-s-size');
    const predefined   = ['F','S','M','L','XL'];
    if (sizeSelectEl && sizeInputEl) {
      if (predefined.includes(sizeVal)) {
        sizeSelectEl.value = sizeVal;
        sizeInputEl.style.display = 'none';
        sizeInputEl.value = sizeVal;
      } else {
        sizeSelectEl.value = 'custom';
        sizeInputEl.style.display = '';
        sizeInputEl.value = sizeVal;
      }
    }
    modal.querySelector('#cl-s-source').value = f.source || '振興';
    modal.querySelector('#cl-s-krw').value    = f.krwCost || '';
    modal.querySelector('#cl-s-rate').value   = f.rate || '';
    modal.querySelector('#cl-s-qty').value    = f.qty || '';
    calcStagingPreview();
    modal.style.display = 'flex';
  }

  function calcStagingPreview() {
    const krw    = parseFloat(document.getElementById('cl-s-krw')?.value) || 0;
    const rate   = parseFloat(document.getElementById('cl-s-rate')?.value) || 1;
    const qty    = parseFloat(document.getElementById('cl-s-qty')?.value) || 0;
    const source = document.getElementById('cl-s-source')?.value || '振興';
    const feeRate = source === '振興' ? 0.03 : 0.04;
    const unitNt = krw > 0 && rate > 0 ? (krw / rate) * (1 + feeRate) : 0;
    const subtotal = unitNt * qty;
    const el = document.getElementById('cl-s-preview');
    if (el) el.innerHTML = krw > 0
      ? `單件成本 NT$ ${unitNt.toFixed(0)}　合計 NT$ ${subtotal.toFixed(0)}`
      : '';
  }

  // ══════════════════════════════════════════════
  //  二、進貨明細
  // ══════════════════════════════════════════════
  function renderInbound() {
    const container = document.getElementById('cl-inbound-list');
    if (!container) return;
    if (!inboundList.length) {
      container.innerHTML = `<div class="cl-empty">尚無進貨紀錄</div>`;
      return;
    }
    const filteredInbound = filterByDays(inboundList, 'orderDate', inboundDays, inboundFrom, inboundTo);
    const sorted = [...filteredInbound].sort((a, b) => {
      const dateDiff = new Date(b.orderDate) - new Date(a.orderDate);
      if (dateDiff !== 0) return dateDiff;
      const parseTs = str => {
        if (!str) return 0;
        const d = new Date(str.replace(' ', 'T'));
        return isNaN(d.getTime()) ? 0 : d.getTime();
      };
      return parseTs(b.inboundAt) - parseTs(a.inboundAt);
    });
    let html = '';
    sorted.forEach(row => {
      html += `
      <div class="cl-card cl-card-collapse">
        <div class="cl-card-header cl-card-toggle" onclick="clToggleCard(this)">
          <div class="cl-card-toggle-left">
            <div class="cl-card-title">${row.style || '—'} <span class="cl-size-tag">${row.size || ''}</span></div>
            <div class="cl-card-sub">${formatDate(row.orderDate)} ・ ${row.stall || '—'} ・ ${row.productCode || '—'}</div>
          </div>
          <div class="cl-card-toggle-right">
            <span class="cl-card-summary">NT$ ${(row.subtotal||0).toLocaleString(undefined,{maximumFractionDigits:0})}</span>
            <span class="cl-chevron">›</span>
          </div>
        </div>
        <div class="cl-card-body">
          <div class="cl-card-row">
            <span>韓幣 × 數量</span><span>₩${(row.krwCost||0).toLocaleString()} × ${row.qty||0}件</span>
          </div>
          <div class="cl-card-row">
            <span>匯率 / 代購</span><span>${row.rate || '—'} ／ ${row.source || '—'}</span>
          </div>
          <div class="cl-card-row">
            <span>單件成本</span><span>NT$ ${(row.unitNtPrice||0).toFixed(0)}</span>
          </div>
          <div class="cl-card-row">
            <span>入庫時間</span><span>${formatDateTime(row.inboundAt)}</span>
          </div>
        </div>
      </div>`;
    });
    container.innerHTML = html;
  }

  // ══════════════════════════════════════════════
  //  三、庫存管理
  // ══════════════════════════════════════════════
  function renderStock(filter) {
    const container = document.getElementById('cl-stock-list');
    if (!container) return;

    let list = stockList;
    const kw = (document.getElementById('cl-stock-search')?.value || '').trim().toLowerCase();
    if (kw) list = list.filter(s =>
      (s.style || '').toLowerCase().includes(kw) ||
      (s.productCode || '').toLowerCase().includes(kw)
    );
    if (stockFilter === 'available') {
      list = list.filter(s => {
        const total = parseInt(s.stock) || 0;
        const avail = s.isSample ? total - 1 : total;
        return avail > 0;
      });
    } else if (stockFilter === 'sold') {
      list = list.filter(s => {
        const total = parseInt(s.stock) || 0;
        const avail = s.isSample ? total - 1 : total;
        return avail === 0;
      });
    } else if (stockFilter === 'reorder') {
      list = list.filter(s => {
        const total = parseInt(s.stock) || 0;
        const avail = s.isSample ? Math.max(0, total - 1) : total;
        return avail < 0;
      });
    }

    if (!list.length) {
      container.innerHTML = `<div class="cl-empty">尚無庫存商品</div>`;
      return;
    }

    // 統計
    const inStock  = stockList.filter(s => parseInt(s.stock) > 0).length;
    const total    = stockList.length;
    const statEl   = document.getElementById('cl-stock-stat');
    if (statEl) statEl.textContent = `共 ${total} 款・${inStock} 款有庫存`;

    let html = '';
    list.forEach(row => {
      const totalStock   = parseInt(row.stock) || 0;
      const displayStock = row.isSample ? totalStock - 1 : totalStock;
      const statusClass  = displayStock > 0 ? 'cl-badge-done' : 'cl-badge-empty';
      const statusLabel  = row.isSample
        ? (displayStock > 0 ? '含樣品' : '售完')
        : (displayStock > 0 ? '可售' : (displayStock < 0 ? '追加' : '售完'));
      html += `
      <div class="cl-card cl-card-collapse">
        <div class="cl-card-header cl-card-toggle" onclick="clToggleCard(this)">
          <div class="cl-card-toggle-left">
            <div class="cl-card-title">${row.style || '—'} <span class="cl-size-tag">${row.size || ''}</span></div>
            <div class="cl-card-sub">${row.productCode || '—'}</div>
          </div>
          <div class="cl-card-toggle-right">
            <span class="cl-card-summary">${displayStock} 件</span>
            <span class="cl-badge ${statusClass}">${statusLabel}</span>
            <span class="cl-chevron">›</span>
          </div>
        </div>
        <div class="cl-card-body">
          <div class="cl-card-row">
            <span>成本</span><span>NT$ ${(row.cost||0).toFixed(0)}</span>
          </div>
          <div class="cl-card-row">
            <span>售價</span><span>${row.price ? 'NT$ ' + row.price : '—'}</span>
          </div>
          <div class="cl-card-row cl-card-row-highlight">
            <span>庫存數量</span><span>${displayStock} 件${row.isSample ? '（含1件樣品）' : ''}</span>
          </div>
          <div class="cl-card-actions">
            <button class="cl-btn cl-btn-primary" onclick="clOpenStockEdit('${row.productCode}')">編輯</button>
          </div>
        </div>
      </div>`;
    });
    container.innerHTML = html;
  }

  window.clOpenStockEdit = function(code) {
    const row = stockList.find(s => s.productCode === code);
    if (!row) return;
    const modal = document.getElementById('cl-stock-modal');
    if (!modal) return;
    modal.querySelector('#cl-st-code').textContent  = row.productCode || '—';
    modal.querySelector('#cl-st-style').textContent = `${row.style || '—'} ${row.size || ''}`;
    modal.querySelector('#cl-st-cost').textContent  = `NT$ ${(row.cost||0).toFixed(0)}`;
    modal.querySelector('#cl-st-price').value  = row.price || '';
    const stock = parseInt(row.stock) || 0;
    const sampleCheck = modal.querySelector('#cl-st-sample');
    sampleCheck.checked  = !!row.isSample;
    sampleCheck.disabled = stock <= 0;
    const sampleRow = sampleCheck?.closest('.cl-form-row-check');
    if (sampleRow) sampleRow.style.opacity = stock <= 0 ? '0.4' : '';
    modal.querySelector('#cl-st-status').value = row.status || '可售';
    modal.dataset.code = code;
    modal.style.display = 'flex';
  };

  // ══════════════════════════════════════════════
  //  四、出貨明細
  // ══════════════════════════════════════════════
  function renderOutbound() {
    const container = document.getElementById('cl-outbound-list');
    if (!container) return;
    if (!outboundList.length) {
      container.innerHTML = `<div class="cl-empty">尚無出貨紀錄</div>`;
      return;
    }

    // 時間篩選
    const filteredOutbound = filterByDays(outboundList, 'date', outboundDays, outboundFrom, outboundTo);
    // 依批次 ID 分組（batchId = 每次新增產生的唯一 ID）
    const orders = {};
    filteredOutbound.forEach(row => {
      // 新資料：orderId 是 batchId（唯一ID）；舊資料：orderId 是 IG 帳號（含@或舊格式）→ 用 id 讓每列獨立
      const isOldFormat = (row.orderId || '').startsWith('@') || (row.orderId || '').includes('sds') || (row.orderId || '').includes('cyn');
      const key = isOldFormat ? row.id : (row.batchId || row.orderId || row.id);
      if (!orders[key]) orders[key] = { batchId: key, orderId: row.orderId || '—', date: row.date, items: [], status: row.status, ig: row.ig || '', name: row.name || '', phone: row.phone || '', address: row.address || '', shipping: row.shipping || '', bank: row.bank || '' };
      else orders[key].status = row.status;
      orders[key].items.push(row);
    });

    let html = '';
    Object.values(orders).sort((a,b) => new Date(b.date) - new Date(a.date)).forEach(order => {
      const total = order.items.reduce((s, i) => s + (parseFloat(i.subtotal) || 0), 0);
      const statusClass = order.status === '已出貨' ? 'cl-badge-done' : 'cl-badge-pending';
      html += `
      <div class="cl-card cl-card-collapse">
        <div class="cl-card-header cl-card-toggle" onclick="clToggleCard(this)">
          <div class="cl-card-toggle-left">
            <div class="cl-card-title">${order.ig ? order.ig : '訂單'} ${order.name ? '・' + order.name : ''}</div>
            <div class="cl-card-sub">${formatDate(order.date)}${order.shipping ? ' ・ ' + order.shipping : ''}</div>
          </div>
          <div class="cl-card-toggle-right">
            <span class="cl-card-summary">NT$ ${total.toLocaleString(undefined,{maximumFractionDigits:0})}</span>
            <span class="cl-badge ${statusClass}">${order.status || '已出貨'}</span>
            <span class="cl-chevron">›</span>
          </div>
        </div>
        <div class="cl-card-body">
          ${order.ig ? `<div class="cl-card-row"><span>IG</span><span>${order.ig}</span></div>` : ''}
          ${order.name ? `<div class="cl-card-row"><span>姓名</span><span>${order.name}</span></div>` : ''}
          ${order.phone ? `<div class="cl-card-row"><span>電話</span><span>${order.phone}</span></div>` : ''}
          ${order.address ? `<div class="cl-card-row"><span>地址</span><span>${order.address}</span></div>` : ''}
          ${order.shipping ? `<div class="cl-card-row"><span>寄送方式</span><span>${order.shipping}</span></div>` : ''}
          ${order.bank ? `<div class="cl-card-row"><span>銀行後五碼</span><span>${order.bank}</span></div>` : ''}
          <div class="cl-card-row" style="border-top:1px dashed var(--color-border-tertiary);margin-top:4px;padding-top:8px"></div>
          ${order.items.map(item => `
          <div class="cl-card-row">
            <span>${item.style || '—'} ${item.size || ''} × ${item.qty || 1}</span>
            <span>NT$ ${(parseFloat(item.subtotal)||0).toLocaleString(undefined,{maximumFractionDigits:0})}</span>
          </div>`).join('')}
          <div class="cl-card-row cl-card-row-highlight">
            <span>訂單合計</span><span>NT$ ${total.toLocaleString(undefined,{maximumFractionDigits:0})}</span>
          </div>
          ${order.status !== '已出貨' ? `
          <div class="cl-card-actions">
            <button class="cl-btn cl-btn-ghost" onclick="clEditOutbound('${order.batchId}')">編輯</button>
            <button class="cl-btn cl-btn-primary" onclick="clMarkOutboundDone('${order.batchId}')">標記為已出貨</button>
          </div>` : ''}
        </div>
      </div>`;
    });
    container.innerHTML = html;
  }

  // 出貨購物車
  function renderOutboundCart() {
    const el = document.getElementById('cl-ob-cart-items');
    const totalEl = document.getElementById('cl-ob-cart-total');
    if (!el) return;
    if (!outboundCart.length) {
      el.innerHTML = `<div class="cl-cart-empty">尚未加入商品</div>`;
      if (totalEl) totalEl.textContent = 'NT$ 0';
      return;
    }
    const total = outboundCart.reduce((s, i) => s + (i.price * i.qty), 0);
    el.innerHTML = outboundCart.map((item, idx) => `
      <div class="cl-cart-row">
        <div class="cl-cart-info">
          <span class="cl-cart-name">${item.style} ${item.size}</span>
          <span class="cl-cart-detail">${item.qty}件 × NT$${item.price}</span>
        </div>
        <div class="cl-cart-right">
          <span>NT$ ${(item.price * item.qty).toLocaleString()}</span>
          <button class="cl-cart-del" onclick="clRemoveCartItem(${idx})">✕</button>
        </div>
      </div>`).join('');
    if (totalEl) totalEl.textContent = `NT$ ${total.toLocaleString()}`;
  }

  window.clRemoveCartItem = function(idx) {
    outboundCart.splice(idx, 1);
    renderOutboundCart();
  };

  async function openOutboundForm() {
    outboundCart = [];
    isSubmitting = false; // 每次開啟都重置提交鎖
    selectedProductCode = '';
    const searchInput = document.getElementById('cl-ob-search');
    if (searchInput) searchInput.value = '';
    const hiddenInput = document.getElementById('cl-ob-product');
    if (hiddenInput) hiddenInput.value = '';
    const panel = document.getElementById('cl-ob-panel');
    if (panel) panel.style.display = 'none';
    const obBtn = document.getElementById('cl-ob-submit');
    if (obBtn) { obBtn.disabled = false; obBtn.textContent = '新增訂單'; }
    const modal = document.getElementById('cl-outbound-modal');
    if (!modal) return;
    modal.querySelector('#cl-ob-ig').value       = '';
    modal.querySelector('#cl-ob-name').value     = '';
    modal.querySelector('#cl-ob-phone').value    = '';
    modal.querySelector('#cl-ob-address').value  = '';
    modal.querySelector('#cl-ob-shipping').value = '7-11';
    modal.querySelector('#cl-ob-bank').value     = '';
    modal.querySelector('#cl-ob-date').value     = today();
    renderOutboundCart();

    // 先確保庫存已載入
    const sel = modal.querySelector('#cl-ob-product');
    if (sel) {
      sel.innerHTML = `<option value="">載入中…</option>`;
      modal.style.display = 'flex';
      modal.querySelector('#cl-ob-status').value = '待出貨';

      // 每次都重新拉最新庫存，確保即時反映入庫/出貨
      const gasUrl = getGasUrl();
      if (!gasUrl) {
        // GAS URL 未設定，直接用本機快取
        stockList = JSON.parse(localStorage.getItem('clothes_stock') || '[]');
      } else {
        const freshRes = await gasCallWithStatus({ action: 'clothes_getStock' });
        if (freshRes?.success) {
          stockList = freshRes.data || [];
          saveLocal('clothes_stock', stockList);
        } else {
          // GAS 回傳失敗，fallback 本機快取
          const cached = JSON.parse(localStorage.getItem('clothes_stock') || '[]');
          if (cached.length) stockList = cached;
        }
      }

      dropdownStockList = stockList;
      clRenderDropdownList('');
    } else {
      modal.style.display = 'flex';
    }
  }

  window.clEditOutbound = async function(orderId) {
    // 用 batchId 分組（跟 renderOutbound 一致）
    const order = Object.values((() => {
      const o = {};
      outboundList.forEach(r => {
        const k = r.batchId || r.orderId || r.id;
        if (!o[k]) o[k] = { batchId: k, ...r, items: [] };
        o[k].items.push(r);
      });
      return o;
    })()).find(o => o.batchId === orderId);
    if (!order) return;

    outboundCart = order.items.map(item => ({
      productCode: item.productCode,
      style: item.style, size: item.size,
      cost: item.cost, price: item.price,
      qty: item.qty, subtotal: item.subtotal
    }));

    isSubmitting = false;
    const obBtn = document.getElementById('cl-ob-submit');
    if (obBtn) { obBtn.disabled = false; obBtn.textContent = '儲存修改'; }

    const modal = document.getElementById('cl-outbound-modal');
    if (!modal) return;
    modal.querySelector('#cl-ob-ig').value       = order.ig || '';
    modal.querySelector('#cl-ob-name').value     = order.name || '';
    modal.querySelector('#cl-ob-phone').value    = order.phone || '';
    modal.querySelector('#cl-ob-address').value  = order.address || '';
    modal.querySelector('#cl-ob-shipping').value = order.shipping || '7-11';
    modal.querySelector('#cl-ob-bank').value     = order.bank || '';
    modal.querySelector('#cl-ob-date').value     = order.date || today();
    modal.style.display = 'flex';
    modal.querySelector('#cl-ob-status').value   = order.status || '待出貨';
    modal.dataset.editOrderId = orderId; // 記錄編輯中的 orderId

    // 填庫存選單
    const sel = modal.querySelector('#cl-ob-product');
    if (sel) {
      const gasUrl = getGasUrl();
      if (gasUrl) {
        const freshRes = await gasCallWithStatus({ action: 'clothes_getStock' });
        if (freshRes?.success) { stockList = freshRes.data || []; dropdownStockList = stockList; saveLocal('clothes_stock', stockList); }
      }
      dropdownStockList = stockList;
      clRenderDropdownList('');
    }
    renderOutboundCart();
  };

  window.clMarkOutboundDone = function(orderId) {
    const order = outboundList.find(r => (r.batchId || r.orderId || r.id) === orderId);
    const igHandle = order?.ig ? order.ig.replace(/^@/, '') : null;

    showClConfirm('確定標記為已出貨？', async () => {
      // 先開 IG（必須在使用者點擊的同步流程中執行，才不會被 popup blocker 攔截）
      const igWin = igHandle ? window.open('https://ig.me/m/' + igHandle, '_blank') : null;

      // 更新本機
      outboundList.forEach(row => {
        if ((row.batchId || row.orderId || row.id) === orderId) row.status = '已出貨';
      });
      saveLocal('clothes_outbound', outboundList);
      // 同步 GAS
      await gasCallWithStatus({ action: 'clothes_updateOutboundStatus', orderId, status: '已出貨' });
      showClToast('✅ 已標記為已出貨');
      renderOutbound();
    });
  };

    window.clAddToCart = function() {
    const modal   = document.getElementById('cl-outbound-modal');
    const hidden  = modal.querySelector('#cl-ob-product');
    const qty     = parseInt(modal.querySelector('#cl-ob-qty').value) || 1;
    const price   = parseFloat(modal.querySelector('#cl-ob-price').value) || 0;
    if (!hidden.value) return showClToast('請選擇商品');
    outboundCart.push({
      productCode: hidden.value,
      style: hidden.dataset.style || '',
      size:  hidden.dataset.size  || '',
      cost:  parseFloat(hidden.dataset.cost) || 0,
      price, qty,
      subtotal: price * qty
    });
    // 重置下拉
    hidden.value = '';
    selectedProductCode = '';
    const searchEl = document.getElementById('cl-ob-search');
    if (searchEl) searchEl.value = '';
    modal.querySelector('#cl-ob-qty').value   = '1';
    modal.querySelector('#cl-ob-price').value = '';
    renderOutboundCart();
  };

  // 選商品自動帶入售價
  document.addEventListener('change', e => {
    if (e.target.id === 'cl-ob-product') {
      const opt = e.target.options[e.target.selectedIndex];
      const priceEl = document.getElementById('cl-ob-price');
      if (priceEl && opt?.dataset.price) priceEl.value = opt.dataset.price;
    }
  });

  // ══════════════════════════════════════════════
  //  五、預存盈餘
  // ══════════════════════════════════════════════
  function renderSurplus() {
    const allDeps = surplusData.deposits || [];
    const allExps = surplusData.expenses || [];
    const deps = filterByDays(allDeps, 'date', surplusDays, surplusFrom, surplusTo);
    const exps = filterByDays(allExps, 'date', surplusDays, surplusFrom, surplusTo);

    // 入金：台幣 × 匯率 → 韓幣
    const totalDepositKrw = deps.reduce((s, d) => s + Math.round((parseFloat(d.ntd)||0) * (parseFloat(d.rate)||1)), 0);
    // 支出：直接是韓幣
    const totalExpenseKrw = exps.reduce((s, e) => s + (parseFloat(e.total) || 0), 0);
    const balanceKrw      = totalDepositKrw - totalExpenseKrw;

    const balEl = document.getElementById('cl-surplus-balance');
    if (balEl) {
      balEl.textContent = `₩${balanceKrw.toLocaleString(undefined,{maximumFractionDigits:0})}`;
      balEl.className   = 'cl-surplus-balance ' + (balanceKrw >= 0 ? 'cl-balance-pos' : 'cl-balance-neg');
    }
    const depEl = document.getElementById('cl-surplus-deposit-total');
    const expEl = document.getElementById('cl-surplus-expense-total');
    if (depEl) depEl.textContent = `₩${totalDepositKrw.toLocaleString(undefined,{maximumFractionDigits:0})}`;
    if (expEl) expEl.textContent = `₩${totalExpenseKrw.toLocaleString(undefined,{maximumFractionDigits:0})}`;

    // 入金列表
    const depList = document.getElementById('cl-deposit-list');
    if (depList) {
      depList.innerHTML = !deps.length ? '<div class="cl-empty-small">尚無入金紀錄</div>' :
        deps.map(d => `
        <div class="cl-surplus-item-card">
          <div class="cl-surplus-item-left">
            <span class="cl-surplus-item-date">${formatDate(d.date)}</span>
            <span class="cl-surplus-item-rate">匯率 ${d.rate}</span>
          </div>
          <div class="cl-surplus-item-right">
            <span class="cl-surplus-item-ntd">NT$ ${(parseFloat(d.ntd)||0).toLocaleString()}</span>
            <span class="cl-surplus-item-krw">₩${Math.round((parseFloat(d.ntd)||0)*(parseFloat(d.rate)||1)).toLocaleString()}</span>
          </div>
        </div>`).join('');
    }

    // 支出列表（韓幣）
    const expList = document.getElementById('cl-expense-list');
    if (expList) {
      expList.innerHTML = !exps.length ? '<div class="cl-empty-small">尚無支出紀錄</div>' :
        exps.map(e => `
        <div class="cl-surplus-item-card">
          <div class="cl-surplus-item-left">
            <span class="cl-surplus-item-date">${formatDate(e.date)}</span>
            <span class="cl-surplus-item-note">${e.note || '支出'}</span>
          </div>
          <div class="cl-surplus-item-right">
            ${e.product ? `<span class="cl-surplus-item-sub">商品 ₩${(parseFloat(e.product)||0).toLocaleString()}</span>` : ''}
            ${e.agency  ? `<span class="cl-surplus-item-sub">代購 ₩${(parseFloat(e.agency)||0).toLocaleString()}</span>`  : ''}
            ${e.shipping? `<span class="cl-surplus-item-sub">運費 ₩${(parseFloat(e.shipping)||0).toLocaleString()}</span>`: ''}
            <span class="cl-surplus-item-krw">₩${(parseFloat(e.total)||0).toLocaleString()}</span>
          </div>
        </div>`).join('');
    }
  }

  // ══════════════════════════════════════════════
  //  提交動作
  // ══════════════════════════════════════════════
  async function submitStaging() {
    if (isSubmitting) return;
    const get = id => document.getElementById(id)?.value?.trim() || '';
    const row = {
      id:          editingStaging?.id || genId(),
      date:        get('cl-s-date') || today(),
      productCode: get('cl-s-code'),
      stall:       get('cl-s-stall'),
      style:       get('cl-s-style'),
      size:        get('cl-s-size'),
      source:      get('cl-s-source'),
      krwCost:     parseFloat(get('cl-s-krw')) || 0,
      rate:        parseFloat(get('cl-s-rate')) || 0,
      qty:         parseInt(get('cl-s-qty'))   || 0,
      status:      '待入庫'
    };
    if (!row.style || !row.krwCost || !row.qty) return showClToast('請填寫款式、韓幣成本、數量');
    isSubmitting = true;
    const saveBtn = document.getElementById('cl-staging-save');
    if (saveBtn) { saveBtn.disabled = true; saveBtn.textContent = '儲存中…'; }
    try {
      await gasCallWithStatus({ action: 'clothes_addStaging', data: JSON.stringify(row) });
    } finally {
      isSubmitting = false;
      if (saveBtn) { saveBtn.disabled = false; saveBtn.textContent = '儲存'; }
    }

    if (editingStaging) {
      const idx = stagingList.findIndex(r => r.id === editingStaging.id);
      if (idx !== -1) stagingList[idx] = row;
    } else {
      stagingList.unshift(row);
    }
    saveLocal('clothes_staging', stagingList);
    document.getElementById('cl-staging-modal').style.display = 'none';
    editingStaging = null;
    showClToast('✅ 已儲存');
    renderStaging();
  }

  async function submitStockEdit() {
    if (isSubmitting) return;
    const modal = document.getElementById('cl-stock-modal');
    const code  = modal?.dataset.code;
    if (!code) return;
    const row   = stockList.find(s => s.productCode === code);
    if (!row) return;
    row.price    = parseFloat(modal.querySelector('#cl-st-price').value) || '';
    row.isSample = modal.querySelector('#cl-st-sample').checked;
    row.status   = modal.querySelector('#cl-st-status').value;
    isSubmitting = true;
    const saveBtn = document.getElementById('cl-stock-save');
    if (saveBtn) { saveBtn.disabled = true; saveBtn.textContent = '更新中…'; }
    try {
      await gasCallWithStatus({ action: 'clothes_updateProduct', data: JSON.stringify(row) });
      saveLocal('clothes_stock', stockList);
      modal.style.display = 'none';
      showClToast('✅ 已更新');
      renderStock();
    } finally {
      isSubmitting = false;
      if (saveBtn) { saveBtn.disabled = false; saveBtn.textContent = '更新'; }
    }
  }

  async function submitOutbound() {
    if (isSubmitting) return;
    if (!outboundCart.length) return showClToast('請先加入商品');
    const modal    = document.getElementById('cl-outbound-modal');
    const ig       = modal.querySelector('#cl-ob-ig').value.trim();
    const name     = modal.querySelector('#cl-ob-name').value.trim();
    const phone    = modal.querySelector('#cl-ob-phone').value.trim();
    const address  = modal.querySelector('#cl-ob-address').value.trim();
    const shipping = modal.querySelector('#cl-ob-shipping').value;
    const bank     = modal.querySelector('#cl-ob-bank').value.trim();
    const date     = modal.querySelector('#cl-ob-date').value || today();
    const status   = modal.querySelector('#cl-ob-status').value || '待出貨';
    const editOrderId = modal.dataset.editOrderId || null;

    if (!ig || !name || !phone || !address || !bank)
      return showClToast('請填寫所有收件資料');

    const batchId = editOrderId || genId(); // 唯一批次 ID（每張訂單唯一）
    const orderId = batchId;         // B欄存唯一ID，IG帳號另存 ig 欄

    const rows = outboundCart.map(item => ({
      id: genId(), orderId, batchId, date, status,
      ig, name, phone, address, shipping, bank,
      productCode: item.productCode,
      style: item.style, size: item.size,
      cost: item.cost, price: item.price,
      qty: item.qty, subtotal: item.subtotal
    }));

    isSubmitting = true;
    const obBtn = document.getElementById('cl-ob-submit');
    if (obBtn) { obBtn.disabled = true; obBtn.textContent = '處理中…'; }
    try {
      if (editOrderId) {
        // 編輯模式：先刪 Sheet 舊資料，再移除本機舊資料
        await gasCallWithStatus({ action: 'clothes_deleteOutboundBatch', batchId: editOrderId });
        outboundList = outboundList.filter(r => (r.batchId || r.orderId || r.id) !== editOrderId);
      }
      await gasCallWithStatus({ action: 'clothes_addOutbound', data: JSON.stringify(rows) });
    } finally {
      isSubmitting = false;
      if (obBtn) { obBtn.disabled = false; obBtn.textContent = '新增訂單'; }
      modal.dataset.editOrderId = ''; // 清除編輯狀態
    }

    // 扣庫存
    rows.forEach(row => {
      const s = stockList.find(s => s.productCode === row.productCode);
      if (s) {
        s.stock = (parseInt(s.stock)||0) - row.qty;
        s.status = s.stock > 0 ? '可售' : (s.stock < 0 ? '追加' : '售完');
      }
    });
    outboundList.unshift(...rows);
    saveLocal('clothes_outbound', outboundList);
    saveLocal('clothes_stock', stockList);

    modal.style.display = 'none';
    outboundCart = [];
    showClToast('✅ 出貨完成');
    renderOutbound();
  }

  async function submitDeposit() {
    const modal = document.getElementById('cl-deposit-modal');
    const date  = modal.querySelector('#cl-dep-date').value || today();
    const ntd   = parseFloat(modal.querySelector('#cl-dep-ntd').value) || 0;
    const rate  = parseFloat(modal.querySelector('#cl-dep-rate').value) || 0;
    if (!ntd || !rate) return showClToast('請填寫金額與匯率');
    if (isSubmitting) return;
    isSubmitting = true;
    const depBtn = document.getElementById('cl-deposit-save');
    if (depBtn) { depBtn.disabled = true; depBtn.textContent = '儲存中…'; }
    const row = { id: genId(), date, ntd, rate };
    try {
      await gasCallWithStatus({ action: 'clothes_addDeposit', data: JSON.stringify(row) });
    } finally {
      isSubmitting = false;
      if (depBtn) { depBtn.disabled = false; depBtn.textContent = '儲存'; }
    }
    surplusData.deposits.unshift(row);
    saveLocal('clothes_surplus', surplusData);
    modal.style.display = 'none';
    showClToast('✅ 已記錄');
    renderSurplus();
  }

  async function submitExpense() {
    const modal    = document.getElementById('cl-expense-modal');
    const date     = modal.querySelector('#cl-exp-date').value || today();
    const product  = parseFloat(modal.querySelector('#cl-exp-product').value) || 0;
    const agency   = parseFloat(modal.querySelector('#cl-exp-agency').value) || 0;
    const shipping = parseFloat(modal.querySelector('#cl-exp-shipping').value) || 0;
    const note     = modal.querySelector('#cl-exp-note').value.trim() || '';
    const total    = product + agency + shipping;
    if (!total) return showClToast('請填寫至少一項支出');
    if (isSubmitting) return;
    isSubmitting = true;
    const expBtn = document.getElementById('cl-expense-save');
    if (expBtn) { expBtn.disabled = true; expBtn.textContent = '儲存中…'; }
    const row = { id: genId(), date, product, agency, shipping, total, note };
    try {
      await gasCallWithStatus({ action: 'clothes_addExpense', data: JSON.stringify(row) });
    } finally {
      isSubmitting = false;
      if (expBtn) { expBtn.disabled = false; expBtn.textContent = '儲存'; }
    }
    surplusData.expenses.unshift(row);
    saveLocal('clothes_surplus', surplusData);
    modal.style.display = 'none';
    showClToast('✅ 已記錄');
    renderSurplus();
  }

  // ── 自製商品下拉（仿 app.js 模式）──────────────────
  let dropdownStockList = [];
  let selectedProductCode = '';

  window.clSelectProduct = function(code, label) {
    selectedProductCode = code;
    document.getElementById('cl-ob-product').value = code;
    document.getElementById('cl-ob-search').value  = label;
    document.getElementById('cl-ob-panel').style.display = 'none';
    const item = dropdownStockList.find(s => s.productCode === code);
    if (item) {
      const priceEl = document.getElementById('cl-ob-price');
      if (priceEl && !priceEl.value && item.price) priceEl.value = item.price;
      const h = document.getElementById('cl-ob-product');
      h.dataset.style = item.style || '';
      h.dataset.size  = item.size  || '';
      h.dataset.cost  = item.cost  || 0;
      h.dataset.price = item.price || '';
      const total = parseInt(item.stock) || 0;
      h.dataset.avail = item.isSample ? Math.max(0, total - 1) : total;
    }
  };

  function clRenderDropdownList(kw) {
    const list = document.getElementById('cl-ob-list');
    if (!list) return;
    const filtered = kw
      ? dropdownStockList.filter(s =>
          (s.style || '').toLowerCase().includes(kw) ||
          (s.productCode || '').toLowerCase().includes(kw) ||
          (s.size || '').toLowerCase().includes(kw))
      : dropdownStockList;
    list.innerHTML = filtered.length
      ? filtered.map(s => {
          const total = parseInt(s.stock) || 0;
          const avail = s.isSample ? Math.max(0, total - 1) : total;
          const stockLabel = avail > 0 ? `庫存${avail}件` : (avail < 0 ? `追加${Math.abs(avail)}件` : '售完');
          const label = `${s.style || '—'} ${s.size || ''}`;
          return `<div class="cl-dropdown-item${s.productCode === selectedProductCode ? ' active' : ''}" onmousedown="clSelectProduct('${s.productCode}', '${label.replace(/'/g,"\'")}')">
            <span class="cl-dropdown-item-name">${s.style || '—'} <span style="opacity:0.55;font-weight:400;font-size:12px">${s.size || ''}</span></span>
            <span class="cl-dropdown-item-stock">${stockLabel}</span>
          </div>`;
        }).join('')
      : '<div class="cl-dropdown-empty">無符合商品</div>';
  }

  // ── 尺寸下拉切換 ──────────────────────────────────
  window.clHandleSizeSelect = function(sel) {
    const input = document.getElementById('cl-s-size');
    if (!input) return;
    if (sel.value === 'custom') {
      input.style.display = '';
      input.value = '';
      input.focus();
    } else {
      input.style.display = 'none';
      input.value = sel.value;
    }
  };

  // ── 時間篩選工具 ──────────────────────────────────
  function filterByDays(list, dateKey, days, from, to) {
    if (days === 0 && !from && !to) return list;
    const now = new Date();
    return list.filter(row => {
      const d = new Date(row[dateKey]);
      if (isNaN(d)) return true;
      if (from && to) return d >= new Date(from) && d <= new Date(to + 'T23:59:59');
      if (days > 0) {
        const cutoff = new Date(now);
        cutoff.setDate(cutoff.getDate() - days);
        return d >= cutoff;
      }
      return true;
    });
  }

  // ── 同步狀態 ─────────────────────────────────────
  let syncTimer = null;
  function setSyncStatus(state, msg) {
    const el = document.getElementById('cl-sync-status');
    if (!el) return;
    el.className = 'cl-sync-status ' + (state || '');
    el.textContent = msg || '';
    if (state === 'done' || state === 'error') {
      clearTimeout(syncTimer);
      syncTimer = setTimeout(() => {
        el.className = 'cl-sync-status';
        el.textContent = '';
      }, 2000);
    }
  }



  // ── 摺疊卡片 ─────────────────────────────────────
  window.clToggleCard = function(headerEl) {
    const card = headerEl.closest('.cl-card-collapse');
    if (!card) return;
    const body = card.querySelector('.cl-card-body');
    const chevron = headerEl.querySelector('.cl-chevron');
    const isOpen = card.classList.contains('cl-card-open');
    if (isOpen) {
      // 收合：先鎖住高度再縮回 0
      body.style.maxHeight = body.scrollHeight + 'px';
      requestAnimationFrame(() => {
        requestAnimationFrame(() => { body.style.maxHeight = '0'; });
      });
      card.classList.remove('cl-card-open');
      if (chevron) chevron.style.transform = '';
    } else {
      // 展開
      card.classList.add('cl-card-open');
      body.style.maxHeight = body.scrollHeight + 'px';
      if (chevron) chevron.style.transform = 'rotate(90deg)';
      // transition 結束後解除高度限制（允許動態內容增高）
      body.addEventListener('transitionend', function once(e) {
        if (e.propertyName !== 'max-height') return;
        if (card.classList.contains('cl-card-open')) body.style.maxHeight = 'none';
        body.removeEventListener('transitionend', once);
      });
    }
  };

    // ══════════════════════════════════════════════
  //  工具函式
  // ══════════════════════════════════════════════
  function today() {
    return new Date().toISOString().slice(0, 10);
  }
  function genId() {
    return Date.now().toString(36) + Math.random().toString(36).slice(2, 6);
  }
  function formatDate(str) {
    if (!str || str === 'undefined' || str === 'null') return '—';
    try {
      const d = new Date(str);
      if (isNaN(d.getTime())) return String(str).slice(0, 10) || '—';
      return d.toLocaleDateString('zh-TW', { month: 'numeric', day: 'numeric' });
    } catch { return String(str).slice(0, 10) || '—'; }
  }

  function formatDateTime(str) {
    if (!str || str === 'undefined' || str === 'null') return '—';
    try {
      const d = new Date(str);
      if (isNaN(d.getTime())) return String(str).slice(0, 16) || '—';
      return d.toLocaleDateString('zh-TW', { month: 'numeric', day: 'numeric' }) +
        ' ' + d.toLocaleTimeString('zh-TW', { hour: '2-digit', minute: '2-digit' });
    } catch { return String(str).slice(0, 16) || '—'; }
  }
  function saveLocal(key, data) {
    try { localStorage.setItem(key, JSON.stringify(data)); } catch {}
  }
  function showClToast(msg) {
    const t = document.getElementById('cl-toast');
    if (!t) return;
    t.textContent = msg;
    t.classList.add('show');
    setTimeout(() => t.classList.remove('show'), 2200);
  }
  function showClConfirm(msg, onConfirm) {
    const modal   = document.getElementById('cl-confirm-modal');
    const msgEl   = document.getElementById('cl-confirm-msg');
    const okBtn   = document.getElementById('cl-confirm-ok');
    const cancelBtn = document.getElementById('cl-confirm-cancel');
    if (!modal) { if (confirm(msg)) onConfirm(); return; }
    msgEl.textContent = msg;
    modal.style.display = 'flex';
    const cleanup = () => modal.style.display = 'none';
    okBtn.onclick     = () => { cleanup(); onConfirm(); };
    cancelBtn.onclick = cleanup;
  }

  // ══════════════════════════════════════════════
  //  開關服飾系統
  // ══════════════════════════════════════════════
  window.showClothesSystem = function() {
    isClothesOpen = true;
    const overlay = document.getElementById('clothes-overlay');
    if (!overlay) return;
    overlay.style.display = 'flex';
    // 關閉 workspace modal
    document.getElementById('workspace-modal').style.display = 'none';
    // 預設打開貨運核對
    switchTab('staging');
  };

  window.hideClothesSystem = function() {
    isClothesOpen = false;
    const overlay = document.getElementById('clothes-overlay');
    if (overlay) overlay.style.display = 'none';
  };

  // ══════════════════════════════════════════════
  //  事件綁定（init）
  // ══════════════════════════════════════════════
  function init() {
    // Tab 導覽
    document.querySelectorAll('.cl-nav-item').forEach(el => {
      el.addEventListener('click', () => switchTab(el.dataset.tab));
    });

    // 返回鍵
    document.getElementById('cl-back-btn')?.addEventListener('click', hideClothesSystem);

    // ── 貨運核對 ──
    document.getElementById('cl-staging-add-btn')?.addEventListener('click', () => {
      editingStaging = null;
      openStagingForm(null);
    });
    document.getElementById('cl-staging-modal-close')?.addEventListener('click', () => {
      document.getElementById('cl-staging-modal').style.display = 'none';
    });
    document.getElementById('cl-staging-save')?.addEventListener('click', submitStaging);
    ['cl-s-krw','cl-s-rate','cl-s-qty','cl-s-source'].forEach(id => {
      document.getElementById(id)?.addEventListener('input', calcStagingPreview);
    });
    document.getElementById('cl-s-source')?.addEventListener('change', calcStagingPreview);

    // ── 庫存搜尋 ──
    document.getElementById('cl-stock-search')?.addEventListener('input', () => renderStock());
    document.getElementById('cl-stock-modal-close')?.addEventListener('click', () => {
      document.getElementById('cl-stock-modal').style.display = 'none';
    });
    document.getElementById('cl-stock-save')?.addEventListener('click', submitStockEdit);

    // ── 出貨 ──
    document.getElementById('cl-outbound-add-btn')?.addEventListener('click', openOutboundForm);
    document.getElementById('cl-outbound-modal-close')?.addEventListener('click', () => {
      document.getElementById('cl-outbound-modal').style.display = 'none';
    });
    document.getElementById('cl-ob-add-item')?.addEventListener('click', clAddToCart);
    document.getElementById('cl-ob-submit')?.addEventListener('click', submitOutbound);

    // ── 自製下拉搜尋（仿 app.js 模式）──
    document.getElementById('cl-ob-search')?.addEventListener('focus', function() {
      if (!dropdownStockList.length) return;
      clRenderDropdownList(this.value.trim().toLowerCase());
      document.getElementById('cl-ob-panel').style.display = 'block';
    });
    document.getElementById('cl-ob-search')?.addEventListener('input', function() {
      if (!dropdownStockList.length) return;
      clRenderDropdownList(this.value.trim().toLowerCase());
      document.getElementById('cl-ob-panel').style.display = 'block';
      document.getElementById('cl-ob-product').value = '';
      selectedProductCode = '';
    });
    document.getElementById('cl-ob-search')?.addEventListener('blur', function() {
      setTimeout(() => {
        const panel = document.getElementById('cl-ob-panel');
        if (panel) panel.style.display = 'none';
      }, 150);
    });

    // ── 盈餘 ──
    document.getElementById('cl-deposit-btn')?.addEventListener('click', () => {
      const m = document.getElementById('cl-deposit-modal');
      if (m) { m.querySelector('#cl-dep-date').value = today(); m.style.display = 'flex'; }
    });
    document.getElementById('cl-expense-btn')?.addEventListener('click', () => {
      const m = document.getElementById('cl-expense-modal');
      if (m) { m.querySelector('#cl-exp-date').value = today(); m.style.display = 'flex'; }
    });
    document.getElementById('cl-deposit-modal-close')?.addEventListener('click', () => {
      document.getElementById('cl-deposit-modal').style.display = 'none';
    });
    document.getElementById('cl-expense-modal-close')?.addEventListener('click', () => {
      document.getElementById('cl-expense-modal').style.display = 'none';
    });
    document.getElementById('cl-deposit-save')?.addEventListener('click', submitDeposit);
    document.getElementById('cl-expense-save')?.addEventListener('click', submitExpense);

    // ── 核對單篩選 ──
    document.querySelectorAll('[data-filter]').forEach(btn => {
      btn.addEventListener('click', () => {
        document.querySelectorAll('[data-filter]').forEach(b => b.classList.remove('active'));
        btn.classList.add('active');
        stagingFilter = btn.dataset.filter;
        renderStaging();
      });
    });

    // ── 庫存篩選 ──
    document.querySelectorAll('[data-stock-filter]').forEach(btn => {
      btn.addEventListener('click', () => {
        document.querySelectorAll('[data-stock-filter]').forEach(b => b.classList.remove('active'));
        btn.classList.add('active');
        stockFilter = btn.dataset.stockFilter;
        renderStock();
      });
    });

    // ── 時間篩選通用綁定 ──
    function bindTimFilter(selector, rangeId, fromId, toId, daysVar, fromVar, toVar, renderFn) {
      document.querySelectorAll(selector).forEach(btn => {
        btn.addEventListener('click', () => {
          document.querySelectorAll(selector).forEach(b => b.classList.remove('active'));
          btn.classList.add('active');
          const days = btn.dataset.days;
          const range = document.getElementById(rangeId);
          if (days === 'custom') {
            if (range) range.style.display = 'flex';
          } else {
            if (range) range.style.display = 'none';
            if (daysVar === 'inbound')  { inboundDays  = parseInt(days); inboundFrom  = ''; inboundTo  = ''; }
            if (daysVar === 'outbound') { outboundDays = parseInt(days); outboundFrom = ''; outboundTo = ''; }
            if (daysVar === 'surplus')  { surplusDays  = parseInt(days); surplusFrom  = ''; surplusTo  = ''; }
            renderFn();
          }
        });
      });
      const fromEl = document.getElementById(fromId);
      const toEl   = document.getElementById(toId);
      if (fromEl) fromEl.addEventListener('change', e => {
        if (daysVar === 'inbound')  inboundFrom  = e.target.value;
        if (daysVar === 'outbound') outboundFrom = e.target.value;
        if (daysVar === 'surplus')  surplusFrom  = e.target.value;
        renderFn();
      });
      if (toEl) toEl.addEventListener('change', e => {
        if (daysVar === 'inbound')  inboundTo  = e.target.value;
        if (daysVar === 'outbound') outboundTo = e.target.value;
        if (daysVar === 'surplus')  surplusTo  = e.target.value;
        renderFn();
      });
    }

    bindTimFilter('#tab-inbound  [data-days]', 'cl-inbound-custom-range',  'cl-inbound-date-from',  'cl-inbound-date-to',  'inbound',  '', '', renderInbound);
    bindTimFilter('#tab-outbound [data-days]', 'cl-outbound-custom-range', 'cl-outbound-date-from', 'cl-outbound-date-to', 'outbound', '', '', renderOutbound);
    bindTimFilter('#tab-surplus  [data-days]', 'cl-surplus-custom-range',  'cl-surplus-date-from',  'cl-surplus-date-to',  'surplus',  '', '', renderSurplus);

    // 服飾管理入口
    document.getElementById('wsOpenClothesBtn')?.addEventListener('click', showClothesSystem);
  }

  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', init);
  else init();

})();
