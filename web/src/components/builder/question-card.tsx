import React from "react";
import { useSortable } from "@dnd-kit/sortable";
import { CSS } from "@dnd-kit/utilities";
import { Question } from "@/types/survey";
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

  const handleOptionChange = (index: number, value: string) => {
    if (!question.options) return;
    const newOptions = normalizeQuestionOptions(question.options) || [];
    newOptions[index] = { ...newOptions[index], label: value };
    onUpdate(question.id, { options: newOptions });
  };

  const addOption = () => {
    if (!question.options) return;
    onUpdate(question.id, {
      options: [
        ...(normalizeQuestionOptions(question.options) || []),
        ...createDefaultQuestionOptions([tBuilder("optionLabel", { index: question.options.length + 1 })]),
      ],
    });
  };

  const removeOption = (index: number) => {
    if (!question.options) return;
    const newOptions = (normalizeQuestionOptions(question.options) || []).filter((_, i) => i !== index);
    onUpdate(question.id, { options: newOptions });
  };

  const toggleOtherOption = (index: number) => {
    if (!question.options) return;
    const currentOptions = normalizeQuestionOptions(question.options) || [];
    const newOptions = currentOptions.map((option, optionIndex) => ({
      ...option,
      isOther: optionIndex === index ? !option.isOther : false,
      requireOtherText: optionIndex === index ? (option.isOther ? false : option.requireOtherText === true) : false,
    }));
    onUpdate(question.id, { options: newOptions });
  };

  const toggleRequireOtherText = (index: number, checked: boolean) => {
    if (!question.options) return;
    const currentOptions = normalizeQuestionOptions(question.options) || [];
    const newOptions = currentOptions.map((option, optionIndex) => {
      if (optionIndex !== index) return option;
      return {
        ...option,
        requireOtherText: option.isOther ? checked : false,
      };
    });
    onUpdate(question.id, { options: newOptions });
  };

  const toggleExclusiveOption = (index: number) => {
    if (!question.options || question.type !== "multi") return;
    const currentOptions = normalizeQuestionOptions(question.options) || [];
    const nextExclusive = !currentOptions[index]?.exclusive;
    const newOptions = currentOptions.map((option, optionIndex) => ({
      ...option,
      exclusive: optionIndex === index ? nextExclusive : false,
    }));
    onUpdate(question.id, { options: newOptions });
  };

  const handleSelectionBoundChange = (field: "minSelections" | "maxSelections", value: string) => {
    const trimmed = value.trim();
    if (trimmed.length === 0) {
      onUpdate(question.id, { [field]: undefined });
      return;
    }

    const parsed = Number.parseInt(trimmed, 10);
    onUpdate(question.id, { [field]: Number.isFinite(parsed) ? parsed : undefined });
  };

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
            {hasLogicWarning && (
              <TooltipProvider>
                <Tooltip>
                  <TooltipTrigger asChild>
                    <div className="flex items-center gap-1 text-red-500">
                      <AlertTriangle className="h-5 w-5" />
                    </div>
                  </TooltipTrigger>
                  <TooltipContent>
                    <p className="text-sm">{logicWarningMessage || tBuilder("logicWarningGeneric")}</p>
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
                {question.options?.map((option, index) => (
                    <div key={index} className="space-y-2">
                      <div className="flex items-center gap-2">
                      {renderChoiceMarker(question.type)}
                      <Input 
                        value={getQuestionOptionLabel(option)} 
                        onChange={(e) => handleOptionChange(index, e.target.value)}
                        className="h-8 text-sm"
                      />
                      <Button
                        type="button"
                        variant={isOtherQuestionOption(option) ? "secondary" : "outline"}
                        size="sm"
                        className="h-8 shrink-0"
                        onClick={() => toggleOtherOption(index)}
                      >
                        {tBuilder("otherOptionToggle")}
                      </Button>
                      {question.type === "multi" ? (
                        <Button
                          type="button"
                          variant={option.exclusive ? "secondary" : "outline"}
                          size="sm"
                          className="h-8 shrink-0"
                          onClick={() => toggleExclusiveOption(index)}
                        >
                          {tBuilder("exclusiveOptionToggle")}
                        </Button>
                      ) : null}
                      <Button variant="ghost" size="icon" className="h-8 w-8 text-gray-400 hover:text-red-500" onClick={() => removeOption(index)}>
                        <X className="h-4 w-4" />
                      </Button>
                    </div>
                    {isOtherQuestionOption(option) ? (
                      <div className="ml-6 flex items-center justify-between rounded-md border border-dashed border-gray-200 px-3 py-2">
                        <span className="text-xs text-gray-600">{tBuilder("otherTextRequiredToggle")}</span>
                        <Switch
                          checked={isOtherTextRequiredQuestionOption(option)}
                          onCheckedChange={(checked) => toggleRequireOtherText(index, checked)}
                        />
                      </div>
                    ) : null}
                  </div>
                ))}
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
                  <span>{tBuilder("minSelections")}</span>
                  <Input
                    type="number"
                    min={0}
                    value={question.minSelections ?? ""}
                    onChange={(e) => handleSelectionBoundChange("minSelections", e.target.value)}
                    className="w-16 h-6 text-xs"
                  />
                </div>
                <div className="flex items-center gap-2">
                  <span>{tBuilder("maxSelections")}</span>
                  <Input
                    type="number"
                    min={1}
                    value={question.maxSelections ?? ""}
                    onChange={(e) => handleSelectionBoundChange("maxSelections", e.target.value)}
                    className="w-16 h-6 text-xs"
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
