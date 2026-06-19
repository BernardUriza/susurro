import { useCallback, useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { CopyButton } from './copy-button';
import {
  SUSURRO_GATEWAY,
  type AdminKey,
  type AdminKeysResponse,
  type CreatedKeyResponse,
} from './gateway';
import styles from './pages.module.css';

const ADMIN_TOKEN_STORAGE_KEY = 'susurro_admin_token';

function formatDailyLimit(limit: number): string {
  return limit === 0 ? '∞' : String(limit);
}

function formatCost(cost: number): string {
  return `$${cost.toFixed(4)}`;
}

export function AdminPage() {
  const [adminToken, setAdminToken] = useState<string>(
    () => localStorage.getItem(ADMIN_TOKEN_STORAGE_KEY) ?? ''
  );
  const [tokenInput, setTokenInput] = useState('');
  const [keys, setKeys] = useState<AdminKey[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [newKey, setNewKey] = useState<CreatedKeyResponse | null>(null);
  const [createName, setCreateName] = useState('');
  const [createLimit, setCreateLimit] = useState('0');

  const clearStoredToken = useCallback(() => {
    localStorage.removeItem(ADMIN_TOKEN_STORAGE_KEY);
    setAdminToken('');
    setKeys([]);
  }, []);

  const loadKeys = useCallback(async (token: string) => {
    setLoading(true);
    setError(null);
    try {
      const res = await fetch(`${SUSURRO_GATEWAY}/admin/keys`, {
        headers: { Authorization: `Bearer ${token}` },
      });
      if (res.status === 401) {
        setError('invalid admin token');
        localStorage.removeItem(ADMIN_TOKEN_STORAGE_KEY);
        setAdminToken('');
        setKeys([]);
        return;
      }
      if (!res.ok) {
        throw new Error(`admin/keys returned ${res.status}`);
      }
      const data = (await res.json()) as AdminKeysResponse;
      setKeys(data.keys);
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : 'failed to load keys');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    if (adminToken) {
      void loadKeys(adminToken);
    }
  }, [adminToken, loadKeys]);

  const handleLogin = () => {
    const trimmed = tokenInput.trim();
    if (!trimmed) {
      return;
    }
    localStorage.setItem(ADMIN_TOKEN_STORAGE_KEY, trimmed);
    setAdminToken(trimmed);
    setTokenInput('');
  };

  const handleCreate = async () => {
    if (!createName.trim()) {
      return;
    }
    setError(null);
    try {
      const res = await fetch(`${SUSURRO_GATEWAY}/admin/keys`, {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${adminToken}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          name: createName.trim(),
          daily_limit: Number(createLimit) || 0,
        }),
      });
      if (!res.ok) {
        throw new Error(`create key returned ${res.status}`);
      }
      const created = (await res.json()) as CreatedKeyResponse;
      setNewKey(created);
      setCreateName('');
      setCreateLimit('0');
      await loadKeys(adminToken);
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : 'failed to create key');
    }
  };

  const handleRevoke = async (token: string) => {
    setError(null);
    try {
      const res = await fetch(`${SUSURRO_GATEWAY}/admin/keys/${token}/revoke`, {
        method: 'POST',
        headers: { Authorization: `Bearer ${adminToken}` },
      });
      if (!res.ok) {
        throw new Error(`revoke returned ${res.status}`);
      }
      await loadKeys(adminToken);
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : 'failed to revoke key');
    }
  };

  if (!adminToken) {
    return (
      <div className={styles.page}>
        <div className={styles.inner}>
          <div className={styles.topBar}>
            <h1 className={styles.title}>Susurro Admin</h1>
            <Link to="/" className={styles.homeLink}>
              ← demo
            </Link>
          </div>
          {error && <div className={styles.errorBox}>{error}</div>}
          <section className={styles.section}>
            <h2 className={styles.sectionTitle}>Authenticate</h2>
            <div className={styles.field}>
              <label className={styles.label} htmlFor="admin-token">
                admin token
              </label>
              <input
                id="admin-token"
                className={styles.input}
                type="password"
                value={tokenInput}
                onChange={(e) => setTokenInput(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === 'Enter') {
                    handleLogin();
                  }
                }}
                placeholder="Bearer admin token"
              />
            </div>
            <button type="button" className={styles.button} onClick={handleLogin}>
              unlock
            </button>
          </section>
        </div>
      </div>
    );
  }

  return (
    <div className={styles.page}>
      <div className={styles.inner}>
        <div className={styles.topBar}>
          <h1 className={styles.title}>Susurro Admin</h1>
          <div className={styles.row}>
            <Link to="/" className={styles.homeLink}>
              ← demo
            </Link>
            <button type="button" className={styles.button} onClick={clearStoredToken}>
              logout
            </button>
          </div>
        </div>

        {error && <div className={styles.errorBox}>{error}</div>}

        {newKey && (
          <div className={styles.newKeyBox}>
            <p className={styles.newKeyWarning}>
              save this now — the full token is shown only once.
            </p>
            <div className={styles.tokenBox}>
              <span className={styles.tokenValue}>{newKey.token}</span>
              <CopyButton value={newKey.token} />
            </div>
            <p className={styles.notice}>
              name: {newKey.name} · daily limit: {formatDailyLimit(newKey.daily_limit)}
            </p>
          </div>
        )}

        <section className={styles.section}>
          <h2 className={styles.sectionTitle}>Create project key</h2>
          <div className={styles.row}>
            <div className={styles.field}>
              <label className={styles.label} htmlFor="key-name">
                name
              </label>
              <input
                id="key-name"
                className={styles.input}
                type="text"
                value={createName}
                onChange={(e) => setCreateName(e.target.value)}
                placeholder="project name"
              />
            </div>
            <div className={styles.field}>
              <label className={styles.label} htmlFor="key-limit">
                daily limit (0 = ∞)
              </label>
              <input
                id="key-limit"
                className={styles.input}
                type="number"
                min={0}
                value={createLimit}
                onChange={(e) => setCreateLimit(e.target.value)}
              />
            </div>
            <button type="button" className={styles.button} onClick={handleCreate}>
              create
            </button>
          </div>
        </section>

        <section className={styles.section}>
          <h2 className={styles.sectionTitle}>Keys</h2>
          {loading && <p className={styles.notice}>loading keys…</p>}
          <div className={styles.tableWrap}>
            <table className={styles.table}>
              <thead>
                <tr>
                  <th>name</th>
                  <th>kind</th>
                  <th>daily limit</th>
                  <th>active</th>
                  <th>requests today</th>
                  <th>requests total</th>
                  <th>est. cost usd</th>
                  <th>actions</th>
                </tr>
              </thead>
              <tbody>
                {keys.map((key) => (
                  <tr key={key.token} className={key.active ? undefined : styles.rowInactive}>
                    <td>{key.name}</td>
                    <td>{key.kind}</td>
                    <td>{formatDailyLimit(key.daily_limit)}</td>
                    <td>{key.active ? 'yes' : 'no'}</td>
                    <td>{key.requests_today}</td>
                    <td>{key.requests_total}</td>
                    <td>{formatCost(key.est_cost_usd_total)}</td>
                    <td>
                      <div className={styles.row}>
                        <CopyButton value={key.token} label="copy token" />
                        {key.active && (
                          <button
                            type="button"
                            className={`${styles.copyButton} ${styles.buttonDanger}`}
                            onClick={() => handleRevoke(key.token)}
                          >
                            revoke
                          </button>
                        )}
                      </div>
                    </td>
                  </tr>
                ))}
                {!loading && keys.length === 0 && (
                  <tr>
                    <td colSpan={8} className={styles.notice}>
                      no keys yet
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        </section>
      </div>
    </div>
  );
}
