import {
  S3Client,
  GetObjectCommand,
} from "@aws-sdk/client-s3";
import { getSignedUrl } from "@aws-sdk/s3-request-presigner";

export type B2PresignedResult = { url: string; expiresAt: Date };

let b2Client: S3Client | null = null;

function getB2Client(): S3Client | null {
  const endpoint = process.env.B2_ENDPOINT;
  const bucket = process.env.B2_BUCKET;
  const keyId = process.env.B2_KEY_ID;
  const appKey = process.env.B2_APP_KEY;
  const region = process.env.B2_REGION;

  if (!endpoint || !bucket || !keyId || !appKey || !region) {
    return null;
  }

  if (!b2Client) {
    b2Client = new S3Client({
      endpoint,
      region,
      forcePathStyle: true,
      credentials: {
        accessKeyId: keyId,
        secretAccessKey: appKey,
      },
    });
  }
  return b2Client;
}

export function validateB2Key(b2Key: string): boolean {
  if (!b2Key || b2Key.trim() !== b2Key) {
    return false;
  }
  if (b2Key.includes("?") || b2Key.includes("#")) {
    return false;
  }
  return true;
}

const DEFAULT_EXPIRES_IN = 3600;

export async function generateB2PresignedUrl(
  b2Key: string,
  opts?: { expiresIn?: number },
): Promise<B2PresignedResult | null> {
  const client = getB2Client();
  if (!client) return null;
  if (!validateB2Key(b2Key)) return null;

  const bucket = process.env.B2_BUCKET!;
  const expiresIn = opts?.expiresIn ?? DEFAULT_EXPIRES_IN;
  const command = new GetObjectCommand({ Bucket: bucket, Key: b2Key });
  const url = await getSignedUrl(client, command, { expiresIn });
  return {
    url,
    expiresAt: new Date(Date.now() + expiresIn * 1000),
  };
}