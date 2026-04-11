import { memo, useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useSEO } from '../hooks/useSEO';
import {
  generateWebApplicationLD,
  generateFAQPageLD,
  generateOrganizationLD,
  injectStructuredData,
  removeStructuredData,
} from '../utils/structuredData';

// ============================================================
// 数据定义（求职 Agent 场景）
// ============================================================

const SITE_URL = 'https://job-agent.example.com';
const LOGO_URL = '/logo.svg';
const OG_IMAGE_URL = '/og-image.jpg';

const FEATURES = [
  {
    icon: '📋',
    title: 'JD 计划设置',
    description: '根据目标岗位定制 JD 分析计划，自动拆解职位要求，生成匹配度评估。',
  },
  {
    icon: '🔍',
    title: '岗位信息获取',
    description: '实时抓取和聚合全网岗位信息，包括薪资、要求、公司规模等核心数据。',
  },
  {
    icon: '📄',
    title: '简历针对性优化',
    description: '根据目标 JD 智能优化简历，突出匹配关键词，提高简历通过率。',
  },
  {
    icon: '🚀',
    title: '自动化投递',
    description: '一键批量投递匹配岗位，持续优化投递策略，提高面试邀约率。',
  },
  {
    icon: '📊',
    title: '投递数据分析',
    description: '可视化追踪投递进度、面试转化率、薪资分布等关键指标。',
  },
  {
    icon: '💡',
    title: '求职策略建议',
    description: '基于市场数据和你的背景，提供个性化的求职路径和技能提升建议。',
  },
];

const FAQ_ITEMS = [
  {
    question: '求职 Agent 是什么？',
    answer: '求职 Agent 是基于 AI 的智能求职工具，能帮你：1) 分析目标岗位 JD；2) 自动获取全网岗位信息；3) 针对性优化简历；4) 自动化投递简历。全程 AI 辅助，大幅提高求职效率。',
  },
  {
    question: 'JD 计划设置有什么用？',
    answer: '通过 JD 计划设置，AI 会帮你拆解目标岗位的关键词、技能要求、经验要求等，生成匹配度评分，并告诉你哪些岗位最适合你，避免盲目投递浪费时间。',
  },
  {
    question: '简历优化是如何工作的？',
    answer: 'AI 会对比你的简历和目标 JD，找出匹配度不足的关键词，提供具体的修改建议：包括如何突出相关经验、如何调整技能描述、如何量化成果等，让你的简历更吸引 HR。',
  },
  {
    question: '自动化投递安全吗？',
    answer: '自动化投递功能会模拟正常用户操作，遵守各招聘平台的使用规范。你可以设置每日投递上限、目标岗位范围等参数，确保投递质量。同时支持投递前的预览确认。',
  },
  {
    question: '求职 Agent 收费吗？',
    answer: '基础功能（JD 分析、岗位搜索、简历建议）免费使用。高级功能（自动化投递、深度数据分析、优先匹配）需要开通会员，具体请参考定价页面。',
  },
  {
    question: '适合哪些求职阶段的人？',
    answer: '适合所有求职阶段：应届生（不知道怎么找第一份工作）、1-3 年经验者（想跳槽但不知道市场情况）、资深人士（需要精准匹配高端岗位）、转行者（需要了解目标行业的岗位要求）。',
  },
];

// ============================================================
// 组件
// ============================================================

export default function LandingPage() {
  const navigate = useNavigate();

  // SEO 配置 - 针对求职场景
  useSEO({
    title: '求职 Agent - AI 智能找工作 | 简历优化 | 自动投递',
    description: '求职 Agent 是 AI 驱动的求职工具，支持 JD 计划设置、岗位信息获取、简历针对性优化、自动化投递等功能，帮你高效找到理想工作。',
    keywords: '求职,找工作,简历优化,自动投递,JD分析,岗位搜索,面试,职业规划,AI求职,智能招聘',
    canonicalUrl: SITE_URL,
    ogTitle: '求职 Agent - AI 智能求职工具',
    ogDescription: 'JD 计划设置、岗位信息获取、简历优化、自动化投递——一站式 AI 求职平台。',
    ogImage: OG_IMAGE_URL,
    twitterTitle: '求职 Agent - AI 智能求职工具',
    twitterDescription: 'AI 驱动的求职工具，帮你高效找到理想工作。',
    twitterImage: OG_IMAGE_URL,
  });

  // 注入结构化数据
  useEffect(() => {
    injectStructuredData('ld-webapp', generateWebApplicationLD({
      name: '求职 Agent',
      description: 'AI 驱动的智能求职工具，支持 JD 分析、简历优化、自动投递',
      url: SITE_URL,
      applicationCategory: 'JobSearchApplication',
      offers: {
        price: '0',
        priceCurrency: 'CNY',
      },
    }));

    injectStructuredData('ld-org', generateOrganizationLD({
      name: '求职 Agent',
      url: SITE_URL,
      logo: LOGO_URL,
    }));

    injectStructuredData('ld-faq', generateFAQPageLD(FAQ_ITEMS));

    return () => {
      removeStructuredData('ld-webapp');
      removeStructuredData('ld-org');
      removeStructuredData('ld-faq');
    };
  }, []);

  return (
    <div className="min-h-screen bg-white dark:bg-gray-950 text-gray-900 dark:text-gray-100">
      {/* Header */}
      <Header onNavigateChat={() => navigate('/chat')} />

      <main>
        {/* Hero 区域 */}
        <HeroSection onNavigateChat={() => navigate('/chat')} />

        {/* Features 区域 */}
        <FeaturesSection />

        {/* 内容区（SEO 重点 - 长文本） */}
        <ContentSection />

        {/* FAQ 区域 */}
        <FAQSection />

        {/* CTA 区域 */}
        <CTASection onNavigateChat={() => navigate('/chat')} />
      </main>

      {/* Footer */}
      <Footer />
    </div>
  );
}

// ============================================================
// Header
// ============================================================

interface HeaderProps {
  onNavigateChat: () => void;
}

const Header = memo(function Header({ onNavigateChat }: HeaderProps) {
  return (
    <header
      className="sticky top-0 z-50 border-b border-gray-100 dark:border-gray-800 bg-white/80 dark:bg-gray-950/80 backdrop-blur-md"
      role="banner"
    >
      <nav
        className="max-w-6xl mx-auto px-4 sm:px-6 lg:px-8 h-16 flex items-center justify-between"
        role="navigation"
        aria-label="主导航"
      >
        {/* Logo */}
        <a
          href="/"
          className="flex items-center gap-2.5 group"
          aria-label="求职 Agent - 首页"
        >
          <div className="w-8 h-8 rounded-lg bg-gradient-to-br from-emerald-500 to-blue-600 flex items-center justify-center shadow-sm group-hover:shadow-md transition-shadow">
            <svg className="w-5 h-5 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24" aria-hidden="true">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 13.255A23.931 23.931 0 0112 15c-3.183 0-6.22-.62-9-1.745M16 6V4a2 2 0 00-2-2h-4a2 2 0 00-2 2v2m4 6h.01M5 20h14a2 2 0 002-2V8a2 2 0 00-2-2H5a2 2 0 00-2 2v10a2 2 0 002 2z" />
            </svg>
          </div>
          <span className="font-semibold text-lg">求职 Agent</span>
        </a>

        {/* 导航链接 */}
        <div className="hidden sm:flex items-center gap-8">
          <a href="#features" className="text-sm text-gray-600 dark:text-gray-400 hover:text-gray-900 dark:hover:text-gray-100 transition-colors">
            功能
          </a>
          <a href="#about" className="text-sm text-gray-600 dark:text-gray-400 hover:text-gray-900 dark:hover:text-gray-100 transition-colors">
            关于
          </a>
          <a href="#faq" className="text-sm text-gray-600 dark:text-gray-400 hover:text-gray-900 dark:hover:text-gray-100 transition-colors">
            FAQ
          </a>
        </div>

        {/* CTA 按钮 */}
        <button
          onClick={onNavigateChat}
          className="px-4 py-2 text-sm font-medium text-white bg-emerald-600 hover:bg-emerald-700 rounded-lg transition-colors shadow-sm hover:shadow"
        >
          开始使用
        </button>
      </nav>
    </header>
  );
});

// ============================================================
// Hero Section
// ============================================================

interface HeroSectionProps {
  onNavigateChat: () => void;
}

function HeroSection({ onNavigateChat }: HeroSectionProps) {
  return (
    <section
      className="relative overflow-hidden pt-16 pb-20 sm:pt-24 sm:pb-32"
      aria-labelledby="hero-heading"
    >
      {/* 背景装饰 */}
      <div className="absolute inset-0 -z-10">
        <div className="absolute top-0 left-1/2 -translate-x-1/2 w-[800px] h-[400px] bg-gradient-to-r from-emerald-500/10 via-blue-500/10 to-purple-500/10 blur-3xl rounded-full" />
      </div>

      <div className="max-w-6xl mx-auto px-4 sm:px-6 lg:px-8 text-center">
        {/* 标签 */}
        <div className="inline-flex items-center gap-2 px-3 py-1.5 mb-6 text-xs font-medium text-emerald-700 dark:text-emerald-300 bg-emerald-50 dark:bg-emerald-900/30 rounded-full border border-emerald-200 dark:border-emerald-800">
          <span className="relative flex h-2 w-2">
            <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75" />
            <span className="relative inline-flex rounded-full h-2 w-2 bg-emerald-500" />
          </span>
          AI 驱动 · 智能求职
        </div>

        {/* 主标题 */}
        <h1
          id="hero-heading"
          className="text-4xl sm:text-5xl lg:text-6xl font-bold tracking-tight"
        >
          让你的{' '}
          <span className="bg-gradient-to-r from-emerald-600 to-blue-600 bg-clip-text text-transparent">
            求职之路
          </span>
          <br />
          更高效、更精准
        </h1>

        {/* 副标题 */}
        <p className="mt-6 text-lg sm:text-xl text-gray-600 dark:text-gray-400 max-w-2xl mx-auto leading-relaxed">
          JD 拆解 · 岗位聚合 · 简历优化 · 自动投递——AI 帮你一站式找工作。
          <br className="hidden sm:block" />
          告别海投，精准匹配，提高面试转化率。
        </p>

        {/* CTA 按钮 */}
        <div className="mt-10 flex flex-col sm:flex-row items-center justify-center gap-4">
          <button
            onClick={onNavigateChat}
            className="w-full sm:w-auto px-8 py-3.5 text-base font-semibold text-white bg-emerald-600 hover:bg-emerald-700 rounded-xl transition-all shadow-lg shadow-emerald-500/25 hover:shadow-emerald-500/40 hover:-translate-y-0.5 active:translate-y-0"
          >
            免费开始求职
          </button>
          <a
            href="#features"
            className="w-full sm:w-auto px-8 py-3.5 text-base font-semibold text-gray-700 dark:text-gray-300 bg-gray-100 dark:bg-gray-800 hover:bg-gray-200 dark:hover:bg-gray-700 rounded-xl transition-all hover:-translate-y-0.5"
          >
            了解功能
          </a>
        </div>

        {/* 信任指标 */}
        <div className="mt-12 flex flex-wrap items-center justify-center gap-x-8 gap-y-4 text-sm text-gray-500 dark:text-gray-400">
          <div className="flex items-center gap-1.5">
            <svg className="w-4 h-4 text-green-500" fill="currentColor" viewBox="0 0 20 20" aria-hidden="true">
              <path fillRule="evenodd" d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z" clipRule="evenodd" />
            </svg>
            免费使用
          </div>
          <div className="flex items-center gap-1.5">
            <svg className="w-4 h-4 text-green-500" fill="currentColor" viewBox="0 0 20 20" aria-hidden="true">
              <path fillRule="evenodd" d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z" clipRule="evenodd" />
            </svg>
            智能匹配
          </div>
          <div className="flex items-center gap-1.5">
            <svg className="w-4 h-4 text-green-500" fill="currentColor" viewBox="0 0 20 20" aria-hidden="true">
              <path fillRule="evenodd" d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z" clipRule="evenodd" />
            </svg>
            数据驱动
          </div>
        </div>
      </div>
    </section>
  );
}

// ============================================================
// Features Section
// ============================================================

const FeaturesSection = memo(function FeaturesSection() {
  return (
    <section
      id="features"
      className="py-20 sm:py-28 bg-gray-50 dark:bg-gray-900"
      aria-labelledby="features-heading"
    >
      <div className="max-w-6xl mx-auto px-4 sm:px-6 lg:px-8">
        {/* 标题 */}
        <div className="text-center mb-16">
          <h2 id="features-heading" className="text-3xl sm:text-4xl font-bold">
            一站式 AI 求职解决方案
          </h2>
          <p className="mt-4 text-lg text-gray-600 dark:text-gray-400 max-w-2xl mx-auto">
            从岗位分析到简历投递，AI 全程辅助你的求职流程
          </p>
        </div>

        {/* 功能网格 */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6 lg:gap-8">
          {FEATURES.map((feature, idx) => (
            <article
              key={idx}
              className="group p-6 bg-white dark:bg-gray-800 rounded-2xl border border-gray-200 dark:border-gray-700 hover:border-emerald-300 dark:hover:border-emerald-700 transition-all hover:shadow-lg hover:-translate-y-1"
            >
              <div className="text-3xl mb-4" aria-hidden="true">
                {feature.icon}
              </div>
              <h3 className="text-lg font-semibold mb-2 group-hover:text-emerald-600 dark:group-hover:text-emerald-400 transition-colors">
                {feature.title}
              </h3>
              <p className="text-sm text-gray-600 dark:text-gray-400 leading-relaxed">
                {feature.description}
              </p>
            </article>
          ))}
        </div>
      </div>
    </section>
  );
});

// ============================================================
// Content Section (SEO 重点 - 长文本内容)
// ============================================================

const ContentSection = memo(function ContentSection() {
  return (
    <section
      id="about"
      className="py-20 sm:py-28"
      aria-labelledby="about-heading"
    >
      <div className="max-w-6xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="max-w-3xl mx-auto">
          {/* 标题 */}
          <h2 id="about-heading" className="text-3xl sm:text-4xl font-bold text-center mb-12">
            关于求职 Agent
          </h2>

          {/* SEO 长文本内容 */}
          <article className="prose prose-gray dark:prose-invert max-w-none prose-headings:font-semibold prose-a:text-emerald-600 dark:prose-a:text-emerald-400 prose-img:rounded-xl">
            <p className="text-gray-600 dark:text-gray-400 leading-relaxed">
              <strong>求职 Agent</strong>是基于 AI 大语言模型的智能求职工具。
              它能帮你分析目标岗位 JD、获取全网岗位信息、针对性优化简历、自动化投递简历，
              并提供数据驱动的求职策略建议，让你的求职之路更高效、更精准。
            </p>

            <h3 className="text-xl font-semibold mt-8 mb-4">核心功能</h3>
            <ul className="list-disc list-outside ml-5 space-y-2 text-gray-600 dark:text-gray-400">
              <li><strong>JD 计划设置</strong>：拆解岗位要求，生成关键词匹配度分析，告诉你哪些岗位最适合</li>
              <li><strong>岗位信息获取</strong>：实时聚合各大平台的岗位数据，包括薪资、要求、公司规模等</li>
              <li><strong>简历针对性优化</strong>：对比你的简历和目标 JD，提供具体的修改建议，提高简历通过率</li>
              <li><strong>自动化投递</strong>：一键批量投递匹配岗位，持续优化投递策略，提高面试邀约率</li>
            </ul>

            <h3 className="text-xl font-semibold mt-8 mb-4">适用人群</h3>
            <ul className="list-disc list-outside ml-5 space-y-2 text-gray-600 dark:text-gray-400">
              <li><strong>应届生</strong>：不知道怎么找第一份工作，需要了解市场和岗位要求</li>
              <li><strong>1-3 年经验者</strong>：想跳槽但不清楚市场薪资和机会，需要精准匹配</li>
              <li><strong>资深人士</strong>：需要精准匹配高端岗位，避免浪费时间在不合适的机会上</li>
              <li><strong>转行者</strong>：需要了解目标行业的岗位要求，找到技能匹配的切入点</li>
            </ul>

            <h3 className="text-xl font-semibold mt-8 mb-4">为什么选择我们？</h3>
            <p className="text-gray-600 dark:text-gray-400 leading-relaxed">
              求职 Agent <strong>免费开放</strong>基础功能，无需注册即可体验 JD 分析和岗位搜索。
              我们使用 AI 大模型深度理解岗位需求和简历内容，提供比传统招聘平台更精准的匹配建议。
              同时支持账户注册，以便保存求职记录和自动化投递设置。
            </p>
          </article>
        </div>
      </div>
    </section>
  );
});

// ============================================================
// FAQ Section
// ============================================================

const FAQSection = memo(function FAQSection() {
  return (
    <section
      id="faq"
      className="py-20 sm:py-28 bg-gray-50 dark:bg-gray-900"
      aria-labelledby="faq-heading"
    >
      <div className="max-w-6xl mx-auto px-4 sm:px-6 lg:px-8">
        {/* 标题 */}
        <div className="text-center mb-12">
          <h2 id="faq-heading" className="text-3xl sm:text-4xl font-bold">
            常见问题
          </h2>
          <p className="mt-4 text-lg text-gray-600 dark:text-gray-400">
            关于求职 Agent，你可能想知道的
          </p>
        </div>

        {/* FAQ 列表 */}
        <div className="max-w-3xl mx-auto space-y-4">
          {FAQ_ITEMS.map((item, idx) => (
            <FAQItem key={idx} question={item.question} answer={item.answer} />
          ))}
        </div>
      </div>
    </section>
  );
});

// ============================================================
// FAQ Item（可折叠）
// ============================================================

interface FAQItemProps {
  question: string;
  answer: string;
}

function FAQItem({ question, answer }: FAQItemProps) {
  const [isOpen, setIsOpen] = useState(false);

  return (
    <details
      className="group bg-white dark:bg-gray-800 rounded-xl border border-gray-200 dark:border-gray-700 overflow-hidden"
      open={isOpen}
    >
      <summary
        className="flex items-center justify-between cursor-pointer p-5 list-none hover:bg-gray-50 dark:hover:bg-gray-750 transition-colors"
        onClick={(e) => {
          e.preventDefault();
          setIsOpen(!isOpen);
        }}
        role="button"
        aria-expanded={isOpen}
      >
        <h3 className="text-base font-medium pr-4">{question}</h3>
        <svg
          className="w-5 h-5 text-gray-500 flex-shrink-0 transition-transform duration-200 group-open:rotate-180"
          fill="none"
          stroke="currentColor"
          viewBox="0 0 24 24"
          aria-hidden="true"
        >
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
        </svg>
      </summary>
      <div className="px-5 pb-5 text-sm text-gray-600 dark:text-gray-400 leading-relaxed border-t border-gray-100 dark:border-gray-700 pt-4">
        {answer}
      </div>
    </details>
  );
}

// ============================================================
// CTA Section
// ============================================================

interface CTASectionProps {
  onNavigateChat: () => void;
}

function CTASection({ onNavigateChat }: CTASectionProps) {
  return (
    <section
      className="py-20 sm:py-28"
      aria-labelledby="cta-heading"
    >
      <div className="max-w-6xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="relative overflow-hidden rounded-3xl bg-gradient-to-br from-emerald-600 to-blue-700 px-6 py-16 sm:px-12 sm:py-20 text-center text-white">
          {/* 背景装饰 */}
          <div className="absolute inset-0 -z-0">
            <div className="absolute -top-24 -right-24 w-64 h-64 bg-white/10 rounded-full blur-3xl" />
            <div className="absolute -bottom-24 -left-24 w-64 h-64 bg-white/10 rounded-full blur-3xl" />
          </div>

          <div className="relative z-10">
            <h2 id="cta-heading" className="text-3xl sm:text-4xl font-bold">
              开始你的高效求职之旅
            </h2>
            <p className="mt-4 text-lg text-emerald-100 max-w-xl mx-auto">
              免费体验 JD 分析和岗位搜索，让 AI 帮你找到理想工作
            </p>
            <button
              onClick={onNavigateChat}
              className="mt-8 px-8 py-3.5 text-base font-semibold text-emerald-700 bg-white hover:bg-emerald-50 rounded-xl transition-all shadow-lg hover:shadow-xl hover:-translate-y-0.5"
            >
              免费开始使用
            </button>
          </div>
        </div>
      </div>
    </section>
  );
}

// ============================================================
// Footer
// ============================================================

const Footer = memo(function Footer() {
  const currentYear = new Date().getFullYear();

  return (
    <footer
      className="border-t border-gray-200 dark:border-gray-800 bg-white dark:bg-gray-950"
      role="contentinfo"
    >
      <div className="max-w-6xl mx-auto px-4 sm:px-6 lg:px-8 py-12">
        <div className="grid grid-cols-1 md:grid-cols-3 gap-8">
          {/* 品牌信息 */}
          <div>
            <div className="flex items-center gap-2.5 mb-4">
              <div className="w-8 h-8 rounded-lg bg-gradient-to-br from-emerald-500 to-blue-600 flex items-center justify-center">
                <svg className="w-5 h-5 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24" aria-hidden="true">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 13.255A23.931 23.931 0 0112 15c-3.183 0-6.22-.62-9-1.745M16 6V4a2 2 0 00-2-2h-4a2 2 0 00-2 2v2m4 6h.01M5 20h14a2 2 0 002-2V8a2 2 0 00-2-2H5a2 2 0 00-2 2v10a2 2 0 002 2z" />
                </svg>
              </div>
              <span className="font-semibold">求职 Agent</span>
            </div>
            <p className="text-sm text-gray-500 dark:text-gray-400 leading-relaxed">
              AI 驱动的智能求职工具，帮你高效找到理想工作。
            </p>
          </div>

          {/* 快速链接 */}
          <nav aria-label="快速链接">
            <h3 className="font-medium mb-4">快速链接</h3>
            <ul className="space-y-2 text-sm">
              <li><a href="#features" className="text-gray-500 dark:text-gray-400 hover:text-gray-900 dark:hover:text-gray-100 transition-colors">功能介绍</a></li>
              <li><a href="#about" className="text-gray-500 dark:text-gray-400 hover:text-gray-900 dark:hover:text-gray-100 transition-colors">关于我们</a></li>
              <li><a href="#faq" className="text-gray-500 dark:text-gray-400 hover:text-gray-900 dark:hover:text-gray-100 transition-colors">常见问题</a></li>
            </ul>
          </nav>

          {/* 法律信息 */}
          <nav aria-label="法律信息">
            <h3 className="font-medium mb-4">法律信息</h3>
            <ul className="space-y-2 text-sm">
              <li><a href="/privacy" className="text-gray-500 dark:text-gray-400 hover:text-gray-900 dark:hover:text-gray-100 transition-colors">隐私政策</a></li>
              <li><a href="/terms" className="text-gray-500 dark:text-gray-400 hover:text-gray-900 dark:hover:text-gray-100 transition-colors">使用条款</a></li>
              <li><a href="/contact" className="text-gray-500 dark:text-gray-400 hover:text-gray-900 dark:hover:text-gray-100 transition-colors">联系我们</a></li>
            </ul>
          </nav>
        </div>

        {/* 版权信息 */}
        <div className="mt-10 pt-8 border-t border-gray-200 dark:border-gray-800 text-center text-sm text-gray-500 dark:text-gray-400">
          <p>&copy; {currentYear} 求职 Agent. 保留所有权利.</p>
        </div>
      </div>
    </footer>
  );
});
