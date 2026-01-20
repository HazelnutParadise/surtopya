"use client";

import React, { useState } from "react";
import { DndContext, DragEndEvent, DragOverlay, DragStartEvent, useSensor, useSensors, PointerSensor, closestCenter } from "@dnd-kit/core";
import { arrayMove, SortableContext, verticalListSortingStrategy } from "@dnd-kit/sortable";
import { Question, QuestionType } from "@/types/survey";
import { Toolbox } from "./toolbox";
import { Canvas } from "./canvas";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Switch } from "@/components/ui/switch";
import { Save, Eye, Palette, Layout, Split, ArrowLeft, Settings, Send, History as HistoryIcon, Database, AlertTriangle, Globe, Lock, Rocket, RotateCcw } from "lucide-react";
import { Separator } from "@/components/ui/separator";
import { useRouter } from "next/navigation";
import { nanoid } from "nanoid";
import { ThemeEditor } from "./theme-editor";
import { LogicEditor } from "./logic-editor";
import { SurveyTheme, LogicRule } from "@/types/survey";
import { QuestionCard } from "./question-card";
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

export function SurveyBuilder() {
  const router = useRouter();
  const [questions, setQuestions] = useState<Question[]>([
    {
        id: 'page-1',
        type: 'section',
        title: 'Page 1',
        required: false,
        points: 0,
    }
  ]);
  const [activeId, setActiveId] = useState<string | null>(null);
  const [activeItem, setActiveItem] = useState<any>(null); // Track active item data
  const [title, setTitle] = useState("Untitled Survey");
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

  // Consent Modal State
  const [consentGiven, setConsentGiven] = useState(false);


  const [isPublic, setIsPublic] = useState(true);
  const [includeInDatasets, setIncludeInDatasets] = useState(true);
  const [isPublished, setIsPublished] = useState(false);
  const [hasUnpublishedChanges, setHasUnpublishedChanges] = useState(false);
  const [publishSettingsOpen, setPublishSettingsOpen] = useState(false);
  const [publishedCount, setPublishedCount] = useState(0);

  const notifyChange = () => {
      setIsDirty(true);
      setHasUnpublishedChanges(true);
  };

  // Settings Draft State (for cancel/unsaved changes)
  const [settingsDraft, setSettingsDraft] = useState<{
      title: string;
      description: string;
      pointsReward: number;
      isPublic: boolean;
      includeInDatasets: boolean;
  } | null>(null);
  const [confirmSettingsExit, setConfirmSettingsExit] = useState(false);

  const hasUnsavedSettings = settingsDraft ? (
      settingsDraft.title !== title || 
      settingsDraft.description !== description || 
      settingsDraft.pointsReward !== pointsReward || 
      settingsDraft.isPublic !== isPublic ||
      settingsDraft.includeInDatasets !== includeInDatasets
  ) : false;

  React.useEffect(() => {
    setMounted(true);
  }, []);

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

  const sensors = useSensors(
    useSensor(PointerSensor, {
      activationConstraint: {
        distance: 8,
      },
    })
  );

  const handleDragStart = (event: DragStartEvent) => {
    setActiveId(event.active.id as string);
    setActiveItem(event.active.data.current);
  };

  const handleDragOver = (event: any) => {
    const { active, over } = event;
    if (!over) return;

    // If dragging a toolbox item over the canvas
    if (active.data.current?.isToolboxItem) {
      const isOverCanvas = over.id === 'canvas-droppable' || questions.some(q => q.id === over.id);
      
      if (isOverCanvas) {
        // Check if we already have a placeholder
        const hasPlaceholder = questions.some(q => q.id === 'placeholder');
        
        if (!hasPlaceholder) {
          const type = active.data.current.type as QuestionType;
          const placeholder: Question = {
            id: 'placeholder',
            type,
            title: "New Question",
            required: false,
            points: 10,
            options: type === 'single' || type === 'multi' || type === 'select' ? ['Option 1', 'Option 2'] : undefined,
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
        title: "New Question",
        required: false,
        points: 10,
        options: type === 'single' || type === 'multi' || type === 'select' ? ['Option 1', 'Option 2'] : undefined,
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
        title: `${item.title} (Copy)`,
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
        title: "New Page",
        required: false,
        points: 0,
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
        return 'Logic jump points to a deleted question';
      }
      
      // Check if destination is AFTER current question (forward jump only)
      if (destIndex <= questionIndex) {
        return 'Logic jump points to a question before or at current position';
      }
    }
    
    return null;
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
    window.open('/survey/preview', '_blank');
  };

  if (!mounted) return null;

  if (!consentGiven) {
    return (
      <Dialog open={true} onOpenChange={(open) => { if (!open) router.push('/dashboard'); }}>
        <DialogContent className="sm:max-w-md" onInteractOutside={(e) => e.preventDefault()}>
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2 text-xl">
              <Database className="h-5 w-5 text-purple-600" />
              Data Usage Consent
            </DialogTitle>
            <DialogDescription className="text-base pt-2">
              Before you start building, please note how your survey data will be used:
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4 py-4">
            <div className="flex gap-3">
              <div className="h-8 w-8 rounded-full bg-purple-100 dark:bg-purple-900/30 flex items-center justify-center shrink-0">
                <Layout className="h-4 w-4 text-purple-600" />
              </div>
              <p className="text-sm text-gray-600 dark:text-gray-400">
                <strong>De-identification:</strong> All survey responses are automatically de-identified to protect participant privacy.
              </p>
            </div>
            <div className="flex gap-3">
              <div className="h-8 w-8 rounded-full bg-blue-100 dark:bg-blue-900/30 flex items-center justify-center shrink-0">
                <Globe className="h-4 w-4 text-blue-600" />
              </div>
              <p className="text-sm text-gray-600 dark:text-gray-400">
                <strong>Marketplace:</strong> By default, de-identified datasets are contributed to our Open Marketplace to keep Surtopya free.
              </p>
            </div>
            <div className="flex gap-3">
              <div className="h-8 w-8 rounded-full bg-amber-100 dark:bg-amber-900/30 flex items-center justify-center shrink-0">
                <Lock className="h-4 w-4 text-amber-600" />
              </div>
              <p className="text-sm text-gray-600 dark:text-gray-400">
                <strong>Paid Opt-out:</strong> Pro users can opt-out of data sharing for non-public surveys.
              </p>
            </div>
          </div>
          <DialogFooter>
            <Button variant="ghost" onClick={() => router.push('/dashboard')}>Cancel</Button>
            <Button className="bg-purple-600 hover:bg-purple-700 text-white" onClick={() => setConsentGiven(true)}>
              I Understand and Agree
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    );
  }

  return (
    <div className="flex h-screen flex-col bg-gray-50 dark:bg-gray-950">
      {/* Header */}
      <div className="bg-white border-b border-gray-200 px-4 py-2 flex items-center justify-between shadow-sm z-10 dark:bg-gray-900 dark:border-gray-800">
           <div className="flex items-center gap-4">
                <Button variant="ghost" size="icon" onClick={() => router.push('/dashboard')}>
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
                        placeholder="Untitled Survey"
                    />
                    <span className="text-[10px] text-gray-400 capitalize px-1">{isPublished ? 'Published' : 'Draft'} • {questions.filter(q => q.type !== 'section').length} Questions</span>
                </div>
           </div>
           <div className="flex items-center gap-3">
                <div className="flex items-center bg-gray-100 dark:bg-gray-800 rounded-lg p-1">
                    <Button 
                        variant={viewMode === 'builder' ? 'secondary' : 'ghost'} 
                        size="sm" 
                        onClick={() => setViewMode('builder')} 
                        className={`text-xs h-7 ${viewMode === 'builder' ? 'bg-white shadow-sm' : ''}`}
                    >
                        Builder
                    </Button>
                    <Button
                        variant={viewMode === 'settings' ? 'secondary' : 'ghost'}
                        size="sm"
                        onClick={() => {
                            if (isDirty) notifyChange();
                            // Initialize settings draft with current values
                            setSettingsDraft({
                                title,
                                description,
                                pointsReward,
                                isPublic,
                                includeInDatasets,
                            });
                            setViewMode('settings');
                        }}
                        className={`text-xs h-7 ${viewMode === 'settings' ? 'bg-white shadow-sm' : ''}`}
                    >
                        Settings
                    </Button>
                </div>
               <Separator orientation="vertical" className="h-6" />
               <span className="flex items-center gap-1 text-xs text-gray-500">
                      <HistoryIcon className="h-3 w-3" />
                      <TooltipProvider>
                          <Tooltip>
                              <TooltipTrigger asChild>
                                  <span className="cursor-help">{calculateEstimatedTime(questions)}m</span>
                              </TooltipTrigger>
                              <TooltipContent>
                                  <p>Estimated time to complete the survey</p>
                              </TooltipContent>
                          </Tooltip>
                      </TooltipProvider>
               </span>
               <Button size="sm" variant="outline" onClick={() => setActiveSidebar('theme')} className="h-8">
                      <Palette className="mr-2 h-3 w-3" /> Theme
               </Button>
               <Button 
                      size="sm" 
                      variant="outline"
                      onClick={() => {
                          setIsDirty(false);
                          // Mock save logic
                          alert("Survey saved successfully!");
                      }} 
                      className="h-8"
                      disabled={!isDirty}
                 >
                      <Save className="mr-2 h-3 w-3" /> Save
               </Button>
               <Button size="sm" variant="outline" onClick={() => openPreview()} className="h-8">
                      <Eye className="mr-2 h-3 w-3" /> Preview
               </Button>
               <Button 
                      size="sm" 
                      onClick={() => setPublishSettingsOpen(true)} 
                      className={`h-8 ${hasUnpublishedChanges ? "bg-purple-600 hover:bg-purple-700 text-white" : "bg-gray-100 text-gray-400 cursor-not-allowed"}`}
                      disabled={!hasUnpublishedChanges}
                  >
                      <Send className="mr-2 h-3 w-3" />
                      {isPublished ? "Republish" : "Publish"}
               </Button>
           </div>
      </div>

      {/* Main Content */}
      <div className="flex-1 overflow-hidden flex flex-col">
        {/* Settings View */}
        {viewMode === 'settings' ? (
            <div className="flex-1 overflow-y-auto bg-gray-50 dark:bg-gray-950 p-8">
                <div className="mx-auto max-w-2xl bg-white dark:bg-gray-900 rounded-lg shadow-sm border border-gray-200 dark:border-gray-800 p-8">
                    <h2 className="text-2xl font-bold mb-6">Survey Settings</h2>
                    <div className="space-y-6">
                        <div className="space-y-2">
                            <label className="text-sm font-medium">Survey Title</label>
                            <Input 
                            value={settingsDraft?.title || ''} 
                            onChange={(e) => setSettingsDraft(prev => prev ? ({ ...prev, title: e.target.value }) : null)}
                            placeholder="Enter survey title"
                        />    </div>
                        <div className="space-y-2">
                            <label className="text-sm font-medium">Description</label>
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
                                        title="Bold"
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
                                        title="Italic"
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
                                            const url = prompt('Enter URL:', 'https://');
                                            if (url) {
                                            const newText = text.substring(0, start) + '[' + (selected || 'link text') + '](' + url + ')' + text.substring(end);
                                            setSettingsDraft(prev => prev ? ({ ...prev, description: newText }) : null);
                                        }
                                    }}    
                                        className="p-1.5 rounded hover:bg-gray-200 dark:hover:bg-gray-800 text-gray-600 dark:text-gray-400"
                                        title="Add Link"
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
                                        title="Bullet List"
                                    >
                                        <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><line x1="8" x2="21" y1="6" y2="6"/><line x1="8" x2="21" y1="12" y2="12"/><line x1="8" x2="21" y1="18" y2="18"/><line x1="3" x2="3.01" y1="6" y2="6"/><line x1="3" x2="3.01" y1="12" y2="12"/><line x1="3" x2="3.01" y1="18" y2="18"/></svg>
                                    </button>
                                </div>
                                {/* Textarea */}
                                <textarea 
                                    id="description-textarea"
                                value={settingsDraft?.description || ''} 
                                onChange={(e) => setSettingsDraft(prev => prev ? ({ ...prev, description: e.target.value }) : null)}
                                placeholder="Describe what this survey is about..."
                                    className="w-full min-h-[100px] bg-transparent px-3 py-2 text-sm placeholder:text-gray-500 focus:outline-none resize-none"
                                />
                            </div>
                            <p className="text-xs text-gray-500">Supports Markdown formatting</p>
                        </div>

                        <div className="grid grid-cols-2 gap-4">
                            <div className="space-y-2">
                                <label className="text-sm font-medium">Points Reward</label>
                                <Input 
                                    type="number" 
                                value={settingsDraft?.pointsReward || 0} 
                                onChange={(e) => setSettingsDraft(prev => prev ? ({ ...prev, pointsReward: Number(e.target.value) }) : null)}
                                min={0}
                                />
                                <p className="text-xs text-gray-500">Points awarded to respondents</p>
                            </div>
                            <div className="space-y-2">
                                <label className="text-sm font-medium">Expiration Date</label>
                                <Input 
                                    type="date" 
                                    defaultValue=""
                                    className="dark:bg-gray-800"
                                />
                                <p className="text-xs text-gray-500 italic">Optional</p>
                            </div>
                        </div>

                        <div className="space-y-2">
                            <label className="text-sm font-medium">Visibility</label>
                            <div className="flex bg-gray-100 dark:bg-gray-800 p-1 rounded-lg w-fit">
                                <button
                                    onClick={() => setSettingsDraft(prev => prev ? ({ ...prev, isPublic: true, includeInDatasets: true }) : null)}
                                    className={`px-4 py-1.5 rounded-md text-sm font-medium transition-all ${settingsDraft?.isPublic ? 'bg-white dark:bg-gray-700 shadow-sm text-purple-600' : 'text-gray-500'}`}
                                >
                                    Public
                                </button>
                                <button
                                    onClick={() => setSettingsDraft(prev => prev ? ({ ...prev, isPublic: false, includeInDatasets: false }) : null)}
                                    className={`px-4 py-1.5 rounded-md text-sm font-medium transition-all ${!settingsDraft?.isPublic ? 'bg-white dark:bg-gray-700 shadow-sm text-purple-600' : 'text-gray-500'}`}
                                >
                                    Non-public
                                </button>
                            </div>
                            <p className="text-xs text-gray-500 mt-1 leading-relaxed">
                                {settingsDraft?.isPublic 
                                    ? 'Visible in marketplace and searchable by search engines.' 
                                    : 'Hidden from marketplace. Link only. (Manual Opt-in still available for marketplace sharing)'}
                            </p>
                        </div>

                        <Separator className="dark:bg-gray-800" />

                        <div className="space-y-4">
                            <div className="flex items-center justify-between">
                                <div className="space-y-0.5">
                                    <label className="text-sm font-bold flex items-center gap-2">
                                        <Database className="h-4 w-4 text-purple-600" />
                                        Include de-identified data in Marketplace
                                    </label>
                                    <p className="text-xs text-gray-500 max-w-[400px]">
                                        {settingsDraft?.isPublic 
                                            ? 'Public surveys are automatically enrolled. Opt-out requires Paid Membership.' 
                                            : 'Contribute de-identified results to our marketplace. (Manual Opt-in required for non-public surveys).'}
                                    </p>
                                </div>
                                <div className="flex items-center gap-3">
                                    <Switch 
                                        checked={settingsDraft?.includeInDatasets}
                                        disabled={settingsDraft?.isPublic} // Simplified: Public must opt-in unless paid (mock-disabled)
                                        onCheckedChange={(checked: boolean) => setSettingsDraft(prev => prev ? ({ ...prev, includeInDatasets: checked }) : null)}
                                    />
                                </div>
                            </div>
                            {settingsDraft?.isPublic && (
                                <div className="p-3 rounded-lg bg-purple-50 dark:bg-purple-900/20 border border-purple-100 dark:border-purple-800 flex items-start gap-3">
                                    <AlertTriangle className="h-4 w-4 text-purple-600 mt-0.5" />
                                    <p className="text-xs text-purple-700 dark:text-purple-400">
                                        <strong>Dataset Enrollment</strong> is mandatory for free users publishing <strong>Public</strong> surveys. 
                                        Upgrade to Pro to publish public surveys without contributing data.
                                    </p>
                                </div>
                            )}
                        </div>
                        
                        <div className="pt-6 border-t border-gray-200 dark:border-gray-800 flex justify-end gap-3">
                             <Button variant="ghost" onClick={() => setViewMode('builder')} className="text-gray-500 hover:text-gray-700">
                                Cancel
                             </Button>
                             <Button 
                                disabled={!hasUnsavedSettings}
                                onClick={() => {
                                 if (settingsDraft) {
                                     setTitle(settingsDraft.title);
                                     setDescription(settingsDraft.description);
                                     setPointsReward(settingsDraft.pointsReward);
                                     setIsPublic(settingsDraft.isPublic);
                                     setIncludeInDatasets(settingsDraft.includeInDatasets);
                                     notifyChange();
                                     setViewMode('builder');
                                 }
                             }} className={hasUnsavedSettings ? "bg-purple-600 hover:bg-purple-700 text-white" : "bg-gray-200 text-gray-500 hover:bg-gray-200"}>
                                Save Changes
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
                            {activeSidebar === 'toolbox' ? 'Toolbox' : 'Theme'}
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

                    {activeSidebar === 'toolbox' && (
                        <div className="mt-8 p-4 rounded-xl bg-purple-50 dark:bg-purple-900/10 border border-purple-100 dark:border-purple-800/50">
                            <div className="flex items-center gap-2 text-purple-600 font-bold text-xs uppercase tracking-widest mb-2">
                                <Database className="h-3.5 w-3.5" />
                                Dataset Notice
                            </div>
                            <p className="text-[11px] text-purple-700 dark:text-purple-400 leading-relaxed">
                                Responses to this survey will be de-identified and added to our <strong>Open Dataset Marketplace</strong>. 
                                This helps us keep the platform free for everyone.
                            </p>
                        </div>
                    )}
                  </aside>

                  {/* Canvas */}
                  <main 
                    className="flex-1 overflow-y-auto p-8 transition-colors duration-200"
                    style={{ 
                        backgroundColor: theme.backgroundColor,
                        fontFamily: theme.fontFamily === 'serif' ? 'serif' : theme.fontFamily === 'mono' ? 'monospace' : theme.fontFamily === 'comic' ? '"Comic Sans MS", cursive, sans-serif' : 'inherit'
                    }}
                  >
                    <div className="mx-auto max-w-3xl" style={{ '--primary': theme.primaryColor } as React.CSSProperties}>
                      <SortableContext 
                        items={questions.map(q => q.id).filter(id => {
                            if (!activeItem) return true;
                            // If dragging a section, only sections are sortable targets
                            if (activeItem.type === 'section') {
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
                               Add New Page
                            </div>
                            <span className="text-[10px] font-normal opacity-60">Pages help organize long surveys into sections</span>
                         </Button>
                       </div>
                    </div>
                  </main>
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
                            <DialogTitle>Delete {questions.find(q => q.id === deletingQuestionId)?.type === 'section' ? 'Page' : 'Question'}?</DialogTitle>
                            <DialogDescription>
                                Are you sure you want to delete this {questions.find(q => q.id === deletingQuestionId)?.type === 'section' ? 'page and all questions inside it' : 'question'}? This action cannot be undone.
                            </DialogDescription>
                        </DialogHeader>
                        <DialogFooter>
                            <Button variant="outline" onClick={() => setDeletingQuestionId(null)}>Cancel</Button>
                            <Button variant="destructive" onClick={confirmDelete}>Delete</Button>
                        </DialogFooter>
                    </DialogContent>
                </Dialog>
                
                <DragOverlay dropAnimation={null}>
                  {activeId ? (
                     activeItem?.isToolboxItem ? (
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
                            {activeItem.type === 'section' ? (
                                <div className="flex flex-col mb-8 rounded-xl border border-gray-200 bg-white/50 p-4 shadow-2xl dark:border-gray-800 dark:bg-gray-900/50 rotate-2 opacity-90 cursor-grabbing ring-2 ring-purple-500">
                                    <QuestionCard 
                                        question={activeItem} 
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
                                            const index = questions.findIndex(q => q.id === activeItem.id);
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
                                    question={activeItem} 
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

            <Dialog open={publishSettingsOpen} onOpenChange={setPublishSettingsOpen}>
                <DialogContent>
                    <DialogHeader>
                        <DialogTitle>Publish Settings</DialogTitle>
                        <DialogDescription>Configured visibility and dataset options before {isPublished ? 'republishing' : 'publishing'}.</DialogDescription>
                    </DialogHeader>
                    
                    <div className="space-y-6 py-4">
                        {publishedCount === 0 && (
                            <div className="p-3 bg-blue-50 text-blue-700 text-sm rounded-lg flex gap-2">
                                <AlertTriangle className="h-5 w-5 shrink-0" />
                                <div>
                                    <strong>First Publish Notice:</strong> Once published, dataset sharing settings will be locked. Non-public surveys cannot be switched to public later.
                                </div>
                            </div>
                        )}

                        <div className="flex items-center justify-between">
                            <div className="space-y-0.5">
                                <label className="text-sm font-medium flex items-center gap-2">
                                    {isPublic ? <Globe className="h-4 w-4 text-emerald-500" /> : <Lock className="h-4 w-4 text-amber-500" />}
                                    Visibility
                                </label>
                                <p className="text-xs text-gray-500">
                                    {isPublic ? "Visible to everyone in the marketplace" : "Only accessible via direct link"}
                                </p>
                            </div>
                            <div className="flex items-center gap-2">
                                <span className="text-xs font-medium">{isPublic ? "Public" : "Non-public"}</span>
                                <Switch 
                                    checked={isPublic}
                                    disabled={publishedCount > 0 && !isPublic} // Cannot switch to Public if already published as Non-public
                                    onCheckedChange={(checked) => {
                                        setIsPublic(checked);
                                        // Auto-force dataset logic
                                        if (checked) {
                                            setIncludeInDatasets(true);
                                        } else {
                                            setIncludeInDatasets(false);
                                        }
                                    }}
                                />
                            </div>
                        </div>

                        <div className="flex items-center justify-between opacity-100">
                             <div className="space-y-0.5">
                                <label className="text-sm font-medium flex items-center gap-2">
                                    <Database className="h-4 w-4 text-purple-500" />
                                    Dataset Contributions
                                </label>
                                <p className="text-xs text-gray-500">
                                    {isPublic 
                                        ? "Public surveys must contribute to the dataset marketplace." 
                                        : "Non-public surveys can opt-in to contribute to the dataset marketplace."}
                                </p>
                            </div>
                            <Switch 
                                checked={includeInDatasets}
                                disabled={isPublic} // Only disabled (forced true) if Public
                                onCheckedChange={setIncludeInDatasets}
                            />
                        </div>

                        <div className="flex items-center justify-between">
                            <div className="space-y-0.5">
                                <label className="text-sm font-medium">Points Reward</label>
                                <p className="text-xs text-gray-500">Points awarded to respondents</p>
                            </div>
                            <Input 
                                type="number" 
                                value={pointsReward} 
                                onChange={(e) => setPointsReward(parseInt(e.target.value) || 0)}
                                className="w-24"
                            />
                        </div>
                    </div>

                    <DialogFooter>
                        <Button variant="outline" onClick={() => setPublishSettingsOpen(false)}>Cancel</Button>
                        <Button 
                            className="bg-purple-600 hover:bg-purple-700" 
                            onClick={() => {
                                setIsPublished(true);
                                setHasUnpublishedChanges(false);
                                setPublishedCount(prev => prev + 1);
                                setPublishSettingsOpen(false);
                                // Here you would trigger API call
                                notifyChange(); // Just to clear dirty state in real app
                                setIsDirty(false); // Clear dirty
                            }}
                        >
                            <Rocket className="mr-2 h-4 w-4" />
                            Confirm & {isPublished ? 'Republish' : 'Publish'}
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
