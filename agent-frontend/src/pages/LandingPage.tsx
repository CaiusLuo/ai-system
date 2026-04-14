import { memo, useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useSEO } from '../hooks/useSEO';
import {
  generateFAQPageLD,
  generateOrganizationLD,
  generateWebApplicationLD,
  injectStructuredData,
  removeStructuredData,
} from '../utils/structuredData';
import { HeroBackgroundMotion, SoftGridMotion } from '../remotion';

const SITE_URL = 'https://job-workbench.example.com';
const LOGO_URL = '/logo.svg';
const OG_IMAGE_URL = '/og-image.jpg';
const BRAND_NAME = '求职工作台';

const FEATURES = [
  {
    badge: '01',
    title: '岗位清单管理',
    description: '按行业、城市、优先级整理目标岗位，避免重复投递和信息遗漏。',
  },
  {
    badge: '02',
    title: '简历版本维护',
    description: '为不同岗位准备简历版本，统一记录修改点与投递关联关系。',
  },
  {
    badge: '03',
    title: '投递进度追踪',
    description: '标记每次投递、笔试和面试状态，让后续跟进更有节奏。',
  },
  {
    badge: '04',
    title: '岗位匹配整理',
    description: '围绕 JD 要求梳理匹配点，帮助你更快判断是否值得投入时间。',
  },
  {
    badge: '05',
    title: '反馈与复盘',
    description: '沉淀投递反馈与面试记录，逐步形成可复用的求职方法。',
  },
  {
    badge: '06',
    title: '个人求职面板',
    description: '将岗位、简历和会话聚合到同一工作台，长期使用也保持清晰。',
  },
];

const FAQ_ITEMS = [
  {
    question: '这个产品适合哪些人使用？',
    answer: '适合正在求职或准备跳槽的用户。无论是应届生、转行用户还是有经验的求职者，都可以用它统一管理岗位、简历和投递进度。',
  },
  {
    question: '主要能解决什么问题？',
    answer: '主要解决信息分散和流程混乱的问题。你可以把岗位筛选、简历调整和投递记录集中在同一个工作台内，减少遗漏和重复劳动。',
  },
  {
    question: '是否支持长期追踪投递过程？',
    answer: '支持。你可以持续记录每个岗位的状态变化与反馈内容，便于后续复盘和策略调整。',
  },
  {
    question: '注册后数据会保留吗？',
    answer: '会。注册后可保存会话和求职记录，后续登录可以继续在原有进度上操作。',
  },
];

export default function LandingPage() {
  const navigate = useNavigate();

  useSEO({
    title: `${BRAND_NAME} - 岗位匹配与求职管理平台`,
    description: `${BRAND_NAME}用于集中管理岗位信息、简历版本与投递进度，帮助你更有条理地完成求职准备。`,
    keywords: '求职管理,岗位匹配,简历优化,投递追踪,求职工作台,职业服务平台',
    canonicalUrl: SITE_URL,
    ogTitle: `${BRAND_NAME} - 更清晰的求职工作台`,
    ogDescription: '聚合岗位、整理简历、追踪投递进度，帮助你更稳定地推进求职流程。',
    ogImage: OG_IMAGE_URL,
    ogSiteName: BRAND_NAME,
    twitterTitle: `${BRAND_NAME} - 求职管理平台`,
    twitterDescription: '更有条理地管理岗位、简历和投递过程。',
    twitterImage: OG_IMAGE_URL,
  });

  useEffect(() => {
    injectStructuredData(
      'ld-webapp',
      generateWebApplicationLD({
        name: BRAND_NAME,
        description: '用于岗位匹配、简历维护与投递追踪的求职管理平台',
        url: SITE_URL,
        applicationCategory: 'JobSearchApplication',
        offers: {
          price: '0',
          priceCurrency: 'CNY',
        },
      })
    );

    injectStructuredData(
      'ld-org',
      generateOrganizationLD({
        name: BRAND_NAME,
        url: SITE_URL,
        logo: LOGO_URL,
      })
    );

    injectStructuredData('ld-faq', generateFAQPageLD(FAQ_ITEMS));

    return () => {
      removeStructuredData('ld-webapp');
      removeStructuredData('ld-org');
      removeStructuredData('ld-faq');
    };
  }, []);

  return (
    <div className="min-h-screen bg-[var(--app-canvas)] text-[var(--text-primary)]">
      <Header onNavigateChat={() => navigate('/chat')} />

      <main>
        <HeroSection onNavigateChat={() => navigate('/chat')} />
        <FeaturesSection />
        <ContentSection />
        <FAQSection />
        <CTASection onNavigateChat={() => navigate('/chat')} />
      </main>

      <Footer />
    </div>
  );
}

interface HeaderProps {
  onNavigateChat: () => void;
}

const Header = memo(function Header({ onNavigateChat }: HeaderProps) {
  return (
    <header className="sticky top-0 z-40 border-b border-[var(--border-subtle)] bg-[rgba(247,247,245,0.86)] backdrop-blur-md">
      <nav
        className="mx-auto flex h-16 w-full max-w-6xl items-center justify-between px-4 sm:px-6 lg:px-8"
        role="navigation"
        aria-label="主导航"
      >
        <a href="/" className="flex items-center gap-3" aria-label={`${BRAND_NAME} - 首页`}>
          <div className="flex h-9 w-9 items-center justify-center rounded-xl border border-[var(--border-subtle)] bg-[var(--surface-raised)] text-[var(--accent-700)] shadow-[var(--shadow-soft)]">
            <svg className="h-5 w-5" fill="none" stroke="currentColor" viewBox="0 0 24 24" aria-hidden="true">
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={1.8}
                d="M4 7.5h16M6.5 4.5h11A1.5 1.5 0 0119 6v12a1.5 1.5 0 01-1.5 1.5h-11A1.5 1.5 0 015 18V6a1.5 1.5 0 011.5-1.5zm2.5 7h6m-6 3h4"
              />
            </svg>
          </div>
          <div>
            <span className="block text-sm font-semibold tracking-tight text-[var(--text-primary)]">{BRAND_NAME}</span>
            <span className="block text-[11px] text-[var(--text-muted)]">岗位匹配与投递管理</span>
          </div>
        </a>

        <div className="hidden items-center gap-7 sm:flex">
          <a href="#features" className="text-sm text-[var(--text-secondary)] transition-colors hover:text-[var(--text-primary)]">
            功能
          </a>
          <a href="#about" className="text-sm text-[var(--text-secondary)] transition-colors hover:text-[var(--text-primary)]">
            介绍
          </a>
          <a href="#faq" className="text-sm text-[var(--text-secondary)] transition-colors hover:text-[var(--text-primary)]">
            常见问题
          </a>
        </div>

        <button onClick={onNavigateChat} className="btn-primary h-10 px-4 text-sm">
          进入工作台
        </button>
      </nav>
    </header>
  );
});

interface HeroSectionProps {
  onNavigateChat: () => void;
}

function HeroSection({ onNavigateChat }: HeroSectionProps) {
  return (
    <section className="relative overflow-hidden border-b border-[var(--border-subtle)] py-16 sm:py-20" aria-labelledby="hero-heading">
      <div className="pointer-events-none absolute inset-0">
        <HeroBackgroundMotion className="absolute inset-0" opacity={0.5} />
      </div>

      <div className="relative mx-auto w-full max-w-6xl px-4 sm:px-6 lg:px-8">
        <div className="mx-auto max-w-3xl text-center">
          <p className="inline-flex items-center rounded-full border border-[var(--border-subtle)] bg-[var(--surface-raised)] px-3 py-1 text-xs font-medium text-[var(--accent-700)]">
            岗位匹配与求职管理
          </p>

          <h1 id="hero-heading" className="mt-5 text-3xl font-semibold leading-tight tracking-tight text-[var(--text-primary)] sm:text-4xl lg:text-[2.75rem]">
            把岗位、简历和投递进度
            <br className="hidden sm:block" />
            整理在一个求职工作台中
          </h1>

          <p className="mx-auto mt-5 max-w-2xl text-base leading-relaxed text-[var(--text-secondary)] sm:text-lg">
            聚合岗位信息，维护简历版本，持续追踪每次投递与反馈。让求职准备更有条理，日常使用更稳定。
          </p>

          <div className="mt-8 flex flex-col items-center justify-center gap-3 sm:flex-row">
            <button onClick={onNavigateChat} className="btn-primary h-11 w-full px-5 text-sm sm:w-auto">
              开始使用
            </button>
            <a href="#features" className="btn-secondary h-11 w-full px-5 text-sm sm:w-auto">
              查看功能
            </a>
          </div>

          <div className="mt-8 flex flex-wrap items-center justify-center gap-x-6 gap-y-2 text-sm text-[var(--text-muted)]">
            <span>流程清晰</span>
            <span>记录可追踪</span>
            <span>长期可复用</span>
          </div>
        </div>
      </div>
    </section>
  );
}

const FeaturesSection = memo(function FeaturesSection() {
  return (
    <section id="features" className="relative py-16 sm:py-20" aria-labelledby="features-heading">
      <div className="pointer-events-none absolute inset-0">
        <SoftGridMotion className="absolute inset-0" opacity={0.24} />
      </div>

      <div className="relative mx-auto w-full max-w-6xl px-4 sm:px-6 lg:px-8">
        <div className="mb-10 text-center sm:mb-12">
          <h2 id="features-heading" className="text-2xl font-semibold tracking-tight text-[var(--text-primary)] sm:text-3xl">
            支撑求职流程的核心能力
          </h2>
          <p className="mx-auto mt-3 max-w-2xl text-[15px] leading-relaxed text-[var(--text-secondary)] sm:text-base">
            从岗位筛选到投递复盘，围绕实际使用场景提供清晰的工作面板。
          </p>
        </div>

        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {FEATURES.map((feature) => (
            <article key={feature.title} className="surface-panel p-5 sm:p-6">
              <div className="mb-3 inline-flex rounded-md bg-[var(--accent-050)] px-2 py-1 text-xs font-semibold text-[var(--accent-700)]">
                {feature.badge}
              </div>
              <h3 className="text-base font-semibold text-[var(--text-primary)]">{feature.title}</h3>
              <p className="mt-2 text-sm leading-relaxed text-[var(--text-secondary)]">{feature.description}</p>
            </article>
          ))}
        </div>
      </div>
    </section>
  );
});

const ContentSection = memo(function ContentSection() {
  return (
    <section id="about" className="border-y border-[var(--border-subtle)] bg-[var(--surface-soft)] py-16 sm:py-20" aria-labelledby="about-heading">
      <div className="mx-auto w-full max-w-6xl px-4 sm:px-6 lg:px-8">
        <div className="mx-auto max-w-3xl">
          <h2 id="about-heading" className="text-center text-2xl font-semibold tracking-tight text-[var(--text-primary)] sm:text-3xl">
            更清晰地管理你的求职过程
          </h2>

          <article className="mt-8 space-y-6 text-[15px] leading-7 text-[var(--text-secondary)] sm:text-base">
            <p>
              这个平台关注的是求职过程管理：把岗位线索、简历准备、投递进度和反馈记录放在同一处，帮助你减少遗漏并形成稳定节奏。
            </p>
            <p>
              当目标岗位较多时，最常见的问题是信息分散。通过统一面板，你可以快速查看当前优先岗位、已投递岗位和待跟进任务，避免重复操作。
            </p>
            <p>
              在持续使用过程中，你还能沉淀一套自己的复盘资料。每次面试反馈和简历调整都可以关联到岗位上下文，让后续决策更有依据。
            </p>
          </article>
        </div>
      </div>
    </section>
  );
});

const FAQSection = memo(function FAQSection() {
  return (
    <section id="faq" className="py-16 sm:py-20" aria-labelledby="faq-heading">
      <div className="mx-auto w-full max-w-6xl px-4 sm:px-6 lg:px-8">
        <div className="mb-10 text-center sm:mb-12">
          <h2 id="faq-heading" className="text-2xl font-semibold tracking-tight text-[var(--text-primary)] sm:text-3xl">
            常见问题
          </h2>
          <p className="mt-3 text-[15px] text-[var(--text-secondary)] sm:text-base">
            使用前你可能关心的几个问题
          </p>
        </div>

        <div className="mx-auto max-w-3xl space-y-3.5">
          {FAQ_ITEMS.map((item) => (
            <FAQItem key={item.question} question={item.question} answer={item.answer} />
          ))}
        </div>
      </div>
    </section>
  );
});

interface FAQItemProps {
  question: string;
  answer: string;
}

function FAQItem({ question, answer }: FAQItemProps) {
  const [open, setOpen] = useState(false);

  return (
    <details open={open} className="surface-panel overflow-hidden">
      <summary
        className="flex cursor-pointer list-none items-center justify-between px-5 py-4 text-left"
        onClick={(event) => {
          event.preventDefault();
          setOpen(!open);
        }}
        role="button"
        aria-expanded={open}
      >
        <span className="pr-4 text-sm font-medium text-[var(--text-primary)] sm:text-[15px]">{question}</span>
        <svg
          className={`h-4 w-4 flex-shrink-0 text-[var(--text-muted)] transition-transform ${open ? 'rotate-180' : ''}`}
          fill="none"
          stroke="currentColor"
          viewBox="0 0 24 24"
          aria-hidden="true"
        >
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
        </svg>
      </summary>
      <div className="border-t border-[var(--border-subtle)] px-5 pb-4 pt-3.5 text-sm leading-relaxed text-[var(--text-secondary)]">
        {answer}
      </div>
    </details>
  );
}

interface CTASectionProps {
  onNavigateChat: () => void;
}

function CTASection({ onNavigateChat }: CTASectionProps) {
  return (
    <section className="py-16 sm:py-20" aria-labelledby="cta-heading">
      <div className="mx-auto w-full max-w-6xl px-4 sm:px-6 lg:px-8">
        <div className="surface-panel px-6 py-10 text-center sm:px-10 sm:py-12">
          <h2 id="cta-heading" className="text-2xl font-semibold tracking-tight text-[var(--text-primary)] sm:text-3xl">
            从今天开始整理你的求职进度
          </h2>
          <p className="mx-auto mt-3 max-w-xl text-[15px] leading-relaxed text-[var(--text-secondary)] sm:text-base">
            统一管理岗位、简历和投递记录，减少重复操作，提升执行效率。
          </p>
          <button onClick={onNavigateChat} className="btn-primary mt-7 h-11 px-6 text-sm">
            进入工作台
          </button>
        </div>
      </div>
    </section>
  );
}

const Footer = memo(function Footer() {
  const year = new Date().getFullYear();

  return (
    <footer className="border-t border-[var(--border-subtle)] bg-[var(--surface-raised)]" role="contentinfo">
      <div className="mx-auto grid w-full max-w-6xl grid-cols-1 gap-8 px-4 py-10 sm:px-6 lg:grid-cols-3 lg:px-8">
        <div>
          <div className="mb-3 flex items-center gap-2.5">
            <div className="flex h-8 w-8 items-center justify-center rounded-lg border border-[var(--border-subtle)] bg-[var(--surface-soft)] text-[var(--accent-700)]">
              <svg className="h-[18px] w-[18px]" fill="none" stroke="currentColor" viewBox="0 0 24 24" aria-hidden="true">
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth={1.8}
                  d="M4 7.5h16M6.5 4.5h11A1.5 1.5 0 0119 6v12a1.5 1.5 0 01-1.5 1.5h-11A1.5 1.5 0 015 18V6a1.5 1.5 0 011.5-1.5z"
                />
              </svg>
            </div>
            <span className="text-sm font-semibold text-[var(--text-primary)]">{BRAND_NAME}</span>
          </div>
          <p className="text-sm leading-relaxed text-[var(--text-secondary)]">
            聚合岗位、整理简历、追踪投递进度，帮助你更有条理地完成求职准备。
          </p>
        </div>

        <nav aria-label="快速链接">
          <h3 className="mb-3 text-sm font-semibold text-[var(--text-primary)]">快速链接</h3>
          <ul className="space-y-2 text-sm text-[var(--text-secondary)]">
            <li>
              <a href="#features" className="transition-colors hover:text-[var(--text-primary)]">
                功能介绍
              </a>
            </li>
            <li>
              <a href="#about" className="transition-colors hover:text-[var(--text-primary)]">
                使用说明
              </a>
            </li>
            <li>
              <a href="#faq" className="transition-colors hover:text-[var(--text-primary)]">
                常见问题
              </a>
            </li>
          </ul>
        </nav>

        <nav aria-label="法律信息">
          <h3 className="mb-3 text-sm font-semibold text-[var(--text-primary)]">法律信息</h3>
          <ul className="space-y-2 text-sm text-[var(--text-secondary)]">
            <li>
              <a href="/privacy" className="transition-colors hover:text-[var(--text-primary)]">
                隐私政策
              </a>
            </li>
            <li>
              <a href="/terms" className="transition-colors hover:text-[var(--text-primary)]">
                使用条款
              </a>
            </li>
            <li>
              <a href="/contact" className="transition-colors hover:text-[var(--text-primary)]">
                联系我们
              </a>
            </li>
          </ul>
        </nav>
      </div>

      <div className="border-t border-[var(--border-subtle)] px-4 py-5 text-center text-xs text-[var(--text-muted)] sm:px-6 lg:px-8">
        © {year} {BRAND_NAME}. 保留所有权利。
      </div>
    </footer>
  );
});
