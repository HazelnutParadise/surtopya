import type { LogicCondition, LogicConditionMatch, LogicOperator, LogicRule, Question } from "@/types/survey"
import {
  ensureQuestionOptionIds,
  findQuestionOptionById,
  findQuestionOptionByLabel,
  normalizeChoiceQuestionOptions,
} from "@/lib/question-options"
import { getMultiAnswerValues, getSingleAnswerValue } from "@/lib/survey-answer-state"

export type LogicIssueCode =
  | "contradictory_conditions"
  | "deleted_option"
  | "deleted_destination"
  | "invalid_destination_position"

export type LogicIssue = {
  code: LogicIssueCode
  ruleIndex: number
  conditionIndex?: number
}

const isRecord = (value: unknown): value is Record<string, unknown> => {
  return typeof value === "object" && value !== null && !Array.isArray(value)
}

const normalizeConditionMatch = (value: unknown): LogicConditionMatch =>
  value === "excludes" ? "excludes" : "includes"

const normalizeOperator = (value: unknown): LogicOperator =>
  value === "and" ? "and" : "or"

const normalizeLogicCondition = (value: unknown): LogicCondition | null => {
  if (!isRecord(value)) return null
  if (typeof value.optionId !== "string" || value.optionId.trim().length === 0) return null

  return {
    optionId: value.optionId,
    match: normalizeConditionMatch(value.match),
  }
}

export const normalizeLogicRule = (question: Pick<Question, "type" | "options">, rule: LogicRule): LogicRule => {
  const normalizedConditions = Array.isArray(rule.conditions)
    ? rule.conditions.map(normalizeLogicCondition).filter((condition): condition is LogicCondition => condition !== null)
    : []

  if (normalizedConditions.length > 0) {
    return {
      triggerOption: rule.triggerOption,
      operator: normalizeOperator(rule.operator),
      conditions: normalizedConditions,
      destinationQuestionId: rule.destinationQuestionId,
    }
  }

  if (typeof rule.triggerOption === "string" && rule.triggerOption.trim().length > 0) {
    const option = findQuestionOptionByLabel(question, rule.triggerOption)
    return {
      triggerOption: rule.triggerOption,
      operator: "or",
      conditions: option?.id ? [{ optionId: option.id, match: "includes" }] : [],
      destinationQuestionId: rule.destinationQuestionId,
    }
  }

  return {
    triggerOption: rule.triggerOption,
    operator: normalizeOperator(rule.operator),
    conditions: [],
    destinationQuestionId: rule.destinationQuestionId,
  }
}

export const normalizeQuestionLogic = (question: Question): Question => {
  const normalizedOptions = ensureQuestionOptionIds(normalizeChoiceQuestionOptions(question)) || []
  const normalizedQuestion = {
    ...question,
    options: normalizedOptions,
  }

  return {
    ...normalizedQuestion,
    logic: (question.logic || []).map((rule) => normalizeLogicRule(normalizedQuestion, rule)),
  }
}

export const hasQuestionLogic = (question: Pick<Question, "logic">) => Boolean(question.logic && question.logic.length > 0)

export const isContradictoryLogicRule = (rule: LogicRule) => {
  const seen = new Map<string, LogicConditionMatch>()
  for (const condition of rule.conditions || []) {
    const previous = seen.get(condition.optionId)
    if (previous && previous !== condition.match) {
      return true
    }
    seen.set(condition.optionId, condition.match)
  }
  return false
}

export const getQuestionLogicIssues = (question: Question, allQuestions: Question[]): LogicIssue[] => {
  if (!hasQuestionLogic(question)) return []

  const normalizedQuestion = normalizeQuestionLogic(question)
  const questionIndex = allQuestions.findIndex((item) => item.id === question.id)
  const issues: LogicIssue[] = []

  normalizedQuestion.logic?.forEach((rule, ruleIndex) => {
    if (isContradictoryLogicRule(rule)) {
      issues.push({ code: "contradictory_conditions", ruleIndex })
    }

    if ((rule.conditions || []).length === 0 && rule.triggerOption) {
      issues.push({ code: "deleted_option", ruleIndex })
    }

    rule.conditions?.forEach((condition, conditionIndex) => {
      if (!findQuestionOptionById(normalizedQuestion, condition.optionId)) {
        issues.push({ code: "deleted_option", ruleIndex, conditionIndex })
      }
    })

    if (rule.destinationQuestionId === "end_survey") return

    const destinationIndex = allQuestions.findIndex((item) => item.id === rule.destinationQuestionId)
    if (destinationIndex === -1) {
      issues.push({ code: "deleted_destination", ruleIndex })
      return
    }

    if (destinationIndex <= questionIndex) {
      issues.push({ code: "invalid_destination_position", ruleIndex })
    }
  })

  return issues
}

const resolveSelectedOptionId = (question: Pick<Question, "type" | "options">, value: string) => {
  const byId = findQuestionOptionById(question, value)
  if (byId?.id) return byId.id
  const byLabel = findQuestionOptionByLabel(question, value)
  return byLabel?.id ?? ""
}

const getSelectedOptionIds = (question: Question, rawAnswer: unknown) => {
  if (question.type === "multi") {
    return getMultiAnswerValues(rawAnswer)
      .map((value) => resolveSelectedOptionId(question, value))
      .filter((value) => value.length > 0)
  }

  if (question.type === "single" || question.type === "select") {
    const selectedValue = getSingleAnswerValue(rawAnswer)
    const optionId = selectedValue ? resolveSelectedOptionId(question, selectedValue) : ""
    return optionId ? [optionId] : []
  }

  return []
}

export const logicRuleMatchesAnswer = (question: Question, rawAnswer: unknown, incomingRule: LogicRule) => {
  const rule = normalizeLogicRule(question, incomingRule)
  const selectedOptionIds = getSelectedOptionIds(normalizeQuestionLogic(question), rawAnswer)
  if (selectedOptionIds.length === 0) return false
  const conditions = rule.conditions || []
  if (conditions.length === 0) return false
  if (isContradictoryLogicRule(rule)) return false

  if (rule.operator === "and") {
    return conditions.every((condition) =>
      condition.match === "includes"
        ? selectedOptionIds.includes(condition.optionId)
        : !selectedOptionIds.includes(condition.optionId)
    )
  }

  return conditions.some((condition) =>
    condition.match === "includes"
      ? selectedOptionIds.includes(condition.optionId)
      : !selectedOptionIds.includes(condition.optionId)
  )
}
