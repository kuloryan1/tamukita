import { describe, expect, test } from "vitest";
import { getR2BucketNames } from "@/lib/r2-buckets";

describe("getR2BucketNames", () => {
  test("returns distinct private and public buckets", () => {
    expect(getR2BucketNames({
      R2_PRIVATE_BUCKET_NAME: "tamukita-media-private",
      R2_PUBLIC_BUCKET_NAME: "tamukita-media-public",
    })).toEqual({ privateBucket: "tamukita-media-private", publicBucket: "tamukita-media-public" });
  });

  test("keeps the legacy private bucket alias when it is separate from the public bucket", () => {
    expect(getR2BucketNames({
      R2_BUCKET_NAME: "tamukita-media-private",
      R2_PUBLIC_BUCKET_NAME: "tamukita-media-public",
    })).toEqual({ privateBucket: "tamukita-media-private", publicBucket: "tamukita-media-public" });
  });

  test("rejects a shared bucket even when configured through the legacy alias", () => {
    expect(getR2BucketNames({
      R2_BUCKET_NAME: "tamukita-media",
      R2_PUBLIC_BUCKET_NAME: "tamukita-media",
    })).toBeNull();
  });

  test("trims bucket names before checking whether they are distinct", () => {
    expect(getR2BucketNames({
      R2_PRIVATE_BUCKET_NAME: " tamukita-media ",
      R2_PUBLIC_BUCKET_NAME: "tamukita-media",
    })).toBeNull();
  });

  test("returns null when either bucket is missing", () => {
    expect(getR2BucketNames({ R2_PRIVATE_BUCKET_NAME: "tamukita-media-private" })).toBeNull();
    expect(getR2BucketNames({ R2_PUBLIC_BUCKET_NAME: "tamukita-media-public" })).toBeNull();
  });
});
