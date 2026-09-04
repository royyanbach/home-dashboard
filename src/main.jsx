import { StrictMode, useEffect, useRef, useState } from 'react';
import { createRoot } from 'react-dom/client';
import { BrowserRouter, Route, Routes, useNavigate, useParams } from 'react-router-dom';
import { Theme } from '@astryxdesign/core';
import { AspectRatio } from '@astryxdesign/core/AspectRatio';
import { Button } from '@astryxdesign/core/Button';
import { Card } from '@astryxdesign/core/Card';
import { Carousel } from '@astryxdesign/core/Carousel';
import { Heading } from '@astryxdesign/core/Heading';
import { IconButton } from '@astryxdesign/core/IconButton';
import { Skeleton } from '@astryxdesign/core/Skeleton';
import { Spinner } from '@astryxdesign/core/Spinner';
import { Stack } from '@astryxdesign/core/Stack';
import { Switch } from '@astryxdesign/core/Switch';
import { Text } from '@astryxdesign/core/Text';
import { TopNav } from '@astryxdesign/core/TopNav';
import { neutralTheme } from '@astryxdesign/theme-neutral/built';
import { ArrowLeft, ArrowRight, Download, Maximize, Settings, Share2, X } from 'lucide-react';
import { registerSW } from 'virtual:pwa-register';
import { config } from './config.js';
import {
  getPushPermission,
  getPushStatusMessage,
  isPushSupported,
  subscribeToPushNotifications,
  syncPushSubscription,
  unsubscribeFromPushNotifications,
} from './push.js';
import './index.css';

const themeColors = {
  light: '#FFFFFF',
  dark: '#1F1F22',
};

function syncThemeColorWithSystemTheme() {
  const colorScheme = window.matchMedia('(prefers-color-scheme: dark)');
  const themeColor = document.getElementById('theme-color');

  const updateThemeColor = () => {
    themeColor?.setAttribute('content', colorScheme.matches ? themeColors.dark : themeColors.light);
  };

  updateThemeColor();
  if (colorScheme.addEventListener) {
    colorScheme.addEventListener('change', updateThemeColor);
  } else {
    colorScheme.addListener(updateThemeColor);
  }
}

registerSW({ immediate: true });
syncThemeColorWithSystemTheme();

const { buildCommitSha, clipsApiUrl, clipsHost, liveHost, liveStreamUrl, liveSnapshotUrl, porchImage } = config;
const cameraIds = ['cam1', 'cam2', 'cam3'];
const cameraTitles = {
  cam1: 'Front Porch',
  cam2: 'Front Yard 1',
  cam3: 'Front Yard 2',
};
const cameraDetailPosterUrl = `${liveHost}/cam2-snapshot`;

function getGroupLabel(capturedAt) {
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  const capturedDay = new Date(capturedAt);
  capturedDay.setHours(0, 0, 0, 0);
  const daysAgo = Math.round((today - capturedDay) / 86400000);

  if (daysAgo === 0) return 'Today';
  if (daysAgo === 1) return 'Yesterday';
  return new Intl.DateTimeFormat('en-US', { weekday: 'long' }).format(capturedAt);
}

function toSnapshot(item) {
  const capturedAt = new Date(item.created_at);
  return {
    id: item.id,
    fileName: item.file_name,
    videoUrl: `${clipsHost}/${item.file_name}`,
    frameUrl: `${clipsHost}/${item.file_name.replace(/\.mp4$/i, '.jpg')}`,
    capturedAt,
    time: new Intl.DateTimeFormat('en-US', {
      hour: '2-digit',
      minute: '2-digit',
      hour12: false,
    }).format(capturedAt),
    date: new Intl.DateTimeFormat('en-US', {
      weekday: 'long',
      month: 'long',
      day: 'numeric',
    }).format(capturedAt),
    group: getGroupLabel(capturedAt),
  };
}

function useClips() {
  const [snapshots, setSnapshots] = useState([]);
  const [pagination, setPagination] = useState(null);
  const [isLoading, setIsLoading] = useState(true);
  const [isLoadingMore, setIsLoadingMore] = useState(false);
  const [error, setError] = useState(null);

  const fetchPage = async (page, append) => {
    setError(null);
    append ? setIsLoadingMore(true) : setIsLoading(true);
    try {
      const response = await fetch(`${clipsApiUrl}/?page=${page}`);
      if (!response.ok) throw new Error(`Unable to load clips (${response.status})`);
      const data = await response.json();
      const receivedSnapshots = data.items.map(toSnapshot);
      setSnapshots((current) => (append ? [...current, ...receivedSnapshots] : receivedSnapshots));
      setPagination(data.pagination);
    } catch (fetchError) {
      setError(fetchError.message);
    } finally {
      append ? setIsLoadingMore(false) : setIsLoading(false);
    }
  };

  useEffect(() => {
    fetchPage(1, false);
  }, []);

  return {
    snapshots,
    pagination,
    isLoading,
    isLoadingMore,
    error,
    retry: () => fetchPage(1, false),
    loadMore: () => pagination?.next_page && fetchPage(pagination.next_page, true),
  };
}

function usePushNotifications() {
  const [notificationsEnabled, setNotificationsEnabled] = useState(false);
  const [isPushLoading, setIsPushLoading] = useState(() => getPushPermission() === 'granted');
  const [pushMessage, setPushMessage] = useState(getPushStatusMessage);

  useEffect(() => {
    if (!isPushSupported()) {
      setPushMessage(getPushStatusMessage());
      return;
    }
    if (Notification.permission !== 'granted') {
      setNotificationsEnabled(false);
      setPushMessage(getPushStatusMessage());
      return;
    }

    setIsPushLoading(true);
    syncPushSubscription()
      .then((subscription) => {
        setNotificationsEnabled(Boolean(subscription));
        setPushMessage(subscription ? null : getPushStatusMessage());
      })
      .catch(() => {
        setNotificationsEnabled(false);
        setPushMessage(getPushStatusMessage());
      })
      .finally(() => setIsPushLoading(false));
  }, []);

  const setNotifications = async (enabled) => {
    if (!isPushSupported()) {
      setPushMessage(getPushStatusMessage());
      return;
    }
    if (enabled && Notification.permission === 'denied') {
      setPushMessage(getPushStatusMessage());
      return;
    }

    setIsPushLoading(true);
    setPushMessage(null);
    try {
      if (enabled) {
        await subscribeToPushNotifications();
        setNotificationsEnabled(true);
      } else {
        await unsubscribeFromPushNotifications();
        setNotificationsEnabled(false);
      }
    } catch (error) {
      setNotificationsEnabled(!enabled);
      setPushMessage(error.message);
    } finally {
      setIsPushLoading(false);
    }
  };

  return { notificationsEnabled, isPushLoading, pushMessage, setNotifications };
}

function SettingsButton({ onClick }) {
  return (
    <IconButton
      icon={<Settings />}
      label="Open settings"
      tooltip="Settings"
      variant="ghost"
      onClick={onClick}
    />
  );
}

function SettingsScreen({ notificationsEnabled, isPushLoading, pushMessage, setNotifications }) {
  const navigate = useNavigate();
  const permission = getPushPermission();
  const isBlocked = permission === 'denied' || permission === 'unsupported';
  const disabledMessage = isBlocked ? getPushStatusMessage() : undefined;

  return (
    <main className="mx-auto h-dvh w-full max-w-md overflow-y-auto bg-surface">
      <TopNav
        className="sticky top-0 z-10 bg-surface px-4"
        label="Settings navigation"
        heading={
          <IconButton
            icon={<ArrowLeft />}
            label="Back"
            tooltip="Back"
            variant="ghost"
            onClick={() => navigate(-1)}
          />
        }
        centerContent={<Heading level={2}>Settings</Heading>}
      />
      <section className="px-6 py-4">
        <Heading level={3}>Notifications</Heading>
        <Card width="100%" className="mt-4">
          <Stack gap={4}>
            <Switch
              label="Push notifications"
              description="Receive alerts from your home automations."
              value={notificationsEnabled}
              labelPosition="start"
              labelSpacing="spread"
              width="100%"
              isLoading={isPushLoading}
              isDisabled={isBlocked}
              disabledMessage={disabledMessage}
              changeAction={setNotifications}
              status={
                pushMessage ? { type: 'error', message: pushMessage } : undefined
              }
            />
          </Stack>
        </Card>
      </section>
      {buildCommitSha && (
        <section className="px-6 py-4">
          <Heading level={3}>Build</Heading>
          <Card width="100%" className="mt-4">
            <Stack gap={2}>
              <Text type="label" display="block">
                Commit hash
              </Text>
              <Text type="code" display="block" wordBreak="break-all">
                {buildCommitSha}
              </Text>
            </Stack>
          </Card>
        </section>
      )}
    </main>
  );
}

function LiveView() {
  const [isPlaying, setIsPlaying] = useState(false);
  const [showControls, setShowControls] = useState(false);
  const videoRef = useRef(null);

  const enterFullscreen = (event) => {
    event.stopPropagation();
    const video = videoRef.current;
    if (!video) return;
    if (typeof video.webkitEnterFullscreen === 'function') {
      video.webkitEnterFullscreen();
      return;
    }
    video.requestFullscreen?.();
  };

  return (
    <AspectRatio
      ratio={16 / 9}
      className="group overflow-hidden rounded-lg bg-muted shadow-sm"
      aria-label="Front Porch live camera"
      onClick={() => setShowControls((visible) => !visible)}
    >
      <section className="relative h-full w-full">
        <img
          src={liveSnapshotUrl}
          alt=""
          aria-hidden="true"
          onError={(event) => {
            event.currentTarget.onerror = null;
            event.currentTarget.src = porchImage;
          }}
          className="absolute inset-0 h-full w-full object-cover"
        />
        <video
          ref={videoRef}
          className={`absolute inset-0 h-full w-full object-cover transition-opacity duration-500 ${isPlaying ? 'opacity-100' : 'opacity-0'}`}
          src={liveStreamUrl}
          autoPlay
          muted
          playsInline
          preload="auto"
          poster={liveSnapshotUrl}
          onPlaying={() => setIsPlaying(true)}
          aria-label="Front Porch live stream"
        />
        <span className="absolute bottom-3 right-3 flex size-2.5 items-center justify-center">
          {!isPlaying ? (
            <Spinner size="sm" shade="onMedia" aria-label="Loading live stream" />
          ) : (
            <span
              className="relative inline-flex size-2.5 items-center justify-center"
              role="status"
              aria-label="Live"
            >
              <span
                className="absolute inset-0 animate-pulse rounded-full border-2 border-error"
                aria-hidden="true"
              />
              <span className="size-1 rounded-full bg-error" aria-hidden="true" />
            </span>
          )}
        </span>
        <span
          className={`absolute inset-0 flex items-center justify-center bg-black/40 transition-opacity duration-200 ${
            showControls
              ? 'opacity-100'
              : 'pointer-events-none opacity-0 group-hover:pointer-events-auto group-hover:opacity-100'
          }`}
        >
          <IconButton
            icon={<Maximize />}
            label="Enter fullscreen"
            tooltip="Fullscreen"
            variant="secondary"
            onClick={enterFullscreen}
          />
        </span>
      </section>
    </AspectRatio>
  );
}

function SnapshotTile({ snapshot, onOpen }) {
  const resolvedImageUrl = snapshot.frameUrl ?? porchImage;

  return (
    <button
      type="button"
      onClick={() => onOpen(snapshot)}
      className="group relative aspect-square w-full overflow-hidden rounded-lg bg-muted text-left shadow-sm transition focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-accent"
      aria-label={`Open snapshot captured at ${snapshot.time}`}
    >
      <img
        src={resolvedImageUrl}
        alt="Front porch camera snapshot"
        onError={(event) => {
          event.currentTarget.onerror = null;
          event.currentTarget.src = porchImage;
        }}
        className={`h-full w-full object-cover transition duration-300 group-hover:scale-105 ${snapshot.group === 'Yesterday' ? 'brightness-75 saturate-75' : ''} ${snapshot.group === 'Monday' ? 'brightness-90 grayscale' : ''}`}
      />
      <span className="absolute inset-x-0 bottom-0 bg-gradient-to-t from-black/65 to-transparent px-4 pb-3 pt-10 text-sm font-medium text-white">
        {snapshot.time}
      </span>
    </button>
  );
}

function SnapshotGridSkeleton({ count = 2 }) {
  return (
    <section
      className="mt-5 grid grid-cols-2 gap-5"
      aria-label="Loading snapshots"
      aria-busy="true"
    >
      {Array.from({ length: count }, (_, index) => (
        <section key={index} className="aspect-square">
          <Skeleton width="100%" height="100%" radius={4} index={index} />
        </section>
      ))}
    </section>
  );
}

function HomeScreen({ snapshots, isLoading, error, retry, openSettings }) {
  const navigate = useNavigate();
  const earlierSnapshots = snapshots.slice(0, 2);

  return (
    <main className="mx-auto h-dvh w-full max-w-md overflow-y-auto bg-surface">
      <TopNav
        className="sticky top-0 z-10 bg-surface px-6"
        label="Home navigation"
        heading={<Heading level={2}>Home</Heading>}
        endContent={<SettingsButton onClick={openSettings} />}
      />
      <section className="px-6 pb-10">
        <section className="mt-3">
          <Heading level={2}>Front Porch</Heading>
          <section className="mt-6">
            <LiveView />
          </section>
        </section>
        <section className="mt-10">
          <Stack direction="horizontal" hAlign="between" vAlign="center" width="100%">
            <Heading level={3}>Detected motions</Heading>
            <IconButton
              icon={<ArrowRight />}
              label="All snapshots"
              tooltip="All snapshots"
              variant="ghost"
              onClick={() => navigate('/snapshots')}
            />
          </Stack>
          {isLoading && <SnapshotGridSkeleton />}
          {error && (
            <section className="mt-5">
              <Text as="p" className="text-secondary">
                {error}
              </Text>
              <Button label="Try again" variant="secondary" onClick={retry} className="mt-4" />
            </section>
          )}
          {!isLoading && !error && earlierSnapshots.length === 0 && (
            <Text as="p" className="mt-5 text-secondary">
              No snapshots yet.
            </Text>
          )}
          {earlierSnapshots.length > 0 && (
            <section className="mt-5 grid grid-cols-2 gap-5">
              {earlierSnapshots.map((snapshot) => (
                <SnapshotTile
                  key={snapshot.id}
                  snapshot={snapshot}
                  onOpen={(item) => navigate(`/snapshots/${item.id}`)}
                />
              ))}
            </section>
          )}
        </section>
        <section className="mt-10">
          <Heading level={3}>Other cameras</Heading>
          <section className="mt-5 -mx-6">
            <Carousel
              gap={0}
              padding={6}
              hasButtons={false}
              hasEdgeFade={false}
              aria-label="Other cameras"
            >
              {cameraIds.filter((cameraId) => cameraId !== 'cam1').map((cameraId, index) => (
                <button
                  key={cameraId}
                  type="button"
                  className={`relative aspect-video w-72 shrink-0 overflow-hidden rounded-lg bg-muted text-left shadow-sm transition focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-accent ${index > 0 ? 'ml-5' : ''}`}
                  onClick={() => navigate(`/cameras/${cameraId}`)}
                  aria-label={`Open ${cameraTitles[cameraId]}`}
                >
                  <img
                    src={`${liveHost}/${cameraId}-snapshot`}
                    alt=""
                    className="h-full w-full object-cover"
                  />
                  <span className="absolute inset-x-0 bottom-0 bg-gradient-to-t from-black/65 to-transparent px-4 pb-3 pt-10 text-sm font-medium text-white">
                    {cameraTitles[cameraId]}
                  </span>
                </button>
              ))}
            </Carousel>
          </section>
        </section>
      </section>
    </main>
  );
}

function HistoryScreen({
  snapshots,
  pagination,
  isLoading,
  isLoadingMore,
  error,
  retry,
  loadMore,
  openSettings,
}) {
  const navigate = useNavigate();
  const groupedSnapshots = snapshots.reduce((groups, snapshot) => {
    const existingGroup = groups.find((group) => group.label === snapshot.group);
    if (existingGroup) existingGroup.items.push(snapshot);
    else groups.push({ label: snapshot.group, items: [snapshot] });
    return groups;
  }, []);
  return (
    <main className="mx-auto h-dvh w-full max-w-md overflow-y-auto bg-surface">
      <TopNav
        className="sticky top-0 z-10 bg-surface px-4"
        label="Front Porch navigation"
        heading={<IconButton icon={<ArrowLeft />} label="Back to home" tooltip="Back" variant="ghost" onClick={() => navigate('/')} />}
        centerContent={<Heading level={2}>Front Porch</Heading>}
        endContent={<SettingsButton onClick={openSettings} />}
      />
      <section className="space-y-8 px-6 py-2">
        {isLoading && (
          <section aria-label="Loading clip history" aria-busy="true">
            <section className="h-4 w-1/3">
              <Skeleton width="100%" height="100%" radius={2} index={0} />
            </section>
            <SnapshotGridSkeleton count={6} />
          </section>
        )}
        {error && (
          <section>
            <Text as="p" className="text-secondary">
              {error}
            </Text>
            <Button label="Try again" variant="secondary" onClick={retry} className="mt-4" />
          </section>
        )}
        {groupedSnapshots.map((group) => (
          <section key={group.label}>
            <header className="flex items-center justify-between">
              <Text
                as="h2"
                className="text-sm font-semibold uppercase tracking-wider text-secondary"
              >
                {group.label}
              </Text>
              <Text as="p" className="text-secondary">
                {group.items.length}
              </Text>
            </header>
            <section className="mt-5 grid grid-cols-2 gap-4">
              {group.items.map((snapshot) => (
                <SnapshotTile
                  key={snapshot.id}
                  snapshot={snapshot}
                  onOpen={(item) => navigate(`/snapshots/${item.id}`)}
                />
              ))}
            </section>
          </section>
        ))}
        {pagination?.next_page && (
          <Button
            label={isLoadingMore ? 'Loading clips…' : 'Load more'}
            variant="secondary"
            isDisabled={isLoadingMore}
            isLoading={isLoadingMore}
            onClick={loadMore}
            width="100%"
          />
        )}
      </section>
    </main>
  );
}

function DetailScreen({
  isLoading = false,
  videoUrl,
  posterUrl,
  videoLabel,
  closePath,
  closeLabel,
  unavailableTitle,
  unavailableMessage,
  footerContent,
  autoPlay = false,
  muted = false,
  preload = 'metadata',
}) {
  const navigate = useNavigate();
  const videoRef = useRef(null);

  useEffect(() => {
    if (!autoPlay || !videoUrl) return;
    const video = videoRef.current;
    if (!video) return;

    video.muted = muted;
    video.load();
    video.play().catch(() => {});
  }, [autoPlay, muted, videoUrl]);

  if (isLoading)
    return (
      <main className="mx-auto flex min-h-dvh w-full max-w-md flex-col overflow-hidden bg-black text-white">
        <header className="flex items-center justify-end p-5">
          <IconButton
            icon={<X />}
            label={closeLabel}
            tooltip="Close"
            variant="ghost"
            onClick={() => navigate(closePath)}
          />
        </header>
        <section className="flex flex-1 items-center" aria-label="Loading clip" aria-busy="true">
          <section className="aspect-video w-full">
            <Skeleton width="100%" height="100%" radius="none" />
          </section>
        </section>
        <footer className="bg-gradient-to-b from-neutral-900 to-black px-7 pb-8 pt-7">
          <section className="h-4 w-1/4">
            <Skeleton width="100%" height="100%" radius={2} index={1} />
          </section>
          <section className="mt-4 h-8 w-2/3">
            <Skeleton width="100%" height="100%" radius={2} index={2} />
          </section>
        </footer>
      </main>
    );
  if (!videoUrl)
    return (
      <main className="mx-auto flex min-h-dvh w-full max-w-md flex-col bg-surface px-6 py-7">
        <IconButton
          icon={<ArrowLeft />}
          label={closeLabel}
          tooltip="Back"
          variant="ghost"
          onClick={() => navigate(closePath)}
        />
        <Heading level={2} className="mt-10">
          {unavailableTitle}
        </Heading>
        <Text as="p" className="mt-3 text-secondary">
          {unavailableMessage}
        </Text>
      </main>
    );
  return (
    <main className="mx-auto flex min-h-dvh w-full max-w-md flex-col overflow-hidden bg-black text-white">
      <header className="flex items-center justify-end p-5">
        <IconButton
          icon={<X />}
          label={closeLabel}
          tooltip="Close"
          variant="ghost"
          onClick={() => navigate(closePath)}
        />
      </header>
      <section className="flex flex-1 items-center">
        <video
          ref={videoRef}
          className="w-full object-cover"
          controls
          autoPlay={autoPlay}
          muted={muted}
          playsInline
          preload={preload}
          poster={posterUrl}
          src={videoUrl}
          aria-label={videoLabel}
        >
          Your browser does not support embedded video.
        </video>
      </section>
      {footerContent && (
        <footer className="flex items-end justify-between bg-gradient-to-b from-neutral-900 to-black px-7 pb-8 pt-7">
          {footerContent}
        </footer>
      )}
    </main>
  );
}

function SnapshotDetailRoute({ snapshots, isLoading }) {
  const { snapshotId } = useParams();
  const snapshot = snapshots.find((item) => String(item.id) === snapshotId);

  return (
    <DetailScreen
      isLoading={isLoading}
      videoUrl={snapshot?.videoUrl}
      posterUrl={snapshot?.videoUrl.replace(/\.mp4$/i, '-alert.jpg')}
      videoLabel="Front porch camera recording"
      closePath="/snapshots"
      closeLabel="Close snapshot"
      unavailableTitle="Clip unavailable"
      unavailableMessage="Return to the history and choose a loaded clip."
      footerContent={
        snapshot && (
          <>
            <section>
              <Text as="p" className="text-sm font-semibold text-secondary">
                Captured
              </Text>
              <Heading level={2} className="mt-2 text-white">
                {snapshot.date}
              </Heading>
              <Text as="p" className="mt-1 text-xl text-white">
                {snapshot.time}
              </Text>
            </section>
            <section className="flex gap-3">
              <IconButton
                icon={<Download />}
                label="Download snapshot"
                tooltip="Download"
                variant="secondary"
              />
              <IconButton
                icon={<Share2 />}
                label="Share snapshot"
                tooltip="Share"
                variant="secondary"
              />
            </section>
          </>
        )
      }
    />
  );
}

function CameraDetailRoute() {
  const { cameraId } = useParams();
  const isAvailableCamera = cameraIds.includes(cameraId);
  const cameraTitle = cameraTitles[cameraId] ?? cameraId;

  return (
    <DetailScreen
      videoUrl={isAvailableCamera ? `${liveHost}/${cameraId}-live` : null}
      posterUrl={cameraDetailPosterUrl}
      videoLabel={`${cameraTitle} live stream`}
      closePath="/"
      closeLabel="Close camera"
      unavailableTitle="Camera unavailable"
      unavailableMessage="Return home and choose an available camera."
      autoPlay
      muted
      preload="auto"
      footerContent={
        isAvailableCamera && (
          <section>
            <Text as="p" className="text-sm font-semibold text-secondary">
              Live Camera
            </Text>
            <Heading level={2} className="mt-2 text-white">
              {cameraTitle}
            </Heading>
          </section>
        )
      }
    />
  );
}

function App() {
  const clips = useClips();
  const push = usePushNotifications();
  const navigate = useNavigate();
  const openSettings = () => navigate('/settings');
  const screenProps = { ...clips, openSettings };
  return (
    <Theme theme={neutralTheme}>
      <Routes>
        <Route path="/" element={<HomeScreen {...screenProps} />} />
        <Route path="/snapshots" element={<HistoryScreen {...screenProps} />} />
        <Route path="/settings" element={<SettingsScreen {...push} />} />
        <Route path="/cameras/:cameraId" element={<CameraDetailRoute />} />
        <Route
          path="/snapshots/:snapshotId"
          element={<SnapshotDetailRoute snapshots={clips.snapshots} isLoading={clips.isLoading} />}
        />
        <Route path="*" element={<HomeScreen {...screenProps} />} />
      </Routes>
    </Theme>
  );
}

createRoot(document.getElementById('root')).render(
  <StrictMode>
    <BrowserRouter>
      <App />
    </BrowserRouter>
  </StrictMode>,
);
