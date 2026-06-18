/* ============================================================
   AI Career Diagnostic Coach — app.js
   Runs entirely client-side. No data leaves the browser.
   ============================================================ */
(function () {
  'use strict';

  // ----- Config ----------------------------------------------------

  // Point map for option letters.
  var POINTS = { A: 0, B: 1, C: 2, D: 3, E: 4 };

  // The 6 scored categories. Max points = 6 * 4 = 24.
  var SCORED = [
    { key: 'workflow',    label: 'AI in workflow',     blurbHi: 'AI is wired into your daily process.', blurbLo: 'AI has not yet entered your daily workflow.' },
    { key: 'projects',    label: 'AI project mgmt',    blurbHi: 'You ship real AI projects end-to-end.', blurbLo: 'You have limited hands-on AI project ownership.', isProjects: true },
    { key: 'uncertainty', label: 'Comfort w/ change',  blurbHi: 'You treat AI ambiguity as opportunity.', blurbLo: 'AI ambiguity still feels uncomfortable.' },
    { key: 'automation',  label: 'Automation lens',    blurbHi: 'You see automation surface area clearly.', blurbLo: 'You may be underestimating what AI can automate in your role.' },
    { key: 'disruption',  label: 'Disruption read',    blurbHi: 'You have a realistic 24-month outlook.', blurbLo: 'Your disruption outlook may be too conservative.' },
    { key: 'upskilling',  label: 'Upskilling cadence', blurbHi: 'Your weekly learning cadence is strong.', blurbLo: 'Your weekly upskilling time is too low to compound.' }
  ];

  // Job role labels (used in copy/output).
  var ROLE_LABEL = {
    A: 'Individual Contributor',
    B: 'Senior IC / Specialist',
    C: 'Manager',
    D: 'Tech Lead / Architect',
    E: 'Director / VP+',
    F: 'Student',
    G: 'Fresh Grad'
  };

  var EXP_LABEL = {
    A: '0–1 yr', B: '1–3 yrs', C: '3–5 yrs', D: '5–10 yrs', E: '10+ yrs'
  };

  // Persona thresholds.
  var PERSONAS = [
    { max: 25,  name: 'AI-Agnostic',
      tag: 'AI is something happening to other people — your runway is shrinking faster than it feels.' },
    { max: 50,  name: 'The Explorer',
      tag: 'You poke at the tools, but AI is not yet a system inside your workflow.' },
    { max: 75,  name: 'The Strategic Adapter',
      tag: 'AI is a daily co-worker. You are starting to redesign how you operate — not just what you do.' },
    { max: 100, name: 'The AI-Native Architect',
      tag: 'You build systems where AI is the primary collaborator. You author disruption, you do not absorb it.' }
  ];

  // Approximate calibrated peer percentile curves by role group.
  // mean = expected peer score, sd = spread; used in a normal CDF.
  var PEER_CURVES = {
    A: { mean: 48, sd: 16, label: 'Individual Contributors' },
    B: { mean: 55, sd: 16, label: 'Senior ICs' },
    C: { mean: 52, sd: 15, label: 'Managers' },
    D: { mean: 62, sd: 14, label: 'Tech Leads / Architects' },
    E: { mean: 58, sd: 15, label: 'Directors / VPs' },
    F: { mean: 42, sd: 18, label: 'Students' },
    G: { mean: 46, sd: 17, label: 'Fresh Grads' }
  };

  // ----- DOM helpers ----------------------------------------------

  function $(sel, root) { return (root || document).querySelector(sel); }
  function $$(sel, root) { return Array.prototype.slice.call((root || document).querySelectorAll(sel)); }

  // ----- Scoring core ---------------------------------------------

  function getAnswers(form) {
    var data = new FormData(form);
    var out = {};
    ['role','exp','workflow','projects','uncertainty','automation','disruption','upskilling']
      .forEach(function (k) { out[k] = data.get(k); });
    return out;
  }

  function answeredCount(form) {
    var a = getAnswers(form);
    var n = 0;
    Object.keys(a).forEach(function (k) { if (a[k]) n++; });
    return n;
  }

  function pointsFor(letter) {
    return POINTS[letter] != null ? POINTS[letter] : 0;
  }

  // Compute readiness rating with role-based modifiers.
  function computeRating(ans) {
    var isStudentLike = ans.role === 'F' || ans.role === 'G';
    var isArchitectLike = ans.role === 'D';

    var perCategory = SCORED.map(function (cat) {
      var raw = pointsFor(ans[cat.key]); // 0..4
      var weighted = raw;
      var excluded = false;
      var boosted = false;

      if (cat.isProjects) {
        if (isStudentLike) {
          // Exclude Projects entirely from numerator AND denominator.
          excluded = true;
          weighted = 0;
        } else if (isArchitectLike) {
          weighted = raw * 1.2;
          boosted = true;
        }
      }

      return {
        key: cat.key,
        label: cat.label,
        raw: raw,
        weighted: weighted,
        max: 4,
        excluded: excluded,
        boosted: boosted
      };
    });

    var sum = perCategory.reduce(function (s, c) {
      return c.excluded ? s : s + c.weighted;
    }, 0);

    var maxDen = perCategory.reduce(function (s, c) {
      return c.excluded ? s : s + c.max;
    }, 0);

    // Architect 1.2× boost can lift the Projects contribution above 4.
    // Reflect that in the denominator so a perfect-on-everything Architect
    // still tops out at 100, not >100.
    var boosted = perCategory.find(function (c) { return c.boosted; });
    if (boosted) maxDen = maxDen - 4 + (4 * 1.2);

    var pct = maxDen > 0 ? (sum / maxDen) * 100 : 0;
    pct = Math.max(0, Math.min(100, Math.round(pct)));

    return { score: pct, perCategory: perCategory, maxDen: maxDen, sum: sum, normalized: isStudentLike };
  }

  function pickPersona(score) {
    for (var i = 0; i < PERSONAS.length; i++) {
      if (score <= PERSONAS[i].max) return PERSONAS[i];
    }
    return PERSONAS[PERSONAS.length - 1];
  }

  // Normal CDF via Abramowitz & Stegun 26.2.17 approximation.
  function normalCdf(x, mean, sd) {
    var z = (x - mean) / sd;
    var t = 1 / (1 + 0.2316419 * Math.abs(z));
    var d = 0.3989423 * Math.exp(-z * z / 2);
    var p = d * t * (0.3193815 + t * (-0.3565638 + t * (1.781478 + t * (-1.821256 + t * 1.330274))));
    return z > 0 ? 1 - p : p;
  }

  function peerBenchmark(score, role) {
    var curve = PEER_CURVES[role] || PEER_CURVES.A;
    var pct = Math.round(normalCdf(score, curve.mean, curve.sd) * 100);
    pct = Math.max(1, Math.min(99, pct));
    return { percentile: pct, label: curve.label };
  }

  // Build the diagnostic summary: 2 sentences — one strength, one blind spot.
  function buildDiagnostic(perCategory) {
    var scored = perCategory.filter(function (c) { return !c.excluded; });
    var sortedHi = scored.slice().sort(function (a, b) { return b.raw - a.raw; });
    var sortedLo = scored.slice().sort(function (a, b) { return a.raw - b.raw; });
    var strength = sortedHi[0];
    var blindSpot = sortedLo[0];

    var sCat = SCORED.find(function (c) { return c.key === strength.key; });
    var bCat = SCORED.find(function (c) { return c.key === blindSpot.key; });

    return 'Strength: ' + sCat.blurbHi + ' Blind spot: ' + bCat.blurbLo;
  }

  // Build the highest-impact next step based on the weakest category.
  var NEXT_STEPS = {
    workflow:    'Pick one repetitive task you do every day this week and rebuild it with an AI assistant in the loop — measure the time delta.',
    projects:    'Scope a 14-day end-to-end AI project (real user, real ship date) and put it on your calendar before you close this tab.',
    uncertainty: 'Run one deliberate "messy" AI experiment this week where the outcome is genuinely unknown — and ship the result publicly.',
    automation:  'Audit your last 5 working days, tag every task as automatable / not, and rebuild the top 3 with AI tooling.',
    disruption:  'Write a one-page "my role in 24 months" memo. Share it with your manager and ask them to disagree.',
    upskilling:  'Block 3 hours this week on the calendar — non-negotiable — for hands-on AI practice (not videos, not articles).'
  };

  function buildNextStep(perCategory) {
    var scored = perCategory.filter(function (c) { return !c.excluded; });
    scored.sort(function (a, b) { return a.raw - b.raw; });
    return NEXT_STEPS[scored[0].key];
  }

  var REFLECTIVE = {
    workflow:    'If AI handled one task in your workflow tomorrow, which one would buy you the most focus?',
    projects:    'What is the smallest AI project you could ship in 14 days that someone outside your team would actually use?',
    uncertainty: 'What is one assumption about your job that you have not stress-tested against AI in the last 6 months?',
    automation:  'If 50% of your current work were automated next year, what would you want the remaining 50% to be?',
    disruption:  'If your role were redefined in 18 months, what would you want the new title on your business card to be?',
    upskilling:  'If you had exactly 1 hour this weekend for AI, what is the very first skill you would target?'
  };

  function buildReflective(perCategory) {
    var scored = perCategory.filter(function (c) { return !c.excluded; });
    scored.sort(function (a, b) { return a.raw - b.raw; });
    return REFLECTIVE[scored[0].key];
  }

  function buildLinkedIn(score, persona, nextStep, role) {
    var roleLabel = ROLE_LABEL[role] || 'professional';
    var lines = [
      'I just scored ' + score + '/100 on the AI Career Diagnostic — landing as "' + persona.name + '".',
      '',
      'The signal as a ' + roleLabel + ' wasn’t the score itself. It was the blind spot it surfaced.',
      '',
      'My next 14 days: ' + nextStep,
      '',
      'If you lead people or projects, the question isn’t "are you using AI?" — it’s "is AI changing what you ship?"',
      '',
      '#AI #FutureOfWork #CareerGrowth'
    ];
    return lines.join('\n');
  }

  // ----- UI binding -----------------------------------------------

  var form = $('#quiz');
  var qpFill = $('#qpFill');
  var qpCount = $('#qpCount');
  var errorEl = $('#quizError');
  var results = $('#results');

  function updateProgress() {
    var n = answeredCount(form);
    qpCount.textContent = String(n);
    qpFill.style.width = (n / 8 * 100) + '%';
  }

  form.addEventListener('change', updateProgress);
  form.addEventListener('reset', function () {
    setTimeout(function () {
      updateProgress();
      results.hidden = true;
      errorEl.hidden = true;
    }, 0);
  });

  form.addEventListener('submit', function (e) {
    e.preventDefault();
    var ans = getAnswers(form);
    var missing = Object.keys(ans).filter(function (k) { return !ans[k]; });
    if (missing.length) {
      errorEl.hidden = false;
      // Scroll to the first unanswered question.
      var first = $('[data-q="' + missing[0] + '"]');
      if (first) first.scrollIntoView({ behavior: 'smooth', block: 'center' });
      return;
    }
    errorEl.hidden = true;
    render(ans);
  });

  function render(ans) {
    var result = computeRating(ans);
    var persona = pickPersona(result.score);
    var diagnostic = buildDiagnostic(result.perCategory);
    var nextStep = buildNextStep(result.perCategory);
    var bench = peerBenchmark(result.score, ans.role);
    var linkedin = buildLinkedIn(result.score, persona, nextStep, ans.role);
    var reflective = buildReflective(result.perCategory);

    // Reveal & populate.
    results.hidden = false;

    // Animated number + ring.
    animateNumber($('#scoreNum'), 0, result.score, 900);
    var circ = 2 * Math.PI * 52;
    var offset = circ * (1 - result.score / 100);
    var fg = $('#ringFg');
    // small reflow to retrigger transition reliably
    fg.style.strokeDashoffset = String(circ);
    requestAnimationFrame(function () { fg.style.strokeDashoffset = String(offset); });
    fg.style.stroke = strokeForScore(result.score);
    $('#scoreSub').textContent = result.normalized ? 'Readiness (normalized)' : 'Readiness Rating';

    $('#personaName').textContent = persona.name;
    $('#personaTag').textContent = persona.tag;
    $('#benchmark').textContent =
      'Higher than ' + bench.percentile + '% of ' + bench.label + ' on this diagnostic.';

    $('#diagnosticText').textContent = diagnostic;
    $('#nextStepText').textContent = nextStep;
    $('#linkedinText').textContent = linkedin;
    $('#reflectiveQ').textContent = reflective;

    // Breakdown.
    var list = $('#breakdownList');
    list.innerHTML = '';
    result.perCategory.forEach(function (c) {
      var li = document.createElement('li');
      li.className = 'bd-row' + (c.boosted ? ' boosted' : '') + (c.excluded ? ' excluded' : '');
      var pct = c.excluded ? 0 : Math.round((c.weighted / (c.boosted ? 4.8 : 4)) * 100);
      li.innerHTML =
        '<span class="bd-name">' + c.label + '</span>' +
        '<span class="bd-bar"><span style="width:' + pct + '%"></span></span>' +
        '<span class="bd-val">' + (c.excluded ? 'n/a' : (Math.round(c.weighted * 10) / 10) + ' / ' + (c.boosted ? '4.8' : '4')) + '</span>';
      list.appendChild(li);
    });
    $('#breakdownNote').textContent =
      result.normalized
        ? 'Projects category excluded from denominator (Student / Fresh Grad normalization). Effective max: ' + Math.round(result.maxDen) + ' points.'
        : 'Effective max: ' + Math.round(result.maxDen * 10) / 10 + ' points across ' + result.perCategory.filter(function(c){return !c.excluded}).length + ' categories.';

    // JSON output (front-end / API friendly).
    var payload = {
      rating: result.score,
      persona: persona.name,
      role: ROLE_LABEL[ans.role] || null,
      experience: EXP_LABEL[ans.exp] || null,
      diagnostic: diagnostic,
      next_step: nextStep,
      benchmark: {
        percentile: bench.percentile,
        peer_group: bench.label
      },
      breakdown: result.perCategory.map(function (c) {
        return {
          category: c.label,
          raw: c.raw,
          weighted: Math.round(c.weighted * 100) / 100,
          max: c.boosted ? 4.8 : 4,
          excluded: c.excluded,
          boosted: c.boosted
        };
      }),
      reflective_question: reflective,
      linkedin: linkedin
    };
    $('#jsonOut').textContent = JSON.stringify(payload, null, 2);

    // Scroll into view.
    setTimeout(function () {
      results.scrollIntoView({ behavior: 'smooth', block: 'start' });
    }, 80);
  }

  function strokeForScore(s) {
    if (s >= 76) return '#34d399';   // AI-Native — green
    if (s >= 51) return '#7c5cff';   // Strategic Adapter — violet
    if (s >= 26) return '#22d3ee';   // Explorer — cyan
    return '#fb7185';                // AI-Agnostic — rose
  }

  function animateNumber(el, from, to, dur) {
    var start = performance.now();
    function tick(now) {
      var t = Math.min(1, (now - start) / dur);
      var eased = 1 - Math.pow(1 - t, 3);
      el.textContent = String(Math.round(from + (to - from) * eased));
      if (t < 1) requestAnimationFrame(tick);
    }
    requestAnimationFrame(tick);
  }

  // ----- Copy buttons ---------------------------------------------

  function bindCopy(btnId, labelId, sourceId) {
    var btn = $('#' + btnId);
    var label = $('#' + labelId);
    if (!btn || !label) return;
    btn.addEventListener('click', function () {
      var src = $('#' + sourceId);
      if (!src) return;
      var text = src.textContent || '';
      var done = function () {
        var prev = label.textContent;
        label.textContent = 'Copied!';
        btn.disabled = true;
        setTimeout(function () { label.textContent = prev; btn.disabled = false; }, 1600);
      };
      if (navigator.clipboard && navigator.clipboard.writeText) {
        navigator.clipboard.writeText(text).then(done).catch(fallbackCopy);
      } else {
        fallbackCopy();
      }
      function fallbackCopy() {
        var ta = document.createElement('textarea');
        ta.value = text;
        ta.setAttribute('readonly', '');
        ta.style.position = 'absolute';
        ta.style.left = '-9999px';
        document.body.appendChild(ta);
        ta.select();
        try { document.execCommand('copy'); done(); } catch (_) {}
        document.body.removeChild(ta);
      }
    });
  }

  bindCopy('copyLinked', 'copyLabel', 'linkedinText');
  bindCopy('copyJson',   'copyJsonLabel', 'jsonOut');

  // ----- Footer year ----------------------------------------------
  var yr = $('#yr');
  if (yr) yr.textContent = String(new Date().getFullYear());

  // Init.
  updateProgress();
})();
