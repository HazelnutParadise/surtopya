import { useDraggable } from "@dnd-kit/core";
import { Type, ListChecks, CheckSquare, Star, Calendar, ChevronDown } from "lucide-react";
import { Button } from "@/components/ui/button";
import { QuestionType } from "@/types/survey";
import { useTranslations } from "next-intl";

interface ToolboxItemProps {
  type: QuestionType;
  label: string;
  icon: React.ReactNode;
}

function DraggableToolboxItem({ type, label, icon }: ToolboxItemProps) {
  const { attributes, listeners, setNodeRef, transform, isDragging } = useDraggable({
    id: `toolbox-${type}`,
    data: {
      isToolboxItem: true,
      type,
    },
  });

  const style = transform ? {
    transform: `translate3d(${transform.x}px, ${transform.y}px, 0)`,
    opacity: 0, // Hide original when dragging
  } : undefined;

  return (
    <div
      ref={setNodeRef}
      data-testid={`toolbox-${type}`}
      style={style}
      {...listeners}
      {...attributes}
      className="mb-3"
    >
      <Button
        variant="outline"
        data-testid={`toolbox-${type}`}
        className="w-full justify-start gap-3 h-12 border-dashed hover:border-solid hover:border-purple-500 hover:text-purple-600 transition-all cursor-grab active:cursor-grabbing"
      >
        {icon}
        <span>{label}</span>
      </Button>
    </div>
  );
}

function ClickableToolboxItem({ type, label, icon, onAddQuestion }: ToolboxItemProps & {
  onAddQuestion: (type: QuestionType) => void
}) {
  return (
    <div className="mb-3">
      <Button
        type="button"
        variant="outline"
        data-testid={`toolbox-${type}`}
        className="w-full justify-start gap-3 h-12 border-dashed hover:border-solid hover:border-purple-500 hover:text-purple-600 transition-all"
        onClick={() => onAddQuestion(type)}
      >
        {icon}
        <span>{label}</span>
      </Button>
    </div>
  )
}

interface ToolboxProps {
  onAddQuestion?: (type: QuestionType) => void
}

export function Toolbox({ onAddQuestion }: ToolboxProps = {}) {
  const tQuestion = useTranslations("QuestionTypes");

  return (
    <div className="space-y-1">
      {onAddQuestion ? (
        <>
          <ClickableToolboxItem type="single" label={tQuestion("single")} icon={<ListChecks className="h-4 w-4" />} onAddQuestion={onAddQuestion} />
          <ClickableToolboxItem type="multi" label={tQuestion("multi")} icon={<CheckSquare className="h-4 w-4" />} onAddQuestion={onAddQuestion} />
          <ClickableToolboxItem type="text" label={tQuestion("text")} icon={<Type className="h-4 w-4" />} onAddQuestion={onAddQuestion} />
          <ClickableToolboxItem type="rating" label={tQuestion("rating")} icon={<Star className="h-4 w-4" />} onAddQuestion={onAddQuestion} />
          <ClickableToolboxItem type="select" label={tQuestion("select")} icon={<ChevronDown className="h-4 w-4" />} onAddQuestion={onAddQuestion} />
          <ClickableToolboxItem type="date" label={tQuestion("date")} icon={<Calendar className="h-4 w-4" />} onAddQuestion={onAddQuestion} />
        </>
      ) : (
        <>
          <DraggableToolboxItem type="single" label={tQuestion("single")} icon={<ListChecks className="h-4 w-4" />} />
          <DraggableToolboxItem type="multi" label={tQuestion("multi")} icon={<CheckSquare className="h-4 w-4" />} />
          <DraggableToolboxItem type="text" label={tQuestion("text")} icon={<Type className="h-4 w-4" />} />
          <DraggableToolboxItem type="rating" label={tQuestion("rating")} icon={<Star className="h-4 w-4" />} />
          <DraggableToolboxItem type="select" label={tQuestion("select")} icon={<ChevronDown className="h-4 w-4" />} />
          <DraggableToolboxItem type="date" label={tQuestion("date")} icon={<Calendar className="h-4 w-4" />} />
        </>
      )}
    </div>
  );
}
