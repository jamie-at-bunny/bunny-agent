import type { components as core } from "@bunny.net/openapi-client/generated/core.d.ts";
import type { components as stream } from "@bunny.net/openapi-client/generated/stream.d.ts";
import { defineTool } from "../registry.js";

const STREAM_API = "https://video.bunnycdn.com";

type VideoLibrary = core["schemas"]["VideoLibraryModel"];
type StreamVideo = stream["schemas"]["VideoModel"];
type StreamVideoList = stream["schemas"]["PaginationListOfVideoModel"];

/** The account API can omit ApiKey; the Stream API is unusable without it. */
function libraryApiKey(library: VideoLibrary): string {
  if (!library.ApiKey) {
    throw new Error(`Video library ${library.Id} has no API key`);
  }
  return library.ApiKey;
}

/**
 * The Bunny Stream API (video.bunnycdn.com) authenticates with the video
 * LIBRARY's own ApiKey, not the account key, so it can't go through
 * BunnyClient. Fetch the library via the account API first to get its key.
 */
async function streamApi<T>(
  apiKey: string,
  method: string,
  path: string,
  body?: unknown,
): Promise<T> {
  const res = await fetch(`${STREAM_API}${path}`, {
    method,
    headers: {
      AccessKey: apiKey,
      Accept: "application/json",
      ...(body !== undefined ? { "Content-Type": "application/json" } : {}),
    },
    body: body !== undefined ? JSON.stringify(body) : undefined,
  });

  const text = await res.text();
  if (!res.ok) {
    throw new Error(
      `Bunny Stream API ${method} ${path} failed with ${res.status}: ${text.slice(0, 2000)}`,
    );
  }
  if (!text) return undefined as T;
  try {
    return JSON.parse(text) as T;
  } catch {
    return text as unknown as T;
  }
}

const summarizeLibrary = (library: VideoLibrary) => ({
  id: library.Id,
  name: library.Name,
  video_count: library.VideoCount,
  storage_used_bytes: library.StorageUsage,
  replication_regions: library.ReplicationRegions,
  pull_zone_id: library.PullZoneId,
});

const summarizeVideo = (video: StreamVideo) => ({
  guid: video.guid,
  title: video.title,
  length_seconds: video.length,
  status: video.status,
  storage_size_bytes: video.storageSize,
  date_uploaded: video.dateUploaded,
});

export const listVideoLibraries = defineTool({
  name: "list_video_libraries",
  description:
    "List all Bunny Stream video libraries on the account with their IDs, names, video counts, and storage usage. Does not include credentials — use get_video_library for those.",
  input_schema: { type: "object", properties: {}, additionalProperties: false },
  run: async (client) => {
    const libraries = await client.main<
      VideoLibrary[] | core["schemas"]["PaginationListModelOfVideoLibraryModel"]
    >("GET", "/videolibrary?page=1&perPage=100");
    const list = Array.isArray(libraries) ? libraries : libraries.Items ?? [];
    return list.map(summarizeLibrary);
  },
});

export const createVideoLibrary = defineTool({
  name: "create_video_library",
  description:
    "Create a new Bunny Stream video library (video hosting, transcoding, and delivery). Returns the library details including its API key credentials for the Stream API. Replication region codes: DE, NY, LA, SG, SYD, UK, SE, BR, JH.",
  input_schema: {
    type: "object",
    properties: {
      name: {
        type: "string",
        description: "Name for the new video library",
      },
      replication_regions: {
        type: "array",
        items: { type: "string" },
        description: "Optional replica region codes for geo-replication.",
      },
    },
    required: ["name"],
    additionalProperties: false,
  },
  run: async (client, input) => {
    const library = await client.main<VideoLibrary>("POST", "/videolibrary", {
      Name: input.name,
      ...(input.replication_regions?.length
        ? { ReplicationRegions: input.replication_regions }
        : {}),
    });
    return {
      ...summarizeLibrary(library),
      credentials: {
        library_id: library.Id,
        api_key: library.ApiKey,
        read_only_api_key: library.ReadOnlyApiKey,
        api_example: `curl -H "AccessKey: ${library.ApiKey}" ${STREAM_API}/library/${library.Id}/videos`,
      },
    };
  },
});

export const getVideoLibrary = defineTool({
  name: "get_video_library",
  description:
    "Get details and credentials for an existing video library: name, video count, storage usage, and the library API key used to authenticate against the Stream API (video.bunnycdn.com).",
  input_schema: {
    type: "object",
    properties: {
      library_id: { type: "number", description: "Numeric video library ID" },
    },
    required: ["library_id"],
    additionalProperties: false,
  },
  run: async (client, input) => {
    const library = await client.main<VideoLibrary>(
      "GET",
      `/videolibrary/${input.library_id}`,
    );
    return {
      ...summarizeLibrary(library),
      credentials: {
        library_id: library.Id,
        api_key: library.ApiKey,
        read_only_api_key: library.ReadOnlyApiKey,
      },
    };
  },
});

export const deleteVideoLibrary = defineTool({
  name: "delete_video_library",
  description:
    "Permanently delete a video library and all videos in it. Irreversible. Only call after the user explicitly confirms deleting this specific library.",
  destructive: true,
  input_schema: {
    type: "object",
    properties: {
      library_id: {
        type: "number",
        description: "Numeric video library ID to delete",
      },
    },
    required: ["library_id"],
    additionalProperties: false,
  },
  run: async (client, input) => {
    await client.main("DELETE", `/videolibrary/${input.library_id}`);
    return { deleted: true, library_id: input.library_id };
  },
});

export const listVideos = defineTool({
  name: "list_videos",
  description:
    "List videos in a Bunny Stream video library with their GUIDs, titles, lengths, and processing status. Video status codes: 0 created, 1 uploaded, 2 processing, 3 transcoding, 4 finished, 5 error, 6 upload failed.",
  input_schema: {
    type: "object",
    properties: {
      library_id: { type: "number", description: "Numeric video library ID" },
    },
    required: ["library_id"],
    additionalProperties: false,
  },
  run: async (client, input) => {
    const library = await client.main<VideoLibrary>(
      "GET",
      `/videolibrary/${input.library_id}`,
    );
    const videos = await streamApi<StreamVideoList>(
      libraryApiKey(library),
      "GET",
      `/library/${library.Id}/videos?page=1&itemsPerPage=100`,
    );
    return {
      library_id: library.Id,
      total_videos: videos.totalItems,
      videos: (videos.items ?? []).map(summarizeVideo),
    };
  },
});

export const createVideo = defineTool({
  name: "create_video",
  description:
    "Create a new video entry in a Bunny Stream library. Returns the video GUID and upload instructions — the video file itself is uploaded afterwards via a PUT request with the library API key.",
  input_schema: {
    type: "object",
    properties: {
      library_id: { type: "number", description: "Numeric video library ID" },
      title: { type: "string", description: "Title for the new video" },
    },
    required: ["library_id", "title"],
    additionalProperties: false,
  },
  run: async (client, input) => {
    const library = await client.main<VideoLibrary>(
      "GET",
      `/videolibrary/${input.library_id}`,
    );
    const video = await streamApi<StreamVideo>(
      libraryApiKey(library),
      "POST",
      `/library/${library.Id}/videos`,
      { title: input.title },
    );
    const uploadUrl = `${STREAM_API}/library/${library.Id}/videos/${video.guid}`;
    return {
      ...summarizeVideo(video),
      library_id: library.Id,
      upload: {
        instructions: `Upload the video file with a PUT request to ${uploadUrl} using the library API key in the AccessKey header.`,
        upload_example: `curl -X PUT -H "AccessKey: ${library.ApiKey}" --data-binary @video.mp4 ${uploadUrl}`,
      },
    };
  },
});

export const streamTools = [
  listVideoLibraries,
  createVideoLibrary,
  getVideoLibrary,
  deleteVideoLibrary,
  listVideos,
  createVideo,
];
