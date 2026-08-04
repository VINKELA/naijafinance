import { Routes } from '@angular/router';
import { BondsPage } from './pages/bonds';
import { FundsPage } from './pages/funds';
import { FxPage } from './pages/fx';
import { CompaniesPage } from './pages/companies';
import { AlertsPage } from './pages/alerts';
import { MarketPage } from './pages/market';
import { WatchlistPage } from './pages/watchlist';
import { PortfolioPage } from './pages/portfolio';
import { SymbolPage } from './pages/symbol';
import { AssetPage } from './pages/asset';
import { AuthPage } from './pages/auth';

export const routes: Routes = [
  { path: '', redirectTo: '/market', pathMatch: 'full' },
  { path: 'market', component: MarketPage, title: 'Market Overview' },
  { path: 'bonds', component: BondsPage, title: 'Bonds & Auctions' },
  { path: 'funds', component: FundsPage, title: 'Mutual Funds' },
  { path: 'fx', component: FxPage, title: 'CBN FX Rates' },
  { path: 'companies', component: CompaniesPage, title: 'Company Profiles' },
  { path: 'alerts', component: AlertsPage, title: 'Threshold Alerts' },
  { path: 'watchlist', component: WatchlistPage, title: 'Watchlist' },
  { path: 'portfolio', component: PortfolioPage, title: 'Portfolio' },
  { path: 'symbol', component: SymbolPage, title: 'Symbol & Chart' },
  { path: 'asset', component: AssetPage, title: 'Asset Information' },
  { path: 'account', component: AuthPage, title: 'Account' },
];
