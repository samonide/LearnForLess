"use client";

import { updateLessonProgress } from "@/actions/student/progress";
import Hls from "hls.js";
import { Loader2, PlayCircle } from "lucide-react";
import { useEffect, useRef, useState } from "react";

interface VideoPlayerProps {
  src: string;
  title?: string;
  lessonId?: string;
  initialPosition?: number;
  initialPercentage?: number;
}

/** Throttle interval for progress updates (15 seconds). */
const PROGRESS_UPDATE_INTERVAL = 15_000;

/**
 * Video player that handles both directly-playable sources (MP4, WebM, etc.,
 * played natively by the browser) and external M3U8/HLS streams (played via
 * hls.js, falling back to native HLS support where the browser has it, e.g.
 * Safari).
 *
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
  const [status, setStatus] = useState<"loading" | "ready" | "error">("loading");
  const [error, setError] = useState<string | null>(null);
  const errorRef = useRef(false);
  const lastUpdateRef = useRef(0);
  const seekedRef = useRef(false);

  useEffect(() => {
    const videoEl = videoRef.current;
    if (!videoEl) return;
    const video: HTMLVideoElement = videoEl;

    const lower = src.toLowerCase();
    const isHls = lower.includes(".m3u8");

    let hls: Hls | null = null;
    let cancelled = false;
    seekedRef.current = false;

    /** Seek to the stored resume position (once per source load). */
    function seekToResume() {
      if (seekedRef.current || !initialPosition || initialPosition <= 0) return;
      seekedRef.current = true;
      video.currentTime = initialPosition;
    }

    function attachDirect() {
      // Native playback: browser loads the URL itself.
      video.src = src;
      video.load();
      setStatus("ready");
      video.addEventListener("loadedmetadata", seekToResume, { once: true });
    }

    function attachHls() {
      // 1) Native HLS (Safari on macOS/iOS)
      if (video.canPlayType("application/vnd.apple.mpegurl")) {
        video.src = src;
        video.load();
        setStatus("ready");
        video.addEventListener("loadedmetadata", seekToResume, { once: true });
        return;
      }
      // 2) Fallback to hls.js for non-native browsers (Chrome, Firefox, etc.)
      if (Hls.isSupported()) {
        hls = new Hls();
        hls.loadSource(src);
        hls.attachMedia(video);
        hls.on(Hls.Events.MANIFEST_PARSED, () => {
          setStatus("ready");
          seekToResume();
        });
        hls.on(Hls.Events.ERROR, (_evt, data) => {
          if (cancelled) return;
          if (data.fatal) {
            errorRef.current = true;
            setStatus("error");
            setError(
              data.details === Hls.ErrorDetails.MANIFEST_LOAD_ERROR ||
                data.details === Hls.ErrorDetails.MANIFEST_LOAD_TIMEOUT
                ? "Unable to load the stream. The video may be unreachable or expired."
                : "The stream failed to play."
            );
          }
        });
      } else {
        // 3) No HLS support at all
        errorRef.current = true;
        setStatus("error");
        setError("Your browser doesn't support this video stream format.");
      }
    }

    /** Throttled progress-persist callback. */
    function onTimeUpdate() {
      if (cancelled || !lessonId) return;

      const now = Date.now();
      if (now - lastUpdateRef.current < PROGRESS_UPDATE_INTERVAL) return;
      lastUpdateRef.current = now;

      const duration = video.duration;
      if (!duration || !isFinite(duration) || duration <= 0) return;

      const position = Math.floor(video.currentTime);
      // Cap at 99 so "Mark as Complete" remains the sole path to 100%.
      const percentage = Math.min(Math.round((position / duration) * 100), 99);

      updateLessonProgress(lessonId, {
        last_position: position,
        progress_percentage: percentage,
      }).catch(() => {
        // Silently ignore — progress tracking is non-critical.
      });
    }

    if (isHls) {
      setStatus("loading");
      attachHls();
    } else {
      attachDirect();
    }

    // Native error handler (also triggers for HLS on native Safari)
    const onVideoError = () => {
      if (cancelled || errorRef.current) return;
      errorRef.current = true;
      setStatus("error");
      setError("This video could not be played. It may be unavailable or expired.");
    };
    video.addEventListener("error", onVideoError);
    video.addEventListener("timeupdate", onTimeUpdate);

    return () => {
      cancelled = true;
      lastUpdateRef.current = 0;
      video.removeEventListener("error", onVideoError);
      video.removeEventListener("timeupdate", onTimeUpdate);
      if (hls) {
        hls.destroy();
      }
    };
  }, [src, lessonId, initialPosition]);

  if (status === "error") {
    return (
      <div
        role="alert"
        className="aspect-video w-full rounded-xl overflow-hidden bg-card border border-border flex flex-col items-center justify-center gap-2 text-center p-6"
      >
        <PlayCircle className="w-10 h-10 text-muted-foreground/50" />
        <p className="text-sm text-muted-foreground">{error}</p>
        {title ? (
          <p className="text-xs text-muted-foreground/60">Lesson: {title}</p>
        ) : null}
      </div>
    );
  }

  return (
    <div className="relative aspect-video w-full rounded-xl overflow-hidden bg-black">
      {status === "loading" && (
        <div className="absolute inset-0 flex items-center justify-center bg-black/40 z-10">
          <Loader2 className="w-6 h-6 text-white animate-spin" />
        </div>
      )}
      <video
        ref={videoRef}
        controls
        playsInline
        className="w-full h-full object-contain relative z-0"
        aria-label={title ? `Video: ${title}` : "Video player"}
        preload="metadata"
      />
    </div>
  );
}
