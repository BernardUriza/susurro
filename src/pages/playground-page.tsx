import { useEffect, useRef, useState } from 'react';
import { Link } from 'react-router-dom';
import { SUSURRO_GATEWAY, type DiscoveryResponse } from './gateway';
import styles from './pages.module.css';

export function PlaygroundPage() {
  const [token, setToken] = useState('');
  const [recording, setRecording] = useState(false);
  const [transcript, setTranscript] = useState('');
  const [ttsText, setTtsText] = useState('Hola, soy susurro.');
  const [audioUrl, setAudioUrl] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const recorderRef = useRef<MediaRecorder | null>(null);
  const chunksRef = useRef<Blob[]>([]);

  useEffect(() => {
    fetch(`${SUSURRO_GATEWAY}/v1/discovery`)
      .then((res) => res.json() as Promise<DiscoveryResponse>)
      .then((d) => setToken(d.onboarding_token))
      .catch(() => setError('could not load a demo token'));
  }, []);

  const startRecording = async () => {
    setError(null);
    setTranscript('');
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      const rec = new MediaRecorder(stream);
      chunksRef.current = [];
      rec.ondataavailable = (e) => chunksRef.current.push(e.data);
      rec.onstop = async () => {
        stream.getTracks().forEach((t) => t.stop());
        const blob = new Blob(chunksRef.current, { type: rec.mimeType });
        await transcribe(blob);
      };
      recorderRef.current = rec;
      rec.start();
      setRecording(true);
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : 'mic access failed');
    }
  };

  const stopRecording = () => {
    recorderRef.current?.stop();
    setRecording(false);
  };

  const transcribe = async (blob: Blob) => {
    setBusy(true);
    try {
      const res = await fetch(`${SUSURRO_GATEWAY}/v1/stt?language=es`, {
        method: 'POST',
        headers: { Authorization: `Bearer ${token}`, 'Content-Type': blob.type || 'audio/webm' },
        body: blob,
      });
      const data = (await res.json()) as { transcript?: string; detail?: string };
      if (!res.ok) {
        setError(data.detail ?? `stt failed (${res.status})`);
        return;
      }
      setTranscript(data.transcript ?? '(empty)');
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : 'stt request failed');
    } finally {
      setBusy(false);
    }
  };

  const speak = async () => {
    if (!ttsText.trim()) {
      return;
    }
    setError(null);
    setBusy(true);
    try {
      const res = await fetch(`${SUSURRO_GATEWAY}/v1/tts`, {
        method: 'POST',
        headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
        body: JSON.stringify({ input: ttsText.trim(), voice: 'onyx' }),
      });
      if (!res.ok) {
        const data = (await res.json()) as { detail?: string };
        setError(data.detail ?? `tts failed (${res.status})`);
        return;
      }
      const blob = await res.blob();
      setAudioUrl(URL.createObjectURL(blob));
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : 'tts request failed');
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className={styles.page}>
      <div className={styles.inner}>
        <div className={styles.topBar}>
          <h1 className={styles.title}>Susurro Playground</h1>
          <Link to="/docs" className={styles.homeLink}>
            ← docs
          </Link>
        </div>

        {error && <div className={styles.errorBox}>{error}</div>}
        <p className={styles.notice}>
          Runs against the live gateway with the rate-limited demo token. Mic + text only — no
          models in your browser.
        </p>

        <section className={styles.section}>
          <h2 className={styles.sectionTitle}>Speech → text</h2>
          <button
            type="button"
            className={styles.button}
            onClick={recording ? stopRecording : startRecording}
            disabled={busy && !recording}
          >
            {recording ? '■ stop & transcribe' : '● record'}
          </button>
          {busy && !recording && <p className={styles.notice}>transcribing…</p>}
          {transcript && (
            <div className={styles.tokenBox}>
              <span className={styles.tokenValue}>{transcript}</span>
            </div>
          )}
        </section>

        <section className={styles.section}>
          <h2 className={styles.sectionTitle}>Text → speech</h2>
          <div className={styles.field}>
            <textarea
              className={styles.input}
              rows={3}
              value={ttsText}
              onChange={(e) => setTtsText(e.target.value)}
            />
          </div>
          <button type="button" className={styles.button} onClick={speak} disabled={busy}>
            {busy ? 'synthesizing…' : '▶ speak'}
          </button>
          {audioUrl && <audio src={audioUrl} controls autoPlay style={{ marginTop: '1rem', width: '100%' }} />}
        </section>
      </div>
    </div>
  );
}
