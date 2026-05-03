// REST client for the Mini App.
// Sends Telegram initData on every request as `Authorization: tma <initData>`.
// Server middleware verifies the HMAC against the bot token.

(function (global) {
  function authHeader() {
    const initData =
      (global.Telegram && global.Telegram.WebApp && global.Telegram.WebApp.initData) || '';
    return { Authorization: 'tma ' + initData };
  }

  async function request(method, path, body) {
    const res = await fetch(path, {
      method,
      headers: {
        'Content-Type': 'application/json',
        ...authHeader(),
      },
      body: body !== undefined ? JSON.stringify(body) : undefined,
    });
    if (!res.ok) {
      const text = await res.text();
      throw new Error(`API ${res.status}: ${text}`);
    }
    return res.json();
  }

  global.api = {
    init:        ()                       => request('GET',    '/api/miniapp/init'),
    setQty:      (orderId, itemId, qty)   => request('POST',   `/api/orders/${orderId}/items`, { itemId, quantity: qty }),
    placeOrder:  (orderId)                => request('POST',   `/api/orders/${orderId}/place`),
    getCart:     (orderId)                => request('GET',    `/api/orders/${orderId}`),
  };
})(window);
