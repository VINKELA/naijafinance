import { Injectable } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Observable } from 'rxjs';

/** Django REST backend base URL (dev). CORS is enabled for localhost:4200. */
export const API_BASE = '/api'; // relative: nginx proxies /api/ to backend (staging + prod)

export interface Bond { id: number; symbol: string; name: string; last_price: string; asset_type: string; sector?: string | null; maturity_date?: string | null; coupon_rate?: string | null; }
export interface Auction { id: number; instrument_symbol: string; instrument_name: string; auction_date: string; tenor: string; offer_size: string | null; stop_rate: string | null; notes?: string | null; }
export interface NavSnapshot { id: number; fund: number; date: string; nav: string; }
export interface Fund { id: number; name: string; manager: string | null; asset_class: string; asset_class_display: string; latest_nav: NavSnapshot | null; nav_history: NavSnapshot[]; }
export interface FxRate { id: number; pair: string; rate: string; date: string; source: string; }
export interface RevenuePoint { year: number; revenue_ngn: string; }
export interface CompanyProfile { id: number; symbol: string; name: string; sector: string | null; description: string | null; eps: string | null; pe_ratio: string | null; book_value: string | null; market_cap: string | null; revenue_history?: RevenuePoint[] | null; }
export interface Alert { id?: number; instrument: number | null; instrument_symbol?: string | null; fund: number | null; fund_name?: string | null; alert_type: string; alert_type_display?: string; threshold: string; direction: string; direction_display?: string; active: boolean; triggered?: boolean; triggered_at?: string | null; last_evaluated_at?: string | null; last_value?: string | null; }

@Injectable({ providedIn: 'root' })
export class ApiService {
  constructor(private http: HttpClient) {}

  // F-04
  bonds(): Observable<Bond[]> { return this.http.get<Bond[]>(`${API_BASE}/bonds/`); }
  commercialPapers(): Observable<Bond[]> { return this.http.get<Bond[]>(`${API_BASE}/commercial-papers/`); }
  auctions(): Observable<Auction[]> { return this.http.get<Auction[]>(`${API_BASE}/auctions/`); }

  // F-05
  funds(): Observable<Fund[]> { return this.http.get<Fund[]>(`${API_BASE}/funds/`); }

  // F-06
  fxRates(latest = true): Observable<FxRate[]> { return this.http.get<FxRate[]>(`${API_BASE}/fx-rates/${latest ? '?latest=1' : ''}`); }

  // F-07
  companies(): Observable<CompanyProfile[]> { return this.http.get<CompanyProfile[]>(`${API_BASE}/companies/`); }

  // F-08
  alerts(): Observable<Alert[]> { return this.http.get<Alert[]>(`${API_BASE}/alerts/`, { headers: this.authHeaders() }); }
  createAlert(alert: Alert): Observable<Alert> { return this.http.post<Alert>(`${API_BASE}/alerts/`, alert, { headers: this.authHeaders() }); }
  updateAlert(id: number, alert: Partial<Alert>): Observable<Alert> { return this.http.patch<Alert>(`${API_BASE}/alerts/${id}/`, alert, { headers: this.authHeaders() }); }
  deleteAlert(id: number): Observable<void> { return this.http.delete<void>(`${API_BASE}/alerts/${id}/`, { headers: this.authHeaders() }); }
  // Market layer (F-01/F-02/F-03) — currently deterministic mock data until the NGX feed lands
  movers(type = 'active', limit = 8): Observable<any[]> { return this.http.get<any[]>(`${API_BASE}/stocks/movers/?type=${type}&limit=${limit}`); }
  indexes(): Observable<any[]> { return this.http.get<any[]>(`${API_BASE}/indexes/`); }
  overview(): Observable<any> { return this.http.get<any>(`${API_BASE}/overview/`); }
  news(limit = 10): Observable<any[]> { return this.http.get<any[]>(`${API_BASE}/news/?limit=${limit}`); }
  fundDetail(id: number): Observable<any> { return this.http.get<any>(`${API_BASE}/fund/${id}/`); }
  companyDetail(symbol: string): Observable<any> { return this.http.get<any>(`${API_BASE}/company/${symbol}/`); }
  stockDetail(symbol: string): Observable<any> { return this.http.get<any>(`${API_BASE}/stock/${symbol}/`); }
  // ---- Auth (F-09) ----
  register(payload: any): Observable<any> { return this.http.post(`${API_BASE}/auth/register/`, payload); }
  login(email: string, password: string): Observable<any> { return this.http.post(`${API_BASE}/auth/login/`, { email, password }); }
  refreshTokens(refresh: string): Observable<any> { return this.http.post(`${API_BASE}/auth/refresh/`, { refresh }); }
  saveTokens(tokens: any) { if (tokens?.access) localStorage.setItem('nf_access', tokens.access); if (tokens?.refresh) localStorage.setItem('nf_refresh', tokens.refresh); }
  clearTokens() { localStorage.removeItem('nf_access'); localStorage.removeItem('nf_refresh'); }
  get token() { return localStorage.getItem('nf_access'); }
  get isAuthed() { return !!this.token; }
  private authHeaders(): Record<string, string> { return this.token ? { Authorization: `Bearer ${this.token}` } : {}; }

  // ---- F-01 Watchlists ----
  watchlists(): Observable<any[]> { return this.http.get<any[]>(`${API_BASE}/watchlists/`, { headers: this.authHeaders() }); }
  defaultWatchlist(): Observable<any> { return this.http.get<any>(`${API_BASE}/watchlist/default/`, { headers: this.authHeaders() }); }
  watchlistHistory(period = 90): Observable<any> { return this.http.get<any>(`${API_BASE}/watchlist/history/?period=${period}`, { headers: this.authHeaders() }); }
  toggleWatchlist(symbol: string, fundId?: number): Observable<any> {
    const body: any = symbol ? { symbol } : { fund_id: fundId };
    return this.http.post<any>(`${API_BASE}/watchlist/toggle/`, body, { headers: this.authHeaders() });
  }
  sharePortfolio(portfolioId: number): Observable<any> { return this.http.post<any>(`${API_BASE}/portfolios/${portfolioId}/share/`, {}, { headers: this.authHeaders() }); }
  compare(symbols: string[], funds: number[], period = 90): Observable<any> {
    const qs = new URLSearchParams();
    if (symbols.length) qs.set('symbols', symbols.join(','));
    if (funds.length) qs.set('funds', funds.join(','));
    qs.set('period', String(period));
    return this.http.get<any>(`${API_BASE}/compare/?${qs.toString()}`);
  }

  // ---- F-09 Portfolios ----
  portfolios(): Observable<any[]> { return this.http.get<any[]>(`${API_BASE}/portfolios/`, { headers: this.authHeaders() }); }
  createPortfolio(name: string): Observable<any> { return this.http.post<any>(`${API_BASE}/portfolios/`, { name }, { headers: this.authHeaders() }); }
  addPortfolioItem(portfolioId: number, symbol: string, quantity: number, purchasePrice: number, fundId?: number): Observable<any> {
    const body: any = { portfolio_id: portfolioId, symbol, quantity, purchase_price: purchasePrice };
    if (fundId) body.fund_id = fundId;
    return this.http.post<any>(`${API_BASE}/portfolio-items/add-by-symbol/`, body, { headers: this.authHeaders() });
  }
  removePortfolioItem(itemId: number): Observable<void> {
    return this.http.delete<void>(`${API_BASE}/portfolio-items/${itemId}/`, { headers: this.authHeaders() });
  }
  deletePortfolio(portfolioId: number): Observable<void> {
    return this.http.delete<void>(`${API_BASE}/portfolios/${portfolioId}/`, { headers: this.authHeaders() });
  }
  portfolioInsights(): Observable<any> { return this.http.get<any>(`${API_BASE}/portfolio-insights/`, { headers: this.authHeaders() }); }
  portfolioPerformance(id: number, period = 90): Observable<any> { return this.http.get<any>(`${API_BASE}/portfolios/${id}/performance/?period=${period}`, { headers: this.authHeaders() }); }
  createMixShare(portfolioId: number, itemIds?: number[]): Observable<any> {
    const body: any = { portfolio_id: portfolioId };
    if (itemIds && itemIds.length) body.item_ids = itemIds;
    return this.http.post<any>(`${API_BASE}/mix/`, body, { headers: this.authHeaders() });
  }
  mixCard(token: string): Observable<any> { return this.http.get<any>(`${API_BASE}/mix/${token}/`); }
  mixPerformance(token: string, period = 90): Observable<any> { return this.http.get<any>(`${API_BASE}/mix/${token}/performance/?period=${period}`); }
  revokeMix(token: string): Observable<void> { return this.http.delete<void>(`${API_BASE}/mix/${token}/revoke/`, { headers: this.authHeaders() }); }
  searchStocks(q: string): Observable<any[]> { return this.http.get<any[]>(`${API_BASE}/stocks/search/?q=${encodeURIComponent(q)}`); }
}
