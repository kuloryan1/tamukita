type R2BucketEnvironment = Record<string, string | undefined>;

export function getR2BucketNames(environment: R2BucketEnvironment = process.env) {
  const privateBucket = (environment.R2_PRIVATE_BUCKET_NAME || environment.R2_BUCKET_NAME)?.trim();
  const publicBucket = environment.R2_PUBLIC_BUCKET_NAME?.trim();
  if (!privateBucket || !publicBucket || privateBucket === publicBucket) return null;
  return { privateBucket, publicBucket };
}
