# BM33 Past-Paper Trainer

Installable offline trainer covering **two BM33 blocks**, switched with the tabs
at the top of the home screen.

**Live app → https://bingoweetiwat.github.io/immune-sum2-trainer/**

| Block | Scope | Items |
|---|---|---:|
| **Immune II** | Human Immune System Summative II — BM33 **L10–L19** | 264 (204 past-paper + 60 author-made) |
| **Pharmaco I** | Fundamental in Pharmacology Summative I — BM33 **L1–L7** | 212 (172 past-paper + 40 author-made) |

Past-paper items come from BM32, BM31, BM30, BM29, BM28 and the AX legacy bank.
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
It then launches fullscreen with its own icon and works with no internet — both
blocks' slides are cached in the background on first launch (about 15 MB).

## Cross-device sync
Progress merges question-by-question through a **private GitHub Gist**.
Tap **☁ Sync setup** and paste a token — once per device. **One token and one
gist cover both blocks**; their question ids are namespaced so they can never
collide. The token is stored only in that browser's localStorage and is never
committed here.

> ⚠️ **The token must be a “classic” token with the `gist` scope ticked.**
> **Fine-grained tokens do not work** — GitHub's Gist API does not accept them.
> Create one at <https://github.com/settings/tokens/new> and tick only `gist`.

## Layout

```
data.js         slidelist.js    slides/      Immune II bank + its slides
data_pharm.js   slidelist_p.js  slides_p/    Pharmaco I bank + its slides
index.html  app.css  app.js  sw.js  manifest.webmanifest   shared shell
```

Sources and build scripts live outside this repo, in the two blocks'
`Resources/` folders. Both builders stamp the same `sw.js` cache name, hashed
over every shell file **and both data files**, so a change to either block
reaches installed devices.
