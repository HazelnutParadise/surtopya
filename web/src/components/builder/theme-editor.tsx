import React from "react";
import { Label } from "@/components/ui/label";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { SurveyTheme } from "@/types/survey";
import { useTranslations } from "next-intl";

interface ThemeEditorProps {
  theme: SurveyTheme;
  onUpdate: (updates: Partial<SurveyTheme>) => void;
}

export function ThemeEditor({ theme, onUpdate }: ThemeEditorProps) {
  const t = useTranslations("ThemeEditor");

  return (
    <div className="space-y-6 p-4">
      <div className="space-y-2">
        <Label>{t("primaryColor")}</Label>
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
        <Label>{t("backgroundColor")}</Label>
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
        <Label>{t("fontFamily")}</Label>
        <Select 
          value={theme.fontFamily} 
          onValueChange={(value) => onUpdate({ fontFamily: value })}
        >
          <SelectTrigger>
            <SelectValue placeholder={t("selectFont")} />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="inter">{t("fontInter")}</SelectItem>
            <SelectItem value="serif">{t("fontSerif")}</SelectItem>
            <SelectItem value="mono">{t("fontMono")}</SelectItem>
            <SelectItem value="comic">{t("fontComic")}</SelectItem>
          </SelectContent>
        </Select>
      </div>
    </div>
  );
}
