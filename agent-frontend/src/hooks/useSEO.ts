// SEO 管理模块 - 动态更新页面 meta 标签
// 适用于 SPA 的 SEO 解决方案：通过 JS 动态更新 document head

export interface SEOConfig {
  // 基础 SEO
  title: string;
  description: string;
  keywords?: string;
  canonicalUrl?: string;

  // Open Graph (Facebook, LinkedIn, 微信等)
  ogTitle?: string;
  ogDescription?: string;
  ogImage?: string;
  ogType?: string; // 'website' | 'article' | 'product'
  ogSiteName?: string;

  // Twitter Card
  twitterCard?: string; // 'summary' | 'summary_large_image'
  twitterTitle?: string;
  twitterDescription?: string;
  twitterImage?: string;

  // 其他
  noindex?: boolean; // 禁止搜索引擎索引
  follow?: boolean;  // 允许跟踪链接
}

const DEFAULT_CONFIG: Partial<SEOConfig> = {
  ogType: 'website',
  twitterCard: 'summary_large_image',
};

/**
 * SEO Hook - 在组件中调用此函数更新页面 SEO
 * 
 * 用法:
 * useSEO({
 *   title: '求职工作台 - 岗位匹配与投递管理',
 *   description: '...',
 *   keywords: '求职管理,岗位匹配,简历优化',
 * });
 */
export function useSEO(config: SEOConfig): void {
  const mergedConfig = { ...DEFAULT_CONFIG, ...config };

  // 更新 title
  document.title = mergedConfig.title;

  // 更新基础 meta 标签
  updateMeta('description', mergedConfig.description);
  if (mergedConfig.keywords) {
    updateMeta('keywords', mergedConfig.keywords);
  }

  // 规范 URL（防止重复内容）
  if (mergedConfig.canonicalUrl) {
    updateCanonicalUrl(mergedConfig.canonicalUrl);
  }

  // robots 指令
  updateRobots(mergedConfig.noindex, mergedConfig.follow);

  // Open Graph
  updateMetaProperty('og:title', mergedConfig.ogTitle || mergedConfig.title);
  updateMetaProperty('og:description', mergedConfig.ogDescription || mergedConfig.description);
  if (mergedConfig.ogImage) {
    updateMetaProperty('og:image', mergedConfig.ogImage);
  }
  if (mergedConfig.ogType) {
    updateMetaProperty('og:type', mergedConfig.ogType);
  }
  updateMetaProperty('og:site_name', mergedConfig.ogSiteName || '求职工作台');
  updateMetaProperty('og:locale', 'zh_CN');

  // Twitter Card
  updateMetaName('twitter:card', mergedConfig.twitterCard || 'summary_large_image');
  updateMetaName('twitter:title', mergedConfig.twitterTitle || mergedConfig.title);
  updateMetaName(
    'twitter:description',
    mergedConfig.twitterDescription || mergedConfig.description
  );
  if (mergedConfig.twitterImage) {
    updateMetaName('twitter:image', mergedConfig.twitterImage);
  }
}

function updateMeta(name: string, content: string): void {
  let el = document.querySelector(`meta[name="${name}"]`);
  if (!el) {
    el = document.createElement('meta');
    el.setAttribute('name', name);
    document.head.appendChild(el);
  }
  el.setAttribute('content', content);
}

function updateMetaName(name: string, content: string): void {
  let el = document.querySelector(`meta[name="${name}"]`);
  if (!el) {
    el = document.createElement('meta');
    el.setAttribute('name', name);
    document.head.appendChild(el);
  }
  el.setAttribute('content', content);
}

function updateMetaProperty(property: string, content: string): void {
  let el = document.querySelector(`meta[property="${property}"]`);
  if (!el) {
    el = document.createElement('meta');
    el.setAttribute('property', property);
    document.head.appendChild(el);
  }
  el.setAttribute('content', content);
}

function updateCanonicalUrl(url: string): void {
  let el = document.querySelector('link[rel="canonical"]');
  if (!el) {
    el = document.createElement('link');
    el.setAttribute('rel', 'canonical');
    document.head.appendChild(el);
  }
  el.setAttribute('href', url);
}

function updateRobots(noindex?: boolean, follow?: boolean): void {
  const content = `${noindex ? 'noindex' : 'index'}, ${follow !== false ? 'follow' : 'nofollow'}`;
  updateMeta('robots', content);
}
