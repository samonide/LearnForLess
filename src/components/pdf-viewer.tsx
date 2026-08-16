"use client";

import { useState } from "react";
import { Button } from "@/components/ui/button";
import { ChevronLeft, ChevronRight, ZoomIn, ZoomOut, Maximize, Download } from "lucide-react";

interface PDFViewerProps {
  url: string;
  allowDownload?: boolean;
}

export default function PDFViewer({ url, allowDownload = true }: PDFViewerProps) {
  const [scale, setScale] = useState(1);
  const [fullscreen, setFullscreen] = useState(false);

  // We use an iframe/object combination for standard browser rendering.
  // This is highly reliable, supports zoom/navigation natively, and doesn't crash on large files.
  // We overlay our premium LMS control bar for a customized feel.
  return (
    <div className={`flex flex-col border border-border rounded-xl overflow-hidden bg-card ${fullscreen ? "fixed inset-0 z-50 h-screen w-screen" : "h-[650px] w-full"}`}>
      {/* Controls Bar */}
      <div className="border-b border-border bg-muted/30 px-4 py-2 flex items-center justify-between gap-4 text-sm font-medium">
        <div className="flex items-center gap-2">
          <Button
            variant="ghost"
            size="icon"
            onClick={() => setScale((s) => Math.max(s - 0.1, 0.5))}
            title="Zoom Out"
          >
            <ZoomOut className="w-4 h-4" />
          </Button>
          <span className="text-xs">{Math.round(scale * 100)}%</span>
          <Button
            variant="ghost"
            size="icon"
            onClick={() => setScale((s) => Math.min(s + 0.1, 2.0))}
            title="Zoom In"
          >
            <ZoomIn className="w-4 h-4" />
          </Button>
        </div>

        <div className="flex items-center gap-2">
          <Button
            variant="ghost"
            size="icon"
            onClick={() => setFullscreen(!fullscreen)}
            title="Toggle Fullscreen"
          >
            <Maximize className="w-4 h-4" />
          </Button>

          {allowDownload && (
            <a href={url} download target="_blank" rel="noreferrer">
              <Button variant="ghost" size="icon" title="Download PDF">
                <Download className="w-4 h-4" />
              </Button>
            </a>
          )}
        </div>
      </div>

      {/* Frame Container */}
      <div className="flex-1 bg-slate-100 dark:bg-slate-900 overflow-auto flex items-center justify-center p-4">
        <iframe
          src={`${url}#toolbar=0&navpanes=0`}
          className="w-full h-full border-0 rounded-lg shadow-sm"
          style={{ transform: `scale(${scale})`, transformOrigin: "top center", transition: "transform 0.15s ease-out" }}
          title="PDF Content"
        />
      </div>
    </div>
  );
}
