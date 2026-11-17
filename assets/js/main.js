(function () {
  var doc = document;

  // Mobile menu
  var toggle = doc.querySelector('.nav-toggle');
  var nav = doc.getElementById('site-nav');
  if (toggle && nav) {
    var setOpen = function (open) {
      toggle.setAttribute('aria-expanded', String(open));
      nav.classList.toggle('is-open', open);
    };
    toggle.addEventListener('click', function () {
      setOpen(toggle.getAttribute('aria-expanded') !== 'true');
    });
    doc.addEventListener('keydown', function (e) {
      if (e.key === 'Escape') { setOpen(false); toggle.focus(); }
    });
    nav.addEventListener('click', function (e) {
      if (e.target.closest('a')) setOpen(false);
    });
  }

  // Header border/shadow after scroll
  var header = doc.querySelector('.site-header');
  if (header) {
    var onScroll = function () { header.classList.toggle('is-scrolled', window.scrollY > 8); };
    onScroll();
    window.addEventListener('scroll', onScroll, { passive: true });
  }

  // Calendly inline widget (official script)
  var cw = doc.querySelector('.calendly-inline-widget');
  if (cw && window.Calendly && Calendly.initInlineWidget) {
    Calendly.initInlineWidget({ url: cw.getAttribute('data-url'), parentElement: cw });
  } else if (cw && !doc.querySelector('script[data-calendly]')) {
    var cs = doc.createElement('script');
    cs.src = 'https://assets.calendly.com/assets/external/widget.js'; cs.async = true; cs.setAttribute('data-calendly', '1');
    doc.head.appendChild(cs);
  }

  // Booking scheduler
  var sc = doc.querySelector('.sched');
  if (sc) {
    var q = function (s) { return sc.querySelector(s); };
    var steps = sc.querySelectorAll('.sched-step');
    var show = function (n) { steps.forEach(function (el) { el.hidden = el.getAttribute('data-step') != n; }); };
    var SLOTS = ['09:30', '10:30', '11:30', '13:30', '14:30', '15:30', '16:30']; // availability (edit here)
    var MAXDAYS = 45, today = new Date(); today.setHours(0, 0, 0, 0);
    var view = new Date(today.getFullYear(), today.getMonth(), 1), picked = null, slot = null;
    var tz = ''; try { tz = Intl.DateTimeFormat().resolvedOptions().timeZone; } catch (x) {}
    if (tz) q('[data-tz]').textContent = tz.replace(/_/g, ' ');
    var fmt = function (d, o) { return d.toLocaleDateString(undefined, o); };
    var open = function (d) {
      var dow = d.getDay(), diff = (d - today) / 864e5;
      return dow !== 0 && dow !== 6 && diff >= 1 && diff <= MAXDAYS;
    };
    var render = function () {
      var grid = q('[data-days]'); grid.innerHTML = '';
      q('[data-month]').textContent = fmt(view, { month: 'long', year: 'numeric' });
      var first = (view.getDay() + 6) % 7, n = new Date(view.getFullYear(), view.getMonth() + 1, 0).getDate();
      for (var i = 0; i < first; i++) grid.appendChild(doc.createElement('span'));
      for (var k = 1; k <= n; k++) {
        (function (d) {
          var b = doc.createElement('button'); b.type = 'button'; b.textContent = d.getDate();
          b.className = 'day'; b.disabled = !open(d);
          if (picked && +picked === +d) b.classList.add('is-on');
          b.addEventListener('click', function () { picked = d; slot = null; render(); times(); });
          grid.appendChild(b);
        })(new Date(view.getFullYear(), view.getMonth(), k));
      }
      q('[data-prev]').disabled = view <= new Date(today.getFullYear(), today.getMonth(), 1);
      q('[data-next]').disabled = view >= new Date(today.getFullYear(), today.getMonth() + 1, 1) && new Date(view.getFullYear(), view.getMonth() + 1, 1) > new Date(+today + MAXDAYS * 864e5);
    };
    var times = function () {
      var box = q('[data-slots]'), list = q('[data-slotlist]'); list.innerHTML = '';
      if (!picked) { box.hidden = true; return; }
      box.hidden = false;
      q('[data-slotlabel]').textContent = fmt(picked, { weekday: 'long', day: 'numeric', month: 'long' });
      SLOTS.forEach(function (t) {
        var b = doc.createElement('button'); b.type = 'button'; b.className = 'slot'; b.textContent = t;
        b.addEventListener('click', function () {
          slot = t;
          var f = q('form');
          f.elements.slot.value = picked.getFullYear() + '-' + ('0' + (picked.getMonth() + 1)).slice(-2) + '-' + ('0' + picked.getDate()).slice(-2) + ' ' + t;
          f.elements.timezone.value = tz;
          q('[data-chosen]').textContent = fmt(picked, { weekday: 'long', day: 'numeric', month: 'long' }) + ' at ' + t + (tz ? ' (' + tz.replace(/_/g, ' ') + ')' : '');
          show(2);
        });
        list.appendChild(b);
      });
    };
    q('[data-prev]').addEventListener('click', function () { view = new Date(view.getFullYear(), view.getMonth() - 1, 1); render(); });
    q('[data-next]').addEventListener('click', function () { view = new Date(view.getFullYear(), view.getMonth() + 1, 1); render(); });
    q('[data-back]').addEventListener('click', function () { show(1); });
    render();

    var form = q('form'), status = q('.form-status');
    var say = function (msg, ok) { status.hidden = false; status.textContent = msg; status.className = 'form-status ' + (ok ? 'is-ok' : 'is-err'); };
    form.addEventListener('submit', function (e) {
      e.preventDefault();
      if (!form.checkValidity()) { var bad = form.querySelector(':invalid'); say('Please complete the highlighted fields.', false); if (bad) bad.focus(); return; }
      var action = sc.getAttribute('data-action');
      if (!action) { say('Booking is not connected yet. Please check back soon.', false); return; }
      var btn = form.querySelector('button[type=submit]'); btn.disabled = true;
      fetch(action, { method: 'POST', body: new FormData(form), headers: { Accept: 'application/json' } })
        .then(function (r) {
          if (!r.ok) throw new Error('bad');
          q('[data-confirm]').textContent = q('[data-chosen]').textContent + '. We will confirm by email.';
          show(3);
        })
        .catch(function () { say('Something went wrong. Please try again in a moment.', false); })
        .then(function () { btn.disabled = false; });
    });
  }

  // Fade/rise on scroll (skipped entirely for reduced motion)
  var items = doc.querySelectorAll('.reveal');
  var reduce = window.matchMedia && window.matchMedia('(prefers-reduced-motion: reduce)').matches;
  if (!items.length) return;
  if (reduce || !('IntersectionObserver' in window)) {
    items.forEach(function (el) { el.classList.add('is-in'); });
    return;
  }
  var io = new IntersectionObserver(function (entries) {
    entries.forEach(function (en) {
      if (en.isIntersecting) { en.target.classList.add('is-in'); io.unobserve(en.target); }
    });
  }, { rootMargin: '0px 0px -8% 0px', threshold: 0.08 });
  items.forEach(function (el) { io.observe(el); });
})();
