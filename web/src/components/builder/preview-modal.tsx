"use client";

import React, { useState } from "react";
import { Question, SurveyTheme } from "@/types/survey";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import { Checkbox } from "@/components/ui/checkbox";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { ChevronLeft, ChevronRight, X } from "lucide-react";
import { Progress } from "@/components/ui/progress";

interface PreviewModalProps {
  open: boolean;
  onClose: () => void;
  title: string;
  questions: Question[];
  theme: SurveyTheme;
}

export function PreviewModal({ open, onClose, title, questions, theme }: PreviewModalProps) {
  const [currentPageIndex, setCurrentPageIndex] = useState(0);
  const [responses, setResponses] = useState<Record<string, any>>({});

  if (!open) return null;

  // Group questions by section/page
  const pages: { header: Question; children: Question[] }[] = [];
  let currentPage: { header: Question; children: Question[] } | null = null;

  questions.forEach((q) => {
    if (q.type === 'section') {
      if (currentPage) {
        pages.push(currentPage);
      }
      currentPage = { header: q, children: [] };
    } else {
      if (currentPage) {
        currentPage.children.push(q);
      }
    }
  });
  if (currentPage) {
    pages.push(currentPage);
  }

  const currentPageData = pages[currentPageIndex];
  const progress = pages.length > 0 ? ((currentPageIndex + 1) / pages.length) * 100 : 0;

  const handleResponse = (questionId: string, value: any) => {
    setResponses((prev) => ({ ...prev, [questionId]: value }));
  };

  const handleNext = () => {
    if (currentPageIndex < pages.length - 1) {
      setCurrentPageIndex(currentPageIndex + 1);
    }
  };

  const handlePrev = () => {
    if (currentPageIndex > 0) {
      setCurrentPageIndex(currentPageIndex - 1);
    }
  };

  const handleSubmit = () => {
    alert("Preview mode: Survey submitted!\n\nResponses:\n" + JSON.stringify(responses, null, 2));
  };

  const renderQuestion = (question: Question, index: number) => {
    const questionNumber = index + 1;

    switch (question.type) {
      case 'short':
        return (
          <div key={question.id} className="mb-6">
            <Label className="text-base font-medium">
              {questionNumber}. {question.title}
              {question.required && <span className="text-red-500 ml-1">*</span>}
            </Label>
            {question.description && (
              <p className="text-sm text-gray-500 mt-1">{question.description}</p>
            )}
            <Input
              className="mt-2"
              placeholder="Your answer"
              value={responses[question.id] || ''}
              onChange={(e) => handleResponse(question.id, e.target.value)}
            />
          </div>
        );

      case 'long':
        return (
          <div key={question.id} className="mb-6">
            <Label className="text-base font-medium">
              {questionNumber}. {question.title}
              {question.required && <span className="text-red-500 ml-1">*</span>}
            </Label>
            {question.description && (
              <p className="text-sm text-gray-500 mt-1">{question.description}</p>
            )}
            <Textarea
              className="mt-2"
              placeholder="Your answer"
              value={responses[question.id] || ''}
              onChange={(e) => handleResponse(question.id, e.target.value)}
            />
          </div>
        );

      case 'single':
        return (
          <div key={question.id} className="mb-6">
            <Label className="text-base font-medium">
              {questionNumber}. {question.title}
              {question.required && <span className="text-red-500 ml-1">*</span>}
            </Label>
            {question.description && (
              <p className="text-sm text-gray-500 mt-1">{question.description}</p>
            )}
            <RadioGroup
              className="mt-3 space-y-2"
              value={responses[question.id] || ''}
              onValueChange={(value) => handleResponse(question.id, value)}
            >
              {question.options?.map((option, i) => (
                <div key={i} className="flex items-center space-x-2">
                  <RadioGroupItem value={option} id={`${question.id}-${i}`} />
                  <Label htmlFor={`${question.id}-${i}`} className="font-normal cursor-pointer">
                    {option}
                  </Label>
                </div>
              ))}
            </RadioGroup>
          </div>
        );

      case 'multi':
        return (
          <div key={question.id} className="mb-6">
            <Label className="text-base font-medium">
              {questionNumber}. {question.title}
              {question.required && <span className="text-red-500 ml-1">*</span>}
            </Label>
            {question.description && (
              <p className="text-sm text-gray-500 mt-1">{question.description}</p>
            )}
            <div className="mt-3 space-y-2">
              {question.options?.map((option, i) => {
                const selected = responses[question.id] || [];
                return (
                  <div key={i} className="flex items-center space-x-2">
                    <Checkbox
                      id={`${question.id}-${i}`}
                      checked={selected.includes(option)}
                      onCheckedChange={(checked) => {
                        if (checked) {
                          handleResponse(question.id, [...selected, option]);
                        } else {
                          handleResponse(question.id, selected.filter((o: string) => o !== option));
                        }
                      }}
                    />
                    <Label htmlFor={`${question.id}-${i}`} className="font-normal cursor-pointer">
                      {option}
                    </Label>
                  </div>
                );
              })}
            </div>
          </div>
        );

      case 'select':
        return (
          <div key={question.id} className="mb-6">
            <Label className="text-base font-medium">
              {questionNumber}. {question.title}
              {question.required && <span className="text-red-500 ml-1">*</span>}
            </Label>
            {question.description && (
              <p className="text-sm text-gray-500 mt-1">{question.description}</p>
            )}
            <select
              className="mt-2 w-full border border-gray-300 rounded-md p-2 bg-white dark:bg-gray-800 dark:border-gray-700"
              value={responses[question.id] || ''}
              onChange={(e) => handleResponse(question.id, e.target.value)}
            >
              <option value="">Select an option</option>
              {question.options?.map((option, i) => (
                <option key={i} value={option}>{option}</option>
              ))}
            </select>
          </div>
        );

      case 'rating':
        return (
          <div key={question.id} className="mb-6">
            <Label className="text-base font-medium">
              {questionNumber}. {question.title}
              {question.required && <span className="text-red-500 ml-1">*</span>}
            </Label>
            {question.description && (
              <p className="text-sm text-gray-500 mt-1">{question.description}</p>
            )}
            <div className="mt-3 flex gap-2">
              {[1, 2, 3, 4, 5].map((num) => (
                <Button
                  key={num}
                  variant={responses[question.id] === num ? "default" : "outline"}
                  size="sm"
                  onClick={() => handleResponse(question.id, num)}
                  className={responses[question.id] === num ? "bg-purple-600 hover:bg-purple-700" : ""}
                >
                  {num}
                </Button>
              ))}
            </div>
          </div>
        );

      default:
        return null;
    }
  };

  return (
    <div className="fixed inset-0 z-50 bg-black/50 flex items-center justify-center p-4">
      <div
        className="relative w-full max-w-2xl max-h-[90vh] rounded-xl shadow-2xl overflow-hidden flex flex-col"
        style={{
          backgroundColor: theme.backgroundColor,
          fontFamily: theme.fontFamily === 'serif' ? 'serif' : theme.fontFamily === 'mono' ? 'monospace' : theme.fontFamily === 'comic' ? '"Comic Sans MS", cursive, sans-serif' : 'inherit',
        }}
      >
        {/* Header */}
        <div
          className="p-4 text-white flex items-center justify-between"
          style={{ backgroundColor: theme.primaryColor }}
        >
          <h2 className="text-xl font-bold">{title}</h2>
          <Button variant="ghost" size="icon" onClick={onClose} className="text-white hover:bg-white/20">
            <X className="h-5 w-5" />
          </Button>
        </div>

        {/* Progress */}
        <div className="px-4 pt-4">
          <div className="flex items-center justify-between text-sm text-gray-500 mb-2">
            <span>Page {currentPageIndex + 1} of {pages.length}</span>
            <span>{Math.round(progress)}% complete</span>
          </div>
          <Progress value={progress} className="h-2" />
        </div>

        {/* Content */}
        <div className="flex-1 overflow-y-auto p-6">
          {currentPageData && (
            <Card className="border-none shadow-none bg-transparent">
              <CardHeader className="px-0 pt-0">
                <CardTitle className="text-2xl">{currentPageData.header.title}</CardTitle>
                {currentPageData.header.description && (
                  <CardDescription className="text-base">
                    {currentPageData.header.description}
                  </CardDescription>
                )}
              </CardHeader>
              <CardContent className="px-0">
                {currentPageData.children.map((q, i) => renderQuestion(q, i))}
              </CardContent>
            </Card>
          )}
        </div>

        {/* Footer */}
        <div className="p-4 border-t border-gray-200 dark:border-gray-800 flex items-center justify-between bg-white/50 dark:bg-gray-900/50">
          <Button
            variant="outline"
            onClick={handlePrev}
            disabled={currentPageIndex === 0}
          >
            <ChevronLeft className="mr-2 h-4 w-4" />
            Previous
          </Button>

          {currentPageIndex === pages.length - 1 ? (
            <Button
              onClick={handleSubmit}
              style={{ backgroundColor: theme.primaryColor }}
              className="text-white"
            >
              Submit
            </Button>
          ) : (
            <Button
              onClick={handleNext}
              style={{ backgroundColor: theme.primaryColor }}
              className="text-white"
            >
              Next
              <ChevronRight className="ml-2 h-4 w-4" />
            </Button>
          )}
        </div>
      </div>
    </div>
  );
}
