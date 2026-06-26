import { useEffect, useRef, useState } from 'react';
import { Link } from 'react-router-dom';
import { SUSURRO_GATEWAY, type DiscoveryResponse } from './gateway';
import styles from './pages.module.css';

export function PlaygroundPage() {
  const [token, setToken] = useState('');
  const [recording, setRecording] = useState(false);
  const [transcript, setTranscript] = useState('');
  const [ttsText, setTtsText] = useState('Hola, soy susurro.');
  const [ttsVoice, setTtsVoice] = useState('onyx');
  const [audioUrl, setAudioUrl] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [fileName, setFileName] = useState<string | null>(null);
  const [fileTask, setFileTask] = useState<'transcribe' | 'translate'>('transcribe');
  const [fileResult, setFileResult] = useState('');
  const recorderRef = useRef<MediaRecorder | null>(null);
  const chunksRef = useRef<Blob[]>([]);
  const fileInputRef = useRef<HTMLInputElement | null>(null);

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

  const transcribeFile = async (file: File) => {
    setError(null);
    setFileResult('');
    setBusy(true);
    try {
      const params = new URLSearchParams({ task: fileTask });
      if (fileTask === 'transcribe') {
        params.set('language', 'es');
      }
      const ext = file.name.split('.').pop()?.toLowerCase();
      if (ext) {
        params.set('format', ext);
      }
      const res = await fetch(`${SUSURRO_GATEWAY}/v1/stt?${params.toString()}`, {
        method: 'POST',
        headers: { Authorization: `Bearer ${token}`, 'Content-Type': file.type || 'audio/mpeg' },
        body: file,
      });
      const data = (await res.json()) as { transcript?: string; detail?: string };
      if (!res.ok) {
        setError(data.detail ?? `stt failed (${res.status})`);
        return;
      }
      setFileResult(data.transcript ?? '(empty)');
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : 'file upload failed');
    } finally {
      setBusy(false);
    }
  };

  const onFilePicked = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) {
      return;
    }
    setFileName(file.name);
    void transcribeFile(file);
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
        body: JSON.stringify({ input: ttsText.trim(), voice: ttsVoice }),
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
          Runs against the live gateway with the rate-limited demo token. Mic, file upload + text —
          no models in your browser.
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
          <h2 className={styles.sectionTitle}>File → text</h2>
          <p className={styles.notice}>
            Upload an audio file. <strong>Transcribe</strong> keeps the original language;{' '}
            <strong>translate</strong> runs Whisper translation — output is always English.
          </p>
          <div className={styles.field}>
            <label className={styles.notice}>
              <input
                type="radio"
                name="fileTask"
                checked={fileTask === 'transcribe'}
                onChange={() => setFileTask('transcribe')}
              />{' '}
              transcribe (español)
            </label>
            <label className={styles.notice} style={{ marginLeft: '1rem' }}>
              <input
                type="radio"
                name="fileTask"
                checked={fileTask === 'translate'}
                onChange={() => setFileTask('translate')}
              />{' '}
              translate → English
            </label>
          </div>
          <input
            ref={fileInputRef}
            type="file"
            accept="audio/*,.mp3,.wav,.m4a,.ogg,.webm,.flac,.mp4"
            onChange={onFilePicked}
            disabled={busy}
            style={{ display: 'none' }}
          />
          <button
            type="button"
            className={styles.button}
            onClick={() => fileInputRef.current?.click()}
            disabled={busy}
          >
            {busy ? 'processing…' : '⬆ choose audio file'}
          </button>
          {fileName && <p className={styles.notice}>{fileName}</p>}
          {fileResult && (
            <div className={styles.tokenBox}>
              <span className={styles.tokenValue}>{fileResult}</span>
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
          <div className={styles.field}>
            <select
              className={styles.input}
              value={ttsVoice}
              onChange={(e) => setTtsVoice(e.target.value)}
              aria-label="voice"
            >
              {['onyx', 'alloy', 'echo', 'fable', 'nova', 'shimmer'].map((v) => (
                <option key={v} value={v}>
                  {v}
                </option>
              ))}
            </select>
          </div>
          <button type="button" className={styles.button} onClick={speak} disabled={busy}>
            {busy ? 'synthesizing…' : `▶ speak (${ttsVoice})`}
          </button>
          {audioUrl && (
            <audio src={audioUrl} controls autoPlay style={{ marginTop: '1rem', width: '100%' }} />
          )}
        </section>
      </div>
    </div>
  );
}
