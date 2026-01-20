import React from "react";
import { useSortable } from "@dnd-kit/sortable";
import { CSS } from "@dnd-kit/utilities";
import { Question } from "@/types/survey";
import { Card, CardContent, CardHeader } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Switch } from "@/components/ui/switch"; // Need to install switch
import { GripVertical, Trash2, Plus, X, Copy, AlertTriangle } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@/components/ui/tooltip";

interface QuestionCardProps {
  question: Question;
  isFirstSection?: boolean;
  onUpdate: (id: string, updates: Partial<Question>) => void;
  onDelete: (id: string) => void;
  onDuplicate: (id: string) => void;
  onOpenLogic: (id: string) => void;
  isHidden?: boolean;
  isOverlay?: boolean;
  hasLogicWarning?: boolean;
  logicWarningMessage?: string;
}

export function QuestionCard({ question, isFirstSection, onUpdate, onDelete, onDuplicate, onOpenLogic, isHidden, isOverlay, hasLogicWarning, logicWarningMessage }: QuestionCardProps) {
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
    opacity: isDragging ? 0 : 1,
  };

  const handleOptionChange = (index: number, value: string) => {
    if (!question.options) return;
    const newOptions = [...question.options];
    newOptions[index] = value;
    onUpdate(question.id, { options: newOptions });
  };

  const addOption = () => {
    if (!question.options) return;
    onUpdate(question.id, { options: [...question.options, `Option ${question.options.length + 1}`] });
  };

  const removeOption = (index: number) => {
    if (!question.options) return;
    const newOptions = question.options.filter((_, i) => i !== index);
    onUpdate(question.id, { options: newOptions });
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
                ? 'bg-[var(--primary)] text-white border-none' 
                : ''
        }`}>
        <CardHeader className="flex flex-row items-start gap-4 space-y-0 p-4 relative">
          <div 
            {...attributes} 
            {...listeners} 
            className={`mt-2 cursor-grab active:cursor-grabbing ${question.type === 'section' ? 'text-white/50 hover:text-white' : 'text-gray-400 hover:text-gray-600'}`}
          >
            <GripVertical className="h-5 w-5" />
          </div>
        
        <div className="flex-1 space-y-4">
          <div className="flex items-center gap-3">
            <Input 
              value={question.title} 
              onChange={(e) => onUpdate(question.id, { title: e.target.value })}
              className={`font-semibold text-lg border-transparent focus:border-white/50 bg-transparent px-2 h-auto py-1 ${
                  question.type === 'section' 
                    ? 'text-xl text-white w-full text-center placeholder:text-white/50' 
                    : 'hover:border-gray-200 focus:border-purple-500'
              }`}
              placeholder={question.type === 'section' ? "Page Title" : "Question Title"}
            />
            {question.type !== 'section' && (
                <Badge variant="outline" className="capitalize text-xs text-gray-500">
                {question.type}
                </Badge>
            )}
            {hasLogicWarning && (
              <TooltipProvider>
                <Tooltip>
                  <TooltipTrigger asChild>
                    <div className="flex items-center gap-1 text-red-500">
                      <AlertTriangle className="h-5 w-5" />
                    </div>
                  </TooltipTrigger>
                  <TooltipContent>
                    <p className="text-sm">{logicWarningMessage || 'Logic jump may be invalid'}</p>
                  </TooltipContent>
                </Tooltip>
              </TooltipProvider>
            )}
          </div>
          
          {question.type === 'section' && (
            <Input 
                value={question.description || ''} 
                onChange={(e) => onUpdate(question.id, { description: e.target.value })}
                className="text-white/80 border-transparent focus:border-white/50 bg-transparent px-2 h-auto py-1 text-sm w-full text-center placeholder:text-white/40"
                placeholder="Page Description (Optional)"
            />
          )}

          {/* Question Body based on Type */}
          <div className="pl-2">
            {(question.type === 'single' || question.type === 'multi' || question.type === 'select') && (
              <div className="space-y-2">
                {question.options?.map((option, index) => (
                  <div key={index} className="flex items-center gap-2">
                    <div className={`h-4 w-4 border border-gray-300 ${question.type === 'multi' ? 'rounded-sm' : 'rounded-full'}`} />
                    <Input 
                      value={option} 
                      onChange={(e) => handleOptionChange(index, e.target.value)}
                      className="h-8 text-sm"
                    />
                    <Button variant="ghost" size="icon" className="h-8 w-8 text-gray-400 hover:text-red-500" onClick={() => removeOption(index)}>
                      <X className="h-4 w-4" />
                    </Button>
                  </div>
                ))}
                <Button variant="ghost" size="sm" onClick={addOption} className="text-purple-600 hover:text-purple-700 hover:bg-purple-50">
                  <Plus className="mr-2 h-3 w-3" /> Add Option
                </Button>
              </div>
            )}

            {question.type === 'text' && (
              <Input disabled placeholder="Long answer text..." className="bg-gray-50 border-dashed" />
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
                <div className="text-xs text-white/80">Questions below this line will appear on this page</div>
              </div>
            )}
          </div>
        </div>

        <div className="flex flex-col gap-2">
          <Button variant="ghost" size="icon" className="text-gray-400 hover:text-purple-600 hover:bg-purple-50" onClick={() => onDuplicate(question.id)} title="Duplicate">
            <Copy className="h-5 w-5" />
          </Button>
          {(question.type === 'single' || question.type === 'select') && (
            <Button variant="ghost" size="icon" className="text-gray-400 hover:text-blue-600 hover:bg-blue-50" onClick={() => onOpenLogic(question.id)} title="Logic Jumps">
                <svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="h-5 w-5"><path d="M6 3v12"/><circle cx="18" cy="6" r="3"/><circle cx="6" cy="18" r="3"/><path d="M18 9a9 9 0 0 1-9 9"/></svg>
            </Button>
          )}
          <Button 
            variant="ghost" 
            size="icon" 
            className={`text-gray-400 ${isFirstSection ? 'opacity-50 cursor-not-allowed' : 'hover:text-red-500 hover:bg-red-50'}`} 
            onClick={() => !isFirstSection && onDelete(question.id)} 
            title={isFirstSection ? "Cannot delete first page" : "Delete"}
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
                <span>Max Stars</span>
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
            <div className="flex items-center gap-2">
            <span>Required</span>
            <Switch 
                checked={question.required} 
                onCheckedChange={(checked) => onUpdate(question.id, { required: checked })} 
            />
            </div>
            <div className="flex items-center gap-2">
            <span>Points</span>
            <Input 
                type="number" 
                value={question.points} 
                onChange={(e) => onUpdate(question.id, { points: parseInt(e.target.value) || 0 })}
                className="w-16 h-6 text-xs"
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
