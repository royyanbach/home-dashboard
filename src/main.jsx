import { StrictMode, useEffect, useState } from 'react';
import { createRoot } from 'react-dom/client';
import { BrowserRouter, Route, Routes, useNavigate, useParams } from 'react-router-dom';
import { Theme } from '@astryxdesign/core';
import { Button } from '@astryxdesign/core/Button';
import { Heading } from '@astryxdesign/core/Heading';
import { IconButton } from '@astryxdesign/core/IconButton';
import { Skeleton } from '@astryxdesign/core/Skeleton';
import { Text } from '@astryxdesign/core/Text';
import { TopNav } from '@astryxdesign/core/TopNav';
import { neutralTheme } from '@astryxdesign/theme-neutral/built';
import { ArrowLeft, ArrowRight, Download, Settings, Share2, X } from 'lucide-react';
import './index.css';

const porchImage = '/images/front-porch.png';
const clipsApiUrl = 'https://home-automation-clips-api.royyanbach.workers.dev';
const clipsHost = 'https://ha-s3.royyanba.ch';
const latestFrameUrl = 'https://ha-s3.royyanba.ch/clips/cam1/latest-frame.jpg';
const latestFrame = { id: 'latest-frame', time: 'Live view', group: 'Today', featured: true };

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

function SnapshotTile({
  snapshot,
  onOpen,
  large = false,
  imageUrl,
  imageAlt = 'Front porch camera snapshot',
}) {
  const resolvedImageUrl = imageUrl ?? snapshot.frameUrl ?? porchImage;

  return (
    <button
      type="button"
      onClick={() => onOpen(snapshot)}
      className={`group relative overflow-hidden rounded-lg bg-muted text-left shadow-sm transition focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-accent ${large ? 'aspect-video w-full' : 'aspect-square w-full'}`}
      aria-label={`Open snapshot captured at ${snapshot.time}`}
    >
      <img
        src={resolvedImageUrl}
        alt={imageAlt}
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

function HomeScreen({ snapshots, isLoading, error, retry }) {
  const navigate = useNavigate();
  const [latestFrameUrlWithCacheBust] = useState(
    () => `${latestFrameUrl}?cacheBust=${Math.random().toString(36).slice(2)}`,
  );
  const [isLatestFrameReady, setIsLatestFrameReady] = useState(false);
  const earlierSnapshots = snapshots.slice(0, 2);
  const openLatestFrame = () =>
    window.open(latestFrameUrlWithCacheBust, '_blank', 'noopener,noreferrer');

  useEffect(() => {
    const timer = window.setTimeout(() => setIsLatestFrameReady(true), 15000);
    return () => window.clearTimeout(timer);
  }, []);
  return (
    <main className="mx-auto h-dvh w-full max-w-md overflow-y-auto bg-surface">
      <TopNav
        className="sticky top-0 z-10 bg-surface px-6"
        label="Home navigation"
        heading={<Heading level={2}>Home</Heading>}
        endContent={<IconButton icon={<Settings />} label="Open settings" tooltip="Settings" variant="ghost" />}
      />
      <section className="px-6 pb-10">
        <section className="mt-3">
          <Heading level={2}>Front Porch</Heading>
          <section className="mt-6">
            {isLatestFrameReady ? (
              <SnapshotTile
                snapshot={latestFrame}
                onOpen={openLatestFrame}
                imageUrl={latestFrameUrlWithCacheBust}
                imageAlt="Latest Front Porch camera frame"
                large
              />
            ) : (
              <section
                className="aspect-video w-full"
                aria-label="Loading latest Front Porch frame"
                aria-busy="true"
              >
                <Skeleton width="100%" height="100%" radius={4} />
              </section>
            )}
          </section>
        </section>
        <section className="mt-10">
          <Text as="p" className="text-secondary">
            Earlier today
          </Text>
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
          <footer className="pt-8">
            <Button
              label="All snapshots"
              endContent={<ArrowRight />}
              variant="ghost"
              onClick={() => navigate('/snapshots')}
            />
          </footer>
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
        endContent={<IconButton icon={<Settings />} label="Open settings" tooltip="Settings" variant="ghost" />}
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

function DetailScreen({ snapshots, isLoading }) {
  const navigate = useNavigate();
  const { snapshotId } = useParams();
  const snapshot = snapshots.find((item) => String(item.id) === snapshotId);
  if (isLoading)
    return (
      <main className="mx-auto flex min-h-dvh w-full max-w-md flex-col overflow-hidden bg-black text-white">
        <header className="flex items-center justify-end p-5">
          <IconButton
            icon={<X />}
            label="Close snapshot"
            tooltip="Close"
            variant="ghost"
            onClick={() => navigate('/snapshots')}
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
  if (!snapshot)
    return (
      <main className="mx-auto flex min-h-dvh w-full max-w-md flex-col bg-surface px-6 py-7">
        <IconButton
          icon={<ArrowLeft />}
          label="Back to snapshots"
          tooltip="Back"
          variant="ghost"
          onClick={() => navigate('/snapshots')}
        />
        <Heading level={2} className="mt-10">
          Clip unavailable
        </Heading>
        <Text as="p" className="mt-3 text-secondary">
          Return to the history and choose a loaded clip.
        </Text>
      </main>
    );
  return (
    <main className="mx-auto flex min-h-dvh w-full max-w-md flex-col overflow-hidden bg-black text-white">
      <header className="flex items-center justify-end p-5">
        <IconButton
          icon={<X />}
          label="Close snapshot"
          tooltip="Close"
          variant="ghost"
          onClick={() => navigate('/snapshots')}
        />
      </header>
      <section className="flex flex-1 items-center">
        <video
          className="w-full object-cover"
          controls
          playsInline
          preload="metadata"
          poster={porchImage}
          aria-label="Front porch camera recording"
        >
          <source src={snapshot.videoUrl} type="video/mp4" />
          Your browser does not support embedded video.
        </video>
      </section>
      <footer className="flex items-end justify-between bg-gradient-to-b from-neutral-900 to-black px-7 pb-8 pt-7">
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
      </footer>
    </main>
  );
}

function App() {
  const clips = useClips();
  return (
    <Theme theme={neutralTheme}>
      <Routes>
        <Route path="/" element={<HomeScreen {...clips} />} />
        <Route path="/snapshots" element={<HistoryScreen {...clips} />} />
        <Route
          path="/snapshots/:snapshotId"
          element={<DetailScreen snapshots={clips.snapshots} isLoading={clips.isLoading} />}
        />
        <Route path="*" element={<HomeScreen {...clips} />} />
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
