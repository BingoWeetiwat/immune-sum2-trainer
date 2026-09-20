# BM33 Past-Paper Trainer

Installable offline trainer covering **three BM33 blocks**, switched with the tabs
at the top of the home screen.

**Live app → https://bingoweetiwat.github.io/immune-sum2-trainer/**

| Block | Scope | Items |
|---|---|---:|
| **Immune II** | Human Immune System Summative II — BM33 **L10–L19** | 264 (204 past-paper + 60 author-made) |
| **Pharmaco I** | Fundamental in Pharmacology Summative I — BM33 **L1–L7** | 234 (194 past-paper + 40 author-made) |
| **Infectious** | General Principles of Infectious Diseases Summative I — BM33 **L1–L14 + Labs 1–5** | 515 (162 past-paper + 353 author-made) |

Past-paper items come from BM32, BM31, BM30, BM29, BM28 and the legacy banks
(AX for immune/pharmaco, หลักสูตร 54 for infectious).
**Every past-paper item names the cohort and question number it came from**, and
the BM33 source slide is shown on the answer card.

Answers are verified against the BM33 lecture decks and standard textbooks rather
than copied from student keys — BM32 has no key at all, and the AX bank's own
compiler warns that its keys were never checked. Where a key looks wrong, or more
than one answer is defensible, it is stated openly (⚠).

### A note on the Pharmaco lecture mapping
Chemotherapy and glucocorticoids sat in the **older cohorts' Summative II**, so
those items are harvested from their SUM 2 papers and re-mapped onto BM33's L6
and L7. Conversely, the sympathomimetic / parasympatholytic blocks inside those
same papers are BM33 **Summative II** material and are deliberately excluded.

## Install on iPhone / iPad
Open the link in **Safari** → **Share** → **Add to Home Screen**.
It then launches fullscreen with its own icon and works with no internet — all
three blocks' slides are cached in the background on first launch (about 28 MB).

## Cross-device sync
Progress merges question-by-question through a **private GitHub Gist**.
Tap **☁ Sync setup** and paste a token — once per device. **One token and one
gist cover all three blocks**; their question ids are namespaced so they can never
collide. The token is stored only in that browser's localStorage and is never
committed here.

> ⚠️ **The token must be a “classic” token with the `gist` scope ticked.**
> **Fine-grained tokens do not work** — GitHub's Gist API does not accept them.
> Create one at <https://github.com/settings/tokens/new> and tick only `gist`.

## Layout

```
data.js         slidelist.js    slides/      Immune II bank + its slides
data_pharm.js   slidelist_p.js  slides_p/    Pharmaco I bank + its slides
data_infect.js  slidelist_i.js  slides_i/    Infectious bank + its slides
index.html  app.css  app.js  sw.js  manifest.webmanifest   shared shell
```

⚠️ **All three builders must hash the same file set** when they restamp the `sw.js`
cache name, or they stamp different names and thrash each other on every build.
The set is the ten shell + data files; it is written out identically in
`build_app2.py`, `build_app.py` and `build_app_infect.py`.

⚠️ `4. Infectious/_mcq_toolkit/letters_lock_infect.json` pins the correct letter of
every Infectious item that has shipped. The app stores the LETTER an item was
answered with, and the local trainer builder reshuffles a lecture's letters
whenever its question count changes. **Never delete that lock.**

Sources and build scripts live outside this repo:

```
2. Human Immune System/Immune Sum II Past Paper Trainer/Resources/build_app2.py
3. Pharmaco/Pharmaco Sum I Past Paper Trainer/Resources/build_app.py
4. Infectious/_mcq_toolkit/build_app_infect.py
```

All three stamp the same `sw.js` cache name, hashed over every shell file **and
all three data files**, so a change to any block reaches installed devices.

## The practical-exam simulator (Infectious only)

`practical.html` is a second page in this app: **267 photo stations across Labs
1–5**, where you type the scientific name and stage rather than picking an option,
against a countdown, and grade yourself against the key points the paper marks.
It is reached from the 🔬 tile on the Infectious block's home screen.

Its photographs are public-domain **CDC DPDx** figures plus openly-licensed
**Wikimedia Commons** files, served from `practical_img/` (263 webp, ~6 MB) and
listed in `practical_list.js` so the service worker warms them like the slides.
Progress lives under `infect_lab_v1_sim`.

⚠️ The service worker used to cache every navigation as `index.html`. With a
second page that would have replaced the app shell with the practical page the
first time it was opened, so navigations are now cached under their own URL with
`index.html` kept as the offline fallback.
