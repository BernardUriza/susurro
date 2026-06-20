import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { CopyButton } from './copy-button';
import { SUSURRO_GATEWAY, type ClaimResponse } from './gateway';
import styles from './pages.module.css';

export function ClaimPage() {
  const [code, setCode] = useState('');
  const [name, setName] = useState('');
  const [claimed, setClaimed] = useState<ClaimResponse | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    const hash = window.location.hash.replace(/^#/, '').trim();
    if (hash.startsWith('claim-')) {
      setCode(hash);
    }
  }, []);

  const redeem = async () => {
    const trimmedCode = code.trim();
    if (!trimmedCode) {
      return;
    }
    setLoading(true);
    setError(null);
    try {
      const res = await fetch(`${SUSURRO_GATEWAY}/v1/claim`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          claim_code: trimmedCode,
          name: name.trim() || undefined,
        }),
      });
      const data = (await res.json()) as ClaimResponse & { detail?: string };
      if (!res.ok) {
        setError(data.detail ?? `claim failed (${res.status})`);
        return;
      }
      setClaimed(data);
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : 'claim request failed');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className={styles.page}>
      <div className={styles.inner}>
        <div className={styles.topBar}>
          <h1 className={styles.title}>Susurro — Claim a token</h1>
          <Link to="/" className={styles.homeLink}>
            ← docs
          </Link>
        </div>

        {error && <div className={styles.errorBox}>{error}</div>}

        {claimed ? (
          <div className={styles.newKeyBox}>
            <p className={styles.newKeyWarning}>
              save this now — your token is shown only ONCE. The claim is now burned.
            </p>
            <div className={styles.tokenBox}>
              <span className={styles.tokenValue}>{claimed.token}</span>
              <CopyButton value={claimed.token} />
            </div>
            <p className={styles.notice}>
              app identifier: <strong>{claimed.name}</strong>
            </p>
            <p className={styles.notice}>
              Send it as <code>Authorization: Bearer &lt;token&gt;</code> to{' '}
              {SUSURRO_GATEWAY}/v1/* — or as the <code>api-key</code> header for Azure-OpenAI-shaped
              clients. See <Link to="/docs" className={styles.homeLink}>the docs</Link>.
            </p>
          </div>
        ) : (
          <section className={styles.section}>
            <h2 className={styles.sectionTitle}>Redeem your claim</h2>
            <p className={styles.notice}>
              Paste the claim code the owner gave you. You get a token once; this code then dies.
            </p>
            <div className={styles.field}>
              <label className={styles.label} htmlFor="claim-code">
                claim code
              </label>
              <input
                id="claim-code"
                className={styles.input}
                type="text"
                value={code}
                onChange={(e) => setCode(e.target.value)}
                placeholder="claim-..."
              />
            </div>
            <div className={styles.field}>
              <label className={styles.label} htmlFor="claim-name">
                app identifier (only if the owner left it open)
              </label>
              <input
                id="claim-name"
                className={styles.input}
                type="text"
                value={name}
                onChange={(e) => setName(e.target.value)}
                placeholder="my-app (optional)"
              />
            </div>
            <button type="button" className={styles.button} onClick={redeem} disabled={loading}>
              {loading ? 'claiming…' : 'claim token'}
            </button>
          </section>
        )}
      </div>
    </div>
  );
}
