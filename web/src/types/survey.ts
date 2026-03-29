export type QuestionType = 'single' | 'multi' | 'text' | 'short' | 'long' | 'rating' | 'date' | 'select' | 'section';

export interface QuestionOption {
    label: string;
    isOther?: boolean;
}

export interface LogicRule {
    triggerOption: string;
    destinationQuestionId: string;
}

export interface Question {
    id: string;
    type: QuestionType;
    title: string;
    description?: string;
    options?: QuestionOption[]; // For single/multi/select
    required: boolean;
    logic?: LogicRule[];
    maxRating?: number; // Task 10
}

export interface SurveyTheme {
    primaryColor: string;
    backgroundColor: string;
    fontFamily: string;
}

export interface Survey {
    id: string;
    title: string;
    description: string;
    questions: Question[];
    theme?: SurveyTheme;
    settings: {
        isPublic: boolean;
        isResponseOpen: boolean;
        requireLoginToRespond: boolean;
        visibility: 'public' | 'non-public';
        isDatasetActive: boolean;
        everPublic?: boolean;
        pointsReward: number;
        expiresAt?: string;
        publishedCount?: number; // Task 6
        currentPublishedVersionNumber?: number;
        hasUnpublishedChanges?: boolean;
        isPublished?: boolean;
    };
}
