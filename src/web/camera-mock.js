// Web camera mock using getUserMedia API
import React from 'react';

// Camera component mock for web
const Camera = React.forwardRef((props, ref) => {
  const videoRef = React.useRef(null);
  const [stream, setStream] = React.useState(null);
  const [error, setError] = React.useState(null);

  React.useEffect(() => {
    if (!props.isActive) return;

    const initCamera = async () => {
      try {
        const mediaStream = await navigator.mediaDevices.getUserMedia({
          video: {
            facingMode: props.device?.position === 'front' ? 'user' : 'environment',
            width: { ideal: 1280 },
            height: { ideal: 720 }
          }
        });
        setStream(mediaStream);
        if (videoRef.current) {
          videoRef.current.srcObject = mediaStream;
        }
      } catch (err) {
        console.error('Camera access failed:', err);
        setError(err.message);
      }
    };

    initCamera();

    return () => {
      if (stream) {
        stream.getTracks().forEach(track => track.stop());
      }
    };
  }, [props.isActive, props.device]);

  if (error) {
    return (
      <div style={{
        ...props.style,
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        backgroundColor: 'black',
        color: 'white',
        fontSize: '16px',
        textAlign: 'center',
        padding: '20px'
      }}>
        Camera Error: {error}
        <br />
        Please allow camera access
      </div>
    );
  }

  return (
    <video
      ref={videoRef}
      style={{
        width: '100%',
        height: '100%',
        objectFit: 'cover',
        backgroundColor: 'black',
        ...props.style
      }}
      autoPlay
      playsInline
      muted
    />
  );
});

// Static methods for Camera component
Camera.requestCameraPermission = async () => {
  try {
    await navigator.mediaDevices.getUserMedia({ video: true });
    return 'granted';
  } catch (error) {
    console.warn('Camera permission denied:', error);
    return 'denied';
  }
};

export { Camera };

export const useCameraDevices = () => {
  const [devices, setDevices] = React.useState(null);

  React.useEffect(() => {
    navigator.mediaDevices.enumerateDevices()
      .then(deviceList => {
        const videoDevices = deviceList.filter(device => device.kind === 'videoinput');
        setDevices({
          back: videoDevices.find(device => device.label.toLowerCase().includes('back')) || videoDevices[0],
          front: videoDevices.find(device => device.label.toLowerCase().includes('front')) || videoDevices[1],
        });
      })
      .catch(console.error);
  }, []);

  return devices;
};

export const useFrameProcessor = (processor, deps) => {
  // Return null for web - frame processing not supported
  return null;
};

// Export default for compatibility
export default {
  Camera,
  useCameraDevices,
  useFrameProcessor,
};
