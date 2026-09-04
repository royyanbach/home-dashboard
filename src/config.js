function requireEnv(name) {
  const value = import.meta.env[name];
  if (!value) throw new Error(`Missing ${name}. Copy .env.example to .env and set the value.`);
  return value;
}

const clipsHost = requireEnv('VITE_CLIPS_HOST');
const liveHost = requireEnv('VITE_LIVE_HOST');
const cameraId = import.meta.env.VITE_CAMERA_ID ?? 'cam1';
const buildCommitSha = import.meta.env.VITE_BUILD_COMMIT_SHA;

export const config = {
  clipsApiUrl: requireEnv('VITE_CLIPS_API_URL'),
  clipsHost,
  liveHost,
  liveStreamUrl: `${liveHost}/${cameraId}-live`,
  liveSnapshotUrl: `${liveHost}/${cameraId}-snapshot`,
  porchImage: '/images/front-porch.png',
  buildCommitSha,
};
