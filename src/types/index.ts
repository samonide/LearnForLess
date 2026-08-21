
export type Json =
  | string
  | number
  | boolean
  | null
  | Json[]
  | { [key: string]: Json | undefined };

// ============================================================
// TABLE ROW TYPES (aliases for convenience)
// ============================================================

export type Profile = {
  id: string;
  email: string | null;
  display_name: string | null;
  role: UserRole;
  created_at: string;
  updated_at: string;
};

export type User = Profile & {
  user_courses?: Array<{
    course_id: string;
    created_at?: string;
    expires_at?: string | null;
    courses?: { id: string; title: string; status: string } | null;
  }>;
  student_access?: Array<{ last_seen_at?: string | null }>;
};

export type Course = {
  id: string;
  title: string;
  slug: string;
  description: string | null;
  thumbnail_url: string | null;
  status: CourseStatus;
  sort_order: number;
  created_at: string;
  updated_at: string;
};
export type Module = {
  id: string;
  course_id: string;
  title: string;
  description: string | null;
  sort_order: number;
  created_at: string;
  updated_at: string;
};
export type Lesson = {
  id: string;
  module_id: string;
  title: string;
  description: string | null;
  content_type: ContentType;
  content: string | null;
  storage_path: string | null;
  sort_order: number;
  is_preview: boolean;
  source_fingerprint: string | null;
  external_source: string | null;
  external_key: string | null;
  external_bh_url: string | null;
  file_size: number | null;
  source_stamped: boolean | null;
  created_at: string;
  updated_at: string;
};
export type AccessToken = {
  id: string;
  token_hint: string | null;
  bound_user_id: string | null;
  created_by: string | null;
  name: string;
  description: string | null;
  is_active: boolean;
  expires_at: string | null;
  max_uses: number | null;
  current_uses: number;
  last_used_at: string | null;
  created_at: string;
  updated_at: string;
};
export type TokenCourse = {
  id: string;
  token_id: string;
  course_id: string;
  created_at: string;
};
export type UserCourse = {
  id: string;
  user_id: string;
  course_id: string;
  granted_by_token: string | null;
  created_at: string;
  expires_at: string | null;
};
export type LessonProgress = {
  id: string;
  user_id: string;
  lesson_id: string;
  completed: boolean;
  progress_percentage: number;
  last_position: number;
  updated_at: string;
};
export type AuditLog = {
  id: string;
  admin_id: string | null;
  action: string;
  entity_type: string | null;
  entity_id: string | null;
  metadata: Json | null;
  created_at: string;
};
export type StudentAccess = {
  id: string;
  user_id: string;
  token_id: string | null;
  created_at: string;
  last_seen_at: string;
};

// ============================================================
// CONTENT TYPES
// ============================================================

export type ContentType = "pdf" | "video" | "text" | "link" | "image" | "file";
export type CourseStatus = "draft" | "published" | "archived";
export type UserRole = "admin" | "student";

// ============================================================
// EXTENDED / COMPUTED TYPES
// ============================================================

export type CourseWithProgress = Course & {
  completed_lessons: number;
  total_lessons: number;
  progress_pct: number;
  module_count: number;
};

export type ModuleWithLessons = Module & {
  lessons: Lesson[];
};

export type CourseWithModules = Course & {
  modules: ModuleWithLessons[];
};

export type LessonWithProgress = Lesson & {
  progress?: LessonProgress | null;
  lesson_number: number;
};

export type ModuleWithLessonsAndProgress = Module & {
  lessons: LessonWithProgress[];
  completed_lessons: number;
  total_lessons: number;
};

export type CourseViewerData = Course & {
  modules: ModuleWithLessonsAndProgress[];
  total_lessons: number;
  completed_lessons: number;
  progress_pct: number;
};

// ============================================================
// ADMIN TYPES
// ============================================================

export type TokenWithCourses = AccessToken & {
  courses: Course[];
};

export type UserWithCourses = Profile & {
  courses: Course[];
  last_activity: string | null;
};

export type AdminStats = {
  total_courses: number;
  published_courses: number;
  total_modules: number;
  total_lessons: number;
  active_tokens: number;
  total_students: number;
};

export type RecentTokenActivity = {
  token_name: string;
  token_hint: string | null;
  course_title: string;
  student_email: string | null;
  date: string;
  status: string;
};

// ============================================================
// TOKEN TYPES
// ============================================================

// Only used server-side — never exposed to client
export type TokenHashResult = {
  rawToken: string;
  tokenHash: string;
  tokenHint: string;
};

// ============================================================
// SERVER ACTION RESULT TYPES
// ============================================================

export type ActionResult<T = void> =
  | { success: true; data: T }
  | { success: false; error: string };

export type TokenRedemptionResult =
  | { success: true; courseIds: string[]; courseNames?: string[] }
  | { success: false; error: TokenRedemptionError };

export type RecoveryResult =
  | { success: true }
  | { success: false; error: RecoveryError };

export type RecoveryError =
  | "invalid_recovery_credentials"
  | "recovery_token_expired"
  | "recovery_token_used"
  | "password_too_short"
  | "unknown_error";

export type GenerateRecoveryResult =
  | { success: true; rawToken: string; hint: string }
  | { success: false; error: string };

export type TokenRedemptionError =
  | "invalid_token"
  | "token_disabled"
  | "token_expired"
  | "token_assigned_to_another_student"
  | "token_max_uses_reached"
  | "no_courses_assigned"
  | "unknown_error";

// ============================================================
// FORM TYPES
// ============================================================

export type CreateCourseInput = {
  title: string;
  slug: string;
  description?: string;
  thumbnail_url?: string;
  status: CourseStatus;
};

export type UpdateCourseInput = Partial<CreateCourseInput> & {
  id: string;
};

export type CreateModuleInput = {
  course_id: string;
  title: string;
  description?: string;
  sort_order?: number;
};

export type CreateLessonInput = {
  module_id: string;
  title: string;
  description?: string;
  content_type: ContentType;
  content?: string;
  sort_order?: number;
  is_preview?: boolean;
};

type LessonContentUpdate = {
  content?: string | null;
  storage_path?: string | null;
};

export type UpdateLessonInput = Omit<Partial<CreateLessonInput>, "content"> &
  LessonContentUpdate & { id: string };

export type GenerateTokenInput = {
  name?: string;
  description?: string;
  course_ids: string[];
  expires_at?: string | null;
  max_uses?: number | null;
};

export type GrantAccessInput = {
  user_id: string;
  course_id: string;
  expires_at?: string | null;
};

// ============================================================
// NAVIGATION / UI TYPES
// ============================================================

export type NavItem = {
  label: string;
  href: string;
  icon?: string;
  active?: boolean;
};

export type BreadcrumbItem = {
  label: string;
  href?: string;
};

export type PaginationState = {
  page: number;
  pageSize: number;
  total: number;
};

// ============================================================
// IMPORTER TYPES
// ============================================================

export type SourceContentType = "video" | "pdf" | "code_file";

export type ImportWarningLevel = "info" | "warning" | "error";

export type ImportWarning = {
  level: ImportWarningLevel;
  message: string;
  source_type: SourceContentType;
  source_key: string | null;
};

export type ParsedLesson = {
  title: string;
  description: string | null;
  content_type: ContentType;
  sort_order: number;
  is_preview: boolean;
  /** Source material fingerprint for dedup: SHA-256 hex of (content_type, chapter_name, unique_key) */
  source_fingerprint: string;
  external_source: string | null;
  external_key: string | null;
  external_bh_url: string | null;
  file_size: number | null;
  source_stamped: boolean | null;
  /** The primary content URL (stream_url, or presigned URL at view time) */
  content: string | null;
  /** Raw source row for reference */
  source_row: Record<string, unknown>;
};

export type ParsedModule = {
  title: string;
  description: string | null;
  sort_order: number;
  source_chapter_num: string;
  lessons: ParsedLesson[];
};

export type ParsedCourse = {
  source_id: string;
  source_type: string;
  title: string;
  description: string | null;
  modules: ParsedModule[];
};

export type ImportResult = {
  mode: "incremental" | "replacement";
  courseId: string;
  courseTitle: string;
  sourceCourseId: string;
  sourceType: string;
  modulesCreated: number;
  /** Modules added this run. 0 when no new modules were created. */
  modulesAdded: number;
  /** Modules removed this run. 0 unless mode is "replacement". */
  modulesRemoved: number;
  /** Lessons added this run. */
  lessonsAdded: number;
  /** Lessons removed this run. 0 unless mode is "replacement". */
  lessonsRemoved: number;
  lessonsByType: Record<string, number>;
  totalLessons: number;
  warnings: ImportWarning[];
};

export type ParseResult = {
  success: true;
  course: ParsedCourse;
  warnings: ImportWarning[];
} | {
  success: false;
  error: string;
};
