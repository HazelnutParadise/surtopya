import type {
  ChoiceLogicCondition,
  LogicCondition,
  LogicConditionMatch,
  LogicOperator,
  LogicRule,
  Question,
  ScalarLogicCondition,
} from "@/types/survey"
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
  | "invalid_default_destination"
  | "invalid_scalar_value"
  | "incomplete_scalar_range"
  | "invalid_scalar_range"
  | "invalid_condition_type"
  | "multiple_exclusive_options"
  | "invalid_selection_bounds"

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

export const isScalarLogicCondition = (value: LogicCondition | null | undefined): value is ScalarLogicCondition => {
  return Boolean(value && value.kind === "scalar")
}

export const isChoiceLogicCondition = (value: LogicCondition | null | undefined): value is ChoiceLogicCondition => {
  return Boolean(value && !isScalarLogicCondition(value) && typeof value.optionId === "string" && value.optionId.length > 0)
}

const normalizeLogicCondition = (value: unknown): LogicCondition | null => {
  if (!isRecord(value)) return null

  if (value.kind === "scalar" || typeof value.comparator === "string") {
    if (typeof value.comparator !== "string" || typeof value.value !== "string") return null
    return {
      kind: "scalar",
      comparator:
        value.comparator === "between" || value.comparator === "not_between" || value.comparator === "gt"
          ? value.comparator
          : "lt",
      value: value.value,
      secondaryValue: typeof value.secondaryValue === "string" ? value.secondaryValue : undefined,
    }
  }

  if (typeof value.optionId !== "string" || value.optionId.trim().length === 0) return null

  return {
    kind: value.kind === "choice" ? "choice" : undefined,
    optionId: value.optionId,
    match: normalizeConditionMatch(value.match),
  }
}

const getChoiceConditions = (rule: LogicRule) =>
  (rule.conditions || []).filter((condition): condition is ChoiceLogicCondition => isChoiceLogicCondition(condition))

const getScalarConditions = (rule: LogicRule) =>
  (rule.conditions || []).filter((condition): condition is ScalarLogicCondition => isScalarLogicCondition(condition))

export type SurveyPage = {
  section: Question | null
  questions: Question[]
}

export const buildSurveyPages = (questions: Question[]): SurveyPage[] => {
  const pages = questions.reduce<SurveyPage[]>((acc, question) => {
    if (question.type === "section") {
      acc.push({ section: question, questions: [] })
      return acc
    }

    if (acc.length === 0) {
      acc.push({ section: null, questions: [] })
    }

    acc[acc.length - 1].questions.push(question)
    return acc
  }, [])

  if (pages.length === 0 && questions.length > 0) {
    return [{ section: null, questions: questions.filter((question) => question.type !== "section") }]
  }

  return pages
}

const findPageIndexForQuestionId = (questions: Question[], questionId: string) => {
  const pages = buildSurveyPages(questions)
  return pages.findIndex((page) =>
    page.section?.id === questionId || page.questions.some((question) => question.id === questionId)
  )
}

export const getLaterSectionQuestions = (allQuestions: Question[], questionId: string) => {
  const currentPageIndex = findPageIndexForQuestionId(allQuestions, questionId)
  if (currentPageIndex === -1) return []

  return buildSurveyPages(allQuestions)
    .slice(currentPageIndex + 1)
    .map((page) => page.section)
    .filter((section): section is Question => section?.type === "section")
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
  for (const condition of getChoiceConditions(rule)) {
    const previous = seen.get(condition.optionId)
    if (previous && previous !== condition.match) {
      return true
    }
    seen.set(condition.optionId, condition.match)
  }
  return false
}

const isValidDateOnly = (value: string) => /^\d{4}-\d{2}-\d{2}$/.test(value)

const parseRatingNumber = (value: unknown) => {
  if (typeof value === "number" && Number.isFinite(value)) return value
  if (typeof value === "string" && value.trim().length > 0) {
    const parsed = Number.parseFloat(value)
    if (Number.isFinite(parsed)) return parsed
  }
  return null
}

const validateScalarCondition = (question: Question, condition: ScalarLogicCondition): LogicIssueCode | null => {
  const isRange = condition.comparator === "between" || condition.comparator === "not_between"

  if (!condition.value.trim()) return "invalid_scalar_value"
  if (isRange && !condition.secondaryValue?.trim()) return "incomplete_scalar_range"

  if (question.type === "rating") {
    const primary = parseRatingNumber(condition.value)
    if (primary === null) return "invalid_scalar_value"
    if (!isRange) return null
    const secondary = parseRatingNumber(condition.secondaryValue)
    if (secondary === null) return "incomplete_scalar_range"
    return primary <= secondary ? null : "invalid_scalar_range"
  }

  if (question.type === "date") {
    if (!isValidDateOnly(condition.value)) return "invalid_scalar_value"
    if (!isRange) return null
    if (!condition.secondaryValue || !isValidDateOnly(condition.secondaryValue)) return "incomplete_scalar_range"
    return condition.value <= condition.secondaryValue ? null : "invalid_scalar_range"
  }

  return "invalid_condition_type"
}

const getExclusiveOptions = (question: Question) => {
  return (question.options || []).filter((option) => option.exclusive === true)
}

const hasInvalidSelectionBounds = (question: Question) => {
  if (question.type !== "multi") return false

  const optionCount = (question.options || []).length
  const minSelections = question.minSelections
  const maxSelections = question.maxSelections

  if (minSelections != null && (!Number.isInteger(minSelections) || minSelections < 0)) {
    return true
  }

  if (maxSelections != null && (!Number.isInteger(maxSelections) || maxSelections < 1)) {
    return true
  }

  if (minSelections != null && maxSelections != null && minSelections > maxSelections) {
    return true
  }

  if (minSelections != null && minSelections > optionCount) {
    return true
  }

  if (maxSelections != null && maxSelections > optionCount) {
    return true
  }

  return false
}

const hasInvalidDefaultDestination = (question: Question, allQuestions: Question[]) => {
  if (question.type !== "section") return false

  const destinationId = question.defaultDestinationQuestionId?.trim()
  if (!destinationId) return false
  if (destinationId === "end_survey") return false

  const currentPageIndex = findPageIndexForQuestionId(allQuestions, question.id)
  const destinationQuestion = allQuestions.find((candidate) => candidate.id === destinationId)
  const destinationPageIndex = findPageIndexForQuestionId(allQuestions, destinationId)

  return (
    !destinationQuestion ||
    destinationQuestion.type !== "section" ||
    currentPageIndex === -1 ||
    destinationPageIndex === -1 ||
    destinationPageIndex <= currentPageIndex
  )
}

export const getQuestionLogicIssues = (question: Question, allQuestions: Question[]): LogicIssue[] => {
  const normalizedQuestion = normalizeQuestionLogic(question)
  const issues: LogicIssue[] = []
  const currentPageIndex = findPageIndexForQuestionId(allQuestions, normalizedQuestion.id)

  if (normalizedQuestion.type === "section") {
    if (hasInvalidDefaultDestination(normalizedQuestion, allQuestions)) {
      issues.push({ code: "invalid_default_destination", ruleIndex: -1 })
    }
    return issues
  }

  if (normalizedQuestion.type === "multi") {
    if (getExclusiveOptions(normalizedQuestion).length > 1) {
      issues.push({ code: "multiple_exclusive_options", ruleIndex: -1 })
    }
    if (hasInvalidSelectionBounds(normalizedQuestion)) {
      issues.push({ code: "invalid_selection_bounds", ruleIndex: -1 })
    }
  }

  if (!hasQuestionLogic(normalizedQuestion)) return issues

  normalizedQuestion.logic?.forEach((rule, ruleIndex) => {
    const choiceConditions = getChoiceConditions(rule)
    const scalarConditions = getScalarConditions(rule)

    if (normalizedQuestion.type === "single" || normalizedQuestion.type === "select" || normalizedQuestion.type === "multi") {
      if (scalarConditions.length > 0) {
        issues.push({ code: "invalid_condition_type", ruleIndex })
      }

      if (isContradictoryLogicRule(rule)) {
        issues.push({ code: "contradictory_conditions", ruleIndex })
      }

      if (choiceConditions.length === 0 && rule.triggerOption) {
        issues.push({ code: "deleted_option", ruleIndex })
      }

      choiceConditions.forEach((condition, conditionIndex) => {
        if (!findQuestionOptionById(normalizedQuestion, condition.optionId)) {
          issues.push({ code: "deleted_option", ruleIndex, conditionIndex })
        }
      })
    } else if (normalizedQuestion.type === "rating" || normalizedQuestion.type === "date") {
      if (choiceConditions.length > 0 || scalarConditions.length > 1) {
        issues.push({ code: "invalid_condition_type", ruleIndex })
      } else if (scalarConditions.length === 0) {
        issues.push({ code: "invalid_scalar_value", ruleIndex })
      } else {
        const scalarIssue = validateScalarCondition(normalizedQuestion, scalarConditions[0])
        if (scalarIssue) {
          issues.push({ code: scalarIssue, ruleIndex })
        }
      }
    }

    if (rule.destinationQuestionId === "end_survey") return

    const destinationQuestion = allQuestions.find((item) => item.id === rule.destinationQuestionId)
    if (!destinationQuestion) {
      issues.push({ code: "deleted_destination", ruleIndex })
      return
    }

    const destinationPageIndex = findPageIndexForQuestionId(allQuestions, rule.destinationQuestionId)
    if (
      destinationQuestion.type !== "section" ||
      currentPageIndex === -1 ||
      destinationPageIndex === -1 ||
      destinationPageIndex <= currentPageIndex
    ) {
      issues.push({ code: "invalid_destination_position", ruleIndex })
    }
  })

  return issues
}

export const getMultiSelectionValidationIssue = (question: Question, rawAnswer: unknown) => {
  if (question.type !== "multi") return null

  const selectedCount = getMultiAnswerValues(rawAnswer).length
  if (selectedCount === 0) return null

  if (question.minSelections != null && selectedCount < question.minSelections) {
    return "min"
  }

  if (question.maxSelections != null && selectedCount > question.maxSelections) {
    return "max"
  }

  return null
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

const matchesScalarCondition = (question: Question, rawAnswer: unknown, condition: ScalarLogicCondition) => {
  if (validateScalarCondition(question, condition)) return false

  if (question.type === "rating") {
    const answerValue = parseRatingNumber(rawAnswer)
    const primary = parseRatingNumber(condition.value)
    const secondary = parseRatingNumber(condition.secondaryValue)
    if (answerValue === null || primary === null) return false

    switch (condition.comparator) {
      case "gt":
        return answerValue > primary
      case "between":
        return secondary !== null ? answerValue >= primary && answerValue <= secondary : false
      case "not_between":
        return secondary !== null ? answerValue < primary || answerValue > secondary : false
      default:
        return answerValue < primary
    }
  }

  if (question.type === "date") {
    const answerValue = typeof rawAnswer === "string" ? rawAnswer : ""
    if (!isValidDateOnly(answerValue) || !isValidDateOnly(condition.value)) return false

    switch (condition.comparator) {
      case "gt":
        return answerValue > condition.value
      case "between":
        return Boolean(condition.secondaryValue && answerValue >= condition.value && answerValue <= condition.secondaryValue)
      case "not_between":
        return Boolean(condition.secondaryValue && (answerValue < condition.value || answerValue > condition.secondaryValue))
      default:
        return answerValue < condition.value
    }
  }

  return false
}

export const logicRuleMatchesAnswer = (question: Question, rawAnswer: unknown, incomingRule: LogicRule) => {
  const normalizedQuestion = normalizeQuestionLogic(question)
  const rule = normalizeLogicRule(normalizedQuestion, incomingRule)
  if (isContradictoryLogicRule(rule)) return false

  if (normalizedQuestion.type === "single" || normalizedQuestion.type === "select" || normalizedQuestion.type === "multi") {
    const selectedOptionIds = getSelectedOptionIds(normalizedQuestion, rawAnswer)
    if (selectedOptionIds.length === 0) return false
    const conditions = getChoiceConditions(rule)
    if (conditions.length === 0) return false

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

  if (normalizedQuestion.type === "rating" || normalizedQuestion.type === "date") {
    const scalarCondition = getScalarConditions(rule)[0]
    if (!scalarCondition) return false
    return matchesScalarCondition(normalizedQuestion, rawAnswer, scalarCondition)
  }

  return false
}
