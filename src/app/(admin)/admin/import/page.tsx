"use client";

import { useState, useRef, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Upload, FileUp, AlertTriangle, CheckCircle2, Loader2, FileText, Video, FileCode, BookOpen, ArrowLeft, ExternalLink } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Badge } from "@/components/ui/badge";
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle, AlertDialogTrigger } from "@/components/ui/alert-dialog";
import { Progress, ProgressIndicator, ProgressTrack } from "@/components/ui/progress";
import { parseImport, importCourse } from "@/actions/admin/import-course";

type ImportMode = "incremental" | "replacement";

type PageState =
  | { phase: "empty" }
  | { phase: "parsing" }
  | { phase: "inspection"; parseResult: { success: true; course: { source_id: string; source_type: string; title: string; description: string | null; modules: { title: string; description: string | null; sort_order: number; source_chapter_num: string; lessons: { title: string; content_type: string; sort_order: number; is_preview: boolean }[] }[] }; warnings: { level: string; message: string; source_type: string; source_key: string | null }[]; moduleCount: number; totalLessonCount: number; lessonsByType: Record<string, number> }; fileName: string }
  | { phase: "importing"; mode: ImportMode; fileName: string; courseTitle: string }
  | { phase: "success"; result: { courseId: string; courseTitle: string; mode: string; modulesCreated: number; lessonsAdded: number; lessonsRemoved: number; totalLessons: number; lessonsByType: Record<string, number>; warnings: { level: string; message: string; source_type: string; source_key: string | null }[] } }
  | { phase: "error"; message: string };

const contentTypeLabels: Record<string, { label: string; icon: React.ElementType }> = {
  video: { label: "Videos", icon: Video },
  pdf: { label: "PDFs", icon: FileText },
  file: { label: "Code Files", icon: FileCode },
  text: { label: "Text", icon: FileText },
  link: { label: "Links", icon: BookOpen },
  image: { label: "Images", icon: FileText },
};

export default function ImportPage() {
  const router = useRouter();
  const [isPending, startTransition] = useTransition();
  const [state, setState] = useState<PageState>({ phase: "empty" });
  const [replaceDialogOpen, setReplaceDialogOpen] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const currentFileRef = useRef<File | null>(null);
  const pendingImportModeRef = useRef<ImportMode | null>(null);

  function processFile(file: File) {
    currentFileRef.current = file;
    setState({ phase: "parsing" });

    const formData = new FormData();
    formData.set("file", file);

    startTransition(async () => {
      const result = await parseImport(formData);
      if (!result.success) {
        setState({ phase: "error", message: result.error });
        return;
      }

      const data = result.data;
      if (!data.success) {
        setState({ phase: "error", message: data.error });
        return;
      }

      setState({
        phase: "inspection",
        parseResult: data,
        fileName: file.name,
      });
    });
  }

  function handleDrop(e: React.DragEvent) {
    e.preventDefault();
    const file = e.dataTransfer.files[0];
    if (file) processFile(file);
  }

  function handleDragOver(e: React.DragEvent) {
    e.preventDefault();
  }

  function handleImport(mode: ImportMode) {
    const currentState = state;
    if (currentState.phase !== "inspection") return;

    setState({
      phase: "importing",
      mode,
      fileName: currentState.fileName,
      courseTitle: currentState.parseResult.course.title,
    });

    const formData = new FormData();
    if (currentFileRef.current) {
      formData.set("file", currentFileRef.current);
    }
    formData.set("mode", mode);

    startTransition(async () => {
      const result = await importCourse(formData);
      if (!result.success) {
        setState({ phase: "error", message: result.error });
        return;
      }

      setState({ phase: "success", result: result.data });
    });
  }

  function reset() {
    setState({ phase: "empty" });
    if (fileInputRef.current) {
      fileInputRef.current.value = "";
    }
    currentFileRef.current = null;
  }

  const inspectionState = state.phase === "inspection" ? state : null;

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-semibold tracking-tight">Auto Course Importer</h1>
        <p className="text-sm text-muted-foreground mt-1">
          Import courses from a source database file.
        </p>
      </div>

      {state.phase === "error" && (
        <Card>
          <CardHeader>
            <div className="flex items-center gap-2 text-destructive">
              <AlertTriangle className="w-5 h-5" />
              <CardTitle>Import Failed</CardTitle>
            </div>
            <CardDescription>{state.message}</CardDescription>
          </CardHeader>
          <CardContent>
            <Button variant="outline" onClick={reset}>
              <ArrowLeft className="w-4 h-4 mr-2" />
              Try Again
            </Button>
          </CardContent>
        </Card>
      )}

      {state.phase === "parsing" && (
        <Card>
          <CardHeader>
            <div className="flex items-center gap-2">
              <Loader2 className="w-5 h-5 animate-spin text-primary" />
              <CardTitle>Parsing File...</CardTitle>
            </div>
            <CardDescription>Reading source database structure...</CardDescription>
          </CardHeader>
          <CardContent>
            <Progress value={null}>
              <ProgressTrack className="h-2">
                <ProgressIndicator className="bg-primary" />
              </ProgressTrack>
            </Progress>
          </CardContent>
        </Card>
      )}

      {state.phase === "importing" && (
        <Card>
          <CardHeader>
            <div className="flex items-center gap-2">
              <Loader2 className="w-5 h-5 animate-spin text-primary" />
              <CardTitle>Importing Course...</CardTitle>
            </div>
            <CardDescription>
              {state.mode === "replacement" ? "Replacing" : "Importing"} &ldquo;{state.courseTitle}&rdquo;
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <Progress value={null}>
              <ProgressTrack className="h-2">
                <ProgressIndicator className="bg-primary" />
              </ProgressTrack>
            </Progress>
            <p className="text-xs text-muted-foreground">
              Processing modules and lessons. This may take a moment...
            </p>
          </CardContent>
        </Card>
      )}

      {state.phase === "success" && (
        <Card>
          <CardHeader>
            <div className="flex items-center gap-2 text-green-600 dark:text-green-400">
              <CheckCircle2 className="w-5 h-5" />
              <CardTitle>Import Complete</CardTitle>
            </div>
            <CardDescription>&ldquo;{state.result.courseTitle}&rdquo; imported successfully.</CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
              <div className="rounded-lg border border-border bg-muted/30 p-3 text-center">
                <div className="text-2xl font-semibold tabular-nums">{state.result.totalLessons}</div>
                <div className="text-xs text-muted-foreground mt-0.5">Total Lessons</div>
              </div>
              <div className="rounded-lg border border-border bg-muted/30 p-3 text-center">
                <div className="text-2xl font-semibold tabular-nums">{state.result.lessonsAdded}</div>
                <div className="text-xs text-muted-foreground mt-0.5">
                  {state.result.mode === "replacement" ? "Recreated" : "Added"}
                </div>
              </div>
              <div className="rounded-lg border border-border bg-muted/30 p-3 text-center">
                <div className="text-2xl font-semibold tabular-nums">{state.result.lessonsRemoved}</div>
                <div className="text-xs text-muted-foreground mt-0.5">Removed</div>
              </div>
              <div className="rounded-lg border border-border bg-muted/30 p-3 text-center">
                <div className="text-2xl font-semibold tabular-nums">{state.result.modulesCreated}</div>
                <div className="text-xs text-muted-foreground mt-0.5">Modules</div>
              </div>
            </div>

            {Object.keys(state.result.lessonsByType).length > 0 && (
              <div className="flex flex-wrap gap-2">
                {Object.entries(state.result.lessonsByType).map(([type, count]) => {
                  const info = contentTypeLabels[type] || { label: type, icon: FileText };
                  const Icon = info.icon;
                  return (
                    <Badge key={type} variant="secondary" className="flex items-center gap-1.5 px-2.5 py-1">
                      <Icon className="w-3.5 h-3.5" />
                      {count} {info.label}
                    </Badge>
                  );
                })}
              </div>
            )}

            {state.result.warnings.length > 0 && (
              <Alert variant="default">
                <AlertTriangle className="w-4 h-4" />
                <AlertTitle>Warnings ({state.result.warnings.length})</AlertTitle>
                <AlertDescription>
                  <ul className="list-disc list-inside text-xs space-y-1 mt-1">
                    {state.result.warnings.map((w, i) => (
                      <li key={i}>{w.message}</li>
                    ))}
                  </ul>
                </AlertDescription>
              </Alert>
            )}

            <div className="flex gap-3">
              <Button variant="default" onClick={() => router.push(`/admin/courses/${state.result.courseId}/builder`)}>
                <ExternalLink className="w-4 h-4 mr-2" />
                Open Course Builder
              </Button>
              <Button variant="outline" onClick={reset}>
                Import Another
              </Button>
            </div>
          </CardContent>
        </Card>
      )}

      {state.phase === "empty" && (
        <Card>
          <CardHeader>
            <CardTitle>Upload Database File</CardTitle>
            <CardDescription>
              Select or drag a <code className="text-xs bg-muted px-1.5 py-0.5 rounded">.db</code> file to inspect and import.
            </CardDescription>
          </CardHeader>
          <CardContent>
            <div
              onDrop={handleDrop}
              onDragOver={handleDragOver}
              onClick={() => fileInputRef.current?.click()}
              className="border-2 border-dashed border-border rounded-xl p-12 text-center cursor-pointer hover:border-primary/50 transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2"
              role="button"
              tabIndex={0}
              onKeyDown={(e) => { if (e.key === "Enter" || e.key === " ") fileInputRef.current?.click(); }}
              aria-label="Upload database file"
            >
              <div className="flex flex-col items-center gap-3">
                <div className="w-12 h-12 rounded-full bg-muted flex items-center justify-center">
                  <Upload className="w-6 h-6 text-muted-foreground" />
                </div>
                <div className="space-y-1">
                  <p className="text-sm font-medium">Click to upload or drag and drop</p>
                  <p className="text-xs text-muted-foreground">SQLite database files (.db)</p>
                </div>
                <Button variant="outline" size="sm" type="button">
                  <FileUp className="w-4 h-4 mr-2" />
                  Select File
                </Button>
              </div>
            </div>
            <input
              ref={fileInputRef}
              type="file"
              accept=".db"
              className="hidden"
              onChange={(e) => { if (e.target.files?.[0]) processFile(e.target.files[0]); }}
            />
          </CardContent>
        </Card>
      )}

      {inspectionState && (
        <div className="space-y-4">
          <Card>
            <CardHeader>
              <div className="flex items-start justify-between">
                <div>
                  <CardTitle>{inspectionState.parseResult.course.title}</CardTitle>
                  <CardDescription className="mt-1.5 space-y-1">
                    <div className="flex items-center gap-1.5">
                      <Badge variant="outline" className="text-xs font-mono">
                        {inspectionState.parseResult.course.source_type}
                      </Badge>
                      <span className="text-xs text-muted-foreground">
                        source ID: {inspectionState.parseResult.course.source_id}
                      </span>
                    </div>
                    {inspectionState.parseResult.course.description && (
                      <p className="text-xs mt-1">{inspectionState.parseResult.course.description}</p>
                    )}
                  </CardDescription>
                </div>
                <Badge variant="secondary" className="shrink-0">
                  {inspectionState.fileName}
                </Badge>
              </div>
            </CardHeader>
            <CardContent>
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
                <div className="rounded-lg border border-border bg-muted/30 p-3 text-center">
                  <div className="text-2xl font-semibold tabular-nums">{inspectionState.parseResult.moduleCount}</div>
                  <div className="text-xs text-muted-foreground mt-0.5">Modules</div>
                </div>
                <div className="rounded-lg border border-border bg-muted/30 p-3 text-center">
                  <div className="text-2xl font-semibold tabular-nums">{inspectionState.parseResult.totalLessonCount}</div>
                  <div className="text-xs text-muted-foreground mt-0.5">Lessons</div>
                </div>
                {Object.entries(inspectionState.parseResult.lessonsByType).map(([type, count]) => {
                  const info = contentTypeLabels[type] || { label: type, icon: FileText };
                  const Icon = info.icon;
                  return (
                    <div key={type} className="rounded-lg border border-border bg-muted/30 p-3 text-center">
                      <div className="text-2xl font-semibold tabular-nums">{count}</div>
                      <div className="text-xs text-muted-foreground mt-0.5 flex items-center justify-center gap-1">
                        <Icon className="w-3 h-3" />
                        {info.label}
                      </div>
                    </div>
                  );
                })}
              </div>
            </CardContent>
          </Card>

          {inspectionState.parseResult.warnings.length > 0 && (
            <Alert variant="default">
              <AlertTriangle className="w-4 h-4" />
              <AlertTitle>Parse Warnings ({inspectionState.parseResult.warnings.length})</AlertTitle>
              <AlertDescription>
                <ul className="list-disc list-inside text-xs space-y-1 mt-1">
                  {inspectionState.parseResult.warnings.map((w, i) => (
                    <li key={i}>{w.message}</li>
                  ))}
                </ul>
              </AlertDescription>
            </Alert>
          )}

          <Card>
            <CardHeader>
              <CardTitle className="text-base">Module Preview</CardTitle>
              <CardDescription>
                {inspectionState.parseResult.moduleCount} module{inspectionState.parseResult.moduleCount !== 1 ? "s" : ""} detected
              </CardDescription>
            </CardHeader>
            <CardContent>
              <div className="space-y-2">
                {inspectionState.parseResult.course.modules.map((mod) => (
                  <div
                    key={mod.source_chapter_num}
                    className="flex items-center justify-between rounded-lg border border-border px-4 py-2.5 text-sm"
                  >
                    <div className="flex items-center gap-2 min-w-0">
                      <span className="text-muted-foreground tabular-nums shrink-0">
                        {mod.sort_order}.
                      </span>
                      <span className="truncate font-medium">{mod.title}</span>
                    </div>
                    <span className="text-xs text-muted-foreground shrink-0 ml-2">
                      {mod.lessons.length} lesson{mod.lessons.length !== 1 ? "s" : ""}
                    </span>
                  </div>
                ))}
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle className="text-base">Import Options</CardTitle>
              <CardDescription>
                Choose how to import this course. Source data is not modified.
              </CardDescription>
            </CardHeader>
            <CardContent>
              <div className="grid sm:grid-cols-2 gap-4">
                <Card className="border-border">
                  <CardHeader className="p-4">
                    <CardTitle className="text-sm">Incremental Import</CardTitle>
                    <CardDescription className="text-xs mt-1">
                      Add new modules and lessons. Existing content and manual
                      edits are preserved. Recommended for first import.
                    </CardDescription>
                  </CardHeader>
                  <CardContent className="px-4 pb-4 pt-0">
                    <Button className="w-full" variant="default" onClick={() => handleImport("incremental")} disabled={isPending}>
                      <FileUp className="w-4 h-4 mr-2" />
                      Import Incremental
                    </Button>
                  </CardContent>
                </Card>

                <Card className="border-border">
                  <CardHeader className="p-4">
                    <CardTitle className="text-sm text-amber-600 dark:text-amber-400">
                      Replace Content
                    </CardTitle>
                    <CardDescription className="text-xs mt-1">
                      Remove all imported modules and lessons, then re-import
                      from source. Course metadata, enrollments, and manual
                      content are preserved.
                    </CardDescription>
                  </CardHeader>
                  <CardContent className="px-4 pb-4 pt-0">
                    <AlertDialog open={replaceDialogOpen} onOpenChange={setReplaceDialogOpen}>
                      <AlertDialogTrigger
                        render={
                          <Button className="w-full" variant="outline" disabled={isPending}>
                            <AlertTriangle className="w-4 h-4 mr-2" />
                            Replace Content
                          </Button>
                        }
                      />
                      <AlertDialogContent>
                        <AlertDialogHeader>
                          <AlertDialogTitle>Replace Imported Content?</AlertDialogTitle>
                          <AlertDialogDescription>
                            This will remove all previously imported modules and lessons
                            for &ldquo;{inspectionState.parseResult.course.title}&rdquo;
                            and re-import them from the source file.
                          </AlertDialogDescription>
                        </AlertDialogHeader>
                        <AlertDialogDescription className="text-xs text-muted-foreground space-y-1">
                          <p className="font-medium text-foreground text-sm">This action will:</p>
                          <ul className="list-disc list-inside space-y-0.5">
                            <li>Remove imported modules and lessons</li>
                            <li>Re-import from source file</li>
                            <li>Preserve course metadata and settings</li>
                            <li>Preserve student enrollments</li>
                            <li>Preserve manually-added content</li>
                          </ul>
                        </AlertDialogDescription>
                        <AlertDialogFooter>
                          <AlertDialogCancel>Cancel</AlertDialogCancel>
                          <AlertDialogAction
                            variant="destructive"
                            onClick={() => {
                              setReplaceDialogOpen(false);
                              handleImport("replacement");
                            }}
                          >
                            Replace Content
                          </AlertDialogAction>
                        </AlertDialogFooter>
                      </AlertDialogContent>
                    </AlertDialog>
                  </CardContent>
                </Card>
              </div>

              <div className="mt-4">
                <Button variant="ghost" size="sm" onClick={reset}>
                  <ArrowLeft className="w-4 h-4 mr-2" />
                  Choose Different File
                </Button>
              </div>
            </CardContent>
          </Card>
        </div>
      )}
    </div>
  );
}