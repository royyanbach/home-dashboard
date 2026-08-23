function requireEnv(name) {
  const value = import.meta.env[name];
  if (!value) throw new Error(`Missing ${name}. Copy .env.example to .env and set the value.`);
  return value;
}

const clipsHost = requireEnv('VITE_CLIPS_HOST');
const cameraId = import.meta.env.VITE_CAMERA_ID ?? 'cam1';

export const config = {
  clipsApiUrl: requireEnv('VITE_CLIPS_API_URL'),
  clipsHost,
  latestFrameUrl: `${clipsHost}/clips/${cameraId}/latest-frame.jpg`,
  porchImage: '/images/front-porch.png',
};
