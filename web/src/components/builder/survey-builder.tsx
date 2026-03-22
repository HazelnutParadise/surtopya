"use client";

import React, { useState } from "react";
import { DndContext, DragEndEvent, DragOverlay, DragStartEvent, DragOverEvent, useSensor, useSensors, PointerSensor, closestCenter } from "@dnd-kit/core";
import { arrayMove, SortableContext, verticalListSortingStrategy } from "@dnd-kit/sortable";
import { Question, QuestionType } from "@/types/survey";
import { Toolbox } from "./toolbox";
import { Canvas } from "./canvas";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Switch } from "@/components/ui/switch";
import { Save, Eye, Palette, Layout, Split, ArrowLeft, Settings, Send, History as HistoryIcon, Database, AlertTriangle, Globe, Lock, Rocket, RotateCcw } from "lucide-react";
import { Separator } from "@/components/ui/separator";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { nanoid } from "nanoid";
import { ThemeEditor } from "./theme-editor";
import { LogicEditor } from "./logic-editor";
import { SurveyTheme, LogicRule } from "@/types/survey";
import { QuestionCard } from "./question-card";
import { getLocaleFromPath, withLocale } from "@/lib/locale";
import { getContrastColor } from "@/lib/utils";
import { mapApiSurveyToUi } from "@/lib/survey-mappers";
import { CAP_SURVEY_PUBLIC_DATASET_OPT_OUT, getSurveyDatasetSharingEffectiveValue, isSurveyDatasetSharingLocked, isSurveyPublishLocked } from "@/lib/survey-publish-locks";
import type { SurveyVersion } from "@/lib/api";
import { VersionDocumentPreview, type SurveyVersionSnapshotPreview } from "@/components/survey/version-document-preview";
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { useTimeZone, useTranslations } from "next-intl";
import { localDatetimeToUtcISOString, utcToDatetimeLocal } from "@/lib/date-time";
import { notifyPointsBalanceChanged } from "@/lib/points-balance-events";
import {
  readUiPayloadError,
  readUiPayloadMessage,
  resolveUiError,
  toUiErrorMessage,
} from "@/lib/ui-error";

// Simple ID generator if nanoid causes issues or for simplicity
const generateId = () => Math.random().toString(36).substr(2, 9);

const calculateEstimatedTime = (questions: Question[]) => {
    return questions.reduce((acc, q) => {
        switch(q.type) {
             case 'short': return acc + 1;
             case 'long': return acc + 2;
             case 'section': return acc;
             default: return acc + 0.5;
        }
    }, 0);
};

type DragData = Record<string, unknown>

const isToolboxDrag = (data: DragData | null | undefined): data is DragData & { isToolboxItem: true; type: QuestionType } => {
  return data != null && data["isToolboxItem"] === true && typeof data["type"] === "string"
}

export function SurveyBuilder() {
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const locale = getLocaleFromPath(pathname);
  const timeZone = useTimeZone()
  const withLocalePath = (href: string) => withLocale(href, locale);
  const tBuilder = useTranslations("SurveyBuilder");
  const tCommon = useTranslations("Common");
  const tNavigation = useTranslations("Navigation");
  const tConsent = useTranslations("ConsentModal");
  const tDashboard = useTranslations("Dashboard");
  const tSurveyPage = useTranslations("SurveyPage");
  const editId = searchParams.get("edit");
  const defaultPageTitle = tBuilder("defaultPageTitle");
  const [questions, setQuestions] = useState<Question[]>([
    {
        id: 'page-1',
        type: 'section',
        title: defaultPageTitle,
        required: false,
    }
  ]);
  const [activeId, setActiveId] = useState<string | null>(null);
  const [activeItem, setActiveItem] = useState<DragData | null>(null); // Track active item data
  const [title, setTitle] = useState(tBuilder("untitledSurvey"));
  const [isDirty, setIsDirty] = useState(false);
  const [activeSidebar, setActiveSidebar] = useState<'toolbox' | 'theme'>('toolbox');
  const [theme, setTheme] = useState<SurveyTheme>({
    primaryColor: '#9333ea', // purple-600
    backgroundColor: '#f9fafb', // gray-50
    fontFamily: 'inter',
  });
  const [logicEditorOpen, setLogicEditorOpen] = useState(false);
  const [activeLogicQuestionId, setActiveLogicQuestionId] = useState<string | null>(null);
  const [deletingQuestionId, setDeletingQuestionId] = useState<string | null>(null);
  const [mounted, setMounted] = useState(false);
  const [viewMode, setViewMode] = useState<'builder' | 'settings'>('builder');
  const [description, setDescription] = useState("");
  const [pointsReward, setPointsReward] = useState(0);
  const [expiresAtLocal, setExpiresAtLocal] = useState("");
  const [surveyId, setSurveyId] = useState<string | null>(null);
  const [loadingSurvey, setLoadingSurvey] = useState(false);
  const [savingSurvey, setSavingSurvey] = useState(false);
  const [publishingSurvey, setPublishingSurvey] = useState(false);
  const [publishError, setPublishError] = useState<string | null>(null);
  const [saveError, setSaveError] = useState<string | null>(null);
  const [saveErrorRequiresAuth, setSaveErrorRequiresAuth] = useState(false);

  // Consent Modal State
  const [consentGiven, setConsentGiven] = useState(false);


  const [isPublic, setIsPublic] = useState(true);
  const [includeInDatasets, setIncludeInDatasets] = useState(true);
  const [requireLoginToRespond, setRequireLoginToRespond] = useState(false);
  const [isPublished, setIsPublished] = useState(false);
  const [hasUnpublishedChanges, setHasUnpublishedChanges] = useState(false);
  const [publishSettingsOpen, setPublishSettingsOpen] = useState(false);
  const [publishedCount, setPublishedCount] = useState(0);
  const [capabilities, setCapabilities] = useState<Record<string, boolean>>({});
  const [versions, setVersions] = useState<SurveyVersion[]>([]);
  const [versionsLoading, setVersionsLoading] = useState(false);
  const [selectedVersion, setSelectedVersion] = useState<SurveyVersion | null>(null);
  const [isVersionPreviewOpen, setIsVersionPreviewOpen] = useState(false);
  const [restoringVersionNumber, setRestoringVersionNumber] = useState<number | null>(null);
  const [confirmRestoreVersionNumber, setConfirmRestoreVersionNumber] = useState<number | null>(null);
  const [versionError, setVersionError] = useState<string | null>(null);
  const [restoreNotice, setRestoreNotice] = useState<string | null>(null);
  const normalizeNonNegativePoints = (value: string) => Math.max(0, Number.parseInt(value || "0", 10) || 0)
  const getBuilderError = (payload: unknown, fallbackKey: string) =>
    resolveUiError(payload, tBuilder(fallbackKey))
  const getErrorMessage = (error: unknown, fallbackKey: string) =>
    toUiErrorMessage(error, tBuilder(fallbackKey))
  const mapPublishError = (payload: unknown) => {
    const apiMessage = readUiPayloadMessage(payload)
    if (apiMessage) return apiMessage
    const rawError = readUiPayloadError(payload)
    if (!rawError) return tBuilder("publishErrorGeneric")
    if (rawError === "Active survey limit reached") return tBuilder("publishErrorActiveSurveyLimitReached")
    if (rawError === "No changes to publish") return tBuilder("noChangesToPublish")
    if (rawError === "Insufficient points for boost top-up") return tBuilder("publishErrorInsufficientBoostPoints")
    if (rawError === "Boost points can only increase after first publish") return tBuilder("publishErrorBoostIncreaseOnly")
    if (rawError === "Unpublish and publish again to increase boost points") return tBuilder("publishErrorUnpublishBeforeIncrease")
    if (rawError === "Boost points cannot be negative") return tBuilder("publishErrorBoostNonNegative")
    if (rawError === "Published version expired") return tBuilder("publishedVersionExpired")
    return tBuilder("publishErrorGeneric")
  }

  const notifyChange = () => {
      setIsDirty(true);
      setHasUnpublishedChanges(true);
  };

  // Settings Draft State (for cancel/unsaved changes)
  const [settingsDraft, setSettingsDraft] = useState<{
      title: string;
      description: string;
      pointsReward: number;
      expiresAtLocal: string;
      isPublic: boolean;
      includeInDatasets: boolean;
      requireLoginToRespond: boolean;
  } | null>(null);
  const [confirmSettingsExit, setConfirmSettingsExit] = useState(false);
  const dashboardPath = withLocalePath('/dashboard')

  const hasUnsavedSettings = settingsDraft ? (
      settingsDraft.title !== title || 
      settingsDraft.description !== description || 
      settingsDraft.pointsReward !== pointsReward || 
      settingsDraft.expiresAtLocal !== expiresAtLocal ||
      settingsDraft.isPublic !== isPublic ||
      settingsDraft.includeInDatasets !== includeInDatasets ||
      settingsDraft.requireLoginToRespond !== requireLoginToRespond
  ) : false;
  const hasSavedDraft = Boolean(surveyId)
  const hasPublishableChanges = !isPublished || hasUnpublishedChanges
  const canOpenPublishDialog =
    hasSavedDraft && hasPublishableChanges && !isDirty && !publishingSurvey && !loadingSurvey

  const isPublishLocked = isSurveyPublishLocked(publishedCount)
  const isBuilderDatasetSharingLocked = isSurveyDatasetSharingLocked({
    publishedCount,
    capabilities,
    visibility: settingsDraft?.isPublic ? "public" : "non-public",
  })
  const isSettingsDraftDatasetSharingEnabled = getSurveyDatasetSharingEffectiveValue({
    capabilities,
    visibility: settingsDraft?.isPublic ? "public" : "non-public",
    includeInDatasets: settingsDraft?.includeInDatasets,
  })
  const isBuilderDatasetSharingEnabled = getSurveyDatasetSharingEffectiveValue({
    capabilities,
    visibility: isPublic ? "public" : "non-public",
    includeInDatasets,
  })
  const draftSnapshot: SurveyVersionSnapshotPreview = React.useMemo(
    () => ({
      title,
      description,
      visibility: isPublic ? "public" : "non-public",
      includeInDatasets: getSurveyDatasetSharingEffectiveValue({
        capabilities,
        visibility: isPublic ? "public" : "non-public",
        includeInDatasets,
      }),
      pointsReward,
      expiresAt: localDatetimeToUtcISOString(expiresAtLocal, timeZone) || undefined,
      questions: questions
        .filter((question) => question.id !== "placeholder")
        .map((question, index) => ({
          id: question.id,
          type: question.type,
          title: question.title,
          description: question.description || undefined,
          options: question.options || [],
          required: question.required,
          maxRating: question.maxRating,
          logic: question.logic,
          sortOrder: index,
        })),
    }),
    [title, description, isPublic, capabilities, includeInDatasets, pointsReward, expiresAtLocal, questions, timeZone]
  )
  const minExpiresAtLocal = React.useMemo(() => utcToDatetimeLocal(new Date().toISOString(), timeZone), [timeZone])

  const handleViewVersion = React.useCallback((version: SurveyVersion) => {
    setSelectedVersion(version)
    setIsVersionPreviewOpen(true)
  }, [])

  React.useEffect(() => {
    setMounted(true);
  }, []);

  React.useEffect(() => {
    let isActive = true
    const loadCapabilities = async () => {
      try {
        const response = await fetch("/api/app/me", { cache: "no-store" })
        const payload = await response.json().catch(() => ({}))
        if (isActive && response.ok) {
          setCapabilities(payload.capabilities || {})
        }
      } catch {
        if (isActive) {
          setCapabilities({})
        }
      }
    }

    loadCapabilities()
    return () => {
      isActive = false
    }
  }, [])

  // Warn on exit if unsaved
  React.useEffect(() => {
    const handleBeforeUnload = (e: BeforeUnloadEvent) => {
      if (isDirty) {
        e.preventDefault();
        e.returnValue = '';
      }
    };
    window.addEventListener('beforeunload', handleBeforeUnload);
    return () => window.removeEventListener('beforeunload', handleBeforeUnload);
  }, [isDirty]);

  const requestExitEditor = () => {
    if (isDirty) {
      setConfirmSettingsExit(true)
      return
    }
    router.push(dashboardPath)
  }

  const confirmExitEditor = () => {
    setConfirmSettingsExit(false)
    router.push(dashboardPath)
  }

  const sensors = useSensors(
    useSensor(PointerSensor, {
      activationConstraint: {
        distance: 8,
      },
    })
  );

  const handleDragStart = (event: DragStartEvent) => {
    setActiveId(event.active.id as string);
    setActiveItem((event.active.data.current as DragData | null) ?? null);
  };

  const handleDragOver = (event: DragOverEvent) => {
    const { active, over } = event;
    if (!over) return;

    // If dragging a toolbox item over the canvas
    const activeData = (active.data.current as DragData | null) ?? null
    if (isToolboxDrag(activeData)) {
      const isOverCanvas = over.id === 'canvas-droppable' || questions.some(q => q.id === over.id);
      
      if (isOverCanvas) {
        // Check if we already have a placeholder
        const hasPlaceholder = questions.some(q => q.id === 'placeholder');
        
        if (!hasPlaceholder) {
          const type = activeData.type as QuestionType;
          const placeholder: Question = {
            id: 'placeholder',
            type,
            title: tBuilder("newQuestion"),
            required: false,
            options: type === 'single' || type === 'multi' || type === 'select' ? [
              tBuilder("optionLabel", { index: 1 }),
              tBuilder("optionLabel", { index: 2 }),
            ] : undefined,
          };

          setQuestions(items => {
            // Insert at the hover position or end
            let overIndex = items.findIndex(item => item.id === over.id);
            
            // Prevent inserting before the first section
            if (overIndex === 0 && items.length > 0 && items[0].type === 'section') {
                overIndex = 1;
            }

            const newItems = [...items];
            
            if (overIndex !== -1) {
              newItems.splice(overIndex, 0, placeholder);
            } else {
              newItems.push(placeholder);
            }
            return newItems;
          });
        } else {
            // Move placeholder if needed
            setQuestions(items => {
                const activeIndex = items.findIndex(i => i.id === 'placeholder');
                const overIndex = items.findIndex(i => i.id === over.id);
                
                if (overIndex !== -1 && activeIndex !== overIndex) {
                    return arrayMove(items, activeIndex, overIndex);
                }
                return items;
            });
        }
      }
    }
  };

  const handleDragEnd = (event: DragEndEvent) => {
    const { active, over } = event;

    // Remove placeholder if it exists (we will replace it with real item or just remove it)
    const cleanQuestions = questions.filter(q => q.id !== 'placeholder');

    if (!over) {
      setActiveId(null);
      setActiveItem(null);
      setQuestions(cleanQuestions);
      return;
    }

    // Check if dropped on a valid target (canvas or existing question)
    const isOverCanvas = over.id === 'canvas-droppable' || questions.some(q => q.id === over.id);
    if (!isOverCanvas) {
        setActiveId(null);
        setActiveItem(null);
        setQuestions(cleanQuestions);
        return;
    }

    // Dropping a new item from Toolbox
    if (active.data.current?.isToolboxItem) {
      const type = active.data.current.type as QuestionType;
      const newQuestion: Question = {
        id: generateId(),
        type,
        title: tBuilder("newQuestion"),
        required: false,
        options: type === 'single' || type === 'multi' || type === 'select' ? [
          tBuilder("optionLabel", { index: 1 }),
          tBuilder("optionLabel", { index: 2 }),
        ] : undefined,
      };

      // Replace placeholder with real question
      const placeholderIndex = questions.findIndex(q => q.id === 'placeholder');
      if (placeholderIndex !== -1) {
          const newItems = [...questions];
          newItems[placeholderIndex] = newQuestion;
          
          // Enforce: Cannot be before first section
          if (placeholderIndex === 0 && newItems.length > 1 && newItems[1].type === 'section') {
             // Swap if needed, but usually we just want to ensure it's not at 0 if 0 is section
             // Actually, if 0 is section, we can't be at 0 unless we replaced it? No, placeholder is separate.
             // If placeholder is at 0, and we have a section at 1 (previously 0), then we are before it.
          }
          
          // Simpler enforcement: If index 0 is NOT a section, move it.
          // But wait, we have "Page 1" which is a section.
          // So items[0] MUST be a section.
          
          if (newItems.length > 0 && newItems[0].type !== 'section') {
              // We just replaced placeholder at 0 with a non-section.
              // We need to move it to 1.
              const firstItem = newItems[0];
              newItems.splice(0, 1);
              newItems.splice(1, 0, firstItem);
          }

          setQuestions(newItems);
          notifyChange();
      } else {
          // Fallback if no placeholder
          // Append to end is safe.
          // But what if list was empty? (Not possible due to Page 1)
          // What if dropped "before" Page 1 but no placeholder?
          // We'll just append to end to be safe.
          setQuestions([...cleanQuestions, newQuestion]);
          notifyChange();
      }
    } 
    // Reordering existing items
    else if (active.id !== over.id) {
      setQuestions((items) => {
        const oldIndex = items.findIndex((item) => item.id === active.id);
        const newIndex = items.findIndex((item) => item.id === over.id);
        
        // If moving a section, move the whole block
        if (items[oldIndex].type === 'section') {
            // 1. Find the block of questions belonging to this section
            let endIndex = oldIndex;
            for (let i = oldIndex + 1; i < items.length; i++) {
                if (items[i].type === 'section') break;
                endIndex = i;
            }
            
            const movingBlock = items.slice(oldIndex, endIndex + 1);
            const remainingItems = items.filter((_, index) => index < oldIndex || index > endIndex);
            
            // 2. Find where to insert in the remaining items
            const overIndexInRemaining = remainingItems.findIndex(item => item.id === over.id);
            if (overIndexInRemaining === -1) return items;

            // Find the section that the 'over' item belongs to
            let targetSectionStart = overIndexInRemaining;
            // Scan backwards to find the section header
            while (targetSectionStart >= 0 && remainingItems[targetSectionStart].type !== 'section') {
                targetSectionStart--;
            }
            
            // If we somehow didn't find a section (e.g. dropped before first section?), default to 0
            if (targetSectionStart < 0) targetSectionStart = 0;

            // Find the end of this target section
            let targetSectionEnd = targetSectionStart;
            while (targetSectionEnd + 1 < remainingItems.length && remainingItems[targetSectionEnd + 1].type !== 'section') {
                targetSectionEnd++;
            }

            // Decide insertion point: Before target section or After target section?
            // Use original indices to determine direction
            let insertIndex = targetSectionStart;
            
            if (oldIndex < newIndex) {
                // Dragging down: Insert after the target section
                insertIndex = targetSectionEnd + 1;
            } else {
                // Dragging up: Insert before the target section
                insertIndex = targetSectionStart;
            }
            
            const newItems = [
                ...remainingItems.slice(0, insertIndex),
                ...movingBlock,
                ...remainingItems.slice(insertIndex)
            ];
            
            return newItems;
        }

        // Normal question reordering
        const newItems = arrayMove(items, oldIndex, newIndex);
        
        // Enforce: First item must be a section
        if (newItems.length > 0 && newItems[0].type !== 'section') {
            return items;
        }
        
        return newItems;
      });
      notifyChange();
    } else {
        // If dropped on self or no change, just ensure placeholder is gone
        setQuestions(cleanQuestions);
    }

    setActiveId(null);
    setActiveItem(null);
  };

  const updateQuestion = (id: string, updates: Partial<Question>) => {
    setQuestions(questions.map(q => q.id === id ? { ...q, ...updates } : q));
    notifyChange();
  };

  const deleteQuestion = (id: string) => {
    // Prevent deleting the first page/section
    if (questions.length > 0 && questions[0].id === id && questions[0].type === 'section') {
        return;
    }
    setDeletingQuestionId(id);
  };

  const confirmDelete = () => {
    if (deletingQuestionId) {
        // Check if it's a section
        const questionToDelete = questions.find(q => q.id === deletingQuestionId);
        
        if (questionToDelete?.type === 'section') {
            // Cascade delete: Delete section AND all questions until next section
            const index = questions.findIndex(q => q.id === deletingQuestionId);
            let endIndex = index;
            for (let i = index + 1; i < questions.length; i++) {
                if (questions[i].type === 'section') break;
                endIndex = i;
            }
            
            const newQuestions = questions.filter((_, i) => i < index || i > endIndex);
            setQuestions(newQuestions);
        } else {
            // Normal delete
            setQuestions(questions.filter(q => q.id !== deletingQuestionId));
        }
        
        notifyChange();
        setDeletingQuestionId(null);
    }
  };

  const duplicateQuestion = (id: string) => {
    const startIndex = questions.findIndex(q => q.id === id);
    if (startIndex === -1) return;

    const itemsToDuplicate: Question[] = [];
    const item = questions[startIndex];
    itemsToDuplicate.push({
        ...item,
        id: generateId(),
        title: `${item.title} (${tBuilder("copySuffix")})`,
        logic: [],
    });

    // If it's a page (section), also duplicate all questions until the next section
    if (item.type === 'section') {
        let i = startIndex + 1;
        while (i < questions.length && questions[i].type !== 'section') {
            const q = questions[i];
            itemsToDuplicate.push({
                ...q,
                id: generateId(),
                logic: [], // Don't copy logic to avoid referential issues
            });
            i++;
        }
    }

    const newQuestions = [...questions];
    newQuestions.splice(startIndex + itemsToDuplicate.length, 0, ...itemsToDuplicate);
    
    setQuestions(newQuestions);
    notifyChange();
  };

  const openLogicEditor = (id: string) => {
    setActiveLogicQuestionId(id);
    setLogicEditorOpen(true);
  };

  const saveLogic = (logic: LogicRule[]) => {
    if (activeLogicQuestionId) {
        updateQuestion(activeLogicQuestionId, { logic });
    }
  };

  const addPage = () => {
    const newSection: Question = {
        id: generateId(),
        type: 'section',
        title: tBuilder("newPage"),
        required: false,
    };
    setQuestions([...questions, newSection]);
    notifyChange();
  };

  // Validate logic jumps - returns warning message if invalid, null if valid
  const getLogicWarning = (questionId: string): string | null => {
    const questionIndex = questions.findIndex(q => q.id === questionId);
    if (questionIndex === -1) return null;
    
    const question = questions[questionIndex];
    if (!question.logic || question.logic.length === 0) return null;
    
    for (const rule of question.logic) {
      // Skip "end_survey" - always valid
      if (rule.destinationQuestionId === 'end_survey') continue;
      
      // Check if destination exists
      const destIndex = questions.findIndex(q => q.id === rule.destinationQuestionId);
      if (destIndex === -1) {
        return tBuilder("logicWarningDeleted");
      }
      
      // Check if destination is AFTER current question (forward jump only)
      if (destIndex <= questionIndex) {
        return tBuilder("logicWarningBackwards");
      }
    }
    
    return null;
  };

  const buildQuestionsPayload = () => {
    return questions
      .filter(q => q.id !== "placeholder")
      .map((q) => ({
        id: q.id,
        type: q.type,
        title: q.title,
        description: q.description || "",
        options: q.options || [],
        required: q.required,
        maxRating: q.maxRating || 0,
        logic: q.logic || [],
      }));
  };

  const applyMappedSurvey = React.useCallback((mapped: ReturnType<typeof mapApiSurveyToUi>) => {
    const defaultSection: Question = {
      id: generateId(),
      type: "section",
      title: defaultPageTitle,
      required: false,
    }

    const safeQuestions: Question[] =
      mapped.questions.length > 0 && mapped.questions[0].type === "section"
        ? mapped.questions
        : [defaultSection, ...mapped.questions]

    setSurveyId(mapped.id)
    setTitle(mapped.title)
    setDescription(mapped.description)
    setQuestions(safeQuestions)
    setTheme(
      mapped.theme || {
        primaryColor: "#9333ea",
        backgroundColor: "#f9fafb",
        fontFamily: "inter",
      }
    )
    setPointsReward(mapped.settings.pointsReward)
    setExpiresAtLocal(utcToDatetimeLocal(mapped.settings.expiresAt, timeZone))
    setIsPublic(mapped.settings.visibility === "public")
    setIncludeInDatasets(mapped.settings.isDatasetActive)
    setRequireLoginToRespond(mapped.settings.requireLoginToRespond)
    setIsPublished(Boolean(mapped.settings.isPublished || (mapped.settings.publishedCount || 0) > 0))
    setPublishedCount(mapped.settings.publishedCount || 0)
    setHasUnpublishedChanges(Boolean(mapped.settings.hasUnpublishedChanges))
  }, [defaultPageTitle, timeZone])

  const loadSurveyVersions = React.useCallback(async (id: string) => {
    setVersionsLoading(true)
    setVersionError(null)
    try {
      const response = await fetch(`/api/app/surveys/${id}/versions`, { cache: "no-store" })
      if (!response.ok) {
        const errorPayload = await response.json().catch(() => ({}))
        throw new Error(getBuilderError(errorPayload, "versionLoadFailed"))
      }
      const payload = await response.json()
      const loadedVersions = payload.versions || []
      setVersions(loadedVersions)
      setSelectedVersion((previous) => {
        if (loadedVersions.length === 0) return null
        if (!previous) return loadedVersions[0]
        return loadedVersions.find((version: SurveyVersion) => version.id === previous.id) || loadedVersions[0]
      })
    } catch {
      setVersions([])
      setVersionError(tBuilder("versionLoadFailed"))
    } finally {
      setVersionsLoading(false)
    }
  }, [tBuilder])

  React.useEffect(() => {
    if (!editId) return
    let isActive = true

    const loadSurvey = async () => {
      setLoadingSurvey(true)
      try {
        const response = await fetch(`/api/app/surveys/${editId}`, { cache: "no-store" })
        if (!response.ok) {
          return
        }
        const payload = await response.json()
        const mapped = mapApiSurveyToUi(payload)

        if (!isActive) return
        applyMappedSurvey(mapped)
        setIsDirty(false)
        await loadSurveyVersions(mapped.id)
      } catch (error) {
        console.error("Failed to load survey:", error)
      } finally {
        if (isActive) {
          setLoadingSurvey(false)
        }
      }
    }

    loadSurvey()

    return () => {
      isActive = false
    }
  }, [applyMappedSurvey, editId, loadSurveyVersions])

  const restoreVersionToDraft = async (versionNumber: number) => {
    if (!surveyId) return
    setRestoringVersionNumber(versionNumber)
    setVersionError(null)
    setRestoreNotice(null)
    try {
      const response = await fetch(`/api/app/surveys/${surveyId}/versions/${versionNumber}/restore-draft`, {
        method: "POST",
      })
      if (!response.ok) {
        const errorPayload = await response.json().catch(() => ({}))
        throw new Error(getBuilderError(errorPayload, "versionRestoreFailed"))
      }
      const payload = await response.json()
      const mapped = mapApiSurveyToUi(payload)
      applyMappedSurvey(mapped)
      setIsDirty(true)
      setRestoreNotice(tBuilder("restoredToDraft"))
    } catch {
      setVersionError(tBuilder("versionRestoreFailed"))
    } finally {
      setRestoringVersionNumber(null)
    }
  }

  const confirmRestoreVersionToDraft = async () => {
    if (confirmRestoreVersionNumber == null) return
    const targetVersion = confirmRestoreVersionNumber
    setConfirmRestoreVersionNumber(null)
    await restoreVersionToDraft(targetVersion)
  }

  const saveSurvey = async () => {
    setSavingSurvey(true);
    setSaveError(null);
    setSaveErrorRequiresAuth(false);
    try {
      const payload = {
        title,
        description,
        visibility: isPublic ? "public" : "non-public",
        requireLoginToRespond,
        includeInDatasets: getSurveyDatasetSharingEffectiveValue({
          capabilities,
          visibility: isPublic ? "public" : "non-public",
          includeInDatasets,
        }),
        theme,
        pointsReward,
        expiresAtLocal,
        timeZone,
        questions: buildQuestionsPayload(),
      };

      const response = await fetch(surveyId ? `/api/app/surveys/${surveyId}` : "/api/app/surveys", {
        method: surveyId ? "PUT" : "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify(payload),
      });

      if (!response.ok) {
        const errorPayload = await response.json().catch(() => ({}));
        if (response.status === 401) {
          throw new Error(tBuilder("saveErrorUnauthorized"));
        }
        throw new Error(resolveUiError(errorPayload, tBuilder("saveErrorGeneric")));
      }

      const data = await response.json();
      const mapped = mapApiSurveyToUi(data);

      applyMappedSurvey(mapped)
      setIsDirty(false);

      return mapped;
    } catch (error) {
      const message = toUiErrorMessage(error, tBuilder("saveErrorGeneric"))
      const needsAuth = message === tBuilder("saveErrorUnauthorized")
      setSaveError(message)
      setSaveErrorRequiresAuth(needsAuth)
      throw error
    } finally {
      setSavingSurvey(false);
    }
  };

  const publishSurvey = async () => {
    setPublishingSurvey(true);
    setPublishError(null);
    try {
      let currentId = surveyId;
      if (!currentId) {
        const saved = await saveSurvey();
        currentId = saved?.id || null;
      }
      if (!currentId) {
        throw new Error(tBuilder("publishErrorMissingSurveyId"));
      }

      const response = await fetch(`/api/app/surveys/${currentId}/publish`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          visibility: isPublic ? "public" : "non-public",
          includeInDatasets: getSurveyDatasetSharingEffectiveValue({
            capabilities,
            visibility: isPublic ? "public" : "non-public",
            includeInDatasets,
          }),
          pointsReward,
        }),
      });

      if (!response.ok) {
        const errorPayload = await response.json().catch(() => ({}));
        throw new Error(mapPublishError(errorPayload));
      }

      const data = await response.json();
      const mapped = mapApiSurveyToUi(data);

      applyMappedSurvey(mapped)
      await loadSurveyVersions(mapped.id)
      setHasUnpublishedChanges(false);
      setIsDirty(false);
      setPublishSettingsOpen(false);
      setPublishError(null);
      notifyPointsBalanceChanged();
    } catch (error) {
      console.error("Failed to publish survey:", error);
      setPublishError(getErrorMessage(error, "publishErrorGeneric"));
    } finally {
      setPublishingSurvey(false);
    }
  };

  const openPreview = () => {
    // Save survey data to sessionStorage for the preview page
    const surveyData = {
      id: 'preview',
      title,
      description,
      questions,
      settings: {
        isPublic,
        pointsReward,
      }
    };
    sessionStorage.setItem('preview_survey', JSON.stringify(surveyData));
    sessionStorage.setItem('preview_theme', JSON.stringify(theme));
    
    // Open preview in new tab
    window.open(withLocalePath('/create/preview'), '_blank');
  };

  if (!mounted) return null;

  if (!consentGiven) {
    return (
      <Dialog open={true} onOpenChange={(open) => { if (!open) router.push(withLocalePath('/dashboard')); }}>
        <DialogContent className="sm:max-w-md" onInteractOutside={(e) => e.preventDefault()}>
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2 text-xl">
              <Database className="h-5 w-5 text-purple-600" />
              {tConsent("title")}
            </DialogTitle>
            <DialogDescription className="text-base pt-2">
              {tConsent("description")}
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4 py-4">
            <div className="flex gap-3">
              <div className="h-8 w-8 rounded-full bg-purple-100 dark:bg-purple-900/30 flex items-center justify-center shrink-0">
                <Layout className="h-4 w-4 text-purple-600" />
              </div>
              <p className="text-sm text-gray-600 dark:text-gray-400">
                <strong>{tConsent("deidentification")}:</strong> {tConsent("deidentificationText")}
              </p>
            </div>
            <div className="flex gap-3">
              <div className="h-8 w-8 rounded-full bg-blue-100 dark:bg-blue-900/30 flex items-center justify-center shrink-0">
                <Globe className="h-4 w-4 text-blue-600" />
              </div>
              <p className="text-sm text-gray-600 dark:text-gray-400">
                <strong>{tConsent("marketplace")}:</strong> {tConsent("marketplaceText")}
              </p>
            </div>
            <div className="flex gap-3">
              <div className="h-8 w-8 rounded-full bg-amber-100 dark:bg-amber-900/30 flex items-center justify-center shrink-0">
                <Lock className="h-4 w-4 text-amber-600" />
              </div>
              <p className="text-sm text-gray-600 dark:text-gray-400">
                <strong>{tConsent("paidOptout")}:</strong> {tConsent("paidOptoutText")}
              </p>
            </div>
          </div>
          <DialogFooter>
            <Button variant="ghost" onClick={() => router.push(withLocalePath('/dashboard'))}>{tCommon("cancel")}</Button>
            <Button className="bg-purple-600 hover:bg-purple-700 text-white" onClick={() => setConsentGiven(true)}>
              {tConsent("agree")}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    );
  }

  const questionCount = questions.filter(q => q.type !== 'section').length;
  const deletingQuestion = deletingQuestionId ? questions.find(q => q.id === deletingQuestionId) : null;
  const deletingIsSection = deletingQuestion?.type === 'section';

  return (
    <div className="flex h-screen flex-col bg-gray-50 dark:bg-gray-950">
      {/* Header */}
      <div className="bg-white border-b border-gray-200 px-4 py-2 flex items-center justify-between shadow-sm z-10 dark:bg-gray-900 dark:border-gray-800">
           <div className="flex items-center gap-4">
                <Button variant="ghost" size="icon" onClick={requestExitEditor}>
                    <ArrowLeft className="h-4 w-4" />
                </Button>
                <div className="flex flex-col">
                    <Input 
                        value={title} 
                        onChange={(e) => {
                            setTitle(e.target.value);
                            notifyChange();
                        }}
                        className="h-7 text-sm font-bold border-transparent hover:border-gray-200 focus:border-purple-500 bg-transparent px-1 w-auto min-w-[150px]"
                        placeholder={tBuilder("untitledSurvey")}
                    />
                    <span className="text-[10px] text-gray-400 capitalize px-1">
                      {isPublished ? tDashboard("published") : tDashboard("draft")} · {tBuilder("questionCount", { count: questionCount })}
                    </span>
                </div>
           </div>
           <div className="flex items-center gap-3">
                <div className="relative flex items-center bg-gray-100 dark:bg-gray-800 rounded-lg p-1">
                    <span
                        aria-hidden
                        className={`absolute left-1 top-1 h-7 w-20 rounded-md bg-white shadow-sm transition-transform duration-200 dark:bg-gray-900 ${viewMode === 'settings' ? 'translate-x-20' : 'translate-x-0'}`}
                    />
                    <Button 
                        variant="ghost"
                        size="sm" 
                        onClick={() => setViewMode('builder')} 
                        className={`relative z-10 h-7 w-20 text-xs ${viewMode === 'builder' ? 'text-gray-900' : 'text-gray-500 hover:text-gray-800'}`}
                    >
                        {tBuilder("builder")}
                    </Button>
                    <Button
                        variant="ghost"
                        size="sm"
                        onClick={() => {
                            if (isDirty) notifyChange();
                                // Initialize settings draft with current values
                            setSettingsDraft({
                                title,
                                description,
                                pointsReward,
                                expiresAtLocal,
                                isPublic,
                                includeInDatasets,
                                requireLoginToRespond,
                            });
                            setViewMode('settings');
                        }}
                        data-testid="builder-tab-settings"
                        className={`relative z-10 h-7 w-20 text-xs ${viewMode === 'settings' ? 'text-gray-900' : 'text-gray-500 hover:text-gray-800'}`}
                    >
                        {tBuilder("settings")}
                    </Button>
                </div>
               <Separator orientation="vertical" className="h-6" />
               <span className="flex items-center gap-1 text-xs text-gray-500">
                      <HistoryIcon className="h-3 w-3" />
                      <TooltipProvider>
                          <Tooltip>
                              <TooltipTrigger asChild>
                                  <span className="cursor-help">{tBuilder("minutesShort", { minutes: calculateEstimatedTime(questions) })}</span>
                              </TooltipTrigger>
                              <TooltipContent>
                                  <p>{tBuilder("estimatedTime")}</p>
                              </TooltipContent>
                          </Tooltip>
                      </TooltipProvider>
               </span>
               <Button size="sm" variant="outline" onClick={() => setActiveSidebar(activeSidebar === 'theme' ? 'toolbox' : 'theme')} className="h-8">
                      {activeSidebar === 'theme' ? <Layout className="mr-2 h-3 w-3" /> : <Palette className="mr-2 h-3 w-3" />}
                      {activeSidebar === 'theme' ? tBuilder("toolbox") : tBuilder("theme")}
               </Button>
               <Button 
                      size="sm" 
                      variant="outline"
                      onClick={saveSurvey}
                      className="h-8"
                      disabled={!isDirty || savingSurvey || loadingSurvey}
                 >
                      <Save className="mr-2 h-3 w-3" /> {tCommon("save")}
               </Button>
                <Button size="sm" variant="outline" onClick={() => openPreview()} className="h-8">
                       <Eye className="mr-2 h-3 w-3" /> {tCommon("preview")}
                </Button>
                <Button 
                       size="sm" 
                      onClick={() => {
                        setPublishError(null)
                        setPublishSettingsOpen(true)
                      }} 
                      className={`h-8 ${canOpenPublishDialog ? "bg-purple-600 hover:bg-purple-700 text-white" : "bg-gray-100 text-gray-400 cursor-not-allowed"}`}
                      disabled={!canOpenPublishDialog}
                  >
                      <Send className="mr-2 h-3 w-3" />
                      {isPublished ? tBuilder("republish") : tCommon("publish")}
               </Button>
           </div>
      </div>
      {saveError ? (
        <div className="border-b border-red-200 bg-red-50 px-4 py-2 text-sm text-red-700">
          <div className="mx-auto flex w-full max-w-7xl items-center justify-between gap-3">
            <span>{saveError}</span>
            {saveErrorRequiresAuth ? (
              <Button size="sm" variant="outline" onClick={() => window.location.assign("/api/logto/sign-in")}>
                {tNavigation("login")}
              </Button>
            ) : null}
          </div>
        </div>
      ) : null}

      {/* Main Content */}
      <div className="flex-1 overflow-hidden flex flex-col">
        {/* Settings View */}
        {viewMode === 'settings' ? (
            <div className="flex-1 overflow-y-auto bg-gray-50 dark:bg-gray-950 p-8">
                <div className="mx-auto max-w-2xl bg-white dark:bg-gray-900 rounded-lg shadow-sm border border-gray-200 dark:border-gray-800 p-8">
                    <h2 className="text-2xl font-bold mb-6">{tBuilder("surveySettingsTitle")}</h2>
                    <div className="space-y-6">
                        <div className="space-y-2">
                            <label className="text-sm font-medium">{tBuilder("surveyTitle")}</label>
                            <Input 
                            value={settingsDraft?.title || ''} 
                            onChange={(e) => setSettingsDraft(prev => prev ? ({ ...prev, title: e.target.value }) : null)}
                            placeholder={tBuilder("surveyTitlePlaceholder")}
                        />    </div>
                        <div className="space-y-2">
                            <label className="text-sm font-medium">{tBuilder("description")}</label>
                            <div className="border border-gray-200 dark:border-gray-800 rounded-md overflow-hidden">
                                {/* Formatting Toolbar */}
                                <div className="flex items-center gap-1 p-2 border-b border-gray-200 dark:border-gray-800 bg-gray-50 dark:bg-gray-900">
                                    <button
                                        type="button"
                                        onClick={() => {
                                            const textarea = document.getElementById('description-textarea') as HTMLTextAreaElement;
                                            const start = textarea.selectionStart;
                                            const end = textarea.selectionEnd;
                                            const text = textarea.value;
                                        const selected = text.substring(start, end);
                                        const newText = text.substring(0, start) + '**' + selected + '**' + text.substring(end);
                                        setSettingsDraft(prev => prev ? ({ ...prev, description: newText }) : null);
                                    }}    
                                        className="p-1.5 rounded hover:bg-gray-200 dark:hover:bg-gray-800 text-gray-600 dark:text-gray-400"
                                        title={tBuilder("formatBold")}
                                    >
                                        <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5"><path d="M6 4h8a4 4 0 0 1 4 4 4 4 0 0 1-4 4H6z"/><path d="M6 12h9a4 4 0 0 1 4 4 4 4 0 0 1-4 4H6z"/></svg>
                                    </button>
                                    <button
                                        type="button"
                                        onClick={() => {
                                            const textarea = document.getElementById('description-textarea') as HTMLTextAreaElement;
                                            const start = textarea.selectionStart;
                                            const end = textarea.selectionEnd;
                                            const text = textarea.value;
                                        const selected = text.substring(start, end);
                                        const newText = text.substring(0, start) + '_' + selected + '_' + text.substring(end);
                                        setSettingsDraft(prev => prev ? ({ ...prev, description: newText }) : null);
                                    }}    
                                        className="p-1.5 rounded hover:bg-gray-200 dark:hover:bg-gray-800 text-gray-600 dark:text-gray-400"
                                        title={tBuilder("formatItalic")}
                                    >
                                        <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><line x1="19" x2="10" y1="4" y2="4"/><line x1="14" x2="5" y1="20" y2="20"/><line x1="15" x2="9" y1="4" y2="20"/></svg>
                                    </button>
                                    <button
                                        type="button"
                                        onClick={() => {
                                            const textarea = document.getElementById('description-textarea') as HTMLTextAreaElement;
                                            const start = textarea.selectionStart;
                                            const end = textarea.selectionEnd;
                                            const text = textarea.value;
                                            const selected = text.substring(start, end);
                                            const url = prompt(tBuilder("linkPrompt"), 'https://');
                                            if (url) {
                                            const linkText = selected || tBuilder("linkText");
                                            const newText = text.substring(0, start) + '[' + linkText + '](' + url + ')' + text.substring(end);
                                            setSettingsDraft(prev => prev ? ({ ...prev, description: newText }) : null);
                                        }
                                    }}    
                                        className="p-1.5 rounded hover:bg-gray-200 dark:hover:bg-gray-800 text-gray-600 dark:text-gray-400"
                                        title={tBuilder("formatLink")}
                                    >
                                        <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M10 13a5 5 0 0 0 7.54.54l3-3a5 5 0 0 0-7.07-7.07l-1.72 1.71"/><path d="M14 11a5 5 0 0 0-7.54-.54l-3 3a5 5 0 0 0 7.07 7.07l1.71-1.71"/></svg>
                                    </button>
                                    <div className="w-px h-5 bg-gray-200 dark:bg-gray-700 mx-1" />
                                    <button
                                        type="button"
                                        onClick={() => {
                                            const textarea = document.getElementById('description-textarea') as HTMLTextAreaElement;
                                            const start = textarea.selectionStart;
                                            const text = textarea.value;
                                        const newText = text.substring(0, start) + '\n- ' + text.substring(start);
                                        setSettingsDraft(prev => prev ? ({ ...prev, description: newText }) : null);
                                    }}    
                                        className="p-1.5 rounded hover:bg-gray-200 dark:hover:bg-gray-800 text-gray-600 dark:text-gray-400"
                                        title={tBuilder("formatBulletList")}
                                    >
                                        <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><line x1="8" x2="21" y1="6" y2="6"/><line x1="8" x2="21" y1="12" y2="12"/><line x1="8" x2="21" y1="18" y2="18"/><line x1="3" x2="3.01" y1="6" y2="6"/><line x1="3" x2="3.01" y1="12" y2="12"/><line x1="3" x2="3.01" y1="18" y2="18"/></svg>
                                    </button>
                                </div>
                                {/* Textarea */}
                                <textarea 
                                    id="description-textarea"
                                value={settingsDraft?.description || ''} 
                                onChange={(e) => setSettingsDraft(prev => prev ? ({ ...prev, description: e.target.value }) : null)}
                                placeholder={tBuilder("descriptionPlaceholder")}
                                    className="w-full min-h-[100px] bg-transparent px-3 py-2 text-sm placeholder:text-gray-500 focus:outline-none resize-none"
                                />
                            </div>
                            <p className="text-xs text-gray-500">{tBuilder("supportsMarkdown")}</p>
                        </div>

                        <div className="grid grid-cols-2 gap-4">
                            <div className="space-y-2">
                                <label className="text-sm font-medium">{tBuilder("pointsReward")}</label>
                                <Input 
                                    type="number" 
                                value={settingsDraft?.pointsReward || 0} 
                                onChange={(e) =>
                                  setSettingsDraft(prev => prev ? ({ ...prev, pointsReward: normalizeNonNegativePoints(e.target.value) }) : null)
                                }
                                min={0}
                                />
                                <p className="text-xs text-gray-500">{tBuilder("pointsRewardDescription")}</p>
                            </div>
                            <div className="space-y-2">
                                <label className="text-sm font-medium">{tBuilder("expirationDate")}</label>
                                <Input 
                                    type="datetime-local"
                                    value={settingsDraft?.expiresAtLocal || ""}
                                    min={minExpiresAtLocal || undefined}
                                    className="dark:bg-gray-800"
                                    onChange={(e) =>
                                      setSettingsDraft(prev =>
                                        prev ? ({ ...prev, expiresAtLocal: e.target.value }) : null
                                      )
                                    }
                                />
                                <p className="text-xs text-gray-500 italic">{tBuilder("optional")}</p>
                            </div>
                        </div>

                            <div className="space-y-2">
                                <label className="text-sm font-medium">{tBuilder("visibility")}</label>
                            <div className="flex bg-gray-100 dark:bg-gray-800 p-1 rounded-lg w-fit">
                                <button
                                    data-testid="builder-settings-visibility-public"
                                    disabled={isPublishLocked}
                                    onClick={() => setSettingsDraft(prev => prev ? ({ ...prev, isPublic: true }) : null)}
                                    className={`px-4 py-1.5 rounded-md text-sm font-medium transition-all disabled:opacity-50 disabled:cursor-not-allowed ${settingsDraft?.isPublic ? 'bg-white dark:bg-gray-700 shadow-sm text-purple-600' : 'text-gray-500'}`}
                                >
                                    {tBuilder("visibilityPublic")}
                                </button>
                                <button
                                    data-testid="builder-settings-visibility-nonpublic"
                                    disabled={isPublishLocked}
                                    onClick={() => setSettingsDraft(prev => prev ? ({ ...prev, isPublic: false }) : null)}
                                    className={`px-4 py-1.5 rounded-md text-sm font-medium transition-all disabled:opacity-50 disabled:cursor-not-allowed ${!settingsDraft?.isPublic ? 'bg-white dark:bg-gray-700 shadow-sm text-purple-600' : 'text-gray-500'}`}
                                >
                                    {tBuilder("visibilityNonPublic")}
                                </button>
                            </div>
                            <p className="text-xs text-gray-500 mt-1 leading-relaxed">
                                {settingsDraft?.isPublic 
                                    ? tBuilder("visibilityPublicDescription")
                                    : tBuilder("visibilityNonPublicDescription")}
                            </p>
                            {isPublishLocked ? (
                              <p
                                className="text-xs text-gray-500 mt-1 flex items-center gap-1"
                                data-testid="builder-settings-publish-locked-hint"
                              >
                                <Lock className="h-3 w-3" />
                                {tBuilder("settingsLockedAfterPublish")}
                              </p>
                            ) : null}
                        </div>

                        <div className="flex items-center justify-between rounded-lg border border-gray-200 dark:border-gray-800 px-4 py-3">
                            <div className="space-y-1 pr-4">
                                <label className="text-sm font-medium">{tBuilder("requireLoginToRespondLabel")}</label>
                                <p className="text-xs text-gray-500">{tBuilder("requireLoginToRespondDescription")}</p>
                            </div>
                            <Switch
                                checked={Boolean(settingsDraft?.requireLoginToRespond)}
                                onCheckedChange={(checked: boolean) =>
                                  setSettingsDraft(prev => prev ? ({ ...prev, requireLoginToRespond: checked }) : null)
                                }
                                data-testid="builder-settings-require-login"
                            />
                        </div>

                        <Separator className="dark:bg-gray-800" />

                        <div className="space-y-4">
                            <div className="flex items-center justify-between">
                                <div className="space-y-0.5">
                                    <label className="text-sm font-bold flex items-center gap-2">
                                        <Database className="h-4 w-4 text-purple-600" />
                                        {tBuilder("includeDatasetLabel")}
                                    </label>
                                    <p className="text-xs text-gray-500 max-w-[400px]">
                                        {settingsDraft?.isPublic 
                                            ? tBuilder("publicDatasetNote")
                                            : tBuilder("nonPublicDatasetNote")}
                                    </p>
                                </div>
                                <div className="flex items-center gap-3">
                                    <Switch 
                                        checked={getSurveyDatasetSharingEffectiveValue({
                                          capabilities,
                                          visibility: settingsDraft?.isPublic ? "public" : "non-public",
                                          includeInDatasets: settingsDraft?.includeInDatasets,
                                        })}
                                        disabled={isBuilderDatasetSharingLocked} // Locked after first publish; forced true if public/ever public.
                                        onCheckedChange={(checked: boolean) => setSettingsDraft(prev => prev ? ({ ...prev, includeInDatasets: checked }) : null)}
                                        data-testid="builder-settings-include-in-datasets"
                                    />
                                </div>
                            </div>
                            {isSettingsDraftDatasetSharingEnabled && (
                                <div className="p-3 rounded-lg bg-purple-50 dark:bg-purple-900/20 border border-purple-100 dark:border-purple-800 flex items-start gap-3">
                                    <AlertTriangle className="h-4 w-4 text-purple-600 mt-0.5" />
                                    <p className="text-xs text-purple-700 dark:text-purple-400">
                                        <strong>{tBuilder("datasetEnrollmentTitle")}</strong> {tBuilder("datasetEnrollmentNotice", { visibility: tBuilder("visibilityPublic") })}
                                    </p>
                                </div>
                            )}
                        </div>
                        
                        <div className="pt-6 border-t border-gray-200 dark:border-gray-800 flex justify-end gap-3">
                             <Button variant="ghost" onClick={() => setViewMode('builder')} className="text-gray-500 hover:text-gray-700">
                                {tCommon("cancel")}
                             </Button>
                             <Button 
                                disabled={!hasUnsavedSettings}
                                onClick={() => {
                                 if (settingsDraft) {
                                     setTitle(settingsDraft.title);
                                     setDescription(settingsDraft.description);
                                     setPointsReward(settingsDraft.pointsReward);
                                     setExpiresAtLocal(settingsDraft.expiresAtLocal);
                                     setIsPublic(settingsDraft.isPublic);
                                     setIncludeInDatasets(settingsDraft.includeInDatasets);
                                     setRequireLoginToRespond(settingsDraft.requireLoginToRespond);
                                     notifyChange();
                                     setViewMode('builder');
                                 }
                             }} className={hasUnsavedSettings ? "bg-purple-600 hover:bg-purple-700 text-white" : "bg-gray-200 text-gray-500 hover:bg-gray-200"}>
                                {tCommon("save")}
                             </Button>
                        </div>
                    </div>
                </div>
            </div>
        ) : (
             <DndContext 
                sensors={sensors} 
                collisionDetection={closestCenter} 
                onDragStart={handleDragStart} 
                onDragOver={handleDragOver}
                onDragEnd={handleDragEnd}
              >

                <div className="flex flex-1 overflow-hidden">
                  {/* Sidebar */}
                  <aside className="w-64 border-r border-gray-200 bg-white p-4 dark:border-gray-800 dark:bg-gray-900 overflow-y-auto">
                    <div className="flex items-center justify-between mb-4">
                        <h2 className="text-sm font-semibold text-gray-500 uppercase tracking-wider">
                            {activeSidebar === 'toolbox' ? tBuilder("toolbox") : tBuilder("theme")}
                        </h2>
                        {activeSidebar === 'theme' && (
                            <Button variant="ghost" size="icon" onClick={() => setActiveSidebar('toolbox')} className="h-6 w-6">
                                <Layout className="h-4 w-4" />
                            </Button>
                        )}
                    </div>
                    
                    {activeSidebar === 'toolbox' ? (
                        <Toolbox />
                    ) : (
                        <ThemeEditor theme={theme} onUpdate={(updates) => {
                            setTheme({ ...theme, ...updates });
                            notifyChange();
                        }} />
                    )}

                    {activeSidebar === 'toolbox' && isBuilderDatasetSharingEnabled && (
                        <div className="mt-8 p-4 rounded-xl bg-purple-50 dark:bg-purple-900/10 border border-purple-100 dark:border-purple-800/50">
                            <div className="flex items-center gap-2 text-purple-600 font-bold text-xs uppercase tracking-widest mb-2">
                                <Database className="h-3.5 w-3.5" />
                                {tBuilder("datasetNotice")}
                            </div>
                            <p className="text-[11px] text-purple-700 dark:text-purple-400 leading-relaxed">
                                {tBuilder("datasetNoticeText")}
                            </p>
                        </div>
                    )}
                  </aside>

                  {/* Canvas */}
                  <main 
                    className="flex-1 overflow-y-auto p-8 transition-colors duration-200"
                    style={{
                        backgroundColor: theme.backgroundColor,
                        color: getContrastColor(theme.backgroundColor) === 'white' ? '#ffffff' : '#111827',
                        fontFamily: theme.fontFamily === 'serif' ? 'serif' : theme.fontFamily === 'mono' ? 'monospace' : theme.fontFamily === 'comic' ? '"Comic Sans MS", cursive, sans-serif' : 'inherit'
                    }}
                  >
                    <div className="mx-auto max-w-3xl" style={{ '--primary': theme.primaryColor, '--primary-foreground': getContrastColor(theme.primaryColor) === 'white' ? '#ffffff' : '#111827' } as React.CSSProperties}>
                      <SortableContext 
                        items={questions.map(q => q.id).filter(id => {
                            if (!activeItem) return true;
                            // If dragging a section, only sections are sortable targets
                            if (typeof activeItem.type === "string" && activeItem.type === 'section') {
                                const q = questions.find(i => i.id === id);
                                return q?.type === 'section';
                            }
                            return true;
                        })} 
                        strategy={verticalListSortingStrategy}
                      >
                        <Canvas 
                          questions={questions} 
                          onUpdate={(id, updates) => {
                              updateQuestion(id, updates);
                              notifyChange();
                          }} 
                          onDelete={deleteQuestion} 
                          onDuplicate={duplicateQuestion}
                          onOpenLogic={openLogicEditor}
                          activeId={activeId}
                          getLogicWarning={getLogicWarning}
                        />
                      </SortableContext>
                       <div className="mt-4 flex justify-center pb-12">
                         <Button 
                           variant="outline" 
                           onClick={addPage}
                           className="border-dashed border-2 hover:border-purple-500 hover:text-purple-600 px-8 py-6 rounded-xl flex flex-col gap-1 h-auto bg-white/50 dark:bg-gray-800/50"
                         >
                            <div className="flex items-center gap-2 font-bold">
                               <Layout className="h-4 w-4" />
                               {tBuilder("addPage")}
                            </div>
                            <span className="text-[10px] font-normal opacity-60">{tBuilder("addPageDescription")}</span>
                         </Button>
                       </div>
                       {surveyId ? (
                         <section className="xl:hidden mt-4 rounded-xl border border-gray-200 dark:border-gray-800 bg-white/90 dark:bg-gray-900/80 p-4 space-y-3">
                           <div className="flex items-center gap-2 text-xs font-semibold text-gray-700 dark:text-gray-200">
                             <HistoryIcon className="h-3.5 w-3.5" />
                             {tBuilder("versionHistory")}
                           </div>
                            {versionsLoading ? (
                              <p className="text-xs text-gray-500">{tCommon("loading")}</p>
                            ) : versions.length === 0 ? (
                              <p className="text-xs text-gray-500">{tBuilder("versionEmpty")}</p>
                            ) : (
                              <div data-testid="builder-version-history-list-mobile" className="max-h-[22rem] overflow-y-auto pr-1 space-y-2">
                                {versions.map((version) => (
                                  <div key={version.id} className="rounded-md border border-gray-200 dark:border-gray-800 bg-white dark:bg-gray-900 px-2 py-1.5">
                                    <div className="text-[11px] font-medium text-gray-700 dark:text-gray-200">
                                      {tBuilder("versionLabel", { version: version.versionNumber })}
                                    </div>
                                    <div className="mt-1 flex items-center gap-1">
                                      <Button
                                        size="sm"
                                        variant="ghost"
                                        className="h-6 px-2 text-[11px]"
                                        data-testid={`builder-version-view-mobile-${version.versionNumber}`}
                                        onClick={() => handleViewVersion(version)}
                                      >
                                        {tBuilder("viewVersion")}
                                      </Button>
                                     <Button
                                       size="sm"
                                       variant="outline"
                                       className="h-6 px-2 text-[11px]"
                                       onClick={() => setConfirmRestoreVersionNumber(version.versionNumber)}
                                       disabled={restoringVersionNumber === version.versionNumber}
                                     >
                                       {restoringVersionNumber === version.versionNumber ? tCommon("saving") : tBuilder("restoreToDraft")}
                                     </Button>
                                   </div>
                                 </div>
                               ))}
                             </div>
                            )}
                            {versionError ? <p className="text-[11px] text-red-600">{versionError}</p> : null}
                            {restoreNotice ? <p className="text-[11px] text-emerald-700 dark:text-emerald-400">{restoreNotice}</p> : null}
                          </section>
                        ) : null}
                    </div>
                  </main>
                  {surveyId ? (
                    <aside className="hidden xl:flex w-[240px] flex-col border-l border-gray-200 bg-white dark:border-gray-800 dark:bg-gray-900 p-4 gap-3 overflow-y-auto">
                      <div className="flex items-center gap-2 text-xs font-semibold text-gray-700 dark:text-gray-200">
                        <HistoryIcon className="h-3.5 w-3.5" />
                        {tBuilder("versionHistory")}
                      </div>
                      {versionsLoading ? (
                        <p className="text-xs text-gray-500">{tCommon("loading")}</p>
                      ) : versions.length === 0 ? (
                        <p className="text-xs text-gray-500">{tBuilder("versionEmpty")}</p>
                      ) : (
                        <div data-testid="builder-version-history-list-desktop" className="max-h-[22rem] overflow-y-auto pr-1 space-y-2">
                          {versions.map((version) => (
                            <div key={version.id} className="rounded-md border border-gray-200 dark:border-gray-800 bg-gray-50 dark:bg-gray-900 px-2 py-1.5">
                              <div className="text-[11px] font-medium text-gray-700 dark:text-gray-200">
                                {tBuilder("versionLabel", { version: version.versionNumber })}
                              </div>
                              <div className="mt-1 flex items-center gap-1">
                                <Button
                                  size="sm"
                                  variant="ghost"
                                  className="h-6 px-2 text-[11px]"
                                  data-testid={`builder-version-view-desktop-${version.versionNumber}`}
                                  onClick={() => handleViewVersion(version)}
                                >
                                  {tBuilder("viewVersion")}
                                </Button>
                                <Button
                                  size="sm"
                                  variant="outline"
                                  className="h-6 px-2 text-[11px]"
                                  onClick={() => setConfirmRestoreVersionNumber(version.versionNumber)}
                                  disabled={restoringVersionNumber === version.versionNumber}
                                >
                                  {restoringVersionNumber === version.versionNumber ? tCommon("saving") : tBuilder("restoreToDraft")}
                                </Button>
                              </div>
                            </div>
                          ))}
                        </div>
                      )}
                      {versionError ? <p className="text-[11px] text-red-600">{versionError}</p> : null}
                      {restoreNotice ? <p className="text-[11px] text-emerald-700 dark:text-emerald-400">{restoreNotice}</p> : null}
                    </aside>
                  ) : null}
                </div>
                
                {activeLogicQuestionId && questions.find(q => q.id === activeLogicQuestionId) && (
                    <LogicEditor 
                        question={questions.find(q => q.id === activeLogicQuestionId)!}
                        allQuestions={questions}
                        open={logicEditorOpen}
                        onOpenChange={setLogicEditorOpen}
                        onSave={(logic) => {
                            if (activeLogicQuestionId) {
                                saveLogic(logic);
                                notifyChange();
                            }
                        }}
                    />
                )}

                <Dialog open={!!deletingQuestionId} onOpenChange={(open) => !open && setDeletingQuestionId(null)}>
                    <DialogContent onInteractOutside={(e) => e.preventDefault()}>
                        <DialogHeader>
                            <DialogTitle>
                              {deletingIsSection ? tBuilder("deletePageTitle") : tBuilder("deleteQuestionTitle")}
                            </DialogTitle>
                            <DialogDescription>
                                {deletingIsSection ? tBuilder("deletePageDescription") : tBuilder("deleteQuestionDescription")}
                            </DialogDescription>
                        </DialogHeader>
                        <DialogFooter>
                            <Button variant="outline" onClick={() => setDeletingQuestionId(null)}>{tCommon("cancel")}</Button>
                            <Button variant="destructive" onClick={confirmDelete}>{tCommon("delete")}</Button>
                        </DialogFooter>
                    </DialogContent>
                </Dialog>
                
                <DragOverlay dropAnimation={null}>
                  {activeId ? (
                     activeItem?.isToolboxItem === true ? (
                        <div className="w-[600px] opacity-60"> {/* Translucent preview */}
                            {/* Preview of what it looks like */}
                             <div className="bg-white border border-purple-500 shadow-xl rounded-lg p-4">
                                <div className="h-4 w-1/3 bg-gray-200 rounded mb-4"></div>
                                <div className="space-y-2">
                                    <div className="h-8 w-full bg-gray-100 rounded border border-gray-200"></div>
                                    <div className="h-8 w-full bg-gray-100 rounded border border-gray-200"></div>
                                </div>
                             </div>
                        </div>
                     ) : (
                         <div className="w-[800px]"> {/* Fixed width for drag overlay to match canvas */}
                            {typeof activeItem?.type === "string" && activeItem.type === 'section' ? (
                                <div className="flex flex-col mb-8 rounded-xl border border-gray-200 bg-white/50 p-4 shadow-2xl dark:border-gray-800 dark:bg-gray-900/50 rotate-2 opacity-90 cursor-grabbing ring-2 ring-purple-500">
                                    <QuestionCard 
                                        question={activeItem as unknown as Question} 
                                        onUpdate={() => {}} 
                                        onDelete={() => {}} 
                                        onDuplicate={() => {}} 
                                        onOpenLogic={() => {}}
                                        isOverlay
                                        isFirstSection={true}
                                    />
                                    {/* Render questions belonging to this section */}
                                    <div className="pl-4 mt-4 space-y-4 border-l-2 border-gray-100 dark:border-gray-800 ml-4">
                                        {(() => {
                                            const activeItemId = typeof activeItem?.id === "string" ? activeItem.id : null
                                            const index = activeItemId ? questions.findIndex(q => q.id === activeItemId) : -1
                                            if (index === -1) return null;
                                            const sectionQuestions = [];
                                            for (let i = index + 1; i < questions.length; i++) {
                                                if (questions[i].type === 'section') break;
                                                sectionQuestions.push(questions[i]);
                                            }
                                            return sectionQuestions.map((q, i) => (
                                                <QuestionCard 
                                                    key={q.id}
                                                    question={q} 
                                                    onUpdate={() => {}} 
                                                    onDelete={() => {}} 
                                                    onDuplicate={() => {}} 
                                                    onOpenLogic={() => {}}
                                                    isOverlay
                                                />
                                            ));
                                        })()}
                                    </div>
                                </div>
                            ) : (
                                <QuestionCard 
                                    question={activeItem as unknown as Question} 
                                    onUpdate={() => {}} 
                                    onDelete={() => {}} 
                                    onDuplicate={() => {}} 
                                    onOpenLogic={() => {}}
                                    isOverlay
                                />
                            )}
                         </div>
                     )
                  ) : null}
                </DragOverlay>

            <Dialog
                open={publishSettingsOpen}
                onOpenChange={(open) => {
                  setPublishSettingsOpen(open)
                  if (!open) {
                    setPublishError(null)
                  }
                }}
            >
                <DialogContent>
                    <DialogHeader>
                        <DialogTitle>{tBuilder("publishSettings")}</DialogTitle>
                        <DialogDescription>
                          {isPublished ? tBuilder("confirmRepublish") : tBuilder("confirmPublish")}
                        </DialogDescription>
                    </DialogHeader>
                    
                    <div className="space-y-6 py-4">
                        {publishedCount === 0 && (
                            <div className="p-3 bg-blue-50 text-blue-700 text-sm rounded-lg flex gap-2">
                                <AlertTriangle className="h-5 w-5 shrink-0" />
                                <div>
                                    <strong>{tBuilder("firstPublishNotice")}:</strong> {tBuilder("firstPublishWarning")}
                                </div>
                            </div>
                        )}

                        <div className="flex items-center justify-between">
                            <div className="space-y-0.5">
                                <label className="text-sm font-medium flex items-center gap-2">
                                    {isPublic ? <Globe className="h-4 w-4 text-emerald-500" /> : <Lock className="h-4 w-4 text-amber-500" />}
                                    {tBuilder("visibility")}
                                </label>
                                <p className="text-xs text-gray-500">
                                    {isPublic ? tBuilder("visibilityPublic") : tBuilder("visibilityNonPublic")}
                                </p>
                            </div>
                            <div className="flex items-center gap-2">
                                <span className="text-xs font-medium">{isPublic ? tBuilder("visibilityPublic") : tBuilder("visibilityNonPublic")}</span>
                                <Switch 
                                    checked={isPublic}
                                    disabled={isPublishLocked}
                                    onCheckedChange={(checked) => {
                                        setIsPublic(checked);
                                        // Auto-force dataset logic for tiers without opt-out capability.
                                        if (checked && !capabilities[CAP_SURVEY_PUBLIC_DATASET_OPT_OUT]) {
                                            setIncludeInDatasets(true);
                                        }
                                    }}
                                />
                            </div>
                        </div>

                        <div className="flex items-center justify-between opacity-100">
                             <div className="space-y-0.5">
                                <label className="text-sm font-medium flex items-center gap-2">
                                    <Database className="h-4 w-4 text-purple-500" />
                                    {tBuilder("datasetContributions")}
                                </label>
                                <p className="text-xs text-gray-500">
                                    {isPublic 
                                        ? tBuilder("publicDatasetNote")
                                        : tBuilder("nonPublicDatasetNote")}
                                </p>
                            </div>
                            <Switch 
                                checked={getSurveyDatasetSharingEffectiveValue({
                                  capabilities,
                                  visibility: isPublic ? "public" : "non-public",
                                  includeInDatasets,
                                })}
                                disabled={isSurveyDatasetSharingLocked({
                                  publishedCount,
                                  capabilities,
                                  visibility: isPublic ? "public" : "non-public",
                                })}
                                onCheckedChange={setIncludeInDatasets}
                                data-testid="builder-publish-include-in-datasets"
                            />
                        </div>

                        <div className="flex items-center justify-between">
                            <div className="space-y-0.5">
                                <label className="text-sm font-medium">{tBuilder("pointsReward")}</label>
                                <p className="text-xs text-gray-500">{tBuilder("pointsRewardDescription")}</p>
                            </div>
                            <Input 
                                type="number" 
                                value={pointsReward} 
                                onChange={(e) => setPointsReward(normalizeNonNegativePoints(e.target.value))}
                                min={0}
                                className="w-24"
                            />
                        </div>
                        {publishError ? (
                          <p className="text-sm text-red-600" data-testid="builder-publish-error">
                            {publishError}
                          </p>
                        ) : null}
                    </div>

                    <DialogFooter>
                        <Button
                          variant="outline"
                          onClick={() => {
                            setPublishError(null)
                            setPublishSettingsOpen(false)
                          }}
                        >
                          {tCommon("cancel")}
                        </Button>
                        <Button 
                            className="bg-purple-600 hover:bg-purple-700" 
                            onClick={publishSurvey}
                            disabled={!canOpenPublishDialog}
                        >
                            <Rocket className="mr-2 h-4 w-4" />
                            {isPublished ? tBuilder("confirmRepublish") : tBuilder("confirmPublish")}
                        </Button>
                    </DialogFooter>
                </DialogContent>
            </Dialog>

            <Dialog open={isVersionPreviewOpen} onOpenChange={setIsVersionPreviewOpen}>
              <DialogContent className="sm:max-w-3xl max-h-[85vh] overflow-hidden">
                <VersionDocumentPreview
                  version={selectedVersion}
                  draftSnapshot={draftSnapshot}
                  className="max-h-[70vh] overflow-y-auto pr-1"
                />
              </DialogContent>
            </Dialog>

            <Dialog open={confirmRestoreVersionNumber != null} onOpenChange={(open) => !open && setConfirmRestoreVersionNumber(null)}>
              <DialogContent onInteractOutside={(e) => e.preventDefault()}>
                <DialogHeader>
                  <DialogTitle>{tBuilder("restoreDraftConfirmTitle")}</DialogTitle>
                  <DialogDescription>{tBuilder("restoreDraftConfirmDescription")}</DialogDescription>
                </DialogHeader>
                <DialogFooter>
                  <Button variant="outline" onClick={() => setConfirmRestoreVersionNumber(null)}>
                    {tCommon("cancel")}
                  </Button>
                  <Button
                    variant="destructive"
                    onClick={confirmRestoreVersionToDraft}
                    disabled={confirmRestoreVersionNumber == null || restoringVersionNumber != null}
                  >
                    {tBuilder("restoreDraftConfirmAction")}
                  </Button>
                </DialogFooter>
              </DialogContent>
            </Dialog>

            <Dialog open={confirmSettingsExit} onOpenChange={(open) => !open && setConfirmSettingsExit(false)}>
              <DialogContent onInteractOutside={(e) => e.preventDefault()}>
                <DialogHeader>
                  <DialogTitle>{tSurveyPage("exitSurveyTitle")}</DialogTitle>
                  <DialogDescription>{tSurveyPage("exitSurveyDescription")}</DialogDescription>
                </DialogHeader>
                <DialogFooter>
                  <Button variant="outline" onClick={() => setConfirmSettingsExit(false)}>
                    {tCommon("cancel")}
                  </Button>
                  <Button variant="destructive" onClick={confirmExitEditor}>
                    {tSurveyPage("exitWithoutSaving")}
                  </Button>
                </DialogFooter>
              </DialogContent>
            </Dialog>
                  </DndContext>
        )}
      </div>
    </div>
  );
}
