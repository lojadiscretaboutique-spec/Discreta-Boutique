import { 
  collection, 
  doc, 
  getDoc, 
  getDocs, 
  setDoc, 
  updateDoc, 
  deleteDoc, 
  query, 
  where, 
  orderBy, 
  limit, 
  serverTimestamp, 
  increment 
} from 'firebase/firestore';
import { db, auth } from '../lib/firebase';

export enum OperationType {
  CREATE = 'create',
  UPDATE = 'update',
  DELETE = 'delete',
  LIST = 'list',
  GET = 'get',
  WRITE = 'write',
}

interface FirestoreErrorInfo {
  error: string;
  operationType: OperationType;
  path: string | null;
  authInfo: {
    userId?: string | null;
    email?: string | null;
  }
}

function handleFirestoreError(error: unknown, operationType: OperationType, path: string | null): never {
  const errInfo: FirestoreErrorInfo = {
    error: error instanceof Error ? error.message : String(error),
    authInfo: {
      userId: auth.currentUser?.uid || null,
      email: auth.currentUser?.email || null,
    },
    operationType,
    path
  };
  console.error('Firestore Error: ', JSON.stringify(errInfo));
  throw new Error(JSON.stringify(errInfo));
}

export interface BlogContentBlock {
  id: string;
  type: 'paragraph' | 'heading' | 'image' | 'youtube' | 'table' | 'cta' | 'faq' | 'product_grid' | 'quote' | 'divider' | 'bullet_list' | 'numbered_list' | 'callout' | 'conclusion';
  level?: 2 | 3 | 4;
  content?: string;
  url?: string;
  path?: string;
  width?: number;
  height?: number;
  sizeKb?: number;
  alt?: string;
  caption?: string;
  videoId?: string;
  headers?: string[];
  rows?: string[][];
  style?: 'primary' | 'secondary' | 'whatsapp' | 'outline' | 'info' | 'warning' | 'tip';
  newTab?: boolean;
  question?: string;
  answer?: string;
  productIds?: string[];
  items?: string[];
}

export interface FAQItem {
  question: string;
  answer: string;
}

export interface BlogPost {
  id?: string;
  title: string;
  slug: string;
  subtitle?: string;
  summary?: string;
  content: string;
  contentBlocks?: BlogContentBlock[];
  coverImage?: string;
  gallery?: string[];
  categoryId?: string;
  tags?: string[];
  authorId?: string;
  publishedAt?: string | null;
  scheduledAt?: string | null;
  status: 'rascunho' | 'publicado' | 'agendado' | 'arquivado' | 'trash';
  featured?: boolean;
  relatedPosts?: string[];
  relatedProducts?: string[];
  relatedCategories?: string[];
  readingTime?: number;
  clusterId?: string;
  clusterType?: 'pillar' | 'cluster' | '';
  seo?: {
    title?: string;
    description?: string;
    canonical?: string;
    keywords?: string;
    ogImage?: string;
    twitterImage?: string;
    faq?: FAQItem[];
  };
  createdAt?: any;
  updatedAt?: any;
  views?: number;
}

export interface BlogCluster {
  id?: string;
  title: string;
  slug: string;
  description?: string;
  mainKeyword: string;
  secondaryKeywords?: string[];
  pillarPostId: string;
  clusterPostIds: string[];
  relatedCategoryIds?: string[];
  relatedProductIds?: string[];
  internalLinks?: { text: string; url: string }[];
  status: 'active' | 'inactive';
  priority?: number;
  createdAt?: string;
  updatedAt?: string;
}

export interface BlogCategory {
  id?: string;
  name: string;
  slug: string;
  description?: string;
}

export interface BlogTag {
  id?: string;
  name: string;
  slug: string;
}

export interface BlogComment {
  id?: string;
  postId: string;
  postTitle?: string;
  authorName: string;
  authorEmail: string;
  content: string;
  status: 'pending' | 'approved' | 'spam' | 'rejected';
  createdAt: any;
}

export interface BlogSettings {
  id?: string;
  blogName: string;
  blogDescription?: string;
  postsPerPage?: number;
  commentsModerated?: boolean;
  seo?: {
    title?: string;
    description?: string;
    canonical?: string;
    keywords?: string;
  };
}

export interface BlogAuthor {
  id?: string;
  name: string;
  avatarUrl?: string;
  bio?: string;
  role?: string;
}

export interface BlogStatistic {
  id?: string;
  postId?: string;
  postTitle?: string;
  views: number;
  clicks: number;
  shares: number;
  avgTime: number; // in seconds
  source?: string;
  date: string; // YYYY-MM-DD
}

export const blogService = {
  // Post operations
  async listPosts(includeHidden = false): Promise<BlogPost[]> {
    const path = 'blog_posts';
    try {
      const colRef = collection(db, path);
      let q = query(colRef, orderBy('createdAt', 'desc'));
      
      const snap = await getDocs(q);
      const posts = snap.docs.map(d => ({ id: d.id, ...d.data() } as BlogPost));
      if (!includeHidden) {
        return posts.filter(p => {
          if (p.status === 'publicado') return true;
          if (p.status === 'agendado' && p.publishedAt) {
            return new Date(p.publishedAt) <= new Date();
          }
          return false;
        });
      }
      return posts;
    } catch (e) {
      handleFirestoreError(e, OperationType.LIST, path);
    }
  },

  async getPostBySlug(slug: string): Promise<BlogPost | null> {
    const path = 'blog_posts';
    try {
      const colRef = collection(db, path);
      const q = query(colRef, where('slug', '==', slug), limit(1));
      const snap = await getDocs(q);
      if (snap.empty) return null;
      const d = snap.docs[0];
      return { id: d.id, ...d.data() } as BlogPost;
    } catch (e) {
      handleFirestoreError(e, OperationType.GET, `${path}/slug/${slug}`);
    }
  },

  async getPostById(id: string): Promise<BlogPost | null> {
    const path = `blog_posts/${id}`;
    try {
      const snap = await getDoc(doc(db, 'blog_posts', id));
      if (!snap.exists()) return null;
      return { id: snap.id, ...snap.data() } as BlogPost;
    } catch (e) {
      handleFirestoreError(e, OperationType.GET, path);
    }
  },

  async savePost(id: string | undefined, post: Omit<BlogPost, 'id' | 'createdAt' | 'updatedAt'>): Promise<string> {
    const postId = id || doc(collection(db, 'blog_posts')).id;
    const path = `blog_posts/${postId}`;
    try {
      const postRef = doc(db, 'blog_posts', postId);
      
      // Calculate reading time roughly: 200 words per minute
      const plainText = post.content.replace(/[#*`_\[\]]/g, '');
      const wordCount = plainText.trim().split(/\s+/).length || 0;
      const readingTime = Math.max(1, Math.ceil(wordCount / 200));

      const payload = {
        ...post,
        readingTime,
        updatedAt: serverTimestamp()
      } as any;

      if (!id) {
        payload.createdAt = serverTimestamp();
        payload.views = 0;
      }

      await setDoc(postRef, payload, { merge: true });
      return postId;
    } catch (e) {
      handleFirestoreError(e, OperationType.WRITE, path);
    }
  },

  async incrementPostViews(id: string): Promise<void> {
    const path = `blog_posts/${id}`;
    try {
      const postRef = doc(db, 'blog_posts', id);
      await updateDoc(postRef, {
        views: increment(1)
      });
    } catch (e) {
      handleFirestoreError(e, OperationType.WRITE, path);
    }
  },

  async deletePostPermanently(id: string): Promise<void> {
    const path = `blog_posts/${id}`;
    try {
      await deleteDoc(doc(db, 'blog_posts', id));
    } catch (e) {
      handleFirestoreError(e, OperationType.DELETE, path);
    }
  },

  // Category operations
  async listCategories(): Promise<BlogCategory[]> {
    const path = 'blog_categories';
    try {
      const snap = await getDocs(query(collection(db, path), orderBy('name', 'asc')));
      return snap.docs.map(d => ({ id: d.id, ...d.data() } as BlogCategory));
    } catch (e) {
      handleFirestoreError(e, OperationType.LIST, path);
    }
  },

  async saveCategory(id: string | undefined, category: Omit<BlogCategory, 'id'>): Promise<string> {
    const categoryId = id || doc(collection(db, 'blog_categories')).id;
    const path = `blog_categories/${categoryId}`;
    try {
      await setDoc(doc(db, 'blog_categories', categoryId), category, { merge: true });
      return categoryId;
    } catch (e) {
      handleFirestoreError(e, OperationType.WRITE, path);
    }
  },

  async deleteCategory(id: string): Promise<void> {
    const path = `blog_categories/${id}`;
    try {
      await deleteDoc(doc(db, 'blog_categories', id));
    } catch (e) {
      handleFirestoreError(e, OperationType.DELETE, path);
    }
  },

  // Tag operations
  async listTags(): Promise<BlogTag[]> {
    const path = 'blog_tags';
    try {
      const snap = await getDocs(query(collection(db, path), orderBy('name', 'asc')));
      return snap.docs.map(d => ({ id: d.id, ...d.data() } as BlogTag));
    } catch (e) {
      handleFirestoreError(e, OperationType.LIST, path);
    }
  },

  async saveTag(id: string | undefined, tag: Omit<BlogTag, 'id'>): Promise<string> {
    const tagId = id || doc(collection(db, 'blog_tags')).id;
    const path = `blog_tags/${tagId}`;
    try {
      await setDoc(doc(db, 'blog_tags', tagId), tag, { merge: true });
      return tagId;
    } catch (e) {
      handleFirestoreError(e, OperationType.WRITE, path);
    }
  },

  async deleteTag(id: string): Promise<void> {
    const path = `blog_tags/${id}`;
    try {
      await deleteDoc(doc(db, 'blog_tags', id));
    } catch (e) {
      handleFirestoreError(e, OperationType.DELETE, path);
    }
  },

  // Author operations
  async listAuthors(): Promise<BlogAuthor[]> {
    const path = 'blog_authors';
    try {
      const snap = await getDocs(collection(db, path));
      return snap.docs.map(d => ({ id: d.id, ...d.data() } as BlogAuthor));
    } catch (e) {
      handleFirestoreError(e, OperationType.LIST, path);
    }
  },

  async saveAuthor(id: string | undefined, author: Omit<BlogAuthor, 'id'>): Promise<string> {
    const authorId = id || doc(collection(db, 'blog_authors')).id;
    const path = `blog_authors/${authorId}`;
    try {
      await setDoc(doc(db, 'blog_authors', authorId), author, { merge: true });
      return authorId;
    } catch (e) {
      handleFirestoreError(e, OperationType.WRITE, path);
    }
  },

  // Comment operations
  async listComments(postId?: string): Promise<BlogComment[]> {
    const path = 'blog_comments';
    try {
      const colRef = collection(db, path);
      let q = query(colRef, orderBy('createdAt', 'desc'));
      if (postId) {
        q = query(colRef, where('postId', '==', postId), orderBy('createdAt', 'desc'));
      }
      const snap = await getDocs(q);
      return snap.docs.map(d => ({ id: d.id, ...d.data() } as BlogComment));
    } catch (e) {
      handleFirestoreError(e, OperationType.LIST, path);
    }
  },

  async saveComment(comment: Omit<BlogComment, 'id' | 'createdAt'>): Promise<string> {
    const commentId = doc(collection(db, 'blog_comments')).id;
    const path = `blog_comments/${commentId}`;
    try {
      await setDoc(doc(db, 'blog_comments', commentId), {
        ...comment,
        createdAt: serverTimestamp()
      });
      return commentId;
    } catch (e) {
      handleFirestoreError(e, OperationType.WRITE, path);
    }
  },

  async moderateComment(id: string, status: 'approved' | 'spam' | 'rejected'): Promise<void> {
    const path = `blog_comments/${id}`;
    try {
      await updateDoc(doc(db, 'blog_comments', id), { status });
    } catch (e) {
      handleFirestoreError(e, OperationType.WRITE, path);
    }
  },

  async deleteComment(id: string): Promise<void> {
    const path = `blog_comments/${id}`;
    try {
      await deleteDoc(doc(db, 'blog_comments', id));
    } catch (e) {
      handleFirestoreError(e, OperationType.DELETE, path);
    }
  },

  // Settings operations
  async getSettings(): Promise<BlogSettings | null> {
    const path = 'blog_settings/main';
    try {
      const snap = await getDoc(doc(db, 'blog_settings', 'main'));
      if (!snap.exists()) return null;
      return { id: snap.id, ...snap.data() } as BlogSettings;
    } catch (e) {
      handleFirestoreError(e, OperationType.GET, path);
    }
  },

  async saveSettings(settings: Omit<BlogSettings, 'id'>): Promise<void> {
    const path = 'blog_settings/main';
    try {
      await setDoc(doc(db, 'blog_settings', 'main'), settings, { merge: true });
    } catch (e) {
      handleFirestoreError(e, OperationType.WRITE, path);
    }
  },

  // Statistics operations
  async listStatistics(): Promise<BlogStatistic[]> {
    const path = 'blog_statistics';
    try {
      const snap = await getDocs(collection(db, path));
      return snap.docs.map(d => ({ id: d.id, ...d.data() } as BlogStatistic));
    } catch (e) {
      handleFirestoreError(e, OperationType.LIST, path);
    }
  },

  async listStats(): Promise<BlogStatistic[]> {
    return this.listStatistics();
  },

  async logStat(postId: string | undefined, postTitle: string | undefined, type: 'view' | 'click' | 'share', source = 'direct'): Promise<void> {
    const todayStr = new Date().toISOString().split('T')[0];
    const statId = `${postId || 'general'}_${type}_${source}_${todayStr}`;
    const path = `blog_statistics/${statId}`;
    try {
      const statRef = doc(db, 'blog_statistics', statId);
      await setDoc(statRef, {
        postId: postId || 'general',
        postTitle: postTitle || 'Geral',
        actionType: type,
        views: type === 'view' ? increment(1) : increment(0),
        clicks: type === 'click' ? increment(1) : increment(0),
        shares: type === 'share' ? increment(1) : increment(0),
        avgTime: 0,
        source,
        date: todayStr
      }, { merge: true });
    } catch (e) {
      handleFirestoreError(e, OperationType.WRITE, path);
    }
  },

  // SEO Cluster Methods
  async listClusters(): Promise<BlogCluster[]> {
    const path = 'blog_clusters';
    try {
      const snap = await getDocs(collection(db, path));
      return snap.docs.map(d => ({ id: d.id, ...d.data() } as BlogCluster));
    } catch (e) {
      handleFirestoreError(e, OperationType.LIST, path);
    }
  },

  async getCluster(clusterId: string): Promise<BlogCluster | null> {
    const path = `blog_clusters/${clusterId}`;
    try {
      const docRef = doc(db, 'blog_clusters', clusterId);
      const snap = await getDoc(docRef);
      if (snap.exists()) {
        return { id: snap.id, ...snap.data() } as BlogCluster;
      }
      return null;
    } catch (e) {
      handleFirestoreError(e, OperationType.GET, path);
    }
  },

  async createCluster(cluster: Partial<BlogCluster>): Promise<string> {
    const path = 'blog_clusters';
    try {
      const collRef = collection(db, path);
      const docRef = doc(collRef);
      const clusterData = {
        title: cluster.title || "",
        slug: cluster.slug || "",
        description: cluster.description || "",
        mainKeyword: cluster.mainKeyword || "",
        secondaryKeywords: cluster.secondaryKeywords || [],
        pillarPostId: cluster.pillarPostId || "",
        clusterPostIds: cluster.clusterPostIds || [],
        relatedCategoryIds: cluster.relatedCategoryIds || [],
        relatedProductIds: cluster.relatedProductIds || [],
        internalLinks: cluster.internalLinks || [],
        status: cluster.status || "active",
        priority: cluster.priority || 1,
        createdAt: cluster.createdAt || new Date().toISOString(),
        updatedAt: new Date().toISOString()
      };
      await setDoc(docRef, clusterData);
      return docRef.id;
    } catch (e) {
      handleFirestoreError(e, OperationType.WRITE, path);
    }
  },

  async updateCluster(clusterId: string, cluster: Partial<BlogCluster>): Promise<void> {
    const path = `blog_clusters/${clusterId}`;
    try {
      const docRef = doc(db, 'blog_clusters', clusterId);
      const updateData: any = {
        ...cluster,
        updatedAt: new Date().toISOString()
      };
      delete updateData.id;
      await updateDoc(docRef, updateData);
    } catch (e) {
      handleFirestoreError(e, OperationType.WRITE, path);
    }
  },

  async deleteCluster(clusterId: string): Promise<void> {
    const path = `blog_clusters/${clusterId}`;
    try {
      const docRef = doc(db, 'blog_clusters', clusterId);
      await deleteDoc(docRef);
    } catch (e) {
      handleFirestoreError(e, OperationType.DELETE, path);
    }
  }
};
