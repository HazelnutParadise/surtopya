export const MOCK_DATASETS = [
    {
        id: "ds-1",
        title: "Global E-commerce Trends 2024",
        description: "De-identified survey data from 50,000+ respondents regarding online shopping habits across 15 countries.",
        sampleSize: "52.4k",
        format: "CSV, JSON",
        lastUpdated: "2 days ago",
        category: "Market Research",
        isPublic: true,
        downloads: "1.2k",
        apiAvailable: true,
        longDescription: "This dataset was generated through the Surtopya Open Data Program. It contains de-identified responses from multiple consumer surveys conducted between January and June 2024. All personally identifiable information (PII) such as names, emails, and precise locations has been removed or aggregated.",
        columns: [
            { name: "age_group", type: "Categorical (18-24, 25-34, etc.)" },
            { name: "primary_platform", type: "Most used e-commerce platform" },
            { name: "avg_monthly_spend", type: "Numerical (USD equivalent)" },
            { name: "satisfaction_score", type: "Rating (1-5)" }
        ],
        sampleData: [
            { id: "anon_01a", age: "18-24", country: "US", platform: "Amazon", spend: 450 },
            { id: "anon_02b", age: "25-34", country: "UK", platform: "eBay", spend: 280 },
            { id: "anon_03c", age: "18-24", country: "CA", platform: "Shopify", spend: 120 },
            { id: "anon_04d", age: "45-54", country: "DE", platform: "Amazon", spend: 1200 },
            { id: "anon_05e", age: "25-34", country: "JP", platform: "Rakuten", spend: 650 },
        ]
    },
    {
        id: "ds-2",
        title: "Remote Work & Mental Health Longitudinal Study",
        description: "Multi-year dataset tracking employee well-being in remote vs. hybrid environments. Anonymized textual sentiment included.",
        sampleSize: "12.8k",
        format: "CSV",
        lastUpdated: "1 week ago",
        category: "Social Science",
        isPublic: true,
        downloads: "856",
        apiAvailable: true,
        longDescription: "A longitudinal study exploring the relationship between remote work arrangements and employee mental health outcomes. Data includes de-identified sentiment analysis from open-ended responses.",
        columns: [
            { name: "work_mode", type: "Categorical (Remote, Hybrid, In-office)" },
            { name: "stress_level", type: "Scale (1-10)" },
            { name: "social_isolation_score", type: "Numerical" }
        ],
        sampleData: [
            { id: "anon_99x", age: "30-35", country: "FR", mood: "Neutral", mode: "Remote" },
            { id: "anon_88y", age: "22-28", country: "DE", mood: "High", mode: "Hybrid" }
        ]
    },
    {
        id: "ds-3",
        title: "Gen Z Sustainable Fashion Drivers",
        description: "Detailed analytics on purchasing drivers for sustainable apparel among youth in Asia and North America.",
        sampleSize: "8.2k",
        format: "JSON",
        lastUpdated: "3 weeks ago",
        category: "Consumer Goods",
        isPublic: false, // This will represent "Paid" now
        downloads: "420",
        apiAvailable: true,
        longDescription: "Insightful data on why Gen Z consumers choose sustainable fashion brands, focusing on price sensitivity vs. ethical alignment.",
        columns: [
            { name: "sustainability_priority", type: "Scale (1-5)" },
            { name: "price_sensitivity", type: "Scale (1-5)" }
        ],
        sampleData: [
            { id: "anon_f1", age: "18-22", country: "SG", priority: 5, price: 3 },
            { id: "anon_f2", age: "20-24", country: "US", priority: 4, price: 4 }
        ]
    },
    {
        id: "ds-4",
        title: "Health & Wellness Multidimensional Survey",
        description: "Comprehensive health data covering 20+ variables including sleep, diet, exercise, and mental health metrics across 10,000 users.",
        sampleSize: "10.4k",
        format: "CSV",
        lastUpdated: "4 days ago",
        category: "Healthcare",
        isPublic: true,
        downloads: "2.5k",
        apiAvailable: true,
        longDescription: "A multidimensional dataset capturing various aspects of human health and wellness. This wide-format data is ideal for complex correlation analysis and machine learning model training in the health tech sector.",
        columns: [
            { name: "user_id", type: "Anonymous ID" },
            { name: "age", type: "Number" },
            { name: "gender", type: "Categorical" },
            { name: "sleep_hours", type: "Floating Point" },
            { name: "rem_percent", type: "Percentage" },
            { name: "daily_steps", type: "Integer" },
            { name: "caloric_intake", type: "Integer" },
            { name: "water_liters", type: "Floating Point" },
            { name: "stress_level", type: "Scale (1-10)" },
            { name: "exercise_min", type: "Integer" },
            { name: "heart_rate_avg", type: "Integer" },
            { name: "bmi", type: "Floating Point" }
        ],
        sampleData: [
            { id: "h001", age: 28, gender: "F", sleep: 7.5, rem: 22, steps: 10400, calories: 2100, water: 2.5, stress: 4, exercise: 45, hr: 68, bmi: 22.4 },
            { id: "h002", age: 34, gender: "M", sleep: 6.2, rem: 18, steps: 5200, calories: 2800, water: 1.8, stress: 7, exercise: 15, hr: 74, bmi: 26.8 },
            { id: "h003", age: 45, gender: "NB", sleep: 8.0, rem: 25, steps: 8900, calories: 1950, water: 3.2, stress: 3, exercise: 60, hr: 62, bmi: 24.1 },
            { id: "h004", age: 19, gender: "F", sleep: 9.1, rem: 28, steps: 12000, calories: 2300, water: 2.8, stress: 2, exercise: 90, hr: 60, bmi: 21.5 },
            { id: "h005", age: 52, gender: "M", sleep: 5.5, rem: 15, steps: 3400, calories: 2500, water: 1.2, stress: 8, exercise: 0, hr: 82, bmi: 29.3 }
        ]
    }
];
