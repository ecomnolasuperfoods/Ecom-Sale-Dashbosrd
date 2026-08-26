/* Nola Superfoods — Data Dashboard 2026
   Renders data/data.json (built by scripts/extract.py from the master workbook). */
(function () {
  'use strict';

  var MON = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
  var MON_TH = { Jan: 'ม.ค.', Feb: 'ก.พ.', Mar: 'มี.ค.', Apr: 'เม.ย.', May: 'พ.ค.', Jun: 'มิ.ย.', Jul: 'ก.ค.', Aug: 'ส.ค.', Sep: 'ก.ย.', Oct: 'ต.ค.', Nov: 'พ.ย.', Dec: 'ธ.ค.' };
  // Fixed slot order — colour follows the entity, never its rank.
  var PLATFORMS = ['Tiktok', 'Shopee', 'Lazada', 'Facebook', 'Line Chat', 'Website', 'Line Shopping', 'Amaze'];
  var SLOT = { Tiktok: 1, Shopee: 2, Lazada: 3, Facebook: 4, 'Line Chat': 5, Website: 6, 'Line Shopping': 7, Amaze: 8 };
  var SKU_MONTHS = ['Sep25', 'Oct25', 'Nov25', 'Dec25', 'Jan26', 'Feb26', 'Mar26', 'Apr26', 'May26', 'Jun26', 'Jul26'];
  var SKU_MONTHS_TH = ['ก.ย.68', 'ต.ค.68', 'พ.ย.68', 'ธ.ค.68', 'ม.ค.69', 'ก.พ.69', 'มี.ค.69', 'เม.ย.69', 'พ.ค.69', 'มิ.ย.69', 'ก.ค.69'];

  var D = null, charts = {}, activeTab = 'overview';
  var state = { dailyPlat: 'ALL', dailyMon: null, monPlatView: '2026', adsPlat: 'Tiktok', stockSort: 'qty' };

  /* ---------- helpers ---------- */
  function css(name) { return getComputedStyle(document.documentElement).getPropertyValue(name).trim(); }
  function color(slot) { return css('--s' + slot); }
  function platColor(p) { return color(SLOT[p] || 8); }
  function n(v) { return (typeof v === 'number' && isFinite(v)) ? v : 0; }
  function has(v) { return typeof v === 'number' && isFinite(v); }

  function baht(v, dp) {
    if (!has(v)) return '—';
    return v.toLocaleString('en-US', { minimumFractionDigits: dp || 0, maximumFractionDigits: dp || 0 });
  }
  function compact(v) {
    if (!has(v)) return '—';
    var a = Math.abs(v);
    if (a >= 1e6) return (v / 1e6).toFixed(a >= 1e7 ? 1 : 2) + ' ล.';
    if (a >= 1e3) return Math.round(v / 1e3) + 'k';
    return Math.round(v).toString();
  }
  function pct(v, dp) {
    if (!has(v)) return '—';
    return (v * 100).toFixed(dp === undefined ? 1 : dp) + '%';
  }
  function delta(v, dp) {
    if (!has(v)) return '—';
    var s = (v > 0 ? '+' : '') + (v * 100).toFixed(dp === undefined ? 1 : dp) + '%';
    return '<span class="' + (v >= 0 ? 'up' : 'down') + '">' + s + '</span>';
  }
  function el(id) { return document.getElementById(id); }
  function agg(plat, year, mon, field) {
    var r = D.monthlyAgg[plat + '|' + year + '|' + mon];
    return r ? n(r[field]) : 0;
  }
  function aggAll(year, mon, field) {
    var t = 0;
    PLATFORMS.forEach(function (p) { t += agg(p, year, mon, field); });
    return t;
  }
  /* number of days in a 2026 month that actually recorded sales (any platform) */
  function daysWithSales(mon) {
    var seen = {};
    PLATFORMS.forEach(function (p) {
      var days = D.daily[p + '|2026|' + mon];
      if (!days) return;
      Object.keys(days).forEach(function (d) { if (n(days[d].gmv) > 0) seen[d] = 1; });
    });
    return Object.keys(seen).length;
  }

  /* months of 2026 that actually carry sales */
  function activeMonths() {
    return MON.filter(function (m) {
      var r = D.monthly2026.find(function (x) { return x.month === m; });
      return r && has(r.total) && r.total > 0;
    });
  }

  /* ---------- chart defaults ---------- */
  function applyChartDefaults() {
    var C = Chart;
    C.defaults.font.family = '"Noto Sans Thai", system-ui, -apple-system, "Segoe UI", sans-serif';
    C.defaults.font.size = 12;
    C.defaults.color = css('--text-secondary');
    C.defaults.borderColor = css('--grid');
    C.defaults.maintainAspectRatio = false;
    C.defaults.animation.duration = 350;
    C.defaults.plugins.legend.labels.usePointStyle = true;
    C.defaults.plugins.legend.labels.boxWidth = 9;
    C.defaults.plugins.legend.labels.boxHeight = 9;
    C.defaults.plugins.legend.labels.padding = 14;
    C.defaults.plugins.tooltip.backgroundColor = css('--text-primary');
    C.defaults.plugins.tooltip.titleColor = css('--surface-1');
    C.defaults.plugins.tooltip.bodyColor = css('--surface-1');
    C.defaults.plugins.tooltip.padding = 10;
    C.defaults.plugins.tooltip.cornerRadius = 8;
    C.defaults.plugins.tooltip.boxPadding = 5;
    C.defaults.plugins.tooltip.usePointStyle = true;
    C.defaults.elements.bar.borderRadius = 4;
    C.defaults.elements.bar.borderSkipped = 'bottom';
    C.defaults.elements.line.borderWidth = 2;
    C.defaults.elements.line.tension = 0.25;
    C.defaults.elements.point.radius = 0;
    C.defaults.elements.point.hoverRadius = 5;
    C.defaults.elements.point.hitRadius = 14;
  }

  function axes(opts) {
    opts = opts || {};
    return {
      x: {
        grid: { display: false },
        border: { color: css('--axis') },
        ticks: { color: css('--text-muted'), maxRotation: opts.rotate || 0, autoSkip: true }
      },
      y: {
        beginAtZero: true,
        grid: { color: css('--grid'), drawTicks: false },
        border: { display: false },
        ticks: {
          color: css('--text-muted'), padding: 8,
          callback: opts.tick || function (v) { return compact(v); }
        },
        stacked: !!opts.stacked
      }
    };
  }

  function draw(id, cfg) {
    if (charts[id]) charts[id].destroy();
    var c = el(id);
    if (!c) return;
    charts[id] = new Chart(c.getContext('2d'), cfg);
  }

  function moneyTip(suffix) {
    return function (ctx) {
      var v = ctx.parsed.y !== undefined && ctx.parsed.y !== null ? ctx.parsed.y : ctx.parsed;
      return ' ' + ctx.dataset.label + ': ' + baht(Math.round(v)) + (suffix || ' บาท');
    };
  }

  /* ================= OVERVIEW ================= */
  function renderOverview() {
    var months = activeMonths();
    var last = months[months.length - 1];
    var gmv = 0, target = 0, ads = 0, orders = 0, gmv25 = 0, orders25 = 0, cancel = 0;
    months.forEach(function (m) {
      var r = D.monthly2026.find(function (x) { return x.month === m; });
      gmv += n(r.total); ads += n(r.adsSpend);
      target += n(D.targets2026.Total ? D.targets2026.Total[m] : 0);
      orders += aggAll(2026, m, 'orders');
      gmv25 += aggAll(2025, m, 'gmv');
      orders25 += aggAll(2025, m, 'orders');
      cancel += aggAll(2026, m, 'cancelGmv');
    });
    var aov = orders ? gmv / orders : null;
    var aov25 = orders25 ? gmv25 / orders25 : null;

    el('kpiRow').innerHTML = [
      kpi('ยอดขายรวม 2026 (สะสม)', baht(Math.round(gmv)), 'บาท · ' + MON_TH[months[0]] + '–' + MON_TH[last],
        target ? meter(gmv / target, 'เทียบเป้าสะสม ' + baht(Math.round(target)) + ' บาท = ' + pct(gmv / target)) : ''),
      kpi('เทียบช่วงเดียวกันปี 2025', delta(gmv25 ? gmv / gmv25 - 1 : null), '2025 ทำได้ ' + baht(Math.round(gmv25)) + ' บาท'),
      kpi('คำสั่งซื้อ', baht(orders), orders25 ? 'ปี 2025 ช่วงเดียวกัน ' + baht(orders25) + ' · ' + delta(orders / orders25 - 1) : ''),
      kpi('ยอดเฉลี่ยต่อออเดอร์', baht(Math.round(aov)) , aov25 ? 'ปี 2025 ' + baht(Math.round(aov25)) + ' บาท · ' + delta(aov / aov25 - 1) : ''),
      kpi('ค่าโฆษณารวม', baht(Math.round(ads)), 'คิดเป็น ' + pct(gmv ? ads / gmv : null) + ' ของยอดขาย'),
      kpi('ROI เฉลี่ย', ads ? (gmv / ads).toFixed(2) + '×' : '—', 'ยอดขาย ÷ ค่าโฆษณา'),
      kpi('ยอดขายที่ถูกยกเลิก', baht(Math.round(cancel)), 'คิดเป็น ' + pct(gmv ? cancel / gmv : null) + ' ของยอดขาย')
    ].join('');

    var lastDays = daysWithSales(last);
    el('coverage').innerHTML = 'ข้อมูลถึง ' + MON_TH[last] + ' 2026 (' + lastDays + ' วัน) · อัปเดต ' + D.meta.generated;
    el('footNote').innerHTML = 'ที่มา: ' + D.meta.source + ' · สร้างโดย scripts/extract.py · ตัวเลขทั้งหมดเป็นบาท เว้นแต่ระบุไว้เป็นอย่างอื่น';

    /* monthly vs target vs 2025 */
    draw('cOverviewMonthly', {
      type: 'bar',
      data: {
        labels: MON.map(function (m) { return MON_TH[m]; }),
        datasets: [
          {
            label: 'ยอดขายจริง 2026', type: 'bar',
            data: MON.map(function (m) { var r = D.monthly2026.find(function (x) { return x.month === m; }); return has(r.total) ? r.total : null; }),
            backgroundColor: color(1), borderWidth: 0, order: 3
          },
          {
            label: 'เป้าหมาย 2026', type: 'line',
            data: MON.map(function (m) { return n(D.targets2026.Total ? D.targets2026.Total[m] : null) || null; }),
            borderColor: color(4), backgroundColor: color(4), borderWidth: 2, pointRadius: 3, order: 1
          },
          {
            label: 'ยอดจริง 2025', type: 'line',
            data: MON.map(function (m) { return aggAll(2025, m, 'gmv') || null; }),
            borderColor: css('--text-muted'), backgroundColor: css('--text-muted'),
            borderWidth: 2, borderDash: [5, 4], pointRadius: 0, order: 2
          }
        ]
      },
      options: {
        interaction: { mode: 'index', intersect: false },
        scales: axes(),
        plugins: { tooltip: { callbacks: { label: moneyTip() } } }
      }
    });

    /* platform share */
    var months26 = activeMonths();
    var shares = PLATFORMS.map(function (p) {
      var t = 0; months26.forEach(function (m) { t += agg(p, 2026, m, 'gmv'); });
      return { p: p, v: t };
    }).filter(function (x) { return x.v > 0; }).sort(function (a, b) { return b.v - a.v; });
    var totShare = shares.reduce(function (s, x) { return s + x.v; }, 0);

    draw('cPlatShare', {
      type: 'bar',
      data: {
        labels: shares.map(function (x) { return x.p; }),
        datasets: [{
          label: 'ยอดขายสะสม 2026',
          data: shares.map(function (x) { return x.v; }),
          backgroundColor: shares.map(function (x) { return platColor(x.p); }),
          borderWidth: 0
        }]
      },
      options: {
        indexAxis: 'y',
        scales: {
          x: { beginAtZero: true, grid: { color: css('--grid'), drawTicks: false }, border: { display: false }, ticks: { color: css('--text-muted'), callback: function (v) { return compact(v); } } },
          y: { grid: { display: false }, border: { color: css('--axis') }, ticks: { color: css('--text-secondary') } }
        },
        plugins: {
          legend: { display: false },
          tooltip: { callbacks: { label: function (ctx) { return ' ' + baht(Math.round(ctx.parsed.x)) + ' บาท · ' + pct(ctx.parsed.x / totShare); } } }
        }
      }
    });

    /* yearly */
    var years = [2022, 2023, 2024, 2025, 2026];
    draw('cYearly', {
      type: 'line',
      data: {
        labels: years,
        datasets: ['Tiktok', 'Shopee', 'Lazada'].map(function (p) {
          return {
            label: p,
            data: years.map(function (y) {
              var row = (D.yearly[p] || []).find(function (r) { return r.year === y; });
              return row && has(row.gmv) ? row.gmv : null;
            }),
            borderColor: platColor(p), backgroundColor: platColor(p),
            pointRadius: 3, spanGaps: true
          };
        })
      },
      options: {
        interaction: { mode: 'index', intersect: false },
        scales: axes(),
        plugins: { tooltip: { callbacks: { label: moneyTip() } } }
      }
    });

    /* table */
    var rows = MON.map(function (m) {
      var r = D.monthly2026.find(function (x) { return x.month === m; });
      var tg = n(D.targets2026.Total ? D.targets2026.Total[m] : 0);
      var g25 = aggAll(2025, m, 'gmv');
      return '<tr><td>' + MON_TH[m] + '</td>' +
        '<td>' + (has(r.total) ? baht(Math.round(r.total)) : '—') + '</td>' +
        '<td>' + (tg ? baht(tg) : '—') + '</td>' +
        '<td>' + (tg && has(r.total) ? pct(r.total / tg) : '—') + '</td>' +
        '<td>' + (g25 ? baht(Math.round(g25)) : '—') + '</td>' +
        '<td>' + (g25 && has(r.total) ? delta(r.total / g25 - 1) : '—') + '</td>' +
        '<td>' + (has(r.mom) ? delta(r.mom) : '—') + '</td>' +
        '<td>' + (r.adsSpend ? baht(Math.round(r.adsSpend)) : '—') + '</td>' +
        '<td>' + (has(r.adsPct) ? pct(r.adsPct) : '—') + '</td>' +
        '<td>' + (has(r.roi) ? r.roi.toFixed(2) + '×' : '—') + '</td></tr>';
    }).join('');
    el('tOverview').innerHTML =
      '<thead><tr><th>เดือน</th><th>ยอดขาย 2026</th><th>เป้า</th><th>% เป้า</th><th>ยอด 2025</th><th>YoY</th><th>MoM</th><th>ค่าโฆษณา</th><th>ADS%</th><th>ROI</th></tr></thead><tbody>' +
      rows + '</tbody><tfoot><tr><td>รวม</td><td>' + baht(Math.round(gmv)) + '</td><td>' + baht(Math.round(target)) + '</td><td>' + pct(target ? gmv / target : null) +
      '</td><td>' + baht(Math.round(gmv25)) + '</td><td>' + delta(gmv25 ? gmv / gmv25 - 1 : null) + '</td><td>—</td><td>' + baht(Math.round(ads)) +
      '</td><td>' + pct(gmv ? ads / gmv : null) + '</td><td>' + (ads ? (gmv / ads).toFixed(2) + '×' : '—') + '</td></tr></tfoot>';

    renderInsights(months, gmv, target, gmv25, ads, cancel);
  }

  function kpi(label, value, sub, extra) {
    return '<div class="kpi"><div class="label">' + label + '</div><div class="value">' + value + '</div>' +
      (sub ? '<div class="sub">' + sub + '</div>' : '') + (extra || '') + '</div>';
  }
  function meter(ratio, caption) {
    var w = Math.max(0, Math.min(1, ratio)) * 100;
    return '<div class="meter"><i style="width:' + w.toFixed(1) + '%"></i></div><div class="sub">' + caption + '</div>';
  }

  function renderInsights(months, gmv, target, gmv25, ads, cancel) {
    var out = [];
    var last = months[months.length - 1], prev = months[months.length - 2];
    var rl = D.monthly2026.find(function (x) { return x.month === last; });
    var rp = D.monthly2026.find(function (x) { return x.month === prev; });

    if (rl && rp && has(rl.total) && has(rp.total)) {
      var ch = rl.total / rp.total - 1;
      var dl = daysWithSales(last), dp = daysWithSales(prev);
      var perDay = (dl && dp) ? (rl.total / dl) / (rp.total / dp) - 1 : null;
      out.push(callout(ch < -0.15 ? 'crit' : (ch < 0 ? 'warn' : 'good'),
        'เดือนล่าสุด (' + MON_TH[last] + ') ' + (ch >= 0 ? 'โต' : 'ตก') + ' ' + pct(Math.abs(ch)) + ' จากเดือนก่อน',
        'ยอด ' + baht(Math.round(rl.total)) + ' บาท (' + dl + ' วัน) เทียบ ' + MON_TH[prev] + ' ' + baht(Math.round(rp.total)) + ' บาท (' + dp + ' วัน)' +
        (has(perDay) ? ' — เทียบแบบต่อวันคือ ' + delta(perDay) + ' ซึ่งเป็นตัวเลขที่ควรใช้เมื่อเดือนล่าสุดยังไม่จบ' : '')));
    }
    if (target) {
      var gap = target - gmv;
      out.push(callout(gmv / target < 0.7 ? 'crit' : (gmv / target < 0.95 ? 'warn' : 'good'),
        'ทำได้ ' + pct(gmv / target) + ' ของเป้าสะสม',
        'ต่ำกว่าเป้า ' + baht(Math.round(gap)) + ' บาท จากเป้าสะสม ' + baht(Math.round(target)) + ' บาท'));
    }
    if (cancel && gmv) {
      out.push(callout(cancel / gmv > 0.1 ? 'crit' : 'warn',
        'ยอดยกเลิก ' + pct(cancel / gmv) + ' ของยอดขาย',
        'มูลค่ารวม ' + baht(Math.round(cancel)) + ' บาท — ทุก 1% ที่กดลงได้ ≈ ' + baht(Math.round(gmv * 0.01)) + ' บาท'));
    }
    /* best/worst ROI month */
    var roiRows = months.map(function (m) { return D.monthly2026.find(function (x) { return x.month === m; }); }).filter(function (r) { return has(r.roi); });
    if (roiRows.length > 1) {
      var best = roiRows.slice().sort(function (a, b) { return b.roi - a.roi; })[0];
      var worst = roiRows.slice().sort(function (a, b) { return a.roi - b.roi; })[0];
      out.push(callout('', 'ROI สูงสุด ' + MON_TH[best.month] + ' ที่ ' + best.roi.toFixed(2) + '× · ต่ำสุด ' + MON_TH[worst.month] + ' ที่ ' + worst.roi.toFixed(2) + '×',
        'ค่าโฆษณา ' + MON_TH[best.month] + ' ' + baht(Math.round(best.adsSpend)) + ' บาท เทียบ ' + MON_TH[worst.month] + ' ' + baht(Math.round(worst.adsSpend)) + ' บาท'));
    }
    /* platform biggest YoY move */
    var moves = PLATFORMS.map(function (p) {
      var a = 0, b = 0;
      months.forEach(function (m) { a += agg(p, 2026, m, 'gmv'); b += agg(p, 2025, m, 'gmv'); });
      return { p: p, a: a, b: b, d: b ? a / b - 1 : null };
    }).filter(function (x) { return x.b > 200000 && has(x.d); }).sort(function (x, y) { return x.d - y.d; });
    if (moves.length) {
      var w = moves[0], bst = moves[moves.length - 1];
      out.push(callout(w.d < -0.2 ? 'crit' : 'warn', 'แพลตฟอร์มที่หดตัวมากที่สุด: ' + w.p + ' ' + pct(w.d),
        w.p + ' ' + baht(Math.round(w.b)) + ' → ' + baht(Math.round(w.a)) + ' บาท · โตดีที่สุดคือ ' + bst.p + ' ' + (has(bst.d) ? pct(bst.d) : '—')));
    }
    el('insights').innerHTML = out.join('');
  }
  function callout(kind, title, body) {
    return '<div class="callout ' + kind + '"><b>' + title + '</b><p>' + body + '</p></div>';
  }

  /* ================= SALES ================= */
  function buildSalesControls() {
    var sp = el('selPlatD');
    sp.innerHTML = '<option value="ALL">ทุกแพลตฟอร์ม</option>' +
      PLATFORMS.map(function (p) { return '<option value="' + p + '">' + p + '</option>'; }).join('');
    sp.value = state.dailyPlat;
    var months = activeMonths();
    state.dailyMon = state.dailyMon || months[months.length - 1];
    el('selMonD').innerHTML = months.map(function (m) { return '<option value="' + m + '">' + MON_TH[m] + '</option>'; }).join('');
    el('selMonD').value = state.dailyMon;
    sp.onchange = function () { state.dailyPlat = this.value; renderDaily(); };
    el('selMonD').onchange = function () { state.dailyMon = this.value; renderDaily(); };
    Array.prototype.forEach.call(el('segYearView').children, function (b) {
      b.onclick = function () {
        state.monPlatView = b.dataset.v;
        Array.prototype.forEach.call(el('segYearView').children, function (x) { x.setAttribute('aria-pressed', x === b); });
        renderMonthPlatTable();
      };
    });
  }

  function dailySeries(plat, year, mon) {
    var out = new Array(31).fill(null);
    var keys = plat === 'ALL' ? PLATFORMS : [plat];
    var any = false;
    keys.forEach(function (p) {
      var days = D.daily[p + '|' + year + '|' + mon];
      if (!days) return;
      Object.keys(days).forEach(function (d) {
        var i = parseInt(d, 10) - 1;
        if (i < 0 || i > 30) return;
        out[i] = n(out[i]) + n(days[d].gmv); any = true;
      });
    });
    if (!any) return new Array(31).fill(null);
    /* trailing zeros = days that have not happened yet, not a real zero */
    for (var i = out.length - 1; i >= 0; i--) {
      if (out[i] === null || out[i] === 0) out[i] = null; else break;
    }
    return out;
  }

  function renderDaily() {
    var mon = state.dailyMon, plat = state.dailyPlat;
    var s26 = dailySeries(plat, 2026, mon), s25 = dailySeries(plat, 2025, mon);
    draw('cDaily', {
      type: 'line',
      data: {
        labels: Array.from({ length: 31 }, function (_, i) { return i + 1; }),
        datasets: [
          { label: MON_TH[mon] + ' 2026', data: s26, borderColor: color(1), backgroundColor: color(1), fill: false, spanGaps: false },
          { label: MON_TH[mon] + ' 2025', data: s25, borderColor: css('--text-muted'), backgroundColor: css('--text-muted'), borderWidth: 2, borderDash: [5, 4], spanGaps: false }
        ]
      },
      options: {
        interaction: { mode: 'index', intersect: false },
        scales: axes(),
        plugins: { tooltip: { callbacks: { label: moneyTip() } } }
      }
    });
  }

  function renderSales() {
    renderDaily();
    var months = activeMonths();

    draw('cOrders', {
      type: 'bar',
      data: {
        labels: MON.map(function (m) { return MON_TH[m]; }),
        datasets: [
          { label: 'คำสั่งซื้อ 2026', data: MON.map(function (m) { return aggAll(2026, m, 'orders') || null; }), backgroundColor: color(1), borderWidth: 0 },
          { label: 'คำสั่งซื้อ 2025', data: MON.map(function (m) { return aggAll(2025, m, 'orders') || null; }), backgroundColor: css('--axis'), borderWidth: 0 }
        ]
      },
      options: {
        interaction: { mode: 'index', intersect: false },
        scales: axes({ tick: function (v) { return baht(v); } }),
        plugins: { tooltip: { callbacks: { label: function (ctx) { return ' ' + ctx.dataset.label + ': ' + baht(ctx.parsed.y) + ' ออเดอร์'; } } } }
      }
    });

    draw('cCancel', {
      type: 'bar',
      data: {
        labels: MON.map(function (m) { return MON_TH[m]; }),
        datasets: [{
          label: 'ยอดขายที่ถูกยกเลิก',
          data: MON.map(function (m) { return aggAll(2026, m, 'cancelGmv') || null; }),
          backgroundColor: css('--critical'), borderWidth: 0
        }]
      },
      options: {
        scales: axes(),
        plugins: {
          legend: { display: false },
          tooltip: {
            callbacks: {
              label: function (ctx) {
                var m = MON[ctx.dataIndex], g = aggAll(2026, m, 'gmv');
                return ' ' + baht(Math.round(ctx.parsed.y)) + ' บาท · ' + pct(g ? ctx.parsed.y / g : null) + ' ของยอดขาย';
              }
            }
          }
        }
      }
    });

    renderMonthPlatTable();

    var dd = D.dday.slice().sort(function (a, b) { return (b.gmv || 0) - (a.gmv || 0); });
    el('tDday').innerHTML = '<thead><tr><th>แคมเปญ</th><th>แพลตฟอร์ม</th><th>ปี</th><th>ยอดขาย</th><th>ออเดอร์</th><th>AOV</th><th>คลิก</th><th>ผู้เยี่ยมชม</th><th>CVR</th></tr></thead><tbody>' +
      (dd.length ? dd.map(function (r) {
        return '<tr><td>' + r.dday + '</td><td><span class="swatch" style="background:' + platColor(r.platform) + '"></span>' + r.platform + '</td><td>' + r.year + '</td>' +
          '<td>' + baht(Math.round(r.gmv)) + '</td><td>' + baht(r.orders) + '</td><td>' + baht(Math.round(r.aov)) + '</td>' +
          '<td>' + baht(r.clicks) + '</td><td>' + baht(r.visitors) + '</td><td>' + (has(r.cvr) ? pct(r.cvr) : '—') + '</td></tr>';
      }).join('') : '<tr><td colspan="9" style="text-align:center;color:var(--text-muted)">ยังไม่มีข้อมูลวันแคมเปญในไฟล์ต้นทาง</td></tr>') + '</tbody>';
  }

  function renderMonthPlatTable() {
    var v = state.monPlatView;
    var head = '<thead><tr><th>แพลตฟอร์ม</th>' + MON.map(function (m) { return '<th>' + MON_TH[m] + '</th>'; }).join('') + '<th>รวม</th></tr></thead>';
    var body = PLATFORMS.map(function (p) {
      var cells = MON.map(function (m) {
        var a = agg(p, 2026, m, 'gmv'), b = agg(p, 2025, m, 'gmv');
        if (v === '2026') return '<td>' + (a ? baht(Math.round(a)) : '—') + '</td>';
        if (v === '2025') return '<td>' + (b ? baht(Math.round(b)) : '—') + '</td>';
        return '<td>' + (a && b ? delta(a / b - 1, 0) : '—') + '</td>';
      }).join('');
      var ta = 0, tb = 0;
      MON.forEach(function (m) { ta += agg(p, 2026, m, 'gmv'); tb += agg(p, 2025, m, 'gmv'); });
      var tot = v === '2026' ? baht(Math.round(ta)) : v === '2025' ? baht(Math.round(tb)) : (ta && tb ? delta(ta / tb - 1, 0) : '—');
      return '<tr><td><span class="swatch" style="background:' + platColor(p) + '"></span>' + p + '</td>' + cells + '<td><b>' + tot + '</b></td></tr>';
    }).join('');
    var footCells = MON.map(function (m) {
      var a = aggAll(2026, m, 'gmv'), b = aggAll(2025, m, 'gmv');
      if (v === '2026') return '<td>' + (a ? baht(Math.round(a)) : '—') + '</td>';
      if (v === '2025') return '<td>' + (b ? baht(Math.round(b)) : '—') + '</td>';
      return '<td>' + (a && b ? delta(a / b - 1, 0) : '—') + '</td>';
    }).join('');
    var TA = 0, TB = 0;
    MON.forEach(function (m) { TA += aggAll(2026, m, 'gmv'); TB += aggAll(2025, m, 'gmv'); });
    var totAll = v === '2026' ? baht(Math.round(TA)) : v === '2025' ? baht(Math.round(TB)) : (TA && TB ? delta(TA / TB - 1, 0) : '—');
    el('tMonthPlat').innerHTML = head + '<tbody>' + body + '</tbody><tfoot><tr><td>รวม</td>' + footCells + '<td>' + totAll + '</td></tr></tfoot>';
  }

  /* ================= PLATFORM & ADS ================= */
  function renderPlatform() {
    draw('cStack', {
      type: 'bar',
      data: {
        labels: MON.map(function (m) { return MON_TH[m]; }),
        datasets: PLATFORMS.map(function (p) {
          return {
            label: p,
            data: MON.map(function (m) { return agg(p, 2026, m, 'gmv') || null; }),
            backgroundColor: platColor(p), borderWidth: 2, borderColor: css('--surface-1'),
            stack: 'gmv'
          };
        })
      },
      options: {
        interaction: { mode: 'index', intersect: false },
        scales: { x: axes().x, y: Object.assign(axes({ stacked: true }).y, { stacked: true }) },
        plugins: { tooltip: { callbacks: { label: moneyTip() } } }
      }
    });

    draw('cAdsSpend', {
      type: 'bar',
      data: {
        labels: MON.map(function (m) { return MON_TH[m]; }),
        datasets: [{
          label: 'ค่าโฆษณา',
          data: MON.map(function (m) { var r = D.monthly2026.find(function (x) { return x.month === m; }); return r && r.adsSpend ? r.adsSpend : null; }),
          backgroundColor: color(2), borderWidth: 0
        }]
      },
      options: {
        scales: axes(),
        plugins: {
          legend: { display: false },
          tooltip: {
            callbacks: {
              label: function (ctx) {
                var r = D.monthly2026[ctx.dataIndex];
                return ' ' + baht(Math.round(ctx.parsed.y)) + ' บาท · ' + pct(r.adsPct) + ' ของยอดขาย';
              }
            }
          }
        }
      }
    });

    draw('cRoi', {
      type: 'line',
      data: {
        labels: MON.map(function (m) { return MON_TH[m]; }),
        datasets: [{
          label: 'ROI (เท่า)',
          data: MON.map(function (m) { var r = D.monthly2026.find(function (x) { return x.month === m; }); return r && has(r.roi) ? r.roi : null; }),
          borderColor: color(3), backgroundColor: color(3), pointRadius: 4, spanGaps: true
        }]
      },
      options: {
        scales: axes({ tick: function (v) { return v.toFixed(0) + '×'; } }),
        plugins: {
          legend: { display: false },
          tooltip: {
            callbacks: {
              label: function (ctx) {
                var r = D.monthly2026[ctx.dataIndex];
                return ' ROI ' + ctx.parsed.y.toFixed(2) + '× · ADS ' + pct(r.adsPct);
              }
            }
          }
        }
      }
    });

    Array.prototype.forEach.call(el('segAdsPlat').children, function (b) {
      b.onclick = function () {
        state.adsPlat = b.dataset.v;
        Array.prototype.forEach.call(el('segAdsPlat').children, function (x) { x.setAttribute('aria-pressed', x === b); });
        renderAdsPlat();
      };
    });
    renderAdsPlat();

    draw('cShopeeCh', {
      type: 'bar',
      data: {
        labels: MON.map(function (m) { return MON_TH[m]; }),
        datasets: [
          { label: 'หน้ารายละเอียดสินค้า', field: 'chProduct', backgroundColor: color(1) },
          { label: 'Live ของร้าน', field: 'chLive', backgroundColor: color(2) },
          { label: 'วิดีโอของร้าน', field: 'chVideo', backgroundColor: color(3) },
          { label: 'พาร์ทเนอร์', field: 'chPartner', backgroundColor: color(4) }
        ].map(function (ds) {
          return Object.assign({}, ds, {
            data: MON.map(function (m) { return agg('Shopee', 2026, m, ds.field) || null; }),
            borderWidth: 0
          });
        })
      },
      options: {
        interaction: { mode: 'index', intersect: false },
        scales: axes(),
        plugins: { tooltip: { callbacks: { label: moneyTip() } } }
      }
    });
  }

  var ADS_SPEC = {
    Tiktok: {
      chart: [
        { key: 'gmvMaxGmv', label: 'GMV Max — วิดีโอ/ทั่วไป', slot: 1 },
        { key: 'gmvMaxLiveGmv', label: 'GMV Max — Live', slot: 2 }
      ],
      cols: [
        ['GMV', 'gmv', 'money'], ['เป้า', 'gmvTarget', 'money'],
        ['GMV Max รวม', 'gmvMaxAllGmv', 'money'], ['Spend รวม', 'gmvMaxAllSpend', 'money'], ['ROAS รวม', 'gmvMaxAllRoas', 'x'],
        ['GMV Max วิดีโอ', 'gmvMaxGmv', 'money'], ['Spend', 'gmvMaxSpend', 'money'], ['ROAS', 'gmvMaxRoas', 'x'],
        ['GMV Max Live', 'gmvMaxLiveGmv', 'money'], ['Spend', 'gmvMaxLiveSpend', 'money'], ['ROAS', 'gmvMaxLiveRoas', 'x'],
        ['สัดส่วน Live', 'liveRatio', 'pct'], ['C-Ads Spend', 'cAdsSpend', 'money']
      ]
    },
    Shopee: {
      chart: [
        { key: 'adsGmv', label: 'Shopee Ads', slot: 1 },
        { key: 'affGmv', label: 'Affiliate', slot: 2 },
        { key: 'cpasGmv', label: 'CPAS', slot: 3 }
      ],
      cols: [
        ['GMV', 'gmv', 'money'], ['เป้า', 'gmvTarget', 'money'],
        ['Ads GMV', 'adsGmv', 'money'], ['Ads Spend', 'adsSpend', 'money'], ['ROAS', 'roas', 'x'],
        ['Affiliate GMV', 'affGmv', 'money'], ['Spend', 'affSpend', 'money'], ['ROAS', 'roasAff', 'x'],
        ['CPAS GMV', 'cpasGmv', 'money'], ['Spend', 'cpasSpend', 'money'], ['ROAS', 'roasCpas', 'x'],
        ['ROI', 'roi', 'x'], ['เทียบเป้า', 'diffTgPct', 'delta']
      ]
    },
    Lazada: {
      chart: [
        { key: 'adsMaxGmv', label: 'Ads (Max)', slot: 1 },
        { key: 'adsAffGmv', label: 'Affiliate', slot: 2 },
        { key: 'adsKwGmv', label: 'Ads Keyword', slot: 3 }
      ],
      cols: [
        ['GMV', 'gmv', 'money'], ['เป้า', 'gmvTarget', 'money'],
        ['Ads Max GMV', 'adsMaxGmv', 'money'], ['Spend', 'adsMaxSpend', 'money'], ['ROAS', 'roas', 'x'],
        ['Affiliate GMV', 'adsAffGmv', 'money'], ['Spend', 'adsAffSpend', 'money'], ['ROAS', 'roasAff', 'x'],
        ['ROI', 'roi', 'x'], ['MoM', 'diffMoMPct', 'delta'], ['เทียบเป้า', 'diffTgPct', 'delta']
      ]
    }
  };

  function renderAdsPlat() {
    var p = state.adsPlat, spec = ADS_SPEC[p], rows = D.adsDetail[p];
    draw('cAdsPlat', {
      type: 'bar',
      data: {
        labels: MON.map(function (m) { return MON_TH[m]; }),
        datasets: spec.chart.map(function (c) {
          return {
            label: c.label,
            data: rows.map(function (r) { return has(r[c.key]) && r[c.key] ? r[c.key] : null; }),
            backgroundColor: color(c.slot), borderWidth: 2, borderColor: css('--surface-1'), stack: 'a'
          };
        }).concat([{
          label: 'GMV รวมของแพลตฟอร์ม', type: 'line',
          data: rows.map(function (r) { return has(r.gmv) && r.gmv ? r.gmv : null; }),
          borderColor: css('--text-muted'), backgroundColor: css('--text-muted'),
          borderWidth: 2, borderDash: [5, 4], pointRadius: 0
        }])
      },
      options: {
        interaction: { mode: 'index', intersect: false },
        scales: { x: axes().x, y: Object.assign(axes().y, { stacked: true }) },
        plugins: { tooltip: { callbacks: { label: moneyTip() } } }
      }
    });

    function cell(val, kind) {
      if (!has(val)) return '<td>—</td>';
      if (kind === 'money') return '<td>' + baht(Math.round(val)) + '</td>';
      if (kind === 'x') return '<td>' + val.toFixed(2) + '×</td>';
      if (kind === 'pct') return '<td>' + pct(val) + '</td>';
      if (kind === 'delta') return '<td>' + delta(val, 0) + '</td>';
      return '<td>' + val + '</td>';
    }
    el('tAdsPlat').innerHTML =
      '<thead><tr><th>เดือน</th>' + spec.cols.map(function (c) { return '<th>' + c[0] + '</th>'; }).join('') + '</tr></thead><tbody>' +
      rows.map(function (r) {
        return '<tr><td>' + MON_TH[r.month] + '</td>' + spec.cols.map(function (c) { return cell(r[c[1]], c[2]); }).join('') + '</tr>';
      }).join('') + '</tbody>';
  }

  /* ================= PRODUCTS & STOCK ================= */
  function prodTotal(p) {
    return ['Jan26', 'Feb26', 'Mar26', 'Apr26', 'May26', 'Jun26', 'Jul26'].reduce(function (s, m) { return s + n(p.qty[m]); }, 0);
  }

  function renderProducts() {
    var prods = D.products.filter(function (p) { return p.sku && p.name; });
    var totQty = prods.reduce(function (s, p) { return s + prodTotal(p); }, 0);
    var withStock = prods.filter(function (p) { return n(p.stockLBL) + n(p.stockMHC) > 0; });
    var totStock = prods.reduce(function (s, p) { return s + n(p.stockLBL) + n(p.stockMHC); }, 0);
    var moving = prods.filter(function (p) { return prodTotal(p) > 0; });
    var risky = prods.filter(function (p) {
      var st = n(p.stockLBL) + n(p.stockMHC), av = n(p.avg3m);
      return av > 0 && st / av < 1;
    });

    el('kpiProducts').innerHTML = [
      kpi('SKU ทั้งหมด', baht(prods.length), 'มีการขายจริง ' + moving.length + ' ตัว'),
      kpi('จำนวนชิ้นที่ขายได้', baht(totQty), 'สะสม ม.ค.–ก.ค. 2026'),
      kpi('สต็อกคงเหลือรวม', baht(totStock), 'ลาดบัวหลวง + มหาชัย · ' + withStock.length + ' SKU ที่มีของ'),
      kpi('SKU เสี่ยงของขาด', baht(risky.length), 'สต็อกคงเหลือ < ยอดขายเฉลี่ย 3 เดือน')
    ].join('');

    var top = moving.slice().sort(function (a, b) { return prodTotal(b) - prodTotal(a); }).slice(0, 15);
    draw('cTopSku', {
      type: 'bar',
      data: {
        labels: top.map(function (p) { return p.name; }),
        datasets: [{ label: 'จำนวนชิ้น', data: top.map(prodTotal), backgroundColor: color(1), borderWidth: 0 }]
      },
      options: {
        indexAxis: 'y',
        scales: {
          x: { beginAtZero: true, grid: { color: css('--grid'), drawTicks: false }, border: { display: false }, ticks: { color: css('--text-muted') } },
          y: { grid: { display: false }, border: { color: css('--axis') }, ticks: { color: css('--text-secondary'), font: { size: 11 } } }
        },
        plugins: {
          legend: { display: false },
          tooltip: { callbacks: { label: function (ctx) { return ' ' + baht(ctx.parsed.x) + ' ชิ้น · ' + pct(totQty ? ctx.parsed.x / totQty : null); } } }
        }
      }
    });

    var byCat = {};
    moving.forEach(function (p) { var c = p.category || 'ไม่ระบุ'; byCat[c] = (byCat[c] || 0) + prodTotal(p); });
    var cats = Object.keys(byCat).map(function (k) { return { k: k, v: byCat[k] }; }).sort(function (a, b) { return b.v - a.v; });
    draw('cCategory', {
      type: 'bar',
      data: {
        labels: cats.map(function (c) { return c.k; }),
        datasets: [{ label: 'จำนวนชิ้น', data: cats.map(function (c) { return c.v; }), backgroundColor: color(1), borderWidth: 0 }]
      },
      options: {
        indexAxis: 'y',
        scales: {
          x: { beginAtZero: true, grid: { color: css('--grid'), drawTicks: false }, border: { display: false }, ticks: { color: css('--text-muted') } },
          y: { grid: { display: false }, border: { color: css('--axis') }, ticks: { color: css('--text-secondary'), font: { size: 11 } } }
        },
        plugins: {
          legend: { display: false },
          tooltip: { callbacks: { label: function (ctx) { return ' ' + baht(ctx.parsed.x) + ' ชิ้น · ' + pct(totQty ? ctx.parsed.x / totQty : null); } } }
        }
      }
    });

    var top6 = top.slice(0, 6);
    var trendM = SKU_MONTHS.slice(4), trendTH = SKU_MONTHS_TH.slice(4);
    draw('cSkuTrend', {
      type: 'line',
      data: {
        labels: trendTH,
        datasets: top6.map(function (p, i) {
          return {
            label: p.name,
            data: trendM.map(function (m) { return has(p.qty[m]) ? p.qty[m] : null; }),
            borderColor: color(i + 1), backgroundColor: color(i + 1), pointRadius: 2, spanGaps: true
          };
        })
      },
      options: {
        interaction: { mode: 'index', intersect: false },
        scales: axes({ tick: function (v) { return baht(v); } }),
        plugins: { tooltip: { callbacks: { label: function (ctx) { return ' ' + ctx.dataset.label + ': ' + baht(ctx.parsed.y) + ' ชิ้น'; } } } }
      }
    });

    el('selStockSort').onchange = function () { state.stockSort = this.value; renderStockTable(); };
    renderStockTable();
  }

  function renderStockTable() {
    var prods = D.products.filter(function (p) { return p.sku && p.name; });
    var s = state.stockSort;
    prods = prods.slice().sort(function (a, b) {
      var sa = n(a.stockLBL) + n(a.stockMHC), sb = n(b.stockLBL) + n(b.stockMHC);
      if (s === 'run') return n(b.runScore) - n(a.runScore);
      if (s === 'stock') return sb - sa;
      if (s === 'low') {
        var ra = n(a.avg3m) > 0 ? sa / a.avg3m : 9e9, rb = n(b.avg3m) > 0 ? sb / b.avg3m : 9e9;
        return ra - rb;
      }
      return prodTotal(b) - prodTotal(a);
    });

    el('tStock').innerHTML =
      '<thead><tr><th>สินค้า</th><th>หมวด</th><th>ขนาด</th><th>ขายสะสม 2026</th><th>เฉลี่ย 3 ด.</th><th>เฉลี่ยวัน D-Day</th><th>ลาดบัวหลวง</th><th>มหาชัย</th><th>รวมสต็อก</th><th>เดือนที่ขายได้</th><th>Run Score</th></tr></thead><tbody>' +
      prods.map(function (p) {
        var st = n(p.stockLBL) + n(p.stockMHC);
        var cover = n(p.avg3m) > 0 ? st / p.avg3m : null;
        var badge = '';
        if (has(cover)) {
          badge = cover < 1 ? '<span class="pill pill-crit">⚠ เสี่ยงขาด</span>'
            : cover < 2 ? '<span class="pill pill-warn">◐ ตึง</span>'
              : '<span class="pill pill-good">✓ พอ</span>';
        }
        return '<tr><td>' + p.name + '</td><td>' + (p.category || '—') + '</td><td>' + (p.pack || '—') + '</td>' +
          '<td>' + baht(prodTotal(p)) + '</td><td>' + (has(p.avg3m) ? p.avg3m.toFixed(1) : '—') + '</td>' +
          '<td>' + (has(p.avgDday) ? p.avgDday.toFixed(1) : '—') + '</td>' +
          '<td>' + baht(p.stockLBL) + '</td><td>' + baht(p.stockMHC) + '</td>' +
          '<td>' + baht(st) + '</td>' +
          '<td>' + (has(cover) ? cover.toFixed(1) + ' ด. ' + badge : '—') + '</td>' +
          '<td>' + (has(p.runScore) ? p.runScore.toFixed(2) : '—') + '</td></tr>';
      }).join('') + '</tbody>';
  }

  /* ================= AFFILIATE ================= */
  function affMonthsSorted() {
    var order = { Jan: 0, Feb: 1, Mar: 2, Apr: 3, May: 4, Jun: 5, Jul: 6, Aug: 7, Sep: 8, Oct: 9, Nov: 10, Dec: 11 };
    return Object.keys(D.affTiktokMonthly).sort(function (a, b) {
      return order[a.split(' ')[0]] - order[b.split(' ')[0]];
    });
  }

  function renderAffiliate() {
    var ms = affMonthsSorted();
    var totGmv = 0, totComm = 0, totOrders = 0, maxCreators = 0;
    ms.forEach(function (m) {
      var r = D.affTiktokMonthly[m];
      totGmv += n(r.gmv); totComm += n(r.commission); totOrders += n(r.orders);
      maxCreators = Math.max(maxCreators, n(r.creators));
    });
    var shopeeGmv = D.affShopeeChannel.reduce(function (s, c) { return s + n(c.gmv); }, 0);
    var shopeeComm = D.affShopeeChannel.reduce(function (s, c) { return s + n(c.commission); }, 0);

    el('kpiAff').innerHTML = [
      kpi('GMV จาก TikTok Affiliate', baht(Math.round(totGmv)), 'สะสม ' + ms.length + ' เดือนที่มีข้อมูล'),
      kpi('ค่าคอมมิชชั่นที่จ่าย', baht(Math.round(totComm)), 'คิดเป็น ' + pct(totGmv ? totComm / totGmv : null) + ' ของ GMV'),
      kpi('ครีเอเตอร์สูงสุดต่อเดือน', baht(maxCreators), 'ครีเอเตอร์ที่ทำยอดได้จริง'),
      kpi('GMV จาก Shopee Affiliate', baht(Math.round(shopeeGmv)), 'ค่าคอมฯ ' + baht(Math.round(shopeeComm)) + ' บาท · ' + pct(shopeeGmv ? shopeeComm / shopeeGmv : null))
    ].join('');

    draw('cAffMonthly', {
      type: 'bar',
      data: {
        labels: ms,
        datasets: [
          { label: 'GMV จากครีเอเตอร์', data: ms.map(function (m) { return D.affTiktokMonthly[m].gmv; }), backgroundColor: color(1), borderWidth: 0 },
          { label: 'ค่าคอมมิชชั่น', data: ms.map(function (m) { return D.affTiktokMonthly[m].commission; }), backgroundColor: color(2), borderWidth: 0 }
        ]
      },
      options: {
        interaction: { mode: 'index', intersect: false },
        scales: axes(),
        plugins: { tooltip: { callbacks: { label: moneyTip() } } }
      }
    });

    draw('cAffContent', {
      type: 'bar',
      data: {
        labels: ms,
        datasets: [
          { label: 'ครีเอเตอร์', data: ms.map(function (m) { return D.affTiktokMonthly[m].creators; }), backgroundColor: color(3), borderWidth: 0 },
          { label: 'ไลฟ์', data: ms.map(function (m) { return D.affTiktokMonthly[m].lives; }), backgroundColor: color(4), borderWidth: 0 },
          { label: 'วิดีโอ', data: ms.map(function (m) { return D.affTiktokMonthly[m].videos; }), backgroundColor: color(5), borderWidth: 0 }
        ]
      },
      options: {
        interaction: { mode: 'index', intersect: false },
        scales: axes({ tick: function (v) { return baht(v); } }),
        plugins: { tooltip: { callbacks: { label: function (ctx) { return ' ' + ctx.dataset.label + ': ' + baht(ctx.parsed.y); } } } }
      }
    });

    var fol = D.affTiktokFollowers || {};
    el('tAffTop').innerHTML =
      '<thead><tr><th>ครีเอเตอร์</th><th>ผู้ติดตาม</th><th>GMV</th><th>ออเดอร์</th><th>ค่าคอมมิชชั่น</th><th>Comm. rate</th><th>สัดส่วน GMV</th></tr></thead><tbody>' +
      (function () {
        var tot = D.affTiktokTop.reduce(function (s, c) { return s + n(c.gmv); }, 0);
        return D.affTiktokTop.slice(0, 25).map(function (c) {
          return '<tr><td>' + c.name + '</td><td>' + (has(fol[c.name]) ? baht(fol[c.name]) : '—') + '</td>' +
            '<td>' + baht(Math.round(c.gmv)) + '</td><td>' + baht(c.orders) + '</td>' +
            '<td>' + baht(Math.round(c.commission)) + '</td><td>' + pct(c.gmv ? c.commission / c.gmv : null) + '</td>' +
            '<td>' + pct(tot ? c.gmv / tot : null) + '</td></tr>';
        }).join('');
      })() + '</tbody>';

    draw('cAffShopeeCh', {
      type: 'bar',
      data: {
        labels: D.affShopeeChannel.map(function (c) { return c.channel; }),
        datasets: [{
          label: 'ยอดขาย',
          data: D.affShopeeChannel.map(function (c) { return c.gmv; }),
          backgroundColor: D.affShopeeChannel.map(function (_, i) { return color(i + 1); }), borderWidth: 0
        }]
      },
      options: {
        scales: axes(),
        plugins: {
          legend: { display: false },
          tooltip: {
            callbacks: {
              label: function (ctx) {
                var c = D.affShopeeChannel[ctx.dataIndex];
                return ' ' + baht(Math.round(c.gmv)) + ' บาท · ' + baht(c.qty) + ' ชิ้น · ค่าคอมฯ ' + baht(Math.round(c.commission));
              }
            }
          }
        }
      }
    });

    var sh = D.affShopee.slice().sort(function (a, b) { return n(b.gmv) - n(a.gmv); }).slice(0, 15);
    el('tAffShopee').innerHTML =
      '<thead><tr><th>พาร์ทเนอร์</th><th>ยอดขาย</th><th>ชิ้น</th><th>ค่าคอมฯ</th><th>ROI</th><th>ผู้ซื้อ</th></tr></thead><tbody>' +
      sh.map(function (r) {
        return '<tr><td>' + r.name + '</td><td>' + baht(Math.round(r.gmv)) + '</td><td>' + baht(r.qty) + '</td>' +
          '<td>' + baht(Math.round(r.commission)) + '</td><td>' + (has(r.roi) ? r.roi.toFixed(1) : '—') + '</td><td>' + baht(r.buyers) + '</td></tr>';
      }).join('') + '</tbody>';
  }

  /* ================= shell ================= */
  var RENDERERS = {
    overview: renderOverview, sales: renderSales, platform: renderPlatform,
    products: renderProducts, affiliate: renderAffiliate
  };
  var rendered = {};

  function showTab(name) {
    activeTab = name;
    document.querySelectorAll('.tab').forEach(function (t) { t.setAttribute('aria-selected', t.dataset.tab === name); });
    document.querySelectorAll('.panel').forEach(function (p) { p.hidden = p.id !== 'panel-' + name; });
    if (!rendered[name]) { RENDERERS[name](); rendered[name] = true; }
    if (location.hash.slice(1) !== name) history.replaceState(null, '', '#' + name);
  }

  function rerenderAll() {
    applyChartDefaults();
    Object.keys(charts).forEach(function (k) { charts[k].destroy(); });
    charts = {}; rendered = {};
    RENDERERS[activeTab]();
    rendered[activeTab] = true;
  }

  function initTheme() {
    var saved = null;
    try { saved = localStorage.getItem('nola-theme'); } catch (e) { }
    if (saved) document.documentElement.setAttribute('data-theme', saved);
    el('themeBtn').onclick = function () {
      var cur = document.documentElement.getAttribute('data-theme');
      var isDark = cur ? cur === 'dark' : matchMedia('(prefers-color-scheme: dark)').matches;
      var next = isDark ? 'light' : 'dark';
      document.documentElement.setAttribute('data-theme', next);
      try { localStorage.setItem('nola-theme', next); } catch (e) { }
      rerenderAll();
    };
  }

  fetch('data/data.json', { cache: 'no-cache' })
    .then(function (r) { if (!r.ok) throw new Error('HTTP ' + r.status); return r.json(); })
    .then(function (json) {
      D = json;
      el('loading').remove();
      applyChartDefaults();
      initTheme();
      buildSalesControls();
      document.querySelectorAll('.tab').forEach(function (t) {
        t.onclick = function () { showTab(t.dataset.tab); };
      });
      var initial = location.hash.slice(1);
      showTab(RENDERERS[initial] ? initial : 'overview');
      addEventListener('resize', function () {
        Object.keys(charts).forEach(function (k) { charts[k].resize(); });
      });
    })
    .catch(function (e) {
      el('loading').innerHTML = 'โหลดข้อมูลไม่สำเร็จ: ' + e.message +
        '<br><span style="font-size:13px">ถ้าเปิดไฟล์จากเครื่องโดยตรง ให้รัน <code>python3 -m http.server</code> ในโฟลเดอร์นี้แล้วเปิดผ่าน localhost</span>';
    });
})();
