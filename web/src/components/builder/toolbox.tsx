import { useDraggable } from "@dnd-kit/core";
import { Type, ListChecks, CheckSquare, Star, Calendar, ChevronDown } from "lucide-react";
import { Button } from "@/components/ui/button";
import { QuestionType } from "@/types/survey";

interface ToolboxItemProps {
  type: QuestionType;
  label: string;
  icon: React.ReactNode;
}

function ToolboxItem({ type, label, icon }: ToolboxItemProps) {
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
    <div ref={setNodeRef} style={style} {...listeners} {...attributes} className="mb-3">
      <Button variant="outline" className="w-full justify-start gap-3 h-12 border-dashed hover:border-solid hover:border-purple-500 hover:text-purple-600 transition-all cursor-grab active:cursor-grabbing">
        {icon}
        <span>{label}</span>
      </Button>
    </div>
  );
}

export function Toolbox() {
  return (
    <div className="space-y-1">
      <ToolboxItem type="single" label="Single Choice" icon={<ListChecks className="h-4 w-4" />} />
      <ToolboxItem type="multi" label="Multiple Choice" icon={<CheckSquare className="h-4 w-4" />} />
      <ToolboxItem type="text" label="Text Answer" icon={<Type className="h-4 w-4" />} />
      <ToolboxItem type="rating" label="Rating Scale" icon={<Star className="h-4 w-4" />} />
      <ToolboxItem type="select" label="Dropdown" icon={<ChevronDown className="h-4 w-4" />} />
      <ToolboxItem type="date" label="Date" icon={<Calendar className="h-4 w-4" />} />
    </div>
  );
}
