(function (root) {
  const remote = () => root.PulseRemote;
  const KEY = 'pulse-auth-session-v1';
  const RECOVERY_KEY = 'pulse-auth-recovery-v1';
  let current = null;
  const headers = token => ({ apikey: remote().SUPABASE_PUBLISHABLE_KEY, ...(token ? { Authorization: `Bearer ${token}` } : {}), 'Content-Type': 'application/json' });
  const endpoint = path => remote().SUPABASE_URL + path;
  const read = () => { try { return JSON.parse(root.localStorage.getItem(KEY) || 'null'); } catch { return null; } };
  const normalize = value => value && value.access_token ? { ...value, expires_at: Number(value.expires_at) || Math.floor(Date.now() / 1000) + (Number(value.expires_in) || 3600) } : value;
  const save = value => { current = normalize(value) || null; try { if (current) root.localStorage.setItem(KEY, JSON.stringify(current)); else root.localStorage.removeItem(KEY); } catch {} };
  async function request(path, options = {}) {
    const response = await root.fetch(endpoint(path), { method: options.method || 'GET', headers: headers(options.token), body: options.body ? JSON.stringify(options.body) : undefined });
    const data = await response.json().catch(() => ({}));
    if (!response.ok) throw new Error(data.msg || data.message || data.error_description || data.error || `Request failed (${response.status})`);
    return data;
  }
  async function subscription(user, token) {
    if (!user || !token) return { role: 'free', plan: null };
    try {
      const query = `/rest/v1/pulse_subscriptions?select=status,current_period_end,cancel_at_period_end,stripe_customer_id&user_id=eq.${encodeURIComponent(user.id)}&limit=1`;
      const response = await root.fetch(endpoint(query), { headers: { ...headers(token), Accept: 'application/json' } });
      if (!response.ok) return { role: 'free', plan: null };
      const rows = await response.json(), row = rows[0];
      const active = row && ['active', 'trialing'].includes(row.status) && (!row.current_period_end || Date.parse(row.current_period_end) > Date.now());
      return { role: active ? 'pro' : 'free', plan: row || null };
    } catch { return { role: 'free', plan: null }; }
  }
  async function refreshSession(value) {
    if (!value || !value.refresh_token) return null;
    const next = await request('/auth/v1/token?grant_type=refresh_token', { method: 'POST', body: { refresh_token: value.refresh_token } });
    save(next);
    return next;
  }
  async function activeSession() {
    let session = current || read();
    if (session && Number(session.expires_at) < Math.floor(Date.now() / 1000) + 60) session = await refreshSession(session);
    return session;
  }
  async function restore() {
    const fragment = new URLSearchParams((root.location.hash || '').slice(1));
    if (fragment.has('access_token') && fragment.has('refresh_token')) {
      const expiry = Number(fragment.get('expires_in')) || 3600;
      save({ access_token: fragment.get('access_token'), refresh_token: fragment.get('refresh_token'), token_type: fragment.get('token_type') || 'bearer', expires_at: Math.floor(Date.now() / 1000) + expiry });
      if (fragment.get('type') === 'recovery') { try { root.localStorage.setItem(RECOVERY_KEY, '1'); } catch {} }
      root.history.replaceState(null, '', root.location.pathname + root.location.search + '#/account');
    }
    let session = read();
    if (session && Number(session.expires_at) < Math.floor(Date.now() / 1000) + 60) {
      try { session = await refreshSession(session); } catch { save(null); session = null; }
    }
    if (!session || !session.access_token) return { session: null, user: null, role: 'free', plan: null };
    try {
      const user = await request('/auth/v1/user', { token: session.access_token });
      const plan = await subscription(user, session.access_token);
      current = session;
      let recovery = false;
      try { recovery = root.localStorage.getItem(RECOVERY_KEY) === '1'; } catch {}
      return { session, user, role: plan.role, plan: plan.plan, recovery };
    } catch {
      save(null);
      return { session: null, user: null, role: 'free', plan: null };
    }
  }
  async function signIn(email, password) {
    const session = await request('/auth/v1/token?grant_type=password', { method: 'POST', body: { email, password } });
    save(session);
    return restore();
  }
  async function signUp(email, password) {
    const redirect = root.location.origin + root.location.pathname;
    const result = await request('/auth/v1/signup?redirect_to=' + encodeURIComponent(redirect), { method: 'POST', body: { email, password } });
    const session = result.session || result;
    if (session.access_token) save(session);
    return session.access_token ? restore() : { needsConfirmation: true, user: result.user || null };
  }
  async function resetPassword(email) {
    await request('/auth/v1/recover?redirect_to=' + encodeURIComponent(root.location.origin + root.location.pathname), { method: 'POST', body: { email } });
  }
  async function updatePassword(password) {
    const session = current || read();
    if (!session || !session.access_token) throw new Error('Open the password reset link from your email first.');
    await request('/auth/v1/user', { method: 'PUT', token: session.access_token, body: { password } });
    try { root.localStorage.removeItem(RECOVERY_KEY); } catch {}
  }
  async function signOut() {
    const session = current || read();
    try { if (session && session.access_token) await request('/auth/v1/logout', { method: 'POST', token: session.access_token }); }
    catch {}
    finally { save(null); }
  }
  async function checkout() {
    const session = await activeSession();
    if (!session || !session.access_token) throw new Error('Sign in before subscribing.');
    const result = await request('/functions/v1/create-checkout-session', { method: 'POST', token: session.access_token, body: {} });
    if (!result.url) throw new Error('Checkout could not be started.');
    root.location.assign(result.url);
  }
  async function portal() {
    const session = await activeSession();
    if (!session || !session.access_token) throw new Error('Sign in to manage your subscription.');
    const result = await request('/functions/v1/create-portal-session', { method: 'POST', token: session.access_token, body: {} });
    if (!result.url) throw new Error('Subscription management could not be opened.');
    root.location.assign(result.url);
  }
  root.PulseAuth = { restore, signIn, signUp, resetPassword, updatePassword, signOut, checkout, portal };
})(typeof window !== 'undefined' ? window : globalThis);
