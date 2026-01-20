
import { Survey, SurveyTheme } from "@/types/survey";

export type MockSurveyData = Survey & {
    estimatedTime: string;
    responseCount: number;
    creator: string;
    theme?: SurveyTheme;
};

export const MOCK_SURVEYS: Record<string, MockSurveyData> = {
    "1": {
        id: "1",
        title: "Consumer Preferences 2024",
        description: "Help us understand your shopping habits. This comprehensive survey covers your online shopping experience, preferred platforms, and purchasing behaviors. Your insights will help shape the future of e-commerce.",
        questions: [
            {
                id: "sec1",
                type: "section",
                title: "Shopping Habits",
                description: "Tell us about your online shopping experience.",
                required: false,
                points: 0,
            },
            {
                id: "q1",
                type: "single",
                title: "How often do you shop online?",
                required: true,
                options: ["Daily", "Weekly", "Monthly", "Rarely"],
                points: 10,
            },
            {
                id: "q2",
                type: "multi",
                title: "Which platforms do you use? (Select all that apply)",
                required: false,
                options: ["Amazon", "eBay", "Shopify Stores", "Etsy", "AliExpress"],
                points: 10,
            },
            {
                id: "q3",
                type: "text",
                title: "What is your biggest frustration with online shopping?",
                required: true,
                points: 10,
            },
            {
                id: "q4",
                type: "rating",
                title: "Rate your last online shopping experience",
                required: true,
                points: 10,
            },
            {
                id: "sec2",
                type: "section",
                title: "Demographics",
                description: "Tell us a bit about yourself.",
                required: false,
                points: 0,
            },
            {
                id: "q5",
                type: "select",
                title: "What is your age group?",
                required: true,
                options: ["18-24", "25-34", "35-44", "45-54", "55+"],
                points: 10,
            },
            {
                id: "q6",
                type: "date",
                title: "When did you last make an online purchase?",
                required: false,
                points: 10,
            },
        ],
        settings: {
            isPublic: true,
            isPublished: true,
            visibility: 'public',
            isDatasetActive: true,
            pointsReward: 50,
        },
        estimatedTime: "2-3 min",
        responseCount: 1247,
        creator: "Market Research Inc.",
    },
    "2": {
        id: "2",
        title: "Tech Adoption Survey",
        description: "Share your technology preferences and habits. We want to understand how people interact with new technologies and what drives adoption decisions.",
        questions: [
            { id: "sec1", type: "section", title: "Technology Usage", required: false, points: 0 },
            { id: "q1", type: "single", title: "What is your primary device?", required: true, options: ["Smartphone", "Laptop", "Desktop", "Tablet"], points: 10 },
        ],
        settings: {
            isPublic: true,
            isPublished: true,
            visibility: 'public',
            isDatasetActive: true,
            pointsReward: 75,
        },
        estimatedTime: "5 min",
        responseCount: 892,
        creator: "Tech Insights Lab",
    },
    "preview": {
        id: "preview",
        title: "Preview Survey",
        description: "",
        questions: [],
        settings: {
            isPublic: true,
            isPublished: false,
            visibility: 'non-public',
            isDatasetActive: false,
            pointsReward: 0
        },
        estimatedTime: "N/A",
        responseCount: 0,
        creator: "You",
    }
};
