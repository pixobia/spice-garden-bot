(function () {
  "use strict";
  const tg = window.Telegram && window.Telegram.WebApp;
  if (tg) tg.ready();

  const state = {
    boot: "loading", // 'loading' | 'ready' | 'error'
    bootError: null,
    customer: null,
    menu: [],
    cartOrderId: null,
    cartItems: [], // [{ itemId, quantity, priceAtTime }]
    view: "menu", // 'menu' | 'cart'
    search: "",
    openCategories: new Set(),
    placing: false,
    deliveryFee: 0,
    sync: {
      pending: new Map(), // itemId -> latest qty
      timer: null,
      inFlight: 0,
    },
  };

  const fmt = (rupees) => "₹" + rupees.toLocaleString("en-IN");

  const qtyFor = (itemId) =>
    state.cartItems.find((x) => x.itemId === itemId)?.quantity || 0;
  const cartCount = () => state.cartItems.reduce((s, x) => s + x.quantity, 0);
  const subtotal = () =>
    state.cartItems.reduce((s, x) => s + x.quantity * x.priceAtTime, 0);
  const deliveryFee = () =>
    state.cartItems.length > 0 ? state.deliveryFee : 0;
  const total = () => subtotal() + deliveryFee();

  let itemIndex = new Map();
  const findItem = (id) => itemIndex.get(id) || null;
  function rebuildItemIndex() {
    itemIndex = new Map();
    for (const cat of state.menu)
      for (const it of cat.items) itemIndex.set(it.id, it);
  }

  function matchesSearch(item) {
    const q = state.search.trim().toLowerCase();
    if (!q) return true;
    return item.name.toLowerCase().includes(q);
  }

  function setView(v) {
    state.view = v;
    render();
  }
  function setSearch(text) {
    state.search = text;
    render();
  }
  function toggleCategory(n) {
    if (state.openCategories.has(n)) state.openCategories.delete(n);
    else state.openCategories.add(n);
    render();
  }

  function setQty(itemId, qty) {
    qty = Math.max(0, Math.min(99, Math.floor(qty)));
    const item = findItem(itemId);
    if (!item) return;

    const idx = state.cartItems.findIndex((x) => x.itemId === itemId);
    if (qty === 0) {
      if (idx !== -1) state.cartItems.splice(idx, 1);
    } else if (idx === -1) {
      state.cartItems.push({ itemId, quantity: qty, priceAtTime: item.price });
    } else {
      state.cartItems[idx] = { ...state.cartItems[idx], quantity: qty };
    }

    scheduleSync(itemId, qty);
    if (tg) tg.HapticFeedback?.impactOccurred?.("light");
    render();
  }
  const incQty = (id) => setQty(id, qtyFor(id) + 1);
  const decQty = (id) => setQty(id, qtyFor(id) - 1);

  // Fire-and-forget: never replay server responses into local state — a stale
  // response could clobber a newer tap.
  function scheduleSync(itemId, qty) {
    state.sync.pending.set(itemId, qty);
    if (state.sync.timer) clearTimeout(state.sync.timer);
    state.sync.timer = setTimeout(flushSync, 300);
  }

  async function flushSync() {
    state.sync.timer = null;
    const updates = [...state.sync.pending.entries()];
    state.sync.pending.clear();
    if (updates.length === 0) return;

    state.sync.inFlight += updates.length;
    try {
      await Promise.all(
        updates.map(([itemId, qty]) =>
          api.setQty(state.cartOrderId, itemId, qty).catch((err) => {
            console.error("Sync failed", { itemId, qty, err });
            if (tg) tg.HapticFeedback?.notificationOccurred?.("error");
          })
        )
      );
    } finally {
      state.sync.inFlight = Math.max(0, state.sync.inFlight - updates.length);
    }
  }

  async function flushSyncAndWait() {
    if (state.sync.timer) clearTimeout(state.sync.timer);
    state.sync.timer = null;
    if (state.sync.pending.size > 0) await flushSync();
    while (state.sync.inFlight > 0) await new Promise((r) => setTimeout(r, 25));
  }

  async function placeOrder() {
    if (state.placing) return;
    state.placing = true;
    render();

    try {
      await flushSyncAndWait();
      const result = await api.placeOrder(state.cartOrderId);
      console.log("Place order:", result);
      if (tg) {
        tg.HapticFeedback?.notificationOccurred?.("success");
        tg.close();
      } else {
        alert(
          "Order processed (" + result.status + "). Check your Telegram chat."
        );
      }
    } catch (err) {
      console.error("Place order failed:", err);
      state.placing = false;
      render();
      if (tg) tg.HapticFeedback?.notificationOccurred?.("error");
      alert("Could not place order. " + (err.message || ""));
    }
  }

  const el = {
    loading: document.getElementById("loading"),
    app: document.getElementById("app"),
    error: document.getElementById("error"),
    backBtn: document.getElementById("back-btn"),
    title: document.getElementById("hd-title"),
    viewMenu: document.getElementById("view-menu"),
    viewCart: document.getElementById("view-cart"),
    categories: document.getElementById("categories"),
    cartList: document.getElementById("cart-list"),
    cartEmpty: document.getElementById("cart-empty"),
    cartTotals: document.getElementById("cart-totals"),
    tSub: document.getElementById("t-sub"),
    tDel: document.getElementById("t-del"),
    tTot: document.getElementById("t-tot"),
    cta: document.getElementById("cta"),
    search: document.getElementById("search"),
  };

  function render() {
    if (state.boot === "loading") {
      show(el.loading);
      hide(el.app);
      hide(el.error);
      return;
    }
    if (state.boot === "error") {
      hide(el.loading);
      hide(el.app);
      el.error.textContent =
        "Failed to load. " + (state.bootError || "Please try again.");
      show(el.error);
      return;
    }

    hide(el.loading);
    hide(el.error);
    show(el.app);

    if (state.view === "menu") {
      show(el.viewMenu);
      hide(el.viewCart);
      el.title.textContent = "Menu — Crust & Fuel";
      hide(el.backBtn);
      renderMenuList();
    } else {
      hide(el.viewMenu);
      show(el.viewCart);
      el.title.textContent = "Your cart  ·  " + cartCount() + " items";
      show(el.backBtn);
      renderCartList();
    }
    renderCta();
  }

  const show = (e) => e.classList.remove("hidden");
  const hide = (e) => e.classList.add("hidden");

  function renderMenuList() {
    if (el.search.value !== state.search) el.search.value = state.search;
    const scrollTop = el.viewMenu.scrollTop;

    el.categories.innerHTML = "";
    const isSearching = !!state.search.trim();

    let anyMatched = false;
    state.menu.forEach((cat) => {
      const matched = cat.items.filter(matchesSearch);
      if (isSearching && matched.length === 0) return;
      anyMatched = true;

      const wrap = document.createElement("div");
      wrap.className = "cat";
      wrap.dataset.open =
        isSearching || state.openCategories.has(cat.name) ? "true" : "false";

      const hd = document.createElement("div");
      hd.className = "cat-hd";
      hd.innerHTML =
        '<span class="chev">›</span>' +
        '<span class="cat-name"></span>' +
        '<span class="cat-count"></span>';
      hd.querySelector(".cat-name").textContent = cat.name;
      hd.querySelector(".cat-count").textContent =
        (isSearching ? matched.length : cat.count) + " items";
      hd.addEventListener("click", () => toggleCategory(cat.name));
      wrap.appendChild(hd);

      const items = document.createElement("div");
      items.className = "cat-items";
      matched.forEach((it) => items.appendChild(renderMenuItem(it)));
      wrap.appendChild(items);

      el.categories.appendChild(wrap);
    });

    if (isSearching && !anyMatched) {
      const empty = document.createElement("div");
      empty.className = "empty";
      empty.textContent = 'No items match "' + state.search + '".';
      el.categories.appendChild(empty);
    }

    el.viewMenu.scrollTop = scrollTop;
  }

  function renderMenuItem(it) {
    const row = document.createElement("div");
    row.className = "mi";

    const thumb = document.createElement("img");
    thumb.className = "thumb";
    thumb.src =
      it.imageUrl || "https://placehold.co/100x100/e5e7eb/6b7280?text=Item";
    thumb.alt = "";
    thumb.loading = "lazy";
    row.appendChild(thumb);

    const info = document.createElement("div");
    info.className = "info";
    const nm = document.createElement("div");
    nm.className = "nm";
    nm.textContent = it.name;
    const pr = document.createElement("div");
    pr.className = "pr";
    pr.textContent = fmt(it.price);
    info.appendChild(nm);
    info.appendChild(pr);
    row.appendChild(info);

    if (qtyFor(it.id) === 0) {
      const add = document.createElement("button");
      add.className = "add";
      add.textContent = "Add";
      add.addEventListener("click", () => incQty(it.id));
      row.appendChild(add);
    } else {
      row.appendChild(buildStepper(it.id));
    }
    return row;
  }

  function buildStepper(itemId) {
    const q = document.createElement("div");
    q.className = "qty";
    const minus = document.createElement("button");
    minus.textContent = "−";
    const num = document.createElement("span");
    num.className = "num";
    num.textContent = qtyFor(itemId);
    const plus = document.createElement("button");
    plus.textContent = "+";
    q.appendChild(minus);
    q.appendChild(num);
    q.appendChild(plus);
    minus.addEventListener("click", () => decQty(itemId));
    plus.addEventListener("click", () => incQty(itemId));
    return q;
  }

  function renderCartList() {
    el.cartList.innerHTML = "";
    if (state.cartItems.length === 0) {
      show(el.cartEmpty);
      hide(el.cartTotals);
      return;
    }
    hide(el.cartEmpty);
    show(el.cartTotals);

    state.cartItems.forEach((line) => {
      const item = findItem(line.itemId) || {
        name: "Item #" + line.itemId,
        imageUrl: "",
        price: line.priceAtTime,
      };

      const row = document.createElement("div");
      row.className = "cart-row";

      const thumb = document.createElement("img");
      thumb.className = "thumb";
      thumb.src =
        item.imageUrl || "https://placehold.co/100x100/e5e7eb/6b7280?text=Item";
      thumb.alt = "";
      row.appendChild(thumb);

      const info = document.createElement("div");
      info.className = "info";
      const nm = document.createElement("div");
      nm.className = "nm";
      nm.textContent = item.name;
      const pr = document.createElement("div");
      pr.className = "pr";
      pr.textContent =
        fmt(line.priceAtTime) +
        " each  ·  " +
        fmt(line.priceAtTime * line.quantity);
      info.appendChild(nm);
      info.appendChild(pr);
      row.appendChild(info);

      row.appendChild(buildStepper(line.itemId));
      el.cartList.appendChild(row);
    });

    el.tSub.textContent = fmt(subtotal());
    el.tDel.textContent = deliveryFee() === 0 ? "Free" : fmt(deliveryFee());
    el.tTot.textContent = fmt(total());
  }

  function renderCta() {
    if (state.placing) {
      el.cta.disabled = true;
      el.cta.textContent = "Placing order...";
      return;
    }
    const c = cartCount();
    if (state.view === "menu") {
      el.cta.textContent = "View cart";
      el.cta.disabled = c === 0;
    } else {
      el.cta.textContent =
        c === 0 ? "Cart is empty" : "Place order  ·  " + fmt(total());
      el.cta.disabled = c === 0;
    }
  }

  async function boot() {
    try {
      const data = await api.init();
      state.customer = data.customer;
      state.menu = data.menu;
      state.cartOrderId = data.cart.id;
      state.cartItems = Array.isArray(data.cart.items) ? data.cart.items : [];
      state.deliveryFee = data.deliveryFee ?? 0;
      rebuildItemIndex();
      if (state.menu.length > 0) state.openCategories.add(state.menu[0].name);
      state.boot = "ready";
    } catch (err) {
      console.error("Boot failed:", err);
      state.boot = "error";
      state.bootError = err.message;
    }
    render();

    el.backBtn.addEventListener("click", () => setView("menu"));
    el.cta.addEventListener("click", () => {
      if (state.view === "menu") setView("cart");
      else placeOrder();
    });
    el.search.addEventListener("input", (e) => setSearch(e.target.value));

    // Flush on tab close so the last tap isn't lost.
    window.addEventListener("pagehide", () => {
      flushSync();
    });

    if (tg) tg.expand();
  }

  boot();
})();
