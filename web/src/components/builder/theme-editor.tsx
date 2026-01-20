import React from "react";
import { Label } from "@/components/ui/label";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { SurveyTheme } from "@/types/survey";

interface ThemeEditorProps {
  theme: SurveyTheme;
  onUpdate: (updates: Partial<SurveyTheme>) => void;
}

export function ThemeEditor({ theme, onUpdate }: ThemeEditorProps) {
  return (
    <div className="space-y-6 p-4">
      <div className="space-y-2">
        <Label>Primary Color</Label>
        <div className="flex items-center gap-3">
          <Input 
            type="color" 
            value={theme.primaryColor} 
            onChange={(e) => onUpdate({ primaryColor: e.target.value })}
            className="h-10 w-20 p-1 cursor-pointer"
          />
          <span className="text-sm text-gray-500 uppercase">{theme.primaryColor}</span>
        </div>
      </div>

      <div className="space-y-2">
        <Label>Background Color</Label>
        <div className="flex items-center gap-3">
          <Input 
            type="color" 
            value={theme.backgroundColor} 
            onChange={(e) => onUpdate({ backgroundColor: e.target.value })}
            className="h-10 w-20 p-1 cursor-pointer"
          />
          <span className="text-sm text-gray-500 uppercase">{theme.backgroundColor}</span>
        </div>
      </div>

      <div className="space-y-2">
        <Label>Font Family</Label>
        <Select 
          value={theme.fontFamily} 
          onValueChange={(value) => onUpdate({ fontFamily: value })}
        >
          <SelectTrigger>
            <SelectValue placeholder="Select Font" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="inter">Inter (Default)</SelectItem>
            <SelectItem value="serif">Serif</SelectItem>
            <SelectItem value="mono">Monospace</SelectItem>
            <SelectItem value="comic">Comic Sans</SelectItem>
          </SelectContent>
        </Select>
      </div>
    </div>
  );
}
