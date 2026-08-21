"use client";

import {
    createLesson,
    deleteLesson,
    updateLesson
} from "@/actions/admin/lessons";
import {
    createModule,
    deleteModule,
    reorderModules,
    updateModule,
} from "@/actions/admin/modules";
import {
    AlertDialog,
    AlertDialogAction,
    AlertDialogCancel,
    AlertDialogContent,
    AlertDialogDescription,
    AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { Button } from "@/components/ui/button";
import {
    Dialog,
    DialogContent,
    DialogHeader,
    DialogTitle
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import type { Lesson, Module } from "@/types";
import {
    closestCenter,
    DndContext,
    DragEndEvent,
    PointerSensor,
    useSensor,
    useSensors
} from "@dnd-kit/core";
import {
    SortableContext,
    useSortable,
    verticalListSortingStrategy,
} from "@dnd-kit/sortable";
import { CSS } from "@dnd-kit/utilities";
import {
    AlertTriangle,
    ChevronDown,
    ChevronUp,
    Edit2,
    GripVertical,
    Plus,
    Trash2
} from "lucide-react";
import { useState, useTransition } from "react";
import { toast } from "sonner";

interface CourseBuilderProps {
  courseId: string;
  initialModules: (Module & { lessons: Lesson[] })[];
}

interface ModuleWithLessons extends Module {
  lessons: Lesson[];
}

export default function CourseBuilder({
  courseId,
  initialModules,
}: CourseBuilderProps) {
  const [modules, setModules] = useState<ModuleWithLessons[]>(initialModules);
  const [isPending, startTransition] = useTransition();
  const [expandedModules, setExpandedModules] = useState<Set<string>>(
    new Set(modules.map((m) => m.id))
  );

  // Dialog states
  const [showModuleDialog, setShowModuleDialog] = useState(false);
  const [editingModule, setEditingModule] = useState<ModuleWithLessons | null>(null);
  const [moduleTitle, setModuleTitle] = useState("");
  const [moduleDesc, setModuleDesc] = useState("");

  const [showLessonDialog, setShowLessonDialog] = useState(false);
  const [editingLesson, setEditingLesson] = useState<Lesson | null>(null);
  const [selectedModuleId, setSelectedModuleId] = useState("");
  const [lessonTitle, setLessonTitle] = useState("");
  const [lessonDesc, setLessonDesc] = useState("");

  const [showDeleteAlert, setShowDeleteAlert] = useState(false);
  const [deleteTarget, setDeleteTarget] = useState<{
    type: "module" | "lesson";
    id: string;
  } | null>(null);

  const sensors = useSensors(
    useSensor(PointerSensor)
  );

  // ============================================================
  // MODULE CRUD ACTIONS
  // ============================================================

  function openModuleDialog(module?: ModuleWithLessons) {
    if (module) {
      setEditingModule(module);
      setModuleTitle(module.title);
      setModuleDesc(module.description || "");
    } else {
      setEditingModule(null);
      setModuleTitle("");
      setModuleDesc("");
    }
    setShowModuleDialog(true);
  }

  function handleSaveModule() {
    if (!moduleTitle.trim()) {
      toast.error("Please enter a module title.");
      return;
    }

    startTransition(async () => {
      if (editingModule) {
        // Update
        const res = await updateModule(editingModule.id, {
          title: moduleTitle.trim(),
          description: moduleDesc.trim() || undefined,
        });
        if (res.success) {
          toast.success("Module updated!");
          setModules((prev) =>
            prev.map((m) =>
              m.id === editingModule.id
                ? { ...m, title: moduleTitle, description: moduleDesc }
                : m
            )
          );
          setShowModuleDialog(false);
        } else {
          toast.error(res.error);
        }
      } else {
        // Create
        const res = await createModule({
          course_id: courseId,
          title: moduleTitle.trim(),
          description: moduleDesc.trim() || undefined,
        });
        if (!res.success) {
          toast.error(res.error);
          return;
        }

        toast.success("Module created!");
        setModules((prev) => [
          ...prev,
          {
            id: res.data.id,
            course_id: courseId,
            title: moduleTitle,
            description: moduleDesc,
            sort_order: prev.length + 1,
            created_at: new Date().toISOString(),
            updated_at: new Date().toISOString(),
            lessons: [],
          },
        ]);
        setShowModuleDialog(false);
      }
    });
  }

  // ============================================================
  // LESSON CRUD ACTIONS
  // ============================================================

  function openLessonDialog(moduleId: string, lesson?: Lesson) {
    setSelectedModuleId(moduleId);
    if (lesson) {
      setEditingLesson(lesson);
      setLessonTitle(lesson.title);
      setLessonDesc(lesson.description || "");
    } else {
      setEditingLesson(null);
      setLessonTitle("");
      setLessonDesc("");
    }
    setShowLessonDialog(true);
  }

  function handleSaveLesson() {
    if (!lessonTitle.trim()) {
      toast.error("Please enter a lesson title.");
      return;
    }

    startTransition(async () => {
      if (editingLesson) {
        // Update
        const res = await updateLesson({
          id: editingLesson.id,
          title: lessonTitle.trim(),
          description: lessonDesc.trim() || undefined,
        });
        if (res.success) {
          toast.success("Lesson updated!");
          setModules((prev) =>
            prev.map((m) =>
              m.id === selectedModuleId
                ? {
                    ...m,
                    lessons: m.lessons.map((l) =>
                      l.id === editingLesson.id
                        ? {
                            ...l,
                            title: lessonTitle,
                            description: lessonDesc,
                          }
                        : l
                    ),
                  }
                : m
            )
          );
          setShowLessonDialog(false);
        } else {
          toast.error(res.error);
        }
      } else {
        // Create
        const res = await createLesson({
          module_id: selectedModuleId,
          title: lessonTitle.trim(),
          description: lessonDesc.trim() || undefined,
          content_type: "text",
        });
        if (!res.success) {
          toast.error(res.error);
          return;
        }

        toast.success("Lesson created!");
        setModules((prev) =>
          prev.map((m) =>
            m.id === selectedModuleId
              ? {
                  ...m,
                  lessons: [
                    ...m.lessons,
                    {
                      id: res.data.id,
                      module_id: selectedModuleId,
                      title: lessonTitle,
                      description: lessonDesc,
                      content_type: "text",
                      content: null,
                      storage_path: null,
                      sort_order: m.lessons.length + 1,
                      is_preview: false,
                      source_fingerprint: null,
                      external_source: null,
                      external_key: null,
                      external_bh_url: null,
                      file_size: null,
                      source_stamped: null,
                      created_at: new Date().toISOString(),
                      updated_at: new Date().toISOString(),
                      progress: null,
                      lesson_number: 0,
                    },
                  ],
                }
              : m
          )
        );
        setShowLessonDialog(false);
      }
    });
  }

  function handleDelete(type: "module" | "lesson", id: string) {
    setDeleteTarget({ type, id });
    setShowDeleteAlert(true);
  }

  function confirmDelete() {
    if (!deleteTarget) return;

    startTransition(async () => {
      const res =
        deleteTarget.type === "module"
          ? await deleteModule(deleteTarget.id)
          : await deleteLesson(deleteTarget.id);

      if (res.success) {
        toast.success(
          deleteTarget.type === "module"
            ? "Module deleted!"
            : "Lesson deleted!"
        );

        if (deleteTarget.type === "module") {
          setModules((prev) => prev.filter((m) => m.id !== deleteTarget.id));
        } else {
          setModules((prev) =>
            prev.map((m) => ({
              ...m,
              lessons: m.lessons.filter((l) => l.id !== deleteTarget.id),
            }))
          );
        }
        setShowDeleteAlert(false);
        setDeleteTarget(null);
      } else {
        toast.error(res.error);
      }
    });
  }

  const handleDragEnd = (event: DragEndEvent) => {
    const { active, over: overItem } = event;

    if (!overItem || active.id === overItem.id) return;

    // Determine if we're reordering modules or lessons
    if (active.id.toString().startsWith("module-")) {
      // Reorder modules
      const oldIdx = modules.findIndex(
        (m) => m.id === active.id.toString().replace("module-", "")
      );
      const newIdx = modules.findIndex(
        (m) => m.id === overItem.id.toString().replace("module-", "")
      );

      if (oldIdx === -1 || newIdx === -1) return;

      const reordered = [...modules];
      const [moved] = reordered.splice(oldIdx, 1);
      reordered.splice(newIdx, 0, moved);

      setModules(reordered);

      startTransition(async () => {
        const res = await reorderModules(
          courseId,
          reordered.map((m) => m.id)
        );
        if (!res.success) {
          toast.error(res.error);
          setModules(modules); // Revert
        }
      });
    }
  };

  function toggleModule(moduleId: string) {
    const updated = new Set(expandedModules);
    if (updated.has(moduleId)) {
      updated.delete(moduleId);
    } else {
      updated.add(moduleId);
    }
    setExpandedModules(updated);
  }

  return (
    <div className="space-y-4">
      {/* Add Module Button */}
      <Button onClick={() => openModuleDialog()} className="flex items-center gap-2">
        <Plus className="w-4 h-4" />
        Add Module
      </Button>

      {/* Modules List */}
      <DndContext
        sensors={sensors}
        collisionDetection={closestCenter}
        onDragEnd={handleDragEnd}
      >
        <SortableContext
          items={modules.map((m) => `module-${m.id}`)}
          strategy={verticalListSortingStrategy}
        >
          <div className="space-y-3">
            {modules.length === 0 ? (
              <div className="border border-dashed border-border rounded-xl p-8 text-center text-muted-foreground bg-card">
                <p>No modules yet. Create one to get started.</p>
              </div>
            ) : (
              modules.map((module) => (
                <ModuleCard
                  key={module.id}
                  module={module}
                  isExpanded={expandedModules.has(module.id)}
                  onToggle={() => toggleModule(module.id)}
                  onEditModule={() => openModuleDialog(module)}
                  onDeleteModule={() => handleDelete("module", module.id)}
                  onEditLesson={(lesson) => openLessonDialog(module.id, lesson)}
                  onAddLesson={() => openLessonDialog(module.id)}
                  onDeleteLesson={(lessonId) => handleDelete("lesson", lessonId)}
                  isPending={isPending}
                />
              ))
            )}
          </div>
        </SortableContext>
      </DndContext>

      {/* Module Dialog */}
      <Dialog open={showModuleDialog} onOpenChange={setShowModuleDialog}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>
              {editingModule ? "Edit Module" : "Create New Module"}
            </DialogTitle>
          </DialogHeader>

          <div className="space-y-4">
            <div className="space-y-1.5">
              <Label>Module Title *</Label>
              <Input
                placeholder="e.g., Getting Started"
                value={moduleTitle}
                onChange={(e) => setModuleTitle(e.target.value)}
                disabled={isPending}
              />
            </div>

            <div className="space-y-1.5">
              <Label>Description</Label>
              <Textarea
                placeholder="Optional description..."
                rows={3}
                value={moduleDesc}
                onChange={(e) => setModuleDesc(e.target.value)}
                disabled={isPending}
              />
            </div>

            <div className="flex gap-3">
              <Button
                variant="outline"
                onClick={() => setShowModuleDialog(false)}
                disabled={isPending}
              >
                Cancel
              </Button>
              <Button onClick={handleSaveModule} disabled={isPending}>
                {isPending ? "Saving..." : "Save Module"}
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>

      {/* Lesson Dialog */}
      <Dialog open={showLessonDialog} onOpenChange={setShowLessonDialog}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>
              {editingLesson ? "Edit Lesson" : "Create New Lesson"}
            </DialogTitle>
          </DialogHeader>

          <div className="space-y-4">
            <div className="space-y-1.5">
              <Label>Lesson Title *</Label>
              <Input
                placeholder="e.g., Introduction to Concepts"
                value={lessonTitle}
                onChange={(e) => setLessonTitle(e.target.value)}
                disabled={isPending}
              />
            </div>

            <div className="space-y-1.5">
              <Label>Description</Label>
              <Textarea
                placeholder="Optional lesson description..."
                rows={3}
                value={lessonDesc}
                onChange={(e) => setLessonDesc(e.target.value)}
                disabled={isPending}
              />
            </div>

            <div className="text-sm text-muted-foreground bg-muted/30 p-3 rounded">
              <p>
                Content can be edited in the lesson editor after creation. Edit a lesson to add rich text, PDF, video, or file attachments.
              </p>
            </div>

            <div className="flex gap-3">
              <Button
                variant="outline"
                onClick={() => setShowLessonDialog(false)}
                disabled={isPending}
              >
                Cancel
              </Button>
              <Button onClick={handleSaveLesson} disabled={isPending}>
                {isPending ? "Saving..." : "Save Lesson"}
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>

      {/* Delete Confirmation Alert */}
      <AlertDialog open={showDeleteAlert} onOpenChange={setShowDeleteAlert}>
        <AlertDialogContent>
          <AlertDialogTitle className="flex items-center gap-2">
            <AlertTriangle className="w-5 h-5 text-destructive" />
            Confirm Deletion
          </AlertDialogTitle>
          <AlertDialogDescription>
            {deleteTarget?.type === "module"
              ? "Are you sure you want to delete this module and all its lessons? This action cannot be undone."
              : "Are you sure you want to delete this lesson? This action cannot be undone."}
          </AlertDialogDescription>
          <div className="flex gap-3">
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction
              onClick={confirmDelete}
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
            >
              {isPending ? "Deleting..." : "Delete"}
            </AlertDialogAction>
          </div>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}

// ============================================================
// MODULE CARD COMPONENT (Draggable)
// ============================================================

interface ModuleCardProps {
  module: ModuleWithLessons;
  isExpanded: boolean;
  onToggle: () => void;
  onEditModule: () => void;
  onDeleteModule: () => void;
  onEditLesson: (lesson: Lesson) => void;
  onAddLesson: () => void;
  onDeleteLesson: (lessonId: string) => void;
  isPending: boolean;
}

function ModuleCard({
  module,
  isExpanded,
  onToggle,
  onEditModule,
  onDeleteModule,
  onEditLesson,
  onAddLesson,
  onDeleteLesson,
  isPending,
}: ModuleCardProps) {
  const { setNodeRef, transform, transition, isDragging } = useSortable({
    id: `module-${module.id}`,
  });

  const style = {
    transform: CSS.Transform.toString(transform),
    transition,
    opacity: isDragging ? 0.5 : 1,
  };

  return (
    <div
      ref={setNodeRef}
      style={style}
      className="border border-border rounded-lg bg-card overflow-hidden shadow-sm"
    >
      {/* Module Header */}
      <div className="flex items-center justify-between p-4 bg-muted/30 hover:bg-muted/50 transition-colors">
        <div className="flex items-center gap-3 flex-1">
          <GripVertical className="w-5 h-5 text-muted-foreground cursor-grab" />
          <button
            onClick={onToggle}
            className="flex items-center gap-2 flex-1 text-left"
          >
            {isExpanded ? (
              <ChevronUp className="w-4 h-4 text-muted-foreground" />
            ) : (
              <ChevronDown className="w-4 h-4 text-muted-foreground" />
            )}
            <div>
              <div className="font-semibold text-foreground">{module.title}</div>
              {module.description && (
                <div className="text-xs text-muted-foreground">{module.description}</div>
              )}
            </div>
          </button>
          <span className="text-xs bg-primary/10 text-primary px-2.5 py-1 rounded font-medium ml-auto">
            {module.lessons.length} lessons
          </span>
        </div>

        {/* Actions */}
        <div className="flex items-center gap-2 ml-2">
          <Button
            size="sm"
            variant="ghost"
            onClick={onEditModule}
            disabled={isPending}
          >
            <Edit2 className="w-4 h-4" />
          </Button>
          <Button
            size="sm"
            variant="ghost"
            onClick={onDeleteModule}
            disabled={isPending}
            className="text-destructive hover:text-destructive"
          >
            <Trash2 className="w-4 h-4" />
          </Button>
        </div>
      </div>

      {/* Lessons List (Expandable) */}
      {isExpanded && (
        <div className="border-t border-border p-4 space-y-2 bg-background/50">
          {module.lessons.length === 0 ? (
            <div className="text-center text-sm text-muted-foreground py-6">
              No lessons yet.
            </div>
          ) : (
            <div className="space-y-2">
              {module.lessons.map((lesson) => (
                <div
                  key={lesson.id}
                  className="flex items-center justify-between p-3 rounded-lg bg-card border border-border hover:border-muted-foreground transition-colors"
                >
                  <div>
                    <div className="font-medium text-sm text-foreground">
                      {lesson.title}
                    </div>
                    {lesson.description && (
                      <div className="text-xs text-muted-foreground">
                        {lesson.description}
                      </div>
                    )}
                  </div>

                  <div className="flex items-center gap-2">
                    <Button
                      size="sm"
                      variant="ghost"
                      onClick={() => onEditLesson(lesson)}
                      disabled={isPending}
                    >
                      <Edit2 className="w-4 h-4" />
                    </Button>
                    <Button
                      size="sm"
                      variant="ghost"
                      onClick={() => onDeleteLesson(lesson.id)}
                      disabled={isPending}
                      className="text-destructive hover:text-destructive"
                    >
                      <Trash2 className="w-4 h-4" />
                    </Button>
                  </div>
                </div>
              ))}
            </div>
          )}

          {/* Add Lesson Button */}
          <Button
            variant="outline"
            size="sm"
            onClick={onAddLesson}
            disabled={isPending}
            className="w-full flex items-center gap-2"
          >
            <Plus className="w-4 h-4" />
            Add Lesson
          </Button>
        </div>
      )}
    </div>
  );
}
