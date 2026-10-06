interface WorkProject {
  name: string;
  desc: string;
  icon?: string;
  tags?: string[];
  status?: string;
  statusText?: string;
  link?: string;
  linkText?: string;
}

interface FriendLink {
  name?: string;
  link?: string;
  avatar?: string;
  descr?: string;
}

interface Window {
  globalFn?: { themeChange?: { giscus?: (mode: string) => void } };
  WORKS_DATA?: WorkProject[];
  __FLINK_DATA?: { class_name?: string; link_list?: FriendLink[] }[];
  __SITE_STATS?: { postCount: number };
}

declare const hexo: import('hexo');
declare const GLOBAL_CONFIG: { lightbox?: string; localSearch?: { path: string; top_n_per_article?: number } };
declare class LocalSearch {
  constructor(options: { path: string; unescape: boolean; top_n_per_article: number });
  datas: { title: string; content: string; url: string }[];
  getResultItems(keywords: string[]): { item: string; includedCount: number; hitCount: number; id: number }[];
  highlightSearchWords(body: HTMLElement | null): void;
}
interface Window {
  pjax?: { refresh: (container: Element) => void };
  btf?: {
    lightboxDeferred?: boolean;
    loadLightbox: (images: Iterable<HTMLImageElement>) => void;
    getScript: (source: string) => Promise<unknown>;
  };
  Fancybox?: unknown;
}
