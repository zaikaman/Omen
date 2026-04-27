import type { OutboundPost, PostLifecycleEvent, PostStatus } from "@omen/shared";

const transitions: Record<PostStatus, Partial<Record<PostLifecycleEvent, PostStatus>>> = {
  queued: {
    format: "formatting",
    mark_ready: "ready",
    start_posting: "posting",
    fail: "failed",
  },
  formatting: {
    mark_ready: "ready",
    fail: "failed",
  },
  ready: {
    start_posting: "posting",
    fail: "failed",
  },
  posting: {
    mark_posted: "posted",
    fail: "failed",
  },
  posted: {},
  failed: {
    retry: "queued",
  },
};

export const getNextPostStatus = (
  currentStatus: PostStatus,
  event: PostLifecycleEvent,
): PostStatus => {
  const nextStatus = transitions[currentStatus][event];

  if (!nextStatus) {
    throw new Error(
      `Invalid outbound post transition: ${currentStatus} -> ${event}.`,
    );
  }

  return nextStatus;
};

export const transitionPost = (
  post: OutboundPost,
  event: PostLifecycleEvent,
  patch: Partial<OutboundPost> = {},
): OutboundPost => ({
  ...post,
  ...patch,
  status: getNextPostStatus(post.status, event),
  updatedAt: patch.updatedAt ?? new Date().toISOString(),
});

export const isTerminalPostStatus = (status: PostStatus) =>
  status === "posted" || status === "failed";
