import Link from "next/link";
import { Button } from "@/components/ui/button";

import { Navbar } from "@/components/navbar";
import { cookies } from "next/headers";
import { withLocale } from "@/lib/locale";
import { getServerTranslator } from "@/lib/i18n-server";

export default async function Home() {
  const localeCookieStore = await cookies();
  const locale = localeCookieStore.get("NEXT_LOCALE")?.value || "zh-TW";
  const t = await getServerTranslator("Home");
  return (
    <div className="flex flex-col min-h-screen">
      <Navbar />
      <main className="flex-1">
        <section className="w-full py-12 md:py-24 lg:py-32 xl:py-48 bg-black text-white">
          <div className="container px-4 md:px-6">
            <div className="flex flex-col items-center space-y-4 text-center">
              <div className="space-y-2">
                <h1 className="text-3xl font-bold tracking-tighter sm:text-4xl md:text-5xl lg:text-6xl leading-tight bg-clip-text text-transparent bg-gradient-to-r from-blue-400 via-purple-500 to-pink-500">
                  {t("heroTitle")}
                </h1>
                <p className="mx-auto max-w-[700px] text-gray-400 md:text-xl">
                  {t("heroSubtitle")}
                </p>
              </div>
              <div className="space-x-4">
                <Button asChild className="bg-white text-black hover:bg-gray-200">
                  <Link href={withLocale("/create", locale)}>{t("getStarted")}</Link>
                </Button>
                <Button variant="outline" asChild className="border-white bg-transparent text-white hover:bg-white hover:text-black">
                  <Link href={withLocale("/explore", locale)}>{t("browseSurveys")}</Link>
                </Button>
              </div>
            </div>
          </div>
        </section>
        <section className="w-full py-12 md:py-24 lg:py-32 bg-gray-100 dark:bg-gray-800">
          <div className="container px-4 md:px-6">
            <div className="grid gap-10 sm:grid-cols-2 lg:grid-cols-3">
              <div className="flex flex-col items-center space-y-4 text-center">
                <div className="p-4 bg-white rounded-full shadow-lg dark:bg-gray-900">
                  <svg
                    className=" h-10 w-10 text-purple-600"
                    fill="none"
                    height="24"
                    stroke="currentColor"
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    strokeWidth="2"
                    viewBox="0 0 24 24"
                    width="24"
                    xmlns="http://www.w3.org/2000/svg"
                  >
                    <path d="M14.5 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V7.5L14.5 2z" />
                    <polyline points="14 2 14 8 20 8" />
                  </svg>
                </div>
                <h2 className="text-xl font-bold">{t("featureOneTitle")}</h2>
                <p className="text-gray-500 dark:text-gray-400">
                  {t("featureOneDescription")}
                </p>
              </div>
              <div className="flex flex-col items-center space-y-4 text-center">
                <div className="p-4 bg-white rounded-full shadow-lg dark:bg-gray-900">
                  <svg
                    className=" h-10 w-10 text-pink-600"
                    fill="none"
                    height="24"
                    stroke="currentColor"
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    strokeWidth="2"
                    viewBox="0 0 24 24"
                    width="24"
                    xmlns="http://www.w3.org/2000/svg"
                  >
                    <circle cx="12" cy="12" r="10" />
                    <line x1="2" x2="22" y1="12" y2="12" />
                    <path d="M12 2a15.3 15.3 0 0 1 4 10 15.3 15.3 0 0 1-4 10 15.3 15.3 0 0 1-4-10 15.3 15.3 0 0 1 4-10z" />
                  </svg>
                </div>
                <h2 className="text-xl font-bold">{t("featureTwoTitle")}</h2>
                <p className="text-gray-500 dark:text-gray-400">
                  {t("featureTwoDescription")}
                </p>
              </div>
              <div className="flex flex-col items-center space-y-4 text-center">
                <div className="p-4 bg-white rounded-full shadow-lg dark:bg-gray-900">
                  <svg
                    className=" h-10 w-10 text-blue-600"
                    fill="none"
                    height="24"
                    stroke="currentColor"
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    strokeWidth="2"
                    viewBox="0 0 24 24"
                    width="24"
                    xmlns="http://www.w3.org/2000/svg"
                  >
                    <path d="M21.21 15.89A10 10 0 1 1 8 2.83" />
                    <path d="M22 12A10 10 0 0 0 12 2v10z" />
                  </svg>
                </div>
                <h2 className="text-xl font-bold">{t("featureThreeTitle")}</h2>
                <p className="text-gray-500 dark:text-gray-400">
                  {t("featureThreeDescription")}
                </p>
              </div>
            </div>
          </div>
        </section>
      </main>
      <footer className="flex flex-col gap-2 sm:flex-row py-6 w-full shrink-0 items-center px-4 md:px-6 border-t">
        <p className="text-xs text-gray-500 dark:text-gray-400">
          {t("footerCopyright")}
        </p>
        <nav className="sm:ml-auto flex gap-4 sm:gap-6">
          <Link className="text-xs hover:underline underline-offset-4" href="#">
            {t("footerTerms")}
          </Link>
          <Link className="text-xs hover:underline underline-offset-4" href="#">
            {t("footerPrivacy")}
          </Link>
        </nav>
      </footer>
    </div>
  );
}
