import React from "react";
import { useDroppable } from "@dnd-kit/core";
import { Question } from "@/types/survey";
import { QuestionCard } from "./question-card";

interface CanvasProps {
  questions: Question[];
  onUpdate: (id: string, updates: Partial<Question>) => void;
  onDelete: (id: string) => void;
  onDuplicate: (id: string) => void;
  onOpenLogic: (id: string) => void;
  activeId: string | null;
  getLogicWarning: (questionId: string) => string | null;
}

export function Canvas({ questions, onUpdate, onDelete, onDuplicate, onOpenLogic, activeId, getLogicWarning }: CanvasProps) {
  const { setNodeRef } = useDroppable({
    id: 'canvas-droppable',
  });

  // Calculate which questions should be hidden (because they are being dragged with a section)
  const hiddenIds = React.useMemo(() => {
    if (!activeId) return new Set<string>();
    
    const activeQuestion = questions.find(q => q.id === activeId);
    if (activeQuestion?.type !== 'section') return new Set<string>();

    const ids = new Set<string>();
    // Don't add activeId itself, dnd-kit handles that
    
    const index = questions.findIndex(q => q.id === activeId);
    for (let i = index + 1; i < questions.length; i++) {
        if (questions[i].type === 'section') break;
        ids.add(questions[i].id);
    }
    return ids;
  }, [activeId, questions]);

  if (questions.length === 0) {
    return (
      <div ref={setNodeRef} className="flex h-64 flex-col items-center justify-center rounded-xl border-2 border-dashed border-gray-300 bg-gray-50 text-gray-400 dark:border-gray-700 dark:bg-gray-900 transition-colors hover:border-purple-500 hover:bg-purple-50/50 dark:hover:bg-purple-900/20">
        <p className="text-lg font-medium">Drag items here from the toolbox</p>
        <p className="text-sm">Start building your survey</p>
      </div>
    );
  }

  return (
    <div ref={setNodeRef} className="pb-20 min-h-[500px]">
      {(() => {
        const sections: { header: Question; children: Question[] }[] = [];
        let currentSection: { header: Question; children: Question[] } | null = null;
        const orphanedQuestions: Question[] = [];

        questions.forEach((q) => {
            if (q.type === 'section') {
                if (currentSection) {
                    sections.push(currentSection);
                }
                currentSection = { header: q, children: [] };
            } else {
                if (currentSection) {
                    currentSection.children.push(q);
                } else {
                    orphanedQuestions.push(q);
                }
            }
        });
        if (currentSection) {
            sections.push(currentSection);
        }

        return (
            <>
                {orphanedQuestions.map((q) => {
                    const warning = getLogicWarning(q.id);
                    return (
                    <QuestionCard 
                        key={q.id} 
                        question={q} 
                        isFirstSection={false}
                        onUpdate={onUpdate} 
                        onDelete={onDelete} 
                        onDuplicate={onDuplicate}
                        onOpenLogic={onOpenLogic}
                        isHidden={hiddenIds.has(q.id)}
                        hasLogicWarning={!!warning}
                        logicWarningMessage={warning || undefined}
                    />
                )})}
                {sections.map((section, sectionIndex) => (
                    <div key={section.header.id} className="mb-8 rounded-xl border border-gray-200 bg-white/50 p-4 shadow-sm dark:border-gray-800 dark:bg-gray-900/50">
                        <QuestionCard 
                            key={section.header.id} 
                            question={section.header} 
                            isFirstSection={sectionIndex === 0}
                            onUpdate={onUpdate} 
                            onDelete={onDelete} 
                            onDuplicate={onDuplicate}
                            onOpenLogic={onOpenLogic}
                            isHidden={hiddenIds.has(section.header.id)}
                        />
                        <div className="pl-4 mt-4 space-y-4 border-l-2 border-gray-100 dark:border-gray-800 ml-4">
                            {section.children.map((q) => {
                                const warning = getLogicWarning(q.id);
                                return (
                                <QuestionCard 
                                    key={q.id} 
                                    question={q} 
                                    isFirstSection={false}
                                    onUpdate={onUpdate} 
                                    onDelete={onDelete} 
                                    onDuplicate={onDuplicate}
                                    onOpenLogic={onOpenLogic}
                                    isHidden={hiddenIds.has(q.id)}
                                    hasLogicWarning={!!warning}
                                    logicWarningMessage={warning || undefined}
                                />
                            )})}
                        </div>
                    </div>
                ))}
            </>
        );
      })()}
    </div>
  );
}
