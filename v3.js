(function () {
  var pages = window.BOMO_MENU;
  var sheetsEl = document.getElementById("sheets");
  var stackEl = document.getElementById("stack");
  var rootStyle = document.documentElement.style;
  var reduce = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
  var money = function (n) { return "$" + n.toLocaleString("es-MX"); };

  // ----- Assets opcionales: si existen en /assets se aplican solos -----
  function probe(src, ok, fail) {
    var im = new Image();
    im.onload = function () { ok(im); };
    if (fail) im.onerror = fail;
    im.src = src;
  }
  // Imagen de fondo: assets/fondo/fondo.jpg
  probe("assets/fondo/fondo.jpg", function () { rootStyle.setProperty("--bg-image", 'url("assets/fondo/fondo.jpg")'); });
  var clipEl = null;   // el clip se crea más abajo, antes de mostrar la pila

  // Clip: carpeta assets/clip/. Se crea de inmediato (no espera a comprobar el archivo) y, si una imagen falla al
  // cargar, prueba la siguiente: clip2-web → clip2 → clip-web → clip. Si fallan todas, se quita.
  (function makeClip(list) {
    var im = new Image(), i = 0;
    im.className = "clip"; im.alt = "";
    im.onerror = function () { if (++i < list.length) im.src = "assets/clip/" + list[i]; else im.remove(); };
    im.src = "assets/clip/" + list[0];
    clipEl = im;
    stackEl.appendChild(im);
  })(["clip2-web.png", "clip2.png", "clip-web.png", "clip.png"]);

  // El clip sujeta la pila. Con la portada al frente va por encima de todo; en cuanto hay hojas
  // ya pasadas (colgando arriba) queda DETRÁS de todas, así que ellas lo tapan por completo.
  var clipZ = 0;
  function placeClip() {
    if (!clipEl) return;
    var want = front === 0 ? 21 : 1;
    if (want === clipZ) return;
    var reappears = want === 21 && clipZ === 1;
    clipZ = want;
    clipEl.style.zIndex = want;
    if (reappears) {                       // vuelve a salir sobre la portada con un fundido corto
      clipEl.classList.remove("clip-in"); void clipEl.offsetWidth; clipEl.classList.add("clip-in");
      clipEl.addEventListener("animationend", function done() {
        clipEl.classList.remove("clip-in"); clipEl.removeEventListener("animationend", done);
      });
    }
  }

  // ----- Contenido -----
  var coverHTML =
    '<div class="body cover" role="tabpanel" id="panel-inicio" aria-labelledby="tab-inicio">' +
      '<div class="cover-top">Menú</div>' +
      '<img class="receipt" src="assets/recibo.webp" width="692" height="1036" alt="Recibo de Bomo: pan con intención, horneado para ti" decoding="async">' +
      (window.BOMO_SOON ? '<div class="postit"><span class="postit-tag">' + BOMO_SOON.tag + '</span><div class="postit-name">' + BOMO_SOON.n +
        '</div>' + (BOMO_SOON.d ? '<p class="postit-d">' + BOMO_SOON.d + "</p>" : "") + "</div>" : "") +
      '<div class="cover-logo"><h1 class="logo logo-img" id="logo">Bomo</h1></div>' +
    "</div>";

  var HINT = "Toca un pan para verlo y agregarlo a tu orden.";

  function pageHTML(page) {
    var groups = page.groups.map(function (g, gi) {
      var items = g.items.map(function (it, ii) {
        var price = it.p == null
          ? '<span class="price soon">pronto</span>'
          : '<span class="price">' + money(it.p) + "</span>";
        var open = it.p != null ? ' class="item has-view" tabindex="0" role="button" aria-label="Ver ' + it.n + '" data-page="' + page.id + '" data-g="' + gi + '" data-it="' + ii + '"' : ' class="item"';
        return "<li" + open + '><div class="row"><span class="name">' + it.n +
          '</span><span class="dots"></span>' + price + "</div>" +
          (it.d ? '<p class="desc">' + it.d + "</p>" : "") + "</li>";   // descripción solo si el producto la necesita
      }).join("");
      return '<section class="group"><h3>' + g.name + '</h3><ul class="items">' + items + "</ul></section>";
    }).join("");
    return '<div class="body" role="tabpanel" id="panel-' + page.id + '" aria-labelledby="tab-' + page.id + '">' +
      '<h2 class="title">' + page.title + '</h2><p class="hint">' + HINT + "</p>" + groups + "</div>";
  }

  // Orden de adelante hacia atrás: la hoja con más contenido va al fondo, es la más ancha
  // y la de mayor margen. Si cambias el contenido, reordena esta lista.
  var ORDER = ["temporada", "bolleria", "mesa"];
  var byId = {};
  pages.forEach(function (p) { byId[p.id] = p; });

  var all = [{ id: "inicio", tab: "Menú", html: coverHTML }].concat(
    ORDER.map(function (id) { var p = byId[id]; return { id: id, tab: p.tab, html: pageHTML(p) }; })
  );

  var sheets = all.map(function (s, i) {
    var el = document.createElement("div");
    el.className = "sheet";
    el.dataset.i = i;
    el.style.setProperty("--i", i);
    el.innerHTML =
      '<div class="tab" role="tab" id="tab-' + s.id + '" aria-controls="panel-' + s.id +
      '"><span class="tab-label">' + s.tab + "</span></div>" + s.html;
    sheetsEl.appendChild(el);
    return el;
  });

  // ----- Estado: "front" es la hoja de enfrente; las anteriores cuelgan arriba -----
  var front = 0;

  function apply() {
    stackEl.style.setProperty("--turned", front);
    sheets.forEach(function (s, i) {
      var state = i < front ? "turned" : i === front ? "front" : "behind";
      var tab = s.querySelector(".tab");
      s.dataset.state = state;
      tab.setAttribute("aria-selected", state === "front");
      tab.tabIndex = state === "front" ? 0 : -1;
      s.querySelector(".body").inert = state !== "front";
    });
  }

  // ----- Giro con papel que se dobla -----
  // La hoja se reemplaza durante el giro por N tiras (clones recortados) cuyos ángulos
  // se acumulan: el borde inferior se adelanta y la hoja se curva en lugar de girar rígida.
  var PERSPECTIVE = 2200;         // px: menor = más profundidad (y la hoja se agranda más al levantarse)
  var A_END = 128;               // grados al final: ya pasó por encima y quedó fuera de la vista
  var active = [];                // giros en curso
  var ease = {
    up:   function (p) { return p * p * (3 - 2 * p); },          // arranca suave, acelera
    down: function (p) { return 1 - Math.pow(1 - p, 3); }        // llega frenando
  };
  var smooth = function (v) { v = Math.max(0, Math.min(1, v)); return v * v * (3 - 2 * v); };

  function buildRig(sheet, dir, delay) {
    var H = sheet.offsetHeight, W = sheet.offsetWidth;
    var N = Math.max(7, Math.min(12, Math.round(H / 110)));
    var h = H / N;
    var rig = document.createElement("div");
    rig.className = "rig";
    rig.style.width = W + "px";
    rig.style.height = H + "px";
    rig.style.zIndex = 60 - (+sheet.dataset.i);
    // La perspectiva va en el propio transform del rig (no en el contenedor): así Safari la
    // aplica igual que Chrome y todas las tiras comparten el mismo punto de fuga.
    rig.style.transform = "perspective(" + PERSPECTIVE + "px) rotate(" + (getComputedStyle(sheet).getPropertyValue("--r").trim() || "0deg") + ")";
    var plate = document.createElement("div");
    plate.className = "rig-shadow";
    rig.appendChild(plate);
    var segs = [];
    // Plantilla: solo la hoja de enfrente lleva su contenido; las de atrás tienen el texto
    // oculto, así que se copian vacías (mucho más ligero: evita un tirón al arrancar).
    var tpl = sheet.cloneNode(true);
    if (sheet.dataset.state !== "front") {
      var b = tpl.querySelector(".body");
      while (b.firstChild) b.removeChild(b.firstChild);
    }
    tpl.style.height = H + "px";
    var backColor = getComputedStyle(sheet).backgroundColor;
    for (var k = 0; k < N; k++) {
      var seg = document.createElement("div");
      seg.className = "seg";
      seg.style.height = (h + 1) + "px";
      var clone = tpl.cloneNode(true);
      Array.prototype.forEach.call(clone.querySelectorAll("[id]"), function (n) { n.removeAttribute("id"); });
      clone.removeAttribute("id");
      clone.classList.add("sheet-clone");
      clone.style.width = W + "px";
      clone.style.top = (-k * h) + "px";
      clone.inert = true;
      var shade = document.createElement("div");
      shade.className = "shade";
      seg.appendChild(clone);
      seg.appendChild(shade);
      rig.appendChild(seg);

      // Reverso: cuando la tira pasa de 90° se ve el dorso del papel (liso, un poco más oscuro),
      // en lugar de desaparecer. Es lo que hace que se lea como hoja que se voltea.
      var back = document.createElement("div");
      back.className = "seg back";
      back.style.height = (h + 1) + "px";
      back.style.backgroundColor = backColor;
      var bshade = document.createElement("div");
      bshade.className = "shade";
      bshade.style.opacity = ".16";
      back.appendChild(bshade);
      rig.appendChild(back);

      segs.push({ el: seg, back: back, shade: shade });
    }
    sheetsEl.appendChild(rig);
    return { sheet: sheet, rig: rig, plate: plate, segs: segs, h: h, N: N, dir: dir,
             t0: performance.now() + delay * 1000, dur: dir === "up" ? 430 : 480 };
  }

  function pose(r, A, B) {
    var y = 0, z = 0;
    for (var k = 0; k < r.N; k++) {
      var phi = A + B * Math.pow(k / (r.N - 1), 1.4);
      phi = Math.max(0, Math.min(180, phi));
      var rad = phi * Math.PI / 180;
      var t = "translate3d(0," + y.toFixed(2) + "px," + z.toFixed(2) + "px) rotateX(" + phi.toFixed(2) + "deg)";
      r.segs[k].el.style.transform = t;
      r.segs[k].back.style.transform = t + " rotateY(180deg)";
      r.segs[k].shade.style.opacity = Math.min(0.34, Math.sin(Math.min(rad, Math.PI / 2)) * 0.3).toFixed(3);
      y += r.h * Math.cos(rad);
      z += r.h * Math.sin(rad);
    }
    r.plate.style.opacity = Math.max(0, 1 - A / 35).toFixed(3);
  }

  function finish(r) {
    r.rig.remove();
    r.sheet.classList.remove("in-flight");
    if (r.dir === "up") {
      r.sheet.classList.add("reveal");
      r.sheet.addEventListener("animationend", function done() {
        r.sheet.classList.remove("reveal");
        r.sheet.removeEventListener("animationend", done);
      });
    }
    // La hoja que baja aterriza sin texto (su copia animada iba vacía): se le da un fundido
    // corto para que el contenido no "salte" de la nada.
    if (r.dir === "down" && r.sheet.dataset.state === "front") {
      var bd = r.sheet.querySelector(".body");
      r.sheet.classList.add("text-in");
      bd.addEventListener("animationend", function done() {
        r.sheet.classList.remove("text-in");
        bd.removeEventListener("animationend", done);
      });
    }
    requestAnimationFrame(function () { r.sheet.classList.remove("no-tr"); });
    active.splice(active.indexOf(r), 1);
    if (!active.length) {
      placeClip();                   // si volvió la portada, el clip reaparece al terminar de asentarse
      var f = sheets[front];
      f.classList.remove("settle"); void f.offsetWidth; f.classList.add("settle");
      f.addEventListener("animationend", function done(e) {
        if (e.animationName !== "settle") return;
        f.classList.remove("settle"); f.removeEventListener("animationend", done);
      });
    }
  }

  function tick(now) {
    active.slice().forEach(function (r) {
      var p = (now - r.t0) / r.dur;
      if (p >= 1) { finish(r); return; }
      p = Math.max(0, p);
      var e = ease[r.dir](p);
      // El doblez llega a su máximo pronto, mientras la hoja aún se ve (después ya va de canto)
      if (r.dir === "up") pose(r, A_END * e, 95 * Math.sin(Math.PI * Math.pow(p, 0.6)));
      else                pose(r, A_END * (1 - e), -70 * Math.sin(Math.PI * Math.pow(p, 0.85)));
    });
    if (active.length) requestAnimationFrame(tick);
  }

  function launch(list) {            // list: [{sheet, dir, delay}] — se construye antes de apply()
    return list.map(function (it) { return buildRig(it.sheet, it.dir, it.delay); });
  }

  function select(idx, animate) {
    if (idx === front) return;
    active.slice().forEach(finish);  // si había giros en curso, termínalos
    var from = front, rigs = [];
    var go = animate && !reduce;
    if (go) {
      var list = [], k, j;
      if (idx > from) {              // pasar hojas hacia arriba, de la primera a la última
        for (k = from; k < idx; k++) list.push({ sheet: sheets[k], dir: "up", delay: (k - from) * 0.035 });
      } else {                       // regresarlas: baja primero la última que subió
        for (j = idx; j < from; j++) list.push({ sheet: sheets[j], dir: "down", delay: (from - 1 - j) * 0.05 });
      }
      rigs = launch(list);
    }
    front = idx;
    apply();
    if (!go) placeClip();
    else if (front > 0) setTimeout(placeClip, 120);   // se esconde cuando la portada ya empezó a subir
    window.scrollTo({ top: 0, behavior: go ? "smooth" : "auto" });
    if (go) {
      rigs.forEach(function (r) {
        r.sheet.classList.add("no-tr", "in-flight");
        pose(r, r.dir === "up" ? 0 : A_END, 0);
        active.push(r);
      });
      requestAnimationFrame(tick);
    }
    try { history.replaceState(null, "", "#" + all[idx].id); } catch (e) {}
  }

  sheets.forEach(function (s, i) {
    var tab = s.querySelector(".tab");
    tab.addEventListener("click", function () { select(i, true); askMotion(); });
    tab.addEventListener("keydown", function (e) {
      if (e.key === "Enter" || e.key === " ") { e.preventDefault(); select(i, true); return; }
      var n = e.key === "ArrowDown" || e.key === "ArrowRight" ? 1 :
              e.key === "ArrowUp" || e.key === "ArrowLeft" ? -1 : 0;
      if (!n) return;
      e.preventDefault();
      var j = Math.max(0, Math.min(all.length - 1, front + n));
      select(j, true);
      sheets[j].querySelector(".tab").focus();
    });
  });

  // ----- Visor del pan + orden (carrito) -----
  // Todo va fuera de la pila (en <body>): la pila tiene transformaciones 3D y rompería el position: fixed.
  var viewerOpen = false;
  var slug = function (t) {
    return t.toLowerCase().normalize("NFD").replace(/[̀-ͯ]/g, "").replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "");
  };
  var BAG_ICON = '<svg viewBox="0 0 24 24" width="24" height="24" fill="none" stroke="currentColor" stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">' +
    '<path d="M5 8h14l-1.1 11.2a1.5 1.5 0 0 1-1.5 1.3H7.6a1.5 1.5 0 0 1-1.5-1.3L5 8z"/><path d="M9 8V6.5a3 3 0 0 1 6 0V8"/></svg>';

  // ---- Orden: lista de productos, guardada en el navegador ----
  var cart = (function () {
    var items = [];
    try { items = JSON.parse(localStorage.getItem("bomo-orden") || "[]") || []; } catch (e) { items = []; }
    var el = document.createElement("aside");
    el.className = "cart"; el.hidden = true;
    el.setAttribute("aria-label", "Tu orden");
    el.innerHTML =
      '<section class="cart-panel" id="cart-panel" hidden>' +
        '<header class="cart-head"><h2>Tu orden</h2><button class="cart-min" type="button" aria-label="Minimizar la orden">–</button></header>' +
        '<ul class="cart-list"></ul>' +
        '<div class="cart-total"><span>Total</span><span class="cart-sum"></span></div>' +
        '<label class="cart-note"><span>Nombre y notas (opcional)</span><textarea rows="2" maxlength="200" placeholder="Ej. Para recoger a las 5 pm"></textarea></label>' +
        '<button class="cart-send" type="button">Enviar por WhatsApp</button>' +
        '<button class="cart-clear" type="button">Vaciar orden</button>' +
      "</section>" +
      '<button class="cart-bag" type="button" aria-label="Ver tu orden" aria-expanded="false" aria-controls="cart-panel">' + BAG_ICON + '<span class="cart-count"></span></button>';
    document.body.appendChild(el);
    var bag = el.querySelector(".cart-bag"), panel = el.querySelector(".cart-panel"), list = el.querySelector(".cart-list"),
        countEl = el.querySelector(".cart-count"), sumEl = el.querySelector(".cart-sum"), note = el.querySelector("textarea");

    function save() { try { localStorage.setItem("bomo-orden", JSON.stringify(items)); } catch (e) {} }
    function count() { return items.reduce(function (a, i) { return a + i.q; }, 0); }
    function total() { return items.reduce(function (a, i) { return a + i.q * i.p; }, 0); }
    function render() {
      var n = count();
      if (n === 0) { leave(); return; }      // al vaciarse, la orden se despide con animación (deja a la vista lo último que tenía)
      cancelLeave();
      el.hidden = false;
      countEl.textContent = n;
      sumEl.textContent = money(total());
      list.innerHTML = items.map(function (it, i) {
        return '<li class="cart-item"><span class="cart-name">' + it.n + '</span>' +
          '<span class="cart-qty"><button type="button" data-i="' + i + '" data-d="-1" aria-label="Quitar uno de ' + it.n + '">−</button><b>' + it.q +
          '</b><button type="button" data-i="' + i + '" data-d="1" aria-label="Agregar uno de ' + it.n + '">+</button></span>' +
          '<span class="cart-line">' + money(it.q * it.p) + "</span></li>";
      }).join("");
    }
    // Salida al vaciar la orden: primero el recuadro se encoge hacia la bolsa y luego la bolsa se desvanece encogiéndose.
    var leaving = false, leaveToken = 0;
    function cancelLeave() {
      if (!leaving) return;
      leaving = false; leaveToken++;
      if (bag.getAnimations) bag.getAnimations().forEach(function (a) { a.cancel(); });
    }
    function leave() {
      if (el.hidden || leaving) return;
      leaving = true;
      var token = ++leaveToken;
      function done() {
        if (token !== leaveToken) return;
        leaving = false;
        if (bag.getAnimations) bag.getAnimations().forEach(function (a) { a.cancel(); });
        setOpen(false, true);
        el.hidden = true;
        list.innerHTML = "";
      }
      if (reduce || !bag.animate) { done(); return; }
      function bagOut() {
        if (token !== leaveToken) return;
        var a = bag.animate([{ transform: "scale(1)", opacity: 1 }, { transform: "scale(.25)", opacity: 0 }],
          { duration: 260, easing: "cubic-bezier(.5,0,.8,.4)", fill: "forwards" });
        a.onfinish = done;
      }
      if (!panel.hidden) { setOpen(false); setTimeout(bagOut, 300); } else bagOut();
    }
    // El panel se encoge hacia la bolsa al minimizar (como una ventana de iOS) y crece desde ella al abrir.
    var panelAnim = null;
    function setOpen(on, instant) {
      if (panelAnim) { panelAnim.cancel(); panelAnim = null; }
      var was = !panel.hidden;
      bag.setAttribute("aria-expanded", on ? "true" : "false");
      bag.setAttribute("aria-label", on ? "Minimizar la orden" : "Ver tu orden");
      el.classList.toggle("open", on);
      if (on === was && !instant) return;
      var small = "translate(10px, 26px) scale(.1)";
      if (instant || reduce || !panel.animate) { panel.hidden = !on; return; }
      if (on) {
        panel.hidden = false;
        panelAnim = panel.animate([{ transform: small, opacity: 0 }, { transform: "none", opacity: 1 }],
          { duration: 380, easing: "cubic-bezier(.2,1.1,.3,1)" });
      } else {
        panelAnim = panel.animate([{ transform: "none", opacity: 1 }, { transform: small, opacity: 0 }],
          { duration: 300, easing: "cubic-bezier(.5,0,.8,.4)", fill: "forwards" });
        var a = panelAnim;
        a.onfinish = function () { if (panelAnim === a) { panelAnim = null; panel.hidden = true; } a.cancel(); };
      }
    }
    function bump() {
      if (bag.animate && !reduce) bag.animate([{ transform: "scale(1)" }, { transform: "scale(1.22)" }, { transform: "scale(1)" }], { duration: 380, easing: "ease-out" });
    }
    function add(k, name, price) {
      var f = items.filter(function (i) { return i.k === k; })[0];
      if (f) f.q++; else items.push({ k: k, n: name, p: price, q: 1 });
      save(); render();
    }
    bag.addEventListener("click", function () { setOpen(panel.hidden); });
    el.querySelector(".cart-min").addEventListener("click", function () { setOpen(false); bag.focus(); });
    list.addEventListener("click", function (e) {
      var b = e.target.closest && e.target.closest("button[data-i]");
      if (!b) return;
      var it = items[+b.dataset.i]; if (!it) return;
      it.q += +b.dataset.d;
      if (it.q <= 0) items.splice(+b.dataset.i, 1);
      save(); render();
    });
    el.querySelector(".cart-clear").addEventListener("click", function () { items = []; save(); render(); });
    // "Enviar por WhatsApp" es solo de adorno por ahora: se puede presionar, pero no lleva a ninguna acción.
    el.querySelector(".cart-send").addEventListener("click", function () {});
    render();
    return { add: add, bag: bag, el: el, bump: bump };
  })();

  // ---- Visor: el pan salta sobre un fondo borroso ----
  (function viewer() {
    var el = document.createElement("div");
    el.className = "viewer"; el.hidden = true;
    el.setAttribute("role", "dialog"); el.setAttribute("aria-modal", "true"); el.setAttribute("aria-label", "Detalle del pan");
    el.innerHTML =
      '<div class="viewer-veil"></div>' +
      '<div class="viewer-main">' +
        '<div class="viewer-stage"><img class="viewer-img" alt=""><div class="viewer-ph" aria-hidden="true"></div>' +
          '<button class="viewer-x" type="button" aria-label="Cerrar">×</button></div>' +
        '<div class="viewer-info"><div class="viewer-row"><span class="viewer-name"></span><span class="viewer-price"></span></div>' +
          '<p class="viewer-desc"></p>' +
          '<button class="viewer-add" type="button">Agregar a la orden</button></div>' +
      "</div>";
    document.body.appendChild(el);
    var stage = el.querySelector(".viewer-stage"), img = el.querySelector(".viewer-img"), ph = el.querySelector(".viewer-ph"),
        nameEl = el.querySelector(".viewer-name"), priceEl = el.querySelector(".viewer-price"), descEl = el.querySelector(".viewer-desc"),
        xBtn = el.querySelector(".viewer-x"), addBtn = el.querySelector(".viewer-add"),
        lastFocus = null, hideT = null, cur = null, busy = false, tries = [];

    function ready() { el.classList.add("loaded"); }
    function usePlaceholder() { img.hidden = true; ph.hidden = false; ready(); }
    function tryNext() {
      if (!tries.length) { usePlaceholder(); return; }
      img.src = tries.shift();
    }
    img.addEventListener("load", function () { img.hidden = false; ph.hidden = true; ready(); });
    img.addEventListener("error", tryNext);

    function show(li) {
      var page = byId[li.dataset.page], it = page && page.groups[+li.dataset.g].items[+li.dataset.it];
      if (!it) return;
      cur = { k: li.dataset.page + ":" + li.dataset.g + ":" + li.dataset.it, n: it.n, p: it.p };
      lastFocus = li; busy = false;
      nameEl.textContent = it.n;
      priceEl.textContent = it.p == null ? "pronto" : money(it.p);
      descEl.textContent = it.d || ""; descEl.hidden = !it.d;
      addBtn.disabled = it.p == null; addBtn.textContent = "Agregar a la orden";
      img.alt = it.n; img.hidden = true; ph.hidden = true; img.removeAttribute("src");
      var base = "assets/panes/" + (it.img || slug(it.n));
      tries = [base + ".webp", base + ".png"]; tryNext();
      clearTimeout(hideT);
      el.hidden = false;
      el.classList.remove("loaded", "adding");
      void el.offsetWidth;
      el.classList.add("open");
      document.documentElement.classList.add("viewer-on");
      viewerOpen = true;
      xBtn.focus({ preventScroll: true });
    }
    function hide() {
      if (!viewerOpen) return;
      viewerOpen = false;
      el.classList.remove("open");
      document.documentElement.classList.remove("viewer-on");
      hideT = setTimeout(function () { el.hidden = true; img.removeAttribute("src"); }, 260);
      if (lastFocus) lastFocus.focus({ preventScroll: true });
    }

    // Agregar: el pan vuela hacia la bolsa, el visor se cierra y la bolsa avisa con un saltito
    function addToOrder() {
      if (!cur || busy || cur.p == null) return;
      busy = true;
      var wasEmpty = cart.el.hidden;
      cart.add(cur.k, cur.n, cur.p);
      addBtn.textContent = "✓ Agregado";
      var src = img.hidden ? ph : img, r = src.getBoundingClientRect(), b = cart.bag.getBoundingClientRect();
      if (!reduce && src.animate && r.width) {
        var fly = src.cloneNode(true);
        fly.removeAttribute("hidden"); fly.className = (src === img ? "viewer-img" : "viewer-ph") + " fly";
        fly.style.cssText = "position:fixed;left:" + r.left + "px;top:" + r.top + "px;width:" + r.width + "px;height:" + r.height + "px;margin:0;z-index:300;pointer-events:none;opacity:1;transform:none;animation:none;";
        document.body.appendChild(fly);
        src.style.visibility = "hidden";
        var dx = (b.left + b.width / 2) - (r.left + r.width / 2), dy = (b.top + b.height / 2) - (r.top + r.height / 2), s = Math.max(.08, b.width / r.width * .8);
        var anim = fly.animate([
          { transform: "translate(0,0) scale(1)", opacity: 1, offset: 0 },
          { transform: "translate(" + dx * .35 + "px," + (dy * .35 - 40) + "px) scale(.7)", opacity: 1, offset: .4 },
          { transform: "translate(" + dx + "px," + dy + "px) scale(" + s + ")", opacity: .9, offset: 1 }
        ], { duration: 650, easing: "cubic-bezier(.5,0,.75,.6)", fill: "forwards" });
        setTimeout(hide, 140);
        anim.onfinish = function () { fly.remove(); src.style.visibility = ""; cart.bump(); };
      } else {
        setTimeout(hide, 450); cart.bump();
      }
      if (wasEmpty && cart.bag.animate && !reduce) cart.bag.animate([{ transform: "scale(.4)", opacity: 0 }, { transform: "scale(1)", opacity: 1 }], { duration: 300, easing: "cubic-bezier(.2,1.4,.4,1)" });
    }

    sheetsEl.addEventListener("click", function (e) {
      var li = e.target.closest && e.target.closest(".item.has-view");
      if (li) show(li);
    });
    sheetsEl.addEventListener("keydown", function (e) {
      if ((e.key === "Enter" || e.key === " ") && e.target.classList && e.target.classList.contains("has-view")) {
        e.preventDefault(); show(e.target);
      }
    });
    el.querySelector(".viewer-veil").addEventListener("click", hide);
    el.querySelector(".viewer-main").addEventListener("click", function (e) { if (e.target === this) hide(); });
    xBtn.addEventListener("click", hide);
    addBtn.addEventListener("click", addToOrder);
    document.addEventListener("keydown", function (e) { if (e.key === "Escape") hide(); });
  })();

  // ----- Gesto: deslizar el dedo para voltear -----
  // De derecha a izquierda pasa a la hoja siguiente; de izquierda a derecha regresa a la anterior.
  // Solo cuenta un deslizamiento rápido y claramente horizontal: el scroll vertical no se toca.
  (function swipe() {
    var sx = 0, sy = 0, st = 0, on = false;
    document.addEventListener("touchstart", function (e) {
      if (e.touches.length !== 1) { on = false; return; }
      sx = e.touches[0].clientX; sy = e.touches[0].clientY; st = Date.now(); on = true;
    }, { passive: true });
    document.addEventListener("touchcancel", function () { on = false; }, { passive: true });
    document.addEventListener("touchend", function (e) {
      if (!on) return;
      on = false;
      if (viewerOpen || (e.target.closest && e.target.closest(".cart"))) return;
      var t = e.changedTouches[0], dx = t.clientX - sx, dy = t.clientY - sy;
      if (Date.now() - st > 800 || Math.abs(dx) < 50 || Math.abs(dx) < Math.abs(dy) * 1.5) return;
      var to = Math.max(0, Math.min(all.length - 1, front + (dx < 0 ? 1 : -1)));
      if (to === front) return;
      select(to, true);
      askMotion();
    }, { passive: true });
  })();

  var start = all.findIndex(function (p) { return "#" + p.id === location.hash; });
  if (start > 0) front = start;
  apply();
  placeClip();
  requestAnimationFrame(function () { requestAnimationFrame(function () { document.body.classList.add("ready"); }); });

  // ----- Inclinación (cursor en escritorio / movimiento del celular) -----
  // En el celular se usa el giroscopio (necesita HTTPS; en iPhone pide permiso una vez). El dedo NO mueve el efecto.
  var tx = 0, ty = 0, cx = 0, cy = 0, raf = null, gyro = false, asking = false, perm = "", orientEvents = 0, lastG = null, lastB = null;
  function clamp(v) { return Math.max(-1, Math.min(1, v)); }
  function frame() {
    cx += (tx - cx) * 0.08; cy += (ty - cy) * 0.08;
    rootStyle.setProperty("--tx", cx.toFixed(3));
    rootStyle.setProperty("--ty", cy.toFixed(3));
    raf = (Math.abs(tx - cx) > 0.002 || Math.abs(ty - cy) > 0.002) ? requestAnimationFrame(frame) : null;
  }
  function setTilt(x, y) { tx = clamp(x); ty = clamp(y); if (!raf) raf = requestAnimationFrame(frame); }
  // Con el celular en la mano el movimiento natural es de unos pocos grados: se amplifica para que el efecto se note
  // (el efecto completo se alcanza con ~12° de giro a los lados y ~14° de cabeceo respecto a sostenerlo a ~50°).
  function onOrient(e) {
    if (e.gamma == null) return;
    orientEvents++; lastG = e.gamma; lastB = e.beta;
    setTilt(e.gamma / 12, (e.beta - 50) / 14);
    if (dbg) dbgShow();
  }
  function listenMotion() { gyro = true; document.documentElement.classList.add("gyro"); window.addEventListener("deviceorientation", onOrient); }
  function askMotion() {
    if (reduce || gyro || asking || !window.DeviceOrientationEvent) { if (dbg) dbgShow(); return; }
    var DOE = window.DeviceOrientationEvent;
    if (typeof DOE.requestPermission === "function") {          // iPhone / iPad
      asking = true;
      DOE.requestPermission().then(function (r) {
        asking = false; perm = r;
        if (r === "granted") listenMotion();
        if (dbg) dbgShow();
      }).catch(function (err) { asking = false; perm = "error: " + (err && err.message || err); if (dbg) dbgShow(); });
    } else { perm = "no hace falta"; listenMotion(); if (dbg) dbgShow(); }
  }
  // El permiso se pide en el primer toque (iOS lo exige dentro de un gesto del usuario); si se negó, no se insiste.
  document.addEventListener("click", askMotion, { once: true });
  document.addEventListener("touchend", askMotion, { once: true, passive: true });
  if (!reduce) {
    window.addEventListener("pointermove", function (e) {
      if (e.pointerType === "touch") return;                      // el dedo no mueve el efecto
      setTilt((e.clientX / innerWidth - 0.5) * 2, (e.clientY / innerHeight - 0.5) * 2);
    }, { passive: true });
    document.addEventListener("pointerleave", function (e) { if (e.pointerType !== "touch") setTilt(0, 0); });
  }
  // Diagnóstico opcional: agregar ?giro a la dirección muestra el estado del sensor en una esquina (para probar en el celular).
  var dbg = null;
  if (/[?&]giro\b/.test(location.search)) {
    dbg = document.createElement("div");
    dbg.style.cssText = "position:fixed;left:8px;top:8px;z-index:2000;padding:6px 8px;border-radius:6px;background:rgba(0,0,0,.75);color:#fff;font:12px/1.4 monospace;pointer-events:none;max-width:70vw";
    document.body.appendChild(dbg);
  }
  function dbgShow() {
    if (!dbg) return;
    dbg.innerHTML = "https: " + window.isSecureContext + "<br>reducir movimiento: " + reduce + "<br>permiso: " + (perm || (typeof DeviceOrientationEvent !== "undefined" && typeof DeviceOrientationEvent.requestPermission === "function" ? "pendiente (toca la pantalla)" : "sin pedir")) +
      "<br>eventos: " + orientEvents + (lastG != null ? "<br>gamma " + lastG.toFixed(1) + " · beta " + (lastB == null ? "-" : lastB.toFixed(1)) : "");
  }
  if (dbg) dbgShow();
  // ----- Pantalla de carga: se quita cuando el sitio terminó de cargar -----
  // Se ve por lo menos un ciclo completo de la animación (1 s) y se retira al cerrar un ciclo; tope de 6 s por si algo tarda.
  (function loaderOff() {
    var el = document.getElementById("loader");
    if (!el) return;
    var anim = el.querySelector(".loader-anim"), t0 = performance.now(), gone = false;
    var MIN = reduce ? 300 : 1000, MAX = 6000;
    function finish() {
      if (gone) return; gone = true;
      el.classList.add("done");
      document.documentElement.classList.remove("loading");
      setTimeout(function () { el.remove(); }, 500);
    }
    function ready() {
      var wait = Math.max(0, MIN - (performance.now() - t0));
      setTimeout(function () {
        if (reduce || !anim) { finish(); return; }
        anim.addEventListener("animationiteration", finish, { once: true });   // espera a que cierre la vuelta
        setTimeout(finish, 1200);
      }, wait);
    }
    var fontsOk = document.fonts && document.fonts.ready ? document.fonts.ready : Promise.resolve();
    var loaded = document.readyState === "complete" ? Promise.resolve() : new Promise(function (r) { window.addEventListener("load", r, { once: true }); });
    Promise.all([fontsOk, loaded]).then(ready, ready);
    setTimeout(finish, MAX);
  })();
})();
