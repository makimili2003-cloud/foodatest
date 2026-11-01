// Pokretanje AR-a koje radi i kad se sajt otvori iz Instagrama, Facebooka, TikToka itd.
// Te aplikacije otvaraju linkove u SVOM ugrađenom browseru, koji ne podržava AR:
//  - Android: AR pokrećemo direktno preko Google Scene Viewer-a (intent), mimo ugrađenog browsera.
//  - iPhone: Instagram ne dozvoljava AR (Quick Look radi samo u Safariju), pa nudimo "Otvori u Safariju".
(function () {
  var UA = navigator.userAgent || '';
  var IN_APP = /Instagram|FBAN|FBAV|FB_IAB|FBIOS|Messenger|MessengerForiOS|musical_ly|TikTok|Bytedance|Snapchat|LinkedInApp|Pinterest|Line\/|Twitter|GSA\//i.test(UA);
  var ANDROID = /Android/i.test(UA);
  var IOS = /iPhone|iPad|iPod/i.test(UA) || (navigator.platform === 'MacIntel' && navigator.maxTouchPoints > 1);
  var APP = /Instagram/i.test(UA) ? 'Instagram' : /FBAN|FBAV|FB_IAB|FBIOS/i.test(UA) ? 'Facebook' : /Messenger/i.test(UA) ? 'Messenger' : /musical_ly|TikTok|Bytedance/i.test(UA) ? 'TikTok' : 'aplikacija';

  function abs(u) { try { return new URL(u, location.href).href; } catch (e) { return u; } }

  // Google Scene Viewer preko intent linka (Android)
  function sceneViewer(opts) {
    var file = abs(opts.glb);
    var params = 'file=' + encodeURIComponent(file) + '&mode=ar_preferred' +
      (opts.title ? '&title=' + encodeURIComponent(opts.title) : '') +
      (opts.fixedScale ? '&resizable=false' : '');
    var fallback = location.href.split('#')[0];
    var intent = 'intent://arvr.google.com/scene-viewer/1.0?' + params +
      '#Intent;scheme=https;package=com.google.android.googlequicksearchbox;action=android.intent.action.VIEW;' +
      'S.browser_fallback_url=' + encodeURIComponent(fallback) + ';end;';
    var a = document.createElement('a'); a.href = intent; a.rel = 'noopener';
    document.body.appendChild(a); a.click(); a.remove();
  }

  function css() {
    if (document.getElementById('arHelpCss')) return;
    var st = document.createElement('style'); st.id = 'arHelpCss';
    st.textContent =
      '.arh{position:fixed;inset:0;z-index:1000;display:flex;align-items:flex-end;justify-content:center;background:rgba(31,26,23,.55);font-family:system-ui,-apple-system,Segoe UI,Roboto,sans-serif;animation:arhIn .25s ease}' +
      '@keyframes arhIn{from{opacity:0}}' +
      '.arh-box{width:min(440px,100%);background:#fff;color:#1f1a17;border-radius:24px 24px 0 0;padding:26px 22px calc(22px + env(safe-area-inset-bottom));box-shadow:0 -20px 50px -20px rgba(0,0,0,.4);animation:arhUp .35s cubic-bezier(.2,.8,.2,1)}' +
      '@keyframes arhUp{from{transform:translateY(40px)}}' +
      '.arh h3{font:700 22px/1.2 Georgia,serif;margin:0 0 8px}.arh p{margin:0 0 16px;color:#6a6058;font-size:15px;line-height:1.5}' +
      '.arh ol{margin:0 0 18px;padding-left:20px;color:#1f1a17;font-size:15px;line-height:1.7}' +
      '.arh .b{display:flex;align-items:center;justify-content:center;width:100%;border:0;border-radius:999px;padding:15px;font:600 16px system-ui;cursor:pointer;text-decoration:none;margin-top:10px}' +
      '.arh .p{background:#d9472b;color:#fff}.arh .g{background:#f3ece2;color:#1f1a17}.arh .t{background:none;color:#6a6058;font-weight:500}' +
      '.arh .dots{display:inline-block;background:#f3ece2;border-radius:6px;padding:0 6px;font-weight:700;letter-spacing:1px}';
    document.head.appendChild(st);
  }

  // iPhone u aplikaciji: uputstvo + "Otvori u Safariju"
  function iosHelp() {
    css();
    var url = location.href.split('#')[0];
    var w = document.createElement('div'); w.className = 'arh';
    w.innerHTML = '<div class="arh-box" role="dialog" aria-modal="true">' +
      '<h3>Otvorite u Safariju za AR</h3>' +
      '<p>' + APP + ' ne dozvoljava prikaz jela na stolu (AR). U Safariju radi odmah:</p>' +
      '<a class="b p" id="arhSafari" href="x-safari-' + url + '">Otvori u Safariju</a>' +
      '<ol style="margin-top:16px"><li>Ako se ne otvori: tapnite <span class="dots">•••</span> gore desno</li><li>Izaberite <b>„Open in external browser“</b> / <b>„Otvori u Safariju“</b></li><li>Tapnite ponovo <b>„Pogledaj na svom stolu“</b></li></ol>' +
      '<button class="b g" id="arhCopy" type="button">Kopiraj link</button>' +
      '<button class="b t" id="arhClose" type="button">Zatvori</button></div>';
    document.body.appendChild(w);
    w.addEventListener('click', function (e) { if (e.target === w) w.remove(); });
    w.querySelector('#arhClose').onclick = function () { w.remove(); };
    w.querySelector('#arhCopy').onclick = function () {
      var btn = this;
      var done = function () { btn.textContent = 'Link je kopiran ✓ Nalepite ga u Safari'; };
      if (navigator.clipboard && navigator.clipboard.writeText) navigator.clipboard.writeText(url).then(done, function () { prompt('Kopirajte link:', url); });
      else prompt('Kopirajte link:', url);
    };
  }

  function noAR() {
    css();
    var w = document.createElement('div'); w.className = 'arh';
    w.innerHTML = '<div class="arh-box" role="dialog" aria-modal="true"><h3>AR nije dostupan na ovom uređaju</h3>' +
      '<p>Jelo i dalje možete da okrećete i zumirate. Za prikaz na stolu otvorite stranicu na telefonu u Chrome-u (Android) ili Safariju (iPhone).</p>' +
      '<button class="b g" type="button">U redu</button></div>';
    document.body.appendChild(w);
    w.onclick = function (e) { if (e.target === w || e.target.tagName === 'BUTTON') w.remove(); };
  }

  /**
   * @param {HTMLElement} mv  model-viewer element
   * @param {{ title?: string, fixedScale?: boolean }} opts
   */
  function launchAR(mv, opts) {
    opts = opts || {};
    var glb = mv.getAttribute('src') || mv.src;
    if (!IN_APP && mv.canActivateAR) { mv.activateAR(); return; }
    if (ANDROID && glb) { sceneViewer({ glb: glb, title: opts.title, fixedScale: opts.fixedScale }); return; }
    if (IOS && IN_APP) { iosHelp(); return; }
    if (mv.canActivateAR) { mv.activateAR(); return; }
    noAR();
  }

  window.FoodAR = { launchAR: launchAR, inApp: IN_APP, android: ANDROID, ios: IOS, canLaunch: function (mv) { return !!(mv && (mv.canActivateAR || ((ANDROID || IOS) && IN_APP))); } };
})();
