import { useRef, useState, useEffect } from 'react';
import { X, Camera } from 'lucide-react';

interface ReceiptCameraModalProps {
  onCapture: (file: File) => void;
  onClose: () => void;
}

export default function ReceiptCameraModal({ onCapture, onClose }: ReceiptCameraModalProps) {
  const videoRef = useRef<HTMLVideoElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let stream: MediaStream | null = null;
    
    async function startCamera() {
      try {
        stream = await navigator.mediaDevices.getUserMedia({ 
          video: { facingMode: 'environment' } 
        });
        if (videoRef.current) {
          videoRef.current.srcObject = stream;
        }
      } catch (err) {
        console.error("Error accessing camera:", err);
        setError("Could not access camera. Please check permissions or use the upload button.");
      }
    }
    
    startCamera();

    return () => {
      if (stream) {
        stream.getTracks().forEach(track => track.stop());
      }
    };
  }, []);

  const handleCapture = () => {
    if (videoRef.current && canvasRef.current) {
      const video = videoRef.current;
      const canvas = canvasRef.current;
      canvas.width = video.videoWidth;
      canvas.height = video.videoHeight;
      const ctx = canvas.getContext('2d');
      if (ctx) {
        ctx.drawImage(video, 0, 0, canvas.width, canvas.height);
        canvas.toBlob((blob) => {
          if (blob) {
            const file = new File([blob], "receipt_capture.jpg", { type: "image/jpeg" });
            onCapture(file);
          }
        }, 'image/jpeg', 0.9);
      }
    }
  };

  return (
    <div className="modal-overlay" style={{ zIndex: 9999 }}>
      <div className="modal glass-panel" style={{ width: '90%', maxWidth: '500px', display: 'flex', flexDirection: 'column' }}>
        <div className="modal-header">
          <h2>Scan Receipt</h2>
          <button className="icon-btn" onClick={onClose}><X size={20} /></button>
        </div>
        <div style={{ padding: '1rem', display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '1rem' }}>
          {error ? (
            <div style={{ color: 'var(--danger)', padding: '1rem', textAlign: 'center' }}>{error}</div>
          ) : (
            <>
              <div style={{ position: 'relative', width: '100%', background: '#000', borderRadius: '0.5rem', overflow: 'hidden', aspectRatio: '3/4' }}>
                <video 
                  ref={videoRef} 
                  autoPlay 
                  playsInline 
                  style={{ width: '100%', height: '100%', objectFit: 'cover' }}
                />
              </div>
              <button className="btn" style={{ background: '#10b981', padding: '1rem 2rem', fontSize: '1.1rem', borderRadius: '2rem', display: 'flex', gap: '0.5rem', alignItems: 'center' }} onClick={handleCapture}>
                <Camera size={24} /> Take Photo
              </button>
            </>
          )}
          <canvas ref={canvasRef} style={{ display: 'none' }} />
        </div>
      </div>
    </div>
  );
}
