"use client";

import {
    createLesson,
    getAdminSignedUrl,
    updateLesson,
    uploadLessonFile,
} from "@/actions/admin/lessons";
import {
    AlertDialog,
    AlertDialogAction,
    AlertDialogCancel,
    AlertDialogContent,
    AlertDialogDescription,
    AlertDialogFooter,
    AlertDialogHeader,
    AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Separator } from "@/components/ui/separator";
import { Switch } from "@/components/ui/switch";
import { Textarea } from "@/components/ui/textarea";
import { formatFileSize } from "@/lib/utils";
import type { ContentType, Lesson } from "@/types";
import { EditorContent, useEditor } from "@tiptap/react";
import StarterKit from "@tiptap/starter-kit";
import {
    Bold,
    Check,
    ChevronLeft,
    ExternalLink,
    File,
    FileText,
    Image as ImageIcon,
    Italic,
    Link2,
    Loader2,
    List,
    ListOrdered,
    Quote,
    Redo2,
    Strikethrough,
    Trash2,
    Undo2,
    Video,
} from "lucide-react";
import { useEffect, useMemo, useRef, useState, useTransition } from "react";
import { toast } from "sonner";
import { deleteLesson as deleteLessonAction } from "@/actions/admin/lessons";

type FileEntry = { name: string; size: number };

interface LessonEditorProps {
  courseId: string;
  moduleId: string;
  moduleTitle: string;
  moduleIndex: number;
  lesson: Lesson | null;
  onDone: () => void;
  onDeleted: () => void;
}

const CONTENT_TYPES: Array<{ value: ContentType; label: string; hint: string }> = [
  { value: "text", label: "Text", hint: "Write or paste rich content" },
  { value: "pdf", label: "PDF", hint: "Upload a PDF document" },
  { value: "video", label: "Video", hint: "Upload a video file" },
  { value: "image", label: "Image", hint: "Upload an image" },
  { value: "link", label: "Link", hint: "Add an external URL" },
  { value: "file", label: "File", hint: "Upload any other file" },
];

function contentTypeLabel(type: ContentType): string {
  return CONTENT_TYPES.find((t) => t.value === type)?.label ?? type;
}

function contentTypeIcon(type: ContentType, className: string) {
  switch (type) {
    case "pdf":
      return <FileText className={className} />;
    case "video":
      return <Video className={className} />;
    case "image":
      return <ImageIcon className={className} />;
    case "link":
      return <Link2 className={className} />;
    default:
      return <File className={className} />;
  }
}

export default function LessonEditor({
  courseId,
  moduleId,
  moduleTitle,
  moduleIndex,
  lesson,
  onDone,
  onDeleted,
}: LessonEditorProps) {
  const isEdit = !!lesson;
  const [isPending, startTransition] = useTransition();
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [uploadProgress, setUploadProgress] = useState<number | null>(null);

  // ── Form state ─────────────────────────────────────────────
  const [title, setTitle] = useState(lesson?.title ?? "");
  const [description, setDescription] = useState(lesson?.description ?? "");
  const [contentType, setContentType] = useState<ContentType>(lesson?.content_type ?? "text");
  const [initialContentType] = useState<ContentType>(lesson?.content_type ?? "text");
  const [textContent, setTextContent] = useState(lesson?.content ?? "");
  const [sourceMode, setSourceMode] = useState(false);
  const [linkUrl, setLinkUrl] = useState(
    lesson?.content_type === "link" ? (lesson?.content ?? "") : ""
  );
  const [isPreview, setIsPreview] = useState(lesson?.is_preview ?? false);
  const [fileEntry, setFileEntry] = useState<FileEntry | null>(() =>
    lesson?.storage_path
      ? { name: lesson.storage_path.split("/").pop() ?? "file", size: 0 }
      : null
  );
  // True once the admin removed a previously-stored file (M6)
  const [removedStoredFile, setRemovedStoredFile] = useState(false);
  const [previewUrl, setPreviewUrl] = useState<string | null>(null);
  const [deleteOpen, setDeleteOpen] = useState(false);

  // ── Tiptap rich text editor ────────────────────────────────
  const editor = useEditor({
    extensions: [StarterKit],
    content: lesson?.content_type === "text" ? (lesson.content ?? "") : "",
    immediatelyRender: false,
    onUpdate: ({ editor: e }) => setTextContent(e.getHTML()),
  });

  useEffect(() => {
    if (isEdit && lesson?.content_type === "text" && editor) {
      editor.commands.setContent(lesson.content ?? "", { emitUpdate: false });
    }
  }, [isEdit, lesson?.content_type, lesson?.content, editor]);

  useEffect(() => {
    if (lesson?.storage_path) {
      getAdminSignedUrl(lesson.storage_path).then((res) => {
        if (res.success) setPreviewUrl(res.data.url);
      });
    }
  }, [lesson?.storage_path]);

  const isMediaType = useMemo(
    () => ["pdf", "video", "image", "file"].includes(contentType),
    [contentType]
  );

  const hasStoredFile = !!lesson?.storage_path;
  const hasExternalSource =
    !!lesson?.external_key || !!lesson?.external_bh_url || !!lesson?.content;

  // A media lesson is saveable when a new file is chosen, or the
  // existing source (stored file / imported content) is still intact (M5).
  function hasMediaSource(): boolean {
    if (fileInputRef.current?.files?.[0]) return true;
    return isEdit && !removedStoredFile && (hasStoredFile || hasExternalSource);
  }

  // ── File helpers ───────────────────────────────────────────
  function handleFileSelect(file: File | null) {
    if (!file) return;
    setFileEntry({ name: file.name, size: file.size });
    setPreviewUrl(URL.createObjectURL(file));
    setUploadProgress(null);
  }

  function handleRemoveFile() {
    setFileEntry(null);
    setPreviewUrl(null);
    setUploadProgress(null);
    if (lesson?.storage_path) setRemovedStoredFile(true);
    if (fileInputRef.current) fileInputRef.current.value = "";
  }

  // Clear any chosen-but-unsaved file when switching content type —
  // a video selected for what becomes a PDF lesson must not persist (M6).
  function handleTypeChange(next: ContentType) {
    if (next === contentType) return;
    if (fileInputRef.current) fileInputRef.current.value = "";
    setFileEntry(null);
    setPreviewUrl(null);
    setUploadProgress(null);
    setContentType(next);
  }

  // ── Validation ─────────────────────────────────────────────
  function validate(): string | null {
    if (!title.trim()) return "Please enter a lesson title.";
    if (contentType === "link") {
      const value = linkUrl.trim();
      if (!value) return "Please enter a link URL.";
      try {
        new URL(value);
      } catch {
        return "That link doesn't look like a valid URL.";
      }
    }
    if (isMediaType && !hasMediaSource()) {
      return `Please choose a ${contentTypeLabel(contentType).toLowerCase()} file for this lesson.`;
    }
    return null;
  }

  // ── Submit (create or edit) ────────────────────────────────
  function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    const error = validate();
    if (error) {
      toast.error(error);
      return;
    }

    startTransition(async () => {
      const courseIdOfLesson = courseId;
      let lessonId = lesson?.id ?? "";

      if (isEdit) {
        const typeChanged = contentType !== initialContentType;
        const newFileChosen = !!fileInputRef.current?.files?.[0];

        // Content handling:
        // - text/link lessons always write their editor value;
        // - media lessons that KEPT their type preserve existing
        //   content (imported stream URLs live here — H6);
        // - a type switch drops the old type's content (M6).
        let contentValue: string | null | undefined;
        if (contentType === "text") contentValue = textContent;
        else if (contentType === "link") contentValue = linkUrl.trim();
        else if (typeChanged) contentValue = null;

        // Clear a stale stored file unless a replacement upload follows
        // in this same save (M6). The server deletes the orphan object.
        const clearStoredFile =
          hasStoredFile && !newFileChosen && (removedStoredFile || typeChanged);

        const res = await updateLesson({
          id: lesson!.id,
          title,
          description,
          content_type: contentType,
          ...(contentValue !== undefined ? { content: contentValue } : {}),
          is_preview: isPreview,
          ...(clearStoredFile ? { storage_path: null as string | null } : {}),
        });
        if (!res.success) {
          toast.error(res.error);
          return;
        }
        lessonId = lesson!.id;
      } else {
        const res = await createLesson({
          module_id: moduleId,
          title,
          description,
          content_type: contentType,
          content:
            contentType === "text"
              ? textContent || undefined
              : contentType === "link"
                ? linkUrl.trim() || undefined
                : undefined,
          is_preview: isPreview,
        });
        if (!res.success) {
          toast.error(res.error);
          return;
        }
        lessonId = res.data.id;
      }

      // Upload file if a new one was selected for media types
      if (fileInputRef.current?.files?.[0]) {
        const formData = new FormData();
        formData.append("file", fileInputRef.current.files[0]);
        setUploadProgress(0);
        const fakeTimer = setInterval(() => {
          setUploadProgress((p) => {
            if (p === null || p >= 90) return p;
            return p + 10;
          });
        }, 300);

        try {
          const uploadRes = await uploadLessonFile(
            courseIdOfLesson,
            moduleId,
            lessonId,
            formData
          );
          clearInterval(fakeTimer);
          if (!uploadRes.success) {
            setUploadProgress(null);
            toast.error(`Lesson saved, but upload failed: ${uploadRes.error}`);
            onDone();
            return;
          }
          setUploadProgress(100);
          toast.success(isEdit ? "Lesson updated." : "Lesson created.");
          onDone();
          return;
        } catch {
          clearInterval(fakeTimer);
          setUploadProgress(null);
          toast.error("Lesson saved, but upload failed unexpectedly.");
          onDone();
          return;
        }
      }

      toast.success(isEdit ? "Lesson updated." : "Lesson created.");
      onDone();
    });
  }

  // ── Delete ─────────────────────────────────────────────────
  function handleDelete() {
    startTransition(async () => {
      const res = await deleteLessonAction(lesson!.id);
      if (res.success) {
        toast.success("Lesson deleted.");
        onDeleted();
      } else {
        toast.error(res.error);
      }
    });
  }

  // ── Toolbar button helper ──────────────────────────────────
  const ToolbarBtn = ({
    label,
    onClick,
    active,
    disabled,
    children,
  }: {
    label: string;
    onClick: () => void;
    active?: boolean;
    disabled?: boolean;
    children: React.ReactNode;
  }) => (
    <button
      type="button"
      title={label}
      aria-label={label}
      onClick={onClick}
      disabled={disabled}
      className={
        "inline-flex h-7 w-7 items-center justify-center rounded-md transition-colors disabled:opacity-40 " +
        (active
          ? "bg-muted text-foreground"
          : "text-muted-foreground hover:bg-muted hover:text-foreground")
      }
    >
      {children}
    </button>
  );

  return (
    <form
      onSubmit={handleSubmit}
      className="mx-auto w-full max-w-4xl px-4 pb-16 pt-2 sm:px-6"
    >
      {/* Header */}
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="flex items-center gap-3">
          <Button
            type="button"
            variant="ghost"
            size="icon"
            onClick={onDone}
            title="Back to lessons"
          >
            <ChevronLeft className="w-4 h-4" />
          </Button>
          <div className="space-y-0.5">
            <h2 className="text-lg font-semibold tracking-tight text-foreground">
              {isEdit ? "Edit Lesson" : "New Lesson"}
            </h2>
            <p className="text-xs text-muted-foreground">
              Module {moduleIndex} · {moduleTitle}
            </p>
          </div>
        </div>

        <div className="flex items-center gap-2">
          {isEdit && (
            <Button
              type="button"
              variant="ghost"
              size="sm"
              className="text-destructive hover:bg-destructive/10"
              onClick={() => setDeleteOpen(true)}
            >
              <Trash2 className="w-3.5 h-3.5" />
              Delete
            </Button>
          )}
          <Button
            type="button"
            variant="outline"
            size="sm"
            onClick={onDone}
            disabled={isPending}
          >
            Cancel
          </Button>
          <Button type="submit" size="sm" disabled={isPending}>
            {isPending ? (
              <>
                <Loader2 className="w-3.5 h-3.5 animate-spin" />
                Saving…
              </>
            ) : isEdit ? (
              "Save Changes"
            ) : (
              "Create Lesson"
            )}
          </Button>
        </div>
      </div>

      <Separator className="my-6" />

      {/* Lesson details */}
      <section className="space-y-5">
        <div className="space-y-1.5">
          <Label htmlFor="lesson-title">Lesson Title *</Label>
          <Input
            id="lesson-title"
            type="text"
            placeholder="e.g. Welcome & Course Overview"
            value={title}
            onChange={(e) => setTitle(e.target.value)}
            disabled={isPending}
            autoFocus
            required
          />
        </div>

        <div className="space-y-1.5">
          <Label htmlFor="lesson-description">Description</Label>
          <Textarea
            id="lesson-description"
            placeholder="Optional. Brief summary students see before opening the lesson."
            rows={2}
            value={description}
            onChange={(e) => setDescription(e.target.value)}
            disabled={isPending}
          />
        </div>

        <div className="flex items-center justify-between gap-4 rounded-lg border border-border bg-card px-4 py-3">
          <div className="space-y-0.5">
            <p className="text-sm font-medium text-foreground">
              Preview lesson
            </p>
            <p className="text-xs text-muted-foreground">
              Available to students who haven&apos;t enrolled yet.
            </p>
          </div>
          <Switch
            checked={isPreview}
            onCheckedChange={setIsPreview}
            disabled={isPending}
            aria-label="Preview lesson"
          />
        </div>
      </section>

      <Separator className="my-8" />

      {/* Content type */}
      <section className="space-y-4">
        <div className="space-y-1">
          <Label>Content Type</Label>
          <p className="text-xs text-muted-foreground">
            Choose what this lesson contains. Changing the type after saving
            keeps your title, description, and preview setting.
          </p>
        </div>

        <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-6">
          {CONTENT_TYPES.map((t) => {
            const selected = contentType === t.value;
            return (
              <button
                key={t.value}
                type="button"
                onClick={() => handleTypeChange(t.value)}
                disabled={isPending}
                className={
                  "relative flex flex-col items-start gap-2 rounded-lg border p-3 text-left transition-colors disabled:opacity-50 " +
                  (selected
                    ? "border-primary bg-primary/5 ring-1 ring-primary"
                    : "border-border bg-card hover:bg-accent")
                }
              >
                <span
                  className={
                    "text-muted-foreground " + (selected ? "text-primary" : "")
                  }
                >
                  {contentTypeIcon(t.value, "w-4 h-4")}
                </span>
                <span className="text-sm font-medium text-foreground">
                  {t.label}
                </span>
                <span className="text-[10px] leading-tight text-muted-foreground">
                  {t.hint}
                </span>
                {selected && (
                  <span className="absolute right-2 top-2">
                    <Check className="w-3.5 h-3.5 text-primary" />
                  </span>
                )}
              </button>
            );
          })}
        </div>
      </section>

      {/* Content editor */}
      <section className="mt-8 space-y-4">
        <div className="space-y-1">
          <Label>Content</Label>
          <p className="text-xs text-muted-foreground">
            {contentType === "text" &&
              "Format text with the toolbar. Students see this rendered inside the lesson."}
            {contentType === "link" &&
              "Students will be taken to this URL in a new tab."}
            {isMediaType &&
              "Upload a file — up to 500 MB. Replace an existing file by uploading a new one."}
          </p>
        </div>

        {contentType === "text" && (
          <div className="overflow-hidden rounded-lg border border-border bg-card">
            <div className="flex items-center justify-between gap-2 border-b border-border px-2 py-1.5">
              <div className="flex items-center gap-0.5">
                <ToolbarBtn
                  label="Bold"
                  active={editor?.isActive("bold")}
                  onClick={() => editor?.chain().focus().toggleBold().run()}
                >
                  <Bold className="w-3.5 h-3.5" />
                </ToolbarBtn>
                <ToolbarBtn
                  label="Italic"
                  active={editor?.isActive("italic")}
                  onClick={() => editor?.chain().focus().toggleItalic().run()}
                >
                  <Italic className="w-3.5 h-3.5" />
                </ToolbarBtn>
                <ToolbarBtn
                  label="Strikethrough"
                  active={editor?.isActive("strike")}
                  onClick={() => editor?.chain().focus().toggleStrike().run()}
                >
                  <Strikethrough className="w-3.5 h-3.5" />
                </ToolbarBtn>
                <span className="mx-1 h-4 w-px bg-border" />
                <ToolbarBtn
                  label="Bullet list"
                  active={editor?.isActive("bulletList")}
                  onClick={() => editor?.chain().focus().toggleBulletList().run()}
                >
                  <List className="w-3.5 h-3.5" />
                </ToolbarBtn>
                <ToolbarBtn
                  label="Numbered list"
                  active={editor?.isActive("orderedList")}
                  onClick={() => editor?.chain().focus().toggleOrderedList().run()}
                >
                  <ListOrdered className="w-3.5 h-3.5" />
                </ToolbarBtn>
                <ToolbarBtn
                  label="Blockquote"
                  active={editor?.isActive("blockquote")}
                  onClick={() => editor?.chain().focus().toggleBlockquote().run()}
                >
                  <Quote className="w-3.5 h-3.5" />
                </ToolbarBtn>
                <span className="mx-1 h-4 w-px bg-border" />
                <ToolbarBtn
                  label="Undo"
                  disabled={!editor?.can().undo()}
                  onClick={() => editor?.chain().focus().undo().run()}
                >
                  <Undo2 className="w-3.5 h-3.5" />
                </ToolbarBtn>
                <ToolbarBtn
                  label="Redo"
                  disabled={!editor?.can().redo()}
                  onClick={() => editor?.chain().focus().redo().run()}
                >
                  <Redo2 className="w-3.5 h-3.5" />
                </ToolbarBtn>
              </div>
              <Button
                type="button"
                variant="ghost"
                size="xs"
                onClick={() => {
                  if (sourceMode && editor) {
                    editor.commands.setContent(textContent, { emitUpdate: false });
                  }
                  setSourceMode(!sourceMode);
                }}
              >
                {sourceMode ? "Rich text" : "Source"}
              </Button>
            </div>

            {sourceMode ? (
              <Textarea
                aria-label="HTML source"
                value={textContent}
                onChange={(e) => setTextContent(e.target.value)}
                className="min-h-[320px] rounded-none border-0 font-mono text-sm focus-visible:ring-0"
              />
            ) : (
              <div className="px-4 py-3">
                <EditorContent
                  editor={editor}
                  className="min-h-[320px] text-foreground focus-visible:outline-none [&_.tiptap]:min-h-[320px] [&_.tiptap]:outline-none [&_.tiptap]:leading-relaxed"
                />
              </div>
            )}
          </div>
        )}

        {contentType === "link" && (
          <div className="space-y-1.5">
            <Label htmlFor="lesson-link">URL</Label>
            <Input
              id="lesson-link"
              type="url"
              placeholder="https://example.com/resource"
              value={linkUrl}
              onChange={(e) => setLinkUrl(e.target.value)}
              disabled={isPending}
            />
          </div>
        )}

        {isEdit &&
          isMediaType &&
          contentType === lesson?.content_type &&
          (lesson?.content || lesson?.external_key || lesson?.external_bh_url) && (
            <div className="space-y-3 rounded-lg border border-border bg-muted/30 p-4">
              <div className="space-y-0.5">
                <p className="text-sm font-medium text-foreground">
                  Imported source
                </p>
                <p className="text-xs text-muted-foreground">
                  This lesson&apos;s content comes from a course import. It is
                  preserved when you save. Change the content type or re-import
                  to replace it.
                </p>
              </div>
              <dl className="grid gap-2 text-sm">
                {lesson?.content && (
                  <div className="grid gap-1 sm:grid-cols-[140px_1fr] sm:items-center">
                    <dt className="text-xs text-muted-foreground">
                      {lesson.content_type === "video" ? "Stream URL" : "Source URL"}
                    </dt>
                    <dd className="min-w-0">
                      <Input
                        readOnly
                        value={lesson.content}
                        className="h-8 font-mono text-xs"
                        onFocus={(e) => e.currentTarget.select()}
                      />
                    </dd>
                  </div>
                )}
                {lesson?.external_key && (
                  <div className="grid gap-1 sm:grid-cols-[140px_1fr] sm:items-center">
                    <dt className="text-xs text-muted-foreground">Storage key</dt>
                    <dd className="min-w-0">
                      <Input
                        readOnly
                        value={lesson.external_key}
                        className="h-8 font-mono text-xs"
                        onFocus={(e) => e.currentTarget.select()}
                      />
                    </dd>
                  </div>
                )}
                {lesson?.external_bh_url && (
                  <div className="grid gap-1 sm:grid-cols-[140px_1fr] sm:items-center">
                    <dt className="text-xs text-muted-foreground">Backup link</dt>
                    <dd>
                      <a
                        href={lesson.external_bh_url}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="inline-flex items-center gap-1 text-xs text-primary underline-offset-2 hover:underline"
                      >
                        Open backup link
                        <ExternalLink className="w-3 h-3" />
                      </a>
                    </dd>
                  </div>
                )}
              </dl>
            </div>
          )}

        {isMediaType && (
          <div className="rounded-lg border border-dashed border-border bg-card p-4 sm:p-6">
            {!fileEntry ? (
              <div className="flex flex-col items-center gap-3 py-6 text-center">
                <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-muted text-muted-foreground">
                  {contentTypeIcon(contentType, "w-5 h-5")}
                </div>
                <div className="space-y-1">
                  <p className="text-sm font-medium text-foreground">
                    No file uploaded
                  </p>
                  <p className="text-xs text-muted-foreground">
                    Drop a file here, or click to browse
                  </p>
                </div>
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  onClick={() => fileInputRef.current?.click()}
                >
                  Choose file
                </Button>
                <input
                  ref={fileInputRef}
                  type="file"
                  className="hidden"
                  accept={
                    contentType === "pdf"
                      ? "application/pdf"
                      : contentType === "video"
                        ? "video/*"
                        : contentType === "image"
                          ? "image/*"
                          : undefined
                  }
                  onChange={(e) => handleFileSelect(e.target.files?.[0] ?? null)}
                />
              </div>
            ) : (
              <div className="space-y-4">
                <div className="flex items-center gap-3">
                  <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg bg-muted text-muted-foreground">
                    {contentTypeIcon(contentType, "w-5 h-5")}
                  </div>
                  <div className="min-w-0 flex-1 space-y-0.5">
                    <p className="truncate text-sm font-medium text-foreground">
                      {fileEntry.name}
                    </p>
                    <p className="text-xs text-muted-foreground">
                      {fileEntry.size > 0 ? formatFileSize(fileEntry.size) : "Uploaded"} ·{" "}
                      {lesson?.storage_path ? "replace to update" : "will be uploaded on save"}
                    </p>
                  </div>
                  <Button
                    type="button"
                    variant="ghost"
                    size="sm"
                    onClick={handleRemoveFile}
                    disabled={isPending}
                  >
                    Remove
                  </Button>
                </div>

                {previewUrl && contentType === "image" && (
                  <img
                    src={previewUrl}
                    alt="File preview"
                    className="max-h-64 rounded-lg border border-border object-contain"
                  />
                )}
                {previewUrl && contentType === "pdf" && (
                  <iframe
                    src={previewUrl}
                    title="PDF preview"
                    className="h-96 w-full rounded-lg border border-border"
                  />
                )}
                {previewUrl && contentType === "video" && (
                  <video
                    src={previewUrl}
                    controls
                    className="max-h-96 w-full rounded-lg border border-border"
                  />
                )}

                {uploadProgress !== null && (
                  <div className="space-y-1.5">
                    <div className="flex items-center justify-between text-xs">
                      <span className="text-muted-foreground">Uploading…</span>
                      <span className="font-medium text-foreground">
                        {uploadProgress}%
                      </span>
                    </div>
                    <div className="h-1.5 w-full overflow-hidden rounded-full bg-muted">
                      <div
                        className="h-full rounded-full bg-primary transition-all"
                        style={{ width: `${uploadProgress}%` }}
                      />
                    </div>
                  </div>
                )}
              </div>
            )}
          </div>
        )}
      </section>

      {/* Sticky action bar */}
      <div className="sticky bottom-4 mt-10 flex flex-wrap items-center justify-between gap-3 rounded-lg border border-border bg-card px-4 py-3 shadow-sm">
        <div className="flex items-center gap-2 text-xs text-muted-foreground">
          {isMediaType && !hasMediaSource() && (
            <Badge variant="outline" className="text-[10px]">
              File required
            </Badge>
          )}
          {contentType === "text" && (
            <span>Content is saved as HTML.</span>
          )}
          {contentType === "link" && <span>Link opens in a new tab.</span>}
        </div>
        <div className="flex items-center gap-2">
          <Button
            type="button"
            variant="outline"
            size="sm"
            onClick={onDone}
            disabled={isPending}
          >
            Cancel
          </Button>
          <Button type="submit" size="sm" disabled={isPending}>
            {isPending ? (
              <>
                <Loader2 className="w-3.5 h-3.5 animate-spin" />
                Saving…
              </>
            ) : isEdit ? (
              "Save Changes"
            ) : (
              "Create Lesson"
            )}
          </Button>
        </div>
      </div>

      {/* Delete confirmation */}
      <AlertDialog open={deleteOpen} onOpenChange={setDeleteOpen}>
        <AlertDialogContent className="max-w-md">
          <AlertDialogHeader>
            <AlertDialogTitle>Delete this lesson?</AlertDialogTitle>
            <AlertDialogDescription>
              This permanently deletes &ldquo;{lesson?.title}&rdquo; and its
              uploaded file. This can&apos;t be undone.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={isPending}>Cancel</AlertDialogCancel>
            <AlertDialogAction
              onClick={handleDelete}
              disabled={isPending}
              className="bg-destructive/10 text-destructive hover:bg-destructive/20 dark:bg-destructive/20 dark:hover:bg-destructive/30"
            >
              {isPending && <Loader2 className="w-3.5 h-3.5 animate-spin" />}
              Delete lesson
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </form>
  );
}
