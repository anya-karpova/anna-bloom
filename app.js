/* ANNA BLOOM — статический интернет-магазин для GitHub Pages.
 * Важно: заявки не передаются на сервер автоматически.
 * Покупатель вручную отправляет подготовленное сообщение через WhatsApp.
 */
(() => {
  'use strict';
  const PRODUCTS = window.BLOOM_PRODUCTS || [];
  const PHONE = '79518836281';
  const TELEGRAM_URL = 'https://t.me/Anya_karpova';
  const SHEETS_ENDPOINT = (() => {
    try {
      const url = new URL(String(window.BLOOM_SHEETS_ENDPOINT || '').trim());
      return url.protocol === 'https:' &&
        url.hostname === 'script.google.com' &&
        /^\/macros\/s\/[A-Za-z0-9_-]+\/exec$/.test(url.pathname) ? url.href : '';
    } catch { return ''; }
  })();
  let sendingOrder = false;
  let lastOrderId = '';
  const CART_KEY = 'anna-bloom-cart-v1';
  const FAV_KEY = 'anna-bloom-favorites-v1';
  const $ = (sel, root = document) => root.querySelector(sel);
  const $$ = (sel, root = document) => [...root.querySelectorAll(sel)];
  const price = (num) => new Intl.NumberFormat('ru-RU').format(num) + ' ₽';
  const lookup = (id) => PRODUCTS.find(p => p.id === id);
  const safeLoad = (key, fallback) => {
    try { const value = JSON.parse(localStorage.getItem(key)); return value ?? fallback; }
    catch { return fallback; }
  };
  const safeSave = (key, value) => { try { localStorage.setItem(key, JSON.stringify(value)); } catch { /* приватный режим */ } };
  const loadedCart = safeLoad(CART_KEY, {});
  const loadedFavs = safeLoad(FAV_KEY, []);
  let cart = (loadedCart && typeof loadedCart === 'object' && !Array.isArray(loadedCart)) ? loadedCart : {};
  let favorites = new Set(Array.isArray(loadedFavs) ? loadedFavs.filter(x => typeof x === 'string') : []);
  let filter = 'Все', search = '', sort = 'popular', favOnly = false;
  let currentLayer = null, privacyBackToOrder = false, orderItems = [], orderMessage = '';
  let toastTimer;

  function icon(type){ return `<svg class="ico" aria-hidden="true"><use href="#i-${type}" /></svg>`; }
  function toast(message) {
    const t = $('#toast'); t.textContent = message; t.classList.add('show');
    clearTimeout(toastTimer); toastTimer = setTimeout(() => t.classList.remove('show'), 2600);
  }
  function cleanCart() {
    Object.keys(cart).forEach(id => { const n = Number(cart[id]); if (!lookup(id) || !Number.isInteger(n) || n < 1) delete cart[id]; else cart[id] = Math.min(n, 50); });
    safeSave(CART_KEY, cart);
  }
  function cartQty(){ return Object.values(cart).reduce((sum, n) => sum + Number(n), 0); }
  function cartTotal(){ return Object.entries(cart).reduce((sum, [id, n]) => sum + (lookup(id)?.price || 0) * n, 0); }
  function updateCounters() {
    const c = cartQty(), f = [...favorites].filter(id => lookup(id)).length;
    $('#cartCount').textContent = c; $('#cartCount').hidden = !c;
    $('#favCount').textContent = f; $('#favCount').hidden = !f;
    $('#cartTitleCount').textContent = `(${c})`;
    $('#favoritesToggle').setAttribute('aria-pressed', String(favOnly));
    $('#favoritesToggle').classList.toggle('is-active', favOnly);
  }
  function cardHTML(p) {
    const selected = favorites.has(p.id);
    return `<article class="product-card">
      <button class="product-image-wrap tint-${p.tint}" data-product="${p.id}" aria-label="Посмотреть ${p.name}">
        <span class="product-tag">${p.badge}</span><img loading="lazy" src="${p.picture}" alt="Концептуальная иллюстрация: ${p.name}" />
      </button>
      <button class="product-favorite ${selected ? 'is-active' : ''}" data-fav="${p.id}" aria-label="${selected ? 'Убрать из избранного' : 'Добавить в избранное'}: ${p.name}" aria-pressed="${selected}">${icon('heart')}</button>
      <div class="product-category">${p.category}</div><button class="product-name" data-product="${p.id}">${p.name}</button>
      <div class="product-bottom"><span class="product-price"><small>от</small> ${price(p.price)}</span><button class="cart-add" data-add="${p.id}" aria-label="Добавить в корзину: ${p.name}">+</button></div>
    </article>`;
  }
  function renderProducts() {
    let result = PRODUCTS.filter(p => (filter === 'Все' || p.category === filter) && (!favOnly || favorites.has(p.id)) && (p.name + ' ' + p.category + ' ' + p.info).toLocaleLowerCase('ru').includes(search));
    if (sort === 'priceAsc') result.sort((a,b) => a.price-b.price);
    if (sort === 'priceDesc') result.sort((a,b) => b.price-a.price);
    if (sort === 'name') result.sort((a,b) => a.name.localeCompare(b.name, 'ru'));
    $('#catalogGrid').innerHTML = result.map(cardHTML).join('');
    $('#catalogEmpty').hidden = Boolean(result.length);
    $('#catalogEmpty').textContent = favOnly && !favorites.size ? 'В избранном пока пусто. Нажмите ♡ на понравившейся композиции.' : 'По Вашему запросу ничего не найдено. Попробуйте другую категорию или напишите нам — обсудим индивидуальную идею.';
    $$('.filter-pill').forEach(btn => { const active = btn.dataset.filter === filter; btn.classList.toggle('active', active); btn.setAttribute('aria-pressed', String(active)); });
    updateCounters();
  }
  function setFilter(next) {
    filter = next; favOnly = false;
    renderProducts();
    $('#catalog').scrollIntoView({behavior:'smooth', block:'start'});
  }
  function addItem(id, qty=1) {
    if (!lookup(id)) return;
    cart[id] = Math.min(50, (cart[id] || 0) + qty);
    safeSave(CART_KEY, cart); updateCounters(); renderCart(); toast('Добавлено в корзину ♡');
  }
  function changeQty(id, delta) {
    if (!lookup(id)) return;
    const next = (cart[id] || 0) + delta;
    if (next <= 0) delete cart[id]; else cart[id] = Math.min(50,next);
    safeSave(CART_KEY, cart); updateCounters(); renderCart();
  }
  function toggleFav(id) {
    if (!lookup(id)) return;
    favorites.has(id) ? favorites.delete(id) : favorites.add(id);
    safeSave(FAV_KEY,[...favorites]); renderProducts();
    if (currentLayer === 'product') { const btn = $('#productModal [data-fav]'); if (btn) { btn.classList.toggle('is-active',favorites.has(id)); btn.textContent = favorites.has(id) ? '♥ В избранном' : '♡ В избранное'; }}
  }
  function renderCart() {
    const list = Object.entries(cart).map(([id,qty]) => ({product:lookup(id),qty})).filter(r=>r.product);
    if (!list.length) {
      $('#cartItems').innerHTML = `<div class="empty-cart"><div class="flower-emoji">✿</div><h3>Пока ни одного цветка</h3><p>Добавьте понравившиеся композиции из каталога. Их можно будет обсудить в одной заявке.</p><button class="btn btn-outline" id="cartBrowse">В каталог ↗</button></div>`;
      $('#cartFooter').innerHTML = '';
      return;
    }
    $('#cartItems').innerHTML = list.map(({product:p,qty}) => `<div class="cart-row"><div class="cart-row-image"><img src="${p.picture}" alt="" /></div><div class="cart-row-main"><div class="cart-row-name">${p.name}</div><div class="cart-row-price">от ${price(p.price)}</div><div class="cart-row-actions"><div class="qty-control"><button data-qty="-1" data-id="${p.id}" aria-label="Уменьшить количество">−</button><span>${qty}</span><button data-qty="1" data-id="${p.id}" aria-label="Увеличить количество">+</button></div><button class="remove-item" data-remove="${p.id}">Убрать</button></div></div></div>`).join('');
    $('#cartFooter').innerHTML = `<div class="drawer-summary"><span>Предварительная сумма</span><strong>от ${price(cartTotal())}</strong></div><p class="drawer-note">Итоговая стоимость, условия изготовления и доставки — после согласования. На сайте нет онлайн-оплаты.</p><button id="checkoutCart" class="btn btn-dark">Оформить заявку <span>↗</span></button>`;
  }
  const layerEls = {cart:$('#cartDrawer'),product:$('#productModal'),order:$('#orderModal'),privacy:$('#privacyModal')};
  function closeLayer() {
    if (!currentLayer) return;
    const last = layerEls[currentLayer];
    last.classList.remove('open'); last.setAttribute('aria-hidden','true');
    $('#overlay').classList.remove('show'); $('#overlay').hidden = true;
    document.body.classList.remove('modal-open'); currentLayer = null;
  }
  function openLayer(name) {
    closeLayer();
    currentLayer = name;
    $('#overlay').hidden = false;
    requestAnimationFrame(() => $('#overlay').classList.add('show'));
    layerEls[name].setAttribute('aria-hidden','false');
    layerEls[name].classList.add('open');
    document.body.classList.add('modal-open');
    if (name === 'cart') renderCart();
  }
  function openProduct(id) {
    const p = lookup(id); if(!p)return;
    $('#productModalContent').innerHTML = `<div class="product-modal-layout"><div class="product-modal-image"><img src="${p.picture}" alt="Концептуальная иллюстрация: ${p.name}" /></div><div class="product-modal-info"><span class="section-kicker">${p.category}</span><h2>${p.name}</h2><div class="modal-price"><span>от</span> ${price(p.price)}</div><p>${p.info}</p><ul class="detail-list">${p.details.map(x=>`<li>${x}</li>`).join('')}</ul><div class="modal-actions"><button class="btn btn-dark" data-add="${p.id}">В корзину <span>+</span></button><button class="btn btn-outline" data-single-order="${p.id}">Заказать ↗</button></div><button class="text-link" data-fav="${p.id}">${favorites.has(p.id)?'♥ В избранном':'♡ В избранное'}</button><div class="modal-price-notice">* Иллюстрация и цена — пример. Детали и итоговую стоимость уточняем при обращении.</div></div></div>`;
    openLayer('product');
  }
  function openOrder(products = []) {
    orderItems = products.filter(row=>lookup(row.id) && row.qty > 0).map(row=>({id:row.id,qty:Math.min(50,row.qty)}));
    $('#orderForm').reset(); $('#formError').hidden = true;
    $('#orderFormView').hidden = false; $('#orderSuccess').hidden = true;
    const selection = orderItems.map(row=>`• ${lookup(row.id).name} — ${row.qty} шт.`);
    $('#orderSelection').textContent = selection.length ? 'Вы выбрали:\n' + selection.join('\n') : 'Индивидуальная композиция / свободная идея';
    $('#orderForm [name="date"]').min = new Date(Date.now()-new Date().getTimezoneOffset()*60000).toISOString().slice(0,10);
    openLayer('order');
    setTimeout(() => $('#orderForm [name="name"]')?.focus(),200);
  }
  function orderRowsFromCart() { return Object.entries(cart).map(([id,qty])=>({id,qty})); }
  function formatPhone(raw) {
    let digits = raw.replace(/\D/g,'');
    if (digits.length === 10) digits = '7'+digits;
    if (digits.length === 11 && digits[0] === '8') digits = '7'+digits.slice(1);
    return digits.length === 11 && digits[0] === '7' ? '+'+digits : null;
  }
  function buildMessage(data, id) {
    const lines = [`Здравствуйте! Хочу уточнить цветочную инсталляцию в Воронеже.`, `Заявка: ${id}`, `Имя: ${data.name}`, `Телефон: ${data.phone}`];
    if (orderItems.length) lines.push('Интересуют композиции:',...orderItems.map(row=>`— ${lookup(row.id).name} × ${row.qty} (ориентир от ${price(lookup(row.id).price*row.qty)})`));
    else lines.push('Интересует индивидуальная композиция / оформление.');
    if (data.date) lines.push('Дата события: '+data.date);
    if (data.place) lines.push('Место: '+data.place);
    if (data.message) lines.push('Пожелания: '+data.message);
    lines.push('Прошу сообщить возможность изготовления и итоговую стоимость.');
    return lines.join('\n');
  }
  function newOrderId() {
    const date = new Date().toISOString().slice(0,10).replaceAll('-', '');
    const charset = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789';
    const bytes = new Uint8Array(10);
    if (window.crypto && window.crypto.getRandomValues) window.crypto.getRandomValues(bytes);
    else for (let i=0;i<bytes.length;i++) bytes[i]=Math.floor(Math.random()*256);
    const suffix = [...bytes].map(b=>charset[b % charset.length]).join('');
    return 'AB-' + date + '-' + suffix;
  }

  function checkSheetStatus(id) {
    return new Promise(resolve => {
      const callbackName = 'bloomAck_' + newOrderId().replace(/[^A-Z0-9]/g,'');
      let finished = false;
      const el = document.createElement('script');
      const finish = value => {
        if (finished) return;
        finished = true;
        clearTimeout(timer);
        el.remove();
        try { delete window[callbackName]; } catch { window[callbackName] = undefined; }
        resolve(Boolean(value));
      };
      window[callbackName] = data => finish(data && data.saved === true);
      el.onerror = () => finish(false);
      el.src = SHEETS_ENDPOINT + '?id=' + encodeURIComponent(id) + '&callback=' +
        encodeURIComponent(callbackName) + '&t=' + Date.now();
      const timer = setTimeout(() => finish(false), 6000);
      document.head.appendChild(el);
    });
  }

  function showOrderResult(id, mode) {
    $('#orderId').textContent = '№ ' + id;
    $('#sendOrderWhatsapp').href = 'https://wa.me/' + PHONE + '?text=' + encodeURIComponent(orderMessage);
    const title = $('#orderSuccess h2');
    const note = $('#orderSuccess > p');
    const label = $('#orderSuccess .section-kicker');
    if (mode === 'saved') {
      label.textContent = 'ЗАЯВКА ПОЛУЧЕНА';
      title.innerHTML = 'Спасибо за <em>заявку!</em>';
      note.textContent = 'Заявка сохранена. Мы свяжемся с Вами по указанному номеру, чтобы обсудить детали. При желании Вы можете также написать в WhatsApp.';
    } else if (mode === 'unconfirmed') {
      label.textContent = 'НУЖНО ПОДТВЕРЖДЕНИЕ';
      title.innerHTML = 'Проверим <em>заявку?</em>';
      note.textContent = 'Не удалось подтвердить запись в таблицу. Заявка могла поступить. Для надёжности отправьте подготовленное сообщение в WhatsApp.';
    } else {
      label.textContent = 'ВСЁ ГОТОВО';
      title.innerHTML = 'Осталось только <em>отправить.</em>';
      note.textContent = 'Сообщение сформировано. Нажмите «Открыть WhatsApp» и отправьте его в чате. Без этого шага заявка не поступит.';
    }
    $('#orderFormView').hidden = true;
    $('#orderSuccess').hidden = false;
    $('#orderModal').scrollTop = 0;
  }

  async function submitOrder(event) {
    event.preventDefault();
    if (sendingOrder) return;
    const form = event.currentTarget;
    const name = form.elements.name.value.trim();
    const phone = formatPhone(form.elements.phone.value);
    const date = form.elements.date.value;
    const place = form.elements.place.value.trim();
    const message = form.elements.message.value.trim();
    const consent = form.elements.consent.checked;
    const err = $('#formError');
    let error = '';
    if (name.length < 2) error = 'Укажите, пожалуйста, Ваше имя (не менее двух символов).';
    else if (!phone) error = 'Укажите телефон РФ из 10 цифр или в формате +7 (999) 000-00-00.';
    else if (date && date < form.elements.date.min) error = 'Дата события не может быть в прошлом.';
    else if (!consent) error = 'Для подготовки заявки необходимо согласие на обработку данных.';
    if (error) { err.textContent = error; err.hidden = false; return; }
    err.hidden = true;
    const id = newOrderId();
    lastOrderId = id;
    orderMessage = buildMessage({name,phone,date,place,message}, id);
    if (!SHEETS_ENDPOINT) {
      showOrderResult(id, 'whatsapp');
      return;
    }
    const payload = {
      id, name, phone, eventDate: date, place, message, consent: true,
      website: form.elements.website ? form.elements.website.value : '',
      items: orderItems.map(row => ({
        name: lookup(row.id).name, qty: row.qty
      })),
      estimatedTotal: orderItems.reduce((sum, row) => sum + lookup(row.id).price * row.qty, 0)
    };
    const btn = $('#orderForm .form-submit');
    const originalLabel = btn.innerHTML;
    sendingOrder = true;
    btn.disabled = true;
    btn.textContent = 'Отправляем заявку…';
    try {
      const controller = new AbortController();
      const timer = setTimeout(() => controller.abort(), 15000);
      try {
        await fetch(SHEETS_ENDPOINT, {
          method: 'POST', mode: 'no-cors',
          headers: {'Content-Type': 'text/plain;charset=utf-8'},
          body: JSON.stringify(payload),
          signal: controller.signal
        });
      } finally { clearTimeout(timer); }
      // Google Apps Script's cross-origin response is opaque; verify saving separately.
      let saved = false;
      for (let retry=0; retry<3 && !saved; retry++) {
        if (retry) await new Promise(r => setTimeout(r, 1100));
        saved = await checkSheetStatus(id);
      }
      showOrderResult(id, saved ? 'saved' : 'unconfirmed');
    } catch {
      showOrderResult(id, 'unconfirmed');
    } finally {
      sendingOrder = false;
      btn.disabled = false;
      btn.innerHTML = originalLabel;
    }
  }
  function openPrivacy(fromOrder=false) { privacyBackToOrder = fromOrder; openLayer('privacy'); }
  function closePrivacy() { const goBack = privacyBackToOrder; privacyBackToOrder = false; closeLayer(); if (goBack) openLayer('order'); }

  if (SHEETS_ENDPOINT) {
    $('#orderFormView .modal-lead').textContent = 'Заполните форму, и мы получим Вашу заявку. Затем свяжемся с Вами для уточнения стоимости и деталей.';
    $('#orderForm .form-submit').innerHTML = 'Отправить заявку <span>↗</span>';
    $('#orderForm .form-hint').textContent = 'Предварительная заявка без оплаты. Ваши данные будут переданы для обработки заказа.';
  }
  cleanCart();
  $('#currentYear').textContent = String(new Date().getFullYear());
  renderProducts(); renderCart();
  document.addEventListener('click', (event) => {
    const target = event.target;
    const add = target.closest('[data-add]');
    if (add) { addItem(add.dataset.add); return; }
    const product = target.closest('[data-product]');
    if (product) { openProduct(product.dataset.product); return; }
    const fav = target.closest('[data-fav]');
    if (fav) { toggleFav(fav.dataset.fav); return; }
    const single = target.closest('[data-single-order]');
    if (single) { openOrder([{id:single.dataset.singleOrder,qty:1}]); return; }
    const custom = target.closest('[data-order-custom]');
    if (custom) { openOrder([]); return; }
    const filterBtn = target.closest('[data-filter]');
    if (filterBtn) { setFilter(filterBtn.dataset.filter); return; }
    const category = target.closest('[data-category]');
    if (category) { setFilter(category.dataset.category); return; }
    const qty = target.closest('[data-qty]');
    if (qty) { changeQty(qty.dataset.id,Number(qty.dataset.qty)); return; }
    const remove = target.closest('[data-remove]');
    if (remove) { delete cart[remove.dataset.remove]; safeSave(CART_KEY,cart); updateCounters(); renderCart(); return; }
    if (target.closest('#cartBrowse')) { closeLayer(); $('#catalog').scrollIntoView({behavior:'smooth'}); return; }
    if (target.closest('#checkoutCart')) { openOrder(orderRowsFromCart()); return; }
    if (target.closest('#privacyFromForm')) { openPrivacy(true); return; }
  });
  $('#cartToggle').addEventListener('click',()=>openLayer('cart'));
  $('#closeCart').addEventListener('click',closeLayer);
  $('#closeProduct').addEventListener('click',closeLayer);
  $('#closeOrder').addEventListener('click',closeLayer);
  $('#privacyOpen').addEventListener('click',()=>openPrivacy(false));
  $('#closePrivacy').addEventListener('click',closePrivacy);
  $('#overlay').addEventListener('click',() => currentLayer==='privacy' ? closePrivacy(): closeLayer());
  document.addEventListener('keydown',e=>{ if(e.key==='Escape'&&currentLayer){currentLayer==='privacy'?closePrivacy():closeLayer();} });
  $('#menuToggle').addEventListener('click',e=>{const menu=$('#mainNav');const next=!menu.classList.contains('open');menu.classList.toggle('open',next);e.currentTarget.setAttribute('aria-expanded',String(next));});
  $$('.main-nav a').forEach(a=>a.addEventListener('click',()=>{$('#mainNav').classList.remove('open');$('#menuToggle').setAttribute('aria-expanded','false');}));
  $('#searchToggle').addEventListener('click',()=>{$('#catalog').scrollIntoView({behavior:'smooth'});setTimeout(()=>$('#catalogSearch').focus(),300);});
  $('#favoritesToggle').addEventListener('click',()=>{favOnly=!favOnly;filter='Все';renderProducts();$('#catalog').scrollIntoView({behavior:'smooth'});toast(favOnly?'Показываем избранные композиции':'Показываем все композиции');});
  $('#catalogSearch').addEventListener('input',e=>{search=e.target.value.trim().toLocaleLowerCase('ru');renderProducts();});
  $('#catalogSort').addEventListener('change',e=>{sort=e.target.value;renderProducts();});
  $('#orderForm').addEventListener('submit',submitOrder);
  $('#copyOrder').addEventListener('click',async()=>{
    try { await navigator.clipboard.writeText(orderMessage);toast('Заявка скопирована'); }
    catch { const t=document.createElement('textarea');t.value=orderMessage;t.style.position='fixed';t.style.top='-9999px';document.body.append(t);t.select();const ok=document.execCommand('copy');t.remove();toast(ok?'Заявка скопирована':'Не удалось скопировать текст'); }
  });
  // Нажатие на #... в меню не раскрывает и не сохраняет персональные данные.
})();
