import React from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue, SelectGroup, SelectLabel } from "@/components/ui/select";
import { Label } from "@/components/ui/label";
import { Question, LogicRule } from "@/types/survey";
import { Plus, Trash2, ArrowRight } from "lucide-react";

interface LogicEditorProps {
  question: Question;
  allQuestions: Question[];
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onSave: (logic: LogicRule[]) => void;
}

export function LogicEditor({ question, allQuestions, open, onOpenChange, onSave }: LogicEditorProps) {
  const [rules, setRules] = React.useState<LogicRule[]>(question.logic || []);

  // Reset rules when opening for a different question
  React.useEffect(() => {
    setRules(question.logic || []);
  }, [question.id, open]);

  const addRule = () => {
    if (!question.options || question.options.length === 0) return;
    setRules([...rules, { triggerOption: question.options[0], destinationQuestionId: "" }]);
  };

  const removeRule = (index: number) => {
    const newRules = [...rules];
    newRules.splice(index, 1);
    setRules(newRules);
  };

  const updateRule = (index: number, field: keyof LogicRule, value: string) => {
    const newRules = [...rules];
    newRules[index] = { ...newRules[index], [field]: value };
    setRules(newRules);
  };

  const handleSave = () => {
    onSave(rules);
    onOpenChange(false);
  };

  // Only allow logic for single choice or dropdown questions
  const isCompatible = question.type === 'single' || question.type === 'select';
  
  // Filter questions that come AFTER the current question to prevent loops
  const currentQuestionIndex = allQuestions.findIndex(q => q.id === question.id);
  
  // 1. Questions on the same page (after current)
  const samePageQuestions: Question[] = [];
  for (let i = currentQuestionIndex + 1; i < allQuestions.length; i++) {
      if (allQuestions[i].type === 'section') break;
      samePageQuestions.push(allQuestions[i]);
  }

  // 2. Subsequent Pages (Sections)
  const subsequentPages = allQuestions.slice(currentQuestionIndex + 1).filter(q => q.type === 'section');

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-[600px]" onInteractOutside={(e) => e.preventDefault()}>
        <DialogHeader>
          <DialogTitle>Logic Jumps for "{question.title}"</DialogTitle>
        </DialogHeader>

        {!isCompatible ? (
          <div className="py-6 text-center text-gray-500">
            Logic jumps are only available for Single Choice and Dropdown questions.
          </div>
        ) : (
          <div className="space-y-4 py-4">
            {rules.length === 0 ? (
              <div className="text-center text-sm text-gray-500 py-4 border-2 border-dashed rounded-lg">
                No logic rules defined. Click "Add Rule" to start.
              </div>
            ) : (
              <div className="space-y-3">
                {rules.map((rule, index) => (
                  <div key={index} className="flex items-center gap-3 bg-gray-50 p-3 rounded-lg border border-gray-100 dark:bg-gray-900 dark:border-gray-800">
                    <div className="flex-1 grid grid-cols-[1fr,auto,1fr] gap-2 items-center">
                      <div className="space-y-1">
                        <Label className="text-xs text-gray-500">If answer is</Label>
                        <Select 
                          value={rule.triggerOption} 
                          onValueChange={(val) => updateRule(index, 'triggerOption', val)}
                        >
                          <SelectTrigger className="h-9">
                            <SelectValue placeholder="Select Option" />
                          </SelectTrigger>
                          <SelectContent>
                            {question.options?.map(opt => (
                              <SelectItem key={opt} value={opt}>{opt}</SelectItem>
                            ))}
                          </SelectContent>
                        </Select>
                      </div>

                      <ArrowRight className="h-4 w-4 text-gray-400 mt-5" />

                      <div className="space-y-1">
                        <Label className="text-xs text-gray-500">Jump to</Label>
                        {(() => {
                          // Check if current destination is invalid
                          const destId = rule.destinationQuestionId;
                          const isEndSurvey = destId === 'end_survey';
                          const destQuestion = allQuestions.find(q => q.id === destId);
                          const destIndex = allQuestions.findIndex(q => q.id === destId);
                          const isInvalid = !isEndSurvey && destId && (
                            !destQuestion || // Question was deleted
                            destIndex <= currentQuestionIndex // Question is before or at current position
                          );
                          const invalidReason = !destQuestion 
                            ? '(Deleted)' 
                            : destIndex <= currentQuestionIndex 
                              ? '(Invalid position)' 
                              : '';
                          
                          return (
                            <div className="flex items-center gap-2">
                              <Select 
                                value={rule.destinationQuestionId} 
                                onValueChange={(val) => updateRule(index, 'destinationQuestionId', val)}
                              >
                                <SelectTrigger className={`h-9 flex-1 ${isInvalid ? 'border-red-500 bg-red-50 dark:bg-red-900/20' : ''}`}>
                                  <SelectValue placeholder="Select Question">
                                    {isInvalid && destQuestion ? (
                                      <span className="text-red-600">{destQuestion.title || 'Untitled'} {invalidReason}</span>
                                    ) : isInvalid && !destQuestion ? (
                                      <span className="text-red-600">Deleted Question {invalidReason}</span>
                                    ) : undefined}
                                  </SelectValue>
                                </SelectTrigger>
                                <SelectContent>
                                  <SelectItem value="end_survey">Submit Survey (End)</SelectItem>
                                  
                                  {samePageQuestions.length > 0 && (
                                      <SelectGroup>
                                          <SelectLabel>Current Page</SelectLabel>
                                          {samePageQuestions.map(q => (
                                              <SelectItem key={q.id} value={q.id}>{q.title || "Untitled Question"}</SelectItem>
                                          ))}
                                      </SelectGroup>
                                  )}

                                  {subsequentPages.length > 0 && (
                                      <SelectGroup>
                                          <SelectLabel>Go to Page</SelectLabel>
                                          {subsequentPages.map(q => (
                                              <SelectItem key={q.id} value={q.id}>{q.title || "Untitled Page"}</SelectItem>
                                          ))}
                                      </SelectGroup>
                                  )}
                                </SelectContent>
                              </Select>
                              {isInvalid && (
                                <div className="text-red-500" title={`Logic jump is invalid: ${invalidReason}`}>
                                  <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                                    <path d="m21.73 18-8-14a2 2 0 0 0-3.48 0l-8 14A2 2 0 0 0 4 21h16a2 2 0 0 0 1.73-3Z"/>
                                    <path d="M12 9v4"/>
                                    <path d="M12 17h.01"/>
                                  </svg>
                                </div>
                              )}
                            </div>
                          );
                        })()}
                      </div>
                    </div>
                    
                    <Button variant="ghost" size="icon" onClick={() => removeRule(index)} className="mt-5 text-gray-400 hover:text-red-500">
                      <Trash2 className="h-4 w-4" />
                    </Button>
                  </div>
                ))}
              </div>
            )}

            <Button variant="outline" onClick={addRule} className="w-full border-dashed">
              <Plus className="mr-2 h-4 w-4" /> Add Logic Rule
            </Button>
          </div>
        )}

        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>Cancel</Button>
          <Button onClick={handleSave} disabled={!isCompatible}>Save Logic</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
