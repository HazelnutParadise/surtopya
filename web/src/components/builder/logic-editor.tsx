import React from "react"
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog"
import { Button } from "@/components/ui/button"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue, SelectGroup, SelectLabel } from "@/components/ui/select"
import { Label } from "@/components/ui/label"
import { LogicRule, Question } from "@/types/survey"
import { Plus, Trash2, ArrowRight, AlertTriangle } from "lucide-react"
import { useTranslations } from "next-intl"
import { findQuestionOptionById } from "@/lib/question-options"
import { isContradictoryLogicRule, normalizeQuestionLogic } from "@/lib/survey-logic"

interface LogicEditorProps {
  question: Question
  allQuestions: Question[]
  open: boolean
  onOpenChange: (open: boolean) => void
  onSave: (logic: LogicRule[]) => void
}

export function LogicEditor({ question, allQuestions, open, onOpenChange, onSave }: LogicEditorProps) {
  const t = useTranslations("LogicEditor")
  const normalizedQuestion = React.useMemo(() => normalizeQuestionLogic(question), [question])
  const [rules, setRules] = React.useState<LogicRule[]>(normalizedQuestion.logic || [])

  React.useEffect(() => {
    setRules(normalizedQuestion.logic || [])
  }, [normalizedQuestion, open])

  const isCompatible =
    normalizedQuestion.type === "single" ||
    normalizedQuestion.type === "select" ||
    normalizedQuestion.type === "multi"
  const isMultiQuestion = normalizedQuestion.type === "multi"
  const normalizedOptions = normalizedQuestion.options || []

  const currentQuestionIndex = allQuestions.findIndex((item) => item.id === normalizedQuestion.id)

  const samePageQuestions: Question[] = []
  for (let index = currentQuestionIndex + 1; index < allQuestions.length; index += 1) {
    if (allQuestions[index].type === "section") break
    samePageQuestions.push(allQuestions[index])
  }

  const subsequentPages = allQuestions.slice(currentQuestionIndex + 1).filter((item) => item.type === "section")

  const addRule = () => {
    const firstOption = normalizedOptions[0]
    const firstOptionId = firstOption?.id
    if (!firstOptionId) return

    setRules((currentRules) => [
      ...currentRules,
      {
        triggerOption: firstOption.label,
        operator: "or",
        conditions: [{ optionId: firstOptionId, match: "includes" }],
        destinationQuestionId: "",
      },
    ])
  }

  const addCondition = (ruleIndex: number) => {
    const firstOption = normalizedOptions[0]
    const firstOptionId = firstOption?.id
    if (!firstOptionId) return

    setRules((currentRules) =>
      currentRules.map((rule, index) =>
        index === ruleIndex
          ? {
              ...rule,
              conditions: [...(rule.conditions || []), { optionId: firstOptionId, match: "includes" }],
            }
          : rule
      )
    )
  }

  const removeRule = (index: number) => {
    setRules((currentRules) => currentRules.filter((_, currentIndex) => currentIndex !== index))
  }

  const updateRule = (index: number, updates: Partial<LogicRule>) => {
    setRules((currentRules) =>
      currentRules.map((rule, currentIndex) => (currentIndex === index ? { ...rule, ...updates } : rule))
    )
  }

  const updateCondition = (
    ruleIndex: number,
    conditionIndex: number,
    field: "optionId" | "match",
    value: string
  ) => {
    setRules((currentRules) =>
      currentRules.map((rule, currentIndex) => {
        if (currentIndex !== ruleIndex) return rule

        const nextConditions = [...(rule.conditions || [])]
        const nextCondition = nextConditions[conditionIndex]
        if (!nextCondition) return rule

        nextConditions[conditionIndex] = {
          ...nextCondition,
          [field]: value,
        }

        return {
          ...rule,
          conditions: nextConditions,
        }
      })
    )
  }

  const removeCondition = (ruleIndex: number, conditionIndex: number) => {
    setRules((currentRules) =>
      currentRules.map((rule, currentIndex) => {
        if (currentIndex !== ruleIndex) return rule

        return {
          ...rule,
          conditions: (rule.conditions || []).filter((_, index) => index !== conditionIndex),
        }
      })
    )
  }

  const handleSave = () => {
    onSave(rules)
    onOpenChange(false)
  }

  const renderDestinationSelect = (rule: LogicRule, ruleIndex: number) => {
    const destinationId = rule.destinationQuestionId
    const isEndSurvey = destinationId === "end_survey"
    const destinationQuestion = allQuestions.find((item) => item.id === destinationId)
    const destinationIndex = allQuestions.findIndex((item) => item.id === destinationId)
    const isInvalid = !isEndSurvey && destinationId && (!destinationQuestion || destinationIndex <= currentQuestionIndex)
    const invalidReason = !destinationQuestion
      ? t("invalidDeleted")
      : destinationIndex <= currentQuestionIndex
        ? t("invalidPosition")
        : ""

    return (
      <div className="space-y-1">
        <Label className="text-xs text-gray-500">{t("jumpTo")}</Label>
        <div className="flex items-center gap-2">
          <Select value={rule.destinationQuestionId} onValueChange={(value) => updateRule(ruleIndex, { destinationQuestionId: value })}>
            <SelectTrigger className={`h-9 flex-1 ${isInvalid ? "border-red-500 bg-red-50 dark:bg-red-900/20" : ""}`}>
              <SelectValue placeholder="Select Question">
                {isInvalid && destinationQuestion ? (
                  <span className="text-red-600">
                    {destinationQuestion.title || t("untitledQuestion")} {invalidReason}
                  </span>
                ) : isInvalid && !destinationQuestion ? (
                  <span className="text-red-600">
                    {t("deletedQuestion")} {invalidReason}
                  </span>
                ) : undefined}
              </SelectValue>
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="end_survey">{t("endSurvey")}</SelectItem>

              {samePageQuestions.length > 0 ? (
                <SelectGroup>
                  <SelectLabel>{t("currentPage")}</SelectLabel>
                  {samePageQuestions.map((item) => (
                    <SelectItem key={item.id} value={item.id}>
                      {item.title || t("untitledQuestion")}
                    </SelectItem>
                  ))}
                </SelectGroup>
              ) : null}

              {subsequentPages.length > 0 ? (
                <SelectGroup>
                  <SelectLabel>{t("goToPage")}</SelectLabel>
                  {subsequentPages.map((item) => (
                    <SelectItem key={item.id} value={item.id}>
                      {item.title || t("untitledPage")}
                    </SelectItem>
                  ))}
                </SelectGroup>
              ) : null}
            </SelectContent>
          </Select>
          {isInvalid ? (
            <div className="text-red-500" title={t("invalidTitle", { reason: invalidReason })}>
              <AlertTriangle className="h-5 w-5" />
            </div>
          ) : null}
        </div>
      </div>
    )
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-[720px]" onInteractOutside={(event) => event.preventDefault()}>
        <DialogHeader>
          <DialogTitle>{t("title", { title: normalizedQuestion.title })}</DialogTitle>
          <DialogDescription>{t("precedenceHint")}</DialogDescription>
        </DialogHeader>

        {!isCompatible ? (
          <div className="py-6 text-center text-gray-500">{t("unsupported")}</div>
        ) : (
          <div className="space-y-4 py-4">
            {rules.length === 0 ? (
              <div className="rounded-lg border-2 border-dashed py-4 text-center text-sm text-gray-500">{t("empty")}</div>
            ) : (
              <div className="space-y-3">
                {rules.map((rule, ruleIndex) => {
                  const conditions = rule.conditions || []
                  const hasContradiction = isContradictoryLogicRule(rule)

                  return (
                    <div
                      key={ruleIndex}
                      className="space-y-4 rounded-lg border border-gray-100 bg-gray-50 p-4 dark:border-gray-800 dark:bg-gray-900"
                    >
                      {isMultiQuestion ? (
                        <div className="grid gap-4 md:grid-cols-[minmax(0,1fr)_auto_minmax(0,1fr)] md:items-start">
                          <div className="space-y-3">
                            <div className="space-y-1">
                              <Label className="text-xs text-gray-500">{t("operator")}</Label>
                              <Select
                                value={rule.operator || "or"}
                                onValueChange={(value) => updateRule(ruleIndex, { operator: value as LogicRule["operator"] })}
                              >
                                <SelectTrigger className="h-9">
                                  <SelectValue />
                                </SelectTrigger>
                                <SelectContent>
                                  <SelectItem value="and">{t("operatorAnd")}</SelectItem>
                                  <SelectItem value="or">{t("operatorOr")}</SelectItem>
                                </SelectContent>
                              </Select>
                            </div>

                            <div className="space-y-2">
                              {conditions.map((condition, conditionIndex) => {
                                const selectedOption = findQuestionOptionById(normalizedQuestion, condition.optionId)
                                const missingOptionValue = selectedOption ? null : condition.optionId || `missing-${ruleIndex}-${conditionIndex}`
                                return (
                                  <div key={`${ruleIndex}-${conditionIndex}`} className="grid gap-2 sm:grid-cols-[160px_minmax(0,1fr)_auto]">
                                    <div className="space-y-1">
                                      <Label className="text-xs text-gray-500">{t("conditionMatch")}</Label>
                                      <Select
                                        value={condition.match}
                                        onValueChange={(value) => updateCondition(ruleIndex, conditionIndex, "match", value)}
                                      >
                                        <SelectTrigger className="h-9">
                                          <SelectValue />
                                        </SelectTrigger>
                                        <SelectContent>
                                          <SelectItem value="includes">{t("conditionIncludes")}</SelectItem>
                                          <SelectItem value="excludes">{t("conditionExcludes")}</SelectItem>
                                        </SelectContent>
                                      </Select>
                                    </div>

                                    <div className="space-y-1">
                                      <Label className="text-xs text-gray-500">{t("selectOption")}</Label>
                                      <Select
                                        value={selectedOption?.id || missingOptionValue || undefined}
                                        onValueChange={(value) => updateCondition(ruleIndex, conditionIndex, "optionId", value)}
                                      >
                                        <SelectTrigger className="h-9">
                                          <SelectValue placeholder={t("selectOption")} />
                                        </SelectTrigger>
                                        <SelectContent>
                                          {!selectedOption && missingOptionValue ? (
                                            <SelectItem value={missingOptionValue}>{t("deletedQuestion")}</SelectItem>
                                          ) : null}
                                          {normalizedOptions.map((option) => (
                                            <SelectItem key={option.id} value={option.id!}>
                                              {option.label}
                                            </SelectItem>
                                          ))}
                                        </SelectContent>
                                      </Select>
                                    </div>

                                    <div className="flex items-end">
                                      <Button
                                        variant="ghost"
                                        size="icon"
                                        onClick={() => removeCondition(ruleIndex, conditionIndex)}
                                        disabled={conditions.length <= 1}
                                        className="h-9 w-9 text-gray-400 hover:text-red-500"
                                      >
                                        <Trash2 className="h-4 w-4" />
                                      </Button>
                                    </div>
                                  </div>
                                )
                              })}
                            </div>

                            <Button variant="outline" onClick={() => addCondition(ruleIndex)} className="border-dashed">
                              <Plus className="mr-2 h-4 w-4" /> {t("addCondition")}
                            </Button>

                            {hasContradiction ? (
                              <div className="flex items-center gap-2 rounded-md border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-700 dark:border-red-900/50 dark:bg-red-950/30 dark:text-red-300">
                                <AlertTriangle className="h-4 w-4 shrink-0" />
                                {t("contradictoryConditions")}
                              </div>
                            ) : null}
                          </div>

                          <div className="hidden md:flex pt-6">
                            <ArrowRight className="h-4 w-4 text-gray-400" />
                          </div>

                          {renderDestinationSelect(rule, ruleIndex)}
                        </div>
                      ) : (
                        <div className="grid gap-4 md:grid-cols-[minmax(0,1fr)_auto_minmax(0,1fr)] md:items-start">
                          <div className="space-y-1">
                            <Label className="text-xs text-gray-500">{t("ifAnswerIs")}</Label>
                            <Select
                              value={conditions[0]?.optionId || undefined}
                              onValueChange={(value) =>
                                updateRule(ruleIndex, {
                                  triggerOption: normalizedOptions.find((option) => option.id === value)?.label,
                                  operator: "or",
                                  conditions: [{ optionId: value, match: "includes" }],
                                })
                              }
                            >
                              <SelectTrigger className="h-9">
                                <SelectValue placeholder={t("selectOption")} />
                              </SelectTrigger>
                              <SelectContent>
                                {normalizedOptions.map((option) => (
                                  <SelectItem key={option.id} value={option.id!}>
                                    {option.label}
                                  </SelectItem>
                                ))}
                              </SelectContent>
                            </Select>
                          </div>

                          <div className="hidden md:flex pt-6">
                            <ArrowRight className="h-4 w-4 text-gray-400" />
                          </div>

                          {renderDestinationSelect(rule, ruleIndex)}
                        </div>
                      )}

                      <div className="flex justify-end">
                        <Button
                          variant="ghost"
                          size="icon"
                          onClick={() => removeRule(ruleIndex)}
                          className="text-gray-400 hover:text-red-500"
                        >
                          <Trash2 className="h-4 w-4" />
                        </Button>
                      </div>
                    </div>
                  )
                })}
              </div>
            )}

            <Button variant="outline" onClick={addRule} className="w-full border-dashed">
              <Plus className="mr-2 h-4 w-4" /> {t("addRule")}
            </Button>
          </div>
        )}

        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>
            {t("cancel")}
          </Button>
          <Button onClick={handleSave} disabled={!isCompatible}>
            {t("save")}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
