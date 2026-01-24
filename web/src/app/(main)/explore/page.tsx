"use client";

import { Suspense } from "react";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { SurveyCard } from "@/components/survey-card";
import { Search, Filter, ArrowUpDown } from "lucide-react";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { getLocaleFromPath, withLocale } from "@/lib/locale";
import { useTranslations } from "next-intl";

// Mock Data
const MOCK_SURVEYS_LIST = [
  {
    id: "1",
    title: "2024年永續包裝消費者偏好調查",
    description: "幫助我們了解環保包裝如何影響您的購買決策。您的回饋將塑造未來的產品線。",
    points: 50,
    duration: 5,
    responses: 1240,
    rating: 4.8,
    author: { name: "EcoLife Research", image: "" },
    tags: ["市場研究", "永續發展"],
    isHot: true,
    category: "market",
    visibility: 'public' as const,
  },
  {
    id: "2",
    title: "遠距工作與心理健康調查",
    description: "一項關於長期遠距工作對員工福祉和生產力影響的綜合研究。",
    points: 100,
    duration: 12,
    responses: 856,
    rating: 4.5,
    author: { name: "Dr. Sarah Chen", image: "" },
    tags: ["學術研究", "心理學"],
    isHot: false,
    category: "academic",
    visibility: 'public' as const,
  },
  {
    id: "3",
    title: "疫情後全球旅遊趨勢",
    description: "您下一次計劃去哪裡旅遊？分享您對即將到來的假期的旅遊習慣和偏好。",
    points: 30,
    duration: 3,
    responses: 3420,
    rating: 4.2,
    author: { name: "TravelWeekly", image: "" },
    tags: ["生活方式", "旅遊"],
    isHot: true,
    category: "market",
    visibility: 'public' as const,
  },
  {
    id: "4",
    title: "UX 可用性測試：新行動銀行 App",
    description: "我們正在尋找測試人員來評估我們新銀行應用程序原型的導航流程。",
    points: 150,
    duration: 15,
    responses: 120,
    rating: 4.9,
    author: { name: "FinTech UX Lab", image: "" },
    tags: ["UX 研究", "技術"],
    isHot: false,
    category: "ux",
    visibility: 'non-public' as const,
  },
  {
    id: "5",
    title: "咖啡消費習慣機查",
    description: "關於您每日咖啡攝入量和品牌偏好的快速調查。",
    points: 20,
    duration: 2,
    responses: 5600,
    rating: 4.0,
    author: { name: "BeanStats", image: "" },
    tags: ["餐飲服務"],
    isHot: false,
    category: "market",
    visibility: 'public' as const,
  },
  {
    id: "6",
    title: "教育中的 AI 工具：學生觀點",
    description: "您在學習中如何使用 ChatGPT 和其他 AI 工具？一項針對大學生的匿名調查。",
    points: 80,
    duration: 8,
    responses: 450,
    rating: 4.6,
    author: { name: "EdTech Watch", image: "" },
    tags: ["教育", "人工智慧"],
    isHot: false,
    category: "academic",
    visibility: 'public' as const,
  },
];

function ExploreContent() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const pathname = usePathname();
  const locale = getLocaleFromPath(pathname);
  const withLocalePath = (href: string) => withLocale(href, locale);
  const t = useTranslations("Explore");
  const tCategories = useTranslations("Categories");
  
  const searchQuery = searchParams.get('q') || '';
  const category = searchParams.get('category') || 'all';
  const sort = searchParams.get('sort') || 'recommended';

  // State update helpers
  const updateSearch = (term: string) => {
    const params = new URLSearchParams(searchParams.toString());
    if (term) {
      params.set('q', term);
    } else {
      params.delete('q');
    }
    router.replace(withLocalePath(`/explore?${params.toString()}`));
  };

  const updateCategory = (val: string) => {
    const params = new URLSearchParams(searchParams.toString());
    if (val && val !== 'all') {
      params.set('category', val);
    } else {
      params.delete('category');
    }
    router.push(withLocalePath(`/explore?${params.toString()}`));
  };

  const updateSort = (val: string) => {
    const params = new URLSearchParams(searchParams.toString());
    if (val) {
      params.set('sort', val);
    } else {
      params.delete('sort');
    }
    router.push(withLocalePath(`/explore?${params.toString()}`));
  };

  // Filter Logic
  const filteredSurveys = MOCK_SURVEYS_LIST.filter(survey => {
    // Exclude non-public surveys from the marketplace listing
    if (survey.visibility !== 'public') return false;

    const matchesSearch = survey.title.toLowerCase().includes(searchQuery.toLowerCase()) || 
                           survey.description.toLowerCase().includes(searchQuery.toLowerCase());
    const matchesCategory = category === 'all' || survey.category === category;
    
    return matchesSearch && matchesCategory;
  })
  .sort((a, b) => {
    switch(sort) {
      case 'newest': return parseInt(b.id) - parseInt(a.id);
      case 'points-high': return b.points - a.points;
      case 'duration-short': return a.duration - b.duration;
      case 'recommended': 
      default: return 0;
    }
  });

  return (
    <div className="min-h-screen bg-gray-50 dark:bg-gray-950">
      {/* Header Section */}
      <div className="bg-white border-b border-gray-200 dark:bg-gray-900 dark:border-gray-800">
        <div className="container px-4 py-12 md:px-6 md:py-16">
          <div className="max-w-2xl">
            <h1 className="text-3xl font-bold tracking-tight text-gray-900 sm:text-4xl dark:text-white">
              {t("title")} <span className="text-transparent bg-clip-text bg-gradient-to-r from-purple-600 to-pink-600">{t("titleHighlight")}</span>
            </h1>
            <p className="mt-4 text-lg text-gray-500 dark:text-gray-400">
              {t("description")}
            </p>
          </div>
        </div>
      </div>

      {/* Search & Filter Section */}
      <section className="sticky top-0 z-10 bg-white/80 backdrop-blur-md border-b border-gray-200 dark:bg-gray-900/80 dark:border-gray-800" aria-label="搜尋與過濾">
        <div className="container px-4 py-4 md:px-6">
          <div className="flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
             {/* Search */}
            <div className="relative flex-1 max-w-lg w-full">
              <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-gray-400" />
              <Input 
                type="search"
                placeholder={t("searchPlaceholder")}
                className="pl-10 bg-gray-50 border-gray-200 focus-visible:ring-purple-500 dark:bg-gray-800 dark:border-gray-700 w-full"
                defaultValue={searchQuery}
                onChange={(e) => updateSearch(e.target.value)}
              />
            </div>
            
            {/* Filters */}
            <div className="flex flex-col sm:flex-row items-center gap-4 w-full lg:w-auto">
              <Select value={category} onValueChange={updateCategory}>
                <SelectTrigger className="w-full sm:w-[180px] bg-white dark:bg-gray-900">
                  <div className="flex items-center gap-2">
                    <Filter className="h-3.5 w-3.5 text-gray-500" />
                    <SelectValue placeholder={t("filterPlaceholder")} />
                  </div>
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">{t("categoryAll")}</SelectItem>
                  <SelectItem value="academic">{tCategories("social-science")}</SelectItem>
                  <SelectItem value="market">{tCategories("market-research")}</SelectItem>
                  <SelectItem value="ux">{t("categoryUx")}</SelectItem>
                </SelectContent>
              </Select>

              <Select value={sort} onValueChange={updateSort}>
                <SelectTrigger className="w-full sm:w-[180px] bg-white dark:bg-gray-900">
                  <div className="flex items-center gap-2">
                    <ArrowUpDown className="h-3.5 w-3.5 text-gray-500" />
                    <SelectValue placeholder={t("sortPlaceholder")} />
                  </div>
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="recommended">{t("sortRecommended")}</SelectItem>
                  <SelectItem value="newest">{t("sortNewest")}</SelectItem>
                  <SelectItem value="points-high">{t("sortPointsHigh")}</SelectItem>
                  <SelectItem value="duration-short">{t("sortDurationShort")}</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>
        </div>
      </section>

      {/* Grid Section */}
      <div className="container px-4 py-8 md:px-6">
        <div className="grid grid-cols-1 gap-6 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
          {filteredSurveys.map((survey) => (
            <SurveyCard key={survey.id} {...survey} locale={locale} />
          ))}
          {filteredSurveys.length === 0 && (
             <div className="col-span-full py-12 text-center text-gray-500">
               {t("noSurveys")}
             </div>
          )}
        </div>
        
        {/* Load More */}
        {filteredSurveys.length > 0 && (
          <div className="mt-12 flex justify-center">
            <Button variant="outline" size="lg" className="min-w-[200px]">
              {t("loadMore")}
            </Button>
          </div>
        )}
      </div>
    </div>
  );
}

export default function ExplorePage() {
  return (
    <Suspense fallback={<div className="min-h-screen flex items-center justify-center"><div className="animate-spin rounded-full h-8 w-8 border-b-2 border-purple-600"></div></div>}>
      <ExploreContent />
    </Suspense>
  );
}
