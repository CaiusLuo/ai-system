// 结构化数据 (JSON-LD) 生成器
// 用于向搜索引擎提供结构化信息，提高搜索结果的丰富度

export interface OrganizationData {
  name: string;
  url: string;
  logo?: string;
  sameAs?: string[]; // 社交媒体链接
}

export interface ProductData {
  name: string;
  description: string;
  image?: string;
  brand?: string;
  offers?: {
    price: string;
    priceCurrency: string;
    availability: string;
  };
}

export interface FAQItem {
  question: string;
  answer: string;
}

export interface ArticleData {
  headline: string;
  description: string;
  image?: string;
  datePublished: string;
  dateModified?: string;
  author: string;
}

/**
 * 生成 Organization JSON-LD
 */
export function generateOrganizationLD(data: OrganizationData): string {
  return JSON.stringify({
    '@context': 'https://schema.org',
    '@type': 'Organization',
    name: data.name,
    url: data.url,
    ...(data.logo && { logo: data.logo }),
    ...(data.sameAs && { sameAs: data.sameAs }),
  });
}

/**
 * 生成 WebApplication JSON-LD
 */
export function generateWebApplicationLD(data: {
  name: string;
  description: string;
  url: string;
  applicationCategory?: string;
  operatingSystem?: string;
  offers?: {
    price: string;
    priceCurrency: string;
  };
  aggregateRating?: {
    ratingValue: string;
    reviewCount: string;
  };
}): string {
  return JSON.stringify({
    '@context': 'https://schema.org',
    '@type': 'WebApplication',
    name: data.name,
    description: data.description,
    url: data.url,
    applicationCategory: data.applicationCategory || 'JobSearchApplication',
    operatingSystem: data.operatingSystem || 'Any',
    browserRequirements: 'Requires JavaScript',
    ...(data.offers && {
      offers: {
        '@type': 'Offer',
        price: data.offers.price,
        priceCurrency: data.offers.priceCurrency,
      },
    }),
    ...(data.aggregateRating && {
      aggregateRating: {
        '@type': 'AggregateRating',
        ratingValue: data.aggregateRating.ratingValue,
        reviewCount: data.aggregateRating.reviewCount,
      },
    }),
  });
}

/**
 * 生成 FAQ JSON-LD（提高搜索权重，可能出现富摘要结果）
 */
export function generateFAQPageLD(items: FAQItem[]): string {
  return JSON.stringify({
    '@context': 'https://schema.org',
    '@type': 'FAQPage',
    mainEntity: items.map((item) => ({
      '@type': 'Question',
      name: item.question,
      acceptedAnswer: {
        '@type': 'Answer',
        text: item.answer,
      },
    })),
  });
}

/**
 * 生成 Article JSON-LD
 */
export function generateArticleLD(data: ArticleData): string {
  return JSON.stringify({
    '@context': 'https://schema.org',
    '@type': 'Article',
    headline: data.headline,
    description: data.description,
    ...(data.image && { image: data.image }),
    datePublished: data.datePublished,
    ...(data.dateModified && { dateModified: data.dateModified }),
    author: {
      '@type': 'Person',
      name: data.author,
    },
  });
}

/**
 * 生成 BreadcrumbList JSON-LD（面包屑导航）
 */
export function generateBreadcrumbLD(items: { name: string; url: string }[]): string {
  return JSON.stringify({
    '@context': 'https://schema.org',
    '@type': 'BreadcrumbList',
    itemListElement: items.map((item, index) => ({
      '@type': 'ListItem',
      position: index + 1,
      name: item.name,
      item: item.url,
    })),
  });
}

/**
 * 将 JSON-LD 注入到页面
 */
export function injectStructuredData(id: string, data: string): void {
  let el = document.getElementById(id);
  if (!el) {
    el = document.createElement('script');
    el.id = id;
    (el as HTMLScriptElement).type = 'application/ld+json';
    document.head.appendChild(el);
  }
  el.textContent = data;
}

/**
 * 移除 JSON-LD 数据
 */
export function removeStructuredData(id: string): void {
  const el = document.getElementById(id);
  if (el) {
    el.remove();
  }
}
