"use client";

import { markLessonComplete } from "@/actions/student/progress";
import PDFViewer from "@/components/pdf-viewer";
import VideoPlayer from "@/components/video-player";
import {
    Accordion,
    AccordionContent,
    AccordionItem,
    AccordionTrigger,
} from "@/components/ui/accordion";
import { Button } from "@/components/ui/button";
import { Progress } from "@/components/ui/progress";
import { Sheet, SheetContent, SheetTrigger } from "@/components/ui/sheet";
import type { CourseViewerData } from "@/types";
import {
    ArrowLeft,
    Check,
    CheckCircle2,
    ChevronLeft,
    ChevronRight,
    Circle,
    Download,
    ExternalLink,
    FileText,
    HelpCircle,
    Image as ImageIcon,
    Menu,
    PlayCircle
} from "lucide-react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect, useState, useTransition } from "react";
import { toast } from "sonner";

interface CourseViewerProps {
  course: CourseViewerData;
  lesson: {
    id: string;
    title: string;
    description: string | null;
    content_type: string;
    content: string | null;
    storage_path: string | null;
    signed_url?: string;
    module_id: string;
  };
  courseId: string;
  lessonId: string;
}

export default function CourseViewer({
  course,
  lesson,
  courseId,
  lessonId,
}: CourseViewerProps) {
  const router = useRouter();
  const [isPending, startTransition] = useTransition();
  const [courseProgress, setCourseProgress] = useState(course.progress_pct);
  const [completedLessons, setCompletedLessons] = useState<Set<string>>(
    new Set(
      course.modules
        .flatMap((m) => m.lessons)
        .filter((l) => l.progress?.completed)
        .map((l) => l.id)
    )
  );

  // Flattened list of lessons for simple navigation
  const allLessons = course.modules.flatMap((m) => m.lessons);
  const currentIdx = allLessons.findIndex((l) => l.id === lessonId);
  const prevLesson = currentIdx > 0 ? allLessons[currentIdx - 1] : null;
  const nextLesson = currentIdx < allLessons.length - 1 ? allLessons[currentIdx + 1] : null;

  // Current module context (label + position within module)
  const currentModule = course.modules.find((m) => m.id === lesson.module_id);
  const currentModuleLessons = currentModule?.lessons ?? [];
  const lessonInModuleIdx = currentModuleLessons.findIndex((l) => l.id === lessonId);

  // Sync completion states
  useEffect(() => {
    setCourseProgress(course.progress_pct);
    setCompletedLessons(
      new Set(
        course.modules
          .flatMap((m) => m.lessons)
          .filter((l) => l.progress?.completed)
          .map((l) => l.id)
      )
    );
  }, [course]);

  // Handle Mark Complete action
  async function handleMarkComplete() {
    startTransition(async () => {
      const result = await markLessonComplete(lessonId);

      if (!result.success) {
        toast.error("Failed to update progress: " + result.error);
        return;
      }

      toast.success("Lesson marked as complete!");

      // Add to local state immediately
      const updated = new Set(completedLessons);
      updated.add(lessonId);
      setCompletedLessons(updated);

      if (result.data) {
        setCourseProgress(result.data.courseProgress);
      }

      // Auto-advance to next lesson if available
      if (nextLesson) {
        router.push(`/course/${courseId}/lesson/${nextLesson.id}`);
      } else {
        router.refresh();
      }
    });
  }

  // Current lesson progress (for resume tracking)
  const currentLessonProgress = course.modules
    .flatMap((m) => m.lessons)
    .find((l) => l.id === lessonId)?.progress;

  // Helper to render content based on content_type
  function renderContent() {
    switch (lesson.content_type) {
      case "text":
        return (
          <div
            className="prose-lesson prose dark:prose-invert max-w-none"
            dangerouslySetInnerHTML={{ __html: lesson.content || "" }}
          />
        );
      case "video":
        // Check if internal (storage) or external URL
        const videoSrc = lesson.signed_url || lesson.content;
        if (!videoSrc) {
          return (
            <div className="p-10 bg-card border border-border rounded-xl text-center flex flex-col items-center gap-4">
              <div className="w-12 h-12 rounded-full bg-muted flex items-center justify-center">
                <PlayCircle className="w-6 h-6 text-muted-foreground/50" />
              </div>
              <p className="text-sm text-muted-foreground">Video content is not available.</p>
            </div>
          );
        }
        return (
          <div className="w-full">
            <VideoPlayer
              key={lessonId}
              src={videoSrc}
              title={lesson.title}
              lessonId={lessonId}
              initialPosition={currentLessonProgress?.last_position ?? 0}
            />
          </div>
        );
      case "pdf":
        const pdfUrl = lesson.signed_url || lesson.content;
        if (!pdfUrl) {
          return (
            <div className="p-10 bg-card border border-border rounded-xl text-center flex flex-col items-center gap-4">
              <div className="w-12 h-12 rounded-full bg-muted flex items-center justify-center">
                <FileText className="w-6 h-6 text-muted-foreground/50" />
              </div>
              <p className="text-sm text-muted-foreground">PDF document not available.</p>
            </div>
          );
        }
        return <PDFViewer url={pdfUrl} allowDownload={true} />;
      case "image":
        const imgUrl = lesson.signed_url || lesson.content;
        if (!imgUrl) {
          return (
            <div className="p-10 bg-card border border-border rounded-xl text-center flex flex-col items-center gap-4">
              <div className="w-12 h-12 rounded-full bg-muted flex items-center justify-center">
                <ImageIcon className="w-6 h-6 text-muted-foreground/50" />
              </div>
              <p className="text-sm text-muted-foreground">Image not available.</p>
            </div>
          );
        }
        return (
          <div className="bg-card border border-border rounded-xl overflow-hidden flex items-center justify-center p-4">
            <img src={imgUrl} alt={lesson.title} loading="lazy" className="max-w-full max-h-[600px] object-contain rounded-lg" />
          </div>
        );
      case "link":
        if (!lesson.content) {
          return (
            <div className="p-10 bg-card border border-border rounded-xl text-center flex flex-col items-center gap-4">
              <div className="w-12 h-12 rounded-full bg-muted flex items-center justify-center">
                <ExternalLink className="w-6 h-6 text-muted-foreground/50" />
              </div>
              <p className="text-sm text-muted-foreground">Link URL not available.</p>
            </div>
          );
        }
        return (
          <div className="bg-card border border-border rounded-xl p-12 text-center space-y-6 max-w-md mx-auto">
            <div className="w-16 h-16 rounded-full bg-primary/10 flex items-center justify-center mx-auto">
              <ExternalLink className="w-8 h-8 text-primary" />
            </div>
            <div className="space-y-2">
              <h3 className="font-semibold text-lg text-foreground">External Learning Resource</h3>
              <p className="text-muted-foreground text-sm leading-relaxed">
                This lesson requires viewing material on an external website. Click below to open.
              </p>
            </div>
            <a href={lesson.content} target="_blank" rel="noopener noreferrer" className="block">
              <Button className="w-full flex items-center justify-center gap-2">
                Visit Resource
                <ExternalLink className="w-4 h-4" />
              </Button>
            </a>
          </div>
        );
      case "file":
        const fileUrl = lesson.signed_url || lesson.content;
        if (!fileUrl) {
          return (
            <div className="p-10 bg-card border border-border rounded-xl text-center flex flex-col items-center gap-4">
              <div className="w-12 h-12 rounded-full bg-muted flex items-center justify-center">
                <Download className="w-6 h-6 text-muted-foreground/50" />
              </div>
              <p className="text-sm text-muted-foreground">Attachment not available.</p>
            </div>
          );
        }
        return (
          <div className="bg-card border border-border rounded-xl p-12 text-center space-y-6 max-w-md mx-auto">
            <div className="w-16 h-16 rounded-full bg-primary/10 flex items-center justify-center mx-auto">
              <Download className="w-8 h-8 text-primary" />
            </div>
            <div className="space-y-2">
              <h3 className="font-semibold text-lg text-foreground">Lesson Material</h3>
              <p className="text-muted-foreground text-sm leading-relaxed">
                Download the file attached to this lesson.
              </p>
            </div>
            <a href={fileUrl} download className="block">
              <Button className="w-full flex items-center justify-center gap-2">
                <Download className="w-4 h-4" />
                Download File
              </Button>
            </a>
          </div>
        );
      default:
        return (
          <div className="p-10 bg-card border border-border rounded-xl text-center flex flex-col items-center gap-4">
            <div className="w-12 h-12 rounded-full bg-muted flex items-center justify-center">
              <HelpCircle className="w-6 h-6 text-muted-foreground/50" />
            </div>
            <p className="text-sm text-muted-foreground">Unsupported content type.</p>
          </div>
        );
    }
  }

  // Sidebar component for reuse
  const SidebarContent = () => (
    <div className="flex flex-col h-full bg-sidebar text-sidebar-foreground">
      {/* Sidebar header */}
      <div className="p-5 border-b border-sidebar-border space-y-4">
        <div className="flex items-center gap-3">
          <Link
            href="/dashboard"
            className="inline-flex items-center gap-1.5 text-xs text-muted-foreground hover:text-foreground font-medium"
          >
            <ArrowLeft className="w-3.5 h-3.5" />
            Dashboard
          </Link>
          <span className="text-xs text-sidebar-border">·</span>
          <Link
            href={`/course/${courseId}`}
            className="text-xs text-muted-foreground hover:text-foreground font-medium"
          >
            Course
          </Link>
        </div>
        <div>
          <h2 className="text-lg font-semibold leading-tight tracking-tight text-foreground line-clamp-2">
            {course.title}
          </h2>
        </div>
        <div className="space-y-2 pt-1">
          <div className="flex justify-between text-xs font-semibold text-foreground">
            <span>Course Progress</span>
            <span>{courseProgress}%</span>
          </div>
          <Progress value={courseProgress} />
        </div>
      </div>

      {/* Accordion Modules */}
      <div className="flex-1 overflow-y-auto p-4">
        <Accordion
          type="multiple"
          defaultValue={(course.modules as Array<{ id: string }>).map((m) => m.id)}
          className="space-y-0.5"
        >
          {course.modules.map((mod: any) => (
            <AccordionItem
              key={mod.id}
              value={mod.id}
              className="border-0 rounded-md overflow-hidden"
            >
              <AccordionTrigger className="hover:no-underline py-3 px-2 font-semibold text-sm text-foreground text-left leading-relaxed">
                <div className="space-y-1">
                  <span>{mod.title}</span>
                  <div className="text-xs text-muted-foreground font-medium">
                    {mod.completed_lessons} / {mod.total_lessons} Completed
                  </div>
                </div>
              </AccordionTrigger>
              <AccordionContent className="pt-1 pb-3 space-y-1 px-2">
                {mod.lessons.map((les: any) => {
                  const isCurrent = les.id === lessonId;
                  const isCompleted = completedLessons.has(les.id);

                  return (
                    <Link
                      key={les.id}
                      href={`/course/${courseId}/lesson/${les.id}`}
                      className={`flex items-start gap-2.5 p-2 rounded-md text-sm font-medium no-underline ${
                        isCurrent
                          ? "bg-primary text-primary-foreground"
                          : "hover:bg-sidebar-accent text-foreground"
                      }`}
                    >
                      <div className="mt-0.5 shrink-0">
                        {isCompleted ? (
                          <CheckCircle2
                            className={`w-4 h-4 ${
                              isCurrent
                                ? "text-primary-foreground"
                                : "text-primary"
                            }`}
                          />
                        ) : (
                          <Circle className="w-4 h-4 opacity-40" />
                        )}
                      </div>
                      <div className="text-xs leading-relaxed flex-1">
                        <span className="opacity-70 mr-1.5">{les.lesson_number}.</span>
                        <span>{les.title}</span>
                      </div>
                    </Link>
                  );
                })}
              </AccordionContent>
            </AccordionItem>
          ))}
        </Accordion>
      </div>
    </div>
  );

  return (
    <div className="flex-1 flex flex-col md:flex-row min-h-0 bg-background">
      {/* Desktop Sidebar (Left side, fixed width) */}
      <aside className="hidden md:block w-80 shrink-0 h-[calc(100vh-3.5rem)] sticky top-14">
        <SidebarContent />
      </aside>

      {/* Main Content Area */}
      <main className="flex-1 flex flex-col min-h-0 overflow-y-auto">
        {/* Course viewer top-bar */}
        <div className="sticky top-14 md:top-0 z-30 bg-background/95 backdrop-blur border-b border-border px-6 lg:px-10 py-3 flex items-center justify-between gap-4">
          <div className="flex items-center gap-3">
            {/* Mobile Sidebar Trigger (Menu icon) */}
            <Sheet>
              <SheetTrigger
                render={
                  <Button variant="outline" size="icon" className="md:hidden shrink-0">
                    <Menu className="w-4 h-4" />
                  </Button>
                }
              />
              <SheetContent side="left" className="p-0 w-[calc(100vw-1.5rem)] sm:w-80">
                <SidebarContent />
              </SheetContent>
            </Sheet>

            <span className="font-semibold text-foreground truncate max-w-[200px] sm:max-w-sm md:max-w-md lg:max-w-xl">
              {lesson.title}
            </span>
          </div>

          {/* Top navigation controls */}
          <div className="flex items-center gap-2">
            {prevLesson ? (
              <Link href={`/course/${courseId}/lesson/${prevLesson.id}`}>
                <Button variant="outline" size="sm" className="flex items-center gap-1.5 h-8">
                  <ChevronLeft className="w-4 h-4" />
                  <span className="hidden sm:inline">Previous</span>
                </Button>
              </Link>
            ) : (
              <Button variant="outline" size="sm" disabled className="flex items-center gap-1.5 h-8">
                <ChevronLeft className="w-4 h-4" />
                <span className="hidden sm:inline">Previous</span>
              </Button>
            )}

            {nextLesson ? (
              <Link href={`/course/${courseId}/lesson/${nextLesson.id}`}>
                <Button variant="outline" size="sm" className="flex items-center gap-1.5 h-8">
                  <span className="hidden sm:inline">Next</span>
                  <ChevronRight className="w-4 h-4" />
                </Button>
              </Link>
            ) : (
              <Button variant="outline" size="sm" disabled className="flex items-center gap-1.5 h-8">
                <span className="hidden sm:inline">Next</span>
                <ChevronRight className="w-4 h-4" />
              </Button>
            )}
          </div>
        </div>

        {/* Content canvas */}
        <div className="flex-1 px-6 lg:px-10 py-8 w-full mx-auto">
          <div className="max-w-5xl mx-auto space-y-10">
            {/* Lesson header area */}
            <div className="max-w-3xl space-y-2.5">
              {/* Module / lesson context */}
              <div className="flex items-center gap-2 text-xs font-mono text-muted-foreground">
                {currentModule ? (
                  <>
                    <span>{currentModule.title}</span>
                    <span className="opacity-50">/</span>
                  </>
                ) : null}
                <span>
                  Lesson {Math.min(lessonInModuleIdx + 1, Math.max(currentModuleLessons.length, 1))}
                  {currentModuleLessons.length > 1
                    ? ` of ${currentModuleLessons.length}`
                    : ""}
                </span>
              </div>
              <h1 className="text-2xl md:text-3xl font-semibold tracking-tight text-foreground text-balance">
                {lesson.title}
              </h1>
              {lesson.description && (
                <p className="text-muted-foreground text-sm md:text-base leading-relaxed max-w-3xl">
                  {lesson.description}
                </p>
              )}
            </div>

            {/* Dynamic Content Container */}
            <div className="w-full">{renderContent()}</div>

            {/* Complete Lesson Action / Bottom Bar */}
            <div className="border-t border-border pt-8 flex items-center justify-between gap-4">
              <div>
                {completedLessons.has(lessonId) ? (
                  <div className="flex items-center gap-2 text-green-600 dark:text-green-500 font-semibold text-sm">
                    <Check className="w-4 h-4 stroke-[3px]" />
                    <span>Lesson Completed</span>
                  </div>
                ) : (
                  <p className="text-xs text-muted-foreground">
                    Finish this lesson and mark it as complete to update your overall course progress.
                  </p>
                )}
              </div>

              <Button
                onClick={handleMarkComplete}
                disabled={completedLessons.has(lessonId) || isPending}
                className="flex items-center gap-2 h-11 px-6 font-semibold"
              >
                {isPending ? (
                  <span>Saving...</span>
                ) : completedLessons.has(lessonId) ? (
                  <span>Completed</span>
                ) : (
                  <>
                    <CheckCircle2 className="w-4 h-4" />
                    <span>Mark as Complete</span>
                  </>
                )}
              </Button>
            </div>
          </div>
        </div>
      </main>
    </div>
  );
}
