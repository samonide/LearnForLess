"use client";

import PDFViewer from "@/components/pdf-viewer";
import { Button } from "@/components/ui/button";
import { createClient } from "@/lib/supabase/client";
import type { Lesson } from "@/types";
import {
    Download,
    ExternalLink,
    FileText,
    HelpCircle,
    ImageIcon,
    Loader2,
    PlayCircle,
} from "lucide-react";
import { useEffect, useState } from "react";

interface LessonContentProps {
  lesson: Lesson;
  courseId: string;
}

export default function LessonContent({ lesson, courseId }: LessonContentProps) {
  const [signedUrl, setSignedUrl] = useState<string | null>(null);
  const [isLoadingUrl, setIsLoadingUrl] = useState(false);

  // Fetch signed URL for storage-based content
  useEffect(() => {
    if (lesson.storage_path && (lesson.content_type === "pdf" || lesson.content_type === "video" || lesson.content_type === "file" || lesson.content_type === "image")) {
      setIsLoadingUrl(true);
      const supabase = createClient();

      supabase.storage
        .from("course-materials")
        .createSignedUrl(lesson.storage_path, 3600) // 1 hour expiry
        .then(({ data, error }) => {
          if (data?.signedUrl) {
            setSignedUrl(data.signedUrl);
          }
          setIsLoadingUrl(false);
        })
        .catch(() => {
          setIsLoadingUrl(false);
        });
    }
  }, [lesson.storage_path, lesson.content_type]);

  // Determine content source (signed URL from storage or direct content)
  const contentUrl = signedUrl || lesson.content;

  // Render based on content type
  switch (lesson.content_type) {
    case "text":
      return (
        <div className="prose prose-sm md:prose-base dark:prose-invert max-w-none">
          {/* Sanitized HTML content */}
          <div dangerouslySetInnerHTML={{ __html: lesson.content || "" }} />
        </div>
      );

    case "video":
      if (!contentUrl) {
        return <EmptyContentState icon={PlayCircle} message="Video content is not available." />;
      }
      if (isLoadingUrl) {
        return <LoadingContentState />;
      }
      return (
        <div className="aspect-video w-full rounded-xl overflow-hidden border border-border bg-black shadow-sm">
          <video
            src={contentUrl}
            controls
            className="w-full h-full object-contain"
            controlsList="nodownload"
          />
        </div>
      );

    case "pdf":
      if (!contentUrl) {
        return <EmptyContentState icon={FileText} message="PDF document is not available." />;
      }
      if (isLoadingUrl) {
        return <LoadingContentState />;
      }
      return <PDFViewer url={contentUrl} allowDownload={false} />;

    case "image":
      if (!contentUrl) {
        return <EmptyContentState icon={ImageIcon} message="Image is not available." />;
      }
      if (isLoadingUrl) {
        return <LoadingContentState />;
      }
      return (
        <div className="border border-border rounded-xl overflow-hidden bg-muted flex items-center justify-center p-4">
          <img
            src={contentUrl}
            alt={lesson.title}
            className="max-w-full max-h-[600px] object-contain rounded-lg"
          />
        </div>
      );

    case "link":
      if (!lesson.content) {
        return <EmptyContentState icon={ExternalLink} message="Link URL is not available." />;
      }
      return (
        <div className="border border-border rounded-xl bg-card p-12 text-center space-y-6 max-w-md mx-auto shadow-sm">
          <div className="w-16 h-16 rounded-full bg-primary/10 flex items-center justify-center mx-auto">
            <ExternalLink className="w-8 h-8 text-primary" />
          </div>
          <div className="space-y-2">
            <h3 className="font-bold text-lg text-foreground">External Learning Resource</h3>
            <p className="text-muted-foreground text-sm leading-relaxed">
              This lesson requires viewing material on an external website. Click below to open it in a new tab.
            </p>
          </div>
          <a href={lesson.content} target="_blank" rel="noopener noreferrer" className="block">
            <Button className="w-full flex items-center justify-center gap-2">
              Open Resource
              <ExternalLink className="w-4 h-4" />
            </Button>
          </a>
        </div>
      );

    case "file":
      if (!contentUrl) {
        return <EmptyContentState icon={Download} message="Attachment file is not available." />;
      }
      if (isLoadingUrl) {
        return <LoadingContentState />;
      }
      return (
        <div className="border border-border rounded-xl bg-card p-12 text-center space-y-6 max-w-md mx-auto shadow-sm">
          <div className="w-16 h-16 rounded-full bg-primary/10 flex items-center justify-center mx-auto">
            <Download className="w-8 h-8 text-primary" />
          </div>
          <div className="space-y-2">
            <h3 className="font-bold text-lg text-foreground">Download Attachment</h3>
            <p className="text-muted-foreground text-sm leading-relaxed">
              Click below to download the course materials provided for this lesson.
            </p>
          </div>
          <a href={contentUrl} download className="block">
            <Button className="w-full flex items-center justify-center gap-2">
              Download File
              <Download className="w-4 h-4" />
            </Button>
          </a>
        </div>
      );

    default:
      return (
        <EmptyContentState
          icon={HelpCircle}
          message={`Unsupported content type: ${lesson.content_type}`}
        />
      );
  }
}

// ============================================================
// HELPER COMPONENTS
// ============================================================

interface EmptyContentStateProps {
  icon: React.ComponentType<{ className?: string }>;
  message: string;
}

function EmptyContentState({ icon: Icon, message }: EmptyContentStateProps) {
  return (
    <div className="p-8 border border-dashed border-border rounded-xl bg-muted/20 text-center text-muted-foreground flex flex-col items-center gap-3">
      <Icon className="w-12 h-12" />
      <span className="text-sm">{message}</span>
    </div>
  );
}

function LoadingContentState() {
  return (
    <div className="p-8 border border-border rounded-xl bg-muted/30 text-center text-muted-foreground flex flex-col items-center gap-3">
      <Loader2 className="w-6 h-6 animate-spin" />
      <span className="text-sm">Loading content...</span>
    </div>
  );
}
