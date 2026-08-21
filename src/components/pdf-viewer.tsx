"use client";

import { useState, useCallback, useEffect, useRef } from "react";
import { Document, Page, pdfjs } from "react-pdf";
import "react-pdf/dist/Page/AnnotationLayer.css";
import "react-pdf/dist/Page/TextLayer.css";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import {
  Maximize,
  Minimize,
  Download,
  FileText,
  RotateCw,
} from "lucide-react";

// Use CDN worker to avoid Next.js bundling issues with the worker entry.
// pdfjs-dist 6.x worker lives at the matching version path.
pdfjs.GlobalWorkerOptions.workerSrc = `https://unpkg.com/pdfjs-dist@${pdfjs.version}/build/pdf.worker.min.mjs`;

interface PDFViewerProps {
  url: string;
  allowDownload?: boolean;
  fileName?: string;
}

const CANVAS_PADDING = 32; // 16px * 2 for p-4

export default function PDFViewer({
  url,
  allowDownload = true,
  fileName,
}: PDFViewerProps) {
  const [numPages, setNumPages] = useState(0);
  const [fullscreen, setFullscreen] = useState(false);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [containerWidth, setContainerWidth] = useState(0);
  const containerRef = useRef<HTMLDivElement>(null);
  const pageRefs = useRef<(HTMLDivElement | null)[]>([]);
  const [visiblePages, setVisiblePages] = useState<Set<number>>(new Set([1]));

  // Track container width for responsive PDF sizing
  useEffect(() => {
    const el = containerRef.current;
    if (!el) return;

    const updateWidth = () => {
      setContainerWidth(el.clientWidth);
    };
    updateWidth();

    const ro = new ResizeObserver(updateWidth);
    ro.observe(el);
    return () => ro.disconnect();
  }, []);

  // Page width = available container width (no zoom)
  const pageWidth = Math.max(containerWidth - CANVAS_PADDING, 0);

  // IntersectionObserver to track which pages are visible
  useEffect(() => {
    if (numPages === 0) return;

    const obs = new IntersectionObserver(
      (entries) => {
        for (const entry of entries) {
          const idx = Number(entry.target.getAttribute("data-page-index"));
          if (isNaN(idx)) continue;
          setVisiblePages((prev) => {
            const next = new Set(prev);
            if (entry.isIntersecting) {
              next.add(idx);
            } else {
              next.delete(idx);
            }
            return next;
          });
        }
      },
      { threshold: 0.1 },
    );

    for (const el of pageRefs.current) {
      if (el) obs.observe(el);
    }
    return () => obs.disconnect();
  }, [numPages]);

  // Which page is most prominently visible (lowest visible index)
  const currentPage = visiblePages.size > 0 ? Math.min(...visiblePages) + 1 : 1;

  function onDocumentLoadSuccess({ numPages }: { numPages: number }) {
    setNumPages(numPages);
    setLoading(false);
    setLoadError(null);
    pageRefs.current = new Array(numPages).fill(null);
  }

  function onDocumentLoadError(err: Error) {
    setLoading(false);
    setLoadError(err.message || "Failed to load PDF document.");
  }

  const handleRetry = useCallback(() => {
    setLoading(true);
    setLoadError(null);
  }, []);

  function ErrorBlock({ message }: { message: string }) {
    return (
      <div className="flex flex-col items-center justify-center gap-4 text-center py-16">
        <div className="w-12 h-12 rounded-full bg-destructive/10 flex items-center justify-center">
          <FileText className="w-6 h-6 text-destructive/70" />
        </div>
        <div className="space-y-1">
          <p className="text-sm font-medium text-foreground">Failed to load PDF</p>
          <p className="text-xs text-muted-foreground max-w-xs">{message}</p>
        </div>
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

  function SkeletonBlock() {
    return (
      <div className="w-full flex flex-col items-center justify-center py-16 gap-3">
        <Skeleton className="w-full h-[400px] max-w-2xl rounded-lg" />
        <div className="flex gap-2">
          <Skeleton className="w-8 h-6 rounded" />
          <Skeleton className="w-8 h-6 rounded" />
          <Skeleton className="w-8 h-6 rounded" />
        </div>
      </div>
    );
  }

  return (
    <div
      className={`flex flex-col bg-card border border-border rounded-xl overflow-hidden ${
        fullscreen
          ? "fixed inset-0 z-50 h-screen w-screen rounded-none"
          : "h-[65vh] min-h-[400px] md:h-[75vh] w-full"
      }`}
    >
      {/* Controls Bar */}
      <div className="border-b border-border bg-card px-3 py-1.5 flex items-center justify-between gap-2 shrink-0">
        {/* Page indicator */}
        <div className="text-xs text-muted-foreground tabular-nums font-medium select-none">
          {numPages > 0
            ? `Page ${currentPage} of ${numPages}`
            : " "}
        </div>

        {/* Actions */}
        <div className="flex items-center gap-1">
          <Button
            variant="ghost"
            size="icon"
            onClick={() => setFullscreen(!fullscreen)}
            title={fullscreen ? "Exit Fullscreen (Esc)" : "Fullscreen"}
            className="h-8 w-8"
          >
            {fullscreen ? <Minimize className="w-3.5 h-3.5" /> : <Maximize className="w-3.5 h-3.5" />}
          </Button>
          {allowDownload && (
            <a href={url} download={fileName || true} target="_blank" rel="noreferrer">
              <Button variant="ghost" size="icon" title="Download PDF" className="h-8 w-8">
                <Download className="w-3.5 h-3.5" />
              </Button>
            </a>
          )}
        </div>
      </div>

      {/* Document Canvas — scrollable vertical stack of all pages */}
      <div
        ref={containerRef}
        className="flex-1 bg-muted/50 overflow-auto p-4"
      >
        {loadError ? (
          <ErrorBlock message={loadError} />
        ) : (
          <Document
            file={url}
            onLoadSuccess={onDocumentLoadSuccess}
            onLoadError={onDocumentLoadError}
            loading={<SkeletonBlock />}
            error={<ErrorBlock message="Failed to load PDF document." />}
            className="mx-auto"
          >
            {Array.from({ length: numPages || 1 }, (_, i) => (
              <div
                key={i}
                ref={(el) => { pageRefs.current[i] = el; }}
                data-page-index={i}
                className="mb-4 last:mb-0"
              >
                <Page
                  pageNumber={i + 1}
                  width={pageWidth}
                  renderTextLayer={true}
                  renderAnnotationLayer={true}
                  className="border border-border rounded-lg overflow-hidden bg-white shadow-sm mx-auto"
                  loading={
                    <div className="flex items-center justify-center py-12">
                      <Skeleton className="w-full h-[500px] max-w-2xl rounded-lg" />
                    </div>
                  }
                />
              </div>
            ))}
          </Document>
        )}
      </div>
    </div>
  );
}