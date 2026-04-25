import {
  postFeedResponseSchema,
  postStatusResponseSchema,
  type PostFeedResponse,
  type PostStatusResponse,
} from '@omen/shared';

import { apiRequest } from './client';

export type GetPostsOptions = {
  runId?: string;
  signalId?: string;
  intelId?: string;
};

export const getPosts = async (
  options: GetPostsOptions = {},
): Promise<PostFeedResponse> => {
  const searchParams = new URLSearchParams();

  if (options.runId) {
    searchParams.set('runId', options.runId);
  }

  if (options.signalId) {
    searchParams.set('signalId', options.signalId);
  }

  if (options.intelId) {
    searchParams.set('intelId', options.intelId);
  }

  const suffix = searchParams.size > 0 ? `?${searchParams.toString()}` : '';
  return apiRequest(`/posts${suffix}`, postFeedResponseSchema);
};

export const getPostStatus = (id: string): Promise<PostStatusResponse> =>
  apiRequest(`/posts/${encodeURIComponent(id)}`, postStatusResponseSchema);
