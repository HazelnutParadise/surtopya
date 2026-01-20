import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { SurveyCard } from "@/components/survey-card";
import { Plus, BarChart3, Wallet, Award } from "lucide-react";
import Link from "next/link";

// Mock Data for Dashboard
const MY_SURVEYS = [
  {
    id: "my-1",
    title: "Customer Satisfaction Survey",
    description: "Gathering feedback from our customers about their experience.",
    points: 25,
    duration: 5,
    responses: 156,
    rating: 4.5,
    author: { name: "You", image: "" },
    tags: ["Feedback"],
    isHot: false,
    visibility: 'public' as const,
    hasUnpublishedChanges: true,
  },
  {
    id: "my-2",
    title: "Employee Engagement Survey",
    description: "Annual survey to measure employee engagement and satisfaction.",
    points: 50,
    duration: 10,
    responses: 89,
    rating: 4.2,
    author: { name: "You", image: "" },
    tags: ["HR"],
    isHot: false,
    visibility: 'non-public' as const,
  },
  {
    id: "my-3",
    title: "Product Feature Request",
    description: "Help us prioritize new features for the next release.",
    points: 30,
    duration: 3,
    responses: 245,
    rating: 4.8,
    author: { name: "You", image: "" },
    tags: ["Product"],
    isHot: true,
    visibility: 'public' as const,
  },
];

export default function DashboardPage() {
  return (
    <div className="min-h-screen bg-gray-50 dark:bg-gray-950 pb-20">
      {/* Dashboard Header */}
      <div className="bg-white border-b border-gray-200 dark:bg-gray-900 dark:border-gray-800">
        <div className="container px-4 py-8 md:px-6">
          <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4">
            <div>
              <h1 className="text-2xl font-bold text-gray-900 dark:text-white">Dashboard</h1>
              <p className="text-gray-500 dark:text-gray-400">Welcome back, User</p>
            </div>
            <Button asChild className="bg-purple-600 hover:bg-purple-700 text-white">
              <Link href="/create">
                <Plus className="mr-2 h-4 w-4" /> Create New Survey
              </Link>
            </Button>
          </div>
        </div>
      </div>

      <div className="container px-4 py-8 md:px-6 space-y-8">
        {/* Stats Grid */}
        <div className="grid grid-cols-1 gap-4 md:grid-cols-3">
          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">Total Responses</CardTitle>
              <BarChart3 className="h-4 w-4 text-gray-500" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">1,234</div>
              <p className="text-xs text-gray-500">+20.1% from last month</p>
            </CardContent>
          </Card>
          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">Points Balance</CardTitle>
              <Wallet className="h-4 w-4 text-gray-500" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">5,600</div>
              <p className="text-xs text-gray-500">~$56.00 value</p>
            </CardContent>
          </Card>
          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">Active Surveys</CardTitle>
              <Award className="h-4 w-4 text-gray-500" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">3</div>
              <p className="text-xs text-gray-500">2 ending soon</p>
            </CardContent>
          </Card>
        </div>

        {/* My Surveys */}
        <div>
          <h2 className="text-xl font-semibold text-gray-900 dark:text-white mb-4">My Surveys</h2>
          <div className="grid grid-cols-1 gap-6 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
            {MY_SURVEYS.map((survey) => (
              <SurveyCard key={survey.id} {...survey} variant="dashboard" />
            ))}
            
            {/* Create New Card Placeholder */}
            <Link href="/create" className="group flex h-full flex-col items-center justify-center rounded-xl border-2 border-dashed border-gray-200 bg-white/50 p-6 transition-all hover:border-purple-500 hover:bg-purple-50/50 dark:border-gray-800 dark:bg-gray-900/50 dark:hover:border-purple-500/50 dark:hover:bg-purple-900/20">
              <div className="mb-4 rounded-full bg-gray-100 p-4 group-hover:bg-purple-100 dark:bg-gray-800 dark:group-hover:bg-purple-900">
                <Plus className="h-6 w-6 text-gray-500 group-hover:text-purple-600 dark:text-gray-400 dark:group-hover:text-purple-400" />
              </div>
              <h3 className="text-lg font-semibold text-gray-900 group-hover:text-purple-600 dark:text-white dark:group-hover:text-purple-400">Create New Survey</h3>
              <p className="text-sm text-gray-500 dark:text-gray-400">Start from scratch or template</p>
            </Link>
          </div>
        </div>
      </div>
    </div>
  );
}
