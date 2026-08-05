# Daylight — frontend

A single-page habit check. Four files, no build step, no npm.

```
daylight/
├── index.html
├── style.css
├── script.js
└── README.md
```

This README is for you. **Nothing about the backend, the model, or the stack
appears anywhere on the page itself** — the visitor sees a wellbeing tool, not a
machine learning demo. Error messages are plain English; anything technically
useful is written to the browser console under `[Daylight]`.

---

## Running it

1. Start the backend from the folder holding `main.py` and `Mental_health_model.pkl`:

   ```bash
   uvicorn main:app --reload
   ```

2. Serve this folder over HTTP — **don't double-click `index.html`.** Chrome
   blocks `fetch` from `file://` pages, so the request never leaves the browser:

   ```bash
   cd daylight
   python -m http.server 5500
   ```

3. Open **http://localhost:5500**

If the service is unreachable a thin bar appears at the top of the page. That's
the only connectivity signal the visitor gets.

### Pointing at a deployed backend

One line, top of `script.js`:

```js
const API_BASE = 'http://127.0.0.1:8000'
```

Then tighten CORS in `main.py` from `allow_origins=["*"]` to your real frontend
origin before it goes anywhere public.

---

## ⚠️ One bug in Old_main.py — `/predict` fails until you fix it

Your pipeline was trained with a column named **`grouped_countries`**, but
`main.py` builds the DataFrame with `Grouped_country`. Every request currently
raises:

```
ValueError: columns are missing: {'grouped_countries'}
```

Because FastAPI omits CORS headers on unhandled exceptions, the browser sees this
as a network failure rather than a 500 — which is why it can look like the server
is down when it isn't.

In the `input_data` dictionary, change:

```python
'Grouped_country'    :country_group    # Old_main.py
'grouped_countries'  :country_group    # main.py
```

That's the only change needed. Verified directly against your `.pkl`.

---

## Notes on the model, for your reference

**The score is out of 10, not 100.** Predictions land roughly between 3.6 and
9.4. The three bands in the UI use the quartiles from your training data rather
than invented cut-offs:

| Band | Range | Meaning |
|---|---|---|
| Running low | below 5.1 | bottom quarter |
| Steady | 5.1 – 7.1 | middle half |
| Thriving | above 7.1 | top quarter |

**What actually moves the prediction**, measured against your model with
everything else held at the median:

| Change | Score |
|---|---|
| Phone time 2h → 8h | 7.83 → 5.48 |
| Sleep 4.5h → 8.5h | 5.92 → 6.76 |
| Stress Low → Very High | 6.27 → 6.18 |

Phone time dominates. Stress barely registers, despite being an input.

**Country** is free text. Your backend already folds anything outside its
`top_countries` list into `"Other"`, and the encoder uses
`handle_unknown='ignore'`, so any spelling is safe. It also barely affects the
result — India vs Other vs Spain differed by about 0.01.

---

## What the page does

- **Three-step flow** — You → Screens → Your day, with a progress bar you can
  click backwards through. Answers are validated per step.
- **Sliders instead of number boxes**, each with a live value bubble and a
  "most people say 6–8 hours" hint for context.
- **Tap-to-pick answers** replace four dropdowns.
- **A live 24-hour ribbon** showing where the hours go, with a gentle nudge if
  they add up to more than a day.
- **A sunrise result.** The sun's height along the arc is the score — low sits on
  the horizon under a starry sky, high climbs toward noon as the sky warms. The
  accent colour spreads from there into the rest of the page.
- **"What a small change would do"** — three extra scores for the same day with
  one thing altered (an hour more sleep, an hour less phone, thirty minutes more
  movement), shown as real differences.
- **Recent checks** kept in `localStorage` only, clearable.
- Save a plain-text copy, toasts, full keyboard support, and
  `prefers-reduced-motion` respected throughout.

## Customising

- **Copy** lives in `index.html` — headlines, questions, hints.
- **Band names, colours and messages** are the `BANDS` array in `script.js`.
- **Palette** is the `:root` block at the top of `style.css`. The whole theme
  runs off six colour variables: `--sage` (primary), `--sage-soft`, `--honey`,
  `--clay`, `--lilac` and `--sun`.

## A note on the theme

Light, warm and low-contrast on purpose. A tool that asks someone about their
sleep and stress shouldn't look like a dashboard or a medical form, so: soft
paper background with a fine grain, deep sage as the primary colour, and honey
and clay for the result bands — warm enough to feel kind, muted enough that a
low score never reads as an alarm.

The result sky is the only dark object on the page. It brightens from twilight
to clear morning as the score climbs, which makes it the focal point precisely
because everything around it is pale and quiet.
