/* ============================================================================
   CHỢ TRỜI ROACHUP — script.js
   Toàn bộ logic được điều khiển bởi config.json, không hardcode số liệu.
   Đã tích hợp Google Sheet & Apps Script API làm trung gian đồng bộ Cloud.
   ============================================================================ */

   (() => {
    'use strict';
  
    /* ==========================================================
       0. STATE DÙNG CHUNG
       ========================================================== */
    const state = {
      config: null,          // nội dung config.json sau khi load
      currency: { poop: 0, cheese: 0 },
      roaches: [],           // danh sách con gián đang sống trên màn hình
      currentPageId: 'menu',
      navOpen: false,
      lastFrameTime: 0,
    };
  
    const els = {}; // cache các phần tử DOM hay dùng, gán trong initDom()
  
    /* ==========================================================
       1. GOOGLE SHEET & API BRIDGE
       ========================================================== */
  
    // ⚠️ THAY URL GOOGLE APPS SCRIPT CỦA BẠN VÀO CÁC BIẾN DƯỚI ĐÂY:
    const GOOGLE_API_URL = "https://script.google.com/macros/s/AKfycbzv1QLZoAtHPQL__3UvAoP42yAltlSIqDR4C2KHphF47tJcy9OhSJFkEGSGGh6LMtjR/exec";
    const ANALYTICS_API = "hhttps://script.google.com/macros/s/AKfycbzf1FSl9tWsqaYasvjejLrRgN6YS_mc3n-TszTT0KgfJSV4xDkuc0MFa2O_v-d2EWzM/exec";
    
    let playerId = new URLSearchParams(window.location.search).get('id');
  
    const SheetAPIBridge = {
      async getInitialCurrency() {
        if (!playerId) {
          console.warn("[API] Không tìm thấy player_id trên URL! Ví dụ URL đúng: ?id=abc123");
          return null;
        }
  
        try {
          const response = await fetch(`${GOOGLE_API_URL}?action=get&player_id=${playerId}`);
          const data = await response.json();
  
          if (data.status === "success") {
            console.log("[API] Tải dữ liệu thành công:", data);
            return {
              poop: Number(data.poop),
              cheese: Number(data.cheese)
            };
          } else {
            console.warn("[API] Người chơi chưa có dữ liệu trên Sheet.");
            return null;
          }
        } catch (error) {
          console.error("[API] Lỗi kết nối Google Sheet:", error);
          return null;
        }
      },
  
      async saveCurrencyToSheet(poop, cheese) {
        if (!playerId) {
          return false;
        }
  
        try {
          const response = await fetch(GOOGLE_API_URL, {
            method: "POST",
            headers: { "Content-Type": "text/plain;charset=utf-8" },
            body: JSON.stringify({
              player_id: playerId,
              poop: poop,
              cheese: cheese
            })
          });
  
          const result = await response.json();
          console.log("[API] Cập nhật Sheet thành công:", result);
          return true;
        } catch (error) {
          console.error("[API] Lỗi khi lưu lên Sheet:", error);
          return false;
        }
      },
  
      async onCurrencyChanged(poop, cheese) {
        console.log(`[Shop] Số dư mới: ${poop} Cức | ${cheese} Phô mai. Đang lưu lên Cloud...`);
        await this.saveCurrencyToSheet(poop, cheese);
      },
  
      async onPurchase(groupId, price, currentPoop, currentCheese) {},
  
      async onExchange(price, newRoachIds, currentPoop, currentCheese) {}
    };
  
    /* ==========================================================
       2. LOAD CONFIG
       ========================================================== */
    async function loadConfig() {
      try {
        const res = await fetch('config.json', { cache: 'no-store' });
        if (!res.ok) throw new Error('Không đọc được config.json');
        return await res.json();
      } catch (err) {
        console.error('[RoachUp] Lỗi load config.json:', err);
        return null;
      }
    }
  
    /* ==========================================================
       3. CURRENCY
       ========================================================== */
    function setCurrency(poop, cheese) {
      state.currency.poop = Math.max(0, Math.round(poop));
      state.currency.cheese = Math.max(0, Math.round(cheese));
      renderCurrency();
      SheetAPIBridge.onCurrencyChanged(state.currency.poop, state.currency.cheese);
    }
  
    function addCurrency(deltaPoop, deltaCheese) {
      setCurrency(state.currency.poop + deltaPoop, state.currency.cheese + deltaCheese);
    }
  
    function canAfford(price) {
      return state.currency.poop >= (price.poop || 0) && state.currency.cheese >= (price.cheese || 0);
    }
  
    function renderCurrency() {
      const cfg = state.config.currency;
      els.poopValue.textContent = state.currency.poop;
      els.cheeseValue.textContent = state.currency.cheese;
      els.poopIcon.textContent = cfg.poopIcon;
      els.cheeseIcon.textContent = cfg.cheeseIcon;
    }
  
    /* ==========================================================
       4. PAGE NAVIGATION
       ========================================================== */
    const PAGE_ORDER = ['menu', 'play', 'donate'];
  
    function goToPage(targetId) {
      if (targetId === state.currentPageId) { closeNav(); return; }
      const oldEl = els.pages[state.currentPageId];
      const newEl = els.pages[targetId];
      if (!oldEl || !newEl) return;
  
      const forward = PAGE_ORDER.indexOf(targetId) > PAGE_ORDER.indexOf(state.currentPageId);
      const enterFrom = forward ? '56px' : '-56px';
      const exitTo = forward ? '-56px' : '56px';
  
      newEl.style.transition = 'none';
      newEl.style.transform = `translate3d(${enterFrom}, 0, 0) scale(0.98)`;
      newEl.style.opacity = '0';
      newEl.classList.add('is-active');
      void newEl.offsetWidth;
  
      requestAnimationFrame(() => {
        newEl.style.transition = '';
        newEl.style.transform = 'translate3d(0,0,0) scale(1)';
        newEl.style.opacity = '1';
      });
  
      oldEl.style.transform = `translate3d(${exitTo}, 0, 0) scale(0.98)`;
      oldEl.style.opacity = '0';
  
      window.setTimeout(() => {
        oldEl.classList.remove('is-active');
        oldEl.style.transition = '';
        oldEl.style.transform = '';
        oldEl.style.opacity = '';
      }, 620);
  
      state.currentPageId = targetId;
      closeNav();
    }
  
    /* ==========================================================
       5. FLOATING NAV
       ========================================================== */
    function toggleNav() {
      state.navOpen = !state.navOpen;
      els.floatingLogo.classList.toggle('is-open', state.navOpen);
      els.floatingNav.classList.toggle('is-open', state.navOpen);
    }
    function closeNav() {
      state.navOpen = false;
      els.floatingLogo.classList.remove('is-open');
      els.floatingNav.classList.remove('is-open');
    }
  
    /* ==========================================================
       6. ROACH ENGINE
       ========================================================== */
  
    function weightedPickGroup(groups) {
      const total = groups.reduce((sum, g) => sum + Math.max(0, g.chance), 0);
      let roll = Math.random() * total;
      for (const g of groups) {
        roll -= Math.max(0, g.chance);
        if (roll <= 0) return g;
      }
      return groups[groups.length - 1];
    }
  
    function randRange(min, max) {
      return min + Math.random() * (max - min);
    }
  
    function spawnRoaches() {
      els.roachField.querySelectorAll('.roach').forEach(el => el.remove());
      state.roaches = [];
  
      const rc = state.config.roach;
      const groups = state.config.groups;
      const count = Math.round(randRange(rc.countMin, rc.countMax));
      const fieldRect = els.roachField.getBoundingClientRect();
  
      for (let i = 0; i < count; i++) {
        const group = weightedPickGroup(groups);
        const size = randRange(rc.sizeMin, rc.sizeMax);
        const speed = randRange(rc.speedMin, rc.speedMax);
        const angle = Math.random() * Math.PI * 2;
  
        const roachEl = document.createElement('div');
        roachEl.className = 'roach';
        roachEl.style.width = `${size}px`;
  
        const img = document.createElement('img');
        img.src = group.image;
        img.alt = group.title;
        img.style.cursor = 'pointer';
        img.onerror = () => { img.style.display = 'none'; };
        
        img.addEventListener('click', (e) => {
          e.stopPropagation();
          openBuyPopup(group);
          analyticsItem(group);
        });
        
        roachEl.appendChild(img);
        const label = document.createElement('button');
        label.className = 'roach-label';
        label.style.fontSize = `${Math.max(9, size * rc.labelScale * 0.22)}px`;
        label.textContent = group.title;
        label.addEventListener('click', (e) => {
          e.stopPropagation();
          openBuyPopup(group);
          analyticsItem(group);
        });
        roachEl.appendChild(label);
  
        els.roachField.appendChild(roachEl);
  
        const roach = {
          el: roachEl,
          img,
          group,
          size,
          x: randRange(0, Math.max(1, fieldRect.width - size)),
          y: randRange(0, Math.max(1, fieldRect.height - size)),
          vx: Math.cos(angle) * speed,
          vy: Math.sin(angle) * speed,
          facing: 1,
        };
        state.roaches.push(roach);
        applyRoachTransform(roach);
      }
    }
  
    function applyRoachTransform(roach) {
      roach.el.style.transform = `translate3d(${roach.x}px, ${roach.y}px, 0)`;
      roach.img.style.transform = roach.facing < 0 ? 'scaleX(-1)' : 'scaleX(1)';
    }
  
    let fieldBounds = { width: 0, height: 0 };
    function refreshFieldBounds() {
      const rect = els.roachField.getBoundingClientRect();
      fieldBounds.width = rect.width;
      fieldBounds.height = rect.height;
    }
  
    function stepRoaches(dt) {
      for (const roach of state.roaches) {
        const maxX = Math.max(1, fieldBounds.width - roach.size);
        const maxY = Math.max(1, fieldBounds.height - roach.size * 0.75);
  
        roach.x += roach.vx * dt;
        roach.y += roach.vy * dt;
  
        if (roach.x <= 0) { roach.x = 0; roach.vx = Math.abs(roach.vx); }
        else if (roach.x >= maxX) { roach.x = maxX; roach.vx = -Math.abs(roach.vx); }
  
        if (roach.y <= 0) { roach.y = 0; roach.vy = Math.abs(roach.vy); }
        else if (roach.y >= maxY) { roach.y = maxY; roach.vy = -Math.abs(roach.vy); }
  
        roach.facing = roach.vx >= 0 ? 1 : -1;
        applyRoachTransform(roach);
      }
    }
  
    function animationLoop(timestamp) {
      if (!state.lastFrameTime) state.lastFrameTime = timestamp;
      let dt = (timestamp - state.lastFrameTime) / 1000;
      dt = Math.min(dt, 0.05);
      state.lastFrameTime = timestamp;
  
      if (state.currentPageId === 'play') {
        stepRoaches(dt);
      }
      requestAnimationFrame(animationLoop);
    }
  
    /* ==========================================================
       7. ĐỔI GIÁN
       ========================================================== */
    function tryExchangeRoach() {
      const price = state.config.exchange.price;
      if (!canAfford(price)) {
        els.exchangeBtn.animate(
          [{ transform: 'translateX(0)' }, { transform: 'translateX(-6px)' },
           { transform: 'translateX(6px)' }, { transform: 'translateX(0)' }],
          { duration: 280, easing: 'ease-out' }
        );
        return;
      }
      addCurrency(-(price.poop || 0), -(price.cheese || 0));
      spawnRoaches();
      SheetAPIBridge.onExchange(price, state.roaches.map(r => r.group.id));
    }
  
    /* ==========================================================
       8. MOMENTUM SCROLL
       ========================================================== */
    function attachMomentumScroll(el) {
      let isDragging = false;
      let startY = 0, startScroll = 0;
      let lastY = 0, lastTime = 0, velocity = 0;
      let rafId = null;
  
      function stopMomentum() {
        if (rafId) cancelAnimationFrame(rafId);
        rafId = null;
      }
  
      function onPointerDown(e) {
        if (e.pointerType === 'touch') return;
        isDragging = true;
        stopMomentum();
        startY = lastY = e.clientY;
        startScroll = el.scrollTop;
        lastTime = performance.now();
        el.setPointerCapture(e.pointerId);
      }
      function onPointerMove(e) {
        if (!isDragging) return;
        const now = performance.now();
        const dy = e.clientY - lastY;
        const dt = Math.max(1, now - lastTime);
        velocity = dy / dt;
        el.scrollTop -= dy;
        lastY = e.clientY;
        lastTime = now;
      }
      function onPointerUp() {
        if (!isDragging) return;
        isDragging = false;
        let v = velocity * 16;
        function momentumStep() {
          v *= 0.94;
          el.scrollTop -= v;
          if (Math.abs(v) > 0.5) {
            rafId = requestAnimationFrame(momentumStep);
          }
        }
        rafId = requestAnimationFrame(momentumStep);
      }
  
      el.addEventListener('pointerdown', onPointerDown);
      el.addEventListener('pointermove', onPointerMove);
      el.addEventListener('pointerup', onPointerUp);
      el.addEventListener('pointerleave', onPointerUp);
    }
  
    /* ==========================================================
       9. POPUPS
       ========================================================== */
    const THEME_PREFIX = 'theme-';
  
    function setTheme(el, themeName) {
      el.className = el.className.split(' ').filter(c => !c.startsWith(THEME_PREFIX)).join(' ').trim();
      if (themeName) el.classList.add(THEME_PREFIX + themeName);
    }
  
    function openOverlay(overlayEl) {
      overlayEl.classList.add('is-open');
    }
    function closeOverlay(overlayEl) {
      overlayEl.classList.remove('is-open');
    }
  
    function openBuyPopup(group) {
      const p = group.popup_buy;
      els.buyImage.src = p.image;
      els.buyTitle.textContent = p.title;
      els.buyDesc.textContent = p.description;
      els.buyClose.textContent = '✕';
      els.buyBtnLabel.textContent = p.button && p.button.title ? p.button.title : 'Mua';
      els.buyPoopPrice.textContent = `${state.config.currency.poopIcon} ${group.price.poop || 0}`;
      els.buyCheesePrice.textContent = `${state.config.currency.cheeseIcon} ${group.price.cheese || 0}`;
      setTheme(els.buyPopup, p.theme);
  
      const hasUrl = !!(p.button && p.button.url);
      const affordable = canAfford(group.price);
      els.buyBtn.classList.toggle('is-disabled', !hasUrl && !affordable);
  
      els.buyBtn.onclick = () => {
        if (hasUrl) {
          // Mở link Shopee trước để không bị trình duyệt chặn Popup
          window.open(p.button.url, '_blank', 'noopener');
          // Gửi thông kê về Google Sheet ở chế độ chạy ngầm
          analyticsBuy(group);
          return;
        }
        if (!canAfford(group.price)) return;
        addCurrency(-(group.price.poop || 0), -(group.price.cheese || 0));
        SheetAPIBridge.onPurchase(group.id, group.price);
  
        if (group.specialFunction && window.RoachSpecialFunctions && window.RoachSpecialFunctions[group.specialFunction]) {
          window.RoachSpecialFunctions[group.specialFunction](group);
        }
  
        closeOverlay(els.buyOverlay);
        openThanksPopup(group);
      };
  
      openOverlay(els.buyOverlay);
    }
  
    function openThanksPopup(group) {
      const p = group.popup_thanks;
      els.thanksImage.src = p.image;
      els.thanksCaption.textContent = p.caption;
      setTheme(els.thanksPopup, p.theme);
      openOverlay(els.thanksOverlay);
    }
  
    /* ==========================================================
       10. ANALYTICS & SPECIAL FUNCTIONS
       ========================================================== */
    window.RoachSpecialFunctions = {
      mystery_box(group) {
        console.log('[RoachUp] specialFunction chưa được lập trình:', group.specialFunction);
      },
    };
  
    // Hàm gửi tín hiệu click vào vật phẩm
    function analyticsItem(group) {
      fetch(ANALYTICS_API, {
        method: "POST",
        headers: { "Content-Type": "text/plain;charset=utf-8" },
        body: JSON.stringify({
          action: "clickItem",
          id: group.id,
          title: group.popup_buy.title
        })
      }).catch(err => console.error("Analytics Error:", err));
    }
  
    // Hàm gửi tín hiệu click nút Mua
    function analyticsBuy(group) {
      fetch(ANALYTICS_API, {
        method: "POST",
        headers: { "Content-Type": "text/plain;charset=utf-8" },
        body: JSON.stringify({
          action: "clickBuy",
          id: group.id,
          title: group.popup_buy.title
        })
      }).catch(err => console.error("Analytics Error:", err));
    }
  
    /* ==========================================================
       11. INIT
       ========================================================== */
    function cacheDom() {
      els.pages = {
        menu: document.getElementById('page-menu'),
        play: document.getElementById('page-play'),
        donate: document.getElementById('page-donate'),
      };
      els.floatingLogo = document.getElementById('floating-logo');
      els.floatingNav = document.getElementById('floating-nav');
  
      els.poopValue = document.getElementById('poop-value');
      els.cheeseValue = document.getElementById('cheese-value');
      els.poopIcon = document.getElementById('poop-icon');
      els.cheeseIcon = document.getElementById('cheese-icon');
  
      els.roachField = document.getElementById('roach-field');
      els.exchangeBtn = document.getElementById('exchange-btn');
      els.exchangeLabel = document.getElementById('exchange-label');
  
      els.buyOverlay = document.getElementById('buy-overlay');
      els.buyPopup = document.getElementById('buy-popup');
      els.buyImage = document.getElementById('buy-image');
      els.buyTitle = document.getElementById('buy-title');
      els.buyDesc = document.getElementById('buy-desc');
      els.buyClose = document.getElementById('buy-close');
      els.buyBtn = document.getElementById('buy-btn');
      els.buyBtnLabel = document.getElementById('buy-btn-label');
      els.buyPoopPrice = document.getElementById('buy-poop-price');
      els.buyCheesePrice = document.getElementById('buy-cheese-price');
  
      els.thanksOverlay = document.getElementById('thanks-overlay');
      els.thanksPopup = document.getElementById('thanks-popup');
      els.thanksImage = document.getElementById('thanks-image');
      els.thanksCaption = document.getElementById('thanks-caption');
      els.thanksClose = document.getElementById('thanks-close');
    }
  
    function bindEvents() {
      els.floatingLogo.addEventListener('click', toggleNav);
      document.querySelectorAll('[data-goto]').forEach(btn => {
        btn.addEventListener('click', () => goToPage(btn.dataset.goto));
      });
  
      els.exchangeBtn.addEventListener('click', tryExchangeRoach);
  
      els.buyClose.addEventListener('click', () => closeOverlay(els.buyOverlay));
      els.buyOverlay.addEventListener('click', (e) => {
        if (e.target === els.buyOverlay) closeOverlay(els.buyOverlay);
      });
  
      els.thanksClose.addEventListener('click', () => closeOverlay(els.thanksOverlay));
      els.thanksOverlay.addEventListener('click', (e) => {
        if (e.target === els.thanksOverlay) closeOverlay(els.thanksOverlay);
      });
  
      attachMomentumScroll(els.buyDesc.parentElement);
  
      window.addEventListener('resize', () => {
        refreshFieldBounds();
      });
    }
  
    async function init() {
      cacheDom();
      bindEvents();
  
      const config = await loadConfig();
      if (!config) {
        document.body.innerHTML = '<p style="padding:40px;font-family:sans-serif">Không load được config.json. Hãy chạy website qua local server (vd: <code>python3 -m http.server</code>) thay vì mở trực tiếp file HTML.</p>';
        return;
      }
      state.config = config;
  
      els.exchangeLabel.textContent = config.exchange.buttonLabel;
  
      // ---- API BRIDGE: Thử lấy tiền từ Google Sheet qua Cloud trước ----
      const external = await SheetAPIBridge.getInitialCurrency();
      if (external && typeof external.poop === 'number') {
        state.currency.poop = Math.max(0, Math.round(external.poop));
        state.currency.cheese = Math.max(0, Math.round(external.cheese));
        renderCurrency();
      } else {
        setCurrency(config.currency.defaultPoop, config.currency.defaultCheese);
      }
  
      refreshFieldBounds();
      spawnRoaches();
  
      requestAnimationFrame(animationLoop);
    }
  
    document.addEventListener('DOMContentLoaded', init);
  })();