"use client";

import { markLessonComplete, updateLessonProgress } from "@/actions/student/progress";
import Hls from "hls.js";
import {
  Loader2,
  Play,
  Pause,
  Volume2,
  Volume1,
  VolumeX,
  Maximize,
  Minimize,
  RotateCw,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { useEffect, useRef, useState, useCallback } from "react";

interface VideoPlayerProps {
  src: string;
  title?: string;
  lessonId?: string;
  initialPosition?: number;
  initialPercentage?: number;
}

/** Throttle interval for progress updates (15 seconds). */
const PROGRESS_UPDATE_INTERVAL = 15_000;

function formatTime(seconds: number): string {
  if (!isFinite(seconds) || seconds < 0) return "0:00";
  const h = Math.floor(seconds / 3600);
  const m = Math.floor((seconds % 3600) / 60);
  const s = Math.floor(seconds % 60);
  if (h > 0) return `${h}:${String(m).padStart(2, "0")}:${String(s).padStart(2, "0")}`;
  return `${m}:${String(s).padStart(2, "0")}`;
}

/**
 * Video player built on native <video> + hls.js.
 * Handles HLS/m3u8 via hls.js and falls back to native playback for
 * direct sources (MP4, WebM, or HLS on Safari).
 *
 * Custom controls: play/pause, seek, volume, fullscreen, time/progress.
 * Tracks playback position via throttled updateLessonProgress calls and
 * resumes from the stored last_position when a lessonId is provided.
 */
export default function VideoPlayer({
  src,
  title,
  lessonId,
  initialPosition = 0,
}: VideoPlayerProps) {
  const videoRef = useRef<HTMLVideoElement>(null);
  const containerRef = useRef<HTMLDivElement>(null);
  const hlsRef = useRef<Hls | null>(null);
  const [status, setStatus] = useState<"loading" | "ready" | "error">("loading");
  const [error, setError] = useState<string | null>(null);
  const [playing, setPlaying] = useState(false);
  const [currentTime, setCurrentTime] = useState(0);
  const [duration, setDuration] = useState(0);
  const [volume, setVolume] = useState(1);
  const [muted, setMuted] = useState(false);
  const [fullscreen, setFullscreen] = useState(false);
  const [buffered, setBuffered] = useState(0);
  const [showControls, setShowControls] = useState(true);

  const errorRef = useRef(false);
  const lastUpdateRef = useRef(0);
  const seekedRef = useRef(false);
  const completedRef = useRef(false);
  const controlsTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const mouseOverRef = useRef(false);
  const [retryKey, setRetryKey] = useState(0);

  const isHls = src.toLowerCase().includes(".m3u8");

  const handleRetry = useCallback(() => {
    errorRef.current = false;
    seekedRef.current = false;
    setStatus("loading");
    setError(null);
    setRetryKey((k) => k + 1);
  }, []);

  // Initialize HLS or native playback
  useEffect(() => {
    const video = videoRef.current;
    if (!video || !src) return;

    errorRef.current = false;
    seekedRef.current = false;
    let cancelled = false;

    // Clean up previous HLS instance
    if (hlsRef.current) {
      hlsRef.current.destroy();
      hlsRef.current = null;
    }

    // Reset state
    setPlaying(false);
    setCurrentTime(0);
    setDuration(0);
    setStatus("loading");
    completedRef.current = false;

    function seekToResume(videoEl: HTMLVideoElement) {
      if (seekedRef.current || !initialPosition || initialPosition <= 0) return;
      seekedRef.current = true;
      const trySeek = () => {
        if (cancelled) return;
        if (videoEl.readyState >= 1) {
          videoEl.currentTime = initialPosition;
        } else {
          setTimeout(trySeek, 200);
        }
      };
      trySeek();
    }

    if (isHls && Hls.isSupported()) {
      const hls = new Hls();
      hlsRef.current = hls;
      hls.loadSource(src);
      hls.attachMedia(video);
      hls.on(Hls.Events.MANIFEST_PARSED, () => {
        if (cancelled) return;
        setStatus("ready");
        setDuration(video.duration || 0);
        seekToResume(video);
      });
      hls.on(Hls.Events.ERROR, (_event, data) => {
        if (cancelled || errorRef.current) return;
        if (data.fatal) {
          errorRef.current = true;
          setStatus("error");
          setError("This video could not be played. It may be unavailable or expired.");
        }
      });
    } else {
      // Native playback (MP4, WebM, or HLS on Safari)
      video.src = src;
      video.addEventListener("loadedmetadata", function onMeta() {
        if (cancelled) return;
        setStatus("ready");
        setDuration(video.duration || 0);
        seekToResume(video);
        video.removeEventListener("loadedmetadata", onMeta);
      });
      video.addEventListener("error", function onError() {
        if (cancelled || errorRef.current) return;
        errorRef.current = true;
        setStatus("error");
        setError("This video could not be played. It may be unavailable or expired.");
        video.removeEventListener("error", onError);
      });
    }

    return () => {
      cancelled = true;
      lastUpdateRef.current = 0;
      if (hlsRef.current) {
        hlsRef.current.destroy();
        hlsRef.current = null;
      }
      if (video) {
        video.removeAttribute("src");
        video.load();
      }
    };
  }, [src, initialPosition, retryKey]);

  // Media event listeners
  useEffect(() => {
    const video = videoRef.current;
    if (!video) return;

    const v = video;

    function onPlay() {
      setPlaying(true);
    }

    function onPause() {
      setPlaying(false);
    }

    function onTimeUpdate() {
      setCurrentTime(v.currentTime);
      if (!lessonId) return;
      const dur = v.duration;
      const pos = v.currentTime ?? 0;

      // Auto-complete when playback reaches the end (within last 3s or 95%)
      if (!completedRef.current && dur && isFinite(dur) && dur > 0) {
        if (pos >= dur - 3 || pos / dur >= 0.95) {
          completedRef.current = true;
          markLessonComplete(lessonId).catch(() => {});
        }
      }

      const now = Date.now();
      if (now - lastUpdateRef.current < PROGRESS_UPDATE_INTERVAL) return;
      lastUpdateRef.current = now;
      if (!dur || !isFinite(dur) || dur <= 0) return;
      const position = Math.floor(pos);
      const percentage = Math.min(Math.round((position / dur) * 100), 99);
      updateLessonProgress(lessonId, {
        last_position: position,
        progress_percentage: percentage,
      }).catch(() => {});
    }

    function onDurationChange() {
      setDuration(v.duration || 0);
    }

    function onProgress() {
      if (v.buffered.length > 0) {
        setBuffered(v.buffered.end(v.buffered.length - 1));
      }
    }

    function onVolumeChange() {
      setVolume(v.volume);
      setMuted(v.muted);
    }

    function onVideoError() {
      if (errorRef.current) return;
      errorRef.current = true;
      setStatus("error");
      setError("This video could not be played. It may be unavailable or expired.");
    }

    video.addEventListener("play", onPlay);
    video.addEventListener("pause", onPause);
    video.addEventListener("timeupdate", onTimeUpdate);
    video.addEventListener("durationchange", onDurationChange);
    video.addEventListener("progress", onProgress);
    video.addEventListener("volumechange", onVolumeChange);
    video.addEventListener("error", onVideoError);

    return () => {
      video.removeEventListener("play", onPlay);
      video.removeEventListener("pause", onPause);
      video.removeEventListener("timeupdate", onTimeUpdate);
      video.removeEventListener("durationchange", onDurationChange);
      video.removeEventListener("progress", onProgress);
      video.removeEventListener("volumechange", onVolumeChange);
      video.removeEventListener("error", onVideoError);
    };
  }, [lessonId, retryKey]);

  // Fullscreen change listener
  useEffect(() => {
    function onFsChange() {
      setFullscreen(!!document.fullscreenElement);
    }
    document.addEventListener("fullscreenchange", onFsChange);
    return () => document.removeEventListener("fullscreenchange", onFsChange);
  }, []);

  // Auto-hide controls when playing
  useEffect(() => {
    if (!playing) {
      setShowControls(true);
      return;
    }
    const timeout = setTimeout(() => {
      if (!mouseOverRef.current) {
        setShowControls(false);
      }
    }, 3000);
    controlsTimeoutRef.current = timeout;
    return () => clearTimeout(timeout);
  }, [playing]);

  function togglePlay() {
    const video = videoRef.current;
    if (!video) return;
    if (video.paused) {
      video.play().catch(() => {});
    } else {
      video.pause();
    }
  }

  function handleSeek(e: React.MouseEvent<HTMLDivElement>) {
    const video = videoRef.current;
    if (!video || !duration) return;
    const rect = e.currentTarget.getBoundingClientRect();
    const pos = Math.max(0, Math.min(1, (e.clientX - rect.left) / rect.width));
    video.currentTime = pos * duration;
    setCurrentTime(video.currentTime);
  }

  function handleVolumeChange(e: React.ChangeEvent<HTMLInputElement>) {
    const video = videoRef.current;
    if (!video) return;
    const val = parseFloat(e.target.value);
    video.volume = val;
    video.muted = val === 0;
  }

  function toggleMute() {
    const video = videoRef.current;
    if (!video) return;
    video.muted = !video.muted;
  }

  async function toggleFullscreen() {
    const container = containerRef.current;
    if (!container) return;
    if (document.fullscreenElement) {
      await document.exitFullscreen();
    } else {
      await container.requestFullscreen();
    }
  }

  function showControlsTemporarily() {
    setShowControls(true);
    if (controlsTimeoutRef.current) clearTimeout(controlsTimeoutRef.current);
    if (playing) {
      controlsTimeoutRef.current = setTimeout(() => {
        if (!mouseOverRef.current) setShowControls(false);
      }, 3000);
    }
  }

  if (status === "error") {
    return (
      <div
        role="alert"
        className="aspect-video w-full rounded-xl overflow-hidden bg-card border border-border flex flex-col items-center justify-center gap-3 text-center p-6"
      >
        <div className="w-12 h-12 rounded-full bg-destructive/10 flex items-center justify-center">
          <Play className="w-6 h-6 text-destructive/70" />
        </div>
        <div className="space-y-1">
          <p className="text-sm font-medium text-foreground">Video unavailable</p>
          <p className="text-xs text-muted-foreground max-w-xs">{error}</p>
        </div>
        {title ? (
          <p className="text-xs text-muted-foreground/60">{title}</p>
        ) : null}
        <Button
          variant="outline"
          size="sm"
          onClick={handleRetry}
          className="flex items-center gap-1.5"
        >
          <RotateCw className="w-3.5 h-3.5" />
          Retry
        </Button>
      </div>
    );
  }

  const showLoading = status === "loading";

  return (
    <div
      ref={containerRef}
      className="relative w-full rounded-xl overflow-hidden bg-black aspect-video group"
      onMouseEnter={() => {
        mouseOverRef.current = true;
        setShowControls(true);
        if (controlsTimeoutRef.current) clearTimeout(controlsTimeoutRef.current);
      }}
      onMouseLeave={() => {
        mouseOverRef.current = false;
        if (playing) setShowControls(false);
      }}
      onMouseMove={showControlsTemporarily}
    >
      {/* Loading spinner overlay */}
      {showLoading && (
        <div className="absolute inset-0 z-10 flex items-center justify-center bg-black/60">
          <Loader2 className="w-8 h-8 text-white/70 animate-spin" />
        </div>
      )}

      <video
        ref={videoRef}
        className={`w-full h-full object-contain ${showLoading ? "opacity-0" : "opacity-100"} transition-opacity duration-300`}
        playsInline
        preload="metadata"
        aria-label={title ? `Video: ${title}` : "Video player"}
      />

      {/* Big play button (centered overlay when paused, ready) */}
      {!playing && status === "ready" && (
        <div
          className="absolute inset-0 flex items-center justify-center z-20"
          onClick={togglePlay}
        >
          <div className="w-16 h-16 rounded-full bg-primary/85 border-2 border-primary flex items-center justify-center transition-transform hover:scale-110 cursor-pointer">
            <Play className="w-7 h-7 text-white ml-0.5" fill="white" />
          </div>
        </div>
      )}

      {/* Controls bar */}
      <div
        className={`absolute bottom-0 left-0 right-0 z-30 transition-opacity duration-300 ${
          (showControls || !playing) ? "opacity-100" : "opacity-0 pointer-events-none"
        }`}
      >
        {/* Seek bar */}
        <div className="mx-3 mb-1">
          <div
            className="relative h-1 bg-white/20 rounded-full cursor-pointer group/progress"
            onClick={handleSeek}
          >
            {/* Buffered */}
            <div
              className="absolute top-0 left-0 h-full bg-white/30 rounded-full"
              style={{ width: `${duration > 0 ? (buffered / duration) * 100 : 0}%` }}
            />
            {/* Played */}
            <div
              className="absolute top-0 left-0 h-full bg-primary rounded-full"
              style={{ width: `${duration > 0 ? (currentTime / duration) * 100 : 0}%` }}
            />
            {/* Thumb */}
            <div
              className="absolute top-1/2 -translate-y-1/2 w-3 h-3 bg-primary rounded-full opacity-0 group-hover/progress:opacity-100 transition-opacity"
              style={{
                left: `${duration > 0 ? (currentTime / duration) * 100 : 0}%`,
                marginLeft: "-6px",
              }}
            />
          </div>
        </div>

        {/* Controls row */}
        <div className="flex items-center gap-2 px-3 pb-2 pt-1 bg-gradient-to-t from-black/80 to-transparent">
          {/* Play / Pause */}
          <button
            type="button"
            className="text-white hover:text-primary transition-colors p-1 shrink-0"
            onClick={togglePlay}
            aria-label={playing ? "Pause" : "Play"}
          >
            {playing ? <Pause className="w-5 h-5" /> : <Play className="w-5 h-5" />}
          </button>

          {/* Time display */}
          <span className="text-xs text-white/80 font-mono whitespace-nowrap tabular-nums shrink-0">
            {formatTime(currentTime)} / {formatTime(duration)}
          </span>

          <div className="flex-1 min-w-0" />

          {/* Volume — always visible, slider always shown */}
          <div className="flex items-center gap-1.5 shrink-0 min-w-0">
            <button
              type="button"
              className="text-white hover:text-primary transition-colors p-1 shrink-0"
              onClick={toggleMute}
              aria-label={muted ? "Unmute" : "Mute"}
            >
              {muted || volume === 0 ? (
                <VolumeX className="w-4 h-4" />
              ) : volume < 0.33 ? (
                <Volume1 className="w-4 h-4" />
              ) : (
                <Volume2 className="w-4 h-4" />
              )}
            </button>
            <div className="hidden sm:flex items-center gap-1.5">
              <input
                type="range"
                min="0"
                max="1"
                step="0.05"
                value={muted ? 0 : volume}
                onChange={handleVolumeChange}
                className="w-16 lg:w-20 h-1 accent-primary cursor-pointer shrink-0"
                aria-label="Volume"
              />
              <span className="text-[10px] text-white/50 font-mono tabular-nums w-6 text-right shrink-0">
                {Math.round((muted ? 0 : volume) * 100)}
              </span>
            </div>
          </div>

          {/* Fullscreen */}
          <button
            type="button"
            className="text-white hover:text-primary transition-colors p-1 shrink-0"
            onClick={toggleFullscreen}
            aria-label={fullscreen ? "Exit fullscreen" : "Fullscreen"}
          >
            {fullscreen ? <Minimize className="w-4 h-4" /> : <Maximize className="w-4 h-4" />}
          </button>
        </div>
      </div>
    </div>
  );
}