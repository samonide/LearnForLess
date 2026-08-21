"use client";

import {
    deleteLesson,
    reorderLessons,
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
import LessonEditor from "@/components/lesson-editor";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import type { Lesson, Module } from "@/types";
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
    Video,
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

  // Lesson editor (full-page workspace, replaces lesson modal)
  const [editorState, setEditorState] = useState<{
    module: ModuleWithLessons;
    lesson: Lesson | null;
    moduleIndex: number;
  } | null>(null);

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

  function openLessonEditor(module: ModuleWithLessons, lesson: Lesson | null = null) {
    setEditorState({
      module,
      lesson,
      moduleIndex: initialModules.findIndex((m) => m.id === module.id) + 1,
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
        return <FileText className="w-4 h-4 text-muted-foreground" />;
      case "video":
        return <Video className="w-4 h-4 text-muted-foreground" />;
      case "link":
        return <Link2 className="w-4 h-4 text-muted-foreground" />;
      case "image":
        return <ImageIcon className="w-4 h-4 text-muted-foreground" />;
      case "file":
        return <File className="w-4 h-4 text-muted-foreground" />;
      default:
        return <FileText className="w-4 h-4 text-muted-foreground" />;
    }
  }

  return (
    <div className="space-y-6">
      {/* Lesson editor workspace — full page, replaces the old modal */}
      {editorState && (
        <LessonEditor
          key={
            editorState.lesson
              ? `lesson-${editorState.lesson.id}`
              : `new-${editorState.module.id}`
          }
          courseId={courseId}
          moduleId={editorState.module.id}
          moduleTitle={editorState.module.title}
          moduleIndex={editorState.moduleIndex}
          lesson={editorState.lesson}
          onDone={() => {
            setEditorState(null);
            router.refresh();
          }}
          onDeleted={() => {
            setEditorState(null);
            router.refresh();
          }}
        />
      )}

      {!editorState && (
        <>
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
            <h3 className="font-semibold text-lg">No modules added yet</h3>
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
              className="border border-border bg-card rounded-xl overflow-hidden"
            >
              {/* Module Header Bar */}
              <div className="bg-muted border-b border-border px-6 py-4 flex flex-col sm:flex-row sm:items-center justify-between gap-4">
                <div className="space-y-1">
                  <div className="flex items-center gap-2">
                    <span className="font-mono text-xs text-muted-foreground font-semibold uppercase">
                      Module {modIdx + 1}
                    </span>
                    <Badge variant="outline" className="text-[10px]">
                      {mod.lessons.length} lessons
                    </Badge>
                  </div>
                  <h3 className="font-semibold text-base text-foreground leading-tight">
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
                  <div className="p-8 text-center text-xs text-muted-foreground border border-dashed border-border rounded-lg bg-muted/40">
                    No lessons in this module. Add your first lesson to start.
                  </div>
                ) : (
                  mod.lessons.map((les, lesIdx) => (
                    <div
                      key={les.id}
                      className="border border-border rounded-lg px-4 py-3 flex flex-col sm:flex-row sm:items-center justify-between gap-4 hover:bg-accent transition-colors bg-card"
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
                              <Badge className="text-[9px] px-1 py-0 bg-primary/10 text-primary">
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
                          onClick={() => openLessonEditor(mod, les)}
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
                  onClick={() => openLessonEditor(mod)}
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
        </>
      )}
    </div>
  );
}
