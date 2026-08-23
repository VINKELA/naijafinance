# NF-5 / NF-6 Data-Source Licensing Assessment + NGX Delayed-Data Engagement Prep

| | |
|---|---|
| **Author** | CTO (research subagent prep, CTO sign-off pending) |
| **Date** | 2026-08-04 |
| **Status** | **FINAL — CTO sign-off 2026-08-03; for CEO / Compliance review** |
| **Risk-register items** | NF-5 (scraping CSCS / Google Finance with no source ToS/licence on file), NF-6 (login-based scraping ToS / anti-bot exposure) — owner: CTO, due 2026-08-04 |
| **Related spec gate** | F-01 / Gate G3 — "licensed or public-compliant feeds only"; login-scraping must retire; NGX delayed quotes (30-min) require delayed-display licence or authorized-vendor pass-through |
| **Scope note** | Research-only. No external contact made. All prices/terms not confirmed online are marked **VERIFY** and are **not** to be treated as real until confirmed by NGX/FMDQ etc. |

---

## 1. Risk summary

### NF-5 — Unlicensed/undocumented source ingestion (CSCS + Google Finance)
**Status: OPEN — HIGH — remediation path identified, work starts on the licence engagement (see §4).**

- Current ingestion scrapes (a) Google Finance public pages for NGX equities and (b) CSCS (Nigerian securities depository) behind a login. Neither source has a ToS or licence on file.
- **Google Finance**: Google's Terms of Service (policies.google.com/terms, retrieved 2026-08-03) expressly prohibit "using automated means to access content from any of our services in violation of the machine-readable instructions on our web pages" and list "scraping content that doesn't belong to you" as abusive conduct, alongside prohibitions on misrepresenting identity and disrupting services. Google Finance has **no official public API** (the Finance API was discontinued years ago — VERIFY exact date). Google's `robots.txt` does **not** disallow `/finance` (so the "machine-readable instructions" clause may not directly bite), but the general anti-scraping and "content that doesn't belong to you" clauses still apply, and Google data shown on Finance is itself exchange-licensed data — scraping it gives us **no licence from NGX** and a **dubious position vs Google**.
- **CSCS login scraping (NF-6)**: requires account credentials (shared/automated use breaches most ToS), is anti-bot exposed (CAPTCHA/IP blocks), and has no licence basis. G3 mandates retirement of all login-based scraping. **Verdict: NO-GO — retire, do not extend.**
- **Known precedent (context, not legal advice; VERIFY citations before external use):** US case law distinguishes criminal/CFAA exposure from contract exposure — *hiQ v. LinkedIn* (9th Cir. 2022): scraping publicly available data is not "unauthorized access" under CFAA; but a 2024 jury verdict held hiQ in **breach of contract** with LinkedIn. *Meta v. Bright Data* (9th Cir. 2023): public-data scraping is not a CFAA violation. Net position for us: scraping public pages is rarely a *crime*, but is a **contract breach risk** and, for exchange data, an **IP/licensing breach** — which is exactly what G3 is designed to eliminate.

### NF-6 — Login-based scraping ToS / anti-bot exposure
**Status: OPEN — HIGH — remediated by G3 (retire CSCS login scraping; replace with licensed feeds).** Residual risk: shared-credential exposure, blocked IPs, and data-provenance untraceability. Action: decommission before Sprint-1 F-04..F-06 integration of replacement sources; keep credentials out of repos; no new login-scraping pipelines.

### G3 verdict per source (summary)
| Source | G3 verdict |
|---|---|
| NGX 30-min delayed via NGX's own public website | CONDITIONAL (public-display intent, but redistribution of NGX IP must be confirmed) |
| NGX delayed/EOD via official NGX REST API | GO (pending rate-card + delayed-display licence) |
| NGX X-DataPortal subscription | LIVE at dataportal.ngxgroup.com (HTTP 200, verified 2026-08-03); xdataportal.com is a dead alias — use the ngxgroup.com subdomain |
| NGX authorized vendor pass-through (Bloomberg/FactSet/ICE/LSEG/SIX/GTN) | CONDITIONAL (GO only if real-time becomes a requirement; cost-prohibitive for consumer product) |
| Google Finance scraping | NO-GO |
| CSCS login scraping | NO-GO (G3 mandate) |
| DMO (FGN bond auction calendar/results, NTB, Savings Bond circulars) | GO (public government data) |
| CBN NFEM official FX | GO (public official data) |
| FMDQ (bond yields/depth) | CONDITIONAL (subscription portal; redistribution terms needed) |
| AFEX commodity prices | CONDITIONAL (public daily prices; API/ToS unverified — site unreachable from research sandbox) |
| SEC NAV disclosures (CIS weekly, ETF monthly) | GO (public regulator disclosure; note granularity — weekly/monthly, not daily) |

---

## 2. Options table

| # | Source | Licence type | Indicative cost | ToS status | G3 verdict | Notes |
|---|---|---|---|---|---|---|
| 1 | **NGX delayed quotes (30-min)** via ngxgroup.com public pages | Display on own site implied by NGX ("Prices displayed on this website are delayed by 30 minutes… subscribe to X-DataPortal, contact your stockbroker or registered Data Vendors") — but NGX states market data is NGX IP; redistribution licence required for passing data to third parties | Free to view; redistribution fee **VERIFY** | NGX site terms; data is NGX IP | **CONDITIONAL** | Cleanest interim display source while licence is negotiated; do NOT build product on it without written redistribution confirmation |
| 2 | **NGX delayed/EOD via official NGX API** (REST, JSON/XML) | Display licence (delayed/EOD tier). Brochure: "API Infrastructure … available to a range of developers for the display of Real Time, Delayed or End of Day data on Web-friendly applications" | Not published; request rate card **VERIFY** | Official channel — expected to be clean | **GO** | Preferred F-01 path; ask about delayed-display tier, JSON/XML, call limits, SLAs |
| 3 | **NGX X-DataPortal** (dataportal.ngxgroup.com — reachable 2026-08-03) | Self-serve subscription; instant purchase of data; free 7-day historical; Equity Level-1 Historical & Real-Time; EOD statistics, sectoral, broker performance | "Affordable rate" (NGX wording); numbers **VERIFY** (portal is self-serve/pay) | Official channel | **GO** | Cheapest self-serve option; good for EOD + historical while delayed-display licence is negotiated |
| 4 | **NGX real-time via authorized vendors** (Bloomberg L.P., FactSet UK, GTN, ICE Data Services, LSEG Data & Analytics, SIX) | Distribution/display licence via vendor; "A distribution license is required of any entity that passes NGX real-time data to third parties or clients in any format" | High (enterprise); **VERIFY** | Official channel | **CONDITIONAL** | Overkill for consumer MVP; revisit only if real-time becomes a paid feature |
| 5 | **NGX local software vendors** (SecondStax, Zanibal, Caladata, Infoware, Neulogic, Batex, Global Trybe, etc.) | Potential integration/pass-through partners | **VERIFY** | Official list | **CONDITIONAL** | May offer cheaper pass-through than global vendors; second-pass candidates |
| 6 | **Google Finance scraping** | None available (no API; ToS prohibits scraping/automation) | — | Prohibited (see §1) | **NO-GO** | Retire; also yields no NGX licence |
| 7 | **CSCS login scraping** | None | — | Breach risk + anti-bot | **NO-GO** | G3 retirement mandate |
| 8 | **DMO** (dmo.gov.ng — FGN Bonds Issuance Calendar, Bonds Auction Results, Offer Circulars, NTB, Savings Bond circulars) | Government public data; no licence required for factual auction data (standard media practice) | Free | Public; "All Rights Reserved" site footer applies to site content, not to published facts (VERIFY legal reading) | **GO** | Sprint-1 F-04 needs (auction calendar, results); stable HTML + PDF/XLSX |
| 9 | **CBN NFEM FX** (cbn.gov.ng/rates/ExchRateByCurrency.html — "Export to Excel" available) | Official public data; widely republished | Free | Public government data | **GO** | Official rate = volume-weighted average (NFEM); HTML table scrapable but prefer CBN-published files |
| 10 | **FMDQ** (fmdqgroup.com/exchange/market-data/) | "Market Data Subscription" via e-Markets Portal; data-distributor terms for redistribution | Not published; **VERIFY** via info@fmdqgroup.com | Terms of Use / Disclaimer on site | **CONDITIONAL** | Sprint-2 bond depth; co-branded S&P DJI indices exist; ask for redistribution terms, not just display |
| 11 | **AFEX** (afexnigeria.com) | Public daily commodity prices; possible public API | Free/public; API **VERIFY** | Site unreachable from research sandbox (HTTP 502) — re-check from Nigeria/alternate network | **CONDITIONAL** | Commodity prices for later sprints; verify ToS + API before integration |
| 12 | **SEC NAV** (sec.gov.ng → Keep Track of Capital Market Data → Net Asset Value Data) | Public regulator disclosure | Free | Public; SEC Terms of Use apply | **GO** | Weekly NAV for CIS, monthly for ETF/CIS — NOT daily; daily NAV must come from fund managers/NGX fund pages (VERIFY) |

---

## 3. Recommendation — F-01 NGX delayed quotes

**Recommended path (in order):**

1. **Primary — NGX direct delayed-display licence via official API (§2 #2).** NGX has an official REST API (JSON/XML) expressly built for "display of Real Time, Delayed or End of Day data on Web-friendly applications" — this is the designed-in solution for a consumer web/mobile quotes product. Pursue a **delayed-display licence** (not real-time, not redistribution) — smallest licence scope, lowest expected cost, full compliance.
2. **Fallback — X-DataPortal subscription (§2 #3)** for EOD quotes + historical data (free 7-day historical; paid self-serve products) if the delayed-display API tier is unavailable or uneconomic at MVP stage.
3. **Interim — NGX public 30-min delayed pages (§2 #1)** as the *only* immediate display source *only* under the following conditions: label quotes as 30-min delayed, attribute NGX, do not repackage/sell the feed, and treat it as temporary until #1 or #2 is signed. Confirm redistribution position in the same outreach — do not assume.
4. **Explicitly excluded:** Google Finance scraping and CSCS login scraping (both NO-GO; retirement required by G3 regardless of licence outcome).
5. **Defer real-time** (§2 #4) to a later phase — vendor pass-through is enterprise-priced and out of scope for F-01 economics.

**Decision needed from CEO (with this doc):** approve the outreach to NGX (draft in §4) and the budget envelope to be confirmed for the delayed-display licence once the rate card is received (no binding commitment until rates are known).

---

## 4. Draft NGX outreach note — **FOR CTO REVIEW ONLY — DO NOT SEND**

> Subject: Enquiry — NGX delayed market-data display licence for a consumer finance application
>
> To: NGX Market Services / Data Services (contactcenter@ngxgroup.com; +234 (700) 225-5649 — primary site contacts, VERIFY current routing)
>
> We are a Nigerian fintech building a consumer market-data product (equities quotes, delayed). We wish to engage NGX on a licensed data relationship and would appreciate the following:
>
> 1. **Rate card / Market Data Pricelist** for delayed data (30-minute) display licences and, if available, End-of-Day historical data (current version of the pricelist referenced on ngxgroup.com/exchange/data/historical-data/).
> 2. **Delayed-display licence terms** — scope of use for a consumer web/mobile application; number of end-user displays permitted; attribution and "delayed 30 minutes" labelling requirements.
> 3. **API availability** — the NGX API (REST, JSON/XML) for Delayed/EOD display: access terms, data points available, call/volume limits, and whether the delayed tier can be contracted directly (vs. X-DataPortal subscription).
> 4. **Redistribution rights** — explicit confirmation of whether displaying delayed quotes inside our application (free to end users) requires a redistribution licence or is covered by a display licence.
> 5. **X-DataPortal** — self-serve subscription pricing for Equity Level-1 Historical / Real-Time products and EOD statistics.
> 6. **Timeline** — indicative contracting-to-live timeline and any onboarding/technical certification steps (e.g., feed testing, sandbox).
>
> We are not requesting real-time data at this stage. Please also confirm the correct contact for data licensing (the public site lists contactcenter@ngxgroup.com; the Market Data Services brochure lists +234 1 4485857 / Marketservices@nse.com.ng, which appears dated — VERIFY).

---

## 5. VERIFY list (every fact not confirmed from a cited, retrieved source)

1. **NGX pricing** — no figures published online; "Market Data Pricelist" page exists (ngxgroup.com/exchange/data/data-pricing-policies-contracts/) but renders empty; historical-data page links a pricelist document (referenced, not yet retrieved — retrieve in outreach). All costs in §2 are unconfirmed.
2. **NGX API currency** — the REST API (RT/Delayed/EOD display, JSON/XML) is documented in the NGX "Market Data Services" brochure (PDF via ngxgroup.com `/?wpdmdl=26972`, retrieved 2026-08-03); brochure is NSE-branded/older (mentions 2017–2018) — confirm the API is still offered, current endpoints, and terms.
3. **NGX contact routing** — contactcenter@ngxgroup.com / +234 (700) 225-5649 (current site footer); Market Services Dept +234 1 4485857 / Marketservices@nse.com.ng (brochure, likely legacy).
4. **Google Finance API status** — no official public API today; exact discontinuation date VERIFY (widely documented as years ago).
5. **Case-law specifics** — hiQ v. LinkedIn (9th Cir. 2022 CFAA holding; 2024 jury verdict for LinkedIn on contract breach — amounts/penalties VERIFY before citing externally); Meta v. Bright Data (9th Cir. 2023). Nigeria-specific position under the Cybercrime Act 2015 / contract law is **not assessed** — obtain Nigerian counsel's view before relying on any precedent.
6. **Google robots.txt** — `/finance` not disallowed in www.google.com/robots.txt (checked 2026-08-03); finance.google.com/robots.txt returns 404. This may weaken the "machine-readable instructions" clause; do not rely on it.
7. **AFEX** — site returned HTTP 502 from the research sandbox (2026-08-03); public daily prices, any public API (api.afexnigeria.com), and ToS all unverified; re-check from a Nigerian or alternate network.
8. **FMDQ** — subscription pricing, e-Markets Portal access model, and data-distributor terms not published (site pages retrieved: fmdqgroup.com/exchange/market-data/).
9. **CBN** — NFEM page retrieved (HTML table + "Export to Excel"); official rate = volume-weighted average; no official API known (VERIFY); redistribution terms of official government data not formally stated (standard practice = free).
10. **DMO** — FGN Bonds Issuance Calendar / Auction Results / Offer Circulars / NTB / Savings Bond pages confirmed live; "All Rights Reserved" footer — legal reading that factual auction data is freely reusable VERIFY with counsel.
11. **SEC NAV** — page confirmed: Weekly NAV (CIS), Monthly NAV (ETF), Monthly NAV (CIS); file formats (XLSX?) VERIFY; daily NAV sources for funds VERIFY (fund managers / NGX fund pages).
12. **X-DataPortal** — dataportal.ngxgroup.com reachable (HTTP 200); product list and free 7-day historical from the NGX page; portal pricing requires account — VERIFY.
13. **NGX delayed-licence existence** — NGX site implies delayed display is the public default and real-time requires subscription/vendor; the existence/price of a formal "delayed display licence" as a distinct product is **the key open question** (see §6).
14. **NGXGROUP self-listing / contact-person changes** — any recent org changes affecting the data-services desk VERIFY at outreach time.

---

## 6. Single biggest open question (for CEO / NGX)

> **Does NGX sell a formal 30-minute delayed-data display licence for consumer web/mobile applications, and at what rate — or is delayed display covered only by X-DataPortal subscriptions and vendor pass-through?**

This determines whether F-01 takes the cheap direct-API path (recommended), the portal path, or must fall back to an interim public-display position while negotiating. Everything else (FMDQ, CBN, DMO, SEC, AFEX) is either GO or low-risk CONDITIONAL with identified owners.

---

## 7. Sources retrieved (2026-08-03, all public)

- ngxgroup.com — home; /exchange/data/ pages (real-time, historical, X-DataPortal, vendors-list, equities-price-list); "Market Data Services" brochure PDF (wpdmdl=26972); vendors list incl. authorized real-time data vendors + software vendors.
- policies.google.com/terms — ToS anti-scraping/automation clauses.
- cbn.gov.ng/rates/ExchRateByCurrency.html — NFEM official FX page.
- dmo.gov.ng — FGN bonds calendar/auction results/NTB/Savings Bond sections.
- fmdqgroup.com/exchange/market-data/ — Market Data Subscription, e-Markets Portal, S&P DJI indices.
- sec.gov.ng — Net Asset Value Data page (Weekly CIS NAV / Monthly ETF & CIS NAV).
- afexnigeria.com — unreachable (502) from sandbox; marked VERIFY.
- dataportal.ngxgroup.com — reachable (200).

*This document is a DRAFT prepared for CTO sign-off and CEO/Compliance review. Nothing herein is a commitment to NGX, FMDQ, or any third party; no external contact has been made.*

---

## 8. CTO sign-off

**Signed:** CTO — 2026-08-03. Reviewed and accepted as the NF-5/6 remediation basis. §3 recommendation approved as direction (NGX delayed-display licence via official API; X-DataPortal fallback; interim public 30-min display only with attribution + written redistribution confirmation). §4 outreach note approved for review, NOT for sending until the CEO confirms the outreach go-ahead and the data-source budget envelope. Routing: Compliance (NF-5/6 register update) + CEO (decision queue: NGX outreach + budget).
