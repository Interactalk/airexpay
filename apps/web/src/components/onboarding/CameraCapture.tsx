import { useEffect, useRef, useState } from 'react';
import { assessRaster, qualityIssueCopy, type QualityIssue } from '../../lib/image-quality.ts';
import { documentMimeFromBytes, MAX_DOCUMENT_BYTES } from '@airexpay/validation';

type CameraState =
  'idle' | 'requesting' | 'live' | 'denied' | 'missing' | 'unavailable' | 'preview';

const PROMPTS = [
  'Blink twice, then hold still.',
  'Turn your head slowly to the left, then face the camera.',
  'Turn your head slowly to the right, then face the camera.',
] as const;

export function CameraCapture({
  facing,
  label,
  liveness = false,
  onConfirm,
}: {
  facing: 'environment' | 'user';
  label: string;
  liveness?: boolean;
  onConfirm: (file: Blob, mime: string) => void;
}) {
  const videoRef = useRef<HTMLVideoElement>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const [state, setState] = useState<CameraState>('idle');
  const [issues, setIssues] = useState<QualityIssue[]>([]);
  const [preview, setPreview] = useState<string | null>(null);
  const [pending, setPending] = useState<Blob | null>(null);
  const [pendingMime, setPendingMime] = useState<string | null>(null);
  const [fileError, setFileError] = useState<string | null>(null);
  const [challenge] = useState(
    () => PROMPTS[Math.floor(Math.random() * PROMPTS.length)] ?? PROMPTS[0],
  );
  const [challengeDone, setChallengeDone] = useState(false);

  const previewUrl = useRef<string | null>(null);
  useEffect(() => {
    previewUrl.current = preview;
  }, [preview]);
  useEffect(() => {
    return () => {
      stopStream(streamRef.current);
      streamRef.current = null;
      if (previewUrl.current) URL.revokeObjectURL(previewUrl.current);
    };
  }, []);

  async function start() {
    setFileError(null);
    setState('requesting');
    if (!navigator.mediaDevices?.getUserMedia) {
      setState('unavailable');
      return;
    }
    try {
      const stream = await navigator.mediaDevices.getUserMedia({
        audio: false,
        video: { facingMode: { ideal: facing }, width: { ideal: 1280 }, height: { ideal: 720 } },
      });
      streamRef.current = stream;
      const video = videoRef.current;
      if (video) {
        video.srcObject = stream;
        await video.play();
      }
      setState('live');
    } catch (error) {
      const name = error instanceof DOMException ? error.name : '';
      if (
        name === 'NotAllowedError' ||
        name === 'PermissionDeniedError' ||
        name === 'SecurityError'
      ) {
        setState('denied');
        return;
      }
      if (
        name === 'NotFoundError' ||
        name === 'OverconstrainedError' ||
        name === 'DevicesNotFoundError'
      ) {
        setState('missing');
        return;
      }
      setState('unavailable');
    }
  }

  async function capture() {
    const video = videoRef.current;
    if (!video || video.videoWidth === 0) return;
    const canvas = document.createElement('canvas');
    canvas.width = video.videoWidth;
    canvas.height = video.videoHeight;
    const context = canvas.getContext('2d', { willReadFrequently: true });
    if (!context) return;
    context.drawImage(video, 0, 0);
    const pixels = context.getImageData(0, 0, canvas.width, canvas.height);
    const report = assessRaster({ width: canvas.width, height: canvas.height, rgba: pixels.data });
    const blob = await new Promise<Blob | null>((resolve) =>
      canvas.toBlob(resolve, 'image/jpeg', 0.92),
    );
    if (!blob) return;
    showCandidate(blob, 'image/jpeg', report.issues);
  }

  function showCandidate(blob: Blob, mime: string, nextIssues: QualityIssue[]) {
    setIssues(nextIssues);
    setPending(nextIssues.length === 0 ? blob : null);
    setPendingMime(nextIssues.length === 0 ? mime : null);
    setPreview((current) => {
      if (current) URL.revokeObjectURL(current);
      return URL.createObjectURL(blob);
    });
    setState('preview');
    stopStream(streamRef.current);
    streamRef.current = null;
  }

  function retake() {
    setPending(null);
    setPendingMime(null);
    setIssues([]);
    setPreview((current) => {
      if (current) URL.revokeObjectURL(current);
      return null;
    });
    setState('idle');
  }

  async function onFile(file: File) {
    setFileError(null);
    if (file.size > MAX_DOCUMENT_BYTES) {
      setFileError('Files must be 10 MB or smaller.');
      return;
    }
    const bytes = new Uint8Array(await file.arrayBuffer());
    const mime = documentMimeFromBytes(bytes);
    if (!mime) {
      setFileError('Upload a JPG, PNG, or PDF. The file type is checked from its contents.');
      return;
    }
    if (mime === 'application/pdf') {
      showCandidate(new Blob([bytes], { type: mime }), mime, []);
      return;
    }
    const bitmap = await createImageBitmap(new Blob([bytes], { type: mime }));
    const canvas = document.createElement('canvas');
    canvas.width = bitmap.width;
    canvas.height = bitmap.height;
    const context = canvas.getContext('2d', { willReadFrequently: true });
    if (!context) return;
    context.drawImage(bitmap, 0, 0);
    bitmap.close();
    const pixels = context.getImageData(0, 0, canvas.width, canvas.height);
    const report = assessRaster({ width: canvas.width, height: canvas.height, rgba: pixels.data });
    showCandidate(new Blob([bytes], { type: mime }), mime, report.issues);
  }

  return (
    <div className="camera-block">
      <div className="row between">
        <h3 style={{ margin: 0 }}>{label}</h3>
      </div>
      {liveness ? (
        <div className="callout" style={{ marginTop: 10 }}>
          <div style={{ fontWeight: 600 }}>Basic check: {challenge}</div>
          <p className="muted" style={{ margin: '6px 0 0' }}>
            This is only a basic prompt. Real liveness review would be done by a KYC provider. That
            provider has not been chosen and is waiting on legal review.
          </p>
          <label className="row" style={{ marginTop: 8 }}>
            <input
              type="checkbox"
              checked={challengeDone}
              onChange={(event) => setChallengeDone(event.target.checked)}
            />
            I completed the prompt
          </label>
        </div>
      ) : null}
      <div className="camera-stage" style={{ marginTop: 12 }}>
        {state === 'live' || state === 'requesting' ? (
          <video ref={videoRef} playsInline muted autoPlay data-testid="camera-video" />
        ) : null}
        {preview && state === 'preview' ? <img src={preview} alt="" /> : null}
        {state === 'live' ? <div className="guide-frame" aria-hidden="true" /> : null}
      </div>
      {state === 'denied' ? (
        <p data-testid="camera-error" role="alert">
          Camera access was denied. You can upload a file instead.
        </p>
      ) : null}
      {state === 'missing' ? (
        <p data-testid="camera-error" role="alert">
          No camera was found on this device. You can upload a file instead.
        </p>
      ) : null}
      {state === 'unavailable' ? (
        <p data-testid="camera-error" role="alert">
          The camera is unavailable. You can upload a file instead.
        </p>
      ) : null}
      {issues.length > 0 ? (
        <ul>
          {issues.map((issue) => (
            <li key={issue}>{qualityIssueCopy(issue)}</li>
          ))}
        </ul>
      ) : null}
      {fileError ? <p role="alert">{fileError}</p> : null}
      <div className="row" style={{ marginTop: 12, flexWrap: 'wrap' }}>
        {state !== 'live' && state !== 'preview' ? (
          <button
            type="button"
            className="btn btn-primary"
            data-testid="camera-start"
            onClick={() => void start()}
          >
            Allow camera
          </button>
        ) : null}
        {state === 'live' ? (
          <button
            type="button"
            className="btn btn-primary"
            data-testid="camera-capture"
            onClick={() => void capture()}
          >
            Capture
          </button>
        ) : null}
        {state === 'preview' ? (
          <button type="button" className="btn btn-outline" onClick={retake}>
            Retake
          </button>
        ) : null}
        {state === 'preview' && pending && pendingMime ? (
          <button
            type="button"
            className="btn btn-primary"
            data-testid="camera-confirm"
            disabled={liveness && !challengeDone}
            onClick={() => onConfirm(pending, pendingMime)}
          >
            Use this photo
          </button>
        ) : null}
        <label className="btn btn-outline">
          Upload a file
          <input
            type="file"
            accept="image/jpeg,image/png,application/pdf"
            style={{
              position: 'absolute',
              width: 1,
              height: 1,
              overflow: 'hidden',
              clip: 'rect(0 0 0 0)',
            }}
            onChange={(event) => {
              const file = event.target.files?.[0];
              event.target.value = '';
              if (file) void onFile(file);
            }}
          />
        </label>
      </div>
    </div>
  );
}

function stopStream(stream: MediaStream | null) {
  stream?.getTracks().forEach((track) => track.stop());
}
