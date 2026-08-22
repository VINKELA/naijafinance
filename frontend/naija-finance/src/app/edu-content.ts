/**
 * REQ-EDU-1 — Per-module Q&A question bank (CCO-approved, 08-08).
 * 72 questions across 11 modules. Pidgin hooks for voice, English for card title.
 * pidginAnswer = Pidgin rendering of the answer (app-wide EN ⇄ PIDGIN toggle, CEO 16:41).
 * Key terms link to glossary only where term exists in VOICE-GLOSSARY-50-TERMS.md.
 * Sourced from products/naija-finance/REQ-EDU-1-QUESTION-BANK.md
 */
export interface EduQuestion {
  pidginHook: string;
  englishTitle: string;
  answer: string;
  pidginAnswer: string;
  keyTerms: { label: string; link?: string }[];
  audioUrl?: string;
}

export interface EduModuleContent {
  questions: EduQuestion[];
  defaultExpanded: boolean;
}

export const EDU_CONTENT: Record<string, EduModuleContent> = {
  market: {
    questions: [
      { pidginHook: "Wetin be stock?", englishTitle: "What is a stock?", answer: "A share of ownership in a company; price moves with supply/demand and company performance.", pidginAnswer: "Na small part of di company wey you own; di price dey move with supply/demand and how di company dey do.", keyTerms: [{ label: 'stock', link: '/glossary/stock_share' }, { label: 'share', link: '/glossary/stock_share' }, { label: 'market cap', link: '/glossary/market_capitalisation_market_cap' }] },
      { pidginHook: "How I go buy stock for Nigeria?", englishTitle: "How do I buy stocks in Nigeria?", answer: "Through a licensed broker on the Nigerian Exchange; the app tracks prices — it does not execute trades.", pidginAnswer: "You go use licensed broker for NGX; di app dey show prices — e no dey buy or sell for you.", keyTerms: [{ label: 'broker', link: '/glossary/broker' }, { label: 'NGX' }] },
      { pidginHook: "Wetin be dividend?", englishTitle: "What is a dividend?", answer: "A share of company profit paid to shareholders, usually per share.", pidginAnswer: "Na part of di company profit wey dem pay di owners, usually per share.", keyTerms: [{ label: 'dividend', link: '/glossary/dividend' }, { label: 'yield', link: '/glossary/yield' }] },
      { pidginHook: "Why stock price dey up and down?", englishTitle: "Why do stock prices go up and down?", answer: "Supply and demand, company performance, news, and market sentiment all affect prices.", pidginAnswer: "Supply and demand, how di company dey do, news, and market feeling dey move am.", keyTerms: [{ label: 'volatility', link: '/glossary/volatility' }] },
      { pidginHook: "Wetin be market cap?", englishTitle: "What is market cap?", answer: "Total value of all a company's shares = price × shares outstanding.", pidginAnswer: "Na total value of all di company shares = price × how many shares dey.", keyTerms: [{ label: 'market cap', link: '/glossary/market_capitalisation_market_cap' }] },
      { pidginHook: "How I go sabi wetin stock dey worth?", englishTitle: "How do I know what a stock is worth?", answer: "Compare price to fundamentals: P/E ratio, earnings, dividends — not just price.", pidginAnswer: "Compare price with fundamentals: P/E ratio, earnings, dividends — no be price alone.", keyTerms: [{ label: 'P/E', link: '/glossary/pe_ratio_pricetoearnings' }, { label: 'earnings' }] },
      { pidginHook: "Wetin be gainers and losers?", englishTitle: "What are gainers and losers?", answer: "Today's biggest price risers and fallers on the market; a quick scan of where money is moving.", pidginAnswer: "Na di biggest risers and fallers today; quick look at where money dey move.", keyTerms: [] },
    ],
    defaultExpanded: false,
  },
  stocks: {
    questions: [
      { pidginHook: "Wetin be stock?", englishTitle: "What is a stock?", answer: "A share of ownership in a company; price moves with supply/demand and company performance.", pidginAnswer: "Na small part of di company wey you own; di price dey move with supply/demand and how di company dey do.", keyTerms: [{ label: 'stock', link: '/glossary/stock_share' }, { label: 'share', link: '/glossary/stock_share' }, { label: 'market cap', link: '/glossary/market_capitalisation_market_cap' }] },
      { pidginHook: "How I go buy stock for Nigeria?", englishTitle: "How do I buy stocks in Nigeria?", answer: "Through a licensed broker on the Nigerian Exchange (NGX); the app tracks prices — it does not execute trades.", pidginAnswer: "You go use licensed broker for NGX; di app dey show prices — e no dey buy or sell for you.", keyTerms: [{ label: 'broker', link: '/glossary/broker' }, { label: 'NGX' }] },
      { pidginHook: "Why stock price dey up and down?", englishTitle: "Why do stock prices go up and down?", answer: "Supply and demand, company performance, news, and market sentiment all affect prices.", pidginAnswer: "Supply and demand, how di company dey do, news, and market feeling dey move am.", keyTerms: [{ label: 'volatility', link: '/glossary/volatility' }] },
      { pidginHook: "Wetin be P/E ratio?", englishTitle: "What is the P/E ratio?", answer: "Price divided by earnings per share — a common measure of how expensive a stock is relative to its profit.", pidginAnswer: "Na price divide by earnings per share — how expensive di stock be compared to di profit e dey make.", keyTerms: [{ label: 'P/E', link: '/glossary/pe_ratio_pricetoearnings' }, { label: 'earnings' }] },
      { pidginHook: "Wetin be gainers and losers?", englishTitle: "What are gainers and losers?", answer: "Today's biggest price risers and fallers on the market; a quick scan of where money is moving.", pidginAnswer: "Na di biggest risers and fallers today; quick look at where money dey move.", keyTerms: [] },
      { pidginHook: "Wetin be 52-week high and low?", englishTitle: "What are the 52-week high and low?", answer: "The highest and lowest price a stock traded at over the last year — useful context, not a prediction.", pidginAnswer: "Na di highest and lowest price di stock trade for di last one year — useful context, no be prediction.", keyTerms: [{ label: 'volatility', link: '/glossary/volatility' }] },
    ],
    defaultExpanded: false,
  },
  bonds: {
    questions: [
      { pidginHook: "Wetin be bond?", englishTitle: "What is a bond?", answer: "A loan you give to a government or company; they pay interest and return your money at maturity.", pidginAnswer: "Na loan wey you give government or company; dem dey pay you interest and return your money at maturity.", keyTerms: [{ label: 'bond', link: '/glossary/bond' }, { label: 'coupon' }, { label: 'maturity' }] },
      { pidginHook: "Wetin be FGN bond?", englishTitle: "What is an FGN bond?", answer: "A bond issued by the federal government (DMO) — generally lower credit risk than corporate bonds, but not risk-free.", pidginAnswer: "Na bond wey federal government (DMO) issue — lower risk pass corporate bond, but e no be risk-free.", keyTerms: [{ label: 'DMO', link: '/glossary/dmo_debt_management_office' }] },
      { pidginHook: "Wetin be yield?", englishTitle: "What is yield?", answer: "Your income as a percentage of what you paid — coupon rate is not the same as yield when price differs.", pidginAnswer: "Na your income as percentage of wetin you pay — coupon rate no be same as yield when price differ.", keyTerms: [{ label: 'yield', link: '/glossary/yield' }, { label: 'coupon' }] },
      { pidginHook: "If I hold bond till maturity, wetin I go get?", englishTitle: "What do I get if I hold a bond to maturity?", answer: "Your principal back plus all coupons paid along the way.", pidginAnswer: "You go get your principal back plus all coupons wey dem pay along di way.", keyTerms: [{ label: 'face value', link: '/glossary/face_value' }] },
      { pidginHook: "Wetin be T-bill?", englishTitle: "What is a Treasury bill?", answer: "Short-term government debt sold at a discount; you get face value at maturity.", pidginAnswer: "Na short-term government debt wey dem sell at discount; you get face value at maturity.", keyTerms: [{ label: 'T-bill', link: '/glossary/treasury_bill_tbill' }] },
      { pidginHook: "Bond dey risky?", englishTitle: "Are bonds risky?", answer: "Lower risk than stocks, but not zero: default risk, interest-rate risk, and inflation all matter.", pidginAnswer: "E lower risk pass stock, but no be zero: default risk, interest-rate risk, and inflation dey matter.", keyTerms: [{ label: 'risk', link: '/glossary/risk' }, { label: 'inflation', link: '/glossary/inflation' }, { label: 'interest rate', link: '/glossary/interest_rate' }] },
      { pidginHook: "Govt bond vs company bond — wetin be the difference?", englishTitle: "Government vs corporate bond", answer: "Government (FGN) bonds carry sovereign backing; corporate bonds carry company credit risk, usually with higher yield.", pidginAnswer: "FGN bonds get government backing; corporate bonds get company risk, usually with higher yield.", keyTerms: [{ label: 'bond', link: '/glossary/bond' }, { label: 'risk', link: '/glossary/risk' }] },
      { pidginHook: "Wetin be commercial paper?", englishTitle: "What is a commercial paper?", answer: "A short-term unsecured loan to a company; higher yield than T-bills, more risk.", pidginAnswer: "Na short-term loan wey no get collateral; higher yield pass T-bill, more risk.", keyTerms: [{ label: 'maturity' }, { label: 'liquidity', link: '/glossary/liquidity' }] },
      { pidginHook: "How CP differ from bond?", englishTitle: "How is CP different from a bond?", answer: "Much shorter tenor — days to months vs years — and no collateral backing.", pidginAnswer: "E tenor short pass — days to months vs years — and no collateral backing.", keyTerms: [{ label: 'bond', link: '/glossary/bond' }] },
      { pidginHook: "Why CP yield high pass T-bill?", englishTitle: "Why do CP yields beat T-bills?", answer: "More risk — unsecured corporate credit versus government backing.", pidginAnswer: "More risk — corporate credit wey no get government backing.", keyTerms: [{ label: 'risk', link: '/glossary/risk' }] },
      { pidginHook: "Who fit issue commercial paper?", englishTitle: "Who can issue commercial paper?", answer: "Creditworthy companies raising short-term cash; usually large corporates and banks.", pidginAnswer: "Companies wey get good credit record wey need quick cash; usually big companies and banks.", keyTerms: [] },
      { pidginHook: "Wetin be discount?", englishTitle: "What is a discount (in CP context)?", answer: "You buy below face value and receive face value at maturity — the difference is your return.", pidginAnswer: "You buy below face value and get face value at maturity — di difference na your return.", keyTerms: [{ label: 'face value', link: '/glossary/face_value' }] },
      { pidginHook: "I fit sell am before maturity?", englishTitle: "Can I sell before maturity?", answer: "Yes, on the secondary market — but price depends on market conditions.", pidginAnswer: "Yes, for secondary market — but price dey depend on market condition.", keyTerms: [{ label: 'secondary market', link: '/glossary/secondary_market' }, { label: 'liquidity', link: '/glossary/liquidity' }] },
    ],
    defaultExpanded: false,
  },
  funds: {
    questions: [
      { pidginHook: "Wetin be mutual fund?", englishTitle: "What is a mutual fund?", answer: "A pool of many investors' money run by a professional manager.", pidginAnswer: "Na pool of many people money wey professional manager dey run.", keyTerms: [{ label: 'mutual fund', link: '/glossary/mutual_fund' }, { label: 'NAV', link: '/glossary/nav_net_asset_value' }] },
      { pidginHook: "Wetin be NAV?", englishTitle: "What is NAV?", answer: "Net Asset Value — the price of one unit of the fund, usually updated daily.", pidginAnswer: "Net Asset Value — na di price of one unit of di fund, usually dey update daily.", keyTerms: [{ label: 'NAV', link: '/glossary/nav_net_asset_value' }] },
      { pidginHook: "How I go know which fund good?", englishTitle: "How do I evaluate a fund?", answer: "Look at NAV history, fund size, fees, and what it invests in — past performance is not a promise.", pidginAnswer: "Look at NAV history, fund size, fees, and wetin e dey invest for — past performance no be promise.", keyTerms: [] },
      { pidginHook: "Wetin be money market fund?", englishTitle: "What is a money market fund?", answer: "A fund investing in short-term, low-risk instruments like T-bills, CP, and bank deposits.", pidginAnswer: "Na fund wey dey invest for short-term low-risk things like T-bills, CP, and bank deposit.", keyTerms: [{ label: 'liquidity', link: '/glossary/liquidity' }] },
      { pidginHook: "Fund vs stock — which one?", englishTitle: "Fund vs stock — what is the difference?", answer: "A fund spreads your money across many assets (diversification); a stock is one company.", pidginAnswer: "Fund dey spread your money across many assets; stock na one company.", keyTerms: [{ label: 'diversification', link: '/glossary/diversification' }] },
      { pidginHook: "I fit withdraw my money anytime?", englishTitle: "Can I withdraw anytime?", answer: "Depends on fund type: money-market and equity funds are usually redeemable; some have lock-ins.", pidginAnswer: "E dey depend on fund type: money-market and equity funds usually dey allow; some get lock-in.", keyTerms: [{ label: 'liquidity', link: '/glossary/liquidity' }] },
    ],
    defaultExpanded: false,
  },
  fx: {
    questions: [
      { pidginHook: "Wetin be exchange rate?", englishTitle: "What is an exchange rate?", answer: "The price of one currency in another — for example, how many naira for one US dollar.", pidginAnswer: "Na di price of one currency for another — e.g. how many naira for one US dollar.", keyTerms: [{ label: 'exchange rate', link: '/glossary/exchange_rate' }] },
      { pidginHook: "Why dollar rate dey change?", englishTitle: "Why does the dollar rate keep changing?", answer: "Supply and demand, CBN policy, oil prices, and global capital flows all affect the rate.", pidginAnswer: "Supply and demand, CBN policy, oil price, and global money movement dey affect am.", keyTerms: [{ label: 'CBN', link: '/glossary/central_bank_of_nigeria_cbn' }] },
      { pidginHook: "Wetin be official rate vs market rate?", englishTitle: "Official vs market rate?", answer: "CBN-published rate versus the rate you actually get from banks and Bureaux de Change.", pidginAnswer: "CBN rate vs di rate wey you actually get from bank and BDC.", keyTerms: [{ label: 'CBN', link: '/glossary/central_bank_of_nigeria_cbn' }] },
      { pidginHook: "How FX dey affect my investments?", englishTitle: "How does FX affect my investments?", answer: "Currency moves change the naira value of foreign assets and the cost of imports.", pidginAnswer: "Currency movement dey change di naira value of foreign assets and di cost of imports.", keyTerms: [{ label: 'devaluation', link: '/glossary/devaluation' }] },
      { pidginHook: "Wetin be devaluation?", englishTitle: "What is devaluation?", answer: "When the naira's official value drops against other currencies.", pidginAnswer: "When di naira official value drop against other currency.", keyTerms: [{ label: 'devaluation', link: '/glossary/devaluation' }] },
      { pidginHook: "I fit use app to change money?", englishTitle: "Can I use this app to exchange money?", answer: "No — the app shows rates for information; it does not do currency transactions.", pidginAnswer: "No — di app dey show rates for information; e no dey do currency transaction.", keyTerms: [] },
      { pidginHook: "Wetin be CBN official rate?", englishTitle: "What is the CBN official rate?", answer: "The exchange rate published by the Central Bank of Nigeria; other market rates may differ.", pidginAnswer: "Na di exchange rate wey Central Bank of Nigeria publish; other market rates fit differ.", keyTerms: [{ label: 'CBN', link: '/glossary/central_bank_of_nigeria_cbn' }] },
    ],
    defaultExpanded: false,
  },
  companies: {
    questions: [
      { pidginHook: "Wetin be company profile?", englishTitle: "What is a company profile?", answer: "Key facts about a listed company: what it does, its sector, market cap, and recent financials.", pidginAnswer: "Na key facts about listed company: wetin e dey do, e sector, market cap, and recent financials.", keyTerms: [{ label: 'equity', link: '/glossary/equity' }, { label: 'market cap', link: '/glossary/market_capitalisation_market_cap' }] },
      { pidginHook: "How I go read company fundamentals?", englishTitle: "How do I read company fundamentals?", answer: "Focus on P/E ratio, earnings per share (EPS), and revenue trends.", pidginAnswer: "Focus on P/E ratio, earnings per share (EPS), and revenue trend.", keyTerms: [{ label: 'P/E', link: '/glossary/pe_ratio_pricetoearnings' }, { label: 'EPS', link: '/glossary/earnings_per_share_eps' }] },
      { pidginHook: "Wetin be sector?", englishTitle: "What is a sector?", answer: "A group of companies in the same line of business — for example, banking, telecoms, or consumer goods.", pidginAnswer: "Na group of companies for same line of business — like banking, telecoms, or consumer goods.", keyTerms: [] },
    ],
    defaultExpanded: false,
  },
  watchlist: {
    questions: [
      { pidginHook: "Wetin be watchlist?", englishTitle: "What is a watchlist?", answer: "Your personal list of instruments to monitor without owning them.", pidginAnswer: "Na your personal list of instruments wey you dey monitor without owning dem.", keyTerms: [{ label: 'watchlist', link: '/glossary/watchlist' }] },
      { pidginHook: "How alert dey work?", englishTitle: "How do alerts work?", answer: "You set a threshold; the app notifies you when price, yield, or NAV crosses it.", pidginAnswer: "You set threshold; di app go notify you when price, yield, or NAV cross am.", keyTerms: [{ label: 'risk', link: '/glossary/risk' }] },
      { pidginHook: "Why I need watchlist?", englishTitle: "Why keep a watchlist?", answer: "Track candidates and market moves before you commit money — no pressure, just information.", pidginAnswer: "Track candidates and market movement before you commit money — no pressure, just information.", keyTerms: [] },
      { pidginHook: "Wetin happen if I no set threshold?", englishTitle: "What if I don't set a threshold?", answer: "No alert fires — you just see the list update passively.", pidginAnswer: "No alert go fire — you just dey see di list update passively.", keyTerms: [] },
      { pidginHook: "How many instrument I fit watch?", englishTitle: "How many instruments can I watch?", answer: "As many as you like; the watchlist keeps them in one place for quick checks.", pidginAnswer: "As many as you like; di watchlist dey keep dem for one place for quick check.", keyTerms: [] },
    ],
    defaultExpanded: false,
  },
  portfolio: {
    questions: [
      { pidginHook: "Wetin be portfolio?", englishTitle: "What is a portfolio?", answer: "Your collection of holdings and their total value over time.", pidginAnswer: "Na your collection of holdings and dia total value over time.", keyTerms: [{ label: 'portfolio', link: '/glossary/portfolio' }] },
      { pidginHook: "Wetin be P&L?", englishTitle: "What is P&L?", answer: "Profit and loss — your gain or loss versus what you paid.", pidginAnswer: "Profit and loss — your gain or loss vs wetin you pay.", keyTerms: [] },
      { pidginHook: "Wetin be diversification?", englishTitle: "What is diversification?", answer: "Spreading across asset types like stocks, bonds, and funds to reduce risk.", pidginAnswer: "De spread across asset types like stocks, bonds, and funds to reduce risk.", keyTerms: [{ label: 'diversification', link: '/glossary/diversification' }] },
      { pidginHook: "Why my portfolio value dey change?", englishTitle: "Why does my portfolio value change?", answer: "Prices move daily; your portfolio value = sum of holdings at current prices.", pidginAnswer: "Price dey move daily; your portfolio value = sum of holdings at current price.", keyTerms: [{ label: 'volatility', link: '/glossary/volatility' }] },
      { pidginHook: "I fit enter my own holdings?", englishTitle: "Can I enter my own holdings?", answer: "Yes, manually in MVP — the app tracks, it doesn't hold your money.", pidginAnswer: "Yes, you fit enter am manually for MVP — di app dey track, e no dey hold your money.", keyTerms: [] },
    ],
    defaultExpanded: false,
  },
  assetMix: {
    questions: [
      { pidginHook: "Wetin be asset mix?", englishTitle: "What is an asset mix?", answer: "A curated combination of assets with set proportions, for analysis — hypothetical, not your actual holdings.", pidginAnswer: "Na curated combination of assets with set proportions, for analysis — hypothetical, no be your real holdings.", keyTerms: [] },
      { pidginHook: "How I go choose my own mix?", englishTitle: "How do I choose a mix?", answer: "Depends on your time horizon and risk appetite; the tool shows outcome ranges, not 'best' answers.", pidginAnswer: "E dey depend on your time horizon and risk appetite; di tool dey show outcome range, no be 'best' answer.", keyTerms: [{ label: 'risk tolerance', link: '/glossary/risk_tolerance' }] },
      { pidginHook: "Wetin be aggressive vs conservative mix?", englishTitle: "Aggressive vs conservative mix?", answer: "More stocks = more potential growth AND more ups and downs; more bonds and funds = steadier.", pidginAnswer: "More stocks = more growth AND more up and down; more bonds and funds = steadier.", keyTerms: [{ label: 'risk', link: '/glossary/risk' }, { label: 'return', link: '/glossary/return' }] },
      { pidginHook: "Na advice dis be?", englishTitle: "Is this advice?", answer: "No — educational scenario tool only. Hypothetical outcomes, not recommendations.", pidginAnswer: "No — na educational scenario tool only. Hypothetical outcome, no be recommendation.", keyTerms: [] },
      { pidginHook: "Wetin be my own mix suppose?", englishTitle: "What should my own mix be?", answer: "No one-size-fits-all; depends on your goals, timeline, and comfort with ups and downs.", pidginAnswer: "No one-size-fit-all; e dey depend on your goal, timeline, and how you take comfort with up and down.", keyTerms: [] },
    ],
    defaultExpanded: false,
  },
  compare: {
    questions: [
      { pidginHook: "How I go compare two assets?", englishTitle: "How do I compare two assets?", answer: "Side-by-side price, yield, or NAV history overlay on one chart.", pidginAnswer: "Side-by-side price, yield, or NAV history overlay for one chart.", keyTerms: [{ label: 'index', link: '/glossary/index' }] },
      { pidginHook: "Wetin be benchmark?", englishTitle: "What is a benchmark?", answer: "A reference index, like the NGX All-Share Index, to measure an asset's performance against.", pidginAnswer: "Na reference index, like NGX All-Share Index, to measure asset performance against.", keyTerms: [{ label: 'All-Share Index', link: '/glossary/allshare_index' }] },
      { pidginHook: "Why I need compare?", englishTitle: "Why compare?", answer: "Spot differences in performance, risk, and timing before making decisions.", pidginAnswer: "See difference for performance, risk, and timing before you make decision.", keyTerms: [{ label: 'risk', link: '/glossary/risk' }] },
      { pidginHook: "Wetin compare fit tell me wey chart no fit?", englishTitle: "What can compare show that a single chart can't?", answer: "Relative strength and timing gaps between two instruments at a glance.", pidginAnswer: "Relative strength and timing gap between two instruments at one glance.", keyTerms: [] },
      { pidginHook: "I fit compare bond with stock?", englishTitle: "Can I compare a bond with a stock?", answer: "Yes — different scales, but the overlay shows behaviour side by side.", pidginAnswer: "Yes — different scale, but di overlay dey show behaviour side by side.", keyTerms: [{ label: 'bond', link: '/glossary/bond' }, { label: 'stock', link: '/glossary/stock_share' }] },
      { pidginHook: "Why past performance no be guarantee?", englishTitle: "Why is past performance not a guarantee?", answer: "Markets change; what an asset did before doesn't promise the same result later.", pidginAnswer: "Market dey change; wetin asset do before no dey promise same result later.", keyTerms: [{ label: 'return', link: '/glossary/return' }, { label: 'risk', link: '/glossary/risk' }] },
      { pidginHook: "Wetin be time series?", englishTitle: "What is a time series?", answer: "A sequence of values over time, like daily prices, used to spot trends.", pidginAnswer: "Na sequence of values over time, like daily price, to spot trend.", keyTerms: [] },
    ],
    defaultExpanded: false,
  },
  alerts: {
    questions: [
      { pidginHook: "Wetin be alert?", englishTitle: "What is an alert?", answer: "Automatic notification when an instrument crosses your chosen level.", pidginAnswer: "Na automatic notification when instrument cross your chosen level.", keyTerms: [{ label: 'risk', link: '/glossary/risk' }] },
      { pidginHook: "How I set alert?", englishTitle: "How do I set an alert?", answer: "Pick an instrument, set a threshold level, and choose your notification channel.", pidginAnswer: "Pick instrument, set threshold level, and choose your notification channel.", keyTerms: [] },
      { pidginHook: "Wetin fit trigger alert?", englishTitle: "What can trigger an alert?", answer: "Price, yield, NAV, or percentage change crossing your chosen level.", pidginAnswer: "Price, yield, NAV, or percentage change wey cross your level.", keyTerms: [] },
      { pidginHook: "How many alert I fit get?", englishTitle: "How many alerts can I have?", answer: "Multiple — one per instrument and level you want to track.", pidginAnswer: "Plenty — one per instrument and level wey you want track.", keyTerms: [] },
      { pidginHook: "Na advice alert be?", englishTitle: "Are alerts advice?", answer: "No — they just tell you when a level is hit; decisions remain yours.", pidginAnswer: "No — dem just dey tell you when level don hit; decision na your own.", keyTerms: [] },
      { pidginHook: "Alert vs advice — wetin different?", englishTitle: "What is the difference between an alert and advice?", answer: "An alert just tells you a price, yield, or NAV crossed your chosen level; it never tells you what to buy or sell.", pidginAnswer: "Alert just dey tell you price/yield/NAV don cross your level; e never dey tell you wetin to buy or sell.", keyTerms: [] },
    ],
    defaultExpanded: false,
  },
  blog: {
    questions: [
      { pidginHook: "Wetin dey inside blog?", englishTitle: "What is in the blog?", answer: "Market education and company news in plain language.", pidginAnswer: "Na market education and company news for plain language.", keyTerms: [] },
      { pidginHook: "Na advice di post be?", englishTitle: "Are posts advice?", answer: "No — analysis and education, not investment advice.", pidginAnswer: "No — analysis and education, no be investment advice.", keyTerms: [] },
      { pidginHook: "How I go take understand market news?", englishTitle: "How do I make sense of market news?", answer: "Focus on what changed, who it affects, and what it means for prices — plain-English explainers throughout.", pidginAnswer: "Focus on wetin change, who e affect, and wetin e mean for price — plain-English explainer everywhere.", keyTerms: [] },
      { pidginHook: "How I go know wetin post dey talk?", englishTitle: "How do I know what a post is about?", answer: "Title and excerpt on each card; open the full post to read.", pidginAnswer: "Title and excerpt for each card; open di full post to read.", keyTerms: [] },
      { pidginHook: "Wetin be 'plain language'?", englishTitle: "What is 'plain language'?", answer: "No jargon — terms are explained as you read; key terms link to the glossary.", pidginAnswer: "No jargon — dem dey explain term as you dey read; key term dey link to glossary.", keyTerms: [] },
      { pidginHook: "Wetin be inflation?", englishTitle: "What is inflation?", answer: "The general rise in prices over time; it reduces what your money can buy.", pidginAnswer: "Na general rise for price over time; e dey reduce wetin your money fit buy.", keyTerms: [{ label: 'inflation', link: '/glossary/inflation' }] },
      { pidginHook: "Wetin be compound interest?", englishTitle: "What is compound interest?", answer: "Earning interest on your interest — your money grows faster the longer it stays invested.", pidginAnswer: "Na to dey earn interest on your interest — your money dey grow fast pass di longer e stay.", keyTerms: [{ label: 'compound interest', link: '/glossary/compound_interest' }] },
      { pidginHook: "How I go start to invest?", englishTitle: "How do I start investing?", answer: "Start small and regular: learn the basics, track with watchlists, build a diversified mix over time — and for personal advice, talk to a licensed financial adviser.", pidginAnswer: "Start small and regular: learn di basics, track with watchlist, build diversified mix over time — and for personal advice, talk to licensed financial adviser.", keyTerms: [{ label: 'diversification', link: '/glossary/diversification' }] },
    ],
    defaultExpanded: false,
  },
};
