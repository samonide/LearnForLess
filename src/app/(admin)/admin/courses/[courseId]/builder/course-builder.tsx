"use client";

import {
    createLesson,
    deleteLesson,
    reorderLessons,
    updateLesson,
    uploadLessonFile,
} from "@/actions/admin/lessons";
import {
    createModule,
    deleteModule,
    reorderModules,
    updateModule,
} from "@/actions/admin/modules";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
    Dialog,
    DialogContent,
    DialogDescription,
    DialogFooter,
    DialogHeader,
    DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
    Select,
    SelectContent,
    SelectItem,
    SelectTrigger,
    SelectValue,
} from "@/components/ui/select";
import { Switch } from "@/components/ui/switch";
import { Textarea } from "@/components/ui/textarea";
import type { ContentType, Lesson, Module } from "@/types";
import {
    ChevronDown,
    ChevronUp,
    Edit,
    File,
    FileText,
    Image as ImageIcon,
    Layers,
    Link2,
    Loader2,
    Plus,
    Trash2,
    Upload,
    Video
} from "lucide-react";
import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";
import { toast } from "sonner";

interface ModuleWithLessons extends Module {
  lessons: Lesson[];
}

interface CourseBuilderProps {
  courseId: string;
  initialModules: ModuleWithLessons[];
}

export default function CourseBuilder({
  courseId,
  initialModules,
}: CourseBuilderProps) {
  const router = useRouter();
  const [isPending, startTransition] = useTransition();

  // Modals state
  const [moduleModalOpen, setModuleModalOpen] = useState(false);
  const [activeModule, setActiveModule] = useState<Module | null>(null);
  const [moduleTitle, setModuleTitle] = useState("");
  const [moduleDesc, setModuleDesc] = useState("");

  const [lessonModalOpen, setLessonModalOpen] = useState(false);
  const [activeLesson, setActiveLesson] = useState<Lesson | null>(null);
  const [lessonModuleId, setLessonModuleId] = useState("");
  const [lessonTitle, setLessonTitle] = useState("");
  const [lessonDesc, setLessonDesc] = useState("");
  const [lessonType, setLessonType] = useState<ContentType>("text");
  const [lessonContent, setLessonContent] = useState("");
  const [isPreview, setIsPreview] = useState(false);
  const [selectedFile, setSelectedFile] = useState<File | null>(null);

  // ── MODULE ACTIONS ─────────────────────────────────────────

  function openModuleModal(mod: Module | null = null, forceModuleId?: string) {
    if (mod) {
      setActiveModule(mod);
      setModuleTitle(mod.title);
      setModuleDesc(mod.description || "");
    } else {
      setActiveModule(null);
      setModuleTitle("");
      setModuleDesc("");
    }
    setModuleModalOpen(true);
  }

  async function handleModuleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!moduleTitle.trim()) return;

    startTransition(async () => {
      if (activeModule) {
        // Edit module
        const res = await updateModule(activeModule.id, {
          title: moduleTitle,
          description: moduleDesc,
        });
        if (!res.success) {
          toast.error(res.error);
          return;
        }

        toast.success("Module updated successfully.");
        setModuleModalOpen(false);
        router.refresh();
      } else {
        // Create module
        const res = await createModule({
          course_id: courseId,
          title: moduleTitle,
          description: moduleDesc,
        });
        if (!res.success) {
          toast.error(res.error);
          return;
        }

        toast.success("Module created successfully.");
        setModuleModalOpen(false);
        router.refresh();
      }
    });
  }

  async function handleDeleteModule(id: string) {
    if (!confirm("Are you sure you want to delete this module? All lessons inside will be deleted too.")) return;

    startTransition(async () => {
      const res = await deleteModule(id);
      if (res.success) {
        toast.success("Module deleted.");
        router.refresh();
      } else {
        toast.error(res.error);
      }
    });
  }

  async function handleMoveModule(index: number, direction: "up" | "down") {
    const targetIdx = direction === "up" ? index - 1 : index + 1;
    if (targetIdx < 0 || targetIdx >= initialModules.length) return;

    const reordered = [...initialModules];
    const temp = reordered[index];
    reordered[index] = reordered[targetIdx];
    reordered[targetIdx] = temp;

    startTransition(async () => {
      const res = await reorderModules(
        courseId,
        reordered.map((m) => m.id)
      );
      if (res.success) {
        router.refresh();
      } else {
        toast.error("Failed to reorder modules: " + res.error);
      }
    });
  }

  // ── LESSON ACTIONS ──────────────────────────────────────────

  function openLessonModal(moduleId: string, lesson: Lesson | null = null) {
    setLessonModuleId(moduleId);
    setSelectedFile(null);
    if (lesson) {
      setActiveLesson(lesson);
      setLessonTitle(lesson.title);
      setLessonDesc(lesson.description || "");
      setLessonType(lesson.content_type as ContentType);
      setLessonContent(lesson.content || "");
      setIsPreview(lesson.is_preview);
    } else {
      setActiveLesson(null);
      setLessonTitle("");
      setLessonDesc("");
      setLessonType("text");
      setLessonContent("");
      setIsPreview(false);
    }
    setLessonModalOpen(true);
  }

  async function handleLessonSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!lessonTitle.trim()) return;

    startTransition(async () => {
      let savedLessonId = "";

      if (activeLesson) {
        // Edit Lesson
        const res = await updateLesson({
          id: activeLesson.id,
          title: lessonTitle,
          description: lessonDesc,
          content_type: lessonType,
          content: lessonContent,
          is_preview: isPreview,
        });

        if (!res.success) {
          toast.error(res.error);
          return;
        }
        savedLessonId = activeLesson.id;
      } else {
        // Create Lesson
        const res = await createLesson({
          module_id: lessonModuleId,
          title: lessonTitle,
          description: lessonDesc,
          content_type: lessonType,
          content: lessonContent,
          is_preview: isPreview,
        });

        if (res.success === false) {
          toast.error(res.error);
          return;
        }
        savedLessonId = res.data.id;
      }

      // Handle file upload if file is selected for media types
      if (selectedFile && ["pdf", "video", "image", "file"].includes(lessonType)) {
        const formData = new FormData();
        formData.append("file", selectedFile);
        
        toast.loading("Uploading file to secure storage...", { id: "upload-toast" });
        const uploadRes = await uploadLessonFile(
          courseId,
          lessonModuleId,
          savedLessonId,
          formData
        );
        toast.dismiss("upload-toast");

        if (!uploadRes.success) {
          toast.error(`File upload failed: ${uploadRes.error}`);
          return;
        }
      }

      toast.success("Lesson saved successfully.");
      setLessonModalOpen(false);
      router.refresh();
    });
  }

  async function handleDeleteLesson(id: string) {
    if (!confirm("Are you sure you want to delete this lesson?")) return;

    startTransition(async () => {
      const res = await deleteLesson(id);
      if (res.success) {
        toast.success("Lesson deleted.");
        router.refresh();
      } else {
        toast.error(res.error);
      }
    });
  }

  async function handleMoveLesson(
    moduleId: string,
    lessons: Lesson[],
    index: number,
    direction: "up" | "down"
  ) {
    const targetIdx = direction === "up" ? index - 1 : index + 1;
    if (targetIdx < 0 || targetIdx >= lessons.length) return;

    const reordered = [...lessons];
    const temp = reordered[index];
    reordered[index] = reordered[targetIdx];
    reordered[targetIdx] = temp;

    startTransition(async () => {
      const res = await reorderLessons(
        moduleId,
        reordered.map((l) => l.id)
      );
      if (res.success) {
        router.refresh();
      } else {
        toast.error("Failed to reorder lessons: " + res.error);
      }
    });
  }

  // Render proper icon for content type
  function getContentTypeIcon(type: string) {
    switch (type) {
      case "pdf":
        return <FileText className="w-4 h-4 text-red-500" />;
      case "video":
        return <Video className="w-4 h-4 text-blue-500" />;
      case "link":
        return <Link2 className="w-4 h-4 text-green-500" />;
      case "image":
        return <ImageIcon className="w-4 h-4 text-purple-500" />;
      case "file":
        return <File className="w-4 h-4 text-slate-500" />;
      default:
        return <FileText className="w-4 h-4 text-slate-400" />;
    }
  }

  return (
    <div className="space-y-6">
      {/* Action buttons */}
      <div className="flex justify-end">
        <Button onClick={() => openModuleModal()} className="flex items-center gap-2">
          <Plus className="w-4 h-4" />
          Add Module
        </Button>
      </div>

      {/* Modules List Canvas */}
      <div className="space-y-6">
        {initialModules.length === 0 ? (
          <div className="border-2 border-dashed border-border rounded-xl p-16 text-center space-y-4 bg-card">
            <Layers className="w-12 h-12 text-muted-foreground/30 mx-auto" />
            <h3 className="font-bold text-lg">No modules added yet</h3>
            <p className="text-muted-foreground text-sm max-w-sm mx-auto">
              Create your course structure by adding modules, then add lessons inside them.
            </p>
            <Button onClick={() => openModuleModal()} className="flex items-center gap-2 mx-auto">
              <Plus className="w-4 h-4" />
              Add Module
            </Button>
          </div>
        ) : (
          initialModules.map((mod, modIdx) => (
            <div
              key={mod.id}
              className="border border-border bg-card rounded-xl overflow-hidden shadow-sm"
            >
              {/* Module Header Bar */}
              <div className="bg-slate-100 dark:bg-slate-900 border-b border-border px-6 py-4 flex flex-col sm:flex-row sm:items-center justify-between gap-4">
                <div className="space-y-1">
                  <div className="flex items-center gap-2">
                    <span className="font-mono text-xs text-muted-foreground font-semibold uppercase">
                      Module {modIdx + 1}
                    </span>
                    <Badge variant="outline" className="text-[10px]">
                      {mod.lessons.length} lessons
                    </Badge>
                  </div>
                  <h3 className="font-bold text-base text-foreground leading-tight">
                    {mod.title}
                  </h3>
                  {mod.description && (
                    <p className="text-muted-foreground text-xs">{mod.description}</p>
                  )}
                </div>

                {/* Module control actions */}
                <div className="flex items-center gap-1.5 self-end sm:self-center">
                  {/* Reorder Buttons */}
                  <Button
                    variant="ghost"
                    size="icon"
                    disabled={modIdx === 0 || isPending}
                    onClick={() => handleMoveModule(modIdx, "up")}
                    title="Move Module Up"
                  >
                    <ChevronUp className="w-4 h-4" />
                  </Button>
                  <Button
                    variant="ghost"
                    size="icon"
                    disabled={modIdx === initialModules.length - 1 || isPending}
                    onClick={() => handleMoveModule(modIdx, "down")}
                    title="Move Module Down"
                  >
                    <ChevronDown className="w-4 h-4" />
                  </Button>

                  <Button
                    variant="ghost"
                    size="icon"
                    onClick={() => openModuleModal(mod)}
                    title="Edit Module Name"
                  >
                    <Edit className="w-4 h-4 text-muted-foreground" />
                  </Button>
                  <Button
                    variant="ghost"
                    size="icon"
                    onClick={() => handleDeleteModule(mod.id)}
                    title="Delete Module"
                    className="text-destructive hover:bg-destructive/10"
                  >
                    <Trash2 className="w-4 h-4" />
                  </Button>
                </div>
              </div>

              {/* Module Lessons Grid */}
              <div className="p-4 space-y-2">
                {mod.lessons.length === 0 ? (
                  <div className="p-8 text-center text-xs text-muted-foreground border border-dashed border-border rounded-lg bg-slate-50/50 dark:bg-slate-900/50">
                    No lessons in this module. Add your first lesson to start.
                  </div>
                ) : (
                  mod.lessons.map((les, lesIdx) => (
                    <div
                      key={les.id}
                      className="border border-border rounded-lg px-4 py-3 flex flex-col sm:flex-row sm:items-center justify-between gap-4 hover:bg-slate-50 dark:hover:bg-slate-900/40 transition-colors bg-card"
                    >
                      <div className="flex items-center gap-3">
                        {/* Drag indicator / content type icon */}
                        <div className="p-2 rounded bg-muted/60 shrink-0">
                          {getContentTypeIcon(les.content_type)}
                        </div>

                        <div>
                          <div className="flex items-center gap-2">
                            <span className="font-semibold text-sm text-foreground">
                              {lesIdx + 1}. {les.title}
                            </span>
                            {les.is_preview && (
                              <Badge className="text-[9px] px-1 py-0 bg-blue-100 dark:bg-blue-900 text-blue-800 dark:text-blue-200">
                                Preview
                              </Badge>
                            )}
                            <Badge variant="outline" className="text-[9px] uppercase font-mono px-1 py-0">
                              {les.content_type}
                            </Badge>
                          </div>
                          {les.description && (
                            <p className="text-muted-foreground text-xs mt-0.5 line-clamp-1">
                              {les.description}
                            </p>
                          )}
                        </div>
                      </div>

                      {/* Lesson Actions */}
                      <div className="flex items-center gap-1 self-end sm:self-center">
                        {/* Reorder Buttons */}
                        <Button
                          variant="ghost"
                          size="icon"
                          className="h-8 w-8"
                          disabled={lesIdx === 0 || isPending}
                          onClick={() => handleMoveLesson(mod.id, mod.lessons, lesIdx, "up")}
                          title="Move Lesson Up"
                        >
                          <ChevronUp className="w-3.5 h-3.5" />
                        </Button>
                        <Button
                          variant="ghost"
                          size="icon"
                          className="h-8 w-8"
                          disabled={lesIdx === mod.lessons.length - 1 || isPending}
                          onClick={() => handleMoveLesson(mod.id, mod.lessons, lesIdx, "down")}
                          title="Move Lesson Down"
                        >
                          <ChevronDown className="w-3.5 h-3.5" />
                        </Button>

                        <Button
                          variant="ghost"
                          size="icon"
                          className="h-8 w-8"
                          onClick={() => openLessonModal(mod.id, les)}
                          title="Edit Lesson"
                        >
                          <Edit className="w-3.5 h-3.5 text-muted-foreground" />
                        </Button>
                        <Button
                          variant="ghost"
                          size="icon"
                          className="h-8 w-8 text-destructive hover:bg-destructive/10"
                          onClick={() => handleDeleteLesson(les.id)}
                          title="Delete Lesson"
                        >
                          <Trash2 className="w-3.5 h-3.5" />
                        </Button>
                      </div>
                    </div>
                  ))
                )}

                {/* Add lesson button trigger */}
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={() => openLessonModal(mod.id)}
                  className="w-full border border-dashed border-border hover:border-solid text-muted-foreground hover:text-foreground mt-2 flex items-center justify-center gap-1.5 h-10 rounded-lg text-xs"
                >
                  <Plus className="w-4 h-4" />
                  Add Lesson
                </Button>
              </div>
            </div>
          ))
        )}
      </div>

      {/* ── MODULE CREATION MODAL ─────────────────────────────── */}
      <Dialog open={moduleModalOpen} onOpenChange={setModuleModalOpen}>
        <DialogContent className="max-w-md">
          <form onSubmit={handleModuleSubmit}>
            <DialogHeader>
              <DialogTitle>
                {activeModule ? "Edit Module Settings" : "Create New Module"}
              </DialogTitle>
              <DialogDescription>
                Define the module container details.
              </DialogDescription>
            </DialogHeader>

            <div className="space-y-4 py-4">
              <div className="space-y-1.5">
                <Label htmlFor="mod-title">Module Title *</Label>
                <Input
                  id="mod-title"
                  type="text"
                  placeholder="e.g. Welcome & Onboarding"
                  value={moduleTitle}
                  onChange={(e) => setModuleTitle(e.target.value)}
                  disabled={isPending}
                  required
                />
              </div>

              <div className="space-y-1.5">
                <Label htmlFor="mod-desc">Description</Label>
                <Textarea
                  id="mod-desc"
                  placeholder="Briefly summarize what this module covers..."
                  value={moduleDesc}
                  onChange={(e) => setModuleDesc(e.target.value)}
                  disabled={isPending}
                />
              </div>
            </div>

            <DialogFooter>
              <Button
                type="button"
                variant="outline"
                onClick={() => setModuleModalOpen(false)}
                disabled={isPending}
              >
                Cancel
              </Button>
              <Button type="submit" disabled={isPending || !moduleTitle.trim()}>
                {isPending && <Loader2 className="w-4 h-4 mr-2 animate-spin" />}
                {activeModule ? "Save Changes" : "Create Module"}
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>

      {/* ── LESSON CREATION / EDITING MODAL ───────────────────── */}
      <Dialog open={lessonModalOpen} onOpenChange={setLessonModalOpen}>
        <DialogContent className="max-w-lg overflow-y-auto max-h-[85vh]">
          <form onSubmit={handleLessonSubmit}>
            <DialogHeader>
              <DialogTitle>
                {activeLesson ? "Edit Lesson Details" : "Create New Lesson"}
              </DialogTitle>
              <DialogDescription>
                Define content parameters, lesson preview options, and upload file attachments.
              </DialogDescription>
            </DialogHeader>

            <div className="space-y-4 py-4 text-left">
              {/* Title */}
              <div className="space-y-1.5">
                <Label htmlFor="les-title">Lesson Title *</Label>
                <Input
                  id="les-title"
                  type="text"
                  placeholder="e.g. Course Introduction"
                  value={lessonTitle}
                  onChange={(e) => setLessonTitle(e.target.value)}
                  disabled={isPending}
                  required
                />
              </div>

              {/* Description */}
              <div className="space-y-1.5">
                <Label htmlFor="les-desc">Description</Label>
                <Textarea
                  id="les-desc"
                  placeholder="Summarize the core takeaways of this lesson..."
                  value={lessonDesc}
                  onChange={(e) => setLessonDesc(e.target.value)}
                  disabled={isPending}
                />
              </div>

              {/* Content Type */}
              <div className="space-y-1.5">
                <Label htmlFor="les-type">Content Type</Label>
                <Select
                  value={lessonType}
                  onValueChange={(val: any) => setLessonType(val)}
                  disabled={isPending}
                >
                  <SelectTrigger id="les-type" className="w-full">
                    <SelectValue placeholder="Select content type" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="text">Rich Text / HTML Editor</SelectItem>
                    <SelectItem value="pdf">PDF Attachment</SelectItem>
                    <SelectItem value="video">MP4 Video Player</SelectItem>
                    <SelectItem value="link">External Web URL</SelectItem>
                    <SelectItem value="image">JPG/PNG/WebP Image</SelectItem>
                    <SelectItem value="file">Generic Zip/Doc Attachment</SelectItem>
                  </SelectContent>
                </Select>
              </div>

              {/* Preview Status toggle */}
              <div className="flex items-center justify-between border border-border rounded-lg p-3 bg-slate-50/50 dark:bg-slate-900/50">
                <div className="space-y-0.5">
                  <Label htmlFor="les-preview" className="text-sm font-semibold">
                    Free Preview Access
                  </Label>
                  <p className="text-[10px] text-muted-foreground">
                    Allow guest visitors to access this lesson without a token.
                  </p>
                </div>
                <Switch
                  id="les-preview"
                  checked={isPreview}
                  onCheckedChange={setIsPreview}
                  disabled={isPending}
                />
              </div>

              {/* ── DYNAMIC CONFIG BASED ON TYPE ─────────────────── */}

              {/* Rich text / raw HTML editor */}
              {lessonType === "text" && (
                <div className="space-y-1.5">
                  <Label htmlFor="les-content">Lesson HTML Content</Label>
                  <Textarea
                    id="les-content"
                    placeholder="<h2>Header</h2><p>Write your lesson content body here in rich HTML markup...</p>"
                    rows={6}
                    value={lessonContent}
                    onChange={(e) => setLessonContent(e.target.value)}
                    disabled={isPending}
                  />
                  <span className="block text-[10px] text-muted-foreground font-mono">
                    HTML syntax supported.
                  </span>
                </div>
              )}

              {/* Link type */}
              {lessonType === "link" && (
                <div className="space-y-1.5">
                  <Label htmlFor="les-link">External URL Address</Label>
                  <Input
                    id="les-link"
                    type="url"
                    placeholder="https://t.me/example-channel"
                    value={lessonContent}
                    onChange={(e) => setLessonContent(e.target.value)}
                    disabled={isPending}
                    required
                  />
                </div>
              )}

              {/* Media File Uploads (pdf, video, image, file) */}
              {["pdf", "video", "image", "file"].includes(lessonType) && (
                <div className="space-y-2 border border-dashed border-border rounded-lg p-5 text-center bg-slate-50/30 dark:bg-slate-900/10">
                  <div className="mx-auto w-10 h-10 rounded-full bg-muted flex items-center justify-center mb-3">
                    <Upload className="w-5 h-5 text-muted-foreground" />
                  </div>
                  <Label
                    htmlFor="les-file"
                    className="cursor-pointer font-semibold text-xs text-primary hover:underline block"
                  >
                    Select File to Upload
                  </Label>
                  <input
                    id="les-file"
                    type="file"
                    accept={
                      lessonType === "pdf"
                        ? "application/pdf"
                        : lessonType === "image"
                        ? "image/*"
                        : lessonType === "video"
                        ? "video/*"
                        : "*"
                    }
                    onChange={(e) => {
                      if (e.target.files && e.target.files.length > 0) {
                        setSelectedFile(e.target.files[0]);
                      }
                    }}
                    className="hidden"
                    disabled={isPending}
                  />
                  {selectedFile ? (
                    <div className="text-xs text-foreground font-bold mt-2 truncate bg-muted px-2 py-1 rounded">
                      Selected: {selectedFile.name} ({(selectedFile.size / (1024 * 1024)).toFixed(2)} MB)
                    </div>
                  ) : activeLesson?.storage_path ? (
                    <div className="text-[10px] text-muted-foreground mt-2 truncate">
                      Current file: {activeLesson.storage_path.split("/").pop()}
                    </div>
                  ) : (
                    <span className="text-[10px] text-muted-foreground block mt-1">
                      PDF, MP4, JPEG, PNG, or ZIP. Max file limit 500MB.
                    </span>
                  )}

                  {/* For video, we also support an external streaming video URL instead of file upload */}
                  {lessonType === "video" && (
                    <div className="space-y-1.5 text-left border-t border-border pt-4 mt-4">
                      <Label htmlFor="les-video-url">Or Stream Video URL</Label>
                      <Input
                        id="les-video-url"
                        type="url"
                        placeholder="https://example.com/streaming-file.mp4"
                        value={lessonContent}
                        onChange={(e) => setLessonContent(e.target.value)}
                        disabled={isPending}
                      />
                      <span className="block text-[9px] text-muted-foreground">
                        Use this option to link external hosting (Vimeo, Bunny, S3) instead of local upload.
                      </span>
                    </div>
                  )}
                </div>
              )}
            </div>

            <DialogFooter>
              <Button
                type="button"
                variant="outline"
                onClick={() => setLessonModalOpen(false)}
                disabled={isPending}
              >
                Cancel
              </Button>
              <Button type="submit" disabled={isPending || !lessonTitle.trim()}>
                {isPending && <Loader2 className="w-4 h-4 mr-2 animate-spin" />}
                {activeLesson ? "Save Changes" : "Create Lesson"}
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>
    </div>
  );
}
