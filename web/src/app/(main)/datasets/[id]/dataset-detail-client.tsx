"use client";

import { useParams, useRouter, useSearchParams, usePathname } from "next/navigation";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Database, Download, Code, FileText, Info, BarChart, Globe, Terminal, Copy, ChevronLeft, Lock, ArrowRightLeft } from "lucide-react";
import Link from "next/link";
import { useState, useEffect } from "react";
import { MOCK_DATASETS } from "@/lib/datasets-data";

interface DatasetDetailClientProps {
  id: string;
  apiUrl: string;
}

export function DatasetDetailClient({ id, apiUrl }: DatasetDetailClientProps) {
  const router = useRouter();
  const searchParams = useSearchParams();
  const pathname = usePathname();
  
  const [activeTab, setActiveTab] = useState(searchParams.get("tab") || "overview");
  const dataset = MOCK_DATASETS.find(ds => ds.id === id);

  // Sync tab to URL
  useEffect(() => {
    const currentTab = searchParams.get("tab") || "overview";
    if (activeTab !== currentTab) {
      const params = new URLSearchParams(searchParams.toString());
      params.set("tab", activeTab);
      router.replace(`${pathname}?${params.toString()}`, { scroll: false });
    }
  }, [activeTab, pathname, router, searchParams]);

  if (!dataset) {
    return (
      <div className="min-h-screen flex flex-col items-center justify-center p-4">
        <h2 className="text-2xl font-bold mb-4">找不到數據集</h2>
        <Button asChild>
          <Link href="/datasets">返回數據市集</Link>
        </Button>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-50 dark:bg-gray-950 pb-20">
      {/* Navigation */}
      <div className="container px-4 py-6 md:px-6">
        <Button variant="ghost" asChild className="mb-4">
          <Link href="/datasets">
            <ChevronLeft className="mr-2 h-4 w-4" /> 返回
          </Link>
        </Button>
      </div>

      {/* Hero / Header */}
      <div className="bg-white border-b dark:bg-gray-900 dark:border-gray-800">
        <div className="container px-4 py-8 md:px-6">
          <div className="flex flex-col md:flex-row justify-between items-start gap-6">
            <div className="space-y-4 max-w-3xl">
              <div className="flex items-center gap-2">
                <Badge className="bg-purple-100 text-purple-700 dark:bg-purple-900/30 dark:text-purple-300">{dataset.category}</Badge>
                <Badge variant="outline">版本 2.0.4</Badge>
              </div>
              <h1 className="text-3xl md:text-4xl font-bold text-gray-900 dark:text-white">{dataset.title}</h1>
              <p className="text-lg text-gray-500 dark:text-gray-400">
                {dataset.description}
              </p>
              <div className="flex flex-wrap gap-6 text-sm">
                <div className="flex items-center gap-2">
                  <Database className="h-4 w-4 text-purple-600" />
                  <span className="font-bold">{dataset.sampleSize}</span> 樣本數
                </div>
                <div className={`flex items-center gap-2 ${dataset.isPublic ? 'text-emerald-600' : 'text-amber-600'}`}>
                  {dataset.isPublic ? <Globe className="h-4 w-4" /> : <Lock className="h-4 w-4" />}
                  {dataset.isPublic ? "完全公開" : "付費存取"}
                </div>
                <div className="flex items-center gap-2">
                  <BarChart className="h-4 w-4 text-purple-600" />
                  98% 完成率
                </div>
              </div>
            </div>
            <div className="flex flex-col gap-3 w-full md:w-auto">
              <Button className="bg-purple-600 hover:bg-purple-700 text-white shadow-lg shadow-purple-500/30 font-semibold h-11 px-8">
                <Download className="mr-2 h-4 w-4" strokeWidth={2.5} /> 下載 {dataset.format.split(',')[0]}
              </Button>
              <Button 
                variant="outline" 
                className="border-purple-200 dark:border-purple-900/50 bg-purple-50/50 dark:bg-purple-900/10 text-purple-700 dark:text-purple-300 hover:bg-purple-100 dark:hover:bg-purple-900/20 h-11 px-8"
              >
                <Terminal className="mr-2 h-4 w-4" strokeWidth={2.5} /> 透過 API 查詢
              </Button>
            </div>
          </div>
        </div>
      </div>

      {/* Content Tabs */}
      <div className="container px-4 py-10 md:px-6">
        <Tabs value={activeTab} onValueChange={setActiveTab} className="space-y-8">
          <TabsList className="bg-gray-100 dark:bg-gray-800 p-1 h-12">
            <TabsTrigger value="overview" className="px-6 h-10"><Info className="h-4 w-4 mr-2" /> 概覽</TabsTrigger>
            <TabsTrigger value="data-preview" className="px-6 h-10"><FileText className="h-4 w-4 mr-2" /> 數據預覽</TabsTrigger>
            <TabsTrigger value="api-docs" className="px-6 h-10"><Code className="h-4 w-4 mr-2" /> API 文件</TabsTrigger>
          </TabsList>

          <TabsContent value="overview" className="grid grid-cols-1 lg:grid-cols-3 gap-8">
            <div className="lg:col-span-2 space-y-8">
              <div className="prose dark:prose-invert max-w-none">
                <h3 className="text-xl font-bold">關於此數據集</h3>
                <p>
                  {dataset.longDescription}
                </p>
                <h4 className="text-lg font-bold">主要欄位</h4>
                <ul className="grid grid-cols-1 md:grid-cols-2 gap-4 list-none pl-0">
                  {dataset.columns.map((col, i) => (
                    <li key={i} className="flex flex-col p-3 rounded-lg border border-gray-200 dark:border-gray-800 bg-white dark:bg-gray-900">
                      <strong className="text-purple-600 font-mono">{col.name}</strong>
                      <span className="text-xs text-gray-500 mt-1">{col.type}</span>
                    </li>
                  ))}
                </ul>
              </div>
            </div>
            <div className="space-y-6">
              <Card>
                <CardHeader>
                  <CardTitle className="text-lg">元數據 (Metadata)</CardTitle>
                </CardHeader>
                <CardContent className="space-y-4 text-sm">
                  <div className="flex justify-between">
                    <span className="text-gray-500">許可證 (License)</span>
                    <span className="font-medium">CC BY-NC 4.0</span>
                  </div>
                  <div className="flex justify-between items-center group/doi relative">
                    <span className="text-gray-500 flex items-center gap-1">
                      DOI
                      <Info className="h-3.5 w-3.5 cursor-help" />
                      <div className="absolute bottom-full mb-2 left-0 w-64 p-2 bg-gray-900 text-white text-[10px] rounded shadow-xl opacity-0 group-hover/doi:opacity-100 transition-opacity pointer-events-none z-10">
                        數位物件識別碼 (DOI) 是一個唯一且持久的字串，為此數據集提供永久連結，以便於引用和參考。
                      </div>
                    </span>
                    <span className="font-medium text-purple-600">10.5281/surtopya.{dataset.id.replace('-', '.')}.24</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-gray-500">文件格式</span>
                    <span className="font-medium">{dataset.format}</span>
                  </div>
                </CardContent>
              </Card>
            </div>
          </TabsContent>

          <TabsContent value="api-docs">
            <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
              <div className="lg:col-span-2 space-y-6">
                <div className="space-y-4">
                  <h3 className="text-2xl font-bold">數據集 API</h3>
                  <p className="text-gray-500">
                    透過我們高效能的 RESTful API 以寫程式的方式存取此數據集。
                  </p>
                </div>

                <Card className="bg-black text-gray-300 border-gray-800 shadow-2xl">
                  <div className="p-4 border-b border-gray-800 flex justify-between items-center bg-gray-900">
                    <span className="text-xs font-mono uppercase text-gray-500">端點 (Endpoint): GET {apiUrl}/v1/datasets/{id}/query</span>
                    <Button variant="ghost" size="icon" className="h-8 w-8 text-gray-400 hover:text-white">
                      <Copy className="h-4 w-4" />
                    </Button>
                  </div>
                  <CardContent className="p-6 font-mono text-sm overflow-x-auto">
                    <pre className="text-emerald-500/90">
{`curl -X GET "${apiUrl}/v1/datasets/${id}/query" \\
     -H "Authorization: Bearer YOUR_API_KEY" \\
     -G \\
     --data-urlencode "limit=10" \\
     --data-urlencode "filter=${dataset.columns[0]?.name}:value"`}
                    </pre>
                  </CardContent>
                </Card>

                <div className="space-y-4">
                  <h4 className="text-lg font-bold">Python 範例</h4>
                   <Card className="bg-gray-100 dark:bg-gray-800 border-0">
                    <CardContent className="p-6 font-mono text-sm overflow-x-auto text-purple-600 dark:text-purple-400">
                      <pre>
{`import requests
 
url = "${apiUrl}/v1/datasets/${id}/query"
params = {"limit": 100}
response = requests.get(url, params=params)
 
data = response.json()
print(f"Retrieved {len(data['results'])} records.")`}
                      </pre>
                    </CardContent>
                  </Card>
                </div>
              </div>
              
              <aside className="space-y-6">
                <div className="p-6 rounded-2xl bg-gradient-to-br from-blue-600 to-purple-700 text-white shadow-xl">
                  <Terminal className="h-8 w-8 mb-4" />
                  <h4 className="font-bold text-lg">直接數據串流</h4>
                  <p className="text-sm text-blue-100 mt-2 leading-relaxed">
                    我們的後端支援直接將大型 JSON 回應串流到您的數據管道中。大型匯出不會造成超時。
                  </p>
                  <Button variant="secondary" className="w-full mt-6 bg-white/20 hover:bg-white/30 text-white border-0">
                    查看 API 參考項目
                  </Button>
                </div>
              </aside>
            </div>
          </TabsContent>

          <TabsContent value="data-preview">
            <div className="flex items-center gap-2 mb-4 text-xs text-gray-400 bg-gray-100 dark:bg-gray-800/50 w-fit px-3 py-1.5 rounded-full">
              <ArrowRightLeft className="h-3 w-3" />
              <span>水平捲動以查看所有欄位</span>
            </div>
            <Card className="border-0 shadow-xl overflow-hidden ring-1 ring-gray-200 dark:ring-gray-800">
              <CardContent className="p-0">
                <div className="overflow-x-auto custom-scrollbar">
                  <table className="w-full text-sm text-left text-gray-500 dark:text-gray-400">
                    <thead className="text-xs text-gray-700 uppercase bg-gray-50/80 dark:bg-gray-800/80 backdrop-blur-sm sticky top-0 dark:text-gray-400">
                      <tr>
                        {Object.keys(dataset.sampleData[0]).map((key) => (
                          <th key={key} className="px-6 py-4 whitespace-nowrap">{key.toUpperCase()}</th>
                        ))}
                      </tr>
                    </thead>
                    <tbody className="divide-y dark:divide-gray-800">
                      {dataset.sampleData.map((row, i) => (
                        <tr key={i} className="bg-white dark:bg-gray-900 hover:bg-gray-50 dark:hover:bg-gray-800/50 transition-colors">
                          {Object.values(row).map((val, j) => (
                            <td key={j} className={`px-6 py-4 whitespace-nowrap ${j === 0 ? 'font-mono text-xs text-purple-600' : ''} ${typeof val === 'number' ? 'text-gray-900 dark:text-gray-100 font-bold' : ''}`}>
                              {typeof val === 'number' && j === Object.values(row).length - 1 ? `$${val}` : val}
                            </td>
                          ))}
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </CardContent>
            </Card>
            <div className="mt-4 text-center text-xs text-gray-500">
              顯示 {dataset.title} 的樣本記錄。
            </div>
          </TabsContent>
        </Tabs>
      </div>
    </div>
  );
}

function Users({ className }: { className?: string }) {
  return (
    <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className={className}>
      <path d="M16 21v-2a4 4 0 0 0-4-4H6a4 4 0 0 0-4 4v2" /><circle cx="9" cy="7" r="4" /><path d="M22 21v-2a4 4 0 0 0-3-3.87" /><path d="M16 3.13a4 4 0 0 1 0 7.75" />
    </svg>
  );
}
