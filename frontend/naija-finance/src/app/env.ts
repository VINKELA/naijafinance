/** Runtime environment flag: demo/staging warning text is gated on this.
 *  Demo mode = localhost / staging hosts. The production domain
 *  (naijafinance.com) is NOT demo — no demo/staging warnings there. */
const DEMO_HOSTS = ['localhost', '127.0.0.1', 'staging'];
export const IS_DEMO: boolean = (() => {
  const host = window.location.hostname || '';
  return DEMO_HOSTS.some(h => host.includes(h)) || !host.includes('naijafinance.com') || host.includes('9183');
})();
