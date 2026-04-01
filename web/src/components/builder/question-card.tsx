import React from "react";
import { DndContext, DragEndEvent, PointerSensor, useSensor, useSensors } from "@dnd-kit/core";
import { arrayMove, SortableContext, useSortable, verticalListSortingStrategy } from "@dnd-kit/sortable";
import { CSS } from "@dnd-kit/utilities";
import { Question, QuestionOption } from "@/types/survey";
import { Card, CardHeader } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Switch } from "@/components/ui/switch"; // Need to install switch
import { GripVertical, Trash2, Plus, X, Copy, AlertTriangle, Check, Circle, ChevronUp, ChevronDown } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import { useTranslations } from "next-intl";
import {
  createDefaultQuestionOptions,
  getQuestionOptionLabel,
  isOtherQuestionOption,
  isOtherTextRequiredQuestionOption,
  normalizeQuestionOptions,
} from "@/lib/question-options";
import { builderCollisionDetection } from "@/components/builder/survey-builder-drag";

type ChoiceQuestionType = Extract<Question["type"], "single" | "multi" | "select">

const renderChoiceMarker = (type: Question["type"]) => {
  if (type === "multi") {
    return (
      <div
        className="flex h-5 w-5 items-center justify-center rounded-md border-2 border-emerald-500 bg-emerald-50 text-emerald-600 shadow-sm"
        data-testid="question-choice-marker-multi"
      >
        <Check className="h-3.5 w-3.5" />
      </div>
    )
  }

  return (
    <div
      className="flex h-5 w-5 items-center justify-center rounded-full border-2 border-sky-500 bg-sky-50 text-sky-600 shadow-sm"
      data-testid="question-choice-marker-single"
    >
      <Circle className="h-2.5 w-2.5 fill-current stroke-none" />
    </div>
  )
}

interface SortableOptionRowProps {
  option: QuestionOption & { id: string }
  questionType: ChoiceQuestionType
  canMoveUp: boolean
  canMoveDown: boolean
  onMoveUp: (optionId: string) => void
  onMoveDown: (optionId: string) => void
  onOptionChange: (optionId: string, value: string) => void
  onToggleOtherOption: (optionId: string) => void
  onToggleRequireOtherText: (optionId: string, checked: boolean) => void
  onToggleExclusiveOption: (optionId: string) => void
  onRemoveOption: (optionId: string) => void
  hasExclusiveOptionWarning: boolean
  tBuilder: ReturnType<typeof useTranslations>
}

function SortableOptionRow({
  option,
  questionType,
  canMoveUp,
  canMoveDown,
  onMoveUp,
  onMoveDown,
  onOptionChange,
  onToggleOtherOption,
  onToggleRequireOtherText,
  onToggleExclusiveOption,
  onRemoveOption,
  hasExclusiveOptionWarning,
  tBuilder,
}: SortableOptionRowProps) {
  const {
    attributes,
    listeners,
    setNodeRef,
    transform,
    transition,
    isDragging,
  } = useSortable({ id: option.id })

  const style = {
    transform: CSS.Transform.toString(transform),
    transition,
  }

  return (
    <div ref={setNodeRef} style={style} className={`space-y-2 ${isDragging ? "z-10" : ""}`}>
      <div className={`flex items-center gap-2 rounded-lg ${isDragging ? "bg-purple-50" : ""}`}>
        <div
          {...attributes}
          {...listeners}
          aria-label={tBuilder("reorderOption")}
          className="hidden cursor-grab items-center self-stretch px-1 text-gray-400 hover:text-purple-600 active:cursor-grabbing md:flex"
        >
          <GripVertical className="h-4 w-4" />
        </div>
        <div className="flex flex-col gap-2 md:hidden">
          <Button
            type="button"
            variant="ghost"
            size="icon"
            className="h-8 w-8 text-gray-400 hover:text-purple-600 hover:bg-purple-50"
            onClick={() => onMoveUp(option.id)}
            disabled={!canMoveUp}
            aria-label={tBuilder("moveOptionUp")}
            data-testid={`option-move-up-${option.id}`}
          >
            <ChevronUp className="h-4 w-4" />
          </Button>
          <Button
            type="button"
            variant="ghost"
            size="icon"
            className="h-8 w-8 text-gray-400 hover:text-purple-600 hover:bg-purple-50"
            onClick={() => onMoveDown(option.id)}
            disabled={!canMoveDown}
            aria-label={tBuilder("moveOptionDown")}
            data-testid={`option-move-down-${option.id}`}
          >
            <ChevronDown className="h-4 w-4" />
          </Button>
        </div>
        {renderChoiceMarker(questionType)}
        <Input
          value={getQuestionOptionLabel(option)}
          onChange={(e) => onOptionChange(option.id, e.target.value)}
          className="h-8 text-sm"
        />
        <Button
          type="button"
          variant={isOtherQuestionOption(option) ? "secondary" : "outline"}
          size="sm"
          className="h-8 shrink-0"
          onClick={() => onToggleOtherOption(option.id)}
        >
          {tBuilder("otherOptionToggle")}
        </Button>
        {questionType === "multi" ? (
          <Button
            type="button"
            variant={option.exclusive ? "secondary" : "outline"}
            size="sm"
            className={`h-8 shrink-0 ${
              hasExclusiveOptionWarning ? "border-red-300 text-red-600 hover:bg-red-50" : ""
            }`}
            onClick={() => onToggleExclusiveOption(option.id)}
          >
            {tBuilder("exclusiveOptionToggle")}
          </Button>
        ) : null}
        <Button
          variant="ghost"
          size="icon"
          className="h-8 w-8 text-gray-400 hover:text-red-500"
          onClick={() => onRemoveOption(option.id)}
        >
          <X className="h-4 w-4" />
        </Button>
      </div>
      {isOtherQuestionOption(option) ? (
        <div className="ml-6 flex items-center justify-between rounded-md border border-dashed border-gray-200 px-3 py-2">
          <span className="text-xs text-gray-600">{tBuilder("otherTextRequiredToggle")}</span>
          <Switch
            checked={isOtherTextRequiredQuestionOption(option)}
            onCheckedChange={(checked) => onToggleRequireOtherText(option.id, checked)}
          />
        </div>
      ) : null}
    </div>
  )
}

interface QuestionCardProps {
  question: Question;
  isFirstSection?: boolean;
  laterSectionOptions?: Pick<Question, "id" | "title">[];
  onUpdate: (id: string, updates: Partial<Question>) => void;
  onDelete: (id: string) => void;
  onDuplicate: (id: string) => void;
  onOpenLogic: (id: string) => void;
  onMoveUp?: (id: string) => void;
  onMoveDown?: (id: string) => void;
  canMoveUp?: boolean;
  canMoveDown?: boolean;
  isHidden?: boolean;
  isOverlay?: boolean;
  hasLogic?: boolean;
  hasLogicWarning?: boolean;
  hasCriticalLogicWarning?: boolean;
  logicWarningMessage?: string;
  hasIssueWarning?: boolean;
  issueWarningMessage?: string;
  hasSelectionBoundsWarning?: boolean;
  hasExclusiveOptionWarning?: boolean;
}

export function QuestionCard({
  question,
  isFirstSection,
  laterSectionOptions = [],
  onUpdate,
  onDelete,
  onDuplicate,
  onOpenLogic,
  onMoveUp,
  onMoveDown,
  canMoveUp = false,
  canMoveDown = false,
  isHidden,
  isOverlay,
  hasLogic,
  hasLogicWarning,
  hasCriticalLogicWarning = false,
  logicWarningMessage,
  hasIssueWarning = false,
  issueWarningMessage,
  hasSelectionBoundsWarning = false,
  hasExclusiveOptionWarning = false,
}: QuestionCardProps) {
  const tBuilder = useTranslations("SurveyBuilder");
  const tQuestion = useTranslations("QuestionTypes");
  const hasConfiguredLogic = hasLogic ?? Boolean(question.logic?.length);
  const hasLaterSectionOptions = laterSectionOptions.length > 0;
  const hasValidSpecificDestination = Boolean(
    question.defaultDestinationQuestionId === "end_survey" ||
      (question.defaultDestinationQuestionId &&
        laterSectionOptions.some((option) => option.id === question.defaultDestinationQuestionId))
  );
  const {
    attributes,
    listeners,
    setNodeRef,
    transform,
    transition,
    isDragging,
  } = useSortable({ id: question.id });

  const style = {
    transform: CSS.Transform.toString(transform),
    transition,
    opacity: isDragging && !isOverlay ? 0 : 1,
  };

  const isChoiceQuestion =
    question.type === "single" || question.type === "multi" || question.type === "select"
  const choiceQuestionType = isChoiceQuestion ? (question.type as ChoiceQuestionType) : null
  const questionOptions = React.useMemo(
    () =>
      (normalizeQuestionOptions(question.options) || []).map((option, index) => ({
        ...option,
        id: option.id ?? `${question.id}-option-${index}`,
      })),
    [question.id, question.options]
  )

  const optionSensors = useSensors(
    useSensor(PointerSensor, {
      activationConstraint: {
        distance: 4,
      },
    })
  )

  const updateOptions = React.useCallback(
    (updater: (options: Array<QuestionOption & { id: string }>) => Array<QuestionOption & { id: string }>) => {
      onUpdate(question.id, { options: updater(questionOptions) })
    },
    [onUpdate, question.id, questionOptions]
  )

  const handleOptionChange = (optionId: string, value: string) => {
    if (!isChoiceQuestion) return
    updateOptions((options) =>
      options.map((option) => (option.id === optionId ? { ...option, label: value } : option))
    )
  }

  const addOption = () => {
    if (!isChoiceQuestion) return;
    onUpdate(question.id, {
      options: [
        ...questionOptions,
        ...createDefaultQuestionOptions([tBuilder("optionLabel", { index: questionOptions.length + 1 })]),
      ],
    });
  };

  const removeOption = (optionId: string) => {
    if (!isChoiceQuestion) return
    updateOptions((options) => options.filter((option) => option.id !== optionId))
  }

  const toggleOtherOption = (optionId: string) => {
    if (!isChoiceQuestion) return
    updateOptions((options) =>
      options.map((option) => ({
        ...option,
        isOther: option.id === optionId ? !option.isOther : false,
        requireOtherText:
          option.id === optionId ? (option.isOther ? false : option.requireOtherText === true) : false,
      }))
    )
  }

  const toggleRequireOtherText = (optionId: string, checked: boolean) => {
    if (!isChoiceQuestion) return
    updateOptions((options) =>
      options.map((option) => {
        if (option.id !== optionId) return option
        return {
          ...option,
          requireOtherText: option.isOther ? checked : false,
        }
      })
    )
  }

  const toggleExclusiveOption = (optionId: string) => {
    if (!isChoiceQuestion || question.type !== "multi") return;
    const nextExclusive = !questionOptions.find((option) => option.id === optionId)?.exclusive;
    updateOptions((options) =>
      options.map((option) => ({
        ...option,
        exclusive: option.id === optionId ? nextExclusive : false,
      }))
    )
  }

  const moveOption = (optionId: string, direction: "up" | "down") => {
    if (!isChoiceQuestion) return
    const currentIndex = questionOptions.findIndex((option) => option.id === optionId)
    if (currentIndex === -1) return

    const nextIndex = direction === "up" ? currentIndex - 1 : currentIndex + 1
    if (nextIndex < 0 || nextIndex >= questionOptions.length) return

    onUpdate(question.id, {
      options: arrayMove(questionOptions, currentIndex, nextIndex),
    })
  }

  const handleOptionDragEnd = (event: DragEndEvent) => {
    if (!isChoiceQuestion) return

    const { active, over } = event
    if (!over || active.id === over.id) return

    const oldIndex = questionOptions.findIndex((option) => option.id === active.id)
    const newIndex = questionOptions.findIndex((option) => option.id === over.id)
    if (oldIndex === -1 || newIndex === -1) return

    onUpdate(question.id, {
      options: arrayMove(questionOptions, oldIndex, newIndex),
    })
  }

  const handleSelectionBoundChange = (field: "minSelections" | "maxSelections", value: string) => {
    const trimmed = value.trim();
    if (trimmed.length === 0) {
      onUpdate(question.id, { [field]: undefined });
      return;
    }

    const parsed = Number.parseInt(trimmed, 10);
    onUpdate(question.id, { [field]: Number.isFinite(parsed) ? parsed : undefined });
  };

  return (
    <div 
      ref={setNodeRef} 
      style={style} 
      className={`relative group mb-6 ${isHidden ? 'hidden' : ''}`}
    >
      <Card className={`transition-all duration-200 ${
            isDragging || isOverlay ? 'shadow-2xl ring-2 ring-purple-500 rotate-2 opacity-80' : 'hover:shadow-md'
        } ${
            question.type === 'section' 
                ? 'bg-[var(--primary)] text-[var(--primary-foreground)] border-none'
                : ''
        }`}>
        <CardHeader className="flex flex-row items-start gap-4 space-y-0 p-4 relative">
          <div 
            {...attributes} 
            {...listeners} 
            className={`mt-2 hidden md:block cursor-grab active:cursor-grabbing ${question.type === 'section' ? 'text-[var(--primary-foreground)] opacity-50 hover:opacity-100' : 'text-gray-400 hover:text-gray-600'}`}
          >
            <GripVertical className="h-5 w-5" />
          </div>
        
        <div className="flex-1 space-y-4">
          <div className="flex items-center gap-3">
            <Input 
              value={question.title} 
              onChange={(e) => onUpdate(question.id, { title: e.target.value })}
              className={`font-semibold border-transparent focus:border-white/50 bg-transparent px-3 h-auto ${
                  question.type === 'section' 
                    ? 'min-h-14 py-3 text-2xl md:text-2xl text-[var(--primary-foreground)] w-full text-center placeholder:text-[var(--primary-foreground)] placeholder:opacity-50'
                    : 'min-h-12 py-2 text-xl md:text-xl hover:border-gray-200 focus:border-purple-500'
              }`}
              placeholder={question.type === 'section' ? tBuilder("pageTitlePlaceholder") : tBuilder("questionTitlePlaceholder")}
            />
            {question.type !== 'section' && (
                <Badge variant="outline" className="capitalize text-xs text-gray-500">
                {tQuestion(question.type)}
                </Badge>
            )}
            {hasConfiguredLogic && !hasLogicWarning ? (
              <Badge
                variant="secondary"
                className="border border-blue-200 bg-blue-50 text-[11px] font-medium text-blue-700 dark:border-blue-900/50 dark:bg-blue-950/30 dark:text-blue-300"
                data-testid="question-logic-indicator"
              >
                {tBuilder("logicJumps")}
              </Badge>
            ) : null}
            {hasIssueWarning && (
              <TooltipProvider>
                <Tooltip>
                  <TooltipTrigger asChild>
                    <div className="flex items-center gap-1 text-red-500" data-testid="question-warning-indicator">
                      <AlertTriangle className="h-5 w-5" />
                    </div>
                  </TooltipTrigger>
                  <TooltipContent>
                    <p className="text-sm">{issueWarningMessage || logicWarningMessage || tBuilder("logicWarningGeneric")}</p>
                  </TooltipContent>
                </Tooltip>
              </TooltipProvider>
            )}
          </div>
          
          {question.type === 'section' && (
            <div className="space-y-3">
              <Input 
                  value={question.description || ''} 
                  onChange={(e) => onUpdate(question.id, { description: e.target.value })}
                  className="text-[var(--primary-foreground)] border-transparent focus:border-white/50 bg-transparent px-2 h-auto py-1 text-sm w-full text-center placeholder:text-[var(--primary-foreground)] placeholder:opacity-40"
                  placeholder={tBuilder("pageDescriptionPlaceholder")}
              />
              <div className="rounded-lg border border-white/20 bg-white/10 px-4 py-3 text-left">
                <div className="text-xs font-medium text-[var(--primary-foreground)] opacity-90">
                  {tBuilder("defaultPageJump")}
                </div>
                <div className="mt-3 flex flex-wrap items-center gap-2">
                  <span className="text-xs text-[var(--primary-foreground)] opacity-80">
                    {tBuilder("pageNavigationMode")}
                  </span>
                  <div
                    role="group"
                    aria-label={tBuilder("pageNavigationMode")}
                    className="inline-flex rounded-lg border border-white/20 bg-white/10 p-1"
                  >
                    <Button
                      type="button"
                      size="sm"
                      variant="ghost"
                      className={`h-8 rounded-md border-0 ${
                        !hasValidSpecificDestination
                          ? "bg-white text-gray-900 hover:bg-white/90"
                          : "text-[var(--primary-foreground)] hover:bg-white/10 hover:text-[var(--primary-foreground)]"
                      }`}
                      onClick={() => onUpdate(question.id, { defaultDestinationQuestionId: undefined })}
                    >
                      {tBuilder("pageNavigationNext")}
                    </Button>
                    <Button
                      type="button"
                      size="sm"
                      variant="ghost"
                      disabled={!hasLaterSectionOptions}
                      className={`h-8 rounded-md border-0 ${
                        hasValidSpecificDestination
                          ? "bg-white text-gray-900 hover:bg-white/90"
                          : "text-[var(--primary-foreground)] hover:bg-white/10 hover:text-[var(--primary-foreground)]"
                      }`}
                      onClick={() => {
                        const fallbackId = laterSectionOptions[0]?.id;
                        if (fallbackId) {
                          onUpdate(question.id, { defaultDestinationQuestionId: fallbackId });
                        }
                      }}
                    >
                      {tBuilder("pageNavigationSpecific")}
                    </Button>
                  </div>
                  {hasValidSpecificDestination ? (
                    <select
                      className="h-8 rounded-md border border-white/20 bg-white/10 px-2 text-xs text-[var(--primary-foreground)]"
                      value={question.defaultDestinationQuestionId}
                      onChange={(event) => onUpdate(question.id, { defaultDestinationQuestionId: event.target.value || undefined })}
                    >
                      <option value="end_survey" className="text-gray-900">
                        {tBuilder("pageNavigationEndSurvey")}
                      </option>
                      {laterSectionOptions.map((option) => (
                        <option key={option.id} value={option.id} className="text-gray-900">
                          {option.title}
                        </option>
                      ))}
                    </select>
                  ) : null}
                </div>
              </div>
            </div>
          )}

          {/* Question Body based on Type */}
          <div className="pl-2">
            {(question.type === 'single' || question.type === 'multi' || question.type === 'select') && (
              <div className="space-y-2">
                <DndContext
                  sensors={optionSensors}
                  collisionDetection={builderCollisionDetection}
                  onDragEnd={handleOptionDragEnd}
                >
                  <SortableContext
                    items={questionOptions.map((option) => option.id)}
                    strategy={verticalListSortingStrategy}
                  >
                    {questionOptions.map((option, index) => (
                      <SortableOptionRow
                        key={option.id}
                        option={option}
                        questionType={choiceQuestionType!}
                        canMoveUp={index > 0}
                        canMoveDown={index < questionOptions.length - 1}
                        onMoveUp={(optionId) => moveOption(optionId, "up")}
                        onMoveDown={(optionId) => moveOption(optionId, "down")}
                        onOptionChange={handleOptionChange}
                        onToggleOtherOption={toggleOtherOption}
                        onToggleRequireOtherText={toggleRequireOtherText}
                        onToggleExclusiveOption={toggleExclusiveOption}
                        onRemoveOption={removeOption}
                        hasExclusiveOptionWarning={hasExclusiveOptionWarning}
                        tBuilder={tBuilder}
                      />
                    ))}
                  </SortableContext>
                </DndContext>
                <Button variant="ghost" size="sm" onClick={addOption} className="text-purple-600 hover:text-purple-700 hover:bg-purple-50">
                  <Plus className="mr-2 h-3 w-3" /> {tBuilder("addOption")}
                </Button>
              </div>
            )}

            {question.type === 'text' && (
              <Input disabled placeholder={tBuilder("longAnswerPlaceholder")} className="bg-gray-50 border-dashed" />
            )}

            {question.type === 'date' && (
              <Input disabled type="date" className="bg-gray-50 border-dashed w-auto" />
            )}

            {question.type === 'rating' && (
              <div className="flex gap-2">
                {Array.from({ length: question.maxRating || 5 }).map((_, i) => (
                  <StarIcon key={i} className="h-6 w-6 text-gray-300" />
                ))}
              </div>
            )}

            {question.type === 'section' && (
              <div className="flex flex-col items-center justify-center py-2 mt-2">
                <div className="text-xs text-[var(--primary-foreground)] opacity-80">{tBuilder("questionsBelowLine")}</div>
              </div>
            )}
          </div>
        </div>

        <div className="flex flex-col gap-2">
          <div className="flex md:hidden flex-col gap-2">
            <Button
              variant="ghost"
              size="icon"
              className="text-gray-400 hover:text-purple-600 hover:bg-purple-50"
              onClick={() => onMoveUp?.(question.id)}
              disabled={!canMoveUp}
              aria-label={tBuilder("moveUp")}
              data-testid={`question-move-up-${question.id}`}
            >
              <ChevronUp className="h-4 w-4" />
            </Button>
            <Button
              variant="ghost"
              size="icon"
              className="text-gray-400 hover:text-purple-600 hover:bg-purple-50"
              onClick={() => onMoveDown?.(question.id)}
              disabled={!canMoveDown}
              aria-label={tBuilder("moveDown")}
              data-testid={`question-move-down-${question.id}`}
            >
              <ChevronDown className="h-4 w-4" />
            </Button>
          </div>
          <Button variant="ghost" size="icon" className="text-gray-400 hover:text-purple-600 hover:bg-purple-50" onClick={() => onDuplicate(question.id)} title={tBuilder("duplicate")}>
            <Copy className="h-5 w-5" />
          </Button>
          {(question.type === 'single' || question.type === 'select' || question.type === 'multi' || question.type === 'rating' || question.type === 'date') && (
            <Button
              variant="ghost"
              size="icon"
              className={`${
                hasLogicWarning || hasCriticalLogicWarning
                  ? "text-red-500 hover:text-red-600 hover:bg-red-50"
                  : hasLogic
                    ? "text-blue-600 hover:text-blue-700 hover:bg-blue-50"
                    : "text-gray-400 hover:text-blue-600 hover:bg-blue-50"
              }`}
              onClick={() => onOpenLogic(question.id)}
              title={tBuilder("logicJumps")}
              aria-label={tBuilder("logicJumps")}
            >
                <svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="h-5 w-5"><path d="M6 3v12"/><circle cx="18" cy="6" r="3"/><circle cx="6" cy="18" r="3"/><path d="M18 9a9 9 0 0 1-9 9"/></svg>
            </Button>
          )}
          <Button 
            variant="ghost" 
            size="icon" 
            className={`text-gray-400 ${isFirstSection ? 'opacity-50 cursor-not-allowed' : 'hover:text-red-500 hover:bg-red-50'}`} 
            onClick={() => !isFirstSection && onDelete(question.id)} 
            title={isFirstSection ? tBuilder("cannotDeleteFirstPage") : tBuilder("delete")}
            disabled={isFirstSection}
          >
            <Trash2 className="h-5 w-5" />
          </Button>
        </div>
      </CardHeader>
      
      {question.type !== 'section' && (
        <div className="border-t border-gray-100 bg-gray-50/50 p-2 px-4 flex justify-end gap-4 items-center text-xs text-gray-500">
            {question.type === 'rating' && (
               <div className="flex items-center gap-2">
                <span>{tBuilder("maxStars")}</span>
                <Input 
                    type="number" 
                    min={1}
                    max={10}
                    value={question.maxRating || 5} 
                    onChange={(e) => {
                        let val = parseInt(e.target.value) || 1;
                        if (val > 10) val = 10;
                        if (val < 1) val = 1;
                        onUpdate(question.id, { maxRating: val });
                    }}
                    className="w-16 h-6 text-xs"
                />
               </div>
            )}
            {question.type === "multi" && (
              <>
                <div className="flex items-center gap-2">
                  <span className={hasSelectionBoundsWarning ? "text-red-600" : ""}>{tBuilder("minSelections")}</span>
                  <Input
                    type="number"
                    min={0}
                    value={question.minSelections ?? ""}
                    onChange={(e) => handleSelectionBoundChange("minSelections", e.target.value)}
                    className={`w-16 h-6 text-xs ${hasSelectionBoundsWarning ? "border-red-300 text-red-600 focus-visible:ring-red-200" : ""}`}
                  />
                </div>
                <div className="flex items-center gap-2">
                  <span className={hasSelectionBoundsWarning ? "text-red-600" : ""}>{tBuilder("maxSelections")}</span>
                  <Input
                    type="number"
                    min={1}
                    value={question.maxSelections ?? ""}
                    onChange={(e) => handleSelectionBoundChange("maxSelections", e.target.value)}
                    className={`w-16 h-6 text-xs ${hasSelectionBoundsWarning ? "border-red-300 text-red-600 focus-visible:ring-red-200" : ""}`}
                  />
                </div>
              </>
            )}
            <div className="flex items-center gap-2">
            <span>{tBuilder("required")}</span>
            <Switch 
                checked={question.required} 
                onCheckedChange={(checked) => onUpdate(question.id, { required: checked })} 
            />
            </div>
        </div>
      )}
    </Card>
    </div>
  );
}

function StarIcon({ className }: { className?: string }) {
  return (
    <svg
      xmlns="http://www.w3.org/2000/svg"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
      className={className}
    >
      <polygon points="12 2 15.09 8.26 22 9.27 17 14.14 18.18 21.02 12 17.77 5.82 21.02 7 14.14 2 9.27 8.91 8.26 12 2" />
    </svg>
  );
}
