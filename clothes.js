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
  let isClothesOpen = false;

  // ── GAS 通訊 ─────────────────────────────────
  function getGasUrl() {
    try { return localStorage.getItem('acs_gs_url') || ''; } catch { return ''; }
  }

  async function gasCall(params) {
    const url = getGasUrl();
    if (!url) return null;
    try {
      const qs = Object.entries(params)
        .map(([k, v]) => `${encodeURIComponent(k)}=${encodeURIComponent(String(v))}`)
        .join('&');
      const res = await fetch(`${url}?${qs}`);
      return await res.json();
    } catch { return null; }
  }

  // ── 資料載入 ──────────────────────────────────
  async function loadStaging() {
    const res = await gasCall({ action: 'clothes_getStagingList' });
    if (res?.success) stagingList = res.data || [];
    else stagingList = JSON.parse(localStorage.getItem('clothes_staging') || '[]');
    renderStaging();
  }

  async function loadInbound() {
    const res = await gasCall({ action: 'clothes_getInbound' });
    if (res?.success) inboundList = res.data || [];
    else inboundList = JSON.parse(localStorage.getItem('clothes_inbound') || '[]');
    renderInbound();
  }

  async function loadStock() {
    const res = await gasCall({ action: 'clothes_getStock' });
    if (res?.success) stockList = res.data || [];
    else stockList = JSON.parse(localStorage.getItem('clothes_stock') || '[]');
    renderStock();
  }

  async function loadOutbound() {
    const res = await gasCall({ action: 'clothes_getOutbound' });
    if (res?.success) outboundList = res.data || [];
    else outboundList = JSON.parse(localStorage.getItem('clothes_outbound') || '[]');
    renderOutbound();
  }

  async function loadSurplus() {
    const res = await gasCall({ action: 'clothes_getSurplus' });
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
      el.style.display = el.dataset.page === tab ? 'flex' : 'none';
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

    // 依狀態分組顯示
    const groups = { '待入庫': [], '已入庫': [], '廠商退款': [] };
    stagingList.forEach(row => { (groups[row.status] || groups['待入庫']).push(row); });

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
      const res = await gasCall({ action: 'clothes_voidStaging', id });
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

      const res = await gasCall({
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
    modal.querySelector('#cl-s-size').value   = f.size || '';
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
    let html = '';
    inboundList.forEach(row => {
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
      const stock = parseInt(row.stock) || 0;
      const statusClass = stock > 0 ? 'cl-badge-done' : 'cl-badge-empty';
      const statusLabel = row.isSample ? '樣品' : (stock > 0 ? '可售' : '售完');
      html += `
      <div class="cl-card cl-card-collapse">
        <div class="cl-card-header cl-card-toggle" onclick="clToggleCard(this)">
          <div class="cl-card-toggle-left">
            <div class="cl-card-title">${row.style || '—'} <span class="cl-size-tag">${row.size || ''}</span></div>
            <div class="cl-card-sub">${row.productCode || '—'}</div>
          </div>
          <div class="cl-card-toggle-right">
            <span class="cl-card-summary">${stock} 件</span>
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
            <span>庫存數量</span><span>${stock} 件</span>
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
    modal.querySelector('#cl-st-sample').checked = !!row.isSample;
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

    // 依訂單編號分組
    const orders = {};
    outboundList.forEach(row => {
      const key = row.orderId || row.id;
      if (!orders[key]) orders[key] = { orderId: row.orderId || '—', date: row.date, items: [], status: row.status };
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
            <div class="cl-card-title">訂單 ${order.orderId}</div>
            <div class="cl-card-sub">${formatDate(order.date)}</div>
          </div>
          <div class="cl-card-toggle-right">
            <span class="cl-card-summary">NT$ ${total.toLocaleString(undefined,{maximumFractionDigits:0})}</span>
            <span class="cl-badge ${statusClass}">${order.status || '已出貨'}</span>
            <span class="cl-chevron">›</span>
          </div>
        </div>
        <div class="cl-card-body">
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
            <button class="cl-btn cl-btn-primary" onclick="clMarkOutboundDone('${order.orderId}')">標記為已出貨</button>
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
    const modal = document.getElementById('cl-outbound-modal');
    if (!modal) return;
    modal.querySelector('#cl-ob-order').value  = '';
    modal.querySelector('#cl-ob-date').value   = today();
    modal.querySelector('#cl-ob-status').value = '已出貨';
    renderOutboundCart();

    // 先確保庫存已載入
    const sel = modal.querySelector('#cl-ob-product');
    if (sel) {
      sel.innerHTML = `<option value="">載入中…</option>`;
      modal.style.display = 'flex';

      // 每次都重新拉最新庫存，確保即時反映入庫/出貨
      const freshRes = await gasCall({ action: 'clothes_getStock' });
      if (freshRes?.success) {
        stockList = freshRes.data || [];
        saveLocal('clothes_stock', stockList);
      } else {
        // GAS 失敗 fallback 本機快取
        if (!stockList.length) stockList = JSON.parse(localStorage.getItem('clothes_stock') || '[]');
      }

      const available = stockList.filter(s => parseInt(s.stock) > 0 && !s.isSample);
      if (available.length) {
        sel.innerHTML = `<option value="">選擇商品</option>` +
          available.map(s => `<option value="${s.productCode}" data-style="${s.style}" data-size="${s.size}" data-cost="${s.cost}" data-price="${s.price||''}">${s.style} ${s.size}（庫存${s.stock}件）</option>`).join('');
      } else {
        sel.innerHTML = `<option value="">目前無可售庫存</option>`;
      }
    } else {
      modal.style.display = 'flex';
    }
  }

  window.clMarkOutboundDone = function(orderId) {
    showClConfirm('確定標記為已出貨？', async () => {
      // 更新本機
      outboundList.forEach(row => {
        if ((row.orderId || row.id) === orderId) row.status = '已出貨';
      });
      saveLocal('clothes_outbound', outboundList);
      // 同步 GAS
      await gasCall({ action: 'clothes_updateOutboundStatus', orderId, status: '已出貨' });
      showClToast('✅ 已標記為已出貨');
      renderOutbound();
    });
  };

    window.clAddToCart = function() {
    const modal = document.getElementById('cl-outbound-modal');
    const sel   = modal.querySelector('#cl-ob-product');
    const qty   = parseInt(modal.querySelector('#cl-ob-qty').value) || 1;
    const price = parseFloat(modal.querySelector('#cl-ob-price').value) || 0;
    if (!sel.value) return showClToast('請選擇商品');
    const opt  = sel.options[sel.selectedIndex];
    outboundCart.push({
      productCode: sel.value,
      style: opt.dataset.style,
      size: opt.dataset.size,
      cost: parseFloat(opt.dataset.cost) || 0,
      price,
      qty,
      subtotal: price * qty
    });
    modal.querySelector('#cl-ob-product').value = '';
    modal.querySelector('#cl-ob-qty').value = '1';
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
    const deps  = surplusData.deposits  || [];
    const exps  = surplusData.expenses  || [];

    const totalDeposit  = deps.reduce((s, d) => s + (parseFloat(d.ntd) || 0), 0);
    const totalExpense  = exps.reduce((s, e) => s + (parseFloat(e.total) || 0), 0);
    const balance       = totalDeposit - totalExpense;

    const balEl = document.getElementById('cl-surplus-balance');
    if (balEl) {
      balEl.textContent = `NT$ ${balance.toLocaleString(undefined,{maximumFractionDigits:0})}`;
      balEl.className   = 'cl-surplus-balance ' + (balance >= 0 ? 'cl-balance-pos' : 'cl-balance-neg');
    }
    const depEl = document.getElementById('cl-surplus-deposit-total');
    const expEl = document.getElementById('cl-surplus-expense-total');
    if (depEl) depEl.textContent = `NT$ ${totalDeposit.toLocaleString(undefined,{maximumFractionDigits:0})}`;
    if (expEl) expEl.textContent = `NT$ ${totalExpense.toLocaleString(undefined,{maximumFractionDigits:0})}`;

    // 入金列表
    const depList = document.getElementById('cl-deposit-list');
    if (depList) {
      depList.innerHTML = !deps.length ? '<div class="cl-empty-small">尚無入金紀錄</div>' :
        deps.map(d => `
        <div class="cl-surplus-row">
          <span class="cl-surplus-date">${formatDate(d.date)}</span>
          <span>NT$ ${(parseFloat(d.ntd)||0).toLocaleString()}</span>
          <span class="cl-surplus-rate">匯率 ${d.rate}</span>
          <span class="cl-surplus-krw">₩${Math.round((d.ntd||0)*(d.rate||1)).toLocaleString()}</span>
        </div>`).join('');
    }

    // 支出列表
    const expList = document.getElementById('cl-expense-list');
    if (expList) {
      expList.innerHTML = !exps.length ? '<div class="cl-empty-small">尚無支出紀錄</div>' :
        exps.map(e => `
        <div class="cl-surplus-row">
          <span class="cl-surplus-date">${formatDate(e.date)}</span>
          <span class="cl-surplus-label">${e.note || '支出'}</span>
          <span>商品 ${(e.product||0).toLocaleString()}</span>
          <span>代購 ${(e.agency||0).toLocaleString()}</span>
          <span>運費 ${(e.shipping||0).toLocaleString()}</span>
          <span class="cl-surplus-total">= NT$ ${(parseFloat(e.total)||0).toLocaleString()}</span>
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
      await gasCall({ action: 'clothes_addStaging', data: JSON.stringify(row) });
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
    const modal = document.getElementById('cl-stock-modal');
    const code  = modal?.dataset.code;
    if (!code) return;
    const row   = stockList.find(s => s.productCode === code);
    if (!row) return;
    row.price    = parseFloat(modal.querySelector('#cl-st-price').value) || '';
    row.isSample = modal.querySelector('#cl-st-sample').checked;
    row.status   = modal.querySelector('#cl-st-status').value;
    await gasCall({ action: 'clothes_updateProduct', data: JSON.stringify(row) });
    saveLocal('clothes_stock', stockList);
    modal.style.display = 'none';
    showClToast('✅ 已更新');
    renderStock();
  }

  async function submitOutbound() {
    if (isSubmitting) return;
    if (!outboundCart.length) return showClToast('請先加入商品');
    const modal    = document.getElementById('cl-outbound-modal');
    const orderId  = modal.querySelector('#cl-ob-order').value.trim() || genId().slice(0,8);
    const date     = modal.querySelector('#cl-ob-date').value || today();
    const status   = modal.querySelector('#cl-ob-status').value || '已出貨';

    const rows = outboundCart.map(item => ({
      id: genId(), orderId, date, status,
      productCode: item.productCode,
      style: item.style, size: item.size,
      cost: item.cost, price: item.price,
      qty: item.qty, subtotal: item.subtotal
    }));

    isSubmitting = true;
    const obBtn = document.getElementById('cl-ob-submit');
    if (obBtn) { obBtn.disabled = true; obBtn.textContent = '處理中…'; }
    try {
      await gasCall({ action: 'clothes_addOutbound', data: JSON.stringify(rows) });
    } finally {
      isSubmitting = false;
      if (obBtn) { obBtn.disabled = false; obBtn.textContent = '確認出貨'; }
    }

    // 扣庫存
    rows.forEach(row => {
      const s = stockList.find(s => s.productCode === row.productCode);
      if (s) {
        s.stock = Math.max(0, (parseInt(s.stock)||0) - row.qty);
        s.status = s.stock > 0 ? '可售' : '售完';
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
      await gasCall({ action: 'clothes_addDeposit', data: JSON.stringify(row) });
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
      await gasCall({ action: 'clothes_addExpense', data: JSON.stringify(row) });
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

  // ── 摺疊卡片 ─────────────────────────────────────
  window.clToggleCard = function(headerEl) {
    const card = headerEl.closest('.cl-card-collapse');
    if (!card) return;
    const body = card.querySelector('.cl-card-body');
    const chevron = headerEl.querySelector('.cl-chevron');
    const isOpen = card.classList.contains('cl-card-open');
    if (isOpen) {
      body.style.maxHeight = body.scrollHeight + 'px';
      requestAnimationFrame(() => { body.style.maxHeight = '0'; });
      card.classList.remove('cl-card-open');
      if (chevron) chevron.style.transform = '';
    } else {
      body.style.maxHeight = '0';
      card.classList.add('cl-card-open');
      body.style.maxHeight = body.scrollHeight + 'px';
      if (chevron) chevron.style.transform = 'rotate(90deg)';
      // 動畫結束後移除 maxHeight 限制，避免動態內容被截斷
      body.addEventListener('transitionend', function once() {
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

    // 服飾管理入口
    document.getElementById('wsOpenClothesBtn')?.addEventListener('click', showClothesSystem);
  }

  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', init);
  else init();

})();      // 每次開新增出貨都重新拉最新庫存
      const res = await gasCall({ action: 'clothes_getStock' });
      if (res?.success) {
        stockList = res.data || [];
        saveLocal('clothes_stock', stockList);
      } else {
        if (!stockList.length) stockList = JSON.parse(localStorage.getItem('clothes_stock') || '[]');
      }
