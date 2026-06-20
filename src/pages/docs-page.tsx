import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { CopyButton } from './copy-button';
import { SUSURRO_GATEWAY, type DiscoveryEndpoint, type DiscoveryResponse } from './gateway';
import styles from './pages.module.css';

function buildFetchExample(endpoint: DiscoveryEndpoint, token: string): string {
  const bodyLiteral = JSON.stringify(endpoint.body, null, 2);
  return [
    `const res = await fetch('${endpoint.url}', {`,
    `  method: '${endpoint.method}',`,
    `  headers: {`,
    `    'Authorization': 'Bearer ${token}',`,
    `    'Content-Type': 'application/json',`,
    `  },`,
    `  body: JSON.stringify(${bodyLiteral}),`,
    `});`,
    `const data = await res.json();`,
  ].join('\n');
}

function buildPythonExample(endpoint: DiscoveryEndpoint, token: string): string {
  const bodyLiteral = JSON.stringify(endpoint.body, null, 2);
  return [
    `import httpx`,
    ``,
    `res = httpx.${endpoint.method.toLowerCase()}(`,
    `    '${endpoint.url}',`,
    `    headers={`,
    `        'Authorization': 'Bearer ${token}',`,
    `        'Content-Type': 'application/json',`,
    `    },`,
    `    json=${bodyLiteral},`,
    `)`,
    `data = res.json()`,
  ].join('\n');
}

interface CodeBlockProps {
  label: string;
  code: string;
}

function CodeBlock({ label, code }: CodeBlockProps) {
  return (
    <div className={styles.codeBlockWrap}>
      <div className={styles.codeHeader}>
        <span className={styles.codeLabel}>{label}</span>
        <CopyButton value={code} />
      </div>
      <pre className={styles.codeBlock}>{code}</pre>
    </div>
  );
}

interface EndpointCardProps {
  name: string;
  endpoint: DiscoveryEndpoint;
  token: string;
}

function EndpointCard({ name, endpoint, token }: EndpointCardProps) {
  const showClientExamples = name === 'tts' || name === 'stt';
  return (
    <section className={styles.section}>
      <h2 className={styles.sectionTitle}>{name}</h2>
      <div className={styles.endpointMeta}>
        <span className={styles.method}>{endpoint.method}</span>
        <span className={styles.url}>{endpoint.url}</span>
      </div>
      <CodeBlock label="body" code={JSON.stringify(endpoint.body, null, 2)} />
      <p className={styles.notice}>
        returns:{' '}
        {typeof endpoint.returns === 'string'
          ? endpoint.returns
          : JSON.stringify(endpoint.returns)}
      </p>
      <CodeBlock label="curl" code={endpoint.curl} />
      {showClientExamples && (
        <>
          <CodeBlock label="javascript (fetch)" code={buildFetchExample(endpoint, token)} />
          <CodeBlock label="python (httpx)" code={buildPythonExample(endpoint, token)} />
        </>
      )}
    </section>
  );
}

export function DocsPage() {
  const [discovery, setDiscovery] = useState<DiscoveryResponse | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    fetch(`${SUSURRO_GATEWAY}/v1/discovery`)
      .then((res) => {
        if (!res.ok) {
          throw new Error(`discovery returned ${res.status}`);
        }
        return res.json() as Promise<DiscoveryResponse>;
      })
      .then((data) => {
        if (!cancelled) {
          setDiscovery(data);
        }
      })
      .catch((err: unknown) => {
        if (!cancelled) {
          setError(err instanceof Error ? err.message : 'failed to load discovery');
        }
      });
    return () => {
      cancelled = true;
    };
  }, []);

  const rateLimitNote =
    discovery?.rate_limit?.note ??
    (discovery?.rate_limit?.limit ? String(discovery.rate_limit.limit) : undefined);

  return (
    <div className={styles.page}>
      <div className={styles.inner}>
        <div className={styles.topBar}>
          <h1 className={styles.title}>Susurro Docs</h1>
          <Link to="/" className={styles.homeLink}>
            ← demo
          </Link>
        </div>

        {error && <div className={styles.errorBox}>could not reach gateway: {error}</div>}

        {!discovery && !error && <p className={styles.notice}>loading discovery…</p>}

        {discovery && (
          <>
            <p className={styles.subtitle}>{discovery.purpose}</p>

            <section className={styles.section}>
              <h2 className={styles.sectionTitle}>Demo token — try it (rate-limited)</h2>
              <div className={styles.tokenBox}>
                <span className={styles.tokenValue}>{discovery.onboarding_token}</span>
                <CopyButton value={discovery.onboarding_token} />
              </div>
              <p className={styles.notice}>
                For experimenting only{rateLimitNote ? ` — rate limit: ${rateLimitNote}` : ''}. NOT
                for a real app. To run an app in production, ask the owner for a one-time claim link;
                you redeem it once to get your own unlimited key.
              </p>
            </section>

            <div className={styles.callout}>
              <strong>For AI agents:</strong> <code>GET {SUSURRO_GATEWAY}/v1/discovery</code> returns
              this full contract as JSON for machine self-onboarding. The demo token above is
              rate-limited (50/day) — use it to try the API, then ask the owner for a claim link to
              get your app its own key.
            </div>

            <EndpointCard
              name="tts"
              endpoint={discovery.endpoints.tts}
              token={discovery.onboarding_token}
            />
            <EndpointCard
              name="stt"
              endpoint={discovery.endpoints.stt}
              token={discovery.onboarding_token}
            />
            <EndpointCard
              name="refine"
              endpoint={discovery.endpoints.refine}
              token={discovery.onboarding_token}
            />

            {discovery.azure_openai_compatible && (
              <section className={styles.section}>
                <h2 className={styles.sectionTitle}>Azure OpenAI compatible</h2>
                <p className={styles.notice}>{discovery.azure_openai_compatible.purpose}</p>
                <p className={styles.notice}>
                  TTS: <code>{discovery.azure_openai_compatible.tts}</code>
                </p>
                <p className={styles.notice}>
                  STT: <code>{discovery.azure_openai_compatible.stt}</code>
                </p>
                <p className={styles.notice}>{discovery.azure_openai_compatible.auth}</p>
              </section>
            )}
          </>
        )}
      </div>
    </div>
  );
}
