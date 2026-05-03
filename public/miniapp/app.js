(function () {
  const tg = window.Telegram && window.Telegram.WebApp;
  if (tg) tg.ready();

  const fmtINR = (paise) => '₹' + (paise / 100).toLocaleString('en-IN');

  // ─── State ───────────────────────────────────────────────────────────────
  const state = {
    customer: null,
    menu: [],
    cart: { id: null, items: [], subtotal: 0, deliveryFee: 0, total: 0 },
    view: 'menu', // 'menu' | 'cart'
    search: '',
    pendingSync: new Map(), // itemId -> latest qty (debounced)
    syncTimer: null,
  };

  // ─── DOM refs ────────────────────────────────────────────────────────────
  const el = {
    loading: document.getElementById('loading'),
    app: document.getElementById('app'),
    error: document.getElementById('error'),
    backBtn: document.getElementById('back-btn'),
    title: document.getElementById('hd-title'),
    viewMenu: document.getElementById('view-menu'),
    viewCart: document.getElementById('view-cart'),
    categories: document.getElementById('categories'),
    cartList: document.getElementById('cart-list'),
    cartEmpty: document.getElementById('cart-empty'),
    cartTotals: document.getElementById('cart-totals'),
    tSub: document.getElementById('t-sub'),
    tDel: document.getElementById('t-del'),
    tTot: document.getElementById('t-tot'),
    cta: document.getElementById('cta'),
    search: document.getElementById('search'),
  };

  // ─── Helpers ─────────────────────────────────────────────────────────────
  const cartCount = () => state.cart.items.reduce((s, it) => s + it.quantity, 0);
  const qtyForItem = (itemId) => {
    const found = state.cart.items.find((i) => i.itemId === itemId);
    return found ? found.quantity : 0;
  };

  function showError(msg) {
    el.loading.classList.add('hidden');
    el.app.classList.add('hidden');
    el.error.textContent = msg;
    el.error.classList.remove('hidden');
  }

  // Debounced sync of quantity changes to the server.
  function scheduleSync(itemId, qty) {
    state.pendingSync.set(itemId, qty);
    if (state.syncTimer) clearTimeout(state.syncTimer);
    state.syncTimer = setTimeout(flushSync, 300);
  }
  async function flushSync() {
    const updates = [...state.pendingSync.entries()];
    state.pendingSync.clear();
    state.syncTimer = null;
    for (const [itemId, qty] of updates) {
      try {
        const updated = await api.setQty(state.cart.id, itemId, qty);
        state.cart.items = updated.items;
        state.cart.subtotal = updated.subtotal;
        state.cart.deliveryFee = updated.deliveryFee;
        state.cart.total = updated.total;
        renderCta();
        if (state.view === 'cart') renderCart();
      } catch (err) {
        console.error('sync failed', err);
        if (tg) tg.HapticFeedback?.notificationOccurred?.('error');
      }
    }
  }

  // ─── Local cart mutations (optimistic) ───────────────────────────────────
  function changeQty(itemId, delta, basePrice) {
    const cur = qtyForItem(itemId);
    const next = Math.max(0, cur + delta);
    if (next === cur) return;

    if (cur === 0 && next > 0) {
      state.cart.items.push({ itemId, quantity: next, priceAtTime: basePrice });
    } else if (next === 0) {
      state.cart.items = state.cart.items.filter((i) => i.itemId !== itemId);
    } else {
      const it = state.cart.items.find((i) => i.itemId === itemId);
      if (it) it.quantity = next;
    }

    // Recompute totals locally for snappy UI; server is source of truth on sync.
    const subtotal = state.cart.items.reduce((s, it) => s + it.quantity * it.priceAtTime, 0);
    state.cart.subtotal = subtotal;
    state.cart.deliveryFee = state.cart.items.length > 0 ? 4000 : 0;
    state.cart.total = subtotal + state.cart.deliveryFee;

    scheduleSync(itemId, next);
    if (tg) tg.HapticFeedback?.impactOccurred?.('light');
  }

  // ─── Rendering ───────────────────────────────────────────────────────────
  function matchesSearch(item) {
    if (!state.search) return true;
    return item.name.toLowerCase().includes(state.search.toLowerCase());
  }

  function renderMenu() {
    el.categories.innerHTML = '';
    const q = state.search.trim();

    state.menu.forEach((cat, idx) => {
      const matchedItems = cat.items.filter(matchesSearch);
      if (q && matchedItems.length === 0) return; // hide categories with no hits

      const wrap = document.createElement('div');
      wrap.className = 'cat';
      // Open first category by default, or all categories during a search
      wrap.dataset.open = q ? 'true' : (idx === 0 ? 'true' : 'false');

      const hd = document.createElement('div');
      hd.className = 'cat-hd';
      hd.innerHTML =
        '<span class="chev">›</span>' +
        '<span class="cat-name"></span>' +
        '<span class="cat-count"></span>';
      hd.querySelector('.cat-name').textContent = cat.name;
      hd.querySelector('.cat-count').textContent = (q ? matchedItems.length : cat.count) + ' items';
      hd.addEventListener('click', () => {
        wrap.dataset.open = wrap.dataset.open === 'true' ? 'false' : 'true';
      });
      wrap.appendChild(hd);

      const items = document.createElement('div');
      items.className = 'cat-items';
      matchedItems.forEach((it) => items.appendChild(renderMenuItem(it)));
      wrap.appendChild(items);

      el.categories.appendChild(wrap);
    });

    if (q && el.categories.children.length === 0) {
      const empty = document.createElement('div');
      empty.className = 'empty';
      empty.textContent = 'No items match "' + q + '".';
      el.categories.appendChild(empty);
    }
  }

  function renderMenuItem(it) {
    const row = document.createElement('div');
    row.className = 'mi';

    const thumb = document.createElement('img');
    thumb.className = 'thumb';
    thumb.src = it.imageUrl || 'https://placehold.co/100x100/e5e7eb/6b7280?text=Item';
    thumb.alt = '';
    thumb.loading = 'lazy';
    row.appendChild(thumb);

    const info = document.createElement('div');
    info.className = 'info';
    const nm = document.createElement('div'); nm.className = 'nm'; nm.textContent = it.name;
    const pr = document.createElement('div'); pr.className = 'pr'; pr.textContent = fmtINR(it.price);
    info.appendChild(nm); info.appendChild(pr);
    row.appendChild(info);

    const qty = qtyForItem(it.id);
    if (qty === 0) {
      const add = document.createElement('button');
      add.className = 'add';
      add.textContent = 'Add';
      add.addEventListener('click', () => {
        changeQty(it.id, 1, it.price);
        renderMenu();
        renderCta();
      });
      row.appendChild(add);
    } else {
      row.appendChild(buildQtyStepper(it, () => {
        renderMenu();
        renderCta();
      }));
    }
    return row;
  }

  function buildQtyStepper(item, onChange) {
    const q = document.createElement('div');
    q.className = 'qty';
    const minus = document.createElement('button'); minus.textContent = '−';
    const num = document.createElement('span'); num.className = 'num'; num.textContent = qtyForItem(item.id);
    const plus = document.createElement('button'); plus.textContent = '+';
    q.appendChild(minus); q.appendChild(num); q.appendChild(plus);
    minus.addEventListener('click', () => { changeQty(item.id, -1, item.price); onChange(); });
    plus.addEventListener('click',  () => { changeQty(item.id,  1, item.price); onChange(); });
    return q;
  }

  function renderCart() {
    el.cartList.innerHTML = '';
    if (state.cart.items.length === 0) {
      el.cartEmpty.classList.remove('hidden');
      el.cartTotals.classList.add('hidden');
      return;
    }
    el.cartEmpty.classList.add('hidden');
    el.cartTotals.classList.remove('hidden');

    // Build a lookup of menu items for thumbnail/name.
    const byId = new Map();
    for (const cat of state.menu) for (const it of cat.items) byId.set(it.id, it);

    state.cart.items.forEach((line) => {
      const item = byId.get(line.itemId) || { name: 'Item #' + line.itemId, imageUrl: '', price: line.priceAtTime };
      const row = document.createElement('div');
      row.className = 'cart-row';

      const thumb = document.createElement('img');
      thumb.className = 'thumb';
      thumb.src = item.imageUrl || 'https://placehold.co/100x100/e5e7eb/6b7280?text=Item';
      thumb.alt = '';
      row.appendChild(thumb);

      const info = document.createElement('div');
      info.className = 'info';
      info.style.flex = '1'; info.style.minWidth = '0';
      info.innerHTML = '<div class="nm"></div><div class="pr"></div>';
      info.querySelector('.nm').textContent = item.name;
      info.querySelector('.nm').style.fontSize = '13px';
      info.querySelector('.nm').style.fontWeight = '500';
      info.querySelector('.pr').textContent =
        fmtINR(line.priceAtTime) + ' each  ·  ' + fmtINR(line.priceAtTime * line.quantity);
      row.appendChild(info);

      row.appendChild(buildQtyStepper({ id: line.itemId, price: line.priceAtTime }, () => {
        renderCart();
        renderCta();
      }));

      el.cartList.appendChild(row);
    });

    el.tSub.textContent = fmtINR(state.cart.subtotal);
    el.tDel.textContent = fmtINR(state.cart.deliveryFee);
    el.tTot.textContent = fmtINR(state.cart.total);
  }

  function renderCta() {
    const count = cartCount();
    if (state.view === 'menu') {
      el.cta.textContent = 'View cart';
      el.cta.disabled = count === 0;
    } else {
      el.cta.textContent = count === 0 ? 'Cart is empty' : 'Place order  ·  ' + fmtINR(state.cart.total);
      el.cta.disabled = count === 0;
    }
  }

  function setView(view) {
    state.view = view;
    if (view === 'menu') {
      el.viewMenu.classList.remove('hidden');
      el.viewCart.classList.add('hidden');
      el.title.textContent = 'Menu — Spice Garden';
      el.backBtn.classList.add('hidden');
    } else {
      el.viewMenu.classList.add('hidden');
      el.viewCart.classList.remove('hidden');
      el.title.textContent = 'Your cart  ·  ' + cartCount() + ' items';
      el.backBtn.classList.remove('hidden');
      renderCart();
    }
    renderCta();
  }

  // ─── Actions ─────────────────────────────────────────────────────────────
  async function placeOrder() {
    el.cta.disabled = true;
    el.cta.textContent = 'Placing order...';

    // Make sure pending sync changes have flushed.
    if (state.syncTimer) {
      clearTimeout(state.syncTimer);
      await flushSync();
    }

    try {
      // Tell the bot the user wants to place this order. The bot will
      // run the details confirm flow; if details are missing it'll start
      // the wizard. The actual status flip to AWAITING_PAYMENT happens
      // when the user taps "Confirm and pay" in chat.
      const payload = JSON.stringify({ intent: 'place_order', orderId: state.cart.id });
      if (tg) {
        tg.sendData(payload);
      } else {
        alert('Telegram WebApp unavailable. Payload: ' + payload);
      }
    } catch (err) {
      console.error(err);
      el.cta.disabled = false;
      el.cta.textContent = 'Place order';
    }
  }

  // ─── Boot ────────────────────────────────────────────────────────────────
  async function boot() {
    try {
      const data = await api.init();
      state.customer = data.customer;
      state.menu = data.menu;
      state.cart = data.cart;
      el.loading.classList.add('hidden');
      el.app.classList.remove('hidden');

      renderMenu();
      setView('menu');

      el.backBtn.addEventListener('click', () => setView('menu'));
      el.cta.addEventListener('click', () => {
        if (state.view === 'menu') setView('cart');
        else placeOrder();
      });
      el.search.addEventListener('input', (e) => {
        state.search = e.target.value;
        renderMenu();
      });

      // Apply Telegram theme params (best-effort; CSS uses fallbacks too).
      if (tg) tg.expand();
    } catch (err) {
      console.error(err);
      showError('Failed to load. ' + (err.message || 'Please try again.'));
    }
  }

  boot();
})();
