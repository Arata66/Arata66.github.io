interface WorkProject {
  name: string;
  desc: string;
  icon?: string;
  tags?: string[];
  status?: string;
  statusText?: string;
}

interface FriendLink {
  name?: string;
  link?: string;
  avatar?: string;
  descr?: string;
}

interface Window {
  WORKS_DATA?: WorkProject[];
  __FLINK_DATA?: { class_name?: string; link_list?: FriendLink[] }[];
  __SITE_STATS?: { postCount: number };
}

declare const hexo: import('hexo');
declare const GLOBAL_CONFIG: { lightbox?: string };
interface Window {
  btf?: {
    lightboxDeferred?: boolean;
    loadLightbox: (images: Iterable<HTMLImageElement>) => void;
    getScript: (source: string) => Promise<unknown>;
  };
  Fancybox?: unknown;
}
