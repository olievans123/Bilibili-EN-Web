export interface BiliVideo {
  bvid: string;
  aid: number;
  title: string;
  titleEn?: string;
  desc: string;
  descEn?: string;
  pic: string;
  duration: number;
  view: number;
  danmaku: number;
  reply: number;
  favorite: number;
  coin: number;
  share: number;
  like: number;
  owner: {
    mid: number;
    name: string;
    nameEn?: string;
    face: string;
  };
  pubdate: number;
  cid?: number;
}

export interface BiliCategory {
  tid: number;
  name: string;
  nameEn: string;
}

export interface BiliUser {
  mid: number;
  name: string;
  face: string;
  sign: string;
  level: number;
  isLogin: boolean;
}

export interface BiliSearchResult {
  videos: BiliVideo[];
  total: number;
  page: number;
  pageSize: number;
}

export interface BiliTrendingResult {
  videos: BiliVideo[];
  error?: string;
  page?: number;
  pageSize?: number;
  total?: number;
  hasMore?: boolean;
}

export interface BiliComment {
  rpid: number;
  oid: number;
  mid: number;
  content: {
    message: string;
    messageEn?: string;
  };
  ctime: number;
  like: number;
  rcount: number;
  member: {
    mid: number;
    uname: string;
    avatar: string;
    level_info: {
      current_level: number;
    };
  };
  replies?: BiliComment[];
}

export interface BiliCommentsResult {
  comments: BiliComment[];
  total: number;
  page: number;
  pageSize?: number;
  hasMore?: boolean;
  nextCursor?: number; // Cursor for next page (page offset for pagination)
  requiresLogin?: boolean; // True if more comments require login to load
  error?: string; // Error message if fetch failed
}

export interface BiliChannel {
  mid: number;
  name: string;
  nameEn?: string;
  face: string;
  sign: string;
  level: number;
  follower: number;
  following: number;
  videoCount: number;
}

export interface BiliChannelVideosResult {
  videos: BiliVideo[];
  total: number;
  page: number;
  pageSize: number;
}

export interface Playlist {
  id: string;
  name: string;
  videos: BiliVideo[];
  createdAt: number;
  updatedAt: number;
}

export const CATEGORIES: BiliCategory[] = [
  { tid: 0, name: '全部', nameEn: 'All' },
  { tid: 1, name: '动画', nameEn: 'Animation' },
  { tid: 13, name: '番剧', nameEn: 'Anime' },
  { tid: 167, name: '国创', nameEn: 'Chinese Anime' },
  { tid: 3, name: '音乐', nameEn: 'Music' },
  { tid: 129, name: '舞蹈', nameEn: 'Dance' },
  { tid: 4, name: '游戏', nameEn: 'Gaming' },
  { tid: 36, name: '知识', nameEn: 'Knowledge' },
  { tid: 188, name: '科技', nameEn: 'Technology' },
  { tid: 234, name: '运动', nameEn: 'Sports' },
  { tid: 223, name: '汽车', nameEn: 'Automotive' },
  { tid: 160, name: '生活', nameEn: 'Lifestyle' },
  { tid: 211, name: '美食', nameEn: 'Food' },
  { tid: 217, name: '动物圈', nameEn: 'Animals' },
  { tid: 119, name: '鬼畜', nameEn: 'Memes' },
  { tid: 155, name: '时尚', nameEn: 'Fashion' },
  { tid: 5, name: '娱乐', nameEn: 'Entertainment' },
  { tid: 181, name: '影视', nameEn: 'Movies & TV' },
  { tid: 177, name: '纪录片', nameEn: 'Documentary' },
  { tid: 23, name: '电影', nameEn: 'Movies' },
  { tid: 11, name: '电视剧', nameEn: 'TV Series' },
];
